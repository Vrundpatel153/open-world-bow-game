// ─────────────────────────────────────────────────────────────────────────────
// BowViewModel — AAA First-Person Hunting Recurve Bow (Target Reference Match)
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
    // 1. Central Carved Mahogany Riser (Height 0.24m)
    // Modeled with an integrated arrow shelf on the inner left face
    const riserShape = new THREE.Shape()
    riserShape.moveTo(-0.015, -0.12)
    riserShape.lineTo(0.015, -0.12)
    riserShape.lineTo(0.017, -0.02)
    riserShape.lineTo(0.017, 0.04)
    riserShape.lineTo(0.015, 0.12)
    riserShape.lineTo(-0.015, 0.12)
    riserShape.lineTo(-0.016, 0.04)
    // Smooth, contoured shelf ledge (zero sharp triangle spikes or disjointed notches)
    riserShape.lineTo(-0.019, 0.02)
    riserShape.lineTo(-0.019, -0.01)
    riserShape.lineTo(-0.016, -0.03)
    riserShape.closePath()

    const riser = new THREE.ExtrudeGeometry(riserShape, {
      depth: 0.032,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.002,
      bevelThickness: 0.002,
    })
    riser.center()

    // 2. Leather Wrapped Grip Handle (Center grip from Y = -0.06 to 0.01)
    const gripWrap = new THREE.CylinderGeometry(0.016, 0.017, 0.075, 14)

    // 3. Golden Brass Reinforcement Collars (Sleek rounded bracket sleeve hugging the limb)
    const collarShape = new THREE.Shape()
    const cw = 0.016
    const cd = 0.011
    const cr = 0.003
    collarShape.moveTo(-cw + cr, -cd)
    collarShape.lineTo(cw - cr, -cd)
    collarShape.quadraticCurveTo(cw, -cd, cw, -cd + cr)
    collarShape.lineTo(cw, cd - cr)
    collarShape.quadraticCurveTo(cw, cd, cw - cr, cd)
    collarShape.lineTo(-cw + cr, cd)
    collarShape.quadraticCurveTo(-cw, cd, -cw, cd - cr)
    collarShape.lineTo(-cw, -cd + cr)
    collarShape.quadraticCurveTo(-cw, -cd, -cw + cr, -cd)
    collarShape.closePath()

    const collar = new THREE.ExtrudeGeometry(collarShape, {
      depth: 0.028,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0015,
      bevelThickness: 0.0015,
    })
    collar.center()
    collar.rotateX(Math.PI / 2) // Orient vertically along Y

    // Flange rims for top and bottom of collars
    const collarRim = new THREE.CylinderGeometry(0.0185, 0.0185, 0.0035, 16)
    collarRim.scale(1.15, 1.0, 0.85)

    // Embossed Diamond Crest (Heraldic diamond plaque on upper collar)
    const diamondShape = new THREE.Shape()
    diamondShape.moveTo(0, 0.012)
    diamondShape.lineTo(0.010, 0)
    diamondShape.lineTo(0, -0.012)
    diamondShape.lineTo(-0.010, 0)
    diamondShape.closePath()

    const diamondCrest = new THREE.ExtrudeGeometry(diamondShape, {
      depth: 0.0025,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.0008,
      bevelThickness: 0.0008,
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
      const y = t * 0.38
      // Recurve arc: arches forward gracefully into -Z, then recurves back near tip
      const x = Math.sin(t * Math.PI * 0.5) * 0.015
      const z = -Math.sin(t * Math.PI * 0.6) * 0.05 + Math.pow(t, 2.0) * 0.09
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

    // Brass reinforced recurve tip caps (protects limb ends, houses string nock)
    const tipCap = new THREE.CylinderGeometry(0.008, 0.013, 0.026, 10)
    tipCap.scale(1.1, 1.0, 0.8)

    // 5. Nocked Hunting Arrow Components (Length 0.72m)
    // Cedar wood shaft: extends from z = 0 (nock) forward to z = -0.66
    const shaft = new THREE.CylinderGeometry(0.0042, 0.0042, 0.66, 8)
    shaft.rotateX(Math.PI / 2) // Orient along Z
    shaft.translate(0, 0, -0.33) // Centered at -0.33, spans [0, -0.66]

    // Metal ferrule collar at base of broadhead (z = -0.66)
    const ferrule = new THREE.CylinderGeometry(0.0052, 0.0045, 0.022, 8)
    ferrule.rotateX(Math.PI / 2)
    ferrule.translate(0, 0, -0.66)

    // Polished Silver Razor Broadhead Blade (sharp point at z = -0.72, pointing forward -Z)
    const tipShape = new THREE.Shape()
    tipShape.moveTo(0, -0.72) // Sharp Point
    tipShape.lineTo(0.015, -0.674) // Right barb extending backward
    tipShape.lineTo(0.004, -0.684)
    tipShape.lineTo(0.004, -0.67)
    tipShape.lineTo(-0.004, -0.67)
    tipShape.lineTo(-0.004, -0.684)
    tipShape.lineTo(-0.015, -0.674) // Left barb extending backward
    tipShape.closePath()

    const tipExtrude = new THREE.ExtrudeGeometry(tipShape, {
      depth: 0.0026,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.001,
      bevelThickness: 0.001,
    })
    tipExtrude.center()
    tipExtrude.translate(0, 0, -0.695)

    // 3 Aerodynamic White Turkey Feathers (Length 0.075m, positioned at z = -0.04 to -0.115)
    const fletchShape = new THREE.Shape()
    fletchShape.moveTo(0, 0)
    fletchShape.lineTo(0.013, -0.012)
    fletchShape.lineTo(0.011, -0.075)
    fletchShape.lineTo(0, -0.068)
    fletchShape.closePath()
    const fletching = new THREE.ShapeGeometry(fletchShape)
    fletching.rotateX(Math.PI / 2)
    fletching.translate(0, 0, -0.04)

    // Carved Bone Nock clamped to string (at z = 0)
    const arrowNock = new THREE.CylinderGeometry(0.005, 0.005, 0.020, 8)
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

        // Launch origin from current arrow broadhead tip in world coordinates
        const arrowTipPos = new THREE.Vector3()
        if (arrowGroupRef.current) {
          arrowGroupRef.current.localToWorld(arrowTipPos.set(0, 0, -0.72))
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
    const cam = state.camera
    bowRootRef.current.position.copy(cam.position)
    bowRootRef.current.quaternion.copy(cam.quaternion)

    const isAiming = (isDrawing.current || useQuestStore.getState().isAiming) && isBowEquipped

    // Base camera-space coordinates:
    const baseLocalX = isAiming ? 0.16 : 0.18
    const baseLocalY = isAiming ? -0.06 : -0.08
    const baseLocalZ = isAiming ? -0.44 : -0.46

    const localX = baseLocalX + swayX.current + bobX + shakeX
    const localY = baseLocalY + swayY.current + bobY + shakeY + (1.0 - equipProgress.current) * -0.5
    const localZ = baseLocalZ + recoilOffset.current

    rigGroupRef.current.position.set(localX, localY, localZ)

    // Orientation: upright recurve with slight natural cant
    const pitchX = -0.02 + recoilRotation.current + swayY.current * 0.25
    const yawY = -0.08 + swayX.current * 0.35
    const rollZ = 0.06 // ~3.5 deg inward cant

    rigGroupRef.current.rotation.set(pitchX, yawY, rollZ, 'YXZ')

    // ── 6. Dynamic Bow Limb Flexing & Bowstring Clamping ─────────────────────
    const tension = drawTension.current
    const pullDistance = 0.16 * tension

    // String vibration on loose
    stringVibration.current = THREE.MathUtils.damp(stringVibration.current, 0, 14, dt)
    const vibZ = Math.sin(state.clock.elapsedTime * 95) * 0.005 * stringVibration.current

    // Limbs flex slightly under tension
    const limbFlex = tension * 0.06
    if (upperLimbRef.current && lowerLimbRef.current) {
      upperLimbRef.current.rotation.x = limbFlex
      lowerLimbRef.current.rotation.x = -limbFlex
    }

    // Arrow Shelf on the inner-left face of the riser:
    const shelfPos = new THREE.Vector3(-0.016, 0.020, 0.005)

    // Aiming Direction in Rig Space (points forward toward center crosshair):
    // In camera space crosshair is at (0, 0, -100). From rig at (+0.18, -0.08, -0.46),
    // vector to crosshair is approximately (-0.17, 0.07, -0.98).
    const arrowDir = new THREE.Vector3(-0.16, 0.06, -0.98).normalize()

    // Resting string sits along brace plane at z ~ 0.065, x ~ 0.012
    // During draw: nock pulls backward along +Z
    const restNockZ = 0.065
    const nockPos = new THREE.Vector3(
      shelfPos.x - arrowDir.x * (restNockZ + pullDistance),
      shelfPos.y - arrowDir.y * (restNockZ + pullDistance),
      restNockZ + pullDistance + vibZ
    )

    // Arrow Group (anchored at nockPos: nock is at local (0, 0, 0))
    if (arrowGroupRef.current) {
      if (isReloading.current && reloadProgress < 0.25) {
        arrowGroupRef.current.visible = false
      } else {
        arrowGroupRef.current.visible = true

        // Orient arrow: local -Z points along arrowDir
        const arrowQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          arrowDir
        )
        arrowGroupRef.current.quaternion.copy(arrowQuat)

        const currentNockPos = nockPos.clone()
        if (isReloading.current) {
          const tSlide = (reloadProgress - 0.25) / 0.75
          const easeSlide = THREE.MathUtils.smoothstep(tSlide, 0, 1)
          currentNockPos.y -= (1 - easeSlide) * 0.10
          currentNockPos.x += (1 - easeSlide) * 0.04
        }

        arrowGroupRef.current.position.copy(currentNockPos)
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
      stringPosAttr.setXYZ(0, 0.015, 0.44, 0.065)
    }

    // 2. Clamped Arrow Nock
    stringPosAttr.setXYZ(1, nockPos.x, nockPos.y, nockPos.z)

    // 3. Lower tip position in rig local space
    if (lowerTipNodeRef.current && rigGroupRef.current) {
      lowerTipNodeRef.current.getWorldPosition(tempTipPos)
      rigGroupRef.current.worldToLocal(tempTipPos)
      stringPosAttr.setXYZ(2, tempTipPos.x, tempTipPos.y, tempTipPos.z)
    } else {
      stringPosAttr.setXYZ(2, 0.015, -0.44, 0.065)
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
          <mesh geometry={collarGeo} material={brassMat} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, 0.014, 0]} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, -0.014, 0]} />
          {/* Diamond Heraldic Plaque (❖ motif facing player/camera) */}
          <group position={[-0.005, 0, 0.014]} rotation={[0, 0.08, 0]}>
            <mesh geometry={diamondCrestGeo} material={brassAccentMat} />
            <mesh geometry={flowerEmblemGeo} material={brassMat} position={[0, 0, 0.002]} />
          </group>
        </group>

        {/* Lower Collar Bracket */}
        <group position={[0, -0.08, 0.002]}>
          <mesh geometry={collarGeo} material={brassMat} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, 0.014, 0]} />
          <mesh geometry={collarRimGeo} material={brassAccentMat} position={[0, -0.014, 0]} />
          <group position={[-0.005, 0, 0.014]} rotation={[0, 0.08, 0]}>
            <mesh geometry={diamondCrestGeo} material={brassAccentMat} />
          </group>
        </group>

        {/* ── 2. Upper Recurve Limb ───────────────────────────────────────── */}
        <group ref={upperLimbRef} position={[0, 0.08, 0]}>
          <mesh geometry={upperLimbGeo} material={woodMat} />
          {/* Brass Tip Nock Cap */}
          <mesh geometry={tipCapGeo} material={brassMat} position={[0.015, 0.38, 0.065]} rotation={[0.15, 0, -0.05]} />
          <group ref={upperTipNodeRef} position={[0.015, 0.38, 0.065]} />
        </group>

        {/* ── 3. Lower Recurve Limb ───────────────────────────────────────── */}
        <group ref={lowerLimbRef} position={[0, -0.08, 0]}>
          <mesh geometry={lowerLimbGeo} material={woodMat} />
          {/* Brass Tip Nock Cap */}
          <mesh geometry={tipCapGeo} material={brassMat} position={[0.015, -0.38, 0.065]} rotation={[-0.15, 0, -0.05]} />
          <group ref={lowerTipNodeRef} position={[0.015, -0.38, 0.065]} />
        </group>

        {/* ── 4. Continuous Dynamic Bowstring ─────────────────────────────── */}
        <primitive object={stringLine} />

        {/* ── 5. Nocked Hunting Arrow (Cedar Shaft, Razor Tip, White Vanes) ─── */}
        {/* Anchored at nock: local (0, 0, 0) is clamped to string; local -Z points forward */}
        <group ref={arrowGroupRef}>
          {/* Carved Bone Nock clamped to string (local z = 0) */}
          <mesh geometry={arrowNockGeo} material={arrowNockMat} position={[0, 0, 0]} />

          {/* Cedar Arrow Shaft (extends from z = 0 to z = -0.66) */}
          <mesh geometry={arrowShaftGeo} material={arrowShaftMat} position={[0, 0, 0]} />

          {/* Metal Ferrule Collar at base of broadhead (z = -0.66) */}
          <mesh geometry={ferruleGeo} material={ferruleMat} position={[0, 0, 0]} />

          {/* Polished Razor Silver Broadhead Blade (sharp tip at z = -0.72, pointing forward -Z) */}
          <mesh geometry={arrowTipGeo} material={broadheadMat} position={[0, 0, 0]} />

          {/* 3 White Turkey Feather Fletchings (120 deg apart around rear shaft at z = -0.04 to -0.115) */}
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
            <group key={i} position={[0, 0, 0]} rotation={[0, 0, angle]}>
              <mesh geometry={fletchingGeo} material={fletchMat} position={[0, 0.004, 0]} />
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}
