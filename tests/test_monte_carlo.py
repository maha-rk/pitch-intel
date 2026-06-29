"""
Reproducibility and correctness tests for the What-If Lab Monte Carlo engine.

Run with: pytest tests/test_monte_carlo.py -v

These tests verify that:
  1. The simulation is seeded and fully reproducible across runs.
  2. Removing a goal shifts win probability in the expected direction.
  3. Probability outputs are valid (sum to ~1.0, bounded in [0,1]).
  4. Edge cases (no shots, single-shot match) don't crash.
"""

import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def _simulate(shots, home_team='Home', away_team='Away', exclude=None):
    """Import and call the private _simulate function directly for unit testing."""
    from backend.what_if import _simulate as sim
    return sim(shots, home_team, away_team, exclude=exclude)


# ── Minimal shot fixtures ────────────────────────────────────────────────────

HOME_SHOTS = [
    {'team': 'Home', 'xg': 0.15, 'minute': 10},
    {'team': 'Home', 'xg': 0.42, 'minute': 34},  # the "removed" goal
    {'team': 'Home', 'xg': 0.08, 'minute': 77},
]
AWAY_SHOTS = [
    {'team': 'Away', 'xg': 0.12, 'minute': 25},
    {'team': 'Away', 'xg': 0.31, 'minute': 61},
]
ALL_SHOTS = HOME_SHOTS + AWAY_SHOTS


class TestReproducibility:
    def test_same_seed_same_result(self):
        r1 = _simulate(ALL_SHOTS, 'Home', 'Away')
        r2 = _simulate(ALL_SHOTS, 'Home', 'Away')
        assert r1['home_win'] == r2['home_win'], \
            'Simulation is non-deterministic: seed not fixed'
        assert r1['away_win'] == r2['away_win']
        assert r1['draw'] == r2['draw']

    def test_probabilities_sum_to_100(self):
        r = _simulate(ALL_SHOTS, 'Home', 'Away')
        total = r['home_win'] + r['draw'] + r['away_win']
        assert abs(total - 100.0) < 0.5, f'Probabilities sum to {total}, expected ~100'

    def test_probabilities_in_bounds(self):
        r = _simulate(ALL_SHOTS, 'Home', 'Away')
        for key in ('home_win', 'draw', 'away_win'):
            assert 0.0 <= r[key] <= 100.0, f'{key} = {r[key]} out of bounds'


class TestCounterfactual:
    def test_removing_high_xg_shot_reduces_win_pct(self):
        baseline = _simulate(ALL_SHOTS, 'Home', 'Away')
        # Remove the home team's highest-xG shot (0.42 at index 1)
        counterfactual = _simulate(ALL_SHOTS, 'Home', 'Away', exclude={1})
        assert counterfactual['home_win'] <= baseline['home_win'], (
            f"Removing home shot should reduce home win%. "
            f"Before: {baseline['home_win']}, After: {counterfactual['home_win']}"
        )

    def test_removing_away_shot_increases_home_win(self):
        baseline = _simulate(ALL_SHOTS, 'Home', 'Away')
        away_idx = len(HOME_SHOTS)  # first away shot
        counterfactual = _simulate(ALL_SHOTS, 'Home', 'Away', exclude={away_idx})
        assert counterfactual['home_win'] >= baseline['home_win'], (
            f"Removing an away shot should not decrease home win%."
        )

    def test_removing_shot_changes_xg_total(self):
        baseline = _simulate(ALL_SHOTS, 'Home', 'Away')
        counterfactual = _simulate(ALL_SHOTS, 'Home', 'Away', exclude={1})
        assert counterfactual['home_xg_total'] < baseline['home_xg_total'], \
            'Removing a home shot should reduce home xG total'


class TestEdgeCases:
    def test_no_shots_returns_even_odds(self):
        r = _simulate([], 'Home', 'Away')
        assert r['home_win'] == r['away_win'], \
            'With no shots all outcomes should be equal'

    def test_single_shot_does_not_crash(self):
        r = _simulate([HOME_SHOTS[0]], 'Home', 'Away')
        assert 'home_win' in r

    def test_all_home_shots_favours_home(self):
        high_xg_shots = [{'team': 'Home', 'xg': 0.9, 'minute': i} for i in range(5)]
        r = _simulate(high_xg_shots, 'Home', 'Away')
        assert r['home_win'] > r['away_win'], \
            'Five 0.9-xG home shots should heavily favour home win'
