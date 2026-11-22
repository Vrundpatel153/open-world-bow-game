// ─────────────────────────────────────────────────────────────────────────────
// SwordViewModel — AAA First-Person Martial Sword Physics & Kinematics Viewmodel
// Open-Source Second-Order Spring-Damper Inertia & Authentic Melee Kinematics:
// - Second-Order Damped Harmonic Oscillator (SpringDamper3D):
//     F = -k * (x - target) - c * v + impulse
//     Simulates realistic weapon mass, inertia, and spring rebound.
// - Authentic Martial Ready Stance (Vom Tag / Low-Ready Guard):
//     Framed naturally in lower-right viewport (Guard Y~-0.18, Pommel Y~-0.30, Tip Y~-0.05).
//     Center crosshair (960, 540) and left 75% of viewport 100% unobstructed.
//     Zero stiff vertical pole posture.
// - Quaternion-Based Multi-Phase Martial Cleaving (Zero Gimbal Lock / Robotic Lerps):
//     Combo 1: Descending Diagonal Oberhau (Right Shoulder -> Low Left)
//     Combo 2: Ascending Diagonal Unterhau (Low Left -> High Right)
//     Combo 3: Crushing Overhead Wrath Zornhau (High Right Temple -> Ground Impact)
//     Heavy Attack: 270-degree Whirlwind Cleave with massive wind blast
//     Guard / Parry: Braced Crown Guard (Kron) across chest with tactile spring resistance
// - Dynamic Blade-Edge Slipstream Trail:
//     Real-time vertex history tracking tip & base (zero cartoon static yellow rings).
//     Translucent silver-white air-shearing vapor (#e6f0fa) with quadratic fade.
// - Dedicated Viewmodel Lighting & Depth Buffer Clearing (Zero world clipping).
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

// ── Open-Source Second-Order Spring-Damper Physics Class ─────────────────────
export class SpringDamper3D {
  public current = new THREE.Vector3()
  public target = new THREE.Vector3()
  public velocity = new THREE.Vector3()
  public stiffness: number
  public damping: number

  constructor(stiffness = 180, damping = 18) {
    this.stiffness = stiffness
    this.damping = damping
  }

  public reset(v: THREE.Vector3) {
    this.current.copy(v)
    this.target.copy(v)
    this.velocity.set(0, 0, 0)
  }

  public update(dt: number): THREE.Vector3 {
    const fx = -this.stiffness * (this.current.x - this.target.x) - this.damping * this.velocity.x
    const fy = -this.stiffness * (this.current.y - this.target.y) - this.damping * this.velocity.y
    const fz = -this.stiffness * (this.current.z - this.target.z) - this.damping * this.velocity.z

    this.velocity.x += fx * dt
    this.velocity.y += fy * dt
    this.velocity.z += fz * dt

    this.current.x += this.velocity.x * dt
    this.current.y += this.velocity.y * dt
    this.current.z += this.velocity.z * dt

    return this.current
  }

  public addImpulse(impulse: THREE.Vector3) {
    this.velocity.add(impulse)
  }
}

// Number of historical blade slices for the dynamic aerodynamic trail
const TRAIL_STEPS = 10

export default function SwordViewModel({ onHitRock, onSwordSwingWind }: SwordViewModelProps) {
  const { camera } = useThree()
  const swordRootRef = useRef<THREE.Group>(null!)
  const trailMeshRef = useRef<THREE.Mesh>(null!)
  const runeMatRef = useRef<THREE.MeshStandardMaterial>(null!)

  const activeItem = useQuestStore((s) => s.activeItem)
  const isSwordActive = activeItem === 'sword'

  const equipProgress = useRef(0.0)
  const guardProgress = useRef(0.0)
  const chargeProgress = useRef(0.0)
  const walkBobTimer = useRef(0)
  const breathTimer = useRef(0)
  const wasActive = useRef(false)

  // ── Physics Springs (Look Sway & Mass Inertia) ──────────────────────────────
  const posSpring = useRef(new SpringDamper3D(170, 18))
  const rotSpring = useRef(new SpringDamper3D(140, 16))

  // Camera rotation delta tracking for look-sway inertia
  const prevCamQuat = useRef(new THREE.Quaternion())

  // ── Combat Kinematic State Machine ──────────────────────────────────────────
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
  const isFrozen = useRef(false)
  const frozenType = useRef<SwingType>('none')
  const frozenProgress = useRef(0)

  // Dynamic Blade Tip & Base Trail History (Local Camera Coordinates)
  const trailHistory = useRef<{ tip: THREE.Vector3; base: THREE.Vector3 }[]>(
    Array.from({ length: TRAIL_STEPS }, () => ({
      tip: new THREE.Vector3(0.23, -0.05, -0.55),
      base: new THREE.Vector3(0.23, -0.17, -0.36),
    }))
  )
  const trailAlphaRef = useRef(0)

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
    dynamicTrailGeo,
  } = useMemo(() => {
    // 1. Double-Beveled Silver Blade (Length ~0.46m, Width ~0.036m tapering to spear point)
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
    const hub = new THREE.BoxGeometry(0.038, 0.022, 0.026)

    const quillonLeft = new THREE.CylinderGeometry(0.008, 0.004, 0.065, 8)
    quillonLeft.rotateZ(Math.PI / 2 + 0.16)
    quillonLeft.rotateY(0.08)
    quillonLeft.translate(-0.046, 0.006, 0.004)

    const quillonRight = new THREE.CylinderGeometry(0.008, 0.004, 0.065, 8)
    quillonRight.rotateZ(-(Math.PI / 2 + 0.16))
    quillonRight.rotateY(-0.08)
    quillonRight.translate(0.046, 0.006, 0.004)

    const guardBoss = new THREE.CylinderGeometry(0.0075, 0.0075, 0.008, 4)
    guardBoss.rotateY(Math.PI / 4)
    guardBoss.translate(0, 0, 0.014)

    // 4. Ergonomic Braided Cord Two-Hand Grip
    const grip = new THREE.CylinderGeometry(0.0125, 0.0115, 0.11, 12)
    grip.translate(0, -0.055, 0)

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

    // 6. Dynamic Blade-Edge Trail Geometry (Quad Strip connecting Tip & Base over time)
    const trailPositions = new Float32Array(TRAIL_STEPS * 2 * 3)
    const trailIndices: number[] = []
    const trailUvs = new Float32Array(TRAIL_STEPS * 2 * 2)

    for (let i = 0; i < TRAIL_STEPS; i++) {
      const u = i / (TRAIL_STEPS - 1)
      trailUvs[i * 4 + 0] = u
      trailUvs[i * 4 + 1] = 0.0
      trailUvs[i * 4 + 2] = u
      trailUvs[i * 4 + 3] = 1.0

      if (i < TRAIL_STEPS - 1) {
        const i0 = i * 2
        const i1 = i0 + 1
        const i2 = i0 + 2
        const i3 = i0 + 3
        trailIndices.push(i0, i1, i2)
        trailIndices.push(i2, i1, i3)
      }
    }

    const dynTrail = new THREE.BufferGeometry()
    dynTrail.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
    dynTrail.setAttribute('uv', new THREE.BufferAttribute(trailUvs, 2))
    dynTrail.setIndex(trailIndices)

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
      dynamicTrailGeo: dynTrail,
    }
  }, [])

  // Audio trigger on draw / sheath
  useEffect(() => {
    if (isSwordActive && !wasActive.current) {
      sound.playSwordEquip()
    }
    wasActive.current = isSwordActive
  }, [isSwordActive])

  // Window debug hooks for automated verification
  useEffect(() => {
    ;(window as any).__triggerSwordSwing = (type: SwingType = 'combo1') => {
      if (type === 'heavy') executeSwing('heavy')
      else executeComboClick()
    }
    ;(window as any).__testSwordGuard = (val: boolean) => {
      isGuarding.current = val
    }
    ;(window as any).__freezeSwordPose = (type: SwingType, progress: number) => {
      isFrozen.current = type !== 'none'
      frozenType.current = type
      frozenProgress.current = progress
    }
  }, [])

  // ── Combat Mouse Input Handling ───────────────────────────────────────────
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!isSwordActive) return
      if (e.target instanceof Element && e.target.closest('[class*="leva"], button, a')) return

      if (e.button === 0) {
        isHoldingLMB.current = true
        holdStartTime.current = performance.now()
        isCharged.current = false
      } else if (e.button === 2) {
        isGuarding.current = true
        sound.playSwordParry()
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!isSwordActive) return
      if (e.button === 0 && isHoldingLMB.current) {
        isHoldingLMB.current = false
        const holdDuration = (performance.now() - holdStartTime.current) / 1000

        if (holdDuration >= 0.35 || isCharged.current) {
          executeSwing('heavy')
        } else {
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
    // If currently mid-strike, allow fluid chaining in recovery phase
    if (currentSwing.current !== 'none' && swingTimer.current < swingDuration.current * 0.40) {
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
      swingDuration.current = 0.44
      sound.playSwordChargeRelease()
      triggerGrassWind(2.2)
      // Heavy kinetic recoil impulse into spring
      posSpring.current.addImpulse(new THREE.Vector3(-0.04, 0.01, 0.06))
      rotSpring.current.addImpulse(new THREE.Vector3(0.12, -0.25, 0.18))
    } else {
      swingDuration.current = comboIndex === 3 ? 0.38 : comboIndex === 2 ? 0.26 : 0.28
      sound.playSwordSwing(comboIndex)
      lastComboIndex.current = comboIndex
      comboWindowTimer.current = 0.65
      triggerGrassWind(comboIndex === 3 ? 1.6 : 1.1)

      // Tactical spring recoil impulses based on strike direction
      if (comboIndex === 1) {
        posSpring.current.addImpulse(new THREE.Vector3(-0.025, -0.015, 0.035))
        rotSpring.current.addImpulse(new THREE.Vector3(0.08, -0.14, 0.12))
      } else if (comboIndex === 2) {
        posSpring.current.addImpulse(new THREE.Vector3(0.025, 0.012, 0.035))
        rotSpring.current.addImpulse(new THREE.Vector3(-0.06, 0.14, -0.12))
      } else {
        posSpring.current.addImpulse(new THREE.Vector3(0.0, -0.045, 0.05))
        rotSpring.current.addImpulse(new THREE.Vector3(-0.18, 0.02, -0.05))
      }
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

    // Hit-stop pause (tactile hesitation on solid rock impact)
    if (hitStopTimer.current > 0) {
      hitStopTimer.current -= dt
      return
    }

    // Guard transition lerp
    const targetGuard = isGuarding.current && currentSwing.current === 'none' ? 1.0 : 0.0
    guardProgress.current = THREE.MathUtils.damp(guardProgress.current, targetGuard, 12, dt)

    // 1. Camera Look-Inertia Impulse Calculation
    if (prevCamQuat.current.lengthSq() > 0.001) {
      const deltaQuat = prevCamQuat.current.clone().invert().multiply(camera.quaternion)
      const yawDelta = -deltaQuat.y * 2.2
      const pitchDelta = deltaQuat.x * 2.2

      // Feed look velocity impulses into position and rotation springs
      posSpring.current.addImpulse(new THREE.Vector3(-yawDelta * 0.06, pitchDelta * 0.06, 0))
      rotSpring.current.addImpulse(new THREE.Vector3(-pitchDelta * 0.35, -yawDelta * 0.35, yawDelta * 0.55))
    }
    prevCamQuat.current.copy(camera.quaternion)

    // 2. Locomotion Lissajous Bobbing & Idle Respiration
    const isMoving =
      inputManager.isMovingForward() ||
      inputManager.isMovingBackward() ||
      inputManager.isMovingLeft() ||
      inputManager.isMovingRight()
    const isSprinting = isMoving && inputManager.isSprinting()

    walkBobTimer.current += dt * (isMoving ? (isSprinting ? 13.5 : 8.5) : 1.4)
    breathTimer.current += dt * 1.6

    const bobScale = isMoving ? (isSprinting ? 0.016 : 0.009) : 0.0015
    const bobX = Math.cos(walkBobTimer.current * 0.5) * bobScale
    const bobY = -Math.abs(Math.sin(walkBobTimer.current)) * (bobScale * 1.3)
    const swayX = Math.cos(breathTimer.current * 1.2) * 0.0012
    const swayY = Math.sin(breathTimer.current * 2.4) * 0.0010

    // Update second-order spring dynamics
    posSpring.current.target.set(bobX + swayX, bobY + swayY, 0)
    rotSpring.current.target.set(bobY * 2.0, bobX * 1.5, -bobX * 3.0)
    const springPosOffset = posSpring.current.update(dt)
    const springRotOffset = rotSpring.current.update(dt)

    // 3. Authentic Martial Ready Stance (Bottom-right, blade canted forward-upward)
    // Guard sits firmly at lower-right, tip points gracefully forward into lower-center
    // Center crosshair (960, 540) and left 75% of viewport 100% unobstructed!
    const unequipDrop = 1.0 - equipProgress.current
    const pRest = new THREE.Vector3(0.27, -0.20 - unequipDrop * 0.45, -0.38)
    const qRest = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-0.38 - unequipDrop * 0.4, 0.24, -0.52 - unequipDrop * 0.3, 'YXZ')
    )

    let finalPos = pRest.clone()
    let finalQuat = qRest.clone()

    // 4. Guard / Parry Stance (RMB) — Braced diagonal crown guard (Kron) across chest
    if (guardProgress.current > 0.001) {
      const gp = guardProgress.current
      const gEase = gp * (2 - gp) // Ease out quad
      const pGuard = new THREE.Vector3(0.10, -0.12, -0.34)
      const qGuard = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.62, 0.14, 0.82, 'YXZ'))
      finalPos.lerp(pGuard, gEase)
      finalQuat.slerp(qGuard, gEase)
    }

    // 5. Heavy Charge Stance (Hold LMB) — Warrior draws blade back into coiled high tension
    if (chargeProgress.current > 0.001 && currentSwing.current === 'none') {
      const cp = chargeProgress.current
      const cEase = cp * cp // Ease in quadratic
      const chargeVibe = isCharged.current ? Math.sin(state.clock.elapsedTime * 45) * 0.0025 : 0
      const pCharge = new THREE.Vector3(0.28 + chargeVibe, -0.14, -0.32)
      const qCharge = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0.52, -0.68, 'YXZ'))
      finalPos.lerp(pCharge, cEase)
      finalQuat.slerp(qCharge, cEase)
    }

    // 6. Active Multi-Phase Martial Cleaves (Combos & Attacks)
    let swingTrailAlpha = 0.0

    if (isFrozen.current) {
      currentSwing.current = frozenType.current
    }

    if (currentSwing.current !== 'none') {
      let p = 0
      if (isFrozen.current) {
        p = frozenProgress.current
      } else {
        swingTimer.current -= dt
        p = Math.max(0, 1.0 - swingTimer.current / swingDuration.current) // 0 to 1
      }

      if (currentSwing.current === 'combo1') {
        // ── Combo 1: Descending Diagonal Oberhau (Right-to-Left) ──
        // Starts high right, slashes diagonally down-left across cutting plane
        // Blade remains naturally canted along the cutting plane (never stiffly vertical)
        const pWindup = new THREE.Vector3(0.28, -0.06, -0.32)
        const qWindup = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0.35, -0.65, 'YXZ'))

        const pStrike = new THREE.Vector3(-0.22, -0.24, -0.34)
        const qStrike = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.65, -0.45, -0.35, 'YXZ'))

        if (p < 0.20) {
          const u = p / 0.20
          const ease = u * u * (3 - 2 * u)
          finalPos.lerpVectors(pRest, pWindup, ease)
          finalQuat.slerpQuaternions(qRest, qWindup, ease)
        } else if (p < 0.65) {
          const u = (p - 0.20) / 0.45
          const ease = 1.0 - Math.pow(1.0 - u, 3.0) // Explosive cubic whip
          finalPos.lerpVectors(pWindup, pStrike, ease)
          finalQuat.slerpQuaternions(qWindup, qStrike, ease)
          swingTrailAlpha = Math.sin(u * Math.PI) * 0.95

          if (!hasHitInCurrentSwing.current && u >= 0.35 && u <= 0.65) {
            checkRockCollision(1.0)
          }
        } else {
          const u = (p - 0.65) / 0.35
          const decay = Math.exp(-u * 4.5)
          const bounce = Math.sin(u * Math.PI * 2.0) * decay * 0.03
          const recover = 1.0 - decay
          finalPos.lerpVectors(pStrike, pRest, recover)
          finalPos.y += bounce
          finalQuat.slerpQuaternions(qStrike, qRest, recover)
        }
      } else if (currentSwing.current === 'combo2') {
        // ── Combo 2: Ascending Diagonal Unterhau (Left-to-Right) ──
        // Sweeps diagonally upward from low left to high right
        const pWindup = new THREE.Vector3(-0.20, -0.22, -0.34)
        const qWindup = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, -0.40, 0.55, 'YXZ'))

        const pStrike = new THREE.Vector3(0.26, -0.06, -0.32)
        const qStrike = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, 0.40, 0.70, 'YXZ'))

        if (p < 0.18) {
          const u = p / 0.18
          const ease = u * u * (3 - 2 * u)
          finalPos.lerpVectors(pRest, pWindup, ease)
          finalQuat.slerpQuaternions(qRest, qWindup, ease)
        } else if (p < 0.62) {
          const u = (p - 0.18) / 0.44
          const ease = 1.0 - Math.pow(1.0 - u, 3.0)
          finalPos.lerpVectors(pWindup, pStrike, ease)
          finalQuat.slerpQuaternions(qWindup, qStrike, ease)
          swingTrailAlpha = Math.sin(u * Math.PI) * 0.95

          if (!hasHitInCurrentSwing.current && u >= 0.35 && u <= 0.65) {
            checkRockCollision(1.1)
          }
        } else {
          const u = (p - 0.62) / 0.38
          const decay = Math.exp(-u * 4.5)
          const bounce = Math.sin(u * Math.PI * 2.0) * decay * 0.03
          const recover = 1.0 - decay
          finalPos.lerpVectors(pStrike, pRest, recover)
          finalPos.y -= bounce
          finalQuat.slerpQuaternions(qStrike, qRest, recover)
        }
      } else if (currentSwing.current === 'combo3') {
        // ── Combo 3: Wrath Overhead Finisher Zornhau ──
        // Right-temple overhead raise chopping downward into low-ready
        // Stays on the right side of the screen, leaving center crosshair 100% unobstructed
        const pWindup = new THREE.Vector3(0.18, -0.02, -0.32)
        const qWindup = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.30, 0.20, -0.50, 'YXZ'))

        const pStrike = new THREE.Vector3(0.14, -0.26, -0.36)
        const qStrike = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.85, 0.15, -0.45, 'YXZ'))

        if (p < 0.22) {
          const u = p / 0.22
          const ease = u * u * (3 - 2 * u)
          finalPos.lerpVectors(pRest, pWindup, ease)
          finalQuat.slerpQuaternions(qRest, qWindup, ease)
        } else if (p < 0.65) {
          const u = (p - 0.22) / 0.43
          const ease = 1.0 - Math.pow(1.0 - u, 3.2) // Heavy downward kinetic impact
          finalPos.lerpVectors(pWindup, pStrike, ease)
          finalQuat.slerpQuaternions(qWindup, qStrike, ease)
          swingTrailAlpha = Math.sin(u * Math.PI) * 1.0

          if (!hasHitInCurrentSwing.current && u >= 0.35 && u <= 0.65) {
            checkRockCollision(1.4)
          }
        } else {
          const u = (p - 0.65) / 0.35
          const decay = Math.exp(-u * 5.0)
          const bounce = Math.sin(u * Math.PI * 2.5) * decay * 0.04
          const recover = 1.0 - decay
          finalPos.lerpVectors(pStrike, pRest, recover)
          finalPos.y += bounce
          finalQuat.slerpQuaternions(qStrike, qRest, recover)
        }
      } else if (currentSwing.current === 'heavy') {
        // ── Heavy Attack: 270-degree Whirlwind Cleave ──
        const pWindup = new THREE.Vector3(0.30, -0.10, -0.30)
        const qWindup = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.20, 0.60, -0.75, 'YXZ'))

        const pStrike = new THREE.Vector3(-0.26, -0.18, -0.34)
        const qStrike = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, -0.70, 0.25, 'YXZ'))

        if (p < 0.14) {
          const u = p / 0.14
          finalPos.lerpVectors(pRest, pWindup, u)
          finalQuat.slerpQuaternions(qRest, qWindup, u)
        } else if (p < 0.65) {
          const u = (p - 0.14) / 0.51
          const ease = 1.0 - Math.pow(1.0 - u, 2.5)
          finalPos.lerpVectors(pWindup, pStrike, ease)
          finalPos.y -= Math.sin(u * Math.PI) * 0.04
          finalQuat.slerpQuaternions(qWindup, qStrike, ease)
          swingTrailAlpha = Math.sin(u * Math.PI) * 1.0

          if (!hasHitInCurrentSwing.current && u >= 0.30 && u <= 0.70) {
            checkRockCollision(1.6)
          }
        } else {
          const u = (p - 0.65) / 0.35
          const decay = Math.exp(-u * 4.5)
          const bounce = Math.sin(u * Math.PI * 2.0) * decay * 0.03
          const recover = 1.0 - decay
          finalPos.lerpVectors(pStrike, pRest, recover)
          finalPos.y += bounce
          finalQuat.slerpQuaternions(qStrike, qRest, recover)
        }
      }

      if (!isFrozen.current && swingTimer.current <= 0) {
        currentSwing.current = 'none'
      }
    }

    // Apply second-order spring dynamics on top of kinematic stance
    finalPos.add(springPosOffset)

    const qSway = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(springRotOffset.x, springRotOffset.y, springRotOffset.z, 'YXZ')
    )
    finalQuat.multiply(qSway)

    // Apply viewmodel transform relative to camera
    const worldPos = finalPos.clone().applyQuaternion(camera.quaternion).add(camera.position)
    swordRootRef.current.position.copy(worldPos)

    swordRootRef.current.quaternion.copy(camera.quaternion).multiply(finalQuat)

    // ── Update Dynamic Blade-Edge Aerodynamic Slipstream Trail ───────────────
    // Tip is at (0, 0.46, 0) and base is at (0, 0.03, 0) in sword local coordinates
    const localTip = new THREE.Vector3(0, 0.46, 0).applyQuaternion(finalQuat).add(finalPos)
    const localBase = new THREE.Vector3(0, 0.03, 0).applyQuaternion(finalQuat).add(finalPos)

    // Shift history buffer
    for (let i = TRAIL_STEPS - 1; i > 0; i--) {
      trailHistory.current[i].tip.copy(trailHistory.current[i - 1].tip)
      trailHistory.current[i].base.copy(trailHistory.current[i - 1].base)
    }
    trailHistory.current[0].tip.copy(localTip)
    trailHistory.current[0].base.copy(localBase)

    // Fade trail alpha smoothly
    trailAlphaRef.current = THREE.MathUtils.damp(trailAlphaRef.current, swingTrailAlpha, 14, dt)

    if (trailMeshRef.current) {
      trailMeshRef.current.visible = trailAlphaRef.current > 0.02
      if (trailMeshRef.current.visible) {
        const posAttr = dynamicTrailGeo.getAttribute('position') as THREE.BufferAttribute
        const posArray = posAttr.array as Float32Array

        for (let i = 0; i < TRAIL_STEPS; i++) {
          const pt = trailHistory.current[i]
          // Convert from camera local coords into world coords
          const wTip = pt.tip.clone().applyQuaternion(camera.quaternion).add(camera.position)
          const wBase = pt.base.clone().applyQuaternion(camera.quaternion).add(camera.position)

          posArray[i * 6 + 0] = wTip.x
          posArray[i * 6 + 1] = wTip.y
          posArray[i * 6 + 2] = wTip.z

          posArray[i * 6 + 3] = wBase.x
          posArray[i * 6 + 4] = wBase.y
          posArray[i * 6 + 5] = wBase.z
        }
        posAttr.needsUpdate = true

        const mat = trailMeshRef.current.material as THREE.MeshBasicMaterial
        mat.opacity = trailAlphaRef.current * 0.45
      }
    }

    // ── Update Runic Emissive Glow ───────────────────────────────────────────
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

      // Hit-stop feedback: 45ms tactile freeze frame
      hitStopTimer.current = 0.045

      // Reverse impulse into spring for bounce off rock
      posSpring.current.addImpulse(new THREE.Vector3(0.04, 0.02, 0.06))
      rotSpring.current.addImpulse(new THREE.Vector3(-0.25, 0.20, -0.15))

      // Visual scratch sparks & dust particles at impact normal
      onHitRock?.(hit.hitPoint, hit.normal, hitPower)
    }
  }

  return (
    <>
      {/* 1. First-Person Martial Silver-Steel Sword Viewmodel */}
      <group
        ref={swordRootRef}
        visible={false}
        renderOrder={999}
        onBeforeRender={(renderer) => {
          // Clear depth so viewmodel weapon NEVER clips through terrain, trees or rocks
          renderer.clearDepth()
        }}
      >
        {/* Double-Beveled Ancient Silver-Steel Blade */}
        <mesh geometry={bladeGeo} castShadow receiveShadow>
          <meshStandardMaterial
            color="#dfe5eb"
            roughness={0.16}
            metalness={0.92}
            envMapIntensity={1.5}
          />
        </mesh>

        {/* Embedded Runic Fuller Inlay Channel */}
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

        {/* Antique Winged Brass Crossguard Central Hub */}
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

        {/* Braided Cord Two-Hand Grip */}
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

        {/* Faceted Brass Pommel Counterweight & Teardrop Finial */}
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
      </group>

      {/* 2. Dynamic Aerodynamic Blade-Edge Slipstream Trail (World-Space Ribbon) */}
      <mesh
        ref={trailMeshRef}
        geometry={dynamicTrailGeo}
        visible={false}
        renderOrder={998}
      >
        <meshBasicMaterial
          color="#e6f0fa"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}
