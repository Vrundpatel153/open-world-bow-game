// ─────────────────────────────────────────────────────────────────────────────
// DayCycleSystem — Autonomous Real-Time Day-Night Cycle Engine
// Smoothly cycles through: Sunrise → Day → Sunset → Night → Sunrise
// Blends sky dome uniforms, ambient illumination, directional shadows & fog.
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

export interface DayCyclePhase {
  mode: SkyMode;
  name: string;
  holdDuration: number; // Duration to stay solidly in this phase (seconds)
  transitionDuration: number; // Duration to blend into next phase (seconds)
}

// Configured 4-phase celestial progression (~4.5 minutes full loop)
export const DAY_PHASES: DayCyclePhase[] = [
  { mode: "day", name: "Daylight", holdDuration: 85, transitionDuration: 20 },
  { mode: "sunset", name: "Dusk", holdDuration: 40, transitionDuration: 18 },
  { mode: "night", name: "Midnight", holdDuration: 75, transitionDuration: 20 },
  { mode: "sunrise", name: "Dawn", holdDuration: 40, transitionDuration: 18 },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

interface DayCycleSystemProps {
  blendStateRef: React.MutableRefObject<BlendState>;
  onPhaseChange?: (mode: SkyMode, preset: SkyPreset, phaseName: string) => void;
  onFogColorChange?: (color: string) => void;
}

export default function DayCycleSystem({
  blendStateRef,
  onPhaseChange,
  onFogColorChange,
}: DayCycleSystemProps) {
  const phaseIndexRef = useRef(0);
  const phaseTimerRef = useRef(0);
  const isTransitioningRef = useRef(false);

  // Cached color objects for fog lerping
  const fogColorFrom = useRef(new THREE.Color());
  const fogColorTo = useRef(new THREE.Color());
  const fogCurrent = useRef(new THREE.Color());

  useEffect(() => {
    // Initialize starting phase
    const initialPhase = DAY_PHASES[0];
    onPhaseChange?.(
      initialPhase.mode,
      SKY_PRESETS[initialPhase.mode],
      initialPhase.name
    );
  }, [onPhaseChange]);

  useFrame((_, delta) => {
    // Cap delta to prevent huge jumps on tab defocus
    const dt = Math.min(delta, 0.1);
    phaseTimerRef.current += dt;

    const currentIdx = phaseIndexRef.current;
    const currentPhase = DAY_PHASES[currentIdx];
    const nextIdx = (currentIdx + 1) % DAY_PHASES.length;
    const nextPhase = DAY_PHASES[nextIdx];

    const fromPreset = SKY_PRESETS[currentPhase.mode];
    const toPreset = SKY_PRESETS[nextPhase.mode];

    if (phaseTimerRef.current < currentPhase.holdDuration) {
      // Steady state inside the phase
      if (isTransitioningRef.current) {
        isTransitioningRef.current = false;
        blendStateRef.current = {
          active: false,
          t: 0,
          from: fromPreset,
          to: fromPreset,
        };
      }
    } else {
      // In transition between current phase and next phase
      isTransitioningRef.current = true;
      const transitionElapsed = phaseTimerRef.current - currentPhase.holdDuration;
      const rawT = Math.min(1, transitionElapsed / currentPhase.transitionDuration);
      const t = smoothstep(0, 1, rawT);

      blendStateRef.current = {
        active: true,
        t,
        from: fromPreset,
        to: toPreset,
      };

      // Smooth fog transition
      if (onFogColorChange && fromPreset.skyLow && toPreset.skyLow) {
        fogColorFrom.current.set(fromPreset.skyLow);
        fogColorTo.current.set(toPreset.skyLow);
        fogCurrent.current.lerpColors(fogColorFrom.current, fogColorTo.current, t);
        onFogColorChange("#" + fogCurrent.current.getHexString());
      }

      // Check if transition has finished
      if (rawT >= 1) {
        phaseIndexRef.current = nextIdx;
        phaseTimerRef.current = 0;
        isTransitioningRef.current = false;

        blendStateRef.current = {
          active: false,
          t: 0,
          from: toPreset,
          to: toPreset,
        };

        onPhaseChange?.(nextPhase.mode, toPreset, nextPhase.name);
      }
    }
  });

  return null;
}
