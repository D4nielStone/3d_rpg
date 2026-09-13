import test from 'node:test';
import assert from 'node:assert/strict';

import { Player } from '../server/player.js';
import { createPlayerPersistence } from '../server/multiplayer/persistence.js';

test('sincroniza vida máxima diretamente ao nível', () => {
  const player = new Player({ level: 3, hp: 999, maxHp: 999 });
  assert.equal(player.maxHp, 29);
  assert.equal(player.hp, 29);

  player.addExperience(1000);
  assert.equal(player.maxHp, Math.round(20 * 1.2 ** (player.level - 1)));
  assert.equal(player.hp, player.maxHp);
});

test('salva apenas o snapshot mais recente em ordem', async () => {
  const saved = [];
  const playerStore = {
    saveState: async (id, state) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      saved.push({ id, state: { ...state } });
    },
  };
  const persistence = createPlayerPersistence({ playerStore, logger: { error() {} } });
  const first = new Player({ peerId: 'peer', nickname: 'A' });
  const second = new Player({ peerId: 'peer', nickname: 'B' });

  persistence.queuePlayerSave('player', first);
  second.money = 42;
  persistence.queuePlayerSave('player', second);
  await persistence.savePlayer('player', second);

  assert.equal(saved.length, 1);
  assert.equal(saved[0].state.nickname, 'B');
  assert.equal(saved[0].state.money, 42);
});
