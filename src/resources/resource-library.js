import { createMaterialResource } from './material-resource.js';
import { builtinShaderResources, createShaderResource } from './shader-resource.js';

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
  return value;
}

function materialFromLegacyDefinition(definition = {}, id) {
  const shaderId = definition.shaderId
    ?? (definition.shader === 'Water' ? 'builtin/water' : definition.shader === 'Custom' ? 'shader:custom' : 'builtin/standard');
  return createMaterialResource({
    ...definition,
    id,
    shaderId,
    parameters: {
      ...(definition.parameters ?? {}),
      diffuseColor: definition.diffuseColor ?? definition.parameters?.diffuseColor,
      metallic: definition.metallic,
      roughness: definition.roughness,
      opacity: definition.opacity,
      texture: definition.texture,
    },
  });
}

function legacyMaterialFile(shader) {
  if (!shader?.path?.toLowerCase().endsWith('.mat')) return null;
  try {
    const definition = JSON.parse(shader.source ?? '{}');
    return definition && typeof definition === 'object' ? definition : null;
  } catch {
    return null;
  }
}

export function migrateWorldResources(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  const resourceConfig = source.resources ?? {};
  const shaderInputs = Array.isArray(resourceConfig.shaders) ? resourceConfig.shaders : (source.shaders ?? []);
  const shaders = [...builtinShaderResources()];
  const shaderIds = new Set(shaders.map((shader) => shader.id));
  for (const input of shaderInputs) {
    const shader = createShaderResource(input);
    if (!shader.id || shaderIds.has(shader.id)) continue;
    shaders.push(shader);
    shaderIds.add(shader.id);
  }

  const materials = [];
  const materialIds = new Set();
  const addMaterial = (material) => {
    if (!material?.id || materialIds.has(material.id)) return;
    materials.push(material);
    materialIds.add(material.id);
  };
  const configuredMaterials = Array.isArray(resourceConfig.materials) ? resourceConfig.materials : (source.materials ?? []);
  configuredMaterials.forEach((input) => addMaterial(createMaterialResource(input)));

  for (const shaderInput of shaderInputs) {
    const definition = legacyMaterialFile(shaderInput);
    if (!definition) continue;
    addMaterial(materialFromLegacyDefinition(definition, `material:${shaderInput.path}`));
  }

  const entities = (source.entities ?? []).map((entity) => ({
    ...entity,
    materials: (entity.materials ?? []).map((input, index) => {
      const legacyFile = entity.shader?.file?.toLowerCase().endsWith('.mat') ? entity.shader.file : null;
      const materialId = input.materialId ?? (legacyFile ? `material:${legacyFile}` : `material:${entity.id ?? 'entity'}:${index}`);
      if (!materialIds.has(materialId)) addMaterial(materialFromLegacyDefinition(input, materialId));
      return { ...input, materialId };
    }),
  }));

  return {
    ...source,
    version: Math.max(3, Number(source.version) || 0),
    resources: {
      shaders: shaders.map(cloneValue),
      materials: materials.map(cloneValue),
    },
    entities,
  };
}

export function shaderResources(config) {
  return migrateWorldResources(config).resources.shaders;
}

export function materialResources(config) {
  return migrateWorldResources(config).resources.materials;
}

export function findMaterialResource(materials, materialId) {
  return (materials ?? []).find((material) => material.id === materialId) ?? null;
}
