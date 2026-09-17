export class InputState {
  constructor(target = window, pointerTarget = target) {
    this.keys = new Set();
    this.justPressed = new Set();
    this.gamepadAxes = [0, 0];
    this.pendingClick = null;
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
      this.justPressed.clear();
      this.gamepadAxes = [0, 0];
    });
    pointerTarget.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      this.pendingClick = [event.clientX, event.clientY];
    });
  }

  consumePressed(key) {
    if (!this.justPressed.has(key)) return false;
    this.justPressed.delete(key);
    return true;
  }

  setGamepadAxes(horizontal, forward) {
    this.gamepadAxes = [
      clampAxis(horizontal),
      clampAxis(forward),
    ];
  }

  consumeClick() {
    const click = this.pendingClick;
    this.pendingClick = null;
    return click;
  }

  getMovementCommand() {
    const keyboardHorizontal = Number(this.keys.has('d') || this.keys.has('arrowright'))
      - Number(this.keys.has('a') || this.keys.has('arrowleft'));
    const keyboardForward = Number(this.keys.has('w') || this.keys.has('arrowup'))
      - Number(this.keys.has('s') || this.keys.has('arrowdown'));
    const horizontal = this.gamepadAxes[0] || keyboardHorizontal;
    const forward = this.gamepadAxes[1] || keyboardForward;
    const magnitude = Math.min(1, Math.hypot(horizontal, forward));

    if (magnitude <= 0.0001) return { angle: 0, magnitude: 0 };

    return {
      angle: Math.atan2(horizontal, forward),
      magnitude,
    };
  }

}

function clampAxis(value) {
  return Math.max(-1, Math.min(1, Number(value) || 0));
}
