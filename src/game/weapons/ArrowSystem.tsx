// ─────────────────────────────────────────────────────────────────────────────
// ArrowSystem — Ballistic Physics, Aerodynamic Rotation & Impact Effects
// Manages high-velocity in-flight hunting arrows with parabolic trajectory,
// aerodynamic alignment, target detection, ground penetration with kinetic
// quiver wobble, and celebratory elemental impact sparks.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useQuestStore } from '../stores/questStore'
import { sound } from '../audio/SoundSynthesizer'
import { getOpenWorldHeight } from '@/components/world/OpenWorldGrassField'
import { worldCollisionSystem } from '../physics/WorldCollisionSystem'

export interface ArrowSystemHandle {
  spawnArrow: (origin: THREE.Vector3, direction: THREE.Vector3, power: number) => void
}

interface FlyingArrow {
  id: number
  pos: THREE.Vector3 // Current world position of arrow broadhead TIP
  vel: THREE.Vector3
  quat: THREE.Quaternion // Quaternion rotation: local +Z aligned with velocity
  stuck: boolean
  wobbleAmp: number
  wobbleFreq: number
  wobbleTime: number
  life: number
  trail: THREE.Vector3[]
}

interface SparkParticle {
  id: number
  pos: THREE.Vector3
  vel: THREE.Vector3
  color: string
  life: number
  maxLife: number
  size: number
}

const GRAVITY = -9.8 // Realistic ballistic drop (m/s^2)
const MAX_ARROWS = 32
const MAX_TRAIL_POINTS = 26

// ── Zero-Allocation GPU Streamed Aerodynamic Ribbon Trail ───────────────────
function ArrowTrailRenderer({
  points,
  material,
}: {
  points: THREE.Vector3[]
  material: THREE.Material
}) {
  const geo = useMemo(() => {
    const pos = new Float32Array(MAX_TRAIL_POINTS * 4 * 3)
    const indices: number[] = []
    for (let pi = 0; pi < MAX_TRAIL_POINTS - 1; pi++) {
      const b = pi * 4
      indices.push(b, b + 1, b + 4)
      indices.push(b + 1, b + 5, b + 4)
      indices.push(b + 2, b + 3, b + 6)
      indices.push(b + 3, b + 7, b + 6)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setIndex(indices)
    return g
  }, [])

  useEffect(() => {
    return () => {
      geo.dispose()
    }
  }, [geo])

  useFrame(() => {
    if (!geo) return
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
    const pos = posAttr.array as Float32Array
    const n = points.length
    if (n < 2) return

    for (let pi = 0; pi < n; pi++) {
      const p = points[pi]
      const t = pi / (n - 1)
      const halfW = 0.003 + 0.016 * t
      pos[pi * 12 + 0] = p.x
      pos[pi * 12 + 1] = p.y + halfW
      pos[pi * 12 + 2] = p.z
      pos[pi * 12 + 3] = p.x
      pos[pi * 12 + 4] = p.y - halfW
      pos[pi * 12 + 5] = p.z
      pos[pi * 12 + 6] = p.x + halfW
      pos[pi * 12 + 7] = p.y
      pos[pi * 12 + 8] = p.z
      pos[pi * 12 + 9] = p.x - halfW
      pos[pi * 12 + 10] = p.y
      pos[pi * 12 + 11] = p.z
    }
    posAttr.needsUpdate = true
    geo.setDrawRange(0, (n - 1) * 12)
  })

  return <mesh geometry={geo} material={material} />
}

export const ArrowSystem = forwardRef<ArrowSystemHandle>((_, ref) => {
  const [arrows, setArrows] = useState<FlyingArrow[]>([])
  const [sparks, setSparks] = useState<SparkParticle[]>([])
  const arrowsRef = useRef<FlyingArrow[]>([])
  const sparksRef = useRef<SparkParticle[]>([])
  arrowsRef.current = arrows
  sparksRef.current = sparks

  const recordShot = useQuestStore((s) => s.recordShot)
  const hitTarget = useQuestStore((s) => s.hitTarget)

  // ── Realistic 3D Arrow Mesh Template (Length 0.52m, tip at (0,0,0) facing +Z) ──
  const { shaftGeo, tipGeo, ferruleGeo, fletchGeo, nockGeo, threadGeo, shaftMat, tipMat, ferruleMat, fletchMat, nockMat, threadMat, trailMat } = useMemo(() => {
    // 1. Broadhead Razor Blade (Point at z = 0 pointing forward +Z, barbs at z = -0.050)
    const tipShape = new THREE.Shape()
    tipShape.moveTo(0, 0.0) // Razor point at 0
    tipShape.lineTo(0.009, -0.050) // Right trailing barb
    tipShape.lineTo(0.0025, -0.045)
    tipShape.lineTo(-0.0025, -0.045)
    tipShape.lineTo(-0.009, -0.050) // Left trailing barb
    tipShape.closePath()

    const tip = new THREE.ExtrudeGeometry(tipShape, {
      depth: 0.0014,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.0003,
      bevelThickness: 0.0003,
    })
    tip.rotateX(Math.PI / 2)
    tip.rotateZ(Math.PI / 4) // 45 deg blade tilt

    // 2. Metal Ferrule Collar connecting broadhead to shaft
    const ferrule = new THREE.CylinderGeometry(0.0033, 0.0028, 0.015, 12)
    ferrule.rotateX(Math.PI / 2)
    ferrule.translate(0, 0, -0.050)

    // 3. Cedar Wood Shaft: diameter 5.2mm, length 0.460m, extends from z = -0.050 to z = -0.510
    const shaft = new THREE.CylinderGeometry(0.0026, 0.0026, 0.460, 12)
    shaft.rotateX(Math.PI / 2)
    shaft.translate(0, 0, -0.280)

    // 4. White Turkey Shield-Cut Feathers (3 sleek vanes at rear tail, height 5.5mm, length 5.5cm)
    const fletchShape = new THREE.Shape()
    fletchShape.moveTo(0, 0)
    fletchShape.lineTo(0.0055, -0.010)
    fletchShape.lineTo(0.0055, -0.050)
    fletchShape.lineTo(0, -0.058)
    fletchShape.closePath()
    const fletch = new THREE.ShapeGeometry(fletchShape)
    fletch.rotateX(Math.PI / 2) // Extends backward along -Z

    // Linen thread whipping rings binding the feather quills
    const thread = new THREE.CylinderGeometry(0.0029, 0.0029, 0.004, 12)
    thread.rotateX(Math.PI / 2)

    // 5. Carved Dark Horn Nock (at rear tail z = -0.510 to -0.520)
    const nock = new THREE.CylinderGeometry(0.0026, 0.0026, 0.0075, 12)
    nock.rotateX(Math.PI / 2)
    nock.translate(0, 0, -0.516)

    // Materials
    const sMat = new THREE.MeshStandardMaterial({
      color: '#5c351a',
      roughness: 0.50,
      metalness: 0.03,
    })

    const tMat = new THREE.MeshStandardMaterial({
      color: '#bcc5cc',
      roughness: 0.22,
      metalness: 0.88,
    })

    const feMat = new THREE.MeshStandardMaterial({
      color: '#383d42',
      roughness: 0.32,
      metalness: 0.85,
    })

    const fMat = new THREE.MeshStandardMaterial({
      color: '#eae6de',
      roughness: 0.65,
      side: THREE.DoubleSide,
    })

    const nMat = new THREE.MeshStandardMaterial({
      color: '#1a1410',
      roughness: 0.72,
      metalness: 0.08,
    })

    const thMat = new THREE.MeshStandardMaterial({
      color: '#3d2516',
      roughness: 0.75,
      metalness: 0.05,
    })

    const trMat = new THREE.MeshBasicMaterial({
      color: '#d0f0ff',
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    return {
      shaftGeo: shaft,
      tipGeo: tip,
      ferruleGeo: ferrule,
      fletchGeo: fletch,
      nockGeo: nock,
      threadGeo: thread,
      shaftMat: sMat,
      tipMat: tMat,
      ferruleMat: feMat,
      fletchMat: fMat,
      nockMat: nMat,
      threadMat: thMat,
      trailMat: trMat,
    }
  }, [])

  // Expose spawn method to parent
  useImperativeHandle(ref, () => ({
    spawnArrow: (origin: THREE.Vector3, direction: THREE.Vector3, power: number) => {
      recordShot()

      // Ballistic velocity: directly along crosshair sightline (35 to 47 m/s)
      const speed = 35 + power * 12
      const vel = direction.clone().multiplyScalar(speed)

      // Initial orientation: align local +Z (broadhead razor blade) strictly with direction of flight
      const fwd = direction.clone().normalize()
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd)

      const tailPos = origin.clone().addScaledVector(fwd, -0.52)
      const newArrow: FlyingArrow = {
        id: Date.now() + Math.random(),
        pos: origin.clone(),
        vel,
        quat,
        stuck: false,
        wobbleAmp: 0,
        wobbleFreq: 26,
        wobbleTime: 0,
        life: 0,
        trail: [tailPos],
      }

      arrowsRef.current.push(newArrow)
      setArrows([...arrowsRef.current])
    },
  }))

  // ── Physics Integration Loop ───────────────────────────────────────────────
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    let arrowsUpdated = false
    const activeArrows = [...arrowsRef.current]
    const currentShrines = useQuestStore.getState().shrines

    for (let i = activeArrows.length - 1; i >= 0; i--) {
      const a = activeArrows[i]
      a.life += dt

      // Despawn arrows after 8 seconds
      if (a.life > 8.0) {
        activeArrows.splice(i, 1)
        arrowsUpdated = true
        continue
      }

      // ── Stuck Arrow Quiver Wobble ──────────────────────────────────────────
      if (a.stuck) {
        if (a.wobbleAmp > 0.001) {
          a.wobbleTime += dt
          a.wobbleAmp = THREE.MathUtils.damp(a.wobbleAmp, 0, 8, dt)
          arrowsUpdated = true
        }
        continue
      }

      const prevPos = a.pos.clone()

      // Integrate ballistic physics
      a.vel.y += GRAVITY * dt
      a.pos.addScaledVector(a.vel, dt)

      // Aerodynamic rotation: local +Z (broadhead razor blade) strictly tracks velocity vector
      const fwd = a.vel.clone().normalize()
      a.quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd)

      // Append trail point at the tail of the arrow (0.52m behind tip)
      const tailPos = a.pos.clone().addScaledVector(fwd, -0.52)
      a.trail.push(tailPos)
      if (a.trail.length > MAX_TRAIL_POINTS) {
        a.trail.shift()
      }

      arrowsUpdated = true

      // ── Collision Check 0: Environment Colliders (Trees, Rocks, Shrines) ────
      const envHit = worldCollisionSystem.checkRay(prevPos, a.pos, 0.06)
      if (envHit) {
        a.pos.copy(envHit.hitPoint)
        a.stuck = true
        a.trail = []
        a.wobbleAmp = 0.09
        a.wobbleFreq = envHit.collider.tag === 'tree' ? 24 : 36
        a.wobbleTime = 0
        a.vel.set(0, 0, 0)

        if (envHit.collider.tag === 'tree') {
          sound.playArrowThud(true)
        } else {
          sound.playArrowThud(false)
          // Sparks from stone strike
          const stoneSparks: SparkParticle[] = []
          for (let s = 0; s < 10; s++) {
            stoneSparks.push({
              id: Math.random(),
              pos: envHit.hitPoint.clone(),
              vel: new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                Math.random() * 4 + 1,
                (Math.random() - 0.5) * 5
              ),
              color: '#dcd8cf',
              life: 0,
              maxLife: 0.3 + Math.random() * 0.2,
              size: 0.035,
            })
          }
          sparksRef.current = [...sparksRef.current, ...stoneSparks]
        }

        arrowsUpdated = true
        continue
      }

      // ── Collision Check 1: Guardian Shield Targets on Ancient Shrines ──────
      let targetHit = false
      const motionSegment = new THREE.Line3(prevPos, a.pos)

      for (const shrine of currentShrines) {
        if (shrine.isAwakened) continue

        // Check each of the 3 guardian targets
        for (let tIdx = 0; tIdx < 3; tIdx++) {
          if (shrine.targetsHit[tIdx]) continue

          const angle = (tIdx * (Math.PI * 2)) / 3 + 0.4
          const targetRad = 5.2
          const targetWorldX = shrine.position[0] + Math.cos(angle) * targetRad
          const targetWorldZ = shrine.position[2] + Math.sin(angle) * targetRad
          const targetWorldY = getOpenWorldHeight(targetWorldX, targetWorldZ) + 2.5

          const targetPos = new THREE.Vector3(targetWorldX, targetWorldY, targetWorldZ)

          const closestPt = new THREE.Vector3()
          motionSegment.closestPointToPoint(targetPos, true, closestPt)
          const dist = closestPt.distanceTo(targetPos)

          if (dist < 1.15) {
            hitTarget(shrine.id, tIdx)

            // Spawn radiant elemental sparks
            const newSparks: SparkParticle[] = []
            for (let s = 0; s < 28; s++) {
              const theta = Math.random() * Math.PI * 2
              const phi = Math.random() * Math.PI
              const spd = 2.5 + Math.random() * 6.5
              newSparks.push({
                id: Math.random(),
                pos: targetPos.clone(),
                vel: new THREE.Vector3(
                  Math.sin(phi) * Math.cos(theta) * spd,
                  Math.cos(phi) * spd + 1.8,
                  Math.sin(phi) * Math.sin(theta) * spd
                ),
                color: shrine.color,
                life: 0,
                maxLife: 0.65 + Math.random() * 0.45,
                size: 0.08 + Math.random() * 0.06,
              })
            }
            setSparks((p) => [...p, ...newSparks])

            // Despawn arrow on target shatter
            activeArrows.splice(i, 1)
            targetHit = true
            break
          }
        }
        if (targetHit) break
      }

      if (targetHit) continue

      // ── Collision Check 2: Ground Terrain Penetration ──────────────────────
      const terrainY = getOpenWorldHeight(a.pos.x, a.pos.z)
      if (a.pos.y <= terrainY) {
        // Sink the broadhead razor point 8cm into the ground for authentic embedded arrowhead
        const fwd = a.vel.clone().normalize()
        a.pos.y = terrainY
        a.pos.addScaledVector(fwd, 0.08)
        a.stuck = true
        a.trail = []
        a.wobbleAmp = 0.07
        a.wobbleTime = 0
        sound.playArrowHitWood()
      }
    }

    if (arrowsUpdated) {
      setArrows(activeArrows)
    }

    // ── Update Sparks ────────────────────────────────────────────────────────
    if (sparksRef.current.length > 0) {
      const activeSparks = sparksRef.current
        .map((s) => ({
          ...s,
          life: s.life + dt,
          pos: s.pos.clone().addScaledVector(s.vel, dt),
          vel: s.vel.clone().add(new THREE.Vector3(0, -9.8 * dt, 0)),
        }))
        .filter((s) => s.life < s.maxLife)

      setSparks(activeSparks)
    }
  })

  return (
    <>
      {/* 3D Flying & Stuck Arrows */}
      {arrows.map((a) => {
        const wobble =
          a.stuck && a.wobbleAmp > 0.001
            ? Math.sin(a.wobbleTime * a.wobbleFreq) * a.wobbleAmp * Math.exp(-a.wobbleTime * 6)
            : 0

        // Compute rotation quaternion including physical wobble
        const renderQuat = a.quat.clone()
        if (wobble !== 0) {
          const wobbleQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), wobble)
          renderQuat.multiply(wobbleQ)
        }

        // Efficient pre-allocated ribbon trail mesh
        const hasTrail = !a.stuck && a.trail.length > 1

        return (
          <group key={a.id}>
            {/* Aerodynamic luminous slipstream trail */}
            {hasTrail && (
              <ArrowTrailRenderer points={a.trail} material={trailMat} />
            )}

            {/* The Arrow Mesh: pivot at broadhead tip (0,0,0), +Z is flight forward */}
            <group
              position={[a.pos.x, a.pos.y, a.pos.z]}
              quaternion={renderQuat}
            >
              {/* 1. Forged Steel Two-Blade Broadhead (at front z = 0, pointing +Z) */}
              <mesh geometry={tipGeo} material={tipMat} position={[0, 0, 0]} />

              {/* 2. Metal Ferrule Collar */}
              <mesh geometry={ferruleGeo} material={ferruleMat} position={[0, 0, 0]} />

              {/* 3. Cedar Wood Shaft */}
              <mesh geometry={shaftGeo} material={shaftMat} position={[0, 0, 0]} castShadow />

              {/* 4. Carved Dark Horn Nock */}
              <mesh geometry={nockGeo} material={nockMat} position={[0, 0, 0]} />

              {/* 5. 3 Sleek White Turkey Feathers (at rear tail z = -0.450 to -0.508) */}
              {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
                <group key={i} position={[0, 0, -0.450]} rotation={[0, 0, angle]}>
                  <mesh geometry={fletchGeo} material={fletchMat} position={[0, 0.0026, 0]} />
                </group>
              ))}

              {/* Linen Thread Whipping Rings */}
              <mesh geometry={threadGeo} material={threadMat} position={[0, 0, -0.450]} />
              <mesh geometry={threadGeo} material={threadMat} position={[0, 0, -0.510]} />
            </group>
          </group>
        )
      })}

      {/* Target Impact Sparks */}
      {sparks.map((s) => (
        <mesh key={s.id} position={[s.pos.x, s.pos.y, s.pos.z]}>
          <sphereGeometry args={[s.size * (1 - s.life / s.maxLife), 6, 6]} />
          <meshBasicMaterial color={s.color} transparent opacity={1 - s.life / s.maxLife} />
        </mesh>
      ))}
    </>
  )
})
