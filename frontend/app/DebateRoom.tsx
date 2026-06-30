'use client'
import API_URL from './api-url'
import { tc } from './team-colors'

import { useState, useEffect } from 'react'
import Limitations from './Limitations'
import { SpeakButton } from './voice'
import { exportReport } from './pdf'
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

interface Agent { name: string; stance: string; argument: string }
interface DebateResult {
  topic: string
  data_summary: string
  agent_a: Agent
  agent_b: Agent
  consensus: string
  limitations?: string[]
}

export default function DebateRoom({ matches }: { matches: Match[] }) {
  const [selected, setSelected] = useState<Match | null>(null)
  const [result, setResult] = useState<DebateResult | null>(null)
  const [loading, setLoading] = useState(false)

  const typedArgA = useTypewriter(result?.agent_a.argument)
  const typedArgB = useTypewriter(result?.agent_b.argument, 6)
  const typedConsensus = useTypewriter(result?.consensus, 5)

  useEffect(() => {
    const handler = () => { if (selected && result) run() }
    window.addEventListener('lang-change', handler)
    return () => window.removeEventListener('lang-change', handler)
  }, [selected, result])

  const run = async () => {
    if (!selected) return
    setLoading(true); setResult(null)
    try {
      const p = new URLSearchParams({
        home_team: selected.home_team, away_team: selected.away_team,
        home_score: String(selected.home_score ?? 0), away_score: String(selected.away_score ?? 0),
        lang: getLang(),
      })
      const res = await fetch(`${API_URL}/debate/${selected.match_id}?${p}`)
      setResult(await res.json())
    } catch (e) {}
    setLoading(false)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', height: 'calc(100vh - 150px)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
    <style>{`
      @keyframes scaletip { 0%{transform:rotate(-12deg)} 100%{transform:rotate(12deg)} }
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
              <div key={m.match_id} onClick={() => { setSelected(m); setResult(null) }}
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

      {/* Debate stage */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'transparent', minHeight: 0 }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, position: 'relative', overflow: 'hidden' }}>
            <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} viewBox="0 0 600 500" preserveAspectRatio="xMidYMid slice" fill="none">
              <line x1="300" y1="80" x2="300" y2="420" stroke="#2DD4BF" strokeWidth="5" opacity="0.16"/>
              <line x1="100" y1="190" x2="500" y2="190" stroke="#2DD4BF" strokeWidth="5" opacity="0.16"/>
              <line x1="100" y1="190" x2="130" y2="320" stroke="#2DD4BF" strokeWidth="4" opacity="0.14"/>
              <line x1="500" y1="190" x2="470" y2="300" stroke="#2DD4BF" strokeWidth="4" opacity="0.14"/>
              <path d="M80 320 Q105 380 130 320" stroke="#2DD4BF" strokeWidth="4" fill="none" opacity="0.16"/>
              <path d="M470 300 Q495 355 520 300" stroke="#2DD4BF" strokeWidth="4" fill="none" opacity="0.14"/>
              <line x1="265" y1="420" x2="335" y2="420" stroke="#2DD4BF" strokeWidth="7" strokeLinecap="round" opacity="0.18"/>
              <circle cx="100" cy="190" r="10" fill="#2DD4BF" opacity="0.16"/>
              <circle cx="500" cy="190" r="10" fill="#2DD4BF" opacity="0.16"/>
              <circle cx="300" cy="80" r="8" fill="#2DD4BF" opacity="0.18"/>
            </svg>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#2DD4BF', opacity: 0.8 }}>MODULE 09 · MULTI-AGENT AI</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 76, letterSpacing: '0.05em', lineHeight: 0.88, color: 'var(--t1)', textAlign: 'center', marginTop: 10 }}>DEBATE</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 76, letterSpacing: '0.12em', lineHeight: 0.88, color: '#2DD4BF', textAlign: 'center', borderBottom: '3px solid #2DD4BF', paddingBottom: 6, marginBottom: 4 }}>ROOM</div>
            <div style={{ fontSize: 52, opacity: 0.75, margin: '20px 0 14px', display: 'inline-block', transformOrigin: 'bottom center', animation: 'scaletip 1.6s ease-in-out infinite alternate' }}>⚖️</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--t3)', marginTop: 14 }}>Two Granite agents · one match · opposing views</div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Header / run */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: 'var(--t1)', lineHeight: 1 }}>
                  {selected.home_team} {selected.home_score}–{selected.away_score} {selected.away_team}
                </div>
                <div style={{ fontSize: 13, color: 'var(--t1)', marginTop: 5, fontWeight: 500 }}>{selected.match_date} · Two AI pundits debate the result</div>
              </div>
              <button onClick={run} disabled={loading} style={{
                padding: '9px 22px', background: loading ? 'var(--bg4)' : 'var(--green)', color: loading ? 'var(--t3)' : '#000',
                border: 'none', borderRadius: 5, fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
              }}>{loading ? 'Debating…' : 'Start Debate'}</button>
            </div>

            {loading && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 0' }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: `lpb 1.2s ease ${i * 0.2}s infinite` }} />)}
                <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 4 }}>Granite agents arguing over the data…</span>
              </div>
            )}

            {result && (
              <>
                {/* Topic */}
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderLeft: '3px solid var(--green)', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 4 }}>Motion</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>{result.topic}</div>
                  </div>
                  <button onClick={() => exportReport({
                    title: `Debate — ${selected.home_team} vs ${selected.away_team}`,
                    subtitle: result.topic,
                    meta: [selected.match_date],
                    lang: getLang(),
                    sections: [
                      { heading: `${result.agent_a.name} — ${result.agent_a.stance}`, body: result.agent_a.argument },
                      { heading: `${result.agent_b.name} — ${result.agent_b.stance}`, body: result.agent_b.argument },
                      { heading: 'Consensus', body: result.consensus },
                      ...(result.limitations?.length ? [{ heading: "What this can't tell you", body: result.limitations.map(l => `- ${l}`).join('\n') }] : []),
                    ],
                  })} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', cursor: 'pointer', background: 'var(--bg3)', border: '1px solid var(--bd2)', borderRadius: 5, color: 'var(--t2)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>⬇ PDF</button>
                </div>

                {/* The two agents */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {([[result.agent_a, '#4ADE80', 'var(--g-border)', typedArgA], [result.agent_b, '#F87171', 'var(--r-border)', typedArgB]] as [Agent, string, string, string][]).map(([ag, color, border, typed], i) => (
                    <div key={i} style={{ background: 'var(--bg2)', border: `1px solid ${border}`, borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.04em', color }}>{ag.name}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{ag.stance}</div>
                      </div>
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.7 }}>{typed || ag.argument}</div>
                        <div style={{ marginTop: 10 }}><SpeakButton text={ag.argument} /></div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Consensus */}
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '9px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>Neutral Consensus · IBM Granite</span>
                    <SpeakButton text={result.consensus} />
                  </div>
                  <div style={{ padding: '16px 18px', fontSize: 14, color: 'var(--t1)', lineHeight: 1.8 }}>{typedConsensus || result.consensus}</div>
                </div>

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
