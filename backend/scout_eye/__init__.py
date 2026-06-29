import os
import pandas as pd
import numpy as np
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from concurrent.futures import ThreadPoolExecutor
import faiss

load_dotenv('backend/.env')

from backend.granite import client, MODEL, lang_instruction
encoder = SentenceTransformer('all-MiniLM-L6-v2')

def build_player_index():
    df = pd.read_parquet('data/statsbomb/shots.parquet')
    
    players = df.groupby('player').agg(
        team=('team', 'last'),
        competition=('competition_name', 'last'),
        total_shots=('player', 'count'),
        goals=('is_goal', 'sum'),
        avg_xg=('xg_statsbomb', 'mean'),
        avg_distance=('distance_to_goal', 'mean'),
        avg_angle=('angle_to_goal', 'mean'),
        under_pressure_shots=('under_pressure', 'sum'),
        headers=('shot_body_part_name', lambda x: (x == 'Head').sum()),
        left_foot=('shot_body_part_name', lambda x: (x == 'Left Foot').sum()),
        right_foot=('shot_body_part_name', lambda x: (x == 'Right Foot').sum()),
    ).reset_index()

    players['conversion_rate'] = (players['goals'] / players['total_shots'] * 100).round(1)
    players = players[players['total_shots'] >= 3].reset_index(drop=True)

    descriptions = []
    for _, p in players.iterrows():
        desc = (
            f"{p['player']} plays for {p['team']} in {p['competition']}. "
            f"Shot stats: {p['total_shots']} shots, {int(p['goals'])} goals, "
            f"{p['conversion_rate']}% conversion rate. "
            f"Average xG per shot: {p['avg_xg']:.3f}. "
            f"Average distance to goal: {p['avg_distance']:.1f}m. "
            f"Average angle: {p['avg_angle']:.1f} degrees. "
            f"Shots under pressure: {int(p['under_pressure_shots'])}. "
            f"Headers: {int(p['headers'])}, Right foot: {int(p['right_foot'])}, Left foot: {int(p['left_foot'])}."
        )
        descriptions.append(desc)

    print(f"Encoding {len(descriptions)} players...")
    embeddings = encoder.encode(descriptions, show_progress_bar=True, batch_size=64)
    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings.astype(np.float32))
    print("Index built.")

    return index, players.to_dict(orient='records'), descriptions

_cache = None

def get_index():
    global _cache
    if _cache is None:
        _cache = build_player_index()
    return _cache

def _generate_report(p, desc, lang='en'):
    report = client.chat.completions.create(
        model=MODEL,
        messages=[{
            "role": "user",
            "content": lang_instruction(lang) + f"Generate a concise 3-sentence scouting report for this footballer based on their shooting data. Focus on finishing ability, shot quality, and style:\n\n{desc}"
        }],
        max_tokens=150
    )
    shots = int(p['total_shots'])
    return {
        'name': p['player'],
        'team': p['team'],
        'competition': p['competition'],
        'top_actions': [
            ['Total Shots', shots],
            ['Goals', int(p['goals'])],
            ['Conversion %', float(p['conversion_rate'])],
            ['Avg xG', round(float(p['avg_xg']), 3)],
        ],
        'scouting_report': report.choices[0].message.content,
        'radar': {
            'shots': min(shots, 150),
            'goals': min(int(p['goals']), 30),
            'conversion': float(p['conversion_rate']),
            'xg_quality': round(float(p['avg_xg']) * 100, 1),
            'headers': round(int(p['headers']) / max(shots, 1) * 100, 1),
            'pressure': round(int(p['under_pressure_shots']) / max(shots, 1) * 100, 1),
        },
    }

def search_players(query: str, top_k: int = 3, lang: str = 'en'):
    index, player_list, descriptions = get_index()

    query_embedding = encoder.encode([query]).astype(np.float32)
    distances, indices = index.search(query_embedding, top_k)

    matched = [(player_list[idx], descriptions[idx]) for idx in indices[0]]
    with ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(lambda args: _generate_report(*args, lang=lang), matched))

    return results