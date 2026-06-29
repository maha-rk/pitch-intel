"""
Pitch Intel MCP server.

Exposes the same StatsBomb analysis tools that IBM Granite calls inside the
Pitch Agent — but over the open Model Context Protocol (MCP). Any MCP-compatible
client can now consume them: Claude/other LLM hosts, or an IBM Context Forge
MCP gateway placed in front of the watsonx Granite agent. This makes the tool
layer a reusable, governed surface rather than logic locked inside one endpoint.

Run (stdio transport):
    python -m backend.mcp_server

Then register it with your MCP gateway / client, e.g. Context Forge:
    command: python   args: ["-m", "backend.mcp_server"]
"""

from mcp.server.fastmcp import FastMCP
from backend.pitch_agent import _call_tool

mcp = FastMCP("pitch-intel")


@mcp.tool()
def get_momentum(match_id: int) -> str:
    """Per-team momentum index for a World Cup match (peak, average, windows). Grounded in StatsBomb events."""
    return _call_tool("get_momentum", {"match_id": match_id})


@mcp.tool()
def get_xg_flow(match_id: int) -> str:
    """Per-team expected-goals (xG) summary for a match: total xG, shots, goals, shots on target."""
    return _call_tool("get_xg_flow", {"match_id": match_id})


@mcp.tool()
def get_key_moments(match_id: int) -> str:
    """Chronological key moments (goals, cards, substitutions) for a match."""
    return _call_tool("get_key_moments", {"match_id": match_id})


@mcp.tool()
def get_pass_network(match_id: int) -> str:
    """Top passing connections, per-team pass totals, and players tracked for a match."""
    return _call_tool("get_pass_network", {"match_id": match_id})


@mcp.tool()
def get_emotion_arc(match_id: int, home_team: str = "", away_team: str = "") -> str:
    """Match atmosphere/intensity arc with peak emotional moments (EmotiPulse scoring)."""
    return _call_tool("get_emotion_arc", {"match_id": match_id, "home_team": home_team, "away_team": away_team})


@mcp.tool()
def search_players(query: str) -> str:
    """Natural-language player search across 6,000+ World Cup players (FAISS semantic search)."""
    return _call_tool("search_players", {"query": query})


if __name__ == "__main__":
    mcp.run()
