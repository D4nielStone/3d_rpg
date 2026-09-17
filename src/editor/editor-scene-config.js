import {
  defaultFog,
  defaultLighting,
  defaultSkyColor,
  defaultSounds,
  defaultTerrainConfig,
} from './editor-scene-state.js';

export function buildDefaultWorldConfig() {
  return {
    format: 'webrpg.world',
    version: 2,
    scene: {
      name: 'main-world',
      units: 'world',
      skyColor: [...defaultSkyColor],
      fog: {
        color: [...defaultFog.color],
        near: defaultFog.near,
        far: defaultFog.far,
      },
    },
    terrain: {
      ...defaultTerrainConfig,
      heights: Array.from({ length: 65 * 65 }, () => 0),
    },
    lighting: {
      ...defaultLighting,
      ambientColor: [...defaultLighting.ambientColor],
      directional: {
        ...defaultLighting.directional,
        direction: [...defaultLighting.directional.direction],
        color: [...defaultLighting.directional.color],
      },
      point: {
        ...defaultLighting.point,
        position: [...defaultLighting.point.position],
        color: [...defaultLighting.point.color],
      },
    },
    sounds: { ...defaultSounds },
    player: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      status: { level: 1, hp: 20, maxHp: 20, mana: 20, xp: 0, strength: 1, accuracy: 1, magic: 1, money: 0 },
      inventory: [],
      collision: { enabled: false, shape: 'model', bodyType: 'characterBody', offset: [0, 0, 0], scale: [1, 1, 1], friction: 0.3, restitution: 0 },
      animation: { name: '', loop: true, speed: 1 },
    },
    assets: [],
    entities: [],
    enemyTypes: [],
    enemyAreas: [],
  };
}

export function resolveWorldConfig(config, fallbackConfig = buildDefaultWorldConfig()) {
  if (!config || typeof config !== 'object') return fallbackConfig;
  if (config.entities || config.terrain || config.assets || config.enemyAreas) return config;
  return fallbackConfig;
}
