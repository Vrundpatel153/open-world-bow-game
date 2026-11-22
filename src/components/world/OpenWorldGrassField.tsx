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
  strength: 0,
  timer: 0,
  trigger(origin: THREE.Vector3, dir: THREE.Vector3, power: number = 1.0) {
    this.active = true
    this.origin.copy(origin).addScaledVector(dir, 1.2)
    this.dir.copy(dir)
    this.strength = power
    this.timer = 0.28
    this.radius = 0.6
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
  const { terrainMesh, coreBladesMesh, flowerMeshes, foliageClusters, pathMarkers, colliders } = useMemo(() => {
    // 1. High-Density Core Meadow Plane (86m x 86m covering active sanctuary gaplessly)
    const coreMeadowGeo = new THREE.PlaneGeometry(86, 86, 96, 96)
    coreMeadowGeo.rotateX(-Math.PI / 2)
    const cPosAttr = coreMeadowGeo.attributes.position
    for (let i = 0; i < cPosAttr.count; i++) {
      const x = cPosAttr.getX(i)
      const z = cPosAttr.getZ(i)
      cPosAttr.setY(i, getOpenWorldHeight(x, z))
    }
    coreMeadowGeo.computeVertexNormals()

    // 85,000 5-blade organic tufts (425,000 curved slender blades) across core sanctuary:
    // Rich, lush, dense, completely gapless carpet
    const coreBlades = scatterBlades(new THREE.Mesh(coreMeadowGeo), {
      uniforms: u.surface,
      density: 16,
      maxCount: 85_000,
      minWidth: 0.16,
      maxWidth: 0.24,
      minLength: 0.30,
      maxLength: 0.50,
      tiltMax: 0.24,
      segments: 3,
    })

    // 2. Horizon Open World Terrain Plane (140m x 140m)
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
    const groundMat = makeGroundMaterial(u.surface, new THREE.Color('#22460e'))
    const groundMesh = new THREE.Mesh(terrainGeo, groundMat)
    groundMesh.receiveShadow = true
    groundMesh.castShadow = false
    groundMesh.updateMatrixWorld(true)

    // 4. Scatter Wildflowers across active meadows
    const flowerInstances = scatterFlowers(new THREE.Mesh(coreMeadowGeo), {
      uniforms: u.flower,
      texA: u.flowerTexA,
      texB: u.flowerTexB,
      dirt: u.surface,
      density: 0.22,
      maxCount: 2200,
      size: 0.38,
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
        const maxS = Math.max(scale.x, scale.z)
        const r = bs.radius * maxS * 1.25

        if (r > 0.28) {
          colliders.push({
            id: `rock_${posX.toFixed(1)}_${posZ.toFixed(1)}_${rock.id}`,
            tag: 'rock',
            x: center.x,
            z: center.z,
            y: center.y,
            radius: r,
            height: Math.max(2.5, bs.radius * scale.y * 3.0),
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
        const trunkRadius = Math.max(0.55, bs.radius * Math.min(scale.x, scale.z) * 0.65)

        colliders.push({
          id: `tree_${posX.toFixed(1)}_${posZ.toFixed(1)}_${tree.id}`,
          tag: 'tree',
          x: center.x,
          z: center.z,
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

    // Sword Swing Air Pressure Wave (Parts and ripples grass dynamically)
    let extraWindStrength = 0
    let extraWindSpeed = 0
    const swordSlot = MAX_ROCKS - 2

    if (grassWindImpulse.active && grassWindImpulse.timer > 0) {
      grassWindImpulse.timer -= delta
      grassWindImpulse.radius += delta * 4.2
      s.uRocks.value[swordSlot].set(
        grassWindImpulse.origin.x,
        grassWindImpulse.origin.y,
        grassWindImpulse.origin.z,
        Math.min(2.2, grassWindImpulse.radius)
      )
      extraWindStrength = grassWindImpulse.timer * 0.45 * grassWindImpulse.strength
      extraWindSpeed = grassWindImpulse.timer * 3.2
    } else {
      s.uRocks.value[swordSlot].set(0, -9999, 0, 0)
      grassWindImpulse.active = false
    }

    // Wind parameters (Dynamic waving meadow ripples + sword swing air pulse)
    const rad = 45 * (Math.PI / 180)
    s.uWindDir.value.set(Math.cos(rad), Math.sin(rad))
    s.uWindStrength.value = 0.22 + extraWindStrength
    s.uWindSpeed.value = 1.30 + extraWindSpeed
    s.uWindFreq.value = 0.36
    s.uWindTurb.value = 0.25
    s.uWindLean.value = 0.45
    s.uWindFixLocal.value = 1

    // Colors (Authentic Studio Ghibli stylized meadow matching cloned model)
    const c = colorsRef.current
    c.grassBottom.set('#22460e')
    c.grassTop.set('#78a41c')
    s.uGrassBottom.value.copy(c.grassBottom)
    s.uGrassTop.value.copy(c.grassTop)
    s.uGradStart.value = 0.08
    s.uGradEnd.value = 0.94
    s.uGradPower.value = 1.15
    s.uBrightness.value = 0.96

    // Lush vs Dry environmental patches
    s.uPatchLush.value.set('#1e400c')
    s.uPatchDry.value.set('#7ea420')
    s.uPatchStrength.value = 0.10
    s.uPatchScale.value = 0.08
    s.uPatchBias.value = 1.3

    // Translucency (Subsurface sun scatter — luminous golden-green leaf transmission from model)
    c.transColor.set('#c4e848')
    s.uTransColor.value.copy(c.transColor)
    s.uTransStrength.value = 2.4
    s.uTransPower.value = 3.6
    s.uTransTip.value = 0.82
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
    s.uGndVarColor.value.set('#1e4412')
    s.uGndVarScale.value = 0.35
    s.uGndVarStrength.value = 0.45
    s.uGndGrainScale.value = 4.2
    s.uGndGrainStrength.value = 0.35
    s.uGndReliefScale.value = 0.6
    s.uGndReliefStrength.value = 0.28
    c.dirtColor.set('#243b12')
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

    // Dynamic Distance-based Lazy Loading and Shadow Culling for Foliage Clusters
    const camPos = state.camera.position
    for (let ci = 0; ci < foliageClustersRef.current.length; ci++) {
      const cl = foliageClustersRef.current[ci]
      const dx = cl.position.x - camPos.x
      const dz = cl.position.z - camPos.z
      const distSq = dx * dx + dz * dz

      // Dynamic distance lazy-loading: cull objects > 68m away
      if (distSq > 68 * 68) {
        cl.visible = false
      } else {
        cl.visible = true
        // Shadow culling: only nearby clusters (< 36m) cast dynamic shadows
        const castShadow = distSq < 36 * 36
        cl.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = castShadow
          }
        })
      }
    }
  })

  return (
    <group>
      {/* 1. Rolling Open World Terrain */}
      <primitive object={terrainMesh} />

      {/* 2. 55,000 Dense, Wide, Lush Grass Blades (Gapless Sanctuary Meadow) */}
      <primitive object={coreBladesMesh} />

      {/* 3. Wildflowers */}
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
