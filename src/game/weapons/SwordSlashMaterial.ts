// ─────────────────────────────────────────────────────────────────────────────
// SwordSlashMaterial — AAA Luminous Aerodynamic Blade Slipstream & Crescent Shader
// Inspired by Ghost of Tsushima, Sekiro, and Elden Ring:
// - Dynamic Translucent Slipstream Vapor:
//     * Ultra-fine supersonic air shear striations with zero opaque polygonal facets
//     * Seamless cubic length falloff (U) from razor-sharp cutting edge to dissipative vapor
//     * Soft Gaussian width feathering (V) eliminating all hard polygonal boundaries
// - Incandescent Steel Color Grade:
//     * Blinding white core (#ffffff) at razor edge
//     * Tempered sky-cyan sheen (#9ad0ff) in slipstream body
//     * Ethereal midnight-indigo fade (#3568a8) at vanishing tail
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
  uniform vec3 uColorEdge;
  uniform vec3 uColorTrail;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    // vUv.x: 0.0 at the leading cutting edge, 1.0 at trailing dissipative tail
    // vUv.y: 0.0 at inner blade boundary, 1.0 at outer razor cutting tip

    // 1. Aerodynamic Longitudinal Falloff (U)
    // Razor-sharp leading edge with smooth cubic dissipation towards tail
    float lengthFade = pow(max(0.0, 1.0 - vUv.x), 1.55);
    lengthFade *= smoothstep(1.0, 0.78, vUv.x);

    // 2. Soft Gaussian Transverse Feathering (V)
    // Peak luminance near the outer cutting radius (0.80 - 0.96)
    // Smooth zero-alpha feathering at both boundaries (ZERO sharp polygon sheets)
    float innerFeather = smoothstep(0.0, 0.42, vUv.y);
    float outerFeather = smoothstep(1.03, 0.88, vUv.y);
    float widthFade = innerFeather * outerFeather;

    // 3. High-Speed Supersonic Air Shear Striations
    float shear1 = sin(vUv.y * 36.0 - vUv.x * 16.0 - uTime * 28.0) * 0.5 + 0.5;
    float shear2 = sin(vUv.y * 64.0 + vUv.x * 24.0 + uTime * 42.0) * 0.5 + 0.5;
    float airShear = mix(0.70, 1.0, shear1 * shear2);

    // 4. Incandescent Steel Color Blending
    // Transition: trailing mist -> tempered cyan slipstream -> white-hot cutting core
    vec3 col = mix(uColorTrail, uColorEdge, pow(max(0.0, 1.0 - vUv.x), 1.1));
    float coreHighlight = pow(vUv.y, 2.6) * pow(max(0.0, 1.0 - vUv.x), 0.75);
    col = mix(col, uColorCore, clamp(coreHighlight * 1.5, 0.0, 1.0));

    // 5. Total Dynamic Alpha
    float finalAlpha = lengthFade * widthFade * airShear * uOpacity;
    if (finalAlpha < 0.003) discard;

    gl_FragColor = vec4(col * finalAlpha, finalAlpha);
  }
`

export function createSwordSlashMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.0 },
      uColorCore: { value: new THREE.Color('#ffffff') },
      uColorEdge: { value: new THREE.Color('#9ad0ff') },
      uColorTrail: { value: new THREE.Color('#3568a8') },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
}

// Crescent Slash Arc Material (for dedicated combo arc shockwaves)
const crescentFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uOpacity;
  uniform float uProgress;
  uniform vec3 uColorCore;
  uniform vec3 uColorEdge;

  varying vec2 vUv;

  void main() {
    // vUv.x: 0.0 to 1.0 along the arc span
    // vUv.y: 0.0 at inner ring, 1.0 at outer ring

    // Arc head & tail fade
    float arcSpan = sin(vUv.x * 3.14159265);
    arcSpan = pow(arcSpan, 0.7);

    // Ring thickness feathering (peak near outer blade radius)
    float ringFade = smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.02, 0.82, vUv.y);

    // Dynamic wave sweep
    float sweep = smoothstep(0.0, 0.25, vUv.x - uProgress * 0.4);

    vec3 col = mix(uColorEdge, uColorCore, pow(vUv.y, 1.8));

    float alpha = arcSpan * ringFade * sweep * uOpacity;
    if (alpha < 0.003) discard;

    gl_FragColor = vec4(col * alpha, alpha);
  }
`

export function createSlashCrescentMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: crescentFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.0 },
      uProgress: { value: 0.0 },
      uColorCore: { value: new THREE.Color('#ffffff') },
      uColorEdge: { value: new THREE.Color('#8ec6ff') },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
}
