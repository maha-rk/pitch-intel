import os
from dotenv import load_dotenv
from statsbombpy import sb
import pandas as pd

load_dotenv('backend/.env')

from backend.granite import client, MODEL, lang_instruction
from backend.transparency import LIMITATIONS

def get_match_stats(match_id: int):
    events = sb.events(match_id=match_id)
    teams = events['team'].dropna().unique().tolist()
    if len(teams) < 2:
        return {}
    stats = {}
    for team in teams:
        te = events[events['team'] == team]
        stats[team] = {
            'passes': int(len(te[te['type'] == 'Pass'])),
            'shots': int(len(te[te['type'] == 'Shot'])),
            'pressures': int(len(te[te['type'] == 'Pressure'])),
            'carries': int(len(te[te['type'] == 'Carry'])),
            'tackles': int(len(te[te['type'] == 'Tackle'])),
        }
    return stats

def generate_match_briefing(match_id: int, home_team: str, away_team: str, match_date: str, briefing_type: str = 'post', lang: str = 'en'):
    stats = get_match_stats(match_id)
    stats_text = ''
    for team, s in stats.items():
        stats_text += f"\n{team}: {s['passes']} passes, {s['shots']} shots, {s['pressures']} pressures, {s['carries']} carries, {s['tackles']} tackles"

    if briefing_type == 'pre':
        prompt = f"""You are an elite football analyst writing a pre-match briefing for {home_team} vs {away_team} on {match_date}.
Write a compelling 3-paragraph pre-match analysis covering:
1. Key tactical battle to watch
2. Which team has the advantage and why
3. The player who could be decisive
Keep it punchy and analytical like a Sky Sports analyst."""
    else:
        prompt = f"""You are an elite football analyst writing a post-match briefing for {home_team} vs {away_team} on {match_date}.

Real match statistics:
{stats_text}

Write a compelling 3-paragraph post-match analysis covering:
1. How the match unfolded tactically based on these stats
2. Which team dominated and why the stats tell that story
3. The key tactical insight from this match
Be specific about the numbers. Like a Guardian football correspondent."""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": lang_instruction(lang) + prompt}],
        max_tokens=400
    )
    return {
        'briefing': response.choices[0].message.content,
        'limitations': LIMITATIONS['match_explainer'],
        'stats': stats,
        'match': f"{home_team} vs {away_team}",
        'date': match_date,
        'type': briefing_type
    }
