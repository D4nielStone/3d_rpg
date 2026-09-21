import test from 'node:test';
import assert from 'node:assert/strict';

import { Enemy } from '../server/enemy.js';
import { createEnemyAreas } from '../server/world/enemy-areas.js';

test('área padrão cria ratos e eles respeitam pausar no wander', () => {
  const areas = createEnemyAreas();
  assert.equal(areas.length > 0, true);

  const area = areas[0];
  area.update(Date.now(), [], 0.1);
  assert.equal(area.enemies.size > 0, true);

  const enemy = [...area.enemies.values()][0];
  assert.ok(Array.isArray(enemy.position) && enemy.position.length === 3);
  assert.ok(enemy.wanderPause >= 0);

  const body = {
    position: { x: enemy.position[0], y: enemy.position[1], z: enemy.position[2] },
    velocity: { x: 0, y: 0, z: 0 },
    wakeUp() {},
  };

  enemy.bindPhysics(body);
  enemy.moveTo(enemy.position[0] + 2, enemy.position[2], 0.1);
  assert.equal(enemy.position[0], body.position.x);
  assert.ok(Math.abs(body.velocity.x) > 0);

  const before = enemy.position[0];
  enemy.wanderTarget = [before, enemy.position[1], enemy.position[2]];
  enemy.updateWander(0.1, area);
  assert.ok(enemy.wanderPause >= 0);
});
