export const MAP_CONFIG_STORAGE_KEY = 'webrpg-map-config';

export function normalizeMapConfig(config, fallback = null) {
  if (!config || typeof config !== 'object') return fallback && typeof fallback === 'object' ? { ...fallback } : null;

  const next = {
    ...(fallback && typeof fallback === 'object' ? fallback : {}),
    ...config,
    scene: {
      ...(fallback?.scene ?? {}),
      ...(config.scene ?? {}),
    },
    terrain: Object.prototype.hasOwnProperty.call(config, 'terrain') ? config.terrain : (fallback?.terrain ?? null),
    lighting: {
      ...(fallback?.lighting ?? {}),
      ...(config.lighting ?? {}),
    },
    player: {
      ...(fallback?.player ?? {}),
      ...(config.player ?? {}),
    },
    sounds: {
      ...(fallback?.sounds ?? {}),
      ...(config.sounds ?? {}),
    },
    assets: Array.isArray(config.assets) ? config.assets : (Array.isArray(fallback?.assets) ? fallback.assets : []),
    entities: Array.isArray(config.entities) ? config.entities : (Array.isArray(fallback?.entities) ? fallback.entities : []),
    enemyTypes: Array.isArray(config.enemyTypes) ? config.enemyTypes : (Array.isArray(fallback?.enemyTypes) ? fallback.enemyTypes : []),
    enemyAreas: Array.isArray(config.enemyAreas) ? config.enemyAreas : (Array.isArray(fallback?.enemyAreas) ? fallback.enemyAreas : []),
  };

  if (next.lighting?.directional) {
    next.lighting.directional = {
      ...(fallback?.lighting?.directional ?? {}),
      ...(config.lighting?.directional ?? {}),
    };
  }

  return next;
}

export function readSavedMapConfig(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(MAP_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw);
    return config && typeof config === 'object' ? normalizeMapConfig(config) : null;
  } catch {
    return null;
  }
}

export function saveMapConfig(config, storage = globalThis.localStorage) {
  storage?.setItem(MAP_CONFIG_STORAGE_KEY, JSON.stringify(config));
}
