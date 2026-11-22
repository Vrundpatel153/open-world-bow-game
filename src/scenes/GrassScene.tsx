// ─────────────────────────────────────────────────────────────────────────────
// GrassScene — First-Person Open World Game
// Real 3JS Stylized Grass Component across a vast Open World, Dynamic Sky & Clouds,
// 360° WASD + Mouse Look FPS Controls with Pointer Lock, and Real-Time Trampling.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useState, useCallback, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'

import OpenWorldGrassField, { getOpenWorldHeight } from '@/components/world/OpenWorldGrassField'
import SkyDome from '@/components/skyDome/SkyDome'
import GrassLighting from '@/components/grass/GrassLighting'
import ShadowController from '@/components/grass/ShadowController'
import ProductionFPSController from '@/components/character/ProductionFPSController'
import FpsSystem from '@/systems/FpsSystem'
import LoadingOverlay from '@/ui/LoadingOverlay'
import HUD from '@/ui/HUD'

import type { SkyMode, SkyPreset } from '@/components/skyDome/constants'
import { SKY_PRESETS } from '@/components/skyDome/constants'

export default function GrassScene() {
  const [loaded, setLoaded] = useState(false)
  const [bakeSignal, setBakeSignal] = useState(0)

  // Sky Preset State
  const [currentSky, setCurrentSky] = useState<SkyMode>('day')
  const [activePreset, setActivePreset] = useState<SkyPreset>(SKY_PRESETS['day'])

  // Live player position ref for real-time grass trampling
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0))

  const handleLoaded = useCallback(() => {
    setBakeSignal((n) => n + 1)
    setTimeout(() => setLoaded(true), 400)
  }, [])

  const handleSelectSky = (mode: SkyMode) => {
    setCurrentSky(mode)
    if (SKY_PRESETS[mode]) {
      setActivePreset(SKY_PRESETS[mode])
    }
  }

  const handlePlayerMove = (pos: THREE.Vector3) => {
    playerPosRef.current.copy(pos)
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {!loaded && <LoadingOverlay />}

      {/* ── First-Person HUD & Reticle ───────────────────────────────────── */}
      <HUD currentSky={currentSky} onSelectSky={handleSelectSky} />

      <Canvas
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: 'high-performance',
        }}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        camera={{ fov: 68, near: 0.1, far: 3000, position: [0, 2, 0] }}
        dpr={[1, Math.min(window.devicePixelRatio, 1.5)]}
        style={{ background: '#0a1a05' }}
      >
        {/* ── FPS Counter System ─────────────────────────────────────────── */}
        <FpsSystem />

        {/* ── Lighting & Dynamic Shadows ─────────────────────────────────── */}
        <GrassLighting preset={activePreset} />
        <ShadowController rebakeSignal={bakeSignal} />

        {/* ── Dynamic SkyDome (Clouds, Sun/Moon, Gradient, Stars) ─────────── */}
        <SkyDome
          defaultMode="day"
          targetMode={currentSky}
          onPresetChange={setActivePreset}
        />

        {/* ── Ambient IBL ────────────────────────────────────────────────── */}
        <Environment preset="sunset" background={false} environmentIntensity={0} />

        {/* ── First Person Character & 360° Mouse Look Controller ─────────── */}
        <ProductionFPSController
          onPositionUpdate={handlePlayerMove}
          getTerrainHeight={getOpenWorldHeight}
          worldRadius={52}
        />

        {/* ── Open World Stylized 3JS Grass, Flowers, Trees & Rocks ────────── */}
        <Suspense fallback={null}>
          <OpenWorldGrassField
            preset="default"
            onLoaded={handleLoaded}
            playerPosRef={playerPosRef}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
