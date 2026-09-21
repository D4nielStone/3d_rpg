import * as THREE from 'three';
import vertexShader from './water.vert.glsl?raw';
import fragmentShader from './water.frag.glsl?raw';

let configuredShaderFiles = [];

export function configureWaterShaderSources(files) {
  configuredShaderFiles = Array.isArray(files) ? files : [];
}

function shaderSource(path, fallback) {
  return configuredShaderFiles.find((file) => file.path === path)?.source ?? fallback;
}

export function isWaterEntity(entity) {
  return Array.isArray(entity?.tags) && entity.tags.some((tag) => String(tag).trim().toLowerCase() === 'water');
}

export function createWaterMaterial({
  color = [0.08, 0.45, 0.72],
  level = 0,
  map = null,
  depthTexture = null,
  screenResolution = [1, 1],
  shallowColor = [0.22, 0.66, 1.0],
  deepColor = [0.0, 0.25, 0.45],
  depthFadeDistance = 1,
  absorbance = 2,
  foamAmount = 0.2,
  foamColor = [1, 1, 1],
  roughness = 0.05,
  waveScale = 4,
  heightScale = 0.15,
  waveSpeed = 0.015,
  opacity = 0.78,
} = {}) {
  const material = new THREE.ShaderMaterial({
    vertexShader: shaderSource('src/shaders/water.vert.glsl', vertexShader),
    fragmentShader: shaderSource('src/shaders/water.frag.glsl', fragmentShader),
    uniforms: {
      uDepthTexture: { value: depthTexture },
      uHasDepthTexture: { value: Boolean(depthTexture) },
      uScreenResolution: { value: new THREE.Vector2(...screenResolution) },
      uDepthFadeDistance: { value: Number(depthFadeDistance) || 1 },
      uAbsorbance: { value: Number(absorbance) || 2 },
      uShallowColor: { value: new THREE.Color(...shallowColor) },
      uDeepColor: { value: new THREE.Color(...deepColor) },
      uFoamAmount: { value: Number(foamAmount) || 0.2 },
      u_foamColor: { value: new THREE.Color(...foamColor) },
      u_waterColor: { value: new THREE.Color(...color) },
      uRoughness: { value: Number(roughness) || 0.05 },
      uTime: { value: 0 },
      uWaveScale: { value: Number(waveScale) || 4 },
      uHeightScale: { value: Number(heightScale) || 0.15 },
      uWaveSpeed: { value: Number(waveSpeed) || 0.015 },
      uCameraNear: { value: 0.1 },
      uCameraFar: { value: 1000 },
      uWaterLevel: { value: Number(level) || 0 },
      uOpacity: { value: Math.min(1, Math.max(0, Number(opacity) || 0.78)) },
      uMap: { value: map },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  material.userData.waterShader = true;
  return material;
}

export function refreshWaterMaterial(material) {
  if (!material?.userData?.waterShader) return;
  material.vertexShader = shaderSource('src/shaders/water.vert.glsl', vertexShader);
  material.fragmentShader = shaderSource('src/shaders/water.frag.glsl', fragmentShader);
  material.needsUpdate = true;
}

export function updateWaterMaterial(material, time) {
  if (material?.uniforms?.uTime) material.uniforms.uTime.value = Number(time) || 0;
}

export function updateWaterMaterialUniforms(material, { depthTexture, width, resolution, foamColor, waterColor } = {}) {
  if (!material?.userData?.waterShader) return;
  const uniforms = material.uniforms;
  if (uniforms.uDepthTexture && depthTexture !== undefined) uniforms.uDepthTexture.value = depthTexture;
  if (uniforms.uHasDepthTexture && depthTexture !== undefined) uniforms.uHasDepthTexture.value = Boolean(depthTexture);
  if (uniforms.u_foamWidth && width !== undefined) uniforms.u_foamWidth.value = Number(width) || 0;
  if (uniforms.uScreenResolution && resolution) uniforms.uScreenResolution.value.set(Number(resolution[0]) || 1, Number(resolution[1]) || 1);
  if (uniforms.u_foamColor && foamColor) uniforms.u_foamColor.value.setRGB(...foamColor);
  if (uniforms.u_waterColor && waterColor) uniforms.u_waterColor.value.setRGB(...waterColor);
}
