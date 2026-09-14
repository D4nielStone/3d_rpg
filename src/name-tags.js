import { EnemyHealthBar, NameTag, Transform } from './components.js';

export class NameTagSystem {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.floatingDamages = [];
    this.floatingLevelUps = [];
    this.floatingMisses = [];
    this.lastUpdateAt = performance.now();
  }

  update(world, time = performance.now()) {
    const deltaSeconds = Math.min((time - this.lastUpdateAt) / 1000, 0.1);
    this.lastUpdateAt = time;
    const nameTagHeight = 0.5;
    for (const entity of world.query(Transform, NameTag)) {
      const transform = world.getComponent(entity, Transform);
      const nameTag = world.getComponent(entity, NameTag);
      const tagPosition = [
        transform.position[0],
        transform.position[1] + nameTagHeight,
        transform.position[2],
      ];
      const screenPosition = this.camera.worldToScreen(tagPosition, this.canvas);
      const visible = screenPosition.visible;
      nameTag.element.hidden = !visible;
      if (nameTag.speechExpiresAt && nameTag.speechExpiresAt <= Date.now()) {
        nameTag.hideSpeech();
      }
      if (!visible) {
        nameTag.speechElement.hidden = true;
        continue;
      }
      const screenX = screenPosition.x;
      const screenY = screenPosition.y;
      nameTag.element.style.left = `${screenX}px`;
      nameTag.element.style.top = `${screenY - 40}px`;
      nameTag.speechElement.hidden = !nameTag.speechExpiresAt;
      nameTag.speechElement.style.left = `${screenX}px`;
      nameTag.speechElement.style.top = `${screenY - 76}px`;
    }

    for (const entity of world.query(Transform, EnemyHealthBar)) {
      const transform = world.getComponent(entity, Transform);
      const healthBar = world.getComponent(entity, EnemyHealthBar);
      if (healthBar.previousHp > healthBar.hp) {
        this.spawnDamage(transform.position, healthBar.previousHp - healthBar.hp);
      }
      healthBar.previousHp = healthBar.hp;
      this.updateOverlayPosition(healthBar.element, transform.position, -34);
    }

    this.floatingDamages = this.floatingDamages.filter((damage) => {
      damage.age += deltaSeconds;
      if (damage.age >= 0.8) {
        damage.element.remove();
        return false;
      }
      damage.position[1] += deltaSeconds * 0.7;
      this.updateOverlayPosition(damage.element, damage.position, 0);
      damage.element.style.opacity = `${1 - damage.age / 0.8}`;
      return true;
    });

    this.floatingLevelUps = this.floatingLevelUps.filter((levelUp) => {
      levelUp.age += deltaSeconds;
      if (levelUp.age >= 1.2) {
        levelUp.element.remove();
        return false;
      }
      levelUp.position[1] += deltaSeconds * 0.9;
      this.updateOverlayPosition(levelUp.element, levelUp.position, 0);
      levelUp.element.style.opacity = `${1 - levelUp.age / 1.2}`;
      return true;
    });

    this.floatingMisses = this.floatingMisses.filter((miss) => {
      miss.age += deltaSeconds;
      if (miss.age >= 0.8) {
        miss.element.remove();
        return false;
      }
      miss.position[1] += deltaSeconds * 0.7;
      this.updateOverlayPosition(miss.element, miss.position, 0);
      miss.element.style.opacity = `${1 - miss.age / 0.8}`;
      return true;
    });
  }

  spawnDamage(position, amount) {
    const element = document.createElement('span');
    element.className = 'floating-damage';
    element.textContent = `-${Math.round(amount)}`;
    document.body.append(element);
    this.floatingDamages.push({
      element,
      position: [position[0], position[1] + 0.6, position[2]],
      age: 0,
    });
  }

  spawnLevelUp(position) {
    const element = document.createElement('span');
    element.className = 'floating-level-up';
    element.textContent = 'LEVEL UP';
    document.body.append(element);
    this.floatingLevelUps.push({
      element,
      position: [position[0], position[1] + 0.8, position[2]],
      age: 0,
    });
  }

  
  spawnMissAttack(position) {
    const element = document.createElement('span');
    element.className = 'floating-miss';
    element.textContent = 'MISS';
    document.body.append(element);
    this.floatingMisses.push({
      element,
      position: [position[0], position[1] + 0.8, position[2]],
      age: 0,
    });
  }

  updateOverlayPosition(element, position, offset) {
    const screenPosition = this.camera.worldToScreen(position, this.canvas);
    element.hidden = !screenPosition.visible;
    if (!screenPosition.visible) return;
    element.style.left = `${screenPosition.x}px`;
    element.style.top = `${screenPosition.y + offset}px`;
  }
}