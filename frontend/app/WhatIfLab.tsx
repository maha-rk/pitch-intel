'use client'
import API_URL from './api-url'
import { tc } from './team-colors'

import { useState, useEffect } from 'react'
import Limitations from './Limitations'
import { SpeakButton } from './voice'
import { getLang } from './lang'
import { useTypewriter } from './useTypewriter'

interface Match {
  match_id: number
  match_date: string
  home_team: string
  away_team: string
  home_score?: number
  away_score?: number
}

interface SimResult {
  home_win: number
  draw: number
  away_win: number
  avg_home_goals: number
  avg_away_goals: number
  home_shots: number
  away_shots: number
  home_xg_total: number
  away_xg_total: number
}

interface Goal { index: number; minute: number; player: string; team: string; xg: number }

interface WhatIfResult {
  match_id: number
  home_team: string
  away_team: string
  baseline: SimResult
  goals: Goal[]
  sims: number
  counterfactual?: SimResult
  removed_event?: Goal
  narration?: string
  limitations?: string[]
  error?: string
}

function ProbBar({ label, value, prev, color }: { label: string; value: number; prev?: number; color: string }) {
  const delta = prev != null ? Math.round((value - prev) * 10) / 10 : null
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color }}>{value}%</span>
          {delta != null && delta !== 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: delta > 0 ? '#4ADE80' : '#F87171' }}>
              {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
            </span>
          )}
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        {prev != null && (
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${prev}%`, background: `${color}22`, borderRight: `1px dashed ${color}66` }} />
        )}
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

export default function WhatIfLab({ matches }: { matches: Match[] }) {
  const [selected, setSelected] = useState<Match | null>(null)
  const [result, setResult] = useState<WhatIfResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [removingIdx, setRemovingIdx] = useState<number | null>(null)

  const typedNarration = useTypewriter(result?.narration)

  useEffect(() => {
    const handler = () => { if (selected && result) load(selected) }
    window.addEventListener('lang-change', handler)
    return () => window.removeEventListener('lang-change', handler)
  }, [selected, result])

  const load = async (m: Match, removeIndex?: number) => {
    setLoading(true)
    if (removeIndex == null) { setResult(null); setRemovingIdx(null) }
    else setRemovingIdx(removeIndex)
    try {
      const p = new URLSearchParams({
        home_team: m.home_team, away_team: m.away_team, lang: getLang(),
      })
      if (removeIndex != null) p.set('remove_index', String(removeIndex))
      const res = await fetch(`${API_URL}/what-if/${m.match_id}?${p}`)
      setResult(await res.json())
    } catch (e) {}
    setLoading(false)
  }

  const cf = result?.counterfactual
  const base = result?.baseline

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', height: 'calc(100vh - 150px)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
    <style>{`
      @keyframes orbfloat { 0%{transform:translateY(-8px) scale(1.05)} 100%{transform:translateY(8px) scale(0.95)} }
    `}</style>

      {/* Fixture list */}
      <div style={{ background: 'var(--bg2)', borderRight: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>Fixtures</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {matches.map(m => {
            const sel = selected?.match_id === m.match_id
            return (
              <div key={m.match_id} onClick={() => { setSelected(m); load(m) }}
                style={{ padding: '9px 14px', borderBottom: '1px solid var(--bd)', borderLeft: `3px solid ${sel ? 'var(--green)' : 'transparent'}`, background: sel ? 'rgba(22,101,52,0.09)' : 'none', cursor: 'pointer' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: tc(m.home_team) }}>{m.home_team}</span> <span style={{ color: 'var(--t3)', fontSize: 9 }}>vs</span> <span style={{ color: tc(m.away_team) }}>{m.away_team}</span>
                </div>
                {m.home_score !== undefined && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginTop: 2, letterSpacing: '0.02em' }}>{m.home_score}–{m.away_score} · {m.match_date}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Lab stage */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'transparent', minHeight: 0 }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, position: 'relative', overflow: 'hidden' }}>
            <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} viewBox="0 0 600 500" preserveAspectRatio="xMidYMid slice" fill="none">
              <line x1="60" y1="420" x2="540" y2="420" stroke="#A855F7" strokeWidth="3" opacity="0.07"/>
              <line x1="60" y1="60" x2="60" y2="420" stroke="#A855F7" strokeWidth="3" opacity="0.07"/>
              <path d="M80 400 Q150 390 200 300 Q280 120 300 100 Q320 120 400 300 Q450 390 520 400" stroke="#A855F7" strokeWidth="4" fill="none" opacity="0.09"/>
              <path d="M80 400 Q150 390 200 300 Q280 120 300 100 Q320 120 400 300 Q450 390 520 400 L520 420 L80 420 Z" fill="#A855F7" opacity="0.03"/>
              <circle cx="160" cy="350" r="6" fill="#A855F7" opacity="0.10"/>
              <circle cx="220" cy="240" r="6" fill="#A855F7" opacity="0.10"/>
              <circle cx="300" cy="130" r="7" fill="#A855F7" opacity="0.12"/>
              <circle cx="380" cy="240" r="6" fill="#A855F7" opacity="0.10"/>
              <circle cx="440" cy="350" r="6" fill="#A855F7" opacity="0.10"/>
              <line x1="60" y1="320" x2="540" y2="320" stroke="#A855F7" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.04"/>
              <line x1="60" y1="220" x2="540" y2="220" stroke="#A855F7" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.04"/>
            </svg>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#A855F7', opacity: 0.8 }}>MODULE 10 · MONTE CARLO · xG</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 76, letterSpacing: '0.05em', lineHeight: 0.88, color: 'var(--t1)', textAlign: 'center', marginTop: 10 }}>ALTER</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 76, letterSpacing: '0.12em', lineHeight: 0.88, color: '#A855F7', textAlign: 'center', borderBottom: '3px solid #A855F7', paddingBottom: 6, marginBottom: 4 }}>EGO</div>
            <div style={{ fontSize: 52, opacity: 0.75, margin: '20px 0 14px', display: 'inline-block', animation: 'orbfloat 2s ease-in-out infinite alternate' }}>🔮</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--t3)', marginTop: 14 }}>How much did that goal actually matter?</div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Header */}
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: 'var(--t1)', lineHeight: 1 }}>
                  {selected.home_team} {selected.home_score}–{selected.away_score} {selected.away_team}
                </div>
                <div style={{ fontSize: 13, color: 'var(--t1)', marginTop: 5, fontWeight: 500 }}>
                  {selected.match_date} · Understand how much one goal shaped this result — xG Monte Carlo over the actual shots, 10,000 runs
                </div>
              </div>

              {loading && !result && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 0' }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: `lpb 1.2s ease ${i * 0.2}s infinite` }} />)}
                  <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 4 }}>Running 10,000 simulations…</span>
                </div>
              )}

              {result?.error && (
                <div style={{ padding: '12px 16px', background: '#1A0A0A', border: '1px solid #5A1A1A', borderRadius: 8, color: '#F87171', fontSize: 12 }}>
                  {result.error}
                </div>
              )}

              {base && (
                <>
                  {/* Probability panel */}
                  <div style={{ display: 'grid', gridTemplateColumns: cf ? '1fr 1fr' : '1fr', gap: 12 }}>
                    {/* Baseline */}
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '14px 16px' }}>
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 12 }}>
                        Baseline · all actual shots
                      </div>
                      <ProbBar label={`${result.home_team} win`} value={base.home_win} color="#4ADE80" />
                      <ProbBar label="Draw" value={base.draw} color="#94A3B8" />
                      <ProbBar label={`${result.away_team} win`} value={base.away_win} color="#60A5FA" />
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--bd)', fontSize: 10, color: 'var(--t1)', lineHeight: 1.6, fontWeight: 600 }}>
                        Expected goals: {result.home_team} {base.home_xg_total} ({base.home_shots} shots) · {result.away_team} {base.away_xg_total} ({base.away_shots} shots)
                      </div>
                    </div>

                    {/* Counterfactual */}
                    {cf && result.removed_event && (
                      <div style={{ background: 'var(--bg2)', border: '1px solid var(--g-border, #1A5535)', borderLeft: '3px solid var(--green)', borderRadius: 8, padding: '14px 16px' }}>
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 12 }}>
                          Counterfactual · without {result.removed_event.player}&apos;s {result.removed_event.minute}&apos; goal
                        </div>
                        <ProbBar label={`${result.home_team} win`} value={cf.home_win} prev={base.home_win} color="#4ADE80" />
                        <ProbBar label="Draw" value={cf.draw} prev={base.draw} color="#94A3B8" />
                        <ProbBar label={`${result.away_team} win`} value={cf.away_win} prev={base.away_win} color="#60A5FA" />
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--bd)', fontSize: 10, color: 'var(--t3)', lineHeight: 1.6 }}>
                          Dashed marker shows the baseline probability for comparison.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Goal selector */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--t1)', marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid var(--green)', display: 'inline-block' }}>
                      Remove a goal to re-simulate
                    </div>
                    {result.goals.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--t3)' }}>No goals recorded in this match&apos;s shot data.</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {result.goals.map(g => {
                          const active = removingIdx === g.index
                          return (
                            <button key={g.index} onClick={() => selected && load(selected, g.index)} disabled={loading}
                              style={{
                                padding: '8px 14px', borderRadius: 6, cursor: loading ? 'wait' : 'pointer',
                                background: active ? 'var(--green)' : 'var(--bg2)',
                                border: `1px solid ${active ? 'var(--green)' : 'var(--bd2)'}`,
                                color: active ? '#000' : 'var(--t2)', fontFamily: 'Inter, sans-serif',
                                fontSize: 12, fontWeight: 700, textAlign: 'left',
                              }}>
                              {g.minute}&apos; {g.player}
                              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, opacity: 0.8 }}>
                                {g.team} · xG {g.xg}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Granite narration */}
                  {result.narration && (
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '9px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>IBM Granite · explains the computed shift</span>
                        <SpeakButton text={result.narration} />
                      </div>
                      <div style={{ padding: '16px 18px', fontSize: 14, color: 'var(--t1)', lineHeight: 1.8 }}>{typedNarration || result.narration}</div>
                    </div>
                  )}

                  <Limitations items={result.limitations} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
