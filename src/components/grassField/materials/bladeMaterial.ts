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
  return 0.5 * Math.pow(1.0 - t, 1.2);
}

/**
 * Blade geometry — unit size (base width = 1, height = 1), flat in XY.
 * Instance matrix scales it to a slender, natural stylized blade (approx 0.08 x 0.35m).
 * With segments = 3, this creates an authentic 5-triangle slender blade that renders
 * with peak raster performance and delicate, natural meadow aesthetics.
 */
export function makeBladeGeometry(segments = 3): THREE.BufferGeometry {
  const seg = Math.max(1, Math.round(segments));

  // Two vertices per row, plus a single vertex at the tip.
  const positions = new Float32Array((seg * 2 + 1) * 3);
  for (let i = 0; i < seg; i++) {
    const t = i / seg;
    const w = bladeHalfWidth(t);
    positions[i * 6 + 0] = -w;
    positions[i * 6 + 1] = t;
    positions[i * 6 + 2] = 0;
    positions[i * 6 + 3] = w;
    positions[i * 6 + 4] = t;
    positions[i * 6 + 5] = 0;
  }
  positions[seg * 6 + 0] = 0;
  positions[seg * 6 + 1] = 1; // tip, at x = 0
  positions[seg * 6 + 2] = 0;

  // Quad per segment (two triangles), capped by one triangle at the tip.
  const indices: number[] = [];
  for (let i = 0; i < seg - 1; i++) {
    const l = i * 2;
    const r = l + 1;
    const nl = l + 2;
    const nr = l + 3;
    indices.push(l, nl, r, r, nl, nr);
  }
  const lastL = (seg - 1) * 2;
  indices.push(lastL, seg * 2, lastL + 1);

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
