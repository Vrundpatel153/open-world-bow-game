// ─────────────────────────────────────────────────────────────────────────────
// BowViewModel — AAA First-Person Hunting Recurve Bow & Arrow Viewmodel
// Features:
// - Direct camera matrix tracking: 100% immune to R3F reconciliation detachments
// - Scaled hunting recurve dimensions (ergonomic 0.55m viewmodel height)
// - Hand-stitched leather grip & brass limb pockets with sculpted arrow shelf
// - Curving laminated recurve limbs with bone tip nocks & dynamic draw flexing
// - Braided bowstring with dynamic V-nock tension pull mathematically clamped
//   to the arrow nock on EVERY single frame (zero detachment, zero clipping)
// - Pivot centered directly on the arrow shaft axis so outward canting tilts
//   the limbs away from the crosshair without deflecting the arrow sightline
// - Smooth ADS aiming interpolation (Right Click / Draw LMB) aligning arrow
//   shaft directly on the eye sightline pointing straight into the crosshair
// - Natural weapon inertia / mouse lag, rhythmic walk bob, breathing sway
// - Natural hip carry stance (bottom-right viewport, 75% screen 100% clear)
// - Equip / Stow toggle system via [1] key with smooth raise/holster animations
// - Drawing tension muscle tremor & explosive release recoil kick
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useQuestStore } from '../stores/questStore'
import { sound } from '../audio/SoundSynthesizer'
import { inputManager } from '@/systems/KeyboardInput'

interface BowViewModelProps {
  onFireArrow: (origin: THREE.Vector3, direction: THREE.Vector3, power: number) => void
}

// Arrow shelf & rest local offsets so (0, 0, 0) is the arrow shaft axis
const RISER_OFFSET_X = 0.015
const RISER_OFFSET_Y = -0.034
const STRING_REST_Z = 0.11 // Strung brace height behind riser

export default function BowViewModel({ onFireArrow }: BowViewModelProps) {
  const { camera } = useThree()
  const bowRootRef = useRef<THREE.Group>(null!)
  const arrowGroupRef = useRef<THREE.Group>(null!)
  const upperLimbRef = useRef<THREE.Group>(null!)
  const lowerLimbRef = useRef<THREE.Group>(null!)

  // Animation & physical states
  const drawTension = useRef(0)
  const isDrawing = useRef(false)
  const isReloading = useRef(false)
  const reloadTimer = useRef(0)
  const recoilOffset = useRef(0)
  const recoilRotation = useRef(0)
  const walkBobTimer = useRef(0)
  const breathTimer = useRef(0)
  const stringVibration = useRef(0)
  const aimProgress = useRef(0.0) // 0.0 = hip stance, 1.0 = ADS sightline
  const equipProgress = useRef(1.0) // 1.0 = fully equipped, 0.0 = fully stowed

  const setDrawProgress = useQuestStore((s) => s.setDrawProgress)
  const setAiming = useQuestStore((s) => s.setAiming)
  const isBowEquipped = useQuestStore((s) => s.isBowEquipped)
  const toggleBowEquipped = useQuestStore((s) => s.toggleBowEquipped)

  // ── Procedural Geometries: Realistic Hunting Recurve Bow ───────────────────
  const {
    riserGeo,
    gripWrapGeo,
    upperLimbGeo,
    lowerLimbGeo,
    limbPocketGeo,
    tipNockGeo,
    arrowShaftGeo,
    arrowTipGeo,
    fletchingGeo,
    arrowNockGeo,
    arrowRestGeo,
  } = useMemo(() => {
    // 1. Central Ergonomic Riser Handle (Height ~0.26m)
    const riserShape = new THREE.Shape()
    riserShape.moveTo(-0.014, -0.13)
    riserShape.lineTo(0.013, -0.11)
    riserShape.lineTo(0.015, -0.03)
    // Ergonomic arrow shelf cutout on the left
    riserShape.lineTo(-0.015, 0.02)
    riserShape.lineTo(-0.015, 0.052)
    riserShape.lineTo(0.014, 0.11)
    riserShape.lineTo(-0.014, 0.13)
    riserShape.lineTo(-0.020, 0.0)
    riserShape.closePath()

    const extrudeSettings = {
      depth: 0.026,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.004,
      bevelThickness: 0.004,
    }
    const riser = new THREE.ExtrudeGeometry(riserShape, extrudeSettings)
    riser.center()

    // 2. Leather Wrapped Grip Bands
    const gripWrap = new THREE.CylinderGeometry(0.017, 0.018, 0.11, 12)

    // 3. Brass Reinforcement Limb Pockets
    const limbPocket = new THREE.BoxGeometry(0.030, 0.034, 0.032)

    // 4. Upper & Lower Recurve Limbs (Curving S-profile, length ~0.33m each)
    const upperPoints: THREE.Vector3[] = []
    const lowerPoints: THREE.Vector3[] = []

    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      const y = t * 0.33
      // Curves backward (+Z) then recurves forward (-Z) at tips
      const z = -Math.sin(t * Math.PI * 0.8) * 0.07 + Math.pow(t, 2.2) * 0.10
      upperPoints.push(new THREE.Vector3(0, y, z))
      lowerPoints.push(new THREE.Vector3(0, -y, z))
    }

    const upperCurve = new THREE.CatmullRomCurve3(upperPoints)
    const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints)

    const upperLimb = new THREE.TubeGeometry(upperCurve, 20, 0.012, 8, false)
    const lowerLimb = new THREE.TubeGeometry(lowerCurve, 20, 0.012, 8, false)

    // 5. Carved Horn Tip Nocks
    const tipNock = new THREE.ConeGeometry(0.009, 0.034, 8)

    // 6. Arrow Rest Pad on Riser Shelf
    const arrowRest = new THREE.BoxGeometry(0.012, 0.005, 0.026)

    // 7. Hunting Arrow Components (Length 0.74m)
    // Shaft: fine carbon cedar cylinder
    const shaft = new THREE.CylinderGeometry(0.0040, 0.0040, 0.74, 8)
    shaft.rotateX(Math.PI / 2) // Orient along Z axis

    // Broadhead Arrowhead (razor triangular hunting blade)
    const tipShape = new THREE.Shape()
    tipShape.moveTo(0, 0.036)
    tipShape.lineTo(0.013, -0.015)
    tipShape.lineTo(0.004, -0.009)
    tipShape.lineTo(0, -0.014)
    tipShape.lineTo(-0.004, -0.009)
    tipShape.lineTo(-0.013, -0.015)
    tipShape.closePath()

    const tipExtrude = new THREE.ExtrudeGeometry(tipShape, {
      depth: 0.0022,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0014,
      bevelThickness: 0.0014,
    })
    tipExtrude.center()
    tipExtrude.rotateX(-Math.PI / 2) // Point along -Z

    // Feathers: aerodynamic turkey feather vane
    const fletchShape = new THREE.Shape()
    fletchShape.moveTo(0, 0)
    fletchShape.lineTo(0.014, 0.015)
    fletchShape.lineTo(0.011, 0.085)
    fletchShape.lineTo(0, 0.075)
    fletchShape.closePath()
    const fletching = new THREE.ShapeGeometry(fletchShape)
    fletching.rotateX(Math.PI / 2)

    // Carved Bone Nock
    const nock = new THREE.CylinderGeometry(0.0045, 0.0045, 0.018, 8)
    nock.rotateX(Math.PI / 2)

    return {
      riserGeo: riser,
      gripWrapGeo: gripWrap,
      upperLimbGeo: upperLimb,
      lowerLimbGeo: lowerLimb,
      limbPocketGeo: limbPocket,
      tipNockGeo: tipNock,
      arrowShaftGeo: shaft,
      arrowTipGeo: tipExtrude,
      fletchingGeo: fletching,
      arrowNockGeo: nock,
      arrowRestGeo: arrowRest,
    }
  }, [])

  // ── Materials ──────────────────────────────────────────────────────────────
  const {
    woodMat,
    leatherMat,
    brassMat,
    hornMat,
    stringMat,
    arrowShaftMat,
    broadheadMat,
    fletchGreenMat,
    fletchWhiteMat,
    nockMat,
  } = useMemo(() => {
    const wood = new THREE.MeshStandardMaterial({
      color: '#3d2516',
      roughness: 0.35,
      metalness: 0.06,
    })

    const leather = new THREE.MeshStandardMaterial({
      color: '#21150c',
      roughness: 0.82,
      metalness: 0.04,
    })

    const brass = new THREE.MeshStandardMaterial({
      color: '#d4af37',
      roughness: 0.35,
      metalness: 0.85,
    })

    const horn = new THREE.MeshStandardMaterial({
      color: '#dfd7c8',
      roughness: 0.45,
      metalness: 0.1,
    })

    const string = new THREE.LineBasicMaterial({
      color: '#f0ede6',
      linewidth: 2,
    })

    const arrowShaft = new THREE.MeshStandardMaterial({
      color: '#5c381e',
      roughness: 0.4,
      metalness: 0.05,
    })

    const broadhead = new THREE.MeshStandardMaterial({
      color: '#2b3035',
      roughness: 0.22,
      metalness: 0.92,
    })

    const fletchGreen = new THREE.MeshStandardMaterial({
      color: '#2e7d32',
      roughness: 0.55,
      side: THREE.DoubleSide,
    })

    const fletchWhite = new THREE.MeshStandardMaterial({
      color: '#f5f5f0',
      roughness: 0.55,
      side: THREE.DoubleSide,
    })

    const nock = new THREE.MeshStandardMaterial({
      color: '#e8e0d5',
      roughness: 0.3,
    })

    return {
      woodMat: wood,
      leatherMat: leather,
      brassMat: brass,
      hornMat: horn,
      stringMat: string,
      arrowShaftMat: arrowShaft,
      broadheadMat: broadhead,
      fletchGreenMat: fletchGreen,
      fletchWhiteMat: fletchWhite,
      nockMat: nock,
    }
  }, [])

  // Dynamic Bowstring Line Geometry (Upper Tip -> Arrow Nock -> Lower Tip)
  const stringGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    // Initial relaxed strung points with realistic brace height
    const positions = new Float32Array([
      RISER_OFFSET_X, 0.096 + 0.33, 0.04, // Upper tip
      0, 0, STRING_REST_Z,                 // Center nock point (on arrow nock at (0,0)!)
      RISER_OFFSET_X, -0.164 - 0.33, 0.04, // Lower tip
    ])
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  const stringLine = useMemo(() => new THREE.Line(stringGeo, stringMat), [stringGeo, stringMat])

  // ── Input Listeners & Keybinds ─────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return

      if (e.code === 'Digit1' || e.key === '1') {
        toggleBowEquipped()
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('button, [class*="leva"], a, input')) return

      if (!useQuestStore.getState().isBowEquipped) return

      if (e.button === 0 && inputManager.isLocked && !isReloading.current) {
        isDrawing.current = true
      }
      if (e.button === 2) {
        setAiming(true)
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0 && isDrawing.current && useQuestStore.getState().isBowEquipped) {
        const power = Math.max(0.3, drawTension.current)
        sound.playBowRelease(power)

        // Calculate precision ballistic fire vector:
        // From bow's arrow rest in world space, toward the crosshair raycast aim point
        const camPos = camera.getWorldPosition(new THREE.Vector3())
        const camDir = camera.getWorldDirection(new THREE.Vector3())
        const aimTarget = camPos.clone().addScaledVector(camDir, 80.0)

        const shelfWorldPos = new THREE.Vector3()
        if (arrowGroupRef.current) {
          arrowGroupRef.current.getWorldPosition(shelfWorldPos)
        } else {
          shelfWorldPos.copy(camPos)
        }

        const fireDir = aimTarget.clone().sub(shelfWorldPos).normalize()

        // Advance spawn origin along fire vector by 0.70m so the entire 0.74m projectile
        // is placed cleanly ahead of the bow and camera near plane
        const spawnOrigin = shelfWorldPos.clone().addScaledVector(fireDir, 0.70)

        onFireArrow(spawnOrigin, fireDir, power)

        recoilOffset.current = 0.05 * power
        recoilRotation.current = -0.09 * power
        stringVibration.current = 1.0

        isDrawing.current = false
        drawTension.current = 0
        setDrawProgress(0)

        isReloading.current = true
        reloadTimer.current = 0.25
      }

      if (e.button === 2) {
        setAiming(false)
      }
    }

    const preventContext = (e: MouseEvent) => e.preventDefault()

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('contextmenu', preventContext)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('contextmenu', preventContext)
    }
  }, [camera, onFireArrow, setDrawProgress, setAiming, toggleBowEquipped])

  // ── Per-Frame Animation & Viewmodel Camera Rig ──────────────────────────────
  useFrame((state, delta) => {
    if (!bowRootRef.current) return
    const dt = Math.min(delta, 0.05)

    // ── 0. Equip / Unequip Animation Lerp ────────────────────────────────────
    const targetEquip = isBowEquipped ? 1.0 : 0.0
    equipProgress.current = THREE.MathUtils.damp(equipProgress.current, targetEquip, 8, dt)

    if (equipProgress.current < 0.02 && !isBowEquipped) {
      bowRootRef.current.visible = false
      return
    }
    bowRootRef.current.visible = true

    if (!isBowEquipped && isDrawing.current) {
      isDrawing.current = false
      drawTension.current = 0
      setDrawProgress(0)
    }

    // ── 1. Reload Cycle ─────────────────────────────────────────────────────
    if (isReloading.current) {
      reloadTimer.current -= dt
      if (reloadTimer.current <= 0) {
        isReloading.current = false
      }
    }

    // ── 2. Draw Tension Animation ───────────────────────────────────────────
    if (isDrawing.current && isBowEquipped) {
      const prev = drawTension.current
      drawTension.current = Math.min(1.0, drawTension.current + dt * 2.2)
      setDrawProgress(drawTension.current)

      if (drawTension.current > prev + 0.18) {
        sound.playBowDraw(drawTension.current)
      }
    } else {
      drawTension.current = THREE.MathUtils.damp(drawTension.current, 0, 16, dt)
    }

    // Muscle shake tremor at full draw (>85% tension)
    let shakeX = 0
    let shakeY = 0
    if (drawTension.current > 0.85) {
      const tremor = (drawTension.current - 0.85) * 0.005
      shakeX = (Math.random() - 0.5) * tremor
      shakeY = (Math.random() - 0.5) * tremor
    }

    // ── 3. Dynamic Bowstring & Limbs Flex ────────────────────────────────────
    const pullBackZ = 0.28 * drawTension.current

    stringVibration.current = THREE.MathUtils.damp(stringVibration.current, 0, 14, dt)
    const vib = Math.sin(state.clock.elapsedTime * 95) * 0.01 * stringVibration.current

    // Dynamic limb tips flex backward under draw tension
    const limbBend = drawTension.current * 0.06
    if (upperLimbRef.current && lowerLimbRef.current) {
      upperLimbRef.current.rotation.x = -limbBend
      lowerLimbRef.current.rotation.x = limbBend
    }

    // Update string vertices
    const tipZ = 0.04 - drawTension.current * 0.025
    const stringPos = stringGeo.attributes.position as THREE.BufferAttribute
    stringPos.setXYZ(0, RISER_OFFSET_X, 0.426, tipZ)
    stringPos.setXYZ(1, 0, 0, STRING_REST_Z + pullBackZ + vib)
    stringPos.setXYZ(2, RISER_OFFSET_X, -0.494, tipZ)
    stringPos.needsUpdate = true

    // Arrow moves backward along shelf with the string
    if (arrowGroupRef.current) {
      arrowGroupRef.current.visible = !isReloading.current
      arrowGroupRef.current.position.set(0, 0, pullBackZ)
    }

    // ── 4. Natural Movement Bob & Breathing Sway ─────────────────────────────
    const isMoving =
      inputManager.isMovingForward() ||
      inputManager.isMovingBackward() ||
      inputManager.isMovingLeft() ||
      inputManager.isMovingRight()
    const isSprinting = isMoving && inputManager.isSprinting()

    if (isMoving) {
      walkBobTimer.current += dt * (isSprinting ? 14 : 9)
    } else {
      walkBobTimer.current += dt * 1.5
    }
    breathTimer.current += dt * 1.8

    const bobX = Math.cos(walkBobTimer.current * 0.5) * (isMoving ? 0.010 : 0.002)
    const bobY = Math.sin(walkBobTimer.current) * (isMoving ? 0.015 : 0.003)
    const swayX = Math.cos(breathTimer.current * 0.5) * 0.002
    const swayY = Math.sin(breathTimer.current) * 0.002

    // ── 5. Recoil Recovery ───────────────────────────────────────────────────
    recoilOffset.current = THREE.MathUtils.damp(recoilOffset.current, 0, 14, dt)
    recoilRotation.current = THREE.MathUtils.damp(recoilRotation.current, 0, 12, dt)

    // ── 6. First-Person Camera Tracking with Smooth ADS Interpolation ────────
    const isAimTarget = (isDrawing.current || useQuestStore.getState().isAiming) && isBowEquipped
    aimProgress.current = THREE.MathUtils.damp(aimProgress.current, isAimTarget ? 1.0 : 0.0, 14, dt)
    const aimT = aimProgress.current

    // Hip stance: natural lower-right position, screen center 100% clear
    // ADS stance: arrow (0, 0) aligned right on the eye sightline, bow canted ~20 deg outward
    const hipX = 0.22
    const hipY = -0.18
    const hipZ = -0.34
    const hipCantZ = 0.28  // ~16 deg outward wrist cant in hip stance
    const hipTiltX = -0.06
    const hipYawY = 0.16   // aligns arrow neatly along right screen boundary in hip stance

    const adsX = 0.0       // arrow shaft is exactly at eye sightline center (X = 0)
    const adsY = -0.045    // arrow shaft sits 4.5cm below eye level
    const adsZ = -0.28
    const adsCantZ = 0.35  // ~20 deg outward cant tilts upper limb away from center & compass!
    const adsTiltX = 0.0   // dead flat ballistic trajectory into reticle
    const adsYawY = 0.0    // 100% parallel with camera sightline into crosshair

    const targetLocalX = THREE.MathUtils.lerp(hipX, adsX, aimT)
    let targetLocalY = THREE.MathUtils.lerp(hipY, adsY, aimT)
    const targetLocalZ = THREE.MathUtils.lerp(hipZ, adsZ, aimT)

    // If unequipped, drop bow down below screen
    const stowDropY = (1.0 - equipProgress.current) * -0.60
    targetLocalY += stowDropY

    const targetCantZ =
      THREE.MathUtils.lerp(hipCantZ, adsCantZ, aimT) + (1.0 - equipProgress.current) * 0.4
    const targetTiltX = THREE.MathUtils.lerp(hipTiltX, adsTiltX, aimT)
    const targetYawY = THREE.MathUtils.lerp(hipYawY, adsYawY, aimT)

    // Construct world position from camera orientation
    const cam = state.camera
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)

    const finalPos = cam.position
      .clone()
      .addScaledVector(right, targetLocalX + bobX + swayX + shakeX)
      .addScaledVector(up, targetLocalY + bobY + swayY + shakeY)
      .addScaledVector(forward, -targetLocalZ - recoilOffset.current)

    bowRootRef.current.position.copy(finalPos)

    // Match camera rotation, then apply local weapon cant, tilt & recoil impulse
    bowRootRef.current.quaternion.copy(cam.quaternion)
    bowRootRef.current.rotateZ(targetCantZ)
    bowRootRef.current.rotateX(targetTiltX + recoilRotation.current)
    bowRootRef.current.rotateY(targetYawY)
  })

  return (
    <group ref={bowRootRef} scale={0.58} renderOrder={100}>
      {/* ── 1. Sculpted Wood Riser Handle (offset so arrow shelf is at (0,0)) ─ */}
      <mesh
        geometry={riserGeo}
        material={woodMat}
        position={[RISER_OFFSET_X, RISER_OFFSET_Y, 0]}
        castShadow={false}
      />

      {/* Hand-Stitched Leather Wrap */}
      <mesh
        geometry={gripWrapGeo}
        material={leatherMat}
        position={[RISER_OFFSET_X, RISER_OFFSET_Y - 0.01, 0.005]}
      />

      {/* Brass Limb Connection Pockets */}
      <mesh
        geometry={limbPocketGeo}
        material={brassMat}
        position={[RISER_OFFSET_X, RISER_OFFSET_Y + 0.13, 0.005]}
      />
      <mesh
        geometry={limbPocketGeo}
        material={brassMat}
        position={[RISER_OFFSET_X, RISER_OFFSET_Y - 0.13, 0.005]}
      />

      {/* Arrow Rest Shelf Pad (Leather cushion centered at (0, 0)) */}
      <mesh geometry={arrowRestGeo} material={leatherMat} position={[0, 0, -0.008]} />

      {/* ── 2. Upper Recurve Limb ─────────────────────────────────────────── */}
      <group ref={upperLimbRef} position={[RISER_OFFSET_X, RISER_OFFSET_Y + 0.13, 0]}>
        <mesh geometry={upperLimbGeo} material={woodMat} />
        {/* Carved Horn Tip Nock */}
        <mesh
          geometry={tipNockGeo}
          material={hornMat}
          position={[0, 0.33, 0.04]}
          rotation={[Math.PI, 0, 0]}
        />
      </group>

      {/* ── 3. Lower Recurve Limb ─────────────────────────────────────────── */}
      <group ref={lowerLimbRef} position={[RISER_OFFSET_X, RISER_OFFSET_Y - 0.13, 0]}>
        <mesh geometry={lowerLimbGeo} material={woodMat} />
        {/* Carved Horn Tip Nock */}
        <mesh geometry={tipNockGeo} material={hornMat} position={[0, -0.33, 0.04]} />
      </group>

      {/* ── 4. Dynamic Bowstring ─────────────────────────────────────────── */}
      <primitive object={stringLine} />

      {/* ── 5. Nocked Hunting Arrow (Centered on (0, 0)) ─────────────────── */}
      {/* Positioned at [0, 0, pullBackZ] */}
      <group ref={arrowGroupRef} position={[0, 0, 0]}>
        {/* Carbon Cedar Arrow Shaft (Length 0.74m, extending from z=0.11 to z=-0.63) */}
        <mesh geometry={arrowShaftGeo} material={arrowShaftMat} position={[0, 0, -0.26]} />

        {/* Damascus Forged Steel Broadhead Blade */}
        <mesh geometry={arrowTipGeo} material={broadheadMat} position={[0, 0, -0.63]} />

        {/* Sinew Thread Binding */}
        <mesh position={[0, 0, -0.60]}>
          <cylinderGeometry args={[0.0052, 0.0052, 0.02, 8]} />
          <meshStandardMaterial color="#1f1812" roughness={0.9} />
        </mesh>

        {/* Carved Bone Nock (Clamped to bowstring at z = STRING_REST_Z = 0.11) */}
        <mesh geometry={arrowNockGeo} material={nockMat} position={[0, 0, STRING_REST_Z]} />

        {/* 3 Helical Turkey Feather Vanes (120 deg apart) */}
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
          <group key={i} position={[0, 0, 0.05]} rotation={[0, 0, angle]}>
            <mesh
              geometry={fletchingGeo}
              material={i === 0 ? fletchWhiteMat : fletchGreenMat}
              position={[0, 0.005, 0]}
            />
          </group>
        ))}
      </group>
    </group>
  )
}
