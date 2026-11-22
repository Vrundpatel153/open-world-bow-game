// ─────────────────────────────────────────────────────────────────────────────
// SwordViewModel — AAA First-Person Wooden Training Sword Viewmodel
// Features:
// - Authentic Hand-Carved Hardwood Blade (Bokken / Timber Broadsword)
// - Fluid 3-Click Combo System:
//     Hit 1: Swift Diagonal Left-to-Right Slash
//     Hit 2: Agile Horizontal Right-to-Left Return Cut
//     Hit 3: Heavy Overhead Finisher Cleave with Bass Punch
// - Hold & Release Charged Heavy Attack:
//     Hold LMB: Coils into high guard with vibrating tension
//     Release: Explosive sonic whirlwind power sweep
// - RMB Defensive Guard / Parry Stance
// - Translucent Golden Blade Arc / Slash Ribbon Trail
// - Real-Time Grass Wind Shockwave on Every Swing
// - Rock Collision Detection: Spawns Incandescent Scratch Sparks & Hit-Stop Kick
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useQuestStore } from '../stores/questStore'
import { sound } from '../audio/SoundSynthesizer'
import { inputManager } from '@/systems/KeyboardInput'
import { worldCollisionSystem } from '@/game/physics/WorldCollisionSystem'

interface SwordViewModelProps {
  onHitRock?: (hitPoint: THREE.Vector3, normal: THREE.Vector3, power: number) => void
  onSwordSwingWind?: (origin: THREE.Vector3, dir: THREE.Vector3, power: number) => void
}

type SwingType = 'none' | 'combo1' | 'combo2' | 'combo3' | 'heavy'

export default function SwordViewModel({ onHitRock, onSwordSwingWind }: SwordViewModelProps) {
  const { camera } = useThree()
  const swordRootRef = useRef<THREE.Group>(null!)
  const slashTrailRef = useRef<THREE.Mesh>(null!)

  const activeItem = useQuestStore((s) => s.activeItem)
  const isSwordActive = activeItem === 'sword'

  const equipProgress = useRef(0.0)
  const walkBobTimer = useRef(0)
  const breathTimer = useRef(0)
  const wasActive = useRef(false)

  // ── Combat State Machine ───────────────────────────────────────────────────
  const currentSwing = useRef<SwingType>('none')
  const swingTimer = useRef(0)
  const swingDuration = useRef(0.22)
  const comboWindowTimer = useRef(0)
  const lastComboIndex = useRef(0)

  // Heavy charge attack
  const isHoldingLMB = useRef(false)
  const holdStartTime = useRef(0)
  const isCharged = useRef(false)
  const isGuarding = useRef(false)

  // Hit-stop & recoil
  const hitStopTimer = useRef(0)
  const hasHitInCurrentSwing = useRef(false)

  // ── 3D Procedural Geometries for Wooden Sword ──────────────────────────────
  const {
    bladeGeo,
    edgeHighlightGeo,
    guardGeo,
    gripGeo,
    pommelGeo,
    trailGeo,
  } = useMemo(() => {
    // 1. Carved Heartwood Oak Blade (Length ~0.76m, Width ~0.042m)
    const bladeShape = new THREE.Shape()
    bladeShape.moveTo(-0.021, 0)
    bladeShape.lineTo(-0.019, 0.64)
    bladeShape.lineTo(0.0, 0.76) // Sharp carved point
    bladeShape.lineTo(0.019, 0.64)
    bladeShape.lineTo(0.021, 0)
    bladeShape.closePath()

    const extrudeSettings = {
      depth: 0.018,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.003,
      bevelThickness: 0.004,
    }
    const blade = new THREE.ExtrudeGeometry(bladeShape, extrudeSettings)
    blade.center()
    blade.translate(0, 0.38, 0)

    // Beveled ridge spine down the blade center
    const edge = new THREE.BoxGeometry(0.006, 0.68, 0.022)
    edge.translate(0, 0.35, 0)

    // 2. Carved Walnut Guard (Tsuba)
    const guard = new THREE.CylinderGeometry(0.052, 0.048, 0.018, 16)
    guard.scale(1.2, 1.0, 0.65) // Oval cross-section

    // 3. Cord-Wrapped Two-Hand Grip
    const grip = new THREE.CylinderGeometry(0.018, 0.019, 0.22, 12)
    grip.translate(0, -0.12, 0)

    // 4. Octagonal Weighted Pommel
    const pommel = new THREE.CylinderGeometry(0.026, 0.022, 0.038, 8)
    pommel.translate(0, -0.24, 0)

    // 5. Slash Arc Ribbon Geometry
    const trail = new THREE.RingGeometry(0.48, 0.72, 24, 1, 0, Math.PI * 0.65)

    return {
      bladeGeo: blade,
      edgeHighlightGeo: edge,
      guardGeo: guard,
      gripGeo: grip,
      pommelGeo: pommel,
      trailGeo: trail,
    }
  }, [])

  // Audio trigger on draw / sheath
  useEffect(() => {
    if (isSwordActive && !wasActive.current) {
      sound.playSwordEquip()
    }
    wasActive.current = isSwordActive
  }, [isSwordActive])

  useEffect(() => {
    ;(window as any).__triggerSwordSwing = (type: SwingType = 'combo1') => {
      if (type === 'heavy') executeSwing('heavy')
      else executeComboClick()
    }
  }, [])

  // ── Combat Mouse Input Handling ───────────────────────────────────────────
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!isSwordActive) return
      if ((e.target as HTMLElement)?.closest('[class*="leva"], button, a')) return

      if (e.button === 0) {
        // LMB: start tracking hold for heavy attack
        isHoldingLMB.current = true
        holdStartTime.current = performance.now()
        isCharged.current = false
      } else if (e.button === 2) {
        // RMB: Guard / Parry stance
        isGuarding.current = true
        sound.playSwordParry()
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!isSwordActive) return
      if (e.button === 0 && isHoldingLMB.current) {
        isHoldingLMB.current = false
        const holdDuration = (performance.now() - holdStartTime.current) / 1000

        // If held > 0.35s -> Unleash Heavy Charge Attack!
        if (holdDuration >= 0.35 || isCharged.current) {
          executeSwing('heavy')
        } else {
          // Quick Click -> Progress 3-Click Combo!
          executeComboClick()
        }
      } else if (e.button === 2) {
        isGuarding.current = false
      }
    }

    const preventContext = (e: MouseEvent) => {
      if (isSwordActive) e.preventDefault()
    }

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('contextmenu', preventContext)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('contextmenu', preventContext)
    }
  }, [isSwordActive])

  // ── Combo Execution Logic ─────────────────────────────────────────────────
  const executeComboClick = () => {
    // If currently mid-swing and already near the end, queue next, or ignore if busy
    if (currentSwing.current !== 'none' && swingTimer.current < swingDuration.current * 0.45) {
      return
    }

    let nextCombo = 1
    if (comboWindowTimer.current > 0) {
      if (lastComboIndex.current === 1) nextCombo = 2
      else if (lastComboIndex.current === 2) nextCombo = 3
      else nextCombo = 1
    }

    const swingName: SwingType = nextCombo === 1 ? 'combo1' : nextCombo === 2 ? 'combo2' : 'combo3'
    executeSwing(swingName, nextCombo)
  }

  const executeSwing = (type: SwingType, comboIndex = 1) => {
    currentSwing.current = type
    hasHitInCurrentSwing.current = false

    if (type === 'heavy') {
      swingDuration.current = 0.38
      sound.playSwordChargeRelease()
      triggerGrassWind(1.6)
    } else {
      swingDuration.current = comboIndex === 3 ? 0.34 : 0.22
      sound.playSwordSwing(comboIndex)
      lastComboIndex.current = comboIndex
      comboWindowTimer.current = 0.55 // Window to continue combo
      triggerGrassWind(comboIndex === 3 ? 1.3 : 1.0)
    }

    swingTimer.current = swingDuration.current
  }

  const triggerGrassWind = (power: number) => {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    onSwordSwingWind?.(camera.position, fwd, power)
  }

  // ── Per-Frame Viewmodel Rig, Swing Interpolation & Rock Collision ──────────
  useFrame((state, delta) => {
    if (!swordRootRef.current) return
    const dt = Math.min(delta, 0.05)

    // Equip / Unequip transition
    const targetEquip = isSwordActive ? 1.0 : 0.0
    equipProgress.current = THREE.MathUtils.damp(equipProgress.current, targetEquip, 9, dt)

    if (equipProgress.current < 0.02 && !isSwordActive) {
      swordRootRef.current.visible = false
      return
    }
    swordRootRef.current.visible = true

    // Combo window countdown
    if (comboWindowTimer.current > 0) {
      comboWindowTimer.current -= dt
      if (comboWindowTimer.current <= 0) {
        lastComboIndex.current = 0
      }
    }

    // Heavy charge tracking
    if (isHoldingLMB.current && currentSwing.current === 'none') {
      const holdTime = (performance.now() - holdStartTime.current) / 1000
      if (holdTime > 0.35 && !isCharged.current) {
        isCharged.current = true
        sound.playSwordParry()
      }
    }

    // Hit-stop pause
    if (hitStopTimer.current > 0) {
      hitStopTimer.current -= dt
      return // Hesitate for 1-2 frames on granite collision
    }

    // 1. Natural Movement Bobbing & Sway
    const isMoving =
      inputManager.isMovingForward() ||
      inputManager.isMovingBackward() ||
      inputManager.isMovingLeft() ||
      inputManager.isMovingRight()
    const isSprinting = isMoving && inputManager.isSprinting()

    walkBobTimer.current += dt * (isMoving ? (isSprinting ? 14 : 9) : 1.5)
    breathTimer.current += dt * 1.8

    const bobX = Math.cos(walkBobTimer.current * 0.5) * (isMoving ? 0.012 : 0.002)
    const bobY = Math.sin(walkBobTimer.current) * (isMoving ? 0.015 : 0.003)
    const swayX = Math.cos(breathTimer.current * 0.5) * 0.002
    const swayY = Math.sin(breathTimer.current) * 0.002

    // 2. Base Idle Ready Stance (Bottom-right, blade pointed forward-up with natural cant)
    let posX = 0.20 + bobX + swayX
    let posY = -0.20 + bobY + swayY - (1 - equipProgress.current) * 0.5
    let posZ = -0.42
    let rotX = 0.52
    let rotY = -0.38
    let rotZ = 0.32 - (1 - equipProgress.current) * 0.9

    // 3. Guarding Stance (RMB)
    if (isGuarding.current && currentSwing.current === 'none') {
      posX = 0.02
      posY = -0.15
      posZ = -0.32
      rotX = 0.2
      rotY = 0.85
      rotZ = 1.35
    }

    // 4. Charging Stance (Hold LMB)
    if (isHoldingLMB.current && currentSwing.current === 'none') {
      const chargeShake = isCharged.current ? (Math.random() - 0.5) * 0.008 : 0
      posX = 0.28 + chargeShake
      posY = -0.14
      posZ = -0.32
      rotX = 0.85
      rotY = -0.45
      rotZ = -0.2
    }

    // 5. Active Swing Interpolation (3-Click Combo + Heavy)
    let trailAlpha = 0
    if (currentSwing.current !== 'none') {
      swingTimer.current -= dt
      const p = Math.max(0, 1.0 - swingTimer.current / swingDuration.current) // 0 to 1

      if (currentSwing.current === 'combo1') {
        // Swing 1: Quick Diagonal Slash (Left to Right)
        const t = Math.sin(p * Math.PI)
        posX = THREE.MathUtils.lerp(0.24, -0.22, p) + t * 0.1
        posY = THREE.MathUtils.lerp(-0.18, -0.32, p)
        posZ = -0.35 - t * 0.15
        rotX = 0.2 + t * 0.4
        rotY = THREE.MathUtils.lerp(-0.2, 1.4, p)
        rotZ = THREE.MathUtils.lerp(0.2, -0.85, p)
        trailAlpha = t * 0.85
      } else if (currentSwing.current === 'combo2') {
        // Swing 2: Return Slash (Right to Left horizontal)
        const t = Math.sin(p * Math.PI)
        posX = THREE.MathUtils.lerp(-0.22, 0.26, p) - t * 0.1
        posY = THREE.MathUtils.lerp(-0.28, -0.16, p)
        posZ = -0.35 - t * 0.15
        rotX = 0.15 + t * 0.3
        rotY = THREE.MathUtils.lerp(1.2, -1.1, p)
        rotZ = THREE.MathUtils.lerp(-0.6, 0.75, p)
        trailAlpha = t * 0.85
      } else if (currentSwing.current === 'combo3') {
        // Swing 3: Heavy Finisher Cleave (High overhead downward slam)
        const t = Math.sin(p * Math.PI)
        posX = THREE.MathUtils.lerp(0.08, -0.02, p)
        posY = THREE.MathUtils.lerp(0.08, -0.42, p)
        posZ = -0.32 - t * 0.18
        rotX = THREE.MathUtils.lerp(1.1, -0.4, p)
        rotY = 0.05
        rotZ = THREE.MathUtils.lerp(0.1, -0.15, p)
        trailAlpha = t * 0.95
      } else if (currentSwing.current === 'heavy') {
        // Heavy Power Whirlwind Cleave
        const t = Math.sin(p * Math.PI)
        posX = THREE.MathUtils.lerp(0.32, -0.34, p)
        posY = -0.22 + t * 0.08
        posZ = -0.32 - t * 0.24
        rotX = 0.3
        rotY = THREE.MathUtils.lerp(-0.8, 2.1, p)
        rotZ = THREE.MathUtils.lerp(0.4, -1.2, p)
        trailAlpha = t * 1.0
      }

      // Check Rock Collision during the active strike window (p between 0.25 and 0.55)
      if (!hasHitInCurrentSwing.current && p >= 0.25 && p <= 0.55) {
        checkRockCollision()
      }

      if (swingTimer.current <= 0) {
        currentSwing.current = 'none'
      }
    }

    // Apply viewmodel transform relative to camera
    const localPos = new THREE.Vector3(posX, posY, posZ)
    const worldPos = localPos.applyQuaternion(camera.quaternion).add(camera.position)
    swordRootRef.current.position.copy(worldPos)

    swordRootRef.current.quaternion.copy(camera.quaternion)
    const swingEuler = new THREE.Euler(rotX, rotY, rotZ, 'YXZ')
    swordRootRef.current.quaternion.multiply(new THREE.Quaternion().setFromEuler(swingEuler))

    // Update slash trail ribbon
    if (slashTrailRef.current) {
      slashTrailRef.current.visible = trailAlpha > 0.05
      const mat = slashTrailRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = trailAlpha * 0.65
    }
  })

  // ── Raycast Rock Collision Detection ──────────────────────────────────────
  const checkRockCollision = () => {
    const rayOrigin = camera.position
    const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const rayEnd = rayOrigin.clone().addScaledVector(rayDir, 2.4)

    const hit = worldCollisionSystem.checkRay(rayOrigin, rayEnd, 0.35)
    if (hit && hit.collider.tag === 'rock') {
      hasHitInCurrentSwing.current = true
      const power = currentSwing.current === 'heavy' ? 1.5 : currentSwing.current === 'combo3' ? 1.3 : 1.0

      // Audio: hard wood on granite clack & crack
      sound.playRockStrike(power)

      // Hit-stop feedback: 45ms freeze frame
      hitStopTimer.current = 0.045

      // Visual scratch sparks & dust particles at impact normal
      onHitRock?.(hit.hitPoint, hit.normal, power)
    }
  }

  return (
    <group ref={swordRootRef} visible={false}>
      {/* 1. Carved Oak Heartwood Blade */}
      <mesh geometry={bladeGeo} castShadow receiveShadow>
        <meshStandardMaterial
          color="#563e2c"
          roughness={0.72}
          metalness={0.06}
        />
      </mesh>

      {/* 2. Chamfered Blade Ridge Spine */}
      <mesh geometry={edgeHighlightGeo}>
        <meshStandardMaterial
          color="#846246"
          roughness={0.65}
        />
      </mesh>

      {/* 3. Carved Walnut Tsuba Crossguard */}
      <mesh geometry={guardGeo} castShadow>
        <meshStandardMaterial
          color="#332419"
          roughness={0.82}
          metalness={0.15}
        />
      </mesh>

      {/* 4. Cord-Wrapped Two-Hand Grip */}
      <mesh geometry={gripGeo}>
        <meshStandardMaterial
          color="#221812"
          roughness={0.92}
        />
      </mesh>

      {/* 5. Octagonal Weighted Pommel */}
      <mesh geometry={pommelGeo} castShadow>
        <meshStandardMaterial
          color="#6e5033"
          roughness={0.65}
          metalness={0.35}
        />
      </mesh>

      {/* 6. Dynamic Translucent Golden Slash Arc Ribbon */}
      <mesh
        ref={slashTrailRef}
        geometry={trailGeo}
        position={[0, 0.45, 0]}
        rotation={[-Math.PI * 0.4, 0, -0.4]}
        visible={false}
      >
        <meshBasicMaterial
          color="#ffe17d"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
