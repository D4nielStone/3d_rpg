import test from 'node:test';
import assert from 'node:assert/strict';

import { Player } from '../server/player.js';
import { EnemyArea } from '../server/enemy-area.js';
import { Enemy } from '../server/enemy.js';

test('ataque mágico consome mana e usa distância e projétil configuráveis', () => {
  const player = new Player({
    peerId: 'player-1',
    mana: 5,
    combatMode: 'magic',
    inventory: [{
      id: 'basic-wand',
      name: 'Varinha Básica',
      type: 'weapon',
      slot: 'main',
      kind: 'magic',
      level: 1,
      damage: 1,
      manaCost: 1,
      range: 5,
      speed: 1,
      projectile: 'magic-ball',
    }],
  });

  const enemy = new Enemy({
    type: 'rat',
    level: 1,
    position: [3, 0, 0],
    definitions: new Map([['rat', {
      name: 'Rato',
      model: '',
      level: 1,
      maxHp: 3,
      speed: 1,
      defense: 0,
      damage: 1,
      experience: 2,
      scale: 0.35,
      gold: { min: 1, max: 2 },
      itemDrops: [],
    }]]),
  });

  const area = new EnemyArea({ id: 'area', center: [0, 0, 0], width: 12, depth: 12 });
  area.enemies.set(enemy.id, enemy);

  const result = area.attack(player, Date.now());

  assert.equal(result.hit, true);
  assert.equal(result.damage, 1);
  assert.equal(result.projectile, 'magic-ball');
  assert.equal(player.mana, 4);
  assert.equal(enemy.hp, 2);
});
