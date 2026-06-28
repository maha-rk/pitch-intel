import os
import pandas as pd
from dotenv import load_dotenv
from statsbombpy import sb

load_dotenv('backend/.env')
from backend.granite import client, MODEL
from backend.transparency import LIMITATIONS

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
    symmetry_scores: list[float] = []

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
            foul_events = events[events['type'] == 'Foul Committed']
            fouls = int(len(foul_events))
            shots = int(len(events[events['type'] == 'Shot']))

            # Per-team foul breakdown for symmetry
            home_fouls = int(len(foul_events[foul_events['team'].apply(lambda t: str(t).strip()) == home.strip()]))
            away_fouls = int(len(foul_events[foul_events['team'].apply(lambda t: str(t).strip()) == away.strip()]))
            hi = max(home_fouls, away_fouls)
            lo = min(home_fouls, away_fouls)
            symmetry = round(lo / hi, 2) if hi > 0 else 1.0
        except Exception:
            yellows = reds = fouls = shots = 0
            home_fouls = away_fouls = 0
            symmetry = 1.0

        total_yellows += yellows
        total_reds += reds
        total_fouls += fouls
        total_shots += shots
        symmetry_scores.append(symmetry)

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
            'home_fouls': home_fouls,
            'away_fouls': away_fouls,
            'foul_symmetry': symmetry,
        })

    n = len(match_records)
    avg_symmetry = round(sum(symmetry_scores) / max(len(symmetry_scores), 1), 2)
    # Bias index: how often home team got more fouls called on them (0=never, 1=always)
    home_disadvantaged = sum(1 for m in match_records if m['home_fouls'] > m['away_fouls'])
    home_bias_index = round(home_disadvantaged / max(n, 1), 2)

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
        'avg_foul_symmetry': avg_symmetry,
        'home_bias_index': home_bias_index,
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
FOUL SYMMETRY INDEX: {stats['avg_foul_symmetry']} (1.0 = perfectly equal fouls both sides; 0 = all fouls on one team)
HOME BIAS INDEX: {stats['home_bias_index']} (fraction of matches where home team had more fouls called on them)

MATCH-BY-MATCH RECORD:
{match_lines}

Write a 3-paragraph referee consistency report:
PARAGRAPH 1 — Disciplinary profile: characterise this referee's style (lenient / strict / inconsistent) based on the card and foul averages.
PARAGRAPH 2 — Fairness: comment on the foul symmetry index and home bias — whether this referee called fouls equally between both sides.
PARAGRAPH 3 — Consistency verdict: overall assessment. One punchy closing sentence.

Be specific, cite real numbers from the data, under 160 words total."""

    report = client.chat.completions.create(
        model=MODEL,
        messages=[{'role': 'user', 'content': prompt}],
        max_tokens=250,
    ).choices[0].message.content.strip()

    return {**stats, 'ai_report': report, 'limitations': LIMITATIONS['referee']}
