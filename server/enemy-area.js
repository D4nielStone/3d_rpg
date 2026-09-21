import { Enemy } from './enemy.js';
import { doesAttackHit } from './combat.js';
import { MELEE_ATTACK_RANGE } from '../shared/combat-range.js';

export class EnemyArea {
  constructor({
    id,
    center = [0, 0, 0],
    width = 25,
    depth = 25,
    maxEnemies = 5,
    enemyType = 'rat',
    areaLevel = 1,
    spawnIntervalMs = 3000,
    enemyDefinitions = null,
  } = {}) {
    this.id = id;
    this.center = [...center];
    this.width = width;
    this.depth = depth;
    this.maxEnemies = maxEnemies;
    this.enemyType = enemyType;
    this.areaLevel = areaLevel;
    this.spawnIntervalMs = spawnIntervalMs;
    this.enemyDefinitions = enemyDefinitions;
    this.enemies = new Map();
    this.lastSpawnAt = 0;
  }

  update(time, players = [], deltaSeconds = 1) {
    let changed = false;
    const damagedPlayers = [];
    const missedPlayers = [];
    const deadPlayers = [];
    const activePlayers = [...players].filter((player) => this.contains(player.position));
    for (const enemy of this.enemies.values()) {
      const previousPosition = [...enemy.position];
      const previousAlerted = enemy.alerted;
      const result = enemy.updateChase(activePlayers, deltaSeconds, this);
      if (result?.damagedPlayer) damagedPlayers.push(result.damagedPlayer);
      if (result?.missedPlayer) missedPlayers.push(result.missedPlayer);
      changed = changed
        || previousAlerted !== enemy.alerted
        || previousPosition[0] !== enemy.position[0]
        || previousPosition[2] !== enemy.position[2];
    }

    for (const player of activePlayers) {
      if (player.hp <= 0 && player.die()) deadPlayers.push(player);
    }

    if (this.enemies.size < this.maxEnemies && time - this.lastSpawnAt >= this.spawnIntervalMs) {
      const enemy = new Enemy({
        type: this.enemyType,
        level: this.areaLevel,
        position: this.randomPosition(),
        definitions: this.enemyDefinitions,
      });
      this.enemies.set(enemy.id, enemy);
      this.lastSpawnAt = time;
      changed = true;
    }
    return {
      changed: changed || damagedPlayers.length > 0 || missedPlayers.length > 0 || deadPlayers.length > 0,
      damagedPlayers,
      missedPlayers,
      deadPlayers,
    };
  }

  randomPosition() {
    return [
      this.center[0] + (Math.random() - 0.5) * this.width,
      this.center[1],
      this.center[2] + (Math.random() - 0.5) * this.depth,
    ];
  }

  contains(position) {
    return Math.abs(position[0] - this.center[0]) <= this.width / 2
      && Math.abs(position[2] - this.center[2]) <= this.depth / 2;
  }

  removeEnemy(enemyId) {
    return this.enemies.delete(enemyId);
  }

  attack(player, now) {
    const currentMode = player.combatMode ?? 'melee';
    const weapon = player.getMainWeapon(currentMode);
    if (!weapon) return { hit: false };

    const attackRange = currentMode === 'magic'
      ? Number(weapon.range ?? 5)
      : currentMode === 'ranged'
        ? Number(weapon.range ?? 5)
        : MELEE_ATTACK_RANGE;
    const manaCost = currentMode === 'magic'
      ? Math.max(1, Number(weapon.manaCost ?? weapon.damage ?? 1))
      : 0;

    let target = null;
    let targetDistance = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies.values()) {
      const distance = Math.hypot(
        player.position[0] - enemy.position[0],
        player.position[2] - enemy.position[2],
      );
      if (distance <= attackRange && distance < targetDistance) {
        target = enemy;
        targetDistance = distance;
      }
    }

    if (!target || !player.canAttack(now)) return { hit: false };
    if (currentMode === 'magic' && player.mana < manaCost) return { hit: false };

    target.setTarget(player);
    const weaponDamage = Number(weapon.damage ?? 1);
    const attackDamage = currentMode === 'magic'
      ? weaponDamage + Math.max(0, player.magic - 1)
      : currentMode === 'ranged'
        ? weaponDamage + Math.max(0, Math.floor(player.accuracy) - 1)
        : weaponDamage + player.strength;

    if (currentMode === 'magic') {
      player.mana = Math.max(0, player.mana - manaCost);
    }

    if (!doesAttackHit(player.accuracy, target.defense)) {
      return {
        hit: false,
        enemyId: target.id,
        position: [...target.position],
        manaCost,
      };
    }

    const damage = target.receiveDamage(attackDamage);
    if (target.hp <= 0) {
      this.removeEnemy(target.id);
      return {
        hit: true,
        damage,
        enemyId: target.id,
        rewards: target.getDrop(),
        projectile: weapon.projectile ?? 'magic-ball',
        manaCost,
      };
    }
    // miss attack
    return {
      hit: true,
      damage,
      projectile: weapon.projectile ?? 'magic-ball',
      manaCost,
    };
  }

  toSnapshots({ serverTick } = {}) {
    return [...this.enemies.values()].map((enemy) => ({
      ...enemy.toSnapshot(),
      areaId: this.id,
      serverTick,
    }));
  }
}