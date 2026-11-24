// ─────────────────────────────────────────────────────────────────────────────
// ProductionFPSController — Production-Grade FPS Controller with Fixed Sub-stepping
// Flawless 360° mouse look with Pointer Lock, view-relative kinematics with
// deterministic 60Hz physics sub-stepping, terrain ground clamping with camera elevation
// smoothing, and real-time GPU grass trampling.
// Rock-solid, immune to frame rate dips and micro-stutters.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { inputManager } from '@/systems/KeyboardInput'
import { useQuestStore } from '@/game/stores/questStore'
import { sound } from '@/game/audio/SoundSynthesizer'
import { worldCollisionSystem } from '@/game/physics/WorldCollisionSystem'

interface ProductionFPSControllerProps {
  onPositionUpdate?: (pos: THREE.Vector3, vel: THREE.Vector3) => void
  getTerrainHeight: (x: number, z: number) => number
  worldRadius?: number
  cameraYawRef?: React.MutableRefObject<number>
}

const FIXED_DT = 1 / 60
const MAX_SUB_STEPS = 4

export default function ProductionFPSController({
  onPositionUpdate,
  getTerrainHeight,
  worldRadius = 60,
  cameraYawRef,
}: ProductionFPSControllerProps) {
  const { camera, gl } = useThree()

  // Character Kinematics (in world coordinates)
  const pos = useRef(new THREE.Vector3(0, 0, 0))
  const vel = useRef(new THREE.Vector3(0, 0, 0))
  const isGrounded = useRef(true)
  const cameraElevation = useRef(0)
  const accumulator = useRef(0)
  const stepTimer = useRef(0)

  // Camera Orientation (radians)
  const yaw = useRef(0)
  const pitch = useRef(-0.06) // Slight natural downward gaze

  useEffect(() => {
    ;(window as any).__setCamera = (newYaw: number, newPitch: number) => {
      yaw.current = newYaw
      pitch.current = newPitch
    }
    ;(window as any).__setPlayerPos = (newX: number, newZ: number) => {
      pos.current.x = newX
      pos.current.z = newZ
      pos.current.y = getTerrainHeight(newX, newZ)
      cameraElevation.current = pos.current.y
    }
  }, [getTerrainHeight])

  // Head Bobbing & Landing Dip
  const bobPhase = useRef(0)
  const currentBobY = useRef(0)
  const landingSquash = useRef(0)

  // Scratch Vectors (Zero Garbage Collection)
  const fwd = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())
  const moveDir = useRef(new THREE.Vector3())
  const targetVel = useRef(new THREE.Vector3())

  // Constants
  const EYE_HEIGHT = 1.68
  const WALK_SPEED = 5.2
  const SPRINT_SPEED = 9.8
  const JUMP_IMPULSE = 7.8
  const GRAVITY = -22.0
  const MOUSE_SENSITIVITY = 0.0022

  useEffect(() => {
    // 1. Initial Spawn Setup (clear meadow facing shrines)
    const spawnX = 0
    const spawnZ = 8.5
    const spawnY = getTerrainHeight(spawnX, spawnZ)
    pos.current.set(spawnX, spawnY, spawnZ)
    cameraElevation.current = spawnY
    camera.rotation.order = 'YXZ'
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')
    camera.position.set(spawnX, spawnY + EYE_HEIGHT, spawnZ)

    ;(window as any).__playerPos = pos.current
    ;(window as any).__camera = camera
    ;(window as any).__setPlayerPos = (x: number, z: number) => {
      pos.current.x = x
      pos.current.z = z
      pos.current.y = getTerrainHeight(x, z)
    }

    // 2. Click Window to Request Pointer Lock (Instant 360° Mouse Look)
    const canvas = gl.domElement
    const handleCanvasClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('button, [class*="leva"], a, input')) return
      if (!inputManager.isLocked) {
        try {
          const promise = (canvas as any).requestPointerLock?.()
          if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {})
          }
        } catch (_) {}
      }
    }

    window.addEventListener('click', handleCanvasClick)

    return () => {
      window.removeEventListener('click', handleCanvasClick)
    }
  }, [camera, gl, getTerrainHeight])

  useFrame((_, delta) => {
    // Clamp delta time to avoid spiral of death on long frames
    const dt = Math.min(delta, 0.1)

    // ── 1. Camera Look (360° Mouse Look via Pointer Lock) ─────────────────
    const isAiming = useQuestStore.getState().isAiming
    const drawProgress = useQuestStore.getState().drawProgress
    const sensScale = (isAiming || drawProgress > 0.05) && (camera instanceof THREE.PerspectiveCamera)
      ? Math.max(0.65, camera.fov / 68)
      : 1.0

    const { dx, dy } = inputManager.consumeMouseDelta()
    if (dx !== 0 || dy !== 0) {
      yaw.current -= dx * MOUSE_SENSITIVITY * sensScale
      pitch.current -= dy * MOUSE_SENSITIVITY * sensScale

      // Clamp pitch to avoid gimbal flip (~-85 deg to +85 deg)
      pitch.current = Math.max(-1.48, Math.min(1.48, pitch.current))
    }

    camera.rotation.order = 'YXZ'
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')

    // ── 2. Fixed Physics Sub-Stepping Loop ────────────────────────────────
    accumulator.current += dt
    let steps = 0

    while (accumulator.current >= FIXED_DT && steps < MAX_SUB_STEPS) {
      accumulator.current -= FIXED_DT
      steps++

      // Derive horizontal vectors from current yaw
      fwd.current.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current)).normalize()
      right.current.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current)).normalize()

      let inputX = 0
      let inputZ = 0

      if (inputManager.isMovingForward()) inputZ += 1
      if (inputManager.isMovingBackward()) inputZ -= 1
      if (inputManager.isMovingLeft()) inputX -= 1
      if (inputManager.isMovingRight()) inputX += 1

      const isMoving = Math.abs(inputX) > 0.01 || Math.abs(inputZ) > 0.01
      const sprinting = isMoving && inputManager.isSprinting()
      const targetSpeed = sprinting ? SPRINT_SPEED : WALK_SPEED

      moveDir.current.set(0, 0, 0)
      if (isMoving) {
        const len = Math.hypot(inputX, inputZ)
        const nx = inputX / len
        const nz = inputZ / len

        moveDir.current
          .addScaledVector(fwd.current, nz)
          .addScaledVector(right.current, nx)
          .normalize()

        targetVel.current.copy(moveDir.current).multiplyScalar(targetSpeed)
      } else {
        targetVel.current.set(0, 0, 0)
      }

      // Smooth horizontal velocity integration (Smooth, responsive AAA locomotion)
      const accelRate = isGrounded.current ? 38 : 14
      const frictionRate = isGrounded.current ? 24 : 4

      if (isMoving) {
        vel.current.x = THREE.MathUtils.damp(vel.current.x, targetVel.current.x, accelRate, FIXED_DT)
        vel.current.z = THREE.MathUtils.damp(vel.current.z, targetVel.current.z, accelRate, FIXED_DT)
      } else {
        vel.current.x = THREE.MathUtils.damp(vel.current.x, 0, frictionRate, FIXED_DT)
        vel.current.z = THREE.MathUtils.damp(vel.current.z, 0, frictionRate, FIXED_DT)
      }

      // Apply horizontal movement
      pos.current.x += vel.current.x * FIXED_DT
      pos.current.z += vel.current.z * FIXED_DT

      // World Collision Resolution against Rocks, Trees, Pillars & Shrines
      // Slim human explorer radius (0.21m) and step height (0.42m) enables fluid navigation,
      // stepping over small rocks, and squeezing through forest trees into the woods without snagging
      worldCollisionSystem.resolvePlayerCollision(pos.current, vel.current, 0.21, 0.42)

      // World boundary constraint
      const currentRadius = Math.hypot(pos.current.x, pos.current.z)
      if (currentRadius > worldRadius) {
        const angle = Math.atan2(pos.current.z, pos.current.x)
        pos.current.x = Math.cos(angle) * worldRadius
        pos.current.z = Math.sin(angle) * worldRadius
        vel.current.x *= 0.3
        vel.current.z *= 0.3
      }

      // Vertical Physics & Ground Clamping
      const terrainY = getTerrainHeight(pos.current.x, pos.current.z)

      if (isGrounded.current) {
        pos.current.y = terrainY
        vel.current.y = 0

        // Jump Impulse
        if (inputManager.isJumping()) {
          vel.current.y = JUMP_IMPULSE
          isGrounded.current = false
        }
      } else {
        // Airborne Freefall
        vel.current.y += GRAVITY * FIXED_DT
        pos.current.y += vel.current.y * FIXED_DT

        // Ground Impact Detection
        if (pos.current.y <= terrainY) {
          pos.current.y = terrainY
          const impactSpeed = Math.abs(vel.current.y)
          landingSquash.current = Math.min(0.12, impactSpeed * 0.009)
          vel.current.y = 0
          isGrounded.current = true
        }
      }
    }

    // Recover from landing squash
    landingSquash.current = THREE.MathUtils.damp(landingSquash.current, 0, 16, dt)

    // ── 3. Subtle Head Bobbing ───────────────────────────────────────────
    const horizSpeed = Math.hypot(vel.current.x, vel.current.z)
    let targetBob = 0

    if (isGrounded.current && horizSpeed > 0.4) {
      const isSprinting = inputManager.isSprinting()
      const freq = isSprinting ? 13.5 : 9.0
      const amp = isSprinting ? 0.042 : 0.022
      bobPhase.current += dt * freq
      targetBob = Math.sin(bobPhase.current) * amp
    } else {
      // Idle subtle breathing
      bobPhase.current += dt * 1.8
      targetBob = Math.sin(bobPhase.current) * 0.003
    }

    currentBobY.current = THREE.MathUtils.damp(currentBobY.current, targetBob, 12, dt)

    // Dynamic footstep sound synthesis
    if (isGrounded.current && horizSpeed > 0.6) {
      const stepFreq = inputManager.isSprinting() ? 0.32 : 0.48
      stepTimer.current += dt
      if (stepTimer.current >= stepFreq) {
        stepTimer.current = 0
        sound.playFootstep(inputManager.isSprinting())
      }
    } else {
      stepTimer.current = 0
    }

    // Dynamic Aim-Down-Sights (ADS) Field of View Zoom (Smooth archer focus zoom)
    const isBowEquipped = useQuestStore.getState().isBowEquipped
    const zoomActive = isBowEquipped && (isAiming || drawProgress > 0.05)
    const targetFov = zoomActive ? 68 - Math.max(isAiming ? 14 : 0, drawProgress * 16) : 68
    if (camera instanceof THREE.PerspectiveCamera) {
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 12, dt)
        camera.updateProjectionMatrix()
      }
    }

    // ── 4. Camera Elevation Smoothing & Position ──────────────────────────
    // Smooth camera elevation filters out terrain triangle micro-creases
    cameraElevation.current = THREE.MathUtils.damp(
      cameraElevation.current,
      pos.current.y,
      28,
      dt
    )

    camera.position.set(
      pos.current.x,
      cameraElevation.current + EYE_HEIGHT + currentBobY.current - landingSquash.current,
      pos.current.z
    )

    // Export yaw for compass
    if (cameraYawRef) {
      cameraYawRef.current = yaw.current
    }

    // Notify scene of player position and velocity for real-time grass trampling & parting wake
    onPositionUpdate?.(pos.current, vel.current)
  })

  return null
}
