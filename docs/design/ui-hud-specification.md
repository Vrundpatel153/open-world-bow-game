# Open World Archery: UI & HUD Specification

## 1. Design Philosophy & Aesthetic Pillars
- **Atmospheric Diegesis**: HUD elements must feel etched into the fabric of the ancient fantasy world, never resembling casual web apps or developer dashboards.
- **Zero-Emoji Mandate**: Under no circumstances may unicode emojis be employed. All visual signaling is achieved through classical heraldic iconography, runic geometric glyphs (`▲`, `◆`, `◇`, `◈`), and clean typography.
- **Chiseled Classical Typography**:
  - Headers & Titles: **Cinzel** (Serif, small-caps, tracked letter-spacing `0.08em` to `0.24em`).
  - Narrative Body: **Marcellus** / **Barlow** (Crisp legibility with high contrast).
  - Telemetry & Measurements: **IBM Plex Mono** (Monospaced alignment for degrees, distances, and combat statistics).

---

## 2. Color Palette & Material Tokens

| Token Name | Value | Usage |
| :--- | :--- | :--- |
| **Obsidian Glass Base** | `rgba(14, 20, 15, 0.88)` | Primary HUD card and banner backdrops with `backdrop-filter: blur(14px)` |
| **Antique Gold Primary** | `#d4af37` / `#f5d77f` | Crests, cardinal indicators, borders, and active highlights |
| **Gold Border Dim** | `rgba(214, 184, 120, 0.35)` | Subtle graticule lines and card perimeter hairlines |
| **Ivory Text** | `#f5f0e6` | Primary headers and high-priority narrative text |
| **Muted Slate Text** | `#8c9b90` | Secondary metadata and degree ticks |
| **Aero Mint** | `#38ef7d` | Shrine of the Whispering Wind waypoint & elemental beam |
| **Solar Amber** | `#ff9900` | Shrine of the Solar Flame waypoint & elemental beam |
| **Twilight Violet** | `#b845ff` | Shrine of the Twilight Star waypoint & elemental beam |
| **Titan Cyan** | `#00d2ff` | Shrine of the Ancient Titan waypoint & elemental beam |
| **Celestial Focus** | `#4deeea` | Peak bow draw tension and precision aim reticle indicator |
| **Hit Crimson** | `#ff4d4f` | Combat hit-marker flash and North cardinal accent |

---

## 3. Component Specifications

### 3.1 Diegetic Skyrim-Style Compass Bar
- **Dimensions**: `440px` width × `38px` height.
- **Masking**: Bilateral horizontal gradient mask (`14%` fade-in, `86%` fade-out) preventing hard window borders.
- **Graticule System**:
  - Cardinal Points (`N`, `E`, `S`, `W`): Uppercase bold serif. North features a gold crest arrow (`▲ N`) and glowing amber drop-shadow.
  - Ordinal Points (`NE`, `SE`, `SW`, `NW`): 65% opacity ivory text.
  - Sub-tick Lines: Ticks every 15° with major/minor height differentiation.
  - Center Needle: Downward gold triangle notch and fine vertical hairline (`rgba(245, 215, 127, 0.95)`).
- **Runic Waypoints**:
  - Calculated bearing relative to player camera yaw.
  - Rendered as rotated diamond heraldic prisms with dynamic glow.
  - Distance badge rendered in `IBM Plex Mono` (e.g. `48m`).
- **Celestial Header**: Displays current diurnal phase (e.g., `◆ DAYLIGHT | 182° ◆`).

### 3.2 Ancient Monolith Quest Dossier (Top-Left)
- **Position**: `top: 24px`, `left: 24px`, `width: 320px`.
- **Styling**: Obsidian glass panel with 2px gold corner brackets (`borderTop` & `borderLeft` on top-left, `borderBottom` & `borderRight` on bottom-right).
- **Structure**:
  1. Small-caps category banner: `ACTIVE QUEST` with `[X / 4 HARMONIZED]` tracker.
  2. Main title: `SANCTIFY THE ANCIENT MONOLITHS`.
  3. Hairline divider with golden gradient.
  4. 4-Monolith Status Matrix (Wind, Solar, Twilight, Titan) with real-time ember count (`X/3 EMBERS`), unsealed status (`HARMONIZE [E]`), or completed state (`SANCTIFIED`).
  5. Contextual narrative instruction footer.

### 3.3 Chronicle Notification Banner (Top-Center)
- **Position**: `top: 76px`, horizontally centered beneath compass.
- **Animation**: Slides down smoothly (`translateY`) with fade-in on event, auto-dismissing after 4.5 seconds.
- **Styling**: Obsidian dark slate bar with dual gold hairline borders and rotated diamond heraldic badge.
- **Content**: Clean small-caps header (`CHRONICLE UPDATE`) and high-contrast narrative text.

### 3.4 Dynamic Archery Reticle
- **Tension Caliper Ring**: Outer circle that smoothly contracts from `42px` down to `16px` as draw progress increases from 0 to 1.
- **Peak Draw Activation**: At `drawProgress > 0.88`, turns radiant turquoise (`#4deeea`) with soft bloom glow.
- **Center Diamond Pip**: Rotated 45° diamond pip that enlarges and turns amber-gold at full tension.
- **Hit Marker**: 4 angled crimson slashes (`✕`) that flash for 220ms upon arrow collision with guardian bells.

### 3.5 Diegetic Keybind Guide (Bottom-Center)
- **Position**: `bottom: 22px`, horizontally centered.
- **Styling**: Slate glass bar with frosted keycaps:
  - `[LMB (HOLD)] Draw Bow`
  - `[RELEASE] Loose Arrow`
  - `[RMB] Focus Aim`
  - `[E] Claim Core`

### 3.6 Celestial Harmony Victory Proclamation
- **Trigger**: Restoring all 4 ancient monoliths.
- **Presentation**: Full-screen backdrop blur (`20px`) with heraldic triumph card.
- **Metrics Dossier**: Shows Arrows Released, Embers Cleansed, and Marksmanship Precision percentage.
- **Action**: Golden leaf `COMMENCE NEW VOYAGE` restart button.
