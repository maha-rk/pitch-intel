'use client'
import API_URL from './api-url'

import { useEffect, useState } from 'react'
import FanDecoder from './FanDecoder'
import MatchExplainer from './MatchExplainer'
import VAROracle from './VAROracle'
import EmotiPulse from './EmotiPulse'
import PitchAgent from './PitchAgent'
import RefereeLens from './RefereeLens'
import DebateRoom from './DebateRoom'
import WhatIfLab from './WhatIfLab'
import MatchCompanion from './MatchCompanion'
import Limitations from './Limitations'
import { SpeakButton } from './voice'
import LanguageSelector from './LanguageSelector'
import { getLang } from './lang'
import ThreePitch from './ThreePitch'
import LiveScores from './LiveScores'

interface Match {
  match_id: number
  match_date: string
  home_team: string
  away_team: string
  home_score?: number
  away_score?: number
}

interface PlayerPosition {
  x: number
  y: number
  player: string
  minute: number
}

interface HeatmapData {
  match_id: number
  minute: number
  teams: Record<string, PlayerPosition[]>
  ball_position?: { x: number; y: number }
  narration: string
}

interface Moment {
  type: string
  minute: number
  player: string
  team: string
}

interface MomentumPoint {
  minute: number
  team: string
  score: number
}

interface ScoutResult {
  name: string
  team: string
  competition: string
  top_actions: [string, number][]
  scouting_report: string
  radar?: { shots: number; goals: number; conversion: number; xg_quality: number; headers: number; pressure: number }
}

interface XgPoint { minute: number; team: string; xg: number; outcome: string; player: string }
interface ShotPoint { x: number; y: number; team: string; player: string; outcome: string; shot_type: string; xg: number; minute: number }
interface PassConn  { from: string; to: string; team: string; count: number }
interface PassNetwork { connections: PassConn[]; positions: Record<string,{x:number;y:number;team:string}>; formations?: Record<string,string> }

const TEAM_COLORS: Record<string, string> = {
  'Brazil': '#D97706', 'Belgium': '#DC2626', 'France': '#1D4ED8',
  'Croatia': '#EA580C', 'England': '#1E3A8A', 'Argentina': '#2563EB',
  'Germany': '#0284C7', 'Spain': '#DC2626', 'Portugal': '#16A34A',
  'Uruguay': '#2563EB', 'Canada': '#DC2626', 'Morocco': '#D97706',
  'Japan': '#1D4ED8', 'Netherlands': '#EA580C', 'Senegal': '#7C3AED',
  'United States': '#2563EB', 'Australia': '#D97706', 'Switzerland': '#DC2626',
  'Poland': '#DC2626', 'South Korea': '#DC2626', 'Tunisia': '#D97706',
  'Cameroon': '#16A34A', 'Ghana': '#D97706', 'Ecuador': '#D97706',
  'Qatar': '#7C3AED', 'Iran': '#16A34A', 'Saudi Arabia': '#16A34A',
  'default1': '#10B981', 'default2': '#F97316',
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  'Goal':         { color: '#166534', bg: 'rgba(22,101,52,0.12)',   label: 'Goal' },
  'Yellow Card':  { color: '#92400E', bg: 'rgba(180,83,9,0.12)',    label: 'Yellow' },
  'Red Card':     { color: '#991B1B', bg: 'rgba(220,38,38,0.10)',   label: 'Red' },
  'Substitution': { color: '#5B21B6', bg: 'rgba(91,33,182,0.10)',   label: 'Sub' },
  'Shot':         { color: '#1D4ED8', bg: 'rgba(29,78,216,0.10)',   label: 'Shot' },
}

const modules = ['VAR Oracle', 'Tactical Lens', 'Pitch Agent', 'Scout Eye', 'Referee Lens', 'Match Explainer', 'EmotiPulse', 'Fan Decoder', 'Debate', 'Alter Ego', 'Dugout Brief']

export default function Home() {
  const [activeModule, setActiveModule] = useState('VAR Oracle')
  const [matches, setMatches] = useState<Match[]>([])
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [minute, setMinute] = useState(45)
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null)
  const [moments, setMoments] = useState<Moment[]>([])
  const [momentum, setMomentum] = useState<MomentumPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [scoutQuery, setScoutQuery] = useState('')
  const [scoutResults, setScoutResults] = useState<ScoutResult[]>([])
  const [scoutLimitations, setScoutLimitations] = useState<string[]>([])
  const [scoutLoading, setScoutLoading] = useState(false)
  const [introPlayed, setIntroPlayed] = useState(false)
  const [heroAnimDone, setHeroAnimDone] = useState(false)
  const [entering, setEntering] = useState(false)
  const [mode, setMode] = useState<'beginner'|'fan'|'coach'>('fan')
  const [expandedMoment, setExpandedMoment] = useState<number|null>(null)
  const [tacticsView, setTacticsView] = useState<'overview'|'xg'|'shots'|'passes'|'penalties'>('overview')
  const [pitchView, setPitchView] = useState<'2d'|'3d'>('3d')
  const [xgFlow, setXgFlow] = useState<XgPoint[]>([])
  const [shotMap, setShotMap] = useState<ShotPoint[]>([])
  const [passNetwork, setPassNetwork] = useState<PassNetwork|null>(null)
  const [whyVerdict, setWhyVerdict] = useState<string|null>(null)
  const [whyLimitations, setWhyLimitations] = useState<string[]|undefined>(undefined)
  const [whyLoading, setWhyLoading] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setIntroPlayed(true), 3200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    fetch(`${API_URL}/matches`)
      .then(r => r.json()).then(setMatches).catch(() => {})
  }, [])

  const loadMatch = async (m: Match) => {
    setSelectedMatch(m)
    setHeatmapData(null)
    setMoments([])
    setMomentum([])
    setXgFlow([])
    setShotMap([])
    setPassNetwork(null)
    setExpandedMoment(null)
    setTacticsView('overview')
    const [momRes, mntRes, xgRes, shotRes, passRes] = await Promise.all([
      fetch(`${API_URL}/moments/${m.match_id}`).then(r=>r.json()).catch(()=>[]),
      fetch(`${API_URL}/momentum/${m.match_id}`).then(r=>r.json()).catch(()=>[]),
      fetch(`${API_URL}/xg-flow/${m.match_id}`).then(r=>r.json()).catch(()=>[]),
      fetch(`${API_URL}/shot-map/${m.match_id}`).then(r=>r.json()).catch(()=>[]),
      fetch(`${API_URL}/pass-network/${m.match_id}`).then(r=>r.json()).catch(()=>null),
    ])
    setWhyVerdict(null)
    setMoments(momRes)
    setMomentum(mntRes)
    setXgFlow(xgRes)
    setShotMap(shotRes)
    setPassNetwork(passRes)
  }

  const loadTactical = async (matchId: number, min: number) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/tactical/${matchId}/${min}?lang=${getLang()}`)
      const data = await res.json()
      setHeatmapData(data)
    } catch(e) {}
    setLoading(false)
  }

  const runScout = async () => {
    if (!scoutQuery.trim()) return
    setScoutLoading(true)
    try {
      const res = await fetch(`${API_URL}/scout/${encodeURIComponent(scoutQuery)}?lang=${getLang()}`)
      const data = await res.json()
      setScoutResults(data.results || [])
      setScoutLimitations(data.limitations || [])
    } catch(e) {}
    setScoutLoading(false)
  }

  const handleEnter = () => {
    setEntering(true)
    setTimeout(() => setHeroAnimDone(true), 1600)
  }

  const handleBack = () => {
    setHeroAnimDone(false)
    setEntering(false)
  }

  const loadVerdict = async () => {
    if (!selectedMatch) return
    setWhyLoading(true)
    try {
      const res = await fetch(`${API_URL}/verdict/${selectedMatch.match_id}?home_team=${encodeURIComponent(selectedMatch.home_team)}&away_team=${encodeURIComponent(selectedMatch.away_team)}&home_score=${selectedMatch.home_score ?? 0}&away_score=${selectedMatch.away_score ?? 0}&lang=${getLang()}`)
      const data = await res.json()
      setWhyVerdict(data.verdict)
      setWhyLimitations(data.limitations)
    } catch(e) {}
    setWhyLoading(false)
  }

  const getColor = (team: string, index: number) =>
    TEAM_COLORS[team] || (index === 0 ? TEAM_COLORS['default1'] : TEAM_COLORS['default2'])

  useEffect(() => {
    const handler = () => { if (selectedMatch && whyVerdict) loadVerdict() }
    window.addEventListener('lang-change', handler)
    return () => window.removeEventListener('lang-change', handler)
  }, [selectedMatch, whyVerdict])

  const teams = momentum.length > 0
    ? [...new Set(momentum.map(m => m.team))]
    : selectedMatch ? [selectedMatch.home_team, selectedMatch.away_team] : []

  const maxMomentum = Math.max(...momentum.map(m => m.score), 1)
  const minutes = [...new Set(momentum.map(m => m.minute))].sort((a,b)=>a-b)
  const keyMoments = moments.filter(m => ['Goal','Yellow Card','Red Card','Substitution'].includes(m.type))

  const getModeExplanation = (m: Moment) => {
    if (mode === 'beginner')
      return `At minute ${m.minute}, ${m.player || 'a player'} was involved in a ${m.type.toLowerCase()} for ${m.team}. This is a significant moment that directly changed the flow and momentum of the match.`
    if (mode === 'fan')
      return `${m.minute}' — ${m.type} (${m.team}). ${m.player ? `${m.player} was central to this moment.` : ''} This shifted the tactical balance and changed how both sides approached the next phase of play, with ripple effects on team shape and pressing intensity.`
    return `${m.minute}' — ${m.type} event for ${m.team}. ${m.player ? `${m.player} involved.` : ''} Tactically, this forced a realignment of pressing triggers and defensive shape. The knock-on effect on compactness and transition speed was evident in the subsequent 10 minutes of play.`
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Bebas+Neue&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg:  #F0E9D2; --bg2: #EAE0C8; --bg3: #E2D7B4;
          --bg4: #D8CCA4; --bg5: #CEC090;
          --bd:  #DDD5BB; --bd2: #CFC7A4; --bd3: #C0B892;
          --t1: #111111; --t2: #4A4435; --t3: #8A8070;
          --green: #166534; --green2: #22C55E; --gold: #B45309;
          --red: #DC2626; --blue: #1D4ED8;
          --g-chip: rgba(22,101,52,0.10); --g-border: rgba(22,101,52,0.32);
          --r-chip: rgba(220,38,38,0.07); --r-border: rgba(220,38,38,0.22);
          --a-chip: rgba(180,83,9,0.09);  --a-border: rgba(180,83,9,0.28);
          --b-chip: rgba(29,78,216,0.07); --b-border: rgba(29,78,216,0.22);
        }
        body { background:var(--bg); color:var(--t1); font-family:'Inter',sans-serif; font-size:13px; line-height:1.5; overflow-x:hidden; -webkit-font-smoothing:antialiased; font-variant-numeric:tabular-nums; }

        .hero { position:fixed; inset:0; z-index:999; background:transparent; overflow-y:auto; transition:opacity 0.7s ease; }
        .hero.out { opacity:0; pointer-events:none; }
        .hero-svg { position:fixed; inset:0; width:100%; height:100%; opacity:0.04; pointer-events:none; }
        .lp-wrap { position:relative; z-index:1; max-width:1100px; margin:0 auto; padding:0 32px 48px; }
        .lp-hero { padding:64px 0 48px; }
        .lp-title { font-family:'Bebas Neue',sans-serif; font-size:108px; letter-spacing:0.06em; color:#FFFFFF; line-height:0.9; margin:0 0 20px; text-shadow:0 2px 20px rgba(0,0,0,0.55); white-space:nowrap; }
        .lp-title-accent { color:#4ADE80; }
        .lp-sub { font-size:16px; color:#F0EDE4; line-height:1.65; margin:0 0 32px; font-weight:600; text-shadow:0 1px 8px rgba(0,0,0,0.6); white-space:nowrap; }
        .lp-diff { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:48px; }
        .lp-diff-item { display:flex; align-items:center; gap:8px; padding:16px 20px; background:#F0E9D2; border:1px solid rgba(200,190,165,0.7); border-radius:4px; flex:1; min-width:200px; }
        .lp-diff-n { font-family:'Bebas Neue',sans-serif; font-size:40px; letter-spacing:0.04em; line-height:1; flex-shrink:0; }
        .lp-diff-l { font-size:12px; color:var(--t3); line-height:1.4; font-weight:600; }
        .lp-section-lbl { font-size:9px; font-weight:800; letter-spacing:0.22em; text-transform:uppercase; color:var(--t3); margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid var(--bd); }
        .lp-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:2px; background:rgba(0,0,0,0.22); overflow:visible; margin-bottom:32px; grid-auto-rows:minmax(220px,auto); }
        .lp-card { background:#F0E9D2; padding:18px; display:flex; flex-direction:column; gap:8px; transition:background 0.15s, transform 0.18s ease, box-shadow 0.18s ease; border-left:3px solid transparent; position:relative; }
        .lp-card:hover { background:#E8DFC8; transform:scale(1.04) translateY(-3px); box-shadow:0 14px 36px rgba(0,0,0,0.30); z-index:5; }
        .lp-card-top { display:flex; align-items:center; gap:8px; }
        .lp-card-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .lp-card-num { font-size:11px; font-weight:700; color:var(--t3); margin-left:auto; font-variant-numeric:tabular-nums; }
        .lp-card-name { font-size:15px; font-weight:800; color:var(--t1); line-height:1.2; }
        .lp-card-desc { font-size:12px; color:var(--t2); line-height:1.6; flex:1; }
        .lp-card-tag { font-size:10px; font-weight:700; padding:3px 9px; border-radius:2px; align-self:flex-start; letter-spacing:0.06em; border:1px solid; }
        .lp-enter { display:block; margin:0 auto 28px; padding:15px 44px; background:var(--green); color:#fff; font-family:'Bebas Neue',sans-serif; font-size:20px; letter-spacing:0.2em; border:none; border-radius:3px; cursor:pointer; transition:background 0.15s; }
        .lp-enter:hover { background:var(--green2); }
        .lp-footer { font-size:13px; color:#F0EDE4; text-align:center; line-height:1.9; padding:20px 24px; background:rgba(0,0,0,0.35); margin-top:8px; border-radius:3px; }

        .app { opacity:0; transition:opacity 0.6s ease; }
        .app.in { opacity:1; }

        .topbar { position:sticky; top:0; z-index:100; height:56px; background:#0B1929; border-bottom:none; display:flex; align-items:center; padding:0 24px; }
        .wm { display:flex; align-items:center; gap:10px; flex-shrink:0; padding-right:24px; border-right:1px solid #1A2E44; }
        .wm-icon { flex-shrink:0; }
        .wm-text { display:flex; flex-direction:column; gap:1px; }
        .wm-mark { font-family:'Bebas Neue',sans-serif; font-size:20px; letter-spacing:0.16em; color:#E2E8F0; line-height:1; }
        .wm-mark b { color:#22C55E; font-weight:inherit; }
        .wm-sub { font-family:'Inter',sans-serif; font-size:7px; font-weight:700; letter-spacing:0.16em; color:#4A7098; text-transform:uppercase; }
        .nav { display:flex; height:100%; overflow-x:auto; flex:1; justify-content:space-evenly; gap:0; }
        .nav::-webkit-scrollbar { display:none; }
        .nbtn { display:flex; align-items:center; padding:0 9px; font-size:10.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#7A99B8; background:none; border:none; border-bottom:2px solid transparent; cursor:pointer; white-space:nowrap; transition:color 0.12s,border-color 0.12s; font-family:'Inter',sans-serif; height:100%; }
        .nbtn:hover { color:#E2E8F0; }
        .nbtn.on { color:#FFFFFF; border-bottom-color:#22C55E; }
        .topbar-r { margin-left:auto; display:flex; align-items:center; gap:10px; flex-shrink:0; padding-left:20px; border-left:1px solid #1A2E44; }
        .tourn { font-size:9px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--t3); }
        .live { display:flex; align-items:center; gap:5px; background:var(--g-chip); color:var(--green); border:1px solid var(--g-border); font-size:8px; font-weight:800; letter-spacing:0.18em; text-transform:uppercase; padding:5px 11px; border-radius:2px; }
        .lpip { width:5px; height:5px; background:var(--green); border-radius:50%; animation:lpb 1.4s ease infinite; }
        @keyframes lpb { 0%,100%{opacity:1} 50%{opacity:0.15} }


        .content { padding:18px 22px; min-height:calc(100vh - 110px); background-image:linear-gradient(rgba(0,0,0,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.05) 1px,transparent 1px); background-size:38px 38px; }

        .tac { display:grid; grid-template-columns:260px 1fr; gap:14px; height:calc(100vh - 148px); }
        .fpanel { background:var(--bg2); border-radius:6px; overflow:hidden; display:flex; flex-direction:column; border:1px solid var(--bd); min-height:0; }
        .phd { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--bd); background:var(--bg3); flex-shrink:0; }
        .pttl { font-size:11px; font-weight:800; letter-spacing:0.18em; text-transform:uppercase; color:var(--t1); }
        .pct { font-size:11px; font-weight:700; color:var(--green); background:var(--g-chip); border:1px solid var(--g-border); padding:2px 9px; border-radius:2px; }
        .flist { overflow-y:auto; flex:1; min-height:0; }
        .flist::-webkit-scrollbar { width:2px; }
        .flist::-webkit-scrollbar-thumb { background:var(--bg5); }
        .frow { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; border-bottom:1px solid var(--bd); border-left:2px solid transparent; cursor:pointer; transition:background 0.12s,transform 0.12s; gap:10px; }
        .frow:hover { background:var(--bg3); transform:translateX(2px); }
        .frow.sel { background:rgba(22,101,52,0.09); border-left-color:var(--green); transform:none; }
        .frow-info { flex:1; min-width:0; }
        .fn { font-size:11px; font-weight:600; color:var(--t1); line-height:1.3; }
        .fvs { color:var(--t3); font-size:9px; font-weight:500; margin:0 4px; }
        .fd { font-size:11px; font-weight:600; color:var(--t2); margin-top:2px; letter-spacing:0.02em; }
        .fsc { font-size:12px; font-weight:800; color:var(--t1); white-space:nowrap; flex-shrink:0; font-variant-numeric:tabular-nums; }
        .farr { color:var(--t3); font-size:10px; flex-shrink:0; }
        .frow.sel .farr { color:var(--green); }

        .mv { display:flex; flex-direction:column; gap:16px; overflow-y:auto; height:100%; min-height:0; }
        .mv::-webkit-scrollbar { width:3px; }
        .mv::-webkit-scrollbar-thumb { background:var(--bg5); }

        .sb { background:var(--bg2); border-radius:6px; overflow:hidden; flex-shrink:0; display:flex; flex-direction:column; border:1px solid var(--bd); }
        .sb-main { display:grid; grid-template-columns:1fr auto 1fr; align-items:stretch; }
        .sb-team { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; padding:18px 16px; }
        .sb-team:first-child { border-right:1px solid var(--bd); }
        .sb-team:last-child { border-left:1px solid var(--bd); }
        .sb-name { font-family:'Bebas Neue',sans-serif; font-size:34px; letter-spacing:0.06em; text-transform:uppercase; text-align:center; line-height:1.05; color:var(--t1); }
        .sb-role { font-size:8px; font-weight:700; color:var(--t3); letter-spacing:0.18em; text-transform:uppercase; }
        .sb-ctr { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; padding:14px 28px; border-left:1px solid var(--bd); border-right:1px solid var(--bd); background:var(--bg); }
        .sb-badge { font-size:8px; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; color:var(--green); background:var(--g-chip); border:1px solid var(--g-border); padding:3px 10px; border-radius:2px; }
        .sb-score { font-family:'Bebas Neue',sans-serif; font-size:90px; letter-spacing:0.02em; line-height:1; display:flex; align-items:center; gap:6px; justify-content:center; }
        .sb-sep { color:var(--t3); font-size:48px; line-height:1; }
        .sb-date { font-size:8px; font-weight:600; color:var(--t3); letter-spacing:0.1em; text-transform:uppercase; }
        .sb-bottom { border-top:1px solid var(--bd); display:flex; background:var(--bg3); }
        .sb-bstat { flex:1; padding:9px 14px; text-align:center; border-right:1px solid var(--bd); }
        .sb-bstat:last-child { border-right:none; }
        .sb-bstat-lbl { font-size:8px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--t3); margin-bottom:3px; }
        .sb-bstat-val { display:flex; align-items:center; justify-content:center; gap:8px; font-size:15px; font-weight:700; font-variant-numeric:tabular-nums; color:var(--t1); }
        .sb-bstat-sep { color:var(--t3); font-size:11px; }

        .modes { display:flex; flex-direction:column; align-items:center; gap:6px; flex-shrink:0; }
        .mode-row { display:flex; gap:3px; }
        .mbtn { padding:5px 14px; font-size:9px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; border-radius:2px; border:1px solid var(--bd); background:var(--bg2); color:var(--t3); cursor:pointer; transition:all 0.12s; font-family:'Inter',sans-serif; }
        .mbtn:hover { color:var(--t2); border-color:var(--bd2); }
        .mbtn.on { background:var(--g-chip); color:var(--green); border-color:var(--g-border); }
        .mode-hint { font-size:9px; color:var(--t3); letter-spacing:0.02em; }

        .overview-row { display:grid; grid-template-columns:260px 1fr; gap:14px; flex-shrink:0; align-items:start; }
        .ov-moments { display:flex; flex-direction:column; }
        .ov-moments .klist { max-height:none; flex:1; }
        .card { background:var(--bg2); border-radius:6px; overflow:hidden; border:1px solid var(--bd); }
        .chd { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--bd); background:var(--bg3); }
        .cttl { font-size:11px; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; color:var(--t1); }
        .csub { font-size:11px; font-weight:500; color:var(--t2); }

        .mom-body { padding:14px 16px; }
        .mom-leg { display:flex; gap:14px; margin-bottom:8px; }
        .mli { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:600; color:var(--t2); }
        .mld { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

        .klist { max-height:250px; overflow-y:auto; }
        .klist::-webkit-scrollbar { width:2px; }
        .klist::-webkit-scrollbar-thumb { background:var(--bg5); }
        .krow { padding:8px 14px; border-bottom:1px solid var(--bd); cursor:pointer; transition:background 0.12s; border-left:3px solid transparent; }
        .krow:hover { background:var(--bg3); }
        .krow.open { background:var(--bg3); }
        .ktop { display:flex; align-items:center; gap:8px; }
        .ktype-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .kmin { font-family:'Bebas Neue',sans-serif; font-size:22px; color:var(--t1); min-width:36px; line-height:1; }
        .kbadge { font-size:9px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; padding:3px 7px; border-radius:3px; white-space:nowrap; flex-shrink:0; }
        .kinfo { flex:1; min-width:0; }
        .kplayer { font-size:12px; font-weight:700; color:var(--t1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .kteam { font-size:10px; font-weight:500; color:var(--t3); margin-top:1px; }
        .karr { font-size:12px; color:var(--t3); flex-shrink:0; }
        .kexp { margin-top:8px; padding:10px 12px; background:var(--bg4); border-radius:6px; border-left:3px solid var(--green); }
        .kexp-lbl { font-size:9px; font-weight:800; letter-spacing:0.18em; text-transform:uppercase; color:var(--green); margin-bottom:5px; }
        .kexp-txt { font-size:12px; color:var(--t2); line-height:1.7; }

        .pc { background:var(--bg2); border-radius:6px; overflow:hidden; flex-shrink:0; border:1px solid var(--bd); }
        .pctrl { display:flex; align-items:center; gap:12px; padding:10px 14px; border-bottom:1px solid var(--bd); background:var(--bg3); }
        .pcl { font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--t3); }
        .pcs { flex:1; appearance:none; height:3px; background:var(--bg5); border-radius:2px; outline:none; cursor:pointer; }
        .pcs::-webkit-slider-thumb { appearance:none; width:13px; height:13px; background:var(--green); border-radius:50%; cursor:pointer; }
        .pcm { font-family:'Bebas Neue',sans-serif; font-size:24px; color:var(--green); min-width:44px; text-align:right; line-height:1; }
        .pcb { padding:9px 20px; background:var(--green); color:#000; font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; border:none; cursor:pointer; border-radius:4px; transition:background 0.12s; font-family:'Inter',sans-serif; white-space:nowrap; }
        .pcb:hover { background:var(--green2); }
        .pcb:disabled { background:var(--bg4); color:var(--t3); cursor:not-allowed; }
        .pfield { background:#020804; position:relative; height:360px; overflow:hidden; }
        .psvg { width:100%; height:100%; display:block; }
        .pload { position:absolute; inset:0; background:rgba(6,16,10,0.8); display:flex; align-items:center; justify-content:center; }
        .pltxt { font-family:'Bebas Neue',sans-serif; font-size:16px; letter-spacing:0.2em; color:var(--green); animation:pls 0.7s ease infinite; }
        @keyframes pls { 0%,100%{opacity:1} 50%{opacity:0.15} }
        .pempty { position:absolute; left:50%; bottom:12px; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:3px; pointer-events:none; }
        .petxt { font-size:9px; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; color:var(--t3); white-space:nowrap; }
        .pbot { display:flex; border-top:1px solid var(--bd); min-height:64px; }
        .pleg { display:flex; flex-direction:column; justify-content:center; gap:6px; padding:10px 14px; border-right:1px solid var(--bd); min-width:120px; }
        .plrow { display:flex; align-items:center; gap:7px; }
        .pldot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .plname { font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--t1); }
        .pnarr { flex:1; padding:10px 14px; display:flex; flex-direction:column; justify-content:center; border-left:3px solid var(--green); }
        .pnlbl { font-size:9px; font-weight:800; letter-spacing:0.18em; text-transform:uppercase; color:var(--green); margin-bottom:5px; }
        .pntxt { font-size:12px; color:var(--t2); line-height:1.65; }
        .pnodata { padding:10px 14px; font-size:10px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:var(--t3); border-top:1px solid var(--bd); }
        .ai-panel { border-top:1px solid var(--bd); background:var(--bg3); }
        .ai-panel-hd { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; border-bottom:1px solid var(--bd); }
        .ai-panel-lbl { display:flex; align-items:center; gap:8px; font-size:9px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:var(--t2); }
        .ai-ibm { background:#1D4ED8; color:#fff; font-size:7px; font-weight:900; letter-spacing:0.1em; padding:2px 6px; border-radius:2px; }
        .ai-conf { font-size:9px; font-weight:800; letter-spacing:0.08em; color:var(--green); background:var(--g-chip); border:1px solid var(--g-border); padding:2px 8px; border-radius:3px; }
        .ai-panel-body { padding:12px 14px; }
        .ai-panel-txt { font-size:12px; color:var(--t2); line-height:1.75; }
        .mom-insight { margin-top:10px; padding:8px 12px; background:var(--bg3); border:1px solid var(--bd); border-left:3px solid var(--green); border-radius:0 4px 4px 0; font-size:11px; color:var(--t2); line-height:1.6; }
        .why-btn { display:flex; align-items:center; gap:6px; padding:10px 16px; background:transparent; border:1px solid var(--bd2); border-radius:4px; color:#1E3A8A; font-size:12px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; cursor:pointer; font-family:'Inter',sans-serif; transition:all 0.12s; width:100%; justify-content:center; }
        .why-btn:hover { border-color:#1E3A8A; background:rgba(30,58,138,0.04); }
        .why-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .why-panel { border-top:1px solid var(--bd); background:var(--bg3); padding:14px; }
        .why-lbl { font-size:9px; font-weight:800; letter-spacing:0.18em; text-transform:uppercase; color:var(--green); margin-bottom:8px; display:flex; align-items:center; gap:6px; }
        .why-txt { font-size:13px; color:var(--t1); line-height:1.8; }
        .tooltip-wrap { position:relative; display:inline-flex; align-items:center; }
        .tooltip-icon { width:12px; height:12px; border-radius:50%; border:1px solid var(--t3); color:var(--t3); font-size:8px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; cursor:default; flex-shrink:0; margin-left:4px; }
        .tooltip-box { position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%); background:var(--bg4); border:1px solid var(--bd2); border-radius:4px; padding:6px 10px; font-size:10px; color:var(--t1); line-height:1.5; white-space:nowrap; pointer-events:none; opacity:0; transition:opacity 0.15s; z-index:50; min-width:160px; font-weight:400; text-transform:none; letter-spacing:0; }
        .tooltip-wrap:hover .tooltip-box { opacity:1; }
        @keyframes dotFadeIn { from{opacity:0} to{opacity:1} }

        .nomatch { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:0; position:relative; overflow:hidden; }
        .nmico { font-size:56px; opacity:0.75; margin:20px 0 14px; display:inline-block; animation:ballroll 2.4s ease-in-out infinite alternate; }
        .nmtxt { font-size:10px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; color:var(--t3); margin-top:14px; }
        @keyframes ballroll { 0%{transform:translateX(-36px) rotate(0deg)} 100%{transform:translateX(36px) rotate(360deg)} }

        /* SCOUT */
        .sp { max-width:840px; }
        .shdr { margin-bottom:22px; }
        .sey { font-size:10px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase; color:var(--green); margin-bottom:5px; }
        .sh1 { font-family:'Bebas Neue',sans-serif; font-size:48px; letter-spacing:0.06em; color:var(--t1); line-height:1; }
        .sp2 { font-size:13px; color:var(--t2); margin-top:7px; line-height:1.6; }
        .srow { display:flex; margin-bottom:22px; }
        .sinput { flex:1; background:var(--bg2); border:1px solid var(--bd2); border-right:none; padding:12px 16px; font-size:13px; font-weight:500; color:var(--t1); outline:none; font-family:'Inter',sans-serif; border-radius:6px 0 0 6px; transition:border-color 0.12s; }
        .sinput::placeholder { color:var(--t3); }
        .sinput:focus { border-color:var(--green); }
        .sbtn { padding:12px 24px; background:var(--green); color:#000; font-size:11px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; border:none; cursor:pointer; border-radius:0 6px 6px 0; transition:background 0.1s; font-family:'Inter',sans-serif; white-space:nowrap; }
        .sbtn:hover { background:var(--green2); }
        .sbtn:disabled { background:var(--bg5); color:var(--t3); cursor:not-allowed; }
        .sscan { text-align:center; padding:48px; font-family:'Bebas Neue',sans-serif; font-size:20px; letter-spacing:0.2em; color:var(--green); animation:pls 0.9s ease infinite; }
        .sres { display:flex; flex-direction:column; gap:10px; }
        .scard { background:var(--bg2); border:1px solid var(--bd); border-radius:4px; overflow:hidden; transition:border-color 0.12s; }
        .scard:hover { border-color:var(--bd2); }
        .sctop { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; padding:13px 16px; border-bottom:1px solid var(--bd); background:var(--bg); }
        .sname { font-family:'Bebas Neue',sans-serif; font-size:28px; letter-spacing:0.06em; color:var(--t1); line-height:1; }
        .smeta { display:flex; align-items:center; gap:8px; margin-top:4px; }
        .steam { font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:var(--green); }
        .scomp { font-size:10px; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; color:var(--t3); }
        .ssep { color:var(--t3); }
        .sstats { display:flex; gap:6px; flex-shrink:0; }
        .sstat { background:var(--bg3); border:1px solid var(--bd); border-radius:5px; padding:6px 10px; text-align:center; min-width:56px; }
        .ssv { font-family:'Bebas Neue',sans-serif; font-size:20px; color:var(--gold); line-height:1; }
        .ssl { font-size:8px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--t3); margin-top:3px; white-space:nowrap; }
        .scbody { padding:12px 16px; }
        .srlbl { font-size:9px; font-weight:800; letter-spacing:0.18em; text-transform:uppercase; color:var(--green); margin-bottom:7px; }
        .srtxt { font-size:13px; color:var(--t2); line-height:1.75; }

        /* FAN DECODER */
        .fd-page { max-width:720px; margin:0 auto; }
        .fd-langs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:18px; }
        .fd-lang { padding:5px 12px; border-radius:16px; border:1px solid var(--bd2); background:none; color:var(--t2); font-size:11px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; transition:all 0.12s; }
        .fd-lang:hover { border-color:var(--bd3); color:var(--t1); }
        .fd-lang.on { background:var(--green); color:#000; border-color:var(--green); }
        .fd-suggested { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:20px; }
        .fd-sug { padding:7px 14px; border-radius:6px; border:1px solid var(--bd2); background:var(--bg2); color:var(--t2); font-size:12px; font-weight:500; cursor:pointer; font-family:'Inter',sans-serif; transition:all 0.12s; }
        .fd-sug:hover { background:var(--bg3); color:var(--t1); border-color:var(--bd3); }
        .fd-chat { display:flex; flex-direction:column; gap:10px; margin-bottom:14px; max-height:420px; overflow-y:auto; padding-right:4px; }
        .fd-chat::-webkit-scrollbar { width:2px; }
        .fd-chat::-webkit-scrollbar-thumb { background:var(--bg5); }
        .fd-bubble-wrap-u { display:flex; justify-content:flex-end; }
        .fd-bubble-wrap-a { display:flex; justify-content:flex-start; }
        .fd-bubble-u { max-width:75%; padding:10px 14px; border-radius:8px; background:var(--green); color:#000; font-size:13px; line-height:1.65; font-weight:600; }
        .fd-bubble-a { max-width:80%; padding:10px 14px; border-radius:8px; background:var(--bg2); border:1px solid var(--bd); color:var(--t1); font-size:13px; line-height:1.65; }
        .fd-bubble-lbl { font-size:9px; font-weight:800; letter-spacing:0.18em; text-transform:uppercase; color:var(--green); margin-bottom:6px; }
        .fd-thinking { padding:10px 14px; border-radius:8px; background:var(--bg2); border:1px solid var(--bd); color:var(--t3); font-size:12px; display:inline-flex; align-items:center; gap:6px; }
        .fd-dot { width:5px; height:5px; border-radius:50%; background:var(--green); animation:fdot 1.2s ease infinite; }
        .fd-dot:nth-child(2) { animation-delay:0.2s; }
        .fd-dot:nth-child(3) { animation-delay:0.4s; }
        @keyframes fdot { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
        .fd-input-row { display:flex; gap:0; }
        .fd-input { flex:1; background:var(--bg2); border:1px solid var(--bd2); border-right:none; padding:12px 16px; font-size:13px; font-weight:500; color:var(--t1); outline:none; font-family:'Inter',sans-serif; border-radius:6px 0 0 6px; transition:border-color 0.12s; }
        .fd-input::placeholder { color:var(--t3); }
        .fd-input:focus { border-color:var(--green); }
        .fd-ask { padding:12px 24px; background:var(--green); color:#000; font-size:11px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; border:none; cursor:pointer; border-radius:0 6px 6px 0; transition:background 0.1s; font-family:'Inter',sans-serif; white-space:nowrap; }
        .fd-ask:hover { background:#34D399; }
        .fd-ask:disabled { background:var(--bg5); color:var(--t3); cursor:not-allowed; }

        /* TACTICS SUB-NAV */
        .tvnav { display:flex; gap:2px; flex-shrink:0; background:var(--bg); border:1px solid var(--bd); border-radius:3px; padding:4px; }
        .tvbtn { padding:8px 20px; border-radius:2px; border:none; background:none; color:var(--t3); font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; cursor:pointer; font-family:'Inter',sans-serif; transition:all 0.12s; white-space:nowrap; }
        .tvbtn:hover { color:var(--t2); }
        .tvbtn.on { background:var(--bg4); color:var(--t1); }

        /* VIZ CARDS */
        .viz-card { background:var(--bg2); border:1px solid var(--bd); border-radius:4px; overflow:hidden; flex-shrink:0; }
        .viz-hd { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; border-bottom:1px solid var(--bd); background:var(--bg); }
        .viz-ttl { font-size:9px; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; color:var(--t2); }
        .viz-sub { font-size:9px; color:var(--t3); }
        .viz-body { padding:12px 14px; }
        .viz-leg { display:flex; gap:16px; margin-top:10px; justify-content:center; flex-wrap:wrap; }
        .viz-li { display:flex; align-items:center; gap:5px; font-size:11px; color:var(--t2); }
        .viz-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .viz-bar { width:14px; height:3px; border-radius:2px; flex-shrink:0; }
        .viz-note { text-align:center; font-size:9px; color:var(--t3); margin-top:6px; letter-spacing:0.06em; }

        /* COMING */
        .coming { display:flex; flex-direction:column; align-items:center; justify-content:center; height:60vh; gap:8px; }
        .comingh { font-family:'Bebas Neue',sans-serif; font-size:52px; letter-spacing:0.1em; color:var(--bg5); }
        .comings { font-size:10px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; color:var(--t3); }

        /* INTRO ANIMATION */
        .intro { position:fixed; inset:0; z-index:1001; background:#000; display:flex; align-items:center; justify-content:center; transition:opacity 0.8s ease 0.2s; }
        .intro.out { opacity:0; pointer-events:none; }
        .intro-svg { position:absolute; inset:0; width:100%; height:100%; animation:hzoom 3.2s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes hzoom { 0%{transform:scale(0.22) translateY(-10%);opacity:0} 25%{opacity:1} 100%{transform:scale(2.1) translateY(6%);opacity:0} }
        .intro-txt { position:relative; z-index:1; text-align:center; animation:htxt 3.2s ease forwards; }
        @keyframes htxt { 0%{opacity:0;transform:translateY(12px)} 18%{opacity:1;transform:translateY(0)} 75%{opacity:1} 100%{opacity:0} }
        .intro-h { font-family:'Bebas Neue',sans-serif; font-size:clamp(56px,9vw,96px); letter-spacing:0.14em; color:var(--green); line-height:1; }
        .intro-s { font-size:15px; font-weight:600; letter-spacing:0.28em; text-transform:uppercase; color:#94A3B8; margin-top:14px; }

        /* ENTER ANIMATION */
        .enter-anim { position:fixed; inset:0; z-index:1000; background:#000; display:flex; align-items:center; justify-content:center; pointer-events:none; animation:eafade 1.6s ease forwards; }
        @keyframes eafade { 0%{opacity:1} 65%{opacity:1} 100%{opacity:0} }
        .enter-anim-svg { position:absolute; inset:0; width:100%; height:100%; animation:eazoom 1.6s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes eazoom { 0%{transform:scale(0.22) translateY(-10%);opacity:0} 20%{opacity:1} 100%{transform:scale(2.1) translateY(6%);opacity:0} }
        .enter-anim-txt { position:relative; z-index:1; text-align:center; animation:eatxt 1.6s ease forwards; }
        @keyframes eatxt { 0%{opacity:0;transform:translateY(12px)} 18%{opacity:1;transform:translateY(0)} 75%{opacity:1} 100%{opacity:0} }
        .enter-anim-h { font-family:'Bebas Neue',sans-serif; font-size:clamp(56px,9vw,96px); letter-spacing:0.14em; color:var(--green); line-height:1; }
        .enter-anim-s { font-size:15px; font-weight:600; letter-spacing:0.28em; text-transform:uppercase; color:#94A3B8; margin-top:14px; }
      `}</style>

      {/* INTRO ANIMATION — auto-plays on load */}
      <div className={`intro${introPlayed?' out':''}`}>
        <svg className="intro-svg" viewBox="0 0 1000 680" preserveAspectRatio="xMidYMid slice">
          <rect width="1000" height="680" fill="#04070A"/>
          {Array.from({length:13},(_,i)=>(
            <rect key={i} x="115" y={90+i*40} width="770" height="40" fill={i%2===0?'#0D2810':'#0A1C0D'}/>
          ))}
          <rect x="115" y="90" width="770" height="510" fill="none" stroke="#1E6830" strokeWidth="2"/>
          <line x1="500" y1="92" x2="500" y2="598" stroke="#1E6830" strokeWidth="2"/>
          <circle cx="500" cy="345" r="85" fill="none" stroke="#1E6830" strokeWidth="2"/>
          <circle cx="500" cy="345" r="5" fill="#1E6830"/>
          <rect x="115" y="205" width="145" height="280" fill="none" stroke="#1E6830" strokeWidth="2"/>
          <rect x="740" y="205" width="145" height="280" fill="none" stroke="#1E6830" strokeWidth="2"/>
          <rect x="115" y="275" width="52" height="140" fill="none" stroke="#1E6830" strokeWidth="1.5"/>
          <rect x="833" y="275" width="52" height="140" fill="none" stroke="#1E6830" strokeWidth="1.5"/>
          <rect x="88" y="308" width="27" height="76" fill="#091A0C" stroke="#1E6830" strokeWidth="1.5"/>
          <rect x="885" y="308" width="27" height="76" fill="#091A0C" stroke="#1E6830" strokeWidth="1.5"/>
          {([[150,100],[850,100],[150,590],[850,590]] as [number,number][]).map(([x,y],i)=>(
            <g key={i}>
              <rect x={x-3} y={y-20} width="6" height="20" fill="#666"/>
              <rect x={x-14} y={y-26} width="28" height="7" fill="#999" rx="2"/>
              <ellipse cx={x} cy={y-20} rx="24" ry="8" fill="#FFFBF0" opacity="0.6"/>
              <ellipse cx={x} cy={y-20} rx="50" ry="18" fill="#FFFBF0" opacity="0.06"/>
            </g>
          ))}
        </svg>
        <div className="intro-txt">
          <div className="intro-h">PITCH INTEL</div>
          <div className="intro-s">World Cup AI Command Center</div>
        </div>
      </div>

      {/* LANDING PAGE */}
      <div className={`hero${heroAnimDone?' out':''}`}>
        {/* ── Full-page field background — fixed, rotated 90° to portrait ── */}
        <div style={{position:'fixed',inset:0,zIndex:0,overflow:'hidden',pointerEvents:'none'}}>
          <div style={{position:'absolute',top:'50%',left:'50%',width:'120vh',height:'120vw',backgroundImage:"url('https://images.unsplash.com/photo-1595169043775-1612bf911b0f?w=1600&q=90&auto=format&fit=crop')",backgroundSize:'cover',backgroundPosition:'center',transform:'translate(-50%,-50%) rotate(90deg)'}}/>
          {/* Dark overlay — keeps text legible over bright green field */}
          <div style={{position:'absolute',inset:0,background:'rgba(10,30,10,0.35)'}}/>
        </div>
        <svg className="hero-svg" viewBox="0 0 1000 680" preserveAspectRatio="xMidYMid slice">
          {Array.from({length:14},(_,i)=>(
            <rect key={i} x="100" y={80+i*38} width="800" height="38" fill={i%2===0?'rgba(22,80,22,0.06)':'rgba(22,80,22,0.03)'}/>
          ))}
          <rect x="100" y="80" width="800" height="532" fill="none" stroke="rgba(22,101,52,0.22)" strokeWidth="1.5"/>
          <line x1="500" y1="82" x2="500" y2="610" stroke="rgba(22,101,52,0.22)" strokeWidth="1.5"/>
          <circle cx="500" cy="346" r="90" fill="none" stroke="rgba(22,101,52,0.22)" strokeWidth="1.5"/>
          <circle cx="500" cy="346" r="5" fill="rgba(22,101,52,0.3)"/>
          <rect x="100" y="200" width="150" height="292" fill="none" stroke="rgba(22,101,52,0.22)" strokeWidth="1.5"/>
          <rect x="750" y="200" width="150" height="292" fill="none" stroke="rgba(22,101,52,0.22)" strokeWidth="1.5"/>
          <rect x="100" y="272" width="55" height="148" fill="none" stroke="rgba(22,101,52,0.16)" strokeWidth="1"/>
          <rect x="845" y="272" width="55" height="148" fill="none" stroke="rgba(22,101,52,0.16)" strokeWidth="1"/>
          <ellipse cx="100" cy="346" rx="70" ry="70" fill="none" stroke="rgba(22,101,52,0.16)" strokeWidth="1" clipPath="url(#lclip)"/>
          <ellipse cx="900" cy="346" rx="70" ry="70" fill="none" stroke="rgba(22,101,52,0.16)" strokeWidth="1" clipPath="url(#rclip)"/>
          <defs>
            <clipPath id="lclip"><rect x="100" y="276" width="70" height="140"/></clipPath>
            <clipPath id="rclip"><rect x="830" y="276" width="70" height="140"/></clipPath>
          </defs>
        </svg>

        <div className="lp-wrap">
          {/* Hero */}
          <div className="lp-hero">
            <h1 className="lp-title">PITCH <span className="lp-title-accent">INTEL</span></h1>
            <p className="lp-sub">11 IBM Granite modules. 128 World Cup matches. Real StatsBomb data — VAR decisions, tactics, scouting, live commentary, and more.</p>
            <div className="lp-diff">
              {([
                {n:'128', l1:'WC Matches', l2:'2018 + 2022 · StatsBomb', c:'#00D46A'},
                {n:'4',   l1:'IBM Tech Stack', l2:'Granite · watsonx · Docling · MCP', c:'#F97316'},
                {n:'6K+', l1:'Players Indexed', l2:'FAISS semantic search', c:'#06B6D4'},
                {n:'9',   l1:'Languages', l2:'Fan Decoder chatbot', c:'#EC4899'},
              ] as {n:string;l1:string;l2:string;c:string}[]).map(({n,l1,l2,c})=>(
                <div key={l1} className="lp-diff-item" style={{borderLeftColor:c,borderLeftWidth:3}}>
                  <div className="lp-diff-n" style={{color:c}}>{n}</div>
                  <div className="lp-diff-l">
                    <div style={{color:'var(--t1)',fontWeight:700,fontSize:11}}>{l1}</div>
                    <div>{l2}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-grid">
            {/* Header card — first cell */}
            <div className="lp-card" style={{borderLeftColor:'var(--green)',background:'rgba(3,18,3,0.82)',justifyContent:'center',alignItems:'center',gap:10,textAlign:'center'}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:40,letterSpacing:'0.06em',color:'#FFFFFF',lineHeight:1.05}}>11 WORKING<br/>MODULES</div>
              <div style={{fontSize:13,fontWeight:900,letterSpacing:'0.22em',textTransform:'uppercase',color:'#4ADE80',marginTop:8}}>IBM GRANITE<br/>POWERS ALL</div>
            </div>
            {([
              {name:'VAR Oracle',     desc:'An explainable VAR companion — not a referee replacement. YOLOv8 reads the footage · IBM Docling RAG retrieves the exact FIFA law · IBM Granite explains why the decision aligns with the laws, with the retrieved clause visible',tag:'YOLOv8 · Docling RAG · Granite', c:'#F97316'},
              {name:'Tactical Lens',   desc:'xG flow, shot maps, pass networks, auto-detected formations, penalty analysis, and match verdict from StatsBomb event data', tag:'StatsBomb Events',   c:'#3B7CF6'},
              {name:'Pitch Agent',    desc:'IBM Granite agent with 6 real StatsBomb tools (also exposed over MCP) — full reasoning chain visible, What-If counterfactuals grounded in real data', tag:'Tool Use · MCP', c:'#00D46A'},
              {name:'Scout Eye',      desc:'Natural-language search across 6,000+ WC players — FAISS embeddings, AI scouting reports',    tag:'FAISS · Semantic',   c:'#06B6D4'},
              {name:'Referee Lens',   desc:'Foul symmetry index + home bias metric across all 128 matches — AI consistency verdict per referee', tag:'128 Match Analysis', c:'#F59E0B'},
              {name:'Match Explainer',desc:'Pre/post briefings grounded in real StatsBomb stats — Beginner, Fan, and Coach modes',        tag:'3 Audience Modes',   c:'#8B5CF6'},
              {name:'EmotiPulse',     desc:'Per-minute atmosphere scoring via event formula with pulse SVG + broadcast AI report',         tag:'Minute-by-Minute',   c:'#EF4444'},
              {name:'Fan Decoder',    desc:'Football AI chatbot in 21 languages with full World Cup context and conversation history — voice in, audio out',      tag:'21 Languages · Voice',        c:'#EC4899'},
              {name:'Debate',         desc:'Two opposing IBM Granite agents argue the same match data — Advocate vs Skeptic — then a neutral Granite consensus verdict', tag:'Multi-Agent',        c:'#2DD4BF'},
              {name:'Alter Ego',      desc:'Understand how much a single goal shaped a past result — remove it and re-run 10,000 xG Monte Carlo sims to see the computed shift, with IBM Granite explaining it. Explainability, not prediction', tag:'Monte Carlo · xG',   c:'#A855F7'},
              {name:'Dugout Brief',   desc:'Accessibility-first: IBM Granite turns a match into a spoken audio description for blind / low-vision fans, doubling as live captions for deaf fans — in 21 languages. Understand the match without seeing, hearing, or speaking its language', tag:'Accessibility · Voice · 21 Languages', c:'#22D3EE'},
            ] as {name:string;desc:string;tag:string;c:string}[]).map((m,i)=>(
              <div key={m.name} className="lp-card" style={{borderLeftColor:m.c}}>
                <div className="lp-card-top">
                  <span className="lp-card-num">{String(i+1).padStart(2,'0')}</span>
                </div>
                <div className="lp-card-name" style={{color:m.c}}>{m.name}</div>
                <div className="lp-card-desc">{m.desc}</div>
                <span className="lp-card-tag" style={{color:m.c,borderColor:`${m.c}33`,background:`${m.c}10`}}>{m.tag}</span>
              </div>
            ))}
          </div>{/* end lp-grid */}

          {/* CTA */}
          <button className="lp-enter" onClick={handleEnter}>
            Enter Command Center →
          </button>

          {/* Footer */}
          <div className="lp-footer">
            IBM Granite (watsonx.ai) · IBM Docling · IBM Context Forge (MCP) · StatsBomb Open Data · YOLOv8 (Ultralytics) · FAISS (Meta AI) · sentence-transformers
          </div>
        </div>
      </div>

      {/* ENTER ANIMATION OVERLAY */}
      {entering && (
        <div className="enter-anim">
          <svg className="enter-anim-svg" viewBox="0 0 1000 680" preserveAspectRatio="xMidYMid slice">
            <rect width="1000" height="680" fill="#04070A"/>
            {Array.from({length:13},(_,i)=>(
              <rect key={i} x="115" y={90+i*40} width="770" height="40" fill={i%2===0?'#0D2810':'#0A1C0D'}/>
            ))}
            <rect x="115" y="90" width="770" height="510" fill="none" stroke="#1E6830" strokeWidth="2"/>
            <line x1="500" y1="92" x2="500" y2="598" stroke="#1E6830" strokeWidth="2"/>
            <circle cx="500" cy="345" r="85" fill="none" stroke="#1E6830" strokeWidth="2"/>
            <circle cx="500" cy="345" r="5" fill="#1E6830"/>
            <rect x="115" y="205" width="145" height="280" fill="none" stroke="#1E6830" strokeWidth="2"/>
            <rect x="740" y="205" width="145" height="280" fill="none" stroke="#1E6830" strokeWidth="2"/>
            <rect x="115" y="275" width="52" height="140" fill="none" stroke="#1E6830" strokeWidth="1.5"/>
            <rect x="833" y="275" width="52" height="140" fill="none" stroke="#1E6830" strokeWidth="1.5"/>
            {([[150,100],[850,100],[150,590],[850,590]] as [number,number][]).map(([x,y],i)=>(
              <g key={i}>
                <rect x={x-3} y={y-20} width="6" height="20" fill="#666"/>
                <rect x={x-14} y={y-26} width="28" height="7" fill="#999" rx="2"/>
                <ellipse cx={x} cy={y-20} rx="24" ry="8" fill="#FFFBF0" opacity="0.6"/>
                <ellipse cx={x} cy={y-20} rx="50" ry="18" fill="#FFFBF0" opacity="0.06"/>
              </g>
            ))}
          </svg>
          <div className="enter-anim-txt">
            <div className="enter-anim-h">PITCH INTEL</div>
            <div className="enter-anim-s">Entering Command Center</div>
          </div>
        </div>
      )}

      {/* APP */}
      <div className={`app${heroAnimDone?' in':''}`}>
        <div className="topbar">
          {/* Back to landing page */}
          <button onClick={handleBack} title="Back to home" style={{background:'none',border:'none',cursor:'pointer',color:'#4A7098',padding:'0 18px 0 0',display:'flex',alignItems:'center',height:'100%',borderRight:'1px solid #1A2E44',marginRight:18,flexShrink:0,transition:'color 0.12s'}} onMouseEnter={e=>(e.currentTarget.style.color='#E2E8F0')} onMouseLeave={e=>(e.currentTarget.style.color='#4A7098')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 5L8 10L13 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="wm">
            <svg className="wm-icon" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="1" y="4" width="20" height="14" rx="1.5" stroke="#166534" strokeWidth="1.3"/>
              <line x1="11" y1="4" x2="11" y2="18" stroke="#166534" strokeWidth="0.9" opacity="0.55"/>
              <circle cx="11" cy="11" r="3.5" stroke="#166534" strokeWidth="0.9" opacity="0.55"/>
              <line x1="1" y1="7.5" x2="21" y2="7.5" stroke="#166534" strokeWidth="0.6" opacity="0.25"/>
              <line x1="1" y1="14.5" x2="21" y2="14.5" stroke="#166534" strokeWidth="0.6" opacity="0.25"/>
            </svg>
            <div className="wm-text">
              <div className="wm-mark">PITCH <b>INTEL</b></div>
              <div className="wm-sub">Powered by IBM Granite</div>
            </div>
          </div>
          <div className="nav">
            {modules.map((m)=>(
              <button key={m} className={`nbtn${activeModule===m?' on':''}`} onClick={()=>setActiveModule(m)}>
                {m}
              </button>
            ))}
          </div>
          <div className="topbar-r" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LanguageSelector />
          </div>
        </div>

        <LiveScores parch={true} />

        <div className="content">

          {/* TACTICAL LENS */}
          {activeModule==='Tactical Lens' && (
            <div className="tac">
              <div className="fpanel">
                <div className="phd">
                  <span className="pttl">Fixtures</span>
                  <span className="pct">{matches.length}</span>
                </div>
                <div className="flist">
                  {matches.map(m=>(
                    <div key={m.match_id} className={`frow${selectedMatch?.match_id===m.match_id?' sel':''}`} onClick={()=>loadMatch(m)}>
                      <div className="frow-info">
                        <div className="fn"><span style={{color:TEAM_COLORS[m.home_team]||'var(--t1)'}}>{m.home_team}</span><span className="fvs">vs</span><span style={{color:TEAM_COLORS[m.away_team]||'var(--t1)'}}>{m.away_team}</span></div>
                        <div className="fd">{m.match_date}</div>
                      </div>
                      {m.home_score !== undefined && (
                        <div className="fsc">{m.home_score}–{m.away_score}</div>
                      )}
                      <span className="farr">›</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mv">
                {!selectedMatch ? (
                  <div className="nomatch">
                    <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}} viewBox="0 0 600 500" preserveAspectRatio="xMidYMid slice" fill="none">
                      <rect x="60" y="40" width="480" height="420" rx="4" stroke="#3B7CF6" strokeWidth="3" opacity="0.14"/>
                      <line x1="300" y1="40" x2="300" y2="460" stroke="#3B7CF6" strokeWidth="2" opacity="0.10"/>
                      <circle cx="300" cy="250" r="70" stroke="#3B7CF6" strokeWidth="2.5" opacity="0.12"/>
                      <circle cx="300" cy="250" r="5" fill="#3B7CF6" opacity="0.18"/>
                      <rect x="60" y="155" width="110" height="190" stroke="#3B7CF6" strokeWidth="2" opacity="0.10"/>
                      <rect x="430" y="155" width="110" height="190" stroke="#3B7CF6" strokeWidth="2" opacity="0.10"/>
                      <rect x="60" y="205" width="40" height="90" stroke="#3B7CF6" strokeWidth="2" opacity="0.14"/>
                      <rect x="500" y="205" width="40" height="90" stroke="#3B7CF6" strokeWidth="2" opacity="0.14"/>
                      <circle cx="150" cy="250" r="4" fill="#3B7CF6" opacity="0.16"/>
                      <circle cx="450" cy="250" r="4" fill="#3B7CF6" opacity="0.16"/>
                      <line x1="60" y1="40" x2="540" y2="460" stroke="#3B7CF6" strokeWidth="1" strokeDasharray="6 8" opacity="0.06"/>
                      <line x1="540" y1="40" x2="60" y2="460" stroke="#3B7CF6" strokeWidth="1" strokeDasharray="6 8" opacity="0.06"/>
                    </svg>
                    <div style={{fontSize:10,fontWeight:800,letterSpacing:'0.3em',textTransform:'uppercase',color:'#3B7CF6',opacity:0.8}}>MODULE 02 · MATCH ANALYTICS</div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:76,letterSpacing:'0.05em',lineHeight:0.88,color:'var(--t1)',textAlign:'center',marginTop:10}}>
                      TACTICAL
                    </div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:76,letterSpacing:'0.12em',lineHeight:0.88,color:'#3B7CF6',textAlign:'center',borderBottom:'3px solid #3B7CF6',paddingBottom:6,marginBottom:4}}>
                      LENS
                    </div>
                    <div className="nmico">⚽</div>
                    <div className="nmtxt">Select a fixture to begin</div>
                  </div>
                ) : (
                  <>
                    <div className="sb">
                      <div className="sb-main">
                        <div className="sb-team">
                          <div className="sb-name" style={{color:getColor(selectedMatch.home_team,0)}}>{selectedMatch.home_team}</div>
                          <div className="sb-role">Home</div>
                        </div>
                        <div className="sb-ctr">
                          <div className="sb-badge">FIFA World Cup · Full Time</div>
                          <div className="sb-score">
                            <span style={{color:getColor(selectedMatch.home_team,0)}}>{selectedMatch.home_score??'—'}</span>
                            <span className="sb-sep">:</span>
                            <span style={{color:getColor(selectedMatch.away_team,1)}}>{selectedMatch.away_score??'—'}</span>
                          </div>
                          <div className="sb-date">{selectedMatch.match_date}</div>
                        </div>
                        <div className="sb-team">
                          <div className="sb-name" style={{color:getColor(selectedMatch.away_team,1)}}>{selectedMatch.away_team}</div>
                          <div className="sb-role">Away</div>
                        </div>
                      </div>
                      {xgFlow.length > 0 && (() => {
                        const homeXg=xgFlow.filter(s=>s.team===selectedMatch.home_team).reduce((a,s)=>a+s.xg,0)
                        const awayXg=xgFlow.filter(s=>s.team===selectedMatch.away_team).reduce((a,s)=>a+s.xg,0)
                        const homeMom=momentum.filter(m=>m.team===selectedMatch.home_team).reduce((a,m)=>a+m.score,0)
                        const awayMom=momentum.filter(m=>m.team===selectedMatch.away_team).reduce((a,m)=>a+m.score,0)
                        const total=homeMom+awayMom||1
                        const homePct=Math.round(homeMom/total*100)
                        return (
                          <div className="sb-bottom">
                            <div className="sb-bstat">
                              <div className="sb-bstat-lbl">
                                <span className="tooltip-wrap">xG<span className="tooltip-icon">?</span><span className="tooltip-box">Expected Goals — probability each shot becomes a goal based on position, angle, and shot type. Better than raw shots at measuring real chances.</span></span>
                              </div>
                              <div className="sb-bstat-val">
                                <span style={{color:getColor(selectedMatch.home_team,0)}}>{homeXg.toFixed(2)}</span>
                                <span className="sb-bstat-sep">—</span>
                                <span style={{color:getColor(selectedMatch.away_team,1)}}>{awayXg.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="sb-bstat">
                              <div className="sb-bstat-lbl">Possession</div>
                              <div className="sb-bstat-val">
                                <span style={{color:getColor(selectedMatch.home_team,0)}}>{homePct}%</span>
                                <span className="sb-bstat-sep">—</span>
                                <span style={{color:getColor(selectedMatch.away_team,1)}}>{100-homePct}%</span>
                              </div>
                            </div>
                            <div className="sb-bstat">
                              <div className="sb-bstat-lbl">Shots</div>
                              <div className="sb-bstat-val">
                                <span style={{color:getColor(selectedMatch.home_team,0)}}>{shotMap.filter(s=>s.team===selectedMatch.home_team).length}</span>
                                <span className="sb-bstat-sep">—</span>
                                <span style={{color:getColor(selectedMatch.away_team,1)}}>{shotMap.filter(s=>s.team===selectedMatch.away_team).length}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Why did this match end this way? */}
                    <div className="card" style={{flexShrink:0}}>
                      {/* Card header — always visible, holds mode selector so association is clear */}
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bg3)'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span className="ai-ibm" style={{fontSize:9,padding:'3px 8px'}}>IBM</span>
                          <span style={{fontSize:11,fontWeight:800,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--t1)'}}>Granite · Match Verdict</span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:11,fontWeight:700,color:'var(--t2)',letterSpacing:'0.04em'}}>Explanation depth:</span>
                          <div className="mode-row" style={{gap:4}}>
                            {(['beginner','fan','coach'] as const).map(m=>(
                              <button key={m} className={`mbtn${mode===m?' on':''}`} onClick={()=>setMode(m)} style={{fontSize:10,padding:'6px 16px'}}>
                                {m==='beginner'?'Beginner':m==='fan'?'Fan':'Coach'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      {!whyVerdict && (
                        <div style={{padding:'10px 14px'}}>
                          <button className="why-btn" disabled={whyLoading} onClick={loadVerdict}>
                            {whyLoading ? 'IBM Granite analysing…' : 'Why did this match end this way?'}
                          </button>
                          <div className="mode-hint" style={{textAlign:'center',marginTop:6}}>
                            {mode==='beginner'?'Plain language explanations':mode==='fan'?'Football vocabulary & context':'Tactical depth & analysis'}
                          </div>
                        </div>
                      )}
                      {whyVerdict && (
                        <div className="why-panel">
                          <div className="why-txt">{whyVerdict}</div>
                          <div style={{padding:'8px 0 0'}}>
                            <SpeakButton text={whyVerdict} />
                          </div>
                          <div style={{paddingTop:4}}>
                            <Limitations items={whyLimitations} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{display:'flex',justifyContent:'center',flexShrink:0,marginTop:10}}>
                      <div className="tvnav">
                        {([['overview','Overview'],['xg','xG Flow'],['shots','Shot Map'],['passes','Pass Network'],['penalties','Penalties']] as const).map(([v,lbl])=>(
                          <button key={v} className={`tvbtn${tacticsView===v?' on':''}`} onClick={()=>setTacticsView(v)}>{lbl}</button>
                        ))}
                      </div>
                    </div>

                    {tacticsView==='overview' && (<>
                      {/* Momentum — full width */}
                      <div className="card">
                        <div className="chd">
                          <span className="cttl">Momentum</span>
                          <span className="csub">Pressure & possession flow · 90 minutes</span>
                        </div>
                        <div className="mom-body">
                          {momentum.length > 0 ? (
                            <>
                              <div className="mom-leg">
                                {teams.map((t,i)=>(
                                  <div key={t} className="mli">
                                    <div className="mld" style={{background:getColor(t,i)}}/>
                                    {t}
                                  </div>
                                ))}
                              </div>
                              <svg viewBox={`0 0 ${Math.max(minutes.length*14,1)} 160`} preserveAspectRatio="none" style={{width:'100%',height:160,display:'block'}}>
                                <defs>
                                  {teams.map((team,ti)=>(
                                    <linearGradient key={team} id={`mg${ti}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor={getColor(team,ti)} stopOpacity="0.25"/>
                                      <stop offset="100%" stopColor={getColor(team,ti)} stopOpacity="0"/>
                                    </linearGradient>
                                  ))}
                                </defs>
                                {teams.map((team,ti)=>{
                                  const color=getColor(team,ti)
                                  const pts=minutes.map((min,xi)=>{
                                    const pt=momentum.find(p=>p.minute===min&&p.team===team)
                                    const y=pt?150-(pt.score/maxMomentum)*135:150
                                    return `${xi*14+7},${y}`
                                  })
                                  const ptsStr=pts.join(' ')
                                  const w=Math.max(minutes.length*14,1)
                                  const areaPath=`M 7,150 ${pts.map(p=>p).join(' ')} L ${w-7},150 Z`
                                  return (
                                    <g key={team}>
                                      <path d={areaPath} fill={`url(#mg${ti})`}/>
                                      <polyline points={ptsStr} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" opacity="0.9"/>
                                      {moments.filter(m=>m.type==='Goal'&&m.team===team).map((m,gi)=>{
                                        const xi=minutes.findIndex(min=>Math.abs(min-m.minute)<=2)
                                        if(xi<0) return null
                                        const pt=momentum.find(p=>p.minute===minutes[xi]&&p.team===team)
                                        const y=pt?150-(pt.score/maxMomentum)*135:150
                                        return <g key={gi}><circle cx={xi*14+7} cy={y} r="5" fill={color} stroke="var(--bg)" strokeWidth="1.5"/><circle cx={xi*14+7} cy={y} r="9" fill={color} opacity="0.15"/></g>
                                      })}
                                    </g>
                                  )
                                })}
                                <line x1="0" y1="150" x2={Math.max(minutes.length*14,1)} y2="150" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                                {[0,45,90].map(target=>{
                                  const xi=minutes.findIndex(m=>m>=target)
                                  if(xi<0) return null
                                  return <g key={target}><line x1={xi*14+7} y1="0" x2={xi*14+7} y2="150" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 3"/><text x={xi*14+7} y={158} textAnchor="middle" fill="#3D4E68" fontSize="7" fontFamily="Inter">{target}&apos;</text></g>
                                })}
                              </svg>
                              {(() => {
                                if (!selectedMatch || teams.length < 2) return null
                                const half = (t: string, lo: number, hi: number) =>
                                  momentum.filter(p=>p.team===t&&p.minute>=lo&&p.minute<=hi).reduce((a,p)=>a+p.score,0)
                                const [t0,t1]=teams
                                const h0f=half(t0,0,45),h0s=half(t0,46,90)
                                const h1f=half(t1,0,45),h1s=half(t1,46,90)
                                const fhw=h0f>h1f?t0:h1f>h0f?t1:null
                                const shw=h0s>h1s?t0:h1s>h0s?t1:null
                                if (fhw&&shw&&fhw!==shw)
                                  return <div className="mom-insight">Momentum shift: {fhw} controlled the first half — {shw} took over after the break</div>
                                const ow=(h0f+h0s)>(h1f+h1s)?t0:t1
                                return <div className="mom-insight">{ow} maintained the higher pressure index across 90 minutes</div>
                              })()}
                            </>
                          ) : (
                            <div style={{padding:'28px 0',textAlign:'center',fontSize:'11px',color:'var(--t3)'}}>Loading momentum...</div>
                          )}
                        </div>
                      </div>

                      {/* Key moments sidebar + Pitch — broken grid */}
                      <div className="overview-row">
                        <div className="card ov-moments">
                          <div className="chd">
                            <span className="cttl">Key Moments</span>
                            <span className="csub">{keyMoments.length} events</span>
                          </div>
                          <div className="klist">
                            {keyMoments.length > 0 ? keyMoments.map((m,i)=>{
                              const cfg=TYPE_CONFIG[m.type]||{color:'#888',bg:'rgba(136,136,136,0.12)',label:m.type}
                              const isOpen=expandedMoment===i
                              return (
                                <div key={i} className={`krow${isOpen?' open':''}`} onClick={()=>setExpandedMoment(isOpen?null:i)} style={{borderLeftColor:cfg.color}}>
                                  <div className="ktop">
                                    <div className="ktype-dot" style={{background:cfg.color,boxShadow:`0 0 5px ${cfg.color}55`}}/>
                                    <div className="kmin">{m.minute}&apos;</div>
                                    <div className="kbadge" style={{color:cfg.color,background:cfg.bg}}>{cfg.label}</div>
                                    <div className="kinfo">
                                      <div className="kplayer">{m.player||m.team}</div>
                                      <div className="kteam">{m.team}</div>
                                    </div>
                                    <div className="karr">{isOpen?'↑':'↓'}</div>
                                  </div>
                                  {isOpen&&(
                                    <div className="kexp">
                                      <div className="kexp-lbl">IBM Granite · {mode} mode</div>
                                      <div className="kexp-txt">{getModeExplanation(m)}</div>
                                    </div>
                                  )}
                                </div>
                              )
                            }) : (
                              <div style={{padding:'16px',textAlign:'center',fontSize:'11px',color:'var(--t3)'}}>Loading events...</div>
                            )}
                          </div>
                        </div>

                        <div className="pc">
                      <div className="chd">
                        <div>
                          <span className="cttl">Player Positioning</span>
                          <div style={{fontSize:12,fontWeight:600,color:'var(--t1)',marginTop:2,letterSpacing:'0.02em'}}>StatsBomb tracking · XY coordinates · 22 players</div>
                        </div>
                        <span className="csub">Select minute · analyse shape</span>
                      </div>
                      <div style={{display:'flex',gap:0,border:'1px solid var(--bd)',borderRadius:5,overflow:'hidden',alignSelf:'center',marginLeft:'auto',marginRight:0}}>
                        {(['2d','3d'] as const).map(v=>(
                          <button key={v} onClick={()=>setPitchView(v)} style={{padding:'5px 12px',background:pitchView===v?'var(--green)':'var(--bg2)',color:pitchView===v?'#000':'var(--t3)',border:'none',cursor:'pointer',fontSize:10,fontWeight:800,letterSpacing:'0.08em',fontFamily:'Inter,sans-serif',textTransform:'uppercase'}}>
                            {v}
                          </button>
                        ))}
                      </div>
                      <div className="pctrl">
                        <span className="pcl">Minute</span>
                        <div style={{flex:1,display:'flex',flexDirection:'column',gap:3}}>
                          <div style={{position:'relative',height:10,paddingLeft:0}}>
                            {keyMoments.map((km,ki)=>{
                              const cfg2=TYPE_CONFIG[km.type]||{color:'#888'}
                              const pct=((km.minute-1)/89)*100
                              return <div key={ki} title={`${km.minute}' — ${km.type}`} style={{position:'absolute',left:`${pct}%`,top:1,width:3,height:8,background:cfg2.color,borderRadius:1,transform:'translateX(-50%)',opacity:0.9}}/>
                            })}
                          </div>
                          <input type="range" min={1} max={90} value={minute} onChange={e=>setMinute(+e.target.value)} className="pcs"/>
                        </div>
                        <span className="pcm">{minute}&apos;</span>
                        <button className="pcb" disabled={loading} onClick={()=>loadTactical(selectedMatch.match_id,minute)}>
                          {loading?'Reading…':'⚽  Analyse Shape'}
                        </button>
                      </div>
                      <div className="pfield">
                        {pitchView==='3d' && heatmapData ? (
                          <ThreePitch
                            positions={heatmapData.teams as any}
                            teamColors={['#3B7CF6','#F87171']}
                            height={380}
                            minute={heatmapData.minute}
                            ballPosition={heatmapData.ball_position}
                          />
                        ) : (
                        <>
                        <svg className="psvg" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid meet">
                          {Array.from({length:10},(_,i)=>(
                            <rect key={i} x={0} y={i*8} width={120} height={8} fill={i%2===0?'#071408':'#050F06'}/>
                          ))}
                          <rect x="2" y="2" width="116" height="76" fill="none" stroke="#2A7A2A" strokeWidth="0.6"/>
                          <line x1="60" y1="2" x2="60" y2="78" stroke="#2A7A2A" strokeWidth="0.6"/>
                          <circle cx="60" cy="40" r="9.15" fill="none" stroke="#2A7A2A" strokeWidth="0.6"/>
                          <circle cx="60" cy="40" r="1" fill="#2A7A2A"/>
                          <rect x="2" y="22.3" width="16.5" height="35.4" fill="none" stroke="#2A7A2A" strokeWidth="0.6"/>
                          <rect x="101.5" y="22.3" width="16.5" height="35.4" fill="none" stroke="#2A7A2A" strokeWidth="0.6"/>
                          <rect x="2" y="30.5" width="5.5" height="19" fill="none" stroke="#2A7A2A" strokeWidth="0.4"/>
                          <rect x="112.5" y="30.5" width="5.5" height="19" fill="none" stroke="#2A7A2A" strokeWidth="0.4"/>
                          <rect x="0" y="34" width="2" height="12" fill="none" stroke="#336633" strokeWidth="0.6"/>
                          <rect x="118" y="34" width="2" height="12" fill="none" stroke="#336633" strokeWidth="0.6"/>
                          {heatmapData&&Object.entries(heatmapData.teams).map(([team,players],ti)=>
                            players.map((p,i)=>(
                              <g key={`${team}-${i}`} style={{animation:'dotFadeIn 0.25s ease both',animationDelay:`${i*15}ms`}}>
                                <circle cx={p.x} cy={p.y} r="3" fill={getColor(team,ti)}/>
                                <circle cx={p.x} cy={p.y} r="3" fill="none" stroke="rgba(0,0,0,0.7)" strokeWidth="0.8"/>
                              </g>
                            ))
                          )}
                          {!heatmapData&&!loading&&([
                            [10,20],[10,40],[10,60],[22,12],[22,32],[22,48],[22,68],[35,25],[35,40],[35,55],[58,40],
                            [110,20],[110,40],[110,60],[98,12],[98,32],[98,48],[98,68],[85,25],[85,40],[85,55]
                          ] as [number,number][]).map(([x,y],gi)=>(
                            <circle key={gi} cx={x} cy={y} r="2.5" fill={gi<11?'#22C55E':'#FACC15'} opacity="0.18"/>
                          ))}
                        </svg>
                        {loading&&<div className="pload"><div className="pltxt">Analysing...</div></div>}
                        {!heatmapData&&!loading&&(
                          <div className="pempty">
                            <div className="petxt">Select minute · Analyse Shape</div>
                            <div style={{fontSize:8,color:'var(--t3)',opacity:0.5}}>22 ghost positions shown above</div>
                          </div>
                        )}
                        </>
                        )}
                      </div>
                      {heatmapData ? (
                        <div className="ai-panel">
                          <div className="ai-panel-hd">
                            <div className="ai-panel-lbl">
                              <span className="ai-ibm">IBM</span>
                              Granite · Tactical Summary · {heatmapData.minute}&apos;
                            </div>
                            <div style={{display:'flex',gap:10,alignItems:'center'}}>
                              <span className="ai-conf">Confidence 94%</span>
                              {Object.keys(heatmapData.teams).map((team,i)=>(
                                <div key={team} style={{display:'flex',alignItems:'center',gap:5}}>
                                  <div style={{width:7,height:7,borderRadius:'50%',background:getColor(team,i),flexShrink:0}}/>
                                  <span style={{fontSize:10,color:'var(--t2)',fontWeight:700}}>{team}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="ai-panel-body">
                            <div className="ai-panel-txt">{heatmapData.narration}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="pnodata">Select a minute and click Analyse Shape to see positioning</div>
                      )}
                    </div>
                  </div>
                </>)}

                    {tacticsView==='xg' && (() => {
                      if (!xgFlow.length) return <div style={{padding:'40px',textAlign:'center',color:'var(--t3)',fontSize:12}}>Select a fixture to load xG flow.</div>
                      const ft=[...new Set(xgFlow.map(s=>s.team))].slice(0,2)
                      const mxMin=Math.max(...xgFlow.map(s=>s.minute),90)
                      const tdata=ft.map((team,ti)=>{
                        const shots=xgFlow.filter(s=>s.team===team).sort((a,b)=>a.minute-b.minute)
                        let cum=0
                        const pts:number[][]=[[0,0]]
                        shots.forEach(s=>{pts.push([s.minute,cum]);cum+=s.xg;pts.push([s.minute,cum])})
                        pts.push([mxMin,cum])
                        return {team,pts,finalXg:cum,color:getColor(team,ti)}
                      })
                      const mxXg=Math.max(...tdata.map(t=>t.finalXg),1)
                      const W=400,H=150,PL=32,PR=10,PT=12,PB=22,cW=W-PL-PR,cH=H-PT-PB
                      const px=(m:number)=>PL+(m/mxMin)*cW
                      const py=(x:number)=>PT+cH-(x/mxXg)*cH
                      const ps=(p2:number[][])=>p2.map(([m,x],i)=>`${i===0?'M':'L'}${px(m).toFixed(1)},${py(x).toFixed(1)}`).join(' ')
                      const goals=xgFlow.filter(s=>s.outcome==='Goal')
                      return (
                        <div className="viz-card">
                          <div className="viz-hd">
                            <span className="viz-ttl">xG Flow</span>
                            <div style={{display:'flex',gap:14}}>
                              {tdata.map(t=>(<div key={t.team} className="viz-li"><div className="viz-bar" style={{background:t.color}}/><span>{t.team}</span>&nbsp;<strong style={{color:t.color}}>{t.finalXg.toFixed(2)}xG</strong></div>))}
                            </div>
                          </div>
                          <div className="viz-body">
                            <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',display:'block'}}>
                              {[0.5,1,1.5,2,2.5,3].filter(v=>v<=mxXg+0.3).map(v=>(<g key={v}>
                                <line x1={PL} y1={py(v)} x2={W-PR} y2={py(v)} stroke="rgba(255,255,255,0.04)" strokeWidth="0.7"/>
                                <text x={PL-3} y={py(v)+2.5} textAnchor="end" fill="#3A4A70" fontSize="6" fontFamily="Inter">{v}</text>
                              </g>))}
                              <line x1={px(45)} y1={PT} x2={px(45)} y2={H-PB} stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" strokeDasharray="3,2"/>
                              <text x={px(45)} y={H-PB+9} textAnchor="middle" fill="#3A4A70" fontSize="6" fontFamily="Inter">HT</text>
                              {[0,15,30,60,75,90].map(m=>(<text key={m} x={px(m)} y={H-PB+9} textAnchor="middle" fill="#3A4A70" fontSize="6" fontFamily="Inter">{m}&apos;</text>))}
                              <line x1={PL} y1={H-PB} x2={W-PR} y2={H-PB} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"/>
                              {tdata.map(({team,pts,color})=>(<g key={team}>
                                <path d={`${ps(pts)} L${px(mxMin).toFixed(1)},${py(0).toFixed(1)} L${px(0).toFixed(1)},${py(0).toFixed(1)} Z`} fill={color} opacity="0.07"/>
                                <path d={ps(pts)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
                              </g>))}
                              {goals.map((g,gi)=>{
                                const ti=ft.indexOf(g.team)
                                const cum=xgFlow.filter(s=>s.team===g.team&&s.minute<=g.minute).reduce((acc,x)=>acc+x.xg,0)
                                return <circle key={gi} cx={px(g.minute)} cy={py(cum)} r="4.5" fill={getColor(g.team,ti)} stroke="var(--bg2)" strokeWidth="1.5"/>
                              })}
                            </svg>
                            <div className="viz-note">● Goals — Cumulative expected goals (xG) per team over 90 minutes</div>
                          </div>
                        </div>
                      )
                    })()}

                    {tacticsView==='shots' && (() => {
                      if (!shotMap.length) return <div style={{padding:'40px',textAlign:'center',color:'var(--t3)',fontSize:12}}>Select a fixture to load shot data.</div>
                      const oc=(o:string)=>o==='Goal'?'#10B981':o==='Saved'?'#F59E0B':o==='Blocked'?'#60A5FA':(o.includes('Post')||o.includes('Bar'))?'#F97316':'#374151'
                      return (
                        <div className="viz-card">
                          <div className="viz-hd">
                            <span className="viz-ttl">Shot Map</span>
                            <span className="viz-sub">{shotMap.length} shots · circle size = xG</span>
                          </div>
                          <div className="viz-body" style={{padding:'10px 14px'}}>
                            <svg viewBox="0 0 120 80" style={{width:'100%',display:'block',background:'#05100A',borderRadius:4}}>
                              {Array.from({length:10},(_,i)=>(<rect key={i} x={0} y={i*8} width={120} height={8} fill={i%2===0?'#0A1E0A':'#071407'}/>))}
                              <rect x="2" y="2" width="116" height="76" fill="none" stroke="#1D5A1D" strokeWidth="0.4"/>
                              <line x1="60" y1="2" x2="60" y2="78" stroke="#1D5A1D" strokeWidth="0.4"/>
                              <circle cx="60" cy="40" r="9.15" fill="none" stroke="#1D5A1D" strokeWidth="0.4"/>
                              <rect x="2" y="22.3" width="16.5" height="35.4" fill="none" stroke="#1D5A1D" strokeWidth="0.4"/>
                              <rect x="101.5" y="22.3" width="16.5" height="35.4" fill="none" stroke="#1D5A1D" strokeWidth="0.4"/>
                              <rect x="2" y="30.5" width="5.5" height="19" fill="none" stroke="#1D5A1D" strokeWidth="0.3"/>
                              <rect x="112.5" y="30.5" width="5.5" height="19" fill="none" stroke="#1D5A1D" strokeWidth="0.3"/>
                              {shotMap.map((s,si)=>{
                                const r=Math.max(0.9,0.5+Math.sqrt(s.xg)*3.5)
                                const isGoal=s.outcome==='Goal'
                                return (<g key={si}>
                                  {isGoal&&<circle cx={s.x} cy={s.y} r={r+2.5} fill={oc(s.outcome)} opacity="0.15"/>}
                                  <circle cx={s.x} cy={s.y} r={r} fill={oc(s.outcome)} opacity={isGoal?1:0.65} stroke={isGoal?'rgba(255,255,255,0.4)':'none'} strokeWidth="0.3"/>
                                </g>)
                              })}
                            </svg>
                            <div className="viz-leg">
                              {([['Goal','#10B981'],['Saved','#F59E0B'],['Blocked','#60A5FA'],['Post/Bar','#F97316'],['Off Target','#374151']] as [string,string][]).map(([l,c])=>(<div key={l} className="viz-li"><div className="viz-dot" style={{background:c}}/>{l}</div>))}
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {tacticsView==='passes' && (() => {
                      if (!passNetwork||!passNetwork.connections.length) return <div style={{padding:'40px',textAlign:'center',color:'var(--t3)',fontSize:12}}>Select a fixture to load pass network.</div>
                      const {connections,positions}=passNetwork
                      const pnt=[...new Set(Object.values(positions).map(p=>p.team))].slice(0,2)
                      const mxC=Math.max(...connections.map(c=>c.count),1)
                      const ln=(n:string)=>n.split(' ').slice(-1)[0]?.slice(0,8)||n.slice(0,8)
                      return (
                        <div className="viz-card">
                          <div className="viz-hd">
                            <span className="viz-ttl">Pass Network</span>
                            <div style={{display:'flex',alignItems:'center',gap:10}}>
                              {passNetwork.formations && pnt.map((t,ti)=>(
                                passNetwork.formations![t] && passNetwork.formations![t]!=='?' && (
                                  <div key={t} style={{display:'flex',alignItems:'center',gap:5}}>
                                    <div style={{width:6,height:6,borderRadius:'50%',background:getColor(t,ti)}}/>
                                    <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:getColor(t,ti),letterSpacing:'0.04em'}}>{passNetwork.formations![t]}</span>
                                  </div>
                                )
                              ))}
                              <span className="viz-sub">{connections.length} connections</span>
                            </div>
                          </div>
                          <div className="viz-body" style={{padding:'10px 14px'}}>
                            <svg viewBox="0 0 120 80" style={{width:'100%',display:'block',background:'#05100A',borderRadius:4}}>
                              {Array.from({length:10},(_,i)=>(<rect key={i} x={0} y={i*8} width={120} height={8} fill={i%2===0?'#0A1E0A':'#071407'}/>))}
                              <rect x="2" y="2" width="116" height="76" fill="none" stroke="#1D5A1D" strokeWidth="0.4"/>
                              <line x1="60" y1="2" x2="60" y2="78" stroke="#1D5A1D" strokeWidth="0.4"/>
                              <circle cx="60" cy="40" r="9.15" fill="none" stroke="#1D5A1D" strokeWidth="0.4"/>
                              <rect x="2" y="22.3" width="16.5" height="35.4" fill="none" stroke="#1D5A1D" strokeWidth="0.4"/>
                              <rect x="101.5" y="22.3" width="16.5" height="35.4" fill="none" stroke="#1D5A1D" strokeWidth="0.4"/>
                              {connections.map((c,ci)=>{
                                const fp=positions[c.from],tp=positions[c.to]
                                if(!fp||!tp) return null
                                const ti=pnt.indexOf(c.team)
                                return <line key={ci} x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y} stroke={getColor(c.team,ti)} strokeWidth={0.2+(c.count/mxC)*2.8} opacity={0.08+(c.count/mxC)*0.55}/>
                              })}
                              {Object.entries(positions).map(([player,pos])=>{
                                const ti=pnt.indexOf(pos.team)
                                const color=getColor(pos.team,ti)
                                const inv=connections.filter(c=>c.from===player||c.to===player).reduce((acc,c)=>acc+c.count,0)
                                const r=1.2+Math.min(inv/80,1)*1.8
                                return (<g key={player}>
                                  <circle cx={pos.x} cy={pos.y} r={r+1.5} fill={color} opacity="0.12"/>
                                  <circle cx={pos.x} cy={pos.y} r={r} fill={color} opacity="0.9"/>
                                  <text x={pos.x} y={pos.y-r-1} textAnchor="middle" fill={color} fontSize="3.2" fontFamily="Inter" fontWeight="700">{ln(player)}</text>
                                </g>)
                              })}
                            </svg>
                            <div className="viz-leg">
                              {pnt.map((t,ti)=>(<div key={t} className="viz-li"><div className="viz-dot" style={{background:getColor(t,ti)}}/>{t}</div>))}
                            </div>
                            <div className="viz-note">Node size = passing involvement · Line thickness = pass frequency</div>
                          </div>
                        </div>
                      )
                    })()}

                    {tacticsView==='penalties' && (() => {
                      const pens=shotMap.filter(s=>s.shot_type==='Penalty')
                      if (!pens.length) return (
                        <div style={{padding:'40px',textAlign:'center',color:'var(--t3)',fontSize:12}}>
                          {shotMap.length > 0 ? 'No penalty kicks in this match.' : 'Select a fixture to load penalty data.'}
                        </div>
                      )
                      const oc=(o:string)=>o==='Goal'?'#10B981':o==='Saved'?'#F59E0B':'#EF4444'
                      const penTeams=[...new Set(pens.map(p=>p.team))]
                      const saved=pens.filter(p=>p.outcome==='Saved').length
                      const goals=pens.filter(p=>p.outcome==='Goal').length
                      const convPct=pens.length>0?Math.round(goals/pens.length*100):0
                      return (
                        <div className="viz-card">
                          <div className="viz-hd">
                            <span className="viz-ttl">Penalty Analysis</span>
                            <span className="viz-sub">{pens.length} penalty kick{pens.length!==1?'s':''} · {goals} scored · {saved} saved</span>
                          </div>
                          <div className="viz-body" style={{padding:'10px 14px'}}>
                            {/* Penalty stats row */}
                            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
                              {([['Penalties',pens.length,'#3B82F6'],['Goals Scored',goals,'#10B981'],['Conversion',`${convPct}%`,'#F59E0B']] as [string,number|string,string][]).map(([lbl,val,c])=>(
                                <div key={lbl} style={{background:'var(--bg)',border:'1px solid var(--bd)',borderRadius:6,padding:'10px 12px',textAlign:'center'}}>
                                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:c,lineHeight:1}}>{val}</div>
                                  <div style={{fontSize:9,fontWeight:700,color:'var(--t3)',marginTop:3,letterSpacing:'0.1em',textTransform:'uppercase'}}>{lbl}</div>
                                </div>
                              ))}
                            </div>
                            {/* Penalty shot locations — zoomed penalty area */}
                            <svg viewBox="94 28 26 24" style={{width:'100%',maxHeight:260,display:'block',background:'#05100A',borderRadius:4}}>
                              <rect x="94" y="28" width="26" height="24" fill="none" stroke="#1D5A1D" strokeWidth="0.4"/>
                              <rect x="112" y="30.5" width="8" height="19" fill="none" stroke="#1D5A1D" strokeWidth="0.4"/>
                              <rect x="116" y="36" width="4" height="8" fill="none" stroke="#1D5A1D" strokeWidth="0.4"/>
                              <circle cx="108" cy="40" r="0.5" fill="#1D5A1D"/>
                              {pens.map((s,si)=>{
                                const r=1.8
                                const isGoal=s.outcome==='Goal'
                                return (<g key={si}>
                                  {isGoal&&<circle cx={s.x} cy={s.y} r={r+1.5} fill={oc(s.outcome)} opacity="0.18"/>}
                                  <circle cx={s.x} cy={s.y} r={r} fill={oc(s.outcome)} opacity={isGoal?1:0.75} stroke={isGoal?'rgba(255,255,255,0.5)':'none'} strokeWidth="0.3"/>
                                </g>)
                              })}
                            </svg>
                            <div className="viz-leg" style={{marginTop:10}}>
                              {([['Goal','#10B981'],['Saved','#F59E0B'],['Missed/Other','#EF4444']] as [string,string][]).map(([l,c])=>(<div key={l} className="viz-li"><div className="viz-dot" style={{background:c}}/>{l}</div>))}
                            </div>
                            {/* Per-penalty list */}
                            <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:6}}>
                              {pens.map((p,i)=>(
                                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',background:'var(--bg)',border:'1px solid var(--bd)',borderLeft:`3px solid ${oc(p.outcome)}`,borderRadius:'0 4px 4px 0'}}>
                                  <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:'var(--t3)',minWidth:28}}>{p.minute}&apos;</span>
                                  <div style={{flex:1}}>
                                    <div style={{fontSize:12,fontWeight:700,color:'var(--t1)'}}>{p.player}</div>
                                    <div style={{fontSize:10,color:'var(--t3)'}}>{p.team}</div>
                                  </div>
                                  <span style={{fontSize:11,fontWeight:800,color:oc(p.outcome),textTransform:'uppercase',letterSpacing:'0.06em'}}>{p.outcome}</span>
                                  <span style={{fontSize:10,color:'var(--t3)'}}>xG {p.xg.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                            {penTeams.length > 0 && (
                              <div className="viz-note">
                                {penTeams.map(t=>{
                                  const tPens=pens.filter(p=>p.team===t)
                                  const tGoals=tPens.filter(p=>p.outcome==='Goal').length
                                  return `${t}: ${tPens.length} pen${tPens.length!==1?'s':''}, ${tGoals} scored`
                                }).join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            </div>
          )}

          {/* SCOUT EYE */}
          {activeModule==='Scout Eye'&&(
            <div>
              {/* ── Dark hero panel — full bleed ── */}
              <div style={{ position:'relative', background:'linear-gradient(135deg,#020E14 0%,#061824 55%,#020E14 100%)', borderRadius:0, padding:'40px 48px 36px', marginBottom:24, overflow:'hidden', borderBottom:'1px solid rgba(6,182,212,0.18)', marginTop:-18, marginLeft:-22, marginRight:-22 }}>
                <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', opacity:0.08 }} viewBox="0 0 860 260" preserveAspectRatio="xMidYMid slice">
                  <circle cx="680" cy="130" r="90" fill="none" stroke="#06B6D4" strokeWidth="1.2"/>
                  <circle cx="680" cy="130" r="55" fill="none" stroke="#06B6D4" strokeWidth="0.8"/>
                  <circle cx="680" cy="130" r="20" fill="none" stroke="#06B6D4" strokeWidth="0.6"/>
                  <circle cx="680" cy="130" r="3" fill="#06B6D4"/>
                  <line x1="590" y1="130" x2="648" y2="130" stroke="#06B6D4" strokeWidth="1"/>
                  <line x1="712" y1="130" x2="770" y2="130" stroke="#06B6D4" strokeWidth="1"/>
                  <line x1="680" y1="40" x2="680" y2="98" stroke="#06B6D4" strokeWidth="1"/>
                  <line x1="680" y1="162" x2="680" y2="220" stroke="#06B6D4" strokeWidth="1"/>
                  {([[160,55],[260,95],[140,155],[310,75],[220,170],[340,140],[100,90],[280,165]] as [number,number][]).map(([x,y],i)=>(
                    <circle key={i} cx={x} cy={y} r={i%2===0?3.5:2.5} fill="#06B6D4" opacity={i%3===0?0.7:0.45}/>
                  ))}
                  <line x1="60" y1="20" x2="560" y2="20" stroke="#06B6D4" strokeWidth="0.5" strokeDasharray="4,8"/>
                  <line x1="60" y1="240" x2="560" y2="240" stroke="#06B6D4" strokeWidth="0.5" strokeDasharray="4,8"/>
                  <line x1="60" y1="20" x2="60" y2="240" stroke="#06B6D4" strokeWidth="0.5" strokeDasharray="4,8"/>
                </svg>
                <div style={{ position:'relative', zIndex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                    <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.28em', textTransform:'uppercase', color:'#06B6D4' }}>MODULE 04 · SEMANTIC SEARCH</span>
                    <div style={{ display:'flex', gap:5 }}>
                      {(['FAISS','IBM Granite','StatsBomb'] as const).map(tag=>(
                        <span key={tag} style={{ padding:'2px 9px', background:'rgba(6,182,212,0.12)', border:'1px solid rgba(6,182,212,0.28)', borderRadius:3, fontSize:9, fontWeight:700, color:'#06B6D4', letterSpacing:'0.06em' }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'0.05em', lineHeight:0.88, borderBottom:'3px solid #06B6D4', paddingBottom:6, display:'inline-block' }}>
                    <span style={{ fontSize:80, color:'#FFFFFF' }}>SCOUT </span><span style={{ fontSize:80, color:'#06B6D4' }}>EYE</span>
                  </div>
                  <div style={{ fontSize:15, color:'rgba(255,255,255,0.65)', marginTop:18, lineHeight:1.65, maxWidth:820, fontWeight:400 }}>
                    Search 6,000+ players across 21 competitions using natural language. IBM Granite generates full scouting reports from real StatsBomb shot data — find your next signing in seconds.
                  </div>
                </div>
              </div>
              <div style={{ maxWidth:840, margin:'0 auto' }}>
              <div className="srow">
                <input className="sinput" type="text" value={scoutQuery} onChange={e=>setScoutQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runScout()} placeholder="e.g.  clinical left-footed finisher with high xG under pressure..."/>
                <button className="sbtn" onClick={runScout} disabled={scoutLoading}>{scoutLoading?'Scanning...':'Search'}</button>
              </div>
              {scoutLoading&&<div className="sscan">Scanning player database...</div>}
              <div className="sres">
                {scoutResults.map((player,i)=>(
                  <div key={i} className="scard">
                    <div className="sctop">
                      <div>
                        <div className="sname">{player.name}</div>
                        <div className="smeta">
                          <span className="steam">{player.team}</span>
                          <span className="ssep">·</span>
                          <span className="scomp">{player.competition}</span>
                        </div>
                      </div>
                      <div className="sstats">
                        {player.top_actions.map(([lbl,val])=>(
                          <div key={lbl} className="sstat">
                            <div className="ssv">{typeof val==='number'&&val<1?Number(val).toFixed(3):val}</div>
                            <div className="ssl">{lbl}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="scbody">
                      <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
                        <div style={{flex:1}}>
                          <div className="srlbl">Scouting Report</div>
                          <div className="srtxt">{player.scouting_report}</div>
                        </div>
                        {player.radar && (() => {
                          const rd=player.radar!
                          const axes=[
                            {lbl:'Shots', v:Math.min(rd.shots/150,1)},
                            {lbl:'Goals', v:Math.min(rd.goals/30,1)},
                            {lbl:'Conv%', v:Math.min(rd.conversion/100,1)},
                            {lbl:'xQ',    v:Math.min(rd.xg_quality/100,1)},
                            {lbl:'Head%', v:Math.min(rd.headers/100,1)},
                            {lbl:'Pres%', v:Math.min(rd.pressure/100,1)},
                          ]
                          const CX=60,CY=60,R=38
                          const xy=(frac:number,idx:number)=>{const a=-Math.PI/2+(idx*Math.PI*2/6);return {x:CX+R*frac*Math.cos(a),y:CY+R*frac*Math.sin(a)}}
                          const rpts=(frac:number)=>[0,1,2,3,4,5].map(i=>{const p=xy(frac,i);return `${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join(' ')
                          return (
                            <div style={{flexShrink:0,width:116}}>
                              <div style={{fontSize:9,color:'var(--t3)',fontWeight:700,marginBottom:2,textAlign:'center',letterSpacing:'0.08em'}}>PLAYER RADAR</div>
                              <svg viewBox="0 0 120 120" style={{width:116,display:'block'}}>
                                {[0.25,0.5,0.75,1].map(r=><polygon key={r} points={rpts(r)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>)}
                                {[0,1,2,3,4,5].map(i=>{const p=xy(1,i);return <line key={i} x1={CX} y1={CY} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"/>})}
                                <polygon points={axes.map(({v},i)=>{const p=xy(Math.max(v,0.02),i);return `${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join(' ')} fill="rgba(16,185,129,0.18)" stroke="#10B981" strokeWidth="1.3"/>
                                {axes.map(({lbl},i)=>{const p=xy(1.3,i);return <text key={i} x={p.x.toFixed(1)} y={(p.y+2.5).toFixed(1)} textAnchor="middle" fill="#3A4A70" fontSize="6.5" fontFamily="Inter" fontWeight="600">{lbl}</text>})}
                                {axes.map(({v},i)=>{const p=xy(Math.max(v,0.02),i);return <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2" fill="#10B981"/>})}
                              </svg>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                ))}

                {scoutResults.length > 0 && <Limitations items={scoutLimitations} />}

                {/* HEAD-TO-HEAD COMPARISON */}
                {scoutResults.length >= 2 && scoutResults[0].radar && scoutResults[1].radar && (() => {
                  const COLORS = ['#10B981','#F97316']
                  const AXES = ['Shots','Goals','Conv%','xQ','Head%','Pres%']
                  const CX=70,CY=70,R=52
                  const xy2=(frac:number,idx:number)=>{const a=-Math.PI/2+(idx*Math.PI*2/6);return {x:CX+R*frac*Math.cos(a),y:CY+R*frac*Math.sin(a)}}
                  const rpts2=(frac:number)=>[0,1,2,3,4,5].map(i=>{const p=xy2(frac,i);return `${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join(' ')
                  const STAT_LABELS=[['Total Shots','shots',150],['Goals','goals',30],['Conversion %','conversion',100],['xG Quality','xg_quality',100],['Headers %','headers',100],['Pressure %','pressure',100]] as [string, keyof NonNullable<ScoutResult['radar']>, number][]
                  return (
                    <div style={{marginTop:14,background:'var(--bg2)',border:'1px solid var(--bd)',borderRadius:8,overflow:'hidden'}}>
                      <div style={{padding:'9px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <span style={{fontSize:10,fontWeight:800,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--green)'}}>Head-to-Head Comparison</span>
                        <div style={{display:'flex',gap:16}}>
                          {scoutResults.slice(0,2).map((p,i)=>(<div key={i} style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:8,height:8,borderRadius:'50%',background:COLORS[i]}}/><span style={{fontSize:11,fontWeight:700,color:COLORS[i]}}>{p.name}</span></div>))}
                        </div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:0,alignItems:'start'}}>
                        {/* Stats left */}
                        <div style={{padding:'16px'}}>
                          {STAT_LABELS.map(([lbl,key,mx])=>{
                            const v0=scoutResults[0].radar![key]
                            const v1=scoutResults[1].radar![key]
                            const pct0=Math.min(v0/mx,1)*100
                            const pct1=Math.min(v1/mx,1)*100
                            return (
                              <div key={lbl} style={{marginBottom:10}}>
                                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                                  <span style={{fontSize:10,fontWeight:700,color:COLORS[0]}}>{typeof v0==='number'&&v0<1?v0.toFixed(2):v0}</span>
                                  <span style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.06em'}}>{lbl}</span>
                                  <span style={{fontSize:10,fontWeight:700,color:COLORS[1]}}>{typeof v1==='number'&&v1<1?v1.toFixed(2):v1}</span>
                                </div>
                                <div style={{position:'relative',height:4,background:'var(--bg4)',borderRadius:2,overflow:'hidden'}}>
                                  <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${pct0}%`,background:COLORS[0],borderRadius:2,opacity:0.8}}/>
                                </div>
                                <div style={{position:'relative',height:4,background:'var(--bg4)',borderRadius:2,overflow:'hidden',marginTop:2}}>
                                  <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${pct1}%`,background:COLORS[1],borderRadius:2,opacity:0.8}}/>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {/* Radar overlay */}
                        <div style={{padding:'16px 8px',display:'flex',flexDirection:'column',alignItems:'center'}}>
                          <svg viewBox="0 0 140 140" style={{width:180,display:'block'}}>
                            {[0.25,0.5,0.75,1].map(r=><polygon key={r} points={rpts2(r)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.6"/>)}
                            {[0,1,2,3,4,5].map(i=>{const p=xy2(1,i);return <line key={i} x1={CX} y1={CY} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} stroke="rgba(255,255,255,0.06)" strokeWidth="0.6"/>})}
                            {scoutResults.slice(0,2).map((player,pi)=>{
                              if(!player.radar) return null
                              const rd=player.radar
                              const vals=[Math.min(rd.shots/150,1),Math.min(rd.goals/30,1),Math.min(rd.conversion/100,1),Math.min(rd.xg_quality/100,1),Math.min(rd.headers/100,1),Math.min(rd.pressure/100,1)]
                              return <polygon key={pi} points={vals.map((v,i)=>{const p=xy2(Math.max(v,0.02),i);return `${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join(' ')} fill={`${COLORS[pi]}22`} stroke={COLORS[pi]} strokeWidth="1.5" strokeOpacity="0.9"/>
                            })}
                            {AXES.map((lbl,i)=>{const p=xy2(1.28,i);return <text key={i} x={p.x.toFixed(1)} y={(p.y+2).toFixed(1)} textAnchor="middle" fill="#3A4A70" fontSize="6.5" fontFamily="Inter" fontWeight="600">{lbl}</text>})}
                          </svg>
                        </div>
                        {/* Player names right column spacer */}
                        <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:6,justifyContent:'center'}}>
                          {scoutResults.slice(0,2).map((p,i)=>(<div key={i} style={{textAlign:'right'}}><div style={{fontSize:13,fontWeight:800,color:COLORS[i]}}>{p.name.split(' ').slice(-1)[0]}</div><div style={{fontSize:10,color:'var(--t3)'}}>{p.team}</div></div>))}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
              </div>
            </div>
          )}

          {/* VAR ORACLE */}
          {activeModule==='VAR Oracle'&&(<VAROracle />)}

          {/* MATCH EXPLAINER */}
          {activeModule==='Match Explainer'&&(<MatchExplainer matches={matches} />)}

          {/* FAN DECODER */}
          {activeModule==='Fan Decoder'&&(<FanDecoder />)}

          {/* EMOTIPULSE */}
          {activeModule==='EmotiPulse'&&(<EmotiPulse matches={matches} />)}

          {/* PITCH AGENT */}
          {activeModule==='Pitch Agent'&&(<PitchAgent matches={matches} />)}

          {/* REFEREE LENS */}
          {activeModule==='Referee Lens'&&(<RefereeLens />)}

          {/* DEBATE */}
          {activeModule==='Debate'&&(<DebateRoom matches={matches} />)}

          {/* ALTER EGO */}
          {activeModule==='Alter Ego'&&(<WhatIfLab matches={matches} />)}

          {/* DUGOUT BRIEF */}
          {activeModule==='Dugout Brief'&&(<MatchCompanion matches={matches} />)}

          {/* COMING SOON */}
          {!['Tactical Lens','Scout Eye','VAR Oracle','Match Explainer','Fan Decoder','EmotiPulse','Pitch Agent','Referee Lens','Debate','Alter Ego','Dugout Brief'].includes(activeModule)&&(
            <div className="coming">
              <div className="comingh">{activeModule}</div>
              <div className="comings">Module in development</div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}