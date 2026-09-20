import {
  Vec3,
  Material,
  ContactMaterial,
  Body,
  World,
} from './physics/helpers.js';
import { getColliderDescriptors, getCombinedCollisionScale } from '../../shared/collision-shape.js';
import { normalizePlayerScale } from '../../shared/player-size.js';

const FIXED_TIME_STEP = 1 / 60;
const MAX_SUB_STEPS = 3;
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

function addCapsule(body, scale = [1, 1, 1]) {
  const physicsScale = [scale[0], scale[1] + 0.4, scale[2]];
  getColliderDescriptors('capsule', physicsScale).forEach((descriptor) => body.addShape(descriptor));
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

    this.playerScale =
      normalizePlayerScale(
        mapConfig?.player?.scale,
      );

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
        addCapsule(
          body,
          scale,
        );
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

    addCapsule(
      body,
      this.playerScale,
    );

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

    this.step(safeDelta);

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

    this.world.step(
      FIXED_TIME_STEP,
      safeDelta,
      MAX_SUB_STEPS,
    );

    this.lastCollision =
      this.findPlayerCollision();
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