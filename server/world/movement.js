import { Vec3, createMovementVector } from './physics/helpers.js';

export function getMovementVelocity(
  angle,
  speed,
  magnitude = 1,
) {
  const safeAngle =
    Number.isFinite(angle)
      ? angle
      : 0;

  const safeSpeed =
    Math.max(
      0,
      Number(speed) || 0,
    );

  const safeMagnitude =
    Math.max(
      0,
      Math.min(
        1,
        Number(magnitude) || 0,
      ),
    );

  const velocity =
    safeSpeed * safeMagnitude;

  const vector = createMovementVector(safeAngle, velocity, 1);
  return new Vec3(vector.x, vector.y, vector.z);
}

export function applyMovementVelocity(
  body,
  angle,
  speed,
  magnitude = 1,
) {
  if (!body) {
    return null;
  }

  const movementVelocity =
    getMovementVelocity(
      angle,
      speed,
      magnitude,
    );

  body.velocity.x =
    movementVelocity.x;

  body.velocity.z =
    movementVelocity.z;

  return movementVelocity;
}

export function stopMovement(body) {
  if (!body) {
    return;
  }

  body.velocity.x = 0;
  body.velocity.z = 0;
}

export function stepPhysicsWorld(
  world,
  deltaSeconds,
  fixedTimeStep = 1 / 60,
  maxSubSteps = 8,
) {
  if (!world) {
    return 0;
  }

  const delta =
    Number(deltaSeconds);

  if (
    !Number.isFinite(delta) ||
    delta <= 0
  ) {
    return 0;
  }

  const step =
    Math.min(delta, 0.1);

  world.step(
    fixedTimeStep,
    step,
    maxSubSteps,
  );

  return step;
}