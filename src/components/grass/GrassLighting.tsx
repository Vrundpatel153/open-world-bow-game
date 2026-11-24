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
  sunIntensity?: number | React.MutableRefObject<number>;
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
  const fillLightRef = useRef<THREE.DirectionalLight>(null!);
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

    const effIntensity =
      typeof sunIntensity === "object" && sunIntensity !== null
        ? sunIntensity.current
        : sunIntensity ?? 3.1;

    // Follow the player so the shadow map covers the player's active world area
    const targetPos = playerPosRef?.current ?? new THREE.Vector3(0, 0, 0);

    targetObj.position.copy(targetPos);
    dl.target = targetObj;

    if (sunDir) {
      dl.position.copy(targetPos).addScaledVector(sunDir, lightDistance);

      if (sunColor) dl.color.copy(sunColor);
      dl.intensity = effIntensity;

      // Fill light illuminates shadow sides from the opposite azimuth with soft skylight
      const fl = fillLightRef.current;
      if (fl) {
        const fillDir = new THREE.Vector3(-sunDir.x, Math.max(0.3, sunDir.y * 0.5), -sunDir.z).normalize();
        fl.position.copy(targetPos).addScaledVector(fillDir, 45);
        fl.intensity = effIntensity > 1.0 ? 0.85 : (effIntensity > 0.45 ? 0.30 : 0.18);
      }

      // Dynamic ambient and environmental lighting (Full daylight -> atmospheric silver-blue night)
      if (hemi) {
        if (effIntensity > 1.8) {
          // Broad Daylight: Radiant blue sky and lush mossy turf bounce
          hemi.intensity = 1.8;
          hemi.color.set("#b8e2ff");
          hemi.groundColor.set("#46702c");
        } else if (effIntensity > 0.8) {
          // Dawn / Dusk: Warm peach sky and amber earth bounce
          hemi.intensity = 1.35;
          hemi.color.set("#ffd8b4");
          hemi.groundColor.set("#5a4028");
        } else if (effIntensity > 0.45) {
          // Twilight: Soft deep indigo
          hemi.intensity = 0.55;
          hemi.color.set("#283e5c");
          hemi.groundColor.set("#101a14");
        } else {
          // Atmospheric Moonlight: Visible, moody night with silver-blue skylight and deep forest bounce
          hemi.intensity = 0.42;
          hemi.color.set("#1e2e4a");
          hemi.groundColor.set("#0a1610");
        }
      }

      if (amb) {
        amb.intensity = effIntensity > 1.0 ? 0.82 : (effIntensity > 0.45 ? 0.28 : 0.22);
      }
    } else {
      const l = preset.light;
      dl.color.set(l.dirColor);
      dl.intensity = l.dirIntensity;
      if (hemi) hemi.intensity = 1.4;
    }
  });

  return (
    <>
      {/* 0. Directional Light Target Node */}
      <primitive object={targetRef.current} />

      {/* 1. Atmospheric Hemisphere Skylight & Earth Bounce */}
      <hemisphereLight
        ref={hemiRef}
        color="#b8e2ff"
        groundColor="#46702c"
        intensity={1.8}
      />

      {/* 2. Ambient Fill (Eliminates pitch black silhouettes) */}
      <ambientLight ref={ambientRef} color="#fff8ee" intensity={0.82} />

      {/* 3. Soft Counter-Azimuth Fill Directional Light (Zero shadow, illuminates backlit trees & foliage) */}
      <directionalLight
        ref={fillLightRef}
        color="#e0f0ff"
        intensity={0.85}
        castShadow={false}
      />

      {/* 4. High-Precision Moving Cascaded Directional Sunlight & Shadows */}
      <directionalLight
        ref={dirRef}
        color="#fff8eb"
        intensity={3.1}
        position={[-45, 60, -25]}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-camera-near={1}
        shadow-camera-far={180}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-bias={-0.0002}
        shadow-normalBias={0.05}
      />
    </>
  );
}
