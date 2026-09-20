import { normalizeColor, normalizeVector } from './editor-utils.js';

export const defaultLighting = {
  ambientColor: [1, 1, 1],
  ambientIntensity: 1,
  directional: {
    direction: [-0.45, 0.85, 0.35],
    color: [1, 0.95, 0.85],
    intensity: 0.8,
    castShadow: true,
    enabled: true,
  },
  point: {
    position: [0, 8, 0],
    color: [1, 0.72, 0.45],
    intensity: 2,
    distance: 18,
  },
};

export const defaultSkyColor = [0.039, 0.051, 0.047];
export const defaultFog = { color: [0.63, 0.69, 0.68], near: 180, far: 850 };
export const defaultSounds = { slash: '', pulse: '', arc: '', 'level-up': '' };

export function normalizeSounds(value = {}) {
  return ['slash', 'pulse', 'arc', 'level-up'].reduce((result, name) => ({
    ...result,
    [name]: typeof value?.[name] === 'string' ? value[name] : '',
  }), {});
}

export function normalizeEnemyArea(area) {
  const normalized = area ?? {};
  normalized.center = normalizeVector(normalized.center, [0, 0, 0]);
  normalized.width = Math.max(0.1, Number(normalized.width) || 25);
  normalized.depth = Math.max(0.1, Number(normalized.depth) || 25);
  normalized.maxEnemies = Math.max(0, Number(normalized.maxEnemies ?? 5) || 0);
  normalized.enemyType = String(normalized.enemyType || 'rat');
  normalized.areaLevel = Math.max(1, Number(normalized.areaLevel ?? 1) || 1);
  normalized.spawnIntervalMs = Math.max(0, Number(normalized.spawnIntervalMs ?? 3000) || 0);
  return normalized;
}

export function normalizeEnemyType(type, index = 0) {
  const normalized = type ?? {};
  normalized.id = String(normalized.id || `enemy-${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') || `enemy-${index + 1}`;
  normalized.name = String(normalized.name || normalized.id);
  normalized.model = String(normalized.model || '');
  normalized.modelFormat = String(normalized.modelFormat || '').toLowerCase();
  normalized.level = Math.max(1, Math.floor(Number(normalized.level) || 1));
  normalized.maxHp = Math.max(1, Number(normalized.maxHp) || 1);
  normalized.speed = Math.max(0, Number(normalized.speed) || 0);
  normalized.defense = Math.max(0, Number(normalized.defense) || 0);
  normalized.damage = Math.max(0, Number(normalized.damage) || 0);
  normalized.experience = Math.max(0, Number(normalized.experience) || 0);
  normalized.scale = Math.max(0.01, Number(normalized.scale) || 1);
  normalized.gold = {
    min: Math.max(0, Math.floor(Number(normalized.gold?.min) || 0)),
    max: Math.max(0, Math.floor(Number(normalized.gold?.max) || 0)),
  };
  normalized.gold.max = Math.max(normalized.gold.min, normalized.gold.max);
  normalized.itemDrops = Array.isArray(normalized.itemDrops) ? normalized.itemDrops : [];
  return normalized;
}

export function normalizeLighting(value = {}) {
  const normalizeLight = (light, defaults, maxIntensity) => {
    const normalized = {
      ...defaults,
      ...light,
      color: normalizeColor(light?.color, defaults.color),
      intensity: Math.min(maxIntensity, Math.max(0, Number(light?.intensity ?? defaults.intensity) || 0)),
    };
    if (defaults.direction) normalized.direction = normalizeVector(light?.direction, defaults.direction);
    if (defaults.position) normalized.position = normalizeVector(light?.position, defaults.position);
    if (defaults.distance) normalized.distance = Math.min(200, Math.max(0.1, Number(light?.distance ?? defaults.distance) || defaults.distance));
    return normalized;
  };

  return {
    ambientColor: normalizeVector(value.ambientColor, [1, 1, 1]).map((channel) => Math.min(1, Math.max(0, channel))),
    ambientIntensity: Math.min(1.2, Math.max(0, Number(value.ambientIntensity ?? 1) || 0)),
    directional: {
      ...normalizeLight(value.directional, {
        direction: [-0.45, 0.85, 0.35],
        color: [1, 0.95, 0.85],
        intensity: 0.8,
        enabled: true,
      }, 1.5),
      castShadow: value.directional?.castShadow !== false,
      enabled: value.directional?.enabled !== false,
    },
    point: normalizeLight(value.point, {
      position: [0, 8, 0],
      color: [1, 0.72, 0.45],
      intensity: 2,
      distance: 18,
    }, 10),
  };
}

export function normalizeSkyColor(value) {
  return normalizeVector(value, defaultSkyColor).map((channel) => Math.min(1, Math.max(0, channel)));
}

export function normalizeFog(value = {}) {
  return {
    color: normalizeColor(value.color, defaultFog.color),
    near: Math.max(0, Number(value.near ?? defaultFog.near) || 0),
    far: Math.max(Number(value.far ?? defaultFog.far) || defaultFog.far, Number(value.near ?? defaultFog.near) + 1),
  };
}

export function normalizePointLight(entity) {
  entity.light = {
    color: normalizeColor(entity.light?.color, [1, 0.72, 0.45]),
    intensity: Math.min(10, Math.max(0, Number(entity.light?.intensity ?? 2) || 0)),
    distance: Math.min(200, Math.max(0.1, Number(entity.light?.distance ?? 18) || 18)),
  };
  return entity;
}
