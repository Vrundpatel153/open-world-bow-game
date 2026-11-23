// ─────────────────────────────────────────────────────────────────────────────
// SwordViewModel — AAA Authentic Handcrafted Survival Wooden Sword Viewmodel
// Wilderness Survival Melee Weapon:
// - Traditional Hand-Whittled Hardwood Stave Blade (Mountain Ironwood / Dark Oak)
//     * Asymmetric chisel-bevelled wedge cross-section with flat reinforced spine
//     * Fire-hardened striking edge (char-tempered over coals for combat durability)
//     * Angled survival kissaki / chisel point for deep penetrating thrusts
//     * Hand-gouged central lightening fuller groove
// - Wilderness Pegged Hardwood Crossguard & Hemp Twine Lashings:
//     * Carved oval hardwood guard pegged with wooden locking dowels
//     * Criss-cross hemp rope / waxed sinew lashings wrapped in authentic survival X-patterns
// - Ergonomic Carved Grip with Spiral Cord / Weathered Leather Wrap:
//     * Contoured oval handle core with dense friction cord wrapping
//     * Tied knot accents and short cord ends
// - Carved Wooden Pommel Counterweight & Hanging Leather Lanyard Loop
// - Second-Order Spring-Damper Inertia Physics & Weighty Kinematics:
//     * Combo 1: Descending Diagonal Oberhau (Right Shoulder -> Low Left)
//     * Combo 2: Ascending Diagonal Unterhau (Low Left -> High Right)
//     * Combo 3: Wrath Overhead Finisher Zornhau (Overhead -> Heavy Ground Slam)
//     * Heavy Attack: 270-degree Whirlwind Cleave with massive wind gust
//     * Guard / Parry: Braced Crown Guard across chest with spring resistance
// - First-Person Arm Rig & Viewport Framing:
//     * Held naturally in lower-right hand (Guard Y~-0.18m, Tip Y~-0.05m)
//     * Center crosshair (960, 540) and upper/left 75% 100% unobstructed
//     * Solid hardwood impact acoustics on rock collision
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
class SpringDamper3D {
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
const TRAIL_STEPS = 16

// ── Procedural Procedural Texture Generators for Organic Survival Aesthetics ─
function createProceduralWoodTexture(
  baseColor: string,
  grainColor: string,
  darkGrainColor: string,
  ringDensity = 1.0
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, 512, 512)

  // Longitudinal wood grain lines
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * 512
    const width = 1 + Math.random() * 2.5
    ctx.fillStyle = Math.random() > 0.4 ? grainColor : darkGrainColor
    ctx.globalAlpha = 0.08 + Math.random() * 0.16
    ctx.fillRect(x, 0, width, 512)
  }

  // Organic wood growth rings and gentle wavy grain distortion
  ctx.globalAlpha = 0.12
  ctx.strokeStyle = darkGrainColor
  ctx.lineWidth = 1.8
  for (let y = 0; y < 512; y += 14 / ringDensity) {
    ctx.beginPath()
    for (let x = 0; x <= 512; x += 16) {
      const wave = Math.sin(x * 0.02 + y * 0.05) * 4 + Math.sin(x * 0.06) * 2
      if (x === 0) ctx.moveTo(x, y + wave)
      else ctx.lineTo(x, y + wave)
    }
    ctx.stroke()
  }

  // Subtle natural wood knots
  ctx.globalAlpha = 0.22
  for (let k = 0; k < 3; k++) {
    const kx = 100 + Math.random() * 312
    const ky = 80 + Math.random() * 350
    const grad = ctx.createRadialGradient(kx, ky, 2, kx, ky, 18)
    grad.addColorStop(0, darkGrainColor)
    grad.addColorStop(0.5, grainColor)
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(kx, ky, 8, 18, 0.2, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 2)
  return texture
}

function createProceduralHempTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  ctx.fillStyle = '#7a6240'
  ctx.fillRect(0, 0, 256, 256)

  // Braided fibrous strands
  ctx.strokeStyle = '#5a462b'
  ctx.lineWidth = 2.5
  for (let i = -256; i < 512; i += 10) {
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + 256, 256)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(i + 256, 0)
    ctx.lineTo(i, 256)
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 4)
  return texture
}

export default function SwordViewModel({ onHitRock, onSwordSwingWind }: SwordViewModelProps) {
  const { camera } = useThree()
  const swordRootRef = useRef<THREE.Group>(null!)
  const trailMeshRef = useRef<THREE.Mesh>(null!)

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

  // ── Procedural Textures ─────────────────────────────────────────────────────
  const woodTexture = useMemo(
    () => createProceduralWoodTexture('#5c3a1e', '#7b4f2c', '#382210', 1.2),
    []
  )
  const edgeWoodTexture = useMemo(
    () => createProceduralWoodTexture('#2b1a0e', '#3e2615', '#190e07', 1.8),
    []
  )
  const guardWoodTexture = useMemo(
    () => createProceduralWoodTexture('#4a2e16', '#663f20', '#2a180b', 0.9),
    []
  )
  const hempTexture = useMemo(() => createProceduralHempTexture(), [])

  // ── Procedural Geometries for Authentic Handcrafted Wooden Survival Sword ───
  const {
    bladeGeo,
    edgeBevelGeo,
    fullerGrooveGeo,
    guardPlateGeo,
    guardPegLeftGeo,
    guardPegRightGeo,
    lashingHempGeos,
    handleGripGeo,
    handleWrapRingsGeos,
    pommelKnobGeo,
    lanyardRingGeo,
    dynamicTrailGeo,
  } = useMemo(() => {
    // 1. Hand-Whittled Hardwood Blade Body (Total Length 0.46m)
    // Asymmetric survival sword: flat thick back spine (X < 0) and tapered front cutting bevel (X > 0)
    // Whittled kissaki/tanto chisel point at y = 0.38 to y = 0.46
    const bladeShape = new THREE.Shape()
    // Base heel
    bladeShape.moveTo(-0.012, 0.0) // Flat spine base
    bladeShape.lineTo(-0.010, 0.38) // Straight reinforced spine
    bladeShape.lineTo(-0.002, 0.46) // Chisel piercing tip apex
    bladeShape.lineTo(0.011, 0.38) // Angled tanto tip transition
    bladeShape.lineTo(0.016, 0.0) // Tapered cutting edge base
    bladeShape.closePath()

    const bladeExtrude = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.003,
      bevelThickness: 0.003,
    })
    bladeExtrude.center()
    bladeExtrude.translate(0, 0.23, 0)

    // 2. Fire-Hardened Striking Edge Strip (Char-tempered wood bevel)
    // Mounted along the leading cutting edge to create realistic heat-treated contrast
    const edgeShape = new THREE.Shape()
    edgeShape.moveTo(0.008, 0.0)
    edgeShape.lineTo(0.006, 0.38)
    edgeShape.lineTo(-0.002, 0.46) // Tip point
    edgeShape.lineTo(0.013, 0.38)
    edgeShape.lineTo(0.018, 0.0)
    edgeShape.closePath()

    const edgeExtrude = new THREE.ExtrudeGeometry(edgeShape, {
      depth: 0.0085,
      bevelEnabled: false,
    })
    edgeExtrude.center()
    edgeExtrude.translate(0.004, 0.23, 0)

    // 3. Hand-Gouged Central Lightening Fuller Groove
    const fullerShape = new THREE.Shape()
    fullerShape.moveTo(-0.002, 0.04)
    fullerShape.lineTo(-0.0015, 0.34)
    fullerShape.lineTo(0.0, 0.36)
    fullerShape.lineTo(0.0015, 0.34)
    fullerShape.lineTo(0.002, 0.04)
    fullerShape.closePath()

    const fullerGroove = new THREE.ExtrudeGeometry(fullerShape, {
      depth: 0.0145,
      bevelEnabled: false,
    })
    fullerGroove.center()
    fullerGroove.translate(-0.001, 0.195, 0)

    // 4. Pegged Hardwood Crossguard Plate (Oblong carved oak plate)
    // Width 0.076m, Height 0.018m, Depth 0.026m
    const guardPlate = new THREE.CylinderGeometry(0.013, 0.014, 0.076, 12)
    guardPlate.rotateZ(Math.PI / 2)
    guardPlate.scale(1.0, 1.0, 1.4) // Flatten into stout oblong oval
    guardPlate.translate(0, 0.006, 0)

    // Wooden locking dowel pins on left & right
    const pegLeft = new THREE.CylinderGeometry(0.0035, 0.0035, 0.030, 8)
    pegLeft.rotateX(Math.PI / 2)
    pegLeft.translate(-0.024, 0.006, 0)

    const pegRight = new THREE.CylinderGeometry(0.0035, 0.0035, 0.030, 8)
    pegRight.rotateX(Math.PI / 2)
    pegRight.translate(0.024, 0.006, 0)

    // 5. Wilderness Hemp Rope / Sinew Cross-Lashings
    // Criss-cross diagonal binding cords securing the guard to the blade stave
    const lashingGeos: THREE.BufferGeometry[] = []

    // Diagonal wrap 1 (Lower left to upper right across face)
    const lash1Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.022, -0.010, 0.015),
      new THREE.Vector3(0.0, 0.006, 0.017),
      new THREE.Vector3(0.022, 0.022, 0.014),
      new THREE.Vector3(0.022, 0.022, -0.014),
      new THREE.Vector3(0.0, 0.006, -0.017),
      new THREE.Vector3(-0.022, -0.010, -0.015),
    ], true)
    lashingGeos.push(new THREE.TubeGeometry(lash1Curve, 16, 0.0022, 6, true))

    // Diagonal wrap 2 (Upper left to lower right across face, forming X)
    const lash2Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.022, 0.022, 0.014),
      new THREE.Vector3(0.0, 0.006, 0.017),
      new THREE.Vector3(0.022, -0.010, 0.015),
      new THREE.Vector3(0.022, -0.010, -0.015),
      new THREE.Vector3(0.0, 0.006, -0.017),
      new THREE.Vector3(-0.022, 0.022, -0.014),
    ], true)
    lashingGeos.push(new THREE.TubeGeometry(lash2Curve, 16, 0.0022, 6, true))

    // Horizontal collar wraps at blade collar and below guard
    const collarTop = new THREE.TorusGeometry(0.017, 0.0020, 6, 16)
    collarTop.rotateX(Math.PI / 2)
    collarTop.translate(0, 0.022, 0)
    lashingGeos.push(collarTop)

    const collarBottom = new THREE.TorusGeometry(0.015, 0.0020, 6, 16)
    collarBottom.rotateX(Math.PI / 2)
    collarBottom.translate(0, -0.010, 0)
    lashingGeos.push(collarBottom)

    // 6. Contoured Wooden Handle Grip (Length 0.11m)
    const handle = new THREE.CylinderGeometry(0.0135, 0.0125, 0.11, 14)
    handle.scale(0.88, 1.0, 1.25) // Oval cross-section for ergonomic grip
    handle.translate(0, -0.065, 0)

    // Overlapping spiral grip cord rings
    const wrapRings: THREE.TorusGeometry[] = []
    const wrapYs = [-0.025, -0.045, -0.065, -0.085, -0.105]
    for (let i = 0; i < wrapYs.length; i++) {
      const ring = new THREE.TorusGeometry(0.0138, 0.0020, 6, 16)
      ring.rotateX(Math.PI / 2 + 0.10) // Subtle spiral cant
      ring.translate(0, wrapYs[i], 0)
      wrapRings.push(ring)
    }

    // 7. Carved Wooden Pommel Knob & Hanging Leather Lanyard Loop
    const pommelKnob = new THREE.CylinderGeometry(0.021, 0.014, 0.026, 12)
    pommelKnob.scale(0.9, 1.0, 1.15)
    pommelKnob.translate(0, -0.128, 0)

    const lanyardRing = new THREE.TorusGeometry(0.011, 0.0018, 6, 16)
    lanyardRing.translate(0, -0.146, 0)

    // 8. Dynamic Blade-Edge Slipstream Trail Geometry
    const trailPositions = new Float32Array(TRAIL_STEPS * 2 * 3)
    const trailColors = new Float32Array(TRAIL_STEPS * 2 * 3)
    const trailIndices: number[] = []
    const trailUvs = new Float32Array(TRAIL_STEPS * 2 * 2)

    for (let i = 0; i < TRAIL_STEPS; i++) {
      const u = i / (TRAIL_STEPS - 1)
      trailUvs[i * 4 + 0] = u
      trailUvs[i * 4 + 1] = 0.0
      trailUvs[i * 4 + 2] = u
      trailUvs[i * 4 + 3] = 1.0

      // Smooth cubic exponential fade along trail tail so edge is never sharp/blocky
      const fade = Math.pow(1.0 - u, 2.0)
      const r = 0.95 * fade
      const g = 0.92 * fade
      const b = 0.85 * fade

      // Tip vertex
      trailColors[i * 6 + 0] = r
      trailColors[i * 6 + 1] = g
      trailColors[i * 6 + 2] = b

      // Base vertex (subtly softer)
      trailColors[i * 6 + 3] = r * 0.65
      trailColors[i * 6 + 4] = g * 0.65
      trailColors[i * 6 + 5] = b * 0.60

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
    dynTrail.setAttribute('color', new THREE.BufferAttribute(trailColors, 3))
    dynTrail.setAttribute('uv', new THREE.BufferAttribute(trailUvs, 2))
    dynTrail.setIndex(trailIndices)

    return {
      bladeGeo: bladeExtrude,
      edgeBevelGeo: edgeExtrude,
      fullerGrooveGeo: fullerGroove,
      guardPlateGeo: guardPlate,
      guardPegLeftGeo: pegLeft,
      guardPegRightGeo: pegRight,
      lashingHempGeos: lashingGeos,
      handleGripGeo: handle,
      handleWrapRingsGeos: wrapRings,
      pommelKnobGeo: pommelKnob,
      lanyardRingGeo: lanyardRing,
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
      swingDuration.current = 0.56
      sound.playSwordChargeRelease()
      posSpring.current.addImpulse(new THREE.Vector3(-0.025, 0.010, 0.045))
      rotSpring.current.addImpulse(new THREE.Vector3(0.10, -0.20, 0.15))
    } else {
      swingDuration.current = comboIndex === 3 ? 0.48 : comboIndex === 2 ? 0.42 : 0.44
      sound.playSwordSwing(comboIndex)
      lastComboIndex.current = comboIndex
      comboWindowTimer.current = 0.72

      if (comboIndex === 1) {
        posSpring.current.addImpulse(new THREE.Vector3(-0.018, -0.010, 0.028))
        rotSpring.current.addImpulse(new THREE.Vector3(0.06, -0.12, 0.10))
      } else if (comboIndex === 2) {
        posSpring.current.addImpulse(new THREE.Vector3(0.018, 0.008, 0.028))
        rotSpring.current.addImpulse(new THREE.Vector3(-0.05, 0.12, -0.10))
      } else {
        posSpring.current.addImpulse(new THREE.Vector3(0.0, -0.035, 0.038))
        rotSpring.current.addImpulse(new THREE.Vector3(-0.14, 0.02, -0.04))
      }
    }

    swingTimer.current = swingDuration.current
  }

  const triggerGrassWind = (power: number, sliceOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) => {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)

    const sliceDir = fwd.clone()
      .addScaledVector(right, sliceOffset.x)
      .addScaledVector(up, sliceOffset.y)
      .normalize()

    onSwordSwingWind?.(camera.position, sliceDir, power)
  }

  // ── Per-Frame Viewmodel Rig, Multi-Phase Kinematics & Depth Rendering ─────
  useFrame((state, delta) => {
    if (!swordRootRef.current) return
    const dt = Math.min(delta, 0.05)

    // Equip / Unequip transition
    if (!isSwordActive) {
      equipProgress.current = THREE.MathUtils.damp(equipProgress.current, 0.0, 16, dt)
      if (equipProgress.current < 0.08) {
        equipProgress.current = 0.0
        swordRootRef.current.visible = false
        return
      }
    } else {
      equipProgress.current = THREE.MathUtils.damp(equipProgress.current, 1.0, 16, dt)
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

      posSpring.current.addImpulse(new THREE.Vector3(-yawDelta * 0.06, pitchDelta * 0.06, 0))
      rotSpring.current.addImpulse(new THREE.Vector3(-pitchDelta * 0.35, -yawDelta * 0.35, yawDelta * 0.55))
    }
    prevCamQuat.current.copy(camera.quaternion)

    // 2. Locomotion Bobbing & Multi-Harmonic Respiration
    const isMoving =
      inputManager.isMovingForward() ||
      inputManager.isMovingBackward() ||
      inputManager.isMovingLeft() ||
      inputManager.isMovingRight()
    const isSprinting = isMoving && inputManager.isSprinting()

    walkBobTimer.current += dt * (isMoving ? (isSprinting ? 13.0 : 8.5) : 1.3)
    breathTimer.current += dt * 1.5

    const bobScale = isMoving ? (isSprinting ? 0.013 : 0.007) : 0.0012
    const bobX = Math.cos(walkBobTimer.current * 0.5) * bobScale
    const bobY = -Math.abs(Math.sin(walkBobTimer.current)) * (bobScale * 1.25)
    const swayX = Math.cos(breathTimer.current * 1.3) * 0.0010 + Math.sin(breathTimer.current * 2.8) * 0.0004
    const swayY = Math.sin(breathTimer.current * 2.1) * 0.0012 + Math.cos(breathTimer.current * 4.2) * 0.0003
    const bobRotZ = isMoving ? -Math.sin(walkBobTimer.current * 0.5) * (bobScale * 2.6) : Math.cos(breathTimer.current * 1.6) * 0.002
    const bobPitch = isMoving ? Math.cos(walkBobTimer.current) * (bobScale * 1.6) : 0

    posSpring.current.target.set(bobX + swayX, bobY + swayY, 0)
    rotSpring.current.target.set(bobY * 1.6 + bobPitch, bobX * 1.2, bobRotZ)
    const springPosOffset = posSpring.current.update(dt)
    const springRotOffset = rotSpring.current.update(dt)

    // 3. Authentic Martial Ready Stance (Framed naturally in lower-right viewport)
    // Guard sits at lower-right, wooden blade points gracefully upward-forward across right quadrant
    // Crosshair (960, 540) and left 75% wide open
    const unequipDrop = 1.0 - equipProgress.current
    const pRest = new THREE.Vector3(0.20, -0.14 - unequipDrop * 0.70, -0.36)
    const qRest = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.12 - unequipDrop * 0.55, -0.18, 0.48 - unequipDrop * 0.35, 'YXZ')
    )

    let finalPos = pRest.clone()
    let finalQuat = qRest.clone()

    // 4. Guard / Parry Stance (RMB)
    if (guardProgress.current > 0.001) {
      const gp = guardProgress.current
      const gEase = gp * (2 - gp)
      const pGuard = new THREE.Vector3(0.10, -0.12, -0.34)
      const qGuard = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.62, 0.14, 0.82, 'YXZ'))
      finalPos.lerp(pGuard, gEase)
      finalQuat.slerp(qGuard, gEase)
    }

    // 5. Heavy Charge Stance (Hold LMB)
    if (chargeProgress.current > 0.001 && currentSwing.current === 'none') {
      const cp = chargeProgress.current
      const cEase = cp * cp
      const chargeVibe = isCharged.current ? Math.sin(state.clock.elapsedTime * 45) * 0.0025 : 0
      const pCharge = new THREE.Vector3(0.26 + chargeVibe, -0.12, -0.34)
      const qCharge = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, 0.42, -0.55, 'YXZ'))
      finalPos.lerp(pCharge, cEase)
      finalQuat.slerp(qCharge, cEase)
    }

    // 6. Active Multi-Phase Martial Cleaves (Smooth, Minimal, Continuous Physics)
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
        p = Math.max(0, 1.0 - swingTimer.current / swingDuration.current)
      }

      // Continuous C2 smooth quintic curve for zero jerk
      const quinticEase = (t: number) => t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
      const hermiteEase = (t: number) => t * t * (3.0 - 2.0 * t)

      if (currentSwing.current === 'combo1') {
        // Combo 1: Minimal Diagonal Oberhau (Right Shoulder -> Center-Left)
        const pWindup = new THREE.Vector3(0.24, -0.06, -0.34)
        const qWindup = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.16, 0.22, -0.26, 'YXZ'))
        const pStrike = new THREE.Vector3(-0.14, -0.22, -0.36)
        const qStrike = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.46, -0.32, -0.14, 'YXZ'))

        if (p < 0.22) {
          const u = p / 0.22
          const ease = hermiteEase(u)
          finalPos.lerpVectors(pRest, pWindup, ease)
          finalQuat.slerpQuaternions(qRest, qWindup, ease)
        } else if (p < 0.65) {
          const u = (p - 0.22) / 0.43
          const ease = quinticEase(u)
          finalPos.lerpVectors(pWindup, pStrike, ease)
          finalPos.z -= Math.sin(u * Math.PI) * 0.045
          finalPos.y += Math.sin(u * Math.PI) * 0.018
          finalQuat.slerpQuaternions(qWindup, qStrike, ease)
          swingTrailAlpha = Math.sin(u * Math.PI) * 0.85

          if (!hasHitInCurrentSwing.current && u >= 0.35 && u <= 0.65) {
            checkRockCollision(1.0)
            triggerGrassWind(1.1, new THREE.Vector3(-0.35, -0.1, 0))
          }
        } else {
          const u = (p - 0.65) / 0.35
          const decay = Math.exp(-u * 4.6)
          const bounce = Math.sin(u * Math.PI * 2.0) * decay * 0.020
          const recover = 1.0 - decay
          finalPos.lerpVectors(pStrike, pRest, recover)
          finalPos.y += bounce
          finalQuat.slerpQuaternions(qStrike, qRest, recover)
        }
      } else if (currentSwing.current === 'combo2') {
        // Combo 2: Minimal Diagonal Unterhau (Low-Left -> High-Right return)
        const pWindup = new THREE.Vector3(-0.14, -0.22, -0.36)
        const qWindup = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.42, -0.28, 0.32, 'YXZ'))
        const pStrike = new THREE.Vector3(0.22, -0.08, -0.34)
        const qStrike = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.16, 0.26, 0.52, 'YXZ'))

        if (p < 0.20) {
          const u = p / 0.20
          const ease = hermiteEase(u)
          finalPos.lerpVectors(pRest, pWindup, ease)
          finalQuat.slerpQuaternions(qRest, qWindup, ease)
        } else if (p < 0.64) {
          const u = (p - 0.20) / 0.44
          const ease = quinticEase(u)
          finalPos.lerpVectors(pWindup, pStrike, ease)
          finalPos.z -= Math.sin(u * Math.PI) * 0.042
          finalPos.y -= Math.sin(u * Math.PI) * 0.015
          finalQuat.slerpQuaternions(qWindup, qStrike, ease)
          swingTrailAlpha = Math.sin(u * Math.PI) * 0.85

          if (!hasHitInCurrentSwing.current && u >= 0.35 && u <= 0.65) {
            checkRockCollision(1.15)
            triggerGrassWind(1.2, new THREE.Vector3(0.35, 0.1, 0))
          }
        } else {
          const u = (p - 0.64) / 0.36
          const decay = Math.exp(-u * 4.6)
          const bounce = Math.sin(u * Math.PI * 2.0) * decay * 0.020
          const recover = 1.0 - decay
          finalPos.lerpVectors(pStrike, pRest, recover)
          finalPos.y += bounce
          finalQuat.slerpQuaternions(qStrike, qRest, recover)
        }
      } else if (currentSwing.current === 'combo3') {
        // Combo 3: Disciplined Downward Finisher Zornhau (High Guard -> Ground Chop)
        const pWindup = new THREE.Vector3(0.16, -0.02, -0.34)
        const qWindup = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.24, 0.14, -0.32, 'YXZ'))
        const pStrike = new THREE.Vector3(0.12, -0.24, -0.36)
        const qStrike = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.68, 0.08, -0.28, 'YXZ'))

        if (p < 0.24) {
          const u = p / 0.24
          const ease = hermiteEase(u)
          finalPos.lerpVectors(pRest, pWindup, ease)
          finalQuat.slerpQuaternions(qRest, qWindup, ease)
        } else if (p < 0.66) {
          const u = (p - 0.24) / 0.42
          const ease = quinticEase(u)
          finalPos.lerpVectors(pWindup, pStrike, ease)
          finalPos.z -= Math.sin(u * Math.PI) * 0.038
          finalQuat.slerpQuaternions(qWindup, qStrike, ease)
          swingTrailAlpha = Math.sin(u * Math.PI) * 0.95

          if (!hasHitInCurrentSwing.current && u >= 0.35 && u <= 0.65) {
            checkRockCollision(1.4)
            triggerGrassWind(1.5, new THREE.Vector3(0.0, -0.2, 0))
          }
        } else {
          const u = (p - 0.66) / 0.34
          const decay = Math.exp(-u * 5.0)
          const bounce = Math.sin(u * Math.PI * 2.5) * decay * 0.028
          const recover = 1.0 - decay
          finalPos.lerpVectors(pStrike, pRest, recover)
          finalPos.y += bounce
          finalQuat.slerpQuaternions(qStrike, qRest, recover)
        }
      } else if (currentSwing.current === 'heavy') {
        // Heavy Whirlwind Attack
        const pWindup = new THREE.Vector3(0.26, -0.10, -0.32)
        const qWindup = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, 0.45, -0.55, 'YXZ'))
        const pStrike = new THREE.Vector3(-0.20, -0.18, -0.36)
        const qStrike = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.30, -0.55, 0.20, 'YXZ'))

        if (p < 0.16) {
          const u = p / 0.16
          finalPos.lerpVectors(pRest, pWindup, u)
          finalQuat.slerpQuaternions(qRest, qWindup, u)
        } else if (p < 0.66) {
          const u = (p - 0.16) / 0.50
          const ease = quinticEase(u)
          finalPos.lerpVectors(pWindup, pStrike, ease)
          finalPos.z -= Math.sin(u * Math.PI) * 0.055
          finalPos.y -= Math.sin(u * Math.PI) * 0.030
          finalQuat.slerpQuaternions(qWindup, qStrike, ease)
          swingTrailAlpha = Math.sin(u * Math.PI) * 1.0

          if (!hasHitInCurrentSwing.current && u >= 0.30 && u <= 0.70) {
            checkRockCollision(1.6)
            triggerGrassWind(2.0, new THREE.Vector3(-0.2, 0, 0))
          }
        } else {
          const u = (p - 0.66) / 0.34
          const decay = Math.exp(-u * 4.6)
          const bounce = Math.sin(u * Math.PI * 2.0) * decay * 0.025
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

    // Apply second-order spring dynamics
    finalPos.add(springPosOffset)

    const qSway = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(springRotOffset.x, springRotOffset.y, springRotOffset.z, 'YXZ')
    )
    finalQuat.multiply(qSway)

    // Position viewmodel relative to camera
    const worldPos = finalPos.clone().applyQuaternion(camera.quaternion).add(camera.position)
    swordRootRef.current.position.copy(worldPos)
    swordRootRef.current.quaternion.copy(camera.quaternion).multiply(finalQuat)

    // ── Update Dynamic Aerodynamic Wind-Shear Trail ──────────────────────────
    const localTip = new THREE.Vector3(0, 0.46, 0).applyQuaternion(finalQuat).add(finalPos)
    const localBase = new THREE.Vector3(0, 0.03, 0).applyQuaternion(finalQuat).add(finalPos)

    // When swing just begins, snap all historical trail positions to current blade
    // so no stale polygon quad gets stretched from the previous stance.
    if (trailAlphaRef.current < 0.02 && swingTrailAlpha > 0.05) {
      for (let i = 0; i < TRAIL_STEPS; i++) {
        trailHistory.current[i].tip.copy(localTip)
        trailHistory.current[i].base.copy(localBase)
      }
    }

    for (let i = TRAIL_STEPS - 1; i > 0; i--) {
      trailHistory.current[i].tip.copy(trailHistory.current[i - 1].tip)
      trailHistory.current[i].base.copy(trailHistory.current[i - 1].base)
    }
    trailHistory.current[0].tip.copy(localTip)
    trailHistory.current[0].base.copy(localBase)

    trailAlphaRef.current = THREE.MathUtils.damp(trailAlphaRef.current, swingTrailAlpha, 14, dt)

    if (trailMeshRef.current) {
      trailMeshRef.current.visible = trailAlphaRef.current > 0.02
      if (trailMeshRef.current.visible) {
        const posAttr = dynamicTrailGeo.getAttribute('position') as THREE.BufferAttribute
        const posArray = posAttr.array as Float32Array

        for (let i = 0; i < TRAIL_STEPS; i++) {
          const pt = trailHistory.current[i]
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
        mat.opacity = trailAlphaRef.current * 0.38
      }
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

      // Audio: solid hardwood on rock impact clack & thud
      sound.playRockStrike(hitPower)

      // Hit-stop tactile freeze frame (45ms)
      hitStopTimer.current = 0.045

      // Reverse impulse into spring
      posSpring.current.addImpulse(new THREE.Vector3(0.04, 0.02, 0.06))
      rotSpring.current.addImpulse(new THREE.Vector3(-0.25, 0.20, -0.15))

      // Rock chip particles
      onHitRock?.(hit.hitPoint, hit.normal, hitPower)
    }
  }

  return (
    <>
      {/* 1. First-Person Handcrafted Survival Wooden Sword Viewmodel */}
      <group
        ref={swordRootRef}
        visible={false}
        renderOrder={999}
        onBeforeRender={(renderer) => {
          renderer.clearDepth()
        }}
      >
        {/* Main Heartwood Whittled Blade Body */}
        <mesh geometry={bladeGeo} castShadow receiveShadow>
          <meshStandardMaterial
            color="#5c3a1e"
            map={woodTexture}
            roughness={0.72}
            metalness={0.0}
            bumpMap={woodTexture}
            bumpScale={0.0018}
          />
        </mesh>

        {/* Char-Hardened Striking Edge (Tempered over campfire coals) */}
        <mesh geometry={edgeBevelGeo} castShadow>
          <meshStandardMaterial
            color="#2a180c"
            map={edgeWoodTexture}
            roughness={0.54}
            metalness={0.0}
          />
        </mesh>

        {/* Hand-Gouged Central Fuller Groove */}
        <mesh geometry={fullerGrooveGeo}>
          <meshStandardMaterial
            color="#3a2211"
            roughness={0.85}
            metalness={0.0}
          />
        </mesh>

        {/* Pegged Hardwood Crossguard Plate */}
        <mesh geometry={guardPlateGeo} castShadow>
          <meshStandardMaterial
            color="#4a2e16"
            map={guardWoodTexture}
            roughness={0.68}
            metalness={0.0}
            bumpMap={guardWoodTexture}
            bumpScale={0.0015}
          />
        </mesh>

        {/* Wooden Retaining Dowel Pegs */}
        <mesh geometry={guardPegLeftGeo}>
          <meshStandardMaterial color="#6a4422" roughness={0.78} />
        </mesh>
        <mesh geometry={guardPegRightGeo}>
          <meshStandardMaterial color="#6a4422" roughness={0.78} />
        </mesh>

        {/* Wilderness Hemp Rope / Cord Cross-Lashings */}
        {lashingHempGeos.map((geo, idx) => (
          <mesh key={`lash-${idx}`} geometry={geo}>
            <meshStandardMaterial
              color="#826845"
              map={hempTexture}
              roughness={0.94}
              metalness={0.0}
            />
          </mesh>
        ))}

        {/* Contoured Wooden Handle Grip Core */}
        <mesh geometry={handleGripGeo}>
          <meshStandardMaterial
            color="#342012"
            roughness={0.88}
            metalness={0.0}
          />
        </mesh>

        {/* Overlapping Friction Cord / Weathered Leather Wrap Rings */}
        {handleWrapRingsGeos.map((geo, idx) => (
          <mesh key={`ring-${idx}`} geometry={geo}>
            <meshStandardMaterial
              color="#281a10"
              roughness={0.82}
              metalness={0.0}
            />
          </mesh>
        ))}

        {/* Carved Wooden Pommel Knob Counterweight */}
        <mesh geometry={pommelKnobGeo} castShadow>
          <meshStandardMaterial
            color="#462c16"
            map={guardWoodTexture}
            roughness={0.65}
            metalness={0.0}
          />
        </mesh>

        {/* Hanging Leather Lanyard Loop */}
        <mesh geometry={lanyardRingGeo}>
          <meshStandardMaterial
            color="#523924"
            roughness={0.85}
            metalness={0.0}
          />
        </mesh>
      </group>

      {/* 2. Aerodynamic Wind-Shear Slipstream Trail */}
      <mesh
        ref={trailMeshRef}
        geometry={dynamicTrailGeo}
        visible={false}
        renderOrder={998}
      >
        <meshBasicMaterial
          vertexColors
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
