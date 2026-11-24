// ─────────────────────────────────────────────────────────────────────────────
// ArrowSystem — Ballistic Physics, Aerodynamic Rotation & Impact Effects
// Manages high-velocity in-flight hunting arrows with parabolic trajectory,
// aerodynamic alignment, target detection, ground penetration with kinetic
// quiver wobble, and celebratory elemental impact sparks.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useQuestStore } from '../stores/questStore'
import { sound } from '../audio/SoundSynthesizer'
import { getOpenWorldHeight } from '@/components/world/OpenWorldGrassField'
import { worldCollisionSystem } from '../physics/WorldCollisionSystem'
import { createArrowTrackMaterial } from './ArrowTrackMaterial'

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
  bounces?: number
  flightDist?: number
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

const GRAVITY = -13.5 // Realistic ballistic drop (m/s^2) with aerodynamic archery physics
const MAX_ARROWS = 32
const MAX_TRAIL_POINTS = 26

// Scratch vectors for camera-facing billboard ribbon generation (Zero GC allocations)
const _tVec = new THREE.Vector3()
const _cVec = new THREE.Vector3()
const _nVec = new THREE.Vector3()
const _upFallback = new THREE.Vector3(0, 1, 0)

// ── AAA Camera-Facing Aerodynamic Ribbon Flight Trail ────────────────────────
function ArrowTrailRenderer({
  points,
  material,
}: {
  points: THREE.Vector3[]
  material: THREE.Material
}) {
  const { camera } = useThree()
  const geo = useMemo(() => {
    const vertexCount = MAX_TRAIL_POINTS * 2
    const pos = new Float32Array(vertexCount * 3)
    const uvs = new Float32Array(vertexCount * 2)
    const indices: number[] = []

    for (let pi = 0; pi < MAX_TRAIL_POINTS - 1; pi++) {
      const i0 = pi * 2
      const i1 = pi * 2 + 1
      const i2 = (pi + 1) * 2
      const i3 = (pi + 1) * 2 + 1
      indices.push(i0, i1, i2)
      indices.push(i2, i1, i3)
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    g.setIndex(indices)
    // Pre-set static bounding sphere to avoid per-frame computeBoundingSphere
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 400)
    return g
  }, [])

  useEffect(() => {
    return () => {
      geo.dispose()
    }
  }, [geo])

  useFrame((state) => {
    if (!geo) return
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
    const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute
    const pos = posAttr.array as Float32Array
    const uvs = uvAttr.array as Float32Array
    const n = points.length
    if (n < 2) {
      geo.setDrawRange(0, 0)
      return
    }

    const camPos = camera.position

    for (let pi = 0; pi < n; pi++) {
      const p = points[pi]

      // Flight tangent vector
      if (pi < n - 1) {
        _tVec.copy(points[pi + 1]).sub(p)
      } else {
        _tVec.copy(p).sub(points[pi - 1])
      }
      if (_tVec.lengthSq() < 1e-6) {
        _tVec.set(0, 0, 1)
      } else {
        _tVec.normalize()
      }

      // Vector to camera viewpoint
      _cVec.copy(camPos).sub(p)

      // Ribbon normal perpendicular to both tangent and view line
      _nVec.crossVectors(_tVec, _cVec)
      if (_nVec.lengthSq() < 1e-6) {
        _nVec.crossVectors(_tVec, _upFallback)
      }
      _nVec.normalize()

      // Progression: pi = 0 (oldest/tail, t = 0), pi = n - 1 (newest/nock, t = 1)
      const t = pi / (n - 1)

      // Width: starts sleek at arrow nock (~0.005m halfW = 10mm width), diffuses outward to 0.018m at tail
      const halfW = 0.018 - 0.013 * t

      // Left vertex
      pos[pi * 6 + 0] = p.x + _nVec.x * halfW
      pos[pi * 6 + 1] = p.y + _nVec.y * halfW
      pos[pi * 6 + 2] = p.z + _nVec.z * halfW

      // Right vertex
      pos[pi * 6 + 3] = p.x - _nVec.x * halfW
      pos[pi * 6 + 4] = p.y - _nVec.y * halfW
      pos[pi * 6 + 5] = p.z - _nVec.z * halfW

      // u: 0.0 at arrow nock (t = 1), 1.0 at dissipating tail (t = 0)
      const u = 1.0 - t
      uvs[pi * 4 + 0] = u
      uvs[pi * 4 + 1] = 0.0
      uvs[pi * 4 + 2] = u
      uvs[pi * 4 + 3] = 1.0
    }

    posAttr.needsUpdate = true
    uvAttr.needsUpdate = true
    geo.setDrawRange(0, (n - 1) * 6)

    // Update material time uniform
    if ((material as any).uniforms?.uTime) {
      ; (material as any).uniforms.uTime.value = state.clock.elapsedTime
    }
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

  // ── Authentic 3D Arrow Model ───────────────────────────────────────────────
  const { nodes: arrowNodes } = useGLTF('/assets/models/Arrow.glb') as any

  // ── Realistic 3D Arrow Mesh Template & PBR Materials ────────────────────────
  const { shaftMat, tipMat, ferruleMat, fletchMat, trailMat } = useMemo(() => {
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

    const trMat = createArrowTrackMaterial()

    return {
      shaftMat: sMat,
      tipMat: tMat,
      ferruleMat: feMat,
      fletchMat: fMat,
      trailMat: trMat,
    }
  }, [])

  // Expose spawn method to parent
  useImperativeHandle(ref, () => ({
    spawnArrow: (origin: THREE.Vector3, direction: THREE.Vector3, power: number) => {
      recordShot()

      // Authentic survival recurve bow ballistics:
      // power range: 0.35 (snap tap) to 1.0 (full measured draw)
      // Initial velocity: 22 m/s up to 44 m/s
      const speed = 22 + power * 22
      const vel = direction.clone().multiplyScalar(speed)

      // Initial orientation: align local +Z (broadhead razor blade) strictly with direction of flight
      const fwd = direction.clone().normalize()
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd)

      const tailPos = origin.clone().addScaledVector(fwd, -0.807)
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
        bounces: 0,
        flightDist: 0,
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

      // Despawn arrows after 10 seconds
      if (a.life > 10.0) {
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

      // ── Ballistic Trajectory, Aerodynamic Drag & Natural Range Stall ────────
      // 1. Aerodynamic drag on turkey fletchings and cedar wood shaft
      const dragFactor = Math.pow(0.993, dt * 60)
      a.vel.x *= dragFactor
      a.vel.z *= dragFactor

      // 2. Realistic Ballistic Gravity + Range Stall Curve:
      // "make the lenth limited then it will fall down if its far"
      let currentGravity = GRAVITY
      if (a.life > 1.2) {
        // Natural aerodynamic stall at extended ranges (beyond 50-60m):
        // Downward pitch curves arrow down naturally so it plunges into the earth
        const stall = Math.min(2.8, (a.life - 1.2) * 2.2)
        currentGravity += -14.0 * stall
        a.vel.x *= Math.pow(0.985, dt * 60)
        a.vel.z *= Math.pow(0.985, dt * 60)
      }

      a.vel.y += currentGravity * dt
      a.pos.addScaledVector(a.vel, dt)
      a.flightDist = (a.flightDist || 0) + prevPos.distanceTo(a.pos)

      // Aerodynamic rotation: local +Z (broadhead razor blade) strictly tracks velocity vector
      const speed = a.vel.length()
      if (speed > 0.1) {
        const fwd = a.vel.clone().normalize()
        a.quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd)
      }

      // Append trail point at the tail of the arrow (0.807m behind tip)
      const fwd = speed > 0.1 ? a.vel.clone().normalize() : new THREE.Vector3(0, 0, 1)
      const tailPos = a.pos.clone().addScaledVector(fwd, -0.807)
      a.trail.push(tailPos)
      if (a.trail.length > MAX_TRAIL_POINTS) {
        a.trail.shift()
      }

      arrowsUpdated = true

      // ── Collision Check 0: Environment Colliders (Trees, Rocks, Shrines) ────
      const envHit = worldCollisionSystem.checkRay(prevPos, a.pos, 0.05)
      if (envHit) {
        if (envHit.collider.tag === 'tree') {
          // EMBED FIRMLY INTO WOODEN TREE TRUNK
          const fwdNorm = a.vel.length() > 0.1 ? a.vel.clone().normalize() : envHit.normal.clone().negate()
          // Penetrate broadhead tip 8cm into the wood bark
          a.pos.copy(envHit.hitPoint).addScaledVector(fwdNorm, 0.08)
          a.stuck = true
          a.trail = []
          a.wobbleAmp = 0.12
          a.wobbleFreq = 26
          a.wobbleTime = 0
          a.vel.set(0, 0, 0)
          sound.playArrowThud(true)
          arrowsUpdated = true
          continue
        } else {
          // HIT HARD STONE (BOULDER OR MEGALITH)
          // Arrows cannot pierce rock! They spark and deflect downwards to the ground!
          sound.playArrowThud(false)

          // Emit stone sparks
          const stoneSparks: SparkParticle[] = []
          for (let s = 0; s < 12; s++) {
            stoneSparks.push({
              id: Math.random(),
              pos: envHit.hitPoint.clone(),
              vel: new THREE.Vector3(
                (Math.random() - 0.5) * 4 + envHit.normal.x * 2.5,
                Math.random() * 3 + 1.2,
                (Math.random() - 0.5) * 4 + envHit.normal.z * 2.5
              ),
              color: Math.random() > 0.35 ? '#ffe082' : '#ffffff',
              life: 0,
              maxLife: 0.25 + Math.random() * 0.2,
              size: 0.035,
            })
          }
          sparksRef.current = [...sparksRef.current, ...stoneSparks]

          a.bounces = (a.bounces || 0) + 1
          if (a.bounces >= 2 || a.vel.length() < 5.0) {
            // Drop directly to ground at the base of the rock
            const groundY = getOpenWorldHeight(envHit.hitPoint.x, envHit.hitPoint.z)
            a.pos.copy(envHit.hitPoint)
            a.pos.y = groundY + 0.02
            a.stuck = true
            a.vel.set(0, 0, 0)
            a.trail = []
            a.wobbleAmp = 0
          } else {
            // Deflect off rock face
            a.pos.copy(envHit.hitPoint).addScaledVector(envHit.normal, 0.08)
            a.vel.reflect(envHit.normal).multiplyScalar(0.25)
            a.vel.y -= 4.0 // Strong gravity pull to drop to earth
            a.trail = []
            a.wobbleAmp = 0.04
            a.wobbleFreq = 32
            a.wobbleTime = 0
          }
          arrowsUpdated = true
          continue
        }
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
        const fwdNorm = a.vel.length() > 0.1 ? a.vel.clone().normalize() : new THREE.Vector3(0, -1, 0)
        a.pos.y = terrainY
        a.pos.addScaledVector(fwdNorm, 0.08)
        a.stuck = true
        a.trail = []
        a.wobbleAmp = 0.08
        a.wobbleFreq = 22
        a.wobbleTime = 0
        a.vel.set(0, 0, 0)
        sound.playArrowHitDirt()
        arrowsUpdated = true
        continue
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
              {arrowNodes.Arrow_1 && (
                <group position={[0, 0, -0.807]} rotation={[-Math.PI * 0.5, 0, 0]} scale={30.0}>
                  {/* Turkey Feathers */}
                  <mesh geometry={arrowNodes.Arrow_1.geometry} material={fletchMat} />
                  {/* Straight Cedar Shaft */}
                  <mesh geometry={arrowNodes.Arrow_2.geometry} material={shaftMat} castShadow />
                  {/* Carbon Steel Broadhead Razor Point */}
                  <mesh geometry={arrowNodes.Arrow_3.geometry} material={tipMat} />
                  {/* Steel Ferrule Collar */}
                  <mesh geometry={arrowNodes.Arrow_4.geometry} material={ferruleMat} />
                </group>
              )}
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

useGLTF.preload('/assets/models/Arrow.glb')
