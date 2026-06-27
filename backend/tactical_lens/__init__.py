from statsbombpy import sb
import pandas as pd
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv('backend/.env')

client = Groq(api_key=os.getenv('GROQ_API_KEY'))
GRANITE_MODEL = os.getenv('GRANITE_MODEL', 'llama-3.3-70b-versatile')

def get_match_events(match_id: int):
    events = sb.events(match_id=match_id)
    return events

def get_world_cup_matches():
    matches_2018 = sb.matches(competition_id=43, season_id=3)
    try:
        matches_2022 = sb.matches(competition_id=43, season_id=106)
        combined = pd.concat([matches_2022, matches_2018], ignore_index=True)
        return combined
    except:
        return matches_2018

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

def get_key_moments(match_id: int):
    events = get_match_events(match_id)
    key_types = ['Goal', 'Yellow Card', 'Red Card', 'Substitution', 'Shot']
    key = events[events['type'].isin(key_types)][['type', 'minute', 'player', 'team']].dropna(subset=['minute'])
    key = key.sort_values('minute')
    moments = []
    for _, row in key.iterrows():
        player = str(row.get('player', ''))
        moments.append({
            'type': row['type'],
            'minute': int(row['minute']),
            'player': player if player != 'nan' else '',
            'team': str(row.get('team', ''))
        })
    return moments[:25]

def get_momentum(match_id: int):
    events = get_match_events(match_id)
    teams = events['team'].dropna().unique().tolist()
    if len(teams) < 2:
        return []
    momentum = []
    for minute in range(0, 91, 5):
        window = events[(events['minute'] >= minute) & (events['minute'] < minute + 5)]
        for team in teams:
            team_events = window[window['team'] == team]
            score = len(team_events[team_events['type'].isin(['Pass', 'Carry'])]) + \
                    len(team_events[team_events['type'] == 'Shot']) * 3 + \
                    len(team_events[team_events['type'] == 'Pressure']) * 2
            momentum.append({'minute': minute, 'team': team, 'score': int(score)})
    return momentum