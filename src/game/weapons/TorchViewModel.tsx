// ─────────────────────────────────────────────────────────────────────────────
// TorchViewModel — Authentic Handcrafted 3D Survival Wooden Fire Torch
// Authentic Wilderness Survivalist Torch (Tomb Raider, The Forest, Green Hell):
// - Genuine 3D Model: /assets/models/WoodenTorch.glb
//     * Rugged sculpted branch stave with authentic bark grain & normal maps
//     * Thick pitch-soaked burlap cloth wrap bundle tightly bound around the head
//     * Glowing charcoal fuel core with incandescent embers
// - Procedural Teardrop Volumetric Flame (TeardropFlameMaterial):
//     * Mathematical teardrop envelope with multi-octave FBM turbulence
//     * Blackbody thermal radiation: white-hot core -> gold -> crimson
//     * Wind tilt & locomotion drag
// - Dynamic PointLight & Wind-Carried Embers / Sparks
// - Clean Floating First-Person Viewmodel: ZERO Roblox cylinder arms or block hands
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useQuestStore } from '../stores/questStore'
import { sound } from '../audio/SoundSynthesizer'
import { createVolumetricFireMaterial } from './VolumetricFireMaterial'

const MAX_TORCH_EMBERS = 60

interface TorchEmber {
  pos: THREE.Vector3
  vel: THREE.Vector3
  life: number
  maxLife: number
  size: number
}

// ── Second-Order Spring-Damper for Viewmodel Inertia ─────────────────────────
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

export default function TorchViewModel() {
  const { camera } = useThree()
  const torchRootRef = useRef<THREE.Group>(null!)
  const fireMeshRef = useRef<THREE.Mesh>(null!)
  const flameLightRef = useRef<THREE.PointLight>(null!)
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

  // ── Load Authentic 3D Handcrafted Wooden Torch Model ────────────────────────
  const { nodes } = useGLTF('/assets/models/WoodenTorch.glb') as any

  // ── PBR Textures for Organic Survival Aesthetics ────────────────────────────
  const barkTexture = useMemo(() => createBarkTexture(), [])
  const burlapTexture = useMemo(() => createBurlapClothTexture(), [])

  // ── Dedicated Materials for 3D Mesh Nodes ───────────────────────────────────
  const materials = useMemo(() => {
    const woodMat = new THREE.MeshStandardMaterial({
      color: '#3a2414',
      map: barkTexture,
      bumpMap: barkTexture,
      bumpScale: 0.003,
      roughness: 0.88,
      metalness: 0.0,
    })

    const burlapMat = new THREE.MeshStandardMaterial({
      color: '#1a130e',
      map: burlapTexture,
      bumpMap: burlapTexture,
      bumpScale: 0.0035,
      roughness: 0.94,
      metalness: 0.02,
    })

    const coalMat = new THREE.MeshStandardMaterial({
      color: '#180702',
      emissive: '#ff3b00',
      emissiveIntensity: 2.8,
      roughness: 0.90,
      metalness: 0.02,
    })

    return { woodMat, burlapMat, coalMat }
  }, [barkTexture, burlapTexture])

  // Open-Source 3D Volumetric Raymarched Fire
  const fireBoxGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(1.0, 1.0, 1.0)
    geo.translate(0, 0.5, 0)
    return geo
  }, [])

  const fireTexture = useMemo(() => {
    const loader = new THREE.TextureLoader()
    return loader.load('/assets/Fire.png')
  }, [])

  const volumetricFireMat = useMemo(() => {
    return createVolumetricFireMaterial(fireTexture)
  }, [fireTexture])

  // Soft glowing ember spark particle texture
  const sparkTexture = useMemo(() => {
    const loader = new THREE.TextureLoader()
    return loader.load('/assets/sparkle-particle.png')
  }, [])

  // ── Particle Pool for Embers & Flying Sparks ────────────────────────────────
  const embers = useRef<TorchEmber[]>([])
  const positions = useRef(new Float32Array(MAX_TORCH_EMBERS * 3))
  const colors = useRef(new Float32Array(MAX_TORCH_EMBERS * 3))

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
      rotSpring.current.addImpulse(new THREE.Vector3(pitchDelta * 0.4, yawDelta * 0.4, -yawDelta * 0.3))
    }
    prevCamQuat.current.copy(camera.quaternion)

    // 2. Natural Organic Locomotion Bob & Idle Respiration
    walkBobTimer.current += dt * 4.5
    breathTimer.current += dt * 1.8

    const bobX = Math.cos(walkBobTimer.current * 0.5) * 0.004
    const bobY = Math.sin(walkBobTimer.current) * 0.006 + Math.sin(breathTimer.current) * 0.003
    const bobRotZ = Math.cos(walkBobTimer.current * 0.5) * 0.015

    // 3. Waving Flare Attack
    let waveOffsetX = 0
    let waveOffsetY = 0
    let waveOffsetZ = 0
    let waveRotX = 0
    let waveRotY = 0

    if (waveTimer.current > 0) {
      waveTimer.current -= dt
      const waveProgress = 1.0 - waveTimer.current / 0.42
      const stroke = Math.sin(waveProgress * Math.PI)
      waveOffsetX = -stroke * 0.08
      waveOffsetY = stroke * 0.05
      waveOffsetZ = -stroke * 0.12
      waveRotX = -stroke * 0.28
      waveRotY = -stroke * 0.45
    }

    // 4. Spring Target Calculation
    // Natural wilderness stance: lower-right viewport, tilted forward, leaving 80% screen clear
    const eqY = (1.0 - equipProgress.current) * -0.65
    const targetX = 0.23 + bobX + waveOffsetX
    const targetY = -0.34 + bobY + eqY + waveOffsetY
    const targetZ = -0.52 + waveOffsetZ

    posSpring.current.target.set(targetX, targetY, targetZ)
    rotSpring.current.target.set(
      0.36 + waveRotX,
      -0.24 + waveRotY,
      -0.10 + bobRotZ
    )

    const curPos = posSpring.current.update(dt)
    const curRot = rotSpring.current.update(dt)

    // Position relative to camera (attached to camera corridor)
    torchRootRef.current.position.copy(camera.position)
    torchRootRef.current.quaternion.copy(camera.quaternion)

    // Local offset
    const localGroup = torchRootRef.current.children[0]
    if (localGroup) {
      localGroup.position.copy(curPos)
      localGroup.rotation.set(curRot.x, curRot.y, curRot.z, 'YXZ')
    }

    // 5. Open-Source 3D Volumetric Raymarched Fire Shader Updates
    if (volumetricFireMat && volumetricFireMat.uniforms) {
      volumetricFireMat.uniforms.time.value = time
      volumetricFireMat.uniforms.uSurge.value = waveTimer.current > 0 ? 0.6 : 0.0
      volumetricFireMat.uniforms.uWindStrength.value = 0.35 + (waveTimer.current > 0 ? 0.5 : 0.0)
      volumetricFireMat.uniforms.uWind.value.set(windDir.x, 0, windDir.z)

      if (fireMeshRef.current) {
        fireMeshRef.current.updateMatrixWorld(true)
        volumetricFireMat.uniforms.invModelMatrix.value.copy(fireMeshRef.current.matrixWorld).invert()
      }
    }

    // 6. Dynamic PointLight Intensity Jitter & Thermal Flicker
    const flicker1 = Math.sin(time * 12.0) * 0.35
    const flicker2 = Math.sin(time * 23.5) * 0.22
    const flicker3 = (Math.random() - 0.5) * 0.28

    if (flameLightRef.current) {
      const baseIntensity = 14.0 * equipProgress.current
      flameLightRef.current.intensity = Math.max(
        3.5,
        baseIntensity + flicker1 * 2.0 + flicker2 * 1.4 + flicker3 + (waveTimer.current > 0 ? 5.0 : 0.0)
      )
    }

    // 6b. Synchronize Global Torch Data for Environment & Foliage Shaders
    if (!(window as any).__torchData) {
      ;(window as any).__torchData = {
        active: false,
        pos: new THREE.Vector3(0, -9999, 0),
        intensity: 0,
        color: new THREE.Color('#ff8522'),
        flicker: 0,
      }
    }
    const td = (window as any).__torchData
    td.active = isTorchActive && equipProgress.current > 0.05
    if (td.active && localGroup) {
      const torchHeadWorld = new THREE.Vector3(0, 0.25, 0)
      localGroup.localToWorld(torchHeadWorld)
      td.pos.copy(torchHeadWorld)
      td.intensity = 3.6 * equipProgress.current
      td.flicker = flicker1 * 0.12 + flicker2 * 0.08
    } else {
      td.intensity = 0
    }

    // 7. Global Embers & Flying Sparks Simulation
    if (isTorchActive && equipProgress.current > 0.5) {
      // Spawn new embers at torch flame head
      if (Math.random() < 0.45 && embers.current.length < MAX_TORCH_EMBERS) {
        const torchHeadWorld = new THREE.Vector3(0, 0.25, 0)
        if (localGroup) localGroup.localToWorld(torchHeadWorld)

        embers.current.push({
          pos: torchHeadWorld.clone().add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.06,
              (Math.random() - 0.5) * 0.06,
              (Math.random() - 0.5) * 0.06
            )
          ),
          vel: new THREE.Vector3(
            windDir.x * (0.8 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.3,
            1.2 + Math.random() * 1.4,
            windDir.z * (0.8 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.3
          ),
          life: 0,
          maxLife: 0.8 + Math.random() * 0.8,
          size: 0.04 + Math.random() * 0.035,
        })
      }
    }

    // Update active embers
    const posArr = positions.current
    const colArr = colors.current
    let liveCount = 0

    for (let i = embers.current.length - 1; i >= 0; i--) {
      const e = embers.current[i]
      e.life += dt
      if (e.life >= e.maxLife) {
        embers.current.splice(i, 1)
        continue
      }

      // Advection with wind turbulence
      e.vel.x += Math.sin(time * 6.0 + i) * 0.4 * dt
      e.vel.z += Math.cos(time * 5.0 + i) * 0.4 * dt
      e.pos.addScaledVector(e.vel, dt)

      const lifeRatio = e.life / e.maxLife
      const alpha = 1.0 - lifeRatio

      posArr[liveCount * 3] = e.pos.x
      posArr[liveCount * 3 + 1] = e.pos.y
      posArr[liveCount * 3 + 2] = e.pos.z

      // Color cools from white-gold to incandescent crimson
      if (lifeRatio < 0.3) {
        colArr[liveCount * 3] = 1.0
        colArr[liveCount * 3 + 1] = 0.85 * alpha
        colArr[liveCount * 3 + 2] = 0.25 * alpha
      } else {
        colArr[liveCount * 3] = 1.0 * alpha
        colArr[liveCount * 3 + 1] = 0.35 * alpha
        colArr[liveCount * 3 + 2] = 0.05 * alpha
      }

      liveCount++
    }

    if (emberPointsRef.current) {
      const geo = emberPointsRef.current.geometry
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate = true
      geo.setDrawRange(0, liveCount)
    }
  })

  return (
    <>
      <group
        ref={torchRootRef}
        renderOrder={999}
        onBeforeRender={(renderer) => {
          renderer.clearDepth()
        }}
      >
        <group>
          {/* Authentic 3D Handcrafted Wooden Torch Meshes */}
          {nodes.WoodenTorch_1 && (
            <group rotation={[-Math.PI / 2, 0, 0]} scale={16.0}>
              {/* 1. Sculpted Natural Tree Branch Stave */}
              <mesh
                geometry={nodes.WoodenTorch_1.geometry}
                material={materials.woodMat}
                castShadow
                receiveShadow
              />

              {/* 2. Heavy Pine-Pitch Burlap Cloth Wrap Head */}
              <mesh
                geometry={nodes.WoodenTorch_2.geometry}
                material={materials.burlapMat}
                castShadow
              />

              {/* 3. Incandescent Pine-Pitch Coal Head Core */}
              <mesh
                geometry={nodes.WoodenTorch_3.geometry}
                material={materials.coalMat}
              />
            </group>
          )}

          {/* Authentic Open-Source 3D Volumetric Raymarched Fire (Zero Flat Quads, 100% 3D Fluid) */}
          <mesh
            ref={fireMeshRef}
            geometry={fireBoxGeo}
            material={volumetricFireMat}
            position={[0, 0.245, 0]}
            scale={[0.18, 0.34, 0.18]}
            renderOrder={1000}
          />

          {/* Dynamic PointLight Illuminating the Forest (32m Reach) */}
          <pointLight
            ref={flameLightRef}
            position={[0, 0.28, 0]}
            color="#ff8820"
            intensity={14.0}
            distance={34}
            decay={1.15}
          />
        </group>
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

useGLTF.preload('/assets/models/WoodenTorch.glb')
