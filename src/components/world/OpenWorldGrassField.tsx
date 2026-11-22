// ─────────────────────────────────────────────────────────────────────────────
// OpenWorldGrassField — Optimized Open World Stylized 3JS Foliage System
// Genuine 3D pine trees & rocks cloned directly from grass-scene.glb,
// wide lush GPU instanced grass blades, wildflowers, winding cobblestone paths,
// and real-time player grass trampling.
// Optimized for rock-solid 60+ FPS: Zero GC allocations in useFrame, cached lighting.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'

import { createGrassFieldUniforms } from '../grassField/uniforms'
import { GRASS_PRESETS } from '../grassField/presets'
import { MAX_ROCKS } from '../grassField/shaders/grassBlade'
import { makeGroundMaterial } from '../grassField/materials/groundMaterial'
import { makeBarkMaterial } from '../grassField/materials/barkMaterial'
import {
  makePineLeafMaterial,
  makePineLeafDepthMaterial,
} from '../grassField/materials/pineLeafMaterial'
import { scatterBlades, scatterFlowers } from '../grassField/utils/scatter'
import {
  useGrassControls,
  useFlowerControls,
  useGrassSceneControls,
} from '../grassField/utils/controls'

export const WORLD_SIZE = 140
export const WORLD_SEGMENTS = 64

// Smooth gentle rolling elevation that seamlessly blends with the central diorama (r < 7.2m)
export function getOpenWorldHeight(x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z)
  if (dist < 7.2) {
    return 0 // Flat base matching the central diorama
  }
  const blend = Math.min(1, (dist - 7.2) / 6.0)
  const hills =
    Math.sin(x * 0.055) * 1.2 +
    Math.cos(z * 0.048) * 1.0 +
    Math.sin(x * 0.12 + z * 0.09) * 0.4
  return hills * blend
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
  preset = 'default',
  playerPosRef,
  onLoaded,
}: OpenWorldGrassFieldProps) {
  const groupRef = useRef<THREE.Group>(null!)

  // Load the authentic 3D GLB model and textures
  const { scene } = useGLTF(GLB_URL)
  const [barkColor, barkAO, barkHeight] = useTexture(BARK_TEXTURES)
  const [maskA, rgbA, gradA] = useTexture(FLOWER_TEXTURES_A)
  const [maskB, rgbB, gradB] = useTexture(FLOWER_TEXTURES_B)

  // Controls
  const [grass, setGrass] = useGrassControls()
  const flowers = useFlowerControls()
  const sceneCtl = useGrassSceneControls()

  // Apply preset
  useEffect(() => {
    const p = GRASS_PRESETS[preset]
    if (p) {
      setGrass({ ...GRASS_PRESETS.default.values, ...p.values })
    }
  }, [preset, setGrass])

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

  // Sunlight tracker with cached reference (zero per-frame scene traversal)
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null)
  const sunPos = useRef(new THREE.Vector3())
  const sunTarget = useRef(new THREE.Vector3())

  // Pre-allocated Color objects for zero GC per frame
  const colorsRef = useRef({
    grassBottom: new THREE.Color(),
    grassTop: new THREE.Color(),
    transColor: new THREE.Color(),
    dirtColor: new THREE.Color(),
    barkTint: new THREE.Color(),
  })

  // ── Build Open World Foliage, Terrain & Trails ─────────────────────────────
  const { terrainMesh, bladesMesh, flowerMeshes, foliageClusters, pathMarkers } = useMemo(() => {
    // 1. Rolling Open World Terrain Plane
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

    // Ground Material using EXACT FBM Dirt & Colormap from Cortiz repo
    const groundMat = makeGroundMaterial(u.surface, new THREE.Color('#4f7c13'))
    const groundMesh = new THREE.Mesh(terrainGeo, groundMat)
    groundMesh.receiveShadow = true
    groundMesh.castShadow = false
    groundMesh.updateMatrixWorld(true)

    // 2. Scatter 24,000 Wide, Lush 3JS Grass Blades (Locked 60 FPS + Full Meadow Coverage)
    const blades = scatterBlades(groundMesh, {
      uniforms: u.surface,
      density: 12,
      maxCount: 24_000,
      minWidth: 0.16,
      maxWidth: 0.22,
      minLength: 0.38,
      maxLength: 0.72,
      tiltMax: 0.32,
      segments: 3, // 3 segments = 5 triangles per blade (peak raster efficiency)
    })

    // Zero out any blades inside the central diorama (r < 7.0m) to avoid overlap with GrassField
    const dummy = new THREE.Matrix4()
    const p = new THREE.Vector3()
    const rot = new THREE.Quaternion()
    const s = new THREE.Vector3()

    for (let i = 0; i < blades.count; i++) {
      blades.getMatrixAt(i, dummy)
      dummy.decompose(p, rot, s)
      if (p.x * p.x + p.z * p.z < 7.0 * 7.0) {
        s.set(0, 0, 0)
        dummy.compose(p, rot, s)
        blades.setMatrixAt(i, dummy)
      }
    }
    blades.instanceMatrix.needsUpdate = true

    // 3. Scatter Wildflowers
    const flowerInstances = scatterFlowers(groundMesh, {
      uniforms: u.flower,
      texA: u.flowerTexA,
      texB: u.flowerTexB,
      dirt: u.surface,
      density: 0.25,
      maxCount: 1000,
      size: 0.44,
      mixA: 0.5,
    })

    // Filter inner flowers
    for (const fim of flowerInstances) {
      for (let i = 0; i < fim.count; i++) {
        fim.getMatrixAt(i, dummy)
        dummy.decompose(p, rot, s)
        if (p.x * p.x + p.z * p.z < 7.0 * 7.0) {
          s.set(0, 0, 0)
          dummy.compose(p, rot, s)
          fim.setMatrixAt(i, dummy)
        }
      }
      fim.instanceMatrix.needsUpdate = true
    }

    // 4. Cloned Foliage Clusters (Authentic Trees & Rocks)
    const barkMat = makeBarkMaterial(u.bark)
    const clusters: THREE.Group[] = []

    const createAuthenticCluster = (posX: number, posZ: number, rotY: number, scaleVal: number) => {
      const cluster = scene.clone(true) as THREE.Group
      const floor = cluster.getObjectByName('grass-floor')
      if (floor) {
        floor.removeFromParent()
      }

      cluster.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh
          m.castShadow = true
          m.receiveShadow = true
          const srcMat = Array.isArray(m.material) ? m.material[0] : m.material
          if (srcMat.name === TRUNK_MATERIAL) {
            m.material = barkMat
          } else if (srcMat.name === LEAF_MATERIAL) {
            const std = srcMat as THREE.MeshStandardMaterial
            m.customDepthMaterial = makePineLeafDepthMaterial(std)
            m.material = makePineLeafMaterial(std, m, u.surface)
          }
        }
      })

      const posY = getOpenWorldHeight(posX, posZ)
      cluster.position.set(posX, posY, posZ)
      cluster.rotation.y = rotY
      cluster.scale.setScalar(scaleVal)
      return cluster
    }

    // 3 strategically positioned companion groves of authentic trees and rocks:
    clusters.push(createAuthenticCluster(-18, 4, Math.PI * 0.7, 0.92))
    clusters.push(createAuthenticCluster(14, -22, Math.PI * 1.4, 0.88))
    clusters.push(createAuthenticCluster(18, 18, Math.PI * 0.25, 0.90))

    // 5. Winding Ancient Cobblestone Trail Stones connecting spawn to the 4 shrines
    const stoneMarkers: Array<{ pos: [number, number, number]; rot: number; scale: number }> = []
    const shrineTargets = [
      { x: -22, z: 8 },   // West Wind
      { x: 14, z: -25 },  // South Solar
      { x: 20, z: 20 },   // North Twilight
      { x: -8, z: -22 },  // Deep Titan
    ]

    shrineTargets.forEach((st) => {
      // 5 path stones along each trail
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
      bladesMesh: blades,
      flowerMeshes: flowerInstances,
      foliageClusters: clusters,
      pathMarkers: stoneMarkers,
    }
  }, [scene, u])

  useEffect(() => {
    onLoaded?.()
  }, [onLoaded])

  // ── Sync Uniforms Efficiently (Zero GC allocations per frame) ──────────────
  useFrame((state, delta) => {
    const s = u.surface
    const f = u.flower
    const b = u.bark

    s.uTime.value = (s.uTime.value + delta) % 3600

    // Cache sunlight direction (find once, no scene traverse per frame)
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

    // Wind parameters
    const rad = grass.grWindDir * (Math.PI / 180)
    s.uWindDir.value.set(Math.cos(rad), Math.sin(rad))
    s.uWindStrength.value = grass.grWindStrength
    s.uWindSpeed.value = grass.grWindSpeed
    s.uWindFreq.value = grass.grWindFreq
    s.uWindTurb.value = grass.grWindTurb
    s.uWindLean.value = grass.grWindLean

    // Colors
    const c = colorsRef.current
    c.grassBottom.set(grass.grColorBottom)
    c.grassTop.set(grass.grColorTop)
    s.uGrassBottom.value.copy(c.grassBottom)
    s.uGrassTop.value.copy(c.grassTop)
    s.uGradStart.value = grass.grGradStart
    s.uGradEnd.value = grass.grGradEnd
    s.uGradPower.value = grass.grGradPower
    s.uBrightness.value = grass.grBrightness

    // Lush vs Dry patches
    s.uPatchLush.value.copy(c.grassBottom)
    s.uPatchDry.value.copy(c.grassTop)
    s.uPatchStrength.value = grass.grPatchStrength
    s.uPatchScale.value = grass.grPatchScale
    s.uPatchBias.value = grass.grPatchBias

    // Translucency & Shadows
    s.uShadowStrength.value = grass.grShadowStrength
    s.uShadowSamples.value = 1
    s.uShadowSampleY.value = grass.grShadowSampleY
    s.uShadowRadius.value = grass.grShadowRadius

    c.transColor.set(grass.grTransColor)
    s.uTransColor.value.copy(c.transColor)
    s.uTransStrength.value = grass.grTransStrength
    s.uTransPower.value = grass.grTransPower
    s.uTransTip.value = grass.grTransTip
    s.uTransShadow.value = grass.grTransShadow

    s.uDebugChannel.value = grass.grDebugChannel
    s.uWindFixLocal.value = grass.grWindFixLocal ? 1 : 0

    // Trampling settings
    s.uRockFlatten.value = grass.grRockFlatten
    s.uRockBend.value = grass.grRockBend
    s.uRockRadiusMul.value = grass.grRockRadiusMul
    s.uRockFalloff.value = grass.grRockFalloff

    // Ground Dirt Mask
    s.uTintFloor.value = grass.grTintFloor ? 1 : 0
    s.uFlatFloorNormal.value = grass.grFlatFloorNormal
    c.dirtColor.set(grass.grDirtColor)
    s.uDirtColor.value.copy(c.dirtColor)
    s.uDirtCoverage.value = Math.max(grass.grDirtCoverage, 0.08)
    s.uDirtScale.value = grass.grDirtScale
    s.uDirtSoftness.value = grass.grDirtSoftness
    s.uDirtWarp.value = grass.grDirtWarp
    s.uDirtCut.value = grass.grDirtCut
    s.uDirtBlend.value = grass.grDirtBlend

    // Bark Uniforms
    b.uBarkScale.value = grass.grBarkScale
    c.barkTint.set(grass.grBarkTint)
    b.uBarkTint.value.copy(c.barkTint)
    b.uBarkTintStrength.value = grass.grBarkTintStrength
    b.uBarkSaturation.value = grass.grBarkSaturation
    b.uBarkBrightness.value = grass.grBarkBrightness
    b.uBarkAOStrength.value = grass.grBarkAOStrength
    b.uBarkRelief.value = grass.grBarkRelief

    // Flower Uniforms
    f.uTime.value = s.uTime.value
    f.uWindDir.value.copy(s.uWindDir.value)
    f.uGrassColor.value.copy(c.grassBottom)
    f.uBrightness.value = flowers.flBrightness
    f.uWindStrength.value = flowers.flWindStrength
    f.uWindSpeed.value = flowers.flWindSpeed
    f.uWindFreq.value = flowers.flWindFreq
    f.uWindTurb.value = flowers.flWindTurb
    f.uWindLean.value = flowers.flWindLean
    f.uBendAmp.value = flowers.flBendAmp
    f.uBendFreq.value = flowers.flBendFreq
    f.uFlDirtMax.value = flowers.flDirtMax
  })

  return (
    <group ref={groupRef}>
      {/* ── 1. The Ground Surface with FBM Procedural Dirt ─────────────────── */}
      <primitive object={terrainMesh} />

      {/* ── 2. The Dense Animated Grass Blades (Single Draw Call) ──────────── */}
      <primitive object={bladesMesh} />

      {/* ── 3. Wildflowers Scattered Across the Meadow ─────────────────────── */}
      {flowerMeshes.map((fm, idx) => (
        <primitive key={`flower-im-${idx}`} object={fm} />
      ))}

      {/* ── 4. Cloned Tree & Rock Foliage Clusters ─────────────────────────── */}
      {foliageClusters.map((cluster, idx) => (
        <primitive key={`authentic-cluster-${idx}`} object={cluster} />
      ))}

      {/* ── 5. Winding Ancient Cobblestone Trail Stones ─────────────────────── */}
      {pathMarkers.map((m, idx) => (
        <mesh
          key={`path-stone-${idx}`}
          position={m.pos}
          rotation={[0, m.rot, 0]}
          scale={[m.scale, 0.08, m.scale * 1.3]}
          receiveShadow
        >
          <cylinderGeometry args={[1, 1.1, 0.4, 7]} />
          <meshStandardMaterial color="#554e47" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}
