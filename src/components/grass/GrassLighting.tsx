// ─────────────────────────────────────────────────────────────────────────────
// GrassLighting — Dynamic Directional & Atmospheric Sun/Moon Lighting Rig
// Continuously tracks celestial sun/moon vectors for moving real-time shadows,
// cascaded player-following shadow frustum, sky hemisphere bounce illumination,
// and zero Leva dependencies.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SkyPreset } from "@/components/skyDome/constants";

interface GrassLightingProps {
  preset: SkyPreset;
  sunDir?: THREE.Vector3;
  sunColor?: THREE.Color;
  sunIntensity?: number;
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

export default function GrassLighting({
  preset,
  sunDir,
  sunColor,
  sunIntensity = 3.1,
  playerPosRef,
}: GrassLightingProps) {
  const dirRef = useRef<THREE.DirectionalLight>(null!);
  const hemiRef = useRef<THREE.HemisphereLight>(null!);
  const ambientRef = useRef<THREE.AmbientLight>(null!);

  const lightDistance = 80;

  useFrame(() => {
    const dl = dirRef.current;
    const hemi = hemiRef.current;
    const amb = ambientRef.current;
    if (!dl) return;

    // Follow the player so the shadow map covers the player's active world area
    const targetPos = playerPosRef?.current ?? new THREE.Vector3(0, 0, 0);

    if (sunDir) {
      dl.position.copy(targetPos).addScaledVector(sunDir, lightDistance);
      dl.target.position.copy(targetPos);
      dl.target.updateMatrixWorld();

      if (sunColor) dl.color.copy(sunColor);
      dl.intensity = sunIntensity;

      // Dynamic 3-tier ambient lighting to eliminate black silhouettes
      if (hemi) {
        if (sunIntensity > 1.8) {
          // Broad Daylight
          hemi.intensity = 1.25;
          hemi.color.set("#96d4ff");       // Soft sky blue from above
          hemi.groundColor.set("#385c22"); // Mossy turf green bounce from below
        } else if (sunIntensity > 0.8) {
          // Dawn / Dusk
          hemi.intensity = 1.0;
          hemi.color.set("#ffcba4");       // Warm peach sky
          hemi.groundColor.set("#4a3622"); // Warm amber earth bounce
        } else {
          // Night / Twilight
          hemi.intensity = 0.42;
          hemi.color.set("#243b59");       // Nocturnal indigo
          hemi.groundColor.set("#0f1c14"); // Dark earth
        }
      }

      if (amb) {
        amb.intensity = sunIntensity > 1.0 ? 0.35 : 0.15;
      }
    } else {
      const l = preset.light;
      dl.color.set(l.dirColor);
      dl.intensity = l.dirIntensity;
      if (hemi) hemi.intensity = 1.0;
    }
  });

  return (
    <>
      {/* 1. Atmospheric Hemisphere Skylight & Earth Bounce */}
      <hemisphereLight
        ref={hemiRef}
        color="#96d4ff"
        groundColor="#385c22"
        intensity={1.25}
      />

      {/* 2. Soft Ambient Crevice Fill */}
      <ambientLight ref={ambientRef} color="#fff2de" intensity={0.35} />

      {/* 3. High-Precision Moving Cascaded Directional Sunlight & Shadows */}
      <directionalLight
        ref={dirRef}
        color="#fff8eb"
        intensity={3.1}
        position={[-45, 60, -25]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={180}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-bias={-0.0001}
        shadow-normalBias={0.06}
      />
    </>
  );
}
