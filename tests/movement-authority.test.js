import test from 'node:test';
import assert from 'node:assert/strict';

import { InputState } from '../src/input.js';
import { applyMovementVelocity, getMovementVelocity, stepPhysicsWorld } from '../server/world/movement.js';
import { PhysicsWorld } from '../server/world/physics.js';
import { getMovementRotation, getPlayerSpeed } from '../server/multiplayer/connection.js';

function createInputTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type, event) {
      listeners.get(type)?.(event);
    },
  };
}

test('converte WASD em angulo e magnitude', () => {
  const target = createInputTarget();
  const input = new InputState(target);

  target.dispatch('keydown', { key: 'w', repeat: false });
  assert.deepEqual(input.getMovementCommand(), { angle: 0, magnitude: 1 });

  target.dispatch('keydown', { key: 'd', repeat: false });
  assert.equal(input.getMovementCommand().angle, Math.PI / 4);

  target.dispatch('keyup', { key: 'w' });
  assert.deepEqual(input.getMovementCommand(), { angle: Math.PI / 2, magnitude: 1 });
});

test('Cannon avanca o jogador usando o angulo recebido', () => {
  const physics = new PhysicsWorld({
    terrain: {
      width: 4,
      depth: 4,
      segments: 1,
      heights: [0, 0, 0, 0],
    },
  });

  const next = physics.movePlayer('player', [0, 0.7, 0], Math.PI / 2, 3, 0.05);

  assert.ok(next[0] > 0);
  assert.ok(Math.abs(next[2]) < 0.001);
});

test('utilitario cria velocidade horizontal proporcional a magnitude', () => {
  const velocity = getMovementVelocity(Math.PI / 2, 4, 0.5);

  assert.equal(velocity.x, 2);
  assert.equal(velocity.y, 0);
  assert.ok(Math.abs(velocity.z) < 0.0001);
});

test('usa a velocidade configurada do jogador sem substituí-la pelo padrão', () => {
  assert.equal(getPlayerSpeed({ player: { speed: 7 } }), 7);
  assert.equal(getPlayerSpeed({ player: { speed: 0 } }), 0);
  assert.equal(getPlayerSpeed({ player: { speed: 'invalida' } }), 3);
});

test('utilitario aplica movimento sem apagar velocidade vertical', () => {
  const body = { velocity: { x: 0, y: -6, z: 0 } };

  applyMovementVelocity(body, 0, 3);

  assert.deepEqual(body.velocity, { x: 0, y: -6, z: 3 });
});

test('utilitario avanca o mundo somente quando ha delta valido', () => {
  const calls = [];
  const world = { step: (...args) => calls.push(args) };

  stepPhysicsWorld(world, 0);
  stepPhysicsWorld(world, 0.05);

  assert.deepEqual(calls, [[1 / 60, 0.05, 8]]);
});

test('usa o angulo de movimento como yaw no eixo Y', () => {
  const angle = Math.PI / 2;
  const rotation = [0, angle, 0];

  assert.equal(rotation[0], 0);
  assert.equal(rotation[1], angle);
  assert.equal(rotation[2], 0);
});

test('converte o angulo local para a perspectiva da camera', () => {
  const cameraYaw = 0;
  const localForwardAngle = 0;
  const worldAngle = Math.atan2(
    Math.sin(cameraYaw - Math.PI - localForwardAngle),
    Math.cos(cameraYaw - Math.PI - localForwardAngle),
  );

  assert.ok(Math.abs(Math.abs(worldAngle) - Math.PI) < 1e-9);
});

test('gravidade reduz a altura sem movimento horizontal', () => {
  const physics = new PhysicsWorld();
  const next = physics.movePlayer('falling-player', [0, 5, 0], 0, 0, 0.05);

  assert.ok(next[1] < 5);
});

test('gravidade continua acelerando entre atualizacoes do jogador', () => {
  const physics = new PhysicsWorld();
  let position = [0, 5, 0];

  position = physics.movePlayer('falling-player', position, 0, 0, 0.05);
  const firstHeight = position[1];
  position = physics.movePlayer('falling-player', position, 0, 0, 0.05);

  assert.ok(firstHeight - position[1] > 0.01);
});

test('movimento horizontal nao faz o jogador subir', () => {
  const physics = new PhysicsWorld();
  const first = physics.movePlayer('grounded-player', [0, 0, 0], Math.PI / 2, 3, 0.05);
  const second = physics.movePlayer('grounded-player', first, Math.PI / 2, 3, 0.05);

  assert.ok(second[1] <= first[1] + 0.02);
});

test('jogador atravessa o topo de uma caixa baixa como um degrau', () => {
  const physics = new PhysicsWorld({
    entities: [{
      id: 'island-base',
      position: [0, -0.5, 0],
      scale: [4, 0.4, 4],
      collision: { enabled: true, shape: 'box' },
    }],
  });
  let position = [-3, 0, 0];
  let highestPosition = position[1];

  for (let index = 0; index < 40; index += 1) {
    position = physics.movePlayer('step-player', position, Math.PI / 2, 3, 0.05);
    highestPosition = Math.max(highestPosition, position[1]);
  }

  assert.ok(position[0] > 2);
  assert.ok(highestPosition > 0.3);
});

test('jogador acompanha a altura de uma superfície de modelo', () => {
  const physics = new PhysicsWorld({
    entities: [{
      id: 'island-model',
      position: [0, 0, 0],
      scale: [1, 1, 1],
      collision: {
        enabled: true,
        shape: 'model',
        surface: {
          minX: -2,
          maxX: 2,
          minZ: -2,
          maxZ: 2,
          columns: 2,
          rows: 2,
          heights: [0.6, 0.6, 0.6, 0.6],
        },
      },
    }],
  });
  let position = [-3, 0, 0];
  let highestPosition = position[1];

  for (let index = 0; index < 22; index += 1) {
    position = physics.movePlayer('surface-player', position, Math.PI / 2, 3, 0.05);
    highestPosition = Math.max(highestPosition, position[1]);
  }

  assert.ok(position[0] > 0.2);
  assert.ok(highestPosition > 1.2);
});

test('jogador mantém a cápsula acima da borda mais alta da superfície', () => {
  const physics = new PhysicsWorld({
    entities: [{
      id: 'sloped-island',
      position: [0, 0, 0],
      scale: [1, 1, 1],
      collision: {
        enabled: true,
        shape: 'model',
        surface: {
          minX: -2,
          maxX: 2,
          minZ: -2,
          maxZ: 2,
          columns: 2,
          rows: 2,
          heights: [0, 0.8, 0, 0.8],
        },
      },
    }],
  });

  const position = physics.movePlayer('slope-player', [0, 0, 0], 0, 0, 0.05);

  assert.ok(position[1] >= 1.1);
});

test('jogador bate na parede vertical do modelo importado', () => {
  const physics = new PhysicsWorld({
    entities: [{
      id: 'model-wall',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      collision: {
        enabled: true,
        shape: 'model',
        surface: {
          minX: -2,
          maxX: 2,
          minZ: -2,
          maxZ: 2,
          columns: 2,
          rows: 2,
          heights: [0, 0, 0, 0],
          mesh: {
            vertices: [0, 0, -2, 0, 2, -2, 0, 0, 2, 0, 2, 2],
            indices: [0, 1, 2, 1, 3, 2],
          },
        },
      },
    }],
  });
  let position = [-1, 1, 0];

  for (let index = 0; index < 20; index += 1) {
    position = physics.movePlayer('wall-player', position, Math.PI / 2, 3, 0.05);
  }

  assert.ok(position[0] < 0, `O jogador atravessou a parede em x=${position[0]}`);
});

test('jogador nao atravessa modelo em alta velocidade', () => {
  const physics = new PhysicsWorld({
    entities: [{
      id: 'thin-model-wall',
      position: [0, 0, 0],
      collision: {
        enabled: true,
        shape: 'model',
        surface: {
          minX: -2,
          maxX: 2,
          minZ: -2,
          maxZ: 2,
          columns: 2,
          rows: 2,
          heights: [0, 0, 0, 0],
          mesh: {
            vertices: [0, 0, -2, 0, 2, -2, 0, 0, 2, 0, 2, 2],
            indices: [0, 1, 2, 1, 3, 2],
          },
        },
      },
    }],
  });

  const position = physics.movePlayer('fast-wall-player', [-1, 1, 0], Math.PI / 2, 60, 0.05);

  assert.ok(position[0] < 0, `O jogador atravessou o modelo em x=${position[0]}`);
});

test('jogador nao sobe uma parede representada como superficie inclinada', () => {
  const physics = new PhysicsWorld({
    entities: [{
      id: 'steep-model',
      position: [0, 0, 0],
      collision: {
        enabled: true,
        shape: 'model',
        surface: {
          minX: -2,
          maxX: 2,
          minZ: -2,
          maxZ: 2,
          columns: 2,
          rows: 2,
          heights: [0, 4, 0, 4],
        },
      },
    }],
  });

  const position = physics.movePlayer('steep-player', [-1, 0, 0], Math.PI / 2, 3, 0.05);

  assert.ok(position[0] < -0.8, `O jogador subiu a superficie inclinada em x=${position[0]}`);
});

test('parar o movimento preserva o ultimo yaw', () => {
  assert.deepEqual(getMovementRotation([0, Math.PI / 2, 0], 0, 0), [0, Math.PI / 2, 0]);
  assert.deepEqual(getMovementRotation([0, 0, 0], Math.PI / 2, 1), [0, Math.PI / 2, 0]);
});

test('movimentos consecutivos sem terreno permanecem sobre o piso', () => {
  const physics = new PhysicsWorld();
  let position = [0, 0, 0];

  for (let index = 0; index < 20; index += 1) {
    position = physics.movePlayer('grounded-player', position, 0, 3, 0.05);
  }

  assert.ok(position[1] < 0);
});
