// ─────────────────────────────────────────────────────────────────────────────
// ArrowSystem — Ballistic Physics, Aerodynamic Rotation & Impact Effects
// Manages high-velocity in-flight hunting arrows with parabolic trajectory,
// aerodynamic alignment, target detection, ground penetration with kinetic
// quiver wobble, and celebratory elemental impact sparks.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useImperativeHandle, forwardRef, useMemo } from 'react'
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
  rot: THREE.Euler
  stuck: boolean
  wobbleAmp: number
  wobbleFreq: number
  wobbleTime: number
  life: number
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

const GRAVITY = -12.5 // Natural ballistic drop (m/s^2)
const MAX_ARROWS = 32

export const ArrowSystem = forwardRef<ArrowSystemHandle>((_, ref) => {
  const [arrows, setArrows] = useState<FlyingArrow[]>([])
  const [sparks, setSparks] = useState<SparkParticle[]>([])
  const arrowsRef = useRef<FlyingArrow[]>([])
  const sparksRef = useRef<SparkParticle[]>([])
  arrowsRef.current = arrows
  sparksRef.current = sparks

  const recordShot = useQuestStore((s) => s.recordShot)
  const hitTarget = useQuestStore((s) => s.hitTarget)

  // ── Realistic 3D Arrow Mesh Template (Length 0.74m, tip at (0, 0, 0)) ───────
  const { shaftGeo, tipGeo, fletchGeo, nockGeo, shaftMat, tipMat, fletchMat, nockMat } = useMemo(() => {
    // Carbon-weave cedar shaft
    const shaft = new THREE.CylinderGeometry(0.0042, 0.0042, 0.74, 8)
    shaft.rotateX(Math.PI / 2) // Orient along Z axis

    // Damascus steel broadhead
    const tipShape = new THREE.Shape()
    tipShape.moveTo(0, 0.038)
    tipShape.lineTo(0.014, -0.016)
    tipShape.lineTo(0.005, -0.010)
    tipShape.lineTo(0, -0.015)
    tipShape.lineTo(-0.005, -0.010)
    tipShape.lineTo(-0.014, -0.016)
    tipShape.closePath()

    const tip = new THREE.ExtrudeGeometry(tipShape, {
      depth: 0.0025,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0015,
      bevelThickness: 0.0015,
    })
    tip.center()
    tip.rotateX(-Math.PI / 2) // Point along -Z

    // Feathers
    const fletchShape = new THREE.Shape()
    fletchShape.moveTo(0, 0)
    fletchShape.lineTo(0.015, 0.016)
    fletchShape.lineTo(0.012, 0.09)
    fletchShape.lineTo(0, 0.08)
    fletchShape.closePath()
    const fletch = new THREE.ShapeGeometry(fletchShape)
    fletch.rotateX(Math.PI / 2)

    // Bone nock
    const nock = new THREE.CylinderGeometry(0.0048, 0.0048, 0.02, 8)
    nock.rotateX(Math.PI / 2)

    const sMat = new THREE.MeshStandardMaterial({
      color: '#5c381e',
      roughness: 0.45,
      metalness: 0.05,
    })

    const tMat = new THREE.MeshStandardMaterial({
      color: '#2a2f35',
      roughness: 0.22,
      metalness: 0.9,
    })

    const fMat = new THREE.MeshStandardMaterial({
      color: '#2e7d32',
      roughness: 0.5,
      side: THREE.DoubleSide,
    })

    const nMat = new THREE.MeshStandardMaterial({
      color: '#e8e0d5',
      roughness: 0.35,
    })

    return {
      shaftGeo: shaft,
      tipGeo: tip,
      fletchGeo: fletch,
      nockGeo: nock,
      shaftMat: sMat,
      tipMat: tMat,
      fletchMat: fMat,
      nockMat: nMat,
    }
  }, [])

  // Expose spawn method to parent
  useImperativeHandle(ref, () => ({
    spawnArrow: (origin: THREE.Vector3, direction: THREE.Vector3, power: number) => {
      recordShot()

      // Hunting arrow ballistic speed: 45 m/s to 82 m/s
      const speed = 45 + power * 37
      const vel = direction.clone().multiplyScalar(speed)
      // Aerodynamic slight lift
      vel.y += 0.5 * power

      // Initial rotation facing fire vector
      const rot = new THREE.Euler()
      const dummy = new THREE.Object3D()
      dummy.position.copy(origin)
      dummy.lookAt(origin.clone().add(direction))
      rot.copy(dummy.rotation)

      const newArrow: FlyingArrow = {
        id: Date.now() + Math.random(),
        pos: origin.clone(),
        vel,
        rot,
        stuck: false,
        wobbleAmp: 0,
        wobbleFreq: 26,
        wobbleTime: 0,
        life: 0,
      }

      setArrows((prev) => [...prev.slice(-MAX_ARROWS + 1), newArrow])
    },
  }))

  // ── Physics & Target Raycasting Loop ───────────────────────────────────────
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const currentShrines = useQuestStore.getState().shrines

    let arrowsUpdated = false
    const activeArrows = [...arrowsRef.current]

    for (let i = activeArrows.length - 1; i >= 0; i--) {
      const a = activeArrows[i]
      a.life += dt

      // Despawn arrows after 12 seconds
      if (a.life > 12.0) {
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

      // Aerodynamic rotation (tip faces into velocity vector)
      const lookTarget = a.pos.clone().add(a.vel)
      const dummy = new THREE.Object3D()
      dummy.position.copy(a.pos)
      dummy.lookAt(lookTarget)
      a.rot.copy(dummy.rotation)

      arrowsUpdated = true

      // ── Collision Check 0: Environment Colliders (Trees, Rocks, Shrines) ────
      const envHit = worldCollisionSystem.checkRay(prevPos, a.pos, 0.05)
      if (envHit) {
        a.pos.copy(envHit.hitPoint)
        a.stuck = true
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

          // Target orbital position relative to shrine
          const angle = (tIdx * (Math.PI * 2)) / 3 + 0.4
          const targetRad = 5.2
          const targetWorldX = shrine.position[0] + Math.cos(angle) * targetRad
          const targetWorldZ = shrine.position[2] + Math.sin(angle) * targetRad
          const targetWorldY = getOpenWorldHeight(targetWorldX, targetWorldZ) + 2.5

          const targetPos = new THREE.Vector3(targetWorldX, targetWorldY, targetWorldZ)

          // Distance from arrow segment to target center
          const closestPt = new THREE.Vector3()
          motionSegment.closestPointToPoint(targetPos, true, closestPt)
          const dist = closestPt.distanceTo(targetPos)

          if (dist < 1.05) { // Bullseye hit radius
            hitTarget(shrine.id, tIdx)

            // Spawn radiant elemental sparks
            const newSparks: SparkParticle[] = []
            for (let s = 0; s < 22; s++) {
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
        a.pos.y = terrainY
        a.stuck = true
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
        // Calculate kinetic wobble rotation when stuck
        const wobble =
          a.stuck && a.wobbleAmp > 0.001
            ? Math.sin(a.wobbleTime * a.wobbleFreq) * a.wobbleAmp * Math.exp(-a.wobbleTime * 6)
            : 0

        return (
          <group
            key={a.id}
            position={[a.pos.x, a.pos.y, a.pos.z]}
            rotation={[a.rot.x + wobble, a.rot.y, a.rot.z + wobble]}
          >
            {/* Damascus Steel Broadhead Tip (at pivot (0, 0, 0), facing forward -Z) */}
            <mesh geometry={tipGeo} material={tipMat} position={[0, 0, 0]} />

            {/* Cedar Shaft (0.74m length, extending backward along +Z) */}
            <mesh geometry={shaftGeo} material={shaftMat} position={[0, 0, 0.37]} castShadow />

            {/* Carved Bone Nock (at rear tail z = 0.74) */}
            <mesh geometry={nockGeo} material={nockMat} position={[0, 0, 0.74]} />

            {/* Fletching Feathers (3 vanes at rear tail) */}
            {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
              <group key={i} position={[0, 0, 0.66]} rotation={[0, 0, angle]}>
                <mesh geometry={fletchGeo} material={fletchMat} position={[0, 0.005, 0]} />
              </group>
            ))}
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
