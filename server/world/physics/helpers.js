import RAPIER from '@dimforge/rapier3d/rapier.js';

export { createColliderDesc } from '../../../shared/collision-shape.js';

await RAPIER.init?.();

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = Number(x);
    this.y = Number(y);
    this.z = Number(z);
  }

  set(x, y, z) {
    this.x = Number(x);
    this.y = Number(y);
    this.z = Number(z);
    return this;
  }
}

export class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = Number(x);
    this.y = Number(y);
    this.z = Number(z);
    this.w = Number(w);
  }

  setFromEuler(x, y, z) {
    const cx = Math.cos(x / 2);
    const sx = Math.sin(x / 2);
    const cy = Math.cos(y / 2);
    const sy = Math.sin(y / 2);
    const cz = Math.cos(z / 2);
    const sz = Math.sin(z / 2);

    this.x = sx * cy * cz - cx * sy * sz;
    this.y = cx * sy * cz + sx * cy * sz;
    this.z = cx * cy * sz - sx * sy * cz;
    this.w = cx * cy * cz + sx * sy * sz;
    return this;
  }
}

export class Material {
  constructor(name) {
    this.name = name;
    this.friction = 0;
    this.restitution = 0;
  }
}

export class ContactMaterial {
  constructor(materialA, materialB, config = {}) {
    this.materialA = materialA;
    this.materialB = materialB;
    Object.assign(this, config);
  }
}

export class SAPBroadphase {
  constructor(world) {
    this.world = world;
  }
}

export class Box {
  constructor(size) {
    this.size = size;
  }
}

export class Sphere {
  constructor(radius) {
    this.radius = radius;
  }
}

export class Cylinder {
  constructor(radiusTop, radiusBottom, height) {
    this.radiusTop = radiusTop;
    this.radiusBottom = radiusBottom;
    this.height = height;
  }
}

export class Trimesh {
  constructor(vertices, indices) {
    this.vertices = vertices;
    this.indices = indices;
  }
}

export class Body {
  static STATIC = 0;
  static DYNAMIC = 1;
  static SLEEPING = 2;

  constructor(options = {}) {
    this.mass = Number(options.mass ?? 0);
    this.type = Number(options.type ?? Body.DYNAMIC);
    this.fixedRotation = Boolean(options.fixedRotation);
    this.allowSleep = Boolean(options.allowSleep);
    this.linearDamping = Number(options.linearDamping ?? 0);
    this.angularDamping = Number(options.angularDamping ?? 0);
    this.position = new Vec3();
    this.velocity = new Vec3();
    this.angularVelocity = new Vec3();
    this.force = new Vec3();
    this.torque = new Vec3();
    this.quaternion = new Quaternion();
    this.material = null;
    this.shapes = [];
    this.sleepState = 0;
  }

  addShape(shape, offset = new Vec3()) {
    this.shapes.push({ shape, offset });
  }

  wakeUp() {
    this.sleepState = 0;
  }
}

export class World {
  constructor(config = {}) {
    const gravity = config.gravity ?? { x: 0, y: -9.81, z: 0 };
    this.gravity = new Vec3(
      gravity.x ?? gravity[0] ?? 0,
      gravity.y ?? gravity[1] ?? 0,
      gravity.z ?? gravity[2] ?? 0,
    );
    this.broadphase = new SAPBroadphase(this);
    this.allowSleep = false;
    this.defaultContactMaterial = {
      friction: 0,
      restitution: 0,
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 3,
    };
    this.solver = { iterations: 10, tolerance: 0.001 };
    this.bodies = [];
    this.contacts = [];
    this.contactMaterials = [];
  }

  addBody(body) {
    this.bodies.push(body);
    return body;
  }

  removeBody(body) {
    const index = this.bodies.indexOf(body);
    if (index >= 0) this.bodies.splice(index, 1);
    return body;
  }

  addContactMaterial(material) {
    this.contactMaterials.push(material);
    return material;
  }

  step(fixedTimeStep, deltaSeconds = 0, maxSubSteps = 1) {
    if (!Number.isFinite(Number(fixedTimeStep)) || Number(fixedTimeStep) <= 0) return;

    const delta = Number(deltaSeconds) || 0;
    this.contacts = [];
    const configuredSubSteps = Math.max(1, Math.trunc(Number(maxSubSteps) || 1));
    const dynamicBodies = this.bodies.filter((body) => (
      body.type !== Body.STATIC
      && !(this.allowSleep && body.sleepState === Body.SLEEPING)
    ));
    const maximumDisplacement = dynamicBodies.reduce((maximum, body) => Math.max(
      maximum,
      Math.abs(body.velocity.x * delta),
      Math.abs(body.velocity.y * delta),
      Math.abs(body.velocity.z * delta),
    ), 0);
    const subSteps = Math.max(
      configuredSubSteps,
      Math.ceil(maximumDisplacement / 0.05),
    );
    const subStepDelta = delta / subSteps;

    for (let subStep = 0; subStep < subSteps; subStep += 1) {
      for (const body of dynamicBodies) {
        body.velocity.y += this.gravity.y * subStepDelta;
        body.position.x += body.velocity.x * subStepDelta;
        body.position.y += body.velocity.y * subStepDelta;
        body.position.z += body.velocity.z * subStepDelta;

        if (Math.abs(body.velocity.x) < 1e-6) body.velocity.x = 0;
        if (Math.abs(body.velocity.y) < 1e-6) body.velocity.y = 0;
        if (Math.abs(body.velocity.z) < 1e-6) body.velocity.z = 0;

        for (const staticBody of this.bodies) {
          if (staticBody.type !== Body.STATIC) continue;
          const collision = resolveStaticCollision(body, staticBody);
          if (collision) this.contacts.push({ bi: body, bj: staticBody });
        }
      }
    }
  }
}

function getShapeBounds(body, shapeEntry) {
  const shape = shapeEntry.shape;
  const translation = shape.translation ?? [0, 0, 0];
  const center = [
    body.position.x + Number(translation[0] ?? 0),
    body.position.y + Number(translation[1] ?? 0),
    body.position.z + Number(translation[2] ?? 0),
  ];

  if (shape.type === 'cuboid') {
    const halfExtents = shape.halfExtents ?? [0.5, 0.5, 0.5];
    return {
      min: center.map((value, index) => value - Math.abs(Number(halfExtents[index]) || 0.5)),
      max: center.map((value, index) => value + Math.abs(Number(halfExtents[index]) || 0.5)),
    };
  }

  if (shape.type === 'cylinder') {
    const radius = Math.abs(Number(shape.radius) || 0.5);
    const halfHeight = Math.abs(Number(shape.height) || 1) * 0.5;
    return {
      min: [center[0] - radius, center[1] - halfHeight, center[2] - radius],
      max: [center[0] + radius, center[1] + halfHeight, center[2] + radius],
    };
  }

  if (shape.type === 'ball') {
    const radius = Math.abs(Number(shape.radius) || 0.5);
    return {
      min: center.map((value) => value - radius),
      max: center.map((value) => value + radius),
    };
  }

  if (shape.type === 'trimesh' || (Array.isArray(shape.vertices) && Array.isArray(shape.indices))) {
    const vertices = shape.vertices ?? [];
    if (vertices.length < 3) return null;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < vertices.length; index += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        const value = center[axis] + Number(vertices[index + axis] ?? 0);
        min[axis] = Math.min(min[axis], value);
        max[axis] = Math.max(max[axis], value);
      }
    }
    return { min, max };
  }

  return null;
}

function getBodyBounds(body) {
  const bounds = body.shapes
    .map((shapeEntry) => getShapeBounds(body, shapeEntry))
    .filter(Boolean);
  if (bounds.length === 0) return null;

  return {
    min: [0, 1, 2].map((axis) => Math.min(...bounds.map((item) => item.min[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...bounds.map((item) => item.max[axis]))),
  };
}

function resolveStaticCollision(dynamicBody, staticBody) {
  const dynamicBounds = getBodyBounds(dynamicBody);
  const staticBounds = getBodyBounds(staticBody);
  if (!dynamicBounds || !staticBounds) return false;

  const overlap = [0, 1, 2].map((axis) => Math.min(
    dynamicBounds.max[axis] - staticBounds.min[axis],
    staticBounds.max[axis] - dynamicBounds.min[axis],
  ));
  if (overlap.some((value) => value <= 0)) return false;

  const centers = [0, 1, 2].map((axis) => ({
    dynamic: (dynamicBounds.min[axis] + dynamicBounds.max[axis]) * 0.5,
    static: (staticBounds.min[axis] + staticBounds.max[axis]) * 0.5,
  }));
  const inwardAxes = [0, 1, 2]
    .filter((axis) => {
      const direction = centers[axis].dynamic >= centers[axis].static ? 1 : -1;
      const velocity = dynamicBody.velocity[axis === 0 ? 'x' : axis === 1 ? 'y' : 'z'];
      return velocity * direction < 0;
    })
    .sort((first, second) => overlap[first] - overlap[second]);
  const axis = inwardAxes[0] ?? overlap.indexOf(Math.min(...overlap));
  const dynamicCenter = centers[axis].dynamic;
  const staticCenter = centers[axis].static;
  const direction = dynamicCenter >= staticCenter ? 1 : -1;
  dynamicBody.position[axis === 0 ? 'x' : axis === 1 ? 'y' : 'z'] += overlap[axis] * direction;

  const velocityKey = axis === 0 ? 'x' : axis === 1 ? 'y' : 'z';
  if (dynamicBody.velocity[velocityKey] * direction < 0) dynamicBody.velocity[velocityKey] = 0;
  return true;
}

export function createPhysicsVector(x = 0, y = 0, z = 0) {
  return new Vec3(x, y, z);
}

export function createPhysicsQuaternion(x = 0, y = 0, z = 0) {
  const quaternion = new Quaternion();
  quaternion.setFromEuler(x, y, z);
  return quaternion;
}

export function createPhysicsWorld(gravity = [0, -9.81, 0]) {
  return new World({ gravity: new Vec3(...gravity) });
}

export function createRigidBodyDesc({
  mass = 1,
  translation = [0, 0, 0],
  rotation = [0, 0, 0],
  type = 'dynamic',
} = {}) {
  return {
    mass,
    translation,
    rotation,
    type,
  };
}

export function createBodyState(body) {
  if (!body) return null;
  return {
    position: [body.position.x, body.position.y, body.position.z],
    velocity: [body.velocity.x, body.velocity.y, body.velocity.z],
  };
}

export function stepPhysicsSimulation(world, deltaSeconds, fixedTimeStep = 1 / 60) {
  if (!world || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  const timeStep = Math.min(deltaSeconds, 0.1);
  world.step(fixedTimeStep, timeStep, 1);
  return timeStep;
}

export function createMovementVector(angle, speed, magnitude = 1) {
  const safeAngle = Number.isFinite(angle) ? angle : 0;
  const safeSpeed = Math.max(0, Number(speed) || 0);
  const safeMagnitude = Math.max(0, Math.min(1, Number(magnitude) || 0));
  return createPhysicsVector(
    Math.sin(safeAngle) * safeSpeed * safeMagnitude,
    0,
    Math.cos(safeAngle) * safeSpeed * safeMagnitude,
  );
}
