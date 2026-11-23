// ─────────────────────────────────────────────────────────────────────────────
// TeardropFlameMaterial — AAA Authentic Handmade Survival Wood Fire Shader
// Inspired by Tomb Raider, The Forest, and Green Hell:
// - Multi-Tongue Convective Wood Fire Dynamics:
//     * Independent central roaring updraft and twin spiraling lateral licking tongues
//     * Licking flame tendrils that curl, detach, and dance with thermal buoyancy
// - True Blackbody Thermal Radiation Palette:
//     * Incandescent White-Hot Fuel Core (>1650K) -> Radiant Blazing Gold ->
//     * Rich Deep Roaring Orange -> Fiery Crimson Edges -> Dark Sooty Charcoal Smoke Wisps
// - Natural Roaring Base & Wind Responsiveness:
//     * Wide roaring base rooted in the burning cloth bundle
//     * Fluid wind and locomotion deflection with natural air drag
// - Multi-Planar Volumetric Structure:
//     * Smooth alpha falloff with zero hard polygon edges or cartoon gas-burner cones
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three'

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3 uWind;
  uniform float uWindStrength;
  uniform float uFlameSurge;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  // ── Fast 2D Simplex / Value Noise ──────────────────────────────────────────
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise2(in vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
          dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
      mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
          dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // ── Multi-Octave Fractal Brownian Motion (FBM) Turbulence ──────────────────
  float fbm(vec2 p) {
    float f = 0.0;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    f += 0.5000 * noise2(p); p = m * p;
    f += 0.2500 * noise2(p); p = m * p;
    f += 0.1250 * noise2(p); p = m * p;
    f += 0.0625 * noise2(p);
    return f / 0.9375;
  }

  // ── Authentic Survival Wood Fire Thermal Blackbody Gradient ───────────────
  // White-hot coal base -> Radiant Gold -> Deep Roaring Orange -> Fiery Crimson -> Smoky Charcoal
  vec4 getSurvivalFireColor(float t, float smoke) {
    vec3 col = vec3(0.0);
    float alpha = 1.0;

    if (t < 0.18) {
      // Dark sooty wood smoke wisps at the outer lick and apex
      float u = t / 0.18;
      col = mix(vec3(0.12, 0.08, 0.06), vec3(0.60, 0.10, 0.01), u);
      alpha = smoothstep(0.015, 0.18, t) * (0.50 + 0.50 * (1.0 - smoke));
    } else if (t < 0.45) {
      // Deep fiery crimson / burnt ember
      float u = (t - 0.18) / 0.27;
      col = mix(vec3(0.60, 0.10, 0.01), vec3(0.98, 0.40, 0.04), u);
      alpha = 0.85 + u * 0.15;
    } else if (t < 0.75) {
      // Roaring golden amber wood flame body
      float u = (t - 0.45) / 0.30;
      col = mix(vec3(0.98, 0.40, 0.04), vec3(1.0, 0.82, 0.20), u);
      alpha = 1.0;
    } else {
      // Incandescent white-hot core above burning pitch coals
      float u = (t - 0.75) / 0.25;
      col = mix(vec3(1.0, 0.82, 0.20), vec3(1.0, 0.98, 0.90), u);
      alpha = 1.0;
    }

    return vec4(col, alpha);
  }

  void main() {
    // Coordinate space: x in [-1, 1], y in [0, 1]
    vec2 q = vec2((vUv.x - 0.5) * 2.0, vUv.y);
    float y = clamp(q.y, 0.0, 1.0);
    float t = uTime * 3.4;

    // ── 1. Organic Survival Fire Envelope ────────────────────────────────────
    // Rooted closely in the cloth bundle (width ~0.26 at y=0), billowing in the belly (y=0.25..0.4),
    // and naturally tapering towards the apex.
    float belly = sin(clamp(y * 2.8, 0.0, 3.14159));
    float envelope = (0.26 + 0.34 * pow(belly, 0.75)) * smoothstep(1.0, 0.55, y);

    // ── 2. Convective Domain Warping & Wind Deflection ───────────────────────
    // Buoyant convective air currents rising and swirling
    vec2 warpCoord = vec2(q.x * 2.4, y * 2.8 - t * 2.2);
    float wx = (noise2(warpCoord) - 0.5) * 0.38 * (y + 0.20);
    float wy = (noise2(warpCoord + vec2(4.7, 2.1)) - 0.5) * 0.18 * y;

    // Fluid wind and locomotion deflection: sweeps flame backward and tilts
    float windDeflect = (uWind.x * 0.40 + sin(y * 4.2 - t * 1.8) * 0.06) * uWindStrength * y * y;
    vec2 warpedP = vec2(q.x - windDeflect + wx, y + wy);

    // ── 3. Multi-Tongue Convective Dynamics (Tomb Raider Style) ──────────────
    // Center roaring tongue
    float distCenter = abs(warpedP.x) / max(0.01, envelope * 0.70);
    float tongueCenter = exp(-distCenter * distCenter * 3.6) * (1.12 - y * 0.28);

    // Twin lateral licking flame tongues (spiral and curl outward independently)
    float tongueLeft = exp(-pow(abs(warpedP.x + 0.12 * envelope) / max(0.01, envelope * 0.48), 2.0) * 4.2)
                       * (0.80 + 0.35 * sin(t * 3.6 + y * 5.5)) * (1.0 - y * 0.35);

    float tongueRight = exp(-pow(abs(warpedP.x - 0.12 * envelope) / max(0.01, envelope * 0.48), 2.0) * 4.2)
                        * (0.80 + 0.35 * cos(t * 4.1 + y * 5.5)) * (1.0 - y * 0.35);

    // Composite roaring flame tongues
    float flameDensity = max(tongueCenter, max(tongueLeft, tongueRight));

    // High-frequency licking flame edge turbulence & breakup
    float nTurb = fbm(vec2(q.x * 4.2, y * 5.2 - t * 3.0));
    float nLick = fbm(vec2(q.x * 6.5 - t * 0.9, y * 8.0 - t * 4.2));
    flameDensity *= (0.72 + 0.42 * nTurb + 0.20 * nLick);

    // ── 4. Strict Non-Clipping Edge Falloff ──────────────────────────────────
    // Smoothly decays to exact 0 well before quad boundaries (eliminates all planar edges)
    float horizMask = smoothstep(0.92, 0.45, abs(q.x));
    float vertMask = smoothstep(0.0, 0.05, y) * smoothstep(1.0, 0.70, y);

    float heat = flameDensity * horizMask * vertMask;

    if (heat < 0.018) discard;

    // Smoke factor at outer tips
    float smoke = (1.0 - vertMask) * 0.7 + (1.0 - smoothstep(0.0, 0.35, heat)) * 0.4;
    vec4 fireCol = getSurvivalFireColor(heat, smoke);

    // Subtle localized radiant flame core glow (strictly masked by horizMask and vertMask)
    float coreGlow = exp(-abs(warpedP.x) * 4.5) * smoothstep(0.02, 0.25, y) * smoothstep(0.85, 0.45, y) * 0.20;
    vec3 finalColor = fireCol.rgb + vec3(1.0, 0.45, 0.08) * coreGlow;
    float finalAlpha = clamp(fireCol.a * smoothstep(0.018, 0.09, heat), 0.0, 1.0);

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`

export function createTeardropFlameMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uWind: { value: new THREE.Vector3(0.7, 0, 0.7) },
      uWindStrength: { value: 0.25 },
      uFlameSurge: { value: 0.0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  })
}
