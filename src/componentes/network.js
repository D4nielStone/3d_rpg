export class NetworkIdentity {
  constructor({ peerId, isLocal = false } = {}) {
    this.peerId = peerId;
    this.isLocal = isLocal;
  }
}

export class NetworkTransform {
  constructor({ interpolation = 14 } = {}) {
    this.targetPosition = null;
    this.targetRotation = null;
    this.interpolation = interpolation;
  }
}
