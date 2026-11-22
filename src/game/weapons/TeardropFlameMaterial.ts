// ─────────────────────────────────────────────────────────────────────────────
// TeardropFlameMaterial — Procedural Realistic Teardrop Torch Fire Shader
// Open-source procedural fire mathematics:
// - Dynamic Teardrop Distance Silhouette:
//     R(y) = 2.0 * sqrt(y + 0.04) * (1.05 - y)^1.35
//     Creates a natural bulbous fuel base that tapers to a slender licking apex.
// - Multi-Octave Fractal Brownian Motion (FBM) Convection & Swirling Turbulence:
//     Thermal buoyancy scrolls noise upward with wind deflection and curling tongues.
// - Blackbody Thermal Radiation Color Palette:
//     Incandescent White Core (>1600K) -> Blazing Gold -> Rich Fiery Orange ->
//     Deep Ruby -> Smoky Charcoal Wisps.
// - Tri-Planar Volumetric Structure:
//     Rendered on intersecting vertical planes with soft alpha falloff,
//     giving full 3D volumetric parallax with zero hard polygon edges or cartoon cones.
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

  // ── GLSL 2D Simplex / Value Noise (Inigo Quilez) ───────────────────────────
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

  // ── Blackbody Thermal Radiation Palette (True Flame Emission) ──────────────
  vec3 getThermalFireColor(float t) {
    t = clamp(t, 0.0, 1.2);

    vec3 col = vec3(0.0);
    if (t < 0.22) {
      // Dark smoke / deep crimson wisp
      col = mix(vec3(0.0), vec3(0.72, 0.08, 0.01), t / 0.22);
    } else if (t < 0.55) {
      // Deep fiery orange body
      float u = (t - 0.22) / 0.33;
      col = mix(vec3(0.72, 0.08, 0.01), vec3(1.0, 0.50, 0.04), u);
    } else if (t < 0.86) {
      // Radiant blazing golden yellow
      float u = (t - 0.55) / 0.31;
      col = mix(vec3(1.0, 0.50, 0.04), vec3(1.0, 0.92, 0.38), u);
    } else {
      // Incandescent white-hot core
      float u = (t - 0.86) / 0.34;
      col = mix(vec3(1.0, 0.92, 0.38), vec3(1.0, 1.0, 0.98), u);
    }

    return col;
  }

  void main() {
    // Center horizontal coordinate: x in [-1, 1], y in [0, 1]
    vec2 q = vec2((vUv.x - 0.5) * 2.0, vUv.y);

    float y = clamp(q.y, 0.0, 1.0);
    float t = uTime * 2.4;

    // ── 1. Realistic Mathematical Teardrop Flame Silhouette ──────────────────
    // Wide bulbous base above glowing coals, curving smoothly into a slender pointed apex
    float width = 1.95 * sqrt(y + 0.04) * pow(max(0.0, 1.06 - y), 1.30);
    width *= (1.0 + uFlameSurge * 0.25);

    // ── 2. Thermal Convection & Swirling FBM Noise ────────────────────────────
    vec2 noiseCoord = vec2(q.x * 2.2, y * 3.2 - t);
    float n1 = fbm(noiseCoord);

    // Higher frequency secondary noise for licking flame tendrils
    vec2 detailCoord = vec2(q.x * 4.5, y * 5.0 - t * 1.5);
    float n2 = fbm(detailCoord);

    // Displace horizontal coordinate based on rising turbulence & wind
    float turbulence = (n1 * 0.7 + n2 * 0.3 - 0.5) * 0.42 * y * (2.0 - y);
    float windOffset = uWind.x * uWindStrength * (y * y * 0.6);

    float displacedX = q.x - turbulence - windOffset;

    // Distance metric from flame central spine relative to teardrop boundary
    float dist = abs(displacedX) / max(0.001, width);

    // ── 3. Organic Flame Density & Soft Masking (Zero Hard Polygon Edges) ─────
    float flameMask = smoothstep(1.0, 0.15, dist);

    // Smooth vertical envelope: gentle start at coal bed, fading out at apex
    flameMask *= smoothstep(0.0, 0.09, y);
    flameMask *= smoothstep(1.02, 0.78, y);

    // ── 4. Internal Thermal Density Field ────────────────────────────────────
    float heat = flameMask * (1.35 - dist * 1.05) * (n1 * 0.6 + 0.65 + uFlameSurge * 0.4);
    heat -= y * 0.32; // Natural thermal cooling toward apex
    heat = max(0.0, heat);

    vec3 fireColor = getThermalFireColor(heat);

    // Soft atmospheric outer glow halo around flame
    float glow = 0.08 / (dist * dist + 0.25) * (1.0 - y * 0.6);
    vec3 ambientGlow = vec3(1.0, 0.35, 0.05) * glow * flameMask;

    vec3 finalColor = fireColor + ambientGlow;
    float finalAlpha = clamp(heat * 1.35 + glow * 0.4, 0.0, 1.0);

    // Boost emissive luminance of the core
    finalColor *= (1.0 + smoothstep(0.7, 1.1, heat) * 0.8);

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
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}
