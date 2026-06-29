'use client'

import { useState, useRef, useCallback } from 'react'
import Limitations from './Limitations'
import { exportReport } from './pdf'

interface PersonBox { x1: number; y1: number; x2: number; y2: number; cx: number; cy: number; conf: number }
interface BallBox   { cx: number; cy: number; x1: number; y1: number; x2: number; y2: number; conf: number }

interface DetectionPreview {
  timestamp: number
  persons: PersonBox[]
  ball: BallBox | null
  max_overlap: number
  contact: boolean
}

interface CVFindings {
  duration_seconds: number
  frames_analysed: number
  ball_frame_count: number
  players_detected: number
  contact_detected: boolean
  ball_height: string
  ball_trajectory: string
  ball_speed: string
  player_spread: string
  docling_used: boolean
}

interface LawChunk {
  name: string
  text: string
  source: string
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
  limitations?: string[]
  detection_preview?: DetectionPreview
  cv_findings: CVFindings
  law_chunk?: LawChunk
}

const PIPELINE_STEPS = [
  { label: 'Upload', sub: 'Sending clip to VAR server', time: 0 },
  { label: 'YOLOv8 · Computer Vision', sub: 'Detecting players, ball, contact', time: 800 },
  { label: 'Docling · FIFA Laws', sub: 'Extracting relevant rule from PDF', time: 5000 },
  { label: 'IBM Granite · Verdict', sub: 'Cross-referencing CV output with rulebook', time: 9000 },
]

const VAR_CONFIG = {
  'OVERTURNED':       { color: '#F87171', bg: '#450A0A', label: 'OVERTURNED' },
  'UPHELD':           { color: '#FBBF24', bg: '#451A03', label: 'UPHELD' },
  'NO REVIEW NEEDED': { color: '#4ADE80', bg: '#14532D', label: 'NO REVIEW' },
}

const INCIDENT_ICONS: Record<string, string> = {
  handball: '🤚', foul: '🦵', tackle: '⚡', offside: '🚩', simulation: '🎭',
  free_kick: '🎯', no_incident: '✅', goal_check: '⚽', penalty_kick: '🥅',
}

function DetectionFrame({ dp, incidentType, vcColor }: { dp: DetectionPreview; incidentType: string; vcColor: string }) {
  // Render YOLOv8 bounding boxes on a 16:9 SVG viewport (normalised 0-1 coords)
  const W = 640, H = 360
  const toX = (v: number) => v * W
  const toY = (v: number) => v * H

  // Find the two players closest together (highest overlap indicator) for contact annotation
  let contactPair: [PersonBox, PersonBox] | null = null
  if (dp.contact && dp.persons.length >= 2) {
    let minDist = Infinity
    for (let i = 0; i < dp.persons.length; i++) {
      for (let j = i + 1; j < dp.persons.length; j++) {
        const dx = dp.persons[i].cx - dp.persons[j].cx
        const dy = dp.persons[i].cy - dp.persons[j].cy
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < minDist) { minDist = d; contactPair = [dp.persons[i], dp.persons[j]] }
      }
    }
  }

  const incidentLabel: Record<string, string> = {
    handball: 'HANDBALL DETECTED', foul: 'FOUL CONTACT', tackle: 'TACKLE — CONTACT',
    offside: 'OFFSIDE POSITION', simulation: 'SIMULATION — NO CONTACT',
    free_kick: 'FREE KICK SETUP', no_incident: 'NO INCIDENT', goal_check: 'GOAL CHECK',
  }

  return (
    <div style={{ background: 'var(--bg2)', border: `1px solid var(--bd2)`, borderRadius: 8, overflow: 'hidden', borderTop: `2px solid ${vcColor}` }}>
      <div style={{ padding: '9px 18px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: vcColor, animation: 'lpb 1.4s ease infinite' }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: vcColor }}>YOLOv8 · Detection Frame</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.1em' }}>t = {dp.timestamp}s</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.1em' }}>{dp.persons.length} players</span>
          {dp.ball && <span style={{ fontSize: 9, fontWeight: 700, color: '#F59E0B', letterSpacing: '0.1em' }}>ball detected</span>}
        </div>
      </div>

      <div style={{ position: 'relative', background: '#030C08' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', maxHeight: 320 }}>
          {/* Field stripes */}
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x={0} y={i * (H / 8)} width={W} height={H / 8} fill={i % 2 === 0 ? '#040F07' : '#030C06'} />
          ))}
          {/* Subtle grid */}
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="#0C2010" strokeWidth="0.8" />
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#0C2010" strokeWidth="0.8" />

          {/* Contact zone highlight between closest pair */}
          {contactPair && (() => {
            const [p1, p2] = contactPair
            const mx = ((p1.cx + p2.cx) / 2)
            const my = ((p1.cy + p2.cy) / 2)
            return (
              <g>
                <circle cx={toX(mx)} cy={toY(my)} r={38} fill={`${vcColor}12`} stroke={vcColor} strokeWidth="1" strokeDasharray="4 3" />
                <circle cx={toX(mx)} cy={toY(my)} r={22} fill={`${vcColor}18`} />
                <text x={toX(mx)} y={toY(my) - 44} textAnchor="middle" fill={vcColor} fontSize="9" fontFamily="Inter" fontWeight="800" letterSpacing="0.12em">
                  {incidentLabel[incidentType] ?? 'CONTACT DETECTED'}
                </text>
                <line x1={toX(p1.cx)} y1={toY(p1.cy)} x2={toX(p2.cx)} y2={toY(p2.cy)} stroke={vcColor} strokeWidth="1.2" strokeDasharray="3 2" opacity="0.6" />
              </g>
            )
          })()}

          {/* Player bounding boxes */}
          {dp.persons.map((p, i) => {
            const inContact = contactPair && (contactPair[0] === p || contactPair[1] === p)
            const boxColor = inContact ? vcColor : '#22C55E'
            return (
              <g key={i}>
                <rect
                  x={toX(p.x1)} y={toY(p.y1)}
                  width={toX(p.x2) - toX(p.x1)} height={toY(p.y2) - toY(p.y1)}
                  fill={`${boxColor}08`} stroke={boxColor} strokeWidth={inContact ? 1.5 : 0.8}
                  rx="1"
                />
                {/* Confidence label */}
                <rect x={toX(p.x1)} y={toY(p.y1) - 11} width={30} height={10} fill={boxColor} rx="1" />
                <text x={toX(p.x1) + 2} y={toY(p.y1) - 3} fill="#000" fontSize="6.5" fontFamily="Inter" fontWeight="800">
                  {Math.round(p.conf * 100)}%
                </text>
                {/* Person label */}
                <text x={toX(p.cx)} y={toY(p.y2) + 9} textAnchor="middle" fill={boxColor} fontSize="6" fontFamily="Inter" fontWeight="600" opacity="0.7">
                  P{i + 1}
                </text>
              </g>
            )
          })}

          {/* Ball */}
          {dp.ball && (() => {
            const bx = toX(dp.ball.cx), by = toY(dp.ball.cy)
            return (
              <g>
                <circle cx={bx} cy={by} r={14} fill="rgba(250,204,21,0.08)" stroke="#FACC15" strokeWidth="1" strokeDasharray="3 2" />
                <circle cx={bx} cy={by} r={6} fill="#FACC15" opacity="0.9" />
                <text x={bx} y={by + 19} textAnchor="middle" fill="#FACC15" fontSize="6.5" fontFamily="Inter" fontWeight="800" letterSpacing="0.08em">BALL</text>
                <text x={bx} y={by + 27} textAnchor="middle" fill="#FACC15" fontSize="5.5" fontFamily="Inter" opacity="0.6">
                  {dp.ball.conf ? `conf ${Math.round(dp.ball.conf * 100)}%` : ''}
                </text>
              </g>
            )
          })()}

          {/* Ball height annotation */}
          {dp.ball && (() => {
            const by = dp.ball.cy
            const heightLabel = by < 0.40 ? 'ARM / CHEST HEIGHT' : by < 0.52 ? 'UPPER BODY' : 'FOOT LEVEL'
            const heightColor = by < 0.40 ? '#EF4444' : by < 0.52 ? '#F59E0B' : '#22C55E'
            return (
              <g>
                <line x1={W - 4} y1={0} x2={W - 4} y2={H} stroke="#1A3020" strokeWidth="1" />
                <line x1={W - 4} y1={toY(dp.ball.cy)} x2={W - 18} y2={toY(dp.ball.cy)} stroke={heightColor} strokeWidth="1" strokeDasharray="2 2" />
                <text x={W - 6} y={toY(dp.ball.cy) - 3} textAnchor="end" fill={heightColor} fontSize="6" fontFamily="Inter" fontWeight="700">{heightLabel}</text>
              </g>
            )
          })()}
        </svg>

        {/* Detection metadata strip */}
        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--bd)' }}>
          {[
            { label: 'Players detected', value: dp.persons.length, color: '#22C55E' },
            { label: 'Contact zone', value: dp.contact ? 'YES' : 'NO', color: dp.contact ? vcColor : '#22C55E' },
            { label: 'Max overlap', value: dp.max_overlap.toFixed(4), color: 'var(--t2)' },
            { label: 'Ball', value: dp.ball ? `conf ${Math.round((dp.ball.conf ?? 0) * 100)}%` : 'Not visible', color: dp.ball ? '#FACC15' : 'var(--t3)' },
          ].map(({ label, value, color }, i) => (
            <div key={label} style={{ flex: 1, padding: '8px 12px', borderRight: i < 3 ? '1px solid var(--bd)' : 'none', background: 'var(--bg)' }}>
              <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const FIFA_LAWS_REF = [
  {
    key: 'offside',
    law: 'Law 11',
    title: 'Offside',
    text: `A player is in an offside position if any part of their head, body, or feet is in the opponents' half AND nearer to the opponents' goal line than both the ball and the second-last opponent. Hands and arms of all players (including goalkeepers) are not considered.

Offside Offence — a player in an offside position becomes active by:
• Interfering with play (touching the ball played by a teammate).
• Interfering with an opponent (blocking vision, competing for the ball).
• Gaining an advantage from being in that position.

No offence if received directly from a goal kick, throw-in, or corner kick.
VAR uses a calibrated offside line; the on-field decision is reversed only when there is a clear error.`,
  },
  {
    key: 'handball',
    law: 'Law 12',
    title: 'Handball',
    text: `A handball offence occurs when a player deliberately touches the ball with their hand or arm.
The following are considered handballs regardless of intent:
• The ball touches a player's hand/arm that is in an unnaturally extended position, making the body bigger.
• A player scores or creates a goal directly from a handball.

The hand/arm is considered natural if it is close to the body and does not make the silhouette unnaturally larger.
Accidental handball by an attacker that immediately precedes a goal is penalised.`,
  },
  {
    key: 'foul',
    law: 'Law 12',
    title: 'Fouls & Misconduct',
    text: `A direct free kick is awarded if a player commits any of the following against an opponent:
• Kicks or attempts to kick · Trips or attempts to trip · Charges carelessly/recklessly
• Jumps at · Strikes or attempts to strike · Pushes · Tackles/challenges

A foul committed recklessly must receive a yellow card (caution).
A foul committed with excessive force or brutality must receive a red card (sending-off).
A penalty kick is awarded if any of these offences are committed inside the penalty area.`,
  },
  {
    key: 'tackle',
    law: 'Law 12',
    title: 'Tackles & Serious Foul Play',
    text: `Tackles and challenges must be assessed for the use of force:
• Careless: no disciplinary action required beyond the free kick.
• Reckless: caution (yellow card) — player showed disregard for danger to the opponent.
• Excessive force/brutality: sending-off (red card) — player endangered opponent's safety.

A tackle from behind that endangers the safety of an opponent is serious foul play (red card).
VAR review is triggered when a potential red-card tackle is missed by the on-field referee.`,
  },
  {
    key: 'simulation',
    law: 'Law 12',
    title: 'Simulation',
    text: `A player who attempts to deceive the referee by simulating an injury or being fouled (diving, play-acting) is cautioned for unsporting behaviour (yellow card).
If the game was stopped for the incident, the caution is given at the next stoppage.
VAR may recommend a review when simulation results in an incorrect penalty or red card.`,
  },
]

export default function VAROracle() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(-1)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [openLaw, setOpenLaw] = useState<string | null>(null)
  const [lawManuallyToggled, setLawManuallyToggled] = useState(false)
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
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.detail || errBody?.error || `Server error ${res.status}`)
      }
      const data: Verdict = await res.json()
      timers.current.forEach(clearTimeout)
      setStep(4)
      setLawManuallyToggled(false)
      setOpenLaw(null)
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

      {/* ── FIFA Laws Reference ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden',
          borderTop: '2px solid #A16207',
        }}>
          <div style={{ padding: '9px 18px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#EAB308' }}>FIFA Laws of the Game · Reference</span>
              {verdict && verdict.law_chunk && (
                <span style={{ padding: '2px 8px', background: '#3B2800', border: '1px solid #92400E', borderRadius: 3, fontSize: 9, fontWeight: 700, color: '#EAB308', letterSpacing: '0.08em' }}>
                  {verdict.law_chunk.name} applied
                </span>
              )}
            </div>
            <span style={{ fontSize: 10, color: 'var(--t3)' }}>{verdict?.cv_findings.docling_used ? 'Docling PDF parse' : 'Hardcoded excerpts · drop fifa_laws.pdf to activate Docling'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {FIFA_LAWS_REF.map((law, i) => {
              const isApplied = verdict?.incident_type === law.key || verdict?.law_chunk?.name === law.title
              // Auto-open the applied law when verdict arrives, unless user has manually toggled something
              const isOpen = openLaw === law.key || (isApplied && !lawManuallyToggled)
              return (
                <div key={law.key} style={{ borderBottom: i < FIFA_LAWS_REF.length - 1 ? '1px solid var(--bd)' : 'none' }}>
                  <button
                    onClick={() => { setLawManuallyToggled(true); setOpenLaw(isOpen ? null : law.key) }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '11px 18px', background: isApplied ? '#1A1400' : 'none',
                      border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#A16207', letterSpacing: '0.1em', minWidth: 44 }}>{law.law}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isApplied ? '#EAB308' : 'var(--t1)' }}>{law.title}</span>
                      {isApplied && verdict && (
                        <span style={{ padding: '1px 7px', background: '#3B2800', border: '1px solid #92400E', borderRadius: 3, fontSize: 8, fontWeight: 800, color: '#EAB308', letterSpacing: '0.1em' }}>APPLIED</span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--t3)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 18px 14px 18px', borderTop: '1px solid var(--bd)' }}>
                      <div style={{
                        marginTop: 12, fontSize: 12, color: 'var(--t2)', lineHeight: 1.85,
                        fontFamily: 'monospace', background: 'var(--bg)',
                        border: '1px solid var(--bd)', borderLeft: '3px solid #A16207',
                        borderRadius: '0 4px 4px 0', padding: '12px 16px', whiteSpace: 'pre-wrap',
                      }}>
                        {law.text}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── VAR Verdict ── */}
      {verdict && vc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* YOLOv8 Detection Frame — the "wow" visualization */}
          {verdict.detection_preview && (
            <DetectionFrame dp={verdict.detection_preview} incidentType={verdict.incident_type} vcColor={vc.color} />
          )}

          {/* Main verdict banner */}
          <div style={{
            background: 'var(--bg2)', border: `1px solid var(--bd2)`,
            borderRadius: 8, overflow: 'hidden', borderTop: `3px solid ${vc.color}`,
          }}>
            {/* Broadcast-style top bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 18px', borderBottom: `1px solid var(--bd)`,
              background: 'var(--bg3)',
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
              padding: '10px 24px', borderTop: `1px solid var(--bd)`,
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
                  ['Ball Visible', `${verdict.cv_findings.ball_frame_count} / ${verdict.cv_findings.frames_analysed} frames`],
                  ['Contact', verdict.cv_findings.contact_detected ? 'Yes' : 'No'],
                  ['Ball Height', verdict.cv_findings.ball_height],
                  ['Docling PDF', verdict.cv_findings.docling_used ? 'Active' : 'Fallback'],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--t1)', textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
                {/* Trajectory + speed on their own line to avoid overflow */}
                {verdict.cv_findings.ball_trajectory && verdict.cv_findings.ball_trajectory !== 'not trackable' && (
                  <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 8, marginTop: 2 }}>
                    <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Ball Motion</div>
                    <div style={{ fontSize: 11, color: 'var(--t1)', lineHeight: 1.5 }}>{verdict.cv_findings.ball_trajectory}</div>
                    {verdict.cv_findings.ball_speed && verdict.cv_findings.ball_speed !== 'unknown' && (
                      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3, lineHeight: 1.5 }}>{verdict.cv_findings.ball_speed}</div>
                    )}
                  </div>
                )}
                {/* Formation on its own line */}
                {verdict.cv_findings.player_spread && (
                  <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 8, marginTop: 2 }}>
                    <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Formation</div>
                    <div style={{ fontSize: 11, color: 'var(--t1)', lineHeight: 1.5 }}>{verdict.cv_findings.player_spread}</div>
                  </div>
                )}
              </div>
            </div>

            {/* IBM Granite reasoning */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--bd)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)' }}>IBM Granite · Referee Reasoning</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => exportReport({
                      title: `VAR Oracle Verdict — ${verdict.incident_type}`,
                      subtitle: `${vc.label} · ${confidencePct}% confidence`,
                      meta: [`FIFA ${verdict.law_number}`, verdict.law_applied],
                      sections: [
                        { heading: 'What Happened', body: verdict.what_happened },
                        { heading: 'Correct Decision', body: verdict.correct_decision },
                        { heading: 'Granite Reasoning', body: verdict.reasoning },
                        ...(verdict.law_chunk ? [{ heading: `FIFA Law — ${verdict.law_chunk.name}`, body: verdict.law_chunk.text }] : []),
                        ...(verdict.limitations?.length ? [{ heading: "What this can't tell you", body: verdict.limitations.map(l => `- ${l}`).join('\n') }] : []),
                      ],
                    })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', cursor: 'pointer', background: 'var(--bg3)', border: '1px solid var(--bd2)', borderRadius: 5, color: 'var(--t2)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}
                  >⬇ PDF</button>
                  <span style={{ fontSize: 10, color: 'var(--t3)' }}>Grounded in FIFA {verdict.law_number}</span>
                </div>
              </div>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.85 }}>{verdict.reasoning}</div>
              </div>
            </div>

            <Limitations items={verdict.limitations} />

          </div>


        </div>
      )}
    </div>
  )
}
