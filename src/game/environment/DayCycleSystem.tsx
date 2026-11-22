// ─────────────────────────────────────────────────────────────────────────────
// DayCycleSystem — Autonomous Real-Time Day-Night & Orbital Celestial Engine
// Smoothly arcs the Sun and Moon across the sky with continuous azimuth & elevation,
// casting dynamic real-time moving shadows, lighting foliage & blending atmospheres.
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

export const FULL_CYCLE_SECONDS = 240; // 4 minutes per full day-night cycle

interface DayCycleSystemProps {
  blendStateRef: React.MutableRefObject<BlendState>;
  onPhaseChange?: (mode: SkyMode, preset: SkyPreset, phaseName: string) => void;
  onFogColorChange?: (color: string) => void;
  onSunMove?: (
    dir: THREE.Vector3,
    color: THREE.Color,
    intensity: number,
    elev: number,
    azim: number,
    isNight: boolean
  ) => void;
}

export default function DayCycleSystem({
  blendStateRef,
  onPhaseChange,
  onFogColorChange,
  onSunMove,
}: DayCycleSystemProps) {
  const cycleTimeRef = useRef(35); // Start at pleasant mid-morning (~10:00 AM)
  const lastPhaseRef = useRef<SkyMode>("day");

  // Reusable Math objects for zero GC per frame
  const sunDir = useRef(new THREE.Vector3());
  const sunColor = useRef(new THREE.Color());
  const fogColor = useRef(new THREE.Color());
  const fogColorA = useRef(new THREE.Color());
  const fogColorB = useRef(new THREE.Color());

  useEffect(() => {
    onPhaseChange?.("day", SKY_PRESETS.day, "DAYLIGHT");
  }, [onPhaseChange]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    cycleTimeRef.current = (cycleTimeRef.current + dt) % FULL_CYCLE_SECONDS;
    const progress = cycleTimeRef.current / FULL_CYCLE_SECONDS; // 0.0 to 1.0

    let currentMode: SkyMode = "day";
    let phaseName = "DAYLIGHT";
    let elevation = 45;
    let azimuth = 180;
    let isNight = false;
    let lightIntensity = 3.0;

    if (progress < 0.5) {
      // ── DAYTIME (progress 0.0 to 0.5) ────────────────────────────────────
      const pDay = progress / 0.5; // 0.0 to 1.0
      // Arc: rises in East (95°), peaks at zenith (180°), sets in West (265°)
      azimuth = 95 + pDay * 170;
      elevation = Math.sin(pDay * Math.PI) * 64 + 4; // 4° to 68° to 4°

      if (pDay < 0.14) {
        // Dawn / Sunrise
        currentMode = "sunrise";
        phaseName = "DAWN";
        sunColor.current.set("#ff9638");
        lightIntensity = 1.8 + (pDay / 0.14) * 1.0;
        fogColorA.current.set("#d99fa5"); // Morning rose-lavender
        fogColorB.current.set("#b8ddf8"); // Sky blue
        fogColor.current.lerpColors(fogColorA.current, fogColorB.current, pDay / 0.14);
      } else if (pDay < 0.82) {
        // Daylight / Midday
        currentMode = "day";
        phaseName = "DAYLIGHT";
        sunColor.current.set("#fff8eb");
        lightIntensity = 3.1;
        fogColor.current.set("#b0ddff");
      } else {
        // Dusk / Sunset
        currentMode = "sunset";
        phaseName = "DUSK";
        const tSunset = (pDay - 0.82) / 0.18;
        sunColor.current.set("#ff5c20");
        lightIntensity = 3.0 - tSunset * 1.6;
        fogColorA.current.set("#b0ddff");
        fogColorB.current.set("#d87f54"); // Fiery sunset orange
        fogColor.current.lerpColors(fogColorA.current, fogColorB.current, tSunset);
      }
    } else {
      // ── NIGHTTIME (progress 0.5 to 1.0) ──────────────────────────────────
      isNight = true;
      const pNight = (progress - 0.5) / 0.5; // 0.0 to 1.0
      // Moon rises in East (90°), peaks at South (180°), sets in West (265°)
      azimuth = 90 + pNight * 175;
      elevation = Math.sin(pNight * Math.PI) * 54 + 5; // 5° to 59° to 5°

      currentMode = "night";
      phaseName = pNight < 0.25 ? "TWILIGHT" : pNight < 0.85 ? "MIDNIGHT" : "PRE-DAWN";
      sunColor.current.set("#789ccf"); // Soft nocturnal blue
      lightIntensity = 0.42;

      fogColorA.current.set("#1a2b42");
      fogColorB.current.set("#0d1b2d");
      fogColor.current.lerpColors(fogColorA.current, fogColorB.current, Math.sin(pNight * Math.PI));
    }

    // Convert (elevation, azimuth) to 3D unit direction vector
    const elRad = elevation * (Math.PI / 180);
    const azRad = azimuth * (Math.PI / 180);
    sunDir.current.set(
      Math.cos(elRad) * Math.sin(azRad),
      Math.sin(elRad),
      Math.cos(elRad) * Math.cos(azRad)
    ).normalize();

    // Notify scene of continuous sun/moon trajectory & lighting
    onSunMove?.(
      sunDir.current,
      sunColor.current,
      lightIntensity,
      elevation,
      azimuth,
      isNight
    );

    // Notify fog color
    onFogColorChange?.("#" + fogColor.current.getHexString());

    // Phase transition notification if mode changed
    if (lastPhaseRef.current !== currentMode) {
      lastPhaseRef.current = currentMode;
      onPhaseChange?.(currentMode, SKY_PRESETS[currentMode], phaseName);
    }
  });

  return null;
}
