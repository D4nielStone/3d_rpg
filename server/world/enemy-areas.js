import { EnemyArea } from '../enemy-area.js';
import { createEnemyTypeMap } from './enemy-types.js';

export const MIN_LEVEL_FOR_HIGHER_AREA = 3;

export const DEFAULT_ENEMY_AREAS = Object.freeze([
  {
    id: 'starting-rat-area',
    center: [0, 0, 0],
    width: 20,
    depth: 20,
    maxEnemies: 5,
    enemyType: 'rat',
    areaLevel: 1,
    spawnIntervalMs: 3000,
  },
]);

export function createEnemyAreas(config = null) {
  const definitions = Array.isArray(config?.enemyAreas)
    ? config.enemyAreas
    : DEFAULT_ENEMY_AREAS;
  const enemyTypes = createEnemyTypeMap(config);
  const defaultEnemyType = enemyTypes.keys().next().value ?? 'rat';
  return definitions.map((area, index) => new EnemyArea({
    id: area.id ?? (index === 0 ? 'starting-rat-area' : `map-area-${index + 1}`),
    center: area.center,
    width: area.width,
    depth: area.depth,
    maxEnemies: area.maxEnemies ?? 5,
    enemyType: enemyTypes.has(area.enemyType) ? area.enemyType : defaultEnemyType,
    areaLevel: area.areaLevel ?? Math.min(index + 1, 2),
    spawnIntervalMs: area.spawnIntervalMs ?? 3000,
    enemyDefinitions: enemyTypes,
  }));
}

export function isValidMapConfig(config) {
  if (!config || typeof config !== 'object') return false;
  const enemyAreasValid = config.enemyAreas === undefined
    || (Array.isArray(config.enemyAreas) && config.enemyAreas.every((area) => area && typeof area === 'object'
      && Array.isArray(area.center)
      && area.center.length === 3
      && area.center.every((value) => Number.isFinite(value))
      && Number.isFinite(area.width) && area.width > 0
      && Number.isFinite(area.depth) && area.depth > 0));
  const waterValid = config.water === undefined
    || (config.water && typeof config.water.enabled === 'boolean');
  const enemyTypesValid = config.enemyTypes === undefined
    || (Array.isArray(config.enemyTypes) && config.enemyTypes.every((type) => type && typeof type === 'object'
      && typeof type.id === 'string' && type.id.trim()
      && typeof type.name === 'string' && type.name.trim()
      && typeof type.model === 'string'
      && Number.isFinite(Number(type.maxHp)) && Number(type.maxHp) > 0
      && Number.isFinite(Number(type.speed)) && Number(type.speed) >= 0
      && Number.isFinite(Number(type.defense)) && Number(type.defense) >= 0
      && Number.isFinite(Number(type.gold?.min)) && Number.isFinite(Number(type.gold?.max))
      && Number(type.gold.min) >= 0 && Number(type.gold.max) >= Number(type.gold.min)
      && (!type.itemDrops || Array.isArray(type.itemDrops))));
  return Array.isArray(config.assets)
    && Array.isArray(config.entities)
    && enemyAreasValid
    && enemyTypesValid
    && waterValid;
}

export function isWaterPosition(position, mapConfig) {
  const water = mapConfig?.water;
  if (!water?.enabled) return false;
  const size = Number(water.size) || 50;
  return Math.abs(position[0]) <= size / 2 && Math.abs(position[2]) <= size / 2;
}