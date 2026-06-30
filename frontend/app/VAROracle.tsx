'use client'
import API_URL from './api-url'

import { useState, useRef, useCallback } from 'react'
import React from 'react'
import {
  Scale, Power, Cpu, Flag, Hand,
  LayoutGrid, Circle, Users, Tag, Shield, UserCheck,
  Clock, RefreshCcw, ArrowLeftRight, Trophy,
  AlertCircle, Target, Crosshair, ArrowUp, ArrowUpRight, CornerUpRight,
} from 'lucide-react'
import Limitations from './Limitations'
import { exportReport } from './pdf'

function WhistleIcon({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 13 Q4 9 8 9 L22 9 L22 19 L8 19 Q4 19 4 15 Z" stroke={color} strokeWidth="1.6" />
      <rect x="22" y="11" width="7" height="6" rx="3" stroke={color} strokeWidth="1.6" />
      <circle cx="11" cy="14" r="2.5" fill={color} />
      <line x1="16" y1="9" x2="16" y2="5" stroke={color} strokeWidth="1.6" />
      <line x1="16" y1="5" x2="20" y2="5" stroke={color} strokeWidth="1.6" />
    </svg>
  )
}

function BootIcon({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4 L8 19 Q8 23 13 24 L26 24 L26 21 Q22 21 20 19 L20 15 Q18 12 14 12 L14 4 Z" stroke={color} strokeWidth="1.6" />
      <path d="M13 24 L13 27 L26 27 L26 24" stroke={color} strokeWidth="1.6" />
      <line x1="20" y1="27" x2="20" y2="24" stroke={color} strokeWidth="1.2" opacity="0.5" />
    </svg>
  )
}

function TacticalBoardIcon({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="26" height="26" rx="3" stroke={color} strokeWidth="1.6" />
      <line x1="3" y1="16" x2="29" y2="16" stroke={color} strokeWidth="1.2" opacity="0.5" />
      <line x1="16" y1="3" x2="16" y2="29" stroke={color} strokeWidth="1.2" opacity="0.5" />
      <circle cx="10" cy="10" r="2" fill={color} />
      <circle cx="22" cy="10" r="2" fill={color} />
      <circle cx="10" cy="22" r="2" fill={color} />
      <circle cx="22" cy="22" r="2" fill={color} />
      <circle cx="16" cy="16" r="2" fill={color} />
    </svg>
  )
}

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
  rag_used?: boolean
}

interface RagChunk { heading: string; text: string; score: number }

interface LawChunk {
  name: string
  text: string
  source: string
  rag_chunks?: RagChunk[]
  rag_query?: string
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
  guardian_check?: {
    trusted: boolean
    risk_label: 'LOW' | 'MEDIUM' | 'HIGH'
    detail: string
    method: 'granite-guardian' | 'granite-selfcheck'
    rag_score: number | null
    auto_corrected?: boolean
    original_risk?: string
  }
}

const PIPELINE_STEPS = [
  { label: 'Upload', sub: 'Sending clip to VAR server', time: 0 },
  { label: 'YOLOv8 · Computer Vision', sub: 'Detecting players, ball, contact', time: 800 },
  { label: 'Docling · FIFA Laws', sub: 'Extracting relevant rule from PDF', time: 5000 },
  { label: 'IBM Granite · Verdict', sub: 'Cross-referencing CV output with rulebook', time: 9000 },
  { label: 'Granite Guardian · Trust Check', sub: 'Verifying verdict is grounded in law text', time: 11500 },
]

const VAR_CONFIG = {
  'OVERTURNED':       { color: '#DC2626', bg: '#FEF2F2', label: 'OVERTURNED', dark: '#450A0A' },
  'UPHELD':           { color: '#D97706', bg: '#FFFBEB', label: 'UPHELD',     dark: '#451A03' },
  'NO REVIEW NEEDED': { color: '#16A34A', bg: '#F0FDF4', label: 'NO REVIEW',  dark: '#14532D' },
}

const INCIDENT_ICONS: Record<string, string> = {
  handball: '🤚', foul: '🦵', tackle: '⚡', offside: '🚩', simulation: '🎭',
  free_kick: '🎯', no_incident: '✅', goal_check: '⚽', penalty_kick: '🥅',
}

const FIFA_LAWS_REF: {
  key: string; law: string; num: number; title: string; desc: string; text: string;
  border: string; label: string; Icon: (p: { color: string }) => React.ReactElement
}[] = [
  {
    key: 'law1', law: 'Law 1', num: 1, title: 'The Field of Play',
    desc: 'Pitch dimensions, markings, goals.',
    border: '#0D9488', label: '#0F766E',
    Icon: ({ color }) => <LayoutGrid size={32} color={color} strokeWidth={1.5} />,
    text: `The field must be rectangular, with a length of 100–110m and width of 64–75m for international matches.\nKey markings:\n• Penalty area: 16.5m from each post, 16.5m into the field.\n• Goal area: 5.5m from each post, 5.5m into the field.\n• Centre circle: 9.15m radius.\n• Goals: 7.32m wide × 2.44m tall, nets required.\nThe technical area is where the team officials and substitutes sit. Goal-line technology or VAR may be used to determine whether the ball has crossed the goal line.`,
  },
  {
    key: 'law2', law: 'Law 2', num: 2, title: 'The Ball',
    desc: 'Specifications, replacement, pressure.',
    border: '#0284C7', label: '#0369A1',
    Icon: ({ color }) => <Circle size={32} color={color} strokeWidth={1.5} />,
    text: `The ball must be:\n• Spherical · Leather or other suitable material\n• Circumference: 68–70cm · Weight: 410–450g\n• Pressure: 0.6–1.1 atmospheres at sea level\n\nIf the ball becomes defective during play, the game is stopped and restarted with a replacement ball at the point where the original ball became defective (dropped ball if inside the penalty area or a contested situation).`,
  },
  {
    key: 'law3', law: 'Law 3', num: 3, title: 'The Players',
    desc: 'Team size, substitutions, extra persons.',
    border: '#7C3AED', label: '#6D28D9',
    Icon: ({ color }) => <Users size={32} color={color} strokeWidth={1.5} />,
    text: `Each team has a maximum of 11 players on the field, including a goalkeeper.\nMinimum: 7 players to start or continue a match.\n\nSubstitutions:\n• Up to 5 substitutes per team (3 opportunities, excluding half-time).\n• A substitute becomes a player when the ball is out of play and the referee signals.\n• A player who has been replaced may not re-enter.\n\nA player who is dismissed before kick-off is replaced by a named substitute.`,
  },
  {
    key: 'law4', law: 'Law 4', num: 4, title: "Players' Equipment",
    desc: 'Mandatory kit, prohibited items.',
    border: '#DB2777', label: '#BE185D',
    Icon: ({ color }) => <Tag size={32} color={color} strokeWidth={1.5} />,
    text: `Mandatory equipment:\n• Jersey/shirt with sleeves · Shorts · Socks\n• Shin guards (covered by socks) · Footwear\n\nThe goalkeeper must wear colours that distinguish them from all other players and the referee.\n\nProhibited items: anything dangerous to themselves or another player (jewellery, sharp objects).\nUnderwear may be worn if the colour matches the main colour of the shirt or shorts.\nVAR cannot intervene for equipment violations, but the 4th official may alert the referee.`,
  },
  {
    key: 'law5', law: 'Law 5', num: 5, title: 'The Referee',
    desc: 'Powers, authority, final decisions.',
    border: '#DC2626', label: '#B91C1C',
    Icon: ({ color }) => <Shield size={32} color={color} strokeWidth={1.5} />,
    text: `The referee has full authority to enforce the Laws of the Game.\nKey powers:\n• Allow play to continue (advantage) when a foul occurs and stopping play would benefit the offending team.\n• Suspend, abandon, or terminate the match.\n• Take disciplinary action (caution / send-off) from entry to departure.\n• Act on the advice of other match officials.\n\nVAR Review: the referee may consult the VAR before taking action. The final decision always rests with the referee. Referee decisions cannot be changed after play restarts.`,
  },
  {
    key: 'law6', law: 'Law 6', num: 6, title: 'Other Match Officials',
    desc: 'Assistants, 4th official, VAR, AVAR.',
    border: '#EA580C', label: '#C2410C',
    Icon: ({ color }) => <UserCheck size={32} color={color} strokeWidth={1.5} />,
    text: `Match officials other than the referee:\n• 2 × Assistant Referees (ARs): flag offside, ball out of play, fouls outside the referee's view.\n• 4th Official: manages substitutions, extra time boards, bench conduct.\n• VAR (Video Assistant Referee): reviews clear and obvious errors in 4 categories — goal/no goal, penalty/no penalty, direct red card, mistaken identity.\n• AVAR: assists the VAR in the review room.\n\nVAR intervention is only for clear and obvious errors or serious missed incidents.`,
  },
  {
    key: 'law7', law: 'Law 7', num: 7, title: 'Duration of the Match',
    desc: 'Two 45-min halves, stoppage time, extra time.',
    border: '#D97706', label: '#B45309',
    Icon: ({ color }) => <Clock size={32} color={color} strokeWidth={1.5} />,
    text: `A match consists of two equal halves of 45 minutes.\nHalf-time interval: maximum 15 minutes.\n\nAllowance (stoppage time) is added for:\n• Substitutions · Injuries · Goal celebrations\n• VAR reviews · Time-wasting\n• Any other stoppages\n\nExtra time (if applicable): two periods of 15 minutes each.\nPenalty shoot-out: if still level after extra time.\n\nVAR reviews are included in stoppage time calculations per FIFA directives since 2024.`,
  },
  {
    key: 'law8', law: 'Law 8', num: 8, title: 'Start & Restart of Play',
    desc: 'Kick-off, dropped ball, restarting after incidents.',
    border: '#65A30D', label: '#4D7C0F',
    Icon: ({ color }) => <RefreshCcw size={32} color={color} strokeWidth={1.5} />,
    text: `Kick-off starts each half and restarts play after a goal.\nAll opponents must be in their own half; the kicker's team may be anywhere in their own half.\n\nDropped Ball — used when play was stopped and no other restart applies:\n• Inside the penalty area: goalkeeper receives a dropped ball (opponents outside).\n• Outside the penalty area: one player from the team in possession receives it.\n\nThe ball is in play when it is kicked and clearly moves. The kicker cannot touch the ball again until another player has.`,
  },
  {
    key: 'law9', law: 'Law 9', num: 9, title: 'Ball In & Out of Play',
    desc: 'When ball is out, goal line, touch line.',
    border: '#0891B2', label: '#0E7490',
    Icon: ({ color }) => <ArrowLeftRight size={32} color={color} strokeWidth={1.5} />,
    text: `The ball is OUT of play when:\n• It has wholly crossed the goal line or touch line — whether on the ground or in the air.\n• Play has been stopped by the referee.\n\nThe ball is IN play at all other times, including:\n• When it rebounds from a goalpost, crossbar, or corner flagpost.\n• When it rebounds off a match official who is on the field.\n\nGoal-line technology or VAR is used to confirm whether the ball has wholly crossed the line.`,
  },
  {
    key: 'law10', law: 'Law 10', num: 10, title: 'Determining the Outcome',
    desc: 'Scoring, own goals, shoot-outs.',
    border: '#CA8A04', label: '#A16207',
    Icon: ({ color }) => <Trophy size={32} color={color} strokeWidth={1.5} />,
    text: `A goal is scored when the whole of the ball passes over the goal line, between the goalposts and under the crossbar, provided no offence was committed by the scoring team.\n\nOwn Goal: if a player sends the ball into their own net without an opponent touching it after a deliberate kick from a throw-in/free kick, it is not awarded to the scorer — it is an own goal.\n\nPenalty Shoot-out: each team takes alternating kicks. After 5 kicks each, if still level, sudden death continues until one team scores and the other misses.`,
  },
  {
    key: 'law11', law: 'Law 11', num: 11, title: 'Offside',
    desc: 'Offside position, offside offence, VAR line.',
    border: '#16A34A', label: '#15803D',
    Icon: ({ color }) => <Flag size={32} color={color} strokeWidth={1.5} />,
    text: `A player is in an offside position if any part of the head, body or feet is in the opponents' half AND nearer to the opponents' goal line than both the ball and the second-last opponent. Hands and arms are excluded.\n\nOffside offence occurs when the player in an offside position:\n• Interferes with play (touches the ball passed by a teammate).\n• Interferes with an opponent (blocks vision, challenges).\n• Gains an advantage (ball rebounds from post/bar/opponent).\n\nNo offence from a goal kick, throw-in, or corner kick.\nVAR uses calibrated offside lines; a decision is overturned only for clear and obvious errors.`,
  },
  {
    key: 'law12', law: 'Law 12', num: 12, title: 'Fouls & Misconduct',
    desc: 'Direct/indirect free kicks, cards, penalties.',
    border: '#2563EB', label: '#1D4ED8',
    Icon: ({ color }) => <AlertCircle size={32} color={color} strokeWidth={1.5} />,
    text: `Direct free kick offences (also penalty if inside area):\n• Kicks/trips/charges/jumps at/strikes/pushes an opponent.\n• Handball: deliberate or unnaturally extended arm.\n• Tackles/challenges carelessly, recklessly, or with excessive force.\n\nIndirect free kick offences:\n• Goalkeeper handles a back-pass or throw-in from teammate.\n• Dangerous play, obstruction.\n\nDisciplinary sanctions:\n• Yellow card (caution): reckless foul, simulation, dissent, time-wasting.\n• Red card (sending-off): serious foul play, violent conduct, denying a goal (DOGSO), offensive language.`,
  },
  {
    key: 'law13', law: 'Law 13', num: 13, title: 'Free Kicks',
    desc: 'Direct, indirect, defensive wall position.',
    border: '#9333EA', label: '#7E22CE',
    Icon: ({ color }) => <Target size={32} color={color} strokeWidth={1.5} />,
    text: `Free kicks are either direct (can score directly) or indirect (must touch another player).\n\nFor all free kicks:\n• Ball must be stationary when kicked.\n• Kicker cannot touch the ball again until another player has.\n• All opponents must be ≥ 9.15m from the ball until it is in play.\n\nDefensive wall: all wall players must be ≥ 1m from the ball. Attacking players cannot be in the wall.\n\nFree kick inside own penalty area: all opponents outside the area until ball is in play.`,
  },
  {
    key: 'law14', law: 'Law 14', num: 14, title: 'The Penalty Kick',
    desc: 'Spot, run-up, encroachment, retakes.',
    border: '#E11D48', label: '#BE123C',
    Icon: ({ color }) => <Crosshair size={32} color={color} strokeWidth={1.5} />,
    text: `A penalty kick is taken from the penalty mark (11m from goal).\n\nThe goalkeeper:\n• Must remain on the goal line between the posts until the ball is kicked.\n• May move sideways along the line.\n\nAll other players:\n• Must be outside the penalty area and arc, and behind the penalty mark.\n\nEncroachment: if an attacker encroaches and scores, the kick is retaken; if a defender encroaches and the kick is missed, it is retaken. VAR reviews encroachment and goalkeeper position for clear violations.`,
  },
  {
    key: 'law15', law: 'Law 15', num: 15, title: 'The Throw-In',
    desc: 'Two-hand throw, foot position, foul throw.',
    border: '#0369A1', label: '#075985',
    Icon: ({ color }) => <ArrowUp size={32} color={color} strokeWidth={1.5} />,
    text: `A throw-in is awarded when the ball wholly crosses the touch line.\nThe throw is taken by a player from the opposing team of the player who last touched the ball.\n\nThe thrower must:\n• Face the field of play.\n• Have part of each foot on the touch line or outside.\n• Use both hands equally and deliver from behind and over the head.\n• Release the ball from behind the head in a continuous motion.\n\nA goal cannot be scored directly from a throw-in. The thrower cannot touch the ball again until another player has.`,
  },
  {
    key: 'law16', law: 'Law 16', num: 16, title: 'The Goal Kick',
    desc: 'Kicked from goal area, all opponents outside area.',
    border: '#047857', label: '#065F46',
    Icon: ({ color }) => <ArrowUpRight size={32} color={color} strokeWidth={1.5} />,
    text: `A goal kick is awarded when the ball wholly crosses the goal line (not inside the goal) having last been touched by an attacking player.\n\nThe kick is taken from anywhere inside the goal area by any player of the defending team.\nAll opposing players must be outside the penalty area until the ball is in play.\n\nThe ball is in play when it is kicked and clearly moves.\nA goal can be scored directly from a goal kick (against the opponents only).\nThe kicker cannot touch the ball again until another player has.`,
  },
  {
    key: 'law17', law: 'Law 17', num: 17, title: 'The Corner Kick',
    desc: 'Ball in arc, opponents 9.15m, direct goal allowed.',
    border: '#A16207', label: '#92400E',
    Icon: ({ color }) => <CornerUpRight size={32} color={color} strokeWidth={1.5} />,
    text: `A corner kick is awarded when the ball wholly crosses the goal line, having last been touched by a defending player, and a goal is not scored.\n\nThe ball is placed inside the corner arc nearest to where it crossed the line.\nAll opponents must be ≥ 9.15m from the corner arc until the ball is in play.\n\nA goal may be scored directly from a corner kick (against the opponents).\nThe kicker cannot touch the ball again until another player has.\nThe corner flagpost must not be moved.`,
  },
]

function DetectionFrame({ dp, incidentType, vcColor }: { dp: DetectionPreview; incidentType: string; vcColor: string }) {
  const W = 640, H = 360
  const toX = (v: number) => v * W
  const toY = (v: number) => v * H

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
    <div style={{ background: '#fff', borderTop: `3px solid ${vcColor}`, borderLeft: `1px solid #E5E0D0`, borderRight: `1px solid #E5E0D0`, borderBottom: `1px solid #E5E0D0`, borderRadius: 0, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ padding: '10px 18px', borderBottom: '1px solid #EDE8D8', background: '#FAFAF7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: vcColor }} />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: vcColor }}>YOLOv8 · Detection Frame</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>t = {dp.timestamp}s · {dp.persons.length} players</span>
          {dp.ball && <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706' }}>ball detected</span>}
        </div>
      </div>
      <div style={{ position: 'relative', background: '#030C08' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', maxHeight: 420 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x={0} y={i * (H / 8)} width={W} height={H / 8} fill={i % 2 === 0 ? '#040F07' : '#030C06'} />
          ))}
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="#0C2010" strokeWidth="0.8" />
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#0C2010" strokeWidth="0.8" />
          {contactPair && (() => {
            const [p1, p2] = contactPair
            const mx = (p1.cx + p2.cx) / 2, my = (p1.cy + p2.cy) / 2
            return (
              <g>
                <circle cx={toX(mx)} cy={toY(my)} r={38} fill={`${vcColor}12`} stroke={vcColor} strokeWidth="1" strokeDasharray="4 3" />
                <circle cx={toX(mx)} cy={toY(my)} r={22} fill={`${vcColor}18`} />
                <text x={toX(mx)} y={toY(my) - 44} textAnchor="middle" fill={vcColor} fontSize="13" fontFamily="Inter" fontWeight="800" letterSpacing="0.12em">{incidentLabel[incidentType] ?? 'CONTACT DETECTED'}</text>
                <line x1={toX(p1.cx)} y1={toY(p1.cy)} x2={toX(p2.cx)} y2={toY(p2.cy)} stroke={vcColor} strokeWidth="1.2" strokeDasharray="3 2" opacity="0.6" />
              </g>
            )
          })()}
          {dp.persons.map((p, i) => {
            const inContact = contactPair && (contactPair[0] === p || contactPair[1] === p)
            const boxColor = inContact ? vcColor : '#22C55E'
            return (
              <g key={i}>
                <rect x={toX(p.x1)} y={toY(p.y1)} width={toX(p.x2) - toX(p.x1)} height={toY(p.y2) - toY(p.y1)} fill={`${boxColor}08`} stroke={boxColor} strokeWidth={inContact ? 2.5 : 1.5} rx="1" />
                <rect x={toX(p.x1)} y={toY(p.y1) - 14} width={40} height={14} fill={boxColor} rx="1" />
                <text x={toX(p.x1) + 3} y={toY(p.y1) - 4} fill="#000" fontSize="9" fontFamily="Inter" fontWeight="800">{Math.round(p.conf * 100)}%</text>
                <text x={toX(p.cx)} y={toY(p.y2) + 12} textAnchor="middle" fill={boxColor} fontSize="9" fontFamily="Inter" fontWeight="600" opacity="0.7">P{i + 1}</text>
              </g>
            )
          })}
          {dp.ball && (() => {
            const bx = toX(dp.ball.cx), by = toY(dp.ball.cy)
            return (
              <g>
                <circle cx={bx} cy={by} r={14} fill="rgba(250,204,21,0.08)" stroke="#FACC15" strokeWidth="1" strokeDasharray="3 2" />
                <circle cx={bx} cy={by} r={6} fill="#FACC15" opacity="0.9" />
                <text x={bx} y={by + 22} textAnchor="middle" fill="#FACC15" fontSize="9" fontFamily="Inter" fontWeight="800">BALL</text>
              </g>
            )
          })()}
          {dp.ball && (() => {
            const by = dp.ball.cy
            const heightLabel = by < 0.40 ? 'ARM / CHEST' : by < 0.52 ? 'UPPER BODY' : 'FOOT LEVEL'
            const heightColor = by < 0.40 ? '#EF4444' : by < 0.52 ? '#F59E0B' : '#22C55E'
            return (
              <g>
                <line x1={W - 4} y1={0} x2={W - 4} y2={H} stroke="#1A3020" strokeWidth="1" />
                <line x1={W - 4} y1={toY(dp.ball.cy)} x2={W - 18} y2={toY(dp.ball.cy)} stroke={heightColor} strokeWidth="1" strokeDasharray="2 2" />
                <text x={W - 6} y={toY(dp.ball.cy) - 4} textAnchor="end" fill={heightColor} fontSize="9" fontFamily="Inter" fontWeight="700">{heightLabel}</text>
              </g>
            )
          })()}
        </svg>
        <div style={{ display: 'flex', borderTop: '1px solid #1E2D42' }}>
          {[
            { label: 'Players', value: dp.persons.length, color: '#22C55E' },
            { label: 'Contact', value: dp.contact ? 'YES' : 'NO', color: dp.contact ? vcColor : '#22C55E' },
            { label: 'Overlap', value: dp.max_overlap.toFixed(4), color: '#94A3B8' },
            { label: 'Ball', value: dp.ball ? `${Math.round((dp.ball.conf ?? 0) * 100)}%` : 'N/D', color: dp.ball ? '#FACC15' : '#4A5568' },
          ].map(({ label, value, color }, i) => (
            <div key={label} style={{ flex: 1, padding: '12px 16px', borderRight: i < 3 ? '1px solid #1E2D42' : 'none', background: '#070C14' }}>
              <div style={{ fontSize: 11, color: '#4A5568', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface AskResult { answer: string; completeness: 'COMPLETE' | 'PARTIAL'; law_ref: string | null; limitations?: string[] }

const LAW_NAMES: Record<string, string> = {
  'Law 1': 'Field of Play', 'Law 2': 'The Ball', 'Law 3': 'The Players',
  "Law 4": "Players' Equipment", 'Law 5': 'The Referee', 'Law 6': 'Match Officials',
  'Law 7': 'Duration', 'Law 8': 'Start & Restart', 'Law 9': 'Ball In & Out',
  'Law 10': 'Match Outcome', 'Law 11': 'Offside', 'Law 12': 'Fouls & Misconduct',
  'Law 13': 'Free Kicks', 'Law 14': 'The Penalty Kick', 'Law 15': 'The Throw-In',
  'Law 16': 'The Goal Kick', 'Law 17': 'The Corner Kick',
}

const ASK_PRESETS = [
  { q: 'Can you score directly from a corner kick?',          hint: 'Law 17 · Corner' },
  { q: 'Does a goalkeeper have to stay on the line for a penalty?', hint: 'Law 14 · Penalty' },
  { q: 'What is DOGSO and when does it mean a red card?',     hint: 'Law 12 · Misconduct' },
  { q: 'When does offside not apply?',                        hint: 'Law 11 · Offside' },
  { q: 'What happens if the ball hits the referee?',          hint: 'Law 9 · Ball in Play' },
  { q: 'How many substitutions can a team make per game?',    hint: 'Law 3 · Players' },
]

// SVG pitch diagram — highlights the zone most relevant to the cited law
function PitchZoneDiagram({ lawRef }: { lawRef: string | null }) {
  const n = lawRef ? parseInt(lawRef.replace('Law ', '')) : 0
  const W = 200, H = 128
  // Pitch field rect
  const px = 6, py = 6, pw = W - 12, ph = H - 12
  const cx = px + pw / 2, cy = py + ph / 2
  // penalty area proportions (16.5m / 105m * pw)
  const paW = pw * 0.157, paH = ph * 0.593
  const paY = cy - paH / 2
  // 6-yard box
  const gbW = pw * 0.052, gbH = ph * 0.265, gbY = cy - gbH / 2
  // penalty spot (11m from goal line)
  const pSpotX = pw * 0.105
  // goal
  const gW = 3, gH = ph * 0.108, gY = cy - gH / 2

  const hi = '#FACC15'   // amber highlight
  const hiRed = '#EF4444'

  // returns extra SVG elements to overlay on the pitch
  const zone = (): React.ReactNode => {
    switch (n) {
      case 11: return ( // Offside — vertical line + player dots
        <g>
          <line x1={cx + pw*0.18} y1={py} x2={cx + pw*0.18} y2={py+ph} stroke={hi} strokeWidth={2} strokeDasharray="4 3" opacity={0.9} />
          <circle cx={cx+pw*0.18} cy={cy-ph*0.15} r={4} fill={hi} />
          <circle cx={cx+pw*0.25} cy={cy-ph*0.15} r={4} fill={hiRed} opacity={0.85} />
          <text x={cx+pw*0.18-4} y={py+14} fill={hi} fontSize="7" fontFamily="Inter" fontWeight="800">OFFSIDE LINE</text>
        </g>
      )
      case 12: return ( // Fouls — highlight both penalty areas
        <g>
          <rect x={px} y={paY} width={paW} height={paH} fill={`${hiRed}22`} stroke={hiRed} strokeWidth={1.5} />
          <rect x={px+pw-paW} y={paY} width={paW} height={paH} fill={`${hiRed}22`} stroke={hiRed} strokeWidth={1.5} />
          <text x={px+paW/2} y={cy+4} textAnchor="middle" fill={hiRed} fontSize="6" fontFamily="Inter" fontWeight="800">PENALTY AREA</text>
        </g>
      )
      case 13: return ( // Free kicks — zone just outside left penalty area
        <g>
          <circle cx={px+paW+pw*0.05} cy={cy} r={pw*0.05} fill={`${hi}28`} stroke={hi} strokeWidth={1.5} strokeDasharray="3 2" />
          <circle cx={px+paW+pw*0.05} cy={cy} r={3} fill={hi} />
          <text x={px+paW+pw*0.05} y={cy-pw*0.07} textAnchor="middle" fill={hi} fontSize="6" fontFamily="Inter" fontWeight="700">FREE KICK</text>
        </g>
      )
      case 14: return ( // Penalty kick — right penalty spot + arc
        <g>
          <rect x={px+pw-paW} y={paY} width={paW} height={paH} fill={`${hi}14`} stroke={hi} strokeWidth={1.5} strokeDasharray="3 2" />
          <circle cx={px+pw-pSpotX} cy={cy} r={5} fill={hi} />
          <circle cx={px+pw-pSpotX} cy={cy} r={pw*0.086} fill="none" stroke={hi} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
          <text x={px+pw-pSpotX} y={cy+12} textAnchor="middle" fill={hi} fontSize="6" fontFamily="Inter" fontWeight="800">PENALTY SPOT</text>
        </g>
      )
      case 15: return ( // Throw-in — touchlines
        <g>
          <rect x={px} y={py} width={pw} height={3} fill={hi} opacity={0.7} />
          <rect x={px} y={py+ph-3} width={pw} height={3} fill={hi} opacity={0.7} />
          <text x={cx} y={py+11} textAnchor="middle" fill={hi} fontSize="6" fontFamily="Inter" fontWeight="800">TOUCHLINE</text>
        </g>
      )
      case 16: return ( // Goal kick — 6-yard boxes
        <g>
          <rect x={px} y={gbY} width={gbW} height={gbH} fill={`${hi}28`} stroke={hi} strokeWidth={1.5} />
          <rect x={px+pw-gbW} y={gbY} width={gbW} height={gbH} fill={`${hi}28`} stroke={hi} strokeWidth={1.5} />
          <text x={px+gbW/2} y={cy+4} textAnchor="middle" fill={hi} fontSize="5.5" fontFamily="Inter" fontWeight="800">GOAL AREA</text>
        </g>
      )
      case 17: return ( // Corner kick — 4 corner arcs
        <g>
          {([[px,py],[px+pw,py],[px,py+ph],[px+pw,py+ph]] as [number,number][]).map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r={pw*0.04} fill={`${hi}2A`} stroke={hi} strokeWidth={1.5} />
          ))}
          <text x={cx} y={cy+4} textAnchor="middle" fill={hi} fontSize="6" fontFamily="Inter" fontWeight="800">CORNER ARCS</text>
        </g>
      )
      case 10: return ( // Goals
        <g>
          <rect x={px-gW} y={gY} width={gW+2} height={gH} fill={hi} opacity={0.7} />
          <rect x={px+pw-2} y={gY} width={gW+2} height={gH} fill={hi} opacity={0.7} />
          <text x={cx} y={cy+4} textAnchor="middle" fill={hi} fontSize="6" fontFamily="Inter" fontWeight="800">GOALS</text>
        </g>
      )
      case 8: case 6: return ( // Kickoff / Officials — center
        <g>
          <circle cx={cx} cy={cy} r={pw*0.086} fill={`${hi}1A`} stroke={hi} strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={4} fill={hi} />
          <text x={cx} y={cy-pw*0.1} textAnchor="middle" fill={hi} fontSize="6" fontFamily="Inter" fontWeight="800">CENTRE</text>
        </g>
      )
      default: return null
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      {/* Parchment surround */}
      <rect width={W} height={H} fill="#E8E0C4" />
      {/* Pitch green */}
      <rect x={px} y={py} width={pw} height={ph} fill="#1C5C20" />
      {/* Mown stripes */}
      {Array.from({length:10},(_,i) => (
        <rect key={i} x={px+i*pw/10} y={py} width={pw/10} height={ph} fill={i%2===0?'#1C5C20':'#1E6622'} />
      ))}
      {/* White markings */}
      <rect x={px} y={py} width={pw} height={ph} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1} />
      <line x1={cx} y1={py} x2={cx} y2={py+ph} stroke="rgba(255,255,255,0.45)" strokeWidth={0.8} />
      <circle cx={cx} cy={cy} r={pw*0.086} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={0.8} />
      <circle cx={cx} cy={cy} r={2} fill="rgba(255,255,255,0.6)" />
      {/* Left penalty area */}
      <rect x={px} y={paY} width={paW} height={paH} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={0.8} />
      {/* Right penalty area */}
      <rect x={px+pw-paW} y={paY} width={paW} height={paH} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={0.8} />
      {/* 6-yard boxes */}
      <rect x={px} y={gbY} width={gbW} height={gbH} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.7} />
      <rect x={px+pw-gbW} y={gbY} width={gbW} height={gbH} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.7} />
      {/* Goals */}
      <rect x={px-gW} y={gY} width={gW} height={gH} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={0.8} />
      <rect x={px+pw} y={gY} width={gW} height={gH} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={0.8} />
      {/* Penalty spots */}
      <circle cx={px+pSpotX} cy={cy} r={1.5} fill="rgba(255,255,255,0.5)" />
      <circle cx={px+pw-pSpotX} cy={cy} r={1.5} fill="rgba(255,255,255,0.5)" />
      {/* Corner arcs */}
      {([[px,py],[px+pw,py],[px,py+ph],[px+pw,py+ph]] as [number,number][]).map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={pw*0.036} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.7} />
      ))}
      {/* Zone highlight */}
      {zone()}
      {/* Label at bottom */}
      <text x={cx} y={H-1} textAnchor="middle" fill="#8A8070" fontSize="5.5" fontFamily="Inter" letterSpacing="0.1em">SCHEMATIC · NOT THE ACTUAL INCIDENT</text>
    </svg>
  )
}

function RuleQA({ C }: { C: Record<string, string> }) {
  const register = 'fan'
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AskResult | null>(null)
  const [answerCount, setAnswerCount] = useState(0)
  const [askedQ, setAskedQ] = useState('')

  const ask = async (q: string) => {
    const question = (q || input).trim()
    if (!question) return
    setLoading(true); setResult(null); setAskedQ(question)
    try {
      const res = await fetch(`${API_URL}/var-oracle/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, register, lang: 'en' }),
      })
      const data: AskResult = await res.json()
      setResult(data); setAnswerCount(c => c + 1)
    } catch {
      setResult({ answer: 'Connection error — is the backend running?', completeness: 'PARTIAL', law_ref: null })
    } finally { setLoading(false) }
  }

  const sufficiency = (() => {
    if (!result?.answer) return 0
    const ans = result.answer
    const lawCount = (ans.match(/Law \d+/gi) ?? []).length
    const hasClause = /states|clause|according to|under law|reads|specif/i.test(ans)
    const hasDiscretion = /discretion|not specif|unclear|does not address/i.test(ans)
    const longAnswer = ans.length > 280
    let score = result.completeness === 'COMPLETE' ? 68 : 40
    score += Math.min(lawCount - 1, 3) * 5   // +5 per extra law cited, max +15
    if (hasClause)     score += 7
    if (longAnswer)    score += 5
    if (hasDiscretion) score -= 12
    return Math.min(97, Math.max(22, score))
  })()
  const suffColor   = sufficiency >= 70 ? C.green : sufficiency >= 50 ? '#B45309' : '#DC2626'
  const lawNum      = result?.law_ref?.replace('Law ', '') ?? null

  return (
    <div style={{ padding: '0 48px 32px' }}>

      {/* ── Section header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth={2} strokeLinecap="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.text, fontFamily: 'Inter,sans-serif' }}>FIFA Laws Q&amp;A</span>
          <span style={{ fontSize: 11, color: C.text3 }}>IBM Granite · cited from the official rulebook</span>
        </div>
      </div>

      {/* ── Preset chips — parchment cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10, marginBottom: 14 }}>
        {ASK_PRESETS.map(({ q, hint }) => (
          <button key={q} onClick={() => { setInput(q); ask(q) }} style={{
            textAlign: 'left', background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 0, padding: '11px 14px', cursor: 'pointer', fontFamily: 'inherit',
            borderTop: `2px solid ${C.green}`,
          }}>
            <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.45, marginBottom: 7 }}>{q}</div>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: C.text3 }}>{hint}</span>
          </button>
        ))}
      </div>

      {/* ── Input row ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 22 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask(input)}
          placeholder="Ask any FIFA rule or VAR question…"
          style={{
            flex: 1, padding: '11px 16px', fontSize: 13, border: `1px solid ${C.border}`,
            borderRight: 'none', background: C.card, color: C.text,
            fontFamily: 'Inter,sans-serif', outline: 'none',
          }}
        />
        <button onClick={() => ask(input)} disabled={loading} style={{
          padding: '11px 22px', background: C.green, color: '#fff', border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase',
          fontFamily: 'Inter,sans-serif',
        }}>
          {loading ? 'Checking…' : 'Ask Granite ↗'}
        </button>
      </div>

      {/* ── Result card — parchment with pitch diagram ── */}
      {result && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden', borderTop: `3px solid ${C.green}` }}>

          {/* Header: IBM badge + question + completeness */}
          <div style={{ padding: '10px 20px', borderBottom: `1px solid ${C.border}`, background: '#FAFAF7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ background: '#1558D6', color: '#fff', fontSize: 9, fontWeight: 900, padding: '2px 6px', letterSpacing: '0.06em', flexShrink: 0 }}>IBM</div>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.green }}>GRANITE · RULE ANALYSIS</span>
              <span style={{ fontSize: 10, color: C.text3, fontStyle: 'italic' }}>"{askedQ}"</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: C.text3 }}>#{answerCount}</span>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '2px 8px', border: `1px solid ${suffColor}`, color: suffColor,
              }}>{result.completeness}</span>
            </div>
          </div>

          {/* Two-column: pitch diagram | law + evidence */}
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', borderBottom: `1px solid ${C.border}` }}>

            {/* Left: pitch zone SVG */}
            <div style={{ borderRight: `1px solid ${C.border}`, padding: '14px 14px 10px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.text3, marginBottom: 8 }}>PITCH ZONE · {result.law_ref ?? 'General'}</div>
              <PitchZoneDiagram lawRef={result.law_ref} />
            </div>

            {/* Right: law number + evidence bar */}
            <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>

              {lawNum ? (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.text3, marginBottom: 6 }}>LAW CITED</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 88, color: C.green, lineHeight: 1 }}>{lawNum}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{LAW_NAMES[result.law_ref!] ?? 'FIFA Laws'}</div>
                      <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>FIFA Laws of the Game</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 14, color: C.text3 }}>Law not specified in answer</div>
              )}

              {/* Evidence sufficiency bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.text3 }}>Evidence Sufficiency</span>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: suffColor, lineHeight: 1 }}>{sufficiency}%</span>
                </div>
                <div style={{ height: 5, background: C.bg2, border: `1px solid ${C.border}` }}>
                  <div style={{ height: '100%', width: `${sufficiency}%`, background: suffColor, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize: 12, color: C.text3, marginTop: 7 }}>
                  {result.completeness === 'COMPLETE'
                    ? 'Law clause located and cited in answer'
                    : 'Rulebook may not fully cover this scenario — referee discretion may apply'}
                </div>
              </div>

            </div>
          </div>

          {/* Answer text — full width */}
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.green, marginBottom: 12 }}>Analysis</div>
            <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.85 }}>{result.answer}</div>
          </div>

          {/* Footer */}
          <div style={{ padding: '8px 22px', borderTop: `1px solid ${C.border}`, background: C.bg2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: C.text3 }}>IBM Granite · watsonx · FIFA Laws of the Game 2024</span>
            <span style={{ fontSize: 9, color: C.text3 }}>Pitch Intel · VAR Oracle · #{answerCount}</span>
          </div>

        </div>
      )}
    </div>
  )
}

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
    setFile(f); setVerdict(null); setError(null); setStep(-1)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(f))
  }, [preview])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
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
    PIPELINE_STEPS.slice(1).forEach((s, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), s.time))
    })
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_URL}/var-oracle/analyse`, { method: 'POST', body: form })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.detail || errBody?.error || `Server error ${res.status}`)
      }
      const data: Verdict = await res.json()
      timers.current.forEach(clearTimeout)
      setStep(5); setLawManuallyToggled(false); setOpenLaw(null)
      setTimeout(() => { setVerdict(data); setLoading(false) }, 400)
    } catch (e: unknown) {
      timers.current.forEach(clearTimeout)
      setError(e instanceof Error ? e.message : 'Analysis failed. Ensure the backend is running.')
      setLoading(false); setStep(-1)
    }
  }

  const vc = verdict ? (VAR_CONFIG[verdict.var_action] ?? VAR_CONFIG['UPHELD']) : null
  const confidencePct = verdict ? Math.round(verdict.confidence * 100) : 0

  // ── Parchment colour palette ──────────────────────────────────────
  const C = {
    bg:      '#F0E9D2',
    bg2:     '#E8E0C4',
    card:    '#FAFAF5',
    border:  '#DDD5BB',
    border2: '#C9C0A4',
    text:    '#111111',
    text2:   '#4A4A3A',
    text3:   '#8A8070',
    green:   '#166534',
    greenL:  '#22C55E',
  }

  return (
    <div style={{ margin: '-18px -22px', minHeight: 'calc(100vh - 96px)', fontFamily: "'Inter', sans-serif", background: C.bg, overflowY: 'auto' }}>

        {/* ── HERO SECTION — full-bleed football field ── */}
        <div style={{ position: 'relative', overflow: 'hidden', minHeight: 560 }}>

          {/* Background: local hero image — no external dependency */}
          <img
            src="/var-hero.jpg"
            alt=""
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 50%', zIndex: 0, display: 'block', transform: 'scaleX(-1)' }}
          />
          {/* Overlay: dark on left for readability, opens up on right */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(105deg, rgba(5,12,20,0.96) 0%, rgba(5,12,20,0.88) 38%, rgba(5,12,20,0.55) 62%, rgba(5,12,20,0.15) 100%)' }} />
          {/* Bottom: gentle fade into parchment */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '14%', zIndex: 2, background: `linear-gradient(to bottom, transparent, ${C.bg})` }} />

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 3, padding: '52px 48px 72px', maxWidth: 700 }}>

            {/* Module label */}
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#22C55E', marginBottom: 14 }}>
              Module 01 · Computer Vision + AI Rulebook
            </div>

            {/* VAR ORACLE title */}
            <div style={{ lineHeight: 0.88, marginBottom: 22 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 108, letterSpacing: '0.04em', color: '#FFFFFF' }}>VAR</div>
              <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 96, fontStyle: 'italic', fontWeight: 900, color: '#22C55E', marginTop: -8 }}>
                Oracle
                <svg viewBox="0 0 340 12" style={{ display: 'block', width: 340, marginTop: -2 }}>
                  <path d="M4 7 Q80 2 170 6 Q260 10 336 5" stroke="#22C55E" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
                </svg>
              </div>
            </div>

            {/* Description */}
            <p style={{ fontSize: 15, color: '#CBD5E1', lineHeight: 1.75, maxWidth: 520, marginBottom: 24 }}>
              Upload a match clip. <strong style={{ color: '#FFFFFF' }}>YOLOv8</strong> analyses the footage frame-by-frame,{' '}
              <strong style={{ color: '#FFFFFF' }}>Docling</strong> extracts the relevant FIFA law, and{' '}
              <strong style={{ color: '#FFFFFF' }}>IBM Granite</strong> delivers a structured referee verdict.
            </p>

            {/* Tech badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 28, maxWidth: 560 }}>
              {([
                { Icon: Scale, label: 'YOLOv8',     sub: 'Computer Vision', color: '#4ADE80' },
                { Icon: Power, label: 'Docling',     sub: 'PDF Parsing',     color: '#60A5FA' },
                { Icon: Cpu,   label: 'IBM Granite', sub: 'LLM',             color: '#C084FC' },
                { Icon: Scale, label: 'FIFA Laws',   sub: 'Reference',       color: '#FCD34D' },
              ] as const).map(b => (
                <div key={b.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  background: 'rgba(5,12,20,0.72)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 0,
                  backdropFilter: 'blur(8px)',
                }}>
                  <b.Icon size={22} color={b.color} strokeWidth={1.6} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#FFFFFF' }}>{b.label}</div>
                    <div style={{ fontSize: 9, color: '#94A3B8' }}>{b.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Upload zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !file && inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? '#22C55E' : 'rgba(255,255,255,0.28)'}`,
                borderRadius: 0, padding: preview ? 0 : '36px 24px',
                background: dragging ? 'rgba(34,197,94,0.10)' : 'rgba(5,12,20,0.60)',
                cursor: file ? 'default' : 'pointer',
                transition: 'all 0.15s', textAlign: 'center',
                overflow: 'hidden', maxWidth: 560,
              }}
            >
              {preview ? (
                <video src={preview} controls style={{ width: '100%', display: 'block', maxHeight: 240, objectFit: 'cover' }} />
              ) : (
                <>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', border: '1px solid rgba(34,197,94,0.4)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 4v12M8 8l4-4 4 4M4 20h16" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: '0.14em', color: '#FFFFFF', marginBottom: 4 }}>Drop Match Clip Here</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>or click to browse · MP4 · MOV · AVI · WebM</div>
                </>
              )}
            </div>
            <input ref={inputRef} type="file" accept="video/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }} />

            {file && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', maxWidth: 560 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 0, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>{(file.size / 1024 / 1024).toFixed(1)} MB · ready to analyse</div>
                </div>
                <button onClick={analyse} disabled={loading} style={{
                  padding: '10px 22px', background: loading ? '#166534' : '#22C55E',
                  color: '#000', border: 'none', borderRadius: 0,
                  fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
                }}>
                  {loading ? 'Analysing…' : 'Analyse'}
                </button>
                <button onClick={clear} style={{
                  padding: '10px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.13)',
                  borderRadius: 0, color: '#CBD5E1', cursor: 'pointer', fontSize: 11, fontFamily: 'Inter, sans-serif',
                }}>✕</button>
              </div>
            )}
          </div>
        </div>

        {/* ── PIPELINE ── */}
        {(loading || step >= 0 || error) && (
          <div style={{ padding: '0 48px 24px' }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: loading ? C.greenL : verdict ? C.greenL : '#EF4444', animation: loading ? 'lpb 1s ease infinite' : 'none' }} />
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.green }}>Analysis Pipeline</span>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', gap: 0 }}>
                {PIPELINE_STEPS.map((s, i) => {
                  const done = (step > i && loading) || !!verdict
                  const active = step === i && loading
                  return (
                    <div key={s.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative' }}>
                      {i < PIPELINE_STEPS.length - 1 && (
                        <div style={{ position: 'absolute', left: '50%', top: 16, width: '100%', height: 2, background: done ? C.greenL : C.border, transition: 'background 0.4s', zIndex: 0 }} />
                      )}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: done ? C.green : active ? '#F0FDF4' : C.bg2,
                        border: `2px solid ${done ? C.green : active ? C.greenL : C.border}`,
                        transition: 'all 0.3s',
                      }}>
                        {done ? <span style={{ fontSize: 13, color: '#fff', fontWeight: 900 }}>✓</span>
                          : active ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.greenL, animation: 'lpb 0.8s ease infinite' }} />
                          : <span style={{ fontSize: 10, color: C.text3, fontWeight: 700 }}>{i + 1}</span>}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: done || active ? C.text : C.text3 }}>{s.label}</div>
                        <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>{s.sub}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            {error && (
              <div style={{ marginTop: 10, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 0, padding: '14px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', marginBottom: 4 }}>Analysis Failed</div>
                <div style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 1.6 }}>{error}</div>
              </div>
            )}
          </div>
        )}

        {/* ── VERDICT DETAIL ── */}
        {verdict && vc && (
          <div style={{ padding: '0 48px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {verdict.detection_preview && (
              <DetectionFrame dp={verdict.detection_preview} incidentType={verdict.incident_type} vcColor={vc.color} />
            )}

            {/* Verdict banner */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden', borderTop: `3px solid ${vc.color}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: `1px solid ${C.border}`, background: '#FAFAF7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: vc.color }} />
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: vc.color }}>VAR Decision · {vc.label}</span>
                </div>
                <span style={{ fontSize: 10, color: C.text3 }}>IBM Granite · FIFA Laws of the Game</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'stretch' }}>
                <div style={{ padding: '20px 24px', borderRight: `1px solid ${C.border}`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <div style={{ fontSize: 36 }}>{INCIDENT_ICONS[verdict.incident_type] ?? '⚡'}</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.1em', color: C.text }}>{verdict.incident_type.toUpperCase()}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.text3 }}>Incident</div>
                </div>
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.green, marginBottom: 6 }}>What Happened</div>
                    <div style={{ fontSize: 14, color: C.text, lineHeight: 1.65 }}>{verdict.what_happened}</div>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 0, padding: '5px 12px' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: vc.color }}>{verdict.law_number}</span>
                    <span style={{ color: C.border2 }}>·</span>
                    <span style={{ fontSize: 11, color: C.text2 }}>{verdict.law_applied}</span>
                  </div>
                </div>
                <div style={{ padding: '16px 24px', borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minWidth: 148 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: vc.color, lineHeight: 1 }}>{confidencePct}%</div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.text3 }}>Granite Confidence</div>
                  <div style={{ padding: '6px 14px', borderRadius: 0, background: vc.bg, border: `1px solid ${vc.color}40`, textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: '0.08em', color: vc.color }}>{vc.label}</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '10px 24px', borderTop: `1px solid ${C.border}`, background: vc.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.text3 }}>Correct Decision</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.08em', color: vc.color }}>{verdict.correct_decision}</span>
              </div>
            </div>

            {/* CV findings + reasoning */}
            <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 14 }}>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: '#FAFAF7' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.green }}>YOLOv8 Findings</span>
                </div>
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {([
                    ['Duration', `${verdict.cv_findings.duration_seconds}s`],
                    ['Frames', `${verdict.cv_findings.frames_analysed}`],
                    ['Players', `${verdict.cv_findings.players_detected}`],
                    ['Ball', `${verdict.cv_findings.ball_frame_count}/${verdict.cv_findings.frames_analysed} frames`],
                    ['Contact', verdict.cv_findings.contact_detected ? 'Yes' : 'No'],
                    ['Ball Height', verdict.cv_findings.ball_height],
                    ['RAG', verdict.cv_findings.rag_used ? 'Semantic (FAISS)' : verdict.cv_findings.docling_used ? 'Docling PDF' : 'Fallback'],
                  ] as [string, string][]).map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, color: C.text3 }}>{l}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {verdict.law_chunk?.rag_chunks && verdict.law_chunk.rag_chunks.length > 0 && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: '#FAFAF7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D97706' }}>Docling RAG · Retrieved</span>
                      <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>FAISS semantic search</span>
                    </div>
                    {verdict.law_chunk.rag_query && (
                      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: '#FFFBF0' }}>
                        <span style={{ fontSize: 11, color: C.text3 }}>Query: </span>
                        <span style={{ fontSize: 12, color: C.text2, fontStyle: 'italic' }}>{verdict.law_chunk.rag_query}</span>
                      </div>
                    )}
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {verdict.law_chunk.rag_chunks.map((chunk, i) => (
                        <div key={i} style={{ background: '#FFFBF0', border: `1px solid #FDE68A`, borderLeft: '3px solid #D97706', borderRadius: 0, padding: '12px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#92400E' }}>{chunk.heading}</span>
                            <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>similarity {chunk.score.toFixed(3)}</span>
                          </div>
                          <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.65 }}>{chunk.text.slice(0, 300)}…</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden', flex: 1 }}>
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: '#FAFAF7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.green }}>IBM Granite · Reasoning</span>
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
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', cursor: 'pointer', background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: 0, color: C.text2, fontSize: 11, fontWeight: 700, fontFamily: 'Inter, sans-serif' }}
                    >⬇ PDF</button>
                  </div>
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.85 }}>{verdict.reasoning}</div>
                  </div>
                </div>
              </div>
            </div>

            <Limitations items={verdict.limitations} />
          </div>
        )}

        {/* ── RULE Q&A ── */}
        <RuleQA C={C} />

        {/* ── FIFA LAW CARDS ── */}
        <div style={{ padding: '0 48px 56px' }}>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: `2px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Scale size={22} color={C.green} strokeWidth={2} />
              <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.text }}>FIFA Laws of the Game</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text3, letterSpacing: '0.06em' }}>· Reference</span>
            </div>
            <span style={{ fontSize: 11, color: verdict?.cv_findings?.rag_used ? C.green : C.text3, fontWeight: 700, letterSpacing: '0.04em' }}>
              {verdict?.cv_findings?.rag_used ? '✓ Docling RAG — semantic retrieval' : 'Hardcoded excerpts'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {FIFA_LAWS_REF.map(law => {
              const isApplied = verdict?.law_number === law.law
              const isOpen = openLaw === law.key || (isApplied && !lawManuallyToggled)
              return (
                <div key={law.key} style={{
                  background: isApplied ? '#fff' : C.card,
                  borderTop: `4px solid ${law.border}`,
                  borderLeft: `1px solid ${isApplied ? law.border : C.border}`,
                  borderRight: `1px solid ${isApplied ? law.border : C.border}`,
                  borderBottom: `1px solid ${isApplied ? law.border : C.border}`,
                  borderRadius: 0, overflow: 'hidden',
                  boxShadow: isApplied ? `0 6px 20px ${law.border}30` : '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'box-shadow 0.2s, transform 0.15s',
                }}>
                  <div style={{ padding: '18px 18px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.22em', textTransform: 'uppercase', color: law.label, marginBottom: 2, opacity: 0.8 }}>LAW</div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, color: law.label, lineHeight: 1 }}>{law.num}</div>
                      </div>
                      <div style={{ marginTop: 4, opacity: 0.85 }}><law.Icon color={law.label} /></div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: C.text, marginBottom: 6, letterSpacing: '0.02em', lineHeight: 1.25 }}>{law.title.toUpperCase()}</div>
                    <div style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.6, marginBottom: 14, minHeight: 32 }}>{law.desc}</div>
                  </div>
                  <button
                    onClick={() => { setLawManuallyToggled(true); setOpenLaw(isOpen ? null : law.key) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '9px 18px 14px',
                      background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      fontSize: 12, fontWeight: 800, color: law.label, letterSpacing: '0.05em',
                    }}
                  >
                    View law <span style={{ transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>→</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '14px 18px 18px', borderTop: `1px solid ${C.border}`, background: '#FEFEF9' }}>
                      <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.85, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{law.text}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

    </div>
  )
}
