'use client'

import { useEffect, useRef } from 'react'

interface PlayerPos { x: number; y: number; player: string; team: string; minute?: number }
interface Props {
  positions: Record<string, PlayerPos[]>
  teamColors?: [string, string]
  height?: number
  minute?: number
  ballPosition?: { x: number; y: number }
}

const SB_W = 120
const SB_H = 80

function makeToken(num: number, lastName: string, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const ctx = c.getContext('2d')!
  // Glow halo
  const grd = ctx.createRadialGradient(128, 128, 70, 128, 128, 128)
  grd.addColorStop(0, color + 'FF')
  grd.addColorStop(0.72, color + 'AA')
  grd.addColorStop(1, color + '00')
  ctx.beginPath(); ctx.arc(128, 128, 128, 0, Math.PI * 2)
  ctx.fillStyle = grd; ctx.fill()
  // Solid disc
  ctx.beginPath(); ctx.arc(128, 128, 88, 0, Math.PI * 2)
  ctx.fillStyle = color; ctx.fill()
  // Bright ring
  ctx.beginPath(); ctx.arc(128, 128, 82, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 6; ctx.stroke()
  // Number
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 80px "Arial Black",Arial,sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8
  ctx.fillText(String(num), 128, 104)
  // Name
  ctx.shadowBlur = 0
  ctx.font = 'bold 30px Arial,sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillText(lastName.toUpperCase().slice(0, 8), 128, 170)
  return c
}

export default function ThreePitch({ positions, teamColors = ['#3B82F6', '#EF4444'], height = 400, minute, ballPosition }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Run previous scene cleanup before creating new one
    cleanupRef.current?.()
    cleanupRef.current = null

    if (!mountRef.current) return
    let cancelled = false

    Promise.all([
      import('three'),
      import('three/examples/jsm/controls/OrbitControls.js'),
    ]).then(([THREE, { OrbitControls }]) => {
      if (cancelled || !mountRef.current) return
      const el = mountRef.current
      // Clear any leftover canvas from previous render
      while (el.firstChild) el.removeChild(el.firstChild)
      const {
        Scene, PerspectiveCamera, WebGLRenderer, Color,
        Mesh, MeshLambertMaterial, MeshBasicMaterial,
        BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry,
        DirectionalLight, PointLight, HemisphereLight,
        CanvasTexture, BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial,
      } = THREE

      const W = el.clientWidth || 700

      const scene = new Scene()
      scene.background = new Color(0x0B1622)

      // ── Camera: broadcast angle — elevated, wide ──
      const camera = new PerspectiveCamera(52, W / height, 0.1, 800)
      camera.position.set(0, 55, 72)
      camera.lookAt(0, 0, 0)

      const renderer = new WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(W, height)
      renderer.shadowMap.enabled = true
      el.appendChild(renderer.domElement)

      // OrbitControls
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.target.set(0, 0, 0)
      controls.enableDamping = true; controls.dampingFactor = 0.08
      controls.minDistance = 30; controls.maxDistance = 150
      controls.minPolarAngle = Math.PI * 0.15
      controls.maxPolarAngle = Math.PI * 0.48
      controls.autoRotate = true; controls.autoRotateSpeed = 0.5

      // ── Lighting: stadium floodlights ──
      scene.add(new HemisphereLight(0x223344, 0x112200, 0.7))
      const floods: [number, number, number][] = [[-55, 80, -40], [55, 80, -40], [-55, 80, 40], [55, 80, 40]]
      floods.forEach(([x, y, z]) => {
        const d = new DirectionalLight(0xFFFFEE, 1.9)
        d.position.set(x, y, z); d.castShadow = true; scene.add(d)
        // Floodlight pole
        const pole = new Mesh(new BoxGeometry(0.8, 20, 0.8), new MeshBasicMaterial({ color: 0x333344 }))
        pole.position.set(x, 10, z); scene.add(pole)
        const head = new Mesh(new BoxGeometry(5, 1.2, 1.8), new MeshBasicMaterial({ color: 0xEEEECC }))
        head.position.set(x, 21.5, z); scene.add(head)
        const pt = new PointLight(0xFFFFDD, 1.2, 150)
        pt.position.set(x * 0.45, 38, z * 0.45); scene.add(pt)
      })

      // ── Pitch — vivid green with stripes ──
      const pitch = new Mesh(new PlaneGeometry(SB_W, SB_H), new MeshLambertMaterial({ color: 0x2B8C2B }))
      pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; scene.add(pitch)
      const sw = SB_W / 10
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) continue
        const s = new Mesh(new PlaneGeometry(sw, SB_H), new MeshLambertMaterial({ color: 0x318C31 }))
        s.rotation.x = -Math.PI / 2
        s.position.set(-SB_W / 2 + sw * i + sw / 2, 0.01, 0); scene.add(s)
      }

      // ── White markings ──
      const mk = new MeshBasicMaterial({ color: 0xDDEEDD })
      function ln(x1: number, z1: number, x2: number, z2: number, w = 0.3) {
        const dx = x2 - x1, dz = z2 - z1, len = Math.sqrt(dx * dx + dz * dz)
        const m = new Mesh(new BoxGeometry(len, 0.06, w), mk)
        m.position.set((x1 + x2) / 2 - SB_W / 2, 0.04, (z1 + z2) / 2 - SB_H / 2)
        if (dz !== 0 && dx === 0) m.rotation.y = Math.PI / 2; scene.add(m)
      }
      ln(0,0,SB_W,0); ln(0,SB_H,SB_W,SB_H); ln(0,0,0,SB_H); ln(SB_W,0,SB_W,SB_H); ln(SB_W/2,0,SB_W/2,SB_H)
      ln(0,18,18,18); ln(18,18,18,62); ln(0,62,18,62)
      ln(SB_W,18,SB_W-18,18); ln(SB_W-18,18,SB_W-18,62); ln(SB_W,62,SB_W-18,62)
      ln(0,30,6,30); ln(6,30,6,50); ln(0,50,6,50)
      ln(SB_W,30,SB_W-6,30); ln(SB_W-6,30,SB_W-6,50); ln(SB_W,50,SB_W-6,50)
      for (let i = 0; i < 48; i++) {
        const a1 = (i/48)*Math.PI*2, a2 = ((i+1)/48)*Math.PI*2
        ln(SB_W/2+Math.cos(a1)*10, SB_H/2+Math.sin(a1)*10, SB_W/2+Math.cos(a2)*10, SB_H/2+Math.sin(a2)*10, 0.2)
      }

      // ── Goals ──
      const gm = new MeshBasicMaterial({ color: 0xCCCCDD })
      ;[0, SB_W].forEach(x => {
        ;[-3.66, 3.66].forEach(hz => {
          const p = new Mesh(new BoxGeometry(0.35, 2.6, 0.35), gm)
          p.position.set(x - SB_W/2, 1.3, hz); scene.add(p)
        })
        const b = new Mesh(new BoxGeometry(0.35, 0.35, 7.32), gm)
        b.position.set(x - SB_W/2, 2.6, 0); scene.add(b)
      })

      // ── Player tokens ──
      const tGeo = new CylinderGeometry(2.1, 2.1, 0.24, 32)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anim: { m: any; by: number; ph: number }[] = []
      const avgByTeam: Record<string, {sx:number;sz:number}[]> = {}
      const teamNames = Object.keys(positions)

      teamNames.forEach((team, ti) => {
        const col = teamColors[ti % 2]
        const hexInt = parseInt(col.replace('#',''), 16)
        const byP: Record<string, {x:number[];y:number[]}> = {}
        for (const p of positions[team]) {
          if (!byP[p.player]) byP[p.player] = {x:[],y:[]}
          byP[p.player].x.push(p.x); byP[p.player].y.push(p.y)
        }
        avgByTeam[team] = []
        Object.entries(byP).forEach(([name, coords], idx) => {
          const ax = coords.x.reduce((a,b)=>a+b,0)/coords.x.length
          const ay = coords.y.reduce((a,b)=>a+b,0)/coords.y.length
          const sx = ax - SB_W/2, sz = ay - SB_H/2
          avgByTeam[team].push({sx,sz})

          const lastName = name.split(' ').slice(-1)[0]
          const tex = new CanvasTexture(makeToken(idx+1, lastName, col))
          const token = new Mesh(tGeo,
            [new MeshLambertMaterial({color:hexInt}), new MeshBasicMaterial({map:tex}), new MeshLambertMaterial({color:hexInt})] as any)
          token.position.set(sx, 0.36, sz); token.castShadow = true; scene.add(token)
          anim.push({m:token, by:0.36, ph:(ti*13+idx)*0.43})

          // Glow ring on ground
          const ring = new Mesh(new CylinderGeometry(2.6, 2.6, 0.04, 24),
            new MeshBasicMaterial({color:hexInt, transparent:true, opacity:0.3}))
          ring.position.set(sx, 0.02, sz); scene.add(ring)
        })
      })

      // ── Pass lanes ──
      teamNames.forEach((team, ti) => {
        const hexInt = parseInt(teamColors[ti%2].replace('#',''), 16)
        const pts = avgByTeam[team]
        for (let a = 0; a < pts.length; a++) {
          for (let b = a+1; b < pts.length; b++) {
            const d = Math.sqrt((pts[a].sx-pts[b].sx)**2+(pts[a].sz-pts[b].sz)**2)
            if (d > 28) continue
            const v = new Float32Array([pts[a].sx,0.1,pts[a].sz, pts[b].sx,0.1,pts[b].sz])
            const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(v,3))
            scene.add(new Line(g, new LineBasicMaterial({color:hexInt, transparent:true, opacity:0.3})))
          }
        }
      })

      // ── Ball ──
      const bx = ballPosition ? ballPosition.x - SB_W/2 : 0
      const bz = ballPosition ? ballPosition.y - SB_H/2 : 0
      const ball = new Mesh(new SphereGeometry(0.85, 20, 14), new MeshLambertMaterial({color:0xFFFFFF}))
      ball.position.set(bx, 0.85, bz); ball.castShadow = true; scene.add(ball)
      const bsh = new Mesh(new PlaneGeometry(2,2), new MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.4}))
      bsh.rotation.x = -Math.PI/2; bsh.position.set(bx, 0.02, bz); scene.add(bsh)

      // ── Render ──
      let animId: number
      let t = 0
      const render = () => {
        animId = requestAnimationFrame(render)
        t += 0.016
        anim.forEach(({m,by,ph}) => { m.position.y = by + Math.sin(t*1.3+ph)*0.09 })
        ball.position.y = 0.85 + Math.abs(Math.sin(t*2.8))*0.16
        controls.update()
        renderer.render(scene, camera)
      }
      render()

      const onResize = () => {
        const w = el.clientWidth
        camera.aspect = w / height
        camera.updateProjectionMatrix()
        renderer.setSize(w, height)
      }
      window.addEventListener('resize', onResize)

      cleanupRef.current = () => {
        cancelAnimationFrame(animId)
        window.removeEventListener('resize', onResize)
        controls.dispose(); renderer.dispose()
        if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
      }
    })

    return () => {
      cancelled = true
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [positions, teamColors, height, ballPosition])

  return (
    <div style={{ position:'relative', borderRadius:8, overflow:'hidden', background:'#0B1622' }}>
      <div ref={mountRef} style={{ width:'100%', height }} />
      <div style={{ position:'absolute', top:10, left:12, display:'flex', gap:8, alignItems:'center' }}>
        <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(255,255,255,0.45)' }}>
          3D · StatsBomb Tracking
        </span>
        {minute != null && <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.3)' }}>{minute}&apos;</span>}
      </div>
      <div style={{ position:'absolute', bottom:8, left:12, fontSize:9, color:'rgba(255,255,255,0.28)', fontWeight:600 }}>
        Drag rotate · Scroll zoom
      </div>
    </div>
  )
}
