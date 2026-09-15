export class InputState {
  constructor(target = window) {
    this.justPressed = new Set();
    target.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if (!event.repeat) this.justPressed.add(key);
    });
    target.addEventListener('blur', () => {
      this.justPressed.clear();
    });
  }

  consumePressed(key) {
    if (!this.justPressed.has(key)) return false;
    this.justPressed.delete(key);
    return true;
  }

}
