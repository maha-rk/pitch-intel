'use client'

import { useState, useEffect, useRef } from 'react'
import { LANGUAGES, getLang, setLang } from './lang'

export default function LanguageSelector() {
  const [current, setCurrent] = useState('en')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCurrent(getLang())
    const handler = () => setCurrent(getLang())
    window.addEventListener('lang-change', handler)
    return () => window.removeEventListener('lang-change', handler)
  }, [])

  // Close the dropdown when clicking outside it.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const selected = LANGUAGES.find(l => l.code === current) || LANGUAGES[0]

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', background: 'var(--bg2)',
          border: '1px solid var(--bd)', borderRadius: 5,
          cursor: 'pointer', color: 'var(--t1)', fontSize: 12, fontWeight: 600,
        }}
      >
        <span style={{ fontSize: 16 }}>{selected.flag}</span>
        <span>{selected.label}</span>
        <span style={{ fontSize: 9, color: 'var(--t3)', marginLeft: 2 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '110%', right: 0, zIndex: 999,
          background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 6,
          minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          maxHeight: 340, overflowY: 'auto',
        }}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setCurrent(l.code); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 12px', background: l.code === current ? '#0A1D14' : 'none',
                border: 'none', borderBottom: '1px solid var(--bd)', cursor: 'pointer',
                color: l.code === current ? 'var(--green)' : 'var(--t1)',
                fontSize: 13, textAlign: 'left', fontFamily: 'Inter, sans-serif',
              }}
            >
              <span style={{ fontSize: 18 }}>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
