'use client'
import API_URL from './api-url'

import { useState, useEffect } from 'react'
import { MicButton } from './voice'
import { getLang } from './lang'
import Limitations from './Limitations'

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
  limitations?: string[]
  loading?: boolean
}

const TOOL_META: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  get_momentum:    { label: 'Momentum Data',    icon: '📈', color: '#3B82F6', desc: 'Minute-by-minute pressure & possession flow across 90 minutes' },
  get_xg_flow:     { label: 'xG Flow',          icon: '⚽', color: '#10B981', desc: 'Expected goals per shot — assesses chance quality and who deserved to win' },
  get_key_moments: { label: 'Key Moments',       icon: '⚡', color: '#F59E0B', desc: 'Goals, cards, substitutions — the chronological match story' },
  get_pass_network:{ label: 'Pass Network',      icon: '🔗', color: '#8B5CF6', desc: 'Passing connections and average positions — reveals team shape and playmakers' },
  get_emotion_arc: { label: 'Emotion Arc',       icon: '🌡', color: '#EF4444', desc: 'Match intensity arc based on event scoring — dramatic peaks and atmosphere' },
  search_players:  { label: 'Player Search',     icon: '🔍', color: '#F97316', desc: 'Semantic search across 6000+ players by role, style, or stat profile' },
}

const SUGGESTIONS: { text: string; icon: string; color: string }[] = [
  { text: 'Why did momentum shift in this match?',                                          icon: '📈', color: '#3B7CF6' },
  { text: 'Which team created better chances and why?',                                     icon: '⚽', color: '#10B981' },
  { text: 'Who were the key playmakers in the passing network?',                            icon: '🔗', color: '#8B5CF6' },
  { text: 'What were the biggest turning points?',                                          icon: '⚡', color: '#F59E0B' },
  { text: 'How intense was this match emotionally?',                                        icon: '🌡', color: '#EF4444' },
  { text: 'Find me a clinical striker with high xG under pressure',                        icon: '🔍', color: '#F97316' },
  { text: "What if the red card hadn't happened — how would momentum have shifted?",        icon: '🔮', color: '#A855F7' },
  { text: 'What if the match went to extra time — which team had more left in the tank?',  icon: '🔮', color: '#A855F7' },
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
        {typeof tc.args === 'object' && tc.args !== null && Object.keys(tc.args).length > 0 && (
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

function renderMarkdown(raw: string): string {
  function inline(s: string): string {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+?)\*/g, '<em style="color:var(--t1)">$1</em>')
      .replace(/`([^`\n]+?)`/g, '<code style="background:rgba(74,222,128,0.1);padding:1px 5px;border-radius:3px;font-size:11px;font-family:monospace;color:#4ADE80">$1</code>')
  }

  const isSep = (s: string) => /^\|[\s|:–\-]+\|?$/.test(s.trim())
  const lines = raw.split('\n')
  const parts: string[] = []
  let i = 0

  while (i < lines.length) {
    const t = lines[i].trim()

    // Table: header row followed by separator row
    if (t.startsWith('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        if (!isSep(lines[i]))
          rows.push(lines[i].trim().split('|').slice(1, -1).map(c => c.trim()))
        i++
      }
      if (rows.length > 0) {
        const [header, ...body] = rows
        let tbl = '<table style="border-collapse:collapse;width:100%;margin:10px 0;font-size:12px">'
        tbl += '<thead><tr>' + header.map(h =>
          `<th style="padding:5px 10px;border:1px solid #1A3020;background:#0A1A0E;text-align:left;font-size:10px;font-weight:700;color:#4ADE80;letter-spacing:0.08em;text-transform:uppercase">${inline(h)}</th>`
        ).join('') + '</tr></thead>'
        tbl += '<tbody>' + body.map((row, ri) =>
          `<tr style="background:${ri % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent'}">` +
          row.map(c => `<td style="padding:5px 10px;border:1px solid #1A3020;color:var(--t2)">${inline(c)}</td>`).join('') +
          '</tr>'
        ).join('') + '</tbody></table>'
        parts.push(tbl)
      }
      continue
    }

    // Headings
    const hm = t.match(/^(#{1,3})\s+(.+)/)
    if (hm) {
      const sz = ['17px', '14px', '13px'][hm[1].length - 1]
      parts.push(`<div style="font-weight:800;font-size:${sz};color:var(--t1);margin:10px 0 4px;line-height:1.3">${inline(hm[2])}</div>`)
      i++; continue
    }

    // Numbered list
    if (/^\d+\.\s+/.test(t)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      parts.push('<ol style="margin:6px 0 6px 18px;padding:0">' +
        items.map(it => `<li style="font-size:13px;color:var(--t2);line-height:1.75;margin-bottom:2px">${inline(it)}</li>`).join('') +
        '</ol>')
      continue
    }

    // Bullet list
    if (t.startsWith('- ') || t.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        items.push(lines[i].trim().slice(2))
        i++
      }
      parts.push('<ul style="margin:6px 0 6px 18px;padding:0">' +
        items.map(it => `<li style="font-size:13px;color:var(--t2);line-height:1.75;margin-bottom:2px">${inline(it)}</li>`).join('') +
        '</ul>')
      continue
    }

    // Empty line
    if (!t) { parts.push('<div style="height:5px"></div>'); i++; continue }

    // Paragraph
    parts.push(`<p style="margin:0 0 5px;font-size:13px;color:var(--t2);line-height:1.8">${inline(t)}</p>`)
    i++
  }

  return parts.join('')
}

export default function PitchAgent({ matches }: { matches: Match[] }) {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [matchOpen, setMatchOpen] = useState(false)
  const [toolRegistryOpen, setToolRegistryOpen] = useState(false)

  useEffect(() => {
    const handler = () => setMessages([])
    window.addEventListener('lang-change', handler)
    return () => window.removeEventListener('lang-change', handler)
  }, [])

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || loading) return

    setMessages(prev => [...prev, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    const loadingId = Date.now()
    setMessages(prev => [...prev, { role: 'agent', content: '', loading: true }])

    try {
      const body: Record<string, unknown> = { question, lang: getLang() }
      if (selectedMatch) {
        body.match_context = {
          match_id: selectedMatch.match_id,
          home_team: selectedMatch.home_team,
          away_team: selectedMatch.away_team,
          match_date: selectedMatch.match_date,
        }
      }

      const res = await fetch(`${API_URL}/agent/query`, {
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
          limitations: data.limitations || [],
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
    <div>

      {/* ── Dark hero panel — full bleed ── */}
      <div style={{ position:'relative', background:'linear-gradient(135deg,#050F08 0%,#0A1C10 55%,#050F08 100%)', borderRadius:0, padding:'40px 48px 36px', marginBottom:24, overflow:'hidden', border:'none', borderBottom:'1px solid rgba(0,212,106,0.18)', marginTop:-18, marginLeft:-22, marginRight:-22 }}>
        {/* Pitch SVG decoration */}
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', opacity:0.07 }} viewBox="0 0 860 260" preserveAspectRatio="xMidYMid slice">
          <rect x="60" y="20" width="740" height="220" fill="none" stroke="#00D46A" strokeWidth="1.5"/>
          <line x1="430" y1="20" x2="430" y2="240" stroke="#00D46A" strokeWidth="1.2"/>
          <circle cx="430" cy="130" r="55" fill="none" stroke="#00D46A" strokeWidth="1.2"/>
          <circle cx="430" cy="130" r="3" fill="#00D46A"/>
          <rect x="60" y="75" width="100" height="110" fill="none" stroke="#00D46A" strokeWidth="1"/>
          <rect x="700" y="75" width="100" height="110" fill="none" stroke="#00D46A" strokeWidth="1"/>
          <rect x="60" y="100" width="40" height="60" fill="none" stroke="#00D46A" strokeWidth="0.8"/>
          <rect x="760" y="100" width="40" height="60" fill="none" stroke="#00D46A" strokeWidth="0.8"/>
        </svg>

        <div style={{ position:'relative', zIndex:1 }}>
          {/* Eyebrow */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.28em', textTransform:'uppercase', color:'#00D46A' }}>MODULE 03 · AGENTIC AI</span>
            <div style={{ display:'flex', gap:5 }}>
              {['IBM Granite', 'Tool Use', 'StatsBomb'].map(tag => (
                <span key={tag} style={{ padding:'2px 9px', background:'rgba(0,212,106,0.12)', border:'1px solid rgba(0,212,106,0.28)', borderRadius:3, fontSize:9, fontWeight:700, color:'#00D46A', letterSpacing:'0.06em' }}>{tag}</span>
              ))}
            </div>
          </div>

          {/* Title */}
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'0.05em', lineHeight:0.88, borderBottom:'3px solid #00D46A', paddingBottom:6, display:'inline-block' }}>
            <span style={{ fontSize:80, color:'#FFFFFF' }}>PITCH </span><span style={{ fontSize:80, color:'#00D46A' }}>AGENT</span>
          </div>

          {/* Description */}
          <div style={{ fontSize:15, color:'rgba(255,255,255,0.65)', marginTop:18, lineHeight:1.65, maxWidth:820, fontWeight:400 }}>
            Ask any question about World Cup matches. IBM Granite reasons over real StatsBomb data — momentum flows, xG models, passing networks, player stats — and shows exactly which data it used.
          </div>
        </div>
      </div>

      <div style={{ maxWidth:860, margin:'0 auto' }}>{/* content-wrap */}

      {/* Tool Registry Panel */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => setToolRegistryOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            background: '#0A1A10', border: '1px solid rgba(0,212,106,0.25)',
            borderRadius: toolRegistryOpen ? '6px 6px 0 0' : 6,
            padding: '10px 16px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#00D46A' }}>Tool Registry</span>
          <span style={{ fontSize: 11, color: 'rgba(0,212,106,0.55)', fontWeight: 500 }}>· {Object.keys(TOOL_META).length} IBM Granite tools available</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(0,212,106,0.5)' }}>{toolRegistryOpen ? '▲' : '▼'}</span>
        </button>
        {toolRegistryOpen && (
          <div style={{ border: '1px solid rgba(0,212,106,0.2)', borderTop: 'none', borderRadius: '0 0 6px 6px', background: '#060F09', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {Object.entries(TOOL_META).map(([key, meta], i) => (
                <div key={key} style={{
                  padding: '16px 18px',
                  borderLeft: `3px solid ${meta.color}`,
                  borderRight: i % 3 !== 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  borderBottom: i < Object.keys(TOOL_META).length - 3 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  background: `${meta.color}08`,
                  transition: 'background 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <span style={{ fontSize: 16 }}>{meta.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: meta.color, letterSpacing: '0.04em' }}>{meta.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 }}>{meta.desc}</div>
                  <div style={{ marginTop: 8, display: 'inline-block', fontSize: 10, fontFamily: 'monospace', color: meta.color, opacity: 0.7, background: `${meta.color}14`, padding: '3px 8px', borderRadius: 3 }}>{key}()</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Match context selector */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--t1)', marginBottom: 8 }}>
          Match Context <span style={{ fontWeight: 500, color: 'var(--t2)', fontSize: 13, letterSpacing: '0.02em', textTransform: 'none' }}>— optional, narrows agent to one fixture</span>
        </div>
        <div style={{ position: 'relative', maxWidth: 520 }}>
          <div
            onClick={() => setMatchOpen(o => !o)}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 6,
              borderLeft: `3px solid ${selectedMatch ? 'var(--green)' : 'var(--bd2)'}`,
              padding: '11px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              transition: 'border-color 0.15s',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: selectedMatch ? 700 : 400, color: selectedMatch ? 'var(--t1)' : 'var(--t3)' }}>
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
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--t1)', marginBottom: 12 }}>
            Try asking
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTIONS.map(s => (
              <button
                key={s.text}
                onClick={() => ask(s.text)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 14px',
                  background: `${s.color}0D`,
                  border: `1px solid ${s.color}35`,
                  borderLeft: `3px solid ${s.color}`,
                  borderRadius: 5, fontSize: 12, color: 'var(--t1)', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', transition: 'all 0.14s', textAlign: 'left',
                  fontWeight: 500,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${s.color}1A`; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${s.color}20` }}
                onMouseLeave={e => { e.currentTarget.style.background = `${s.color}0D`; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {s.text}
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

                  {i === messages.length - 1 && !msg.loading && msg.limitations && msg.limitations.length > 0 && (
                    <Limitations items={msg.limitations} />
                  )}
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
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', background: 'var(--bg2)', borderTop: '1px solid var(--bd2)', borderBottom: '1px solid var(--bd2)' }}>
          <MicButton onResult={t => setInput(t)} />
        </div>
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
      </div>{/* end content-wrap */}
    </div>
  )
}
