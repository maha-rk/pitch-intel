'use client'
import API_URL from './api-url'
import { tc } from './team-colors'

import { useState, useRef, useEffect, useCallback } from 'react'
import Limitations from './Limitations'
import { getLang } from './lang'

interface Match {
  match_id: number
  match_date: string
  home_team: string
  away_team: string
  home_score?: number
  away_score?: number
}

interface Beat { minute: number | null; text: string }
interface CompanionResult {
  match: string
  home_team: string
  away_team: string
  final_score: string
  intensity: string
  beats: Beat[]
  limitations?: string[]
  error?: string
}

// Short codes → BCP-47 for speech synthesis.
const BCP47: Record<string, string> = {
  en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR',
  ar: 'ar-SA', ja: 'ja-JP', hi: 'hi-IN', it: 'it-IT', nl: 'nl-NL',
  ru: 'ru-RU', ko: 'ko-KR', zh: 'zh-CN', tr: 'tr-TR', pl: 'pl-PL', sv: 'sv-SE',
  id: 'id-ID', vi: 'vi-VN', bn: 'bn-BD', sw: 'sw-KE', th: 'th-TH',
}

export default function MatchCompanion({ matches }: { matches: Match[] }) {
  const [selected, setSelected] = useState<Match | null>(null)
  const [result, setResult] = useState<CompanionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [current, setCurrent] = useState(-1)
  const [playing, setPlaying] = useState(false)

  const idxRef = useRef(-1)
  const beatsRef = useRef<Beat[]>([])
  const langRef = useRef('en')
  // Generation token: bumped on every play/pause/stop so that a cancelled
  // utterance's late-firing onend callback cannot advance to the next beat.
  const genRef = useRef(0)
  const ttsSupported = typeof window !== 'undefined' && !!window.speechSynthesis

  useEffect(() => {
    const handler = () => { if (selected && result) load(selected) }
    window.addEventListener('lang-change', handler)
    return () => window.removeEventListener('lang-change', handler)
  }, [selected, result])

  // Stop speech on unmount or when switching matches.
  const stop = useCallback(() => {
    genRef.current++
    try { window.speechSynthesis?.cancel() } catch {}
    setPlaying(false)
    setCurrent(-1)
    idxRef.current = -1
  }, [])

  useEffect(() => () => { genRef.current++; try { window.speechSynthesis?.cancel() } catch {} }, [])

  const speakFrom = useCallback((i: number) => {
    const beats = beatsRef.current
    if (i >= beats.length) { setPlaying(false); setCurrent(-1); idxRef.current = -1; return }
    const gen = genRef.current
    idxRef.current = i
    setCurrent(i)
    const u = new SpeechSynthesisUtterance(beats[i].text)
    u.lang = BCP47[langRef.current] || 'en-US'
    u.rate = 0.98
    // Only chain to the next beat on a *natural* end within the same generation.
    u.onend = () => { if (genRef.current === gen) speakFrom(i + 1) }
    window.speechSynthesis.speak(u)
  }, [])

  const load = async (m: Match) => {
    stop()
    setLoading(true); setResult(null)
    langRef.current = getLang()
    try {
      const p = new URLSearchParams({ home_team: m.home_team, away_team: m.away_team, lang: getLang() })
      const res = await fetch(`${API_URL}/match-companion/${m.match_id}?${p}`)
      const data: CompanionResult = await res.json()
      setResult(data)
      const rawBeats = data.beats
      const parsedBeats = Array.isArray(rawBeats)
        ? rawBeats
        : typeof rawBeats === 'string'
          ? (() => { try { return JSON.parse(rawBeats) } catch { return [] } })()
          : []
      data.beats = parsedBeats
      beatsRef.current = parsedBeats
    } catch (e) {}
    setLoading(false)
  }

  const play = () => {
    if (!ttsSupported || !beatsRef.current.length) return
    genRef.current++
    const gen = genRef.current
    try { window.speechSynthesis.cancel() } catch {}
    setPlaying(true)
    const start = idxRef.current >= 0 && idxRef.current < beatsRef.current.length ? idxRef.current : 0
    // Small delay: some browsers (Chrome) drop speak() called immediately after cancel().
    setTimeout(() => { if (genRef.current === gen) speakFrom(start) }, 60)
  }
  const pause = () => { genRef.current++; try { window.speechSynthesis.cancel() } catch {}; setPlaying(false) }
  const restart = () => { idxRef.current = 0; play() }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', height: 'calc(100vh - 150px)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
    <style>{`
      @keyframes headbob { 0%{transform:translateY(-6px) rotate(-4deg)} 100%{transform:translateY(6px) rotate(4deg)} }
    `}</style>

      {/* Fixtures */}
      <div style={{ background: 'var(--bg2)', borderRight: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>Fixtures</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {matches.map(m => {
            const sel = selected?.match_id === m.match_id
            return (
              <div key={m.match_id} role="button" tabIndex={0}
                onClick={() => { setSelected(m); load(m) }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setSelected(m); load(m) } }}
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

      {/* Stage */}
      <div role="region" aria-label="Dugout Brief audio" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'transparent', minHeight: 0 }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, position: 'relative', overflow: 'hidden' }}>
            <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} viewBox="0 0 600 500" preserveAspectRatio="xMidYMid slice" fill="none">
              <path d="M160 280 Q160 140 300 140 Q440 140 440 280" stroke="#22D3EE" strokeWidth="10" strokeLinecap="round" fill="none" opacity="0.15"/>
              <rect x="120" y="275" width="70" height="100" rx="16" stroke="#22D3EE" strokeWidth="7" fill="none" opacity="0.15"/>
              <rect x="410" y="275" width="70" height="100" rx="16" stroke="#22D3EE" strokeWidth="7" fill="none" opacity="0.15"/>
              <path d="M80 260 Q80 180 80 100" stroke="#22D3EE" strokeWidth="2" strokeDasharray="4 8" opacity="0.10"/>
              <path d="M100 280 Q100 200 100 120" stroke="#22D3EE" strokeWidth="2" strokeDasharray="4 8" opacity="0.08"/>
              <path d="M500 260 Q500 180 500 100" stroke="#22D3EE" strokeWidth="2" strokeDasharray="4 8" opacity="0.10"/>
              <path d="M520 280 Q520 200 520 120" stroke="#22D3EE" strokeWidth="2" strokeDasharray="4 8" opacity="0.08"/>
              <ellipse cx="300" cy="420" rx="120" ry="18" stroke="#22D3EE" strokeWidth="2" opacity="0.10"/>
              <line x1="155" y1="375" x2="185" y2="375" stroke="#22D3EE" strokeWidth="4" opacity="0.14"/>
              <line x1="415" y1="375" x2="445" y2="375" stroke="#22D3EE" strokeWidth="4" opacity="0.14"/>
            </svg>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#22D3EE', opacity: 0.8 }}>MODULE 11 · ACCESSIBILITY · 21 LANGUAGES</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 76, letterSpacing: '0.05em', lineHeight: 0.88, color: 'var(--t1)', textAlign: 'center', marginTop: 10 }}>DUGOUT</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 76, letterSpacing: '0.12em', lineHeight: 0.88, color: '#22D3EE', textAlign: 'center', borderBottom: '3px solid #22D3EE', paddingBottom: 6, marginBottom: 4 }}>BRIEF</div>
            <div style={{ fontSize: 52, opacity: 0.75, margin: '20px 0 14px', display: 'inline-block', animation: 'headbob 2.2s ease-in-out infinite alternate' }}>🎧</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--t3)', marginTop: 14 }}>Understand the match without seeing or hearing it</div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Header */}
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: 'var(--t1)', lineHeight: 1 }}>
                  {selected.home_team} <span style={{ color: 'var(--t3)', fontSize: 18 }}>vs</span> {selected.away_team}
                </div>
                <div style={{ fontSize: 13, color: 'var(--t1)', marginTop: 5, fontWeight: 500 }}>
                  {selected.match_date} · Audio description for blind / low-vision fans · captions for deaf fans · 16 languages
                </div>
              </div>

              {loading && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 0' }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: `lpb 1.2s ease ${i * 0.2}s infinite` }} />)}
                  <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 4 }}>IBM Granite is writing the audio description…</span>
                </div>
              )}

              {result?.error && (
                <div style={{ padding: '12px 16px', background: '#1A0A0A', border: '1px solid #5A1A1A', borderRadius: 8, color: '#F87171', fontSize: 12 }}>{result.error}</div>
              )}

              {result && !result.error && result.beats.length > 0 && (
                <>
                  {/* Playback controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '12px 14px' }}>
                    {!ttsSupported ? (
                      <span style={{ fontSize: 12, color: 'var(--t3)' }}>Audio playback is not supported in this browser — captions below still work.</span>
                    ) : (
                      <>
                        <button onClick={playing ? pause : play}
                          aria-label={playing ? 'Pause audio description' : 'Play audio description'}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                            background: 'var(--green)', color: '#000', border: 'none', borderRadius: 6,
                            fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                          }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            {playing ? <><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></> : <polygon points="5 3 19 12 5 21 5 3" />}
                          </svg>
                          {playing ? 'Pause' : 'Play audio'}
                        </button>
                        <button onClick={restart} aria-label="Restart from the beginning"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'var(--bg3)', color: 'var(--t2)', border: '1px solid var(--bd2)', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          ↺ Restart
                        </button>
                      </>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t3)' }}>
                      Final score: <strong style={{ color: 'var(--t1)' }}>{result.final_score}</strong> · {result.intensity}
                    </span>
                  </div>

                  {/* Live caption — announced to screen readers */}
                  <div aria-live="polite" aria-atomic="true" style={{
                    background: 'var(--bg2)', border: '1px solid var(--green)', borderLeft: '4px solid var(--green)', borderRadius: 8, padding: '18px 20px',
                    minHeight: 64, display: 'flex', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--t1)', fontWeight: 600 }}>
                      {current >= 0 ? result.beats[current].text : 'Press Play to hear the match described, or read the full account below.'}
                    </span>
                  </div>

                  {/* Full transcript / captions */}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>
                      Full account · captions
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {result.beats.map((b, i) => {
                        const active = i === current
                        return (
                          <div key={i} onClick={() => { idxRef.current = i; if (ttsSupported) play() }}
                            style={{
                              display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 6, cursor: ttsSupported ? 'pointer' : 'default',
                              background: active ? 'rgba(22,101,52,0.09)' : 'var(--bg2)',
                              border: `1px solid ${active ? 'var(--green)' : 'var(--bd)'}`,
                              borderLeft: active ? '3px solid var(--green)' : '1px solid var(--bd)',
                            }}>
                            <span style={{ flexShrink: 0, width: 42, fontSize: 11, fontWeight: 800, color: active ? 'var(--green)' : 'var(--t3)', paddingTop: 2, flexShrink: 0 }}>
                              {b.minute != null ? `${b.minute}'` : '—'}
                            </span>
                            <span style={{ fontSize: 14, lineHeight: 1.7, color: active ? 'var(--t1)' : 'var(--t2)' }}>{b.text}</span>
                          </div>
                        )
                      })}
                    </div>
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
