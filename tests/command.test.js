import test from 'node:test';
import assert from 'node:assert/strict';

import { createCommandManager } from '../server/multiplayer/commands.js';
import { Player } from '../server/player.js';

test('teleporta o jogador e atualiza o cliente alvo', async () => {
  const messages = [];
  const player = new Player({ peerId: 'peer-1', nickname: 'Hero' });
  const socket = { readyState: 1, send: (message) => messages.push(JSON.parse(message)) };
  const state = {
    players: new Map([['peer-1', player]]),
    activeGuestSessions: new Map([['user-1', { peerId: 'peer-1', socket }]]),
    physics: { teleportPlayer: (id, position) => { state.teleport = { id, position }; } },
  };
  const playerStore = { save: async () => {} };
  const commandManager = createCommandManager({
    state,
    playerStore,
    broadcastSnapshot: () => {},
  });

  await commandManager.execute('/tp 10 2 -4', {
    socket,
    peerId: 'peer-1',
    playerId: 'user-1',
    isAdmin: false,
    sendSystem: () => {},
  });

  assert.deepEqual(player.position, [10, 2, -4]);
  assert.deepEqual(state.teleport, { id: 'user-1', position: [10, 2, -4] });
  assert.deepEqual(messages[0], {
    type: 'teleported',
    position: [10, 2, -4],
    rotation: [0, 0, 0],
  });
});

test('teleporta um alvo pelo apelido e atualiza a área', async () => {
  const messages = [];
  const requester = new Player({ peerId: 'peer-1', nickname: 'Hero' });
  const target = new Player({ peerId: 'peer-2', nickname: 'Mage' });
  const targetSocket = { readyState: 1, send: (message) => messages.push(JSON.parse(message)) };
  const state = {
    players: new Map([['peer-1', requester], ['peer-2', target]]),
    activeGuestSessions: new Map([
      ['user-1', { peerId: 'peer-1' }],
      ['user-2', { peerId: 'peer-2', socket: targetSocket }],
    ]),
    findPlayerArea: () => ({ id: 'second-rat-area', areaLevel: 2 }),
    physics: { teleportPlayer: () => {} },
  };
  const commandManager = createCommandManager({
    state,
    playerStore: { save: async () => {} },
    broadcastSnapshot: () => {},
  });

  await commandManager.execute('/tp @Mage 3 4 5', {
    socket: { readyState: 1, send: () => {} },
    peerId: 'peer-1',
    playerId: 'user-1',
    isAdmin: false,
    sendSystem: () => {},
  });

  assert.deepEqual(target.position, [3, 4, 5]);
  assert.deepEqual(target.area, { id: 'second-rat-area', name: 'Área dos Ratos 2', level: 2 });
  assert.deepEqual(messages[0].position, [3, 4, 5]);
});

test('recusa teleporte para uma posição de água sem alterar o jogador', async () => {
  const messages = [];
  const player = new Player({ peerId: 'peer-1', nickname: 'Hero', position: [1, 2, 3] });
  const socket = { readyState: 1, send: (message) => messages.push(JSON.parse(message)) };
  const state = {
    players: new Map([['peer-1', player]]),
    activeGuestSessions: new Map([['user-1', { peerId: 'peer-1', socket }]]),
    publishedMapConfig: { water: { enabled: true, size: 10 } },
    physics: { teleportPlayer: () => { throw new Error('não deveria mover a física'); } },
  };
  const commandManager = createCommandManager({
    state,
    playerStore: { save: async () => { throw new Error('não deveria salvar'); } },
    broadcastSnapshot: () => { throw new Error('não deveria transmitir'); },
  });

  await commandManager.execute('/tp 0 2 0', {
    socket,
    peerId: 'peer-1',
    playerId: 'user-1',
    isAdmin: false,
    sendSystem: () => {},
  });

  assert.deepEqual(player.position, [1, 2, 3]);
  assert.equal(messages[0].text, 'Não é possível teletransportar para a água.');
});