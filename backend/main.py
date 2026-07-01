import os
import tempfile
from fastapi import FastAPI, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from backend.tactical_lens import get_world_cup_matches, get_key_moments, get_momentum, get_xg_flow, get_shot_map, get_pass_network
from backend.pitch_agent import run_agent
from backend.referee_lens import get_referee_list, analyse_referee
from backend.tactical_lens.heatmap import generate_heatmap_data
from backend.scout_eye import search_players
from backend.fan_decoder import decode_question
from backend.match_explainer import generate_match_briefing
from backend.transparency import LIMITATIONS

app = FastAPI(title="Pitch Intel API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Pitch Intel API is live"}

@app.get("/matches")
def matches():
    df = get_world_cup_matches()
    cols = ['match_id', 'match_date', 'home_team', 'away_team']
    if 'home_score' in df.columns:
        cols += ['home_score', 'away_score']
    return df[cols].to_dict(orient='records')

@app.get("/tactical/{match_id}/{minute}")
def tactical(match_id: int, minute: int, lang: str = Query(default='en')):
    return generate_heatmap_data(match_id, minute, lang)

@app.get("/moments/{match_id}")
def moments(match_id: int):
    return get_key_moments(match_id)

@app.get("/momentum/{match_id}")
def momentum(match_id: int):
    return get_momentum(match_id)

@app.get("/xg-flow/{match_id}")
def xg_flow(match_id: int):
    return get_xg_flow(match_id)

@app.get("/shot-map/{match_id}")
def shot_map(match_id: int):
    return get_shot_map(match_id)

@app.get("/pass-network/{match_id}")
def pass_network(match_id: int):
    return get_pass_network(match_id)

@app.get("/scout/{query}")
def scout(query: str, lang: str = Query(default='en')):
    results = search_players(query, lang=lang)
    return {'results': results, 'limitations': LIMITATIONS['scout_eye'] if results else []}

@app.post("/agent/query")
def agent_query(body: dict):
    question = body.get('question', '')
    match_context = body.get('match_context')
    lang = body.get('lang', 'en')
    if not question.strip():
        return {'error': 'No question provided'}
    return run_agent(question, match_context, lang=lang)

@app.get("/referees")
def referees():
    return get_referee_list()

@app.get("/referee/{referee_name}")
def referee(referee_name: str, lang: str = Query(default='en')):
    return analyse_referee(referee_name, lang=lang)

@app.post("/fan-decoder")
def fan_decoder(body: dict):
    question = body.get('question', '')
    language = body.get('language', 'en')
    history = body.get('history', [])
    answer = decode_question(question, language, history)
    return {"answer": answer, "limitations": LIMITATIONS['fan_decoder']}

@app.on_event("startup")
async def startup_event():
    import threading
    def warm_cache():
        try:
            from backend.scout_eye import get_index
            print("Pre-warming Scout Eye index...")
            get_index()
            print("Scout Eye index ready.")
        except Exception as e:
            print(f"Cache warm failed: {e}")
    threading.Thread(target=warm_cache, daemon=True).start()

    def warm_rag():
        try:
            from backend.var_oracle.rag import get_rag
            print("Pre-warming Docling RAG index...")
            get_rag()
            print("Docling RAG index ready.")
        except Exception as e:
            print(f"RAG warm failed: {e}")
    threading.Thread(target=warm_rag, daemon=True).start()

@app.get("/verdict/{match_id}")
def match_verdict(match_id: int, home_team: str, away_team: str, home_score: int = 0, away_score: int = 0, lang: str = Query(default='en')):
    from backend.tactical_lens import get_key_moments, get_momentum, get_xg_flow
    from backend.granite import client as groq, MODEL as model, lang_instruction
    try:
        moments = get_key_moments(match_id)
        xg = get_xg_flow(match_id)
        mom = get_momentum(match_id)
        goals = [m for m in moments if m.get('type') == 'Goal']
        home_xg = sum(s['xg'] for s in xg if s.get('team') == home_team)
        away_xg = sum(s['xg'] for s in xg if s.get('team') == away_team)
        home_mom = sum(p['score'] for p in mom if p.get('team') == home_team)
        away_mom = sum(p['score'] for p in mom if p.get('team') == away_team)
        subs = [m for m in moments if m.get('type') == 'Substitution']
        goal_strs = [str(g.get('minute')) + "' " + str(g.get('player')) + " (" + str(g.get('team')) + ")" for g in goals]
        context = (
            f"Match: {home_team} {home_score} – {away_score} {away_team}\n"
            f"xG: {home_team} {home_xg:.2f} vs {away_team} {away_xg:.2f}\n"
            f"Momentum index: {home_team} {home_mom:.0f} vs {away_team} {away_mom:.0f}\n"
            f"Goals: {goal_strs}\n"
            f"Substitutions: {len(subs)} total"
        )
        resp = groq.chat.completions.create(
            model=model,
            messages=[{"role":"user","content":f"{lang_instruction(lang)}You are a senior football analyst. Based only on the StatsBomb data below, write a single paragraph (3-4 sentences) explaining why this match ended with this result. Be specific — cite xG, momentum, and key moments. Do not speculate beyond the data.\n\n{context}"}],
            max_tokens=250
        )
        return {"verdict": resp.choices[0].message.content, "limitations": LIMITATIONS['tactical']}
    except Exception as e:
        return {"verdict": f"Analysis unavailable: {e}"}

@app.get("/debate/{match_id}")
def debate(match_id: int, home_team: str, away_team: str, home_score: int = 0, away_score: int = 0, lang: str = Query(default='en')):
    from backend.langflow_pipeline import run_debate_flow
    from fastapi.responses import JSONResponse
    try:
        return run_debate_flow(match_id, home_team, away_team, home_score, away_score, lang=lang)
    except Exception as e:
        return JSONResponse(status_code=500, content={'error': str(e)})

@app.get("/explainer/{match_id}")
def explainer(match_id: int, home_team: str, away_team: str, match_date: str, briefing_type: str = 'post', lang: str = Query(default='en')):
    from fastapi.responses import JSONResponse
    try:
        return generate_match_briefing(match_id, home_team, away_team, match_date, briefing_type, lang=lang)
    except Exception as e:
        return JSONResponse(status_code=500, content={'error': str(e)})

@app.get("/emotipulse/{match_id}")
def emotipulse(match_id: int, home_team: str, away_team: str, lang: str = Query(default='en')):
    from backend.emoti_pulse import generate_emoti_pulse
    from fastapi.responses import JSONResponse
    try:
        return generate_emoti_pulse(match_id, home_team, away_team, lang=lang)
    except Exception as e:
        return JSONResponse(status_code=500, content={'error': str(e)})

@app.get("/match-companion/{match_id}")
def match_companion(match_id: int, home_team: str, away_team: str, lang: str = Query(default='en')):
    from backend.audio_match import generate_companion
    from fastapi.responses import JSONResponse
    try:
        return generate_companion(match_id, home_team, away_team, lang=lang)
    except Exception as e:
        return JSONResponse(status_code=500, content={'error': str(e)})

@app.get("/what-if/{match_id}")
def what_if(match_id: int, home_team: str, away_team: str, remove_index: int = -1, lang: str = Query(default='en')):
    from backend.what_if import run_what_if
    from fastapi.responses import JSONResponse
    try:
        ri = remove_index if remove_index >= 0 else None
        return run_what_if(match_id, home_team, away_team, remove_index=ri, lang=lang)
    except Exception as e:
        return JSONResponse(status_code=500, content={'error': str(e)})

@app.post("/var-oracle/ask")
def var_oracle_ask(body: dict):
    from backend.granite import client as groq, MODEL as model, lang_instruction
    question = body.get('question', '').strip()
    register = body.get('register', 'fan')
    lang = body.get('lang', 'en')
    if not question:
        return {'error': 'No question provided'}
    if register == 'fan':
        prompt = (
            f"{lang_instruction(lang)}"
            "You are a friendly football commentator explaining rules to a casual fan in the stadium. "
            "IMPORTANT: Do NOT use technical jargon or quote Law text verbatim. "
            "Instead, explain the rule as you would to a 14-year-old who loves football but has never read the rulebook. "
            "Use everyday analogies and plain English. You may briefly mention which Law covers it at the end in brackets. "
            "Keep it conversational and under 3 sentences. "
            f"Question: {question}"
        )
    else:
        prompt = (
            f"{lang_instruction(lang)}"
            "You are a FIFA referee instructor writing for a qualified match analyst. "
            "Cite the exact Law number and clause. Quote the precise FIFA wording where relevant. "
            "Address edge cases, referee discretion, and VAR protocol where applicable. "
            "Use technical terminology — DOGSO, IDFK, encroachment, etc. Be comprehensive and exact. "
            "Structure: Law reference first, then the rule, then any edge cases. "
            f"Question: {question}"
        )
    try:
        resp = groq.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=320
        )
        answer = resp.choices[0].message.content or ''
        import re as _re
        # Match "Law N" only as a whole token — prevents "Law 1" matching inside "Law 17"
        found_laws = [int(m) for m in _re.findall(r'\bLaw\s+(\d+)\b', answer, _re.IGNORECASE)]
        has_law_ref = bool(found_laws)
        completeness = 'COMPLETE' if has_law_ref else 'PARTIAL'
        law_ref = f'Law {found_laws[0]}' if found_laws else None
        return {
            'answer': answer,
            'completeness': completeness,
            'law_ref': law_ref,
            'limitations': LIMITATIONS['var_oracle'],
        }
    except Exception as e:
        return {'error': str(e)}

@app.post("/var-oracle/analyse")
async def var_oracle_analyse(file: UploadFile = File(...)):
    from backend.var_oracle import analyse_clip
    from fastapi.responses import JSONResponse
    suffix = os.path.splitext(file.filename or 'clip.mp4')[1] or '.mp4'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        return analyse_clip(tmp_path, filename=file.filename or '')
    except ValueError as e:
        return JSONResponse(status_code=422, content={'error': str(e), 'detail': 'OpenCV could not open the video file. Ensure it is a valid MP4/MOV/AVI clip.'})
    except Exception as e:
        return JSONResponse(status_code=500, content={'error': str(e)})
    finally:
        os.unlink(tmp_path)