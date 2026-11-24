import * as THREE from 'three'
import type { RockUniforms } from '../uniforms'

// ─────────────────────────────────────────────────────────────────────────────
// Rock Material — Physically Harmonized Stylized Stone & Monolith Material
// Features:
// - Seamless day/night atmospheric tinting and brightness tracking
// - Eliminates night-time "glowing white beacon" artifact
// - Dynamic torch firelight illumination on boulder faces
// - Directional shadow reception and PBR roughness/metalness
// ─────────────────────────────────────────────────────────────────────────────

export function makeRockMaterial(
  rockTexture: THREE.Texture | null,
  u: RockUniforms
): THREE.MeshStandardMaterial {
  if (rockTexture) {
    rockTexture.colorSpace = THREE.SRGBColorSpace
  }

  const mat = new THREE.MeshStandardMaterial({
    map: rockTexture,
    roughness: 0.90,
    metalness: 0.04,
    side: THREE.FrontSide,
  })

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)

    shader.vertexShader =
      `varying vec3 vRockWorld;\n` + shader.vertexShader

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vRockWorld = ( modelMatrix * vec4( position, 1.0 ) ).xyz;`
    )

    shader.fragmentShader =
      `varying vec3 vRockWorld;
      uniform vec3  uRockColor;
      uniform float uRockBrightness;
      uniform vec3  uTorchPos;
      uniform vec3  uTorchColor;
      uniform vec4  uTorchParams;\n` + shader.fragmentShader

    // Harmonize rock diffuse color with day/night atmospheric tint and brightness
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      #ifdef USE_MAP
        // Desaturate slightly and blend with atmospheric stone tone
        float _rLuma = dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
        diffuseColor.rgb = mix( vec3( _rLuma ), diffuseColor.rgb, 0.65 );
        diffuseColor.rgb = diffuseColor.rgb * uRockColor * uRockBrightness;
      #else
        diffuseColor.rgb = uRockColor * uRockBrightness;
      #endif`
    )

    // Dynamic torch firelight illumination on rocks
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
      if ( uTorchParams.z > 0.01 ) {
        vec3  _toT = uTorchPos - vRockWorld;
        float _tDist = length( _toT );
        if ( _tDist < uTorchParams.x ) {
          float _tAtten = clamp( 1.0 - _tDist / uTorchParams.x, 0.0, 1.0 );
          _tAtten = pow( _tAtten, 1.35 );
          vec3  _tDir = _toT / max( _tDist, 0.001 );
          float _tWrap = max( dot( normal, _tDir ) * 0.6 + 0.4, 0.0 );
          vec3  _tLight = uTorchColor * ( _tWrap * 0.8 + 0.2 ) * ( _tAtten * uTorchParams.y * ( 1.0 + uTorchParams.w ) );
          // Reflect against stone surface with guaranteed luminous headroom so firelight shines bright & vibrant on rocks
          gl_FragColor.rgb += ( max( diffuseColor.rgb, vec3( 0.22 ) ) * 1.6 + vec3( 0.06 ) ) * _tLight * 1.5;
        }
      }`
    )
  }

  return mat
}
