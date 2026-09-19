import test from 'node:test';
import assert from 'node:assert/strict';

import { Rigidbody, Transform } from '../src/components.js';
import { World } from '../src/ecs.js';
import { PhysicsSystem } from '../src/systems.js';

function flatTerrain() {
  return {
    width: 4,
    depth: 4,
    segments: 1,
    heights: [0, 0, 0, 0],
  };
}

test('rigidbody cai com gravidade e repousa sobre o terreno', () => {
  const world = new World();
  const entity = world.createEntity();
  world.addComponent(entity, new Transform({ position: [0, 2, 0] }));
  world.addComponent(entity, new Rigidbody({ halfExtents: [0.5, 0.5, 0.5] }));
  const physics = new PhysicsSystem({ terrain: flatTerrain(), entities: [] });

  for (let frame = 0; frame < 20; frame += 1) physics.update(world, 0.1);
  const transform = world.getComponent(entity, Transform);
  const body = world.getComponent(entity, Rigidbody);

  assert.ok(transform.position[1] < 2);
  assert.ok(Math.abs(transform.position[1] - (-0.2)) < 1e-9);
  assert.equal(body.grounded, true);
  assert.equal(body.velocity[1], 0);
});

test('rigidbody repousa no topo de collider estatico', () => {
  const world = new World();
  const entity = world.createEntity();
  world.addComponent(entity, new Transform({ position: [0, 3, 0] }));
  world.addComponent(entity, new Rigidbody({ halfExtents: [0.5, 0.5, 0.5] }));
  const physics = new PhysicsSystem({
    terrain: flatTerrain(),
    entities: [{
      position: [0, 1, 0],
      scale: [2, 1, 2],
      collision: { enabled: true, bodyType: 'staticBody' },
    }],
  });

  for (let frame = 0; frame < 20; frame += 1) physics.update(world, 0.1);

  assert.equal(world.getComponent(entity, Transform).position[1], 2);
});
