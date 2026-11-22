// ─────────────────────────────────────────────────────────────────────────────
// ShrineMonoliths — AAA Ancient Megalith Shrines & Floating Guardian Shield Targets
// Features:
// - Chiseled granite dolmen / trilithon megalith pillars with heavy lintel capstones
// - Tiered octagonal flagstone sanctuary with outer standing monolith stones
// - Carved Elder Futhark glowing runes chiseled into the stone pillars
// - Floating faceted Elemental Crystals with orbiting runic focus shards
// - Authentic circular Viking/Celtic oak & bronze guardian shield targets
// - Ascending celestial light pillar and collectable radiant Elemental Core
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useQuestStore, type ShrineDef } from '../stores/questStore'
import { getOpenWorldHeight } from '@/components/world/OpenWorldGrassField'

interface ShrineMonolithsProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>
}

export default function ShrineMonoliths({ playerPosRef }: ShrineMonolithsProps) {
  const shrines = useQuestStore((s) => s.shrines)
  const collectRune = useQuestStore((s) => s.collectRune)

  // Track time for animations
  const timeRef = useRef(0)

  // ── Shared Geometries: Ancient Megalith Sanctuary ──────────────────────────
  const {
    daisLowerGeo,
    daisUpperGeo,
    pillarGeo,
    lintelGeo,
    standingStoneGeo,
    crystalGeo,
    shardGeo,
    beamGeo,
    targetPlankGeo,
    targetRimGeo,
    targetRuneRingGeo,
    targetBullseyeGeo,
    runeStripGeo,
  } = useMemo(() => {
    // 1. Tiered Sanctuary Flagstone Dais
    const daisLower = new THREE.CylinderGeometry(3.6, 3.9, 0.35, 12)
    const daisUpper = new THREE.CylinderGeometry(2.6, 2.9, 0.35, 12)

    // 2. Twin Granite Megalith Pillars (Chiseled, slightly tapered)
    const pillar = new THREE.BoxGeometry(0.75, 4.4, 0.85)

    // 3. Heavy Horizontal Lintel Capstone
    const lintel = new THREE.BoxGeometry(3.2, 0.65, 1.1)

    // 4. Outer Standing Monolith Stones (Weathered Stonehenge Menhirs)
    const menhir = new THREE.CylinderGeometry(0.35, 0.55, 2.4, 6)

    // 5. Faceted Elemental Crystal (Octahedron with bevel-like facets)
    const crystal = new THREE.OctahedronGeometry(0.48, 0)

    // Orbiting runic focus shards
    const shard = new THREE.TetrahedronGeometry(0.14, 0)

    // Celestial Beacon Light Pillar (Cylinder reaching to the heavens)
    const beam = new THREE.CylinderGeometry(0.9, 1.4, 65, 16, 1, true)
    beam.translate(0, 32.5, 0)

    // 6. Guardian Shield Target Components
    // Heavy wooden plank disc
    const plankDisc = new THREE.CylinderGeometry(0.55, 0.55, 0.06, 24)
    plankDisc.rotateX(Math.PI / 2)

    // Chiseled bronze/iron protective rim
    const rim = new THREE.TorusGeometry(0.56, 0.045, 8, 24)

    // Concentric glowing runic ring
    const runeRing = new THREE.RingGeometry(0.32, 0.42, 24)

    // Center radiant bullseye
    const bullseye = new THREE.CircleGeometry(0.24, 20)

    // Vertical runic channel strip
    const runeStrip = new THREE.BoxGeometry(0.09, 3.2, 0.04)

    return {
      daisLowerGeo: daisLower,
      daisUpperGeo: daisUpper,
      pillarGeo: pillar,
      lintelGeo: lintel,
      standingStoneGeo: menhir,
      crystalGeo: crystal,
      shardGeo: shard,
      beamGeo: beam,
      targetPlankGeo: plankDisc,
      targetRimGeo: rim,
      targetRuneRingGeo: runeRing,
      targetBullseyeGeo: bullseye,
      runeStripGeo: runeStrip,
    }
  }, [])

  // ── High Quality Materials ─────────────────────────────────────────────────
  const { weatheredStoneMat, darkOakMat, bronzeMat } = useMemo(() => {
    // Weathered ancient granite stone with subtle roughness
    const stone = new THREE.MeshStandardMaterial({
      color: '#47433e',
      roughness: 0.88,
      metalness: 0.06,
    })

    // Heavy weathered dark oak planks for shield targets
    const oak = new THREE.MeshStandardMaterial({
      color: '#2b1b12',
      roughness: 0.75,
      metalness: 0.04,
    })

    // Oxidized bronze metal for target rims & rivets
    const bronze = new THREE.MeshStandardMaterial({
      color: '#8a6840',
      roughness: 0.45,
      metalness: 0.75,
    })

    return {
      weatheredStoneMat: stone,
      darkOakMat: oak,
      bronzeMat: bronze,
    }
  }, [])

  // Proximity check for [E] / Walk-to-collect Rune Core
  useFrame((_, delta) => {
    timeRef.current += delta

    if (playerPosRef?.current) {
      const p = playerPosRef.current
      for (const s of shrines) {
        if (s.isAwakened && !s.isRuneCollected) {
          const shrineY = getOpenWorldHeight(s.position[0], s.position[2])
          const shrinePos = new THREE.Vector3(s.position[0], shrineY, s.position[2])
          if (p.distanceTo(shrinePos) < 3.8) {
            collectRune(s.id)
          }
        }
      }
    }
  })

  return (
    <>
      {shrines.map((shrine) => (
        <SingleAncientShrine
          key={shrine.id}
          shrine={shrine}
          timeRef={timeRef}
          daisLowerGeo={daisLowerGeo}
          daisUpperGeo={daisUpperGeo}
          pillarGeo={pillarGeo}
          lintelGeo={lintelGeo}
          standingStoneGeo={standingStoneGeo}
          crystalGeo={crystalGeo}
          shardGeo={shardGeo}
          beamGeo={beamGeo}
          targetPlankGeo={targetPlankGeo}
          targetRimGeo={targetRimGeo}
          targetRuneRingGeo={targetRuneRingGeo}
          targetBullseyeGeo={targetBullseyeGeo}
          runeStripGeo={runeStripGeo}
          weatheredStoneMat={weatheredStoneMat}
          darkOakMat={darkOakMat}
          bronzeMat={bronzeMat}
        />
      ))}
    </>
  )
}

function SingleAncientShrine({
  shrine,
  timeRef,
  daisLowerGeo,
  daisUpperGeo,
  pillarGeo,
  lintelGeo,
  standingStoneGeo,
  crystalGeo,
  shardGeo,
  beamGeo,
  targetPlankGeo,
  targetRimGeo,
  targetRuneRingGeo,
  targetBullseyeGeo,
  runeStripGeo,
  weatheredStoneMat,
  darkOakMat,
  bronzeMat,
}: {
  shrine: ShrineDef
  timeRef: React.MutableRefObject<number>
  daisLowerGeo: THREE.CylinderGeometry
  daisUpperGeo: THREE.CylinderGeometry
  pillarGeo: THREE.BoxGeometry
  lintelGeo: THREE.BoxGeometry
  standingStoneGeo: THREE.CylinderGeometry
  crystalGeo: THREE.OctahedronGeometry
  shardGeo: THREE.TetrahedronGeometry
  beamGeo: THREE.CylinderGeometry
  targetPlankGeo: THREE.CylinderGeometry
  targetRimGeo: THREE.TorusGeometry
  targetRuneRingGeo: THREE.RingGeometry
  targetBullseyeGeo: THREE.CircleGeometry
  runeStripGeo: THREE.BoxGeometry
  weatheredStoneMat: THREE.Material
  darkOakMat: THREE.Material
  bronzeMat: THREE.Material
}) {
  const crystalRef = useRef<THREE.Mesh>(null!)
  const shardsGroupRef = useRef<THREE.Group>(null!)
  const beamRef = useRef<THREE.Mesh>(null!)

  const posX = shrine.position[0]
  const posZ = shrine.position[2]
  const posY = getOpenWorldHeight(posX, posZ)

  // Glowing rune materials matching shrine element
  const { runeMat, crystalMat, beamMat } = useMemo(() => {
    const rune = new THREE.MeshStandardMaterial({
      color: shrine.color,
      emissive: shrine.color,
      emissiveIntensity: shrine.isAwakened ? 2.8 : 0.9,
      roughness: 0.2,
    })

    const crystal = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: shrine.color,
      emissiveIntensity: shrine.isAwakened ? 3.4 : 1.2,
      roughness: 0.12,
      metalness: 0.2,
    })

    const beam = new THREE.MeshBasicMaterial({
      color: shrine.color,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { runeMat: rune, crystalMat: crystal, beamMat: beam }
  }, [shrine.color, shrine.isAwakened])

  useFrame(() => {
    const t = timeRef.current
    if (crystalRef.current) {
      // Gentle floating bob & slow magical rotation
      crystalRef.current.rotation.y = t * 0.7
      crystalRef.current.rotation.z = Math.sin(t * 0.4) * 0.15
      crystalRef.current.position.y = 4.4 + Math.sin(t * 1.6) * 0.14
    }

    if (shardsGroupRef.current) {
      shardsGroupRef.current.rotation.y = -t * 1.1
      shardsGroupRef.current.position.y = 4.4 + Math.sin(t * 1.6) * 0.14
    }

    if (beamRef.current && shrine.isAwakened) {
      beamRef.current.rotation.y = t * 0.18
    }
  })

  return (
    <group position={[posX, posY, posZ]}>
      {/* ── 1. Tiered Sanctuary Flagstone Dais ─────────────────────────────── */}
      <mesh
        geometry={daisLowerGeo}
        material={weatheredStoneMat}
        position={[0, 0.18, 0]}
        receiveShadow
      />
      <mesh
        geometry={daisUpperGeo}
        material={weatheredStoneMat}
        position={[0, 0.52, 0]}
        receiveShadow
      />

      {/* ── 2. Twin Granite Megalith Dolmen Pillars ───────────────────────── */}
      {/* Left Pillar */}
      <mesh
        geometry={pillarGeo}
        material={weatheredStoneMat}
        position={[-1.0, 2.7, 0]}
        castShadow
        receiveShadow
      />
      {/* Right Pillar */}
      <mesh
        geometry={pillarGeo}
        material={weatheredStoneMat}
        position={[1.0, 2.7, 0]}
        castShadow
        receiveShadow
      />

      {/* Heavy Horizontal Lintel Capstone */}
      <mesh
        geometry={lintelGeo}
        material={weatheredStoneMat}
        position={[0, 5.0, 0]}
        castShadow
        receiveShadow
      />

      {/* ── 3. Carved Glowing Elder Runes on Pillars ───────────────────────── */}
      {/* Front faces */}
      <mesh
        geometry={runeStripGeo}
        material={runeMat}
        position={[-1.0, 2.7, 0.44]}
      />
      <mesh
        geometry={runeStripGeo}
        material={runeMat}
        position={[1.0, 2.7, 0.44]}
      />
      {/* Back faces */}
      <mesh
        geometry={runeStripGeo}
        material={runeMat}
        position={[-1.0, 2.7, -0.44]}
      />
      <mesh
        geometry={runeStripGeo}
        material={runeMat}
        position={[1.0, 2.7, -0.44]}
      />

      {/* ── 4. Outer Standing Monolith Stones (4 Menhirs) ──────────────────── */}
      {[
        { x: -3.2, z: -3.2, rY: 0.4 },
        { x: 3.2, z: -3.2, rY: -0.5 },
        { x: -3.2, z: 3.2, rY: 1.1 },
        { x: 3.2, z: 3.2, rY: -1.2 },
      ].map((m, idx) => (
        <mesh
          key={idx}
          geometry={standingStoneGeo}
          material={weatheredStoneMat}
          position={[m.x, 1.2, m.z]}
          rotation={[0, m.rY, 0.08]}
          castShadow
          receiveShadow
        />
      ))}

      {/* ── 5. Hovering Elemental Crystal & Orbiting Shards ─────────────────── */}
      <mesh ref={crystalRef} geometry={crystalGeo} material={crystalMat} position={[0, 4.4, 0]} />

      {/* Orbiting focus shards */}
      <group ref={shardsGroupRef} position={[0, 4.4, 0]}>
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
          <mesh
            key={i}
            geometry={shardGeo}
            material={crystalMat}
            position={[Math.cos(angle) * 0.95, Math.sin(angle * 2) * 0.15, Math.sin(angle) * 0.95]}
          />
        ))}
      </group>

      {/* Ambient Elemental Glow Light */}
      <pointLight color={shrine.color} intensity={shrine.isAwakened ? 3.0 : 1.2} distance={9} />

      {/* ── 6. Celestial Light Pillar (Pierces clouds when awakened) ───────── */}
      {shrine.isAwakened && (
        <mesh ref={beamRef} geometry={beamGeo} material={beamMat} />
      )}

      {/* ── 7. Floating Collectable Elemental Core ─────────────────────────── */}
      {shrine.isAwakened && !shrine.isRuneCollected && (
        <group position={[0, 1.45, 1.2]}>
          <mesh>
            <sphereGeometry args={[0.26, 16, 16]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={shrine.color}
              emissiveIntensity={3.5}
              roughness={0.1}
            />
          </mesh>
          <pointLight color={shrine.color} intensity={3.5} distance={7} />
        </group>
      )}

      {/* ── 8. Three Floating Guardian Shield Targets ──────────────────────── */}
      {[0, 1, 2].map((idx) => {
        if (shrine.targetsHit[idx]) return null

        const angle = (idx * (Math.PI * 2)) / 3 + 0.4
        const targetRad = 5.2
        const tX = Math.cos(angle) * targetRad
        const tZ = Math.sin(angle) * targetRad

        return (
          <GuardianShieldTarget
            key={idx}
            index={idx}
            relX={tX}
            relZ={tZ}
            color={shrine.color}
            timeRef={timeRef}
            targetPlankGeo={targetPlankGeo}
            targetRimGeo={targetRimGeo}
            targetRuneRingGeo={targetRuneRingGeo}
            targetBullseyeGeo={targetBullseyeGeo}
            darkOakMat={darkOakMat}
            bronzeMat={bronzeMat}
          />
        )
      })}
    </group>
  )
}

function GuardianShieldTarget({
  index,
  relX,
  relZ,
  color,
  timeRef,
  targetPlankGeo,
  targetRimGeo,
  targetRuneRingGeo,
  targetBullseyeGeo,
  darkOakMat,
  bronzeMat,
}: {
  index: number
  relX: number
  relZ: number
  color: string
  timeRef: React.MutableRefObject<number>
  targetPlankGeo: THREE.CylinderGeometry
  targetRimGeo: THREE.TorusGeometry
  targetRuneRingGeo: THREE.RingGeometry
  targetBullseyeGeo: THREE.CircleGeometry
  darkOakMat: THREE.Material
  bronzeMat: THREE.Material
}) {
  const targetGroupRef = useRef<THREE.Group>(null!)

  const { runicGlowMat, bullseyeMat } = useMemo(() => {
    const runic = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.4,
      roughness: 0.25,
      side: THREE.DoubleSide,
    })

    const bullseye = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: color,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      side: THREE.DoubleSide,
    })

    return { runicGlowMat: runic, bullseyeMat: bullseye }
  }, [color])

  useFrame(() => {
    if (!targetGroupRef.current) return
    const t = timeRef.current
    // Gentle floating bob
    targetGroupRef.current.position.y = 2.5 + Math.sin(t * 2.1 + index * 1.6) * 0.26
    // Subtle rotation facing towards player/center
    targetGroupRef.current.rotation.y = t * 0.5 + index * 2.1
  })

  return (
    <group ref={targetGroupRef} position={[relX, 2.5, relZ]}>
      {/* Heavy Wooden Shield Disc */}
      <mesh geometry={targetPlankGeo} material={darkOakMat} castShadow />

      {/* Chiseled Bronze Protective Rim */}
      <mesh geometry={targetRimGeo} material={bronzeMat} />

      {/* Concentric Glowing Runic Ring */}
      <mesh geometry={targetRuneRingGeo} material={runicGlowMat} position={[0, 0, 0.035]} />

      {/* Radiant Bullseye Center Pip */}
      <mesh geometry={targetBullseyeGeo} material={bullseyeMat} position={[0, 0, 0.04]} />

      {/* Center Bronze Boss Dome */}
      <mesh position={[0, 0, 0.05]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <primitive object={bronzeMat} attach="material" />
      </mesh>
    </group>
  )
}
