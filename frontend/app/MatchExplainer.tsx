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

interface BriefingResult {
  briefing: string
  limitations?: string[]
  stats: Record<string, Record<string, number>>
  match: string
  date: string
  type: string
}

const TEAM_COLORS: Record<string, string> = {
  'Brazil': '#F59E0B', 'Belgium': '#EF4444', 'France': '#3B82F6',
  'Croatia': '#F97316', 'England': '#E2E8F0', 'Argentina': '#60A5FA',
  'Germany': '#38BDF8', 'Spain': '#F87171', 'Portugal': '#4ADE80',
  'Morocco': '#FBBF24', 'Canada': '#EF4444', 'Netherlands': '#F97316',
  'Uruguay': '#60A5FA', 'Japan': '#3B82F6', 'Senegal': '#A78BFA',
  'United States': '#60A5FA', 'Australia': '#FBBF24', 'Switzerland': '#F87171',
  'Poland': '#E2E8F0', 'South Korea': '#EF4444', 'Tunisia': '#F59E0B',
  'Cameroon': '#4ADE80', 'Ghana': '#F59E0B', 'Ecuador': '#F59E0B',
  'Qatar': '#8B5CF6', 'Iran': '#4ADE80', 'Saudi Arabia': '#4ADE80',
  'Wales': '#EF4444', 'Denmark': '#EF4444',
}

const PRE_SECTIONS = ['Tactical Preview', 'Key Advantage', 'Decisive Factor']
const POST_SECTIONS = ['Match Overview', 'Statistical Story', 'Key Insight']

function tc(team: string, fallback: string) {
  return TEAM_COLORS[team] || fallback
}

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

export default function MatchExplainer({ matches }: { matches: Match[] }) {
  const [selected, setSelected] = useState<Match | null>(null)
  const [briefingType, setBriefingType] = useState<'pre' | 'post'>('post')
  const [result, setResult] = useState<BriefingResult | null>(null)
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    if (!selected) return
    setLoading(true)
    setResult(null)
    try {
      const params = new URLSearchParams({
        home_team: selected.home_team,
        away_team: selected.away_team,
        match_date: selected.match_date,
        briefing_type: briefingType,
      })
      const res = await fetch(`http://localhost:8001/explainer/${selected.match_id}?${params}`)
      setResult(await res.json())
    } catch(e) {}
    setLoading(false)
  }

  const hc = selected ? tc(selected.home_team, '#10B981') : '#10B981'
  const ac = selected ? tc(selected.away_team, '#F97316') : '#F97316'

  const teamNames = result ? Object.keys(result.stats) : []
  const t1 = teamNames[0] ?? ''
  const t2 = teamNames[1] ?? ''
  const t1c = tc(t1, hc)
  const t2c = tc(t2, ac)

  const paragraphs = result ? result.briefing.split(/\n\n+/).filter(p => p.trim()) : []
  const sections = briefingType === 'pre' ? PRE_SECTIONS : POST_SECTIONS
  const STATS = ['passes', 'shots', 'pressures', 'carries', 'tackles']

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '220px 1fr',
      height: 'calc(100vh - 150px)',
      border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden',
    }}>

      {/* ── FIXTURE LIST ── */}
      <div style={{ background: 'var(--bg2)', borderRight: '1px solid var(--bd)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>Fixtures</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)' }}>{matches.length}</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {matches.map(m => {
            const sel = selected?.match_id === m.match_id
            return (
              <div
                key={m.match_id}
                onClick={() => { setSelected(m); setResult(null) }}
                style={{
                  padding: '9px 14px', borderBottom: '1px solid var(--bd)',
                  borderLeft: `3px solid ${sel ? 'var(--green)' : 'transparent'}`,
                  background: sel ? 'rgba(16,185,129,0.06)' : 'none',
                  cursor: 'pointer', transition: 'background 0.1s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: tc(m.home_team, 'var(--t1)') }}>{m.home_team}</span>
                    <span style={{ color: 'var(--t3)', fontSize: 9, fontWeight: 800, margin: '0 4px' }}>vs</span>
                    <span style={{ color: tc(m.away_team, 'var(--t2)') }}>{m.away_team}</span>
                  </div>
                  {m.home_score !== undefined && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--t2)', flexShrink: 0 }}>{m.home_score}–{m.away_score}</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{m.match_date}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── MAIN PANEL ── */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

        {!selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, letterSpacing: '0.1em', color: 'var(--bg5)', lineHeight: 1 }}>Match Explainer</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--t3)' }}>Select a fixture to generate your briefing</div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* ── SCORE HEADER ── */}
            <div style={{ position: 'relative', overflow: 'hidden', flexShrink: 0, padding: '22px 28px', background: 'var(--bg2)', borderBottom: '1px solid var(--bd)' }}>
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(105deg, ${hc}20 0%, transparent 42%)`, pointerEvents: 'none' }}/>
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(255deg, ${ac}20 0%, transparent 42%)`, pointerEvents: 'none' }}/>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 20, alignItems: 'center', position: 'relative' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6 }}>Home</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: '0.05em', color: hc, lineHeight: 1 }}>{selected.home_team}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, letterSpacing: '0.06em', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center' }}>
                    <span style={{ color: hc }}>{selected.home_score ?? '—'}</span>
                    <span style={{ color: 'var(--bg5)', fontSize: 32 }}>:</span>
                    <span style={{ color: ac }}>{selected.away_score ?? '—'}</span>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', marginTop: 6, letterSpacing: '0.06em' }}>{selected.match_date} · FIFA World Cup</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6 }}>Away</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: '0.05em', color: ac, lineHeight: 1 }}>{selected.away_team}</div>
                </div>
              </div>
            </div>

            {/* ── CONTROLS ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--bd)', flexShrink: 0, background: 'var(--bg2)' }}>
              <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 4, overflow: 'hidden' }}>
                {(['pre', 'post'] as const).map(t => (
                  <button key={t} onClick={() => setBriefingType(t)} style={{
                    padding: '6px 18px', background: briefingType === t ? 'var(--green)' : 'none',
                    color: briefingType === t ? '#000' : 'var(--t3)', border: 'none',
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.12s',
                  }}>
                    {t === 'pre' ? 'Pre-Match' : 'Post-Match'}
                  </button>
                ))}
              </div>
              <button onClick={generate} disabled={loading} style={{
                padding: '7px 22px', background: loading ? 'var(--bg4)' : 'var(--green)',
                color: loading ? 'var(--t3)' : '#000', border: 'none', borderRadius: 4,
                fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
              }}>
                {loading ? 'Generating...' : 'Generate Briefing'}
              </button>
              {loading && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', animation: `lpb 1.2s ease ${i * 0.2}s infinite` }}/>
                  ))}
                  <span style={{ fontSize: 11, color: 'var(--t3)', marginLeft: 4 }}>Analysing match data…</span>
                </div>
              )}
            </div>

            {result && teamNames.length >= 2 && (
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* ── STAT CALLOUT CARDS ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {STATS.map(stat => {
                    const v1 = result.stats[t1]?.[stat] ?? 0
                    const v2 = result.stats[t2]?.[stat] ?? 0
                    const h1 = v1 > v2, h2 = v2 > v1
                    return (
                      <div key={stat} style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '10px 10px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 10 }}>{stat}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <div>
                            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, lineHeight: 1, color: h1 ? t1c : 'var(--t3)' }}>{v1}</div>
                            <div style={{ fontSize: 8, color: 'var(--t3)', fontWeight: 700, marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t1.split(' ')[0]}</div>
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--bd3)', fontWeight: 700, paddingBottom: 14 }}>vs</div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, lineHeight: 1, color: h2 ? t2c : 'var(--t3)' }}>{v2}</div>
                            <div style={{ fontSize: 8, color: 'var(--t3)', fontWeight: 700, marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t2.split(' ')[0]}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* ── VERSUS BARS ── */}
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '9px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>Statistical Breakdown</span>
                    <div style={{ display: 'flex', gap: 14 }}>
                      {[[t1, t1c],[t2, t2c]].map(([name, color]) => (
                        <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: color as string }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color as string, display: 'inline-block', flexShrink: 0 }}/>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {STATS.map(stat => {
                      const v1 = result.stats[t1]?.[stat] ?? 0
                      const v2 = result.stats[t2]?.[stat] ?? 0
                      const total = v1 + v2
                      const pct1 = total === 0 ? 50 : (v1 / total) * 100
                      const bothZero = total === 0
                      return (
                        <div key={stat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, color: (!bothZero && v1 >= v2) ? t1c : 'var(--t3)', minWidth: 40, textAlign: 'right', lineHeight: 1 }}>{v1}</span>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex', background: 'var(--bg4)' }}>
                            <div style={{ width: `${pct1}%`, background: bothZero ? 'var(--bg5)' : t1c, transition: 'width 0.5s ease' }}/>
                            <div style={{ flex: 1, background: bothZero ? 'var(--bg5)' : t2c }}/>
                          </div>
                          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, color: (!bothZero && v2 > v1) ? t2c : 'var(--t3)', minWidth: 40, lineHeight: 1 }}>{v2}</span>
                          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--t3)', minWidth: 62 }}>{stat}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── AI BRIEFING ── */}
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '9px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }}/>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>
                        AI Analyst · {result.type === 'pre' ? 'Pre-Match' : 'Post-Match'} Briefing
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>IBM Granite · StatsBomb Data</span>
                  </div>
                  <div style={{ padding: '0 20px' }}>
                    {paragraphs.map((para, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 18, alignItems: 'flex-start',
                        padding: '16px 0',
                        borderBottom: i < paragraphs.length - 1 ? '1px solid var(--bd)' : 'none',
                      }}>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, color: 'var(--bg5)', lineHeight: 1, flexShrink: 0, width: 42, paddingTop: 1 }}>
                          0{i + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 7 }}>
                            {sections[i] ?? `Section ${i + 1}`}
                          </div>
                          <div
                            style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.8 }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(para) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Limitations items={result.limitations} />

              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
