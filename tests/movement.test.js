import test from 'node:test';
import assert from 'node:assert/strict';

import { MovementSystem } from '../src/systems.js';
import { LineRenderer, MoveTarget, OutlineRenderer, PlayerController, SwordRenderer, Transform } from '../src/components.js';
import { PhysicsWorld } from '../src/physics-world.js';
import { ThreeRenderSystem } from '../src/three-renderer.js';

test('o corpo do cannon nao e reposicionado manualmente antes do passo fisico', () => {
  const world = new PhysicsWorld();
  const body = world.addPlayer('manual-mix', [0, 0, 0]);
  const originalPosition = [body.position.x, body.position.y, body.position.z];

  let seenPositionAtStep = null;
  const originalStep = world.world.step.bind(world.world);
  world.world.step = (...args) => {
    seenPositionAtStep = [body.position.x, body.position.y, body.position.z];
    body.position.x += body.velocity.x * args[1];
    body.position.z += body.velocity.z * args[1];
    return originalStep(...args);
  };

  world.stepPlayer('manual-mix', originalPosition, [2, 0, 0], 0.1, { ignoreTerrain: true });

  assert.deepEqual(seenPositionAtStep, originalPosition);
});

test('move o jogador por teclado quando o mapa nao tem colisoes', () => {
  const components = new Map([
    [Transform, new Transform({ position: [0, 0, 0] })],
    [PlayerController, new PlayerController({ speed: 3 })],
    [MoveTarget, new MoveTarget()],
  ]);
  const world = {
    query: () => [1],
    getComponent: (_, type) => components.get(type),
  };
  const input = {
    isPressed: (...keys) => keys.includes('d'),
    consumePressed: () => false,
  };

  new MovementSystem(input).update(world, 1);

  assert.ok(components.get(Transform).position[0] > 0);
  assert.equal(components.get(Transform).position[2], 0);
});

test('move o jogador em relacao a orientacao da camera ao usar WASD', () => {
  const components = new Map([
    [Transform, new Transform({ position: [0, 0, 0] })],
    [PlayerController, new PlayerController({ speed: 3 })],
    [MoveTarget, new MoveTarget()],
  ]);
  const world = {
    query: () => [1],
    getComponent: (_, type) => components.get(type),
  };
  const input = {
    isPressed: (...keys) => keys.includes('w'),
    consumePressed: () => false,
  };
  const camera = { yaw: Math.PI / 2, pitch: 0 };

  new MovementSystem(input, null, camera).update(world, 1);

  assert.ok(components.get(Transform).position[0] < 0);
  assert.ok(Math.abs(components.get(Transform).position[2]) < 1e-9);
});

test('move o jogador ate um destino de clique', () => {
  const moveTarget = new MoveTarget();
  moveTarget.position = [3, 0, 0];
  const components = new Map([
    [Transform, new Transform({ position: [0, 0, 0] })],
    [PlayerController, new PlayerController({ speed: 3 })],
    [MoveTarget, moveTarget],
  ]);
  const world = {
    query: () => [1],
    getComponent: (_, type) => components.get(type),
  };
  const input = {
    isPressed: () => false,
    consumePressed: () => false,
  };

  new MovementSystem(input).update(world, 0.1);

  assert.ok(components.get(Transform).position[0] > 0);
  assert.deepEqual(moveTarget.path.at(-1), [3, 0, 0]);
});

test('aplica gravidade ao jogador parado', () => {
  const components = new Map([
    [Transform, new Transform({ position: [0, 5, 0] })],
    [PlayerController, new PlayerController({ speed: 3 })],
    [MoveTarget, new MoveTarget()],
  ]);
  const world = {
    query: () => [1],
    getComponent: (_, type) => components.get(type),
  };
  const input = {
    isPressed: () => false,
    consumePressed: () => false,
  };

  new MovementSystem(input).update(world, 0.1);

  assert.ok(components.get(Transform).position[1] < 5);
});

test('o anel do movimento acompanha a escala do objeto 3d', () => {
  const line = new LineRenderer({ radius: 0.4 });
  const transform = new Transform({ scale: [2, 1, 2] });

  assert.equal(line.getRadius(transform), 0.8);

  const outline = new OutlineRenderer({ radius: 1.2 });
  assert.equal(outline.getRadius(new Transform({ scale: [2, 1, 2] })), 2.4);
  assert.equal(outline.getRadius(new Transform({ scale: [0.5, 1, 0.5] })), 1.2);
});

test('o anel do movimento fica visivel por cima dos objetos 3d', () => {
  const system = Object.create(ThreeRenderSystem.prototype);
  const ring = system.updateRing(
    { getRadius: () => 1, thickness: 0.3, segments: 16, color: [1, 0.5, 0] },
    new Transform({ position: [0, 0, 0], scale: [1, 1, 1] }),
    0,
    [1, 0.5, 0],
  );

  assert.equal(ring.material.depthTest, false);
  assert.ok(ring.renderOrder >= 10);
});

test('o jogador cai pela gravidade quando está acima do terreno', () => {
  const world = new PhysicsWorld({
    terrain: {
      width: 4,
      depth: 4,
      segments: 2,
      heights: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  });

  const result = world.stepPlayer('gravity-check', [0, 5, 0], [0, 0, 0], 0.1);

  assert.ok(result[1] < 5);
});

test('o movimento por teclado ignora o bloqueio legado do terreno', () => {
  const world = new PhysicsWorld({
    terrain: {
      width: 4,
      depth: 4,
      segments: 2,
      heights: [10, 10, 10, 10, 10, 10, 10, 10, 10],
    },
  });

  const result = world.stepPlayer('legacy-terrain', [0, 0, 0], [2, 0, 0], 0.1, { ignoreTerrain: true });

  assert.ok(result[0] > 0);
});

test('o ataque da espada gira no eixo X para um corte frontal', () => {
  const calls = [];
  const object = {
    position: { set: (...args) => calls.push(['position', ...args]) },
    rotation: { set: (...args) => calls.push(['rotation', ...args]) },
    scale: { set: (...args) => calls.push(['scale', ...args]) },
    translateX: () => calls.push(['translateX']),
    translateY: () => calls.push(['translateY']),
    translateZ: () => calls.push(['translateZ']),
    rotateX: () => calls.push(['rotateX']),
    rotateZ: () => calls.push(['rotateZ']),
  };

  const system = Object.create(ThreeRenderSystem.prototype);
  system.entityObjects = new Map();
  system.root = { add: () => {} };
  system.createObject = () => object;

  const world = {
    getComponent: (entity, type) => {
      if (type === Transform) return new Transform({ position: [1, 2, 3], rotation: [0, 0, 0] });
      if (type === SwordRenderer) return new SwordRenderer();
      return null;
    },
  };

  system.updateSwordObject(7, world, 100);

  assert.equal(calls.some((call) => call[0] === 'rotateX'), true);
  assert.equal(calls.some((call) => call[0] === 'rotateZ'), false);
});