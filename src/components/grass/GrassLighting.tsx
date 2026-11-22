// ─────────────────────────────────────────────────────────────────────────────
// GrassLighting — Dynamic Directional & Ambient Sun/Moon Lighting Rig
// Continuously tracks celestial sun/moon vectors for moving real-time shadows,
// calibrated shadow biases for acne prevention, and zero Leva dependencies.
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
}

export default function GrassLighting({
  preset,
  sunDir,
  sunColor,
  sunIntensity,
}: GrassLightingProps) {
  const dirRef = useRef<THREE.DirectionalLight>(null!);
  const ambientRef = useRef<THREE.AmbientLight>(null!);

  const lightDistance = 75;

  useFrame(() => {
    const dl = dirRef.current;
    const al = ambientRef.current;
    if (!dl) return;

    if (sunDir) {
      dl.position.copy(sunDir).multiplyScalar(lightDistance);
      if (sunColor) dl.color.copy(sunColor);
      if (sunIntensity !== undefined) {
        dl.intensity = sunIntensity;
        // Scale ambient light harmoniously with sun intensity
        if (al) {
          if (sunIntensity > 1.2) {
            al.color.set("#e4f2cf");
            al.intensity = 1.05;
          } else if (sunIntensity > 0.6) {
            al.color.set("#e0b898");
            al.intensity = 0.75;
          } else {
            al.color.set("#1f3354");
            al.intensity = 0.38;
          }
        }
      }
    } else {
      // Fallback to preset configuration
      const l = preset.light;
      dl.color.set(l.dirColor);
      dl.intensity = l.dirIntensity;
      if (al) {
        al.color.set(l.ambientColor);
        al.intensity = l.ambientIntensity;
      }
    }

    dl.target.position.set(0, 0, 0);
    dl.target.updateMatrixWorld();
  });

  return (
    <>
      <ambientLight ref={ambientRef} color="#e4f2cf" intensity={1.05} />
      <directionalLight
        ref={dirRef}
        color="#fff8eb"
        intensity={3.1}
        position={[-45, 35, -25]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={160}
        shadow-camera-left={-36}
        shadow-camera-right={36}
        shadow-camera-top={36}
        shadow-camera-bottom={-36}
        shadow-bias={0.0001}
        shadow-normalBias={0.22}
      />
    </>
  );
}
