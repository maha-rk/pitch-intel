import os
import pandas as pd
from dotenv import load_dotenv

load_dotenv('backend/.env')

from backend.granite import client, MODEL, lang_instruction
from backend.transparency import LIMITATIONS


def _safe_name(val) -> str:
    if isinstance(val, dict):
        return val.get('name', '')
    return str(val) if pd.notna(val) else ''


def _safe_bool(val) -> bool:
    try:
        return bool(val) and not (isinstance(val, float) and pd.isna(val))
    except Exception:
        return False


def _process_events(events: pd.DataFrame, home_team: str, away_team: str) -> tuple[dict, list, dict]:
    """Single pass: build emotion windows, chronological timeline, and score tracking."""
    windows: dict[int, dict] = {}
    timeline: list[dict] = []
    score = {home_team: 0, away_team: 0}

    def add_window(minute, pts, label=None):
        w = (int(minute) // 5) * 5
        if w not in windows:
            windows[w] = {'score': 0, 'labels': [], 'first_minute': int(minute)}
        windows[w]['score'] += pts
        if label and len(windows[w]['labels']) < 3:
            windows[w]['labels'].append(label)
            # Track the actual minute of the first labelled event
            if len(windows[w]['labels']) == 1:
                windows[w]['first_minute'] = int(minute)

    sorted_events = events.sort_values('minute')

    for _, ev in sorted_events.iterrows():
        t = _safe_name(ev.get('type', ''))
        m = int(ev.get('minute', 0))
        team = _safe_name(ev.get('team', ''))
        player = _safe_name(ev.get('player', ''))

        if t == 'Shot':
            outcome = _safe_name(ev.get('shot_outcome'))
            if outcome == 'Goal':
                score[team] = score.get(team, 0) + 1
                h = score[home_team]
                a = score[away_team]
                label = f'GOAL – {player} ({team})'
                add_window(m, 100, label)
                timeline.append({
                    'minute': m,
                    'type': 'goal',
                    'text': f"{m}' GOAL – {player} ({team}) → {home_team} {h}–{a} {away_team}",
                    'score': f'{h}–{a}',
                })
            elif outcome == 'Saved':
                add_window(m, 28, f'Shot saved – {team}')
                timeline.append({'minute': m, 'type': 'save', 'text': f"{m}' Shot saved – {player} ({team})"})
            elif outcome == 'Post':
                add_window(m, 22, f'Hit the post – {team}')
                timeline.append({'minute': m, 'type': 'post', 'text': f"{m}' Hit the post – {player} ({team})"})
            elif outcome == 'Blocked':
                add_window(m, 14)
            else:
                add_window(m, 8)

        elif t == 'Foul Committed':
            card = _safe_name(ev.get('foul_committed_card')) or _safe_name(ev.get('bad_behaviour_card'))
            if 'Red' in card:
                add_window(m, 65, f'RED CARD – {player}')
                timeline.append({'minute': m, 'type': 'red_card', 'text': f"{m}' RED CARD – {player} ({team})"})
            elif 'Yellow/Red' in card or 'Second Yellow' in card:
                add_window(m, 55, f'2nd Yellow → Red – {player}')
                timeline.append({'minute': m, 'type': 'red_card', 'text': f"{m}' SECOND YELLOW → RED – {player} ({team})"})
            elif 'Yellow' in card:
                add_window(m, 18, f'Yellow card – {player}')
                timeline.append({'minute': m, 'type': 'yellow_card', 'text': f"{m}' Yellow card – {player} ({team})"})
            else:
                add_window(m, 6)

        elif t == 'Bad Behaviour':
            card = _safe_name(ev.get('bad_behaviour_card'))
            if 'Red' in card:
                add_window(m, 65, f'RED CARD – {player}')
                timeline.append({'minute': m, 'type': 'red_card', 'text': f"{m}' RED CARD (bad behaviour) – {player} ({team})"})
            elif 'Yellow' in card:
                add_window(m, 18, f'Yellow card – {player}')
                timeline.append({'minute': m, 'type': 'yellow_card', 'text': f"{m}' Yellow card – {player} ({team})"})

        elif t == 'Pass':
            if _safe_bool(ev.get('pass_goal_assist')):
                add_window(m, 45, f'Goal assist – {player}')
            elif _safe_bool(ev.get('pass_shot_assist')):
                add_window(m, 14)

        elif t == 'Dribble':
            if _safe_name(ev.get('dribble_outcome')) == 'Complete':
                add_window(m, 5)

        elif t == 'Pressure':
            add_window(m, 1)

        elif t == 'Clearance':
            add_window(m, 3)

    return windows, timeline, score


def get_emotion_arc(match_id: int, home_team: str = '', away_team: str = '') -> dict:
    from statsbombpy import sb
    try:
        events = sb.events(match_id=match_id)
    except Exception as e:
        return {'error': str(e)}

    windows, timeline, final_score = _process_events(events, home_team, away_team)

    max_minute = max(windows.keys(), default=90) + 5
    arc = []
    for minute in range(0, max_minute + 5, 5):
        w = windows.get(minute, {})
        s = min(w.get('score', 0), 150)
        labels = w.get('labels', [])
        # Use actual event minute for display; fall back to window start
        display_minute = w.get('first_minute', minute)
        arc.append({'minute': minute, 'display_minute': display_minute, 'score': s, 'labels': labels})

    max_score = max((a['score'] for a in arc), default=0)
    avg_score = sum(a['score'] for a in arc) / max(len(arc), 1)
    high_windows = sum(1 for a in arc if a['score'] > 35)

    if max_score >= 100:
        intensity = 'THRILLER'
    elif high_windows >= 7:
        intensity = 'HIGH INTENSITY'
    elif avg_score > 18:
        intensity = 'COMPETITIVE'
    else:
        intensity = 'CONTROLLED'

    peak_moments = sorted(
        [a for a in arc if a['score'] >= 15],
        key=lambda x: x['score'],
        reverse=True,
    )[:6]

    return {
        'emotion_arc': arc,
        'peak_moments': peak_moments,
        'max_score': max_score,
        'intensity': intensity,
        'timeline': timeline,
        'final_score': final_score,
    }


def generate_emoti_pulse(match_id: int, home_team: str, away_team: str, lang: str = 'en') -> dict:
    arc_data = get_emotion_arc(match_id, home_team, away_team)
    if 'error' in arc_data:
        return arc_data

    timeline = arc_data['timeline']
    intensity = arc_data['intensity']
    final_score = arc_data.get('final_score', {})

    # Only the most narrative-rich events (goals, cards, key saves/posts)
    key_events = [e for e in timeline if e['type'] in ('goal', 'red_card', 'post', 'save')]
    # Trim saves to max 4 so they don't drown out goals
    saves_shown = 0
    filtered: list[dict] = []
    for e in key_events:
        if e['type'] == 'save':
            if saves_shown >= 4:
                continue
            saves_shown += 1
        filtered.append(e)

    timeline_text = '\n'.join(f"  {e['text']}" for e in filtered) or '  No key events tracked.'
    h_score = final_score.get(home_team, '?')
    a_score = final_score.get(away_team, '?')
    final_result = f'{home_team} {h_score}–{a_score} {away_team}'

    goals = [e for e in timeline if e['type'] == 'goal']
    scorers = ', '.join(set(e['text'].split('GOAL – ')[1].split(' (')[0] for e in goals if 'GOAL – ' in e['text']))

    prompt = f"""You are a football journalist writing the atmosphere section of a match report.

MATCH: {home_team} vs {away_team}
RESULT: {final_result}
INTENSITY: {intensity}
GOAL SCORERS: {scorers or 'none tracked'}

CHRONOLOGICAL EVENT TIMELINE:
{timeline_text}

Write a 3-paragraph atmosphere report grounded entirely in the facts above.

PARAGRAPH 1 — Opening exchanges: reference the actual first goal/card minute and scorer.
PARAGRAPH 2 — Turning point: name the exact moment the match changed, with the score at that moment.
PARAGRAPH 3 — Legacy line: one punchy sentence about what makes this result memorable, citing the final score.

STRICT RULES:
- Every claim must be traceable to the timeline above. No invented facts.
- Name real players and real minutes. Reference actual score lines (e.g. "1–2 down").
- BANNED phrases: "stadium electric", "crowd going wild", "edge of seats", "heart-stopping", "drama unfolds", "magical", "thriller" (noun), "world-class".
- Present tense. Under 130 words total. Separate paragraphs with a blank line."""

    report = client.chat.completions.create(
        model=MODEL,
        messages=[{'role': 'user', 'content': lang_instruction(lang) + prompt}],
        max_tokens=210,
    ).choices[0].message.content.strip()

    # Strip timeline from API response (frontend doesn't need it)
    arc_data.pop('timeline', None)
    arc_data.pop('final_score', None)

    return {
        **arc_data,
        'atmosphere_report': report,
        'limitations': LIMITATIONS['emoti_pulse'],
        'home_team': home_team,
        'away_team': away_team,
        'result': final_result,
    }
