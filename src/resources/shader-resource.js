export const BUILTIN_STANDARD_SHADER_ID = 'builtin/standard';
export const BUILTIN_WATER_SHADER_ID = 'builtin/water';

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
  return value;
}

export function createShaderResource(input = {}) {
  const path = String(input.path ?? '').trim();
  const source = typeof input.source === 'string' ? input.source : '';
  return {
    type: 'Shader',
    id: String(input.id ?? (path ? `shader:${path}` : '')).trim(),
    name: String(input.name ?? path.split('/').pop() ?? 'Shader'),
    path: path || null,
    source,
    vertexSource: input.vertexSource ?? null,
    fragmentSource: input.fragmentSource ?? null,
    pipeline: input.pipeline ?? 'three-shader-material',
    language: input.language ?? 'glsl',
    parameters: Array.isArray(input.parameters) ? cloneValue(input.parameters) : [],
    dependencies: Array.isArray(input.dependencies) ? [...input.dependencies] : [],
    properties: cloneValue(input.properties ?? {}),
    tag: input.tag ?? '',
    compile: {
      status: input.compile?.status ?? 'unknown',
      errors: [...(input.compile?.errors ?? [])],
      warnings: [...(input.compile?.warnings ?? [])],
      hash: input.compile?.hash ?? null,
      version: Number(input.compile?.version ?? 1) || 1,
    },
  };
}

export function builtinShaderResources() {
  return [
    createShaderResource({ id: BUILTIN_STANDARD_SHADER_ID, name: 'Standard', pipeline: 'three-standard-material', language: 'builtin' }),
    createShaderResource({ id: BUILTIN_WATER_SHADER_ID, name: 'Water', pipeline: 'three-shader-material', language: 'builtin' }),
  ];
}
