// ─────────────────────────────────────────────────────────────────────────────
// GrassSceneContent — Open World FPS Environment with Dynamic Celestial Orbit
// Synchronizes real-time moving sun/moon trajectories with directional lighting,
// volumetric sky dome shaders, dense gapless grassland & ancient forest groves.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useCallback, useState, useRef } from "react";
import SceneCamera from "@/components/playground/SceneCamera";
import SceneEnvironment from "@/components/playground/SceneEnvironment";
import PostProcessing from "@/components/playground/PostProcessing";
import type { SceneMode } from "@/components/playground/SceneContent";
import SkyDome from "@/components/skyDome/SkyDome";
import {
  type SkyPreset,
  type SkyMode,
  type BlendState,
  SKY_PRESETS,
} from "@/components/skyDome/constants";
import GrassField from "@/components/grassField";
import GrassLighting from "./GrassLighting";
import ShadowController from "./ShadowController";
import ProductionFPSController from "@/components/character/ProductionFPSController";
import OpenWorldGrassField, { getOpenWorldHeight, grassWindImpulse } from "@/components/world/OpenWorldGrassField";
import BowViewModel from "@/game/weapons/BowViewModel";
import TorchViewModel from "@/game/weapons/TorchViewModel";
import SwordViewModel from "@/game/weapons/SwordViewModel";
import RockSparkSystem, { type RockSparkRef } from "@/game/effects/RockSparkSystem";
import { ArrowSystem, type ArrowSystemHandle } from "@/game/weapons/ArrowSystem";
import ShrineMonoliths from "@/game/shrines/ShrineMonoliths";
import DayCycleSystem from "@/game/environment/DayCycleSystem";
import * as THREE from "three";

interface GrassSceneContentProps {
  mode: SceneMode;
  activePreset: SkyPreset;
  onPresetChange: (preset: SkyPreset) => void;
  grassPreset: string;
  skyMode: SkyMode;
  onModelLoaded?: () => void;
  isFirstPerson?: boolean;
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
  cameraYawRef?: React.MutableRefObject<number>;
  onPhaseChange?: (mode: SkyMode, preset: SkyPreset, phaseName: string) => void;
  onFogColorChange?: (color: string) => void;
}

export default function GrassSceneContent({
  mode,
  activePreset,
  onPresetChange,
  grassPreset,
  skyMode,
  onModelLoaded,
  isFirstPerson = true,
  playerPosRef,
  cameraYawRef,
  onPhaseChange,
  onFogColorChange,
}: GrassSceneContentProps) {
  // Arrow System Ref for weapon firing
  const arrowSystemRef = useRef<ArrowSystemHandle>(null);
  // Rock Scratch Spark System Ref
  const rockSparkRef = useRef<RockSparkRef>(null);

  // Celestial Orbit Trajectory States (Continuous Sun & Moon Movement)
  const sunDirRef = useRef(new THREE.Vector3(0, 1, 0));
  const sunColorRef = useRef(new THREE.Color("#fff8eb"));
  const sunIntensityRef = useRef(3.1);
  const sunElevRef = useRef(55);
  const sunAzimRef = useRef(180);
  const isNightRef = useRef(false);

  // Blend State for Autonomous Day-Night Cycle
  const blendStateRef = useRef<BlendState>({
    active: false,
    t: 0,
    from: activePreset || SKY_PRESETS.day,
    to: activePreset || SKY_PRESETS.day,
  });

  // Re-bake shadow map signal
  const [bakeSignal, setBakeSignal] = useState(0);
  const handleModelLoaded = useCallback(() => {
    setBakeSignal((n) => n + 1);
    onModelLoaded?.();
  }, [onModelLoaded]);

  return (
    <>
      {/* ── Camera: Production FPS with PointerLock in Open World ──────── */}
      {!isFirstPerson ? (
        <SceneCamera folder="Grass Camera" azimuth={41} polar={73} radius={6.5} />
      ) : (
        <>
          <ProductionFPSController
            onPositionUpdate={(p) => playerPosRef?.current?.copy(p)}
            getTerrainHeight={getOpenWorldHeight}
            worldRadius={52}
            cameraYawRef={cameraYawRef}
          />
          <BowViewModel
            onFireArrow={(origin, dir, power) =>
              arrowSystemRef.current?.spawnArrow(origin, dir, power)
            }
          />
          <TorchViewModel />
          <SwordViewModel
            onHitRock={(hitPoint, normal, power) =>
              rockSparkRef.current?.spawnSparks(hitPoint, normal, power)
            }
            onSwordSwingWind={(origin, dir, power) =>
              grassWindImpulse.trigger(origin, dir, power)
            }
          />
        </>
      )}

      {/* ── Archery Projectiles & Collision Particle System ─────────────── */}
      <ArrowSystem ref={arrowSystemRef} />

      {/* ── Rock Scratch Spark & Stone Chip Particles ───────────────────── */}
      <RockSparkSystem ref={rockSparkRef} />

      {/* ── 4 Ancient Rune Shrines & Floating Guardian Bell Targets ──────── */}
      <ShrineMonoliths playerPosRef={playerPosRef} />

      {/* ── Dynamic Orbiting Sunlight, Moonlight & Sweeping Shadows ─────── */}
      <GrassLighting
        preset={activePreset}
        sunDir={sunDirRef.current}
        sunColor={sunColorRef.current}
        sunIntensity={sunIntensityRef}
        playerPosRef={playerPosRef}
      />
      <ShadowController rebakeSignal={bakeSignal} />

      {/* ── Ambient IBL Environment ──────────────────────────────────────── */}
      <SceneEnvironment
        mode={mode}
        background={false}
        defaults={{ preset: "forest", envIntensity: 0.35 }}
      />

      {/* ── Autonomous Celestial Day-Night Cycle & Orbital Sun Engine ───── */}
      <DayCycleSystem
        blendStateRef={blendStateRef}
        onSunMove={(dir, color, intensity, elev, azim, night) => {
          sunDirRef.current.copy(dir);
          sunColorRef.current.copy(color);
          sunIntensityRef.current = intensity;
          sunElevRef.current = elev;
          sunAzimRef.current = azim;
          isNightRef.current = night;
        }}
        onPhaseChange={(nextMode, nextPreset, phaseName) => {
          onPresetChange(nextPreset);
          onPhaseChange?.(nextMode, nextPreset, phaseName);
        }}
        onFogColorChange={onFogColorChange}
      />

      {/* ── Volumetric SkyDome with Smooth Moving Sun & Moon Discs ──────── */}
      <SkyDome
        defaultMode="day"
        targetMode={skyMode}
        blendStateRef={blendStateRef}
        moonElevOverride={sunElevRef}
        moonAzimOverride={sunAzimRef}
        isNight={isNightRef}
        onPresetChange={onPresetChange}
      />

      {/* ── 3D Environments ──────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        {/* 1. Exact Cortiz Diorama Model (grass-scene.glb) for Diorama Showcase */}
        {!isFirstPerson ? (
          <GrassField
            preset={grassPreset}
            wireframe={false}
            onLoaded={handleModelLoaded}
            playerPosRef={playerPosRef}
          />
        ) : (
          /* 2. Expanded Open World with 56,000 Dense Gapless Blades & Ancient Forest */
          <OpenWorldGrassField
            preset={grassPreset}
            playerPosRef={playerPosRef}
            onLoaded={handleModelLoaded}
          />
        )}
      </Suspense>

      {/* ── Calibrated Stylized Bloom (Glowing Runes & Celestial Discs Only) ─ */}
      {/* PostProcessing intentionally disabled for locked 60 FPS performance */}
    </>
  );
}
