import * as CANNON from 'cannon-es';
import { normalizePlayerScale } from '../../shared/player-size.js';
import { canTraverseTerrain, PLAYER_HEIGHT, sampleTerrainHeight } from '../../shared/terrain-height.js';

function addCapsule(body, scale = [1, 1, 1]) {
  const radius = Math.max(0.25, Math.min(Math.abs(scale[0] ?? 1), Math.abs(scale[2] ?? 1)) * 0.5);
  const height = Math.max(radius * 2, Math.abs(scale[1] ?? 1));
  const cylinderHeight = Math.max(0, height - radius * 2);
  body.addShape(new CANNON.Cylinder(radius, radius, cylinderHeight || 0.001, 12));
  if (cylinderHeight > 0) {
    body.addShape(new CANNON.Sphere(radius), new CANNON.Vec3(0, cylinderHeight * 0.5, 0));
    body.addShape(new CANNON.Sphere(radius), new CANNON.Vec3(0, -cylinderHeight * 0.5, 0));
  }
}

function isGroundSurface(entity) {
  return entity?.primitive === 'plane' || entity?.collision?.surface === 'ground';
}

function getCollisionScale(entity) {
  const scale = entity?.collision?.scale ?? [1, 1, 1];
  return scale.map((value) => Math.max(0.01, Math.abs(Number(value) || 1)));
}

function getStaticColliderBounds(entity) {
  if (!entity?.collision?.enabled || !Array.isArray(entity.position)) return null;
  const scale = entity.scale ?? [1, 1, 1];
  const collisionScale = getCollisionScale(entity);
  const offset = entity.collision.offset ?? [0, 0, 0];
  const halfX = Math.max(0.05, Math.abs(Number(scale[0]) || 1) * collisionScale[0] * 0.5);
  const halfY = isGroundSurface(entity) ? 0.05 : Math.max(0.05, Math.abs(Number(scale[1]) || 1) * collisionScale[1] * 0.5);
  const halfZ = Math.max(0.05, Math.abs(Number(scale[2]) || 1) * collisionScale[2] * 0.5);
  return {
    minX: entity.position[0] + (Number(offset[0]) || 0) - halfX,
    maxX: entity.position[0] + (Number(offset[0]) || 0) + halfX,
    minY: entity.position[1] + (Number(offset[1]) || 0) - halfY,
    maxY: entity.position[1] + (Number(offset[1]) || 0) + halfY,
    minZ: entity.position[2] + (Number(offset[2]) || 0) - halfZ,
    maxZ: entity.position[2] + (Number(offset[2]) || 0) + halfZ,
  };
}

function collidesWithStaticColliders(from, to, radius, colliders) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const steps = Math.max(2, Math.ceil(Math.hypot(dx, dz) / 0.15));

  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    const x = from[0] + dx * progress;
    const z = from[2] + dz * progress;
    const blocked = colliders.some((collider) => {
      if (!collider) return false;
      if (collider.maxY <= from[1] + 0.1 && collider.maxY - collider.minY <= 0.5) return false;
      return x >= collider.minX - radius
        && x <= collider.maxX + radius
        && z >= collider.minZ - radius
        && z <= collider.maxZ + radius;
    });
    if (blocked) return true;
  }

  return false;
}

function addGroundCollider(world, playerMaterial) {
  const body = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC,
    material: new CANNON.Material('ground'),
  });
  body.material.friction = 0;
  body.addShape(new CANNON.Box(new CANNON.Vec3(1000, 0.1, 1000)));
  body.position.set(0, -0.8, 0);
  world.addBody(body);
  world.addContactMaterial(new CANNON.ContactMaterial(playerMaterial, body.material, { friction: 0, restitution: 0 }));
}

export class PhysicsWorld {
  constructor(mapConfig = null) {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) });
    this.playerMaterial = new CANNON.Material('player');
    this.bodies = new Map();
    this.lastCollision = null;
    this.staticBodies = new Map();
    this.staticColliders = (mapConfig?.entities ?? [])
      .map((entity) => getStaticColliderBounds(entity))
      .filter(Boolean);
    this.playerScale = normalizePlayerScale(mapConfig?.player?.scale);
    this.terrain = mapConfig?.terrain ?? null;
    for (const entity of mapConfig?.entities ?? []) {
      if (!entity.collision?.enabled) continue;
      const scale = entity.scale ?? [1, 1, 1];
      const collisionScale = getCollisionScale(entity);
      const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
      const material = new CANNON.Material(`static-${entity.id ?? 'collider'}`);
      material.friction = Math.min(1, Math.max(0, Number(entity.collision.friction ?? 0.3) || 0));
      material.restitution = Math.min(1, Math.max(0, Number(entity.collision.restitution ?? 0) || 0));
      if (isGroundSurface(entity) || Math.abs(Number(scale[1]) || 1) * collisionScale[1] <= 0.5) material.friction = 0;
      body.material = material;
      if (entity.collision.shape === 'capsule') {
        addCapsule(body, scale.map((value, index) => value * collisionScale[index]));
      } else {
        body.addShape(new CANNON.Box(new CANNON.Vec3(
          Math.max(0.05, Math.abs(scale[0] ?? 1) * collisionScale[0] * 0.5),
          isGroundSurface(entity) ? 0.05 : Math.max(0.05, Math.abs(scale[1] ?? 1) * collisionScale[1] * 0.5),
          Math.max(0.05, Math.abs(scale[2] ?? 1) * collisionScale[2] * 0.5),
        )));
      }
      const offset = entity.collision.offset ?? [0, 0, 0];
      body.position.set(
        entity.position[0] + (Number(offset[0]) || 0),
        entity.position[1] + (Number(offset[1]) || 0),
        entity.position[2] + (Number(offset[2]) || 0),
      );
      body.quaternion.setFromEuler(...(entity.rotation ?? [0, 0, 0]));
      this.world.addBody(body);
      this.staticBodies.set(body, { id: entity.id ?? null, name: entity.name ?? entity.id ?? 'objeto sem nome' });
      this.world.addContactMaterial(new CANNON.ContactMaterial(this.playerMaterial, material, {
        friction: material.friction,
        restitution: material.restitution,
      }));
    }
    addGroundCollider(this.world, this.playerMaterial);
  }

  movePlayer(id, from, to, deltaSeconds = 1 / 30) {
    this.lastCollision = null;
    let body = this.bodies.get(id);
    if (!body) {
      body = new CANNON.Body({ mass: 1, fixedRotation: true });
      addCapsule(body, this.playerScale);
      body.material = this.playerMaterial;
      this.world.addBody(body);
      this.bodies.set(id, body);
    }
    body.position.set(...from);
    body.wakeUp();
    body.velocity.set(
      (to[0] - from[0]) / Math.max(deltaSeconds, 1 / 60),
      0,
      (to[2] - from[2]) / Math.max(deltaSeconds, 1 / 60),
    );
    const step = Math.max(0, Math.min(Number(deltaSeconds) || 0, 0.1));
    if (step > 0) this.world.step(1 / 60, step, 8);
    const desired = [
      from[0] + (to[0] - from[0]) * Math.min(step / Math.max(deltaSeconds, 1 / 60), 1),
      from[1],
      from[2] + (to[2] - from[2]) * Math.min(step / Math.max(deltaSeconds, 1 / 60), 1),
    ];
    const terrainHeight = sampleTerrainHeight(this.terrain, desired[0], desired[2]);
    if (collidesWithStaticColliders(from, desired, 0.35, this.staticColliders)) {
      body.position.set(...from);
    } else if (terrainHeight !== null && !canTraverseTerrain(this.terrain, from, desired)) {
      body.position.set(...from);
    } else if (terrainHeight !== null) {
      body.position.x = desired[0];
      body.position.z = desired[2];
      body.position.y = terrainHeight + PLAYER_HEIGHT / 2;
      body.velocity.y = 0;
    } else {
      body.position.x = desired[0];
      body.position.z = desired[2];
      body.position.y = from[1] + PLAYER_HEIGHT / 2;
      body.velocity.y = 0;
    }
    for (const contact of this.world.contacts ?? []) {
      const otherBody = contact.bi === body ? contact.bj : contact.bj === body ? contact.bi : null;
      const collider = otherBody ? this.staticBodies.get(otherBody) : null;
      if (collider) {
        this.lastCollision = collider;
        break;
      }
    }
    return [body.position.x, body.position.y, body.position.z];
  }

  teleportPlayer(id, position) {
    const body = this.bodies.get(id);
    if (!body) return;
    body.position.set(...position);
    body.velocity.set(0, 0, 0);
    body.force.set(0, 0, 0);
  }
}
