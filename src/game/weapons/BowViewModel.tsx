// ─────────────────────────────────────────────────────────────────────────────
// BowViewModel — AAA First-Person Hunting Recurve Bow & Arrow Viewmodel
// Features:
// - Direct camera matrix tracking: 100% immune to R3F reconciliation detachments
// - Sculpted wooden riser with hand-stitched leather grip & brass limb pockets
// - Curving laminated recurve limbs with bone tip nocks & dynamic draw flexing
// - Braided multi-ply bowstring with dynamic V-nock tension pull
// - Carbon-fiber cedar hunting arrow with razor Damascus steel broadhead
// - Natural weapon inertia / mouse lag, rhythmic walk bob, breathing sway
// - ADS aim down sights (Right Click) aligning arrow tip with crosshair
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

  const setDrawProgress = useQuestStore((s) => s.setDrawProgress)
  const setAiming = useQuestStore((s) => s.setAiming)

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
    // 1. Central Ergonomic Riser Handle
    const riserShape = new THREE.Shape()
    riserShape.moveTo(-0.022, -0.15)
    riserShape.lineTo(0.018, -0.12)
    riserShape.lineTo(0.024, -0.04)
    riserShape.lineTo(0.016, 0.05) // arrow shelf cutout
    riserShape.lineTo(0.025, 0.12)
    riserShape.lineTo(-0.022, 0.15)
    riserShape.lineTo(-0.03, 0.0)
    riserShape.closePath()

    const extrudeSettings = {
      depth: 0.042,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.008,
      bevelThickness: 0.008,
    }
    const riser = new THREE.ExtrudeGeometry(riserShape, extrudeSettings)
    riser.center()

    // 2. Leather Wrapped Grip Bands
    const gripWrap = new THREE.CylinderGeometry(0.027, 0.028, 0.14, 12)

    // 3. Brass Reinforcement Limb Pockets
    const limbPocket = new THREE.BoxGeometry(0.044, 0.052, 0.048)

    // 4. Upper & Lower Recurve Limbs (Curving S-profile with natural taper)
    const upperPoints: THREE.Vector3[] = []
    const lowerPoints: THREE.Vector3[] = []

    // 12 points along recurve curve
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      const y = t * 0.58
      // Sweeps backward slightly then recurves gracefully forward at tips
      const z = -Math.sin(t * Math.PI * 0.75) * 0.12 + Math.pow(t, 2.4) * 0.14
      const x = 0
      upperPoints.push(new THREE.Vector3(x, y, z))
      lowerPoints.push(new THREE.Vector3(x, -y, z))
    }

    const upperCurve = new THREE.CatmullRomCurve3(upperPoints)
    const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints)

    const upperLimb = new THREE.TubeGeometry(upperCurve, 24, 0.019, 8, false)
    const lowerLimb = new THREE.TubeGeometry(lowerCurve, 24, 0.019, 8, false)

    // 5. Carved Horn Tip Nocks
    const tipNock = new THREE.ConeGeometry(0.014, 0.05, 8)

    // 6. Arrow Rest Pad
    const arrowRest = new THREE.BoxGeometry(0.018, 0.008, 0.035)

    // 7. Hunting Arrow Components
    // Shaft: fine carbon cedar cylinder (0.84m length)
    const shaft = new THREE.CylinderGeometry(0.0055, 0.0055, 0.84, 8)
    // Orient cylinder along Z axis (pointing forward towards -Z)
    shaft.rotateX(Math.PI / 2)

    // Broadhead Arrowhead (triangular razor hunting blade)
    const tipShape = new THREE.Shape()
    tipShape.moveTo(0, 0.045)
    tipShape.lineTo(0.018, -0.02)
    tipShape.lineTo(0.006, -0.012)
    tipShape.lineTo(0, -0.018)
    tipShape.lineTo(-0.006, -0.012)
    tipShape.lineTo(-0.018, -0.02)
    tipShape.closePath()

    const tipExtrude = new THREE.ExtrudeGeometry(tipShape, {
      depth: 0.003,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.002,
      bevelThickness: 0.002,
    })
    tipExtrude.center()
    tipExtrude.rotateX(-Math.PI / 2) // Point along -Z

    // Feathers: aerodynamic turkey feather vane
    const fletchShape = new THREE.Shape()
    fletchShape.moveTo(0, 0)
    fletchShape.lineTo(0.019, 0.02)
    fletchShape.lineTo(0.016, 0.12)
    fletchShape.lineTo(0, 0.11)
    fletchShape.closePath()
    const fletching = new THREE.ShapeGeometry(fletchShape)
    fletching.rotateX(Math.PI / 2)

    // Carved Bone Nock
    const nock = new THREE.CylinderGeometry(0.006, 0.006, 0.025, 8)
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
    // Rich polished walnut / dark rosewood
    const wood = new THREE.MeshStandardMaterial({
      color: '#422817',
      roughness: 0.32,
      metalness: 0.08,
    })

    // Hand-stitched weathered dark leather
    const leather = new THREE.MeshStandardMaterial({
      color: '#21150c',
      roughness: 0.82,
      metalness: 0.04,
    })

    // Polished brass hardware
    const brass = new THREE.MeshStandardMaterial({
      color: '#d4af37',
      roughness: 0.35,
      metalness: 0.85,
    })

    // Carved bone / horn tip nocks
    const horn = new THREE.MeshStandardMaterial({
      color: '#dfd7c8',
      roughness: 0.45,
      metalness: 0.1,
    })

    // Braided silver FastFlight string
    const string = new THREE.LineBasicMaterial({
      color: '#f0ede6',
      linewidth: 2,
    })

    // Cedar arrow shaft with subtle sheen
    const arrowShaft = new THREE.MeshStandardMaterial({
      color: '#5c381e',
      roughness: 0.4,
      metalness: 0.05,
    })

    // Damascus forged steel broadhead
    const broadhead = new THREE.MeshStandardMaterial({
      color: '#2b3035',
      roughness: 0.22,
      metalness: 0.92,
    })

    // Barred turkey feather vanes
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
    // Initial relaxed string points
    const positions = new Float32Array([
      0, 0.58, 0.14,  // Upper tip
      0, 0.0, 0.02,   // Center nock point (on arrow nock)
      0, -0.58, 0.14, // Lower tip
    ])
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  const stringLine = useMemo(() => new THREE.Line(stringGeo, stringMat), [stringGeo, stringMat])

  // ── Input Listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('button, [class*="leva"], a, input')) return

      // Left click: start drawing the bow if player has focus
      if (e.button === 0 && inputManager.isLocked && !isReloading.current) {
        isDrawing.current = true
      }
      // Right click: ADS focus aim
      if (e.button === 2) {
        setAiming(true)
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      // Left click release: fire arrow
      if (e.button === 0 && isDrawing.current) {
        const power = Math.max(0.3, drawTension.current)
        sound.playBowRelease(power)

        // Calculate fire origin & ballistic direction from camera eye
        const origin = new THREE.Vector3()
        const dir = new THREE.Vector3()
        camera.getWorldPosition(origin)
        camera.getWorldDirection(dir)

        onFireArrow(origin, dir, power)

        // Recoil kick & string hum
        recoilOffset.current = 0.07 * power
        recoilRotation.current = -0.14 * power
        stringVibration.current = 1.0

        isDrawing.current = false
        drawTension.current = 0
        setDrawProgress(0)

        // Trigger reload cycle (hide current arrow, re-nock next)
        isReloading.current = true
        reloadTimer.current = 0.28
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
  }, [camera, onFireArrow, setDrawProgress, setAiming])

  // ── Per-Frame Animation & Viewmodel Camera Rig ──────────────────────────────
  useFrame((state, delta) => {
    if (!bowRootRef.current) return
    const dt = Math.min(delta, 0.05)

    // ── 1. Reload Cycle ─────────────────────────────────────────────────────
    if (isReloading.current) {
      reloadTimer.current -= dt
      if (reloadTimer.current <= 0) {
        isReloading.current = false
      }
    }

    // ── 2. Draw Tension Animation ───────────────────────────────────────────
    if (isDrawing.current) {
      const prev = drawTension.current
      drawTension.current = Math.min(1.0, drawTension.current + dt * 2.1)
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
      const tremor = (drawTension.current - 0.85) * 0.007
      shakeX = (Math.random() - 0.5) * tremor
      shakeY = (Math.random() - 0.5) * tremor
    }

    // ── 3. Dynamic Bowstring & Limbs Flex ────────────────────────────────────
    const pullBackZ = 0.28 * drawTension.current // Pull string towards player (+Z in local bow space)

    // String vibration after release
    stringVibration.current = THREE.MathUtils.damp(stringVibration.current, 0, 12, dt)
    const vib = Math.sin(state.clock.elapsedTime * 95) * 0.012 * stringVibration.current

    // Dynamic limb tips flex backward under draw tension
    if (upperLimbRef.current && lowerLimbRef.current) {
      const limbBend = drawTension.current * 0.08
      upperLimbRef.current.rotation.x = -limbBend
      lowerLimbRef.current.rotation.x = limbBend
    }

    // Update string vertices
    const stringPos = stringGeo.attributes.position as THREE.BufferAttribute
    const tipZ = 0.14 - drawTension.current * 0.04
    stringPos.setXYZ(0, 0, 0.58, tipZ)
    stringPos.setXYZ(1, 0, 0.0, 0.02 + pullBackZ + vib)
    stringPos.setXYZ(2, 0, -0.58, tipZ)
    stringPos.needsUpdate = true

    // Arrow slides back along arrow shelf with the string
    if (arrowGroupRef.current) {
      arrowGroupRef.current.visible = !isReloading.current
      // Arrow moves back towards the player (+Z in bow local space)
      arrowGroupRef.current.position.z = pullBackZ
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

    const bobX = Math.cos(walkBobTimer.current * 0.5) * (isMoving ? 0.016 : 0.003)
    const bobY = Math.sin(walkBobTimer.current) * (isMoving ? 0.024 : 0.004)
    const swayX = Math.cos(breathTimer.current * 0.5) * 0.003
    const swayY = Math.sin(breathTimer.current) * 0.003

    // ── 5. Recoil Recovery ───────────────────────────────────────────────────
    recoilOffset.current = THREE.MathUtils.damp(recoilOffset.current, 0, 14, dt)
    recoilRotation.current = THREE.MathUtils.damp(recoilRotation.current, 0, 12, dt)

    // ── 6. First-Person Camera Tracking (100% Reliable World Placement) ─────
    // Idle carry position: comfortably at bottom-right of viewport
    // Aiming position (ADS / Draw): aligned with eye-level center sightline
    const isAiming = isDrawing.current || useQuestStore.getState().isAiming
    const targetLocalX = isAiming ? 0.0 : 0.22
    const targetLocalY = isAiming ? -0.12 : -0.22
    const targetLocalZ = isAiming ? -0.38 : -0.44

    // Local bow cant (tactical archery tilt)
    const targetCantZ = isAiming ? -0.22 : 0.12
    const targetTiltX = isAiming ? 0.02 : -0.05
    const targetYawY = isAiming ? 0.03 : -0.06

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

    // Match camera rotation, then apply local weapon cant & recoil impulse
    bowRootRef.current.quaternion.copy(cam.quaternion)
    bowRootRef.current.rotateZ(targetCantZ)
    bowRootRef.current.rotateX(targetTiltX + recoilRotation.current)
    bowRootRef.current.rotateY(targetYawY)
  })

  return (
    <group ref={bowRootRef} renderOrder={100}>
      {/* ── 1. Sculpted Wood Riser Handle ─────────────────────────────────── */}
      <mesh geometry={riserGeo} material={woodMat} castShadow={false} />

      {/* Hand-Stitched Leather Wrap */}
      <mesh geometry={gripWrapGeo} material={leatherMat} position={[0, -0.01, 0.008]} />

      {/* Brass Limb Connection Pockets */}
      <mesh geometry={limbPocketGeo} material={brassMat} position={[0, 0.15, 0.008]} />
      <mesh geometry={limbPocketGeo} material={brassMat} position={[0, -0.15, 0.008]} />

      {/* Arrow Rest Shelf Pad */}
      <mesh geometry={arrowRestGeo} material={leatherMat} position={[-0.014, 0.042, -0.005]} />

      {/* ── 2. Upper Recurve Limb ─────────────────────────────────────────── */}
      <group ref={upperLimbRef} position={[0, 0.15, 0]}>
        <mesh geometry={upperLimbGeo} material={woodMat} />
        {/* Carved Horn Tip Nock */}
        <mesh
          geometry={tipNockGeo}
          material={hornMat}
          position={[0, 0.58, 0.14]}
          rotation={[Math.PI, 0, 0]}
        />
      </group>

      {/* ── 3. Lower Recurve Limb ─────────────────────────────────────────── */}
      <group ref={lowerLimbRef} position={[0, -0.15, 0]}>
        <mesh geometry={lowerLimbGeo} material={woodMat} />
        {/* Carved Horn Tip Nock */}
        <mesh geometry={tipNockGeo} material={hornMat} position={[0, -0.58, 0.14]} />
      </group>

      {/* ── 4. Dynamic Bowstring ─────────────────────────────────────────── */}
      <primitive object={stringLine} />

      {/* ── 5. Nocked Hunting Arrow ──────────────────────────────────────── */}
      <group ref={arrowGroupRef} position={[-0.002, 0.042, 0]}>
        {/* Fine Carbon Cedar Arrow Shaft (Length 0.84m, pointing towards -Z) */}
        <mesh geometry={arrowShaftGeo} material={arrowShaftMat} position={[0, 0, -0.38]} />

        {/* Damascus Forged Steel Broadhead Blade */}
        <mesh
          geometry={arrowTipGeo}
          material={broadheadMat}
          position={[0, 0, -0.80]}
        />

        {/* Sinew Thread Binding */}
        <mesh position={[0, 0, -0.76]}>
          <cylinderGeometry args={[0.0075, 0.0075, 0.03, 8]} />
          <meshStandardMaterial color="#1f1812" roughness={0.9} />
        </mesh>

        {/* Carved Bone Nock */}
        <mesh geometry={arrowNockGeo} material={nockMat} position={[0, 0, 0.02]} />

        {/* 3 Helical Turkey Feather Vanes (120 deg apart) */}
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
          <group key={i} position={[0, 0, -0.06]} rotation={[0, 0, angle]}>
            <mesh
              geometry={fletchingGeo}
              material={i === 0 ? fletchWhiteMat : fletchGreenMat}
              position={[0, 0.006, 0]}
            />
          </group>
        ))}
      </group>
    </group>
  )
}
