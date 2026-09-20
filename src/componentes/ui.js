export class NameTag {
  constructor({ text = 'Guest', level = 1, alerted = false } = {}) {
    this.text = text;
    this.level = level;
    this.alerted = alerted;
    this.speechExpiresAt = 0;
    this.element = document.createElement('span');
    this.element.className = 'player-name-tag';
    this.speechElement = document.createElement('span');
    this.speechElement.className = 'player-speech-bubble';
    this.speechElement.hidden = true;
    this.update(text, level, alerted);
    document.body.append(this.element, this.speechElement);
  }

  update(text = this.text, level = this.level, alerted = this.alerted) {
    this.text = text;
    this.level = Math.max(1, Number(level) || 1);
    this.alerted = Boolean(alerted);
    this.element.textContent = `${this.alerted ? '! ' : ''}${this.text} • LVL ${this.level}`;
    this.element.classList.toggle('player-name-tag-alerted', this.alerted);
  }

  showSpeech(text, durationMs = 8000) {
    this.speechElement.textContent = text;
    this.speechElement.hidden = false;
    this.speechExpiresAt = Date.now() + durationMs;
  }

  hideSpeech() {
    this.speechElement.hidden = true;
    this.speechExpiresAt = 0;
  }

  dispose() {
    this.element.remove();
    this.speechElement.remove();
  }
}

export class EnemyIdentity {
  constructor({ enemyId, type = 'rat' } = {}) {
    this.enemyId = enemyId;
    this.type = type;
  }
}

export class EnemyHealthBar {
  constructor({ hp = 1, maxHp = 1 } = {}) {
    this.hp = hp;
    this.maxHp = maxHp;
    this.element = document.createElement('div');
    this.element.className = 'enemy-healthbar';
    this.element.setAttribute('role', 'progressbar');
    this.fill = document.createElement('span');
    this.element.append(this.fill);
    document.body.append(this.element);
    this.update(hp, maxHp);
  }

  update(hp, maxHp = this.maxHp) {
    this.hp = Math.max(0, Number(hp) || 0);
    this.maxHp = Math.max(1, Number(maxHp) || 1);
    const percentage = Math.min(100, this.hp / this.maxHp * 100);
    this.fill.style.width = `${percentage}%`;
    this.element.setAttribute('aria-valuenow', String(this.hp));
    this.element.setAttribute('aria-valuemax', String(this.maxHp));
  }

  dispose() { this.element.remove(); }
}

export class PlayerHealthBar {
  constructor({ hp = 1, maxHp = 1 } = {}) {
    this.hp = hp;
    this.maxHp = maxHp;
    this.element = document.createElement('div');
    this.element.className = 'player-healthbar';
    this.element.setAttribute('role', 'progressbar');
    this.element.setAttribute('aria-label', 'Vida do jogador');
    this.fill = document.createElement('span');
    this.element.append(this.fill);
    document.body.append(this.element);
    this.update(hp, maxHp);
  }

  update(hp, maxHp = this.maxHp) {
    this.hp = Math.max(0, Number(hp) || 0);
    this.maxHp = Math.max(1, Number(maxHp) || 1);
    const percentage = Math.min(100, this.hp / this.maxHp * 100);
    this.fill.style.width = `${percentage}%`;
    this.element.setAttribute('aria-valuenow', String(this.hp));
    this.element.setAttribute('aria-valuemax', String(this.maxHp));
  }

  dispose() { this.element.remove(); }
}
