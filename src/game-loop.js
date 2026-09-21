import { SoundListener } from './components.js';

export function startGameLoop({
  world,
  animationSystem,
  physicsSystem,
  rayCastingSystem,
  networkInterpolationSystem,
  soundListenerSystem,
  soundPlayerSystem,
  multiplayerSystem,
  nameTagSystem,
  enemyHoverSystem,
  renderSystem,
}) {
  let previousTime = 0;

  function frame(time) {
    const deltaSeconds = Math.min((time - previousTime) * 0.001, 0.1);
    previousTime = time;

    // A ordem importa: movimento local, rede, interpolacao, marcador e renderizacao.
    physicsSystem.update(world, deltaSeconds);
    renderSystem.updatePhysicsDebug?.(physicsSystem.physicsWorld);
    animationSystem.update(world, deltaSeconds);
    networkInterpolationSystem.update(world, deltaSeconds);
    rayCastingSystem?.update(world);
    soundListenerSystem.update(world);
    const listener = world.query(SoundListener)[0];
    const listenerComponent = listener ? world.getComponent(listener, SoundListener) : null;
    soundPlayerSystem.update(world, listenerComponent?.context ?? null);
    renderSystem.syncCamera();
    enemyHoverSystem.update(world);
    multiplayerSystem.update(world, time);
    nameTagSystem.update(world);
    renderSystem.render(world, time);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}