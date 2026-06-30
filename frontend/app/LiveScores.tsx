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

export default function LiveScores() {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [date, setDate] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/live-scores')
      .then(r => r.json())
      .then(d => { setMatches(d.matches ?? []); setDate(d.date ?? '') })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded || !matches.length) return null

  const isLive = (s: string) => /'\s*$/.test(s) || /\bHT\b|1st|2nd|Live/i.test(s)
  const isFinal = (s: string) => /FT\b|Full Time|Final/i.test(s)

  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(16,185,129,0.07) 0%, rgba(59,130,246,0.05) 100%)',
      borderBottom: '1px solid rgba(34,197,94,0.15)',
      padding: '8px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      overflowX: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', animation: 'lpb 1.4s ease infinite' }} />
        <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#22C55E', whiteSpace: 'nowrap' }}>
          WC2026
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
        {matches.map(m => {
          const live = isLive(m.status)
          const done = isFinal(m.status)
          const statusColor = live ? '#4ADE80' : done ? '#4A5568' : '#94A3B8'
          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
              background: live ? 'rgba(34,197,94,0.06)' : 'rgba(0,0,0,0.2)',
              border: `1px solid ${live ? 'rgba(34,197,94,0.2)' : 'rgba(30,45,66,0.6)'}`,
              borderRadius: 5, padding: '4px 12px',
            }}>
              <span style={{ fontSize: 10, color: '#94A3B8', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#F1F5F9', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {m.home_score} – {m.away_score}
              </span>
              <span style={{ fontSize: 10, color: '#94A3B8', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.away}</span>
              {m.status && (
                <span style={{ fontSize: 8, color: statusColor, fontWeight: live ? 700 : 400, flexShrink: 0 }}>{m.status}</span>
              )}
            </div>
          )
        })}
      </div>

      {date && (
        <span style={{ fontSize: 8, color: '#4A5568', flexShrink: 0, marginLeft: 'auto' }}>{date}</span>
      )}
    </div>
  )
}
