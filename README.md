# Pitch Intel

> Upload a football match clip. **YOLOv8** reads it frame-by-frame. **IBM Docling** extracts the exact FIFA law that applies. **IBM Granite** delivers a structured referee verdict — grounded in the actual rulebook text, not in training approximations. The evidence is shown: the law chunk, the CV readings, the confidence score.
>
> That is one of eight modules.

**IBM SkillsBuild June Innovation Challenge 2026 · Solo submission**
**IBM Granite · IBM Docling · YOLOv8 · StatsBomb open data · FAISS · Next.js 14**

---

## What makes this different

Every other football AI system does one of three things:
- **LLM wrapper over stats** — feed numbers in, get narrative out
- **ML prediction model** — train on historical data, predict one outcome
- **RAG over rules** — embed a rulebook, answer questions about it

Pitch Intel does all three simultaneously, chained together. The VAR Oracle is the clearest example: computer vision reads the footage → Docling parses the FIFA PDF → Granite cross-references both and issues a verdict with the exact law clause visible. That is not a chatbot answering questions about football. It is a grounded inference pipeline where every layer can be inspected.

The same principle runs through all 8 modules: **no Granite call runs without real StatsBomb event data in the context.** If the data pipeline fails, the AI output fails. There is no fallback to fabricated plausibility.

---

## The Problem

Football data analysis is locked behind professional platforms — Wyscout, Opta, InStat — that cost thousands of dollars per season and require institutional access. Fans, journalists, and emerging analysts have no tool that combines real event data with AI-generated reasoning about what that data means. Pitch Intel closes that gap by connecting StatsBomb's open World Cup dataset directly to IBM Granite, making professional-grade tactical analysis accessible to anyone.

---

## Target Users

- **Fan** — wants to understand the match: why a team lost despite more possession, what the xG chart actually means, who the standout player was and why
- **Analyst** — wants data and tactical context together: formation detection, pass network structure, referee consistency metrics, all in one place without switching between tools
- **Broadcaster** — wants instant narrative and context: pre-match briefings grounded in real statistics, atmosphere scores minute-by-minute, multilingual output ready for different markets

---

## The 8 Modules

| # | Module | What it does | Key tech |
|---|--------|-------------|----------|
| 01 | **VAR Oracle** | Upload a match clip. YOLOv8 detects players and ball frame-by-frame. Overlap scoring classifies the incident (foul / handball / offside / tackle). Verdict cross-referenced with the exact FIFA law clause — parsed by IBM Docling from the official PDF. The law text is shown in the UI alongside the CV evidence. | YOLOv8 · IBM Docling · IBM Granite |
| 02 | **TacticalLens** | xG flow chart, shot map (SVG pitch), pass network graph, player position heatmap, auto-detected formation (e.g. 4-3-3) from average position clustering. Three explanation modes: Beginner, Fan, Coach. Penalty analysis tab. "Why did this match end this way?" verdict from Granite. | IBM Granite · StatsBomb events |
| 03 | **Pitch Agent** | IBM Granite agent with structured tool use. Calls `get_momentum`, `get_xg_flow`, `get_key_moments`, `get_pass_network`, `get_emotion_arc`, `search_players` dynamically. Shows the full reasoning chain — judges can see every tool call and what data it returned. Supports What-If counterfactual questions grounded in real data. | IBM Granite · Tool Use · StatsBomb |
| 04 | **Scout Eye** | Natural-language player search ("clinical striker high conversion rate") across 6,000+ World Cup players. Returns top 5 with radar charts and IBM Granite scouting reports. Side-by-side head-to-head comparison when 2 results are selected. | FAISS · sentence-transformers · IBM Granite |
| 05 | **Referee Lens** | Aggregates all 128 World Cup matches by referee. Per referee: foul symmetry index (how evenly fouls were called between both teams), home bias index, card and foul averages, match-by-match log. IBM Granite writes a 3-paragraph consistency report citing real numbers. | IBM Granite · StatsBomb |
| 06 | **Match Explainer** | Pre- and post-match briefings grounded in real StatsBomb stats: shots, xG, possession, key moments. IBM Granite writes the narrative from actual numbers, not from training approximations. | IBM Granite · StatsBomb |
| 07 | **EmotiPulse** | Scores match atmosphere minute-by-minute using a weighted event formula (goals ×10, shots ×2, pressures, fouls, cards). Renders a pulse SVG chart. IBM Granite writes a broadcast-style atmosphere report from the scored data. | IBM Granite · StatsBomb events |
| 08 | **Fan Decoder** | Football AI chatbot in 16 languages (English, Spanish, French, Portuguese, Arabic, Japanese, German, Italian, Dutch, Russian, Korean, Chinese, Turkish, Polish, Swedish, Hindi). Full World Cup context in system prompt. Maintains conversation history within the session. | IBM Granite |

---

## IBM Technology — Deep Dive

### IBM Granite

Granite is the reasoning engine for all 8 modules, served through **IBM watsonx.ai** (`ibm/granite-4-h-small`). Every module routes through a **single inference layer** ([`backend/granite.py`](backend/granite.py)) — no module instantiates its own client, so there is exactly one auditable path to the model. The same layer can serve Granite offline via **Ollama** (`granite3.3:8b`) with no code changes, switched by one environment variable.

Every AI output is grounded in real StatsBomb event data passed as context — Granite never runs without real numbers in the prompt. This is not a wrapper around a general chatbot; it is a grounded inference system where the quality of the output is directly tied to the quality of the data pipeline feeding it.

The three-mode system in TacticalLens (Beginner / Fan / Coach) demonstrates this concretely: the same StatsBomb event data is sent to Granite with different instruction contexts, producing explanations calibrated to three distinct audiences from a single data source.

### IBM Docling

Used in VAR Oracle. When `backend/var_oracle/fifa_laws.pdf` is present, Docling parses the PDF and the relevant rule sections are injected into the Granite prompt alongside YOLOv8 detection output. Verdicts are grounded in actual FIFA regulations — not in Granite's approximate training knowledge of the rules. Every verdict cites the specific FIFA Law that applies, and **the exact parsed law text is shown in the UI** — making the reasoning auditable, not opaque.

To activate: drop `fifa_laws.pdf` (freely available from FIFA) into `backend/var_oracle/`. The code detects it automatically on the next request.

### Agentic Loop (Pitch Agent, Module 03)

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

### Model Context Protocol (MCP) gateway

The same six StatsBomb tools are also exposed over the open **Model Context Protocol** via [`backend/mcp_server.py`](backend/mcp_server.py). Instead of the tool logic being locked inside one endpoint, it becomes a reusable, governed surface that any MCP client can consume — including an **IBM Context Forge** MCP gateway placed in front of the watsonx Granite agent.

```bash
python -m backend.mcp_server      # serves get_momentum, get_xg_flow, get_key_moments,
                                  # get_pass_network, get_emotion_arc, search_players over MCP
```

This means the agent's capabilities are standards-based and portable: the tools can be registered with a gateway, shared across agents, and governed centrally rather than hard-wired to a single app.

### Multi-Agent Debate (Module 09)

Two IBM Granite personas — **The Advocate** and **The Skeptic** — receive the *same* real StatsBomb data and argue opposing readings of a result ("deserved" vs "flattered the winner"). A neutral third Granite pass weighs both and issues a consensus verdict. Because every agent gets identical data, the disagreement is interpretive, not factual — a clean demonstration of grounded reasoning under different framings.

---

## UX Design Decisions

**Solid colors over gradients.** Gradients draw the eye to the UI itself. In an analytics tool, the data must be the focal point. Every color in the palette is chosen for contrast against the dark background, not for decorative effect.

**Visual hierarchy matches decision order.** Score and teams appear first. xG insight appears second — it is the single most predictive metric and the most common question from a fan ("did the score reflect the play?"). Supporting data comes last.

**The evidence is always visible.** In VAR Oracle, the law chunk Docling parsed is shown. In Pitch Agent, every tool call and its raw output is expandable. In TacticalLens, the xG and momentum numbers that fed the Granite verdict are right above the verdict. A judge should never have to take the AI output on faith — they can inspect what went in.

**Honest limitations on every verdict.** Each AI output ships with an explicit "What this can't tell you" panel naming the blind spots of the data and method — surfacing uncertainty instead of implying false confidence.

**Accessibility & broadcast feel.** Ask by voice (speech-to-text) and have any Granite answer read aloud (text-to-speech) via the browser-native Web Speech API. Any verdict or briefing exports to a clean branded **PDF report** for sharing.

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

**Requirements:** Python 3.11+, Node.js 18+, and an IBM Granite backend — either an IBM **watsonx.ai** project (free tier) or **Ollama** running `granite3.3:8b` locally.

```bash
# 1. Clone and set up backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Configure environment — copy the template and fill in your provider
cp backend/example.env backend/.env
#   • watsonx (real IBM Granite, recommended): set WATSONX_API_KEY + WATSONX_PROJECT_ID
#   • offline Granite: install Ollama, run `ollama pull granite3.3:8b`, set LLM_PROVIDER=ollama
#   LLM_PROVIDER=auto selects watsonx → Ollama → Groq automatically.

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
Scout Eye needs to run offline, cold-start fast, without a separate database process. FAISS indexes 6,000+ player embeddings in ~200ms and queries in under 5ms. Warmed at startup via a background thread.

**Groq for IBM Granite inference.**
Sub-second latency lets the agentic tool-use loop complete 3–4 tool calls and return a synthesised answer in under 10 seconds — fast enough to feel interactive. Essential for Pitch Agent.

**Formation detection from average positions.**
StatsBomb open data does not expose lineup formations directly. Sorting players by average x-coordinate, dropping the deepest (goalkeeper proxy), and finding the two largest positional gaps gives a reliable heuristic. The code returns `'?'` when data is insufficient — explicitly acknowledged as a heuristic, not presented as ground truth.

**No mocked AI outputs — every Granite response is generated live from real StatsBomb data.**
No hardcoded responses, no pre-generated reports, no canned examples. If the data pipeline fails, the AI output fails — there is no fallback to fabricated plausibility. Judges can verify this: the Pitch Agent module exposes every tool call and the raw data it returned before Granite formed its answer.

---

## Credits

- [StatsBomb](https://statsbomb.com/open-data) for professional football event data, freely available
- [IBM Research](https://github.com/DS4SD/docling) for Docling
- [Ultralytics](https://ultralytics.com) for YOLOv8
- [Meta AI](https://faiss.ai) for FAISS
- [Hugging Face](https://huggingface.co/sentence-transformers) for sentence-transformers

---

*IBM SkillsBuild June Innovation Challenge 2026 · Solo submission*
