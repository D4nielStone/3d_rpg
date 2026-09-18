import * as CANNON from 'cannon-es';
import { normalizePlayerScale } from '../../shared/player-size.js';
import {
  canTraverseTerrain,
  PLAYER_HEIGHT,
  sampleTerrainHeight,
  TERRAIN_BASE_Y,
} from '../../shared/terrain-height.js';
import { sampleCollisionSurface } from '../../shared/collision-surface.js';
import {
  applyMovementVelocity,
  stepPhysicsWorld,
} from './movement.js';

const MAX_STEP_HEIGHT = 0.65;
const MAX_SURFACE_SLOPE = Math.PI / 4;

function addCapsule(body, scale = [1, 1, 1]) {
  const radius = Math.max(
    0.25,
    Math.min(
      Math.abs(scale[0] ?? 1),
      Math.abs(scale[2] ?? 1),
    ) * 0.5,
  );

  const height = Math.max(
    radius * 2,
    Math.abs(scale[1] ?? 1),
  );

  const cylinderHeight = Math.max(
    0,
    height - radius * 2,
  );

  body.addShape(
    new CANNON.Cylinder(
      radius,
      radius,
      cylinderHeight || 0.001,
      12,
    ),
  );

  if (cylinderHeight > 0) {
    body.addShape(
      new CANNON.Sphere(radius),
      new CANNON.Vec3(
        0,
        cylinderHeight * 0.5,
        0,
      ),
    );

    body.addShape(
      new CANNON.Sphere(radius),
      new CANNON.Vec3(
        0,
        -cylinderHeight * 0.5,
        0,
      ),
    );
  }
}

function getCollisionScale(entity) {
  const scale = entity?.collision?.scale ?? [1, 1, 1];

  return scale.map((value) =>
    Math.max(
      0.01,
      Math.abs(Number(value) || 1),
    ),
  );
}

function getStaticColliderBounds(entity) {
  if (
    !entity?.collision?.enabled ||
    !Array.isArray(entity.position)
  ) {
    return null;
  }

  const scale = entity.scale ?? [1, 1, 1];
  const collisionScale = getCollisionScale(entity);
  const offset = entity.collision.offset ?? [0, 0, 0];

  const halfX = Math.max(
    0.05,
    Math.abs(Number(scale[0]) || 1) *
      collisionScale[0] *
      0.5,
  );

  const halfY = Math.max(
    0.05,
    Math.abs(Number(scale[1]) || 1) *
      collisionScale[1] *
      0.5,
  );

  const halfZ = Math.max(
    0.05,
    Math.abs(Number(scale[2]) || 1) *
      collisionScale[2] *
      0.5,
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
    surface: entity.collision.surface ?? null,
  };
}

function collidesWithStaticColliders(
  from,
  to,
  radius,
  colliders,
) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];

  const steps = Math.max(
    2,
    Math.ceil(Math.hypot(dx, dz) / 0.15),
  );

  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;

    const x =
      from[0] +
      dx * progress;

    const z =
      from[2] +
      dz * progress;

    const blocked = colliders.find((collider) => {
      if (!collider) return false;

      if (
        collider.maxY <= from[1] + 0.1 &&
        collider.maxY - collider.minY <= 0.5
      ) {
        return false;
      }

      return (
        x >= collider.minX - radius &&
        x <= collider.maxX + radius &&
        z >= collider.minZ - radius &&
        z <= collider.maxZ + radius
      ) && collider.maxY - (from[1] - PLAYER_HEIGHT / 2) > MAX_STEP_HEIGHT;
    });

    if (blocked) {
        return true;
    }
  }

  return false;
}

function findTraversableStep(position, radius, colliders) {
  const footHeight = position[1] - PLAYER_HEIGHT / 2;
  return colliders.find((collider) => (
    collider
    && collider.maxY > footHeight
    && collider.maxY - footHeight <= MAX_STEP_HEIGHT
    && position[0] >= collider.minX - radius
    && position[0] <= collider.maxX + radius
    && position[2] >= collider.minZ - radius
    && position[2] <= collider.maxZ + radius
  )) ?? null;
}

function samplePlayerSurfaceHeight(surfaceColliders, position, radius = 0.35) {
  const offsets = [
    [0, 0],
    [radius, 0],
    [-radius, 0],
    [0, radius],
    [0, -radius],
  ];
  return surfaceColliders.reduce((highest, surface) => offsets.reduce((surfaceHighest, [offsetX, offsetZ]) => {
    const height = sampleCollisionSurface(surface, position[0] + offsetX, position[2] + offsetZ);
    return height === null ? surfaceHighest : Math.max(surfaceHighest, height);
  }, highest), null);
}

function addGroundCollider(
  world,
  playerMaterial,
) {
  return;
}

export class PhysicsWorld {
  constructor(mapConfig = null) {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(
        0,
        -9.81,
        0,
      ),
    });

    this.world.broadphase =
      new CANNON.SAPBroadphase(
        this.world,
      );

    this.world.allowSleep = true;

    this.world.defaultContactMaterial.friction = 0;
    this.world.defaultContactMaterial.restitution = 0;

    this.playerMaterial =
      new CANNON.Material('player');

    this.bodies = new Map();
    this.lastCollision = null;

    this.staticBodies = new Map();

    this.surfaceColliders =
      (mapConfig?.entities ?? [])
        .filter((entity) => entity.collision?.enabled && entity.collision?.surface)
        .map((entity) => {
          const surface = entity.collision.surface;
          const position = Array.isArray(entity.position) ? entity.position : [0, 0, 0];
          const offset = Array.isArray(entity.collision.offset) ? entity.collision.offset : [0, 0, 0];
          return {
            ...surface,
            minX: Number(surface.minX) + (Number(position[0]) || 0) + (Number(offset[0]) || 0),
            maxX: Number(surface.maxX) + (Number(position[0]) || 0) + (Number(offset[0]) || 0),
            minZ: Number(surface.minZ) + (Number(position[2]) || 0) + (Number(offset[2]) || 0),
            maxZ: Number(surface.maxZ) + (Number(position[2]) || 0) + (Number(offset[2]) || 0),
          };
        })
        .filter(Boolean);

    this.staticColliders =
      (mapConfig?.entities ?? [])
        .map((entity) =>
          getStaticColliderBounds(entity),
        )
        .filter((collider) => collider && !collider.surface);

    this.playerScale =
      normalizePlayerScale(
        mapConfig?.player?.scale,
      );

    this.terrain =
      mapConfig?.terrain ?? null;

    for (
      const entity of mapConfig?.entities ?? []
    ) {
      if (!entity.collision?.enabled) {
        continue;
      }

      if (entity.collision.surface) {
        const mesh = entity.collision.surface.mesh;
        if (!Array.isArray(mesh?.vertices) || !Array.isArray(mesh?.indices)
          || mesh.vertices.length < 9 || mesh.indices.length < 3) continue;

        const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
        const material = new CANNON.Material(`static-${entity.id ?? 'collider'}`);
        material.friction = Math.min(1, Math.max(0, Number(entity.collision.friction ?? 0.3) || 0));
        material.restitution = Math.min(1, Math.max(0, Number(entity.collision.restitution ?? 0) || 0));
        body.material = material;
        body.addShape(new CANNON.Trimesh(mesh.vertices, mesh.indices));

        const offset = entity.collision.offset ?? [0, 0, 0];
        body.position.set(
          (Number(entity.position?.[0]) || 0) + (Number(offset[0]) || 0),
          (Number(entity.position?.[1]) || 0) + (Number(offset[1]) || 0),
          (Number(entity.position?.[2]) || 0) + (Number(offset[2]) || 0),
        );
        body.quaternion.setFromEuler(...(entity.rotation ?? [0, 0, 0]));
        this.world.addBody(body);
        this.staticBodies.set(body, {
          id: entity.id ?? null,
          name: entity.name ?? entity.id ?? 'objeto sem nome',
        });
        this.world.addContactMaterial(new CANNON.ContactMaterial(this.playerMaterial, material, {
          friction: material.friction,
          restitution: material.restitution,
        }));
      }

      if (entity.collision.surface) {
        continue;
      }

      const scale =
        entity.scale ?? [1, 1, 1];

      const collisionScale =
        getCollisionScale(entity);

      const body =
        new CANNON.Body({
          mass: 0,
          type: CANNON.Body.STATIC,
        });

      const material =
        new CANNON.Material(
          `static-${entity.id ?? 'collider'}`,
        );

      material.friction =
        Math.min(
          1,
          Math.max(
            0,
            Number(
              entity.collision.friction ?? 0.3,
            ) || 0,
          ),
        );

      material.restitution =
        Math.min(
          1,
          Math.max(
            0,
            Number(
              entity.collision.restitution ?? 0,
            ) || 0,
          ),
        );

      if (
        Math.abs(
          Number(scale[1]) || 1,
        ) *
          collisionScale[1] <=
        0.5
      ) {
        material.friction = 0;
      }

      body.material = material;

      if (
        entity.collision.shape ===
        'capsule'
      ) {
        addCapsule(
          body,
          scale.map(
            (value, index) =>
              value *
              collisionScale[index],
          ),
        );
      } else {
        body.addShape(
          new CANNON.Box(
            new CANNON.Vec3(
              Math.max(
                0.05,
                Math.abs(
                  scale[0] ?? 1,
                ) *
                  collisionScale[0] *
                  0.5,
              ),

              Math.max(
                0.05,
                Math.abs(
                  scale[1] ?? 1,
                ) *
                  collisionScale[1] *
                  0.5,
              ),

              Math.max(
                0.05,
                Math.abs(
                  scale[2] ?? 1,
                ) *
                  collisionScale[2] *
                  0.5,
              ),
            ),
          ),

        );
      }

      const offset =
        entity.collision.offset ??
        [0, 0, 0];

      body.position.set(
        entity.position[0] +
          (Number(offset[0]) || 0),

        entity.position[1] +
          (Number(offset[1]) || 0),

        entity.position[2] +
          (Number(offset[2]) || 0),
      );

      body.quaternion.setFromEuler(
        ...(entity.rotation ?? [
          0,
          0,
          0,
        ]),
      );

      this.world.addBody(body);

      this.staticBodies.set(
        body,
        {
          id:
            entity.id ?? null,

          name:
            entity.name ??
            entity.id ??
            'objeto sem nome',
        },
      );

      this.world.addContactMaterial(
        new CANNON.ContactMaterial(
          this.playerMaterial,
          material,
          {
            friction:
              material.friction,

            restitution:
              material.restitution,
          },
        ),
      );
    }

    addGroundCollider(
      this.world,
      this.playerMaterial,
    );
  }

  movePlayer(
    id,
    from,
    angle,
    speed = 3,
    deltaSeconds = 1 / 60,
  ) {
    this.lastCollision = null;

    let body =
      this.bodies.get(id);

    if (!body) {
      body =
        new CANNON.Body({
          mass: 1,
          fixedRotation: true,
          allowSleep: false,
        });

      addCapsule(
        body,
        this.playerScale,
      );

      body.material =
        this.playerMaterial;

      body.linearDamping = 0;
      body.angularDamping = 1;

      this.world.addBody(body);

      this.bodies.set(
        id,
        body,
      );

      body.position.set(
        from[0],
        from[1],
        from[2],
      );
    }

    body.wakeUp();

    const previous = [
      body.position.x,
      body.position.y,
      body.position.z,
    ];
    const intendedPosition = [
      previous[0] + Math.sin(angle) * speed * deltaSeconds,
      previous[1],
      previous[2] + Math.cos(angle) * speed * deltaSeconds,
    ];
applyMovementVelocity(
  body,
  angle,
  speed,
  1,
);

const step = Math.min(
  Math.max(
    Number(deltaSeconds) || 1 / 60,
    1 / 120,
  ),
  0.1,
);
    const physicsSubSteps = Math.max(
      1,
      Math.ceil(Math.hypot(speed * step, speed * step) / 0.05),
    );
    const physicsStep = step / physicsSubSteps;
    for (let index = 0; index < physicsSubSteps; index += 1) {
      stepPhysicsWorld(this.world, physicsStep, physicsStep, 1);
    }

    const desired = [
      body.position.x,
      body.position.y,
      body.position.z,
    ];

    const terrainHeight =
      sampleTerrainHeight(
        this.terrain,
        desired[0],
        desired[2],
      );

    const groundY =
      terrainHeight !== null
        ? terrainHeight +
          PLAYER_HEIGHT / 2
        : null;

    const surfaceHeight = samplePlayerSurfaceHeight(this.surfaceColliders, desired);
    const surfaceGroundY =
      groundY === null
        ? (surfaceHeight === null ? null : surfaceHeight + PLAYER_HEIGHT / 2)
        : surfaceHeight === null
          ? groundY
          : Math.max(groundY, surfaceHeight + PLAYER_HEIGHT / 2);

    const stepCollider = findTraversableStep(
      intendedPosition,
      0.35,
      this.staticColliders,
    );

    if (stepCollider) {
      body.position.set(
        intendedPosition[0],
        stepCollider.maxY + PLAYER_HEIGHT / 2,
        intendedPosition[2],
      );
      body.velocity.set(0, 0, 0);
    } else if (
      collidesWithStaticColliders(
        previous,
        desired,
        0.35,
        this.staticColliders,
      )
    ) {
      body.position.set(
        previous[0],
        previous[1],
        previous[2],
      );

      body.velocity.x = 0;
      body.velocity.z = 0;
    } else if (
      terrainHeight !== null &&
      !canTraverseTerrain(
        this.terrain,
        previous,
        desired,
      )
    ) {
      body.position.set(
        previous[0],
        previous[1],
        previous[2],
      );

      body.velocity.x = 0;
      body.velocity.z = 0;
    } else if (!canTraverseSurface(this.surfaceColliders, previous, desired)) {
      body.position.set(previous[0], previous[1], previous[2]);
      body.velocity.x = 0;
      body.velocity.z = 0;
    } else {
      if (!hasBlockingStaticContact(this.world, body, this.staticBodies)) {
        body.position.x = desired[0];
        body.position.z = desired[2];
      }

      if (
        surfaceHeight !== null &&
        desired[1] <=
          surfaceGroundY + 0.1
      ) {
        body.position.y =
          surfaceGroundY;

        body.velocity.y = 0;
      } else if (
        groundY !== null &&
        terrainHeight !== null &&
        desired[1] <=
          groundY + 0.1
      ) {
        body.position.y =
          groundY;

        body.velocity.y = 0;
      } else {
        body.position.y =
          desired[1];
      }
    }

    for (
      const contact of
        this.world.contacts ?? []
    ) {
      const otherBody =
        contact.bi === body
          ? contact.bj
          : contact.bj === body
            ? contact.bi
            : null;

      const collider =
        otherBody
          ? this.staticBodies.get(
              otherBody,
            )
          : null;

      if (collider) {
        this.lastCollision =
          collider;

        break;
      }
    }

    return [
      body.position.x,
      body.position.y,
      body.position.z,
    ];
  }

  teleportPlayer(
    id,
    position,
  ) {
    const body =
      this.bodies.get(id);

    if (!body) return;

    body.position.set(
      position[0],
      position[1],
      position[2],
    );

    body.velocity.set(
      0,
      0,
      0,
    );

    body.force.set(
      0,
      0,
      0,
    );

    body.wakeUp();
  }
}

function canTraverseSurface(surfaceColliders, from, to) {
  const distance = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const steps = Math.max(2, Math.ceil(distance / 0.1));
  const maxHeightDelta = Math.tan(MAX_SURFACE_SLOPE) * (distance / steps);
  let previousHeight = samplePlayerSurfaceHeight(surfaceColliders, from);

  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const position = [
      from[0] + (to[0] - from[0]) * progress,
      from[1],
      from[2] + (to[2] - from[2]) * progress,
    ];
    const height = samplePlayerSurfaceHeight(surfaceColliders, position);
    if (height !== null && previousHeight !== null
      && Math.abs(height - previousHeight) > maxHeightDelta) {
      return false;
    }
    if (height !== null) previousHeight = height;
  }

  return true;
}

function hasBlockingStaticContact(world, body, staticBodies) {
  return (world.contacts ?? []).some((contact) => {
    const otherBody = contact.bi === body ? contact.bj : contact.bj === body ? contact.bi : null;
    if (!otherBody || !staticBodies.has(otherBody)) return false;
    const normalY = contact.bi === body ? contact.ni.y : -contact.ni.y;
    return Math.abs(normalY) < Math.cos(MAX_SURFACE_SLOPE);
  });
}