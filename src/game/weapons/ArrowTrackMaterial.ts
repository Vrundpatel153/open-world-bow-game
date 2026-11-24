// ─────────────────────────────────────────────────────────────────────────────
// ArrowTrackMaterial — AAA Luminous Aerodynamic Arrow Slipstream Trail Shader
// Inspired by Horizon Zero Dawn, Tomb Raider, and Ghost of Tsushima:
// - Camera-Oriented Luminous Slipstream Ribbon:
//     * Seamless cubic length falloff (U) from razor-sharp arrow nock to dissipative vapor
//     * Soft Gaussian transverse feathering (V) eliminating all hard polygonal boundaries
//     * High-speed supersonic air-shear striations mimicking fletching vortex turbulence
// - Incandescent Archery Color Grading:
//     * Starlight white core (#ffffff) at arrow tail
//     * Radiant celestial cyan-gold sheen (#d4f0ff) in slipstream body
//     * Ethereal twilight indigo fade (#3568a8) at vanishing tail
// - Additive / Screen Blending with Depth-Tested Transparency (Zero world occlusion)
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
  uniform float uOpacity;
  uniform vec3 uColorCore;
  uniform vec3 uColorGlow;
  uniform vec3 uColorTail;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    // vUv.x: 0.0 at arrow nock (newest point), 1.0 at dissipating tail (oldest point)
    // vUv.y: 0.0 at left ribbon edge, 0.5 at ribbon center, 1.0 at right ribbon edge

    // 1. Aerodynamic Longitudinal Falloff (U)
    // Razor-sharp cutting head with smooth cubic dissipation towards tail
    float lengthFade = pow(max(0.0, 1.0 - vUv.x), 1.6);
    lengthFade *= smoothstep(1.0, 0.78, vUv.x);

    // 2. Soft Gaussian Transverse Profile (V)
    // Zero-alpha feathering at both lateral edges, smooth bell curve towards center
    float centerDist = abs(vUv.y - 0.5) * 2.0; // 0.0 at center, 1.0 at edge
    float widthFade = 1.0 - smoothstep(0.0, 1.0, centerDist);
    widthFade = pow(widthFade, 2.2);

    // 3. High-Speed Supersonic Air Shear Striations
    float shear1 = sin(vUv.x * 36.0 - uTime * 26.0) * 0.5 + 0.5;
    float shear2 = sin(vUv.x * 64.0 + uTime * 38.0) * 0.5 + 0.5;
    float airShear = mix(0.72, 1.0, shear1 * shear2);

    // 4. Luminous Color Transition
    // Transition: tail indigo mist -> radiant cyan slipstream -> white-hot cutting core
    vec3 col = mix(uColorTail, uColorGlow, pow(max(0.0, 1.0 - vUv.x), 1.1));
    float coreHighlight = pow(widthFade, 1.8) * pow(max(0.0, 1.0 - vUv.x), 0.6);
    col = mix(col, uColorCore, clamp(coreHighlight * 1.5, 0.0, 1.0));

    // 5. Total Dynamic Alpha
    float finalAlpha = lengthFade * widthFade * airShear * uOpacity;
    if (finalAlpha < 0.003) discard;

    gl_FragColor = vec4(col * finalAlpha, finalAlpha);
  }
`

export function createArrowTrackMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.90 },
      uColorCore: { value: new THREE.Color('#ffffff') },
      uColorGlow: { value: new THREE.Color('#d4f0ff') },
      uColorTail: { value: new THREE.Color('#3568a8') },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
}
