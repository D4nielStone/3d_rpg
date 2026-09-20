import { PhysicsWorld } from './server/world/physics.js';

const physics = new PhysicsWorld({
  entities: [{
    id: 'vertical-box',
    position: [0, 0, 0],
    scale: [4, 2, 4],
    collision: { enabled: true, shape: 'box' },
  }],
});

let pos = [0, 8, 0];
for (let i = 0; i < 10; i += 1) {
  pos = physics.movePlayer('falling-box-player', pos, 0, 0, 0.1);
  console.log(i, JSON.stringify(pos), physics.lastCollision ? physics.lastCollision.id : null);
}
