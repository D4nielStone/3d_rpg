import { BUILTIN_STANDARD_SHADER_ID } from './shader-resource.js';

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
  return value;
}

export function createMaterialResource(input = {}) {
  const parameters = {
    diffuseColor: [1, 1, 1],
    metallic: 0,
    roughness: 0.7,
    opacity: 1,
    ...(input.parameters ?? {}),
  };
  if (Array.isArray(input.diffuseColor)) parameters.diffuseColor = [...input.diffuseColor];
  for (const field of ['metallic', 'roughness', 'opacity', 'surface', 'texture']) {
    if (input[field] !== undefined) parameters[field] = cloneValue(input[field]);
  }
  return {
    type: 'Material',
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? 'Material'),
    shaderId: String(input.shaderId ?? (input.shader === 'Water' ? 'builtin/water' : BUILTIN_STANDARD_SHADER_ID)),
    parameters: cloneValue(parameters),
    state: {
      surface: input.state?.surface ?? input.surface ?? 'Opaque',
      transparent: input.state?.transparent ?? input.surface === 'Transparent',
      depthWrite: input.state?.depthWrite ?? input.surface !== 'Transparent',
      ...(input.state ?? {}),
    },
  };
}
