// ─────────────────────────────────────────────────────────────────────────────
// BowViewModel — AAA Authentic Handcrafted 3D Forest Recurve Bow Viewmodel
// Pure Traditional Wilderness Archery:
// - Genuine 3D Models:
//     * /assets/models/Bow_Wooden.glb (Carved Mountain Yew Recurve Limbs & Leather Riser)
//     * /assets/models/Arrow.glb (Cedar Shaft, Turkey Feathers, Forged Steel Broadhead)
// - Dynamic Flemish-Twist Braided Bowstring with Mathematical Limb Tip Clamping
// - Perfect First-Person Viewport Framing:
//     * Proper proportion (scale 0.095x)
//     * Upper & lower limbs 100% visible inside the window without clipping
//     * Anchored in right third (X~0.22m) leaving center crosshair (960, 540) and left 75% wide open
//     * Arrow strictly aligned in 3D camera depth angle
// - Mouse Look Inertia Sway, Movement Bobbing & Tactile Draw / Release Recoil
// - Dedicated Depth Buffer Clearing (Zero world clipping through trees or terrain)
// - Clean Floating Viewmodel: ZERO Roblox cylinder arms or block hands
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useQuestStore } from '../stores/questStore'
import { sound } from '../audio/SoundSynthesizer'
import { inputManager } from '@/systems/KeyboardInput'

interface BowViewModelProps {
  onFireArrow: (origin: THREE.Vector3, direction: THREE.Vector3, power: number) => void
}

export default function BowViewModel({ onFireArrow }: BowViewModelProps) {
  const { camera } = useThree()
  const bowRootRef = useRef<THREE.Group>(null!)
  const rigGroupRef = useRef<THREE.Group>(null!)
  const arrowGroupRef = useRef<THREE.Group>(null!)

  const isDrawing = useRef(false)
  const drawTension = useRef(0)
  const isReloading = useRef(false)
  const reloadTimer = useRef(0)
  const stringVibration = useRef(0)
  const recoilOffset = useRef(0)
  const recoilRotation = useRef(0)
  const equipProgress = useRef(1.0)
  const aimProgress = useRef(0.0)

  // Camera rotation inertia tracking
  const prevCamQuat = useRef(new THREE.Quaternion())
  const swayOffset = useRef(new THREE.Vector3())
  const swayRot = useRef(new THREE.Vector3())
  const walkBobTimer = useRef(0)
  const breathTimer = useRef(0)

  const setDrawProgress = useQuestStore((s) => s.setDrawProgress)
  const setAiming = useQuestStore((s) => s.setAiming)
  const isBowEquipped = useQuestStore((s) => s.isBowEquipped)
  const toggleBowEquipped = useQuestStore((s) => s.toggleBowEquipped)

  // ── Load Authentic 3D Models ────────────────────────────────────────────────
  const { nodes: bowNodes } = useGLTF('/assets/models/Bow_Wooden.glb') as any
  const { nodes: arrowNodes } = useGLTF('/assets/models/Arrow.glb') as any

  // ── PBR Materials for Organic Archery Aesthetics ────────────────────────────
  const materials = useMemo(() => {
    // Carved Mountain Yew / Walnut Hardwood Limbs & Riser
    const woodMat = new THREE.MeshStandardMaterial({
      color: '#4a2914',
      roughness: 0.65,
      metalness: 0.04,
    })

    // Weathered Leather Grip Wrap & Arrow Shelf Rest
    const leatherMat = new THREE.MeshStandardMaterial({
      color: '#24160e',
      roughness: 0.85,
      metalness: 0.05,
    })

    // Arrow Fletching Turkey Feathers
    const fletchMat = new THREE.MeshStandardMaterial({
      color: '#e8e2d8',
      roughness: 0.65,
      side: THREE.DoubleSide,
    })

    // Cedar Wood Arrow Shaft
    const arrowShaftMat = new THREE.MeshStandardMaterial({
      color: '#5c351a',
      roughness: 0.50,
      metalness: 0.03,
    })

    // Forged Carbon Steel Broadhead Razor Point
    const broadheadMat = new THREE.MeshStandardMaterial({
      color: '#bcc5cc',
      roughness: 0.22,
      metalness: 0.88,
    })

    // Gunmetal Steel Ferrule Collar
    const ferruleMat = new THREE.MeshStandardMaterial({
      color: '#383d42',
      roughness: 0.35,
      metalness: 0.80,
    })

    return { woodMat, leatherMat, fletchMat, arrowShaftMat, broadheadMat, ferruleMat }
  }, [])

  // ── Dynamic Braided Dacron Bowstring Line ───────────────────────────────────
  const { stringGeo, stringLine } = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    // 3 vertices: Upper Tip -> String Nock Center -> Lower Tip
    const positions = new Float32Array([
      0, 0.242, 0.096,
      0, 0.000, 0.096,
      0, -0.242, 0.096,
    ])
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const mat = new THREE.LineBasicMaterial({
      color: '#ded8ce',
      linewidth: 1.5,
    })

    const line = new THREE.Line(geo, mat)
    return { stringGeo: geo, stringLine: line }
  }, [])

  // ── Mouse & Keyboard Controls ──────────────────────────────────────────────
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!isBowEquipped) return
      if (e.target instanceof Element && e.target.closest('[class*="leva"], button, a')) return

      if (e.button === 0 && !isReloading.current) {
        isDrawing.current = true
        sound.playBowDraw(0.2)
      } else if (e.button === 2) {
        setAiming(true)
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!isBowEquipped) return

      if (e.button === 0 && isDrawing.current) {
        isDrawing.current = false
        const power = Math.max(0.35, drawTension.current)

        if (power > 0.40) {
          // Fire physical ballistic arrow
          const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
          const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
          const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)

          // Spawn origin at arrow shelf rest in camera world coordinates
          const aFactor = aimProgress.current
          const spawnOffset = new THREE.Vector3()
            .addScaledVector(camRight, THREE.MathUtils.lerp(0.18, 0.0, aFactor))
            .addScaledVector(camUp, THREE.MathUtils.lerp(-0.08, -0.01, aFactor))
            .addScaledVector(fwd, 0.55)

          const spawnPos = camera.position.clone().add(spawnOffset)

          onFireArrow(spawnPos, fwd, power)
          sound.playBowRelease(power)

          // Tactile spring recoil impulse
          recoilOffset.current = 0.045 * power
          recoilRotation.current = -0.065 * power
          stringVibration.current = 1.0

          // Begin reload animation
          isReloading.current = true
          reloadTimer.current = 0
        } else {
          // Cancelling loose draw
          sound.playBowRelease(0.2)
        }

        drawTension.current = 0
        setDrawProgress(0)
      } else if (e.button === 2) {
        setAiming(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, [class*="leva"], button, a')) return
      if (e.key === '1') {
        toggleBowEquipped()
      }
    }

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [camera, isBowEquipped, onFireArrow, setAiming, setDrawProgress, toggleBowEquipped])

  // ── Per-Frame Viewmodel Rig & Kinematics ───────────────────────────────────
  useFrame((state, delta) => {
    if (!bowRootRef.current || !rigGroupRef.current) return
    const dt = Math.min(delta, 0.05)

    // 1. Equip / Unequip transition
    if (!isBowEquipped) {
      equipProgress.current = THREE.MathUtils.damp(equipProgress.current, 0, 16, dt)
      if (equipProgress.current < 0.05) {
        bowRootRef.current.visible = false
        return
      }
    } else {
      equipProgress.current = THREE.MathUtils.damp(equipProgress.current, 1, 16, dt)
    }
    bowRootRef.current.visible = true

    // 2. Camera Look-Sway Inertia
    if (prevCamQuat.current.lengthSq() > 0.001) {
      const deltaQuat = prevCamQuat.current.clone().invert().multiply(camera.quaternion)
      const yawDelta = -deltaQuat.y * 2.0
      const pitchDelta = deltaQuat.x * 2.0

      swayOffset.current.x = THREE.MathUtils.damp(swayOffset.current.x, yawDelta * 0.03, 10, dt)
      swayOffset.current.y = THREE.MathUtils.damp(swayOffset.current.y, -pitchDelta * 0.03, 10, dt)
      swayRot.current.z = THREE.MathUtils.damp(swayRot.current.z, yawDelta * 0.12, 10, dt)
    }
    prevCamQuat.current.copy(camera.quaternion)

    // Decay recoil
    recoilOffset.current = THREE.MathUtils.damp(recoilOffset.current, 0, 14, dt)
    recoilRotation.current = THREE.MathUtils.damp(recoilRotation.current, 0, 14, dt)

    // 3. Draw Tension & Reload Cycle
    if (isDrawing.current) {
      drawTension.current = Math.min(1.0, drawTension.current + dt * 1.55)
      setDrawProgress(drawTension.current)
    }

    const RELOAD_TIME = 0.55
    let reloadProgress = 1.0
    if (isReloading.current) {
      reloadTimer.current += dt
      reloadProgress = Math.min(1.0, reloadTimer.current / RELOAD_TIME)
      if (reloadProgress >= 1.0) {
        isReloading.current = false
        sound.playArrowNock()
      }
    }

    // 4. Locomotion Bobbing & Respiration
    walkBobTimer.current += dt * 4.5
    breathTimer.current += dt * 1.8

    const bobX = Math.cos(walkBobTimer.current * 0.5) * 0.003
    const bobY = Math.sin(walkBobTimer.current) * 0.005 + Math.sin(breathTimer.current) * 0.002

    // 5. Aiming Alignment (LMB Draw or RMB Focus)
    const isAimingTarget = isDrawing.current || useQuestStore.getState().isAiming
    aimProgress.current = THREE.MathUtils.damp(aimProgress.current, isAimingTarget ? 1.0 : 0.0, 14, dt)
    const aFactor = aimProgress.current

    // Viewmodel Position in Camera Space
    // Idle stance: lower-right viewport (X~0.22m, Y~-0.16m, Z~-0.44m)
    // Aiming stance: brought up toward center sight corridor (X~0.04m, Y~-0.03m, Z~-0.38m)
    const eqY = (1.0 - equipProgress.current) * -0.55
    const targetX = THREE.MathUtils.lerp(0.22, 0.04, aFactor) + bobX + swayOffset.current.x
    const targetY = THREE.MathUtils.lerp(-0.16, -0.03, aFactor) + bobY + eqY + swayOffset.current.y
    const targetZ = THREE.MathUtils.lerp(-0.44, -0.38, aFactor) + recoilOffset.current

    rigGroupRef.current.position.set(targetX, targetY, targetZ)

    // Viewmodel Rotation
    const pitchX = THREE.MathUtils.lerp(0.04, 0.01, aFactor) + recoilRotation.current
    const yawY = THREE.MathUtils.lerp(0.06, -0.02, aFactor)
    const rollZ = THREE.MathUtils.lerp(-0.16, -0.05, aFactor) + swayRot.current.z

    rigGroupRef.current.rotation.set(pitchX, yawY, rollZ, 'YXZ')

    // Attach to camera
    bowRootRef.current.position.copy(camera.position)
    bowRootRef.current.quaternion.copy(camera.quaternion)

    // 6. Dynamic String Pull & Arrow Placement
    const tension = drawTension.current
    const pullDistance = 0.095 * tension

    stringVibration.current = THREE.MathUtils.damp(stringVibration.current, 0, 14, dt)
    const vibZ = Math.sin(state.clock.elapsedTime * 125) * 0.004 * stringVibration.current

    // String nock position (moves back along +Z towards archer when drawn)
    const currentNockZ = 0.096 + pullDistance + vibZ

    // Update dynamic bowstring buffer
    const posAttr = stringGeo.getAttribute('position') as THREE.BufferAttribute
    const posArr = posAttr.array as Float32Array

    // Upper Tip
    posArr[0] = 0.0
    posArr[1] = 0.242
    posArr[2] = 0.096 - tension * 0.012

    // Nock Center on String
    posArr[3] = 0.0
    posArr[4] = 0.0
    posArr[5] = currentNockZ

    // Lower Tip
    posArr[6] = 0.0
    posArr[7] = -0.242
    posArr[8] = 0.096 - tension * 0.012

    posAttr.needsUpdate = true
    stringGeo.computeBoundingSphere()

    // 7. Arrow Position & Sliding Animation
    if (arrowGroupRef.current) {
      if (isReloading.current && reloadProgress < 0.55) {
        arrowGroupRef.current.visible = false
      } else {
        arrowGroupRef.current.visible = true

        let arrowZ = currentNockZ
        let arrowY = 0.0
        let arrowX = 0.005

        if (isReloading.current) {
          const tSlide = (reloadProgress - 0.55) / 0.45
          const easeSlide = THREE.MathUtils.smoothstep(tSlide, 0, 1)
          arrowY -= (1 - easeSlide) * 0.06
          arrowX += (1 - easeSlide) * 0.04
          arrowZ += (1 - easeSlide) * 0.12
        }

        arrowGroupRef.current.position.set(arrowX, arrowY, arrowZ)
      }
    }
  })

  return (
    <group
      ref={bowRootRef}
      renderOrder={999}
      onBeforeRender={(renderer) => {
        renderer.clearDepth()
      }}
    >
      <group ref={rigGroupRef}>
        {/* Authentic 3D Handcrafted Wooden Recurve Bow Model */}
        {bowNodes.Bow_Wooden_1 && (
          <group rotation={[0, -Math.PI * 0.5, 0]} scale={0.095}>
            <group rotation={[-Math.PI / 2, 0, 0]} scale={100}>
              {/* 1. Sculpted Mountain Yew Recurve Limbs & Fadeouts */}
              <mesh
                geometry={bowNodes.Bow_Wooden_1.geometry}
                material={materials.woodMat}
                castShadow
              />

              {/* 2. Weathered Leather Handle Grip & Arrow Shelf Rest */}
              <mesh
                geometry={bowNodes.Bow_Wooden_2.geometry}
                material={materials.leatherMat}
              />
            </group>
          </group>
        )}

        {/* Dynamic Continuous Braided Bowstring Line */}
        <primitive object={stringLine} />

        {/* Authentic 3D Cedar Hunting Arrow */}
        <group ref={arrowGroupRef}>
          {arrowNodes.Arrow_1 && (
            <group rotation={[Math.PI * 0.5, 0, 0]} scale={20.0}>
              {/* 1. Shield-Cut Turkey Feathers */}
              <mesh
                geometry={arrowNodes.Arrow_1.geometry}
                material={materials.fletchMat}
              />

              {/* 2. Straight-Grained Cedar Arrow Shaft */}
              <mesh
                geometry={arrowNodes.Arrow_2.geometry}
                material={materials.arrowShaftMat}
                castShadow
              />

              {/* 3. Forged Carbon Steel Broadhead Razor Point */}
              <mesh
                geometry={arrowNodes.Arrow_3.geometry}
                material={materials.broadheadMat}
              />

              {/* 4. Steel Ferrule Collar & Horn Nock */}
              <mesh
                geometry={arrowNodes.Arrow_4.geometry}
                material={materials.ferruleMat}
              />
            </group>
          )}
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/assets/models/Bow_Wooden.glb')
useGLTF.preload('/assets/models/Arrow.glb')
