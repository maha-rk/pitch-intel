from statsbombpy import sb 
import pandas as pd
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv('backend/.env')

client = Groq(api_key=os.getenv('GROQ_API_KEY'))
GRANITE_MODEL = os.getenv('GRANITE_MODEL', 'ibm/granite-3-3-8b-instruct')

def get_match_events(match_id: int):
    events = sb.events(match_id=match_id)
    return events

def get_world_cup_matches():
    matches = sb.matches(competition_id=43, season_id=3)
    return matches

def get_player_positions(match_id: int):
    events = get_match_events(match_id)
    tracking = events[events['type'] == 'Carry'][['player', 'location', 'minute', 'team']]
    tracking = tracking.dropna(subset=['location'])
    tracking['x'] = tracking['location'].apply(lambda loc: loc[0] if isinstance(loc, list) else None)
    tracking['y'] = tracking['location'].apply(lambda loc: loc[1] if isinstance(loc, list) else None)
    return tracking.dropna(subset=['x', 'y']).to_dict(orient='records')

def narrate_tactical_moment(match_id: int, minute: int):
    events = get_match_events(match_id)
    window = events[(events['minute'] >= minute) & (events['minute'] <= minute + 5)]
    summary = window[['type', 'player', 'team', 'minute']].dropna().to_string()
    
    response = client.chat.completions.create(
        model=GRANITE_MODEL,
        messages=[{
            "role": "user",
            "content": f"You are an expert football analyst. Narrate what is tactically happening in this sequence of match events in 2-3 sentences, focusing on tactical patterns and what it means for the match:\n\n{summary}"
        }],
        max_tokens=200
    )
    return response.choices[0].message.content