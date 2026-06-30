import os
import json
from dotenv import load_dotenv

load_dotenv('backend/.env')
from backend.granite import client, MODEL, lang_instruction
from backend.transparency import LIMITATIONS

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_momentum",
            "description": "Fetch minute-by-minute momentum scores for a match. Use this to understand which team dominated, when momentum shifted, and how pressure evolved across 90 minutes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "match_id": {"type": "integer", "description": "StatsBomb match ID"}
                },
                "required": ["match_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_xg_flow",
            "description": "Fetch expected goals (xG) flow for a match. Use this to assess chance quality, who deserved to win based on xG, and when the best chances were created.",
            "parameters": {
                "type": "object",
                "properties": {
                    "match_id": {"type": "integer", "description": "StatsBomb match ID"}
                },
                "required": ["match_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_key_moments",
            "description": "Fetch goals, cards, substitutions, and shots for a match. Use this to identify turning points, controversial decisions, and the chronological story of the match.",
            "parameters": {
                "type": "object",
                "properties": {
                    "match_id": {"type": "integer", "description": "StatsBomb match ID"}
                },
                "required": ["match_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_pass_network",
            "description": "Fetch passing connections and average player positions. Use this to understand team shape, key playmakers, and tactical structure.",
            "parameters": {
                "type": "object",
                "properties": {
                    "match_id": {"type": "integer", "description": "StatsBomb match ID"}
                },
                "required": ["match_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_emotion_arc",
            "description": "Fetch the emotional intensity arc of a match based on event scoring. Use this to understand dramatic peaks, overall match intensity, and atmosphere classification.",
            "parameters": {
                "type": "object",
                "properties": {
                    "match_id": {"type": "integer", "description": "StatsBomb match ID"},
                    "home_team": {"type": "string", "description": "Home team name"},
                    "away_team": {"type": "string", "description": "Away team name"}
                },
                "required": ["match_id", "home_team", "away_team"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_players",
            "description": "Semantic search for players by description. Use this for questions about specific player types, scouting, or finding players with certain characteristics.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language player description e.g. 'clinical striker with high xG under pressure'"}
                },
                "required": ["query"]
            }
        }
    }
]


def _call_tool(name: str, args) -> str:
    try:
        # Granite occasionally passes a bare value instead of an object
        if not isinstance(args, dict):
            if name in ('get_momentum', 'get_xg_flow', 'get_key_moments', 'get_pass_network'):
                args = {'match_id': args}
            elif name == 'search_players':
                args = {'query': str(args)}
            elif name == 'get_emotion_arc':
                args = {'match_id': args}
            else:
                args = {}

        if name == 'get_momentum':
            from backend.tactical_lens import get_momentum
            data = get_momentum(int(args['match_id']))
            teams: dict = {}
            for pt in data:
                t = pt['team']
                if t not in teams:
                    teams[t] = {'total': 0, 'peak_score': 0, 'peak_minute': 0, 'windows': 0}
                teams[t]['total'] += pt['score']
                teams[t]['windows'] += 1
                if pt['score'] > teams[t]['peak_score']:
                    teams[t]['peak_score'] = pt['score']
                    teams[t]['peak_minute'] = pt['minute']
            for t in teams:
                teams[t]['avg'] = round(teams[t]['total'] / max(teams[t]['windows'], 1), 1)
            return json.dumps({'momentum_by_team': teams, 'total_windows': len(data)})

        elif name == 'get_xg_flow':
            from backend.tactical_lens import get_xg_flow
            data = get_xg_flow(int(args['match_id']))
            teams: dict = {}
            for pt in data:
                t = pt['team']
                if t not in teams:
                    teams[t] = {'total_xg': 0.0, 'shots': 0, 'goals': 0, 'on_target': 0}
                teams[t]['total_xg'] = round(teams[t]['total_xg'] + pt['xg'], 3)
                teams[t]['shots'] += 1
                if pt['outcome'] == 'Goal':
                    teams[t]['goals'] += 1
                if pt['outcome'] in ('Goal', 'Saved'):
                    teams[t]['on_target'] += 1
            return json.dumps({'xg_by_team': teams})

        elif name == 'get_key_moments':
            from backend.tactical_lens import get_key_moments
            data = get_key_moments(int(args['match_id']))
            return json.dumps(data[:20])

        elif name == 'get_pass_network':
            from backend.tactical_lens import get_pass_network
            data = get_pass_network(int(args['match_id']))
            team_totals: dict = {}
            for c in data['connections']:
                t = c['team']
                team_totals[t] = team_totals.get(t, 0) + c['count']
            return json.dumps({
                'top_connections': data['connections'][:8],
                'team_pass_totals': team_totals,
                'players_tracked': len(data['positions'])
            })

        elif name == 'get_emotion_arc':
            from backend.emoti_pulse import get_emotion_arc
            data = get_emotion_arc(
                int(args['match_id']),
                args.get('home_team', ''),
                args.get('away_team', '')
            )
            return json.dumps({
                'intensity': data.get('intensity'),
                'max_score': data.get('max_score'),
                'peak_moments': data.get('peak_moments', [])[:5]
            })

        elif name == 'search_players':
            from backend.scout_eye import search_players
            data = search_players(args['query'], top_k=2)
            return json.dumps([
                {
                    'name': p['name'],
                    'team': p['team'],
                    'competition': p['competition'],
                    'stats': p['top_actions']
                }
                for p in data
            ])

        return json.dumps({'error': f'Unknown tool: {name}'})

    except Exception as e:
        return json.dumps({'error': str(e)})


def run_agent(question: str, match_context: dict | None = None, lang: str = 'en') -> dict:
    q_lower = question.lower().strip()
    is_counterfactual = any(q_lower.startswith(pfx) for pfx in ('what if', 'what would', 'if the', 'suppose', 'imagine if', 'had the'))

    system = (
        lang_instruction(lang) +
        "You are Pitch Intel — an elite AI football analyst powered by IBM Granite. "
        "You have access to real StatsBomb World Cup data via tools. "
        "ALWAYS call the relevant tools first before answering — ground every claim in real data. "
        "IMPORTANT: call each tool at most ONCE per conversation turn. If you have already received a tool result, do not call that tool again — synthesise your answer from the data you already have. "
        "Be specific: name players, cite exact minutes, reference xG values and pass counts. "
        "Your analysis should be insightful, concise, and grounded entirely in the numbers. "
        "Use analyst language — not generic commentary."
    )

    if is_counterfactual:
        system += (
            "\n\nCOUNTERFACTUAL MODE: The user is asking a 'what if' scenario. "
            "First retrieve the actual match data with tools, then reason about how removing or changing the stated event would have altered momentum, xG trajectory, and likely outcome. "
            "Ground your counterfactual in the real data: cite the actual momentum scores, which team was dominating before/after the event, and what the xG gap was. "
            "Be explicit: 'Based on real data, at minute X the momentum shifted to Y with a score of Z — without this event, ...'"
        )

    if match_context:
        system += (
            f"\n\nActive match context — use these IDs when the user asks about this match:"
            f"\nMatch ID: {match_context.get('match_id')}"
            f"\nHome: {match_context.get('home_team')} | Away: {match_context.get('away_team')}"
            f"\nDate: {match_context.get('match_date', '')}"
        )

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": question}
    ]

    tool_calls_log: list[dict] = []
    called_tools: set[str] = set()  # prevent the agent looping on the same tool

    for _ in range(8):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
                max_tokens=900
            )
        except Exception as e:
            # Groq/Llama sometimes emits XML-style tool calls (<function=name [args]</function>)
            # instead of JSON. Parse the failed_generation and execute the tool manually.
            recovered = False
            try:
                err_body = e.response.json() if hasattr(e, 'response') else {}  # type: ignore
                raw = err_body.get('error', {}).get('failed_generation', '')
                if raw:
                    import re as _re
                    for m in _re.finditer(r'<function=(\w+)\s+(\{.*?\})\s*</function>', raw, _re.DOTALL):
                        fn_name, fn_args_str = m.group(1), m.group(2)
                        try:
                            fn_args = json.loads(fn_args_str)
                        except Exception:
                            continue
                        tool_key = f"{fn_name}:{fn_args.get('match_id','')}"
                        if tool_key in called_tools:
                            continue
                        called_tools.add(tool_key)
                        result = _call_tool(fn_name, fn_args)
                        tool_calls_log.append({'tool': fn_name, 'args': fn_args, 'preview': result[:300]})
                        fake_id = f"recovered_{fn_name}"
                        messages.append({
                            "role": "assistant", "content": "",
                            "tool_calls": [{"id": fake_id, "type": "function", "function": {"name": fn_name, "arguments": fn_args_str}}]
                        })
                        messages.append({"role": "tool", "tool_call_id": fake_id, "content": result})
                        recovered = True
            except Exception:
                pass
            if not recovered:
                # No tool call recoverable — synthesise from whatever context exists
                try:
                    fb = client.chat.completions.create(model=MODEL, messages=messages, max_tokens=900)
                    return {'answer': fb.choices[0].message.content or 'Could not generate a response.', 'tool_calls': tool_calls_log, 'limitations': LIMITATIONS['pitch_agent'] if tool_calls_log else []}
                except Exception:
                    pass
                return {'answer': 'Analysis failed — the model had a tool-use error. Try a simpler question.', 'tool_calls': tool_calls_log, 'limitations': LIMITATIONS['pitch_agent']}
            continue  # loop again with recovered tool results in context

        msg = response.choices[0].message

        if not msg.tool_calls:
            return {'answer': msg.content or '', 'tool_calls': tool_calls_log, 'limitations': LIMITATIONS['pitch_agent'] if tool_calls_log else []}

        # Append assistant turn with tool calls
        messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments}
                }
                for tc in msg.tool_calls
            ]
        })

        # Execute each tool call (skip duplicates — agent sometimes loops on same tool)
        for tc in msg.tool_calls:
            fn_name = tc.function.name
            fn_args = json.loads(tc.function.arguments)
            # Groq/Granite sometimes double-encodes: unwrap before anything else
            if not isinstance(fn_args, dict):
                try:
                    inner = json.loads(fn_args)
                    if isinstance(inner, dict):
                        fn_args = inner
                except (json.JSONDecodeError, TypeError):
                    fn_args = {}
            tool_key = f"{fn_name}:{fn_args.get('match_id','')}"
            if tool_key in called_tools:
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": "[data already retrieved in this session — synthesise from previous results]"})
                continue
            called_tools.add(tool_key)
            result = _call_tool(fn_name, fn_args)

            tool_calls_log.append({
                'tool': fn_name,
                'args': fn_args,
                'preview': result[:300]
            })

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result
            })

    return {'answer': 'Agent reached iteration limit.', 'tool_calls': tool_calls_log, 'limitations': LIMITATIONS['pitch_agent'] if tool_calls_log else []}
