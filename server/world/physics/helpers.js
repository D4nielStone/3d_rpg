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
    this.rapierBody = null;
    this.rapierColliders = [];
  }

  addShape(shape, offset = new Vec3()) {
    this.shapes.push({ shape, offset });
  }

  wakeUp() {
    this.sleepState = 0;
    this.rapierBody?.wakeUp();
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
    this.rapierWorld = new RAPIER.World({ x: this.gravity.x, y: this.gravity.y, z: this.gravity.z });
  }

  addBody(body) {
    const descriptor = body.type === Body.STATIC
      ? RAPIER.RigidBodyDesc.fixed()
      : RAPIER.RigidBodyDesc.dynamic();
    descriptor.setTranslation(body.position.x, body.position.y, body.position.z);
    descriptor.setRotation(body.quaternion);
    descriptor.setEnabled(true);
    descriptor.setCcdEnabled(true);
    const rapierBody = this.rapierWorld.createRigidBody(descriptor);
    body.rapierBody = rapierBody;
    body.rapierColliders = [];

    for (const { shape } of body.shapes) {
      const collider = createRapierCollider(shape, body.material);
      if (collider) {
        const rapierCollider = this.rapierWorld.createCollider(collider, rapierBody);
        body.rapierColliders.push(rapierCollider);
      }
    }

    this.bodies.push(body);
    return body;
  }

  removeBody(body) {
    if (body?.rapierBody) {
      this.rapierWorld.removeRigidBody(body.rapierBody);
      body.rapierBody = null;
    }
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
    for (const body of this.bodies) {
      if (!body.rapierBody || body.type === Body.STATIC) continue;
      body.rapierBody.setLinvel({ x: body.velocity.x, y: body.velocity.y, z: body.velocity.z }, true);
    }

    this.rapierWorld.timestep = Math.min(delta, 0.1);
    this.rapierWorld.step();
    this.contacts = [];

    for (const dynamicBody of this.bodies) {
      if (!dynamicBody.rapierBody || dynamicBody.type === Body.STATIC) continue;
      for (const staticBody of this.bodies) {
        if (!staticBody.rapierBody || staticBody.type !== Body.STATIC) continue;
        for (const dynamicCollider of dynamicBody.rapierColliders) {
          for (const staticCollider of staticBody.rapierColliders) {
            let touching = false;
            this.rapierWorld.contactPair(dynamicCollider, staticCollider, () => {
              touching = true;
            });
            if (touching) {
              this.contacts.push({ bi: dynamicBody, bj: staticBody });
              break;
            }
          }
          if (this.contacts.some((contact) => contact.bi === dynamicBody && contact.bj === staticBody)) break;
        }
      }
    }

    for (const body of this.bodies) {
      if (!body.rapierBody || body.type === Body.STATIC) continue;
      const position = body.rapierBody.translation();
      const velocity = body.rapierBody.linvel();
      body.position.set(position.x, position.y, position.z);
      body.velocity.set(velocity.x, velocity.y, velocity.z);
    }
  }
}

function createRapierCollider(shape, material) {
  const friction = Number(material?.friction) || 0;
  const restitution = Number(material?.restitution) || 0;
  let descriptor = null;

  if (shape?.type === 'cuboid') {
    const halfExtents = shape.halfExtents ?? [0.5, 0.5, 0.5];
    descriptor = RAPIER.ColliderDesc.cuboid(...halfExtents);
  } else if (shape?.type === 'cylinder') {
    descriptor = RAPIER.ColliderDesc.cylinder(
      Math.abs(Number(shape.height) || 1) * 0.5,
      Math.abs(Number(shape.radius) || 0.5),
    );
  } else if (shape?.type === 'ball') {
    descriptor = RAPIER.ColliderDesc.ball(Math.abs(Number(shape.radius) || 0.5));
  } else if (shape?.type === 'trimesh'
    || (Array.isArray(shape?.vertices) && Array.isArray(shape?.indices))) {
    descriptor = RAPIER.ColliderDesc.trimesh(
      new Float32Array(shape.vertices),
      new Uint32Array(shape.indices),
    );
  }

  if (!descriptor) return null;
  descriptor.setTranslation(...(shape.translation ?? [0, 0, 0]));
  descriptor.setFriction(friction);
  descriptor.setRestitution(restitution);
  return descriptor;
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
