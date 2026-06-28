'use client'

import { useState, useEffect } from 'react'
import Limitations from './Limitations'

interface RefereeStub {
  name: string
  country: string
  matches: number
}

interface MatchRecord {
  match_id: number
  home: string
  away: string
  date: string
  score: string
  stage: string
  yellows: number
  reds: number
  fouls: number
  shots: number
  home_fouls: number
  away_fouls: number
  foul_symmetry: number
}

interface RefereeReport {
  referee: string
  matches_officiated: number
  total_yellow_cards: number
  total_red_cards: number
  avg_yellows_per_match: number
  avg_reds_per_match: number
  avg_fouls_per_match: number
  avg_shots_per_match: number
  avg_foul_symmetry: number
  home_bias_index: number
  matches: MatchRecord[]
  ai_report: string
  limitations?: string[]
}

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ height: '100%', width: `${Math.min(value / max, 1) * 100}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
    </div>
  )
}

export default function RefereeLens() {
  const [referees, setReferees] = useState<RefereeStub[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [selected, setSelected] = useState<RefereeStub | null>(null)
  const [report, setReport] = useState<RefereeReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('http://localhost:8001/referees')
      .then(r => r.json())
      .then((data: RefereeStub[]) => { setReferees(data); setListLoading(false) })
      .catch(() => setListLoading(false))
  }, [])

  const analyse = async (ref: RefereeStub) => {
    setSelected(ref)
    setReport(null)
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:8001/referee/${encodeURIComponent(ref.name)}`)
      const data: RefereeReport = await res.json()
      setReport(data)
    } catch { /* silent */ }
    setLoading(false)
  }

  const filtered = referees.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.country.toLowerCase().includes(search.toLowerCase())
  )

  const maxYellows = Math.max(...referees.map(r => r.matches), 1)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, height: 'calc(100vh - 150px)' }}>

      {/* ── Referee list panel ── */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 6 }}>
            Referees · {referees.length}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search referee or country…"
            style={{
              width: '100%', background: 'var(--bg3)', border: '1px solid var(--bd)',
              borderRadius: 4, padding: '6px 9px', fontSize: 11, color: 'var(--t1)',
              outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {listLoading ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: 'var(--t3)' }}>Loading referees…</div>
          ) : filtered.map(ref => (
            <div
              key={ref.name}
              onClick={() => analyse(ref)}
              style={{
                padding: '9px 12px', borderBottom: '1px solid var(--bd)', cursor: 'pointer',
                borderLeft: `3px solid ${selected?.name === ref.name ? 'var(--green)' : 'transparent'}`,
                background: selected?.name === ref.name ? '#0A1D14' : 'transparent',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (selected?.name !== ref.name) e.currentTarget.style.background = 'var(--bg3)' }}
              onMouseLeave={e => { if (selected?.name !== ref.name) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{ref.name}</div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>{ref.country} · {ref.matches} match{ref.matches !== 1 ? 'es' : ''}</div>
              <StatBar value={ref.matches} max={maxYellows} color="var(--green)" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Detail panel ── */}
      <div style={{ overflowY: 'auto' }}>
        {!selected && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
            <div style={{ fontSize: 44, opacity: 0.08 }}>🏁</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--t3)' }}>Select a referee to analyse</div>
          </div>
        )}

        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Header */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '16px 20px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 4 }}>
                Referee Profile
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: '0.06em', color: 'var(--t1)', lineHeight: 1 }}>
                {selected.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>{selected.country} · {selected.matches} World Cup matches</div>
            </div>

            {loading && (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '32px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.1em', color: 'var(--t2)', marginBottom: 6 }}>
                  Loading Match Data
                </div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>Fetching StatsBomb events · IBM Granite generating consistency report…</div>
              </div>
            )}

            {report && (
              <>
                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {([
                    ['Matches', report.matches_officiated, '', '#10B981'],
                    ['Yellow Cards', report.total_yellow_cards, `${report.avg_yellows_per_match}/match`, '#F59E0B'],
                    ['Red Cards', report.total_red_cards, `${report.avg_reds_per_match}/match`, '#EF4444'],
                    ['Avg Fouls', report.avg_fouls_per_match, 'per match', '#8B5CF6'],
                  ] as [string, number, string, string][]).map(([lbl, val, sub, color]) => (
                    <div key={lbl} style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color, lineHeight: 1 }}>{val}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{lbl}</div>
                      {sub && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{sub}</div>}
                    </div>
                  ))}
                </div>

                {/* Foul Symmetry / Fairness metric */}
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '9px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>Foul Symmetry · Fairness Metric</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>1.0 = perfectly equal whistle both sides</span>
                  </div>
                  <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6 }}>Symmetry Index</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, color: report.avg_foul_symmetry >= 0.8 ? '#10B981' : report.avg_foul_symmetry >= 0.6 ? '#F59E0B' : '#EF4444', lineHeight: 1 }}>
                          {report.avg_foul_symmetry.toFixed(2)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${report.avg_foul_symmetry * 100}%`, background: report.avg_foul_symmetry >= 0.8 ? '#10B981' : report.avg_foul_symmetry >= 0.6 ? '#F59E0B' : '#EF4444', borderRadius: 3, transition: 'width 0.5s ease' }} />
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
                            {report.avg_foul_symmetry >= 0.8 ? 'Highly consistent whistle' : report.avg_foul_symmetry >= 0.6 ? 'Moderate asymmetry detected' : 'Significant foul imbalance'}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6 }}>Home Bias Index</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, color: report.home_bias_index <= 0.35 ? '#10B981' : report.home_bias_index <= 0.6 ? '#F59E0B' : '#EF4444', lineHeight: 1 }}>
                          {Math.round(report.home_bias_index * 100)}%
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${report.home_bias_index * 100}%`, background: report.home_bias_index <= 0.35 ? '#10B981' : report.home_bias_index <= 0.6 ? '#F59E0B' : '#EF4444', borderRadius: 3, transition: 'width 0.5s ease' }} />
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
                            matches where home team had more fouls called
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI consistency report */}
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '9px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>IBM Granite · Consistency Analysis</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>Grounded in StatsBomb event data</span>
                  </div>
                  <div style={{ padding: '16px 18px' }}>
                    {report.ai_report.split(/\n\n+/).filter(p => p.trim()).map((p, i) => (
                      <div key={i} style={{ marginBottom: i < 2 ? 14 : 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 5 }}>0{i + 1}</div>
                        <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.8 }}>{p}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <Limitations items={report.limitations} />

                {/* Match log */}
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '9px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>Match Log</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>Foul bar shows home vs away split</span>
                  </div>
                  <div>
                    {report.matches.map((m, i) => {
                      const totalF = m.home_fouls + m.away_fouls || 1
                      const symColor = m.foul_symmetry >= 0.8 ? '#10B981' : m.foul_symmetry >= 0.6 ? '#F59E0B' : '#EF4444'
                      return (
                        <div key={m.match_id} style={{
                          display: 'grid', gridTemplateColumns: '1fr 80px auto auto auto auto',
                          gap: 12, alignItems: 'center', padding: '9px 16px',
                          borderBottom: i < report.matches.length - 1 ? '1px solid var(--bd)' : 'none',
                        }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{m.home} {m.score} {m.away}</div>
                            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>{m.date} · {m.stage}</div>
                          </div>
                          {/* Foul split bar */}
                          <div style={{ minWidth: 80 }}>
                            <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                              <span>{m.home_fouls}H</span><span>{m.away_fouls}A</span>
                            </div>
                            <div style={{ height: 5, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden', display: 'flex' }}>
                              <div style={{ height: '100%', width: `${(m.home_fouls / totalF) * 100}%`, background: '#3B82F6', borderRadius: '2px 0 0 2px' }} />
                              <div style={{ height: '100%', width: `${(m.away_fouls / totalF) * 100}%`, background: '#F59E0B', borderRadius: '0 2px 2px 0' }} />
                            </div>
                            <div style={{ fontSize: 8, color: symColor, marginTop: 2, textAlign: 'center' }}>{m.foul_symmetry.toFixed(2)}</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#F59E0B' }}>{m.yellows}</div>
                            <div style={{ fontSize: 9, color: 'var(--t3)' }}>Yellow</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#EF4444' }}>{m.reds}</div>
                            <div style={{ fontSize: 9, color: 'var(--t3)' }}>Red</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t2)' }}>{m.fouls}</div>
                            <div style={{ fontSize: 9, color: 'var(--t3)' }}>Fouls</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t2)' }}>{m.shots}</div>
                            <div style={{ fontSize: 9, color: 'var(--t3)' }}>Shots</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
