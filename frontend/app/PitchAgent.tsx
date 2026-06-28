'use client'

import { useState } from 'react'

interface Match {
  match_id: number
  match_date: string
  home_team: string
  away_team: string
  home_score?: number
  away_score?: number
}

interface ToolCall {
  tool: string
  args: Record<string, unknown>
  preview: string
}

interface AgentMessage {
  role: 'user' | 'agent'
  content: string
  tool_calls?: ToolCall[]
  loading?: boolean
}

const TOOL_META: Record<string, { label: string; icon: string; color: string }> = {
  get_momentum:    { label: 'Momentum Data',    icon: '📈', color: '#3B82F6' },
  get_xg_flow:     { label: 'xG Flow',          icon: '⚽', color: '#10B981' },
  get_key_moments: { label: 'Key Moments',       icon: '⚡', color: '#F59E0B' },
  get_pass_network:{ label: 'Pass Network',      icon: '🔗', color: '#8B5CF6' },
  get_emotion_arc: { label: 'Emotion Arc',       icon: '🌡', color: '#EF4444' },
  search_players:  { label: 'Player Search',     icon: '🔍', color: '#F97316' },
}

const SUGGESTIONS = [
  'Why did momentum shift in this match?',
  'Which team created better chances and why?',
  'Who were the key playmakers in the passing network?',
  'What were the biggest turning points?',
  'How intense was this match emotionally?',
  'Find me a clinical striker with high xG under pressure',
]

function ToolCallBadge({ tc }: { tc: ToolCall }) {
  const [open, setOpen] = useState(false)
  const meta = TOOL_META[tc.tool] || { label: tc.tool, icon: '🔧', color: '#6B7280' }
  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 10px', borderRadius: 4,
          background: `${meta.color}14`, border: `1px solid ${meta.color}30`,
          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}
      >
        <span style={{ fontSize: 11 }}>{meta.icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, letterSpacing: '0.06em' }}>
          {meta.label}
        </span>
        {Object.keys(tc.args).length > 0 && (
          <span style={{ fontSize: 9, color: 'var(--t3)' }}>
            {Object.entries(tc.args).map(([k, v]) => `${k}=${v}`).join(' · ')}
          </span>
        )}
        <span style={{ fontSize: 9, color: 'var(--t3)', marginLeft: 2 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          marginTop: 4, padding: '8px 10px', background: 'var(--bg)',
          border: `1px solid ${meta.color}20`, borderRadius: 4,
          fontFamily: 'monospace', fontSize: 10, color: 'var(--t3)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 120, overflowY: 'auto'
        }}>
          {tc.preview}
        </div>
      )}
    </div>
  )
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

export default function PitchAgent({ matches }: { matches: Match[] }) {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [matchOpen, setMatchOpen] = useState(false)

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || loading) return

    setMessages(prev => [...prev, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    const loadingId = Date.now()
    setMessages(prev => [...prev, { role: 'agent', content: '', loading: true }])

    try {
      const body: Record<string, unknown> = { question }
      if (selectedMatch) {
        body.match_context = {
          match_id: selectedMatch.match_id,
          home_team: selectedMatch.home_team,
          away_team: selectedMatch.away_team,
          match_date: selectedMatch.match_date,
        }
      }

      const res = await fetch('http://localhost:8001/agent/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        {
          role: 'agent',
          content: data.answer || data.error || 'No response.',
          tool_calls: data.tool_calls || [],
        }
      ])
    } catch {
      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        { role: 'agent', content: 'Connection error — is the backend running?', tool_calls: [] }
      ])
    }

    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--green)' }}>
            Module 07 · Agentic AI
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {['IBM Granite', 'Tool Use', 'StatsBomb'].map(tag => (
              <span key={tag} style={{
                padding: '2px 8px', background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)', borderRadius: 3,
                fontSize: 9, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em'
              }}>{tag}</span>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, letterSpacing: '0.06em', color: 'var(--t1)', lineHeight: 1 }}>
          Pitch Agent
        </div>
        <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 7, lineHeight: 1.6, maxWidth: 620 }}>
          Ask any question about World Cup matches. IBM Granite reasons over real StatsBomb data —
          momentum flows, xG models, passing networks, player stats — and shows you exactly which data it used.
        </div>
      </div>

      {/* Match context selector */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 5 }}>
          Match Context (optional — narrows agent to a specific fixture)
        </div>
        <div style={{ position: 'relative', maxWidth: 480 }}>
          <div
            onClick={() => setMatchOpen(o => !o)}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 6,
              padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 12, color: selectedMatch ? 'var(--t1)' : 'var(--t3)' }}>
              {selectedMatch
                ? `${selectedMatch.home_team} vs ${selectedMatch.away_team} — ${selectedMatch.match_date}`
                : 'No match selected — agent uses all 128 matches'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 8, flexShrink: 0 }}>{matchOpen ? '▲' : '▼'}</span>
          </div>
          {matchOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 6,
              marginTop: 4, maxHeight: 220, overflowY: 'auto',
            }}>
              <div
                onClick={() => { setSelectedMatch(null); setMatchOpen(false) }}
                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--bd)', fontSize: 12, color: 'var(--t3)' }}
              >
                No match — all fixtures
              </div>
              {matches.map(m => (
                <div
                  key={m.match_id}
                  onClick={() => { setSelectedMatch(m); setMatchOpen(false) }}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--bd)',
                    background: selectedMatch?.match_id === m.match_id ? 'var(--bg3)' : 'transparent',
                    fontSize: 12, color: 'var(--t2)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = selectedMatch?.match_id === m.match_id ? 'var(--bg3)' : 'transparent')}
                >
                  <span style={{ color: 'var(--t1)', fontWeight: 700 }}>
                    {m.home_team}{m.home_score != null ? ` ${m.home_score}–${m.away_score}` : ' vs'} {m.away_team}
                  </span>
                  <span style={{ marginLeft: 8, color: 'var(--t3)', fontSize: 11 }}>{m.match_date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Suggested questions */}
      {messages.length === 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>
            Try asking
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => ask(s)}
                style={{
                  padding: '6px 12px', background: 'var(--bg2)', border: '1px solid var(--bd)',
                  borderRadius: 6, fontSize: 12, color: 'var(--t2)', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', transition: 'all 0.12s', textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.color = 'var(--t1)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.color = 'var(--t2)' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message thread */}
      {messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'user' ? (
                <div style={{
                  maxWidth: '70%', padding: '10px 14px', borderRadius: 8,
                  background: 'var(--green)', color: '#000', fontSize: 13, fontWeight: 600, lineHeight: 1.6,
                }}>
                  {msg.content}
                </div>
              ) : (
                <div style={{ maxWidth: '88%' }}>
                  {/* Tool calls (reasoning chain) */}
                  {msg.tool_calls && msg.tool_calls.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 5 }}>
                        IBM Granite · Data Retrieved
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {msg.tool_calls.map((tc, j) => <ToolCallBadge key={j} tc={tc} />)}
                      </div>
                    </div>
                  )}

                  {/* Answer */}
                  <div style={{
                    padding: '12px 16px', background: 'var(--bg2)', border: '1px solid var(--bd)',
                    borderLeft: '3px solid var(--green)', borderRadius: '0 8px 8px 0',
                  }}>
                    {msg.loading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--t3)', fontSize: 12 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {[0, 1, 2].map(d => (
                            <div key={d} style={{
                              width: 5, height: 5, borderRadius: '50%', background: 'var(--green)',
                              animation: 'lpb 1.1s ease infinite', animationDelay: `${d * 0.18}s`
                            }} />
                          ))}
                        </div>
                        Granite is analysing the data…
                      </div>
                    ) : (
                      <div
                        style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.8 }}
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: 0, position: 'sticky', bottom: 0, paddingBottom: 4, background: 'var(--bg)' }}>
        <input
          style={{
            flex: 1, background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRight: 'none',
            padding: '12px 16px', fontSize: 13, color: 'var(--t1)', outline: 'none',
            fontFamily: 'Inter, sans-serif', borderRadius: '6px 0 0 6px',
          }}
          placeholder={selectedMatch
            ? `Ask about ${selectedMatch.home_team} vs ${selectedMatch.away_team}…`
            : 'Ask anything about World Cup matches, tactics, players…'
          }
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask(input)}
          disabled={loading}
        />
        <button
          onClick={() => ask(input)}
          disabled={!input.trim() || loading}
          style={{
            padding: '12px 24px',
            background: !input.trim() || loading ? 'var(--bg4)' : 'var(--green)',
            color: !input.trim() || loading ? 'var(--t3)' : '#000',
            border: 'none', borderRadius: '0 6px 6px 0',
            fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
            cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif', flexShrink: 0, transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Thinking…' : 'Ask Granite'}
        </button>
      </div>

      {messages.length > 0 && (
        <div style={{ marginTop: 8, textAlign: 'right' }}>
          <button
            onClick={() => setMessages([])}
            style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--t3)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
          >
            Clear conversation
          </button>
        </div>
      )}
    </div>
  )
}
