export class InputState {
  constructor(target = window) {
    this.keys = new Set();
    this.justPressed = new Set();
    this.virtualKeys = new Set();
    target.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if (!event.repeat) this.justPressed.add(key);
      this.keys.add(key);
    });
    target.addEventListener('keyup', (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
    target.addEventListener('blur', () => {
      this.keys.clear();
      this.virtualKeys.clear();
    });
  }

  isPressed(...keys) {
    return keys.some((key) => this.keys.has(key));
  }

  consumePressed(key) {
    if (!this.justPressed.has(key)) return false;
    this.justPressed.delete(key);
    return true;
  }

  setVirtualKeys(keys) {
    for (const key of this.virtualKeys) this.keys.delete(key);
    this.virtualKeys = new Set(keys);
    for (const key of this.virtualKeys) this.keys.add(key);
  }
}
