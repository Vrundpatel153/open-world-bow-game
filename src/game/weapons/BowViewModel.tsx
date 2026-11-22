// ─────────────────────────────────────────────────────────────────────────────
// BowViewModel — AAA First-Person Hunting Recurve Bow (Exact Reference Image 9 Match)
//
// Strictly engineered to match Reference Image 9:
// 1. Bow Positioning: Stands vertically on the right side of the screen, with
//    its carved mahogany & golden brass grip in the lower-right foreground.
// 2. Arrow Positioning: Sits naturally on the inner shelf on the left of the grip,
//    shaft aligned forward towards the screen center crosshair.
// 3. Bowstring: Continuous taut string connecting upper tip -> arrow nock -> lower tip,
//    following limb curvature and flex.
// 4. Crosshair: Clean small center crosshair; arrows launch precisely through it.
// 5. Drawing Animation: Holding LMB pulls string & arrow smoothly backward,
//    flexing the upper and lower recurve limbs under tension.
// 6. Shooting: On release, launches arrow from broadhead tip along camera sightline.
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
  const rigGroupRef = useRef<THREE.Group>(null!)
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
    ferruleGeo,
    fletchingGeo,
    arrowNockGeo,
  } = useMemo(() => {
    // 1. Central Carved Mahogany Riser (Height 0.24m, width 24mm, depth 28mm)
    const riserShape = new THREE.Shape()
    riserShape.moveTo(-0.012, -0.11)
    riserShape.lineTo(0.012, -0.11)
    riserShape.lineTo(0.013, -0.03)
    riserShape.lineTo(0.013, 0.03)
    riserShape.lineTo(0.012, 0.11)
    riserShape.lineTo(-0.012, 0.11)
    riserShape.lineTo(-0.012, 0.035)
    // Smooth inner shelf indentation at y = 0.0, x = -0.008
    riserShape.quadraticCurveTo(-0.014, 0.020, -0.008, 0.0)
    riserShape.quadraticCurveTo(-0.014, -0.020, -0.012, -0.035)
    riserShape.lineTo(-0.012, -0.11)
    riserShape.closePath()

    const riser = new THREE.ExtrudeGeometry(riserShape, {
      depth: 0.026,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0016,
      bevelThickness: 0.0016,
    })
    riser.center()

    // 2. Stitched Leather Hand Grip Wrap (Y = -0.065 to -0.005)
    const gripWrap = new THREE.CylinderGeometry(0.0145, 0.0150, 0.065, 16)

    // 3. Golden Brass Reinforcement Collars (Sleek bracket sleeves)
    const collar = new THREE.CylinderGeometry(0.0160, 0.0160, 0.028, 16)
    collar.scale(1.10, 1.0, 0.90)

    // Top and bottom flange rims for collars
    const collarRim = new THREE.CylinderGeometry(0.0175, 0.0175, 0.0035, 16)
    collarRim.scale(1.12, 1.0, 0.92)

    // Embossed Diamond Crest (Heraldic plaque on upper collar from Reference Image 9)
    const diamondShape = new THREE.Shape()
    diamondShape.moveTo(0, 0.011)
    diamondShape.lineTo(0.0085, 0)
    diamondShape.lineTo(0, -0.011)
    diamondShape.lineTo(-0.0085, 0)
    diamondShape.closePath()

    const diamondCrest = new THREE.ExtrudeGeometry(diamondShape, {
      depth: 0.002,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.0008,
      bevelThickness: 0.0008,
    })
    diamondCrest.center()

    // 4-petal floral cross emblem inside diamond
    const flowerShape = new THREE.Shape()
    flowerShape.moveTo(0, 0.0035)
    flowerShape.lineTo(0.0018, 0.0018)
    flowerShape.lineTo(0.0035, 0)
    flowerShape.lineTo(0.0018, -0.0018)
    flowerShape.lineTo(0, -0.0035)
    flowerShape.lineTo(-0.0018, -0.0018)
    flowerShape.lineTo(-0.0035, 0)
    flowerShape.lineTo(-0.0018, 0.0018)
    flowerShape.closePath()

    const flowerEmblem = new THREE.ExtrudeGeometry(flowerShape, {
      depth: 0.0016,
      bevelEnabled: false,
    })
    flowerEmblem.center()

    // 4. Upper & Lower Recurve Limbs (Wide flat beveled wooden planks)
    const upperPoints: THREE.Vector3[] = []
    const lowerPoints: THREE.Vector3[] = []

    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      const y = t * 0.33 // Extends from Y = 0.075 to 0.405
      // Recurve: arches forward into -Z, then recurves back into +Z at tip
      const x = -Math.sin(t * Math.PI * 0.45) * 0.008
      const z = -Math.sin(t * Math.PI * 0.55) * 0.035 + Math.pow(t, 2.2) * 0.070
      upperPoints.push(new THREE.Vector3(x, y, z))
      lowerPoints.push(new THREE.Vector3(x, -y, z))
    }

    const upperCurve = new THREE.CatmullRomCurve3(upperPoints)
    const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints)

    // Flat beveled plank cross-section (width 22mm, thickness 9mm)
    const plankShape = new THREE.Shape()
    plankShape.moveTo(-0.011, -0.0045)
    plankShape.lineTo(0.011, -0.0045)
    plankShape.lineTo(0.011, 0.0045)
    plankShape.lineTo(-0.011, 0.0045)
    plankShape.closePath()

    const upperLimb = new THREE.ExtrudeGeometry(plankShape, {
      extrudePath: upperCurve,
      steps: 24,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0012,
      bevelThickness: 0.0012,
    })
    const lowerLimb = new THREE.ExtrudeGeometry(plankShape, {
      extrudePath: lowerCurve,
      steps: 24,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0012,
      bevelThickness: 0.0012,
    })

    // Brass recurve tip nock cap (snug form-fitting cap)
    const tipCap = new THREE.CylinderGeometry(0.0055, 0.010, 0.020, 12)
    tipCap.scale(1.05, 1.0, 0.75)

    // 5. Nocked Hunting Arrow Components (Total Length 0.82m)
    // Cedar wood shaft: extends from z = 0 (nock) forward along -Z to z = -0.75
    const shaft = new THREE.CylinderGeometry(0.0038, 0.0038, 0.75, 12)
    shaft.rotateX(Math.PI / 2) // Orient along Z
    shaft.translate(0, 0, -0.375) // Centered at -0.375, spans [0, -0.75]

    // Metal ferrule collar at base of broadhead (z = -0.74 to -0.765)
    const ferrule = new THREE.CylinderGeometry(0.0048, 0.0040, 0.025, 12)
    ferrule.rotateX(Math.PI / 2)
    ferrule.translate(0, 0, -0.75)

    // Polished Silver Razor Broadhead Blade (sharp point at z = -0.82, pointing forward -Z)
    const tipShape = new THREE.Shape()
    tipShape.moveTo(0, 0.065) // Sharp point at front +Y
    tipShape.lineTo(0.016, 0.0) // Right barb extending backward
    tipShape.lineTo(0.005, 0.01)
    tipShape.lineTo(0.005, -0.01)
    tipShape.lineTo(-0.005, -0.01)
    tipShape.lineTo(-0.005, 0.01)
    tipShape.lineTo(-0.016, 0.0) // Left barb extending backward
    tipShape.closePath()

    const tipExtrude = new THREE.ExtrudeGeometry(tipShape, {
      depth: 0.0022,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0008,
      bevelThickness: 0.0008,
    })
    tipExtrude.rotateX(-Math.PI / 2) // Sharp point points forward along -Z!
    tipExtrude.rotateZ(Math.PI / 4) // 45 deg blade tilt matching reference image
    tipExtrude.translate(0, 0, -0.755) // Point is at Z = -0.82!

    // 3 Aerodynamic White Turkey Feathers (Length 0.09m, positioned at rear shaft z = -0.06 to -0.15)
    const fletchShape = new THREE.Shape()
    fletchShape.moveTo(0, 0.09) // Front tip of feather
    fletchShape.lineTo(0.012, 0.075)
    fletchShape.lineTo(0.011, 0.0)
    fletchShape.lineTo(0, -0.005)
    fletchShape.closePath()
    const fletching = new THREE.ShapeGeometry(fletchShape)
    fletching.rotateX(-Math.PI / 2) // Feather extends forward along -Z from nock
    fletching.translate(0, 0, -0.06) // Spans [ -0.06, -0.15 ]

    // Carved Bone Nock clamped to string (at z = 0)
    const arrowNock = new THREE.CylinderGeometry(0.0044, 0.0044, 0.016, 12)
    arrowNock.rotateX(Math.PI / 2)

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
      arrowTipGeo: tipExtrude,
      ferruleGeo: ferrule,
      fletchingGeo: fletching,
      arrowNockGeo: arrowNock,
    }
  }, [])

  // ── Materials (Rich Warm Fantasy PBR from Reference Image 9) ───────────────
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
    arrowNockMat,
  } = useMemo(() => {
    // Rich dark mahogany wood with stylized beveled luster
    const wood = new THREE.MeshStandardMaterial({
      color: '#3e1f0e',
      roughness: 0.38,
      metalness: 0.04,
    })

    // Stitched leather grip wrap
    const leather = new THREE.MeshStandardMaterial({
      color: '#221208',
      roughness: 0.82,
      metalness: 0.02,
    })

    // Polished antique golden brass collars
    const brass = new THREE.MeshStandardMaterial({
      color: '#d4aa32',
      roughness: 0.28,
      metalness: 0.88,
    })

    // Bright golden brass accent for embossed diamond crest
    const brassAccent = new THREE.MeshStandardMaterial({
      color: '#f2c850',
      roughness: 0.22,
      metalness: 0.92,
    })

    // Taut white woven bowstring
    const string = new THREE.LineBasicMaterial({
      color: '#f8fafc',
      linewidth: 2,
    })

    // Warm cedar arrow shaft
    const arrowShaft = new THREE.MeshStandardMaterial({
      color: '#6c3d1e',
      roughness: 0.42,
      metalness: 0.05,
    })

    // Polished razor silver broadhead blade
    const broadhead = new THREE.MeshStandardMaterial({
      color: '#e8eef4',
      roughness: 0.18,
      metalness: 0.96,
    })

    // Dark steel ferrule collar
    const ferrule = new THREE.MeshStandardMaterial({
      color: '#33373b',
      roughness: 0.32,
      metalness: 0.85,
    })

    // Crisp aerodynamic white turkey feathers
    const fletch = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.48,
      side: THREE.DoubleSide,
    })

    // Carved bone nock
    const nock = new THREE.MeshStandardMaterial({
      color: '#f5efe4',
      roughness: 0.32,
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
      if ((e.target as HTMLElement)?.closest('button, [class*="leva"], a, input')) return
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
        const targetPoint = camPos.clone().addScaledVector(camDir, 150.0)

        // Launch origin from current arrow broadhead tip in world coordinates
        const arrowTipPos = new THREE.Vector3()
        if (arrowGroupRef.current) {
          arrowGroupRef.current.localToWorld(arrowTipPos.set(0, 0, -0.82))
        } else {
          arrowTipPos.copy(camPos).addScaledVector(camDir, 0.70)
        }

        const fireDir = targetPoint.clone().sub(arrowTipPos).normalize()
        onFireArrow(arrowTipPos, fireDir, power)

        // Recoil kickback animation
        recoilOffset.current = 0.038 * power
        recoilRotation.current = -0.045 * power
        stringVibration.current = 1.0

        isDrawing.current = false
        drawTension.current = 0
        setDrawProgress(0)

        // Reload Cycle (fresh arrow slides onto shelf)
        isReloading.current = true
        reloadTimer.current = 0.25
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
        reloadProgress = 1.0 - reloadTimer.current / 0.25
      }
    }

    // 2. Draw Tension Physics
    if (isDrawing.current && isBowEquipped) {
      const prev = drawTension.current
      drawTension.current = Math.min(1.0, drawTension.current + dt * 2.5)
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
      const tremor = (drawTension.current - 0.85) * 0.003
      shakeX = (Math.random() - 0.5) * tremor
      shakeY = (Math.random() - 0.5) * tremor
    }

    // 3. Mouse Look Inertia & Weapon Sway
    const mouseDx = inputManager.mouseDeltaX || 0
    const mouseDy = inputManager.mouseDeltaY || 0

    swayVelX.current += -mouseDx * 0.00020
    swayVelY.current += mouseDy * 0.00020

    swayX.current += swayVelX.current * dt
    swayY.current += swayVelY.current * dt
    swayVelX.current = THREE.MathUtils.damp(swayVelX.current, -swayX.current * 28, 22, dt)
    swayVelY.current = THREE.MathUtils.damp(swayVelY.current, -swayY.current * 28, 22, dt)
    swayX.current = Math.max(-0.020, Math.min(0.020, swayX.current))
    swayY.current = Math.max(-0.020, Math.min(0.020, swayY.current))

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

    const bobX = Math.cos(walkBobTimer.current * 0.5) * (isMoving ? 0.004 : 0.0010)
    const bobY = Math.sin(walkBobTimer.current) * (isMoving ? 0.007 : 0.0015)

    // Recoil recovery
    recoilOffset.current = THREE.MathUtils.damp(recoilOffset.current, 0, 14, dt)
    recoilRotation.current = THREE.MathUtils.damp(recoilRotation.current, 0, 12, dt)

    // ── 5. Stance & Positioning (Exact Match with Reference Image 9) ─────────
    const cam = state.camera
    bowRootRef.current.position.copy(cam.position)
    bowRootRef.current.quaternion.copy(cam.quaternion)

    const isAiming = (isDrawing.current || useQuestStore.getState().isAiming) && isBowEquipped

    // Base camera-space coordinates:
    // Placed vertically on the right side (~26% of screen width)
    const baseLocalX = isAiming ? 0.13 : 0.18
    const baseLocalY = isAiming ? -0.09 : -0.13
    const baseLocalZ = isAiming ? -0.28 : -0.34

    const localX = baseLocalX + swayX.current + bobX + shakeX
    const localY = baseLocalY + swayY.current + bobY + shakeY + (1.0 - equipProgress.current) * -0.5
    const localZ = baseLocalZ + recoilOffset.current

    rigGroupRef.current.position.set(localX, localY, localZ)

    // Orientation: upright recurve with slight natural inward cant
    const pitchX = -0.015 + recoilRotation.current + swayY.current * 0.20
    const yawY = -0.035 + swayX.current * 0.30
    const rollZ = 0.035 // ~2.0 deg natural inward cant

    rigGroupRef.current.rotation.set(pitchX, yawY, rollZ, 'YXZ')
    rigGroupRef.current.updateMatrixWorld(true)

    // ── 6. Dynamic Bow Limb Flexing & Bowstring Clamping ─────────────────────
    const tension = drawTension.current
    const pullDistance = 0.24 * tension

    // String vibration on loose
    stringVibration.current = THREE.MathUtils.damp(stringVibration.current, 0, 14, dt)
    const vibZ = Math.sin(state.clock.elapsedTime * 115) * 0.007 * stringVibration.current

    // Limbs flex slightly under tension
    const limbFlex = tension * 0.05
    if (upperLimbRef.current && lowerLimbRef.current) {
      upperLimbRef.current.rotation.x = limbFlex
      lowerLimbRef.current.rotation.x = -limbFlex
    }

    // Limb tips in rig local space
    const upperTipLocal = new THREE.Vector3(-0.008, 0.405 - limbFlex * 0.2, 0.045 + limbFlex * 0.4)
    const lowerTipLocal = new THREE.Vector3(-0.008, -0.405 + limbFlex * 0.2, 0.045 + limbFlex * 0.4)

    // Aim Target in Camera Space is at (0, 0, -60.0) -> through center crosshair!
    const camPos = cam.getWorldPosition(new THREE.Vector3())
    const camDir = cam.getWorldDirection(new THREE.Vector3())
    const aimTargetWorld = camPos.clone().addScaledVector(camDir, 60.0)
    const aimTargetRigLocal = rigGroupRef.current.worldToLocal(aimTargetWorld.clone())

    const restingNock = new THREE.Vector3(-0.008, 0.0, 0.045)
    // The arrow direction vector points from restingNock straight to the center crosshair aim target!
    const arrowDir = aimTargetRigLocal.clone().sub(restingNock).normalize()

    // When drawing, nock pulls smoothly backward along -arrowDir (+Z):
    const currentNock = restingNock.clone().addScaledVector(arrowDir, -pullDistance)
    currentNock.z += vibZ

    // Update Arrow Group (local nock is at (0, 0, 0), arrow points along -Z)
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
          currentNockPos.y -= (1 - easeSlide) * 0.10
          currentNockPos.x += (1 - easeSlide) * 0.03
        }

        arrowGroupRef.current.position.copy(currentNockPos)
      }
    }

    // ── Update 3-Point Continuous Bowstring: Upper Tip -> Arrow Nock -> Lower Tip ──
    const stringPosAttr = stringGeo.attributes.position as THREE.BufferAttribute
    stringPosAttr.setXYZ(0, upperTipLocal.x, upperTipLocal.y, upperTipLocal.z)
    stringPosAttr.setXYZ(1, currentNock.x, currentNock.y, currentNock.z)
    stringPosAttr.setXYZ(2, lowerTipLocal.x, lowerTipLocal.y, lowerTipLocal.z)
    stringPosAttr.needsUpdate = true
  })

  return (
    <group ref={bowRootRef} renderOrder={100}>
      <group ref={rigGroupRef}>
        {/* ── Viewmodel Lighting: Dedicated illumination rig ensures brass & wood luster ── */}
        <directionalLight position={[0.5, 0.7, 0.8]} intensity={2.8} color="#fff8ee" />
        <ambientLight intensity={1.3} color="#fff2e0" />

        {/* ── 1. Central Carved Mahogany Riser ─────────────────────────────── */}
        <mesh geometry={riserGeo} material={woodMat} position={[0, 0, 0]} castShadow={false} />

        {/* Stitched Leather Hand Grip Wrap */}
        <mesh geometry={gripWrapGeo} material={leatherMat} position={[0, -0.035, 0.0]} />

        {/* ── Golden Brass Collars (Signature Aesthetic from Reference Image 9) ─ */}
        {/* Upper Collar Bracket with Embossed Diamond Crest */}
        <group position={[0, 0.075, 0]}>
          <mesh geometry={collarGeo} material={brassMat} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, 0.014, 0]} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, -0.014, 0]} />
          {/* Diamond Heraldic Plaque (diamond motif facing player/camera flush) */}
          <group position={[-0.007, 0, 0.015]} rotation={[0, -0.08, 0]}>
            <mesh geometry={diamondCrestGeo} material={brassAccentMat} />
            <mesh geometry={flowerEmblemGeo} material={brassMat} position={[0, 0, 0.0018]} />
          </group>
        </group>

        {/* Lower Collar Bracket */}
        <group position={[0, -0.075, 0]}>
          <mesh geometry={collarGeo} material={brassMat} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, 0.014, 0]} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, -0.014, 0]} />
          <group position={[-0.005, 0, 0.015]} rotation={[0, 0.05, 0]}>
            <mesh geometry={diamondCrestGeo} material={brassAccentMat} />
          </group>
        </group>

        {/* ── 2. Upper Recurve Limb ───────────────────────────────────────── */}
        <group ref={upperLimbRef} position={[0, 0.075, 0]}>
          <mesh geometry={upperLimbGeo} material={woodMat} />
          {/* Brass Tip Nock Cap */}
          <mesh geometry={tipCapGeo} material={brassMat} position={[-0.008, 0.33, 0.045]} rotation={[0.08, 0, 0]} />
        </group>

        {/* ── 3. Lower Recurve Limb ───────────────────────────────────────── */}
        <group ref={lowerLimbRef} position={[0, -0.075, 0]}>
          <mesh geometry={lowerLimbGeo} material={woodMat} />
          {/* Brass Tip Nock Cap */}
          <mesh geometry={tipCapGeo} material={brassMat} position={[-0.008, -0.33, 0.045]} rotation={[-0.08, 0, 0]} />
        </group>

        {/* ── 4. Continuous Dynamic Bowstring ─────────────────────────────── */}
        <primitive object={stringLine} />

        {/* ── 5. Nocked Hunting Arrow (Cedar Shaft, Razor Tip, White Vanes) ─── */}
        {/* Anchored at nock: local (0, 0, 0) is clamped to string; local -Z points forward */}
        <group ref={arrowGroupRef}>
          {/* Carved Bone Nock clamped to string (local z = 0) */}
          <mesh geometry={arrowNockGeo} material={arrowNockMat} position={[0, 0, 0]} />

          {/* Cedar Arrow Shaft (extends from z = 0 to z = -0.63) */}
          <mesh geometry={arrowShaftGeo} material={arrowShaftMat} position={[0, 0, 0]} />

          {/* Metal Ferrule Collar at base of broadhead (z = -0.62 to -0.645) */}
          <mesh geometry={ferruleGeo} material={ferruleMat} position={[0, 0, 0]} />

          {/* Polished Razor Silver Broadhead Blade (sharp tip at z = -0.68, pointing forward -Z) */}
          <mesh geometry={arrowTipGeo} material={broadheadMat} position={[0, 0, 0]} />

          {/* 3 White Turkey Feather Fletchings (120 deg apart around rear shaft at z = -0.035 to -0.10) */}
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
            <group key={i} position={[0, 0, 0]} rotation={[0, 0, angle]}>
              <mesh geometry={fletchingGeo} material={fletchMat} position={[0, 0.0035, 0]} />
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}
