'use client'

import { useState, useRef, useCallback } from 'react'

interface CVFindings {
  duration_seconds: number
  frames_analysed: number
  ball_detected: boolean
  players_detected: number
  contact_detected: boolean
  ball_height: string
  ball_trajectory: string
  ball_speed: string
  player_spread: string
  docling_used: boolean
}

interface Verdict {
  incident_type: string
  what_happened: string
  law_applied: string
  law_number: string
  correct_decision: string
  var_action: 'OVERTURNED' | 'UPHELD' | 'NO REVIEW NEEDED'
  reasoning: string
  confidence: number
  cv_findings: CVFindings
}

const PIPELINE_STEPS = [
  { label: 'Upload', sub: 'Sending clip to VAR server', time: 0 },
  { label: 'YOLOv8 · Computer Vision', sub: 'Detecting players, ball, contact', time: 800 },
  { label: 'Docling · FIFA Laws', sub: 'Extracting relevant rule from PDF', time: 5000 },
  { label: 'IBM Granite · Verdict', sub: 'Cross-referencing CV output with rulebook', time: 9000 },
]

const VAR_CONFIG = {
  'OVERTURNED':       { color: '#EF4444', bg: 'rgba(239,68,68,0.10)', label: 'OVERTURNED' },
  'UPHELD':           { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', label: 'UPHELD' },
  'NO REVIEW NEEDED': { color: '#10B981', bg: 'rgba(16,185,129,0.10)', label: 'NO REVIEW' },
}

const INCIDENT_ICONS: Record<string, string> = {
  handball: '🤚', foul: '🦵', tackle: '⚡', offside: '🚩', simulation: '🎭',
  free_kick: '🎯', no_incident: '✅', goal_check: '⚽', penalty_kick: '🥅',
}

export default function VAROracle() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(-1)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setVerdict(null)
    setError(null)
    setStep(-1)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(f))
  }, [preview])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith('video/')) handleFile(f)
  }, [handleFile])

  const clear = () => {
    timers.current.forEach(clearTimeout)
    if (preview) URL.revokeObjectURL(preview)
    setFile(null); setPreview(null); setVerdict(null)
    setError(null); setStep(-1); setLoading(false)
  }

  const analyse = async () => {
    if (!file) return
    timers.current.forEach(clearTimeout)
    setLoading(true); setVerdict(null); setError(null); setStep(0)

    // Animate steps based on expected processing times
    PIPELINE_STEPS.slice(1).forEach((s, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), s.time))
    })

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('http://localhost:8001/var-oracle/analyse', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data: Verdict = await res.json()
      timers.current.forEach(clearTimeout)
      setStep(4)
      setTimeout(() => { setVerdict(data); setLoading(false) }, 400)
    } catch (e: unknown) {
      timers.current.forEach(clearTimeout)
      setError(e instanceof Error ? e.message : 'Analysis failed. Ensure the backend is running.')
      setLoading(false); setStep(-1)
    }
  }

  const vc = verdict ? (VAR_CONFIG[verdict.var_action] ?? VAR_CONFIG['UPHELD']) : null
  const confidencePct = verdict ? Math.round(verdict.confidence * 100) : 0

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>

      {/* ── Module Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 5 }}>
          Module 03 · Computer Vision + AI Rulebook
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, letterSpacing: '0.06em', color: 'var(--t1)', lineHeight: 1 }}>VAR Oracle</div>
        <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 7, lineHeight: 1.6, maxWidth: 640 }}>
          Upload a match clip. <strong style={{ color: 'var(--t1)' }}>YOLOv8</strong> analyses the footage frame-by-frame,{' '}
          <strong style={{ color: 'var(--t1)' }}>Docling</strong> extracts the relevant FIFA law, and{' '}
          <strong style={{ color: 'var(--t1)' }}>IBM Granite</strong> delivers a structured referee verdict.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {['YOLOv8 · Computer Vision', 'Docling · PDF Parsing', 'IBM Granite · LLM', 'FIFA Laws of the Game'].map(tag => (
            <span key={tag} style={{ padding: '3px 10px', background: 'var(--bg3)', border: '1px solid var(--bd)', borderRadius: 3, fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.06em' }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* ── Upload + Pipeline row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: preview ? '1fr 1fr' : '1fr', gap: 14, marginBottom: 14 }}>

        {/* Upload zone */}
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !file && inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--green)' : file ? 'var(--bd2)' : 'var(--bd)'}`,
              borderRadius: 8, overflow: 'hidden',
              background: dragging ? 'rgba(16,185,129,0.04)' : 'var(--bg2)',
              cursor: file ? 'default' : 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
              padding: preview ? 0 : '52px 24px',
              textAlign: 'center',
            }}
          >
            {preview ? (
              <video src={preview} controls style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'cover' }}/>
            ) : (
              <>
                <div style={{ fontSize: 44, opacity: 0.2, marginBottom: 14 }}>🎬</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.1em', color: 'var(--t2)', marginBottom: 6 }}>Drop Match Clip Here</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>MP4 · MOV · AVI · WebM</div>
              </>
            )}
          </div>
          <input ref={inputRef} type="file" accept="video/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }}/>

          {file && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '8px 12px', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{(file.size / 1024 / 1024).toFixed(1)} MB · ready to analyse</div>
              </div>
              <button onClick={analyse} disabled={loading} style={{
                padding: '10px 22px', background: loading ? 'var(--bg4)' : 'var(--green)',
                color: loading ? 'var(--t3)' : '#000', border: 'none', borderRadius: 6,
                fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0,
              }}>
                {loading ? 'Analysing…' : 'Analyse'}
              </button>
              <button onClick={clear} style={{
                padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--bd)',
                borderRadius: 6, color: 'var(--t3)', cursor: 'pointer', fontSize: 11,
                fontFamily: 'Inter, sans-serif', flexShrink: 0,
              }}>Clear</button>
            </div>
          )}
        </div>

        {/* Pipeline steps */}
        {(loading || verdict || error) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: loading ? 'var(--green)' : verdict ? 'var(--green)' : '#EF4444', animation: loading ? 'lpb 1s ease infinite' : 'none' }}/>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>Analysis Pipeline</span>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {PIPELINE_STEPS.map((s, i) => {
                  const done = (step > i && loading) || !!verdict
                  const active = step === i && loading
                  return (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: done ? 'var(--green)' : active ? 'rgba(16,185,129,0.14)' : 'var(--bg4)',
                        border: `1px solid ${done || active ? 'var(--green)' : 'var(--bd)'}`,
                        transition: 'all 0.3s',
                      }}>
                        {done
                          ? <span style={{ fontSize: 13, color: '#000', fontWeight: 900 }}>✓</span>
                          : active
                          ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'lpb 0.8s ease infinite' }}/>
                          : <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700 }}>{i + 1}</span>
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: done || active ? 'var(--t1)' : 'var(--t3)', transition: 'color 0.3s' }}>{s.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>{s.sub}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#EF4444', marginBottom: 5 }}>Analysis Failed</div>
                <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>{error}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── VAR Verdict ── */}
      {verdict && vc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Main verdict banner */}
          <div style={{
            background: 'var(--bg2)', border: `1px solid ${vc.color}40`,
            borderRadius: 8, overflow: 'hidden', borderTop: `3px solid ${vc.color}`,
          }}>
            {/* Broadcast-style top bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 18px', borderBottom: `1px solid ${vc.color}25`,
              background: `linear-gradient(90deg, ${vc.color}0A 0%, transparent 50%)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: vc.color }}/>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: vc.color }}>VAR Decision · {vc.label}</span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>IBM Granite · FIFA Laws of the Game</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 0, alignItems: 'stretch' }}>
              {/* Incident type */}
              <div style={{ padding: '20px 24px', borderRight: '1px solid var(--bd)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <div style={{ fontSize: 36 }}>{INCIDENT_ICONS[verdict.incident_type] ?? '⚡'}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: '0.1em', color: 'var(--t1)' }}>{verdict.incident_type.toUpperCase()}</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--t3)' }}>Incident</div>
              </div>

              {/* What happened + law badge */}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 7 }}>What Happened</div>
                  <div style={{ fontSize: 14, color: 'var(--t1)', lineHeight: 1.65 }}>{verdict.what_happened}</div>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', background: 'var(--bg3)', border: '1px solid var(--bd)', borderRadius: 4, padding: '5px 12px' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: vc.color }}>{verdict.law_number}</span>
                  <span style={{ color: 'var(--bd2)' }}>·</span>
                  <span style={{ fontSize: 11, color: 'var(--t2)' }}>{verdict.law_applied}</span>
                </div>
              </div>

              {/* Confidence + VAR action */}
              <div style={{ padding: '20px 24px', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, minWidth: 130 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: vc.color, lineHeight: 1 }}>{confidencePct}%</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--t3)' }}>Confidence</div>
                <div style={{ padding: '6px 14px', borderRadius: 4, background: vc.bg, border: `1px solid ${vc.color}50`, textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: '0.08em', color: vc.color }}>{vc.label}</div>
                </div>
              </div>
            </div>

            {/* Correct decision footer bar */}
            <div style={{
              padding: '10px 24px', borderTop: `1px solid ${vc.color}25`,
              background: vc.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--t3)' }}>Correct Decision</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.08em', color: vc.color }}>{verdict.correct_decision}</span>
            </div>
          </div>

          {/* CV findings + AI reasoning */}
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12 }}>

            {/* YOLOv8 findings */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)' }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>YOLOv8 Findings</span>
              </div>
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {([
                  ['Clip Duration', `${verdict.cv_findings.duration_seconds}s`],
                  ['Frames Analysed', `${verdict.cv_findings.frames_analysed}`],
                  ['Players Detected', `${verdict.cv_findings.players_detected}`],
                  ['Ball Detected', verdict.cv_findings.ball_detected ? 'Yes' : 'No'],
                  ['Contact Detected', verdict.cv_findings.contact_detected ? 'Yes' : 'No'],
                  ['Ball Height', verdict.cv_findings.ball_height],
                  ['Ball Trajectory', verdict.cv_findings.ball_trajectory ?? '—'],
                  ['Ball Speed', verdict.cv_findings.ball_speed ?? '—'],
                  ['Formation', verdict.cv_findings.player_spread ?? '—'],
                  ['Docling PDF', verdict.cv_findings.docling_used ? 'Used' : 'Fallback'],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--t1)', textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* IBM Granite reasoning */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>IBM Granite · Referee Reasoning</span>
                <span style={{ fontSize: 10, color: 'var(--t3)' }}>Grounded in FIFA {verdict.law_number}</span>
              </div>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.85 }}>{verdict.reasoning}</div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
