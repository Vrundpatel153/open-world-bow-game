// ─────────────────────────────────────────────────────────────────────────────
// SwordViewModel — AAA Authentic Handcrafted 3D Survival Wooden/Steel Sword
// Features:
// - Genuine 3D Model: /assets/models/Sword.glb
//     * Authentically sculpted steel blade with fuller, bevels & quillons
//     * Ergonomic carved hardwood grip with friction cord bindings
//     * Counterweight pommel and forged crossguard
// - Second-Order Spring-Damper Inertia Physics & Weighty Kinematics:
//     * Combo 1: Descending Diagonal Oberhau (Right Shoulder -> Low Left)
//     * Combo 2: Ascending Diagonal Unterhau (Low Left -> High Right)
//     * Combo 3: Wrath Overhead Finisher Zornhau (Overhead -> Heavy Ground Slam)
//     * Heavy Attack: 270-degree Whirlwind Cleave with massive wind gust
//     * Guard / Parry: Braced Crown Guard across chest with spring resistance
// - First-Person Viewport Framing:
//     * Held naturally in lower-right hand (Guard Y~-0.18m, Tip Y~-0.05m)
//     * Center crosshair (960, 540) and upper/left 75% 100% unobstructed
//     * Solid hardwood/steel impact acoustics & sparks on rock collision
// - Dynamic Aerodynamic Blade-Edge Trail
// - Clean Floating Viewmodel: ZERO Roblox cylinder arms or block hands
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
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

// ── Second-Order Spring-Damper Physics Class ─────────────────────────────────
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

// ── Procedural Textures for Organic Survival Aesthetics ─────────────────────
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

  ctx.fillStyle = '#4a3723'
  ctx.fillRect(0, 0, 256, 256)

  // Dense diagonal twisted rope fibers
  ctx.strokeStyle = '#281d11'
  ctx.lineWidth = 1.8
  for (let i = -256; i < 512; i += 6) {
    ctx.globalAlpha = 0.45
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + 256, 256)
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
      tip: new THREE.Vector3(0.23, 0.35, -0.46),
      base: new THREE.Vector3(0.23, -0.15, -0.46),
    }))
  )
  const trailAlphaRef = useRef(0)

  // ── Load Authentic 3D Handcrafted Sword Model ───────────────────────────────
  const { nodes } = useGLTF('/assets/models/Sword.glb') as any

  // ── Procedural Textures & Materials ─────────────────────────────────────────
  const woodTexture = useMemo(
    () => createProceduralWoodTexture('#5c3a1e', '#7b4f2c', '#382210', 1.2),
    []
  )
  const hempTexture = useMemo(() => createProceduralHempTexture(), [])

  const materials = useMemo(() => {
    // Crossguard & Pommel - Tempered Dark Steel
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: '#363b40',
      metalness: 0.92,
      roughness: 0.32,
    })

    // Handle Core - Whittled Mountain Hardwood
    const handleWoodMat = new THREE.MeshStandardMaterial({
      color: '#422816',
      map: woodTexture,
      bumpMap: woodTexture,
      bumpScale: 0.002,
      roughness: 0.82,
      metalness: 0.02,
    })

    // Grip Cord Wrap - Friction Hemp / Weathered Leather
    const gripWrapMat = new THREE.MeshStandardMaterial({
      color: '#322216',
      map: hempTexture,
      bumpMap: hempTexture,
      bumpScale: 0.003,
      roughness: 0.88,
      metalness: 0.04,
    })

    // Cutting Edge - Razor Sharpened Silver Bevel
    const edgeSteelMat = new THREE.MeshStandardMaterial({
      color: '#d4dee8',
      metalness: 0.96,
      roughness: 0.16,
    })

    // Central Fuller Spine - Forged Carbon Steel
    const fullerSteelMat = new THREE.MeshStandardMaterial({
      color: '#76808a',
      metalness: 0.90,
      roughness: 0.28,
    })

    return { darkSteelMat, handleWoodMat, gripWrapMat, edgeSteelMat, fullerSteelMat }
  }, [woodTexture, hempTexture])

  // Aerodynamic Blade Slipstream Trail Geometry
  const dynamicTrailGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const vertexCount = TRAIL_STEPS * 2
    const positions = new Float32Array(vertexCount * 3)
    const uvs = new Float32Array(vertexCount * 2)
    const indices: number[] = []

    for (let i = 0; i < TRAIL_STEPS; i++) {
      const u = i / (TRAIL_STEPS - 1)
      uvs[i * 4 + 0] = u
      uvs[i * 4 + 1] = 0.0 // Base
      uvs[i * 4 + 2] = u
      uvs[i * 4 + 3] = 1.0 // Tip

      if (i < TRAIL_STEPS - 1) {
        const i0 = i * 2
        const i1 = i * 2 + 1
        const i2 = (i + 1) * 2
        const i3 = (i + 1) * 2 + 1
        indices.push(i0, i1, i2)
        indices.push(i2, i1, i3)
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    return geo
  }, [])

  // Audio trigger on equip / unequip
  useEffect(() => {
    if (isSwordActive && !wasActive.current) {
      sound.playSwordEquip()
    }
    wasActive.current = isSwordActive
  }, [isSwordActive])

  // ── Mouse & Keyboard Combat Inputs ──────────────────────────────────────────
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
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!isSwordActive) return
      if (e.button === 0 && isHoldingLMB.current) {
        isHoldingLMB.current = false
        const holdDuration = (performance.now() - holdStartTime.current) / 1000

        if (holdDuration >= 0.40) {
          // Heavy Cleave Finisher
          triggerSwing('heavy')
        } else {
          // Light Combo Chain
          advanceCombo()
        }
      } else if (e.button === 2) {
        isGuarding.current = false
      }
    }

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isSwordActive])

  const advanceCombo = () => {
    if (currentSwing.current !== 'none') return

    const now = performance.now()
    const timeSinceLast = (now - comboWindowTimer.current) / 1000

    let nextCombo: SwingType = 'combo1'
    if (timeSinceLast < 1.1) {
      if (lastComboIndex.current === 1) nextCombo = 'combo2'
      else if (lastComboIndex.current === 2) nextCombo = 'combo3'
      else nextCombo = 'combo1'
    } else {
      nextCombo = 'combo1'
    }

    triggerSwing(nextCombo)
  }

  const triggerSwing = (type: SwingType) => {
    currentSwing.current = type
    swingTimer.current = 0
    hasHitInCurrentSwing.current = false
    comboWindowTimer.current = performance.now()

    if (type === 'combo1') {
      swingDuration.current = 0.28
      lastComboIndex.current = 1
      sound.playSwordSwing(1)
      posSpring.current.addImpulse(new THREE.Vector3(-0.06, 0.04, -0.08))
      rotSpring.current.addImpulse(new THREE.Vector3(0.4, 0.6, -0.5))
    } else if (type === 'combo2') {
      swingDuration.current = 0.26
      lastComboIndex.current = 2
      sound.playSwordSwing(2)
      posSpring.current.addImpulse(new THREE.Vector3(0.08, 0.06, -0.06))
      rotSpring.current.addImpulse(new THREE.Vector3(-0.4, -0.7, 0.6))
    } else if (type === 'combo3') {
      swingDuration.current = 0.34
      lastComboIndex.current = 3
      sound.playSwordSwing(3)
      posSpring.current.addImpulse(new THREE.Vector3(0.0, -0.08, -0.12))
      rotSpring.current.addImpulse(new THREE.Vector3(0.8, 0.0, 0.1))
    } else if (type === 'heavy') {
      swingDuration.current = 0.45
      lastComboIndex.current = 0
      sound.playSwordChargeRelease()
      posSpring.current.addImpulse(new THREE.Vector3(-0.12, 0.05, -0.15))
      rotSpring.current.addImpulse(new THREE.Vector3(0.3, 1.2, -0.8))
    }

    // Aerodynamic blade wind blast
    if (onSwordSwingWind) {
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      const power = type === 'heavy' ? 2.5 : 1.2
      onSwordSwingWind(camera.position, fwd, power)
    }
  }

  // ── Per-Frame Viewmodel Rig & Kinematics ───────────────────────────────────
  useFrame((state, delta) => {
    if (!swordRootRef.current) return
    const dt = Math.min(delta, 0.05)
    const time = state.clock.elapsedTime

    // 1. Equip / Unequip transition
    if (!isSwordActive) {
      equipProgress.current = THREE.MathUtils.damp(equipProgress.current, 0.0, 16, dt)
      if (equipProgress.current < 0.06) {
        equipProgress.current = 0.0
        swordRootRef.current.visible = false
        return
      }
    } else {
      equipProgress.current = THREE.MathUtils.damp(equipProgress.current, 1.0, 16, dt)
    }
    swordRootRef.current.visible = true

    // 2. Camera Look-Inertia Impulse Calculation
    if (prevCamQuat.current.lengthSq() > 0.001) {
      const deltaQuat = prevCamQuat.current.clone().invert().multiply(camera.quaternion)
      const yawDelta = -deltaQuat.y * 2.0
      const pitchDelta = deltaQuat.x * 2.0

      posSpring.current.addImpulse(new THREE.Vector3(-yawDelta * 0.05, pitchDelta * 0.05, 0))
      rotSpring.current.addImpulse(new THREE.Vector3(pitchDelta * 0.4, yawDelta * 0.4, -yawDelta * 0.3))
    }
    prevCamQuat.current.copy(camera.quaternion)

    // 3. Natural Organic Locomotion Bob & Respiration
    walkBobTimer.current += dt * 4.5
    breathTimer.current += dt * 1.8

    const bobX = Math.cos(walkBobTimer.current * 0.5) * 0.004
    const bobY = Math.sin(walkBobTimer.current) * 0.006 + Math.sin(breathTimer.current) * 0.002
    const bobRotZ = Math.cos(walkBobTimer.current * 0.5) * 0.015

    // 4. Heavy Charge Build-Up
    if (isHoldingLMB.current && currentSwing.current === 'none') {
      const holdTime = (performance.now() - holdStartTime.current) / 1000
      chargeProgress.current = Math.min(1.0, holdTime / 0.40)
    } else {
      chargeProgress.current = THREE.MathUtils.damp(chargeProgress.current, 0.0, 14, dt)
    }

    // 5. Crown Guard (Right Click)
    guardProgress.current = THREE.MathUtils.damp(
      guardProgress.current,
      isGuarding.current ? 1.0 : 0.0,
      16,
      dt
    )

    // 6. Swing Kinematics & Quaternion Blending
    let swingProgress = 0
    let swingQuat = new THREE.Quaternion()
    let swingOffset = new THREE.Vector3()

    if (currentSwing.current !== 'none') {
      if (hitStopTimer.current > 0) {
        // Micro Hit-Stop on Impact
        hitStopTimer.current -= dt
      } else {
        swingTimer.current += dt
      }

      swingProgress = Math.min(1.0, swingTimer.current / swingDuration.current)
      const t = swingProgress

      if (currentSwing.current === 'combo1') {
        // Oberhau: Right shoulder diagonal cleave to low left
        const ease = THREE.MathUtils.smoothstep(t, 0, 1)
        const qStart = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0.5, -0.4))
        const qEnd = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, -0.6, 0.7))
        swingQuat.slerpQuaternions(qStart, qEnd, ease)
        swingOffset.set(
          THREE.MathUtils.lerp(0.08, -0.14, ease),
          THREE.MathUtils.lerp(0.06, -0.10, ease),
          THREE.MathUtils.lerp(-0.04, -0.12, Math.sin(ease * Math.PI))
        )
      } else if (currentSwing.current === 'combo2') {
        // Unterhau: Low left diagonal cleave to high right
        const ease = THREE.MathUtils.smoothstep(t, 0, 1)
        const qStart = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, -0.5, 0.5))
        const qEnd = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0.6, -0.6))
        swingQuat.slerpQuaternions(qStart, qEnd, ease)
        swingOffset.set(
          THREE.MathUtils.lerp(-0.12, 0.10, ease),
          THREE.MathUtils.lerp(-0.08, 0.08, ease),
          THREE.MathUtils.lerp(-0.04, -0.10, Math.sin(ease * Math.PI))
        )
      } else if (currentSwing.current === 'combo3') {
        // Zornhau: Crushing overhead smash
        const ease = THREE.MathUtils.smoothstep(t, 0, 1)
        const qStart = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7, 0.1, -0.1))
        const qEnd = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.7, 0.0, 0.0))
        swingQuat.slerpQuaternions(qStart, qEnd, ease)
        swingOffset.set(
          THREE.MathUtils.lerp(0.02, 0.0, ease),
          THREE.MathUtils.lerp(0.12, -0.18, ease),
          THREE.MathUtils.lerp(-0.02, -0.16, Math.sin(ease * Math.PI))
        )
      } else if (currentSwing.current === 'heavy') {
        // Heavy Cleave: 270° horizontal whirlwind
        const ease = THREE.MathUtils.smoothstep(t, 0, 1)
        const qStart = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 1.2, -0.8))
        const qEnd = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, -1.4, 0.9))
        swingQuat.slerpQuaternions(qStart, qEnd, ease)
        swingOffset.set(
          THREE.MathUtils.lerp(0.18, -0.22, ease),
          THREE.MathUtils.lerp(0.02, 0.0, ease),
          THREE.MathUtils.lerp(-0.06, -0.20, Math.sin(ease * Math.PI))
        )
      }

      if (swingProgress >= 1.0) {
        currentSwing.current = 'none'
      }
    }

    // 7. Dynamic Spring Target Setup
    // Authentic Lower-Right Martial Ready Stance:
    // Guard Y~-0.18m, Blade Tip tilted forward into depth
    const eqY = (1.0 - equipProgress.current) * -0.6
    const gFactor = guardProgress.current
    const cFactor = chargeProgress.current

    const readyX = 0.23 + bobX
    const readyY = -0.18 + bobY + eqY
    const readyZ = -0.46

    // Guard stance: crosshair braced across center chest
    const guardX = 0.0
    const guardY = -0.06
    const guardZ = -0.38

    // Charge stance: drawn back beside right ear
    const chargeX = 0.28
    const chargeY = 0.04
    const chargeZ = -0.32

    let targetX = THREE.MathUtils.lerp(readyX, guardX, gFactor)
    let targetY = THREE.MathUtils.lerp(readyY, guardY, gFactor)
    let targetZ = THREE.MathUtils.lerp(readyZ, guardZ, gFactor)

    targetX = THREE.MathUtils.lerp(targetX, chargeX, cFactor) + swingOffset.x
    targetY = THREE.MathUtils.lerp(targetY, chargeY, cFactor) + swingOffset.y
    targetZ = THREE.MathUtils.lerp(targetZ, chargeZ, cFactor) + swingOffset.z

    posSpring.current.target.set(targetX, targetY, targetZ)
    rotSpring.current.target.set(
      THREE.MathUtils.lerp(0.12, 0.25, gFactor),
      THREE.MathUtils.lerp(-0.18, 0.45, gFactor),
      THREE.MathUtils.lerp(-0.14, -0.55, gFactor) + bobRotZ
    )

    const curPos = posSpring.current.update(dt)
    const curRot = rotSpring.current.update(dt)

    // Position relative to camera corridor
    swordRootRef.current.position.copy(camera.position)
    swordRootRef.current.quaternion.copy(camera.quaternion)

    const localGroup = swordRootRef.current.children[0]
    if (localGroup) {
      localGroup.position.copy(curPos)
      const baseQ = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(curRot.x, curRot.y, curRot.z, 'YXZ')
      )
      if (currentSwing.current !== 'none') {
        baseQ.multiply(swingQuat)
      }
      localGroup.quaternion.copy(baseQ)
    }

    // 8. Physical Collision & Sparking against Rocks
    if (currentSwing.current !== 'none' && !hasHitInCurrentSwing.current && localGroup) {
      // Tip is at (0, 0.52, 0) in local space
      const swordTipWorld = new THREE.Vector3(0, 0.52, 0)
      localGroup.localToWorld(swordTipWorld)

      const prevTipWorld = localGroup.localToWorld(new THREE.Vector3(0, 0.20, 0))
      const rockHit = worldCollisionSystem.checkRay(prevTipWorld, swordTipWorld, 0.12)

      if (rockHit && rockHit.collider.tag === 'rock') {
        hasHitInCurrentSwing.current = true
        hitStopTimer.current = 0.06 // 60ms tactile hit-stop
        sound.playRockStrike(1.0)
        posSpring.current.addImpulse(new THREE.Vector3(0.04, 0.06, 0.08))
        rotSpring.current.addImpulse(new THREE.Vector3(-0.3, 0.4, 0.2))

        if (onHitRock) {
          onHitRock(rockHit.hitPoint, rockHit.normal, currentSwing.current === 'heavy' ? 2.0 : 1.0)
        }
      }
    }

    // 9. Aerodynamic Blade Trail History Update
    if (localGroup) {
      const tipLocal = new THREE.Vector3(0, 0.52, 0).applyQuaternion(localGroup.quaternion).add(localGroup.position)
      const baseLocal = new THREE.Vector3(0, 0.08, 0).applyQuaternion(localGroup.quaternion).add(localGroup.position)

      trailHistory.current.unshift({ tip: tipLocal, base: baseLocal })
      if (trailHistory.current.length > TRAIL_STEPS) {
        trailHistory.current.pop()
      }

      const isSwinging = currentSwing.current !== 'none'
      trailAlphaRef.current = THREE.MathUtils.damp(
        trailAlphaRef.current,
        isSwinging ? 0.65 : 0.0,
        18,
        dt
      )

      if (trailMeshRef.current && dynamicTrailGeo) {
        const posAttr = dynamicTrailGeo.getAttribute('position') as THREE.BufferAttribute
        const arr = posAttr.array as Float32Array

        for (let i = 0; i < TRAIL_STEPS; i++) {
          const entry = trailHistory.current[i] || trailHistory.current[0]
          arr[i * 6 + 0] = entry.base.x
          arr[i * 6 + 1] = entry.base.y
          arr[i * 6 + 2] = entry.base.z

          arr[i * 6 + 3] = entry.tip.x
          arr[i * 6 + 4] = entry.tip.y
          arr[i * 6 + 5] = entry.tip.z
        }

        posAttr.needsUpdate = true
        dynamicTrailGeo.computeBoundingSphere()
        ;(trailMeshRef.current.material as THREE.MeshBasicMaterial).opacity = trailAlphaRef.current
        trailMeshRef.current.visible = trailAlphaRef.current > 0.02
      }
    }
  })

  return (
    <group
      ref={swordRootRef}
      renderOrder={999}
      onBeforeRender={(renderer) => {
        renderer.clearDepth()
      }}
    >
      <group>
        {/* Authentic 3D Handcrafted Steel Sword Model */}
        {nodes.Sword_1 && (
          <group rotation={[-Math.PI / 2, 0, 0]} scale={11.0}>
            {/* 1. Crossguard, Quillons & Counterweight Pommel */}
            <mesh
              geometry={nodes.Sword_1.geometry}
              material={materials.darkSteelMat}
              castShadow
            />

            {/* 2. Carved Mountain Hardwood Handle Core */}
            <mesh
              geometry={nodes.Sword_2.geometry}
              material={materials.handleWoodMat}
            />

            {/* 3. Bound Weathered Leather / Hemp Friction Cord Wrap */}
            <mesh
              geometry={nodes.Sword_3.geometry}
              material={materials.gripWrapMat}
            />

            {/* 4. Razor Sharpened Silver Cutting Edge Bevels */}
            <mesh
              geometry={nodes.Sword_4.geometry}
              material={materials.edgeSteelMat}
              castShadow
            />

            {/* 5. Forged Carbon Steel Central Spine & Fuller Groove */}
            <mesh
              geometry={nodes.Sword_5.geometry}
              material={materials.fullerSteelMat}
            />
          </group>
        )}
      </group>

      {/* Aerodynamic Blade-Edge Slipstream Trail */}
      <mesh ref={trailMeshRef} geometry={dynamicTrailGeo}>
        <meshBasicMaterial
          color="#d8e8f8"
          transparent
          opacity={0.0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

useGLTF.preload('/assets/models/Sword.glb')
