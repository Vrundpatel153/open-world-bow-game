// ─────────────────────────────────────────────────────────────────────────────
// FirstPersonArmModel — AAA First-Person Character Arms & Articulated Hands Rig
// Features:
// - Authentic medieval ranger / warrior anatomical arms with cuir-bouilli leather vambraces
// - True 3D anatomical weapon grips: fingers wrap circumference-wise around handles
// - Zero vertical-stick fingers or flat cardboard geometry
// - Left Bow Arm: Hand firmly grasps the bow riser; index finger knuckle cradles shelf
// - Right Bow Arm: Mediterranean 3-finger draw (index, middle, ring) anchored at right cheek
// - Right Sword Arm: Heavy gauntleted warrior grip around the longsword leather hilt
// - Right Torch Arm: Weathered adventurer's leather glove grasping the torch handle
// - 100% Procedural PBR materials with zero external asset dependencies or HTTP lag
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three'

// ── Shared Materials ─────────────────────────────────────────────────────────

// Ranger Forest Wool Sleeve (Folded back near forearm)
export const sleeveMaterial = new THREE.MeshStandardMaterial({
  color: '#283322', // Forest ranger dark wool tunic
  roughness: 0.88,
  metalness: 0.02,
})

// Hardened Medieval Cuir-Bouilli Leather Vambrace (Forearm Armor)
export const vambraceMaterial = new THREE.MeshStandardMaterial({
  color: '#342115', // Rich weathered chestnut brown leather
  roughness: 0.76,
  metalness: 0.08,
})

// Dark Oiled Leather Straps & Binding Cords
export const strapMaterial = new THREE.MeshStandardMaterial({
  color: '#1e140d', // Deep dark brown leather straps
  roughness: 0.84,
  metalness: 0.06,
})

// Antique Hammered Brass Buckles & Studs
export const brassMaterial = new THREE.MeshStandardMaterial({
  color: '#c29b46', // Antique brass metal
  roughness: 0.38,
  metalness: 0.88,
})

// Soft Deerskin / Goat Leather Archer's Glove
export const gloveMaterial = new THREE.MeshStandardMaterial({
  color: '#2a1a10', // Dark supple archer's shooting glove
  roughness: 0.82,
  metalness: 0.05,
})

// Reinforced Heavy Leather Gauntlet (for Sword / Melee)
export const gauntletMaterial = new THREE.MeshStandardMaterial({
  color: '#26180e', // Heavy reinforced swordsman leather
  roughness: 0.78,
  metalness: 0.12,
})

// Natural Skin Tone (Wrist / Thumb accents if exposed)
export const skinMaterial = new THREE.MeshStandardMaterial({
  color: '#c8997a',
  roughness: 0.65,
  metalness: 0.02,
})

// ── Helper: Create a cylindrical handle-wrapping finger ───────────────────────
// Wraps around the Y-axis handle circumference at height yPos from startAngle to (startAngle + wrapAngle)
function createWrappedFinger(
  yPos: number,
  orbitRadius: number,
  fingerRadius: number,
  startAngle: number,
  wrapAngle: number,
  material: THREE.Material
): THREE.Group {
  const fingerGroup = new THREE.Group()
  const segments = 3
  const stepAngle = wrapAngle / segments

  for (let i = 0; i < segments; i++) {
    const a0 = startAngle + i * stepAngle
    const a1 = startAngle + (i + 1) * stepAngle
    const aMid = (a0 + a1) * 0.5

    const x0 = Math.cos(a0) * orbitRadius
    const z0 = Math.sin(a0) * orbitRadius

    const x1 = Math.cos(a1) * orbitRadius
    const z1 = Math.sin(a1) * orbitRadius

    const segLen = Math.hypot(x1 - x0, z1 - z0)

    // Phalanx bone cylinder
    const boneGeo = new THREE.CylinderGeometry(
      fingerRadius * (0.95 - i * 0.08),
      fingerRadius * (1.00 - i * 0.08),
      segLen,
      8
    )
    boneGeo.rotateZ(Math.PI / 2) // Orient along local X
    const bone = new THREE.Mesh(boneGeo, material)
    bone.position.set((x0 + x1) * 0.5, yPos, (z0 + z1) * 0.5)
    bone.rotation.y = -aMid + Math.PI / 2
    fingerGroup.add(bone)

    // Knuckle joint sphere
    const jointGeo = new THREE.SphereGeometry(fingerRadius * (1.02 - i * 0.06), 8, 8)
    const joint = new THREE.Mesh(jointGeo, material)
    joint.position.set(x0, yPos, z0)
    fingerGroup.add(joint)

    // Fingertip rounded cap
    if (i === segments - 1) {
      const tipGeo = new THREE.SphereGeometry(fingerRadius * 0.82, 8, 8)
      const tip = new THREE.Mesh(tipGeo, material)
      tip.position.set(x1, yPos, z1)
      fingerGroup.add(tip)
    }
  }

  return fingerGroup
}

// ── Helper: Create a wrapped thumb locking the fingers ───────────────────────
function createWrappedThumb(
  yPos: number,
  orbitRadius: number,
  thumbRadius: number,
  startAngle: number,
  wrapAngle: number,
  pitchDown: number,
  material: THREE.Material
): THREE.Group {
  const thumbGroup = new THREE.Group()
  const segments = 2
  const stepAngle = wrapAngle / segments

  for (let i = 0; i < segments; i++) {
    const a0 = startAngle + i * stepAngle
    const a1 = startAngle + (i + 1) * stepAngle
    const aMid = (a0 + a1) * 0.5

    const y0 = yPos - i * pitchDown * 0.5
    const y1 = yPos - (i + 1) * pitchDown * 0.5

    const x0 = Math.cos(a0) * orbitRadius
    const z0 = Math.sin(a0) * orbitRadius

    const x1 = Math.cos(a1) * orbitRadius
    const z1 = Math.sin(a1) * orbitRadius

    const segLen = Math.hypot(x1 - x0, y1 - y0, z1 - z0)

    const boneGeo = new THREE.CylinderGeometry(
      thumbRadius * (0.95 - i * 0.08),
      thumbRadius * (1.05 - i * 0.05),
      segLen,
      8
    )
    boneGeo.rotateZ(Math.PI / 2)
    const bone = new THREE.Mesh(boneGeo, material)
    bone.position.set((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5)
    bone.rotation.y = -aMid + Math.PI / 2
    bone.rotation.z = Math.atan2(y1 - y0, Math.hypot(x1 - x0, z1 - z0))
    thumbGroup.add(bone)

    const jointGeo = new THREE.SphereGeometry(thumbRadius * 1.05, 8, 8)
    const joint = new THREE.Mesh(jointGeo, material)
    joint.position.set(x0, y0, z0)
    thumbGroup.add(joint)

    if (i === segments - 1) {
      const tipGeo = new THREE.SphereGeometry(thumbRadius * 0.88, 8, 8)
      const tip = new THREE.Mesh(tipGeo, material)
      tip.position.set(x1, y1, z1)
      thumbGroup.add(tip)
    }
  }

  return thumbGroup
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LEFT ARCHER ARM & BOW-GRIP HAND
// Firmly grasps the vertical bow handle stave; fingers wrap around the circumference.
// ─────────────────────────────────────────────────────────────────────────────
export interface LeftBowArmRig {
  root: THREE.Group
  forearmGroup: THREE.Group
  handGroup: THREE.Group
}

export function createLeftBowArm(): LeftBowArmRig {
  const root = new THREE.Group()
  root.name = 'LeftBowArm'

  // The forearm originates down-left offscreen and angles up to the bow handle at (0, 0, 0)
  const forearmGroup = new THREE.Group()
  // Angle forearm from lower-left toward the bow handle
  forearmGroup.position.set(-0.16, -0.22, 0.12)
  forearmGroup.rotation.set(-0.55, 0.45, -0.68)
  root.add(forearmGroup)

  // Anatomical Forearm (Elbow to Wrist)
  const armLen = 0.28
  const forearmGeo = new THREE.CylinderGeometry(0.023, 0.035, armLen, 14)
  forearmGeo.scale(0.85, 1.0, 1.15)
  const forearmMesh = new THREE.Mesh(forearmGeo, gloveMaterial)
  forearmMesh.position.set(0, armLen * 0.5, 0)
  forearmGroup.add(forearmMesh)

  // Ranger Wool Sleeve at elbow
  const sleeveGeo = new THREE.CylinderGeometry(0.036, 0.042, 0.08, 14)
  const sleeveMesh = new THREE.Mesh(sleeveGeo, sleeveMaterial)
  sleeveMesh.position.set(0, 0.04, 0)
  forearmGroup.add(sleeveMesh)

  // Archer's Leather Vambrace (Forearm Bracer protecting against string slap)
  const vambraceGeo = new THREE.CylinderGeometry(0.026, 0.034, 0.16, 14, 1, true, 0, Math.PI * 1.4)
  vambraceGeo.scale(0.95, 1.0, 1.18)
  const vambraceMesh = new THREE.Mesh(vambraceGeo, vambraceMaterial)
  vambraceMesh.position.set(0, 0.16, 0)
  vambraceMesh.rotation.y = -Math.PI * 0.3
  forearmGroup.add(vambraceMesh)

  // Vambrace Straps with Hammered Brass Buckles
  ;[0.11, 0.21].forEach((yPos) => {
    const strapGeo = new THREE.TorusGeometry(0.027, 0.0022, 8, 16)
    const strap = new THREE.Mesh(strapGeo, strapMaterial)
    strap.position.set(0, yPos, 0)
    strap.rotation.x = Math.PI / 2
    forearmGroup.add(strap)

    const buckleGeo = new THREE.BoxGeometry(0.007, 0.005, 0.003)
    const buckle = new THREE.Mesh(buckleGeo, brassMaterial)
    buckle.position.set(0.025, yPos, 0.008)
    forearmGroup.add(buckle)
  })

  // Hand Group: positioned directly at the bow handle stave
  const handGroup = new THREE.Group()
  root.add(handGroup)

  // Palm / Back of hand resting snugly against rear of handle wrap
  const palmGeo = new THREE.CylinderGeometry(0.012, 0.014, 0.042, 12)
  palmGeo.scale(0.85, 1.0, 1.15)
  const palmMesh = new THREE.Mesh(palmGeo, gloveMaterial)
  palmMesh.position.set(-0.004, -0.005, 0.009)
  palmMesh.rotation.set(0.08, -0.20, 0.05)
  handGroup.add(palmMesh)

  // 4 Fingers wrapping circumference-wise around the cylindrical handle
  // Handle center is at x=0, z=0, radius ~0.012m. Orbit radius = 0.016m.
  // Fingers wrap from left/back (angle ~2.4 rad) around front to right/back (angle ~ -0.6 rad)
  const orbitR = 0.016
  const fRadius = 0.0048
  const startA = 2.40
  const wrapA = -3.20 // Wraps counter-clockwise across front of stave

  const fingerYOffsets = [0.016, 0.003, -0.010, -0.023] // Index, Middle, Ring, Pinky
  fingerYOffsets.forEach((yOff) => {
    const finger = createWrappedFinger(yOff, orbitR, fRadius, startA, wrapA, gloveMaterial)
    handGroup.add(finger)
  })

  // Thumb wrapping across the front from the left to lock the index & middle fingers
  const thumb = createWrappedThumb(0.010, orbitR * 1.05, 0.0055, 2.60, -1.80, 0.008, gloveMaterial)
  handGroup.add(thumb)

  return { root, forearmGroup, handGroup }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. RIGHT ARCHER DRAW ARM & 3-FINGER MEDITERRANEAN STRING HOOK
// Hooks onto the bowstring with 3 fingers (index above nock, middle & ring below);
// Anchored at archer's right cheek/jaw.
// ─────────────────────────────────────────────────────────────────────────────
export interface RightDrawArmRig {
  root: THREE.Group
  forearmGroup: THREE.Group
  handGroup: THREE.Group
}

export function createRightDrawArm(): RightDrawArmRig {
  const root = new THREE.Group()
  root.name = 'RightDrawArm'

  // Forearm extends back and down towards archer's right shoulder
  const forearmGroup = new THREE.Group()
  forearmGroup.position.set(0.06, -0.16, 0.14)
  forearmGroup.rotation.set(0.65, -0.35, 0.45)
  root.add(forearmGroup)

  const armLen = 0.26
  const forearmGeo = new THREE.CylinderGeometry(0.022, 0.034, armLen, 14)
  forearmGeo.scale(0.85, 1.0, 1.15)
  const forearmMesh = new THREE.Mesh(forearmGeo, gloveMaterial)
  forearmMesh.position.set(0, armLen * 0.5, 0)
  forearmGroup.add(forearmMesh)

  // Wool sleeve at elbow
  const sleeveGeo = new THREE.CylinderGeometry(0.035, 0.040, 0.075, 14)
  const sleeveMesh = new THREE.Mesh(sleeveGeo, sleeveMaterial)
  sleeveMesh.position.set(0, 0.04, 0)
  forearmGroup.add(sleeveMesh)

  // Wrist cuff & buckle
  const wristGeo = new THREE.CylinderGeometry(0.023, 0.024, 0.028, 12)
  const wristWrap = new THREE.Mesh(wristGeo, strapMaterial)
  wristWrap.position.set(0, armLen - 0.015, 0)
  forearmGroup.add(wristWrap)

  const buckleGeo = new THREE.BoxGeometry(0.006, 0.005, 0.003)
  const buckle = new THREE.Mesh(buckleGeo, brassMaterial)
  buckle.position.set(-0.022, armLen - 0.015, 0.004)
  forearmGroup.add(buckle)

  // Hand Group: 3 hooked draw fingers curling around the string from the right
  const handGroup = new THREE.Group()
  root.add(handGroup)

  // Anatomical back of draw shooting glove (rounded deerskin)
  const backGeo = new THREE.CylinderGeometry(0.014, 0.017, 0.036, 12)
  backGeo.scale(0.85, 1.0, 1.15)
  const backMesh = new THREE.Mesh(backGeo, gloveMaterial)
  backMesh.position.set(0.012, -0.006, 0.010)
  backMesh.rotation.set(0.12, 0.20, -0.08)
  handGroup.add(backMesh)

  // Mediterranean 3-Finger Draw Hook:
  // Index Finger (just above arrow nock)
  // Middle Finger & Ring Finger (just below arrow nock)
  const drawFingers = [
    { y: 0.014, r: 0.0048 }, // Index (above nock)
    { y: -0.004, r: 0.0050 }, // Middle (below nock)
    { y: -0.018, r: 0.0046 }, // Ring (below nock)
  ]

  drawFingers.forEach((cfg) => {
    // Hook curls backward around string from right (+X) to left (-X) to back (+Z)
    const hook = createWrappedFinger(cfg.y, 0.012, cfg.r, -0.20, 2.80, gloveMaterial)
    hook.position.set(0.004, 0, -0.006)
    handGroup.add(hook)
  })

  // Pinky curled into palm
  const pinky = createWrappedFinger(-0.030, 0.009, 0.0042, 0.20, 2.20, gloveMaterial)
  pinky.position.set(0.012, 0, 0.008)
  handGroup.add(pinky)

  // Thumb tucked flat against palm
  const thumbGeo = new THREE.CylinderGeometry(0.0050, 0.0060, 0.028, 8)
  thumbGeo.rotateZ(Math.PI / 4)
  const thumbMesh = new THREE.Mesh(thumbGeo, gloveMaterial)
  thumbMesh.position.set(0.024, 0.012, 0.006)
  handGroup.add(thumbMesh)

  return { root, forearmGroup, handGroup }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RIGHT SWORD ARM & GAUNTLET HAND
// Full gauntleted warrior combat grip holding the longsword hilt below crossguard.
// ─────────────────────────────────────────────────────────────────────────────
export interface RightSwordArmRig {
  root: THREE.Group
  forearmGroup: THREE.Group
  handGroup: THREE.Group
}

export function createRightSwordArm(): RightSwordArmRig {
  const root = new THREE.Group()
  root.name = 'RightSwordArm'

  // Forearm extends down-right offscreen
  const forearmGroup = new THREE.Group()
  forearmGroup.position.set(0.18, -0.20, 0.16)
  forearmGroup.rotation.set(-0.45, -0.55, 0.65)
  root.add(forearmGroup)

  const armLen = 0.28
  const forearmGeo = new THREE.CylinderGeometry(0.025, 0.038, armLen, 14)
  forearmGeo.scale(0.85, 1.0, 1.15)
  const forearmMesh = new THREE.Mesh(forearmGeo, gauntletMaterial)
  forearmMesh.position.set(0, armLen * 0.5, 0)
  forearmGroup.add(forearmMesh)

  // Flared leather gauntlet cuff
  const cuffGeo = new THREE.CylinderGeometry(0.040, 0.034, 0.07, 14)
  const cuffMesh = new THREE.Mesh(cuffGeo, gauntletMaterial)
  cuffMesh.position.set(0, 0.08, 0)
  forearmGroup.add(cuffMesh)

  // Iron rivets on cuff
  ;[0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].forEach((angle) => {
    const rivetGeo = new THREE.SphereGeometry(0.0028, 8, 8)
    const rivet = new THREE.Mesh(rivetGeo, brassMaterial)
    rivet.position.set(Math.cos(angle) * 0.038, 0.08, Math.sin(angle) * 0.038)
    forearmGroup.add(rivet)
  })

  // Hand Group: Grips the longsword leather hilt at y = -0.04 to -0.09
  // Hilt radius is ~0.013m, orbit radius = 0.017m
  const handGroup = new THREE.Group()
  root.add(handGroup)

  // Palm / back of gauntlet
  const backGeo = new THREE.BoxGeometry(0.030, 0.052, 0.034)
  const backMesh = new THREE.Mesh(backGeo, gauntletMaterial)
  backMesh.position.set(0.016, -0.060, 0.012)
  backMesh.rotation.set(0.10, 0.35, -0.08)
  handGroup.add(backMesh)

  // 4 Gauntleted fingers wrapped circumference-wise around the sword hilt
  const orbitR = 0.017
  const fRadius = 0.0052
  const startA = 0.65
  const wrapA = 3.20

  const fingerYOffsets = [-0.038, -0.052, -0.066, -0.080]
  fingerYOffsets.forEach((yOff) => {
    const finger = createWrappedFinger(yOff, orbitR, fRadius, startA, wrapA, gauntletMaterial)
    handGroup.add(finger)
  })

  // Thumb locking over fingers at front
  const thumb = createWrappedThumb(-0.045, orbitR * 1.05, 0.0058, 0.45, 1.80, 0.008, gauntletMaterial)
  handGroup.add(thumb)

  return { root, forearmGroup, handGroup }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. RIGHT TORCH ARM & ADVENTURER GLOVE
// Weathered leather glove grasping the wooden torch handle below the iron ferrule.
// ─────────────────────────────────────────────────────────────────────────────
export interface RightTorchArmRig {
  root: THREE.Group
  forearmGroup: THREE.Group
  handGroup: THREE.Group
}

export function createRightTorchArm(): RightTorchArmRig {
  const root = new THREE.Group()
  root.name = 'RightTorchArm'

  // Forearm extends down-right offscreen
  const forearmGroup = new THREE.Group()
  forearmGroup.position.set(0.18, -0.22, 0.16)
  forearmGroup.rotation.set(-0.48, -0.52, 0.62)
  root.add(forearmGroup)

  const armLen = 0.28
  const forearmGeo = new THREE.CylinderGeometry(0.024, 0.036, armLen, 14)
  forearmGeo.scale(0.85, 1.0, 1.15)
  const forearmMesh = new THREE.Mesh(forearmGeo, gloveMaterial)
  forearmMesh.position.set(0, armLen * 0.5, 0)
  forearmGroup.add(forearmMesh)

  // Wool sleeve cuff
  const sleeveGeo = new THREE.CylinderGeometry(0.037, 0.042, 0.075, 14)
  const sleeveMesh = new THREE.Mesh(sleeveGeo, sleeveMaterial)
  sleeveMesh.position.set(0, 0.06, 0)
  forearmGroup.add(sleeveMesh)

  // Wrist strap & buckle
  const strapGeo = new THREE.TorusGeometry(0.026, 0.0022, 8, 16)
  const strap = new THREE.Mesh(strapGeo, strapMaterial)
  strap.position.set(0, armLen - 0.015, 0)
  strap.rotation.x = Math.PI / 2
  forearmGroup.add(strap)

  const buckleGeo = new THREE.BoxGeometry(0.006, 0.005, 0.003)
  const buckle = new THREE.Mesh(buckleGeo, brassMaterial)
  buckle.position.set(0.025, armLen - 0.015, 0.005)
  forearmGroup.add(buckle)

  // Hand Group: Grips the torch shaft at y = -0.06 to -0.12
  // Shaft radius is ~0.013m, orbit radius = 0.017m
  const handGroup = new THREE.Group()
  root.add(handGroup)

  // Palm / back of glove
  const backGeo = new THREE.BoxGeometry(0.028, 0.050, 0.032)
  const backMesh = new THREE.Mesh(backGeo, gloveMaterial)
  backMesh.position.set(0.015, -0.080, 0.012)
  backMesh.rotation.set(0.10, 0.35, -0.08)
  handGroup.add(backMesh)

  // 4 Gloved fingers wrapped circumference-wise around the torch shaft
  const orbitR = 0.017
  const fRadius = 0.0050
  const startA = 0.65
  const wrapA = 3.20

  const fingerYOffsets = [-0.058, -0.072, -0.086, -0.100]
  fingerYOffsets.forEach((yOff) => {
    const finger = createWrappedFinger(yOff, orbitR, fRadius, startA, wrapA, gloveMaterial)
    handGroup.add(finger)
  })

  // Thumb locking over fingers at front
  const thumb = createWrappedThumb(-0.065, orbitR * 1.05, 0.0056, 0.45, 1.80, 0.008, gloveMaterial)
  handGroup.add(thumb)

  return { root, forearmGroup, handGroup }
}
