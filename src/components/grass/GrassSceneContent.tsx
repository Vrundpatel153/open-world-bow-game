// ─────────────────────────────────────────────────────────────────────────────
// GrassSceneContent — Open World FPS Environment with Dynamic Day-Night Cycle
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
import { useGrassBreakdown } from "@/components/grassField/debug/GrassBreakdown";
import GrassLighting from "./GrassLighting";
import ShadowController from "./ShadowController";
import ProductionFPSController from "@/components/character/ProductionFPSController";
import OpenWorldGrassField, { getOpenWorldHeight } from "@/components/world/OpenWorldGrassField";
import BowViewModel from "@/game/weapons/BowViewModel";
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
  // Breakdown visualisers
  const { hideField, view } = useGrassBreakdown();

  // Arrow System Ref for weapon firing
  const arrowSystemRef = useRef<ArrowSystemHandle>(null);

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
        </>
      )}

      {/* ── Archery Projectiles & Collision Particle System ─────────────── */}
      <ArrowSystem ref={arrowSystemRef} />

      {/* ── 4 Ancient Rune Shrines & Floating Guardian Bell Targets ──────── */}
      <ShrineMonoliths playerPosRef={playerPosRef} />

      {/* ── Lighting & Shadows ───────────────────────────────────────────── */}
      <GrassLighting preset={activePreset} />
      <ShadowController rebakeSignal={bakeSignal} />

      {/* ── Ambient IBL Environment ──────────────────────────────────────── */}
      <SceneEnvironment
        folder="Grass Environment"
        mode={mode}
        background={false}
        defaults={{ preset: "night", envIntensity: 0 }}
      />

      {/* ── Autonomous Real-Time Day-Night Cycle Engine ─────────────────── */}
      <DayCycleSystem
        blendStateRef={blendStateRef}
        onPhaseChange={(nextMode, nextPreset, phaseName) => {
          onPresetChange(nextPreset);
          onPhaseChange?.(nextMode, nextPreset, phaseName);
        }}
        onFogColorChange={onFogColorChange}
      />

      {/* ── Volumetric SkyDome (FBM Clouds, Sun/Moon, Gradient, Stars) ───── */}
      <SkyDome
        defaultMode="day"
        targetMode={skyMode}
        blendStateRef={blendStateRef}
        onPresetChange={onPresetChange}
      />

      {/* ── 3D Environments ──────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        {!hideField && (
          <>
            {/* 1. Exact Cortiz Diorama Model (grass-scene.glb) */}
            <GrassField
              preset={grassPreset}
              wireframe={mode === "Frame"}
              onLoaded={handleModelLoaded}
              playerPosRef={playerPosRef}
            />

            {/* 2. Expanded Open World with Multiplied Exact Textures & Shaders */}
            {isFirstPerson && (
              <OpenWorldGrassField
                preset={grassPreset}
                playerPosRef={playerPosRef}
              />
            )}
          </>
        )}
        {view}
      </Suspense>

      {/* ── Calibrated Stylized Bloom (High-Threshold, Glowing Runes & Beacons Only) ─ */}
      <PostProcessing
        folder="Grass Postprocessing"
        defaults={{ intensity: 0.85, radius: 0.28, threshold: 0.85 }}
      />
    </>
  );
}
