// ─────────────────────────────────────────────────────────────────────────────
// FirstPersonController — Authentic 360° FPS Movement & Camera
// Full WASD directional movement relative to view, pitch/yaw mouse look with
// Pointer Lock, realistic jump physics, head bobbing, and grass trampling.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useInputStore } from '@/stores/inputStore'

interface FirstPersonControllerProps {
  onPositionUpdate?: (pos: THREE.Vector3) => void
  getTerrainHeight: (x: number, z: number) => number
  worldRadius?: number
}

export default function FirstPersonController({
  onPositionUpdate,
  getTerrainHeight,
  worldRadius = 55,
}: FirstPersonControllerProps) {
  const { camera, gl } = useThree()

  // Character physics
  const playerPos = useRef(new THREE.Vector3(0, 0, 0))
  const vel = useRef(new THREE.Vector3(0, 0, 0))
  const isGrounded = useRef(true)

  // Camera orientation (radians)
  const yaw = useRef(0)
  const pitch = useRef(-0.05)
  const isLocked = useRef(false)
  const isMouseDown = useRef(false)

  // Head bobbing phase
  const bobPhase = useRef(0)
  const EYE_HEIGHT = 1.7

  // Scratch vectors
  const camFwd = useRef(new THREE.Vector3())
  const camRight = useRef(new THREE.Vector3())
  const moveDir = useRef(new THREE.Vector3())

  useEffect(() => {
    // Initial camera setup
    playerPos.current.set(0, getTerrainHeight(0, 0), 0)
    camera.rotation.order = 'YXZ'

    const handlePointerLockChange = () => {
      isLocked.current = document.pointerLockElement === gl.domElement
      useInputStore.getState().setLocked(isLocked.current)
    }

    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('[class*="leva"], button, a')) return
      isMouseDown.current = true
      // Request pointer lock on canvas click
      if (!isLocked.current && e.target === gl.domElement) {
        gl.domElement.requestPointerLock()
      }
    }

    const handleMouseUp = () => {
      isMouseDown.current = false
    }

    const handleMouseMove = (e: MouseEvent) => {
      // Rotate camera if pointer is locked OR if mouse is dragged on canvas
      if (isLocked.current || isMouseDown.current) {
        const sens = 0.0024
        yaw.current -= e.movementX * sens
        pitch.current -= e.movementY * sens

        // Clamp pitch to avoid gimbal flipping (approx -84 to +84 deg)
        pitch.current = Math.max(-1.46, Math.min(1.46, pitch.current))
      }
    }

    document.addEventListener('pointerlockchange', handlePointerLockChange)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [camera, gl, getTerrainHeight])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.08)
    const input = useInputStore.getState()

    // ── 1. Calculate Horizontal Movement (WASD / Joystick) ───────────────
    let inputX = 0
    let inputZ = 0

    if (input.isDown('KeyW') || input.isDown('ArrowUp')) inputZ += 1
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) inputZ -= 1
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) inputX -= 1
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) inputX += 1

    // Virtual Joystick support (for mobile/touch)
    if (input.joystickVector.x !== 0 || input.joystickVector.y !== 0) {
      inputX += input.joystickVector.x
      inputZ += input.joystickVector.y
    }

    const isMoving = Math.abs(inputX) > 0.01 || Math.abs(inputZ) > 0.01
    const sprinting = input.isSprinting && isMoving
    const maxSpeed = sprinting ? 9.2 : 4.6
    const accel = isGrounded.current ? 38 : 10

    // Horizontal Forward & Right based on camera yaw
    camFwd.current.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current)).normalize()
    camRight.current.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current)).normalize()

    if (isMoving) {
      const len = Math.sqrt(inputX * inputX + inputZ * inputZ)
      const nx = inputX / Math.max(len, 1)
      const nz = inputZ / Math.max(len, 1)

      moveDir.current
        .set(0, 0, 0)
        .addScaledVector(camFwd.current, nz)
        .addScaledVector(camRight.current, nx)
        .normalize()

      vel.current.x = THREE.MathUtils.lerp(vel.current.x, moveDir.current.x * maxSpeed, accel * dt)
      vel.current.z = THREE.MathUtils.lerp(vel.current.z, moveDir.current.z * maxSpeed, accel * dt)
    } else {
      const drag = isGrounded.current ? 20 : 3
      vel.current.x = THREE.MathUtils.lerp(vel.current.x, 0, drag * dt)
      vel.current.z = THREE.MathUtils.lerp(vel.current.z, 0, drag * dt)
    }

    // ── 2. Vertical Physics & Jump ────────────────────────────────────────
    const terrainY = getTerrainHeight(playerPos.current.x, playerPos.current.z)
    const gravity = -24.0

    if (isGrounded.current) {
      playerPos.current.y = terrainY
      vel.current.y = 0

      if (input.isJumping) {
        vel.current.y = 8.0 // Jump impulse
        isGrounded.current = false
      }
    } else {
      vel.current.y += gravity * dt
      playerPos.current.y += vel.current.y * dt

      if (playerPos.current.y <= terrainY) {
        playerPos.current.y = terrainY
        vel.current.y = 0
        isGrounded.current = true
      }
    }

    // Apply horizontal motion
    playerPos.current.x += vel.current.x * dt
    playerPos.current.z += vel.current.z * dt

    // Clamp within open world boundary
    const bound = worldRadius * 0.94
    playerPos.current.x = Math.max(-bound, Math.min(bound, playerPos.current.x))
    playerPos.current.z = Math.max(-bound, Math.min(bound, playerPos.current.z))

    // ── 3. Head Bobbing for Realistic First Person Immersion ──────────────
    const horizSpeed = Math.sqrt(vel.current.x * vel.current.x + vel.current.z * vel.current.z)
    let bobY = 0
    let bobX = 0

    if (isGrounded.current && horizSpeed > 0.5) {
      const bobFreq = sprinting ? 15 : 10
      const bobAmp = sprinting ? 0.06 : 0.035
      bobPhase.current += dt * bobFreq
      bobY = Math.sin(bobPhase.current) * bobAmp
      bobX = Math.cos(bobPhase.current * 0.5) * (bobAmp * 0.45)
    } else {
      bobPhase.current = 0
    }

    // ── 4. Set Camera Position & Rotation ─────────────────────────────────
    camera.rotation.order = 'YXZ'
    camera.rotation.set(pitch.current, yaw.current, 0)

    // Camera sits right at eye level of player
    camera.position.set(
      playerPos.current.x + bobX,
      playerPos.current.y + EYE_HEIGHT + bobY,
      playerPos.current.z
    )

    // Notify scene of position (for real-time grass trampling)
    onPositionUpdate?.(playerPos.current)
  })

  return null
}
