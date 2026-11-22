// ─────────────────────────────────────────────────────────────────────────────
// RockSparkSystem — Realistic Stone Impact Scratch Sparks & Dust Particles
// Spawns high-velocity incandescent friction sparks, stone dust chips, and
// an impact flash whenever a sword strike connects with a granite boulder.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, forwardRef, useImperativeHandle, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export interface RockSparkRef {
  spawnSparks: (hitPoint: THREE.Vector3, normal: THREE.Vector3, power?: number) => void
}

const MAX_SPARKS = 120

interface SparkParticle {
  pos: THREE.Vector3
  vel: THREE.Vector3
  life: number
  maxLife: number
  size: number
  color: THREE.Color
}

const RockSparkSystem = forwardRef<RockSparkRef>((_, ref) => {
  const pointsRef = useRef<THREE.Points>(null!)
  const flashLightRef = useRef<THREE.PointLight>(null!)
  const flashTimer = useRef(0)

  // Particle pool
  const particles = useRef<SparkParticle[]>([])

  // Setup buffer attributes
  const positions = useRef(new Float32Array(MAX_SPARKS * 3))
  const colors = useRef(new Float32Array(MAX_SPARKS * 3))
  const sizes = useRef(new Float32Array(MAX_SPARKS))

  // Soft glowing spark texture
  const sparkTexture = useMemo(() => {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
    grad.addColorStop(0.3, 'rgba(255, 230, 150, 0.9)')
    grad.addColorStop(0.7, 'rgba(255, 150, 40, 0.3)')
    grad.addColorStop(1, 'rgba(255, 80, 0, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 32, 32)
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }, [])

  useImperativeHandle(ref, () => ({
    spawnSparks: (hitPoint: THREE.Vector3, normal: THREE.Vector3, power = 1.0) => {
      const count = Math.floor(18 + power * 10)

      // Impact light flash
      if (flashLightRef.current) {
        flashLightRef.current.position.copy(hitPoint).addScaledVector(normal, 0.15)
        flashLightRef.current.intensity = 4.5 * power
        flashTimer.current = 0.12
      }

      for (let i = 0; i < count; i++) {
        // Find inactive or oldest particle
        if (particles.current.length >= MAX_SPARKS) {
          particles.current.shift()
        }

        // Tangent & bitangent spread around normal
        const spreadX = (Math.random() - 0.5) * 1.8
        const spreadY = Math.random() * 1.5 + 0.3
        const spreadZ = (Math.random() - 0.5) * 1.8

        const vel = new THREE.Vector3()
          .copy(normal)
          .multiplyScalar(3.5 * power + Math.random() * 2.5)
          .add(new THREE.Vector3(spreadX, spreadY, spreadZ))

        particles.current.push({
          pos: hitPoint.clone().addScaledVector(normal, 0.05),
          vel,
          life: 0,
          maxLife: 0.25 + Math.random() * 0.35,
          size: 0.06 + Math.random() * 0.08,
          color: new THREE.Color(Math.random() > 0.4 ? '#ffffff' : '#ffd043'),
        })
      }
    },
  }))

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)

    // Flash light decay
    if (flashTimer.current > 0) {
      flashTimer.current -= dt
      if (flashLightRef.current) {
        flashLightRef.current.intensity = Math.max(0, flashTimer.current * 35)
      }
    }

    if (!pointsRef.current) return
    const geo = pointsRef.current.geometry

    let activeCount = 0
    const gravity = new THREE.Vector3(0, -9.8, 0)

    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i]
      p.life += dt

      if (p.life >= p.maxLife) {
        particles.current.splice(i, 1)
        continue
      }

      // Physics update
      p.vel.addScaledVector(gravity, dt)
      p.vel.multiplyScalar(0.96) // Air drag
      p.pos.addScaledVector(p.vel, dt)

      const lifeRatio = p.life / p.maxLife
      const idx = activeCount * 3

      // Pos
      positions.current[idx] = p.pos.x
      positions.current[idx + 1] = p.pos.y
      positions.current[idx + 2] = p.pos.z

      // Color fade: White -> Gold -> Amber -> Dark Ember
      let r = 1.0, g = 0.9, b = 0.4
      if (lifeRatio > 0.6) {
        r = 1.0 - (lifeRatio - 0.6) * 1.5
        g = 0.3 * (1 - lifeRatio)
        b = 0.05
      } else if (lifeRatio > 0.3) {
        r = 1.0
        g = 0.65
        b = 0.1
      }
      colors.current[idx] = r
      colors.current[idx + 1] = g
      colors.current[idx + 2] = b

      // Size decay
      sizes.current[activeCount] = p.size * (1 - lifeRatio)
      activeCount++
    }

    // Zero out unused
    for (let i = activeCount; i < MAX_SPARKS; i++) {
      const idx = i * 3
      positions.current[idx] = 0
      positions.current[idx + 1] = -9999
      positions.current[idx + 2] = 0
      sizes.current[i] = 0
    }

    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
    geo.setDrawRange(0, activeCount)
  })

  return (
    <>
      <pointLight ref={flashLightRef} color="#fff2aa" intensity={0} distance={8} decay={2} />
      <points ref={pointsRef}>
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
          size={0.09}
          map={sparkTexture ?? undefined}
          vertexColors
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  )
})

export default RockSparkSystem
