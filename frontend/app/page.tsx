'use client'

import { useEffect, useState } from 'react'
import FanDecoder from './FanDecoder'
import MatchExplainer from './MatchExplainer'
import VAROracle from './VAROracle'
import EmotiPulse from './EmotiPulse'

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
}

const TEAM_COLORS: Record<string, string> = {
  'Brazil': '#F59E0B', 'Belgium': '#EF4444', 'France': '#3B82F6',
  'Croatia': '#F97316', 'England': '#E2E8F0', 'Argentina': '#60A5FA',
  'Germany': '#38BDF8', 'Spain': '#F87171', 'Portugal': '#4ADE80',
  'Uruguay': '#93C5FD', 'Canada': '#10B981', 'Morocco': '#FBBF24',
  'Japan': '#EF4444', 'Netherlands': '#F97316', 'Senegal': '#A78BFA',
  'United States': '#60A5FA', 'Australia': '#FBBF24', 'Switzerland': '#F87171',
  'Poland': '#E2E8F0', 'South Korea': '#EF4444', 'Tunisia': '#EF4444',
  'Cameroon': '#4ADE80', 'Ghana': '#F59E0B', 'Ecuador': '#F59E0B',
  'Qatar': '#8B5CF6', 'Iran': '#4ADE80', 'Saudi Arabia': '#4ADE80',
  'default1': '#10B981', 'default2': '#F97316',
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  'Goal':         { color: '#10B981', bg: 'rgba(16,185,129,0.18)', label: 'Goal' },
  'Yellow Card':  { color: '#F59E0B', bg: 'rgba(245,158,11,0.18)', label: 'Yellow' },
  'Red Card':     { color: '#EF4444', bg: 'rgba(239,68,68,0.18)',  label: 'Red' },
  'Substitution': { color: '#8B5CF6', bg: 'rgba(139,92,246,0.18)', label: 'Sub' },
  'Shot':         { color: '#38BDF8', bg: 'rgba(56,189,248,0.14)', label: 'Shot' },
}

const modules = ['TacticalLens', 'Scout Eye', 'VAR Oracle', 'Match Explainer', 'Fan Decoder', 'EmotiPulse']

export default function Home() {
  const [activeModule, setActiveModule] = useState('TacticalLens')
  const [matches, setMatches] = useState<Match[]>([])
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [minute, setMinute] = useState(45)
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null)
  const [moments, setMoments] = useState<Moment[]>([])
  const [momentum, setMomentum] = useState<MomentumPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [scoutQuery, setScoutQuery] = useState('')
  const [scoutResults, setScoutResults] = useState<ScoutResult[]>([])
  const [scoutLoading, setScoutLoading] = useState(false)
  const [heroAnimDone, setHeroAnimDone] = useState(false)
  const [mode, setMode] = useState<'beginner'|'fan'|'coach'>('fan')
  const [expandedMoment, setExpandedMoment] = useState<number|null>(null)
  useEffect(() => {
    const t = setTimeout(() => setHeroAnimDone(true), 3200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    fetch('http://localhost:8001/matches')
      .then(r => r.json()).then(setMatches).catch(() => {})
  }, [])

  const loadMatch = async (m: Match) => {
    setSelectedMatch(m)
    setHeatmapData(null)
    setMoments([])
    setMomentum([])
    setExpandedMoment(null)
    const [momRes, mntRes] = await Promise.all([
      fetch(`http://localhost:8001/moments/${m.match_id}`).then(r => r.json()).catch(() => []),
      fetch(`http://localhost:8001/momentum/${m.match_id}`).then(r => r.json()).catch(() => []),
    ])
    setMoments(momRes)
    setMomentum(mntRes)
  }

  const loadTactical = async (matchId: number, min: number) => {
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:8001/tactical/${matchId}/${min}`)
      const data = await res.json()
      setHeatmapData(data)
    } catch(e) {}
    setLoading(false)
  }

  const runScout = async () => {
    if (!scoutQuery.trim()) return
    setScoutLoading(true)
    try {
      const res = await fetch(`http://localhost:8001/scout/${encodeURIComponent(scoutQuery)}`)
      const data = await res.json()
      setScoutResults(data)
    } catch(e) {}
    setScoutLoading(false)
  }

  const getColor = (team: string, index: number) =>
    TEAM_COLORS[team] || (index === 0 ? TEAM_COLORS['default1'] : TEAM_COLORS['default2'])

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
          --bg:    #090C14; --bg2:   #0E1220; --bg3:   #131828;
          --bg4:   #182030; --bg5:   #1E2840;
          --bd:    rgba(255,255,255,0.07); --bd2:   rgba(255,255,255,0.12); --bd3:   rgba(255,255,255,0.18);
          --t1:    #EEF2FF; --t2:    #7A8FB8; --t3:    #3A4A70;
          --green: #10B981; --green2:#34D399; --gold:  #F59E0B;
        }
        body { background:var(--bg); color:var(--t1); font-family:'Inter',sans-serif; font-size:13px; line-height:1.5; overflow-x:hidden; }

        .hero { position:fixed; inset:0; z-index:999; background:#000; display:flex; align-items:center; justify-content:center; transition:opacity 0.8s ease 0.2s; }
        .hero.out { opacity:0; pointer-events:none; }
        .hero-svg { position:absolute; inset:0; width:100%; height:100%; animation:hzoom 3.2s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes hzoom { 0%{transform:scale(0.22) translateY(-10%);opacity:0} 25%{opacity:1} 100%{transform:scale(2.1) translateY(6%);opacity:0} }
        .hero-txt { position:relative; z-index:1; text-align:center; animation:htxt 3.2s ease forwards; }
        @keyframes htxt { 0%{opacity:0;transform:translateY(12px)} 18%{opacity:1;transform:translateY(0)} 75%{opacity:1} 100%{opacity:0} }
        .hero-h { font-family:'Bebas Neue',sans-serif; font-size:clamp(56px,9vw,96px); letter-spacing:0.14em; color:var(--green); line-height:1; }
        .hero-s { font-size:11px; font-weight:700; letter-spacing:0.3em; text-transform:uppercase; color:var(--t3); margin-top:10px; }

        .app { opacity:0; transition:opacity 0.6s ease; }
        .app.in { opacity:1; }

        .topbar { position:sticky; top:0; z-index:100; height:50px; background:var(--bg2); border-bottom:1px solid var(--bd); display:flex; align-items:center; padding:0 20px; gap:16px; }
        .wm { font-family:'Bebas Neue',sans-serif; font-size:20px; letter-spacing:0.12em; color:var(--green); white-space:nowrap; flex-shrink:0; }
        .nav { display:flex; height:100%; flex:1; overflow-x:auto; }
        .nav::-webkit-scrollbar { display:none; }
        .nbtn { display:flex; align-items:center; padding:0 16px; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--t3); background:none; border:none; border-bottom:2px solid transparent; cursor:pointer; white-space:nowrap; transition:color 0.12s,border-color 0.12s; font-family:'Inter',sans-serif; }
        .nbtn:hover { color:var(--t2); }
        .nbtn.on { color:var(--green); border-bottom-color:var(--green); }
        .topbar-r { margin-left:auto; display:flex; align-items:center; gap:12px; flex-shrink:0; }
        .tourn { font-size:10px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:var(--t3); }
        .live { display:flex; align-items:center; gap:5px; background:#450A0A; color:#FCA5A5; font-size:9px; font-weight:800; letter-spacing:0.18em; text-transform:uppercase; padding:3px 8px; border-radius:2px; }
        .lpip { width:5px; height:5px; background:#F87171; border-radius:50%; animation:lpb 1.1s ease infinite; }
        @keyframes lpb { 0%,100%{opacity:1} 50%{opacity:0.1} }

        .ticker { background:var(--bg); border-bottom:1px solid var(--bd); padding:5px 20px; display:flex; gap:28px; overflow:hidden; }
        .ti { display:flex; align-items:center; gap:6px; font-size:10px; font-weight:600; color:var(--t3); white-space:nowrap; }
        .tdot { color:var(--green); font-size:6px; }

        .content { padding:14px 20px; }

        .tac { display:grid; grid-template-columns:256px 1fr; gap:12px; height:calc(100vh - 150px); }
        .fpanel { background:var(--bg2); border:1px solid var(--bd); border-radius:8px; overflow:hidden; display:flex; flex-direction:column; }
        .phd { display:flex; align-items:center; justify-content:space-between; padding:9px 12px; border-bottom:1px solid var(--bd); background:var(--bg); flex-shrink:0; }
        .pttl { font-size:10px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:var(--green); }
        .pct { font-size:10px; font-weight:600; color:var(--t3); }
        .flist { overflow-y:auto; flex:1; }
        .flist::-webkit-scrollbar { width:2px; }
        .flist::-webkit-scrollbar-thumb { background:var(--bg5); }
        .frow { display:flex; align-items:center; justify-content:space-between; padding:9px 12px; border-bottom:1px solid var(--bd); border-left:3px solid transparent; cursor:pointer; transition:background 0.1s,border-left-color 0.1s; gap:8px; }
        .frow:hover { background:var(--bg3); border-left-color:var(--bd2); }
        .frow.sel { background:rgba(16,185,129,0.07); border-left-color:var(--green); }
        .frow-info { flex:1; min-width:0; }
        .fn { font-size:12px; font-weight:700; color:var(--t1); line-height:1.3; }
        .fvs { color:var(--green); font-size:9px; font-weight:800; margin:0 4px; }
        .fd { font-size:10px; font-weight:500; color:var(--t3); margin-top:2px; }
        .fsc { font-size:11px; font-weight:800; color:var(--t2); white-space:nowrap; flex-shrink:0; }
        .farr { color:var(--t3); font-size:13px; flex-shrink:0; }
        .frow.sel .farr { color:var(--green); }

        .mv { display:flex; flex-direction:column; gap:10px; overflow-y:auto; height:100%; }
        .mv::-webkit-scrollbar { width:3px; }
        .mv::-webkit-scrollbar-thumb { background:var(--bg5); }

        .sb { background:var(--bg2); border:1px solid var(--bd); border-radius:8px; padding:16px 24px; display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:20px; flex-shrink:0; }
        .sb-team { display:flex; flex-direction:column; align-items:center; gap:4px; }
        .sb-name { font-size:15px; font-weight:900; letter-spacing:0.05em; text-transform:uppercase; text-align:center; line-height:1.2; }
        .sb-role { font-size:10px; font-weight:600; color:var(--t3); letter-spacing:0.08em; text-transform:uppercase; }
        .sb-ctr { text-align:center; flex-shrink:0; }
        .sb-score { font-family:'Bebas Neue',sans-serif; font-size:42px; letter-spacing:0.08em; line-height:1; display:flex; align-items:center; gap:10px; justify-content:center; }
        .sb-sep { color:var(--t3); font-size:30px; }
        .sb-date { font-size:10px; font-weight:600; color:var(--t3); margin-top:5px; letter-spacing:0.06em; }

        .modes { display:flex; flex-direction:column; align-items:center; gap:6px; flex-shrink:0; }
        .mode-row { display:flex; gap:6px; }
        .mbtn { padding:6px 18px; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; border-radius:20px; border:1px solid var(--bd2); background:none; color:var(--t3); cursor:pointer; transition:all 0.12s; font-family:'Inter',sans-serif; }
        .mbtn:hover { color:var(--t2); border-color:var(--bd3); }
        .mbtn.on { background:var(--green); color:#000; border-color:var(--green); }
        .mode-hint { font-size:10px; color:var(--t3); }

        .twocol { display:grid; grid-template-columns:1fr 1fr; gap:10px; flex-shrink:0; }
        .card { background:var(--bg2); border:1px solid var(--bd); border-radius:8px; overflow:hidden; }
        .chd { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; border-bottom:1px solid var(--bd); }
        .cttl { font-size:10px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:var(--green); }
        .csub { font-size:10px; font-weight:500; color:var(--t3); }

        .mom-body { padding:12px 14px; }
        .mom-leg { display:flex; gap:14px; margin-bottom:8px; }
        .mli { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:600; color:var(--t2); }
        .mld { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

        .klist { max-height:250px; overflow-y:auto; }
        .klist::-webkit-scrollbar { width:2px; }
        .klist::-webkit-scrollbar-thumb { background:var(--bg5); }
        .krow { padding:8px 14px; border-bottom:1px solid var(--bd); cursor:pointer; transition:background 0.1s; }
        .krow:hover { background:var(--bg3); }
        .krow.open { background:var(--bg3); }
        .ktop { display:flex; align-items:center; gap:10px; }
        .kmin { font-family:'Bebas Neue',sans-serif; font-size:20px; color:var(--t2); min-width:38px; line-height:1; }
        .kbadge { font-size:9px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; padding:3px 7px; border-radius:3px; white-space:nowrap; flex-shrink:0; }
        .kinfo { flex:1; min-width:0; }
        .kplayer { font-size:12px; font-weight:700; color:var(--t1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .kteam { font-size:10px; font-weight:500; color:var(--t3); margin-top:1px; }
        .karr { font-size:12px; color:var(--t3); flex-shrink:0; }
        .kexp { margin-top:8px; padding:10px 12px; background:var(--bg4); border-radius:6px; border-left:3px solid var(--green); }
        .kexp-lbl { font-size:9px; font-weight:800; letter-spacing:0.18em; text-transform:uppercase; color:var(--green); margin-bottom:5px; }
        .kexp-txt { font-size:12px; color:var(--t2); line-height:1.7; }

        .pc { background:var(--bg2); border:1px solid var(--bd); border-radius:8px; overflow:hidden; flex-shrink:0; }
        .pctrl { display:flex; align-items:center; gap:12px; padding:9px 14px; border-bottom:1px solid var(--bd); background:var(--bg); }
        .pcl { font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--t3); }
        .pcs { flex:1; appearance:none; height:3px; background:var(--bg5); border-radius:2px; outline:none; cursor:pointer; }
        .pcs::-webkit-slider-thumb { appearance:none; width:13px; height:13px; background:var(--green); border-radius:50%; cursor:pointer; }
        .pcm { font-family:'Bebas Neue',sans-serif; font-size:24px; color:var(--green); min-width:44px; text-align:right; line-height:1; }
        .pcb { padding:7px 18px; background:var(--green); color:#000; font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; border:none; cursor:pointer; border-radius:4px; transition:background 0.1s; font-family:'Inter',sans-serif; }
        .pcb:hover { background:#34D399; }
        .pcb:disabled { background:var(--bg5); color:var(--t3); cursor:not-allowed; }
        .pfield { background:#06100A; position:relative; height:300px; overflow:hidden; }
        .psvg { width:100%; height:100%; display:block; }
        .pload { position:absolute; inset:0; background:rgba(6,16,10,0.8); display:flex; align-items:center; justify-content:center; }
        .pltxt { font-family:'Bebas Neue',sans-serif; font-size:16px; letter-spacing:0.2em; color:var(--green); animation:pls 0.7s ease infinite; }
        @keyframes pls { 0%,100%{opacity:1} 50%{opacity:0.15} }
        .pempty { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; }
        .peico { font-size:32px; opacity:0.1; }
        .petxt { font-size:10px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:var(--t3); }
        .pbot { display:flex; border-top:1px solid var(--bd); min-height:64px; }
        .pleg { display:flex; flex-direction:column; justify-content:center; gap:6px; padding:10px 14px; border-right:1px solid var(--bd); min-width:120px; }
        .plrow { display:flex; align-items:center; gap:7px; }
        .pldot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .plname { font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--t1); }
        .pnarr { flex:1; padding:10px 14px; display:flex; flex-direction:column; justify-content:center; border-left:3px solid var(--green); }
        .pnlbl { font-size:9px; font-weight:800; letter-spacing:0.18em; text-transform:uppercase; color:var(--green); margin-bottom:5px; }
        .pntxt { font-size:12px; color:var(--t2); line-height:1.65; }
        .pnodata { flex:1; display:flex; align-items:center; padding:10px 14px; font-size:10px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:var(--t3); }

        .nomatch { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:10px; }
        .nmico { font-size:44px; opacity:0.08; }
        .nmtxt { font-size:10px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; color:var(--t3); }

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
        .sbtn:hover { background:#34D399; }
        .sbtn:disabled { background:var(--bg5); color:var(--t3); cursor:not-allowed; }
        .sscan { text-align:center; padding:48px; font-family:'Bebas Neue',sans-serif; font-size:20px; letter-spacing:0.2em; color:var(--green); animation:pls 0.9s ease infinite; }
        .sres { display:flex; flex-direction:column; gap:10px; }
        .scard { background:var(--bg2); border:1px solid var(--bd); border-radius:8px; overflow:hidden; transition:border-color 0.12s; }
        .scard:hover { border-color:var(--bd3); }
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

        /* COMING */
        .coming { display:flex; flex-direction:column; align-items:center; justify-content:center; height:60vh; gap:8px; }
        .comingh { font-family:'Bebas Neue',sans-serif; font-size:52px; letter-spacing:0.1em; color:var(--bg5); }
        .comings { font-size:10px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; color:var(--t3); }
      `}</style>

      {/* HERO */}
      <div className={`hero${heroAnimDone?' out':''}`}>
        <svg className="hero-svg" viewBox="0 0 1000 680" preserveAspectRatio="xMidYMid slice">
          <rect width="1000" height="680" fill="#04070A"/>
          <ellipse cx="500" cy="340" rx="480" ry="310" fill="#0A0A20"/>
          <ellipse cx="500" cy="340" rx="480" ry="310" fill="none" stroke="#111135" strokeWidth="50"/>
          <ellipse cx="500" cy="340" rx="400" ry="245" fill="none" stroke="#0D0D28" strokeWidth="24"/>
          {Array.from({length:13},(_,i)=>(
            <rect key={i} x="115" y={90+i*40} width="770" height="40" fill={i%2===0?'#0C200C':'#091809'}/>
          ))}
          <rect x="115" y="90" width="770" height="510" fill="none" stroke="#1A4A1A" strokeWidth="2"/>
          <line x1="500" y1="92" x2="500" y2="598" stroke="#1A4A1A" strokeWidth="2"/>
          <circle cx="500" cy="345" r="85" fill="none" stroke="#1A4A1A" strokeWidth="2"/>
          <circle cx="500" cy="345" r="4" fill="#1A4A1A"/>
          <rect x="115" y="205" width="145" height="280" fill="none" stroke="#1A4A1A" strokeWidth="2"/>
          <rect x="740" y="205" width="145" height="280" fill="none" stroke="#1A4A1A" strokeWidth="2"/>
          <rect x="115" y="275" width="52" height="140" fill="none" stroke="#1A4A1A" strokeWidth="1.5"/>
          <rect x="833" y="275" width="52" height="140" fill="none" stroke="#1A4A1A" strokeWidth="1.5"/>
          <rect x="88" y="308" width="27" height="76" fill="#080820" stroke="#222245" strokeWidth="1.5"/>
          <rect x="885" y="308" width="27" height="76" fill="#080820" stroke="#222245" strokeWidth="1.5"/>
          {([[150,100],[850,100],[150,590],[850,590]] as [number,number][]).map(([x,y],i)=>(
            <g key={i}>
              <rect x={x-3} y={y-20} width="6" height="20" fill="#666"/>
              <rect x={x-14} y={y-26} width="28" height="7" fill="#999" rx="2"/>
              <ellipse cx={x} cy={y-20} rx="24" ry="8" fill="#FFFBF0" opacity="0.6"/>
              <ellipse cx={x} cy={y-20} rx="50" ry="18" fill="#FFFBF0" opacity="0.06"/>
            </g>
          ))}
        </svg>
        <div className="hero-txt">
          <div className="hero-h">PITCH INTEL</div>
          <div className="hero-s">World Cup AI Command Center</div>
        </div>
      </div>

      {/* APP */}
      <div className={`app${heroAnimDone?' in':''}`}>
        <div className="topbar">
          <div className="wm">⚽ Pitch Intel</div>
          <div className="nav">
            {modules.map(m=>(
              <button key={m} className={`nbtn${activeModule===m?' on':''}`} onClick={()=>setActiveModule(m)}>{m}</button>
            ))}
          </div>
          <div className="topbar-r">
            <span className="tourn">FIFA WC 2018/22</span>
            <div className="live"><div className="lpip"/>Live</div>
          </div>
        </div>

        <div className="ticker">
          {['Brazil 2–1 Belgium · QF 2018','France 1–0 Morocco · SF 2022','England 2–0 Sweden · QF 2018','Argentina 3–3 France · Final 2022','128 matches · StatsBomb open data'].map((t,i)=>(
            <div key={i} className="ti"><span className="tdot">●</span>{t}</div>
          ))}
        </div>

        <div className="content">

          {/* TACTICAL LENS */}
          {activeModule==='TacticalLens' && (
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
                        <div className="fn">{m.home_team}<span className="fvs">vs</span>{m.away_team}</div>
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
                    <div className="nmico">⚽</div>
                    <div className="nmtxt">Select a fixture to begin</div>
                  </div>
                ) : (
                  <>
                    <div className="sb">
                      <div className="sb-team">
                        <div className="sb-name" style={{color:getColor(selectedMatch.home_team,0)}}>{selectedMatch.home_team}</div>
                        <div className="sb-role">Home</div>
                      </div>
                      <div className="sb-ctr">
                        <div className="sb-score">
                          <span style={{color:getColor(selectedMatch.home_team,0)}}>{selectedMatch.home_score??'—'}</span>
                          <span className="sb-sep">:</span>
                          <span style={{color:getColor(selectedMatch.away_team,1)}}>{selectedMatch.away_score??'—'}</span>
                        </div>
                        <div className="sb-date">{selectedMatch.match_date} · World Cup</div>
                      </div>
                      <div className="sb-team">
                        <div className="sb-name" style={{color:getColor(selectedMatch.away_team,1)}}>{selectedMatch.away_team}</div>
                        <div className="sb-role">Away</div>
                      </div>
                    </div>

                    <div className="modes">
                      <div className="mode-row">
                        {(['beginner','fan','coach'] as const).map(m=>(
                          <button key={m} className={`mbtn${mode===m?' on':''}`} onClick={()=>setMode(m)}>
                            {m==='beginner'?'Beginner':m==='fan'?'Fan':'Coach'}
                          </button>
                        ))}
                      </div>
                      <div className="mode-hint">
                        {mode==='beginner'?'Plain language explanations':mode==='fan'?'Football vocabulary & context':'Tactical depth & analysis'}
                      </div>
                    </div>

                    <div className="twocol">
                      <div className="card">
                        <div className="chd">
                          <span className="cttl">Momentum</span>
                          <span className="csub">Pressure & possession flow</span>
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
                              <svg viewBox={`0 0 ${Math.max(minutes.length*14,1)} 80`} preserveAspectRatio="none" style={{width:'100%',height:80,display:'block'}}>
                                {teams.map((team,ti)=>{
                                  const color=getColor(team,ti)
                                  const pts=minutes.map((min,xi)=>{
                                    const pt=momentum.find(p=>p.minute===min&&p.team===team)
                                    const y=pt?72-(pt.score/maxMomentum)*65:72
                                    return `${xi*14+7},${y}`
                                  }).join(' ')
                                  return (
                                    <g key={team}>
                                      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" opacity="0.85"/>
                                      {moments.filter(m=>m.type==='Goal'&&m.team===team).map((m,gi)=>{
                                        const xi=minutes.findIndex(min=>Math.abs(min-m.minute)<=2)
                                        if(xi<0) return null
                                        const pt=momentum.find(p=>p.minute===minutes[xi]&&p.team===team)
                                        const y=pt?72-(pt.score/maxMomentum)*65:72
                                        return <circle key={gi} cx={xi*14+7} cy={y} r="4" fill={color} stroke="var(--bg)" strokeWidth="1.5"/>
                                      })}
                                    </g>
                                  )
                                })}
                                {[0,45,90].map(target=>{
                                  const xi=minutes.findIndex(m=>m>=target)
                                  return xi>=0?<text key={target} x={xi*14+7} y={79} textAnchor="middle" fill="#3A4A70" fontSize="6" fontFamily="Inter">{target}'</text>:null
                                })}
                              </svg>
                            </>
                          ) : (
                            <div style={{padding:'20px 0',textAlign:'center',fontSize:'11px',color:'var(--t3)'}}>Loading momentum...</div>
                          )}
                        </div>
                      </div>

                      <div className="card">
                        <div className="chd">
                          <span className="cttl">Key Moments</span>
                          <span className="csub">{keyMoments.length} events</span>
                        </div>
                        <div className="klist">
                          {keyMoments.length > 0 ? keyMoments.map((m,i)=>{
                            const cfg=TYPE_CONFIG[m.type]||{color:'#888',bg:'rgba(136,136,136,0.12)',label:m.type}
                            const isOpen=expandedMoment===i
                            return (
                              <div key={i} className={`krow${isOpen?' open':''}`} onClick={()=>setExpandedMoment(isOpen?null:i)}>
                                <div className="ktop">
                                  <div className="kmin">{m.minute}'</div>
                                  <div className="kbadge" style={{color:cfg.color,background:cfg.bg}}>{cfg.label}</div>
                                  <div className="kinfo">
                                    <div className="kplayer">{m.player||m.team}</div>
                                    <div className="kteam">{m.team}</div>
                                  </div>
                                  <div className="karr">{isOpen?'↑':'↓'}</div>
                                </div>
                                {isOpen&&(
                                  <div className="kexp">
                                    <div className="kexp-lbl">AI Analysis · {mode} mode</div>
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
                    </div>

                    <div className="pc">
                      <div className="chd">
                        <span className="cttl">TacticalLens — Player Positions</span>
                        <span className="csub">Real StatsBomb tracking data</span>
                      </div>
                      <div className="pctrl">
                        <span className="pcl">Minute</span>
                        <input type="range" min={1} max={90} value={minute} onChange={e=>setMinute(+e.target.value)} className="pcs"/>
                        <span className="pcm">{minute}'</span>
                        <button className="pcb" disabled={loading} onClick={()=>loadTactical(selectedMatch.match_id,minute)}>
                          {loading?'Reading...':'Analyse'}
                        </button>
                      </div>
                      <div className="pfield">
                        <svg className="psvg" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid meet">
                          {Array.from({length:10},(_,i)=>(
                            <rect key={i} x={0} y={i*8} width={120} height={8} fill={i%2===0?'#0C200C':'#091809'}/>
                          ))}
                          <rect x="2" y="2" width="116" height="76" fill="none" stroke="#1D5A1D" strokeWidth="0.5"/>
                          <line x1="60" y1="2" x2="60" y2="78" stroke="#1D5A1D" strokeWidth="0.5"/>
                          <circle cx="60" cy="40" r="9.15" fill="none" stroke="#1D5A1D" strokeWidth="0.5"/>
                          <circle cx="60" cy="40" r="0.8" fill="#1D5A1D"/>
                          <rect x="2" y="22.3" width="16.5" height="35.4" fill="none" stroke="#1D5A1D" strokeWidth="0.5"/>
                          <rect x="101.5" y="22.3" width="16.5" height="35.4" fill="none" stroke="#1D5A1D" strokeWidth="0.5"/>
                          <rect x="2" y="30.5" width="5.5" height="19" fill="none" stroke="#1D5A1D" strokeWidth="0.35"/>
                          <rect x="112.5" y="30.5" width="5.5" height="19" fill="none" stroke="#1D5A1D" strokeWidth="0.35"/>
                          <rect x="0" y="34" width="2" height="12" fill="none" stroke="#255525" strokeWidth="0.5"/>
                          <rect x="118" y="34" width="2" height="12" fill="none" stroke="#255525" strokeWidth="0.5"/>
                          {heatmapData&&Object.entries(heatmapData.teams).map(([team,players],ti)=>
                            players.map((p,i)=>(
                              <g key={`${team}-${i}`}>
                                <circle cx={p.x} cy={p.y} r="2.2" fill={getColor(team,ti)} opacity="1"/>
                                <circle cx={p.x} cy={p.y} r="4" fill={getColor(team,ti)} opacity="0.18"/>
                              </g>
                            ))
                          )}
                        </svg>
                        {loading&&<div className="pload"><div className="pltxt">Analysing...</div></div>}
                        {!heatmapData&&!loading&&(
                          <div className="pempty">
                            <div className="peico">📍</div>
                            <div className="petxt">Set minute and click Analyse</div>
                          </div>
                        )}
                      </div>
                      <div className="pbot">
                        {heatmapData?(
                          <>
                            <div className="pleg">
                              {Object.keys(heatmapData.teams).map((team,i)=>(
                                <div key={team} className="plrow">
                                  <div className="pldot" style={{background:getColor(team,i)}}/>
                                  <span className="plname">{team}</span>
                                </div>
                              ))}
                            </div>
                            <div className="pnarr">
                              <div className="pnlbl">AI Analyst · {heatmapData.minute}'</div>
                              <div className="pntxt">{heatmapData.narration}</div>
                            </div>
                          </>
                        ):(
                          <div className="pnodata">Set minute · click Analyse to see player positions</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* SCOUT EYE */}
          {activeModule==='Scout Eye'&&(
            <div className="sp">
              <div className="shdr">
                <div className="sey">Module 02 · Semantic search</div>
                <div className="sh1">Scout Eye</div>
                <div className="sp2">Search 6,000+ players across 21 competitions using natural language. AI generates full scouting reports from real StatsBomb shot data.</div>
              </div>
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
                      <div className="srlbl">Scouting Report</div>
                      <div className="srtxt">{player.scouting_report}</div>
                    </div>
                  </div>
                ))}
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

          {/* COMING SOON */}
          {!['TacticalLens','Scout Eye','VAR Oracle','Match Explainer','Fan Decoder','EmotiPulse'].includes(activeModule)&&(
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