import * as CANNON from 'cannon-es';
import {
  canTraverseTerrain,
  PLAYER_HEIGHT,
  sampleTerrainHeight,
} from '../shared/terrain-height.js';

const PLAYER_RADIUS = 0.35;
const PLAYER_COLLISION_HEIGHT = 1.4;

function addCapsule(body, radius = PLAYER_RADIUS, height = PLAYER_COLLISION_HEIGHT) {
  const cylinderHeight = Math.max(0.001, height - radius * 2);

  body.addShape(
    new CANNON.Cylinder(
      radius,
      radius,
      cylinderHeight,
      12
    )
  );

  body.addShape(
    new CANNON.Sphere(radius),
    new CANNON.Vec3(0, cylinderHeight * 0.5, 0)
  );

  body.addShape(
    new CANNON.Sphere(radius),
    new CANNON.Vec3(0, -cylinderHeight * 0.5, 0)
  );
}

function isGroundSurface(entity) {
  return entity?.primitive === 'plane'
    || entity?.collision?.surface === 'ground';
}

function getCollisionScale(entity) {
  const scale = entity?.collision?.scale ?? [1, 1, 1];

  return scale.map((value) =>
    Math.max(0.01, Math.abs(Number(value) || 1))
  );
}

function getStaticColliderBounds(entity) {
  if (!entity?.collision?.enabled || !Array.isArray(entity.position)) {
    return null;
  }

  const scale = entity.scale ?? [1, 1, 1];
  const collisionScale = getCollisionScale(entity);
  const offset = entity.collision.offset ?? [0, 0, 0];

  const halfX = Math.max(
    0.05,
    Math.abs(Number(scale[0]) || 1) *
      collisionScale[0] *
      0.5
  );

  const halfY = isGroundSurface(entity)
    ? 0.05
    : Math.max(
        0.05,
        Math.abs(Number(scale[1]) || 1) *
          collisionScale[1] *
          0.5
      );

  const halfZ = Math.max(
    0.05,
    Math.abs(Number(scale[2]) || 1) *
      collisionScale[2] *
      0.5
  );

  return {
    minX:
      entity.position[0] +
      (Number(offset[0]) || 0) -
      halfX,

    maxX:
      entity.position[0] +
      (Number(offset[0]) || 0) +
      halfX,

    minY:
      entity.position[1] +
      (Number(offset[1]) || 0) -
      halfY,

    maxY:
      entity.position[1] +
      (Number(offset[1]) || 0) +
      halfY,

    minZ:
      entity.position[2] +
      (Number(offset[2]) || 0) -
      halfZ,

    maxZ:
      entity.position[2] +
      (Number(offset[2]) || 0) +
      halfZ,
  };
}

function getPlayerFootY(position) {
  return Number(position[1] ?? 0) - PLAYER_HEIGHT / 2;
}

function isOnTopOfCollider(position, collider) {
  const centerY = Number(position[1] ?? 0);
  const footY = centerY - PLAYER_HEIGHT / 2;

  return (
    footY >= collider.maxY - 0.2 &&
    footY <= collider.maxY + 0.7
  );
}

function collidesWithStaticColliders(
  from,
  to,
  radius,
  colliders
) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];

  const steps = Math.max(
    2,
    Math.ceil(Math.hypot(dx, dz) / 0.15)
  );

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;

    const position = [
      from[0] + dx * t,
      from[1],
      from[2] + dz * t,
    ];

    const blocked = colliders.some((collider) => {
      if (!collider) return false;

      const minX = collider.minX - radius;
      const maxX = collider.maxX + radius;

      const minZ = collider.minZ - radius;
      const maxZ = collider.maxZ + radius;

      const insideXZ =
        position[0] >= minX &&
        position[0] <= maxX &&
        position[2] >= minZ &&
        position[2] <= maxZ;

      if (!insideXZ) return false;

      const standingOnTop =
        isOnTopOfCollider(position, collider);

      if (standingOnTop) {
        return false;
      }

      if (
        position[1] >
        collider.maxY + PLAYER_HEIGHT * 0.7
      ) {
        return false;
      }

      const shallowFloor =
        collider.maxY <= from[1] + 0.1 &&
        collider.maxY - collider.minY <= 0.5;

      if (shallowFloor) {
        return false;
      }

      return true;
    });

    if (blocked) {
      return true;
    }
  }

  return false;
}

function sampleSurfaceHeightAt(
  position,
  terrain,
  colliders
) {
  let bestHeight = sampleTerrainHeight(
    terrain,
    position[0],
    position[2]
  );

  for (const collider of colliders) {
    if (!collider) continue;

    const insideXZ =
      position[0] >= collider.minX &&
      position[0] <= collider.maxX &&
      position[2] >= collider.minZ &&
      position[2] <= collider.maxZ;

    if (!insideXZ) continue;

    if (!isOnTopOfCollider(position, collider)) {
      continue;
    }

    bestHeight = Math.max(
      bestHeight ?? Number.NEGATIVE_INFINITY,
      collider.maxY
    );
  }

  return bestHeight;
}

function samplePathSurfaceHeight(
  from,
  to,
  terrain,
  colliders
) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];

  const steps = Math.max(
    2,
    Math.ceil(Math.hypot(dx, dz) / 0.2)
  );

  let highest = null;

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;

    const position = [
      from[0] + dx * progress,
      from[1],
      from[2] + dz * progress,
    ];

    const surfaceHeight = sampleSurfaceHeightAt(
      position,
      terrain,
      colliders
    );

    if (surfaceHeight !== null) {
      highest =
        highest === null
          ? surfaceHeight
          : Math.max(highest, surfaceHeight);
    }
  }

  return highest;
}

function addStaticColliders(
  world,
  mapConfig,
  playerMaterial
) {
  for (const entity of mapConfig?.entities ?? []) {
    if (!entity.collision?.enabled) {
      continue;
    }

    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
    });

    const material = new CANNON.Material(
      `static-${entity.id ?? 'collider'}`
    );

    material.friction = Math.min(
      1,
      Math.max(
        0,
        Number(entity.collision.friction ?? 0.3) || 0
      )
    );

    material.restitution = Math.min(
      1,
      Math.max(
        0,
        Number(entity.collision.restitution ?? 0) || 0
      )
    );

    const scale = entity.scale ?? [1, 1, 1];
    const collisionScale =
      getCollisionScale(entity);

    if (
      isGroundSurface(entity) ||
      Math.abs(Number(scale[1]) || 1) *
        collisionScale[1] <= 0.5
    ) {
      material.friction = 0;
    }

    body.material = material;

    if (entity.collision.shape === 'capsule') {
      const capsuleScale = scale.map(
        (value, index) =>
          value * collisionScale[index]
      );

      const radius = Math.max(
        0.05,
        Math.min(
          Math.abs(capsuleScale[0]),
          Math.abs(capsuleScale[2])
        ) * 0.5
      );

      const height = Math.max(
        radius * 2,
        Math.abs(capsuleScale[1])
      );

      addCapsule(
        body,
        radius,
        height
      );
    } else {
      body.addShape(
        new CANNON.Box(
          new CANNON.Vec3(
            Math.max(
              0.05,
              Math.abs(scale[0] ?? 1) *
                collisionScale[0] *
                0.5
            ),

            isGroundSurface(entity)
              ? 0.05
              : Math.max(
                  0.05,
                  Math.abs(scale[1] ?? 1) *
                    collisionScale[1] *
                    0.5
                ),

            Math.max(
              0.05,
              Math.abs(scale[2] ?? 1) *
                collisionScale[2] *
                0.5
            )
          )
        )
      );
    }

    const offset =
      entity.collision.offset ?? [0, 0, 0];

    body.position.set(
      entity.position[0] +
        (Number(offset[0]) || 0),

      entity.position[1] +
        (Number(offset[1]) || 0),

      entity.position[2] +
        (Number(offset[2]) || 0)
    );

    body.quaternion.setFromEuler(
      ...(entity.rotation ?? [0, 0, 0])
    );

    world.addBody(body);

    world.addContactMaterial(
      new CANNON.ContactMaterial(
        playerMaterial,
        material,
        {
          friction: material.friction,
          restitution: material.restitution,
        }
      )
    );
  }
}

function addGroundCollider(
  world,
  playerMaterial
) {
  const material =
    new CANNON.Material('ground');

  material.friction = 0;
  material.restitution = 0;

  const body = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC,
    material,
  });

  body.addShape(
    new CANNON.Box(
      new CANNON.Vec3(
        1000,
        0.1,
        1000
      )
    )
  );

  body.position.set(
    0,
    -0.8,
    0
  );

  world.addBody(body);

  world.addContactMaterial(
    new CANNON.ContactMaterial(
      playerMaterial,
      material,
      {
        friction: 0,
        restitution: 0,
      }
    )
  );
}

export class PhysicsWorld {
  constructor(mapConfig = null) {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(
        0,
        -9.81,
        0
      ),
    });

    this.world.allowSleep = true;

    this.playerMaterial =
      new CANNON.Material('player');

    this.bodies = new Map();

    this.terrain =
      mapConfig?.terrain ?? null;

    this.staticColliders =
      (mapConfig?.entities ?? [])
        .map((entity) =>
          getStaticColliderBounds(entity)
        )
        .filter(Boolean);

    addStaticColliders(
      this.world,
      mapConfig,
      this.playerMaterial
    );

    addGroundCollider(
      this.world,
      this.playerMaterial
    );
  }

  addPlayer(id, position) {
    const body = new CANNON.Body({
      mass: 1,
      fixedRotation: true,
      allowSleep: false,
      linearDamping: 0,
      angularDamping: 1,
    });

    body.material =
      this.playerMaterial;

    addCapsule(
      body,
      PLAYER_RADIUS,
      PLAYER_COLLISION_HEIGHT
    );

    body.position.set(
      position[0],
      position[1],
      position[2]
    );

    body.velocity.set(
      0,
      0,
      0
    );

    this.world.addBody(body);
    this.bodies.set(id, body);

    return body;
  }

  stepPlayer(
    id,
    position,
    velocity = [0, 0, 0],
    deltaSeconds = 1 / 60,
    options = {}
  ) {
    const {
      ignoreTerrain = false,
    } = options;

    const body =
      this.bodies.get(id) ??
      this.addPlayer(
        id,
        position
      );

    const step = Math.max(
      0,
      Math.min(
        Number(deltaSeconds) || 0,
        0.1
      )
    );

    const horizontalVelocity = [
      Number(velocity[0]) || 0,
      Number(velocity[2]) || 0,
    ];

    const desired = [
      position[0] + horizontalVelocity[0] * step,
      position[1],
      position[2] + horizontalVelocity[1] * step,
    ];

    const blocked =
      collidesWithStaticColliders(
        position,
        desired,
        PLAYER_RADIUS,
        this.staticColliders
      );

    const terrainBlocked =
      !ignoreTerrain &&
      sampleTerrainHeight(
        this.terrain,
        position[0],
        position[2]
      ) !== null &&
      !canTraverseTerrain(
        this.terrain,
        position,
        desired
      );

    body.position.set(
      position[0],
      position[1],
      position[2]
    );
    body.velocity.set(
      0,
      0,
      0
    );

    if (!blocked && !terrainBlocked) {
      body.velocity.x = horizontalVelocity[0];
      body.velocity.z = horizontalVelocity[1];
    }

    body.wakeUp();

    if (step > 0) {
      this.world.step(
        1 / 60,
        step,
        8
      );
    }

    if (!ignoreTerrain) {
      const surfaceHeight =
        samplePathSurfaceHeight(
          position,
          [
            body.position.x,
            body.position.y,
            body.position.z,
          ],
          this.terrain,
          this.staticColliders
        );

      if (surfaceHeight !== null) {
        const groundY =
          surfaceHeight + PLAYER_HEIGHT / 2;

        if (body.position.y < groundY) {
          body.position.y = groundY;
          body.velocity.y = 0;
        }
      }
    }

    return [
      body.position.x,
      body.position.y,
      body.position.z,
    ];
  }

  movePlayer(
    id,
    from,
    to,
    deltaSeconds = 1 / 30,
    options = {}
  ) {
    const body =
      this.bodies.get(id) ??
      this.addPlayer(
        id,
        from
      );

    const {
      ignoreTerrain = false,
    } = options;

    const dt = Math.max(
      Number(deltaSeconds) || 0,
      1 / 60
    );

    const movementX =
      (to[0] - from[0]) /
      dt;

    const movementZ =
      (to[2] - from[2]) /
      dt;

    const blocked =
      collidesWithStaticColliders(
        from,
        to,
        PLAYER_RADIUS,
        this.staticColliders
      );

    const terrainBlocked =
      !ignoreTerrain &&
      sampleTerrainHeight(
        this.terrain,
        from[0],
        from[2]
      ) !== null &&
      !canTraverseTerrain(
        this.terrain,
        from,
        to
      );

    body.position.set(
      from[0],
      from[1],
      from[2]
    );
    body.velocity.set(
      0,
      0,
      0
    );

    if (!blocked && !terrainBlocked) {
      body.velocity.x = movementX;
      body.velocity.z = movementZ;
    }

    body.wakeUp();

    if (dt > 0) {
      this.world.step(
        1 / 60,
        dt,
        8
      );
    }

    if (!ignoreTerrain) {
      const surfaceHeight =
        samplePathSurfaceHeight(
          from,
          to,
          this.terrain,
          this.staticColliders
        );

      if (surfaceHeight !== null) {
        const groundY =
          surfaceHeight + PLAYER_HEIGHT / 2;

        if (body.position.y < groundY) {
          body.position.y = groundY;
          body.velocity.y = 0;
        }
      }
    }

    return [
      body.position.x,
      body.position.y,
      body.position.z,
    ];
  }
}