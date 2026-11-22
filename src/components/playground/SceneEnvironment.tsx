
import { Environment } from "@react-three/drei";
import { useControls, folder } from "leva";
import type { SceneMode } from "./SceneContent";

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
    <Environment
      preset={preset}
      background={background ?? mode === "Background"}
      backgroundBlurriness={bgBlurriness}
      backgroundIntensity={bgIntensity}
      environmentIntensity={envIntensity}
    />
  );
}
