# ⚽ Pitch Intel — World Cup AI Command Center

> Understand the game. Explain the moments. Build AI inside the match.

Pitch Intel is a six-module AI platform that gives coaches, analysts, broadcasters, and fans a complete understanding of the FIFA World Cup — powered by IBM Granite, Docling, LangFlow, and Context Forge.

---

## 🚀 Modules

| Module | Description |
|--------|-------------|
| **TacticalLens** | Animated real-time heatmaps of World Cup match data with IBM Granite narration |
| **VAR Oracle** | CV-powered incident detection (YOLOv8) cross-referenced with FIFA Laws via Docling |
| **Match Explainer** | ML-driven performance analysis with Granite-generated pre/post match briefings |
| **Scout Eye** | Natural language semantic player search with AI-generated scouting reports |
| **Fan Decoder** | Multilingual conversational AI explaining football to fans worldwide |
| **EmotiPulse** | Social sentiment mapped to match events, contextualised by Granite |

---

## 🧠 IBM Technologies Used

- **IBM Granite** — reasoning and narration across all six modules
- **Docling** — parsing FIFA Laws of the Game PDF for VAR Oracle
- **LangFlow** — multi-agent orchestration across modules
- **Context Forge** — MCP gateway and proxy layer between all modules
- **IBM Bob** — AI coding assistant used throughout development

---

## 📊 Data Sources

- [StatsBomb Open Data](https://github.com/statsbomb/open-data) — match events, tracking, player stats
- FIFA Laws of the Game (official PDF)
- Twitter/Reddit API — fan sentiment for EmotiPulse
- Roboflow football datasets — YOLOv8 fine-tuning for VAR Oracle

---

## 🛠️ Tech Stack

- **Backend** — Python, FastAPI
- **Frontend** — Next.js, Tailwind CSS
- **CV** — YOLOv8
- **ML** — XGBoost, LightGBM
- **Semantic Search** — Sentence Transformers, FAISS
- **LLM** — IBM Granite via WatsonX

---

## 🎯 The Problem

The World Cup is watched by billions — yet the experience is fractured. Fans don't understand what they're watching. VAR decisions erode trust. Tactical shifts happen invisibly. Pitch Intel makes the invisible visible — instantly, intelligibly, and for everyone.

---

## 💡 Why It Matters

Every module solves a real problem with a real user:
- Coaches drowning in data → TacticalLens
- Fans confused by VAR → VAR Oracle
- Clubs needing affordable scouting → Scout Eye
- Broadcasters tracking fan sentiment → EmotiPulse
- Casual fans worldwide → Fan Decoder
- Analysts needing match context → Match Explainer

---

## 🏗️ Project Structure