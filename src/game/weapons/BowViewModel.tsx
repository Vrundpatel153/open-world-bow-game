// ─────────────────────────────────────────────────────────────────────────────
// BowViewModel — AAA First-Person Hunting Recurve Bow (Target Reference Match)
//
// Strictly engineered to match the reference weapon design (Image 9):
// 1. Bow Positioning: Stands vertically on the right side of the screen, with
//    its carved mahogany & golden brass grip in the lower-right foreground.
// 2. Arrow Positioning: Sits naturally on the inner shelf on the left of the grip,
//    shaft aligned diagonally forward towards the center crosshair.
// 3. Bowstring: Continuous taut string connecting upper tip -> arrow nock -> lower tip,
//    following limb curvature and flex.
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
  const rigGroupRef = useRef<THREE.Group>(null!)
  const arrowGroupRef = useRef<THREE.Group>(null!)
  const upperLimbRef = useRef<THREE.Group>(null!)
  const lowerLimbRef = useRef<THREE.Group>(null!)
  const upperTipNodeRef = useRef<THREE.Group>(null!)
  const lowerTipNodeRef = useRef<THREE.Group>(null!)

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
    upperCollarGeo,
    lowerCollarGeo,
    collarRimGeo,
    diamondCrestGeo,
    flowerEmblemGeo,
    upperLimbGeo,
    lowerLimbGeo,
    arrowShaftGeo,
    arrowTipGeo,
    ferruleGeo,
    fletchingGeo,
    arrowNockGeo,
  } = useMemo(() => {
    // 1. Central Carved Mahogany Riser (Height 0.22m)
    // Sculpted organic grip with clean, integrated shelf recess on the inner-left
    const riserShape = new THREE.Shape()
    riserShape.moveTo(-0.015, -0.11)
    riserShape.lineTo(0.015, -0.11)
    riserShape.lineTo(0.017, -0.02)
    riserShape.lineTo(0.017, 0.04)
    riserShape.lineTo(0.015, 0.11)
    riserShape.lineTo(-0.015, 0.11)
    riserShape.lineTo(-0.017, 0.04)
    // Smooth shelf ledge (clean transition, zero jagged triangle spikes)
    riserShape.lineTo(-0.020, 0.02)
    riserShape.lineTo(-0.020, -0.01)
    riserShape.lineTo(-0.017, -0.03)
    riserShape.closePath()

    const riser = new THREE.ExtrudeGeometry(riserShape, {
      depth: 0.032,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.0025,
      bevelThickness: 0.0025,
    })
    riser.center()

    // 2. Leather Wrapped Grip Handle (Center grip from Y = -0.05 to 0.01)
    const gripWrap = new THREE.CylinderGeometry(0.017, 0.018, 0.075, 14)

    // 3. Golden Brass Reinforcement Collars (Signature feature in Reference Image 9)
    const upperCollar = new THREE.BoxGeometry(0.038, 0.030, 0.040)
    const lowerCollar = new THREE.BoxGeometry(0.038, 0.030, 0.040)
    const collarRim = new THREE.BoxGeometry(0.042, 0.005, 0.044)

    // Embossed Diamond Crest (Heraldic diamond plaque on upper collar)
    const diamondShape = new THREE.Shape()
    diamondShape.moveTo(0, 0.013)
    diamondShape.lineTo(0.010, 0)
    diamondShape.lineTo(0, -0.013)
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

    // 4-petal flower motif inside diamond
    const flowerShape = new THREE.Shape()
    flowerShape.moveTo(0, 0.004)
    flowerShape.lineTo(0.002, 0.002)
    flowerShape.lineTo(0.004, 0)
    flowerShape.lineTo(0.002, -0.002)
    flowerShape.lineTo(0, -0.004)
    flowerShape.lineTo(-0.002, -0.002)
    flowerShape.lineTo(-0.004, 0)
    flowerShape.lineTo(-0.002, 0.002)
    flowerShape.closePath()
    const flowerEmblem = new THREE.ExtrudeGeometry(flowerShape, {
      depth: 0.002,
      bevelEnabled: false,
    })
    flowerEmblem.center()

    // 4. Upper & Lower Recurve Limbs (Wide, flat beveled wooden planks from Reference Image 9)
    const upperPoints: THREE.Vector3[] = []
    const lowerPoints: THREE.Vector3[] = []

    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      const y = t * 0.32
      // Recurve arc: arches forward gracefully, then recurves back near tip
      const x = Math.sin(t * Math.PI * 0.5) * 0.02
      const z = Math.sin(t * Math.PI * 0.65) * 0.05 + Math.pow(t, 2.2) * 0.025
      upperPoints.push(new THREE.Vector3(x, y, z))
      lowerPoints.push(new THREE.Vector3(x, -y, z))
    }

    const upperCurve = new THREE.CatmullRomCurve3(upperPoints)
    const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints)

    // Flat beveled plank cross-section (width 26mm, thickness 10mm)
    const plankShape = new THREE.Shape()
    plankShape.moveTo(-0.013, -0.005)
    plankShape.lineTo(0.013, -0.005)
    plankShape.lineTo(0.013, 0.005)
    plankShape.lineTo(-0.013, 0.005)
    plankShape.closePath()

    const upperLimb = new THREE.ExtrudeGeometry(plankShape, {
      extrudePath: upperCurve,
      steps: 24,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0015,
      bevelThickness: 0.0015,
    })
    const lowerLimb = new THREE.ExtrudeGeometry(plankShape, {
      extrudePath: lowerCurve,
      steps: 24,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0015,
      bevelThickness: 0.0015,
    })

    // 5. Nocked Hunting Arrow Components (Length 0.72m)
    // Cedar wood shaft (diameter 9mm, length 0.68m, centered along Z)
    const shaft = new THREE.CylinderGeometry(0.0045, 0.0045, 0.68, 8)
    shaft.rotateX(Math.PI / 2) // Orient along Z

    // Metal ferrule collar
    const ferrule = new THREE.CylinderGeometry(0.0055, 0.0048, 0.024, 8)
    ferrule.rotateX(Math.PI / 2)

    // Polished Silver Razor Broadhead Blade (sharp point facing -Z, pointing forward into screen)
    const tipShape = new THREE.Shape()
    tipShape.moveTo(0, 0.0) // Point
    tipShape.lineTo(0.016, 0.048) // Right barb extending backward
    tipShape.lineTo(0.005, 0.038)
    tipShape.lineTo(0.005, 0.052)
    tipShape.lineTo(-0.005, 0.052)
    tipShape.lineTo(-0.005, 0.038)
    tipShape.lineTo(-0.016, 0.048) // Left barb extending backward
    tipShape.closePath()

    const tipExtrude = new THREE.ExtrudeGeometry(tipShape, {
      depth: 0.0028,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0012,
      bevelThickness: 0.0012,
    })
    tipExtrude.center()
    tipExtrude.rotateX(Math.PI / 2) // Orient flat in XY

    // 3 Aerodynamic White Turkey Feathers (Matches Reference Image)
    const fletchShape = new THREE.Shape()
    fletchShape.moveTo(0, 0)
    fletchShape.lineTo(0.015, 0.014)
    fletchShape.lineTo(0.012, 0.088)
    fletchShape.lineTo(0, 0.078)
    fletchShape.closePath()
    const fletching = new THREE.ShapeGeometry(fletchShape)
    fletching.rotateX(Math.PI / 2)

    // Carved Bone Nock
    const arrowNock = new THREE.CylinderGeometry(0.0052, 0.0052, 0.022, 8)
    arrowNock.rotateX(Math.PI / 2)

    return {
      riserGeo: riser,
      gripWrapGeo: gripWrap,
      upperCollarGeo: upperCollar,
      lowerCollarGeo: lowerCollar,
      collarRimGeo: collarRim,
      diamondCrestGeo: diamondCrest,
      flowerEmblemGeo: flowerEmblem,
      upperLimbGeo: upperLimb,
      lowerLimbGeo: lowerLimb,
      arrowShaftGeo: shaft,
      arrowTipGeo: tipExtrude,
      ferruleGeo: ferrule,
      fletchingGeo: fletching,
      arrowNockGeo: arrowNock,
    }
  }, [])

  // ── Materials (Rich Warm Fantasy PBR from Reference Image) ─────────────────
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
      color: '#4e2814',
      roughness: 0.36,
      metalness: 0.04,
    })

    // Stitched leather grip wrap
    const leather = new THREE.MeshStandardMaterial({
      color: '#2c190d',
      roughness: 0.82,
      metalness: 0.02,
    })

    // Polished antique golden brass collars
    const brass = new THREE.MeshStandardMaterial({
      color: '#d8aa36',
      roughness: 0.26,
      metalness: 0.88,
    })

    // Bright golden brass accent for embossed diamond crest
    const brassAccent = new THREE.MeshStandardMaterial({
      color: '#f0c858',
      roughness: 0.20,
      metalness: 0.92,
    })

    // Taut white woven bowstring
    const string = new THREE.LineBasicMaterial({
      color: '#f8fafc',
      linewidth: 2,
    })

    // Warm cedar arrow shaft
    const arrowShaft = new THREE.MeshStandardMaterial({
      color: '#764825',
      roughness: 0.42,
      metalness: 0.05,
    })

    // Polished razor silver broadhead blade
    const broadhead = new THREE.MeshStandardMaterial({
      color: '#edf2f7',
      roughness: 0.18,
      metalness: 0.96,
    })

    // Dark steel ferrule collar
    const ferrule = new THREE.MeshStandardMaterial({
      color: '#383d42',
      roughness: 0.32,
      metalness: 0.85,
    })

    // Crisp aerodynamic white turkey feathers
    const fletch = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.50,
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

        // ── Physics: Launch arrow precisely through center crosshair ───────
        const camPos = camera.getWorldPosition(new THREE.Vector3())
        const camDir = camera.getWorldDirection(new THREE.Vector3())
        const targetPoint = camPos.clone().addScaledVector(camDir, 140.0)

        // Launch origin from current arrow tip in world coordinates
        const arrowTipPos = new THREE.Vector3()
        if (arrowGroupRef.current) {
          arrowGroupRef.current.localToWorld(arrowTipPos.set(0, 0, -0.36))
        } else {
          arrowTipPos.copy(camPos).addScaledVector(camDir, 0.6)
        }

        const fireDir = targetPoint.clone().sub(arrowTipPos).normalize()
        onFireArrow(arrowTipPos, fireDir, power)

        // Recoil kickback animation
        recoilOffset.current = 0.04 * power
        recoilRotation.current = -0.05 * power
        stringVibration.current = 1.0

        isDrawing.current = false
        drawTension.current = 0
        setDrawProgress(0)

        // Reload Cycle (fresh arrow slides onto shelf)
        isReloading.current = true
        reloadTimer.current = 0.32
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
        reloadProgress = 1.0 - reloadTimer.current / 0.32
      }
    }

    // 2. Draw Tension Physics
    if (isDrawing.current && isBowEquipped) {
      const prev = drawTension.current
      drawTension.current = Math.min(1.0, drawTension.current + dt * 2.4)
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
      const tremor = (drawTension.current - 0.85) * 0.004
      shakeX = (Math.random() - 0.5) * tremor
      shakeY = (Math.random() - 0.5) * tremor
    }

    // 3. Mouse Look Inertia & Weapon Sway
    const mouseDx = inputManager.mouseDeltaX || 0
    const mouseDy = inputManager.mouseDeltaY || 0

    swayVelX.current += -mouseDx * 0.00022
    swayVelY.current += mouseDy * 0.00022

    swayX.current += swayVelX.current * dt
    swayY.current += swayVelY.current * dt
    swayVelX.current = THREE.MathUtils.damp(swayVelX.current, -swayX.current * 28, 22, dt)
    swayVelY.current = THREE.MathUtils.damp(swayVelY.current, -swayY.current * 28, 22, dt)
    swayX.current = Math.max(-0.03, Math.min(0.03, swayX.current))
    swayY.current = Math.max(-0.03, Math.min(0.03, swayY.current))

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

    const bobX = Math.cos(walkBobTimer.current * 0.5) * (isMoving ? 0.006 : 0.0015)
    const bobY = Math.sin(walkBobTimer.current) * (isMoving ? 0.009 : 0.002)

    // Recoil recovery
    recoilOffset.current = THREE.MathUtils.damp(recoilOffset.current, 0, 14, dt)
    recoilRotation.current = THREE.MathUtils.damp(recoilRotation.current, 0, 12, dt)

    // ── 5. Stance & Positioning (Exact Match with Reference Image 9) ─────────
    // Bow Root follows Camera position & orientation in world space
    const cam = state.camera
    bowRootRef.current.position.copy(cam.position)
    bowRootRef.current.quaternion.copy(cam.quaternion)

    // In Reference Image 9:
    // - Bow stands vertically in the right 35% of the screen.
    // - Grip is in lower-right foreground.
    // - Arrow rests on inner left shelf, pointing diagonally forward to screen center crosshair.
    const isAiming = (isDrawing.current || useQuestStore.getState().isAiming) && isBowEquipped

    // Base camera-space coordinates for the bow riser:
    const baseLocalX = isAiming ? 0.20 : 0.22
    const baseLocalY = isAiming ? -0.05 : -0.06
    const baseLocalZ = isAiming ? -0.48 : -0.50

    const localX = baseLocalX + swayX.current + bobX + shakeX
    const localY = baseLocalY + swayY.current + bobY + shakeY + (1.0 - equipProgress.current) * -0.5
    const localZ = baseLocalZ + recoilOffset.current

    rigGroupRef.current.position.set(localX, localY, localZ)

    // Bow orientation: vertical, slight inward angle toward target
    const pitchX = -0.02 + recoilRotation.current + swayY.current * 0.25
    const yawY = -0.06 + swayX.current * 0.35
    const rollZ = 0.05 // slight natural inward cant (~3 deg)

    rigGroupRef.current.rotation.set(pitchX, yawY, rollZ, 'YXZ')

    // ── 6. Dynamic Bow Limb Flexing & Bowstring Clamping ─────────────────────
    const tension = drawTension.current
    const pullDistance = 0.16 * tension

    // String vibration on loose
    stringVibration.current = THREE.MathUtils.damp(stringVibration.current, 0, 14, dt)
    const vibZ = Math.sin(state.clock.elapsedTime * 95) * 0.005 * stringVibration.current

    // Limbs flex slightly under tension
    const limbFlex = tension * 0.05
    if (upperLimbRef.current && lowerLimbRef.current) {
      upperLimbRef.current.rotation.x = limbFlex
      lowerLimbRef.current.rotation.x = -limbFlex
    }

    // Limb tips in rig local space:
    // Upper tip at Y ~ +0.28, Lower tip at Y ~ -0.26
    const upperTip = new THREE.Vector3(0.04, 0.28 - limbFlex * 0.015, 0.09 + limbFlex * 0.03)
    const lowerTip = new THREE.Vector3(0.04, -0.26 + limbFlex * 0.015, 0.09 + limbFlex * 0.03)

    // Arrow Shelf on the inner-left face of the riser:
    const shelfPos = new THREE.Vector3(-0.020, 0.015, 0.0)

    // Aiming Direction in Rig Space (points forward into screen toward crosshair):
    // In camera space, center crosshair is at (0, 0, -100).
    const arrowDir = new THREE.Vector3(-0.35, 0.07, -0.93).normalize()

    // Arrow Nock clamping to string:
    // In idle: nock rests ~0.20m behind the shelf.
    // In draw: pulls backward along -arrowDir by pullDistance.
    const idleNockDist = 0.20
    const totalNockDist = idleNockDist + pullDistance

    const nockPos = new THREE.Vector3(
      shelfPos.x - arrowDir.x * totalNockDist,
      shelfPos.y - arrowDir.y * totalNockDist,
      shelfPos.z - arrowDir.z * totalNockDist + vibZ
    )

    // Arrow Group (holds shaft, broadhead, fletchings, and nock):
    if (arrowGroupRef.current) {
      if (isReloading.current && reloadProgress < 0.25) {
        arrowGroupRef.current.visible = false
      } else {
        arrowGroupRef.current.visible = true

        // Orient arrow along arrowDir: local -Z points along arrowDir
        const arrowQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          arrowDir
        )
        arrowGroupRef.current.quaternion.copy(arrowQuat)

        // Arrow position along shelf:
        // Broadhead tip is at local z = -0.36, shelf at z = 0, nock at z = +0.20
        const currentArrowPos = shelfPos.clone().addScaledVector(arrowDir, -pullDistance)

        // Reload animation: arrow slides up onto shelf
        if (isReloading.current) {
          const tSlide = (reloadProgress - 0.25) / 0.75
          const easeSlide = THREE.MathUtils.smoothstep(tSlide, 0, 1)
          currentArrowPos.y -= (1 - easeSlide) * 0.12
          currentArrowPos.x += (1 - easeSlide) * 0.04
          currentArrowPos.z += (1 - easeSlide) * 0.06
        }

        arrowGroupRef.current.position.copy(currentArrowPos)
      }
    }

    // Update 3-Point Continuous Bowstring: Upper Tip -> Arrow Nock -> Lower Tip
    const stringPosAttr = stringGeo.attributes.position as THREE.BufferAttribute
    const tempTipPos = new THREE.Vector3()

    // 1. Upper tip position in rig local space
    if (upperTipNodeRef.current && rigGroupRef.current) {
      upperTipNodeRef.current.getWorldPosition(tempTipPos)
      rigGroupRef.current.worldToLocal(tempTipPos)
      stringPosAttr.setXYZ(0, tempTipPos.x, tempTipPos.y, tempTipPos.z)
    } else {
      stringPosAttr.setXYZ(0, 0.02, 0.40, 0.075)
    }

    // 2. Clamped Arrow Nock
    stringPosAttr.setXYZ(1, nockPos.x, nockPos.y, nockPos.z)

    // 3. Lower tip position in rig local space
    if (lowerTipNodeRef.current && rigGroupRef.current) {
      lowerTipNodeRef.current.getWorldPosition(tempTipPos)
      rigGroupRef.current.worldToLocal(tempTipPos)
      stringPosAttr.setXYZ(2, tempTipPos.x, tempTipPos.y, tempTipPos.z)
    } else {
      stringPosAttr.setXYZ(2, 0.02, -0.40, 0.075)
    }
    stringPosAttr.needsUpdate = true
  })

  return (
    <group ref={bowRootRef} renderOrder={100}>
      <group ref={rigGroupRef}>
        {/* ── Viewmodel Lighting: Dedicated illumination rig ensures brass & wood luster ── */}
        <directionalLight position={[0.5, 0.7, 0.8]} intensity={2.6} color="#fff8ee" />
        <ambientLight intensity={1.2} color="#fff2e0" />

        {/* ── 1. Central Carved Mahogany Riser ─────────────────────────────── */}
        <mesh geometry={riserGeo} material={woodMat} position={[0, 0, 0]} castShadow={false} />

        {/* Stitched Leather Hand Grip Wrap */}
        <mesh geometry={gripWrapGeo} material={leatherMat} position={[0, -0.02, 0.003]} />

        {/* ── Golden Brass Collars (Signature Aesthetic from Reference Image 9) ─ */}
        {/* Upper Collar Bracket with Embossed Diamond Crest */}
        <group position={[0, 0.08, 0.002]}>
          <mesh geometry={upperCollarGeo} material={brassMat} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, 0.015, 0]} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, -0.015, 0]} />
          {/* Diamond Heraldic Plaque (❖ motif facing player/camera) */}
          <group position={[-0.006, 0, 0.022]} rotation={[0, 0.10, 0]}>
            <mesh geometry={diamondCrestGeo} material={brassAccentMat} />
            <mesh geometry={flowerEmblemGeo} material={brassMat} position={[0, 0, 0.002]} />
          </group>
        </group>

        {/* Lower Collar Bracket */}
        <group position={[0, -0.08, 0.002]}>
          <mesh geometry={lowerCollarGeo} material={brassMat} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, 0.015, 0]} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, -0.015, 0]} />
          <group position={[-0.006, 0, 0.022]} rotation={[0, 0.10, 0]}>
            <mesh geometry={diamondCrestGeo} material={brassAccentMat} />
          </group>
        </group>

        {/* ── 2. Upper Recurve Limb ───────────────────────────────────────── */}
        <group ref={upperLimbRef} position={[0, 0.08, 0]}>
          <mesh geometry={upperLimbGeo} material={woodMat} />
          <group ref={upperTipNodeRef} position={[0.02, 0.32, 0.075]} />
        </group>

        {/* ── 3. Lower Recurve Limb ───────────────────────────────────────── */}
        <group ref={lowerLimbRef} position={[0, -0.08, 0]}>
          <mesh geometry={lowerLimbGeo} material={woodMat} />
          <group ref={lowerTipNodeRef} position={[0.02, -0.32, 0.075]} />
        </group>

        {/* ── 4. Continuous Dynamic Bowstring ─────────────────────────────── */}
        <primitive object={stringLine} />

        {/* ── 5. Nocked Hunting Arrow (Cedar Shaft, Razor Tip, White Vanes) ─── */}
        {/* Arrow rests directly on shelf; local -Z points forward along flight direction */}
        <group ref={arrowGroupRef}>
          {/* Cedar Arrow Shaft (Length 0.68m, centered at z = -0.08, extends from -0.34 to +0.20) */}
          <mesh geometry={arrowShaftGeo} material={arrowShaftMat} position={[0, 0, -0.08]} />

          {/* Metal Ferrule Collar at base of broadhead (z = -0.34) */}
          <mesh geometry={ferruleGeo} material={ferruleMat} position={[0, 0, -0.34]} />

          {/* Polished Razor Silver Broadhead Blade (sharp tip at z = -0.36, pointing forward -Z) */}
          <mesh geometry={arrowTipGeo} material={broadheadMat} position={[0, 0, -0.36]} />

          {/* Carved Bone Nock clamped to string (z = +0.20) */}
          <mesh geometry={arrowNockGeo} material={arrowNockMat} position={[0, 0, 0.20]} />

          {/* 3 White Turkey Feather Fletchings (120 deg apart around rear shaft at z = +0.12) */}
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
            <group key={i} position={[0, 0, 0.12]} rotation={[0, 0, angle]}>
              <mesh geometry={fletchingGeo} material={fletchMat} position={[0, 0.005, 0]} />
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}
