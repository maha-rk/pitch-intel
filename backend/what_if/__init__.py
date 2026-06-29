"""
What-If Lab — counterfactual match outcomes via xG Monte Carlo simulation.

Every shot in a match carries a StatsBomb xG value, which IS its probability of
becoming a goal. We treat each shot as an independent Bernoulli trial and run
10,000 simulated matches to get a real win/draw/loss distribution. Removing a
goal drops that shot from the pool and re-simulates — so the resulting shift in
win probability is *computed from the data*, not invented by the model.

IBM Granite then narrates the computed shift in plain language. The math is the
analyst; Granite is the translator.
"""

import os
import numpy as np
from dotenv import load_dotenv

load_dotenv('backend/.env')

from backend.granite import client, MODEL, lang_instruction
from backend.transparency import LIMITATIONS

# Fixed seed → reproducible probabilities (same match always yields same numbers).
_SEED = 42
_N_SIMS = 10000


def _get_shots(match_id: int) -> list[dict]:
    from backend.tactical_lens import get_xg_flow
    return get_xg_flow(match_id)


def _simulate(shots: list[dict], home_team: str, away_team: str,
              exclude: set | None = None) -> dict:
    """Monte Carlo over shot-level xG. Returns outcome probabilities (%)."""
    exclude = exclude or set()
    home_xg = np.array([s['xg'] for i, s in enumerate(shots)
                        if s['team'] == home_team and i not in exclude], dtype=float)
    away_xg = np.array([s['xg'] for i, s in enumerate(shots)
                        if s['team'] == away_team and i not in exclude], dtype=float)

    rng = np.random.default_rng(_SEED)
    # Each cell: did this shot score? (uniform < xg). Sum across shots = goals.
    home_goals = (rng.random((_N_SIMS, len(home_xg))) < home_xg).sum(axis=1) if len(home_xg) else np.zeros(_N_SIMS)
    away_goals = (rng.random((_N_SIMS, len(away_xg))) < away_xg).sum(axis=1) if len(away_xg) else np.zeros(_N_SIMS)

    return {
        'home_win': round(float(np.mean(home_goals > away_goals)) * 100, 1),
        'draw': round(float(np.mean(home_goals == away_goals)) * 100, 1),
        'away_win': round(float(np.mean(home_goals < away_goals)) * 100, 1),
        'avg_home_goals': round(float(home_goals.mean()), 2),
        'avg_away_goals': round(float(away_goals.mean()), 2),
        'home_shots': int(len(home_xg)),
        'away_shots': int(len(away_xg)),
        'home_xg_total': round(float(home_xg.sum()), 2),
        'away_xg_total': round(float(away_xg.sum()), 2),
    }


def _goals(shots: list[dict]) -> list[dict]:
    return [
        {'index': i, 'minute': s['minute'], 'player': s['player'],
         'team': s['team'], 'xg': s['xg']}
        for i, s in enumerate(shots) if s['outcome'] == 'Goal'
    ]


def _narrate(home_team, away_team, baseline, cf, removed, lang='en') -> str:
    delta_home = round(cf['home_win'] - baseline['home_win'], 1)
    delta_away = round(cf['away_win'] - baseline['away_win'], 1)
    prompt = f"""A Monte Carlo simulation (10,000 runs) was computed from the real shot-by-shot xG data of this match.

BASELINE (all actual shots):
- {home_team} win: {baseline['home_win']}%
- Draw: {baseline['draw']}%
- {away_team} win: {baseline['away_win']}%

COUNTERFACTUAL — remove {removed['player']}'s {removed['minute']}' goal for {removed['team']} (that shot had an xG of {removed['xg']}):
- {home_team} win: {cf['home_win']}% (change of {delta_home:+})
- Draw: {cf['draw']}%
- {away_team} win: {cf['away_win']}% (change of {delta_away:+})

Explain in 2-3 sentences what this computed shift means. Use ONLY the numbers above — do NOT invent any statistics. Be precise about which direction the win probabilities moved and which team benefits."""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{'role': 'user', 'content': lang_instruction(lang) + prompt}],
        max_tokens=200,
    )
    return (resp.choices[0].message.content or '').strip()


def run_what_if(match_id: int, home_team: str, away_team: str,
                remove_index: int | None = None, lang: str = 'en') -> dict:
    shots = _get_shots(match_id)
    goals = _goals(shots)
    baseline = _simulate(shots, home_team, away_team)

    result = {
        'match_id': match_id,
        'home_team': home_team,
        'away_team': away_team,
        'baseline': baseline,
        'goals': goals,
        'sims': _N_SIMS,
        'limitations': LIMITATIONS['what_if'],
    }

    if remove_index is not None:
        removed = next((g for g in goals if g['index'] == remove_index), None)
        if removed:
            cf = _simulate(shots, home_team, away_team, exclude={remove_index})
            result['counterfactual'] = cf
            result['removed_event'] = removed
            result['narration'] = _narrate(home_team, away_team, baseline, cf, removed, lang)

    return result
