from statsbombpy import sb
import pandas as pd
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')

from backend.granite import client, GRANITE_MODEL, lang_instruction

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
    """Return per-player positions. Uses StatsBomb 360 freeze-frames when available,
    falls back to carry-event positions otherwise."""
    try:
        frames_360 = sb.frames(match_id=match_id)
        if frames_360 is not None and not frames_360.empty:
            rows = []
            for _, row in frames_360.iterrows():
                minute = int(row.get('minute', 0)) if pd.notna(row.get('minute')) else 0
                ff = row.get('freeze_frame') or []
                if not isinstance(ff, list):
                    continue
                for player_entry in ff:
                    if not isinstance(player_entry, dict):
                        continue
                    loc = player_entry.get('location', [])
                    teammate = player_entry.get('teammate', False)
                    actor = player_entry.get('actor', False)
                    player = player_entry.get('player', {})
                    pname = player.get('name', 'Unknown') if isinstance(player, dict) else str(player)
                    if isinstance(loc, list) and len(loc) >= 2:
                        rows.append({
                            'player': pname,
                            'x': float(loc[0]),
                            'y': float(loc[1]),
                            'minute': minute,
                            'team': 'home' if teammate else 'away',
                            'source': '360',
                            'is_actor': bool(actor),
                        })
            if rows:
                print(f'[TacticalLens] Using StatsBomb 360 data: {len(rows)} positions')
                return rows
    except Exception as e:
        print(f'[TacticalLens] 360 data unavailable ({e}), falling back to carry events')

    # Fallback: derive positions from ball-carrier events
    events = get_match_events(match_id)
    tracking = events[events['type'] == 'Carry'][['player', 'location', 'minute', 'team']]
    tracking = tracking.dropna(subset=['location'])
    tracking['x'] = tracking['location'].apply(lambda loc: loc[0] if isinstance(loc, list) else None)
    tracking['y'] = tracking['location'].apply(lambda loc: loc[1] if isinstance(loc, list) else None)
    result = tracking.dropna(subset=['x', 'y']).to_dict(orient='records')
    for r in result:
        r['source'] = 'carry'
    return result

def narrate_tactical_moment(match_id: int, minute: int, lang: str = 'en'):
    events = get_match_events(match_id)
    window = events[(events['minute'] >= minute) & (events['minute'] <= minute + 5)]
    summary = window[['type', 'player', 'team', 'minute']].dropna().to_string()
    response = client.chat.completions.create(
        model=GRANITE_MODEL,
        messages=[{
            "role": "user",
            "content": lang_instruction(lang) + f"You are an expert football analyst. Narrate what is tactically happening in this sequence of match events in 2-3 sentences, focusing on tactical patterns and what it means for the match:\n\n{summary}"
        }],
        max_tokens=200
    )
    return response.choices[0].message.content

def get_key_moments(match_id: int):
    events = get_match_events(match_id)
    moments = []

    # Goals: StatsBomb codes goals as Shot events with shot_outcome == 'Goal'
    shots = events[events['type'] == 'Shot'].copy()
    if 'shot_outcome' in shots.columns:
        shots['_outcome'] = shots['shot_outcome'].apply(lambda x: x.get('name','') if isinstance(x, dict) else str(x))
        goals = shots[shots['_outcome'] == 'Goal'][['minute','player','team']].dropna(subset=['minute'])
        for _, row in goals.iterrows():
            player = str(row.get('player', ''))
            moments.append({'type':'Goal','minute':int(row['minute']),'player':player if player!='nan' else '','team':str(row.get('team',''))})

    # Cards, substitutions
    for etype in ['Yellow Card','Red Card','Substitution']:
        sub = events[events['type'] == etype][['minute','player','team']].dropna(subset=['minute'])
        for _, row in sub.iterrows():
            player = str(row.get('player', ''))
            moments.append({'type':etype,'minute':int(row['minute']),'player':player if player!='nan' else '','team':str(row.get('team',''))})

    moments.sort(key=lambda m: m['minute'])
    return moments[:30]

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


def _tl_name(val) -> str:
    if isinstance(val, dict):
        return val.get('name', '')
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ''
    s = str(val)
    return '' if s == 'nan' else s


def get_xg_flow(match_id: int):
    events = get_match_events(match_id)
    shots = events[events['type'] == 'Shot'].sort_values('minute')
    result = []
    for _, row in shots.iterrows():
        raw = row.get('shot_statsbomb_xg')
        xg = float(raw) if (raw is not None and pd.notna(raw)) else 0.0
        result.append({
            'minute': int(row.get('minute', 0)),
            'team': _tl_name(row.get('team', '')),
            'xg': round(xg, 3),
            'outcome': _tl_name(row.get('shot_outcome', '')),
            'player': _tl_name(row.get('player', '')),
        })
    return result


def get_shot_map(match_id: int):
    events = get_match_events(match_id)
    shots = events[events['type'] == 'Shot']
    result = []
    for _, row in shots.iterrows():
        loc = row.get('location')
        if not isinstance(loc, list) or len(loc) < 2:
            continue
        raw = row.get('shot_statsbomb_xg')
        xg = float(raw) if (raw is not None and pd.notna(raw)) else 0.0
        result.append({
            'x': float(loc[0]),
            'y': float(loc[1]),
            'team': _tl_name(row.get('team', '')),
            'player': _tl_name(row.get('player', '')),
            'outcome': _tl_name(row.get('shot_outcome', '')),
            'shot_type': _tl_name(row.get('shot_type', '')),
            'xg': round(xg, 3),
            'minute': int(row.get('minute', 0)),
        })
    return result


def _detect_formation(avg_pos: dict, team: str) -> str:
    """Infer formation string (e.g. '4-3-3') from average player positions."""
    players = sorted(
        [(name, pos['x']) for name, pos in avg_pos.items() if pos['team'] == team],
        key=lambda p: p[1]
    )
    if len(players) < 8:
        return '?'
    # Drop most-defensive player (goalkeeper proxy) and cap at 10 outfielders
    outfield = players[1:11]
    if len(outfield) < 6:
        return '?'
    xs = [p[1] for p in outfield]
    gaps = sorted(
        [(xs[i + 1] - xs[i], i) for i in range(len(xs) - 1)],
        key=lambda g: g[0], reverse=True
    )
    sp = sorted([gaps[0][1] + 1, gaps[1][1] + 1])
    d, m, a = sp[0], sp[1] - sp[0], len(outfield) - sp[1]
    return f'{d}-{m}-{a}'


def get_pass_network(match_id: int):
    events = get_match_events(match_id)

    on_ball = events[events['type'].isin(['Pass', 'Carry', 'Shot', 'Dribble'])]
    pos_data: dict = {}
    for _, row in on_ball.iterrows():
        player = _tl_name(row.get('player', ''))
        team = _tl_name(row.get('team', ''))
        loc = row.get('location')
        if player and isinstance(loc, list) and len(loc) >= 2:
            if player not in pos_data:
                pos_data[player] = {'x': [], 'y': [], 'team': team}
            pos_data[player]['x'].append(float(loc[0]))
            pos_data[player]['y'].append(float(loc[1]))

    avg_pos = {
        p: {
            'x': round(sum(v['x']) / len(v['x']), 1),
            'y': round(sum(v['y']) / len(v['y']), 1),
            'team': v['team'],
        }
        for p, v in pos_data.items() if v['x']
    }

    passes = events[events['type'] == 'Pass']
    conns: dict = {}
    for _, row in passes.iterrows():
        passer = _tl_name(row.get('player', ''))
        recipient = _tl_name(row.get('pass_recipient', ''))
        team = _tl_name(row.get('team', ''))
        if passer and recipient and passer != recipient:
            key = f'{passer}||{recipient}'
            if key not in conns:
                conns[key] = {'from': passer, 'to': recipient, 'team': team, 'count': 0}
            conns[key]['count'] += 1

    top = sorted(conns.values(), key=lambda x: x['count'], reverse=True)[:40]
    relevant = {c['from'] for c in top} | {c['to'] for c in top}
    filtered_pos = {p: v for p, v in avg_pos.items() if p in relevant}

    teams = list({v['team'] for v in avg_pos.values()})
    formations = {t: _detect_formation(avg_pos, t) for t in teams}

    return {
        'connections': top,
        'positions': filtered_pos,
        'formations': formations,
    }