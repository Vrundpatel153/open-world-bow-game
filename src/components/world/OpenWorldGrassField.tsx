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
    grassBottom: new THREE.Color('#2f5712'),
    grassTop: new THREE.Color('#82ac1e'),
    transColor: new THREE.Color('#c1e54d'),
    dirtColor: new THREE.Color('#284411'),
    barkTint: new THREE.Color('#2b2118'),
  })

  // ── Build Open World Foliage, Terrain & Trails ─────────────────────────────
  const { terrainMesh, bladesMesh, flowerMeshes, foliageClusters, pathMarkers } = useMemo(() => {
    // 1. Terrain Ground Mesh for high-density sampling (radius ~54m)
    const samplePlaneGeo = new THREE.PlaneGeometry(108, 108, 54, 54)
    samplePlaneGeo.rotateX(-Math.PI / 2)
    const sPosAttr = samplePlaneGeo.attributes.position
    for (let i = 0; i < sPosAttr.count; i++) {
      const x = sPosAttr.getX(i)
      const z = sPosAttr.getZ(i)
      sPosAttr.setY(i, getOpenWorldHeight(x, z))
    }
    samplePlaneGeo.computeVertexNormals()

    // 2. Scatter 54,000 Wide, Lush Grass Blades (Overlapping, Gapless Carpet)
    const blades = scatterBlades(new THREE.Mesh(samplePlaneGeo), {
      uniforms: u.surface,
      density: 10,
      maxCount: 40_000,
      minWidth: 0.26,
      maxWidth: 0.36,
      minLength: 0.58,
      maxLength: 0.94,
      tiltMax: 0.28,
      segments: 3,
    })

    // Filter inner diorama blades (r < 7.0m) and clamp boundary (r > 52m)
    const dummy = new THREE.Matrix4()
    const p = new THREE.Vector3()
    const rot = new THREE.Quaternion()
    const s = new THREE.Vector3()

    for (let i = 0; i < blades.count; i++) {
      blades.getMatrixAt(i, dummy)
      dummy.decompose(p, rot, s)
      const d2 = p.x * p.x + p.z * p.z
      if (d2 < 7.0 * 7.0 || d2 > 52.0 * 52.0) {
        s.set(0, 0, 0)
        dummy.compose(p, rot, s)
        blades.setMatrixAt(i, dummy)
      }
    }
    blades.instanceMatrix.needsUpdate = true

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

    // Deep forest moss green ground material
    const groundMat = makeGroundMaterial(u.surface, new THREE.Color('#325812'))
    const groundMesh = new THREE.Mesh(terrainGeo, groundMat)
    groundMesh.receiveShadow = true
    groundMesh.castShadow = false
    groundMesh.updateMatrixWorld(true)

    // 4. Scatter Wildflowers in active meadows
    const flowerInstances = scatterFlowers(new THREE.Mesh(samplePlaneGeo), {
      uniforms: u.flower,
      texA: u.flowerTexA,
      texB: u.flowerTexB,
      dirt: u.surface,
      density: 0.22,
      maxCount: 1200,
      size: 0.44,
      mixA: 0.5,
    })

    for (const fim of flowerInstances) {
      for (let i = 0; i < fim.count; i++) {
        fim.getMatrixAt(i, dummy)
        dummy.decompose(p, rot, s)
        const d2 = p.x * p.x + p.z * p.z
        if (d2 < 7.0 * 7.0 || d2 > 50.0 * 50.0) {
          s.set(0, 0, 0)
          dummy.compose(p, rot, s)
          fim.setMatrixAt(i, dummy)
        }
      }
      fim.instanceMatrix.needsUpdate = true
    }

    // 5. Rich Ancient Pine Forest & Conifer Copses (18+ Diverse Groves)
    const barkMat = makeBarkMaterial(u.bark)
    const clusters: THREE.Group[] = []

    const createAuthenticCluster = (posX: number, posZ: number, rotY: number, scaleVal: number) => {
      const cluster = scene.clone(true) as THREE.Group
      const floor = cluster.getObjectByName('grass-floor')
      if (floor) {
        floor.removeFromParent()
      }

      const distCenter = Math.hypot(posX, posZ)
      const isCaster = distCenter <= 36

      cluster.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh
          m.castShadow = isCaster
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
      bladesMesh: blades,
      flowerMeshes: flowerInstances,
      foliageClusters: clusters,
      pathMarkers: stoneMarkers,
    }
  }, [scene, u])

  useEffect(() => {
    onLoaded?.()
  }, [onLoaded])

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

    // Wind parameters (Dynamic waving meadow ripples)
    const rad = 45 * (Math.PI / 180)
    s.uWindDir.value.set(Math.cos(rad), Math.sin(rad))
    s.uWindStrength.value = 0.16
    s.uWindSpeed.value = 1.35
    s.uWindFreq.value = 0.45
    s.uWindTurb.value = 0.35
    s.uWindLean.value = 0.5
    s.uWindFixLocal.value = 1

    // Colors (Rich lush emerald meadow)
    const c = colorsRef.current
    c.grassBottom.set('#2f5712')
    c.grassTop.set('#82ac1e')
    s.uGrassBottom.value.copy(c.grassBottom)
    s.uGrassTop.value.copy(c.grassTop)
    s.uGradStart.value = 0.12
    s.uGradEnd.value = 1.0
    s.uGradPower.value = 1.6
    s.uBrightness.value = 0.95

    // Lush vs Dry patches
    s.uPatchLush.value.copy(c.grassBottom)
    s.uPatchDry.value.copy(c.grassTop)
    s.uPatchStrength.value = 0.25
    s.uPatchScale.value = 0.15
    s.uPatchBias.value = 1.8

    // Translucency (Subsurface sun scatter)
    c.transColor.set('#c1e54d')
    s.uTransColor.value.copy(c.transColor)
    s.uTransStrength.value = 2.8
    s.uTransPower.value = 3.0
    s.uTransTip.value = 0.65
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

    // Ground Dirt Mask - subtle accent only, NO bare mud craters
    s.uTintFloor.value = 1
    s.uFlatFloorNormal.value = 1
    c.dirtColor.set('#284411')
    s.uDirtColor.value.copy(c.dirtColor)
    s.uDirtCoverage.value = 0.04
    s.uDirtScale.value = 0.25
    s.uDirtSoftness.value = 0.12
    s.uDirtWarp.value = 0.2
    s.uDirtCut.value = 0.15
    s.uDirtBlend.value = 0.45

    // Bark Uniforms
    b.uBarkScale.value = 1.0
    c.barkTint.set('#2b2118')
    b.uBarkTint.value.copy(c.barkTint)
    b.uBarkTintStrength.value = 0.55
    b.uBarkSaturation.value = 1.0
    b.uBarkBrightness.value = 1.0
    b.uBarkAOStrength.value = 1.0

    // Pine Canopy Foliage
    s.uLeafBottom.value.set('#153018')
    s.uLeafTop.value.set('#4b7a28')
    s.uLeafBrightness.value = 1.15
    s.uLeafGradPower.value = 1.1
  })

  return (
    <group>
      {/* 1. Rolling Open World Terrain */}
      <primitive object={terrainMesh} />

      {/* 2. 54,000 Dense, Wide, Lush Grass Blades (Gapless Carpet) */}
      <primitive object={bladesMesh} />

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
