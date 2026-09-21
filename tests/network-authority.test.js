import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizePlayerInput } from '../shared/network-messages.js';
import { InputBuffer } from '../server/multiplayer/input-buffer.js';
import { MovementValidator } from '../server/multiplayer/movement-validator.js';
import { ServerPhysicsAuthority } from '../server/multiplayer/server-physics-authority.js';
import { ClientPrediction } from '../src/network/client-prediction.js';
import { RemotePlayerInterpolation } from '../src/network/remote-player-interpolation.js';

test('normaliza e limita input sem aceitar estado físico', () => {
  assert.deepEqual(normalizePlayerInput({ sequence: 1, tick: 2, moveX: 9, moveZ: -9, jump: 1 }), {
    sequence: 1, tick: 2, moveX: 1, moveZ: -1, jump: false, sprint: false,
  });
  assert.equal(normalizePlayerInput({ sequence: 1, tick: 2, position: [99, 99, 99] }), null);
});

test('buffer processa inputs em ordem e rejeita sequência antiga no consumidor', () => {
  const buffer = new InputBuffer();
  buffer.push({ sequence: 2 });
  buffer.push({ sequence: 1 });
  assert.equal(buffer.takeNext().sequence, 1);
  assert.equal(buffer.takeNext().sequence, 2);
});

test('prediction reaplica inputs pendentes na reconciliação', () => {
  const state = { position: { x: 0, y: 0, z: 0 } };
  const simulated = [];
  const prediction = new ClientPrediction({
    simulate: (input) => { simulated.push(input.sequence); state.position.x += 1; },
    getState: () => state,
    setState: (snapshot) => { state.position = { ...snapshot.position }; },
  });
  prediction.update({ moveX: 1, moveZ: 0 });
  prediction.update({ moveX: 1, moveZ: 0 });
  prediction.reconcile({ lastProcessedInput: 0, position: { x: 1, y: 0, z: 0 } });
  assert.deepEqual(simulated, [0, 1, 1]);
});

test('prediction confirma pequenas diferenças sem reposicionar o jogador', () => {
  const state = { position: { x: 1, y: 0, z: 0 } };
  let stateUpdates = 0;
  const prediction = new ClientPrediction({
    simulate: () => {},
    getState: () => state,
    setState: () => { stateUpdates += 1; },
  });

  prediction.update({ moveX: 1, moveZ: 0 });
  prediction.reconcile({ lastProcessedInput: 0, position: { x: 0.9, y: 0, z: 0 } });

  assert.equal(stateUpdates, 0);
});

test('prediction limita correcoes de posicao do servidor a cada dez segundos', () => {
  const state = { position: { x: 1, y: 0, z: 0 } };
  let currentTime = 0;
  let stateUpdates = 0;
  const prediction = new ClientPrediction({
    now: () => currentTime,
    simulate: () => {},
    getState: () => state,
    setState: (snapshot) => {
      state.position = { ...snapshot.position };
      stateUpdates += 1;
    },
  });

  prediction.reconcile({
    serverTick: 1,
    lastProcessedInput: -1,
    position: { x: 0, y: 0, z: 0 },
  });
  currentTime = 9_999;
  prediction.reconcile({
    serverTick: 2,
    lastProcessedInput: -1,
    position: { x: 2, y: 0, z: 0 },
  });
  assert.equal(stateUpdates, 1);

  currentTime = 10_000;
  prediction.reconcile({
    serverTick: 3,
    lastProcessedInput: -1,
    position: { x: 3, y: 0, z: 0 },
  });
  assert.equal(stateUpdates, 2);
});

test('interpolação ignora snapshot duplicado e interpola snapshots ordenados', () => {
  const interpolation = new RemotePlayerInterpolation({ renderDelay: 0 });
  const first = { serverTick: 1, position: { x: 0, y: 0, z: 0 }, rotation: {}, receivedAt: 0 };
  const second = { serverTick: 2, position: { x: 2, y: 0, z: 0 }, rotation: {}, receivedAt: 16 };
  assert.equal(interpolation.add(first), true);
  assert.equal(interpolation.add(first), false);
  interpolation.add(second);
  assert.equal(interpolation.sample(1.5).position.x, 1);
});

test('extrapolação remota converte ticks do servidor em segundos', () => {
  const interpolation = new RemotePlayerInterpolation({ renderDelay: 0 });
  interpolation.add({
    serverTick: 1,
    position: { x: 0, y: 0, z: 0 },
    linearVelocity: { x: 6, y: 0, z: 0 },
    rotation: {},
  });

  assert.ok(Math.abs(interpolation.sample(2).position.x - 0.1) < 0.0001);
});

test('buffer de snapshots rejeita pacotes atrasados', () => {
  const interpolation = new RemotePlayerInterpolation({ renderDelay: 0 });
  assert.equal(interpolation.add({ serverTick: 2, position: { x: 2, y: 0, z: 0 }, rotation: {} }), true);
  assert.equal(interpolation.add({ serverTick: 1, position: { x: 1, y: 0, z: 0 }, rotation: {} }), false);
});

test('validador rejeita velocidade e teleporte excessivos', () => {
  const validator = new MovementValidator();
  const previous = { position: { x: 0, y: 0, z: 0 }, linearVelocity: { x: 0, y: 0, z: 0 } };
  assert.equal(validator.validateState(previous, { position: { x: 100, y: 0, z: 0 }, linearVelocity: { x: 100, y: 0, z: 0 } }).valid, false);
});

test('validador rejeita pulo no ar', () => {
  assert.equal(new MovementValidator().validateJump({ jump: true }, false), false);
});

test('autoridade server-side simula input e ignora estado físico do cliente', () => {
  let physicsSteps = 0;
  let simulatedPosition = [0, 0, 0];
  const authority = new ServerPhysicsAuthority({
    physics: {
      movePlayer: () => {},
      step: () => { physicsSteps += 1; simulatedPosition = [1, 0, 0]; },
      getPlayerPosition: () => simulatedPosition,
      getPlayerVelocity: () => [2, 0, 0],
    },
    getSpeed: () => 3,
  });
  const player = {
    peerId: 'client-player',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    setTransform(position, rotation) {
      this.position = [...position];
      this.rotation = [...rotation];
    },
  };

  authority.addPlayer(player);
  assert.equal(authority.receiveState(player, {
    position: { x: 12, y: 4, z: -3 },
    rotation: { x: 0, y: 1.5, z: 0 },
    linearVelocity: { x: 2, y: 0, z: -1 },
    grounded: false,
  }), false);
  assert.equal(authority.receiveInput(player, {
    sequence: 4,
    tick: 4,
    moveX: 1,
    moveZ: 0,
  }), true);
  authority.tick();

  assert.equal(physicsSteps, 1);
  assert.deepEqual(authority.snapshots()[0].position, { x: 1, y: 0, z: 0 });
  assert.equal(authority.snapshots()[0].rotation.y, Math.PI / 2);
  assert.equal(authority.snapshots()[0].lastProcessedInput, 4);
});

test('autoridade mantém o último input entre snapshots de entrada', () => {
  const movements = [];
  const authority = new ServerPhysicsAuthority({
    physics: {
      movePlayer: (_id, _position, _angle, speed) => movements.push(speed),
      step: () => {},
      getPlayerPosition: () => [0, 0, 0],
      getPlayerVelocity: () => [0, 0, 0],
    },
  });
  const player = { peerId: 'held-input-player', position: [0, 0, 0], rotation: [0, 0, 0] };

  authority.addPlayer(player);
  authority.receiveInput(player, { sequence: 0, tick: 0, moveX: 1, moveZ: 0 });
  authority.tick();
  authority.tick();

  assert.deepEqual(movements, [3, 3]);
});

test('autoridade usa a velocidade configurada para simular o jogador', () => {
  const movements = [];
  const authority = new ServerPhysicsAuthority({
    physics: {
      movePlayer: (_id, _position, _angle, speed) => movements.push(speed),
      step: () => {},
      getPlayerPosition: () => [0, 0, 0],
      getPlayerVelocity: () => [0, 0, 0],
    },
    getSpeed: (player) => player.speed,
  });
  const player = { peerId: 'configured-speed-player', speed: 7, position: [0, 0, 0], rotation: [0, 0, 0] };

  authority.addPlayer(player);
  authority.receiveInput(player, { sequence: 0, tick: 0, moveX: 1, moveZ: 0 });
  authority.tick();

  assert.deepEqual(movements, [7]);
});

