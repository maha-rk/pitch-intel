# Pitch Intel — World Cup AI Command Center

> A real-time AI football intelligence system that explains not just what happened, but why it happened.

**Solo submission · IBM Granite + IBM Docling · June Innovation Challenge 2026**

---

## The Problem

Football data analysis is locked behind professional platforms — Wyscout, Opta, InStat — that cost thousands of dollars per season and require institutional access. Fans, journalists, and emerging analysts have no tool that combines real event data with AI-generated reasoning about what that data means. Pitch Intel closes that gap by connecting StatsBomb's open World Cup dataset directly to IBM Granite, making professional-grade tactical analysis accessible to anyone.

---

## Target Users

- **Fan** — wants to understand the match: why a team lost despite more possession, what the xG chart actually means, who the standout player was and why
- **Analyst** — wants data and tactical context together: formation detection, pass network structure, referee consistency metrics, all in one place without switching between tools
- **Broadcaster** — wants instant narrative and context: pre-match briefings grounded in real statistics, atmosphere scores minute-by-minute, multilingual output ready for different markets

---

## Why Current Tools Fail

- They show stats without explanation — a journalist gets a number, not an insight
- They are locked behind paywalls that price out independent analysts, students, and fans in emerging markets
- They have no AI reasoning layer — no tool currently grounds a natural-language tactical explanation in live event data pulled in real time

---

## The Solution

Pitch Intel connects real StatsBomb event data (128 World Cup matches, ~3.5M events) directly to IBM Granite. Every output is grounded in real numbers — no hallucination, no fabrication. Granite does not generate analysis from its training knowledge; it receives actual match statistics as context and reasons from them. The system is designed so that if the data pipeline fails, the AI output fails too — there is no fallback to fabricated plausibility.

---

## The 8 Modules

| # | Module | What it does | Key tech |
|---|--------|-------------|----------|
| 01 | **TacticalLens** | xG flow chart, shot map (SVG pitch), pass network graph, player position heatmap, auto-detected formation (e.g. 4-3-3) from average position clustering. Three explanation modes: Beginner, Fan, Coach. | IBM Granite · StatsBomb events |
| 02 | **Scout Eye** | Natural-language player search ("clinical striker high conversion rate") across 6,000+ World Cup players. Returns top 5 with radar charts and IBM Granite scouting reports. Side-by-side head-to-head comparison when 2 results are selected. | FAISS · sentence-transformers · IBM Granite |
| 03 | **VAR Oracle** | Upload a match clip. YOLOv8 detects players and ball frame-by-frame. Overlap scoring determines foul / handball / offside. Verdict cross-referenced with FIFA Laws of the Game, parsed by IBM Docling from the official PDF. | YOLOv8 · IBM Docling · IBM Granite |
| 04 | **Match Explainer** | Pre- and post-match briefings grounded in real StatsBomb stats: shots, xG, possession, key moments. IBM Granite writes the narrative from actual numbers, not from training approximations. | IBM Granite · StatsBomb |
| 05 | **Fan Decoder** | Football AI chatbot in 9 languages (English, Spanish, French, Portuguese, Arabic, Japanese, German, Italian, Dutch). Full World Cup context in system prompt. Maintains conversation history within the session. | IBM Granite |
| 06 | **EmotiPulse** | Scores match atmosphere minute-by-minute using a weighted event formula (goals ×10, shots ×2, pressures, fouls, cards). Renders a pulse SVG chart. IBM Granite writes a broadcast-style atmosphere report from the scored data. | IBM Granite · StatsBomb events |
| 07 | **Pitch Agent** | IBM Granite agent with structured tool use. Calls `get_momentum`, `get_xg_flow`, `get_key_moments`, `get_pass_network`, `get_emotion_arc`, `search_players` dynamically. Shows the full reasoning chain. Up to 5 tool-call iterations per query. | IBM Granite · Tool Use · StatsBomb |
| 08 | **Referee Lens** | Aggregates all 128 World Cup matches by referee. Per referee: yellow/red card averages, foul rate, match-by-match log. IBM Granite writes a 3-paragraph consistency report citing real numbers. | IBM Granite · StatsBomb |

---

## IBM Technology — Deep Dive

### IBM Granite

Granite is the reasoning engine for all 8 modules. Every AI output is grounded in real StatsBomb event data passed as context — Granite never runs without real numbers in the prompt. This is not a wrapper around a general chatbot; it is a grounded inference system where the quality of the output is directly tied to the quality of the data pipeline feeding it.

The three-mode system in TacticalLens (Beginner / Fan / Coach) demonstrates this concretely: the same StatsBomb event data is sent to Granite with different instruction contexts, producing explanations calibrated to three distinct audiences from a single data source.

### IBM Docling

Used exclusively in VAR Oracle. When `backend/var_oracle/fifa_laws.pdf` is present, Docling parses the PDF and the relevant rule sections are injected into the Granite prompt alongside YOLOv8 detection output. Verdicts are grounded in actual FIFA regulations — not in Granite's approximate training knowledge of the rules. Every verdict cites the specific FIFA Law that applies, making the reasoning auditable rather than opaque.

To activate: drop `fifa_laws.pdf` (freely available from FIFA) into `backend/var_oracle/`. The code detects it automatically on the next request.

### Agentic Loop (Pitch Agent, Module 07)

```
User question
    │
    ▼
IBM Granite + 6 tool definitions sent to Groq
    │
    ├── tool_calls returned? ──YES──► execute tool (StatsBomb fetch)
    │                                      │
    │                                 summarise result, append to messages
    │                                      │
    └──────────────────────────────────────┘  (repeat up to 5 iterations)
    │
    NO tool calls → final answer
    │
    ▼
Response + full tool-call log returned to frontend
```

The frontend renders each tool call as an expandable badge — judges can verify which StatsBomb data Granite fetched and what it returned before forming its answer. The reasoning chain is not hidden.

---

## UX Design Decisions

These decisions are deliberate, not aesthetic. The interface is designed to serve data clarity over visual impressiveness.

**Solid colors over gradients.** Gradients draw the eye to the UI itself. In an analytics tool, the data must be the focal point. Every color in the palette is chosen for contrast against the dark background, not for decorative effect.

**Reduced visual noise improves clarity.** Each panel uses at most one or two high-contrast elements — a chart, a score, a key metric. The rest is structured whitespace. A panel that competes with itself loses the user before they read the data.

**Visual hierarchy matches decision order.** Score and teams appear first. xG insight appears second — it is the single most predictive metric and the most common question from a fan ("did the score reflect the play?"). Supporting data comes last. This matches how a user actually processes a match result, not how a database would sort its columns.

**The "Why did this match end this way?" panel is the differentiator.** Most dashboards answer "what happened." Pitch Intel's Match Explainer panel answers "why it happened" — using the actual xG, shot counts, possession sequences, and key moment timeline as input to Granite's reasoning. This is what transforms a dashboard into a decision-explainer. A journalist can copy the output directly. An analyst can interrogate the inputs. A fan can finally understand what they watched.

---

## Data Sources

| Source | What | License |
|--------|------|---------|
| **StatsBomb Open Data** | All events for FIFA World Cup 2018 and 2022 — 128 matches, ~3.5M events, 6,000+ players | Open Data License (free, attribution required) |
| **FIFA Laws of the Game** | Docling-parsed PDF for VAR verdict grounding | Public document |
| **Ultralytics YOLOv8** | Pre-trained model weights for player/ball detection | AGPL-3.0 |
| **sentence-transformers** | `all-MiniLM-L6-v2` for player embedding generation | Apache 2.0 |

No proprietary data. No scraping. No paid APIs beyond Groq's free tier.

---

## Setup

**Requirements:** Python 3.11+, Node.js 18+, Groq API key (free at console.groq.com)

```bash
# 1. Clone and set up backend
cd backend
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn statsbombpy groq python-dotenv \
            sentence-transformers faiss-cpu ultralytics docling

# Configure environment
echo "GROQ_API_KEY=your_key_here" > .env
echo "GRANITE_MODEL=llama-3.3-70b-versatile" >> .env

# Start API server (port 8001)
uvicorn backend.main:app --reload --port 8001

# 2. Start frontend (separate terminal)
cd frontend
npm install
npm run dev   # http://localhost:3000

# 3. Optional: activate IBM Docling in VAR Oracle
cp /path/to/fifa_laws.pdf backend/var_oracle/
# Code detects the file automatically on next request
```

On first run, Scout Eye pre-warms the FAISS index (~200ms). All other modules load data on demand from StatsBomb's API (cached after first fetch per match).

---

## Key Technical Decisions

**Inline SVG instead of a chart library.**
StatsBomb uses a 120×80 pitch coordinate system. Drawing directly to SVG gives exact control over shot positions, passing lines, and player nodes without a coordinate transform layer. Libraries like Recharts or D3 would add complexity without benefit.

**FAISS instead of a vector database.**
Scout Eye needs to run offline, cold-start fast, without a separate database process. FAISS indexes 6,000+ player embeddings in ~200ms and queries in under 5ms. Warmed at startup via a background thread. Simple and correct for the scale.

**Groq for IBM Granite inference.**
Sub-second latency lets the agentic tool-use loop complete 3–4 tool calls and return a synthesised answer in under 10 seconds — fast enough to feel interactive. Essential for the Pitch Agent module.

**Formation detection from average positions.**
StatsBomb open data does not expose lineup formations directly. Sorting players by average x-coordinate, dropping the deepest (goalkeeper proxy), and finding the two largest positional gaps gives a reliable heuristic for structured teams. The code returns `'?'` when data is insufficient — this is explicitly acknowledged as a heuristic, not presented as ground truth.

**No mocked AI outputs — every Granite response is generated live from real StatsBomb data.**
No hardcoded responses, no pre-generated reports, no canned examples. Every Granite call receives actual match statistics as context, not approximate stand-ins from training memory. If the data pipeline fails, the AI output fails — there is no fallback to fabricated plausibility. Judges can verify this: the Pitch Agent module exposes every tool call and the raw data it returned before Granite formed its answer.

---

## Credits

- [StatsBomb](https://statsbomb.com/open-data) for professional football event data, freely available
- [IBM Research](https://github.com/DS4SD/docling) for Docling
- [Ultralytics](https://ultralytics.com) for YOLOv8
- [Meta AI](https://faiss.ai) for FAISS
- [Hugging Face](https://huggingface.co/sentence-transformers) for sentence-transformers

---

*IBM SkillsBuild June Innovation Challenge 2026 · Solo submission*
