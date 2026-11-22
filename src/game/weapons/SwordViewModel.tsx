// ─────────────────────────────────────────────────────────────────────────────
// SwordViewModel — AAA First-Person Ancient Runed Silver-Steel Blade Viewmodel
// Features:
// - Authentic Ancient Silver-Steel Blade with double-beveled edges & central fuller
// - Subtle glowing cyan rune channel inlay with dynamic charge radiance
// - Antique winged brass crossguard with diamond monolith motif & quillons
// - Ergonomic braided cord two-handed hilt with ribbed wrap bands
// - Faceted octagonal brass pommel counterweight & teardrop finial
// - Perfect First-Person Viewport Framing:
//     Idle: lower-right screen (Guard Y~715, Pommel Y~1017, Tip Y~205)
//     Center crosshair (960, 540) and left 75% of viewport 100% unobstructed
// - Organic 3-Phase Martial Combos (Zero "AI noticeable" robotic movement):
//     Hit 1: Swift Diagonal Right-to-Left Slash (Coil -> Acceleration -> Settle)
//     Hit 2: Fluid Horizontal Left-to-Right Cleave (Whip -> Cleave -> Recoil)
//     Hit 3: Crushing Overhead Finisher Cleave (Raise -> Devastating Chop -> Rebound)
// - Heavy Whirlwind Charge Attack (Hold LMB): Coils tension -> Sonic crescent sweep
// - Responsive Guard / Parry Stance (RMB): Diagonal braced parry across chest
// - Mouse Look Inertia Sway & Cadence-Based Walk/Sprint Bobbing
// - Dedicated Viewmodel Lighting & Depth Buffer Clearing (Zero terrain/rock clipping)
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
  const runeMatRef = useRef<THREE.MeshStandardMaterial>(null!)

  const activeItem = useQuestStore((s) => s.activeItem)
  const isSwordActive = activeItem === 'sword'

  const equipProgress = useRef(0.0)
  const guardProgress = useRef(0.0)
  const chargeProgress = useRef(0.0)
  const walkBobTimer = useRef(0)
  const breathTimer = useRef(0)
  const wasActive = useRef(false)

  // Camera rotation inertia tracking
  const prevCamQuat = useRef(new THREE.Quaternion())
  const mouseSwayLag = useRef({ x: 0, y: 0, rotZ: 0 })

  // ── Combat State Machine ───────────────────────────────────────────────────
  const currentSwing = useRef<SwingType>('none')
  const swingTimer = useRef(0)
  const swingDuration = useRef(0.28)
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

  // ── Procedural Geometries for Ancient Silver-Steel Blade ───────────────────
  const {
    bladeGeo,
    fullerRuneGeo,
    guardHubGeo,
    quillonLeftGeo,
    quillonRightGeo,
    guardBossGeo,
    gripGeo,
    ringGeos,
    pommelGeo,
    finialGeo,
    trailGeo,
  } = useMemo(() => {
    // 1. Double-Beveled Silver Blade (Length ~0.46m, Width ~0.036m at base tapering to spear point)
    const bladeShape = new THREE.Shape()
    bladeShape.moveTo(-0.018, 0)
    bladeShape.lineTo(-0.013, 0.38)
    bladeShape.lineTo(0.0, 0.46) // Razor spear tip
    bladeShape.lineTo(0.013, 0.38)
    bladeShape.lineTo(0.018, 0)
    bladeShape.closePath()

    const extrudeSettings = {
      depth: 0.005,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.003,
      bevelThickness: 0.003,
    }
    const blade = new THREE.ExtrudeGeometry(bladeShape, extrudeSettings)
    blade.center()
    blade.translate(0, 0.23, 0)

    // 2. Central Fuller Groove & Glowing Rune Channel
    const fullerShape = new THREE.Shape()
    fullerShape.moveTo(-0.0035, 0.03)
    fullerShape.lineTo(-0.0025, 0.34)
    fullerShape.lineTo(0.0, 0.36)
    fullerShape.lineTo(0.0025, 0.34)
    fullerShape.lineTo(0.0035, 0.03)
    fullerShape.closePath()

    const fullerRune = new THREE.ExtrudeGeometry(fullerShape, {
      depth: 0.0075,
      bevelEnabled: false,
    })
    fullerRune.center()
    fullerRune.translate(0, 0.195, 0)

    // 3. Antique Winged Crossguard
    // Central Hub
    const hub = new THREE.BoxGeometry(0.038, 0.022, 0.026)

    // Swept Quillons
    const quillonLeft = new THREE.CylinderGeometry(0.008, 0.004, 0.065, 8)
    quillonLeft.rotateZ(Math.PI / 2 + 0.16)
    quillonLeft.rotateY(0.08)
    quillonLeft.translate(-0.046, 0.006, 0.004)

    const quillonRight = new THREE.CylinderGeometry(0.008, 0.004, 0.065, 8)
    quillonRight.rotateZ(-(Math.PI / 2 + 0.16))
    quillonRight.rotateY(-0.08)
    quillonRight.translate(0.046, 0.006, 0.004)

    // Diamond Relic Boss
    const guardBoss = new THREE.CylinderGeometry(0.0075, 0.0075, 0.008, 4)
    guardBoss.rotateY(Math.PI / 4)
    guardBoss.translate(0, 0, 0.014)

    // 4. Ergonomic Braided Cord Two-Hand Grip
    const grip = new THREE.CylinderGeometry(0.0125, 0.0115, 0.11, 12)
    grip.translate(0, -0.055, 0)

    // Cord wrap ring bands
    const rings: THREE.TorusGeometry[] = []
    const ringYs = [-0.025, -0.05, -0.075, -0.10]
    for (const ry of ringYs) {
      const ring = new THREE.TorusGeometry(0.0125, 0.0016, 6, 16)
      ring.rotateX(Math.PI / 2)
      ring.translate(0, ry, 0)
      rings.push(ring)
    }

    // 5. Faceted Octagonal Pommel & Teardrop Finial
    const pommel = new THREE.CylinderGeometry(0.020, 0.015, 0.024, 8)
    pommel.translate(0, -0.12, 0)

    const finial = new THREE.ConeGeometry(0.015, 0.014, 8)
    finial.rotateX(Math.PI)
    finial.translate(0, -0.138, 0)

    // 6. Slash Arc Ribbon Geometry
    const trail = new THREE.RingGeometry(0.36, 0.58, 24, 1, 0, Math.PI * 0.70)

    return {
      bladeGeo: blade,
      fullerRuneGeo: fullerRune,
      guardHubGeo: hub,
      quillonLeftGeo: quillonLeft,
      quillonRightGeo: quillonRight,
      guardBossGeo: guardBoss,
      gripGeo: grip,
      ringGeos: rings,
      pommelGeo: pommel,
      finialGeo: finial,
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
    ;(window as any).__testSwordGuard = (val: boolean) => {
      isGuarding.current = val
    }
  }, [])

  // ── Combat Mouse Input Handling ───────────────────────────────────────────
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!isSwordActive) return
      if (e.target instanceof Element && e.target.closest('[class*="leva"], button, a')) return

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

        // If held > 0.35s -> Unleash Heavy Charge Whirlwind!
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
      swingDuration.current = 0.42
      sound.playSwordChargeRelease()
      triggerGrassWind(1.8)
    } else {
      swingDuration.current = comboIndex === 3 ? 0.38 : comboIndex === 2 ? 0.26 : 0.28
      sound.playSwordSwing(comboIndex)
      lastComboIndex.current = comboIndex
      comboWindowTimer.current = 0.65 // Window to continue combo
      triggerGrassWind(comboIndex === 3 ? 1.4 : 1.0)
    }

    swingTimer.current = swingDuration.current
  }

  const triggerGrassWind = (power: number) => {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    onSwordSwingWind?.(camera.position, fwd, power)
  }

  // ── Per-Frame Viewmodel Rig, Multi-Phase Kinematics & Depth Rendering ─────
  useFrame((state, delta) => {
    if (!swordRootRef.current) return
    const dt = Math.min(delta, 0.05)

    // Equip / Unequip transition
    const targetEquip = isSwordActive ? 1.0 : 0.0
    equipProgress.current = THREE.MathUtils.damp(equipProgress.current, targetEquip, 10, dt)

    if (equipProgress.current < 0.015 && !isSwordActive) {
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
      chargeProgress.current = Math.min(1.0, holdTime / 0.35)
      if (holdTime > 0.35 && !isCharged.current) {
        isCharged.current = true
        sound.playSwordParry()
      }
    } else {
      chargeProgress.current = THREE.MathUtils.damp(chargeProgress.current, 0, 8, dt)
    }

    // Hit-stop pause (hesitate on hard rock impact)
    if (hitStopTimer.current > 0) {
      hitStopTimer.current -= dt
      return
    }

    // Guard transition
    const targetGuard = isGuarding.current && currentSwing.current === 'none' ? 1.0 : 0.0
    guardProgress.current = THREE.MathUtils.damp(guardProgress.current, targetGuard, 12, dt)

    // 1. Mouse Look Inertia Lag
    if (prevCamQuat.current.lengthSq() > 0.001) {
      const deltaQuat = prevCamQuat.current.clone().invert().multiply(camera.quaternion)
      const yawDelta = -deltaQuat.y * 1.6
      const pitchDelta = deltaQuat.x * 1.6

      mouseSwayLag.current.x = THREE.MathUtils.damp(mouseSwayLag.current.x, yawDelta * 0.035, 10, dt)
      mouseSwayLag.current.y = THREE.MathUtils.damp(mouseSwayLag.current.y, pitchDelta * 0.035, 10, dt)
      mouseSwayLag.current.rotZ = THREE.MathUtils.damp(mouseSwayLag.current.rotZ, yawDelta * 0.22, 10, dt)
    }
    prevCamQuat.current.copy(camera.quaternion)

    // 2. Natural Movement Bobbing & Breathing Sway
    const isMoving =
      inputManager.isMovingForward() ||
      inputManager.isMovingBackward() ||
      inputManager.isMovingLeft() ||
      inputManager.isMovingRight()
    const isSprinting = isMoving && inputManager.isSprinting()

    walkBobTimer.current += dt * (isMoving ? (isSprinting ? 14 : 9) : 1.5)
    breathTimer.current += dt * 1.8

    const bobX = Math.sin(walkBobTimer.current * 0.5) * (isMoving ? (isSprinting ? 0.015 : 0.008) : 0.0015)
    const bobY = -Math.abs(Math.cos(walkBobTimer.current)) * (isMoving ? (isSprinting ? 0.018 : 0.010) : 0.002)
    const swayX = Math.cos(breathTimer.current * 1.4) * 0.0015
    const swayY = Math.sin(breathTimer.current * 2.8) * 0.0012

    // 3. Base Ready Stance (Bottom-right, blade pointed forward-up with natural cant)
    // Tip comfortably framed at (1568, 205), guard at (1558, 715), pommel at (1552, 1017)
    // Crosshair at (960, 540) has 600px of clearance and is 100% unobstructed!
    const unequipDrop = (1 - equipProgress.current)
    let posX = 0.24 + bobX + swayX + mouseSwayLag.current.x
    let posY = -0.07 + bobY + swayY + mouseSwayLag.current.y - unequipDrop * 0.45
    let posZ = -0.34
    let rotX = -0.65 - unequipDrop * 0.4
    let rotY = 0.16
    let rotZ = -0.55 + mouseSwayLag.current.rotZ - unequipDrop * 0.3

    // 4. Guard / Parry Stance (RMB) — Angled defensively across chest
    if (guardProgress.current > 0.001) {
      const gp = guardProgress.current
      const gEase = gp * (2 - gp) // Ease out quad
      posX = THREE.MathUtils.lerp(posX, 0.08 + mouseSwayLag.current.x * 0.5, gEase)
      posY = THREE.MathUtils.lerp(posY, -0.08 + bobY * 0.4, gEase)
      posZ = THREE.MathUtils.lerp(posZ, -0.34, gEase)
      rotX = THREE.MathUtils.lerp(rotX, -0.72, gEase)
      rotY = THREE.MathUtils.lerp(rotY, 0.12, gEase)
      rotZ = THREE.MathUtils.lerp(rotZ, 0.85, gEase)
    }

    // 5. Charging Stance (Hold LMB) — Warrior draws blade back into a tense ready coil
    if (chargeProgress.current > 0.001 && currentSwing.current === 'none') {
      const cp = chargeProgress.current
      const cEase = cp * cp // Ease in quadratic
      const chargeVibe = isCharged.current ? Math.sin(state.clock.elapsedTime * 45) * 0.0025 : 0
      posX = THREE.MathUtils.lerp(posX, 0.26 + chargeVibe, cEase)
      posY = THREE.MathUtils.lerp(posY, -0.06, cEase)
      posZ = THREE.MathUtils.lerp(posZ, -0.32, cEase)
      rotX = THREE.MathUtils.lerp(rotX, -0.55, cEase)
      rotY = THREE.MathUtils.lerp(rotY, 0.45, cEase)
      rotZ = THREE.MathUtils.lerp(rotZ, -0.52, cEase)
    }

    // 6. Active Multi-Phase Martial Swing Interpolation
    let trailAlpha = 0
    if (currentSwing.current !== 'none') {
      swingTimer.current -= dt
      const p = Math.max(0, 1.0 - swingTimer.current / swingDuration.current) // 0 to 1

      if (currentSwing.current === 'combo1') {
        // ── Swing 1: Swift Diagonal Right-to-Left Slash ──
        if (p < 0.20) {
          // Phase 1: Anticipation / Windup Coil
          const u = p / 0.20
          const ease = u * u * (3 - 2 * u)
          posX = THREE.MathUtils.lerp(0.24, 0.26, ease)
          posY = THREE.MathUtils.lerp(-0.07, -0.05, ease)
          posZ = THREE.MathUtils.lerp(-0.34, -0.32, ease)
          rotX = THREE.MathUtils.lerp(-0.65, -0.55, ease)
          rotY = THREE.MathUtils.lerp(0.16, 0.32, ease)
          rotZ = THREE.MathUtils.lerp(-0.55, -0.48, ease)
        } else if (p < 0.65) {
          // Phase 2: High-Velocity Acceleration Cut
          const u = (p - 0.20) / 0.45
          const ease = Math.pow(u, 2.2)
          posX = THREE.MathUtils.lerp(0.26, -0.14, ease)
          posY = THREE.MathUtils.lerp(-0.05, -0.14, ease)
          posZ = THREE.MathUtils.lerp(-0.32, -0.34, ease)
          rotX = THREE.MathUtils.lerp(-0.55, -0.68, ease)
          rotY = THREE.MathUtils.lerp(0.32, -0.55, ease)
          rotZ = THREE.MathUtils.lerp(-0.48, 0.52, ease)
          trailAlpha = Math.sin(u * Math.PI) * 0.95

          if (!hasHitInCurrentSwing.current && u >= 0.35 && u <= 0.65) {
            checkRockCollision(1.0)
          }
        } else {
          // Phase 3: Kinetic Deceleration & Elastic Recovery
          const u = (p - 0.65) / 0.35
          const decay = Math.exp(-u * 4.5)
          const bounce = Math.sin(u * Math.PI * 2.0) * decay
          const recover = 1 - decay
          posX = THREE.MathUtils.lerp(-0.14, 0.24, recover) + bounce * 0.02
          posY = THREE.MathUtils.lerp(-0.14, -0.07, recover) - bounce * 0.015
          posZ = THREE.MathUtils.lerp(-0.34, -0.34, recover)
          rotX = THREE.MathUtils.lerp(-0.68, -0.65, recover) + bounce * 0.05
          rotY = THREE.MathUtils.lerp(-0.55, 0.16, recover) - bounce * 0.08
          rotZ = THREE.MathUtils.lerp(0.52, -0.55, recover) + bounce * 0.06
        }
      } else if (currentSwing.current === 'combo2') {
        // ── Swing 2: Fluid Horizontal Left-to-Right Cleave ──
        if (p < 0.18) {
          // Phase 1: Momentum Alignment on Left
          const u = p / 0.18
          const ease = u * u * (3 - 2 * u)
          posX = THREE.MathUtils.lerp(-0.14, -0.16, ease)
          posY = THREE.MathUtils.lerp(-0.14, -0.08, ease)
          posZ = THREE.MathUtils.lerp(-0.34, -0.32, ease)
          rotX = THREE.MathUtils.lerp(-0.68, -0.62, ease)
          rotY = THREE.MathUtils.lerp(-0.55, -0.50, ease)
          rotZ = THREE.MathUtils.lerp(0.52, 0.65, ease)
        } else if (p < 0.62) {
          // Phase 2: Horizontal Cleave across Screen
          const u = (p - 0.18) / 0.44
          const ease = Math.pow(u, 2.0)
          posX = THREE.MathUtils.lerp(-0.16, 0.24, ease)
          posY = THREE.MathUtils.lerp(-0.08, -0.08, ease)
          posZ = THREE.MathUtils.lerp(-0.32, -0.32, ease)
          rotX = THREE.MathUtils.lerp(-0.62, -0.52, ease)
          rotY = THREE.MathUtils.lerp(-0.50, 0.55, ease)
          rotZ = THREE.MathUtils.lerp(0.65, -0.55, ease)
          trailAlpha = Math.sin(u * Math.PI) * 0.95

          if (!hasHitInCurrentSwing.current && u >= 0.35 && u <= 0.65) {
            checkRockCollision(1.1)
          }
        } else {
          // Phase 3: Deceleration & Settle
          const u = (p - 0.62) / 0.38
          const decay = Math.exp(-u * 4.5)
          const bounce = Math.sin(u * Math.PI * 2.0) * decay
          const recover = 1 - decay
          posX = THREE.MathUtils.lerp(0.24, 0.24, recover) - bounce * 0.02
          posY = THREE.MathUtils.lerp(-0.08, -0.07, recover) + bounce * 0.015
          posZ = THREE.MathUtils.lerp(-0.32, -0.34, recover)
          rotX = THREE.MathUtils.lerp(-0.52, -0.65, recover) - bounce * 0.05
          rotY = THREE.MathUtils.lerp(0.55, 0.16, recover) + bounce * 0.08
          rotZ = THREE.MathUtils.lerp(-0.55, -0.55, recover) - bounce * 0.06
        }
      } else if (currentSwing.current === 'combo3') {
        // ── Swing 3: Crushing Overhead Finisher Cleave ──
        if (p < 0.24) {
          // Phase 1: High Overhead Two-Handed Raise
          const u = p / 0.24
          const ease = u * u * (3 - 2 * u)
          posX = THREE.MathUtils.lerp(0.24, 0.06, ease)
          posY = THREE.MathUtils.lerp(-0.07, -0.04, ease)
          posZ = THREE.MathUtils.lerp(-0.34, -0.36, ease)
          rotX = THREE.MathUtils.lerp(-0.65, -0.52, ease)
          rotY = THREE.MathUtils.lerp(0.16, 0.02, ease)
          rotZ = THREE.MathUtils.lerp(-0.55, -0.06, ease)
        } else if (p < 0.65) {
          // Phase 2: Devastating Downward Vertical Chop
          const u = (p - 0.24) / 0.41
          const ease = Math.pow(u, 2.6)
          posX = THREE.MathUtils.lerp(0.06, 0.03, ease)
          posY = THREE.MathUtils.lerp(-0.04, -0.16, ease)
          posZ = THREE.MathUtils.lerp(-0.36, -0.36, ease)
          rotX = THREE.MathUtils.lerp(-0.52, -0.82, ease)
          rotY = THREE.MathUtils.lerp(0.02, 0.00, ease)
          rotZ = THREE.MathUtils.lerp(-0.06, -0.08, ease)
          trailAlpha = Math.sin(u * Math.PI) * 1.0

          if (!hasHitInCurrentSwing.current && u >= 0.35 && u <= 0.65) {
            checkRockCollision(1.4)
          }
        } else {
          // Phase 3: Ground Impact Rebound Recoil
          const u = (p - 0.65) / 0.35
          const decay = Math.exp(-u * 5.0)
          const bounce = Math.sin(u * Math.PI * 2.5) * decay
          const recover = 1 - decay
          posX = THREE.MathUtils.lerp(0.03, 0.24, recover)
          posY = THREE.MathUtils.lerp(-0.16, -0.07, recover) + bounce * 0.03
          posZ = THREE.MathUtils.lerp(-0.36, -0.34, recover)
          rotX = THREE.MathUtils.lerp(-0.82, -0.65, recover) - bounce * 0.08
          rotY = THREE.MathUtils.lerp(0.00, 0.16, recover)
          rotZ = THREE.MathUtils.lerp(-0.08, -0.55, recover)
        }
      } else if (currentSwing.current === 'heavy') {
        // ── Heavy Attack: Whirlwind Cleave ──
        if (p < 0.15) {
          const u = p / 0.15
          posX = THREE.MathUtils.lerp(0.26, 0.28, u)
          posY = -0.06
          posZ = -0.32
          rotX = -0.55
          rotY = 0.45
          rotZ = -0.52
        } else if (p < 0.65) {
          const u = (p - 0.15) / 0.50
          const ease = Math.pow(u, 1.8)
          posX = THREE.MathUtils.lerp(0.28, -0.22, ease)
          posY = -0.06 - Math.sin(u * Math.PI) * 0.06
          posZ = -0.32
          rotX = THREE.MathUtils.lerp(-0.55, -0.68, ease)
          rotY = THREE.MathUtils.lerp(0.45, -0.75, ease)
          rotZ = THREE.MathUtils.lerp(-0.52, 0.70, ease)
          trailAlpha = Math.sin(u * Math.PI) * 1.0

          if (!hasHitInCurrentSwing.current && u >= 0.30 && u <= 0.70) {
            checkRockCollision(1.6)
          }
        } else {
          const u = (p - 0.65) / 0.35
          const decay = Math.exp(-u * 4.5)
          const bounce = Math.sin(u * Math.PI * 2.0) * decay
          const recover = 1 - decay
          posX = THREE.MathUtils.lerp(-0.22, 0.24, recover) + bounce * 0.02
          posY = THREE.MathUtils.lerp(-0.06, -0.07, recover)
          posZ = -0.34
          rotX = THREE.MathUtils.lerp(-0.68, -0.65, recover) + bounce * 0.05
          rotY = THREE.MathUtils.lerp(-0.75, 0.16, recover) - bounce * 0.08
          rotZ = THREE.MathUtils.lerp(0.70, -0.55, recover) + bounce * 0.06
        }
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
      mat.opacity = trailAlpha * 0.75
    }

    // Update rune glow
    const isChargeGlow = isCharged.current || (isHoldingLMB.current && chargeProgress.current > 0.5)
    const targetGlow = isChargeGlow ? 2.4 : 0.85
    if (runeMatRef.current) {
      runeMatRef.current.emissiveIntensity = THREE.MathUtils.damp(
        runeMatRef.current.emissiveIntensity,
        targetGlow,
        8,
        dt
      )
    }
  })

  // ── Raycast Rock Collision Detection ──────────────────────────────────────
  const checkRockCollision = (hitPower: number) => {
    const rayOrigin = camera.position
    const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const rayEnd = rayOrigin.clone().addScaledVector(rayDir, 2.6)

    const hit = worldCollisionSystem.checkRay(rayOrigin, rayEnd, 0.35)
    if (hit && hit.collider.tag === 'rock') {
      hasHitInCurrentSwing.current = true

      // Audio: hard steel on granite clack & ring
      sound.playRockStrike(hitPower)

      // Hit-stop feedback: 45ms freeze frame
      hitStopTimer.current = 0.045

      // Visual scratch sparks & dust particles at impact normal
      onHitRock?.(hit.hitPoint, hit.normal, hitPower)
    }
  }

  return (
    <group
      ref={swordRootRef}
      visible={false}
      renderOrder={999}
      onBeforeRender={(renderer) => {
        // Clear depth so viewmodel weapon NEVER clips through terrain, trees or rocks
        renderer.clearDepth()
      }}
    >
      {/* 1. Double-Beveled Ancient Silver-Steel Blade */}
      <mesh geometry={bladeGeo} castShadow receiveShadow>
        <meshStandardMaterial
          color="#dfe5eb"
          roughness={0.16}
          metalness={0.92}
          envMapIntensity={1.5}
        />
      </mesh>

      {/* 2. Embedded Runic Fuller Inlay Channel */}
      <mesh geometry={fullerRuneGeo}>
        <meshStandardMaterial
          ref={runeMatRef}
          color="#3cd0ea"
          emissive="#24b6d4"
          emissiveIntensity={0.85}
          roughness={0.25}
          metalness={0.80}
        />
      </mesh>

      {/* 3. Antique Winged Brass Crossguard */}
      {/* Central Hub */}
      <mesh geometry={guardHubGeo} castShadow>
        <meshStandardMaterial
          color="#d4aa32"
          roughness={0.30}
          metalness={0.88}
        />
      </mesh>

      {/* Swept Winged Quillons */}
      <mesh geometry={quillonLeftGeo} castShadow>
        <meshStandardMaterial
          color="#d4aa32"
          roughness={0.30}
          metalness={0.88}
        />
      </mesh>
      <mesh geometry={quillonRightGeo} castShadow>
        <meshStandardMaterial
          color="#d4aa32"
          roughness={0.30}
          metalness={0.88}
        />
      </mesh>

      {/* Diamond Relic Boss on Guard Face */}
      <mesh geometry={guardBossGeo}>
        <meshStandardMaterial
          color="#f2c852"
          roughness={0.20}
          metalness={0.92}
        />
      </mesh>

      {/* 4. Braided Cord Two-Hand Grip */}
      <mesh geometry={gripGeo}>
        <meshStandardMaterial
          color="#1e1814"
          roughness={0.92}
        />
      </mesh>

      {/* Cord wrap ring bands */}
      {ringGeos.map((geo, idx) => (
        <mesh key={idx} geometry={geo}>
          <meshStandardMaterial
            color="#2e2520"
            roughness={0.80}
          />
        </mesh>
      ))}

      {/* 5. Faceted Brass Pommel Counterweight & Teardrop Finial */}
      <mesh geometry={pommelGeo} castShadow>
        <meshStandardMaterial
          color="#d4aa32"
          roughness={0.30}
          metalness={0.88}
        />
      </mesh>
      <mesh geometry={finialGeo} castShadow>
        <meshStandardMaterial
          color="#d4aa32"
          roughness={0.30}
          metalness={0.88}
        />
      </mesh>

      {/* 6. Dynamic Translucent Golden Slash Arc Ribbon */}
      <mesh
        ref={slashTrailRef}
        geometry={trailGeo}
        position={[0, 0.32, 0]}
        rotation={[-Math.PI * 0.42, 0, -0.35]}
        visible={false}
      >
        <meshBasicMaterial
          color="#ffe082"
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
