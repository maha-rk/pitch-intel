import os
import tempfile
from fastapi import FastAPI, File, UploadFile
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
def tactical(match_id: int, minute: int):
    return generate_heatmap_data(match_id, minute)

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
def scout(query: str):
    return search_players(query)

@app.post("/agent/query")
def agent_query(body: dict):
    question = body.get('question', '')
    match_context = body.get('match_context')
    if not question.strip():
        return {'error': 'No question provided'}
    return run_agent(question, match_context)

@app.get("/referees")
def referees():
    return get_referee_list()

@app.get("/referee/{referee_name}")
def referee(referee_name: str):
    return analyse_referee(referee_name)

@app.post("/fan-decoder")
def fan_decoder(body: dict):
    question = body.get('question', '')
    language = body.get('language', 'en')
    history = body.get('history', [])
    answer = decode_question(question, language, history)
    return {"answer": answer}

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

@app.get("/verdict/{match_id}")
def match_verdict(match_id: int, home_team: str, away_team: str, home_score: int = 0, away_score: int = 0):
    from backend.tactical_lens import get_key_moments, get_momentum, get_xg_flow
    from backend.granite import client as groq, MODEL as model
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
            messages=[{"role":"user","content":f"You are a senior football analyst. Based only on the StatsBomb data below, write a single paragraph (3-4 sentences) explaining why this match ended with this result. Be specific — cite xG, momentum, and key moments. Do not speculate beyond the data.\n\n{context}"}],
            max_tokens=250
        )
        return {"verdict": resp.choices[0].message.content, "limitations": LIMITATIONS['tactical']}
    except Exception as e:
        return {"verdict": f"Analysis unavailable: {e}"}

@app.get("/debate/{match_id}")
def debate(match_id: int, home_team: str, away_team: str, home_score: int = 0, away_score: int = 0):
    from backend.debate import run_debate
    from fastapi.responses import JSONResponse
    try:
        return run_debate(match_id, home_team, away_team, home_score, away_score)
    except Exception as e:
        return JSONResponse(status_code=500, content={'error': str(e)})

@app.get("/explainer/{match_id}")
def explainer(match_id: int, home_team: str, away_team: str, match_date: str, briefing_type: str = 'post'):
    from fastapi.responses import JSONResponse
    try:
        return generate_match_briefing(match_id, home_team, away_team, match_date, briefing_type)
    except Exception as e:
        return JSONResponse(status_code=500, content={'error': str(e)})

@app.get("/emotipulse/{match_id}")
def emotipulse(match_id: int, home_team: str, away_team: str):
    from backend.emoti_pulse import generate_emoti_pulse
    from fastapi.responses import JSONResponse
    try:
        return generate_emoti_pulse(match_id, home_team, away_team)
    except Exception as e:
        return JSONResponse(status_code=500, content={'error': str(e)})

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