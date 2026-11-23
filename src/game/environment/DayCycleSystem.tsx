// ─────────────────────────────────────────────────────────────────────────────
// DayCycleSystem — Autonomous Real-Time Day-Night & Orbital Celestial Engine
// Smoothly arcs the Sun and Moon across the sky with continuous 360° celestial orbit,
// casting dynamic real-time moving shadows, lighting foliage & blending atmospheres.
// Zero teleporting: opposite-phase Sun & Moon with smooth horizon transitions.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  SKY_PRESETS,
  type SkyMode,
  type SkyPreset,
  type BlendState,
} from "@/components/skyDome/constants";
import { useQuestStore } from "@/game/stores/questStore";

export const FULL_CYCLE_SECONDS = 1440; // Realistic 24 minutes per full day-night cycle (1 real second = 1 in-game minute)

interface DayCycleSystemProps {
  blendStateRef: React.MutableRefObject<BlendState>;
  onPhaseChange?: (mode: SkyMode, preset: SkyPreset, phaseName: string) => void;
  onFogColorChange?: (color: string) => void;
  onSunMove?: (
    dir: THREE.Vector3,
    color: THREE.Color,
    intensity: number,
    sunElev: number,
    sunAzim: number,
    moonElev: number,
    moonAzim: number,
    isNight: boolean
  ) => void;
}

export default function DayCycleSystem({
  blendStateRef,
  onPhaseChange,
  onFogColorChange,
  onSunMove,
}: DayCycleSystemProps) {
  // Start at pleasant mid-morning (~10:00 AM)
  const cycleTimeRef = useRef(35);
  const lastPhaseRef = useRef<SkyMode>("day");
  const lastPhaseNameRef = useRef<string>("DAYLIGHT");

  // Reusable Math objects for zero GC per frame
  const celestialDir = useRef(new THREE.Vector3());
  const lightColor = useRef(new THREE.Color());
  const fogColor = useRef(new THREE.Color());
  const fogColorA = useRef(new THREE.Color());
  const fogColorB = useRef(new THREE.Color());

  (window as any).__setCycleTime = (sec: number) => {
    cycleTimeRef.current = sec;
  };

  useEffect(() => {
    onPhaseChange?.("day", SKY_PRESETS.day, "DAYLIGHT");
  }, [onPhaseChange]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    cycleTimeRef.current = (cycleTimeRef.current + dt) % FULL_CYCLE_SECONDS;
    const progress = cycleTimeRef.current / FULL_CYCLE_SECONDS; // 0.0 to 1.0

    // ── Continuous 360° Celestial Orbit ───────────────────────────────────────
    // theta = orbital angle [0, 2π). 0 = Dawn in East, π/2 = Midday South,
    // π = Sunset in West, 3π/2 = Midnight North.
    const theta = progress * Math.PI * 2;

    // Sun Trajectory:
    // Azimuth: starts at 90° (East), rotates through 180° (South), 270° (West), 360°/0° (North)
    const sunAzimuth = (progress * 360 + 90) % 360;
    // Elevation: sinusoidal arc reaching +58° at midday, dipping to -58° at midnight
    const sunElevation = Math.sin(theta) * 58;

    // Moon Trajectory: Anti-solar celestial body (exact opposite phase theta + π)
    const moonTheta = (theta + Math.PI) % (Math.PI * 2);
    const moonAzimuth = (sunAzimuth + 180) % 360;
    const moonElevation = Math.sin(moonTheta) * 58;

    // Determine day vs night state based on sun elevation relative to twilight threshold
    const isNight = sunElevation < -3.0;

    let currentMode: SkyMode = "day";
    let phaseName = "DAYLIGHT";
    let lightIntensity = 2.4;

    if (sunElevation >= -2.0) {
      // ── DAYTIME & TWILIGHT TRANSITIONS ────────────────────────────────────
      if (sunElevation < 14 && progress < 0.5) {
        // Dawn / Sunrise (Sun rising from East)
        currentMode = "sunrise";
        phaseName = "DAWN";
        const tDawn = Math.max(0, (sunElevation + 2.0) / 16.0);
        lightColor.current.set("#ff9638");
        lightIntensity = 0.8 + tDawn * 1.5;
        fogColorA.current.set("#d99fa5"); // Morning rose-lavender
        fogColorB.current.set("#b8ddf8"); // Sky blue
        fogColor.current.lerpColors(fogColorA.current, fogColorB.current, tDawn);
      } else if (sunElevation >= 14) {
        // Daylight / Midday (Warm clear sun, lush green environment)
        currentMode = "day";
        phaseName = "DAYLIGHT";
        lightColor.current.set("#fffbf2"); // Crisp, balanced warm sunlight
        lightIntensity = 2.4;
        fogColor.current.set("#b0ddff");
      } else {
        // Dusk / Sunset (Sun sinking into West)
        currentMode = "sunset";
        phaseName = "DUSK";
        const tDusk = Math.max(0, Math.min(1, (14 - sunElevation) / 16.0));
        lightColor.current.set("#ff7030");
        lightIntensity = 2.4 - tDusk * 1.6;
        fogColorA.current.set("#b0ddff");
        fogColorB.current.set("#d87f54"); // Fiery sunset orange
        fogColor.current.lerpColors(fogColorA.current, fogColorB.current, tDusk);
      }
    } else {
      // ── NOCTURNAL HOURS ──────────────────────────────────────────────────
      currentMode = "night";
      const moonProgress = Math.max(0, moonElevation / 58);
      if (sunElevation > -12) {
        phaseName = "TWILIGHT";
      } else if (sunElevation < -42) {
        phaseName = "MIDNIGHT";
      } else {
        phaseName = progress < 0.75 ? "NIGHT" : "PRE-DAWN";
      }

      lightColor.current.set("#88b2ea"); // Gentle ethereal moonlight
      lightIntensity = 0.35 + moonProgress * 0.15;

      fogColorA.current.set("#152438");
      fogColorB.current.set("#0b1626");
      fogColor.current.lerpColors(fogColorA.current, fogColorB.current, moonProgress);
    }

    // Directional Light Tracking: Sun during day, Moon during night
    const activeElev = sunElevation >= -2.0 ? Math.max(2.0, sunElevation) : Math.max(2.0, moonElevation);
    const activeAzim = sunElevation >= -2.0 ? sunAzimuth : moonAzimuth;

    const elRad = activeElev * (Math.PI / 180);
    const azRad = activeAzim * (Math.PI / 180);
    celestialDir.current.set(
      Math.cos(elRad) * Math.sin(azRad),
      Math.sin(elRad),
      -Math.cos(elRad) * Math.cos(azRad)
    ).normalize();

    // Notify scene of continuous sun and moon trajectory & lighting
    onSunMove?.(
      celestialDir.current,
      lightColor.current,
      lightIntensity,
      sunElevation,
      sunAzimuth,
      moonElevation,
      moonAzimuth,
      isNight
    );

    // Notify fog color
    onFogColorChange?.("#" + fogColor.current.getHexString());

    // Phase transition notification if mode or phase name changed
    const modeChanged = lastPhaseRef.current !== currentMode;
    const nameChanged = lastPhaseNameRef.current !== phaseName;
    if (modeChanged || nameChanged) {
      const prevMode = lastPhaseRef.current;
      lastPhaseRef.current = currentMode;
      lastPhaseNameRef.current = phaseName;
      useQuestStore.getState().setDayPhaseName(phaseName);
      if (modeChanged) {
        blendStateRef.current = {
          active: true,
          t: 0,
          from: SKY_PRESETS[prevMode] || SKY_PRESETS.day,
          to: SKY_PRESETS[currentMode] || SKY_PRESETS.day,
        };
      }
      onPhaseChange?.(currentMode, SKY_PRESETS[currentMode], phaseName);
    }

    if (blendStateRef.current.active) {
      blendStateRef.current.t = Math.min(1.0, blendStateRef.current.t + dt / 4.0);
      if (blendStateRef.current.t >= 1.0) {
        blendStateRef.current.active = false;
      }
    }
  });

  return null;
}
