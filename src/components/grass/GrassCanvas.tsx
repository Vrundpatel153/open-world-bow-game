// ─────────────────────────────────────────────────────────────────────────────
// GrassCanvas — Production 3D Open World Archery Experience
// Autonomous Day-Night Cycle, Clean AAA RPG Game HUD, Zero Clutter & Zero Emojis.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { PCFSoftShadowMap } from "three";
import * as THREE from "three";
import { Leva } from "leva";

import LoadingOverlay from "@/components/overlay/LoadingOverlay";
import {
  SKY_PRESETS,
  type SkyPreset,
  type SkyMode,
} from "@/components/skyDome/constants";
import GrassSceneContent from "./GrassSceneContent";
import FpsSystem from "@/systems/FpsSystem";
import { inputManager } from "@/systems/KeyboardInput";
import GameHUD from "@/game/ui/GameHUD";

const CAMERA_FAR = 3000;

export default function GrassCanvas() {
  const [isLoadingModel, setIsLoadingModel] = useState(true);
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraYawRef = useRef<number>(0);

  // Active sky preset & mode (driven autonomously by DayCycleSystem)
  const [activePreset, setActivePreset] = useState<SkyPreset>(SKY_PRESETS.day);
  const [skyMode, setSkyMode] = useState<SkyMode>("day");
  const [currentPhaseName, setCurrentPhaseName] = useState("DAYLIGHT");
  const [fogColor, setFogColor] = useState<string>(SKY_PRESETS.day.skyLow || "#b5e2ff");

  useEffect(() => {
    return inputManager.onLockChange((locked) => {
      setIsPointerLocked(locked);
    });
  }, []);

  const handleModelLoaded = useCallback(() => {
    setIsLoadingModel(false);
  }, []);

  const handlePresetChange = useCallback((preset: SkyPreset) => {
    setActivePreset(preset);
  }, []);

  const handlePhaseChange = useCallback(
    (mode: SkyMode, preset: SkyPreset, phaseName: string) => {
      setSkyMode(mode);
      setActivePreset(preset);
      setCurrentPhaseName(phaseName);
      if (preset.skyLow) {
        setFogColor(preset.skyLow);
      }
    },
    []
  );

  const handleFogColorChange = useCallback((color: string) => {
    setFogColor(color);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#060c04" }}>
      <Canvas
        shadows={{ type: PCFSoftShadowMap }}
        camera={{ position: [0, 2, 0], fov: 68, near: 0.05, far: CAMERA_FAR }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        dpr={[1, 1.25]}
        style={{ background: "#060c04" }}
      >
        {/* Dynamic Atmospheric Fog synced with Day-Night Cycle */}
        <fog attach="fog" args={[fogColor, 45, 120]} />
        <FpsSystem />
        <GrassSceneContent
          mode="Background"
          activePreset={activePreset}
          onPresetChange={handlePresetChange}
          grassPreset="default"
          skyMode={skyMode}
          onModelLoaded={handleModelLoaded}
          isFirstPerson={true}
          playerPosRef={playerPosRef}
          cameraYawRef={cameraYawRef}
          onPhaseChange={handlePhaseChange}
          onFogColorChange={handleFogColorChange}
        />
      </Canvas>

      {/* Completely suppress Leva editing panels */}
      <Leva hidden />

      {/* ── High-Budget Diegetic Game HUD (Skyrim Compass, Reticle, Quest) ── */}
      <GameHUD
        playerPosRef={playerPosRef}
        cameraYawRef={cameraYawRef}
        onSwitchSkyToNight={() => setSkyMode("night")}
        currentPhaseName={currentPhaseName}
      />

      {/* ── First-Person Pointer Lock Prompt (Clean RPG Style) ────────────── */}
      {!isPointerLocked && !isLoadingModel && (
        <div
          onClick={() => {
            const canvas = document.querySelector('canvas')
            if (canvas) {
              try {
                const promise = (canvas as any).requestPointerLock?.()
                if (promise && typeof promise.catch === 'function') {
                  promise.catch(() => {})
                }
              } catch (_) {}
            }
            inputManager.setLocked(true)
          }}
          style={{
            position: "absolute",
            top: "54%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            cursor: "pointer",
            pointerEvents: "auto",
            background: "linear-gradient(180deg, rgba(16, 22, 16, 0.94) 0%, rgba(8, 12, 9, 0.96) 100%)",
            border: "1px solid rgba(214, 184, 120, 0.45)",
            borderRadius: 2,
            padding: "10px 24px",
            color: "#f5f0e6",
            fontFamily: "'Cinzel', 'Marcellus', serif",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 12px rgba(214, 184, 120, 0.15)",
            whiteSpace: "nowrap",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: "#d4af37" }}>◆</span>
          <span>CLICK TO ENGAGE COMBAT & EXPLORATION (ESC TO RELEASE)</span>
          <span style={{ color: "#d4af37" }}>◆</span>
        </div>
      )}

      <LoadingOverlay visible={isLoadingModel} />
    </div>
  );
}
