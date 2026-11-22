// ─────────────────────────────────────────────────────────────────────────────
// StylizedCharacter — 3D procedural anime adventurer with natural animations
// (Idle breathing, dynamic Walk, fast Sprint, and Jump poses)
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface StylizedCharacterProps {
  speed: number // current horizontal velocity magnitude
  isGrounded: boolean
  isSprinting: boolean
}

export default function StylizedCharacter({
  speed,
  isGrounded,
  isSprinting,
}: StylizedCharacterProps) {
  const rootRef = useRef<THREE.Group>(null!)
  const leftLegRef = useRef<THREE.Group>(null!)
  const rightLegRef = useRef<THREE.Group>(null!)
  const leftArmRef = useRef<THREE.Group>(null!)
  const rightArmRef = useRef<THREE.Group>(null!)
  const bodyRef = useRef<THREE.Group>(null!)
  const headRef = useRef<THREE.Group>(null!)
  const capeRef = useRef<THREE.Group>(null!)

  const animPhase = useRef(0)

  useFrame((_, delta) => {
    if (!rootRef.current) return

    const isMoving = speed > 0.1
    const animSpeed = isSprinting ? 14 : 9

    if (isMoving && isGrounded) {
      animPhase.current += delta * animSpeed
    } else {
      animPhase.current += delta * 2.5
    }

    const t = animPhase.current

    if (!isGrounded) {
      // ── In Air / Jumping Pose ──────────────────────────────────────────
      leftLegRef.current.rotation.x = THREE.MathUtils.lerp(
        leftLegRef.current.rotation.x,
        0.5,
        delta * 10
      )
      rightLegRef.current.rotation.x = THREE.MathUtils.lerp(
        rightLegRef.current.rotation.x,
        -0.3,
        delta * 10
      )
      leftArmRef.current.rotation.x = THREE.MathUtils.lerp(
        leftArmRef.current.rotation.x,
        -0.8,
        delta * 10
      )
      rightArmRef.current.rotation.x = THREE.MathUtils.lerp(
        rightArmRef.current.rotation.x,
        -0.8,
        delta * 10
      )
      leftArmRef.current.rotation.z = THREE.MathUtils.lerp(
        leftArmRef.current.rotation.z,
        -0.4,
        delta * 10
      )
      rightArmRef.current.rotation.z = THREE.MathUtils.lerp(
        rightArmRef.current.rotation.z,
        0.4,
        delta * 10
      )
      bodyRef.current.position.y = 0.55
      bodyRef.current.rotation.x = -0.15
      capeRef.current.rotation.x = 0.8 + Math.sin(t * 8) * 0.15
    } else if (isMoving) {
      // ── Walking / Running Pose ─────────────────────────────────────────
      const stride = isSprinting ? 0.95 : 0.65
      const legAngle = Math.sin(t) * stride
      const armAngle = Math.cos(t) * (stride * 0.85)

      // Legs swing in opposite directions
      leftLegRef.current.rotation.x = legAngle
      rightLegRef.current.rotation.x = -legAngle

      // Arms swing opposite to legs
      leftArmRef.current.rotation.x = -armAngle
      rightArmRef.current.rotation.x = armAngle
      leftArmRef.current.rotation.z = -0.15
      rightArmRef.current.rotation.z = 0.15

      // Torso lean + vertical bounce
      const lean = isSprinting ? 0.28 : 0.14
      bodyRef.current.rotation.x = lean
      bodyRef.current.position.y = 0.5 + Math.abs(Math.sin(t)) * 0.05

      // Head counter-levels slightly
      headRef.current.rotation.x = -lean * 0.6

      // Cape billows backwards with wind flutter
      const capeLift = isSprinting ? 0.95 : 0.45
      capeRef.current.rotation.x = capeLift + Math.sin(t * 2) * 0.12
    } else {
      // ── Idle Pose (Gentle breathing) ──────────────────────────────────
      const breathe = Math.sin(t) * 0.025
      bodyRef.current.position.y = 0.5 + breathe
      bodyRef.current.rotation.x = 0

      leftLegRef.current.rotation.x = THREE.MathUtils.lerp(
        leftLegRef.current.rotation.x,
        0,
        delta * 6
      )
      rightLegRef.current.rotation.x = THREE.MathUtils.lerp(
        rightLegRef.current.rotation.x,
        0,
        delta * 6
      )
      leftArmRef.current.rotation.x = THREE.MathUtils.lerp(
        leftArmRef.current.rotation.x,
        0.05 + Math.sin(t * 0.7) * 0.04,
        delta * 6
      )
      rightArmRef.current.rotation.x = THREE.MathUtils.lerp(
        rightArmRef.current.rotation.x,
        0.05 - Math.sin(t * 0.7) * 0.04,
        delta * 6
      )
      leftArmRef.current.rotation.z = -0.12
      rightArmRef.current.rotation.z = 0.12

      headRef.current.rotation.x = 0
      capeRef.current.rotation.x = 0.2 + Math.sin(t * 1.5) * 0.05
    }
  })

  return (
    <group ref={rootRef} position={[0, 0, 0]}>
      {/* ── Torso & Hips ────────────────────────────────────────────────── */}
      <group ref={bodyRef} position={[0, 0.5, 0]}>
        {/* Main Tunic / Coat */}
        <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[0.22, 0.38, 8, 16]} />
          <meshStandardMaterial
            color="#2a5a8a"
            roughness={0.7}
            metalness={0.1}
          />
        </mesh>

        {/* Waist Belt & Gold Buckle */}
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.24, 0.08, 16]} />
          <meshStandardMaterial color="#4a3018" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.22, 0.23]} castShadow>
          <boxGeometry args={[0.1, 0.08, 0.04]} />
          <meshStandardMaterial
            color="#e6b830"
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>

        {/* Adventurer Scarf / Collar */}
        <mesh position={[0, 0.58, 0.02]} castShadow>
          <torusGeometry args={[0.18, 0.07, 8, 16]} />
          <meshStandardMaterial color="#c23838" roughness={0.8} />
        </mesh>

        {/* Flowing Cape */}
        <group ref={capeRef} position={[0, 0.55, -0.16]}>
          <mesh position={[0, -0.4, -0.05]} castShadow>
            <boxGeometry args={[0.38, 0.75, 0.03]} />
            <meshStandardMaterial
              color="#b82f2f"
              roughness={0.85}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>

        {/* ── Head & Hair ──────────────────────────────────────────────── */}
        <group ref={headRef} position={[0, 0.78, 0]}>
          {/* Face */}
          <mesh castShadow>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color="#fcd9b8" roughness={0.6} />
          </mesh>

          {/* Stylized Anime Hair */}
          <mesh position={[0, 0.08, -0.03]} castShadow>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial color="#d49547" roughness={0.8} />
          </mesh>

          {/* Hair Bangs */}
          <mesh position={[0, 0.12, 0.14]} rotation={[0.4, 0, 0]} castShadow>
            <coneGeometry args={[0.14, 0.2, 5]} />
            <meshStandardMaterial color="#d49547" roughness={0.8} />
          </mesh>
          <mesh
            position={[-0.12, 0.06, 0.12]}
            rotation={[0.3, 0.3, -0.3]}
            castShadow
          >
            <coneGeometry args={[0.09, 0.18, 5]} />
            <meshStandardMaterial color="#d49547" roughness={0.8} />
          </mesh>
          <mesh
            position={[0.12, 0.06, 0.12]}
            rotation={[0.3, -0.3, 0.3]}
            castShadow
          >
            <coneGeometry args={[0.09, 0.18, 5]} />
            <meshStandardMaterial color="#d49547" roughness={0.8} />
          </mesh>

          {/* Eyes (Stylized Anime) */}
          <mesh position={[-0.07, 0.01, 0.18]}>
            <capsuleGeometry args={[0.025, 0.04, 4, 8]} />
            <meshBasicMaterial color="#1a2b3c" />
          </mesh>
          <mesh position={[0.07, 0.01, 0.18]}>
            <capsuleGeometry args={[0.025, 0.04, 4, 8]} />
            <meshBasicMaterial color="#1a2b3c" />
          </mesh>

          {/* Feather in hair */}
          <mesh
            position={[-0.18, 0.14, -0.08]}
            rotation={[0.4, 0, -0.6]}
            castShadow
          >
            <boxGeometry args={[0.04, 0.26, 0.01]} />
            <meshStandardMaterial color="#3ca9d8" roughness={0.5} />
          </mesh>
        </group>

        {/* ── Left Arm ─────────────────────────────────────────────────── */}
        <group ref={leftArmRef} position={[-0.28, 0.48, 0]}>
          {/* Shoulder pad */}
          <mesh position={[0, 0, 0]} castShadow>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#4a3018" roughness={0.8} />
          </mesh>
          {/* Sleeve */}
          <mesh position={[0, -0.16, 0]} castShadow>
            <capsuleGeometry args={[0.065, 0.22, 6, 12]} />
            <meshStandardMaterial color="#2a5a8a" roughness={0.7} />
          </mesh>
          {/* Hand / Glove */}
          <mesh position={[0, -0.32, 0]} castShadow>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#3a2512" roughness={0.9} />
          </mesh>
        </group>

        {/* ── Right Arm ────────────────────────────────────────────────── */}
        <group ref={rightArmRef} position={[0.28, 0.48, 0]}>
          {/* Shoulder pad */}
          <mesh position={[0, 0, 0]} castShadow>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#4a3018" roughness={0.8} />
          </mesh>
          {/* Sleeve */}
          <mesh position={[0, -0.16, 0]} castShadow>
            <capsuleGeometry args={[0.065, 0.22, 6, 12]} />
            <meshStandardMaterial color="#2a5a8a" roughness={0.7} />
          </mesh>
          {/* Hand / Glove */}
          <mesh position={[0, -0.32, 0]} castShadow>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#3a2512" roughness={0.9} />
          </mesh>
        </group>
      </group>

      {/* ── Left Leg ────────────────────────────────────────────────────── */}
      <group ref={leftLegRef} position={[-0.13, 0.48, 0]}>
        {/* Pants */}
        <mesh position={[0, -0.18, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.28, 6, 12]} />
          <meshStandardMaterial color="#253545" roughness={0.8} />
        </mesh>
        {/* Leather Boot */}
        <mesh position={[0, -0.36, 0.04]} castShadow>
          <boxGeometry args={[0.11, 0.16, 0.2]} />
          <meshStandardMaterial color="#4a3018" roughness={0.9} />
        </mesh>
      </group>

      {/* ── Right Leg ───────────────────────────────────────────────────── */}
      <group ref={rightLegRef} position={[0.13, 0.48, 0]}>
        {/* Pants */}
        <mesh position={[0, -0.18, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.28, 6, 12]} />
          <meshStandardMaterial color="#253545" roughness={0.8} />
        </mesh>
        {/* Leather Boot */}
        <mesh position={[0, -0.36, 0.04]} castShadow>
          <boxGeometry args={[0.11, 0.16, 0.2]} />
          <meshStandardMaterial color="#4a3018" roughness={0.9} />
        </mesh>
      </group>
    </group>
  )
}
