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

test('interpolação ignora snapshot duplicado e interpola snapshots ordenados', () => {
  const interpolation = new RemotePlayerInterpolation({ renderDelay: 0 });
  const first = { serverTick: 1, position: { x: 0, y: 0, z: 0 }, rotation: {}, receivedAt: 0 };
  const second = { serverTick: 2, position: { x: 2, y: 0, z: 0 }, rotation: {}, receivedAt: 16 };
  assert.equal(interpolation.add(first), true);
  assert.equal(interpolation.add(first), false);
  interpolation.add(second);
  assert.equal(interpolation.sample(25).position.x, 1);
});

test('validador rejeita velocidade e teleporte excessivos', () => {
  const validator = new MovementValidator();
  const previous = { position: { x: 0, y: 0, z: 0 }, linearVelocity: { x: 0, y: 0, z: 0 } };
  assert.equal(validator.validateState(previous, { position: { x: 100, y: 0, z: 0 }, linearVelocity: { x: 100, y: 0, z: 0 } }).valid, false);
});

test('validador rejeita pulo no ar', () => {
  assert.equal(new MovementValidator().validateJump({ jump: true }, false), false);
});

test('autoridade server-side replica estado do client sem executar física', () => {
  let physicsSteps = 0;
  const authority = new ServerPhysicsAuthority({
    physics: { step: () => { physicsSteps += 1; } },
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
    position: [12, 4, -3],
    rotation: [0, 1.5, 0],
    linearVelocity: [2, 0, -1],
    grounded: false,
  }), true);
  authority.tick();

  assert.equal(physicsSteps, 0);
  assert.deepEqual(authority.snapshots()[0].position, { x: 12, y: 4, z: -3 });
  assert.equal(authority.snapshots()[0].rotation.y, 1.5);
});