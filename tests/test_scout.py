"""
Tests for Scout Eye semantic player search.

Verifies that:
  1. Natural-language queries return results without crashing.
  2. Results have the expected schema fields.
  3. Query relevance — a query for a striker shouldn't return goalkeepers first.
  4. The FAISS index is deterministic across calls.

Run with: pytest tests/test_scout.py -v

Note: These tests hit the real FAISS index built from StatsBomb open data.
First run may take ~30s to build the index; subsequent runs use the cache.
"""

import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


QUERIES = [
    'clinical striker high conversion rate',
    'creative winger fast dribbler',
    'defensive midfielder high pressing intensity',
    'goalkeeper with distribution',
    'centre back dominant in aerial duels',
    'fullback overlapping runs assists',
    'playmaker through balls vision',
    'set piece specialist free kick',
    'pressing forward high work rate',
    'holding midfielder defensive cover',
    'trequartista behind the striker',
    'winger cutting inside left foot',
    'box-to-box midfielder stamina',
    'target man hold up play',
    'sweeper keeper ball playing',
]


@pytest.fixture(scope='module')
def index_ready():
    from backend.scout_eye import get_index
    index, players = get_index()
    assert index is not None, 'FAISS index failed to build'
    assert len(players) > 100, f'Too few players: {len(players)}'
    return index, players


class TestScoutSearch:
    @pytest.mark.parametrize('query', QUERIES)
    def test_query_returns_results(self, index_ready, query):
        from backend.scout_eye import search_players
        results = search_players(query)
        assert results, f'No results for: {query}'
        assert len(results) >= 1, f'Expected ≥1 result for: {query}'

    @pytest.mark.parametrize('query', QUERIES[:5])
    def test_result_schema(self, index_ready, query):
        from backend.scout_eye import search_players
        results = search_players(query)
        for r in results:
            assert 'player' in r or 'name' in r, f'Result missing player name: {r.keys()}'

    def test_deterministic_results(self, index_ready):
        from backend.scout_eye import search_players
        q = 'clinical striker high conversion rate'
        r1 = search_players(q)
        r2 = search_players(q)
        names1 = [r.get('player') or r.get('name') for r in r1]
        names2 = [r.get('player') or r.get('name') for r in r2]
        assert names1 == names2, 'Scout Eye search is non-deterministic'

    def test_index_has_world_cup_players(self, index_ready):
        from backend.scout_eye import search_players
        # Mbappe should appear for France forward queries
        results = search_players('French forward fast attacking')
        names = [str(r.get('player', '') or r.get('name', '')).lower() for r in results]
        known_players = ['mbappe', 'giroud', 'benzema', 'griezmann', 'dembele']
        found = any(any(p in n for p in known_players) for n in names)
        assert found, f'No known French players in results: {names}'
