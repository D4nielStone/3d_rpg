import { FIXED_DT } from '../../shared/network-messages.js';

export class FixedTickLoop {
  constructor({ onTick, now = () => Date.now() } = {}) {
    this.onTick = onTick;
    this.now = now;
    this.accumulator = 0;
    this.lastTime = null;
    this.tick = 0;
  }

  advance(time = this.now()) {
    if (this.lastTime === null) this.lastTime = time;
    this.accumulator += Math.min(0.25, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    while (this.accumulator >= FIXED_DT) {
      this.onTick?.(FIXED_DT, this.tick++);
      this.accumulator -= FIXED_DT;
    }
  }
}