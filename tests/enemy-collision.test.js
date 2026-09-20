import test from 'node:test';
import assert from 'node:assert/strict';

import { collidesWithMap } from '../server/world/collision.js';

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
