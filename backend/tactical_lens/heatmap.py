import json
from . import get_player_positions, narrate_tactical_moment

def generate_heatmap_data(match_id: int, minute: int, lang: str = 'en'):
    positions = get_player_positions(match_id)

    # Filter to 5-minute window
    window = [p for p in positions if abs(p['minute'] - minute) <= 5]

    # Keep only the LATEST position per player
    latest = {}
    for p in window:
        player = p.get('player', 'Unknown')
        if player not in latest or p['minute'] > latest[player]['minute']:
            latest[player] = p

    # Group by team
    teams = {}
    for p in latest.values():
        team = p.get('team', 'Unknown')
        if team not in teams:
            teams[team] = []
        teams[team].append({'x': p['x'], 'y': p['y'], 'player': p['player'], 'minute': p['minute']})

    # Ball position: actor of the event closest to the requested minute
    ball_position = None
    candidates = sorted(window, key=lambda p: abs(p.get('minute', 0) - minute))
    for p in candidates:
        if p.get('is_actor') or p.get('source') == 'carry':
            ball_position = {'x': p['x'], 'y': p['y']}
            break

    # Get AI narration
    narration = narrate_tactical_moment(match_id, minute, lang)

    return {
        'match_id': match_id,
        'minute': minute,
        'teams': teams,
        'ball_position': ball_position,
        'narration': narration
    }
