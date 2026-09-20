function toPositiveNumber(value, fallback) {
  const number = Math.abs(Number(value));
  return Number.isFinite(number) ? Math.max(0.01, number) : fallback;
}

export function getCombinedCollisionScale(entity) {
  const entityScale = entity?.scale ?? [1, 1, 1];
  const collisionScale = entity?.collision?.scale ?? [1, 1, 1];

  return [0, 1, 2].map((index) => (
    toPositiveNumber(entityScale[index], 1) * toPositiveNumber(collisionScale[index], 1)
  ));
}

export function createColliderDesc({
  type = 'cuboid',
  halfExtents = [0.5, 0.5, 0.5],
  radius = 0.5,
  height = 1,
  translation = [0, 0, 0],
  friction = 0,
  restitution = 0,
} = {}) {
  return {
    type,
    halfExtents,
    radius,
    height,
    translation,
    friction,
    restitution,
  };
}

export function getColliderDescriptors(shape, scale = [1, 1, 1]) {
  const safeScale = [0, 1, 2].map((index) => toPositiveNumber(scale[index], 1));
  if (shape !== 'capsule') {
    return [createColliderDesc({
      type: 'cuboid',
      halfExtents: safeScale.map((value) => Math.max(0.05, value * 0.5)),
    })];
  }

  const radius = Math.max(0.2, Math.min(safeScale[0], safeScale[2]) * 0.5);
  const height = Math.max(radius * 2, safeScale[1]);
  const cylinderHeight = Math.max(0, height - radius * 2);
  const descriptors = [createColliderDesc({
    type: 'cylinder',
    radius,
    height: Math.max(cylinderHeight, 0.001),
  })];

  if (cylinderHeight > 0) {
    descriptors.push(
      createColliderDesc({ type: 'ball', radius, translation: [0, cylinderHeight * 0.5, 0] }),
      createColliderDesc({ type: 'ball', radius, translation: [0, -cylinderHeight * 0.5, 0] }),
    );
  } else {
    descriptors.push(createColliderDesc({ type: 'ball', radius }));
  }

  return descriptors;
}