import assert from 'node:assert/strict';
import { Player } from './server/player.js';
import { calculateDefenseXp } from './server/progression.js';

const p1 = new Player({ level: 1, defense: 1 });
for (let i = 0; i < 3; i += 1) p1.registerDefenseProgress(5);
assert.equal(p1.defense, 1);
assert.equal(p1.defenseTraining, 3);
assert.equal(p1.defenseXp, 0);

const p2 = new Player({ level: 1, defense: 1 });
for (let i = 0; i < 4; i += 1) p2.registerDefenseProgress(5);
assert.equal(p2.defenseTraining, 0);
assert.equal(p2.defenseXp, 1);
assert.equal(p2.defense, 1);

const p3 = new Player({ level: 1, defense: 11 });
for (let i = 0; i < 5; i += 1) p3.registerDefenseProgress(1);
assert.equal(p3.defense, 11);
assert.equal(p3.defenseTraining, 1);
assert.equal(p3.defenseXp, 0);

for (const [level, cap] of [[1, 11], [5, 15], [10, 20], [20, 30]]) {
  const p = new Player({ level, defense: cap });
  assert.equal(p.level + 10, cap);
}

assert.equal(calculateDefenseXp(1), 25);
assert.ok(calculateDefenseXp(2) > calculateDefenseXp(1));

const p4 = new Player({ level: 1, defense: 1 });
p4.defenseXp = 25;
p4.registerDefenseProgress(4);
assert.equal(p4.defense, 2);
assert.equal(p4.defenseXp, 1);
assert.equal(p4.defenseTraining, 0);

console.log('Defense rules verified');
