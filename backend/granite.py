"""
Central IBM Granite inference layer for Pitch Intel.

Every module talks to Granite through the `client` and `MODEL` exported here —
no module instantiates its own LLM client. This guarantees a single, auditable
inference path and makes the provider swappable without touching the modules.

Providers (set LLM_PROVIDER, or leave on "auto"):

  watsonx  — IBM watsonx.ai, model ibm/granite-3-3-8b-instruct   (primary / production)
  ollama   — IBM Granite via Ollama, model granite3.3:8b          (offline, free, no cloud)
  groq     — Llama 3.3 70B on Groq                                (legacy dev fallback ONLY —
                                                                    this is NOT Granite)

auto-detection order: watsonx (if creds present) -> ollama (if reachable) -> groq.

The exported `client` exposes the OpenAI-style interface used everywhere in the
codebase:  client.chat.completions.create(model=MODEL, messages=[...], ...)
returning an object with .choices[0].message.content (and .tool_calls).
"""

import os
import json
import types
import urllib.request
from dotenv import load_dotenv

load_dotenv('backend/.env')


def _watsonx_ready() -> bool:
    return bool(os.getenv('WATSONX_API_KEY') and os.getenv('WATSONX_PROJECT_ID'))


def _ollama_base() -> str:
    return os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')


def _ollama_ready() -> bool:
    try:
        urllib.request.urlopen(_ollama_base() + '/api/tags', timeout=0.6)
        return True
    except Exception:
        return False


def _resolve_provider() -> str:
    provider = os.getenv('LLM_PROVIDER', 'auto').strip().lower()
    if provider in ('watsonx', 'ollama', 'groq'):
        return provider
    # auto
    if _watsonx_ready():
        return 'watsonx'
    if _ollama_ready():
        return 'ollama'
    return 'groq'


# --------------------------------------------------------------------------- #
#  watsonx.ai shim — wraps ibm-watsonx-ai's ModelInference.chat() so it speaks
#  the same client.chat.completions.create(...) dialect as the OpenAI SDK.
# --------------------------------------------------------------------------- #
def _wrap_response(d: dict):
    """Turn watsonx's dict response into attribute-access objects."""
    return json.loads(json.dumps(d), object_hook=lambda o: types.SimpleNamespace(**o))


class _WatsonxCompletions:
    def __init__(self, model_inference):
        self._m = model_inference

    def create(self, *, model=None, messages, max_tokens=1024, temperature=0.7,
               tools=None, tool_choice=None, **_ignored):
        params = {'max_tokens': max_tokens, 'temperature': temperature}
        kwargs = {'messages': messages, 'params': params}
        if tools:
            kwargs['tools'] = tools
            if tool_choice:
                kwargs['tool_choice_option'] = tool_choice if isinstance(tool_choice, str) else 'auto'
        resp = self._m.chat(**kwargs)
        # Normalize to the OpenAI message shape the callers expect:
        # always expose .content (None if absent) and .tool_calls (None if empty),
        # and ensure tool-call arguments are a JSON string, not a dict.
        for ch in resp.get('choices', []):
            msg = ch.get('message') or {}
            ch['message'] = msg
            msg.setdefault('content', None)
            tcs = msg.get('tool_calls')
            if not tcs:
                msg['tool_calls'] = None
            else:
                for tc in tcs:
                    fn = tc.get('function', {})
                    args = fn.get('arguments')
                    if isinstance(args, (dict, list)):
                        fn['arguments'] = json.dumps(args)
        return _wrap_response(resp)


class _WatsonxClient:
    def __init__(self):
        from ibm_watsonx_ai import Credentials
        from ibm_watsonx_ai.foundation_models import ModelInference
        creds = Credentials(
            url=os.getenv('WATSONX_URL', 'https://us-south.ml.cloud.ibm.com'),
            api_key=os.getenv('WATSONX_API_KEY'),
        )
        # A deployment space (space_id) binds directly to the watsonx.ai Runtime,
        # so it sidesteps the flaky project<->WML association. Prefer it if set.
        space_id = os.getenv('WATSONX_SPACE_ID')
        target = {'space_id': space_id} if space_id else {'project_id': os.getenv('WATSONX_PROJECT_ID')}
        model = ModelInference(
            model_id=os.getenv('WATSONX_MODEL', 'ibm/granite-3-3-8b-instruct'),
            credentials=creds,
            **target,
        )
        self.chat = types.SimpleNamespace(completions=_WatsonxCompletions(model))


# --------------------------------------------------------------------------- #
#  Build the client + model for the resolved provider.
# --------------------------------------------------------------------------- #
PROVIDER = _resolve_provider()

if PROVIDER == 'watsonx':
    client = _WatsonxClient()
    MODEL = os.getenv('WATSONX_MODEL', 'ibm/granite-3-3-8b-instruct')

elif PROVIDER == 'ollama':
    from openai import OpenAI
    client = OpenAI(base_url=_ollama_base() + '/v1', api_key='ollama')
    MODEL = os.getenv('OLLAMA_MODEL', 'granite3.3:8b')

else:  # groq legacy fallback
    from openai import OpenAI
    client = OpenAI(
        base_url='https://api.groq.com/openai/v1',
        api_key=os.getenv('GROQ_API_KEY'),
    )
    MODEL = os.getenv('GROQ_MODEL', os.getenv('GRANITE_MODEL', 'llama-3.3-70b-versatile'))
    print(
        '\n[Pitch Intel] WARNING: running on Groq/Llama, which is NOT IBM Granite. '
        'Set WATSONX_API_KEY + WATSONX_PROJECT_ID (or run Ollama with granite3.3:8b) '
        'to use real IBM Granite.\n'
    )

# Some modules import the model under the name GRANITE_MODEL.
GRANITE_MODEL = MODEL

print(f'[Pitch Intel] Granite layer -> provider={PROVIDER}, model={MODEL}')
