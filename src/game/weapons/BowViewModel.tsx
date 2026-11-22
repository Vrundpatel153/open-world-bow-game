// ─────────────────────────────────────────────────────────────────────────────
// BowViewModel — AAA First-Person Hunting Recurve Bow (Exact Reference Match)
//
// Engineered to match Reference Specifications & User Requirements:
// 1. Full Bow Visibility: Compact authentic viewmodel framing ensures the
//    entire recurve bow (upper tip, upper limb, grip, lower limb, lower tip)
//    is 100% visible on screen without clipping the top or bottom edges.
// 2. Sculpted 3D Arrowhead: Sharp triangular high-carbon steel razor broadhead
//    with central reinforcing diamond rib and polished metallic cutting edges.
// 3. Arrow End & Nock Mechanics: Bone nock sits at rear with string passing
//    directly through the nock throat (z = 0.0). White shield-cut fletchings
//    mount immediately in front of the nock with thread crest wraps. Zero bare
//    wood behind the nock or string!
// 4. Mathematical String Clamping: 3-point continuous taut string connecting
//    upper tip -> arrow nock -> lower tip, 100% clamped in all animation states.
// 5. Crosshair Alignment: Arrow shaft aims directly at screen center crosshair.
// 6. No Hands: Zero player hands or arms rendered.
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
  const rigGroupRef = useRef<THREE.Group>(null!)
  const arrowGroupRef = useRef<THREE.Group>(null!)
  const upperLimbRef = useRef<THREE.Group>(null!)
  const lowerLimbRef = useRef<THREE.Group>(null!)
  const upperTipMarkerRef = useRef<THREE.Group>(null!)
  const lowerTipMarkerRef = useRef<THREE.Group>(null!)

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
  const aimProgress = useRef(0) // 0.0 = idle hip carry, 1.0 = raised aim stance

  // Mouse sway spring-damper physics
  const swayX = useRef(0)
  const swayY = useRef(0)
  const swayVelX = useRef(0)
  const swayVelY = useRef(0)

  // Reusable vectors for zero GC per frame
  const vUpperWorld = useRef(new THREE.Vector3())
  const vLowerWorld = useRef(new THREE.Vector3())
  const vUpperLocal = useRef(new THREE.Vector3())
  const vLowerLocal = useRef(new THREE.Vector3())

  const setDrawProgress = useQuestStore((s) => s.setDrawProgress)
  const setAiming = useQuestStore((s) => s.setAiming)
  const isBowEquipped = useQuestStore((s) => s.isBowEquipped)
  const toggleBowEquipped = useQuestStore((s) => s.toggleBowEquipped)

  // ── Procedural Geometries (Reference: Stylized Mahogany & Golden Brass Recurve) ──
  const {
    riserGeo,
    gripWrapGeo,
    collarGeo,
    collarRimGeo,
    diamondCrestGeo,
    flowerEmblemGeo,
    upperLimbGeo,
    lowerLimbGeo,
    tipCapGeo,
    arrowShaftGeo,
    arrowTipGeo,
    arrowCoreGeo,
    ferruleGeo,
    fletchingGeo,
    threadWrapGeo,
    arrowNockGeo,
  } = useMemo(() => {
    // 1. Central Carved Mahogany Riser (Height 0.12m, width 20mm, depth 22mm)
    // Left side has sculpted arrow shelf cutout at Y = 0.005, X = -0.0065
    // Arrow rests on top of shelf, NEVER piercing through the solid handle!
    const riserShape = new THREE.Shape()
    riserShape.moveTo(-0.010, -0.060)
    riserShape.lineTo(0.010, -0.060)
    riserShape.lineTo(0.010, -0.015)
    riserShape.lineTo(0.010, 0.015)
    riserShape.lineTo(0.010, 0.060)
    riserShape.lineTo(-0.010, 0.060)
    riserShape.lineTo(-0.010, 0.035)
    // Sculpted arrow shelf: indented sight window cutout on left side
    riserShape.lineTo(-0.003, 0.035)
    riserShape.lineTo(-0.003, 0.005) // horizontal shelf rest
    riserShape.lineTo(-0.010, 0.005)
    riserShape.lineTo(-0.010, -0.015)
    riserShape.lineTo(-0.010, -0.060)
    riserShape.closePath()

    const riser = new THREE.ExtrudeGeometry(riserShape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0014,
      bevelThickness: 0.0014,
    })
    riser.center()

    // 2. Stitched Leather Hand Grip Wrap (Y = -0.045 to -0.008)
    const gripWrap = new THREE.CylinderGeometry(0.0125, 0.0130, 0.044, 16)

    // 3. Golden Brass Reinforcement Collars (Upper & Lower sleeves)
    const collar = new THREE.CylinderGeometry(0.0135, 0.0135, 0.018, 16)
    collar.scale(1.10, 1.0, 0.90)

    const collarRim = new THREE.CylinderGeometry(0.0148, 0.0148, 0.0026, 16)
    collarRim.scale(1.12, 1.0, 0.92)

    // Embossed Diamond Crest (Heraldic plaque on upper collar from Reference Image)
    const diamondShape = new THREE.Shape()
    diamondShape.moveTo(0, 0.0075)
    diamondShape.lineTo(0.0060, 0)
    diamondShape.lineTo(0, -0.0075)
    diamondShape.lineTo(-0.0060, 0)
    diamondShape.closePath()

    const diamondCrest = new THREE.ExtrudeGeometry(diamondShape, {
      depth: 0.0016,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.0006,
      bevelThickness: 0.0006,
    })
    diamondCrest.center()

    // 4-petal floral motif inside diamond
    const flowerShape = new THREE.Shape()
    flowerShape.moveTo(0, 0.0024)
    flowerShape.lineTo(0.0011, 0.0011)
    flowerShape.lineTo(0.0024, 0)
    flowerShape.lineTo(0.0011, -0.0011)
    flowerShape.lineTo(0, -0.0024)
    flowerShape.lineTo(-0.0011, -0.0011)
    flowerShape.lineTo(-0.0024, 0)
    flowerShape.lineTo(-0.0011, 0.0011)
    flowerShape.closePath()

    const flowerEmblem = new THREE.ExtrudeGeometry(flowerShape, {
      depth: 0.0012,
      bevelEnabled: false,
    })
    flowerEmblem.center()

    // 4. Upper & Lower Recurve Limbs
    // Limb curve: length 0.130m, reaches tip at (-0.0065, 0.130, 0.026)
    // Mounted at Y = +/-0.040. Total bow tip-to-tip span is 0.340m:
    // Fits gracefully inside viewport with 100% full visibility of upper & lower tips!
    const upperPoints: THREE.Vector3[] = []
    const lowerPoints: THREE.Vector3[] = []

    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      const y = t * 0.130
      // Recurve: sweeps forward into -Z, then recurves back into +Z at tip
      const x = -Math.sin(t * Math.PI * 0.5) * 0.0065
      const z = -Math.sin(t * Math.PI * 0.55) * 0.020 + Math.pow(t, 2.2) * 0.046
      upperPoints.push(new THREE.Vector3(x, y, z))
      lowerPoints.push(new THREE.Vector3(x, -y, z))
    }

    const upperCurve = new THREE.CatmullRomCurve3(upperPoints)
    const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints)

    // Flat beveled plank cross-section (width 15mm, thickness 6mm)
    const plankShape = new THREE.Shape()
    plankShape.moveTo(-0.0075, -0.0030)
    plankShape.lineTo(0.0075, -0.0030)
    plankShape.lineTo(0.0075, 0.0030)
    plankShape.lineTo(-0.0075, 0.0030)
    plankShape.closePath()

    const upperLimb = new THREE.ExtrudeGeometry(plankShape, {
      extrudePath: upperCurve,
      steps: 24,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0009,
      bevelThickness: 0.0009,
    })
    const lowerLimb = new THREE.ExtrudeGeometry(plankShape, {
      extrudePath: lowerCurve,
      steps: 24,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0009,
      bevelThickness: 0.0009,
    })

    // Brass recurve tip nock cap (snug form-fitting overlay with string notch)
    const tipCap = new THREE.CylinderGeometry(0.0042, 0.0068, 0.012, 12)
    tipCap.scale(1.05, 1.0, 0.75)

    // ── 5. Authentic 3D Hunting Arrow (Total Length 0.58m) ───────────────────
    // Rear: Bone nock throat is at Z = 0.000 where string rests.
    // Zero bare wood or feather extending behind nock or string!

    // Carved Dark Horn Nock: Sleek authentic archery nock (throat at Z = 0.0, ears to +0.0018, sleeve to -0.0055)
    // String rests at Z = 0.000 passing directly through the string throat. Zero bare shaft or feather behind nock or string!
    const arrowNock = new THREE.CylinderGeometry(0.0026, 0.0026, 0.0070, 12)
    arrowNock.rotateX(Math.PI / 2)
    arrowNock.translate(0, 0, -0.0018) // spans [+0.0017, -0.0053]

    // Cedar Wood Shaft: starts at Z = -0.0053 and extends to Z = -0.510 (length 0.5047m)
    const shaft = new THREE.CylinderGeometry(0.0026, 0.0026, 0.5047, 12)
    shaft.rotateX(Math.PI / 2)
    shaft.translate(0, 0, -0.2576) // spans [-0.0053, -0.510]

    // Dark steel ferrule collar (Z = -0.505 to -0.525)
    const ferrule = new THREE.CylinderGeometry(0.0035, 0.0030, 0.020, 12)
    ferrule.rotateX(Math.PI / 2)
    ferrule.translate(0, 0, -0.515)

    // Broadhead Diamond Reinforcing Core Spine
    const coreSpine = new THREE.ConeGeometry(0.0030, 0.065, 4)
    coreSpine.rotateX(-Math.PI / 2) // Points forward along -Z
    coreSpine.translate(0, 0, -0.548) // Reaches point at Z = -0.580

    // Razor Sharp 3D Broadhead Cutting Blade
    const bladeShape = new THREE.Shape()
    bladeShape.moveTo(0, 0.065) // Needle-sharp point at front
    bladeShape.lineTo(0.014, 0.0) // Trailing right barb
    bladeShape.lineTo(0.004, 0.008)
    bladeShape.lineTo(0.004, -0.008)
    bladeShape.lineTo(-0.004, -0.008)
    bladeShape.lineTo(-0.004, 0.008)
    bladeShape.lineTo(-0.014, 0.0) // Trailing left barb
    bladeShape.closePath()

    const bladeExtrude = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.0018,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0006,
      bevelThickness: 0.0006,
    })
    bladeExtrude.rotateX(-Math.PI / 2) // Points forward along -Z
    bladeExtrude.rotateZ(Math.PI / 4) // 45 deg blade tilt
    bladeExtrude.translate(0, 0, -0.515) // Point reaches Z = -0.580

    // 3 Aerodynamic White Turkey Shield-Cut Feathers (Mounted at Z = -0.008 to -0.076)
    // Starts immediately at nock base with ZERO bare shaft gap!
    const fletchShape = new THREE.Shape()
    fletchShape.moveTo(0, 0.068) // Front of feather
    fletchShape.lineTo(0.0082, 0.056)
    fletchShape.lineTo(0.0078, 0.002)
    fletchShape.lineTo(0, 0.0)
    fletchShape.closePath()
    const fletching = new THREE.ShapeGeometry(fletchShape)
    fletching.rotateX(-Math.PI / 2) // Extends forward along -Z
    fletching.translate(0, 0, -0.008) // Spans [-0.008, -0.076]

    // Silk thread whipping rings binding the feather quills
    const threadWrap = new THREE.CylinderGeometry(0.0031, 0.0031, 0.0030, 12)
    threadWrap.rotateX(Math.PI / 2)

    return {
      riserGeo: riser,
      gripWrapGeo: gripWrap,
      collarGeo: collar,
      collarRimGeo: collarRim,
      diamondCrestGeo: diamondCrest,
      flowerEmblemGeo: flowerEmblem,
      upperLimbGeo: upperLimb,
      lowerLimbGeo: lowerLimb,
      tipCapGeo: tipCap,
      arrowShaftGeo: shaft,
      arrowTipGeo: bladeExtrude,
      arrowCoreGeo: coreSpine,
      ferruleGeo: ferrule,
      fletchingGeo: fletching,
      threadWrapGeo: threadWrap,
      arrowNockGeo: arrowNock,
    }
  }, [])

  // ── Materials (Warm Stylized PBR Matching Reference) ──────────────────────
  const {
    woodMat,
    leatherMat,
    brassMat,
    brassAccentMat,
    stringMat,
    arrowShaftMat,
    broadheadMat,
    ferruleMat,
    fletchMat,
    threadMat,
    arrowNockMat,
  } = useMemo(() => {
    const wood = new THREE.MeshStandardMaterial({
      color: '#3e1f0e',
      roughness: 0.38,
      metalness: 0.04,
    })

    const leather = new THREE.MeshStandardMaterial({
      color: '#221208',
      roughness: 0.82,
      metalness: 0.02,
    })

    const brass = new THREE.MeshStandardMaterial({
      color: '#d4aa32',
      roughness: 0.28,
      metalness: 0.88,
    })

    const brassAccent = new THREE.MeshStandardMaterial({
      color: '#f2c850',
      roughness: 0.22,
      metalness: 0.92,
    })

    const string = new THREE.LineBasicMaterial({
      color: '#e2e2e2',
      linewidth: 1.5,
    })

    const arrowShaft = new THREE.MeshStandardMaterial({
      color: '#623518',
      roughness: 0.40,
      metalness: 0.05,
    })

    const broadhead = new THREE.MeshStandardMaterial({
      color: '#edf3f8', // Polished razor silver surgical steel
      roughness: 0.14,
      metalness: 0.98,
    })

    const ferrule = new THREE.MeshStandardMaterial({
      color: '#2b2e32',
      roughness: 0.26,
      metalness: 0.90,
    })

    const fletch = new THREE.MeshStandardMaterial({
      color: '#f0f3f6', // Natural matte white turkey feather
      roughness: 0.60,
      side: THREE.DoubleSide,
    })

    const thread = new THREE.MeshStandardMaterial({
      color: '#8b1e1e', // Crimson silk whipping
      roughness: 0.55,
      metalness: 0.12,
    })

    const nock = new THREE.MeshStandardMaterial({
      color: '#3a281a', // Warm natural dark horn nock (matte, zero blown-out white glare)
      roughness: 0.85,
      metalness: 0.0,
    })

    return {
      woodMat: wood,
      leatherMat: leather,
      brassMat: brass,
      brassAccentMat: brassAccent,
      stringMat: string,
      arrowShaftMat: arrowShaft,
      broadheadMat: broadhead,
      ferruleMat: ferrule,
      fletchMat: fletch,
      threadMat: thread,
      arrowNockMat: nock,
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

  // ── Mouse & Keybind Input Handling ─────────────────────────────────────────
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('button, [class*="leva"], a, input')) return
      if (!useQuestStore.getState().isBowEquipped) return

      if (e.button === 0 && !isReloading.current) {
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

        // ── Physics: Launch arrow precisely through center crosshair ───────
        const camPos = camera.getWorldPosition(new THREE.Vector3())
        const camDir = camera.getWorldDirection(new THREE.Vector3())

        // Target point 80m straight down the center crosshair sightline
        const targetPoint = camPos.clone().addScaledVector(camDir, 80.0)

        // Launch origin aligns with arrow broadhead tip in world space
        const launchPos = new THREE.Vector3()
        if (arrowGroupRef.current) {
          arrowGroupRef.current.localToWorld(launchPos.set(0, 0, -0.58))
        } else {
          launchPos.copy(camPos).addScaledVector(camDir, 0.40)
        }

        const fireDir = targetPoint.clone().sub(launchPos).normalize()
        onFireArrow(launchPos, fireDir, power)

        // Recoil kickback animation
        recoilOffset.current = 0.032 * power
        recoilRotation.current = -0.040 * power
        stringVibration.current = 1.0

        isDrawing.current = false
        drawTension.current = 0
        setDrawProgress(0)

        // Reload Cycle (fresh arrow slides onto shelf)
        isReloading.current = true
        reloadTimer.current = 0.22
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
    if (!bowRootRef.current || !rigGroupRef.current) return
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
        reloadProgress = 1.0 - reloadTimer.current / 0.22
      }
    }

    // 2. Draw Tension Physics
    if (isDrawing.current && isBowEquipped) {
      const prev = drawTension.current
      drawTension.current = Math.min(1.0, drawTension.current + dt * 2.8)
      setDrawProgress(drawTension.current)

      if (drawTension.current > prev + 0.18) {
        sound.playBowDraw(drawTension.current)
      }
    } else {
      drawTension.current = THREE.MathUtils.damp(drawTension.current, 0, 16, dt)
    }

    // Archer hand tremor vibration at maximum draw
    let shakeX = 0
    let shakeY = 0
    if (drawTension.current > 0.85) {
      const tremor = (drawTension.current - 0.85) * 0.0022
      shakeX = (Math.random() - 0.5) * tremor
      shakeY = (Math.random() - 0.5) * tremor
    }

    // 3. Mouse Look Inertia & Weapon Sway
    const mouseDx = inputManager.mouseDeltaX || 0
    const mouseDy = inputManager.mouseDeltaY || 0

    swayVelX.current += -mouseDx * 0.00016
    swayVelY.current += mouseDy * 0.00016

    swayX.current += swayVelX.current * dt
    swayY.current += swayVelY.current * dt
    swayVelX.current = THREE.MathUtils.damp(swayVelX.current, -swayX.current * 28, 22, dt)
    swayVelY.current = THREE.MathUtils.damp(swayVelY.current, -swayY.current * 28, 22, dt)
    swayX.current = Math.max(-0.016, Math.min(0.016, swayX.current))
    swayY.current = Math.max(-0.016, Math.min(0.016, swayY.current))

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

    const bobX = Math.cos(walkBobTimer.current * 0.5) * (isMoving ? 0.003 : 0.0006)
    const bobY = Math.sin(walkBobTimer.current) * (isMoving ? 0.005 : 0.0010)

    // Recoil recovery
    recoilOffset.current = THREE.MathUtils.damp(recoilOffset.current, 0, 14, dt)
    recoilRotation.current = THREE.MathUtils.damp(recoilRotation.current, 0, 12, dt)

    // ── 5. Stance & Positioning (Full Bow Visible Without Fullscreen Clipping) ──
    const cam = state.camera
    bowRootRef.current.position.copy(cam.position)
    bowRootRef.current.quaternion.copy(cam.quaternion)
    bowRootRef.current.updateMatrixWorld(true)

    const isAiming = (isDrawing.current || useQuestStore.getState().isAiming) && isBowEquipped
    const targetAim = isAiming ? 1.0 : 0.0
    aimProgress.current = THREE.MathUtils.damp(aimProgress.current, targetAim, 12, dt)
    const aFactor = aimProgress.current

    // Idle stance: compact recurve framing rests comfortably in the right lower screen quadrant, 100% visible
    // Aim stance: bow raises into archery sight window, arrow rests on shelf with razor broadhead tip sighted directly into center crosshair
    const baseLocalX = THREE.MathUtils.lerp(0.125, 0.0094, aFactor)
    const baseLocalY = THREE.MathUtils.lerp(-0.075, -0.0190, aFactor)
    const baseLocalZ = THREE.MathUtils.lerp(-0.380, -0.340, aFactor)

    const localX = baseLocalX + swayX.current + bobX + shakeX
    const localY = baseLocalY + swayY.current + bobY + shakeY + (1.0 - equipProgress.current) * -0.5
    const localZ = baseLocalZ + recoilOffset.current

    rigGroupRef.current.position.set(localX, localY, localZ)
    rigGroupRef.current.scale.setScalar(0.72)

    // Dynamic rotation: natural inward archery cant prevents stiff telephone-pole look
    const pitchX = THREE.MathUtils.lerp(-0.035, -0.005, aFactor) + recoilRotation.current + swayY.current * 0.18
    const yawY = THREE.MathUtils.lerp(-0.055, -0.004, aFactor) + swayX.current * 0.25
    const rollZ = THREE.MathUtils.lerp(0.280, 0.120, aFactor)

    rigGroupRef.current.rotation.set(pitchX, yawY, rollZ, 'YXZ')
    rigGroupRef.current.updateMatrixWorld(true)

    // ── 6. Dynamic Bow Limb Flexing ──────────────────────────────────────────
    const tension = drawTension.current
    const pullDistance = 0.082 * tension

    // String vibration on loose
    stringVibration.current = THREE.MathUtils.damp(stringVibration.current, 0, 14, dt)
    const vibZ = Math.sin(state.clock.elapsedTime * 125) * 0.005 * stringVibration.current

    // Limbs flex backward under tension
    const limbFlex = tension * 0.038
    if (upperLimbRef.current && lowerLimbRef.current) {
      upperLimbRef.current.rotation.x = limbFlex
      lowerLimbRef.current.rotation.x = -limbFlex
      upperLimbRef.current.updateMatrixWorld(true)
      lowerLimbRef.current.updateMatrixWorld(true)
    }

    // ── 7. Mathematical Limb Tip Tracking ────────────────────────────────────
    // Read exact world position of the tip markers and convert to rigGroup space
    // Guarantees 100% mathematical clamping between limb tips and string vertices
    if (upperTipMarkerRef.current && lowerTipMarkerRef.current) {
      upperTipMarkerRef.current.getWorldPosition(vUpperWorld.current)
      lowerTipMarkerRef.current.getWorldPosition(vLowerWorld.current)
      vUpperLocal.current.copy(rigGroupRef.current.worldToLocal(vUpperWorld.current))
      vLowerLocal.current.copy(rigGroupRef.current.worldToLocal(vLowerWorld.current))
    }

    // ── 8. Crosshair Alignment & Arrow Orientation ───────────────────────────
    // Resting nock position on string at arrow shelf rest (X = -0.0065, Y = 0.008, Z = 0.026)
    const restingNock = new THREE.Vector3(-0.0065, 0.008, 0.026)

    // When drawing, nock pulls smoothly straight backward along +Z:
    const currentNock = restingNock.clone()
    currentNock.z += pullDistance + vibZ

    // In rigGroup space, arrow points along -Z resting in the shelf channel.
    // In aim stance, sightline convergence aligns the razor broadhead needle tip directly into the center crosshair
    const arrowDir = new THREE.Vector3(
      THREE.MathUtils.lerp(0.0, -0.008, aFactor),
      THREE.MathUtils.lerp(0.0, 0.015, aFactor),
      -1.0
    ).normalize()

    // Update Arrow Group (pivot at nock throat (0, 0, 0), arrow points along -Z)
    if (arrowGroupRef.current) {
      if (isReloading.current && reloadProgress < 0.20) {
        arrowGroupRef.current.visible = false
      } else {
        arrowGroupRef.current.visible = true

        // Orient arrow along arrowDir
        const arrowQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          arrowDir
        )
        arrowGroupRef.current.quaternion.copy(arrowQuat)

        const currentNockPos = currentNock.clone()
        if (isReloading.current) {
          const tSlide = (reloadProgress - 0.20) / 0.80
          const easeSlide = THREE.MathUtils.smoothstep(tSlide, 0, 1)
          currentNockPos.y -= (1 - easeSlide) * 0.06
          currentNockPos.x += (1 - easeSlide) * 0.02
        }

        arrowGroupRef.current.position.copy(currentNockPos)
      }
    }

    // ── 9. Continuous Dynamic Bowstring: Upper Tip -> Arrow Nock -> Lower Tip ──
    const stringPosAttr = stringGeo.attributes.position as THREE.BufferAttribute
    stringPosAttr.setXYZ(0, vUpperLocal.current.x, vUpperLocal.current.y, vUpperLocal.current.z)
    stringPosAttr.setXYZ(1, currentNock.x, currentNock.y, currentNock.z)
    stringPosAttr.setXYZ(2, vLowerLocal.current.x, vLowerLocal.current.y, vLowerLocal.current.z)
    stringPosAttr.needsUpdate = true
  })

  return (
    <group
      ref={bowRootRef}
      renderOrder={999}
      onBeforeRender={(renderer) => {
        // Clear depth buffer so first-person weapon viewmodel NEVER clips into world foliage, rocks, or terrain!
        renderer.clearDepth()
      }}
    >
      <group ref={rigGroupRef}>
        {/* ── 1. Central Carved Mahogany Riser with Arrow Shelf Cutout ──────── */}
        <mesh geometry={riserGeo} material={woodMat} position={[0, 0, 0]} castShadow={false} />

        {/* Stitched Leather Hand Grip Wrap */}
        <mesh geometry={gripWrapGeo} material={leatherMat} position={[0, -0.026, 0.0]} />

        {/* ── Golden Brass Collars (Upper & Lower Brackets) ────────────────── */}
        {/* Upper Collar Bracket with Embossed Diamond Crest */}
        <group position={[0, 0.040, 0]}>
          <mesh geometry={collarGeo} material={brassMat} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, 0.009, 0]} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, -0.009, 0]} />
          {/* Diamond Heraldic Plaque facing player flush */}
          <group position={[-0.005, 0, 0.012]} rotation={[0, -0.08, 0]}>
            <mesh geometry={diamondCrestGeo} material={brassAccentMat} />
            <mesh geometry={flowerEmblemGeo} material={brassMat} position={[0, 0, 0.0014]} />
          </group>
        </group>

        {/* Lower Collar Bracket */}
        <group position={[0, -0.040, 0]}>
          <mesh geometry={collarGeo} material={brassMat} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, 0.009, 0]} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, -0.009, 0]} />
          <group position={[-0.004, 0, 0.012]} rotation={[0, 0.05, 0]}>
            <mesh geometry={diamondCrestGeo} material={brassAccentMat} />
          </group>
        </group>

        {/* ── 2. Upper Recurve Limb (Graceful Curve Fully Inside Viewport) ─── */}
        <group ref={upperLimbRef} position={[0, 0.040, 0]}>
          <mesh geometry={upperLimbGeo} material={woodMat} />
          {/* Snug Form-Fitting Brass Tip Overlay with String Notch */}
          <mesh geometry={tipCapGeo} material={brassMat} position={[-0.0065, 0.128, 0.025]} rotation={[0.08, 0, 0]} />
          {/* Mathematical Tip Marker for 100% Clamped String Attachment */}
          <group ref={upperTipMarkerRef} position={[-0.0065, 0.130, 0.026]} />
        </group>

        {/* ── 3. Lower Recurve Limb ───────────────────────────────────────── */}
        <group ref={lowerLimbRef} position={[0, -0.040, 0]}>
          <mesh geometry={lowerLimbGeo} material={woodMat} />
          {/* Snug Form-Fitting Brass Tip Overlay with String Notch */}
          <mesh geometry={tipCapGeo} material={brassMat} position={[-0.0065, -0.128, 0.025]} rotation={[-0.08, 0, 0]} />
          {/* Mathematical Tip Marker for 100% Clamped String Attachment */}
          <group ref={lowerTipMarkerRef} position={[-0.0065, -0.130, 0.026]} />
        </group>

        {/* ── 4. Continuous Dynamic Bowstring ─────────────────────────────── */}
        <primitive object={stringLine} />

        {/* ── 5. Nocked Hunting Arrow (3D Razor Broadhead, White Vanes, Bone Nock) */}
        {/* Anchored at nock throat: local (0, 0, 0) is clamped to string; local -Z points forward */}
        <group ref={arrowGroupRef}>
          {/* Carved Bone Nock clamped to string (local z = 0.0; throat sits on string) */}
          <mesh geometry={arrowNockGeo} material={arrowNockMat} position={[0, 0, 0]} />

          {/* Cedar Arrow Shaft (extends from z = -0.008 to z = -0.510; zero shaft behind nock!) */}
          <mesh geometry={arrowShaftGeo} material={arrowShaftMat} position={[0, 0, 0]} />

          {/* Dark Gunmetal Steel Ferrule Collar (z = -0.505 to -0.525) */}
          <mesh geometry={ferruleGeo} material={ferruleMat} position={[0, 0, 0]} />

          {/* Broadhead Diamond Core Spine */}
          <mesh geometry={arrowCoreGeo} material={ferruleMat} position={[0, 0, 0]} />

          {/* Polished Silver Razor Broadhead Blade (sharp tip at z = -0.580, pointing forward -Z) */}
          <mesh geometry={arrowTipGeo} material={broadheadMat} position={[0, 0, 0]} />

          {/* 3 White Turkey Shield-Cut Feathers (Mounted immediately at nock base: z = -0.008 to -0.076) */}
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
            <group key={i} position={[0, 0, 0]} rotation={[0, 0, angle]}>
              <mesh geometry={fletchingGeo} material={fletchMat} position={[0, 0.0028, 0]} />
            </group>
          ))}

          {/* Silk Thread Whipping Rings binding the feather quills */}
          <mesh geometry={threadWrapGeo} material={threadMat} position={[0, 0, -0.007]} />
          <mesh geometry={threadWrapGeo} material={threadMat} position={[0, 0, -0.077]} />
        </group>
      </group>
    </group>
  )
}
