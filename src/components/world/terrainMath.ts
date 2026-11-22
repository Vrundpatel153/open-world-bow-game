// ─────────────────────────────────────────────────────────────────────────────
// terrainMath — Mathematical definition of open world elevation & landscape
// Shared between terrain vertex displacement, character controller, and foliage scatter.
// ─────────────────────────────────────────────────────────────────────────────

export const PLAYABLE_RADIUS = 85 // 85m radius playable grass area (170m x 170m)
export const SKIRT_RADIUS = 360    // 360m radius horizon mountain skirt

/**
 * Procedural elevation for the open world landscape.
 * Produces smooth, rolling hills, meadows, and rises towards the distant horizon.
 */
export function getTerrainElevation(x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z)

  // 1. Rolling hill undulations
  const hill1 = Math.sin(x * 0.042) * 1.5 + Math.cos(z * 0.038) * 1.3
  const hill2 = Math.sin(x * 0.095 + z * 0.075) * 0.55
  const hill3 = Math.cos(x * 0.018 - z * 0.022) * 1.8

  // Gentle around spawn (dist < 10m) so player starts on smooth ground
  const spawnDamp = Math.min(1.0, dist / 10.0)
  const baseMeadow = (hill1 + hill2 + hill3) * (0.35 + 0.65 * spawnDamp)

  // 2. Horizon mountain skirt (rises up beyond playable radius to frame the sky)
  if (dist > PLAYABLE_RADIUS * 0.8) {
    const skirtProgress = (dist - PLAYABLE_RADIUS * 0.8) / (SKIRT_RADIUS - PLAYABLE_RADIUS * 0.8)
    const clampedProgress = Math.max(0, Math.min(1, skirtProgress))
    
    // Mountains rise smoothly at the outer perimeter
    const mountainRidge =
      Math.sin(x * 0.015) * 6.0 +
      Math.cos(z * 0.012) * 5.0 +
      Math.sin(x * 0.03 + z * 0.025) * 3.0
    
    const skirtRise = Math.pow(clampedProgress, 1.8) * (18.0 + mountainRidge)
    return baseMeadow + skirtRise
  }

  return baseMeadow
}
