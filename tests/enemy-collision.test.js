import test from 'node:test';
import assert from 'node:assert/strict';

import { Enemy } from '../server/enemy.js';
import { collidesWithMap } from '../server/world/collision.js';

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

test('colisao de objetos considera escala do modelo e escala da colisao', () => {
  const mapConfig = {
    entities: [{
      id: 'box',
      position: [0, 0, 0],
      scale: [1, 1, 1],
      collision: {
        enabled: true,
        shape: 'box',
        scale: [4, 1, 1],
        offset: [0, 0, 0],
      },
    }],
  };

  assert.equal(collidesWithMap([1.5, 0, 0], mapConfig, 0.1), true);
  assert.equal(collidesWithMap([3.1, 0, 0], mapConfig, 0.1), false);
});

test('superficie de colisao de modelo respeita a posicao do objeto', () => {
  const mapConfig = {
    entities: [{
      id: 'model',
      position: [5, 0, 2],
      scale: [1, 1, 1],
      collision: {
        enabled: true,
        shape: 'model',
        offset: [0, 0, 0],
        surface: {
          minX: -1,
          maxX: 1,
          minZ: -1,
          maxZ: 1,
          columns: 2,
          rows: 2,
          heights: [0, 0, 0, 0],
        },
      },
    }],
  };

  assert.equal(collidesWithMap([5.5, 0, 2], mapConfig, 0.1), true);
  assert.equal(collidesWithMap([1, 0, 2], mapConfig, 0.1), false);
});
