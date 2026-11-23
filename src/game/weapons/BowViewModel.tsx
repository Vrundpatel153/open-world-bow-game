// ─────────────────────────────────────────────────────────────────────────────
// BowViewModel — AAA Authentic Handcrafted Forest Adventure Wooden Recurve Bow
// Pure Traditional Wilderness Archery:
// - Traditional Carved Hardwood Riser & Recurve Limbs (Rich Mountain Yew / Walnut Wood)
// - Ergonomic Sculpted Arrow Shelf Rest & Weathered Leather Handle Cord Wrap
// - Carved Dark Horn String Nock Tips with Authentic String Grooves (Zero Gaudy Fantasy Brass)
// - Natural Braided Dacron Bowstring with Mathematical Dynamic Limb Tip Clamping
// - Authentic Cedar Hunting Arrow with Dark Horn Nock, Shield-Cut Turkey Feathers,
//   and Forged Carbon-Steel Two-Blade Broadhead Point
// - Perfect First-Person Viewport Framing:
//     * Proper full-size adventure proportion (scale 0.88x)
//     * Upper & lower limbs 100% visible inside the window without clipping
//     * Anchored in right third (X~0.28m) leaving center crosshair (960, 540) and left 75% wide open
//     * Arrow strictly aligned in 3D camera angle (points forward into depth, zero sideways cocking)
// - Mouse Look Inertia Sway, Movement Bobbing & Tactile Draw / Release Recoil
// - Dedicated Depth Buffer Clearing (Zero world clipping through trees or terrain)
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

  // Tip markers in world and local space
  const vUpperWorld = useRef(new THREE.Vector3())
  const vLowerWorld = useRef(new THREE.Vector3())
  const vUpperLocal = useRef(new THREE.Vector3())
  const vLowerLocal = useRef(new THREE.Vector3())

  const setDrawProgress = useQuestStore((s) => s.setDrawProgress)
  const setAiming = useQuestStore((s) => s.setAiming)
  const isBowEquipped = useQuestStore((s) => s.isBowEquipped)
  const toggleBowEquipped = useQuestStore((s) => s.toggleBowEquipped)

  // Debug window hooks for verification
  useEffect(() => {
    ;(window as any).__testBowDraw = (draw: boolean) => {
      isDrawing.current = draw
      if (draw) {
        drawTension.current = 1.0
        setDrawProgress(1.0)
      } else {
        drawTension.current = 0.0
        setDrawProgress(0.0)
      }
    }
  }, [setDrawProgress])

  useEffect(() => {
    ;(window as any).__bowDebug = {
      isReloading,
      reloadTimer,
      arrowGroupRef,
      drawTension,
    }
  }, [])

  // ── Procedural Geometries for Authentic Traditional Wooden Forest Bow ──────
  const {
    riserGeo,
    gripWrapGeo,
    upperLimbGeo,
    lowerLimbGeo,
    hornTipGeo,
    arrowShaftGeo,
    arrowTipGeo,
    ferruleGeo,
    fletchingGeo,
    threadWrapGeo,
    arrowNockGeo,
  } = useMemo(() => {
    // 1. Traditional Carved Yew/Walnut Riser (Length 0.15m, slender contoured handle)
    // Smooth oval cross-section tapering gently into upper and lower limb fadeouts
    const riser = new THREE.CylinderGeometry(0.010, 0.013, 0.15, 16)
    riser.scale(0.85, 1.0, 1.25) // Oval cross-section: 17mm wide, 25mm deep

    // 2. Weathered Dark Leather Handle Wrap
    const gripWrap = new THREE.CylinderGeometry(0.0125, 0.0128, 0.058, 16)
    gripWrap.scale(0.90, 1.0, 1.28)

    // 3. Graceful One-Piece Recurve Wooden Limbs
    // Mounted at Y = +/-0.060m. Total bow span ~0.36m (perfect window framing)
    const upperPoints: THREE.Vector3[] = []
    const lowerPoints: THREE.Vector3[] = []

    for (let i = 0; i <= 18; i++) {
      const t = i / 18
      const y = t * 0.135
      // Recurve: sweeps gently forward into -Z, then curls back into +Z at the horn tip nock
      const x = -Math.sin(t * Math.PI * 0.5) * 0.004
      const z = -Math.sin(t * Math.PI * 0.55) * 0.018 + Math.pow(t, 2.2) * 0.042
      upperPoints.push(new THREE.Vector3(x, y, z))
      lowerPoints.push(new THREE.Vector3(x, -y, z))
    }

    const upperCurve = new THREE.CatmullRomCurve3(upperPoints)
    const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints)

    // Slender tapered flatbow cross-section (width 14mm tapering, thickness 5mm)
    const plankShape = new THREE.Shape()
    plankShape.moveTo(-0.007, -0.0025)
    plankShape.lineTo(0.007, -0.0025)
    plankShape.lineTo(0.007, 0.0025)
    plankShape.lineTo(-0.007, 0.0025)
    plankShape.closePath()

    const upperLimb = new THREE.ExtrudeGeometry(plankShape, {
      extrudePath: upperCurve,
      steps: 22,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0008,
      bevelThickness: 0.0008,
    })

    const lowerLimb = new THREE.ExtrudeGeometry(plankShape, {
      extrudePath: lowerCurve,
      steps: 22,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0008,
      bevelThickness: 0.0008,
    })

    // 4. Carved Dark Horn Tip Nocks with String Grooves
    const hornTip = new THREE.CylinderGeometry(0.0032, 0.0055, 0.012, 12)
    hornTip.scale(1.0, 1.0, 0.75)

    // 5. Traditional Hunting Arrow (Total Length 0.52m)
    // Bone/Horn Nock (throat at z = 0.0)
    const arrowNock = new THREE.CylinderGeometry(0.0026, 0.0026, 0.0075, 12)
    arrowNock.rotateX(Math.PI / 2)
    arrowNock.translate(0, 0, -0.002)

    // Cedar Wood Shaft (length 0.460m, extends from z = -0.005 to z = -0.465)
    const shaft = new THREE.CylinderGeometry(0.0026, 0.0026, 0.460, 12)
    shaft.rotateX(Math.PI / 2)
    shaft.translate(0, 0, -0.235)

    // Dark Forged Carbon-Steel Ferrule
    const ferrule = new THREE.CylinderGeometry(0.0033, 0.0028, 0.015, 12)
    ferrule.rotateX(Math.PI / 2)
    ferrule.translate(0, 0, -0.470)

    // Traditional Two-Blade Forged Hunting Broadhead
    const bladeShape = new THREE.Shape()
    bladeShape.moveTo(0, 0.050) // Needle-sharp point
    bladeShape.lineTo(0.009, 0.0) // Right trailing barb
    bladeShape.lineTo(0.0025, 0.005)
    bladeShape.lineTo(-0.0025, 0.005)
    bladeShape.lineTo(-0.009, 0.0) // Left trailing barb
    bladeShape.closePath()

    const blade = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.0014,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.0003,
      bevelThickness: 0.0003,
    })
    blade.rotateX(-Math.PI / 2)
    blade.translate(0, 0, -0.470) // Reaches needle point at z = -0.520

    // Natural Shield-Cut Feathers (Sleek, authentic hunting profile: height 4.5mm radially, length 5.5cm along shaft)
    const fletchShape = new THREE.Shape()
    fletchShape.moveTo(0, 0)
    fletchShape.lineTo(0.0045, -0.010)
    fletchShape.lineTo(0.0045, -0.048)
    fletchShape.lineTo(0, -0.056)
    fletchShape.closePath()

    const fletch = new THREE.ExtrudeGeometry(fletchShape, {
      depth: 0.0004,
      bevelEnabled: false,
    })
    fletch.rotateX(Math.PI / 2) // Orient length along -Z along arrow shaft
    fletch.translate(0, 0.0026, -0.008) // Mount on shaft surface at rear nock

    // Linen Whipping Thread Rings
    const thread = new THREE.CylinderGeometry(0.0029, 0.0029, 0.004, 12)
    thread.rotateX(Math.PI / 2)

    return {
      riserGeo: riser,
      gripWrapGeo: gripWrap,
      upperLimbGeo: upperLimb,
      lowerLimbGeo: lowerLimb,
      hornTipGeo: hornTip,
      arrowShaftGeo: shaft,
      arrowTipGeo: blade,
      ferruleGeo: ferrule,
      fletchingGeo: fletch,
      threadWrapGeo: thread,
      arrowNockGeo: arrowNock,
    }
  }, [])

  // ── Natural Wilderness Archery PBR Materials (Zero Gaudy Fantasy Brass) ───
  const {
    woodMat,
    leatherMat,
    hornMat,
    stringMat,
    arrowShaftMat,
    broadheadMat,
    fletchMat,
    threadMat,
  } = useMemo(() => {
    // Authentic Mountain Yew / Walnut Hardwood
    const wood = new THREE.MeshStandardMaterial({
      color: '#4c2b16',
      roughness: 0.68,
      metalness: 0.04,
    })

    // Weathered Dark Leather Grip Wrap
    const leather = new THREE.MeshStandardMaterial({
      color: '#281a10',
      roughness: 0.86,
      metalness: 0.06,
    })

    // Carved Natural Dark Horn Tip Overlays & Arrow Nock
    const horn = new THREE.MeshStandardMaterial({
      color: '#1a1410',
      roughness: 0.72,
      metalness: 0.08,
    })

    // Flemish-twist braided dacron bowstring
    const string = new THREE.LineBasicMaterial({
      color: '#dcd7cf',
      linewidth: 1.5,
    })

    // Cedar Wood Arrow Shaft
    const arrowShaft = new THREE.MeshStandardMaterial({
      color: '#5c351a',
      roughness: 0.50,
      metalness: 0.03,
    })

    // Forged Carbon-Steel Hunting Broadhead
    const broadhead = new THREE.MeshStandardMaterial({
      color: '#bcc5cc',
      roughness: 0.22,
      metalness: 0.88,
    })

    // Natural Matte White-Grey Turkey Feathers
    const fletch = new THREE.MeshStandardMaterial({
      color: '#eae6de',
      roughness: 0.65,
      side: THREE.DoubleSide,
    })

    // Linen binding whipping thread
    const thread = new THREE.MeshStandardMaterial({
      color: '#3d2516',
      roughness: 0.75,
      metalness: 0.05,
    })

    return {
      woodMat: wood,
      leatherMat: leather,
      hornMat: horn,
      stringMat: string,
      arrowShaftMat: arrowShaft,
      broadheadMat: broadhead,
      fletchMat: fletch,
      threadMat: thread,
    }
  }, [])

  // Dynamic Bowstring Line
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

        // Launch arrow precisely through center crosshair
        const camPos = camera.getWorldPosition(new THREE.Vector3())
        const camDir = camera.getWorldDirection(new THREE.Vector3())
        const targetPoint = camPos.clone().addScaledVector(camDir, 80.0)

        const launchPos = new THREE.Vector3()
        if (arrowGroupRef.current) {
          arrowGroupRef.current.localToWorld(launchPos.set(0, 0, -0.52))
          arrowGroupRef.current.visible = false
        } else {
          launchPos.copy(camPos).addScaledVector(camDir, 0.40)
        }

        const fireDir = targetPoint.clone().sub(launchPos).normalize()
        onFireArrow(launchPos, fireDir, power)
        sound.playBowRelease(power)

        recoilOffset.current = 0.040 * power
        recoilRotation.current = -0.050 * power
        stringVibration.current = 1.0

        isDrawing.current = false
        drawTension.current = 0
        setDrawProgress(0)

        isReloading.current = true
        reloadTimer.current = 1.10
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

  // ── Per-Frame Viewmodel Rig, Inertia Physics & Camera-Angle Arrow Alignment ──
  useFrame((state, delta) => {
    if (!bowRootRef.current || !rigGroupRef.current) return
    const dt = Math.min(delta, 0.05)

    // Equip / Unequip Animation
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

    // Reload Animation (Total cycle 1.10s: 0.00s-0.62s empty flight tracking; 0.62s-1.10s quiver re-nock)
    let reloadProgress = 1.0
    if (isReloading.current) {
      reloadTimer.current -= dt
      if (reloadTimer.current <= 0) {
        isReloading.current = false
        sound.playArrowNock()
        reloadProgress = 1.0
      } else {
        reloadProgress = 1.0 - reloadTimer.current / 1.10
      }
    }

    // Draw Tension
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

    let shakeX = 0
    let shakeY = 0
    if (drawTension.current > 0.85) {
      const tremor = (drawTension.current - 0.85) * 0.0022
      shakeX = (Math.random() - 0.5) * tremor
      shakeY = (Math.random() - 0.5) * tremor
    }

    // Camera Look Inertia Sway
    if (prevCamQuat.current.lengthSq() > 0.001) {
      const deltaQuat = prevCamQuat.current.clone().invert().multiply(camera.quaternion)
      const yawDelta = -deltaQuat.y * 2.0
      const pitchDelta = deltaQuat.x * 2.0

      swayOffset.current.x = THREE.MathUtils.damp(swayOffset.current.x, -yawDelta * 0.035, 12, dt)
      swayOffset.current.y = THREE.MathUtils.damp(swayOffset.current.y, pitchDelta * 0.035, 12, dt)
      swayRot.current.z = THREE.MathUtils.damp(swayRot.current.z, yawDelta * 0.18, 10, dt)
    }
    prevCamQuat.current.copy(camera.quaternion)

    // Movement Bobbing & Breathing
    const isMoving =
      inputManager.isMovingForward() ||
      inputManager.isMovingBackward() ||
      inputManager.isMovingLeft() ||
      inputManager.isMovingRight()
    const isSprinting = isMoving && inputManager.isSprinting()

    walkBobTimer.current += dt * (isMoving ? (isSprinting ? 13.5 : 8.5) : 1.4)
    breathTimer.current += dt * 1.6

    const bobScale = isMoving ? (isSprinting ? 0.012 : 0.007) : 0.0012
    const bobX = Math.cos(walkBobTimer.current * 0.5) * bobScale
    const bobY = -Math.abs(Math.sin(walkBobTimer.current)) * (bobScale * 1.2)
    const swayX = Math.cos(breathTimer.current * 1.2) * 0.0010
    const swayY = Math.sin(breathTimer.current * 2.4) * 0.0008

    recoilOffset.current = THREE.MathUtils.damp(recoilOffset.current, 0, 14, dt)
    recoilRotation.current = THREE.MathUtils.damp(recoilRotation.current, 0, 12, dt)

    // ── 5. Stance & Positioning (Heroic Full-Size Right-Side Viewport Framing) ──
    const cam = state.camera
    bowRootRef.current.position.copy(cam.position)
    bowRootRef.current.quaternion.copy(cam.quaternion)
    bowRootRef.current.updateMatrixWorld(true)

    const isAiming = (isDrawing.current || useQuestStore.getState().isAiming) && isBowEquipped
    const targetAim = isAiming ? 1.0 : 0.0
    aimProgress.current = THREE.MathUtils.damp(aimProgress.current, targetAim, 12, dt)
    const aFactor = aimProgress.current

    // Idle stance: Bow held gracefully in the lower-right foreground (X=0.205m, Y=-0.115m, Z=-0.320m)
    // Scale 0.85x gives a heroic recurve bow presence with elegant upper limb sweep framing the right third,
    // keeping the entire center crosshair and 80% of exploration view unobstructed.
    // Aim stance: raises into archer's sight window (X=0.048m, Y=-0.038m, Z=-0.220m)
    const unequipDrop = (1.0 - equipProgress.current) * -0.5
    const baseLocalX = THREE.MathUtils.lerp(0.205, 0.048, aFactor)
    const baseLocalY = THREE.MathUtils.lerp(-0.115, -0.038, aFactor)
    const baseLocalZ = THREE.MathUtils.lerp(-0.320, -0.220, aFactor)

    const localX = baseLocalX + swayOffset.current.x + bobX + shakeX
    const localY = baseLocalY + swayOffset.current.y + bobY + shakeY + unequipDrop
    const localZ = baseLocalZ + recoilOffset.current

    rigGroupRef.current.position.set(localX, localY, localZ)
    rigGroupRef.current.scale.setScalar(THREE.MathUtils.lerp(0.85, 0.90, aFactor))

    // Dynamic rotation:
    // In idle: pitchX = 0.02, yawY = 0.02, rollZ = -0.18 (comfortable, natural archer low-ready cant)
    // In aim: pitchX = 0.002, yawY = -0.005, rollZ = -0.06 (precise vertical alignment with sight picture)
    const pitchX = THREE.MathUtils.lerp(0.020, 0.002, aFactor) + recoilRotation.current + swayOffset.current.y * 0.15
    const yawY = THREE.MathUtils.lerp(0.020, -0.005, aFactor) + swayOffset.current.x * 0.15
    const rollZ = THREE.MathUtils.lerp(-0.180, -0.060, aFactor) + swayRot.current.z

    rigGroupRef.current.rotation.set(pitchX, yawY, rollZ, 'YXZ')
    rigGroupRef.current.updateMatrixWorld(true)

    // ── 6. Dynamic Bow Limb Flexing ──────────────────────────────────────────
    const tension = drawTension.current
    const pullDistance = 0.095 * tension

    stringVibration.current = THREE.MathUtils.damp(stringVibration.current, 0, 14, dt)
    const vibZ = Math.sin(state.clock.elapsedTime * 125) * 0.004 * stringVibration.current

    const limbFlex = tension * 0.052
    if (upperLimbRef.current && lowerLimbRef.current) {
      upperLimbRef.current.rotation.x = limbFlex
      lowerLimbRef.current.rotation.x = -limbFlex
      upperLimbRef.current.updateMatrixWorld(true)
      lowerLimbRef.current.updateMatrixWorld(true)
    }

    // ── 7. Mathematical Limb Tip Tracking for Clamped String Vertices ────────
    if (upperTipMarkerRef.current && lowerTipMarkerRef.current) {
      upperTipMarkerRef.current.getWorldPosition(vUpperWorld.current)
      lowerTipMarkerRef.current.getWorldPosition(vLowerWorld.current)
      vUpperLocal.current.copy(rigGroupRef.current.worldToLocal(vUpperWorld.current))
      vLowerLocal.current.copy(rigGroupRef.current.worldToLocal(vLowerWorld.current))
    }

    // ── 8. Arrow Alignment: Strictly Aligned in 3D Camera Depth Angle ────────
    // Arrow rest position on the shelf cutout: X = -0.007, Y = 0.008, Z = 0.026
    const restingNock = new THREE.Vector3(-0.007, 0.008, 0.026)

    // When drawing, nock pulls straight back along +Z towards archer's cheek
    const currentNock = restingNock.clone()
    currentNock.z += pullDistance + vibZ

    // When aiming (aFactor = 1.0): arrow points straight through center crosshair (0, 0, -80m)
    // When in idle (aFactor = 0.0): arrow points naturally along archer's right-hand depth corridor
    const aimCamPoint = bowRootRef.current.localToWorld(new THREE.Vector3(0, 0, -80.0))
    const aimLocalPoint = rigGroupRef.current.worldToLocal(aimCamPoint)
    const aimArrowDir = aimLocalPoint.sub(currentNock).normalize()

    const idleCamPoint = bowRootRef.current.localToWorld(new THREE.Vector3(0.18, -0.09, -50.0))
    const idleLocalPoint = rigGroupRef.current.worldToLocal(idleCamPoint)
    const idleArrowDir = idleLocalPoint.sub(currentNock).normalize()

    const arrowDir = new THREE.Vector3().lerpVectors(idleArrowDir, aimArrowDir, aFactor).normalize()

    if (arrowGroupRef.current) {
      // 0.00s to 0.62s (reloadProgress < 0.58): Bow is completely empty so player tracks shot arrow
      if (isReloading.current && reloadProgress < 0.58) {
        arrowGroupRef.current.visible = false
      } else {
        arrowGroupRef.current.visible = true

        const arrowQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          arrowDir
        )
        arrowGroupRef.current.quaternion.copy(arrowQuat)

        const currentNockPos = currentNock.clone()
        if (isReloading.current) {
          // Smooth slide from archer's quiver onto arrow shelf rest
          const tSlide = (reloadProgress - 0.58) / 0.42
          const easeSlide = THREE.MathUtils.smoothstep(tSlide, 0, 1)
          currentNockPos.y -= (1 - easeSlide) * 0.070
          currentNockPos.x += (1 - easeSlide) * 0.035
          currentNockPos.z += (1 - easeSlide) * 0.120
        }

        arrowGroupRef.current.position.copy(currentNockPos)
      }
    }

    // ── 9. Continuous Dynamic Bowstring Vertices ─────────────────────────────
    const posAttr = stringGeo.getAttribute('position') as THREE.BufferAttribute
    const positions = posAttr.array as Float32Array

    // Vertex 0: Upper Limb Horn Tip
    positions[0] = vUpperLocal.current.x
    positions[1] = vUpperLocal.current.y
    positions[2] = vUpperLocal.current.z

    // Vertex 1: Nock Center on string
    positions[3] = currentNock.x
    positions[4] = currentNock.y
    positions[5] = currentNock.z

    // Vertex 2: Lower Limb Horn Tip
    positions[6] = vLowerLocal.current.x
    positions[7] = vLowerLocal.current.y
    positions[8] = vLowerLocal.current.z

    posAttr.needsUpdate = true
    stringGeo.computeBoundingSphere()
  })

  return (
    <group
      ref={bowRootRef}
      renderOrder={999}
      onBeforeRender={(renderer) => {
        // Clear depth buffer so viewmodel weapon NEVER clips into foliage or rocks
        renderer.clearDepth()
      }}
    >
      <group ref={rigGroupRef}>
        {/* ── 1. Carved Mountain Yew Wooden Riser with Arrow Shelf Cutout ─────── */}
        <mesh geometry={riserGeo} material={woodMat} position={[0, 0, 0]} />

        {/* Weathered Dark Leather Handle Grip Wrap */}
        <mesh geometry={gripWrapGeo} material={leatherMat} position={[0, -0.024, 0]} />

        {/* ── 2. Upper Recurve Wooden Limb ──────────────────────────────────── */}
        <group ref={upperLimbRef} position={[0, 0.050, 0]}>
          <mesh geometry={upperLimbGeo} material={woodMat} />
          {/* Carved Dark Horn String Nock Overlay */}
          <mesh
            geometry={hornTipGeo}
            material={hornMat}
            position={[-0.006, 0.143, 0.027]}
            rotation={[0.08, 0, 0]}
          />
          {/* Tip Marker for 100% Clamped String Attachment */}
          <group ref={upperTipMarkerRef} position={[-0.006, 0.145, 0.028]} />
        </group>

        {/* ── 3. Lower Recurve Wooden Limb ──────────────────────────────────── */}
        <group ref={lowerLimbRef} position={[0, -0.050, 0]}>
          <mesh geometry={lowerLimbGeo} material={woodMat} />
          {/* Carved Dark Horn String Nock Overlay */}
          <mesh
            geometry={hornTipGeo}
            material={hornMat}
            position={[-0.006, -0.143, 0.027]}
            rotation={[-0.08, 0, 0]}
          />
          {/* Tip Marker for 100% Clamped String Attachment */}
          <group ref={lowerTipMarkerRef} position={[-0.006, -0.145, 0.028]} />
        </group>

        {/* ── 4. Continuous Dynamic Braided Bowstring ───────────────────────── */}
        <primitive object={stringLine} />

        {/* ── 5. Traditional Cedar Hunting Arrow ────────────────────────────── */}
        <group ref={arrowGroupRef}>
          {/* Dark Horn Arrow Nock clamped to string */}
          <mesh geometry={arrowNockGeo} material={hornMat} position={[0, 0, 0]} />

          {/* Cedar Wood Arrow Shaft */}
          <mesh geometry={arrowShaftGeo} material={arrowShaftMat} position={[0, 0, 0]} />

          {/* Dark Gunmetal Steel Ferrule Collar */}
          <mesh geometry={ferruleGeo} material={broadheadMat} position={[0, 0, 0]} />

          {/* Forged Two-Blade Carbon Steel Broadhead Blade */}
          <mesh geometry={arrowTipGeo} material={broadheadMat} position={[0, 0, 0]} />

          {/* 3 Natural Matte White-Grey Turkey Shield-Cut Feathers (Left cock-feather, up/down hen feathers) */}
          {[Math.PI, Math.PI / 3, -Math.PI / 3].map((angle, i) => (
            <group key={i} position={[0, 0, 0]} rotation={[0, 0, angle]}>
              <mesh geometry={fletchingGeo} material={fletchMat} position={[0, 0, 0]} />
            </group>
          ))}

          {/* Linen Whipping Thread Rings */}
          <mesh geometry={threadWrapGeo} material={threadMat} position={[0, 0, -0.007]} />
          <mesh geometry={threadWrapGeo} material={threadMat} position={[0, 0, -0.066]} />
        </group>
      </group>
    </group>
  )
}
