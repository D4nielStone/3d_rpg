uniform float uTime;
uniform float uWaveScale;
uniform float uHeightScale;
uniform float uWaveSpeed;

varying vec3 vWorldPosition;
varying float vViewDepth;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 displaced = position;
  vec2 waveUv = (modelMatrix * vec4(position, 1.0)).xz / max(uWaveScale, 0.001);
  float wave = sin(waveUv.x * 6.28318 + uTime * uWaveSpeed * 8.0);
  wave += sin(waveUv.y * 9.42477 - uTime * uWaveSpeed * 6.0) * 0.55;
  displaced.y += wave * uHeightScale * 0.22;

  vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
  vWorldPosition = worldPosition.xyz;
  vec4 viewPosition = viewMatrix * worldPosition;
  vViewDepth = -viewPosition.z;
  gl_Position = projectionMatrix * viewPosition;
}
