import test from 'node:test';
import assert from 'node:assert/strict';

import { Enemy } from '../server/enemy.js';

function terrain(height) {
  return {
    width: 4,
    depth: 4,
    segments: 2,
    heights: [0, 0, 0, 0, height, 0, 0, 0, 0],
  };
}

test('inimigo sobe uma colina abaixo da altura do jogador', () => {
  const enemy = new Enemy({ position: [-1, 0, 0], terrain: terrain(0.6) });
  enemy.updateChase([{ peerId: 'player', position: [3, 0, 0], dead: false }], 1);

  assert.ok(enemy.position[0] > -1, 'O inimigo deveria avançar pela colina');
  assert.ok(enemy.position[1] > 0.5, 'O inimigo deveria acompanhar a altura da colina');
});

test('inimigo não atravessa montanha mais alta que o jogador', () => {
  const enemy = new Enemy({ position: [-1, 0, 0], terrain: terrain(2) });
  enemy.updateChase([{ peerId: 'player', position: [3, 0, 0], dead: false }], 1);

  assert.equal(enemy.position[0], -1);
});
