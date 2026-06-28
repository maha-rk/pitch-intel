import os
import pandas as pd
from groq import Groq
from dotenv import load_dotenv
from statsbombpy import sb

load_dotenv('backend/.env')
client = Groq(api_key=os.getenv('GROQ_API_KEY'))
MODEL = os.getenv('GRANITE_MODEL', 'llama-3.3-70b-versatile')

_matches_cache: pd.DataFrame | None = None


def _get_all_matches() -> pd.DataFrame:
    global _matches_cache
    if _matches_cache is None:
        m18 = sb.matches(competition_id=43, season_id=3)
        try:
            m22 = sb.matches(competition_id=43, season_id=106)
            _matches_cache = pd.concat([m22, m18], ignore_index=True)
        except Exception:
            _matches_cache = m18
    return _matches_cache


def get_referee_list() -> list[dict]:
    matches = _get_all_matches()
    if 'referee' not in matches.columns:
        return []

    referees = []
    for ref, group in matches.groupby('referee'):
        if not ref or (isinstance(ref, float) and pd.isna(ref)):
            continue
        ref_name = str(ref)
        country = ''
        if 'referee_country_name' in group.columns:
            c = group['referee_country_name'].dropna()
            country = str(c.iloc[0]) if len(c) else ''
        referees.append({
            'name': ref_name,
            'country': country,
            'matches': int(len(group)),
            'match_ids': group['match_id'].tolist(),
        })

    return sorted(referees, key=lambda r: r['matches'], reverse=True)


def get_referee_stats(referee_name: str) -> dict:
    matches = _get_all_matches()
    ref_matches = matches[matches['referee'] == referee_name]
    if ref_matches.empty:
        return {'error': f'Referee {referee_name} not found'}

    match_records = []
    total_yellows = total_reds = total_fouls = total_shots = 0

    for _, row in ref_matches.iterrows():
        match_id = int(row['match_id'])
        home = str(row.get('home_team', ''))
        away = str(row.get('away_team', ''))
        date = str(row.get('match_date', ''))
        home_score = row.get('home_score')
        away_score = row.get('away_score')
        stage = str(row.get('competition_stage', ''))

        try:
            events = sb.events(match_id=match_id)
            yellows = int(len(events[
                events['type'].isin(['Foul Committed', 'Bad Behaviour']) &
                events.apply(lambda e: 'Yellow' in str(e.get('foul_committed_card', '') or '') or
                             'Yellow' in str(e.get('bad_behaviour_card', '') or ''), axis=1)
            ]))
            reds = int(len(events[
                events['type'].isin(['Foul Committed', 'Bad Behaviour']) &
                events.apply(lambda e: 'Red' in str(e.get('foul_committed_card', '') or '') or
                             'Red' in str(e.get('bad_behaviour_card', '') or ''), axis=1)
            ]))
            fouls = int(len(events[events['type'] == 'Foul Committed']))
            shots = int(len(events[events['type'] == 'Shot']))
        except Exception:
            yellows = reds = fouls = shots = 0

        total_yellows += yellows
        total_reds += reds
        total_fouls += fouls
        total_shots += shots

        match_records.append({
            'match_id': match_id,
            'home': home,
            'away': away,
            'date': date,
            'score': f"{int(home_score) if pd.notna(home_score) else '?'}–{int(away_score) if pd.notna(away_score) else '?'}",
            'stage': stage,
            'yellows': yellows,
            'reds': reds,
            'fouls': fouls,
            'shots': shots,
        })

    n = len(match_records)
    summary = {
        'referee': referee_name,
        'matches_officiated': n,
        'total_yellow_cards': total_yellows,
        'total_red_cards': total_reds,
        'total_fouls': total_fouls,
        'avg_yellows_per_match': round(total_yellows / max(n, 1), 1),
        'avg_reds_per_match': round(total_reds / max(n, 1), 2),
        'avg_fouls_per_match': round(total_fouls / max(n, 1), 1),
        'avg_shots_per_match': round(total_shots / max(n, 1), 1),
        'matches': match_records,
    }

    return summary


def analyse_referee(referee_name: str) -> dict:
    stats = get_referee_stats(referee_name)
    if 'error' in stats:
        return stats

    match_lines = '\n'.join(
        f"  {m['date']} — {m['home']} {m['score']} {m['away']} ({m['stage']}) "
        f"| {m['yellows']}Y {m['reds']}R {m['fouls']} fouls"
        for m in stats['matches']
    )

    prompt = f"""You are a football referee analyst assessing consistency for the IBM SkillsBuild World Cup AI Challenge.

REFEREE: {referee_name}
MATCHES OFFICIATED: {stats['matches_officiated']}
AVERAGE YELLOWS / MATCH: {stats['avg_yellows_per_match']}
AVERAGE REDS / MATCH: {stats['avg_reds_per_match']}
AVERAGE FOULS CALLED / MATCH: {stats['avg_fouls_per_match']}

MATCH-BY-MATCH RECORD:
{match_lines}

Write a 3-paragraph referee consistency report:
PARAGRAPH 1 — Disciplinary profile: characterise this referee's style (lenient / strict / inconsistent) based on the card and foul averages.
PARAGRAPH 2 — Notable matches: reference 1-2 specific matches where card counts were notably high or low and what that suggests.
PARAGRAPH 3 — Consistency verdict: overall assessment of how consistent this referee was across their matches. One punchy closing sentence.

Be specific, cite real numbers from the data, under 150 words total."""

    report = client.chat.completions.create(
        model=MODEL,
        messages=[{'role': 'user', 'content': prompt}],
        max_tokens=250,
    ).choices[0].message.content.strip()

    return {**stats, 'ai_report': report}
