// ─────────────────────────────────────────────────────────────────────────────
// CharacterController — Open World Third-Person Controller
// Supports WASD + Touch Joystick, Smooth Camera Follow, Physics, Jump, Sprint,
// and real-time Grass Trampling.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useInputStore } from '@/stores/inputStore'
import StylizedCharacter from './StylizedCharacter'

interface CharacterControllerProps {
  onPositionUpdate?: (pos: THREE.Vector3) => void
  initialPosition?: [number, number, number]
}

// Terrain elevation function matching open world terrain
export function getTerrainHeight(x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z)
  // Inside central island (radius ~7m) ground is flat / gentle base
  if (dist < 6.8) {
    return 0
  }
  // Smoothly blend into rolling open world terrain beyond 6.8m
  const blend = Math.min(1, (dist - 6.8) / 4.0)
  const hills =
    Math.sin(x * 0.08) * 0.9 +
    Math.cos(z * 0.07) * 0.8 +
    Math.sin(x * 0.18 + z * 0.14) * 0.4
  return hills * blend
}

export default function CharacterController({
  onPositionUpdate,
  initialPosition = [0, 0, 0],
}: CharacterControllerProps) {
  const { camera } = useThree()

  // Character physical state
  const charGroupRef = useRef<THREE.Group>(null!)
  const pos = useRef(new THREE.Vector3(...initialPosition))
  const vel = useRef(new THREE.Vector3(0, 0, 0))
  const targetRotation = useRef(0)
  const currentRotation = useRef(0)

  // Character animation state
  const [speed, setSpeed] = useState(0)
  const [isGrounded, setIsGrounded] = useState(true)
  const [isSprinting, setIsSprinting] = useState(false)

  // Third-person camera spherical coords
  const cameraAzimuth = useRef(0) // horizontal angle around character
  const cameraPolar = useRef(Math.PI * 0.35) // vertical angle (0 is above, PI/2 is horizon)
  const cameraDistance = useRef(5.5) // distance from character

  // Temp vectors to avoid garbage collection
  const moveDir = useRef(new THREE.Vector3())
  const camFwd = useRef(new THREE.Vector3())
  const camRight = useRef(new THREE.Vector3())
  const desiredCamPos = useRef(new THREE.Vector3())

  useEffect(() => {
    // Initial camera placement
    cameraPolar.current = 1.1
    cameraDistance.current = 5.2
  }, [])

  useFrame((_, delta) => {
    if (!charGroupRef.current) return

    // Cap delta time to prevent tunneling during lag spikes
    const dt = Math.min(delta, 0.08)

    const input = useInputStore.getState()
    const { consumeCameraDelta, consumeZoomDelta } = input

    // ── 1. Update Camera Orbit from Input ──────────────────────────────────
    const camDelta = consumeCameraDelta()
    if (camDelta.dx !== 0 || camDelta.dy !== 0) {
      cameraAzimuth.current -= camDelta.dx * 0.0035
      cameraPolar.current += camDelta.dy * 0.003
      // Clamp vertical camera angle so it doesn't flip or clip underground
      cameraPolar.current = Math.max(0.2, Math.min(Math.PI * 0.48, cameraPolar.current))
    }

    const zoom = consumeZoomDelta()
    if (zoom !== 0) {
      cameraDistance.current = Math.max(2.5, Math.min(18.0, cameraDistance.current + zoom * 2.0))
    }

    // ── 2. Calculate Directional Input (WASD / Joystick) ──────────────────
    let inputX = 0
    let inputZ = 0

    if (input.isDown('KeyW') || input.isDown('ArrowUp')) inputZ += 1
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) inputZ -= 1
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) inputX -= 1
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) inputX += 1

    // Add virtual joystick input (for mobile)
    if (input.joystickVector.x !== 0 || input.joystickVector.y !== 0) {
      inputX += input.joystickVector.x
      inputZ += input.joystickVector.y
    }

    const hasInput = Math.abs(inputX) > 0.01 || Math.abs(inputZ) > 0.01
    const sprinting = input.isSprinting && hasInput
    setIsSprinting(sprinting)

    // Camera forward and right vectors projected onto XZ plane
    camFwd.current.set(
      Math.sin(cameraAzimuth.current),
      0,
      Math.cos(cameraAzimuth.current)
    ).normalize()

    camRight.current.set(
      Math.cos(cameraAzimuth.current),
      0,
      -Math.sin(cameraAzimuth.current)
    ).normalize()

    // ── 3. Character Horizontal Movement ──────────────────────────────────
    const maxSpeed = sprinting ? 8.5 : 4.2
    const accel = isGrounded ? 35 : 12

    if (hasInput) {
      // Normalize input vector
      const len = Math.sqrt(inputX * inputX + inputZ * inputZ)
      const nx = inputX / Math.max(len, 1)
      const nz = inputZ / Math.max(len, 1)

      // Move relative to camera perspective
      moveDir.current
        .set(0, 0, 0)
        .addScaledVector(camFwd.current, nz)
        .addScaledVector(camRight.current, nx)
        .normalize()

      // Accelerate towards desired velocity
      vel.current.x = THREE.MathUtils.lerp(
        vel.current.x,
        moveDir.current.x * maxSpeed,
        accel * dt
      )
      vel.current.z = THREE.MathUtils.lerp(
        vel.current.z,
        moveDir.current.z * maxSpeed,
        accel * dt
      )

      // Update facing rotation smoothly
      targetRotation.current = Math.atan2(moveDir.current.x, moveDir.current.z)
    } else {
      // Decelerate when no input
      const drag = isGrounded ? 18 : 3
      vel.current.x = THREE.MathUtils.lerp(vel.current.x, 0, drag * dt)
      vel.current.z = THREE.MathUtils.lerp(vel.current.z, 0, drag * dt)
    }

    // Smoothly turn character towards movement direction
    let angleDiff = targetRotation.current - currentRotation.current
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
    currentRotation.current += angleDiff * Math.min(1, 14 * dt)
    charGroupRef.current.rotation.y = currentRotation.current

    // ── 4. Vertical Physics & Jump ────────────────────────────────────────
    const terrainY = getTerrainHeight(pos.current.x, pos.current.z)
    const gravity = -26.0

    if (isGrounded) {
      // On Ground
      pos.current.y = terrainY
      vel.current.y = 0

      if (input.isJumping) {
        vel.current.y = 9.2 // Jump burst
        setIsGrounded(false)
      }
    } else {
      // In Air
      vel.current.y += gravity * dt
      pos.current.y += vel.current.y * dt

      // Ground Collision Check
      if (pos.current.y <= terrainY) {
        pos.current.y = terrainY
        vel.current.y = 0
        setIsGrounded(true)
      }
    }

    // ── 5. Apply Horizontal Position ──────────────────────────────────────
    pos.current.x += vel.current.x * dt
    pos.current.z += vel.current.z * dt

    // Sync mesh position
    charGroupRef.current.position.copy(pos.current)

    // Current horizontal speed for animations
    const currentSpeed = Math.sqrt(
      vel.current.x * vel.current.x + vel.current.z * vel.current.z
    )
    setSpeed(currentSpeed)

    // Notify scene of player position (for grass trampling)
    onPositionUpdate?.(pos.current)

    // ── 6. Third-Person Camera Follow ─────────────────────────────────────
    // Calculate camera position in spherical coordinates relative to character
    const sinP = Math.sin(cameraPolar.current)
    const cosP = Math.cos(cameraPolar.current)
    const sinA = Math.sin(cameraAzimuth.current)
    const cosA = Math.cos(cameraAzimuth.current)

    const offsetX = -sinA * sinP * cameraDistance.current
    const offsetY = cosP * cameraDistance.current
    const offsetZ = -cosA * sinP * cameraDistance.current

    // Look target is character's chest / upper body
    const lookTarget = new THREE.Vector3(
      pos.current.x,
      pos.current.y + 1.25,
      pos.current.z
    )

    desiredCamPos.current.set(
      pos.current.x + offsetX,
      pos.current.y + offsetY,
      pos.current.z + offsetZ
    )

    // Prevent camera from clipping through terrain
    const camTerrainY = getTerrainHeight(
      desiredCamPos.current.x,
      desiredCamPos.current.z
    )
    if (desiredCamPos.current.y < camTerrainY + 0.6) {
      desiredCamPos.current.y = camTerrainY + 0.6
    }

    // Smooth camera lag
    camera.position.lerp(desiredCamPos.current, Math.min(1, 14 * dt))
    camera.lookAt(lookTarget)
  })

  return (
    <group ref={charGroupRef} position={initialPosition}>
      <StylizedCharacter
        speed={speed}
        isGrounded={isGrounded}
        isSprinting={isSprinting}
      />
    </group>
  )
}
