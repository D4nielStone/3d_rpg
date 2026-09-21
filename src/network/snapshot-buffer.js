export class SnapshotBuffer {
  constructor({ maxSize = 32 } = {}) { this.maxSize = maxSize; this.snapshots = []; }
  add(snapshot) {
    if (!snapshot || !Number.isFinite(snapshot.serverTick) || this.snapshots.some((item) => item.serverTick === snapshot.serverTick)) return false;
    this.snapshots.push(snapshot);
    this.snapshots.sort((left, right) => left.serverTick - right.serverTick);
    this.snapshots = this.snapshots.slice(-this.maxSize);
    return true;
  }
  around(targetTick) {
    let previous = null;
    let next = null;
    for (const snapshot of this.snapshots) {
      if (snapshot.serverTick <= targetTick) previous = snapshot;
      if (snapshot.serverTick >= targetTick) { next = snapshot; break; }
    }
    return { previous, next };
  }
}