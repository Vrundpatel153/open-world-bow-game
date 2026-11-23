// ─────────────────────────────────────────────────────────────────────────────
// TorchViewModel — AAA Authentic Handcrafted Survival Wooden Fire Torch
// Authentic Wilderness Survivalist Torch (Tomb Raider, The Forest, Green Hell):
// - Rough Natural Tree Branch Stave:
//     * Curved, knotted mountain pine/oak branch with rugged bark grain
//     * Whittled grip section with fibrous hemp twine wrapping
//     * Carved branch pommel base with knotted cord loop
// - Heavy Pine-Pitch Soaked Burlap Rag Wrap Bundle:
//     * Thick torn cloth strips wrapped tightly around the head of the branch
//     * Layered uneven folds with ragged, charred edges
// - Criss-Crossing Charred Hemp Twine & Cord Rope Bindings:
//     * Coarse hemp rope lashed firmly around the cloth bundle with authentic knots
//     * ZERO artificial blacksmith iron cage baskets or metal collar brackets
// - Incandescent Charred Pine-Pitch & Embers Core:
//     * Pitch-soaked charcoal core with deep orange incandescent glow
// - Procedural Teardrop Volumetric Flame (TeardropFlameMaterial):
//     * Mathematical teardrop envelope with multi-octave FBM turbulence
//     * Blackbody thermal radiation palette: white-hot core -> gold -> crimson
//     * Responsive wind tilt and locomotion drag
// - Dynamic PointLight & Wind-Carried Embers / Sparks
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useQuestStore } from '../stores/questStore'
import { sound } from '../audio/SoundSynthesizer'
import { inputManager } from '@/systems/KeyboardInput'
import { createTeardropFlameMaterial } from './TeardropFlameMaterial'

const MAX_TORCH_EMBERS = 60

interface TorchEmber {
  pos: THREE.Vector3
  vel: THREE.Vector3
  life: number
  maxLife: number
  size: number
}

// ── Open-Source Second-Order Spring-Damper for Viewmodel Inertia ─────────────
class SpringDamper3D {
  public current = new THREE.Vector3()
  public target = new THREE.Vector3()
  public velocity = new THREE.Vector3()
  public stiffness: number
  public damping: number

  constructor(stiffness = 160, damping = 18) {
    this.stiffness = stiffness
    this.damping = damping
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

// ── Procedural Textures for Wilderness Survival Torch ───────────────────────
function createBarkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  ctx.fillStyle = '#3a2414'
  ctx.fillRect(0, 0, 512, 512)

  // Vertical rough bark fissures
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 512
    const width = 2 + Math.random() * 5
    ctx.fillStyle = Math.random() > 0.4 ? '#25160b' : '#4d321d'
    ctx.globalAlpha = 0.25 + Math.random() * 0.35
    ctx.fillRect(x, 0, width, 512)
  }

  // Horizontal bark ridges
  ctx.globalAlpha = 0.15
  ctx.strokeStyle = '#1b1007'
  ctx.lineWidth = 2.5
  for (let y = 0; y < 512; y += 18) {
    ctx.beginPath()
    for (let x = 0; x <= 512; x += 16) {
      const wave = Math.sin(x * 0.04) * 3 + Math.sin(x * 0.1) * 1.5
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

function createBurlapClothTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  // Charred pitch-soaked rag base
  ctx.fillStyle = '#1c1510'
  ctx.fillRect(0, 0, 512, 512)

  // Woven burlap fiber crosshatching
  ctx.strokeStyle = '#2d221a'
  ctx.lineWidth = 1.6
  for (let i = 0; i < 512; i += 8) {
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 512)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(512, i)
    ctx.stroke()
  }

  // Pitch soot stains & charred smudges
  ctx.globalAlpha = 0.55
  for (let s = 0; s < 12; s++) {
    const sx = Math.random() * 512
    const sy = Math.random() * 512
    const r = 20 + Math.random() * 45
    const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, r)
    grad.addColorStop(0, '#0c0806')
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(sx, sy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)
  return texture
}

function createHempRopeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  ctx.fillStyle = '#6a5336'
  ctx.fillRect(0, 0, 256, 256)

  // Diagonal twisted twine strands
  ctx.strokeStyle = '#42331e'
  ctx.lineWidth = 2.0
  for (let i = -256; i < 512; i += 8) {
    ctx.globalAlpha = 0.4
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + 256, 256)
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 3)
  return texture
}

export default function TorchViewModel() {
  const { camera } = useThree()
  const torchRootRef = useRef<THREE.Group>(null!)
  const flameGroupRef = useRef<THREE.Group>(null!)
  const flameLightRef = useRef<THREE.PointLight>(null!)
  const emberMatRef = useRef<THREE.MeshStandardMaterial>(null!)
  const emberPointsRef = useRef<THREE.Points>(null!)

  const activeItem = useQuestStore((s) => s.activeItem)
  const isTorchActive = activeItem === 'torch'

  const equipProgress = useRef(0.0)
  const walkBobTimer = useRef(0)
  const breathTimer = useRef(0)
  const waveTimer = useRef(0)
  const wasActive = useRef(false)

  // Physics springs for organic look-sway and bobbing
  const posSpring = useRef(new SpringDamper3D(160, 18))
  const rotSpring = useRef(new SpringDamper3D(140, 16))
  const prevCamQuat = useRef(new THREE.Quaternion())

  // Wind direction vector (synchronized with world: 45° North-East)
  const windDir = useMemo(() => {
    const rad = 45 * (Math.PI / 180)
    return new THREE.Vector3(Math.cos(rad), 0, Math.sin(rad))
  }, [])

  // ── Procedural Textures ─────────────────────────────────────────────────────
  const barkTexture = useMemo(() => createBarkTexture(), [])
  const burlapTexture = useMemo(() => createBurlapClothTexture(), [])
  const ropeTexture = useMemo(() => createHempRopeTexture(), [])

  // ── Procedural Geometries for Authentic Handcrafted Wooden Survival Torch ───
  const {
    branchStaveGeo,
    forkProngGeos,
    charredStakeGeos,
    handleWrapGeo,
    handleWrapRingsGeos,
    pommelKnotGeo,
    burlapWrapGeo,
    burlapFoldsGeos,
    twineLashGeos,
    coalChunkGeos,
    innerEmberGeo,
    flamePlaneGeo,
    coreFlamePlaneGeo,
  } = useMemo(() => {
    // 1. Natural Rugged Mountain Tree Branch Stave (Length ~0.40m)
    // Modeled with natural organic curve and taper (radius 0.013m to 0.016m)
    const branchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.002, -0.16, 0.001),
      new THREE.Vector3(0.005, -0.08, -0.003),
      new THREE.Vector3(0.001, 0.02, 0.002),
      new THREE.Vector3(-0.004, 0.11, -0.002),
      new THREE.Vector3(0.0, 0.18, 0.003),
      new THREE.Vector3(0.002, 0.22, 0.0),
    ])
    const branchStave = new THREE.TubeGeometry(branchCurve, 24, 0.0145, 12, false)

    // 2. Forked Branch Prongs (Split top of branch that cups the fuel bundle)
    const forkProngs: THREE.BufferGeometry[] = []
    const forkAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]
    for (const fa of forkAngles) {
      const pCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(fa) * 0.012, 0.17, Math.sin(fa) * 0.012),
        new THREE.Vector3(Math.cos(fa) * 0.022, 0.20, Math.sin(fa) * 0.022),
        new THREE.Vector3(Math.cos(fa) * 0.024, 0.235, Math.sin(fa) * 0.024),
      ])
      forkProngs.push(new THREE.TubeGeometry(pCurve, 10, 0.0038, 8, false))
    }

    // 3. Charred Wooden Fire Stakes & Splinters jutting up through the center of the rags
    const fireStakes: THREE.BufferGeometry[] = []
    const stakeOffsets = [
      { x: -0.008, z: 0.005, yTop: 0.275, tilt: 0.08 },
      { x: 0.007, z: -0.006, yTop: 0.265, tilt: -0.10 },
      { x: 0.004, z: 0.008, yTop: 0.280, tilt: 0.05 },
      { x: -0.005, z: -0.007, yTop: 0.260, tilt: -0.06 },
    ]
    for (const so of stakeOffsets) {
      const sGeo = new THREE.CylinderGeometry(0.0020, 0.0035, so.yTop - 0.20, 7)
      sGeo.rotateZ(so.tilt)
      sGeo.translate(so.x, (so.yTop + 0.20) * 0.5, so.z)
      fireStakes.push(sGeo)
    }

    // 4. Weathered Hand-Tied Twine Grip Section
    const grip = new THREE.CylinderGeometry(0.0152, 0.0155, 0.11, 14)
    grip.translate(0, -0.04, 0)

    const rings: THREE.TorusGeometry[] = []
    const ringYs = [-0.08, -0.05, -0.02, 0.01]
    for (const ry of ringYs) {
      const ring = new THREE.TorusGeometry(0.0155, 0.0020, 6, 16)
      ring.rotateX(Math.PI / 2)
      ring.translate(0, ry, 0)
      rings.push(ring)
    }

    // Survival cord lanyard loop at branch base
    const pommelKnot = new THREE.TorusGeometry(0.013, 0.0028, 6, 16)
    pommelKnot.translate(0, -0.160, 0)

    // 5. Heavy Pine-Pitch Soaked Burlap Rag Wrap Bundle (Top of Branch)
    const burlapWrap = new THREE.CylinderGeometry(0.029, 0.021, 0.080, 14)
    burlapWrap.translate(0, 0.195, 0)

    // Organic cloth folds & frayed wraps
    const clothFolds: THREE.BufferGeometry[] = []
    const cuff1 = new THREE.CylinderGeometry(0.026, 0.022, 0.024, 12)
    cuff1.translate(0, 0.165, 0)
    clothFolds.push(cuff1)

    const cuff2 = new THREE.CylinderGeometry(0.032, 0.028, 0.032, 12)
    cuff2.translate(0, 0.202, 0)
    clothFolds.push(cuff2)

    const cuff3 = new THREE.CylinderGeometry(0.033, 0.030, 0.020, 12)
    cuff3.translate(0, 0.228, 0)
    clothFolds.push(cuff3)

    // Hanging frayed rag tabs
    const tabCurve1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.023, 0.175, 0.01),
      new THREE.Vector3(0.025, 0.145, 0.012),
      new THREE.Vector3(0.020, 0.125, 0.008),
    ])
    clothFolds.push(new THREE.TubeGeometry(tabCurve1, 8, 0.0035, 6, false))

    const tabCurve2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.022, 0.170, -0.01),
      new THREE.Vector3(-0.024, 0.140, -0.012),
      new THREE.Vector3(-0.018, 0.118, -0.007),
    ])
    clothFolds.push(new THREE.TubeGeometry(tabCurve2, 8, 0.0032, 6, false))

    // 6. Wilderness Twine / Cord Lashings
    const twineGeos: THREE.BufferGeometry[] = []
    const cordLevels = [0.162, 0.185, 0.208]
    const cordRadii = [0.023, 0.028, 0.031]
    for (let i = 0; i < cordLevels.length; i++) {
      const cord = new THREE.TorusGeometry(cordRadii[i], 0.0022, 6, 18)
      cord.rotateX(Math.PI / 2 + 0.06)
      cord.translate(0, cordLevels[i], 0)
      twineGeos.push(cord)
    }

    // Criss-cross diagonal lashings
    const diagLash1Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.025, 0.165, 0.012),
      new THREE.Vector3(0.0, 0.195, 0.029),
      new THREE.Vector3(0.027, 0.225, 0.015),
      new THREE.Vector3(0.027, 0.225, -0.015),
      new THREE.Vector3(0.0, 0.195, -0.029),
      new THREE.Vector3(-0.025, 0.165, -0.012),
    ], true)
    twineGeos.push(new THREE.TubeGeometry(diagLash1Curve, 18, 0.0020, 6, true))

    const diagLash2Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.025, 0.225, 0.015),
      new THREE.Vector3(0.0, 0.195, 0.029),
      new THREE.Vector3(0.027, 0.165, 0.012),
      new THREE.Vector3(0.027, 0.165, -0.012),
      new THREE.Vector3(0.0, 0.195, -0.029),
      new THREE.Vector3(-0.025, 0.225, -0.015),
    ], true)
    twineGeos.push(new THREE.TubeGeometry(diagLash2Curve, 18, 0.0020, 6, true))

    // 7. Bumpy Organic Charcoal Chunks & Glowing Embers Bed (NO FLAT DISCS!)
    const coalChunks: THREE.BufferGeometry[] = []
    const coalOffsets = [
      { x: 0.0, y: 0.235, z: 0.0, r: 0.013 },
      { x: -0.012, y: 0.233, z: 0.008, r: 0.009 },
      { x: 0.011, y: 0.234, z: -0.009, r: 0.010 },
      { x: -0.008, y: 0.236, z: -0.011, r: 0.008 },
      { x: 0.012, y: 0.235, z: 0.007, r: 0.009 },
      { x: 0.001, y: 0.240, z: -0.002, r: 0.011 },
      { x: -0.014, y: 0.230, z: -0.004, r: 0.007 },
      { x: 0.015, y: 0.231, z: 0.002, r: 0.008 },
    ]
    for (const co of coalOffsets) {
      const cGeo = new THREE.DodecahedronGeometry(co.r, 0)
      cGeo.translate(co.x, co.y, co.z)
      coalChunks.push(cGeo)
    }

    // Deep inner glowing coal crevice (hidden deep inside, glowing through cracks)
    const innerGlowingCoals = new THREE.DodecahedronGeometry(0.016, 1)
    innerGlowingCoals.translate(0, 0.230, 0)

    // 8. Quad-Planar Volumetric Survival Wood Fire (Width 0.22m, Height 0.36m)
    const flamePlane = new THREE.PlaneGeometry(0.22, 0.36)
    flamePlane.translate(0, 0.18, 0) // Pivot at base

    const coreFlamePlane = new THREE.PlaneGeometry(0.15, 0.24)
    coreFlamePlane.translate(0, 0.12, 0)

    return {
      branchStaveGeo: branchStave,
      forkProngGeos: forkProngs,
      charredStakeGeos: fireStakes,
      handleWrapGeo: grip,
      handleWrapRingsGeos: rings,
      pommelKnotGeo: pommelKnot,
      burlapWrapGeo: burlapWrap,
      burlapFoldsGeos: clothFolds,
      twineLashGeos: twineGeos,
      coalChunkGeos: coalChunks,
      innerEmberGeo: innerGlowingCoals,
      flamePlaneGeo: flamePlane,
      coreFlamePlaneGeo: coreFlamePlane,
    }
  }, [])

  // Procedural Teardrop Flame Material
  const flameMaterial = useMemo(() => {
    return createTeardropFlameMaterial()
  }, [])

  // Soft glowing ember spark particle texture
  const sparkTexture = useMemo(() => {
    const loader = new THREE.TextureLoader()
    return loader.load('/assets/sparkle-particle.png')
  }, [])

  // ── Particle Pool for Embers & Flying Sparks ────────────────────────────────
  const embers = useRef<TorchEmber[]>([])
  const positions = useRef(new Float32Array(MAX_TORCH_EMBERS * 3))
  const colors = useRef(new Float32Array(MAX_TORCH_EMBERS * 3))
  const sizes = useRef(new Float32Array(MAX_TORCH_EMBERS))

  // Audio trigger on equip / unequip
  useEffect(() => {
    if (isTorchActive && !wasActive.current) {
      sound.playTorchIgnite()
    } else if (!isTorchActive && wasActive.current) {
      sound.playTorchExtinguish()
    }
    wasActive.current = isTorchActive
  }, [isTorchActive])

  // Mouse click wave / thrust action
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!isTorchActive) return
      if (e.target instanceof Element && e.target.closest('[class*="leva"], button, a')) return
      if (e.button === 0 && waveTimer.current <= 0) {
        waveTimer.current = 0.42
        sound.playTorchWave()
        posSpring.current.addImpulse(new THREE.Vector3(-0.02, 0.02, -0.06))
        rotSpring.current.addImpulse(new THREE.Vector3(-0.15, -0.25, 0.18))
      }
    }

    window.addEventListener('mousedown', handleMouseDown)
    return () => window.removeEventListener('mousedown', handleMouseDown)
  }, [isTorchActive])

  // ── Per-Frame Viewmodel Rig, Multi-Octave Flame & Embers ───────────────────
  useFrame((state, delta) => {
    if (!torchRootRef.current) return
    const dt = Math.min(delta, 0.05)
    const time = state.clock.elapsedTime

    // Equip / Unequip transition
    if (!isTorchActive) {
      equipProgress.current = THREE.MathUtils.damp(equipProgress.current, 0.0, 16, dt)
      if (equipProgress.current < 0.08) {
        equipProgress.current = 0.0
        torchRootRef.current.visible = false
        if (emberPointsRef.current) emberPointsRef.current.visible = false
        return
      }
    } else {
      equipProgress.current = THREE.MathUtils.damp(equipProgress.current, 1.0, 16, dt)
    }
    torchRootRef.current.visible = true
    if (emberPointsRef.current) emberPointsRef.current.visible = true

    // 1. Camera Look-Inertia Impulse Calculation
    if (prevCamQuat.current.lengthSq() > 0.001) {
      const deltaQuat = prevCamQuat.current.clone().invert().multiply(camera.quaternion)
      const yawDelta = -deltaQuat.y * 2.0
      const pitchDelta = deltaQuat.x * 2.0

      posSpring.current.addImpulse(new THREE.Vector3(-yawDelta * 0.05, pitchDelta * 0.05, 0))
      rotSpring.current.addImpulse(new THREE.Vector3(-pitchDelta * 0.30, -yawDelta * 0.30, yawDelta * 0.45))
    }
    prevCamQuat.current.copy(camera.quaternion)

    // 2. Locomotion Bobbing & Idle Respiration
    const isMoving =
      inputManager.isMovingForward() ||
      inputManager.isMovingBackward() ||
      inputManager.isMovingLeft() ||
      inputManager.isMovingRight()
    const isSprinting = isMoving && inputManager.isSprinting()

    walkBobTimer.current += dt * (isMoving ? (isSprinting ? 12.0 : 7.8) : 1.2)
    breathTimer.current += dt * 1.5

    const bobScale = isMoving ? (isSprinting ? 0.014 : 0.008) : 0.0012
    const bobX = Math.cos(walkBobTimer.current * 0.5) * bobScale
    const bobY = -Math.abs(Math.sin(walkBobTimer.current)) * (bobScale * 1.3)
    const swayX = Math.cos(breathTimer.current * 1.1) * 0.0010
    const swayY = Math.sin(breathTimer.current * 2.2) * 0.0008

    posSpring.current.target.set(bobX + swayX, bobY + swayY, 0)
    rotSpring.current.target.set(bobY * 1.8, bobX * 1.2, -bobX * 2.5)
    const springPosOffset = posSpring.current.update(dt)
    const springRotOffset = rotSpring.current.update(dt)

    // 3. First-Person Viewport Framing (Lower-Right Quadrant)
    const unequipDrop = 1.0 - equipProgress.current
    const pRest = new THREE.Vector3(0.24, -0.23 - unequipDrop * 0.75, -0.44)
    const qRest = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.05 - unequipDrop * 0.55, -0.09, 0.18 - unequipDrop * 0.35, 'YXZ')
    )

    let finalPos = pRest.clone()
    let finalQuat = qRest.clone()

    // 4. Wave / Thrust Animation
    if (waveTimer.current > 0) {
      waveTimer.current -= dt
      const u = Math.max(0, 1.0 - waveTimer.current / 0.42)
      const thrust = Math.sin(u * Math.PI)
      finalPos.x -= thrust * 0.06
      finalPos.y += thrust * 0.04
      finalPos.z -= thrust * 0.10
      const qWave = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-thrust * 0.35, -thrust * 0.45, thrust * 0.30, 'YXZ')
      )
      finalQuat.multiply(qWave)
    }

    finalPos.add(springPosOffset)
    const qSway = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(springRotOffset.x, springRotOffset.y, springRotOffset.z, 'YXZ')
    )
    finalQuat.multiply(qSway)

    // Apply viewmodel transform relative to camera
    const worldPos = finalPos.clone().applyQuaternion(camera.quaternion).add(camera.position)
    torchRootRef.current.position.copy(worldPos)
    torchRootRef.current.quaternion.copy(camera.quaternion).multiply(finalQuat)

    // ── Update Teardrop Flame Shader Uniforms & Organic Wind Lean ─────────────
    if (flameMaterial && flameMaterial.uniforms) {
      if (flameMaterial.uniforms.uTime) flameMaterial.uniforms.uTime.value = time
      if (flameMaterial.uniforms.uWind) flameMaterial.uniforms.uWind.value.copy(windDir)
      const gust = 1.0 + Math.sin(time * 2.4) * 0.25 + Math.cos(time * 5.1) * 0.15
      if (flameMaterial.uniforms.uWindStrength) flameMaterial.uniforms.uWindStrength.value = gust
    }

    if (flameGroupRef.current) {
      const flameLeanX = Math.sin(time * 3.2) * 0.05 + 0.06
      const flameLeanZ = Math.cos(time * 2.8) * 0.04
      flameGroupRef.current.rotation.x = flameLeanX
      flameGroupRef.current.rotation.z = flameLeanZ
    }

    // ── Update Dynamic PointLight Illuminating Environment ───────────────────
    if (flameLightRef.current) {
      // Natural 3-frequency blackbody thermal flicker
      const flicker1 = Math.sin(time * 14.5) * 0.22
      const flicker2 = Math.cos(time * 28.2) * 0.15
      const flicker3 = Math.sin(time * 47.1) * 0.08
      const totalFlicker = 1.0 + flicker1 + flicker2 + flicker3

      flameLightRef.current.intensity = 4.2 * totalFlicker * equipProgress.current
      flameLightRef.current.distance = 26.0 + totalFlicker * 2.0
    }

    // Update glowing coal bed emissive pulse
    if (emberMatRef.current) {
      const emberPulse = 2.4 + Math.sin(time * 8.0) * 0.6 + Math.cos(time * 19.0) * 0.4
      emberMatRef.current.emissiveIntensity = emberPulse * equipProgress.current
    }

    // ── Update Global Wind-Carried Embers & Flying Sparks ────────────────────
    if (isTorchActive && equipProgress.current > 0.5) {
      // Spawn new embers at flame base in world space
      if (Math.random() < 0.45 && embers.current.length < MAX_TORCH_EMBERS) {
        const torchHeadWorld = new THREE.Vector3(0, 0.24, 0)
        torchHeadWorld.applyQuaternion(torchRootRef.current.quaternion).add(torchRootRef.current.position)

        embers.current.push({
          pos: torchHeadWorld.clone().add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.04,
              (Math.random() - 0.5) * 0.02,
              (Math.random() - 0.5) * 0.04
            )
          ),
          vel: new THREE.Vector3(
            windDir.x * 0.6 + (Math.random() - 0.5) * 0.35,
            0.65 + Math.random() * 0.75, // Buoyant thermal updraft
            windDir.z * 0.6 + (Math.random() - 0.5) * 0.35
          ),
          life: 0,
          maxLife: 0.6 + Math.random() * 0.8,
          size: 0.035 + Math.random() * 0.035,
        })
      }
    }

    // Update active embers
    const posArr = positions.current
    const colArr = colors.current
    let activeCount = 0

    for (let i = embers.current.length - 1; i >= 0; i--) {
      const emb = embers.current[i]
      emb.life += dt
      if (emb.life >= emb.maxLife) {
        embers.current.splice(i, 1)
        continue
      }

      // Physics: buoyant rise, wind drift, and drag
      emb.vel.y += 0.25 * dt // Thermal lift
      emb.vel.x += windDir.x * 0.4 * dt
      emb.vel.z += windDir.z * 0.4 * dt
      emb.pos.addScaledVector(emb.vel, dt)

      const u = emb.life / emb.maxLife
      const idx = activeCount * 3

      posArr[idx + 0] = emb.pos.x
      posArr[idx + 1] = emb.pos.y
      posArr[idx + 2] = emb.pos.z

      // Color decay: brilliant white-gold -> radiant orange -> crimson ember
      const r = 1.0
      const g = Math.max(0, 0.85 - u * 0.85)
      const b = Math.max(0, 0.25 - u * 0.35)

      colArr[idx + 0] = r
      colArr[idx + 1] = g
      colArr[idx + 2] = b

      activeCount++
    }

    // Hide remaining unused particle vertices far below terrain
    for (let i = activeCount; i < MAX_TORCH_EMBERS; i++) {
      const idx = i * 3
      posArr[idx + 0] = 0
      posArr[idx + 1] = -9999
      posArr[idx + 2] = 0
    }

    if (emberPointsRef.current) {
      const geo = emberPointsRef.current.geometry
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate = true
    }
  })

  return (
    <>
      {/* 1. First-Person Handcrafted Survival Wooden Fire Torch Viewmodel */}
      <group
        ref={torchRootRef}
        visible={false}
        renderOrder={999}
        onBeforeRender={(renderer) => {
          renderer.clearDepth()
        }}
      >
        {/* Natural Curved Tree Branch Stave */}
        <mesh geometry={branchStaveGeo} castShadow receiveShadow>
          <meshStandardMaterial
            color="#3a2414"
            map={barkTexture}
            roughness={0.88}
            metalness={0.0}
            bumpMap={barkTexture}
            bumpScale={0.0025}
          />
        </mesh>

        {/* Coarse Twine Handle Grip Section */}
        <mesh geometry={handleWrapGeo}>
          <meshStandardMaterial
            color="#5a4428"
            map={ropeTexture}
            roughness={0.92}
            metalness={0.0}
          />
        </mesh>

        {/* Grip wrapping cord rings */}
        {handleWrapRingsGeos.map((geo, idx) => (
          <mesh key={`hring-${idx}`} geometry={geo}>
            <meshStandardMaterial
              color="#42311c"
              roughness={0.85}
              metalness={0.0}
            />
          </mesh>
        ))}

        {/* Knotted cord lanyard loop at branch base */}
        <mesh geometry={pommelKnotGeo}>
          <meshStandardMaterial
            color="#483622"
            roughness={0.90}
            metalness={0.0}
          />
        </mesh>

        {/* Split Mountain Pine Fork Prongs Clasping the Bundle */}
        {forkProngGeos.map((geo, idx) => (
          <mesh key={`fork-${idx}`} geometry={geo} castShadow>
            <meshStandardMaterial
              color="#3a2414"
              map={barkTexture}
              roughness={0.90}
              metalness={0.0}
            />
          </mesh>
        ))}

        {/* Heavy Pine-Pitch Soaked Burlap Cloth Wrap Bundle */}
        <mesh geometry={burlapWrapGeo} castShadow>
          <meshStandardMaterial
            color="#1b140e"
            map={burlapTexture}
            roughness={0.92}
            metalness={0.02}
            bumpMap={burlapTexture}
            bumpScale={0.003}
          />
        </mesh>

        {/* Overlapping Burlap Cloth Folds & Ragged Cuff Lips */}
        {burlapFoldsGeos.map((geo, idx) => (
          <mesh key={`fold-${idx}`} geometry={geo} castShadow>
            <meshStandardMaterial
              color="#150f0a"
              map={burlapTexture}
              roughness={0.94}
              metalness={0.02}
            />
          </mesh>
        ))}

        {/* Charred Hemp Twine & Cord Binding Lashings (Securing Rag to Branch) */}
        {twineLashGeos.map((geo, idx) => (
          <mesh key={`twine-${idx}`} geometry={geo} castShadow>
            <meshStandardMaterial
              color="#543e26"
              map={ropeTexture}
              roughness={0.94}
              metalness={0.0}
            />
          </mesh>
        ))}

        {/* Charred Fire Stakes & Splinters Rising Through Flame Core */}
        {charredStakeGeos.map((geo, idx) => (
          <mesh key={`stake-${idx}`} geometry={geo} castShadow>
            <meshStandardMaterial
              color="#100b08"
              roughness={0.96}
              metalness={0.0}
            />
          </mesh>
        ))}

        {/* Faceted Charcoal Ember Chunks Clustered in Rag Head (No Flat Discs) */}
        {coalChunkGeos.map((geo, idx) => (
          <mesh key={`coal-${idx}`} geometry={geo} castShadow>
            <meshStandardMaterial
              color="#0d0704"
              roughness={0.95}
              metalness={0.02}
            />
          </mesh>
        ))}

        {/* Deep Incandescent Glowing Coal Core Visible Through Cracks */}
        <mesh geometry={innerEmberGeo}>
          <meshStandardMaterial
            ref={emberMatRef}
            color="#180702"
            emissive="#ff3b00"
            emissiveIntensity={2.8}
            roughness={0.90}
          />
        </mesh>

        {/* Quad-Planar Procedural Convective Wood Fire (0°, 45°, 90°, 135°) */}
        <group ref={flameGroupRef} position={[0, 0.228, 0]}>
          <mesh geometry={flamePlaneGeo} material={flameMaterial} />
          <mesh
            geometry={flamePlaneGeo}
            material={flameMaterial}
            rotation={[0, Math.PI * 0.25, 0]}
          />
          <mesh
            geometry={flamePlaneGeo}
            material={flameMaterial}
            rotation={[0, Math.PI * 0.5, 0]}
          />
          <mesh
            geometry={flamePlaneGeo}
            material={flameMaterial}
            rotation={[0, Math.PI * 0.75, 0]}
          />
          {/* Inner core flame for deep multi-layered roaring wood fire */}
          <mesh
            geometry={coreFlamePlaneGeo}
            material={flameMaterial}
            rotation={[0, Math.PI * 0.125, 0]}
          />
          <mesh
            geometry={coreFlamePlaneGeo}
            material={flameMaterial}
            rotation={[0, Math.PI * 0.625, 0]}
          />
        </group>

        {/* Dynamic PointLight Illuminating the Forest (26m Reach) */}
        <pointLight
          ref={flameLightRef}
          position={[0, 0.32, 0]}
          color="#ff8820"
          intensity={4.2}
          distance={26}
          decay={1.8}
          castShadow
          shadow-bias={-0.0015}
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
        />
      </group>

      {/* Global Wind-Carried Embers & Flying Sparks Particle System */}
      <points ref={emberPointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions.current, 3]}
            usage={THREE.DynamicDrawUsage}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors.current, 3]}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.055}
          map={sparkTexture}
          vertexColors
          transparent
          opacity={0.90}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  )
}
