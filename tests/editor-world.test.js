import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorldController } from '../src/editor/editor-world.js';

function createDocumentStub() {
  return {
    querySelector() {
      return {
        textContent: '',
        value: '',
        hidden: false,
        classList: { toggle() {}, contains() { return false; } },
        setAttribute() {},
        addEventListener() {},
        append() {},
        replaceChildren() {},
      };
    },
    createElement() {
      return {
        style: {},
        setAttribute() {},
        append() {},
        click() {},
      };
    },
  };
}

test('loadWorld reaplica skyColor, fog e lighting do mundo carregado no estado do editor', async () => {
  globalThis.document = createDocumentStub();

  let terrainConfig = { width: 64, depth: 64, segments: 32, amplitude: 0.1, frequency: 0.2, color: '#111111', brushRadius: 3, brushStrength: 0.8 };
  let terrainRemoved = false;
  let lighting = { ambientColor: [1, 1, 1], ambientIntensity: 0.5, directional: { direction: [-0.45, 0.85, 0.35], color: [1, 1, 1], intensity: 0.8, castShadow: true, enabled: true }, point: { position: [0, 4, 0], color: [1, 1, 1], intensity: 2, distance: 18 } };
  let skyColor = [0.1, 0.2, 0.3];
  let fog = { color: [0.2, 0.3, 0.4], near: 10, far: 50 };
  let sounds = { slash: '' };
  let player = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], status: { maxHp: 20, hp: 20 }, inventory: [], collision: {}, animation: {} };
  let assets = [];
  let entities = [];
  let enemyTypes = [];
  let enemyAreas = [];
  let selectedEntityId = null;
  let selectedEnemyAreaId = null;
  const ground = {
    geometry: { attributes: { position: { array: new Float32Array([0, 0, 0, 1, 0, 1, 0, 0, 2]) } } },
    material: { color: { set() {} } },
    visible: true,
    userData: {},
  };
  const entityGroup = { clear() {} };

  const controller = createWorldController({
    terrainConfig: () => terrainConfig,
    terrainRemoved: () => terrainRemoved,
    lighting: () => lighting,
    skyColor: () => skyColor,
    fog: () => fog,
    sounds: () => sounds,
    player: () => player,
    assets: () => assets,
    entities: () => entities,
    enemyTypes: () => enemyTypes,
    enemyAreas: () => enemyAreas,
    ground: () => ground,
    entityGroup: () => entityGroup,
    httpUrl: () => 'http://localhost',
    updateSceneAtmosphere: () => {},
    updateLightingInspector: () => {},
    setStatus: () => {},
    addEntity: () => {},
    instantiateAsset: async () => {},
    refreshPlayerPreview: async () => {},
    selectEntity: (id) => { selectedEntityId = id; },
    createPrimitiveObject: () => null,
  }, {
    terrainConfig: (value) => { terrainConfig = value; },
    terrainRemoved: (value) => { terrainRemoved = Boolean(value); },
    lighting: (value) => { lighting = value; },
    skyColor: (value) => { skyColor = value; },
    fog: (value) => { fog = value; },
    sounds: (value) => { sounds = value; },
    player: (value) => { player = value; },
    assets: (value) => { assets = value; },
    entities: (value) => { entities = value; },
    enemyTypes: (value) => { enemyTypes = value; },
    enemyAreas: (value) => { enemyAreas = value; },
    selectedEntityId: (value) => { selectedEntityId = value; },
    selectedEnemyAreaId: (value) => { selectedEnemyAreaId = value; },
  });

  await controller.loadWorld({
    scene: {
      skyColor: [0.11, 0.22, 0.33],
      fog: { color: [0.44, 0.55, 0.66], near: 12, far: 42 },
    },
    lighting: {
      ambientColor: [0.7, 0.8, 0.9],
      ambientIntensity: 0.75,
      directional: {
        direction: [0.1, 0.2, 0.3],
        color: [0.9, 0.8, 0.7],
        intensity: 0.25,
        castShadow: false,
        enabled: false,
      },
      point: {
        position: [1, 2, 3],
        color: [0.5, 0.6, 0.7],
        intensity: 3,
        distance: 20,
      },
    },
    player: {
      position: [1, 2, 3],
      rotation: [0, 1, 2],
      scale: [2, 2, 2],
      status: { hp: 12, maxHp: 30 },
      inventory: ['pocao'],
      collision: { enabled: true },
      animation: { name: 'idle' },
    },
    sounds: { slash: 'som.mp3' },
    assets: [],
    enemyTypes: [],
    enemyAreas: [],
    entities: [],
  });

  assert.deepEqual(skyColor, [0.11, 0.22, 0.33]);
  assert.deepEqual(fog.color, [0.44, 0.55, 0.66]);
  assert.equal(fog.near, 12);
  assert.equal(fog.far, 42);
  assert.deepEqual(lighting.ambientColor, [0.7, 0.8, 0.9]);
  assert.equal(lighting.ambientIntensity, 0.75);
  assert.deepEqual(lighting.directional.direction, [0.1, 0.2, 0.3]);
  assert.equal(lighting.directional.enabled, false);
  assert.equal(lighting.directional.castShadow, false);
  assert.deepEqual(player.position, [1, 2, 3]);
  assert.deepEqual(player.inventory, ['pocao']);
  assert.equal(player.status.hp, 12);
  assert.equal(player.status.maxHp, 30);
});
