'use client'
import { useEffect, useState } from 'react'

interface LiveMatch {
  id: string
  home: string
  away: string
  home_score: string
  away_score: string
  status: string
  date: string
}

export default function LiveScores({ parch = false }: { parch?: boolean }) {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [date, setDate] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = () =>
      fetch('/api/live-scores')
        .then(r => r.json())
        .then(d => { setMatches(d.matches ?? []); setDate(d.date ?? '') })
        .catch(() => {})
        .finally(() => setLoaded(true))

    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  if (!loaded || !matches.length) return null

  const isLive  = (s: string) => /'\s*$/.test(s) || /\bHT\b|1st|2nd|Live/i.test(s)
  const isFinal = (s: string) => /FT\b|Full Time|Final/i.test(s)

  // Always navy — parch prop kept for API compat but unused
  void parch

  return (
    <div style={{
      background: '#0B1929',
      borderBottom: '1px solid #1A2E44',
      padding: '8px 28px',
      display: 'flex',
      alignItems: 'center',
      minHeight: 50,
      gap: 0,
    }}>

      {/* WC2026 badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
        paddingRight: 20, borderRight: '1px solid #1E3350', marginRight: 20,
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', animation: 'lpb 1.4s ease infinite' }} />
        <span style={{
          fontSize: 10, fontWeight: 900, letterSpacing: '0.24em',
          textTransform: 'uppercase', color: '#22C55E', whiteSpace: 'nowrap',
        }}>WC 2026</span>
      </div>

      {/* Matches — spread evenly */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'space-evenly', gap: 8, overflow: 'hidden',
      }}>
        {matches.map(m => {
          const live = isLive(m.status)
          const done = isFinal(m.status)

          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
              padding: '6px 12px', width: 300, justifyContent: 'space-between',
              background: live ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${live ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 6,
            }}>
              {/* home */}
              <span style={{
                fontSize: 12, fontWeight: 700, color: '#E2E8F0',
                maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{m.home}</span>

              {/* score */}
              <span style={{
                fontSize: 15, fontWeight: 900, color: '#FFFFFF',
                fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em',
                flexShrink: 0, minWidth: 36, textAlign: 'center',
              }}>
                {m.home_score}<span style={{ color: '#4A6A8A', margin: '0 2px' }}>–</span>{m.away_score}
              </span>

              {/* away */}
              <span style={{
                fontSize: 12, fontWeight: 700, color: '#E2E8F0',
                maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{m.away}</span>

              {/* status pill */}
              {m.status && (
                <span style={{
                  fontSize: 9, fontWeight: 800,
                  color: live ? '#22C55E' : done ? '#64748B' : '#64B5F6',
                  background: live ? 'rgba(34,197,94,0.12)' : done ? 'rgba(100,116,139,0.12)' : 'rgba(100,181,246,0.1)',
                  border: `1px solid ${live ? 'rgba(34,197,94,0.3)' : done ? 'rgba(100,116,139,0.2)' : 'rgba(100,181,246,0.2)'}`,
                  borderRadius: 4, padding: '2px 6px',
                  letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0,
                }}>{m.status}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Date */}
      {date && (
        <span style={{
          fontSize: 9, fontWeight: 600, color: '#334E68',
          flexShrink: 0, marginLeft: 20, paddingLeft: 20,
          borderLeft: '1px solid #1E3350', letterSpacing: '0.08em',
        }}>{date}</span>
      )}
    </div>
  )
}
