import { FIXED_DT } from '../../shared/network-messages.js';

export class MovementValidator {
  constructor({ maxSpeed = 6, maxAcceleration = 40, maxTeleportDistance = 2 } = {}) {
    this.maxSpeed = maxSpeed;
    this.maxAcceleration = maxAcceleration;
    this.maxTeleportDistance = maxTeleportDistance;
  }

  validateState(previous, next) {
    const velocity = next.linearVelocity ?? { x: 0, y: 0, z: 0 };
    const speed = Math.hypot(velocity.x, velocity.z);
    const distance = Math.hypot(next.position.x - previous.position.x, next.position.z - previous.position.z);
    const acceleration = Math.hypot(velocity.x - previous.linearVelocity.x, velocity.z - previous.linearVelocity.z) / FIXED_DT;
    return {
      valid: speed <= this.maxSpeed + 0.001
        && acceleration <= this.maxAcceleration + 0.001
        && distance <= this.maxTeleportDistance + this.maxSpeed * FIXED_DT,
      speed,
      distance,
      acceleration,
    };
  }

  validateJump(input, grounded) { return input.jump !== true || grounded === true; }
}