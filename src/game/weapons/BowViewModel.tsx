// ─────────────────────────────────────────────────────────────────────────────
// BowViewModel — AAA First-Person Hunting Recurve Bow & Arrow Viewmodel
// Features:
// - Authentic Archery Sight Alignment: arrow shaft points directly down the
//   crosshair sightline; riser sits safely to the right with 0 reticle obstruction.
// - Physical 2nd-Order Spring Inertia & Mouse Sway (natural weapon drag & recovery)
// - Dynamic Flemish Bowstring & Limb Flexing: string apex & arrow nock 100% clamped.
// - Organic Draw-Hold-Release-Reload Cycle with reload arrow nocking slide animation.
// - Dual Viewmodel Fill Light Rig: ensures wood, brass & feathers are NEVER black silhouettes.
// - Natural Hip Carry Stance in lower-right viewport (85% of screen 100% clear).
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

// Arrow shelf & rest offsets so (0, 0) is the arrow shaft axis
const RISER_OFFSET_X = 0.038
const RISER_OFFSET_Y = -0.015
const STRING_REST_Z = 0.08 // Strung brace height behind riser

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

  // Mouse sway spring-damper physics
  const swayX = useRef(0)
  const swayY = useRef(0)
  const swayVelX = useRef(0)
  const swayVelY = useRef(0)

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
    riserShape.moveTo(-0.016, -0.13)
    riserShape.lineTo(0.015, -0.11)
    riserShape.lineTo(0.018, -0.03)
    // Ergonomic arrow shelf cutout on the left
    riserShape.lineTo(-0.024, 0.01)
    riserShape.lineTo(-0.024, 0.055)
    riserShape.lineTo(0.016, 0.11)
    riserShape.lineTo(-0.016, 0.13)
    riserShape.lineTo(-0.020, 0.0)
    riserShape.closePath()

    const extrudeSettings = {
      depth: 0.028,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.005,
      bevelThickness: 0.005,
    }
    const riser = new THREE.ExtrudeGeometry(riserShape, extrudeSettings)
    riser.center()

    // 2. Leather Wrapped Grip Bands
    const gripWrap = new THREE.CylinderGeometry(0.019, 0.020, 0.11, 12)

    // 3. Brass Reinforcement Limb Pockets
    const limbPocket = new THREE.BoxGeometry(0.032, 0.036, 0.034)

    // 4. Upper & Lower Recurve Limbs (Curving S-profile, length ~0.33m each)
    const upperPoints: THREE.Vector3[] = []
    const lowerPoints: THREE.Vector3[] = []

    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      const y = t * 0.33
      // Curves backward (+Z) then recurves forward (-Z) at tips
      const z = -Math.sin(t * Math.PI * 0.8) * 0.07 + Math.pow(t, 2.2) * 0.09
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
    const arrowRest = new THREE.BoxGeometry(0.014, 0.006, 0.028)

    // 7. Hunting Arrow Components (Length 0.74m)
    // Shaft: fine carbon cedar cylinder
    const shaft = new THREE.CylinderGeometry(0.0040, 0.0040, 0.68, 8)
    shaft.rotateX(Math.PI / 2) // Orient along Z axis

    // Broadhead Arrowhead (razor triangular hunting blade)
    const tipShape = new THREE.Shape()
    tipShape.moveTo(0, 0.038)
    tipShape.lineTo(0.014, -0.016)
    tipShape.lineTo(0.005, -0.010)
    tipShape.lineTo(0, -0.015)
    tipShape.lineTo(-0.005, -0.010)
    tipShape.lineTo(-0.014, -0.016)
    tipShape.closePath()

    const tipExtrude = new THREE.ExtrudeGeometry(tipShape, {
      depth: 0.0024,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0015,
      bevelThickness: 0.0015,
    })
    tipExtrude.center()
    tipExtrude.rotateX(-Math.PI / 2) // Point along -Z

    // Feathers: aerodynamic turkey feather vane
    const fletchShape = new THREE.Shape()
    fletchShape.moveTo(0, 0)
    fletchShape.lineTo(0.015, 0.016)
    fletchShape.lineTo(0.012, 0.088)
    fletchShape.lineTo(0, 0.078)
    fletchShape.closePath()
    const fletching = new THREE.ShapeGeometry(fletchShape)
    fletching.rotateX(Math.PI / 2)

    // Carved Bone Nock
    const nock = new THREE.CylinderGeometry(0.0048, 0.0048, 0.020, 8)
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

  // ── Materials with rich PBR warmth ─────────────────────────────────────────
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
      color: '#6b3f20', // Warm aged walnut
      roughness: 0.38,
      metalness: 0.05,
    })

    const leather = new THREE.MeshStandardMaterial({
      color: '#382214', // Dark stitched leather
      roughness: 0.78,
      metalness: 0.04,
    })

    const brass = new THREE.MeshStandardMaterial({
      color: '#e5c158', // Antique polished brass
      roughness: 0.28,
      metalness: 0.88,
    })

    const horn = new THREE.MeshStandardMaterial({
      color: '#e8decb',
      roughness: 0.42,
      metalness: 0.08,
    })

    const string = new THREE.LineBasicMaterial({
      color: '#ffffff',
      linewidth: 2,
    })

    const arrowShaft = new THREE.MeshStandardMaterial({
      color: '#734725',
      roughness: 0.42,
      metalness: 0.05,
    })

    const broadhead = new THREE.MeshStandardMaterial({
      color: '#343a40',
      roughness: 0.2,
      metalness: 0.95,
    })

    const fletchGreen = new THREE.MeshStandardMaterial({
      color: '#2e7d32',
      roughness: 0.5,
      side: THREE.DoubleSide,
    })

    const fletchWhite = new THREE.MeshStandardMaterial({
      color: '#f8f8f2',
      roughness: 0.5,
      side: THREE.DoubleSide,
    })

    const nock = new THREE.MeshStandardMaterial({
      color: '#f0e8dc',
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
    const positions = new Float32Array([
      RISER_OFFSET_X, RISER_OFFSET_Y + 0.13 + 0.33, 0.02, // Upper tip
      0, 0, STRING_REST_Z,                                  // Center nock point (on arrow nock at (0,0)!)
      RISER_OFFSET_X, RISER_OFFSET_Y - 0.13 - 0.33, 0.02, // Lower tip
    ])
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  const stringLine = useMemo(() => new THREE.Line(stringGeo, stringMat), [stringGeo, stringMat])

  // ── Input Listeners & Keybinds ─────────────────────────────────────────────
  useEffect(() => {
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
        const power = Math.max(0.32, drawTension.current)
        sound.playBowRelease(power)

        // Calculate precision ballistic fire vector:
        // From arrowhead tip in world space directly through crosshair sightline
        const camPos = camera.getWorldPosition(new THREE.Vector3())
        const camDir = camera.getWorldDirection(new THREE.Vector3())
        const aimTarget = camPos.clone().addScaledVector(camDir, 90.0)

        const arrowTipWorldPos = new THREE.Vector3()
        if (arrowGroupRef.current) {
          // Arrow tip is at local z = -0.66
          arrowGroupRef.current.localToWorld(arrowTipWorldPos.set(0, 0, -0.66))
        } else {
          arrowTipWorldPos.copy(camPos).addScaledVector(camDir, 0.4)
        }

        const fireDir = aimTarget.clone().sub(arrowTipWorldPos).normalize()
        onFireArrow(arrowTipWorldPos, fireDir, power)

        // Physical Recoil Kick
        recoilOffset.current = 0.065 * power
        recoilRotation.current = -0.12 * power
        stringVibration.current = 1.0

        isDrawing.current = false
        drawTension.current = 0
        setDrawProgress(0)

        // Reload Cycle (draw new arrow from quiver)
        isReloading.current = true
        reloadTimer.current = 0.42
      }

      if (e.button === 2) {
        setAiming(false)
      }
    }

    const preventContext = (e: MouseEvent) => e.preventDefault()

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('contextmenu', preventContext)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('contextmenu', preventContext)
    }
  }, [camera, onFireArrow, setDrawProgress, setAiming, toggleBowEquipped])

  // ── Per-Frame Animation & Viewmodel Physics Rig ─────────────────────────────
  useFrame((state, delta) => {
    if (!bowRootRef.current) return
    const dt = Math.min(delta, 0.05)

    // ── 0. Equip / Unequip Animation ────────────────────────────────────────
    const targetEquip = isBowEquipped ? 1.0 : 0.0
    equipProgress.current = THREE.MathUtils.damp(equipProgress.current, targetEquip, 10, dt)

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

    // ── 1. Reload Animation & Arrow Nocking ──────────────────────────────────
    let arrowReloadProgress = 1.0
    if (isReloading.current) {
      reloadTimer.current -= dt
      if (reloadTimer.current <= 0) {
        isReloading.current = false
        sound.playArrowNock()
        arrowReloadProgress = 1.0
      } else {
        arrowReloadProgress = 1.0 - reloadTimer.current / 0.42
      }
    }

    // ── 2. Draw Tension Physics ─────────────────────────────────────────────
    if (isDrawing.current && isBowEquipped) {
      const prev = drawTension.current
      drawTension.current = Math.min(1.0, drawTension.current + dt * 2.1)
      setDrawProgress(drawTension.current)

      if (drawTension.current > prev + 0.18) {
        sound.playBowDraw(drawTension.current)
      }
    } else {
      drawTension.current = THREE.MathUtils.damp(drawTension.current, 0, 16, dt)
    }

    // Muscle tremor vibration at full tension (>85%)
    let shakeX = 0
    let shakeY = 0
    if (drawTension.current > 0.85) {
      const tremor = (drawTension.current - 0.85) * 0.006
      shakeX = (Math.random() - 0.5) * tremor
      shakeY = (Math.random() - 0.5) * tremor
    }

    // ── 3. Dynamic Limb Flexing & Bowstring V-Notch Pull ─────────────────────
    const pullBackZ = 0.28 * drawTension.current

    stringVibration.current = THREE.MathUtils.damp(stringVibration.current, 0, 14, dt)
    const vib = Math.sin(state.clock.elapsedTime * 95) * 0.01 * stringVibration.current

    // Limbs flex backward (+Z) under immense spring tension
    const limbBend = drawTension.current * 0.11
    if (upperLimbRef.current && lowerLimbRef.current) {
      upperLimbRef.current.rotation.x = limbBend
      lowerLimbRef.current.rotation.x = -limbBend
    }

    // Update string vertices
    const tipZ = 0.02 + drawTension.current * 0.04
    const stringPos = stringGeo.attributes.position as THREE.BufferAttribute
    stringPos.setXYZ(0, RISER_OFFSET_X, RISER_OFFSET_Y + 0.46, tipZ)
    stringPos.setXYZ(1, 0, 0, STRING_REST_Z + pullBackZ + vib)
    stringPos.setXYZ(2, RISER_OFFSET_X, RISER_OFFSET_Y - 0.46, tipZ)
    stringPos.needsUpdate = true

    // Arrow positioning and reload slide animation
    if (arrowGroupRef.current) {
      if (isReloading.current && arrowReloadProgress < 0.25) {
        arrowGroupRef.current.visible = false
      } else {
        arrowGroupRef.current.visible = true
        if (isReloading.current) {
          // Arrow slides smoothly from below onto the shelf
          const tSlide = (arrowReloadProgress - 0.25) / 0.75
          const easeSlide = THREE.MathUtils.smoothstep(tSlide, 0, 1)
          arrowGroupRef.current.position.set(
            (1 - easeSlide) * 0.06,
            (1 - easeSlide) * -0.12,
            (1 - easeSlide) * 0.10
          )
        } else {
          arrowGroupRef.current.position.set(0, 0, pullBackZ)
        }
      }
    }

    // ── 4. Mouse Look Inertia & Weapon Sway ──────────────────────────────────
    const mouseDx = inputManager.mouseDeltaX || 0
    const mouseDy = inputManager.mouseDeltaY || 0

    swayVelX.current += -mouseDx * 0.00032
    swayVelY.current += mouseDy * 0.00032

    // 2nd-order critically damped spring
    swayX.current += swayVelX.current * dt
    swayY.current += swayVelY.current * dt
    swayVelX.current = THREE.MathUtils.damp(swayVelX.current, -swayX.current * 28, 22, dt)
    swayVelY.current = THREE.MathUtils.damp(swayVelY.current, -swayY.current * 28, 22, dt)

    // Clamp sway
    swayX.current = Math.max(-0.04, Math.min(0.04, swayX.current))
    swayY.current = Math.max(-0.04, Math.min(0.04, swayY.current))

    // ── 5. Natural Walk Bobbing & Breathing Sway ─────────────────────────────
    const isMoving =
      inputManager.isMovingForward() ||
      inputManager.isMovingBackward() ||
      inputManager.isMovingLeft() ||
      inputManager.isMovingRight()
    const isSprinting = isMoving && inputManager.isSprinting()

    if (isMoving) {
      walkBobTimer.current += dt * (isSprinting ? 14 : 9.2)
    } else {
      walkBobTimer.current += dt * 1.5
    }
    breathTimer.current += dt * 1.8

    const bobX = Math.cos(walkBobTimer.current * 0.5) * (isMoving ? 0.009 : 0.002)
    const bobY = Math.sin(walkBobTimer.current) * (isMoving ? 0.014 : 0.003)
    const bobRoll = Math.cos(walkBobTimer.current * 0.5) * (isMoving ? 0.025 : 0.004)

    const breathX = Math.cos(breathTimer.current * 0.5) * 0.0015
    const breathY = Math.sin(breathTimer.current) * 0.0018

    // ── 6. Recoil Recovery ───────────────────────────────────────────────────
    recoilOffset.current = THREE.MathUtils.damp(recoilOffset.current, 0, 14, dt)
    recoilRotation.current = THREE.MathUtils.damp(recoilRotation.current, 0, 12, dt)

    // ── 7. Stance Interpolation (Hip vs True ADS Aiming) ─────────────────────
    const isAimTarget = (isDrawing.current || useQuestStore.getState().isAiming) && isBowEquipped
    aimProgress.current = THREE.MathUtils.damp(aimProgress.current, isAimTarget ? 1.0 : 0.0, 14, dt)
    const aimT = aimProgress.current

    // Hip Stance: natural lower-right position, 85% of screen 100% clear
    const hipX = 0.24
    const hipY = -0.20
    const hipZ = -0.32
    const hipCantZ = -0.32 // ~18 deg outward wrist cant (tilts limbs to the right away from center)
    const hipTiltX = -0.06 // slight forward pitch
    const hipYawY = -0.02

    // ADS Stance: Arrow shaft points directly down crosshair sightline!
    // The riser sits safely to the right (+X); outward cant (~-7 deg) ensures upper limb never cuts across crosshair!
    const adsX = 0.002     // Arrow shaft is on center eye sightline
    const adsY = -0.046    // Arrow shaft sits 4.6cm below eye level
    const adsZ = -0.22
    const adsCantZ = -0.10 // ~6 deg outward cant keeps sight window completely open
    const adsTiltX = 0.0   // Dead-flat ballistic sightline into crosshair
    const adsYawY = 0.0

    const targetLocalX = THREE.MathUtils.lerp(hipX, adsX, aimT) + swayX.current + bobX + breathX + shakeX
    let targetLocalY = THREE.MathUtils.lerp(hipY, adsY, aimT) + swayY.current + bobY + breathY + shakeY
    const targetLocalZ = THREE.MathUtils.lerp(hipZ, adsZ, aimT)

    // Stow animation drop
    const stowDropY = (1.0 - equipProgress.current) * -0.65
    targetLocalY += stowDropY

    const targetCantZ =
      THREE.MathUtils.lerp(hipCantZ, adsCantZ, aimT) +
      bobRoll +
      swayX.current * 0.4 +
      (1.0 - equipProgress.current) * -0.4
    const targetTiltX = THREE.MathUtils.lerp(hipTiltX, adsTiltX, aimT) + swayY.current * 0.3
    const targetYawY = THREE.MathUtils.lerp(hipYawY, adsYawY, aimT) + swayX.current * 0.4

    // Construct world position from camera orientation
    const cam = state.camera
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)

    const finalPos = cam.position
      .clone()
      .addScaledVector(right, targetLocalX)
      .addScaledVector(up, targetLocalY)
      .addScaledVector(forward, -targetLocalZ - recoilOffset.current)

    bowRootRef.current.position.copy(finalPos)

    // Apply camera rotation + weapon cant, tilt, and recoil
    bowRootRef.current.quaternion.copy(cam.quaternion)
    bowRootRef.current.rotateZ(targetCantZ)
    bowRootRef.current.rotateX(targetTiltX + recoilRotation.current)
    bowRootRef.current.rotateY(targetYawY)
  })

  return (
    <group ref={bowRootRef} scale={0.34} renderOrder={100}>
      {/* ── Dedicated Viewmodel Lighting Rig (Ensures warm PBR shading in all conditions) ── */}
      <pointLight position={[0.25, 0.40, 0.15]} intensity={1.8} color="#fff6e5" distance={3.5} />
      <pointLight position={[-0.30, -0.20, 0.15]} intensity={0.7} color="#cce0ff" distance={3.5} />

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
          position={[0, 0.33, 0.02]}
          rotation={[Math.PI, 0, 0]}
        />
      </group>

      {/* ── 3. Lower Recurve Limb ─────────────────────────────────────────── */}
      <group ref={lowerLimbRef} position={[RISER_OFFSET_X, RISER_OFFSET_Y - 0.13, 0]}>
        <mesh geometry={lowerLimbGeo} material={woodMat} />
        {/* Carved Horn Tip Nock */}
        <mesh geometry={tipNockGeo} material={hornMat} position={[0, -0.33, 0.02]} />
      </group>

      {/* ── 4. Dynamic Bowstring ─────────────────────────────────────────── */}
      <primitive object={stringLine} />

      {/* ── 5. Nocked Hunting Arrow (Centered along (0, 0, z)) ─────────────── */}
      <group ref={arrowGroupRef} position={[0, 0, 0]}>
        {/* Cedar Arrow Shaft (Length 0.68m, centered at z = -0.30) */}
        <mesh geometry={arrowShaftGeo} material={arrowShaftMat} position={[0, 0, -0.30]} />

        {/* Damascus Forged Steel Broadhead Blade (tip at z = -0.66) */}
        <mesh geometry={arrowTipGeo} material={broadheadMat} position={[0, 0, -0.66]} />

        {/* Sinew Thread Binding */}
        <mesh position={[0, 0, -0.63]}>
          <cylinderGeometry args={[0.0055, 0.0055, 0.02, 8]} />
          <meshStandardMaterial color="#1f1812" roughness={0.9} />
        </mesh>

        {/* Carved Bone Nock (clamped to string at z = STRING_REST_Z = 0.08) */}
        <mesh geometry={arrowNockGeo} material={nockMat} position={[0, 0, STRING_REST_Z]} />

        {/* 3 Helical Turkey Feather Vanes (120 deg apart at rear) */}
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
          <group key={i} position={[0, 0, 0.02]} rotation={[0, 0, angle]}>
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
