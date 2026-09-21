export class Transform {
  constructor({ position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = {}) {
    this.position = [...position];
    this.rotation = [...rotation];
    this.scale = [...scale];
  }
}

export class Rigidbody {
  constructor({
    halfExtents = [0.5, 0.5, 0.5],
    offset = [0, 0, 0],
    gravity = 9.81,
    mass = 1,
    speed = 3,
  } = {}) {
    this.halfExtents = [...halfExtents].map((value) => Math.max(0.01, Math.abs(Number(value)) || 0.01));
    this.offset = [...offset].map((value) => Number(value) || 0);
    this.gravity = Math.max(0, Number(gravity) || 0);
    this.mass = Math.max(0.001, Number(mass) || 0.001);
    this.speed = Math.max(0, Number(speed) || 0);
    this.movementAngle = 0;
    this.movementMagnitude = 0;
    this.velocity = [0, 0, 0];
    this.grounded = false;
  }
}

export class RayCaster {
  constructor({
    origin = [0, 0, 0],
    direction = [0, -1, 0],
    maxDistance = 100,
    maxDrop = 3,
    heightOffset = 0,
  } = {}) {
    this.origin = [...origin];
    this.direction = [...direction];
    this.maxDistance = Math.max(0.01, Number(maxDistance) || 0.01);
    this.maxDrop = Math.max(0, Number(maxDrop) || 0);
    this.heightOffset = Number(heightOffset) || 0;
    this.grounded = false;
    this.hit = null;
    this.lastGroundHeight = null;
    this.lastGroundPosition = null;
  }
}
