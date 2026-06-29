"""
LangFlow-based Pitch Intel pipeline runner.

Exposes the Debate Room's three-agent Granite pipeline (Advocate → Skeptic →
Mediator) as a LangFlow-compatible flow so it can be:

  - Run via a local LangFlow server  (langflow run flows/pitch_debate_flow.json)
  - Imported into the LangFlow visual canvas for inspection
  - Registered with an IBM Context Forge MCP gateway
  - Called programmatically from any LangFlow client

The flow definition lives in flows/pitch_debate_flow.json. This module provides:
  1. A REST client that calls a running LangFlow server (run_via_langflow_server)
  2. A direct runner that mirrors the flow logic inline (run_debate_flow) — used
     when LangFlow isn't running, so the debate endpoint always works.

Usage — via local LangFlow server:
    pip install langflow
    langflow run --flow flows/pitch_debate_flow.json --port 7860

    Then set in backend/.env:
        LANGFLOW_URL=http://localhost:7860

Usage — programmatically (no LangFlow server needed):
    python -m backend.langflow_pipeline \\
        --match_id 3857276 --home Morocco --away Canada \\
        --home_score 0 --away_score 2

The pipeline is a direct translation of flows/pitch_debate_flow.json into
Python: same three IBM Granite nodes, same prompts, same data flow.
"""

from __future__ import annotations

import json
import os
import argparse
from pathlib import Path

from dotenv import load_dotenv
load_dotenv('backend/.env')

LANGFLOW_URL = os.getenv('LANGFLOW_URL', 'http://localhost:7860')
FLOW_FILE = Path(__file__).parent.parent / 'flows' / 'pitch_debate_flow.json'


# ---------------------------------------------------------------------------
# 1. LangFlow server client (requires a running langflow instance)
# ---------------------------------------------------------------------------

def run_via_langflow_server(match_context: str, lang: str = 'en') -> dict | None:
    """
    POST the match context to a running LangFlow server and return the
    Mediator's consensus verdict. Returns None if the server isn't reachable.
    """
    try:
        import requests
        resp = requests.post(
            f'{LANGFLOW_URL}/api/v1/run/pitch-debate',
            json={
                'input_value': match_context,
                'output_type': 'chat',
                'input_type': 'chat',
                'tweaks': {
                    'Prompt-advocate': {},
                    'Prompt-skeptic': {},
                    'Prompt-mediator': {},
                }
            },
            timeout=45,
        )
        resp.raise_for_status()
        data = resp.json()
        # LangFlow 1.x wraps output in outputs[0].outputs[0].results.message.text
        outputs = data.get('outputs', [])
        if outputs:
            text = (
                outputs[0]
                .get('outputs', [{}])[0]
                .get('results', {})
                .get('message', {})
                .get('text', '')
            )
            if text:
                return {'consensus': text, 'source': 'langflow'}
    except Exception:
        return None


# ---------------------------------------------------------------------------
# 2. Direct flow runner — mirrors the JSON graph in Python
#    Three IBM Granite nodes with the same prompts as the flow file.
# ---------------------------------------------------------------------------

def _granite_call(prompt_text: str, max_tokens: int = 200, temperature: float = 0.6) -> str:
    from backend.granite import client, MODEL
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{'role': 'user', 'content': prompt_text}],
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return (resp.choices[0].message.content or '').strip()


def run_debate_flow(
    match_id: int,
    home_team: str,
    away_team: str,
    home_score: int = 0,
    away_score: int = 0,
    lang: str = 'en',
) -> dict:
    """
    Runs the LangFlow debate pipeline, trying the LangFlow server first and
    falling back to direct Granite calls (same logic, same prompts).

    Returns the same schema as backend.debate.run_debate so it is a drop-in.
    """
    from backend.granite import lang_instruction
    from backend.debate import _build_context
    from backend.transparency import LIMITATIONS

    context, winner = _build_context(match_id, home_team, away_team, home_score, away_score)
    subject = winner or 'the favourite'
    topic = (
        f'Did {subject} deserve this result?'
        if winner else
        'Was this draw a fair reflection of the game?'
    )
    lang_prefix = lang_instruction(lang)

    # --- Try LangFlow server (flow node: ChatInput-1 → ... → ChatOutput-1) ---
    server_result = run_via_langflow_server(lang_prefix + context, lang)

    if server_result:
        # Server handled it — we still need advocate/skeptic for the UI.
        # Run those two locally so the full debate card renders correctly.
        arg_for = _granite_call(
            lang_prefix +
            f"You are The Advocate. Argue the result was DESERVED (2–3 sentences, cite only the data).\n\n{context}",
        )
        arg_against = _granite_call(
            lang_prefix +
            f"You are The Skeptic. Argue the result FLATTERED the winner (2–3 sentences, cite only the data).\n\n{context}",
        )
        consensus = server_result['consensus']
        source = 'langflow+granite'
    else:
        # Direct execution: mirrors OpenAIModel-advocate → OpenAIModel-skeptic →
        # CombineText-1 → OpenAIModel-mediator (same prompts as the JSON flow)
        arg_for = _granite_call(
            lang_prefix +
            "You are The Advocate — a confident football pundit.\n"
            "Argue in 2–3 sharp sentences that the result was FULLY DESERVED. "
            "Cite only the data given (xG, momentum, goals). No hedging.\n\n"
            f"Match data:\n{context}",
        )
        arg_against = _granite_call(
            lang_prefix +
            "You are The Skeptic — a contrarian football pundit.\n"
            "Argue in 2–3 sharp sentences that the result FLATTERED the winner. "
            "Cite only the data given. No hedging.\n\n"
            f"Match data:\n{context}",
        )
        debate_combined = (
            f"The Advocate argued:\n{arg_for}\n\n---\n\nThe Skeptic argued:\n{arg_against}"
        )
        consensus = _granite_call(
            lang_prefix +
            "You are a neutral senior analyst refereeing a debate.\n"
            "Weigh both arguments against the data and deliver a balanced 2-sentence "
            "consensus verdict. Be specific — name the metric that settles it.\n\n"
            f"{debate_combined}\n\nOriginal match data:\n{context}",
            temperature=0.4,
        )
        source = 'granite-direct'

    return {
        'topic': topic,
        'data_summary': context,
        'agent_a': {'name': 'The Advocate', 'stance': 'Result was deserved', 'argument': arg_for},
        'agent_b': {'name': 'The Skeptic', 'stance': 'Result flattered the winner', 'argument': arg_against},
        'consensus': consensus,
        'pipeline_source': source,
        'flow_file': str(FLOW_FILE),
        'limitations': LIMITATIONS['tactical'],
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run Pitch Intel LangFlow debate pipeline')
    parser.add_argument('--match_id', type=int, required=True)
    parser.add_argument('--home', required=True)
    parser.add_argument('--away', required=True)
    parser.add_argument('--home_score', type=int, default=0)
    parser.add_argument('--away_score', type=int, default=0)
    parser.add_argument('--lang', default='en')
    args = parser.parse_args()

    result = run_debate_flow(
        args.match_id, args.home, args.away,
        args.home_score, args.away_score, args.lang,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))
