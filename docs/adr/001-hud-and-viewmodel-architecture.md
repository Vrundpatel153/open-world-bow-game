# ADR 001: Diegetic Archery HUD & Autonomous Environment Architecture

## Status
**Accepted** — November 2026

## Context
The project originated as an interactive diorama exploration with developer UI controls (season dropdowns, sky selectors, Leva property inspectors, and demo text overlays). When transforming the application into a full 3D Open World Archery & Exploration game, several critical deficiencies were identified:

1. **Intrusive Scaffolding & Demo Overlays**: Large Cortiz demo headers (`STYLIZED OPEN WORLD`, `OPEN SOURCE WORKSPACE`), debug pills, and mode switchers (`360° Open World` vs `Diorama Orbit`) overlapped active combat gameplay and broke immersion.
2. **Inappropriate Visual Language**: The existing UI used emojis (e.g., 🎯, 🌲, 💎, 🏆, 📱) and casual web card styling, which clashed directly with the fantasy open-world art direction.
3. **Manual Sky & Season Selection**: Users had to click manual season and sky mode buttons instead of experiencing an atmospheric, living open world.
4. **Viewmodel Matrix Detachment**: In previous iterations, the bow viewmodel was detached from camera space due to R3F scene graph re-mounting, leading to invisible bows and arrows.

---

## Decision Drivers
- **Immersion**: Video game HUD elements must look authentic, diegetic, and high-budget (inspired by *Skyrim*, *Elden Ring*, and *Ghost of Tsushima*).
- **Zero-Emoji Mandate**: Total elimination of unicode emojis across all toasts, objectives, modals, and guides, replaced by heraldic glyphs, runic diamond markers, and classical serif typography (`Cinzel`, `Marcellus`).
- **Autonomous Living World**: Time of day must progress automatically (Daylight → Dusk → Midnight → Dawn) without manual UI toggles, seamlessly blending sky dome uniforms, ambient lighting, directional shadows, and atmospheric fog.
- **High Performance**: UI overlays must remain GPU-light with zero compositing stalls, preserving 60+ FPS performance.

---

## Architectural Decisions

### 1. Compass Architecture (`GameHUD.tsx`)
- **Diegetic Horizontal Ribbon**: 440px wide horizontal ribbon with bilateral opacity masking (`linear-gradient(to right, transparent, black 14%, black 86%, transparent)`).
- **Precision Graticule**: Ticks generated every 15° with major/minor height differentiation, true North accented with a gold heraldic arrow (`▲ N`), and degree readouts.
- **Runic Waypoint Tracking**: Replaced circular colored dots with rotated diamond heraldic prisms (`◇` / `◈`) reflecting shrine state:
  - Unawakened: Core element color with faint glow.
  - Awakened: Pulsing gold sunburst indicating available core.
  - Harmonized: Muted silver ring.
  - Accurate Euclidean distance badge (`48m`) in monospaced typography.

### 2. Autonomous Day-Night Cycle (`DayCycleSystem.tsx`)
- Built a real-time cycle engine running on Three.js's clock delta:
  - 4 celestial phases: **Daylight** (85s) → **Dusk** (40s) → **Midnight** (75s) → **Dawn** (40s) with 18–20s smoothstep transitions.
  - Drives `SkyDome`'s internal `blendStateRef` to cross-fade gradient uniforms (`uSkyLow`, `uSkyHigh`, `uMoonDir`, cloud rim colors, sun elevation).
  - Dynamically synchronizes scene fog (`<fog attach="fog" args={[fogColor, 35, 230]} />`) and ambient/directional light intensities.
  - Broadcasts celestial phase name (`DAYLIGHT`, `DUSK`, `MIDNIGHT`, `DAWN`) to the compass header.

### 3. Pure Video Game HUD Hierarchy
- **Quest Dossier (Top-Left)**: Dark obsidian glass plaque (`rgba(14, 18, 14, 0.9)`) with gold corner accents, displaying active objective status, 4-monolith harmonizing matrix, and narrative instructions without emojis.
- **Chronicle Notifications (Top-Center)**: Cinematic notification banner with dual gold hairline borders sliding down beneath the compass upon striking targets or unsealing monoliths.
- **Dynamic Tension Reticle (Center)**: Dual-layer archery crosshairs with tension caliper ring that contracts and thickens as bowstring draw progress scales 0% → 100%, snapping to turquoise focus diamond at maximum kinetic velocity.
- **Diegetic Keybinds (Bottom-Center)**: Minimalist frosted keycaps (`[LMB (HOLD)]`, `[RELEASE]`, `[RMB]`, `[E]`).
- **Triumph Proclamation (Modal)**: Heraldic victory dossier triggered upon harmonizing all 4 monoliths, with arrows shot, embers cleansed, and precision percentage calculations.

---

## Consequences
- **Positive**:
  - Delivers a cohesive, immersive AAA fantasy aesthetic with no intrusive demo buttons or out-of-place emojis.
  - Player experiences a dynamic living world where lighting and shadows continuously evolve.
  - Full codebase consistency: zero emoji characters in all source files.
- **Trade-offs**:
  - Manual season testing now requires programmatic overrides or debug console commands instead of on-screen buttons.
