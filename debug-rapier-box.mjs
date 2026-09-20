import RAPIER from '@dimforge/rapier3d/rapier.js';
await RAPIER.init?.();
const world = new RAPIER.World({ x: 0, y: -10, z: 0 });

const player = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
player.setTranslation(0, 8, 0, true);
const playerCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(0.35, 0.7, 0.35), player);

const box = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
box.setTranslation(0, 0, 0, true);
const boxCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(2, 1, 2), box);

for (let i = 0; i < 10; i += 1) {
  world.timestep = 0.1;
  world.step();
  const pos = player.translation();
  const vel = player.linvel();
  let touching = false;
  world.contactPair(playerCollider, boxCollider, (manifold) => {
    touching = true;
    const normal = manifold.normal?.();
    console.log('pair', i, 'normal', normal, 'pos', pos, 'vel', vel);
  });
  console.log('step', i, 'pos', pos, 'vel', vel, 'touching', touching);
}
