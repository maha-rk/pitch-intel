import os
import tempfile
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from backend.tactical_lens import get_world_cup_matches, get_key_moments, get_momentum
from backend.tactical_lens.heatmap import generate_heatmap_data
from backend.scout_eye import search_players
from backend.fan_decoder import decode_question
from backend.match_explainer import generate_match_briefing

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

@app.get("/scout/{query}")
def scout(query: str):
    return search_players(query)

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

@app.get("/explainer/{match_id}")
def explainer(match_id: int, home_team: str, away_team: str, match_date: str, briefing_type: str = 'post'):
    return generate_match_briefing(match_id, home_team, away_team, match_date, briefing_type)

@app.get("/emotipulse/{match_id}")
def emotipulse(match_id: int, home_team: str, away_team: str):
    from backend.emoti_pulse import generate_emoti_pulse
    return generate_emoti_pulse(match_id, home_team, away_team)

@app.post("/var-oracle/analyse")
async def var_oracle_analyse(file: UploadFile = File(...)):
    from backend.var_oracle import analyse_clip
    suffix = os.path.splitext(file.filename or 'clip.mp4')[1] or '.mp4'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        return analyse_clip(tmp_path, filename=file.filename or '')
    finally:
        os.unlink(tmp_path)