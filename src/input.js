export class InputState {
  constructor(target = window, pointerTarget = target) {
    this.keys = new Set();
    this.justPressed = new Set();
    this.gamepadAxes = [0, 0];
    this.touchAxes = [0, 0];
    this.joystickPointerId = null;
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
      this.setTouchAxes(0, 0);
    });
    pointerTarget.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      this.pendingClick = [event.clientX, event.clientY];
    });
  }

  attachJoystick(element) {
    if (!element) return;
    const knob = element.querySelector('#mobile-joystick-knob');
    const reset = () => {
      this.joystickPointerId = null;
      this.setTouchAxes(0, 0);
      if (knob) knob.style.transform = 'translate(-50%, -50%)';
    };
    const update = (event) => {
      const bounds = element.getBoundingClientRect();
      const radius = Math.max(1, Math.min(bounds.width, bounds.height) * 0.5);
      const horizontal = event.clientX - (bounds.left + bounds.width * 0.5);
      const vertical = event.clientY - (bounds.top + bounds.height * 0.5);
      const distance = Math.hypot(horizontal, vertical);
      const scale = distance > radius ? radius / distance : 1;
      const x = horizontal * scale;
      const y = vertical * scale;
      this.setTouchAxes(x / radius, -y / radius);
      if (knob) knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    };
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.joystickPointerId = event.pointerId;
      element.setPointerCapture?.(event.pointerId);
      update(event);
    });
    element.addEventListener('pointermove', (event) => {
      if (event.pointerId === this.joystickPointerId) update(event);
    });
    element.addEventListener('pointerup', reset);
    element.addEventListener('pointercancel', reset);
    element.addEventListener('lostpointercapture', reset);
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

  setTouchAxes(horizontal, forward) {
    this.touchAxes = [clampAxis(horizontal), clampAxis(forward)];
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
    const horizontal = this.touchAxes[0] || this.gamepadAxes[0] || keyboardHorizontal;
    const forward = this.touchAxes[1] || this.gamepadAxes[1] || keyboardForward;
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
