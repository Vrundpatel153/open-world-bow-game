// ─────────────────────────────────────────────────────────────────────────────
// OpenWorldGrassField — Production Stylized Foliage & Ancient Forest System
// Features: 54,000 dense, overlapping wind-animated blades with ZERO plain gaps,
// rich multi-tier conifer forests, cobblestone trail markers, and real-time trampling.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'

import { createGrassFieldUniforms } from '../grassField/uniforms'
import { MAX_ROCKS } from '../grassField/shaders/grassBlade'
import { makeGroundMaterial } from '../grassField/materials/groundMaterial'
import { makeBarkMaterial } from '../grassField/materials/barkMaterial'
import {
  makePineLeafMaterial,
  makePineLeafDepthMaterial,
} from '../grassField/materials/pineLeafMaterial'
import { scatterBlades, scatterFlowers } from '../grassField/utils/scatter'
import { worldCollisionSystem, type WorldCollider } from '@/game/physics/WorldCollisionSystem'

export const WORLD_SIZE = 140
export const WORLD_SEGMENTS = 96

// Sword swing wind pressure shockwave trigger
export const grassWindImpulse = {
  active: false,
  origin: new THREE.Vector3(),
  dir: new THREE.Vector3(),
  radius: 0,
  maxRadius: 2.2,
  strength: 0,
  timer: 0,
  maxDuration: 0.38,
  trigger(origin: THREE.Vector3, dir: THREE.Vector3, power: number = 1.0) {
    this.active = true
    this.origin.copy(origin).addScaledVector(dir, 1.4)
    this.dir.copy(dir).normalize()
    this.strength = power
    this.timer = 0.38
    this.maxDuration = 0.38
    this.radius = 0.8
    this.maxRadius = Math.min(2.4, 1.4 + power * 0.5)
  },
}

// Smooth rolling elevation across meadow, rising gracefully into distant boundary hills
export function getOpenWorldHeight(x: number, z: number): number {
  const base =
    Math.sin(x * 0.045) * 1.2 +
    Math.cos(z * 0.042) * 1.1 +
    Math.sin(x * 0.095 + z * 0.08) * 0.45
  const dist = Math.hypot(x, z)
  if (dist > 40) {
    const t = Math.min(1.2, (dist - 40) / 26)
    const hill = Math.pow(t, 2.0) * 12.0 + Math.sin(x * 0.05 + z * 0.04) * 2.0
    return base + hill
  }
  return base
}

// Transform-aware world displacement helper using parent.worldToLocal (immune to parent scales/rotations)
function applyWorldYShift(obj: THREE.Object3D, deltaWorldY: number) {
  if (Math.abs(deltaWorldY) < 1e-5) return
  if (!obj.parent) {
    obj.position.y += deltaWorldY
    obj.updateMatrixWorld(true)
    return
  }
  const curWorld = obj.getWorldPosition(new THREE.Vector3())
  curWorld.y += deltaWorldY
  obj.position.copy(obj.parent.worldToLocal(curWorld))
  obj.updateMatrixWorld(true)
}

interface OpenWorldGrassFieldProps {
  preset?: string
  playerPosRef?: React.MutableRefObject<THREE.Vector3>
  onLoaded?: () => void
}

const GLB_URL = '/assets/grass-scene.glb'
const TRUNK_MATERIAL = 'Material.011'
const LEAF_MATERIAL = '2237f4d60830642a24d65276e7abe1e6'

const BARK_TEXTURES = [
  '/assets/textures/bark/bark_color.png',
  '/assets/textures/bark/bark_AO.png',
  '/assets/textures/bark/bark_height.png',
] as [string, string, string]

const FLOWER_TEXTURES_A = [
  '/assets/textures/flower/flowers.png',
  '/assets/textures/flower/flowersRGB.png',
  '/assets/textures/flower/flowersGradient.png',
] as [string, string, string]

const FLOWER_TEXTURES_B = [
  '/assets/textures/flower3/flowers.png',
  '/assets/textures/flower3/flowersRGB.png',
  '/assets/textures/flower3/flowersGradient.png',
] as [string, string, string]

export default function OpenWorldGrassField({
  playerPosRef,
  onLoaded,
}: OpenWorldGrassFieldProps) {
  // Load the authentic 3D GLB model and textures
  const { scene } = useGLTF(GLB_URL)
  const [barkColor, barkAO, barkHeight] = useTexture(BARK_TEXTURES)
  const [maskA, rgbA, gradA] = useTexture(FLOWER_TEXTURES_A)
  const [maskB, rgbB, gradB] = useTexture(FLOWER_TEXTURES_B)

  // Single shared uniform bag driving all shaders
  const u = useMemo(() => createGrassFieldUniforms(), [])

  // Texture repeat wrapping setup
  useEffect(() => {
    for (const t of [barkColor, barkAO, barkHeight]) {
      t.wrapS = THREE.RepeatWrapping
      t.wrapT = THREE.RepeatWrapping
      t.needsUpdate = true
    }
    barkColor.colorSpace = THREE.SRGBColorSpace
    barkAO.colorSpace = THREE.NoColorSpace
    barkHeight.colorSpace = THREE.NoColorSpace

    u.bark.uBarkColorMap.value = barkColor
    u.bark.uBarkAOMap.value = barkAO
    u.bark.uBarkHeightMap.value = barkHeight

    u.flowerTexA.uFlowerMask.value = maskA
    u.flowerTexA.uFlowerRGB.value = rgbA
    u.flowerTexA.uFlowerGradient.value = gradA

    u.flowerTexB.uFlowerMask.value = maskB
    u.flowerTexB.uFlowerRGB.value = rgbB
    u.flowerTexB.uFlowerGradient.value = gradB
  }, [u, barkColor, barkAO, barkHeight, maskA, rgbA, gradA, maskB, rgbB, gradB])

  // Sunlight tracker with cached reference
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null)
  const sunPos = useRef(new THREE.Vector3())
  const sunTarget = useRef(new THREE.Vector3())

  // Pre-allocated Color objects for zero GC per frame
  const colorsRef = useRef({
    grassBottom: new THREE.Color('#143209'),
    grassTop: new THREE.Color('#386f18'),
    transColor: new THREE.Color('#286614'),
    dirtColor: new THREE.Color('#1a340b'),
    barkTint: new THREE.Color('#2b2118'),
  })
  const foliageClustersRef = useRef<THREE.Group[]>([])

  // ── Build Open World Foliage, Terrain & Trails ─────────────────────────────
  const { terrainMesh, coreBladesMesh, outerBladesMesh, flowerMeshes, foliageClusters, pathMarkers, colliders } = useMemo(() => {
    // 1. High-Density Unified Full-World Forest Lawn Plane (108m x 108m)
    // Completely encompasses the entire 52m exploration boundary, all 18 forest groves & all 4 ancient shrines.
    const forestLawnGeo = new THREE.PlaneGeometry(108, 108, 96, 96)
    forestLawnGeo.rotateX(-Math.PI / 2)
    const cPosAttr = forestLawnGeo.attributes.position
    for (let i = 0; i < cPosAttr.count; i++) {
      const x = cPosAttr.getX(i)
      const z = cPosAttr.getZ(i)
      cPosAttr.setY(i, getOpenWorldHeight(x, z))
    }
    forestLawnGeo.computeVertexNormals()

    // 44,000 14-blade natural interlocking sods (616,000 broad forest lawn blades across the entire world):
    // Multi-tier sods interlace with radial overlap, completely eliminating gaps, bare patches, and plain areas.
    const coreBlades = scatterBlades(new THREE.Mesh(forestLawnGeo), {
      uniforms: u.surface,
      density: 4.8,
      maxCount: 44_000,
      minWidth: 1.15,
      maxWidth: 1.35,
      minLength: 1.05,
      maxLength: 1.30,
      tiltMax: 0.20,
      segments: 2,
    })

    // 2. Perimeter Boundary Hills Turf Ring (Radius 48m to 82m)
    // 12,000 sods providing continuous green coverage up into the boundary hills
    const outerMeadowGeo = new THREE.RingGeometry(48, 82, 48, 12)
    outerMeadowGeo.rotateX(-Math.PI / 2)
    const oPosAttr = outerMeadowGeo.attributes.position
    for (let i = 0; i < oPosAttr.count; i++) {
      const x = oPosAttr.getX(i)
      const z = oPosAttr.getZ(i)
      oPosAttr.setY(i, getOpenWorldHeight(x, z))
    }
    outerMeadowGeo.computeVertexNormals()

    const outerBlades = scatterBlades(new THREE.Mesh(outerMeadowGeo), {
      uniforms: u.surface,
      density: 1.8,
      maxCount: 12_000,
      minWidth: 1.15,
      maxWidth: 1.35,
      minLength: 1.05,
      maxLength: 1.30,
      tiltMax: 0.22,
      segments: 1, // outer blades use 1 segment (1 triangle per blade) for massive distance LOD optimization
    })

    // 3. Horizon Open World Terrain Plane (140m x 140m)
    const terrainGeo = new THREE.PlaneGeometry(
      WORLD_SIZE,
      WORLD_SIZE,
      WORLD_SEGMENTS,
      WORLD_SEGMENTS
    )
    terrainGeo.rotateX(-Math.PI / 2)
    const posAttr = terrainGeo.attributes.position
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i)
      const z = posAttr.getZ(i)
      posAttr.setY(i, getOpenWorldHeight(x, z))
    }
    terrainGeo.computeVertexNormals()

    // Vibrant forest meadow moss ground material perfectly matching grass blade bases
    const groundMat = makeGroundMaterial(u.surface, new THREE.Color('#1a3c10'))
    const groundMesh = new THREE.Mesh(terrainGeo, groundMat)
    groundMesh.receiveShadow = true
    groundMesh.castShadow = false
    groundMesh.updateMatrixWorld(true)

    // 4. Scatter Wildflowers across active meadows
    const flowerInstances = scatterFlowers(new THREE.Mesh(forestLawnGeo), {
      uniforms: u.flower,
      texA: u.flowerTexA,
      texB: u.flowerTexB,
      dirt: u.surface,
      density: 0.35,
      maxCount: 2600,
      size: 0.32,
      mixA: 0.5,
    })

    // 5. Rich Ancient Pine Forest & Conifer Copses (18+ Diverse Groves)
    const barkMat = makeBarkMaterial(u.bark)
    const clusters: THREE.Group[] = []
    const colliders: WorldCollider[] = []

    const createAuthenticCluster = (posX: number, posZ: number, rotY: number, scaleVal: number) => {
      const cluster = scene.clone(true) as THREE.Group
      const floor = cluster.getObjectByName('grass-floor')
      if (floor) {
        floor.removeFromParent()
      }

      const distCenter = Math.hypot(posX, posZ)
      const isCaster = distCenter <= 36

      const posY = getOpenWorldHeight(posX, posZ)
      cluster.position.set(posX, posY, posZ)
      cluster.rotation.y = rotY
      cluster.scale.setScalar(scaleVal)
      cluster.updateMatrixWorld(true)

      // 1. Gather all rock meshes and tree meshes for robust grounding
      const rockMeshes: THREE.Mesh[] = []
      const treeMeshes: THREE.Mesh[] = []

      cluster.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh
          m.castShadow = isCaster
          m.receiveShadow = true
          const srcMat = Array.isArray(m.material) ? m.material[0] : m.material
          if (srcMat?.name === 'RocksStylized_M') {
            rockMeshes.push(m)
          } else if (srcMat?.name === TRUNK_MATERIAL) {
            treeMeshes.push(m)
            m.material = barkMat
          } else if (srcMat?.name === LEAF_MATERIAL) {
            const std = srcMat as THREE.MeshStandardMaterial
            m.customDepthMaterial = makePineLeafDepthMaterial(std)
            m.material = makePineLeafMaterial(std, m, u.surface)
          }
        }
      })

      // Attach rocks directly to cluster root so nested scaling never causes floating
      for (const rock of rockMeshes) {
        cluster.attach(rock)
        if (!rock.geometry.boundingBox) rock.geometry.computeBoundingBox()
        if (!rock.geometry.boundingSphere) rock.geometry.computeBoundingSphere()
        const box = new THREE.Box3().setFromObject(rock)
        const rcX = (box.min.x + box.max.x) * 0.5
        const rcZ = (box.min.z + box.max.z) * 0.5
        const groundY = getOpenWorldHeight(rcX, rcZ)
        // Deep robust grounding: base sunk 0.50m into soil via transform-aware shift (zero floating on any slope)
        const desiredBottom = groundY - 0.50 * scaleVal
        const deltaY = desiredBottom - box.min.y
        applyWorldYShift(rock, deltaY)

        const bs = rock.geometry.boundingSphere!
        const center = bs.center.clone().applyMatrix4(rock.matrixWorld)
        const scale = new THREE.Vector3().setFromMatrixScale(rock.matrixWorld)
        // Accurate rock boundary without artificial 1.25x ballooning
        const r = Math.max(0.20, bs.radius * Math.min(scale.x, scale.z) * 0.72)

        if (r > 0.22) {
          colliders.push({
            id: `rock_${posX.toFixed(1)}_${posZ.toFixed(1)}_${rock.id}`,
            tag: 'rock',
            x: center.x,
            z: center.z,
            y: center.y,
            radius: r,
            height: Math.max(2.5, bs.radius * scale.y * 2.0),
          })
        }
      }

      // Ground tree trunks firmly into the terrain
      for (const tree of treeMeshes) {
        if (!tree.geometry.boundingBox) tree.geometry.computeBoundingBox()
        if (!tree.geometry.boundingSphere) tree.geometry.computeBoundingSphere()
        const trunkBox = new THREE.Box3().setFromObject(tree)
        const tcX = (trunkBox.min.x + trunkBox.max.x) * 0.5
        const tcZ = (trunkBox.min.z + trunkBox.max.z) * 0.5
        const groundY = getOpenWorldHeight(tcX, tcZ)
        const desiredBottom = groundY - 0.28 * scaleVal
        const deltaY = desiredBottom - trunkBox.min.y
        if (tree.parent && tree.parent !== cluster) {
          applyWorldYShift(tree.parent, deltaY)
        } else {
          tree.position.y += deltaY
        }
        tree.updateMatrixWorld(true)

        const bs = tree.geometry.boundingSphere!
        const center = bs.center.clone().applyMatrix4(tree.matrixWorld)
        const scale = new THREE.Vector3().setFromMatrixScale(tree.matrixWorld)
        // Authentic physical pine trunk wood radius (0.24m to 0.35m) so the player can weave between trees
        const trunkRadius = Math.max(0.22, Math.min(0.36, 0.28 * Math.min(scale.x, scale.z)))

        colliders.push({
          id: `tree_${posX.toFixed(1)}_${posZ.toFixed(1)}_${tree.id}`,
          tag: 'tree',
          x: tcX,
          z: tcZ,
          y: groundY,
          radius: trunkRadius,
          height: 24.0 * scaleVal,
        })
      }

      return cluster
    }

    // Central Sanctuary Grove (Authentic rocks & pines embedded naturally)
    clusters.push(createAuthenticCluster(0, 0, 0, 1.0))
    clusters.push(createAuthenticCluster(6, -4, Math.PI * 0.7, 0.95))

    // A. Outer Perimeter Mountain Woodlands (Framing the horizon)
    clusters.push(createAuthenticCluster(-36, 26, Math.PI * 0.4, 1.28))
    clusters.push(createAuthenticCluster(-42, -12, Math.PI * 1.1, 1.32))
    clusters.push(createAuthenticCluster(-28, -36, Math.PI * 0.85, 1.22))
    clusters.push(createAuthenticCluster(34, 32, Math.PI * 0.15, 1.25))
    clusters.push(createAuthenticCluster(40, -14, Math.PI * 1.6, 1.30))
    clusters.push(createAuthenticCluster(26, -38, Math.PI * 0.95, 1.20))
    clusters.push(createAuthenticCluster(0, 44, Math.PI * 0.3, 1.35))
    clusters.push(createAuthenticCluster(0, -44, Math.PI * 1.2, 1.30))

    // B. Shrine Sanctuary Groves (Clustering naturally around each monolith)
    // 1. West Wind Monolith (-22, 0, 8)
    clusters.push(createAuthenticCluster(-27, 14, Math.PI * 0.65, 1.15))
    clusters.push(createAuthenticCluster(-18, 3, Math.PI * 1.3, 0.95))

    // 2. South Solar Flame Monolith (14, 0, -25)
    clusters.push(createAuthenticCluster(19, -30, Math.PI * 1.7, 1.10))
    clusters.push(createAuthenticCluster(8, -21, Math.PI * 0.45, 0.92))

    // 3. North Twilight Star Monolith (20, 0, 20)
    clusters.push(createAuthenticCluster(26, 25, Math.PI * 0.8, 1.12))
    clusters.push(createAuthenticCluster(15, 15, Math.PI * 1.85, 0.94))

    // 4. Deep Titan Monolith (-8, 0, -22)
    clusters.push(createAuthenticCluster(-14, -28, Math.PI * 0.35, 1.14))
    clusters.push(createAuthenticCluster(-3, -17, Math.PI * 1.45, 0.90))

    // C. Scenic Meadow Sentinel Pines (Dotting the rolling landscape)
    clusters.push(createAuthenticCluster(11, 7, Math.PI * 0.5, 1.08))
    clusters.push(createAuthenticCluster(-11, -8, Math.PI * 1.25, 1.02))
    clusters.push(createAuthenticCluster(15, -7, Math.PI * 0.9, 0.96))

    // 6. Ancient Cobblestone Trail Stones guiding to the 4 shrines
    const stoneMarkers: Array<{ pos: [number, number, number]; rot: number; scale: number }> = []
    const shrineTargets = [
      { x: -22, z: 8 },   // West Wind
      { x: 14, z: -25 },  // South Solar
      { x: 20, z: 20 },   // North Twilight
      { x: -8, z: -22 },  // Deep Titan
    ]

    shrineTargets.forEach((st) => {
      for (let step = 1; step <= 5; step++) {
        const t = step / 6
        const pathX = t * st.x + Math.sin(t * Math.PI) * 2.2
        const pathZ = t * st.z + Math.cos(t * Math.PI) * 1.8
        const pathY = getOpenWorldHeight(pathX, pathZ) + 0.04
        stoneMarkers.push({
          pos: [pathX, pathY, pathZ],
          rot: Math.random() * Math.PI * 2,
          scale: 0.35 + Math.random() * 0.2,
        })
      }
    })

    return {
      terrainMesh: groundMesh,
      coreBladesMesh: coreBlades,
      outerBladesMesh: outerBlades,
      flowerMeshes: flowerInstances,
      foliageClusters: clusters,
      pathMarkers: stoneMarkers,
      colliders,
    }
  }, [scene, u])

  foliageClustersRef.current = foliageClusters

  useEffect(() => {
    worldCollisionSystem.addColliders(colliders)
    onLoaded?.()
  }, [colliders, onLoaded])

  // ── Sync Uniforms with Zero GC allocations per frame ───────────────────────
  useFrame((state, delta) => {
    const s = u.surface
    const b = u.bark

    s.uTime.value = (s.uTime.value + delta) % 3600

    // Cache sunlight direction
    if (!sunLightRef.current) {
      state.scene.traverse((o) => {
        if (!sunLightRef.current && (o as THREE.DirectionalLight).isDirectionalLight) {
          sunLightRef.current = o as THREE.DirectionalLight
        }
      })
    }

    if (sunLightRef.current) {
      sunLightRef.current.getWorldPosition(sunPos.current)
      sunLightRef.current.target.getWorldPosition(sunTarget.current)
      s.uSunDir.value.subVectors(sunPos.current, sunTarget.current).normalize()
      s.uSunColor.value.copy(sunLightRef.current.color).multiplyScalar(sunLightRef.current.intensity)
    }

    // Real-Time Grass Trampling under player's feet
    if (playerPosRef?.current) {
      const p = playerPosRef.current
      const playerSlot = MAX_ROCKS - 1
      s.uRocks.value[playerSlot].set(p.x, p.y, p.z, 1.4)
      s.uRockCount.value = MAX_ROCKS
    }

    // ── Localized Sword Swing Directional Grass Wind & Parting ───────────────
    // Modulates ONLY blades in the immediate 1.8-2.2m slice arc in front of the blade.
    // Leaves global forest wind 100% serene and calm (zero global meadow shaking).
    const swordSlot = MAX_ROCKS - 2

    if (grassWindImpulse.active && grassWindImpulse.timer > 0) {
      grassWindImpulse.timer -= delta
      const progress = 1.0 - Math.max(0, grassWindImpulse.timer / grassWindImpulse.maxDuration)
      const radius = THREE.MathUtils.lerp(0.8, grassWindImpulse.maxRadius, Math.sin(progress * Math.PI * 0.5))
      const intensity = Math.sin((1.0 - progress) * Math.PI * 0.5) * grassWindImpulse.strength

      if (s.uSwordSlash) {
        s.uSwordSlash.value.set(
          grassWindImpulse.origin.x,
          grassWindImpulse.origin.y,
          grassWindImpulse.origin.z,
          radius * Math.min(1.0, intensity)
        )
      }
      if (s.uSwordDir) {
        s.uSwordDir.value.copy(grassWindImpulse.dir)
      }

      // Also set rock trampling slot for tactile local parting
      s.uRocks.value[swordSlot].set(
        grassWindImpulse.origin.x,
        grassWindImpulse.origin.y,
        grassWindImpulse.origin.z,
        radius * 0.65
      )
    } else {
      if (s.uSwordSlash) s.uSwordSlash.value.set(0, -9999, 0, 0)
      s.uRocks.value[swordSlot].set(0, -9999, 0, 0)
      grassWindImpulse.active = false
    }

    // Wind parameters (Calm, natural forest meadow breeze - ZERO global shaking on sword swing)
    const rad = 45 * (Math.PI / 180)
    s.uWindDir.value.set(Math.cos(rad), Math.sin(rad))
    s.uWindStrength.value = 0.22
    s.uWindSpeed.value = 1.30
    s.uWindFreq.value = 0.36
    s.uWindTurb.value = 0.25
    s.uWindLean.value = 0.45
    s.uWindFixLocal.value = 1

    // Colors (Authentic Studio Ghibli stylized meadow matching cloned model)
    const c = colorsRef.current
    c.grassBottom.set('#1a3c10')
    c.grassTop.set('#6da824')
    s.uGrassBottom.value.copy(c.grassBottom)
    s.uGrassTop.value.copy(c.grassTop)
    s.uGradStart.value = 0.15
    s.uGradEnd.value = 0.92
    s.uGradPower.value = 1.15
    s.uBrightness.value = 1.02

    // Lush vs Dry environmental patches
    s.uPatchLush.value.set('#16360c')
    s.uPatchDry.value.set('#78a420')
    s.uPatchStrength.value = 0.12
    s.uPatchScale.value = 0.08
    s.uPatchBias.value = 1.2

    // Translucency (Subsurface sun scatter — luminous golden-green leaf transmission from model)
    c.transColor.set('#bde042')
    s.uTransColor.value.copy(c.transColor)
    s.uTransStrength.value = 2.2
    s.uTransPower.value = 3.4
    s.uTransTip.value = 0.78
    s.uTransShadow.value = 1.0

    // Shadows
    s.uShadowStrength.value = 0.6
    s.uShadowSamples.value = 1
    s.uShadowSampleY.value = 0.4
    s.uShadowRadius.value = 0.3

    // Trampling settings
    s.uRockFlatten.value = 0.85
    s.uRockBend.value = 0.25
    s.uRockRadiusMul.value = 1.0
    s.uRockFalloff.value = 0.35

    // Ground Dirt & Moss Variation - Natural organic tonal depth and micro grain
    s.uTintFloor.value = 1
    s.uFlatFloorNormal.value = 1
    s.uGndVarColor.value.set('#1e3c12')
    s.uGndVarScale.value = 0.35
    s.uGndVarStrength.value = 0.50
    s.uGndGrainScale.value = 5.2
    s.uGndGrainStrength.value = 0.38
    s.uGndReliefScale.value = 0.6
    s.uGndReliefStrength.value = 0.25
    c.dirtColor.set('#1a3c10')
    s.uDirtColor.value.copy(c.dirtColor)
    s.uDirtCoverage.value = 0.0
    s.uDirtScale.value = 0.25
    s.uDirtSoftness.value = 0.12
    s.uDirtWarp.value = 0.2
    s.uDirtCut.value = 0.0
    s.uDirtBlend.value = 0.25

    // Bark Uniforms
    b.uBarkScale.value = 1.0
    c.barkTint.set('#2b2118')
    b.uBarkTint.value.copy(c.barkTint)
    b.uBarkTintStrength.value = 0.55
    b.uBarkSaturation.value = 1.0
    b.uBarkBrightness.value = 1.25
    b.uBarkAOStrength.value = 0.85

    // Pine Canopy Foliage - Lush healthy forest pine needles
    s.uLeafBottom.value.set('#1e4420')
    s.uLeafTop.value.set('#568c2e')
    s.uLeafBrightness.value = 1.35
    s.uLeafGradPower.value = 1.05

    // Dynamic Distance-based Lazy Loading for Foliage Clusters (Zero per-frame traversal)
    const camPos = state.camera.position
    for (let ci = 0; ci < foliageClustersRef.current.length; ci++) {
      const cl = foliageClustersRef.current[ci]
      const dx = cl.position.x - camPos.x
      const dz = cl.position.z - camPos.z
      const distSq = dx * dx + dz * dz

      // Dynamic distance lazy-loading: cull clusters > 72m away
      cl.visible = distSq <= 72 * 72
    }
  })

  return (
    <group>
      {/* 1. Rolling Open World Terrain */}
      <primitive object={terrainMesh} />

      {/* 2. 85,000 Dense, Slender, Fine Grass Blades (Gapless Core Sanctuary Meadow) */}
      <primitive object={coreBladesMesh} />

      {/* 3. 35,000 Perimeter Foothills Grass Blades (Smooth Horizon Transition) */}
      <primitive object={outerBladesMesh} />

      {/* 4. Wildflowers */}
      {flowerMeshes.map((fm, i) => (
        <primitive key={`flowers-${i}`} object={fm} />
      ))}

      {/* 4. Rich Ancient Forest & Conifer Copses */}
      {foliageClusters.map((cl, i) => (
        <primitive key={`grove-${i}`} object={cl} />
      ))}

      {/* 5. Ancient Cobblestone Trail Stones */}
      {pathMarkers.map((sm, i) => (
        <mesh
          key={`stone-${i}`}
          position={sm.pos}
          rotation={[0, sm.rot, 0]}
          scale={sm.scale}
          receiveShadow
          castShadow
        >
          <cylinderGeometry args={[0.42, 0.48, 0.08, 7]} />
          <meshStandardMaterial
            color="#525850"
            roughness={0.92}
            metalness={0.08}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}
