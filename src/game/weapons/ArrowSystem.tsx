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

const GRAVITY = -11.5 // Natural ballistic drop (m/s^2)
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

  // ── Realistic 3D Arrow Mesh Template (Length 0.76m, tip at (0,0,0) facing +Z) ──
  const { shaftGeo, tipGeo, ferruleGeo, fletchGeo, nockGeo, shaftMat, tipMat, ferruleMat, fletchMat, nockMat, trailMat } = useMemo(() => {
    // 1. Broadhead Razor Blade (Point at z = 0, barbs at z = -0.05, facing +Z)
    const tipShape = new THREE.Shape()
    tipShape.moveTo(0, 0.0) // Point
    tipShape.lineTo(0.016, -0.05) // Right barb
    tipShape.lineTo(0.005, -0.04)
    tipShape.lineTo(0.005, -0.055)
    tipShape.lineTo(-0.005, -0.055)
    tipShape.lineTo(-0.005, -0.04)
    tipShape.lineTo(-0.016, -0.05) // Left barb
    tipShape.closePath()

    const tip = new THREE.ExtrudeGeometry(tipShape, {
      depth: 0.0028,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0012,
      bevelThickness: 0.0012,
    })
    // Rotate so tip is at (0,0,0) pointing +Z, barbs extend backward along -Z
    tip.rotateX(Math.PI / 2)

    // 2. Metal Ferrule Collar connecting broadhead to shaft (z = -0.045 to -0.065)
    const ferrule = new THREE.CylinderGeometry(0.0055, 0.0048, 0.024, 8)
    ferrule.rotateX(Math.PI / 2)

    // 3. Cedar Wood Shaft: diameter 10mm, length 0.68m, extends from z = -0.05 to z = -0.73
    const shaft = new THREE.CylinderGeometry(0.005, 0.005, 0.68, 8)
    shaft.rotateX(Math.PI / 2)

    // 4. White Turkey Feathers (3 vanes at rear tail, z = -0.62 to -0.71)
    const fletchShape = new THREE.Shape()
    fletchShape.moveTo(0, 0)
    fletchShape.lineTo(0.015, -0.014)
    fletchShape.lineTo(0.012, -0.088)
    fletchShape.lineTo(0, -0.078)
    fletchShape.closePath()
    const fletch = new THREE.ShapeGeometry(fletchShape)
    fletch.rotateX(Math.PI / 2) // Extends backward along -Z

    // 5. Carved Bone Nock (at rear tail z = -0.73)
    const nock = new THREE.CylinderGeometry(0.0055, 0.0055, 0.022, 8)
    nock.rotateX(Math.PI / 2)

    // Materials
    const sMat = new THREE.MeshStandardMaterial({
      color: '#764825',
      roughness: 0.42,
      metalness: 0.05,
    })

    const tMat = new THREE.MeshStandardMaterial({
      color: '#edf2f7', // Clean razor silver broadhead blade
      roughness: 0.18,
      metalness: 0.96,
    })

    const feMat = new THREE.MeshStandardMaterial({
      color: '#383d42',
      roughness: 0.32,
      metalness: 0.85,
    })

    const fMat = new THREE.MeshStandardMaterial({
      color: '#ffffff', // Crisp bright white feathers (matches reference image)
      roughness: 0.50,
      side: THREE.DoubleSide,
    })

    const nMat = new THREE.MeshStandardMaterial({
      color: '#f5efe4',
      roughness: 0.32,
    })

    const trMat = new THREE.LineBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.70,
      linewidth: 2,
    })

    return {
      shaftGeo: shaft,
      tipGeo: tip,
      ferruleGeo: ferrule,
      fletchGeo: fletch,
      nockGeo: nock,
      shaftMat: sMat,
      tipMat: tMat,
      ferruleMat: feMat,
      fletchMat: fMat,
      nockMat: nMat,
      trailMat: trMat,
    }
  }, [])

  // Expose spawn method to parent
  useImperativeHandle(ref, () => ({
    spawnArrow: (origin: THREE.Vector3, direction: THREE.Vector3, power: number) => {
      recordShot()

      // Gameplay ballistic speed: 46 m/s to 68 m/s (punchy, readable frame-by-frame)
      const speed = 46 + power * 22
      const vel = direction.clone().multiplyScalar(speed)
      vel.y += 0.35 * power // subtle aerodynamic lift

      // Initial orientation: align local +Z (broadhead razor blade) strictly with direction of flight
      const fwd = direction.clone().normalize()
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd)

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
        trail: [origin.clone()],
      }

      setArrows((prev) => {
        const next = [...prev, newArrow]
        return next.length > MAX_ARROWS ? next.slice(-MAX_ARROWS) : next
      })
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

      // Aerodynamic rotation: local +Z (broadhead razor blade) strictly tracks velocity vector
      const fwd = a.vel.clone().normalize()
      a.quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd)

      // Append trail point at the tail of the arrow (0.70m behind tip)
      const tailPos = a.pos.clone().addScaledVector(fwd, -0.70)
      a.trail.push(tailPos)
      if (a.trail.length > 16) {
        a.trail.shift()
      }

      arrowsUpdated = true

      // ── Collision Check 0: Environment Colliders (Trees, Rocks, Shrines) ────
      const envHit = worldCollisionSystem.checkRay(prevPos, a.pos, 0.06)
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

        // Create flight trail geometry if flying
        const hasTrail = !a.stuck && a.trail.length > 1
        let trailLineGeo: THREE.BufferGeometry | null = null
        if (hasTrail) {
          trailLineGeo = new THREE.BufferGeometry().setFromPoints(a.trail)
        }

        return (
          <group key={a.id}>
            {/* Aerodynamic luminous slipstream trail */}
            {hasTrail && trailLineGeo && (
              <primitive object={new THREE.Line(trailLineGeo, trailMat)} />
            )}

            {/* The Arrow Mesh: pivot at broadhead tip (0,0,0), +Z is flight forward */}
            <group
              position={[a.pos.x, a.pos.y, a.pos.z]}
              quaternion={renderQuat}
            >
              {/* 1. Silver Broadhead Razor Blade (at front z = 0, pointing +Z) */}
              <mesh geometry={tipGeo} material={tipMat} position={[0, 0, 0]} />

              {/* 2. Metal Ferrule Collar (z = -0.05) */}
              <mesh geometry={ferruleGeo} material={ferruleMat} position={[0, 0, -0.055]} />

              {/* 3. Cedar Wood Shaft (centered at z = -0.39, extends from -0.05 to -0.73) */}
              <mesh geometry={shaftGeo} material={shaftMat} position={[0, 0, -0.39]} castShadow />

              {/* 4. Carved Bone Nock (at rear tail z = -0.73) */}
              <mesh geometry={nockGeo} material={nockMat} position={[0, 0, -0.73]} />

              {/* 5. 3 White Turkey Feathers (at rear tail z = -0.63 to -0.72) */}
              {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
                <group key={i} position={[0, 0, -0.63]} rotation={[0, 0, angle]}>
                  <mesh geometry={fletchGeo} material={fletchMat} position={[0, 0.005, 0]} />
                </group>
              ))}
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
