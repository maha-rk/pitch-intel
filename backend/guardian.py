"""
IBM Granite Guardian — post-generation trust verification for Pitch Intel.

Runs after each VAR Oracle verdict to check whether the Granite output is
grounded in the retrieved FIFA law text (hallucination / faithfulness check).

Two modes (automatic selection):
  1. granite-guardian   — calls ibm/granite-guardian-3-8b via watsonx.ai.
                          This is the IBM-native safety model purpose-built for
                          groundedness and hallucination detection.
  2. granite-selfcheck  — uses the same Granite inference model as a critic
                          (reflexion / self-consistency pass). Active when
                          watsonx creds are absent or the guardian model is
                          unavailable on the current tier.

Return schema:
  {
    'trusted':    bool,         # False = potential hallucination detected
    'risk_label': 'LOW' | 'MEDIUM' | 'HIGH',
    'detail':     str,          # one-sentence explanation
    'method':     'granite-guardian' | 'granite-selfcheck',
    'rag_score':  float | None  # top FAISS similarity score (0-1)
  }
"""

from __future__ import annotations
import os
from dotenv import load_dotenv
load_dotenv('backend/.env')

_GUARDIAN_MODEL = 'ibm/granite-guardian-3-8b'

# Groundedness prompt template (Granite Guardian 3.x input format)
_GROUNDEDNESS_PROMPT = """<|start_of_role|>user<|end_of_role|>You are a faithfulness auditor. You will be given a retrieved context and an AI-generated response. Your task is to determine whether the response makes claims that are NOT supported by the retrieved context.

<retrieved_context>
{context}
</retrieved_context>

<ai_response>
{response}
</ai_response>

Does the AI response contain claims or verdicts NOT grounded in the retrieved context above?

Respond with exactly one of:
  No  — the response is faithful to the context
  Yes — the response contains unsupported claims

Then on a new line give one sentence explaining your decision.<|end_of_text|>
<|start_of_role|>assistant<|end_of_role|>"""

# Self-check prompt (fallback using regular Granite)
_SELFCHECK_PROMPT = """You are a strict AI safety auditor. Review this football VAR ruling for faithfulness to the provided FIFA law text.

FIFA Law text (ground truth):
{context}

VAR verdict to audit:
{response}

Does the verdict cite law provisions that are NOT present in the FIFA law text above? Does it make factual claims about the incident that go beyond what the CV signals described?

Answer: GROUNDED (verdict stays within the law text) or HALLUCINATED (verdict introduces unsupported claims).
Then one sentence explaining why."""


def _try_guardian_model(context: str, response: str) -> dict | None:
    """Attempt to call Granite Guardian 3 via watsonx.ai. Returns None if unavailable."""
    try:
        api_key = os.getenv('WATSONX_API_KEY')
        if not api_key:
            return None

        from ibm_watsonx_ai import Credentials
        from ibm_watsonx_ai.foundation_models import ModelInference

        creds = Credentials(
            url=os.getenv('WATSONX_URL', 'https://us-south.ml.cloud.ibm.com'),
            api_key=api_key,
        )
        space_id = os.getenv('WATSONX_SPACE_ID')
        target = {'space_id': space_id} if space_id else {'project_id': os.getenv('WATSONX_PROJECT_ID')}

        guardian = ModelInference(
            model_id=_GUARDIAN_MODEL,
            credentials=creds,
            **target,
        )

        prompt = _GROUNDEDNESS_PROMPT.format(
            context=context[:1200],
            response=response[:600],
        )
        raw = guardian.generate_text(prompt=prompt, params={'max_new_tokens': 80})
        raw = (raw or '').strip()

        violated = raw.lower().startswith('yes')
        detail_lines = [l.strip() for l in raw.split('\n') if l.strip()]
        detail = detail_lines[1] if len(detail_lines) > 1 else raw[:150]

        return {
            'trusted': not violated,
            'risk_label': 'HIGH' if violated else 'LOW',
            'detail': detail,
            'method': 'granite-guardian',
        }
    except Exception as e:
        print(f'[Guardian] Guardian model unavailable: {e}')
        return None


def _selfcheck(context: str, response: str) -> dict:
    """Granite self-consistency check — uses the same inference model as a critic."""
    from backend.granite import client, MODEL

    prompt = _SELFCHECK_PROMPT.format(
        context=context[:1200],
        response=response[:600],
    )
    try:
        raw = client.chat.completions.create(
            model=MODEL,
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=120,
            temperature=0.1,
        ).choices[0].message.content or ''
        raw = raw.strip()

        upper = raw.upper()
        if 'HALLUCINATED' in upper:
            trusted, risk = False, 'HIGH'
        elif 'GROUNDED' in upper:
            trusted, risk = True, 'LOW'
        else:
            trusted, risk = True, 'MEDIUM'

        lines = [l.strip() for l in raw.split('\n') if l.strip()]
        detail = lines[1] if len(lines) > 1 else lines[0][:150] if lines else 'Self-check inconclusive.'

        return {
            'trusted': trusted,
            'risk_label': risk,
            'detail': detail,
            'method': 'granite-selfcheck',
        }
    except Exception as e:
        return {
            'trusted': True,
            'risk_label': 'MEDIUM',
            'detail': f'Trust check skipped: {e}',
            'method': 'granite-selfcheck',
        }


def check_verdict(
    verdict_text: str,
    law_context: str,
    rag_score: float | None = None,
) -> dict:
    """
    Run a groundedness check on a Granite verdict against its retrieved law context.

    Args:
        verdict_text:  The AI-generated reasoning string (verdict['reasoning']).
        law_context:   The raw FIFA law text the verdict was supposed to cite.
        rag_score:     Top FAISS similarity score from retrieval (0-1), if available.

    Returns:
        Trust check dict — see module docstring for schema.
    """
    result = _try_guardian_model(law_context, verdict_text) or _selfcheck(law_context, verdict_text)

    # Incorporate RAG score as an additional trust signal.
    # Low RAG score (<0.30) means the retrieved chunk was a weak semantic match,
    # which increases the chance of an off-target law being cited.
    if rag_score is not None:
        result['rag_score'] = round(rag_score, 3)
        if rag_score < 0.30 and result['risk_label'] == 'LOW':
            result['risk_label'] = 'MEDIUM'
            result['detail'] = (
                f"RAG retrieval confidence is low ({rag_score:.2f}). "
                "The law chunk may not be the closest match; verify manually. "
                + result['detail']
            )
    else:
        result['rag_score'] = None

    return result
