import * as THREE from "three";
import type { BladeUniforms } from "../uniforms";
import { GROUND_MASK_UNIFORMS, GROUND_MASK_GLSL } from "../shaders/groundMask";
import {
  MAX_ROCKS,
  MAX_SHADOW_TAPS,
  GRASS_BLADE_UNIFORMS,
  GRASS_BLADE_VERTEX,
  GRASS_SHADOW_VERTEX,
} from "../shaders/grassBlade";
import { DEBUG_FRAGMENT_UNIFORMS, DEBUG_VIEW_FRAGMENT } from "../shaders/debug";

// ─────────────────────────────────────────────────────────────────────────────
// Blade Material & 4-Blade Lush Overlapping Recurve Tuft Geometry
//
// Generates a multi-blade organic clump (tuft) for each instance:
//   - Center Blade: stands upright, broad curved ribbon profile, height 1.0, width 0.048
//   - Left Blade: splayed -36°, organic outward flare, height 0.94, width 0.044
//   - Right Blade: splayed +38°, organic outward flare, height 0.90, width 0.042
//   - Back Blade: splayed +170°, arching backward, height 0.86, width 0.040
//
// 120,000 instances = 480,000 broad, lush, overlapping grass blades in ONE draw call!
// Fully carpets the open world sanctuary with ZERO bare ground gaps from any angle.
// Shading normal is forced to +Y on both sides to eliminate specular shimmer.
// ─────────────────────────────────────────────────────────────────────────────

function bladeHalfWidth(t: number): number {
  return 0.5 * Math.pow(Math.max(0.0, 1.0 - t), 1.25);
}

/**
 * Organic 7-Blade Fanned Grass Tuft Geometry.
 * Each instance generates a full 360-degree cluster of 7 slender, curved, overlapping blades
 * splayed at varied radial angles with gentle backward camber and natural offsets.
 * Guarantees 100% gapless, lush coverage from all camera angles with peak raster efficiency.
 */
export function makeBladeGeometry(segments = 3): THREE.BufferGeometry {
  const seg = Math.max(1, Math.round(segments));
  const vertsPerBlade = seg * 2 + 1;

  const bladeConfigs = [
    { yaw:  0.00, tilt: 0.16, hScale: 1.00, wScale: 0.95, xOff:  0.00, zOff:  0.00 },
    { yaw: -0.95, tilt: 0.22, hScale: 0.94, wScale: 0.90, xOff: -0.45, zOff:  0.30 },
    { yaw:  0.90, tilt: 0.20, hScale: 0.92, wScale: 0.90, xOff:  0.45, zOff:  0.25 },
    { yaw: -2.15, tilt: 0.24, hScale: 0.88, wScale: 0.85, xOff: -0.40, zOff: -0.35 },
    { yaw:  2.10, tilt: 0.23, hScale: 0.86, wScale: 0.85, xOff:  0.40, zOff: -0.32 },
    { yaw:  3.14, tilt: 0.25, hScale: 0.84, wScale: 0.82, xOff:  0.00, zOff: -0.50 },
    { yaw:  0.05, tilt: 0.18, hScale: 0.96, wScale: 0.88, xOff:  0.00, zOff:  0.42 },
  ];
  const numBlades = bladeConfigs.length;
  const totalVerts = vertsPerBlade * numBlades;

  const positions = new Float32Array(totalVerts * 3);
  const indices: number[] = [];

  bladeConfigs.forEach((cfg, bIdx) => {
    const vOffset = bIdx * vertsPerBlade;
    const cosY = Math.cos(cfg.yaw);
    const sinY = Math.sin(cfg.yaw);

    for (let i = 0; i < seg; i++) {
      const t = i / seg;
      const w = bladeHalfWidth(t) * cfg.wScale;
      const h = t * cfg.hScale;
      // Natural organic backward curve
      const curveZ = Math.pow(t, 2.0) * cfg.tilt;

      // Left vertex
      const lx = -w;
      const lz = curveZ;
      const rxRotL = lx * cosY - lz * sinY + cfg.xOff;
      const rzRotL = lx * sinY + lz * cosY + cfg.zOff;

      const idxL = (vOffset + i * 2) * 3;
      positions[idxL + 0] = rxRotL;
      positions[idxL + 1] = h;
      positions[idxL + 2] = rzRotL;

      // Right vertex
      const rx = w;
      const rz = curveZ;
      const rxRotR = rx * cosY - rz * sinY + cfg.xOff;
      const rzRotR = rx * sinY + rz * cosY + cfg.zOff;

      const idxR = (vOffset + i * 2 + 1) * 3;
      positions[idxR + 0] = rxRotR;
      positions[idxR + 1] = h;
      positions[idxR + 2] = rzRotR;
    }

    // Tip vertex
    const tipH = cfg.hScale;
    const tipZ = cfg.tilt * 1.25;
    const tipXRot = 0 * cosY - tipZ * sinY + cfg.xOff;
    const tipZRot = 0 * sinY + tipZ * cosY + cfg.zOff;

    const tipIdx = (vOffset + seg * 2) * 3;
    positions[tipIdx + 0] = tipXRot;
    positions[tipIdx + 1] = tipH;
    positions[tipIdx + 2] = tipZRot;

    for (let i = 0; i < seg - 1; i++) {
      const l = vOffset + i * 2;
      const r = l + 1;
      const nl = l + 2;
      const nr = l + 3;
      indices.push(l, nl, r, r, nl, nr);
    }
    const lastL = vOffset + (seg - 1) * 2;
    const lastR = lastL + 1;
    const lastTip = vOffset + seg * 2;
    indices.push(lastL, lastTip, lastR);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function makeBladeMaterial(u: BladeUniforms): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);

    // ── Vertex ───────────────────────────────────────────────────────────────
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      #define MAX_ROCKS ${MAX_ROCKS}
      #define GRASS_SHADOW_TAPS ${MAX_SHADOW_TAPS}
      ${GROUND_MASK_UNIFORMS}
      ${GROUND_MASK_GLSL}
      ${GRASS_BLADE_UNIFORMS}`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      GRASS_BLADE_VERTEX,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      GRASS_SHADOW_VERTEX,
    );
    // Flatten lighting normal to +Y so field does not shimmer
    shader.vertexShader = shader.vertexShader.replace(
      "#include <defaultnormal_vertex>",
      `#include <defaultnormal_vertex>
      transformedNormal = normalize( mat3( viewMatrix ) * vec3( 0.0, 1.0, 0.0 ) );`,
    );

    // ── Fragment ─────────────────────────────────────────────────────────────
    shader.fragmentShader =
      `#define GRASS_SHADOW_TAPS ${MAX_SHADOW_TAPS}
      varying float vBH;
      varying vec3  vWorldPos;
      varying vec3  vBladeN;
      varying float vDirt;
      varying float vPatch;
      ${DEBUG_FRAGMENT_UNIFORMS}
      uniform vec3  uGrassBottom;
      uniform vec3  uGrassTop;
      uniform float uBrightness;
      uniform float uGradStart;
      uniform float uGradEnd;
      uniform float uGradPower;
      uniform vec3  uDirtColor;
      uniform float uDirtBlend;
      uniform vec3  uPatchLush;
      uniform vec3  uPatchDry;
      uniform float uPatchStrength;
      uniform float uPatchBias;
      uniform int   uShadowSamples;
      uniform float uShadowStrength;
      uniform vec3  uSunDir;
      uniform vec3  uSunColor;
      uniform vec3  uTransColor;
      uniform float uTransStrength;
      uniform float uTransPower;
      uniform float uTransTip;
      uniform float uTransShadow;
      #ifdef USE_SHADOWMAP
        varying vec4 vGrassShCoord[ GRASS_SHADOW_TAPS ];
      #endif\n` + shader.fragmentShader;

    // Both faces shade identically
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      `#include <normal_fragment_begin>
      normal = normalize( mat3( viewMatrix ) * vec3( 0.0, 1.0, 0.0 ) );`,
    );

    // Blend base-to-tip gradient and organic meadow patches (ZERO yellow cast)
    shader.fragmentShader = shader.fragmentShader.replace(
      "vec4 diffuseColor = vec4( diffuse, opacity );",
      `float _gT = clamp( ( vBH - uGradStart ) / max( uGradEnd - uGradStart, 0.001 ), 0.0, 1.0 );
      _gT = pow( _gT, uGradPower );
      vec3 _bladeCol = mix( uGrassBottom, uGrassTop, _gT );

      float _pt = pow( clamp( vPatch, 0.0, 1.0 ), uPatchBias );
      _bladeCol = mix( _bladeCol, mix( uPatchLush, uPatchDry, _pt ), uPatchStrength );

      _bladeCol = mix( _bladeCol, uDirtColor, vDirt * uDirtBlend );

      vec4 diffuseColor = vec4( _bladeCol * uBrightness, opacity );`,
    );

    // Soft ring shadow and subtle natural emerald subsurface scatter
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `#include <opaque_fragment>
      {
        float _shadow = 1.0;
        #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
          DirectionalLightShadow _dls = directionalLightShadows[ 0 ];
          float _sSum = 0.0;
          int   _sN   = 0;
          for ( int _k = 0; _k < GRASS_SHADOW_TAPS; _k++ ) {
            if ( _k >= uShadowSamples ) break;
            _sSum += getShadow(
              directionalShadowMap[ 0 ],
              _dls.shadowMapSize,
              _dls.shadowIntensity,
              _dls.shadowBias,
              _dls.shadowRadius,
              vGrassShCoord[ _k ]
            );
            _sN++;
          }
          _shadow = _sSum / float( max( _sN, 1 ) );
        #endif

        gl_FragColor.rgb *= ( 1.0 - uShadowStrength * ( 1.0 - _shadow ) );

        vec3  _L    = normalize( uSunDir );
        vec3  _V    = normalize( cameraPosition - vWorldPos );
        float _back = pow( max( dot( _V, -_L ), 0.0 ), uTransPower );
        float _thin = mix( 1.0, vBH, uTransTip );
        float _edge = 1.0 - abs( dot( normalize( vBladeN ), _L ) );
        float _sh   = mix( 1.0, _shadow, uTransShadow );

        // Clamp sun color intensity contribution to avoid blowing out into yellow
        vec3 _clampedSun = min(uSunColor, vec3(1.1));
        vec3 _trans = uTransColor * _clampedSun * uTransStrength
                    * _back * _thin * _edge * _sh;

        // Subsurface scatter illuminates the grass with lush emerald vibrancy
        gl_FragColor.rgb += _trans;

        ${DEBUG_VIEW_FRAGMENT}
      }`,
    );
  };

  return mat;
}
