'use client'

import { useEffect, useRef } from 'react'

interface PlayerPos { x: number; y: number; player: string; team: string; minute?: number }

interface Props {
  positions: Record<string, PlayerPos[]>   // team name → positions
  teamColors?: [string, string]
  width?: number
  height?: number
  minute?: number
}

// StatsBomb pitch dimensions
const SB_W = 120
const SB_H = 80

export default function ThreePitch({ positions, teamColors = ['#3B7CF6', '#F87171'], width = 700, height = 420, minute }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return
    let animId: number

    import('three').then(({ Scene, PerspectiveCamera, WebGLRenderer, Mesh, MeshLambertMaterial,
      BoxGeometry, SphereGeometry, DirectionalLight, AmbientLight, PlaneGeometry,
      MeshBasicMaterial, EdgesGeometry, LineSegments, LineBasicMaterial, Color,
      TextureLoader, RepeatWrapping }) => {

      const el = mountRef.current!
      const W = el.clientWidth || width
      const H = el.clientHeight || height

      const scene = new Scene()
      scene.background = new Color(0x030C06)

      const camera = new PerspectiveCamera(45, W / H, 0.1, 1000)
      // Angled overhead view — feels 3D without needing orbit controls
      camera.position.set(0, 60, 55)
      camera.lookAt(0, 0, 0)

      const renderer = new WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(W, H)
      renderer.shadowMap.enabled = true
      el.appendChild(renderer.domElement)

      // Lighting
      const ambient = new AmbientLight(0x334433, 0.8)
      scene.add(ambient)
      const sun = new DirectionalLight(0xffffff, 1.2)
      sun.position.set(20, 60, 20)
      sun.castShadow = true
      scene.add(sun)

      // ── Pitch surface ──
      // StatsBomb coords: x=0..120 (lengthwise), y=0..80 (widthwise)
      // Map to Three.js: centre at origin, x→X, y→Z
      const pitchMat = new MeshLambertMaterial({ color: 0x0D2B0E })
      const pitchGeo = new PlaneGeometry(SB_W, SB_H)
      const pitch = new Mesh(pitchGeo, pitchMat)
      pitch.rotation.x = -Math.PI / 2
      pitch.receiveShadow = true
      scene.add(pitch)

      // ── Pitch stripe alternation ──
      const stripeW = SB_W / 10
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) continue
        const sg = new PlaneGeometry(stripeW, SB_H)
        const sm = new MeshLambertMaterial({ color: 0x0F3110 })
        const s = new Mesh(sg, sm)
        s.rotation.x = -Math.PI / 2
        s.position.set(-SB_W / 2 + stripeW * i + stripeW / 2, 0.01, 0)
        scene.add(s)
      }

      // ── Pitch markings (white lines as thin boxes) ──
      const lineMat = new MeshBasicMaterial({ color: 0x2A5030 })
      function addLine(x1: number, z1: number, x2: number, z2: number, w = 0.25) {
        const dx = x2 - x1, dz = z2 - z1
        const len = Math.sqrt(dx * dx + dz * dz)
        const geo = new BoxGeometry(len, 0.05, w)
        const m = new Mesh(geo, new MeshBasicMaterial({ color: 0x3A6B40 }))
        m.position.set((x1 + x2) / 2 - SB_W / 2, 0.02, (z1 + z2) / 2 - SB_H / 2)
        if (dz !== 0 && dx === 0) m.rotation.y = Math.PI / 2
        scene.add(m)
      }
      // Outline
      addLine(0, 0, SB_W, 0); addLine(0, SB_H, SB_W, SB_H)
      addLine(0, 0, 0, SB_H); addLine(SB_W, 0, SB_W, SB_H)
      // Halfway
      addLine(SB_W / 2, 0, SB_W / 2, SB_H)
      // Penalty areas
      addLine(0, 18, 18, 18); addLine(18, 18, 18, 62); addLine(0, 62, 18, 62)
      addLine(SB_W, 18, SB_W - 18, 18); addLine(SB_W - 18, 18, SB_W - 18, 62); addLine(SB_W, 62, SB_W - 18, 62)
      // Goal areas
      addLine(0, 30, 6, 30); addLine(6, 30, 6, 50); addLine(0, 50, 6, 50)
      addLine(SB_W, 30, SB_W - 6, 30); addLine(SB_W - 6, 30, SB_W - 6, 50); addLine(SB_W, 50, SB_W - 6, 50)

      // ── Centre circle (approximated with segments) ──
      const cx = SB_W / 2, cz = SB_H / 2, r = 10
      const segs = 32
      for (let i = 0; i < segs; i++) {
        const a1 = (i / segs) * Math.PI * 2
        const a2 = ((i + 1) / segs) * Math.PI * 2
        addLine(
          cx + Math.cos(a1) * r, cz + Math.sin(a1) * r,
          cx + Math.cos(a2) * r, cz + Math.sin(a2) * r,
          0.2,
        )
      }

      // ── Goals ──
      const goalMat = new MeshBasicMaterial({ color: 0x4B5563 })
      function addGoal(x: number) {
        const post = new BoxGeometry(0.4, 2.5, 0.4)
        const bar = new BoxGeometry(0.4, 0.4, 7.32)
        const p1 = new Mesh(post, goalMat); p1.position.set(x - SB_W / 2, 1.25, -3.66)
        const p2 = new Mesh(post, goalMat); p2.position.set(x - SB_W / 2, 1.25, 3.66)
        const b = new Mesh(bar, goalMat);  b.position.set(x - SB_W / 2, 2.5, 0)
        scene.add(p1, p2, b)
      }
      addGoal(0); addGoal(SB_W)

      // ── Player spheres ──
      const teamNames = Object.keys(positions)
      const playerSphereGeo = new SphereGeometry(1.2, 12, 8)

      teamNames.forEach((team, ti) => {
        const color = parseInt(teamColors[ti % 2].replace('#', ''), 16)
        const mat = new MeshLambertMaterial({ color })
        const shadowMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })

        // Average positions per unique player (avoid rendering every event)
        const byPlayer: Record<string, { x: number[]; y: number[] }> = {}
        for (const p of positions[team]) {
          if (!byPlayer[p.player]) byPlayer[p.player] = { x: [], y: [] }
          byPlayer[p.player].x.push(p.x)
          byPlayer[p.player].y.push(p.y)
        }

        Object.entries(byPlayer).forEach(([, coords]) => {
          const ax = coords.x.reduce((a, b) => a + b, 0) / coords.x.length
          const ay = coords.y.reduce((a, b) => a + b, 0) / coords.y.length
          const sx = ax - SB_W / 2
          const sz = ay - SB_H / 2

          const sphere = new Mesh(playerSphereGeo, mat)
          sphere.position.set(sx, 1.2, sz)
          sphere.castShadow = true
          scene.add(sphere)

          // Drop shadow disc
          const discGeo = new PlaneGeometry(2.4, 2.4)
          const disc = new Mesh(discGeo, shadowMat)
          disc.rotation.x = -Math.PI / 2
          disc.position.set(sx, 0.04, sz)
          scene.add(disc)
        })
      })

      // ── Slow auto-rotate ──
      let angle = 0
      const render = () => {
        animId = requestAnimationFrame(render)
        angle += 0.003
        const r2 = 75
        camera.position.x = Math.sin(angle) * r2 * 0.3
        camera.position.z = 55 + Math.sin(angle * 0.5) * 5
        camera.lookAt(0, 0, 0)
        renderer.render(scene, camera)
      }
      render()

      // Resize
      const onResize = () => {
        const w = el.clientWidth
        camera.aspect = w / H
        camera.updateProjectionMatrix()
        renderer.setSize(w, H)
      }
      window.addEventListener('resize', onResize)

      return () => {
        cancelAnimationFrame(animId)
        window.removeEventListener('resize', onResize)
        renderer.dispose()
        if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
      }
    })

    return () => cancelAnimationFrame(animId)
  }, [positions, teamColors, width, height])

  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#030C06' }}>
      <div ref={mountRef} style={{ width: '100%', height }} />
      <div style={{
        position: 'absolute', top: 10, left: 12,
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
          3D View · Three.js
        </span>
        {minute != null && (
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>{minute}&apos;</span>
        )}
      </div>
    </div>
  )
}
