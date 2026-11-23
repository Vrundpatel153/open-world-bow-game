// ─────────────────────────────────────────────────────────────────────────────
// TorchViewModel — AAA Realistic Medieval Handheld Pitch Torch Viewmodel
// Features:
// - Authentic Procedural Medieval Forged Iron-Sconce Adventurer's Torch:
//     * Turned ash hardwood handle with weathered leather cord wrap & pommel tether ring
//     * Flared forged iron ferrule collar with square rivet studs
//     * 4-rib gothic wrought-iron cage basket with upper & lower binding hoops
//     * Charred pine-pitch burlap fuel bundle with incandescent burning coal bed
// - Procedural Realistic Teardrop Flame (TeardropFlameMaterial):
//     * Mathematical teardrop envelope: R(y) = 2.0 * sqrt(y + 0.04) * (1.06 - y)^1.30
//     * Multi-octave FBM turbulence & dynamic thermal convection licking tongues
//     * Blackbody thermal radiation palette: white-hot core -> blazing gold -> crimson wisps
//     * Tri-planar volumetric structure with zero hard polygon edges or cartoon cones
// - Perfect First-Person Viewport Framing:
//     * Held naturally in lower-right offhand (X~0.28m, Y~-0.24m, Z~-0.42m)
//     * Flame tip stays well below eye level (Y~+0.06m in camera space)
//     * Center crosshair (960, 540) and upper/left 70% of screen 100% unobstructed
// - Second-Order Spring Sway & Movement Inertia (Look lag, cadence bobbing, wave surge)
// - Dedicated Depth Buffer Clearing (Zero world clipping through trees or terrain)
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useQuestStore } from '../stores/questStore'
import { sound } from '../audio/SoundSynthesizer'
import { inputManager } from '@/systems/KeyboardInput'
import { createTeardropFlameMaterial } from './TeardropFlameMaterial'
import { createRightTorchArm } from './FirstPersonArmModel'

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

  // Authentic First-Person Gloved Adventurer's Right Arm
  const torchArmRig = useMemo(() => createRightTorchArm(), [])
  useEffect(() => {
    if (torchRootRef.current) {
      torchArmRig.root.position.set(0, 0, 0)
      torchArmRig.root.rotation.set(0, 0, 0)
      torchRootRef.current.add(torchArmRig.root)
    }
  }, [torchArmRig])

  // ── Procedural Geometries for Medieval Iron-Sconce Adventurer's Torch ───────
  const {
    shaftGeo,
    gripWrapGeo,
    wrapRingsGeos,
    pommelCapGeo,
    pommelRingGeo,
    ferruleGeo,
    basketRibGeos,
    lowerHoopGeo,
    upperHoopGeo,
    fuelBundleGeo,
    emberBedGeo,
    flamePlaneGeo,
  } = useMemo(() => {
    // 1. Turned Ash Hardwood Shaft (Length 0.26m, Radius 0.013m)
    const shaft = new THREE.CylinderGeometry(0.012, 0.014, 0.26, 14)
    shaft.translate(0, 0.01, 0)

    // 2. Weathered Leather Handle Grip Section
    const grip = new THREE.CylinderGeometry(0.0148, 0.0148, 0.11, 14)
    grip.translate(0, -0.04, 0)

    const rings: THREE.TorusGeometry[] = []
    const ringYs = [-0.08, -0.05, -0.02, 0.01]
    for (const ry of ringYs) {
      const ring = new THREE.TorusGeometry(0.0148, 0.0016, 6, 16)
      ring.rotateX(Math.PI / 2)
      ring.translate(0, ry, 0)
      rings.push(ring)
    }

    // 3. Forged Iron Pommel Cap & Tether Ring
    const pommelCap = new THREE.CylinderGeometry(0.016, 0.011, 0.018, 12)
    pommelCap.translate(0, -0.125, 0)

    const pommelRing = new THREE.TorusGeometry(0.010, 0.0022, 6, 16)
    pommelRing.translate(0, -0.142, 0)

    // 4. Flared Iron Neck Ferrule Collar
    const ferrule = new THREE.CylinderGeometry(0.021, 0.014, 0.032, 14)
    ferrule.translate(0, 0.142, 0)

    // 5. Four Curved Gothic Iron Basket Ribs (Prongs)
    const ribGeos: THREE.BufferGeometry[] = []
    const ribAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]

    for (const angle of ribAngles) {
      const points: THREE.Vector3[] = []
      for (let i = 0; i <= 10; i++) {
        const u = i / 10
        const y = 0.145 + u * 0.075
        // Flare outward into basket, then hook slightly inward at top rim
        const r = 0.017 + Math.sin(u * Math.PI * 0.75) * 0.018
        const x = Math.cos(angle) * r
        const z = Math.sin(angle) * r
        points.push(new THREE.Vector3(x, y, z))
      }
      const curve = new THREE.CatmullRomCurve3(points)
      const ribGeo = new THREE.TubeGeometry(curve, 10, 0.0022, 6, false)
      ribGeos.push(ribGeo)
    }

    // 6. Horizontal Forged Iron Binding Hoops
    const lowerHoop = new THREE.TorusGeometry(0.026, 0.0020, 6, 18)
    lowerHoop.rotateX(Math.PI / 2)
    lowerHoop.translate(0, 0.175, 0)

    const upperHoop = new THREE.TorusGeometry(0.033, 0.0024, 6, 18)
    upperHoop.rotateX(Math.PI / 2)
    upperHoop.translate(0, 0.215, 0)

    // 7. Charred Pine-Pitch Burlap Fuel Bundle
    const fuel = new THREE.CylinderGeometry(0.027, 0.020, 0.065, 14)
    fuel.translate(0, 0.185, 0)

    // 8. Incandescent Glowing Charcoal Ember Bed
    const emberBed = new THREE.CylinderGeometry(0.029, 0.026, 0.018, 12)
    emberBed.translate(0, 0.222, 0)

    // 9. Tri-Planar Teardrop Flame Geometry (Width 0.12m, Height 0.23m)
    // Centered at x = 0, y from 0.0 to 1.0 (base at coal bed y=0.22, apex at y=0.45)
    const flamePlane = new THREE.PlaneGeometry(0.12, 0.23)
    flamePlane.translate(0, 0.115, 0) // Pivot at base

    return {
      shaftGeo: shaft,
      gripWrapGeo: grip,
      wrapRingsGeos: rings,
      pommelCapGeo: pommelCap,
      pommelRingGeo: pommelRing,
      ferruleGeo: ferrule,
      basketRibGeos: ribGeos,
      lowerHoopGeo: lowerHoop,
      upperHoopGeo: upperHoop,
      fuelBundleGeo: fuel,
      emberBedGeo: emberBed,
      flamePlaneGeo: flamePlane,
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
        // Forward thrust impulse to spring
        posSpring.current.addImpulse(new THREE.Vector3(-0.02, 0.02, -0.06))
        rotSpring.current.addImpulse(new THREE.Vector3(-0.15, -0.10, 0.08))
      }
    }
    window.addEventListener('mousedown', handleMouseDown)
    return () => window.removeEventListener('mousedown', handleMouseDown)
  }, [isTorchActive])

  // ── Per-Frame Viewmodel Rig, Spring Dynamics & Procedural Flame ────────────
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
    const waveProgress = Math.max(0, waveTimer.current / 0.42)
    const waveThrust = Math.sin(waveProgress * Math.PI) * 0.08

    // 1. Camera Look-Inertia Impulse Calculation
    if (prevCamQuat.current.lengthSq() > 0.001) {
      const deltaQuat = prevCamQuat.current.clone().invert().multiply(camera.quaternion)
      const yawDelta = -deltaQuat.y * 2.0
      const pitchDelta = deltaQuat.x * 2.0

      posSpring.current.addImpulse(new THREE.Vector3(-yawDelta * 0.04, pitchDelta * 0.04, 0))
      rotSpring.current.addImpulse(new THREE.Vector3(-pitchDelta * 0.28, -yawDelta * 0.28, yawDelta * 0.45))
    }
    prevCamQuat.current.copy(camera.quaternion)

    // 2. Locomotion Lissajous Bobbing & Idle Respiration
    const isMoving =
      inputManager.isMovingForward() ||
      inputManager.isMovingBackward() ||
      inputManager.isMovingLeft() ||
      inputManager.isMovingRight()
    const isSprinting = isMoving && inputManager.isSprinting()

    walkBobTimer.current += dt * (isMoving ? (isSprinting ? 13 : 8) : 1.4)
    breathTimer.current += dt * 1.5

    const bobScale = isMoving ? (isSprinting ? 0.014 : 0.008) : 0.0015
    const bobX = Math.cos(walkBobTimer.current * 0.5) * bobScale
    const bobY = -Math.abs(Math.sin(walkBobTimer.current)) * (bobScale * 1.2)
    const swayX = Math.cos(breathTimer.current * 1.2) * 0.0012
    const swayY = Math.sin(breathTimer.current * 2.4) * 0.0010

    posSpring.current.target.set(bobX + swayX, bobY + swayY, 0)
    rotSpring.current.target.set(bobY * 1.8, bobX * 1.2, -bobX * 2.2)
    const springPosOffset = posSpring.current.update(dt)
    const springRotOffset = rotSpring.current.update(dt)

    // 3. Perfect Viewmodel Framing (Held lower-right, flame apex stays well below crosshair)
    // Base hold position: X=0.26m, Y=-0.19m, Z=-0.38m
    // Torch head is at Y~-0.06m, flame apex reaches Y~+0.12m in camera space
    // Crosshair at (960, 540) and left 75% of viewport 100% unobstructed!
    const unequipDrop = 1.0 - equipProgress.current
    const holdPos = new THREE.Vector3(
      0.26 + springPosOffset.x,
      -0.19 + springPosOffset.y - unequipDrop * 0.45,
      -0.38 + waveThrust + springPosOffset.z
    )
    const worldPos = holdPos.applyQuaternion(camera.quaternion).add(camera.position)
    torchRootRef.current.position.copy(worldPos)

    torchRootRef.current.quaternion.copy(camera.quaternion)
    const baseEuler = new THREE.Euler(
      -0.26 - waveThrust * 0.4 - unequipDrop * 0.35 + springRotOffset.x,
      -0.12 + springRotOffset.y,
      0.08 + springRotOffset.z - unequipDrop * 0.25,
      'YXZ'
    )
    torchRootRef.current.quaternion.multiply(new THREE.Quaternion().setFromEuler(baseEuler))

    // 4. Update Procedural Teardrop Flame Shader Uniforms
    flameMaterial.uniforms.uTime.value = t
    flameMaterial.uniforms.uWind.value.copy(windDir)
    flameMaterial.uniforms.uWindStrength.value = 0.20 + (isSprinting ? 0.25 : 0.0) + waveThrust * 0.5
    flameMaterial.uniforms.uFlameSurge.value = waveProgress

    // 5. Dynamic Flame Light Flicker
    const f1 = Math.sin(t * 19.5) * 0.30
    const f2 = Math.sin(t * 31.2) * 0.18
    const f3 = Math.sin(t * 8.4) * 0.15
    const surgeLight = waveProgress * 2.0
    const currentIntensity = Math.max(
      0,
      (4.2 + f1 + f2 + f3 + surgeLight) * equipProgress.current
    )

    if (flameLightRef.current) {
      flameLightRef.current.intensity = currentIntensity
      flameLightRef.current.position.set(
        Math.sin(t * 15) * 0.012,
        0.30 + Math.cos(t * 19) * 0.012,
        Math.cos(t * 13) * 0.012
      )
    }

    // Incandescent coal bed emissive pulse
    if (emberMatRef.current) {
      emberMatRef.current.emissiveIntensity = 2.6 + Math.sin(t * 16) * 0.5 + waveProgress * 1.5
    }

    // 6. Wind-Carried Embers & Flying Sparks Particle System
    const headWorldPos = new THREE.Vector3(0, 0.24, 0)
      .applyQuaternion(torchRootRef.current.quaternion)
      .add(torchRootRef.current.position)

    if (isTorchActive && equipProgress.current > 0.5) {
      const spawnCount = Math.random() > 0.45 ? 2 : 1
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

          const emberVel = new THREE.Vector3(
            (Math.random() - 0.5) * 0.12,
            0.55 + Math.random() * 0.55,
            (Math.random() - 0.5) * 0.12
          )

          embers.current.push({
            pos: emberPos,
            vel: emberVel,
            life: 0,
            maxLife: 0.75 + Math.random() * 0.75,
            size: 0.035 + Math.random() * 0.025,
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

      const windForce = windDir.clone().multiplyScalar(0.70 + Math.sin(t * 4) * 0.20)
      e.vel.addScaledVector(windForce, dt * 1.6)
      e.vel.y += dt * 0.18 // Thermal buoyancy
      e.vel.multiplyScalar(0.98)
      e.pos.addScaledVector(e.vel, dt)

      const lifeRatio = e.life / e.maxLife
      const idx = activeCount * 3

      positions.current[idx] = e.pos.x
      positions.current[idx + 1] = e.pos.y
      positions.current[idx + 2] = e.pos.z

      let r = 1.0, g = 0.85, b = 0.3
      if (lifeRatio > 0.65) {
        const ash = Math.max(0.12, 0.40 * (1 - lifeRatio))
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

      sizes.current[activeCount] = e.size * (1 - lifeRatio * 0.55)
      activeCount++
    }

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
      {/* ── Viewmodel Medieval Handheld Torch Root Group ─────────────────── */}
      <group
        ref={torchRootRef}
        visible={false}
        renderOrder={999}
        onBeforeRender={(renderer) => {
          // Clear depth so viewmodel torch NEVER clips through trees or terrain
          renderer.clearDepth()
        }}
      >
        {/* 1. Turned Ash Hardwood Shaft */}
        <mesh geometry={shaftGeo} castShadow receiveShadow>
          <meshStandardMaterial
            color="#3a281a"
            roughness={0.78}
            metalness={0.06}
          />
        </mesh>

        {/* 2. Weathered Leather Handle Grip */}
        <mesh geometry={gripWrapGeo} receiveShadow>
          <meshStandardMaterial
            color="#22160e"
            roughness={0.85}
            metalness={0.08}
          />
        </mesh>

        {/* Leather wrap cord rings */}
        {wrapRingsGeos.map((geo, idx) => (
          <mesh key={idx} geometry={geo}>
            <meshStandardMaterial
              color="#1a110a"
              roughness={0.80}
              metalness={0.10}
            />
          </mesh>
        ))}

        {/* 3. Forged Iron Pommel Cap & Tether Ring */}
        <mesh geometry={pommelCapGeo} castShadow>
          <meshStandardMaterial
            color="#28292c"
            roughness={0.42}
            metalness={0.85}
          />
        </mesh>
        <mesh geometry={pommelRingGeo}>
          <meshStandardMaterial
            color="#28292c"
            roughness={0.42}
            metalness={0.85}
          />
        </mesh>

        {/* 4. Flared Iron Neck Ferrule Collar */}
        <mesh geometry={ferruleGeo} castShadow>
          <meshStandardMaterial
            color="#2c2d30"
            roughness={0.38}
            metalness={0.88}
          />
        </mesh>

        {/* 5. Four Curved Gothic Iron Basket Ribs (Prongs) */}
        {basketRibGeos.map((geo, idx) => (
          <mesh key={idx} geometry={geo} castShadow>
            <meshStandardMaterial
              color="#2c2d30"
              roughness={0.38}
              metalness={0.88}
            />
          </mesh>
        ))}

        {/* 6. Horizontal Forged Iron Binding Hoops */}
        <mesh geometry={lowerHoopGeo}>
          <meshStandardMaterial
            color="#2c2d30"
            roughness={0.38}
            metalness={0.88}
          />
        </mesh>
        <mesh geometry={upperHoopGeo}>
          <meshStandardMaterial
            color="#2c2d30"
            roughness={0.38}
            metalness={0.88}
          />
        </mesh>

        {/* 7. Charred Pine-Pitch Burlap Fuel Bundle */}
        <mesh geometry={fuelBundleGeo} castShadow>
          <meshStandardMaterial
            color="#14100c"
            roughness={0.94}
            metalness={0.04}
          />
        </mesh>

        {/* 8. Incandescent Glowing Charcoal Ember Bed */}
        <mesh geometry={emberBedGeo}>
          <meshStandardMaterial
            ref={emberMatRef}
            color="#1a0802"
            emissive="#ff3a00"
            emissiveIntensity={2.8}
            roughness={0.85}
          />
        </mesh>

        {/* 9. Tri-Planar Procedural Teardrop Flame (0°, 60°, 120° Intersecting Planes) */}
        <group ref={flameGroupRef} position={[0, 0.22, 0]}>
          <mesh geometry={flamePlaneGeo} material={flameMaterial} />
          <mesh
            geometry={flamePlaneGeo}
            material={flameMaterial}
            rotation={[0, Math.PI / 3, 0]}
          />
          <mesh
            geometry={flamePlaneGeo}
            material={flameMaterial}
            rotation={[0, (Math.PI * 2) / 3, 0]}
          />
        </group>

        {/* 10. Dynamic PointLight Illuminating the Forest (26m Reach) */}
        <pointLight
          ref={flameLightRef}
          position={[0, 0.30, 0]}
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
