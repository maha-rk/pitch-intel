'use client'

import { useState } from 'react'
import Limitations from './Limitations'

interface Match {
  match_id: number
  match_date: string
  home_team: string
  away_team: string
  home_score?: number
  away_score?: number
}

interface ArcPoint {
  minute: number
  display_minute?: number
  score: number
  labels: string[]
}

interface EmotiData {
  emotion_arc: ArcPoint[]
  peak_moments: ArcPoint[]
  max_score: number
  intensity: 'THRILLER' | 'HIGH INTENSITY' | 'COMPETITIVE' | 'CONTROLLED'
  atmosphere_report: string
  limitations?: string[]
  home_team: string
  away_team: string
  result?: string
}

const INTENSITY_CFG = {
  THRILLER:       { color: '#F87171', bg: '#450A0A', glow: '#EF4444' },
  'HIGH INTENSITY':{ color: '#FBBF24', bg: '#451A03', glow: '#F59E0B' },
  COMPETITIVE:    { color: '#4ADE80', bg: '#14532D', glow: '#22C55E' },
  CONTROLLED:     { color: '#9CA3AF', bg: '#1F2937', glow: '#6B7280' },
}

function PulseChart({ arc, maxScore, intensity }: { arc: ArcPoint[], maxScore: number, intensity: string }) {
  const W = 880, H = 130
  const PAD = { t: 12, r: 16, b: 28, l: 32 }
  const cW = W - PAD.l - PAD.r
  const cH = H - PAD.t - PAD.b
  const cfg = INTENSITY_CFG[intensity as keyof typeof INTENSITY_CFG] ?? INTENSITY_CFG.COMPETITIVE
  const maxMinute = arc.length > 0 ? arc[arc.length - 1].minute : 90
  const cap = Math.max(maxScore, 30)

  const toX = (m: number) => PAD.l + (m / maxMinute) * cW
  const toY = (s: number) => PAD.t + cH - Math.min(s / cap, 1) * cH

  const pts = arc.map(p => ({ x: toX(p.minute), y: toY(p.score), ...p }))

  // Smooth cubic bezier path
  const pathD = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
    const prev = pts[i - 1]
    const cp1x = (prev.x + (pt.x - prev.x) * 0.45).toFixed(1)
    const cp2x = (pt.x - (pt.x - prev.x) * 0.45).toFixed(1)
    return `${acc} C ${cp1x},${prev.y.toFixed(1)} ${cp2x},${pt.y.toFixed(1)} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
  }, '')

  const baseline = toY(0)
  const fillD = pts.length
    ? `${pathD} L ${pts[pts.length - 1].x},${baseline} L ${PAD.l},${baseline} Z`
    : ''

  const peakPts = pts.filter(p => p.labels.length > 0 && p.score >= 18)

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="epGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cfg.color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={cfg.color} stopOpacity="0.02" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Grid lines at 45' halftime */}
        <line x1={toX(45)} y1={PAD.t} x2={toX(45)} y2={baseline}
          stroke="var(--bd2)" strokeWidth="1" strokeDasharray="3 3" />
        <text x={toX(45) + 4} y={PAD.t + 10} fontSize="8" fill="var(--t3)">HT</text>

        {/* Fill area */}
        <path d={fillD} fill="url(#epGrad)" />

        {/* Pulse line */}
        <path d={pathD} fill="none" stroke={cfg.color} strokeWidth="1.8"
          strokeLinejoin="round" filter="url(#glow)" />

        {/* Peak event dots */}
        {peakPts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={p.score >= 80 ? 5.5 : 3.5}
              fill={p.score >= 80 ? '#F59E0B' : cfg.color}
              stroke="var(--bg)" strokeWidth="1.5"
            />
          </g>
        ))}

        {/* Minute axis */}
        {[0, 15, 30, 45, 60, 75, 90].map(m => (
          <text key={m} x={toX(m)} y={H - 4}
            fontSize="9" fill="var(--t3)" textAnchor="middle">{m}&apos;</text>
        ))}
      </svg>
    </div>
  )
}

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

export default function EmotiPulse({ matches }: { matches: Match[] }) {
  const [selected, setSelected] = useState<Match | null>(null)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<EmotiData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const scan = async () => {
    if (!selected) return
    setLoading(true); setData(null); setError(null)
    try {
      const params = new URLSearchParams({
        home_team: selected.home_team,
        away_team: selected.away_team,
      })
      const res = await fetch(`http://localhost:8001/emotipulse/${selected.match_id}?${params}`)
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const json: EmotiData = await res.json()
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const cfg = data ? (INTENSITY_CFG[data.intensity] ?? INTENSITY_CFG.COMPETITIVE) : null
  const paragraphs = data?.atmosphere_report.split(/\n\n+/).filter(p => p.trim()) ?? []

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 5 }}>
          Module 05 · Match Atmosphere Intelligence
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, letterSpacing: '0.06em', color: 'var(--t1)', lineHeight: 1 }}>EmotiPulse</div>
        <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 7, lineHeight: 1.6, maxWidth: 640 }}>
          Select a match. <strong style={{ color: 'var(--t1)' }}>StatsBomb</strong> event data is scored by emotional weight —
          goals, cards, near-misses — and rendered as a live <strong style={{ color: 'var(--t1)' }}>match pulse</strong>.
          AI delivers a broadcast-grade atmosphere report.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {['StatsBomb Events', 'Emotion Scoring', 'Pulse Visualisation', 'AI Atmosphere Report'].map(tag => (
            <span key={tag} style={{ padding: '3px 10px', background: 'var(--bg3)', border: '1px solid var(--bd)', borderRadius: 3, fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.06em' }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* ── Match selector ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <div
            onClick={() => setOpen(o => !o)}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 6,
              padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, color: selected ? 'var(--t1)' : 'var(--t3)' }}>
              {selected
                ? `${selected.home_team} vs ${selected.away_team} — ${selected.match_date}`
                : 'Select a match…'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--t3)' }}>{open ? '▲' : '▼'}</span>
          </div>
          {open && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 6,
              marginTop: 4, maxHeight: 260, overflowY: 'auto',
            }}>
              {matches.map(m => (
                <div
                  key={m.match_id}
                  onClick={() => { setSelected(m); setOpen(false); setData(null) }}
                  style={{
                    padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--bd)',
                    background: selected?.match_id === m.match_id ? 'var(--bg3)' : 'transparent',
                    fontSize: 12, color: 'var(--t2)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = selected?.match_id === m.match_id ? 'var(--bg3)' : 'transparent')}
                >
                  <span style={{ color: 'var(--t1)', fontWeight: 700 }}>
                    {m.home_team}
                    {m.home_score != null ? ` ${m.home_score}–${m.away_score}` : ' vs'}
                    {' '}{m.away_team}
                  </span>
                  <span style={{ marginLeft: 10, color: 'var(--t3)', fontSize: 11 }}>{m.match_date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={scan}
          disabled={!selected || loading}
          style={{
            padding: '10px 28px', background: !selected || loading ? 'var(--bg4)' : 'var(--green)',
            color: !selected || loading ? 'var(--t3)' : '#000',
            border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 800,
            letterSpacing: '0.14em', textTransform: 'uppercase', cursor: !selected || loading ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif', flexShrink: 0, transition: 'all 0.15s',
          }}
        >
          {loading ? 'Scanning…' : 'Scan Match'}
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'lpb 0.9s ease infinite', marginBottom: 14 }} />
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.1em', color: 'var(--t2)', marginBottom: 5 }}>Scanning Match Events</div>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>Scoring 900+ StatsBomb events by emotional weight…</div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{ background: '#2D0D0D', border: '1px solid #7B2020', borderRadius: 8, padding: '14px 18px' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#EF4444' }}>Error — </span>
          <span style={{ fontSize: 12, color: 'var(--t2)' }}>{error}</span>
        </div>
      )}

      {/* ── Results ── */}
      {data && cfg && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Intensity banner */}
          <div style={{
            background: 'var(--bg2)', border: `1px solid ${cfg.color}40`,
            borderTop: `3px solid ${cfg.color}`, borderRadius: 8, overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 20px', borderBottom: `1px solid ${cfg.color}20`,
              background: `linear-gradient(90deg, ${cfg.color}0A 0%, transparent 60%)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color }} />
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--t3)' }}>
                  {data.result ?? `${data.home_team} vs ${data.away_team}`}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--t3)' }}>Peak Score</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: cfg.color, lineHeight: 1 }}>{data.max_score}</div>
                </div>
                <div style={{ padding: '6px 16px', background: cfg.bg, border: `1px solid ${cfg.color}50`, borderRadius: 4 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.08em', color: cfg.color, whiteSpace: 'nowrap' }}>{data.intensity}</div>
                </div>
              </div>
            </div>

            {/* Pulse chart */}
            <div style={{ padding: '18px 20px 10px' }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 10 }}>
                Emotional Intensity · 5-Minute Windows
              </div>
              <PulseChart arc={data.emotion_arc} maxScore={data.max_score} intensity={data.intensity} />
            </div>
          </div>

          {/* Peak moments + atmosphere report */}
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 14, alignItems: 'start' }}>

            {/* Peak moments — only labeled entries */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>Peak Moments</span>
              </div>
              <div>
                {(() => {
                  const labeled = data.peak_moments.filter(p => p.labels.length > 0)
                  if (labeled.length === 0) return (
                    <div style={{ padding: '14px', fontSize: 12, color: 'var(--t3)' }}>No key events detected.</div>
                  )
                  return labeled.map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                      padding: '10px 14px',
                      borderBottom: i < labeled.length - 1 ? '1px solid var(--bd)' : 'none',
                    }}>
                      <div style={{
                        fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, color: cfg.color,
                        lineHeight: 1.1, minWidth: 30, textAlign: 'right', flexShrink: 0, paddingTop: 1,
                      }}>{p.display_minute ?? p.minute}&apos;</div>
                      <div style={{ flex: 1 }}>
                        {p.labels.map((l, j) => (
                          <div key={j} style={{
                            fontSize: 11, fontWeight: 700, lineHeight: 1.45,
                            color: l.startsWith('GOAL') || l.startsWith('RED') || l.startsWith('2nd') ? cfg.color : 'var(--t1)',
                          }}>{l}</div>
                        ))}
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>

            {/* Atmosphere report */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>Atmosphere Report</span>
                <span style={{ fontSize: 10, color: 'var(--t3)' }}>AI Broadcast Commentary</span>
              </div>
              <div>
                {paragraphs.map((p, i) => (
                  <div key={i} style={{
                    padding: '13px 18px',
                    borderBottom: i < paragraphs.length - 1 ? '1px solid var(--bd)' : 'none',
                  }}>
                    <div style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase',
                      color: cfg.color, marginBottom: 5, fontFamily: 'Inter, sans-serif',
                    }}>0{i + 1}</div>
                    <div
                      style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.8 }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(p) }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Limitations items={data.limitations} />
          </div>
        </div>
      )}
    </div>
  )
}
