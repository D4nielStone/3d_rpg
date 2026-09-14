import test from 'node:test';
import assert from 'node:assert/strict';

import { MovementSystem } from '../src/systems.js';
import { LineRenderer, MoveTarget, OutlineRenderer, PlayerController, SwordRenderer, Transform } from '../src/components.js';
import { PhysicsWorld } from '../src/physics-world.js';
import { ThreeRenderSystem } from '../src/three-renderer.js';

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