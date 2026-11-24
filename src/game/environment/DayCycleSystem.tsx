// ─────────────────────────────────────────────────────────────────────────────
// DayCycleSystem — Autonomous Real-Time Day-Night & Orbital Celestial Engine
// Smoothly arcs the Sun and Moon across the sky with continuous 360° celestial orbit,
// casting dynamic real-time moving shadows, lighting foliage & blending atmospheres.
// Seamless unified sky and fog: zero color clashes, zero seams, zero fluctuations.
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
  skyHorizonRef?: React.MutableRefObject<THREE.Color>;
  skyZenithRef?: React.MutableRefObject<THREE.Color>;
}

export default function DayCycleSystem({
  blendStateRef,
  onPhaseChange,
  onFogColorChange,
  onSunMove,
  skyHorizonRef,
  skyZenithRef,
}: DayCycleSystemProps) {
  // Start at pleasant mid-morning (~10:00 AM)
  const cycleTimeRef = useRef(140);
  const lastPhaseRef = useRef<SkyMode>("day");
  const lastPhaseNameRef = useRef<string>("DAYLIGHT");

  // Reusable Math objects for zero GC per frame
  const celestialDir = useRef(new THREE.Vector3());
  const lightColor = useRef(new THREE.Color());
  const skyHorizon = useRef(new THREE.Color("#8ec3ee"));
  const skyZenith = useRef(new THREE.Color("#1e6ac4"));

  // Continuous atmospheric color anchors (physically-calibrated palette)
  const cDayHorizon = useRef(new THREE.Color("#8ec3ee")); // Clear atmospheric horizon blue
  const cDayZenith = useRef(new THREE.Color("#1e6ac4"));  // Deep vibrant daytime azure

  const cDawnHorizon = useRef(new THREE.Color("#e8ab80")); // Warm golden dawn peach
  const cDawnZenith = useRef(new THREE.Color("#2e5288"));  // Morning indigo-blue

  const cDuskHorizon = useRef(new THREE.Color("#e88654")); // Warm sunset amber-orange
  const cDuskZenith = useRef(new THREE.Color("#283664"));  // Twilight indigo

  const cTwilightHorizon = useRef(new THREE.Color("#1c263c")); // Deep twilight dusk blue-slate
  const cTwilightZenith = useRef(new THREE.Color("#0a101e"));  // Twilight deep sky

  const cNightHorizon = useRef(new THREE.Color("#121e33")); // Atmospheric nocturnal slate navy
  const cNightZenith = useRef(new THREE.Color("#060b16"));  // Deep starry indigo midnight sky

  (window as any).__setCycleTime = (sec: number) => {
    cycleTimeRef.current = sec % FULL_CYCLE_SECONDS;
  };

  (window as any).__advanceTimePhase = () => {
    const cur = cycleTimeRef.current;
    if (cur < 300) {
      cycleTimeRef.current = 360; // Midday
      useQuestStore.setState({ notification: 'Time shifted to Midday (12:00 PM)' });
    } else if (cur < 650) {
      cycleTimeRef.current = 670; // Sunset (~05:35 PM, sun elevation ~11° in warm golden hour)
      useQuestStore.setState({ notification: 'Time shifted to Golden Sunset (05:35 PM)' });
    } else if (cur < 1000) {
      cycleTimeRef.current = 1080; // Midnight
      useQuestStore.setState({ notification: 'Time shifted to Nocturnal Midnight (12:00 AM)' });
    } else {
      cycleTimeRef.current = 0; // Dawn
      useQuestStore.setState({ notification: 'Time shifted to Dawn (06:00 AM)' });
    }
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

    // ── Continuous Unified Atmospheric Color Engine ──────────────────────────
    // Seamless mathematical interpolation across all elevations: zero color pops, zero clashing seams
    if (sunElevation >= 16) {
      // 1. High Daylight (sun elevation 16° to 58°)
      skyHorizon.current.copy(cDayHorizon.current);
      skyZenith.current.copy(cDayZenith.current);
      lightColor.current.set("#fffbf2");
      lightIntensity = 2.4;
      currentMode = "day";
      phaseName = "DAYLIGHT";
    } else if (sunElevation >= -2) {
      // 2. Horizon Transitions (sun elevation -2° to 16°)
      const tSun = THREE.MathUtils.smoothstep((sunElevation + 2) / 18, 0, 1);

      const isMorning = progress < 0.25 || progress >= 0.75;
      if (isMorning) {
        // Morning / Dawn: from Twilight -> Dawn -> Day
        const tMorning = (sunElevation + 2) / 18;
        if (tMorning < 0.35) {
          const u = tMorning / 0.35;
          skyHorizon.current.lerpColors(cTwilightHorizon.current, cDawnHorizon.current, u);
          skyZenith.current.lerpColors(cTwilightZenith.current, cDawnZenith.current, u);
        } else {
          const u = (tMorning - 0.35) / 0.65;
          skyHorizon.current.lerpColors(cDawnHorizon.current, cDayHorizon.current, u);
          skyZenith.current.lerpColors(cDawnZenith.current, cDayZenith.current, u);
        }
        lightColor.current.lerpColors(new THREE.Color("#ff8c40"), new THREE.Color("#fffbf2"), tSun);
        lightIntensity = 0.9 + tSun * 1.5;
        currentMode = "sunrise";
        phaseName = sunElevation < 6 ? "DAWN" : "MORNING";
      } else {
        // Evening / Sunset: from Day -> Dusk -> Twilight
        const tEvening = (sunElevation + 2) / 18;
        if (tEvening > 0.40) {
          const u = (tEvening - 0.40) / 0.60;
          skyHorizon.current.lerpColors(cDuskHorizon.current, cDayHorizon.current, u);
          skyZenith.current.lerpColors(cDuskZenith.current, cDayZenith.current, u);
        } else {
          const u = tEvening / 0.40;
          skyHorizon.current.lerpColors(cTwilightHorizon.current, cDuskHorizon.current, u);
          skyZenith.current.lerpColors(cTwilightZenith.current, cDuskZenith.current, u);
        }
        lightColor.current.lerpColors(new THREE.Color("#ff7030"), new THREE.Color("#fffbf2"), tSun);
        lightIntensity = 0.9 + tSun * 1.5;
        currentMode = "sunset";
        phaseName = sunElevation < 6 ? "DUSK" : "SUNSET";
      }
    } else if (sunElevation >= -14) {
      // 3. Post-Sunset Twilight (sun elevation -14° to -2°)
      const tTwi = THREE.MathUtils.smoothstep((sunElevation + 14) / 12, 0, 1);
      skyHorizon.current.lerpColors(cNightHorizon.current, cTwilightHorizon.current, tTwi);
      skyZenith.current.lerpColors(cNightZenith.current, cTwilightZenith.current, tTwi);
      lightColor.current.set("#5a78a8");
      lightIntensity = 0.16 + tTwi * 0.35;
      currentMode = "night";
      phaseName = "TWILIGHT";
    } else {
      // 4. Pure Nocturnal Midnight (sun elevation < -14°)
      const moonProgress = Math.max(0, moonElevation / 58);
      skyHorizon.current.copy(cNightHorizon.current);
      skyZenith.current.copy(cNightZenith.current);
      lightColor.current.set("#7aa2d8");
      lightIntensity = 0.45 + moonProgress * 0.15;
      currentMode = "night";
      if (sunElevation < -42) {
        phaseName = "MIDNIGHT";
      } else {
        phaseName = progress < 0.75 ? "NIGHT" : "PRE-DAWN";
      }
    }

    // Export colors to parent and synchronized overrides
    if (skyHorizonRef) {
      skyHorizonRef.current.copy(skyHorizon.current);
    }
    if (skyZenithRef) {
      skyZenithRef.current.copy(skyZenith.current);
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

    // Notify fog color string for any legacy listeners
    onFogColorChange?.("#" + skyHorizon.current.getHexString());

    // Phase transition notification if mode or phase name changed
    const modeChanged = lastPhaseRef.current !== currentMode;
    const nameChanged = lastPhaseNameRef.current !== phaseName;
    if (modeChanged || nameChanged) {
      lastPhaseRef.current = currentMode;
      lastPhaseNameRef.current = phaseName;
      useQuestStore.getState().setDayPhaseName(phaseName);
      onPhaseChange?.(currentMode, SKY_PRESETS[currentMode], phaseName);
    }
  });

  return null;
}
