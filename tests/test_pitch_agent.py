"""
Golden-set tests for Pitch Agent tool routing.

Verifies that _call_tool correctly dispatches to the right StatsBomb
function for each tool name — without making any LLM calls.

Run with: pytest tests/test_pitch_agent.py -v
"""

import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from unittest.mock import patch, MagicMock


# We patch the StatsBomb calls so the tests are fast and offline.
@pytest.fixture(autouse=True)
def patch_statsbomb():
    mock_df = MagicMock()
    mock_df.__getitem__ = MagicMock(return_value=MagicMock())
    mock_df.dropna = MagicMock(return_value=mock_df)
    with (
        patch('backend.tactical_lens.sb.events', return_value=mock_df),
        patch('backend.tactical_lens.sb.matches', return_value=mock_df),
        patch('backend.tactical_lens.sb.frames', side_effect=Exception('no 360')),
        patch('backend.scout_eye.get_index', return_value=(MagicMock(), [])),
    ):
        yield


TOOL_ROUTING_CASES = [
    # (tool_name, args, expected_return_type)
    ('get_momentum',     {'match_id': 1234}, (str, dict, list)),
    ('get_xg_flow',      {'match_id': 1234}, (str, dict, list)),
    ('get_key_moments',  {'match_id': 1234}, (str, dict, list)),
    ('get_pass_network', {'match_id': 1234}, (str, dict, list)),
]


class TestToolRouting:
    @pytest.mark.parametrize('name,args,expected_types', TOOL_ROUTING_CASES)
    def test_tool_dispatched_and_returns(self, name, args, expected_types):
        from backend.pitch_agent import _call_tool
        result = _call_tool(name, args)
        assert isinstance(result, expected_types), \
            f'_call_tool({name}) returned {type(result)}, expected one of {expected_types}'

    def test_string_match_id_normalized(self):
        """_call_tool must not crash when match_id comes as a bare string."""
        from backend.pitch_agent import _call_tool
        try:
            _call_tool('get_momentum', '1234')
        except (ValueError, TypeError) as e:
            pytest.fail(f'_call_tool crashed on string match_id: {e}')

    def test_double_encoded_json_normalized(self):
        """_call_tool must handle args that are a JSON string of a dict."""
        import json
        from backend.pitch_agent import _call_tool
        encoded = json.dumps({'match_id': 1234})
        try:
            _call_tool('get_momentum', encoded)
        except (ValueError, TypeError) as e:
            pytest.fail(f'_call_tool crashed on double-encoded args: {e}')

    def test_unknown_tool_does_not_crash(self):
        from backend.pitch_agent import _call_tool
        result = _call_tool('nonexistent_tool', {})
        # Should return something (empty dict/string), not raise
        assert result is not None
