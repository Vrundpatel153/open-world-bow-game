// ─────────────────────────────────────────────────────────────────────────────
// TorchViewModel — AAA First-Person Forest Wood Torch Viewmodel
// Features:
// - Authentic forest vibe: Hand-carved gnarled hardwood branch with organic curve,
//   hemp cord grip wrap, iron binding ring, and pitch-soaked burlap ember head.
// - Volumetric dynamic PointLight with multi-frequency flame flicker & wide spread (26m)
// - Real-time wind-driven fire particle system: glowing sparks, rising embers,
//   and cooling charcoal ash flakes drifting in the direction of the open world wind.
// - Natural weapon inertia, walk bobbing, and breathing sway.
// - LMB Torch Wave / Thrust action: surges flame intensity and light reach.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useQuestStore } from '../stores/questStore'
import { sound } from '../audio/SoundSynthesizer'
import { inputManager } from '@/systems/KeyboardInput'

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
  const flameGroupRef = useRef<THREE.Group>(null!)
  const flameLightRef = useRef<THREE.PointLight>(null!)
  const emberPointsRef = useRef<THREE.Points>(null!)

  const activeItem = useQuestStore((s) => s.activeItem)
  const isTorchActive = activeItem === 'torch'

  const equipProgress = useRef(0.0) // 0 = stowed, 1 = equipped
  const walkBobTimer = useRef(0)
  const breathTimer = useRef(0)
  const waveTimer = useRef(0)
  const wasActive = useRef(false)

  // Wind direction vector (synchronized with grass field: 45° North-East)
  const windDir = useMemo(() => {
    const rad = 45 * (Math.PI / 180)
    return new THREE.Vector3(Math.cos(rad), 0, Math.sin(rad))
  }, [])

  // ── Particle Pool for Embers & Ashes ───────────────────────────────────────
  const embers = useRef<TorchEmber[]>([])
  const positions = useRef(new Float32Array(MAX_TORCH_EMBERS * 3))
  const colors = useRef(new Float32Array(MAX_TORCH_EMBERS * 3))
  const sizes = useRef(new Float32Array(MAX_TORCH_EMBERS))

  // Soft glowing circular ember particle texture
  const emberTexture = useMemo(() => {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.85)')
    grad.addColorStop(0.7, 'rgba(255, 200, 100, 0.3)')
    grad.addColorStop(1, 'rgba(255, 150, 50, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 32, 32)
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }, [])

  // ── 3D Procedural Geometries for Forest Wood Torch ────────────────────────
  const {
    branchGeo,
    gripWrapGeo,
    ironBandGeo,
    headWrapGeo,
    emberCapGeo,
    flameCoreGeo,
    flameOuterGeo,
  } = useMemo(() => {
    // 1. Organic curved gnarled branch shaft (Height ~0.56m)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.28, 0),
      new THREE.Vector3(0.008, -0.12, 0.006),
      new THREE.Vector3(-0.005, 0.06, -0.004),
      new THREE.Vector3(0.012, 0.20, 0.008),
      new THREE.Vector3(0, 0.28, 0),
    ])
    const branch = new THREE.TubeGeometry(curve, 18, 0.022, 10, false)

    // 2. Hemp cord cross-wrapping around handle
    const gripWrap = new THREE.CylinderGeometry(0.026, 0.027, 0.16, 12)

    // 3. Forged iron binding ring below head
    const ironBand = new THREE.CylinderGeometry(0.034, 0.032, 0.035, 14)

    // 4. Pitch-soaked burlap wrap head
    const headWrap = new THREE.CylinderGeometry(0.042, 0.035, 0.14, 12)

    // 5. Burning charcoal ember cap
    const emberCap = new THREE.SphereGeometry(0.038, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6)

    // 6. Volumetric flame tiers (inner hot core and outer flame envelope)
    const flameCore = new THREE.ConeGeometry(0.032, 0.18, 8)
    flameCore.translate(0, 0.09, 0)

    const flameOuter = new THREE.ConeGeometry(0.055, 0.26, 8)
    flameOuter.translate(0, 0.13, 0)

    return {
      branchGeo: branch,
      gripWrapGeo: gripWrap,
      ironBandGeo: ironBand,
      headWrapGeo: headWrap,
      emberCapGeo: emberCap,
      flameCoreGeo: flameCore,
      flameOuterGeo: flameOuter,
    }
  }, [])

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
      if ((e.target as HTMLElement)?.closest('[class*="leva"], button, a')) return
      if (e.button === 0 && waveTimer.current <= 0) {
        waveTimer.current = 0.45
        sound.playTorchWave()
      }
    }
    window.addEventListener('mousedown', handleMouseDown)
    return () => window.removeEventListener('mousedown', handleMouseDown)
  }, [isTorchActive])

  // ── Per-Frame Viewmodel Rig, Flame Animation & Particle Physics ────────────
  useFrame((state, delta) => {
    if (!torchRootRef.current) return
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime

    // 0. Equip / Unequip transition lerp
    const targetEquip = isTorchActive ? 1.0 : 0.0
    equipProgress.current = THREE.MathUtils.damp(equipProgress.current, targetEquip, 9, dt)

    if (equipProgress.current < 0.02 && !isTorchActive) {
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

    // 1. Natural Walk Bobbing & Breathing Sway
    const isMoving =
      inputManager.isMovingForward() ||
      inputManager.isMovingBackward() ||
      inputManager.isMovingLeft() ||
      inputManager.isMovingRight()
    const isSprinting = isMoving && inputManager.isSprinting()

    walkBobTimer.current += dt * (isMoving ? (isSprinting ? 14 : 9) : 1.5)
    breathTimer.current += dt * 1.8

    const bobX = Math.cos(walkBobTimer.current * 0.5) * (isMoving ? 0.012 : 0.002)
    const bobY = Math.sin(walkBobTimer.current) * (isMoving ? 0.016 : 0.003)
    const swayX = Math.cos(breathTimer.current * 0.5) * 0.003
    const swayY = Math.sin(breathTimer.current) * 0.003

    // 2. Viewmodel Positioning: Right-hand natural forest hold
    // Base position in front right of camera
    const holdOffset = new THREE.Vector3(
      0.22 + bobX + swayX,
      -0.24 + bobY + swayY - (1 - equipProgress.current) * 0.45,
      -0.42 + waveThrust
    )
    const worldHold = holdOffset.applyQuaternion(camera.quaternion).add(camera.position)
    torchRootRef.current.position.copy(worldHold)

    // Base rotation with natural tilt
    torchRootRef.current.quaternion.copy(camera.quaternion)
    const tiltEuler = new THREE.Euler(
      -0.12 - waveThrust * 0.6,
      -0.22,
      0.14 - (1 - equipProgress.current) * 0.8,
      'YXZ'
    )
    torchRootRef.current.quaternion.multiply(new THREE.Quaternion().setFromEuler(tiltEuler))

    // 3. Dynamic Flame Flicker & PointLight
    const flicker1 = Math.sin(t * 19.5) * 0.35
    const flicker2 = Math.sin(t * 31.2) * 0.22
    const flicker3 = Math.sin(t * 7.8) * 0.18
    const flameSurge = waveProgress * 1.8

    const baseIntensity = 4.2 * equipProgress.current
    const currentIntensity = Math.max(0, baseIntensity + flicker1 + flicker2 + flicker3 + flameSurge)

    if (flameLightRef.current) {
      flameLightRef.current.intensity = currentIntensity
      // Subtle flame position dance
      flameLightRef.current.position.set(
        Math.sin(t * 14) * 0.012,
        0.36 + Math.cos(t * 18) * 0.015,
        Math.cos(t * 12) * 0.012
      )
    }

    // Animate flame geometry pulsation
    if (flameGroupRef.current) {
      const scaleY = 1.0 + Math.sin(t * 22) * 0.15 + waveProgress * 0.3
      const scaleXZ = 1.0 + Math.sin(t * 17) * 0.12
      flameGroupRef.current.scale.set(scaleXZ, scaleY, scaleXZ)
      // Slight tilt with wind
      flameGroupRef.current.rotation.z = Math.sin(t * 8) * 0.08 - 0.05
    }

    // 4. Wind-Carried Embers & Ashes Particle System
    // Calculate world position of torch head
    const headWorldPos = new THREE.Vector3(0, 0.35, 0)
      .applyQuaternion(torchRootRef.current.quaternion)
      .add(torchRootRef.current.position)

    // Spawn 1-2 new embers per frame
    if (isTorchActive && equipProgress.current > 0.5) {
      const spawnCount = Math.random() > 0.4 ? 2 : 1
      for (let s = 0; s < spawnCount; s++) {
        if (embers.current.length < MAX_TORCH_EMBERS) {
          const spread = 0.025
          const emberPos = headWorldPos.clone().add(
            new THREE.Vector3(
              (Math.random() - 0.5) * spread,
              Math.random() * 0.02,
              (Math.random() - 0.5) * spread
            )
          )

          // Velocity: rising upward with initial turbulent puff
          const emberVel = new THREE.Vector3(
            (Math.random() - 0.5) * 0.15,
            0.65 + Math.random() * 0.65,
            (Math.random() - 0.5) * 0.15
          )

          embers.current.push({
            pos: emberPos,
            vel: emberVel,
            life: 0,
            maxLife: 0.9 + Math.random() * 0.9,
            size: 0.035 + Math.random() * 0.03,
            initialColor: new THREE.Color(Math.random() > 0.3 ? '#fff499' : '#ff9922'),
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

      // Physics: add upward buoyancy + open world wind drift!
      const windForce = windDir.clone().multiplyScalar(0.75 + Math.sin(t * 4) * 0.25)
      e.vel.addScaledVector(windForce, dt * 1.8)
      e.vel.y += dt * 0.15 // Gentle thermal rise
      e.vel.multiplyScalar(0.98) // Air friction
      e.pos.addScaledVector(e.vel, dt)

      const lifeRatio = e.life / e.maxLife
      const idx = activeCount * 3

      positions.current[idx] = e.pos.x
      positions.current[idx + 1] = e.pos.y
      positions.current[idx + 2] = e.pos.z

      // Color decay: Bright Gold -> Fiery Orange -> Deep Ruby -> Smoke Gray
      let r = 1.0, g = 0.85, b = 0.3
      if (lifeRatio > 0.65) {
        // Smoke ash
        const ash = Math.max(0.2, 0.5 * (1 - lifeRatio))
        r = ash
        g = ash
        b = ash
      } else if (lifeRatio > 0.35) {
        // Red ember
        r = 0.95
        g = 0.35 * (1 - (lifeRatio - 0.35) / 0.3)
        b = 0.05
      } else {
        // Fiery gold
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
      <group ref={torchRootRef} visible={false}>
        {/* 1. Rustic Carved Hardwood Branch */}
        <mesh geometry={branchGeo} castShadow receiveShadow>
          <meshStandardMaterial
            color="#3d2617"
            roughness={0.88}
            metalness={0.05}
          />
        </mesh>

        {/* 2. Hemp Cord Cross-Wrap Handle Grip */}
        <mesh geometry={gripWrapGeo} position={[0, -0.06, 0]}>
          <meshStandardMaterial
            color="#7a6245"
            roughness={0.92}
            bumpScale={0.02}
          />
        </mesh>

        {/* 3. Forged Iron Reinforcement Collar */}
        <mesh geometry={ironBandGeo} position={[0, 0.20, 0]} castShadow>
          <meshStandardMaterial
            color="#2a2928"
            roughness={0.65}
            metalness={0.85}
          />
        </mesh>

        {/* 4. Pitch-Soaked Burlap Wrapping */}
        <mesh geometry={headWrapGeo} position={[0, 0.27, 0]} castShadow>
          <meshStandardMaterial
            color="#1f1814"
            roughness={0.95}
          />
        </mesh>

        {/* 5. Incandescent Charcoal Ember Cap */}
        <mesh geometry={emberCapGeo} position={[0, 0.33, 0]}>
          <meshStandardMaterial
            color="#ff3b00"
            emissive="#ff3300"
            emissiveIntensity={2.4}
            roughness={0.7}
          />
        </mesh>

        {/* 6. Dynamic Volumetric Flame Core (Tiered Additive Meshes) */}
        <group ref={flameGroupRef} position={[0, 0.33, 0]}>
          {/* Inner hot lemon core */}
          <mesh geometry={flameCoreGeo}>
            <meshBasicMaterial
              color="#fff685"
              transparent
              opacity={0.88}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          {/* Outer vibrant amber-orange flame */}
          <mesh geometry={flameOuterGeo}>
            <meshBasicMaterial
              color="#ff5c00"
              transparent
              opacity={0.65}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>

        {/* 7. Dynamic PointLight Illuminating the Forest (26m Reach) */}
        <pointLight
          ref={flameLightRef}
          position={[0, 0.38, 0]}
          color="#ff9028"
          intensity={4.5}
          distance={28}
          decay={1.8}
          castShadow
          shadow-bias={-0.0015}
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
        />
      </group>

      {/* ── Global Wind-Carried Embers & Ashes Particle System ─────────────── */}
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
          size={0.07}
          map={emberTexture ?? undefined}
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
