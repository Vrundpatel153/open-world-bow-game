// ─────────────────────────────────────────────────────────────────────────────
// TorchViewModel — AAA Realistic Medieval Pitch Torch with Procedural Volumetric Fire
// Features:
// - Authentic CC0 Open-Source Handheld Medieval Torch 3D Model (Polyfork / Polygonal Mind)
// - Open-Source Real-Time Procedural Volumetric Fire Shader (Alfred et al. / mattatz)
//     * 22-step object-space raymarching with 3D simplex noise & fBm turbulence
//     * Dynamic wind deflection bending flame tongues with open-world gusts
//     * Seamless alpha gradient lookup (Fire.png) with zero hard polygon edges
// - Incandescent Charred Coal Bed with pulsating heat emissive core
// - Wind-Carried Embers & Flying Sparks Particle System (sparkle-particle.png)
// - Dynamic Multi-Frequency PointLight casting dancing firelight on trees & ground
// - Fluid First-Person Motion: Cadence bobbing, mouse-look inertia sway,
//   and LMB Torch Thrust / Wave surge action.
// - Depth Buffer Clearing (Zero world clipping through trees, monoliths or terrain)
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useQuestStore } from '../stores/questStore'
import { sound } from '../audio/SoundSynthesizer'
import { inputManager } from '@/systems/KeyboardInput'
import { createVolumetricFireMaterial } from './VolumetricFireMaterial'

const MAX_TORCH_EMBERS = 75

interface TorchEmber {
  pos: THREE.Vector3
  vel: THREE.Vector3
  life: number
  maxLife: number
  size: number
  initialColor: THREE.Color
}

export default function TorchViewModel() {
  const { camera } = useThree()
  const torchRootRef = useRef<THREE.Group>(null!)
  const fireMeshRef = useRef<THREE.Mesh>(null!)
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

  // Camera rotation inertia tracking
  const prevCamQuat = useRef(new THREE.Quaternion())
  const mouseSwayLag = useRef({ x: 0, y: 0, rotZ: 0 })

  // Wind direction vector (synchronized with grass field: 45° North-East)
  const windDir = useMemo(() => {
    const rad = 45 * (Math.PI / 180)
    return new THREE.Vector3(Math.cos(rad), 0, Math.sin(rad))
  }, [])

  // ── Load Open-Source Medieval Pitch Torch 3D Model ────────────────────────
  const { scene: rawTorchScene } = useGLTF('/assets/pitch_torch.glb')
  const torchModel = useMemo(() => {
    const clone = rawTorchScene.clone(true)
    // Hide static low-poly flame cones so only the realistic 3D torch body is rendered
    clone.traverse((child) => {
      if (child.name.startsWith('flame')) {
        child.visible = false
      }
      if (child instanceof THREE.Mesh && child.name === 'torch-body') {
        child.castShadow = true
        child.receiveShadow = true
        // Enhance PBR rustic wood & pitch wrap
        if (child.material) {
          const mat = child.material as THREE.MeshStandardMaterial
          mat.roughness = 0.85
          mat.metalness = 0.12
        }
      }
    })
    return clone
  }, [rawTorchScene])

  // ── Load Open-Source Fire Density Ramp Texture (Fire.png) ─────────────────
  const fireTexture = useMemo(() => {
    const loader = new THREE.TextureLoader()
    return loader.load('/assets/Fire.png')
  }, [])

  // Volumetric Fire Material instance
  const fireMaterial = useMemo(() => {
    return createVolumetricFireMaterial(fireTexture)
  }, [fireTexture])

  // Soft glowing ember spark particle texture
  const sparkTexture = useMemo(() => {
    const loader = new THREE.TextureLoader()
    return loader.load('/assets/sparkle-particle.png')
  }, [])

  // ── Particle Pool for Embers & Ashes ───────────────────────────────────────
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
        waveTimer.current = 0.45
        sound.playTorchWave()
      }
    }
    window.addEventListener('mousedown', handleMouseDown)
    return () => window.removeEventListener('mousedown', handleMouseDown)
  }, [isTorchActive])

  // ── Per-Frame Viewmodel Rig, Volumetric Raymarching & Particle Physics ─────
  useFrame((state, delta) => {
    if (!torchRootRef.current) return
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime

    // 0. Equip / Unequip transition lerp
    const targetEquip = isTorchActive ? 1.0 : 0.0
    equipProgress.current = THREE.MathUtils.damp(equipProgress.current, targetEquip, 10, dt)

    if (equipProgress.current < 0.015 && !isTorchActive) {
      torchRootRef.current.visible = false
      if (flameLightRef.current) flameLightRef.current.intensity = 0
      return
    }
    torchRootRef.current.visible = true

    // Wave / thrust decay
    if (waveTimer.current > 0) {
      waveTimer.current -= dt
    }
    const waveProgress = Math.max(0, waveTimer.current / 0.45)
    const waveThrust = Math.sin(waveProgress * Math.PI) * 0.12

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
    const swayX = Math.cos(breathTimer.current * 1.4) * 0.0018
    const swayY = Math.sin(breathTimer.current * 2.8) * 0.0014

    // 3. Viewmodel Framing (Lower-Right Third, tip in view, 100% unobstructed crosshair)
    const unequipDrop = (1 - equipProgress.current)
    const holdOffset = new THREE.Vector3(
      0.26 + bobX + swayX + mouseSwayLag.current.x,
      -0.20 + bobY + swayY + mouseSwayLag.current.y - unequipDrop * 0.45,
      -0.38 + waveThrust
    )
    const worldHold = holdOffset.applyQuaternion(camera.quaternion).add(camera.position)
    torchRootRef.current.position.copy(worldHold)

    torchRootRef.current.quaternion.copy(camera.quaternion)
    const tiltEuler = new THREE.Euler(
      -0.38 - waveThrust * 0.5 - unequipDrop * 0.35,
      -0.22,
      0.12 + mouseSwayLag.current.rotZ - unequipDrop * 0.25,
      'YXZ'
    )
    torchRootRef.current.quaternion.multiply(new THREE.Quaternion().setFromEuler(tiltEuler))

    // 4. Update Volumetric Fire Shader Uniforms
    if (fireMeshRef.current) {
      fireMeshRef.current.updateMatrixWorld()
      fireMaterial.uniforms.time.value = t * 1.65
      fireMaterial.uniforms.invModelMatrix.value.copy(fireMeshRef.current.matrixWorld).invert()
      fireMaterial.uniforms.scale.value.copy(fireMeshRef.current.scale)
      fireMaterial.uniforms.windStrength.value = 0.22 + (isSprinting ? 0.28 : 0.0) + waveThrust * 0.6
      // Flame height surge on thrust
      const flameScaleY = 0.52 * (1.0 + Math.sin(t * 18) * 0.06 + waveProgress * 0.25)
      fireMeshRef.current.scale.set(0.26, flameScaleY, 0.26)
    }

    // 5. Dynamic Flame Light Flicker
    const flicker1 = Math.sin(t * 19.5) * 0.35
    const flicker2 = Math.sin(t * 31.2) * 0.22
    const flicker3 = Math.sin(t * 7.8) * 0.18
    const flameSurge = waveProgress * 2.2
    const currentIntensity = Math.max(
      0,
      (4.6 + flicker1 + flicker2 + flicker3 + flameSurge) * equipProgress.current
    )

    if (flameLightRef.current) {
      flameLightRef.current.intensity = currentIntensity
      flameLightRef.current.position.set(
        Math.sin(t * 14) * 0.015,
        0.36 + Math.cos(t * 18) * 0.015,
        Math.cos(t * 12) * 0.015
      )
    }

    // Incandescent coal bed emissive pulse
    if (emberMatRef.current) {
      emberMatRef.current.emissiveIntensity = 2.2 + Math.sin(t * 16) * 0.6 + waveProgress * 1.5
    }

    // 6. Wind-Carried Embers & Flying Sparks Particle System
    const headWorldPos = new THREE.Vector3(0, 0.36, 0)
      .applyQuaternion(torchRootRef.current.quaternion)
      .add(torchRootRef.current.position)

    if (isTorchActive && equipProgress.current > 0.5) {
      const spawnCount = Math.random() > 0.35 ? 2 : 1
      for (let s = 0; s < spawnCount; s++) {
        if (embers.current.length < MAX_TORCH_EMBERS) {
          const spread = 0.03
          const emberPos = headWorldPos.clone().add(
            new THREE.Vector3(
              (Math.random() - 0.5) * spread,
              Math.random() * 0.03,
              (Math.random() - 0.5) * spread
            )
          )

          const emberVel = new THREE.Vector3(
            (Math.random() - 0.5) * 0.15,
            0.65 + Math.random() * 0.65,
            (Math.random() - 0.5) * 0.15
          )

          embers.current.push({
            pos: emberPos,
            vel: emberVel,
            life: 0,
            maxLife: 0.85 + Math.random() * 0.85,
            size: 0.04 + Math.random() * 0.035,
            initialColor: new THREE.Color(Math.random() > 0.3 ? '#fff59d' : '#ff9800'),
          })
        }
      }
    }

    // Update active embers
    let activeCount = 0
    for (let i = embers.current.length - 1; i >= 0; i--) {
      const e = embers.current[i]
      e.life += dt

      if (e.life >= e.maxLife) {
        embers.current.splice(i, 1)
        continue
      }

      // Physics: buoyancy + open world wind drift
      const windForce = windDir.clone().multiplyScalar(0.75 + Math.sin(t * 4) * 0.25)
      e.vel.addScaledVector(windForce, dt * 1.8)
      e.vel.y += dt * 0.20 // Convection rise
      e.vel.multiplyScalar(0.98) // Air friction
      e.pos.addScaledVector(e.vel, dt)

      const lifeRatio = e.life / e.maxLife
      const idx = activeCount * 3

      positions.current[idx] = e.pos.x
      positions.current[idx + 1] = e.pos.y
      positions.current[idx + 2] = e.pos.z

      // Color decay: Incandescent White-Gold -> Fiery Orange -> Deep Ruby -> Smoke Ash
      let r = 1.0, g = 0.85, b = 0.3
      if (lifeRatio > 0.65) {
        const ash = Math.max(0.15, 0.45 * (1 - lifeRatio))
        r = ash
        g = ash
        b = ash
      } else if (lifeRatio > 0.35) {
        r = 0.95
        g = 0.35 * (1 - (lifeRatio - 0.35) / 0.3)
        b = 0.04
      } else {
        r = 1.0
        g = 0.85 - lifeRatio * 0.8
        b = 0.3 * (1 - lifeRatio)
      }

      colors.current[idx] = r
      colors.current[idx + 1] = g
      colors.current[idx + 2] = b

      sizes.current[activeCount] = e.size * (1 - lifeRatio * 0.6)
      activeCount++
    }

    // Zero out unused
    for (let i = activeCount; i < MAX_TORCH_EMBERS; i++) {
      const idx = i * 3
      positions.current[idx] = 0
      positions.current[idx + 1] = -9999
      positions.current[idx + 2] = 0
      sizes.current[i] = 0
    }

    if (emberPointsRef.current) {
      const geo = emberPointsRef.current.geometry
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate = true
      geo.setDrawRange(0, activeCount)
    }
  })

  return (
    <>
      {/* ── Viewmodel Torch Root Group ────────────────────────────────────── */}
      <group
        ref={torchRootRef}
        visible={false}
        renderOrder={999}
        onBeforeRender={(renderer) => {
          // Clear depth so viewmodel torch NEVER clips through trees or terrain
          renderer.clearDepth()
        }}
      >
        {/* 1. Open-Source Medieval Pitch Torch 3D Model */}
        <primitive
          object={torchModel}
          scale={[0.65, 0.65, 0.65]}
          position={[0, -0.15, 0]}
        />

        {/* 2. Incandescent Burning Charcoal Bed Cap */}
        <mesh position={[0, 0.20, 0]}>
          <cylinderGeometry args={[0.042, 0.038, 0.035, 12]} />
          <meshStandardMaterial
            ref={emberMatRef}
            color="#2a1205"
            emissive="#ff3c00"
            emissiveIntensity={2.4}
            roughness={0.88}
          />
        </mesh>

        {/* 3. Real-Time Procedural Volumetric Raymarching Fire Shader */}
        <mesh
          ref={fireMeshRef}
          position={[0, 0.42, 0]}
          scale={[0.26, 0.52, 0.26]}
          material={fireMaterial}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>

        {/* 4. Dynamic PointLight Illuminating the Forest (28m Reach) */}
        <pointLight
          ref={flameLightRef}
          position={[0, 0.36, 0]}
          color="#ff9028"
          intensity={4.8}
          distance={28}
          decay={1.8}
          castShadow
          shadow-bias={-0.0015}
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
        />
      </group>

      {/* ── Global Wind-Carried Embers & Flying Sparks Particle System ──────── */}
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
          size={0.065}
          map={sparkTexture}
          vertexColors
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  )
}

useGLTF.preload('/assets/pitch_torch.glb')
