# Open World Archery 3D: The Ancient Grove

A production-grade, immersive 3D Open World Archery combat and exploration simulator built with **React 19**, **Three.js**, **React Three Fiber (R3F)**, **Drei**, and custom **GLSL shaders**.

Features dynamic recurve bow physics, an autonomous day-night cycle, a diegetic Skyrim/Elden Ring-style horizontal ribbon compass, ancient megalithic shrines, and zero emojis.

---

## Key Features

### 1. Recurve Archery Combat System
- **Direct Camera Matrix Viewmodel**: 60 FPS viewmodel tracking using real-time camera matrix synchronization, eliminating R3F reconciler detachment and weapon clipping.
- **Dynamic Tension Reticle**: Outer tension caliper ring contracts from $42\text{px}$ to $14\text{px}$ as draw tension scales $0\% \rightarrow 100\%$, snapping to a glowing turquoise diamond (`#4deeea`) at maximum kinetic velocity.
- **Ballistic Arrow Trajectory**: Arrows travel at high velocity ($\sim 48\text{--}76\text{ m/s}$) with aerodynamic orientation alignment, terminal quivering on impact, and elemental hit particle sparks.
- **Kinematic Weapon States**: Procedural dark walnut wood grain, hand-stitched leather grip, dynamic flexing limbs, braided bowstring, and Damascus steel broadhead arrow.

### 2. Autonomous Real-Time Day-Night Cycle
- **Continuous Celestial Loop**: Autonomous cycle progressing through **Daylight** ($85\text{s}$) $\rightarrow$ **Dusk** ($40\text{s}$) $\rightarrow$ **Midnight** ($75\text{s}$) $\rightarrow$ **Dawn** ($40\text{s}$) with smooth $18\text{--}20\text{s}$ cross-fades.
- **Shader & Lighting Blending**: Dynamically cross-fades volumetric FBM cloud uniforms, sun/moon elevation, ambient IBL light, directional shadow angles, and scene atmospheric fog.
- **Telemetry Broadcasting**: Broadcasts live celestial phase names (`DAYLIGHT`, `DUSK`, `MIDNIGHT`, `DAWN`) directly to the compass header.

### 3. Diegetic Skyrim / Elden Ring Style Compass
- **Horizontal Graticule Ribbon**: $440\text{px}$ wide obsidian glass plate with bilateral gradient opacity masking.
- **Precision Graticule**: Degree tick lines every $15^\circ$, cardinal points (`▲ N`, `E`, `S`, `W`) in tracked `Cinzel` serif, and a gold crest arrow highlighting true North.
- **Runic Waypoint Tracking**: Rotated diamond heraldic prisms (`◇` / `◈`) tracking ancient monoliths with elemental colors and real-time distance readouts in meters (`23m`, `56m`).
- **Zero-Emoji Policy**: Pure classical typography and heraldic glyphs; strictly no unicode emojis anywhere in the interface.

### 4. Ancient Megalithic Shrines
- 4 ancient dolmen trilithon monoliths:
  - **Shrine of the Whispering Wind** (Aero Mint)
  - **Shrine of the Solar Flame** (Solar Amber)
  - **Shrine of the Twilight Star** (Twilight Violet)
  - **Shrine of the Ancient Titan** (Titan Cyan)
- Hovering obsidian Elder Futhark runes, glowing elemental crystal beacons, orbiting guardian ember target bells, and cobblestone trail paths guiding the marksman.

### 5. High-Performance Instanced Foliage
- Over $24,000$ wind-animated instanced grass blades with custom vertex displacement shaders.
- Ground normal clamping and collision response without garbage collection overhead.
- Early-exit raymarch optimization in sky shaders for 60+ FPS on PC.

---

## Controls

| Key / Action | Function |
| :--- | :--- |
| **`W` `A` `S` `D`** | Move in 360° Open World |
| **`MOUSE`** | Look around (Click screen to lock cursor, `ESC` to unlock) |
| **`SHIFT`** | Sprint |
| **`SPACE`** | Vault / Jump |
| **`LMB` (Hold)** | Draw Bowstring |
| **`RELEASE`** | Loose Arrow |
| **`RMB`** | Focus ADS Zoom |
| **`E`** | Harmonize / Claim Elemental Core at unsealed monolith |

---

## Tech Stack
- **Framework**: React 19, TypeScript, Vite
- **3D Graphics**: Three.js, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`
- **Typography**: Cinzel, Marcellus, IBM Plex Mono, Barlow
- **State Management**: Zustand
- **Shaders**: Custom GLSL (Volumetric Sky, FBM Clouds, Instanced Wind Grass)

---

## Architecture & Documentation
- **Architecture Decision Record**: [docs/adr/001-hud-and-viewmodel-architecture.md](docs/adr/001-hud-and-viewmodel-architecture.md)
- **UI/HUD Specification**: [docs/design/ui-hud-specification.md](docs/design/ui-hud-specification.md)

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/Vrundpatel153/open-world-bow-game.git

# Enter the directory
cd open-world-bow-game

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## License
MIT
