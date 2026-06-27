import os
from groq import Groq
from dotenv import load_dotenv
from statsbombpy import sb
import pandas as pd

load_dotenv('backend/.env')

client = Groq(api_key=os.getenv('GROQ_API_KEY'))
MODEL = os.getenv('GRANITE_MODEL', 'llama-3.3-70b-versatile')

LANGUAGE_NAMES = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French',
    'de': 'German', 'pt': 'Portuguese', 'ar': 'Arabic',
    'ja': 'Japanese', 'hi': 'Hindi', 'it': 'Italian'
}

def get_world_cup_context():
    try:
        matches_2018 = sb.matches(competition_id=43, season_id=3)
        matches_2022 = sb.matches(competition_id=43, season_id=106)
        all_matches = pd.concat([matches_2018, matches_2022], ignore_index=True)
        context_lines = []
        for _, m in all_matches.iterrows():
            line = f"{m['home_team']} {m.get('home_score','?')}-{m.get('away_score','?')} {m['away_team']} ({m['match_date']})"
            context_lines.append(line)
        return '\n'.join(context_lines[:80])
    except:
        return "FIFA World Cup 2018 Russia and 2022 Qatar match data available."

_context_cache = None

def get_context():
    global _context_cache
    if _context_cache is None:
        _context_cache = get_world_cup_context()
    return _context_cache

def decode_question(question: str, language: str = 'en', history: list = []):
    context = get_context()
    lang_name = LANGUAGE_NAMES.get(language, 'English')

    system_prompt = f"""You are a friendly football expert helping fans understand the FIFA World Cup.
You have access to real match data from World Cup 2018 (Russia) and 2022 (Qatar).
Always respond in {lang_name}.
Keep answers conversational, engaging, and easy to understand.
For beginners, avoid jargon. For tactical questions, go deeper.
Ground your answers in real match facts when possible.

World Cup match results you can reference:
{context}"""

    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-6:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": question})

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        max_tokens=300
    )
    return response.choices[0].message.content