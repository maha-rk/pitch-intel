from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.tactical_lens import get_world_cup_matches, get_key_moments, get_momentum
from backend.tactical_lens.heatmap import generate_heatmap_data
from backend.scout_eye import search_players

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