
import React, { Component, ReactNode, Suspense } from "react";
import { Environment } from "@react-three/drei";
import type { SceneMode } from "./SceneContent";

class SafeEnvironmentBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.warn("SceneEnvironment HDR network load failed, falling back to scene lighting:", err);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

type EnvPreset =
  | "apartment"
  | "city"
  | "dawn"
  | "forest"
  | "lobby"
  | "night"
  | "park"
  | "studio"
  | "sunset"
  | "warehouse";

interface SceneEnvironmentProps {
  mode: SceneMode;
  /** Defaults to `mode === "Background"`. Pass false when something else owns
   *  the backdrop (e.g. the grass scene's SkyDome) but the HDRI is still wanted
   *  for image-based lighting. */
  background?: boolean;
  /** Starting values for the Leva sliders — each scene tunes its own HDRI. */
  defaults?: {
    preset?: EnvPreset;
    bgBlurriness?: number;
    bgIntensity?: number;
    envIntensity?: number;
  };
  /** Leva folder — kept per scene so two demos don't share stored values through
   *  Leva's global store. */
  folder?: string;
}

export default function SceneEnvironment({
  mode,
  background,
  defaults,
}: SceneEnvironmentProps) {
  const preset = (defaults?.preset ?? "park") as EnvPreset;
  const bgBlurriness = defaults?.bgBlurriness ?? 0.9;
  const bgIntensity = defaults?.bgIntensity ?? 0.3;
  const envIntensity = defaults?.envIntensity ?? 0;

  return (
    <SafeEnvironmentBoundary>
      <Suspense fallback={null}>
        <Environment
          preset={preset}
          background={background ?? mode === "Background"}
          backgroundBlurriness={bgBlurriness}
          backgroundIntensity={bgIntensity}
          environmentIntensity={envIntensity}
        />
      </Suspense>
    </SafeEnvironmentBoundary>
  );
}

