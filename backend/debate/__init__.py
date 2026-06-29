"""
Multi-agent debate mode.

Two IBM Granite personas argue opposite readings of the SAME StatsBomb data —
one says the result was deserved, the other says it flattered the winner — then
a neutral third Granite pass delivers a consensus verdict. Every agent is given
identical, real match data, so the disagreement is interpretive, not factual.
"""

import os
from dotenv import load_dotenv

load_dotenv('backend/.env')

from backend.granite import client, MODEL
from backend.transparency import LIMITATIONS


def _build_context(match_id, home_team, away_team, home_score, away_score):
    from backend.tactical_lens import get_key_moments, get_xg_flow, get_momentum
    moments = get_key_moments(match_id)
    xg = get_xg_flow(match_id)
    mom = get_momentum(match_id)
    goals = [m for m in moments if m.get('type') == 'Goal']
    home_xg = sum(s['xg'] for s in xg if s.get('team') == home_team)
    away_xg = sum(s['xg'] for s in xg if s.get('team') == away_team)
    home_mom = sum(p['score'] for p in mom if p.get('team') == home_team)
    away_mom = sum(p['score'] for p in mom if p.get('team') == away_team)
    goal_strs = [f"{g.get('minute')}' {g.get('player')} ({g.get('team')})" for g in goals]
    context = (
        f"Match: {home_team} {home_score} - {away_score} {away_team}\n"
        f"xG: {home_team} {home_xg:.2f} vs {away_team} {away_xg:.2f}\n"
        f"Momentum index: {home_team} {home_mom:.0f} vs {away_team} {away_mom:.0f}\n"
        f"Goals: {goal_strs}"
    )
    winner = home_team if home_score > away_score else away_team if away_score > home_score else None
    return context, winner


def _ask(system, context):
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": f"Match data:\n{context}"},
        ],
        max_tokens=200,
        temperature=0.6,
    )
    return (resp.choices[0].message.content or "").strip()


def run_debate(match_id, home_team, away_team, home_score=0, away_score=0):
    context, winner = _build_context(match_id, home_team, away_team, home_score, away_score)
    subject = winner or 'the favourite'
    topic = f"Did {subject} deserve this result?" if winner else "Was this draw a fair reflection of the game?"

    arg_for = _ask(
        "You are a confident football pundit. Argue that the result was fully DESERVED, "
        "citing only the data given (xG, momentum, goals). 2-3 sharp sentences. No hedging.",
        context,
    )
    arg_against = _ask(
        "You are a contrarian football pundit. Argue that the result FLATTERED the winner "
        "(or that the scoreline misrepresents the play), citing only the data given. "
        "2-3 sharp sentences. No hedging.",
        context,
    )
    consensus = _ask(
        f"You are a neutral senior analyst refereeing a debate. Pundit A argued the result was deserved: "
        f"\"{arg_for}\" Pundit B argued it flattered the winner: \"{arg_against}\" "
        "Weigh both against the data and deliver a balanced 2-sentence consensus verdict.",
        context,
    )

    return {
        'topic': topic,
        'data_summary': context,
        'agent_a': {'name': 'The Advocate', 'stance': 'Result was deserved', 'argument': arg_for},
        'agent_b': {'name': 'The Skeptic', 'stance': 'Result flattered the winner', 'argument': arg_against},
        'consensus': consensus,
        'limitations': LIMITATIONS['tactical'],
    }
