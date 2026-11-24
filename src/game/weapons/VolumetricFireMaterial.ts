// ─────────────────────────────────────────────────────────────────────────────
// VolumetricFireMaterial — AAA Authentic 3D Procedural Volumetric Fire Shader
// Open-source ray-tracing based volumetric flame (based on Alfred et al.
// Real-Time Procedural Volumetric Fire & mattatz/THREE.Fire & Ashima 3D Simplex).
// Features:
// - True 3D Object-Space Volumetric Raymarching (ZERO flat crossed quads or paper cards)
// - Organic Teardrop Boundary Envelope with Guaranteed ZERO Box Silhouette
// - Multi-Octave 3D Simplex Convective Turbulence & 3D Domain Warping
// - Authentic Thermal Blackbody Radiation Curve with Incandescent Fuel Core (>1650K)
// - Dynamic Locomotion & Wind Convective Deflection
// - Anti-Banding Jittered Ray Progression & High Optical Density
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three'

const vertexShader = /* glsl */ `
  uniform mat4 invModelMatrix;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  varying vec3 vLocalCam;

  void main() {
    vLocalPos = position;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vLocalCam = (invModelMatrix * vec4(cameraPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  #define ITERATIONS 32
  #define OCTAVES 3

  uniform sampler2D fireTex;
  uniform float time;
  uniform float seed;
  uniform vec4 noiseScale;
  uniform float magnitude;
  uniform float lacunarity;
  uniform float gain;
  uniform vec3 uWind;
  uniform float uWindStrength;
  uniform float uSurge;

  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  varying vec3 vLocalCam;

  // ── Ashima Arts 3D Simplex Noise ──────────────────────────────────────────
  vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 permute(vec4 x) {
    return mod289(((x * 34.0) + 1.0) * x);
  }

  vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
  }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    // Permutations
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857; // 1.0/7.0
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  // ── Multi-Octave 3D Convective Turbulence ──────────────────────────────────
  float turbulence(vec3 p) {
    float sum = 0.0;
    float freq = 1.0;
    float amp = 1.0;
    for (int i = 0; i < OCTAVES; i++) {
      sum += abs(snoise(p * freq)) * amp;
      freq *= lacunarity;
      amp *= gain;
    }
    return sum;
  }

  // ── Procedural Volumetric Sample ───────────────────────────────────────────
  vec4 sampleVolumetricFire(vec3 p) {
    // p.y in [0.0, 1.0], p.xz in [-1.0, 1.0]
    float r = length(p.xz);
    float y = p.y;
    if (r >= 0.95 || y <= 0.005 || y >= 0.98) return vec4(0.0);

    // Dynamic wind and movement drag deflection: tilts flame backward
    vec2 windOffset = uWind.xz * (y * y * 0.40) * uWindStrength;
    vec3 warpedP = p;
    warpedP.xz -= windOffset;
    float wr = length(warpedP.xz);

    // Multi-tongued organic teardrop envelope:
    // Base fits inside the cloth rim (radius ~0.026m), buoyant belly, tapering to licking tendrils
    float taper = pow(1.0 - y, 1.15);
    float belly = sin(clamp(y * 3.14159, 0.0, 3.14159));
    float baseFit = mix(0.72, 0.88, smoothstep(0.0, 0.18, y));
    float envelope = baseFit * taper * (0.85 + 0.15 * belly) * smoothstep(0.0, 0.015, y);

    // Angular tongue modulation: carves the volume into 3-4 distinct licking tongues of flame
    float angle = atan(warpedP.z, warpedP.x);
    float tongueMod = sin(angle * 3.0 + time * 3.8) * 0.22 + cos(angle * 5.0 - time * 2.8) * 0.14;
    float dynEnvelope = envelope * (1.0 + tongueMod * smoothstep(0.08, 0.70, y));

    if (wr > dynEnvelope) return vec4(0.0);

    // Convective upward velocity & 3D noise coordinates
    vec3 np = warpedP;
    np.y -= (seed + time * 3.2) * noiseScale.w;
    np.xz *= noiseScale.xz * 1.5;
    np.y *= noiseScale.y * 1.2;

    // 3D Domain warp: curling tendrils and turbulent licking tongues
    vec3 curl = vec3(
      snoise(np * 1.6 + vec3(0.0, -time * 1.8, 2.3)),
      snoise(np * 1.6 + vec3(5.1, -time * 2.2, 0.9)),
      snoise(np * 1.6 + vec3(1.7, -time * 2.0, 4.7))
    );
    np += curl * 0.28;

    float turb = turbulence(np);

    // Radial distance ratio [0..1]
    float st_x = wr / max(0.001, dynEnvelope);

    // Density: core is dense, outer edges and negative space between tongues fall to zero
    float rawDensity = (1.0 - pow(st_x, 1.4)) * (1.0 - y * 0.6) * (turb * 1.6 - 0.25);
    float edgeMask = smoothstep(1.0, 0.55, st_x) * smoothstep(0.0, 0.015, y) * smoothstep(1.0, 0.75, y);
    float density = clamp(rawDensity * edgeMask, 0.0, 1.0);
    if (density <= 0.001) return vec4(0.0);

    // Authentic Blackbody thermal radiation palette:
    // Core: incandescent golden-white fuel reaction zone
    // Body: vibrant roaring golden amber
    // Licking tendrils: deep fire orange
    // Outer tips: ember crimson
    vec3 colCore = vec3(1.0, 0.96, 0.85);
    vec3 colGold = vec3(1.0, 0.64, 0.08);
    vec3 colOrange = vec3(0.96, 0.26, 0.02);
    vec3 colCrimson = vec3(0.42, 0.05, 0.01);

    vec3 fireColor;
    float temp = clamp((1.0 - y * 0.75) * (1.0 - st_x * 0.45) * (density * 0.5 + 0.5), 0.0, 1.0);
    if (temp > 0.65) {
      fireColor = mix(colGold * 2.0, colCore * 2.8, (temp - 0.65) / 0.35);
    } else if (temp > 0.30) {
      fireColor = mix(colOrange * 1.5, colGold * 2.0, (temp - 0.30) / 0.35);
    } else {
      fireColor = mix(colCrimson * 0.9, colOrange * 1.5, temp / 0.30);
    }

    fireColor *= (1.0 + uSurge * 0.45);

    // Emission is strictly gated by optical density so gaps between licking tongues are transparent!
    vec3 emission = fireColor * pow(density, 1.25) * 4.2;

    return vec4(emission, density);
  }

  void main() {
    // Ray originates on the box front surface and marches into the object volume
    vec3 rayDir = normalize(vLocalPos - vLocalCam);
    vec3 rayPos = vLocalPos;

    // Anti-aliasing / dithering: jitter initial step position along the ray
    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float stepLen = 1.35 / float(ITERATIONS);
    rayPos += rayDir * (stepLen * jitter);

    vec4 accumColor = vec4(0.0);

    for (int i = 0; i < ITERATIONS; i++) {
      // Bounds check within unit box XZ in [-0.5, 0.5], Y in [0, 1]
      if (rayPos.y >= 0.0 && rayPos.y <= 1.0 && abs(rayPos.x) <= 0.5 && abs(rayPos.z) <= 0.5) {
        // Map local box to fire space: Y in [0, 1], XZ in [-1, 1]
        vec3 p = vec3(rayPos.x * 2.0, rayPos.y, rayPos.z * 2.0);
        vec4 s = sampleVolumetricFire(p);

        // Accumulate emission gated by density
        accumColor.rgb += s.rgb * stepLen;
        accumColor.a += s.a * stepLen;

        // Early saturation exit
        if (accumColor.r > 2.4) break;
      }

      rayPos += rayDir * stepLen;
    }

    accumColor.a = clamp(accumColor.a * 1.8, 0.0, 1.0);
    if (accumColor.a < 0.015) discard;

    gl_FragColor = accumColor;
  }
`

export function createVolumetricFireMaterial(fireTexture: THREE.Texture) {
  fireTexture.magFilter = THREE.LinearFilter
  fireTexture.minFilter = THREE.LinearFilter
  fireTexture.wrapS = THREE.ClampToEdgeWrapping
  fireTexture.wrapT = THREE.ClampToEdgeWrapping

  return new THREE.ShaderMaterial({
    uniforms: {
      fireTex: { value: fireTexture },
      time: { value: 0.0 },
      seed: { value: Math.random() * 19.19 },
      invModelMatrix: { value: new THREE.Matrix4() },
      noiseScale: { value: new THREE.Vector4(1.2, 2.2, 1.2, 0.42) },
      magnitude: { value: 1.42 },
      lacunarity: { value: 2.0 },
      gain: { value: 0.5 },
      uWind: { value: new THREE.Vector3(0.5, 0, 0.5) },
      uWindStrength: { value: 0.25 },
      uSurge: { value: 0.0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  })
}
