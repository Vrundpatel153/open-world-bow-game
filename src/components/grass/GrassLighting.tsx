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
  const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());

  const lightDistance = 80;

  useFrame(() => {
    const dl = dirRef.current;
    const hemi = hemiRef.current;
    const amb = ambientRef.current;
    const targetObj = targetRef.current;
    if (!dl) return;

    // Follow the player so the shadow map covers the player's active world area
    const targetPos = playerPosRef?.current ?? new THREE.Vector3(0, 0, 0);

    targetObj.position.copy(targetPos);
    dl.target = targetObj;

    if (sunDir) {
      dl.position.copy(targetPos).addScaledVector(sunDir, lightDistance);

      if (sunColor) dl.color.copy(sunColor);
      dl.intensity = sunIntensity;

      // Dynamic 3-tier ambient lighting to eliminate black silhouettes
      if (hemi) {
        if (sunIntensity > 1.8) {
          // Broad Daylight: Radiant blue sky and lush mossy turf bounce
          hemi.intensity = 1.6;
          hemi.color.set("#a2d8ff");
          hemi.groundColor.set("#3c5e26");
        } else if (sunIntensity > 0.8) {
          // Dawn / Dusk: Warm peach sky and amber earth bounce
          hemi.intensity = 1.35;
          hemi.color.set("#ffd2aa");
          hemi.groundColor.set("#523a24");
        } else {
          // Night / Twilight: Nocturnal indigo
          hemi.intensity = 0.65;
          hemi.color.set("#2c4568");
          hemi.groundColor.set("#14221a");
        }
      }

      if (amb) {
        amb.intensity = sunIntensity > 1.0 ? 0.72 : 0.28;
      }
    } else {
      const l = preset.light;
      dl.color.set(l.dirColor);
      dl.intensity = l.dirIntensity;
      if (hemi) hemi.intensity = 1.2;
    }
  });

  return (
    <>
      {/* 0. Directional Light Target Node */}
      <primitive object={targetRef.current} />

      {/* 1. Atmospheric Hemisphere Skylight & Earth Bounce */}
      <hemisphereLight
        ref={hemiRef}
        color="#a2d8ff"
        groundColor="#3c5e26"
        intensity={1.6}
      />

      {/* 2. Ambient Fill (Eliminates pitch black silhouettes) */}
      <ambientLight ref={ambientRef} color="#fff6eb" intensity={0.72} />

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
