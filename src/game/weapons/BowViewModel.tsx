// ─────────────────────────────────────────────────────────────────────────────
// BowViewModel — AAA First-Person Hunting Recurve Bow (Target Reference Match)
//
// Strictly engineered to match the reference weapon design:
// 1. Bow Positioning: Stands vertically on the right side of the screen, with
//    its carved wood & brass grip in the lower-right foreground.
// 2. Arrow Positioning: Sits naturally on the inner shelf on the left of the grip,
//    shaft aligned diagonally forward towards the center crosshair.
// 3. Bowstring: Continuous taut string connecting upper tip -> arrow nock -> lower tip,
//    following the limb curvature and flex.
// 4. Crosshair: Clean small center crosshair; arrows launch precisely through it.
// 5. Drawing Animation: Holding LMB pulls string & arrow smoothly backward,
//    flexing the upper and lower recurve limbs under tension.
// 6. Shooting: On release, launches arrow along camera forward sightline.
// 7. Physics: Inherits camera's true world sightline, not local viewmodel tilt.
// 8. No Hands: Zero player hands or arms rendered.
// 9. Consistency: Bow, string, and arrow remain 100% physically clamped in all states.
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
  const equipProgress = useRef(1.0) // 1.0 = equipped, 0.0 = stowed

  // Mouse sway spring-damper physics
  const swayX = useRef(0)
  const swayY = useRef(0)
  const swayVelX = useRef(0)
  const swayVelY = useRef(0)

  const setDrawProgress = useQuestStore((s) => s.setDrawProgress)
  const setAiming = useQuestStore((s) => s.setAiming)
  const isBowEquipped = useQuestStore((s) => s.isBowEquipped)
  const toggleBowEquipped = useQuestStore((s) => s.toggleBowEquipped)

  // ── Procedural Geometries (Reference: Stylized Mahogany & Brass Fantasy Bow) ──
  const {
    riserGeo,
    gripWrapGeo,
    brassCollarGeo,
    diamondCrestGeo,
    upperLimbGeo,
    lowerLimbGeo,
    arrowShaftGeo,
    arrowTipGeo,
    ferruleGeo,
    fletchingGeo,
    nockGeo,
  } = useMemo(() => {
    // 1. Central Carved Mahogany Riser (Height ~0.22m, beveled rectangle)
    const riserShape = new THREE.Shape()
    riserShape.moveTo(-0.016, -0.11)
    riserShape.lineTo(0.016, -0.11)
    riserShape.lineTo(0.018, -0.02)
    // Shelf cutout on the inner left face
    riserShape.lineTo(0.018, 0.04)
    riserShape.lineTo(0.015, 0.11)
    riserShape.lineTo(-0.015, 0.11)
    riserShape.lineTo(-0.018, 0.04)
    riserShape.lineTo(-0.024, 0.02)
    riserShape.lineTo(-0.024, -0.01)
    riserShape.lineTo(-0.018, -0.02)
    riserShape.closePath()

    const riser = new THREE.ExtrudeGeometry(riserShape, {
      depth: 0.032,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.003,
      bevelThickness: 0.003,
    })
    riser.center()

    // 2. Leather Wrapped Grip Handle
    const gripWrap = new THREE.CylinderGeometry(0.019, 0.020, 0.09, 12)

    // 3. Golden Brass Reinforcement Collars (Signature feature in Reference Image)
    const collar = new THREE.BoxGeometry(0.042, 0.034, 0.038)

    // Embossed Diamond Crest (Heraldic ❖ motif on the upper collar)
    const diamondShape = new THREE.Shape()
    diamondShape.moveTo(0, 0.012)
    diamondShape.lineTo(0.010, 0)
    diamondShape.lineTo(0, -0.012)
    diamondShape.lineTo(-0.010, 0)
    diamondShape.closePath()

    const diamondCrest = new THREE.ExtrudeGeometry(diamondShape, {
      depth: 0.003,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.001,
      bevelThickness: 0.001,
    })
    diamondCrest.center()

    // 4. Upper & Lower Recurve Limbs (Beveled sweep, length ~0.44m each)
    const upperPoints: THREE.Vector3[] = []
    const lowerPoints: THREE.Vector3[] = []

    for (let i = 0; i <= 12; i++) {
      const t = i / 12
      const y = t * 0.44
      // Subtle sweep: curves slightly forward (-Z) then arches back (+Z) at tips
      const x = Math.sin(t * Math.PI * 0.6) * 0.03
      const z = -Math.sin(t * Math.PI * 0.75) * 0.05 + Math.pow(t, 2.0) * 0.08
      upperPoints.push(new THREE.Vector3(x, y, z))
      lowerPoints.push(new THREE.Vector3(x, -y, z))
    }

    const upperCurve = new THREE.CatmullRomCurve3(upperPoints)
    const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints)

    const upperLimb = new THREE.TubeGeometry(upperCurve, 20, 0.015, 8, false)
    const lowerLimb = new THREE.TubeGeometry(lowerCurve, 20, 0.015, 8, false)

    // 5. Hunting Arrow Components (Length 0.72m)
    // Cedar wood shaft
    const shaft = new THREE.CylinderGeometry(0.0042, 0.0042, 0.70, 8)
    shaft.rotateX(Math.PI / 2) // Orient along Z axis

    // Silver triangular broadhead blade (matches Reference Image)
    const tipShape = new THREE.Shape()
    tipShape.moveTo(0, 0.042)
    tipShape.lineTo(0.018, -0.018)
    tipShape.lineTo(0.006, -0.012)
    tipShape.lineTo(0, -0.016)
    tipShape.lineTo(-0.006, -0.012)
    tipShape.lineTo(-0.018, -0.018)
    tipShape.closePath()

    const tipExtrude = new THREE.ExtrudeGeometry(tipShape, {
      depth: 0.0028,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0015,
      bevelThickness: 0.0015,
    })
    tipExtrude.center()
    tipExtrude.rotateX(-Math.PI / 2) // Point along -Z

    // Metal ferrule collar connecting broadhead to cedar shaft
    const ferrule = new THREE.CylinderGeometry(0.0055, 0.0048, 0.024, 8)
    ferrule.rotateX(Math.PI / 2)

    // Aerodynamic white turkey feathers (matches Reference Image)
    const fletchShape = new THREE.Shape()
    fletchShape.moveTo(0, 0)
    fletchShape.lineTo(0.016, 0.015)
    fletchShape.lineTo(0.013, 0.095)
    fletchShape.lineTo(0, 0.082)
    fletchShape.closePath()
    const fletching = new THREE.ShapeGeometry(fletchShape)
    fletching.rotateX(Math.PI / 2)

    // Carved bone nock
    const nock = new THREE.CylinderGeometry(0.005, 0.005, 0.022, 8)
    nock.rotateX(Math.PI / 2)

    return {
      riserGeo: riser,
      gripWrapGeo: gripWrap,
      brassCollarGeo: collar,
      diamondCrestGeo: diamondCrest,
      upperLimbGeo: upperLimb,
      lowerLimbGeo: lowerLimb,
      arrowShaftGeo: shaft,
      arrowTipGeo: tipExtrude,
      ferruleGeo: ferrule,
      fletchingGeo: fletching,
      nockGeo: nock,
    }
  }, [])

  // ── Materials (Rich Warm Fantasy PBR from Reference) ───────────────────────
  const {
    woodMat,
    leatherMat,
    brassMat,
    stringMat,
    arrowShaftMat,
    broadheadMat,
    ferruleMat,
    fletchMat,
    nockMat,
  } = useMemo(() => {
    // Rich dark mahogany wood
    const wood = new THREE.MeshStandardMaterial({
      color: '#462714',
      roughness: 0.38,
      metalness: 0.04,
    })

    // Stitched leather grip wrap
    const leather = new THREE.MeshStandardMaterial({
      color: '#28170c',
      roughness: 0.82,
      metalness: 0.02,
    })

    // Polished antique gold / brass collars with embossed diamond crest
    const brass = new THREE.MeshStandardMaterial({
      color: '#e2b542',
      roughness: 0.28,
      metalness: 0.86,
    })

    // White taut bowstring
    const string = new THREE.LineBasicMaterial({
      color: '#f8f8f2',
      linewidth: 2,
    })

    // Warm cedar arrow shaft
    const arrowShaft = new THREE.MeshStandardMaterial({
      color: '#6e4424',
      roughness: 0.42,
      metalness: 0.05,
    })

    // Polished razor silver broadhead blade
    const broadhead = new THREE.MeshStandardMaterial({
      color: '#e4ebf2',
      roughness: 0.22,
      metalness: 0.94,
    })

    // Steel collar ferrule
    const ferrule = new THREE.MeshStandardMaterial({
      color: '#34383c',
      roughness: 0.3,
      metalness: 0.9,
    })

    // Aerodynamic white turkey feathers (matches Reference Image)
    const fletch = new THREE.MeshStandardMaterial({
      color: '#f4f6f8',
      roughness: 0.55,
      side: THREE.DoubleSide,
    })

    const nock = new THREE.MeshStandardMaterial({
      color: '#f2eae0',
      roughness: 0.35,
    })

    return {
      woodMat: wood,
      leatherMat: leather,
      brassMat: brass,
      stringMat: string,
      arrowShaftMat: arrowShaft,
      broadheadMat: broadhead,
      ferruleMat: ferrule,
      fletchMat: fletch,
      nockMat: nock,
    }
  }, [])

  // ── Dynamic Bowstring (Upper Tip -> Arrow Nock -> Lower Tip) ───────────────
  const stringGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(3 * 3) // 3 vertices: Upper, Nock, Lower
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
        const power = Math.max(0.35, drawTension.current)
        sound.playBowRelease(power)

        // ── Physics: Launch precisely through center crosshair ─────────────
        const camPos = camera.getWorldPosition(new THREE.Vector3())
        const camDir = camera.getWorldDirection(new THREE.Vector3())
        const targetPoint = camPos.clone().addScaledVector(camDir, 120.0)

        // Launch origin from current arrow tip in world coordinates
        const arrowTipPos = new THREE.Vector3()
        if (arrowGroupRef.current) {
          arrowGroupRef.current.localToWorld(arrowTipPos.set(0, 0, -0.36))
        } else {
          arrowTipPos.copy(camPos).addScaledVector(camDir, 0.4)
        }

        const fireDir = targetPoint.clone().sub(arrowTipPos).normalize()
        onFireArrow(arrowTipPos, fireDir, power)

        // Recoil kickback
        recoilOffset.current = 0.05 * power
        recoilRotation.current = -0.08 * power
        stringVibration.current = 1.0

        isDrawing.current = false
        drawTension.current = 0
        setDrawProgress(0)

        // Reload Cycle (nock new arrow)
        isReloading.current = true
        reloadTimer.current = 0.38
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

    // 0. Equip / Unequip Animation
    const targetEquip = isBowEquipped ? 1.0 : 0.0
    equipProgress.current = THREE.MathUtils.damp(equipProgress.current, targetEquip, 12, dt)

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

    // 1. Reload Animation
    let reloadProgress = 1.0
    if (isReloading.current) {
      reloadTimer.current -= dt
      if (reloadTimer.current <= 0) {
        isReloading.current = false
        sound.playArrowNock()
        reloadProgress = 1.0
      } else {
        reloadProgress = 1.0 - reloadTimer.current / 0.38
      }
    }

    // 2. Draw Tension Physics
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

    // Tremor vibration at high draw tension
    let shakeX = 0
    let shakeY = 0
    if (drawTension.current > 0.85) {
      const tremor = (drawTension.current - 0.85) * 0.005
      shakeX = (Math.random() - 0.5) * tremor
      shakeY = (Math.random() - 0.5) * tremor
    }

    // 3. Mouse Look Inertia & Weapon Sway
    const mouseDx = inputManager.mouseDeltaX || 0
    const mouseDy = inputManager.mouseDeltaY || 0

    swayVelX.current += -mouseDx * 0.00028
    swayVelY.current += mouseDy * 0.00028

    swayX.current += swayVelX.current * dt
    swayY.current += swayVelY.current * dt
    swayVelX.current = THREE.MathUtils.damp(swayVelX.current, -swayX.current * 28, 22, dt)
    swayVelY.current = THREE.MathUtils.damp(swayVelY.current, -swayY.current * 28, 22, dt)
    swayX.current = Math.max(-0.035, Math.min(0.035, swayX.current))
    swayY.current = Math.max(-0.035, Math.min(0.035, swayY.current))

    // 4. Walk Bobbing & Breathing Sway
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

    const bobX = Math.cos(walkBobTimer.current * 0.5) * (isMoving ? 0.008 : 0.0018)
    const bobY = Math.sin(walkBobTimer.current) * (isMoving ? 0.012 : 0.0025)

    // Recoil recovery
    recoilOffset.current = THREE.MathUtils.damp(recoilOffset.current, 0, 14, dt)
    recoilRotation.current = THREE.MathUtils.damp(recoilRotation.current, 0, 12, dt)

    // ── 5. Stance & Positioning (Strict Match with Reference Image) ──────────
    // In the reference image:
    // - Bow stands vertically in the right 30% of the screen.
    // - The grip is in the lower-right foreground.
    // - The arrow rest is on the inner left of the grip.
    // - Arrow shaft is angled diagonally forward towards the center crosshair.
    const isAiming = (isDrawing.current || useQuestStore.getState().isAiming) && isBowEquipped

    // Camera relative offsets
    const baseLocalX = isAiming ? 0.22 : 0.25
    const baseLocalY = isAiming ? -0.15 : -0.17
    const baseLocalZ = isAiming ? -0.38 : -0.42

    const localX = baseLocalX + swayX.current + bobX + shakeX
    const localY = baseLocalY + swayY.current + bobY + shakeY + (1.0 - equipProgress.current) * -0.6
    const localZ = baseLocalZ - recoilOffset.current

    // Bow orientation: almost vertical with gentle inward turn
    const pitchX = -0.04 + recoilRotation.current + swayY.current * 0.3
    const yawY = -0.14 + swayX.current * 0.4 // gentle inward angle towards target
    const rollZ = 0.06 // almost vertical, slight inward tilt (~3.5 deg)

    // Construct world transform from camera
    const cam = state.camera
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)

    const bowWorldPos = cam.position
      .clone()
      .addScaledVector(right, localX)
      .addScaledVector(up, localY)
      .addScaledVector(fwd, -localZ)

    bowRootRef.current.position.copy(bowWorldPos)
    bowRootRef.current.quaternion.copy(cam.quaternion)
    bowRootRef.current.rotateY(yawY)
    bowRootRef.current.rotateX(pitchX)
    bowRootRef.current.rotateZ(rollZ)

    // ── 6. Dynamic Bow Limb Flexing & Bowstring Clamping ─────────────────────
    const tension = drawTension.current
    const pullDistance = 0.22 * tension

    // String vibration on loose
    stringVibration.current = THREE.MathUtils.damp(stringVibration.current, 0, 14, dt)
    const vibZ = Math.sin(state.clock.elapsedTime * 95) * 0.008 * stringVibration.current

    // Limbs flex slightly backward under tension
    const limbFlex = tension * 0.09
    if (upperLimbRef.current && lowerLimbRef.current) {
      upperLimbRef.current.rotation.x = limbFlex
      lowerLimbRef.current.rotation.x = -limbFlex
    }

    // Limb tips in local space (Upper tip at Y ~ 0.44, Lower tip at Y ~ -0.44)
    const upperTipX = 0.03
    const upperTipY = 0.44 - limbFlex * 0.02
    const upperTipZ = 0.08 + limbFlex * 0.05

    const lowerTipX = 0.03
    const lowerTipY = -0.44 + limbFlex * 0.02
    const lowerTipZ = 0.08 + limbFlex * 0.05

    // Arrow Shelf on the inner-left of the grip:
    const shelfX = -0.024
    const shelfY = 0.012
    const shelfZ = -0.01

    // Arrow direction in bow-local space:
    // Angled forward (-Z), slightly inward (-X toward screen center), and slightly up (+Y):
    const arrowDir = new THREE.Vector3(-0.11, 0.035, -1.0).normalize()

    // Arrow positioning:
    // In idle: nock rests on string (~0.06 behind shelf).
    // In draw: nock pulls straight backward along arrowDir.
    const idleNockDist = 0.08
    const currentNockDist = idleNockDist + pullDistance
    const nockPos = new THREE.Vector3(
      shelfX - arrowDir.x * currentNockDist,
      shelfY - arrowDir.y * currentNockDist,
      shelfZ - arrowDir.z * currentNockDist + vibZ
    )

    // Arrow Group (holds shaft, broadhead, fletchings, and nock):
    if (arrowGroupRef.current) {
      if (isReloading.current && reloadProgress < 0.28) {
        arrowGroupRef.current.visible = false
      } else {
        arrowGroupRef.current.visible = true

        // Orient arrow along arrowDir
        const arrowQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          arrowDir
        )
        arrowGroupRef.current.quaternion.copy(arrowQuat)

        // Arrow position (centered along shaft):
        // Broadhead tip is at local z = -0.35, nock at local z = +0.35
        let centerPos = new THREE.Vector3(
          shelfX + arrowDir.x * (0.35 - currentNockDist),
          shelfY + arrowDir.y * (0.35 - currentNockDist),
          shelfZ + arrowDir.z * (0.35 - currentNockDist)
        )

        // Reload animation: arrow slides up onto shelf
        if (isReloading.current) {
          const tSlide = (reloadProgress - 0.28) / 0.72
          const easeSlide = THREE.MathUtils.smoothstep(tSlide, 0, 1)
          centerPos.y -= (1 - easeSlide) * 0.14
          centerPos.x += (1 - easeSlide) * 0.05
          centerPos.z += (1 - easeSlide) * 0.08
        }

        arrowGroupRef.current.position.copy(centerPos)
      }
    }

    // Update 3-Point Bowstring: Upper Tip -> Arrow Nock -> Lower Tip
    const stringPosAttr = stringGeo.attributes.position as THREE.BufferAttribute
    stringPosAttr.setXYZ(0, upperTipX, upperTipY, upperTipZ)
    stringPosAttr.setXYZ(1, nockPos.x, nockPos.y, nockPos.z)
    stringPosAttr.setXYZ(2, lowerTipX, lowerTipY, lowerTipZ)
    stringPosAttr.needsUpdate = true
  })

  return (
    <group ref={bowRootRef} scale={0.28} renderOrder={100}>
      {/* ── Viewmodel Lighting: Rich warm PBR illumination in all environments ── */}
      <directionalLight position={[0.4, 0.6, 0.8]} intensity={2.8} color="#fff6e6" />
      <ambientLight intensity={1.5} color="#fff0da" />

      {/* ── 1. Central Carved Mahogany Riser ───────────────────────────────── */}
      <mesh geometry={riserGeo} material={woodMat} position={[0, 0, 0]} castShadow={false} />

      {/* Stitched Leather Hand Grip Wrap */}
      <mesh geometry={gripWrapGeo} material={leatherMat} position={[0, -0.015, 0.002]} />

      {/* ── Golden Brass Collars (Signature Aesthetic from Reference Image) ─ */}
      {/* Upper Collar with Embossed Diamond Crest */}
      <group position={[0, 0.085, 0.002]}>
        <mesh geometry={brassCollarGeo} material={brassMat} />
        {/* Diamond Heraldic Crest (❖ motif facing forward) */}
        <mesh geometry={diamondCrestGeo} material={brassMat} position={[0, 0, -0.020]} />
      </group>

      {/* Lower Collar */}
      <group position={[0, -0.085, 0.002]}>
        <mesh geometry={brassCollarGeo} material={brassMat} />
        <mesh geometry={diamondCrestGeo} material={brassMat} position={[0, 0, -0.020]} />
      </group>

      {/* ── 2. Upper Recurve Limb ─────────────────────────────────────────── */}
      <group ref={upperLimbRef} position={[0, 0.085, 0]}>
        <mesh geometry={upperLimbGeo} material={woodMat} />
      </group>

      {/* ── 3. Lower Recurve Limb ─────────────────────────────────────────── */}
      <group ref={lowerLimbRef} position={[0, -0.085, 0]}>
        <mesh geometry={lowerLimbGeo} material={woodMat} />
      </group>

      {/* ── 4. Continuous Dynamic Bowstring ───────────────────────────────── */}
      <primitive object={stringLine} />

      {/* ── 5. Nocked Hunting Arrow (Cedar Shaft, Razor Tip, White Vanes) ───── */}
      <group ref={arrowGroupRef}>
        {/* Cedar Arrow Shaft (Length 0.70m, centered at z = 0) */}
        <mesh geometry={arrowShaftGeo} material={arrowShaftMat} position={[0, 0, 0]} />

        {/* Metal Ferrule Collar at Broadhead Base (z = -0.34) */}
        <mesh geometry={ferruleGeo} material={ferruleMat} position={[0, 0, -0.34]} />

        {/* Polished Razor Silver Broadhead Blade (tip points down -Z, at z = -0.37) */}
        <mesh geometry={arrowTipGeo} material={broadheadMat} position={[0, 0, -0.37]} />

        {/* Carved Bone Nock clamped to string (z = +0.35) */}
        <mesh geometry={nockGeo} material={nockMat} position={[0, 0, 0.35]} />

        {/* 3 White Turkey Feather Fletchings (120 deg apart around rear shaft) */}
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
          <group key={i} position={[0, 0, 0.28]} rotation={[0, 0, angle]}>
            <mesh geometry={fletchingGeo} material={fletchMat} position={[0, 0.005, 0]} />
          </group>
        ))}
      </group>
    </group>
  )
}
