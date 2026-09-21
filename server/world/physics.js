import {
  Vec3,
  Material,
  ContactMaterial,
  Body,
  World,
} from './physics/helpers.js';
import { getColliderDescriptors, getCombinedCollisionScale } from '../../shared/collision-shape.js';
import { normalizePlayerScale } from '../../shared/player-size.js';

const VOID_LIMIT = 10;
const FIXED_TIME_STEP = 1 / 60;
const PLAYER_GRAVITY = 10;

const PLAYER_MASS = 1;
const PLAYER_LINEAR_DAMPING = 0;
const PLAYER_ANGULAR_DAMPING = 1;

const DEFAULT_FRICTION = 0;
const DEFAULT_RESTITUTION = 0;

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getVector3(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  return [
    toFiniteNumber(value[0], fallback[0]),
    toFiniteNumber(value[1], fallback[1]),
    toFiniteNumber(value[2], fallback[2]),
  ];
}

function getCombinedScale(entity) {
  return getCombinedCollisionScale(entity);
}

function createMaterial(name, friction, restitution) {
  return {
    name,
    friction: Math.min(
      1,
      Math.max(0, toFiniteNumber(friction, DEFAULT_FRICTION)),
    ),
    restitution: Math.min(
      1,
      Math.max(0, toFiniteNumber(restitution, DEFAULT_RESTITUTION)),
    ),
  };
}

function addPlayerCollider(body, playerConfig, scale) {
  const collision = playerConfig?.collision ?? {};
  const shape = collision.shape === 'capsule' ? 'capsule' : 'box';
  const offset = getVector3(collision.offset);
  getColliderDescriptors(shape, scale).forEach((descriptor) => {
    descriptor.translation = descriptor.translation.map((value, index) => value + offset[index]);
    body.addShape(descriptor);
  });
}

function scaleTrimeshVertices(vertices, scale) {
  const result = new Array(vertices.length);

  for (let index = 0; index < vertices.length; index += 3) {
    result[index] =
      toFiniteNumber(vertices[index], 0) *
      scale[0];

    result[index + 1] =
      toFiniteNumber(vertices[index + 1], 0) *
      scale[1];

    result[index + 2] =
      toFiniteNumber(vertices[index + 2], 0) *
      scale[2];
  }

  return result;
}

function createTrimeshShape(mesh, scale) {
  if (
    !Array.isArray(mesh?.vertices) ||
    !Array.isArray(mesh?.indices)
  ) {
    return null;
  }

  if (
    mesh.vertices.length < 9 ||
    mesh.indices.length < 3 ||
    mesh.vertices.length % 3 !== 0
  ) {
    return null;
  }

  const vertices = scaleTrimeshVertices(
    mesh.vertices,
    scale,
  );

  const indices = mesh.indices
    .map((value) => Math.trunc(Number(value)))
    .filter((value) => Number.isInteger(value));

  if (indices.length < 3) {
    return null;
  }

  return {
    type: 'trimesh',
    vertices,
    indices,
  };
}

function createReverseTrimeshShape(shape) {
  if (!shape) return null;
  const indices = [];
  for (let index = 0; index + 2 < shape.indices.length; index += 3) {
    indices.push(shape.indices[index], shape.indices[index + 2], shape.indices[index + 1]);
  }
  return {
    type: 'trimesh',
    vertices: shape.vertices,
    indices,
  };
}

function createSurfaceMesh(surface) {
  const columns = Math.floor(Number(surface?.columns));
  const rows = Math.floor(Number(surface?.rows));
  const heights = surface?.heights;
  const valid = surface?.valid;
  if (!Number.isInteger(columns) || columns < 2 || !Number.isInteger(rows) || rows < 2
    || !Array.isArray(heights) || heights.length !== columns * rows) return null;

  const minX = Number(surface.minX);
  const maxX = Number(surface.maxX);
  const minZ = Number(surface.minZ);
  const maxZ = Number(surface.maxZ);
  if (![minX, maxX, minZ, maxZ].every(Number.isFinite) || maxX <= minX || maxZ <= minZ) return null;

  const vertices = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      vertices.push(
        minX + (maxX - minX) * column / (columns - 1),
        Number(heights[row * columns + column]),
        minZ + (maxZ - minZ) * row / (rows - 1),
      );
    }
  }

  const indices = [];
  const isValid = (index) => !Array.isArray(valid) || valid.length !== heights.length || valid[index] === true;
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const topLeft = row * columns + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + columns;
      const bottomRight = bottomLeft + 1;
      if (![topLeft, topRight, bottomLeft, bottomRight].every(isValid)) continue;
      indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
    }
  }
  return indices.length >= 3 ? { vertices, indices } : null;
}

function addBoxShape(body, scale) {
  body.addShape(getColliderDescriptors('box', scale)[0]);
}

function setBodyTransform(body, entity) {
  const position = getVector3(
    entity?.position,
    [0, 0, 0],
  );

  const offset = getVector3(
    entity?.collision?.offset,
    [0, 0, 0],
  );

  const rotation = getVector3(
    entity?.rotation,
    [0, 0, 0],
  );

  body.position.set(
    position[0] + offset[0],
    position[1] + offset[1],
    position[2] + offset[2],
  );

  body.quaternion.setFromEuler(
    rotation[0],
    rotation[1],
    rotation[2],
  );
}

function getCollisionShape(entity) {
  const shape = entity?.collision?.shape;

  const surface = entity?.collision?.surface;
  const hasMesh = Array.isArray(surface?.mesh?.vertices)
    && Array.isArray(surface?.mesh?.indices);
  const hasHeightGrid = Array.isArray(surface?.heights)
    && Number.isInteger(Math.floor(Number(surface?.columns)))
    && Number.isInteger(Math.floor(Number(surface?.rows)));

  if ((shape === 'trimesh' || shape === 'model') && (hasMesh || hasHeightGrid)) {
    return 'trimesh';
  }

  if (shape === 'capsule') {
    return 'capsule';
  }

  return 'box';
}

function sampleMeshHeight(mesh, x, z) {
  const vertices = mesh?.vertices;
  const indices = mesh?.indices;
  if (!Array.isArray(vertices) || !Array.isArray(indices) || vertices.length < 9 || indices.length < 3) {
    return null;
  }

  let highest = -Infinity;
  for (let index = 0; index + 2 < indices.length; index += 3) {
    const first = Number(indices[index]) * 3;
    const second = Number(indices[index + 1]) * 3;
    const third = Number(indices[index + 2]) * 3;
    const ax = Number(vertices[first]);
    const ay = Number(vertices[first + 1]);
    const az = Number(vertices[first + 2]);
    const bx = Number(vertices[second]);
    const by = Number(vertices[second + 1]);
    const bz = Number(vertices[second + 2]);
    const cx = Number(vertices[third]);
    const cy = Number(vertices[third + 1]);
    const cz = Number(vertices[third + 2]);
    if (![ax, ay, az, bx, by, bz, cx, cy, cz].every(Number.isFinite)) continue;

    const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(denominator) < 1e-8) continue;
    const firstWeight = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
    const secondWeight = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
    const thirdWeight = 1 - firstWeight - secondWeight;
    if (firstWeight < -1e-6 || secondWeight < -1e-6 || thirdWeight < -1e-6) continue;

    const height = firstWeight * ay + secondWeight * by + thirdWeight * cy;
    if (height > highest) highest = height;
  }

  return Number.isFinite(highest) ? highest : null;
}

export class PhysicsWorld {
  constructor(mapConfig = null) {
    this.world = new World({
      gravity: new Vec3(0, -PLAYER_GRAVITY, 0),
    });

    this.playerMaterial = new Material('player');

    this.staticBodies = new Map();
    this.bodies = new Map();
    this.playerInputs = new Map();

    this.lastCollision = null;
    this.lastDeltaSeconds = FIXED_TIME_STEP;

    const player = mapConfig?.player ?? {};
    this.playerOrigin = getVector3(player.position, [0, 0, 0]);
    const playerScale = normalizePlayerScale(player.scale);
    this.playerScale = getCombinedCollisionScale({
      scale: playerScale,
      collision: player.collision,
    });
    this.playerConfig = player;

    this.buildStaticColliders(
      mapConfig,
    );
  }

  buildStaticColliders(mapConfig) {
    for (
      const entity of mapConfig?.entities ?? []
    ) {
      if (!entity?.collision?.enabled) {
        continue;
      }

      const body = new Body({
        mass: 0,
        type: Body.STATIC,
        allowSleep: true,
      });

      const material =
        createMaterial(
          `static-${entity.id ?? 'collider'}`,
          entity.collision.friction,
          entity.collision.restitution,
        );

      body.material = material;

      const shapeType =
        getCollisionShape(entity);

      const scale =
        getCombinedScale(entity);

      let shape = null;

      if (shapeType === 'trimesh') {
        const surfaceMesh = entity.collision.surface?.mesh;
        const generatedSurfaceMesh = surfaceMesh
          ? null
          : createSurfaceMesh(entity.collision.surface);
        shape = createTrimeshShape(
          surfaceMesh ?? generatedSurfaceMesh ?? entity.collision.mesh,
          surfaceMesh ? [1, 1, 1] : scale,
        );
        if (!shape) continue;
        body.addShape(createReverseTrimeshShape(shape));
        body.addShape(shape);
      } else if (shapeType === 'capsule') {
        getColliderDescriptors('capsule', scale)
          .forEach((descriptor) => body.addShape(descriptor));
      } else {
        addBoxShape(
          body,
          scale,
        );
      }
      setBodyTransform(
        body,
        entity,
      );

      this.world.addBody(
        body,
      );

      this.staticBodies.set(
        body,
        {
          id: entity.id ?? null,
          name:
            entity.name ??
            entity.id ??
            'objeto sem nome',
          entity,
        },
      );

      this.world.addContactMaterial(
        new ContactMaterial(
          this.playerMaterial,
          material,
          {
            friction: 0,
            restitution: 0,
            contactEquationStiffness: 1e7,
            contactEquationRelaxation: 3,
          },
        ),
      );
    }
  }

  createPlayerBody(id, position) {
    const body = new Body({
      mass: PLAYER_MASS,
      fixedRotation: true,
      allowSleep: false,
      linearDamping: PLAYER_LINEAR_DAMPING,
      angularDamping: PLAYER_ANGULAR_DAMPING,
    });

    addPlayerCollider(body, this.playerConfig, this.playerScale);

    body.material =
      this.playerMaterial;

    body.position.set(
      toFiniteNumber(position?.[0]),
      toFiniteNumber(position?.[1]),
      toFiniteNumber(position?.[2]),
    );

    body.velocity.set(
      0,
      0,
      0,
    );

    body.angularVelocity.set(
      0,
      0,
      0,
    );

    this.world.addBody(
      body,
    );

    this.bodies.set(
      id,
      body,
    );

    return body;
  }

  getPlayerBody(id, position = [0, 0, 0]) {
    let body =
      this.bodies.get(id);

    if (!body) {
      body =
        this.createPlayerBody(
          id,
          position,
        );
    }

    return body;
  }

  movePlayer(
    id,
    from,
    angle,
    speed = 3,
    deltaSeconds = FIXED_TIME_STEP,
    advanceWorld = true,
  ) {
    this.lastCollision = null;

    const body =
      this.getPlayerBody(
        id,
        from,
      );

    const safeAngle =
      Number.isFinite(Number(angle))
        ? Number(angle)
        : 0;

    const safeSpeed =
      Math.max(
        0,
        toFiniteNumber(
          speed,
          0,
        ),
      );

    const inputX =
      Math.sin(safeAngle);

    const inputZ =
      Math.cos(safeAngle);

    const safeDelta =
      Math.min(
        0.1,
        Math.max(
          0,
          toFiniteNumber(
            deltaSeconds,
            FIXED_TIME_STEP,
          ),
        ),
      );

    this.playerInputs.set(
      id,
      {
        x: inputX,
        z: inputZ,
        speed: safeSpeed,
        deltaSeconds: safeDelta,
      },
    );

    body.wakeUp();

    body.velocity.x =
      inputX * safeSpeed;

    body.velocity.z =
      inputZ * safeSpeed;

    if (advanceWorld) this.step(safeDelta);

    return [
      body.position.x,
      body.position.y,
      body.position.z,
    ];
  }

  stopPlayer(id) {
    const body =
      this.bodies.get(id);

    if (!body) {
      return;
    }

    body.velocity.x = 0;
    body.velocity.z = 0;

    this.playerInputs.delete(
      id,
    );

    body.wakeUp();
  }

  syncPlayerHorizontalPosition(id, position) {
    const body = this.bodies.get(id);
    if (!body || !Array.isArray(position)) return;
    body.position.x = toFiniteNumber(position[0], body.position.x);
    body.position.z = toFiniteNumber(position[2], body.position.z);
  }

  updatePlayerVelocity(
    id,
    angle,
    speed = 0,
  ) {
    const body =
      this.bodies.get(id);

    if (!body) {
      return;
    }

    const safeAngle =
      Number.isFinite(Number(angle))
        ? Number(angle)
        : 0;

    const safeSpeed =
      Math.max(
        0,
        toFiniteNumber(
          speed,
          0,
        ),
      );

    body.velocity.x =
      Math.sin(safeAngle) *
      safeSpeed;

    body.velocity.z =
      Math.cos(safeAngle) *
      safeSpeed;

    body.wakeUp();
  }

  applyPlayerInputs() {
    for (
      const [id, input]
      of this.playerInputs
    ) {
      const body =
        this.bodies.get(id);

      if (!body) {
        continue;
      }

      body.velocity.x =
        input.x *
        input.speed;

      body.velocity.z =
        input.z *
        input.speed;

      body.wakeUp();
    }
  }

  getPlayerHalfExtents() {
    const [x, y, z] = this.playerScale ?? [0.7, 1.4, 0.7];
    if (this.playerConfig?.collision?.shape === 'capsule') {
      const radius = Math.max(0.2, Math.min(Math.abs(Number(x) || 0.7), Math.abs(Number(z) || 0.7)) * 0.5);
      const height = Math.max(radius * 2, Math.abs(Number(y) || 1.4));
      return { x: radius, y: height * 0.5, z: radius };
    }
    return {
      x: Math.abs(Number(x) || 0.35) * 0.5,
      y: Math.abs(Number(y) || 0.7) * 0.5,
      z: Math.abs(Number(z) || 0.35) * 0.5,
    };
  }

  getPlayerCollisionOffset() {
    return getVector3(this.playerConfig?.collision?.offset, [0, 0, 0]);
  }

  getStaticBoxBounds(staticBody) {
    if (!staticBody) {
      return null;
    }

    const info =
      this.staticBodies.get(staticBody) ?? null;

    const entity = info?.entity ?? null;
    const center = [
      staticBody.position.x,
      staticBody.position.y,
      staticBody.position.z,
    ];

    const meshVertices = entity?.collision?.surface?.mesh?.vertices;
    if (Array.isArray(meshVertices) && meshVertices.length >= 9 && meshVertices.length % 3 === 0) {
      const minimum = [Infinity, Infinity, Infinity];
      const maximum = [-Infinity, -Infinity, -Infinity];
      for (let index = 0; index < meshVertices.length; index += 3) {
        for (let axis = 0; axis < 3; axis += 1) {
          const value = Number(meshVertices[index + axis]);
          if (!Number.isFinite(value)) continue;
          minimum[axis] = Math.min(minimum[axis], value);
          maximum[axis] = Math.max(maximum[axis], value);
        }
      }
      if (minimum.every(Number.isFinite) && maximum.every(Number.isFinite)) {
        const meshCenter = [0, 1, 2].map((axis) => (minimum[axis] + maximum[axis]) * 0.5);
        const meshHalfExtents = [0, 1, 2].map((axis) => Math.max(0.01, (maximum[axis] - minimum[axis]) * 0.5));
        return {
          minX: center[0] + meshCenter[0] - meshHalfExtents[0],
          maxX: center[0] + meshCenter[0] + meshHalfExtents[0],
          minY: center[1] + meshCenter[1] - meshHalfExtents[1],
          maxY: center[1] + meshCenter[1] + meshHalfExtents[1],
          minZ: center[2] + meshCenter[2] - meshHalfExtents[2],
          maxZ: center[2] + meshCenter[2] + meshHalfExtents[2],
          center,
          halfExtents: meshHalfExtents,
        };
      }
    }

    const scale = getCombinedScale(entity ?? { scale: [1, 1, 1] });
    const halfExtents = (staticBody.shapes[0]?.shape?.halfExtents ?? [
      scale[0] * 0.5,
      scale[1] * 0.5,
      scale[2] * 0.5,
    ]).map((value) => Math.abs(Number(value) || 0.5));

    return {
      minX: center[0] - halfExtents[0],
      maxX: center[0] + halfExtents[0],
      minY: center[1] - halfExtents[1],
      maxY: center[1] + halfExtents[1],
      minZ: center[2] - halfExtents[2],
      maxZ: center[2] + halfExtents[2],
      center,
      halfExtents,
    };
  }

  sampleSurfaceHeight(entity, x, z) {
    if (!entity?.collision?.surface) {
      return null;
    }

    const surface = entity.collision.surface;
    const entityPosition = getVector3(entity.position, [0, 0, 0]);
    const localX = x - entityPosition[0];
    const localZ = z - entityPosition[2];
    const meshHeight = sampleMeshHeight(surface.mesh, localX, localZ);
    if (Number.isFinite(meshHeight)) return entityPosition[1] + meshHeight;
    const columns = Math.floor(Number(surface.columns));
    const rows = Math.floor(Number(surface.rows));
    const heights = Array.isArray(surface.heights) ? surface.heights : [];
    const valid = Array.isArray(surface.valid) ? surface.valid : [];

    if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 2 || rows < 2 || heights.length !== columns * rows) {
      return null;
    }

    const minX = Number(surface.minX);
    const maxX = Number(surface.maxX);
    const minZ = Number(surface.minZ);
    const maxZ = Number(surface.maxZ);
    if (![minX, maxX, minZ, maxZ].every(Number.isFinite) || maxX <= minX || maxZ <= minZ) {
      return null;
    }

    const clampedX = Math.min(Math.max(localX, minX), maxX);
    const clampedZ = Math.min(Math.max(localZ, minZ), maxZ);
    const u = columns === 1 ? 0 : (clampedX - minX) / (maxX - minX) * (columns - 1);
    const v = rows === 1 ? 0 : (clampedZ - minZ) / (maxZ - minZ) * (rows - 1);
    const xIndex = Math.min(columns - 1, Math.max(0, Math.floor(u)));
    const zIndex = Math.min(rows - 1, Math.max(0, Math.floor(v)));
    const fx = u - xIndex;
    const fz = v - zIndex;
    const cell = [
      zIndex * columns + xIndex,
      zIndex * columns + Math.min(columns - 1, xIndex + 1),
      Math.min(rows - 1, zIndex + 1) * columns + xIndex,
      Math.min(rows - 1, zIndex + 1) * columns + Math.min(columns - 1, xIndex + 1),
    ];

    const candidates = cell.map((index) => {
      if (valid.length === heights.length && valid[index] === false) {
        return null;
      }
      return Number(heights[index]);
    });

    if (candidates.some((value) => value === null || !Number.isFinite(value))) {
      return null;
    }

    const h00 = candidates[0];
    const h10 = candidates[1];
    const h01 = candidates[2];
    const h11 = candidates[3];
    const first = h00 * (1 - fx) + h10 * fx;
    const second = h01 * (1 - fx) + h11 * fx;
    return entityPosition[1] + first * (1 - fz) + second * fz;
  }

  resolvePlayerCollision(body, previousPosition) {
    if (!body) {
      return null;
    }

    const half = this.getPlayerHalfExtents();
    const offset = this.getPlayerCollisionOffset();
    const playerMin = {
      x: body.position.x + offset[0] - half.x,
      y: body.position.y + offset[1] - half.y,
      z: body.position.z + offset[2] - half.z,
    };
    const playerMax = {
      x: body.position.x + offset[0] + half.x,
      y: body.position.y + offset[1] + half.y,
      z: body.position.z + offset[2] + half.z,
    };

    let closestCollision = null;
    let bestOverlap = Infinity;

    for (const [staticBody, info] of this.staticBodies.entries()) {
      const entity = info?.entity;
      const bounds = this.getStaticBoxBounds(staticBody);
      if (!bounds) {
        continue;
      }

      const collisionX = body.position.x + offset[0];
      const collisionZ = body.position.z + offset[2];
      const surfaceHeight = entity?.collision?.surface
        ? this.sampleSurfaceHeight(entity, collisionX, collisionZ)
        : null;
      if (Number.isFinite(surfaceHeight)) {
        const groundY = surfaceHeight + half.y - offset[1];
        const wasAboveGround = Number(previousPosition?.y ?? body.position.y) + offset[1] >= surfaceHeight - 0.2;
        const isWithinBoundsX = collisionX >= bounds.minX - half.x && collisionX <= bounds.maxX + half.x;
        const isWithinBoundsZ = collisionZ >= bounds.minZ - half.z && collisionZ <= bounds.maxZ + half.z;
        if (isWithinBoundsX && isWithinBoundsZ && body.velocity.y <= 0 && wasAboveGround) {
          const nextY = Math.max(body.position.y, groundY);
          const penetration = Math.abs(nextY - body.position.y);
          if (penetration < bestOverlap) {
            bestOverlap = penetration;
            closestCollision = { ...info, playerBody: body, normal: { x: 0, y: 1, z: 0 }, type: 'surface' };
          }
          body.position.y = nextY;
          body.velocity.y = Math.max(0, body.velocity.y);
        }
      }

      if (entity?.collision?.shape === 'model') {
        continue;
      }

      const overlapX = Math.min(playerMax.x - bounds.minX, bounds.maxX - playerMin.x);
      const overlapY = Math.min(playerMax.y - bounds.minY, bounds.maxY - playerMin.y);
      const overlapZ = Math.min(playerMax.z - bounds.minZ, bounds.maxZ - playerMin.z);

      const intersects =
        playerMin.x < bounds.maxX && playerMax.x > bounds.minX &&
        playerMin.y < bounds.maxY && playerMax.y > bounds.minY &&
        playerMin.z < bounds.maxZ && playerMax.z > bounds.minZ;

      if (!intersects) {
        continue;
      }

      const axis = [
        ['x', overlapX],
        ['y', overlapY],
        ['z', overlapZ],
      ].sort((a, b) => a[1] - b[1])[0];

      if (axis[0] === 'y') {
        const previousCenterY = (previousPosition?.y ?? body.position.y) + offset[1];
        const previousAbove = previousCenterY >= bounds.maxY
          || previousCenterY >= bounds.minY;
        if (body.velocity.y <= 0 && previousAbove) {
          body.position.y = bounds.maxY + half.y - offset[1];
          body.velocity.y = Math.max(0, body.velocity.y);
        } else {
          body.position.y = bounds.minY - half.y - offset[1];
          body.velocity.y = Math.min(0, body.velocity.y);
        }

        closestCollision = { ...info, playerBody: body, normal: { x: 0, y: axis[0] === 'y' ? 1 : 0, z: 0 }, type: 'box' };
      } else if (axis[0] === 'x') {
        const previousLeft = (previousPosition?.x ?? body.position.x) <= bounds.minX;
        body.position.x = previousLeft
          ? bounds.minX - half.x - offset[0]
          : bounds.maxX + half.x - offset[0];
        body.velocity.x = 0;
        closestCollision = { ...info, playerBody: body, normal: { x: previousLeft ? -1 : 1, y: 0, z: 0 }, type: 'wall' };
      } else {
        const previousBack = (previousPosition?.z ?? body.position.z) <= bounds.minZ;
        body.position.z = previousBack
          ? bounds.minZ - half.z - offset[2]
          : bounds.maxZ + half.z - offset[2];
        body.velocity.z = 0;
        closestCollision = { ...info, playerBody: body, normal: { x: 0, y: 0, z: previousBack ? -1 : 1 }, type: 'wall' };
      }
    }

    return closestCollision;
  }

  step(deltaSeconds = FIXED_TIME_STEP) {
    const safeDelta =
      Math.min(
        0.1,
        Math.max(
          0,
          toFiniteNumber(
            deltaSeconds,
            FIXED_TIME_STEP,
          ),
        ),
      );

    this.lastDeltaSeconds =
      safeDelta;

    this.applyPlayerInputs();

    for (const body of this.bodies.values()) {
      if (!body || body.type === Body.STATIC) {
        continue;
      }

      if (body.position.y < -VOID_LIMIT) {
        body.position.set(...this.playerOrigin);
        body.velocity.set(0, 0, 0);
        body.rapierBody?.setTranslation({
          x: body.position.x,
          y: body.position.y,
          z: body.position.z,
        }, true);
        body.rapierBody?.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }

      const previousPosition = {
        x: body.position.x,
        y: body.position.y,
        z: body.position.z,
      };

      body.velocity.y -= PLAYER_GRAVITY * safeDelta;
      body.position.x += body.velocity.x * safeDelta;
      body.position.y += body.velocity.y * safeDelta;
      body.position.z += body.velocity.z * safeDelta;

      this.lastCollision = this.resolvePlayerCollision(body, previousPosition) ?? this.lastCollision;
    }

    this.lastCollision =
      this.lastCollision ?? this.findPlayerCollision();
  }

  findPlayerCollision() {
    for (
      const contact
      of this.world.contacts ?? []
    ) {
      let playerBody = null;
      let staticBody = null;

      if (
        this.bodies.has(
          contact.bi,
        ) &&
        this.staticBodies.has(
          contact.bj,
        )
      ) {
        playerBody =
          contact.bi;

        staticBody =
          contact.bj;
      } else if (
        this.bodies.has(
          contact.bj,
        ) &&
        this.staticBodies.has(
          contact.bi,
        )
      ) {
        playerBody =
          contact.bj;

        staticBody =
          contact.bi;
      }

      if (
        !playerBody ||
        !staticBody
      ) {
        continue;
      }

      const collider =
        this.staticBodies.get(
          staticBody,
        );

      if (!collider) {
        continue;
      }

      return {
        ...collider,
        playerBody,
      };
    }

    return null;
  }

  getPlayerPosition(id) {
    const body =
      this.bodies.get(id);

    if (!body) {
      return null;
    }

    return [
      body.position.x,
      body.position.y,
      body.position.z,
    ];
  }

  getPlayerVelocity(id) {
    const body =
      this.bodies.get(id);

    if (!body) {
      return null;
    }

    return [
      body.velocity.x,
      body.velocity.y,
      body.velocity.z,
    ];
  }

  getPlayerBodyState(id) {
    const body =
      this.bodies.get(id);

    if (!body) {
      return null;
    }

    return {
      position: [
        body.position.x,
        body.position.y,
        body.position.z,
      ],
      velocity: [
        body.velocity.x,
        body.velocity.y,
        body.velocity.z,
      ],
      sleeping:
        body.sleepState ===
        Body.SLEEPING,
    };
  }

  getDebugColliders() {
    const colliders = [];
    for (const [body, info] of this.staticBodies.entries()) {
      const entity = info?.entity ?? {};
      colliders.push({
        type: entity.collision?.shape === 'model' ? 'model' : 'box',
        name: info?.name ?? entity.id ?? 'collider',
        bounds: this.getStaticBoxBounds(body),
        position: [body.position.x, body.position.y, body.position.z],
        rotation: [...(entity.rotation ?? [0, 0, 0])],
        mesh: entity.collision?.surface?.mesh ?? null,
      });
    }

    for (const [id, body] of this.bodies.entries()) {
      const half = this.getPlayerHalfExtents();
      const offset = this.getPlayerCollisionOffset();
      const center = [
        body.position.x + offset[0],
        body.position.y + offset[1],
        body.position.z + offset[2],
      ];
      colliders.push({
        type: 'player',
        name: String(id),
        shape: this.playerConfig?.collision?.shape === 'capsule' ? 'capsule' : 'box',
        radius: half.x,
        height: half.y * 2,
        bounds: {
          minX: center[0] - half.x,
          maxX: center[0] + half.x,
          minY: center[1] - half.y,
          maxY: center[1] + half.y,
          minZ: center[2] - half.z,
          maxZ: center[2] + half.z,
        },
      });
    }

    return colliders;
  }

  teleportPlayer(
    id,
    position,
  ) {
    const body =
      this.bodies.get(id);

    if (!body) {
      return;
    }

    body.position.set(
      toFiniteNumber(position?.[0]),
      toFiniteNumber(position?.[1]),
      toFiniteNumber(position?.[2]),
    );

    body.velocity.set(
      0,
      0,
      0,
    );

    body.angularVelocity.set(
      0,
      0,
      0,
    );

    body.force.set(
      0,
      0,
      0,
    );

    body.torque.set(
      0,
      0,
      0,
    );

    body.wakeUp();
  }

  removePlayer(id) {
    const body =
      this.bodies.get(id);

    if (!body) {
      return;
    }

    this.world.removeBody(
      body,
    );

    this.bodies.delete(
      id,
    );

    this.playerInputs.delete(
      id,
    );
  }

  getStaticColliderInfo(body) {
    return this.staticBodies.get(
      body,
    ) ?? null;
  }

  get playerCount() {
    return this.bodies.size;
  }

  get colliderCount() {
    return this.staticBodies.size;
  }
}