import { SnapshotBuffer } from './snapshot-buffer.js';

export class RemotePlayerInterpolation {
  constructor({ renderDelay = 100, tickMs = 1000 / 60, maxExtrapolationMs = 100 } = {}) {
    this.renderDelay = renderDelay;
    this.tickMs = tickMs;
    this.maxExtrapolationMs = maxExtrapolationMs;
    this.buffer = new SnapshotBuffer();
  }
  add(snapshot) { return this.buffer.add(snapshot); }
  sample(serverTime) {
    const targetTick = serverTime - this.renderDelay / this.tickMs;
    const { previous, next } = this.buffer.around(targetTick);
    if (previous && next && previous !== next) {
      const alpha = Math.max(0, Math.min(1, (targetTick - previous.serverTick) / (next.serverTick - previous.serverTick)));
      return this.interpolate(previous, next, alpha);
    }
    if (!previous) return null;
    const elapsed = Math.min(this.maxExtrapolationMs, Math.max(0, serverTime - previous.receivedAt));
    const scale = elapsed / 1000;
    return { ...previous, position: { x: previous.position.x + (previous.linearVelocity?.x ?? 0) * scale, y: previous.position.y + (previous.linearVelocity?.y ?? 0) * scale, z: previous.position.z + (previous.linearVelocity?.z ?? 0) * scale } };
  }
  interpolate(previous, next, alpha) {
    const lerp = (left, right) => left + (right - left) * alpha;
    return { ...next, position: { x: lerp(previous.position.x, next.position.x), y: lerp(previous.position.y, next.position.y), z: lerp(previous.position.z, next.position.z) } };
  }
}