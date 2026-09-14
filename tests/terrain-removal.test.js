import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeTerrainForExport } from '../src/editor/terrain-state.js';
import { canTraverseTerrain, sampleTerrainHeight, TERRAIN_BASE_Y, PLAYER_HEIGHT } from '../shared/terrain-height.js';
import { doesAttackHit } from '../server/combat.js';

test('o terreno removido não é exportado para o mundo', () => {
  const exported = normalizeTerrainForExport({ width: 128, depth: 128, heights: [0, 1] }, true);
  assert.equal(exported, null);
});

test('o terreno ativo mantém o mesmo payload ao exportar', () => {
  const config = { width: 128, depth: 128, heights: [0, 1], color: '#202522' };
  const exported = normalizeTerrainForExport(config, false);

  assert.deepEqual(exported, config);
  assert.notStrictEqual(exported, config);
});

test('ataque com defesa alta tem chance mínima e não ultrapassa o limite de acerto', () => {
  assert.equal(doesAttackHit(5, 50, 0.95), false);
  assert.equal(doesAttackHit(5, 50, 0.05), true);
  assert.equal(doesAttackHit(1, 0, 0.999), true);
});

test('o terreno permite atravessar colina baixa dentro do limite de altura do jogador', () => {
  const terrain = {
    width: 4,
    depth: 4,
    segments: 2,
    heights: [0, 0, 0, 0, 0.6, 0, 0, 0, 0],
  };

  assert.ok(sampleTerrainHeight(terrain, 1, 0) > TERRAIN_BASE_Y);
  assert.equal(canTraverseTerrain(terrain, [-1, 0, 0], [3, 0, 0]), true);
  assert.ok(sampleTerrainHeight(terrain, 1, 0) + PLAYER_HEIGHT / 2 < 1.2);
});

test('o terreno bloqueia montanha que excede a altura máxima do jogador', () => {
  const terrain = {
    width: 4,
    depth: 4,
    segments: 2,
    heights: [0, 0, 0, 0, 5, 0, 0, 0, 0],
  };

  assert.ok(sampleTerrainHeight(terrain, 0, 0) > TERRAIN_BASE_Y + PLAYER_HEIGHT);
  assert.equal(canTraverseTerrain(terrain, [-1, 0, 0], [3, 0, 0]), false);
});

test('o terreno bloqueia buraco que excede a profundidade máxima do jogador', () => {
  const terrain = {
    width: 4,
    depth: 4,
    segments: 2,
    heights: [0, 0, 0, 0, -5, 0, 0, 0, 0],
  };

  assert.ok(sampleTerrainHeight(terrain, 0, 0) < TERRAIN_BASE_Y - PLAYER_HEIGHT);
  assert.equal(canTraverseTerrain(terrain, [-1, 0, 0], [3, 0, 0]), false);
});
