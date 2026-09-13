import { Camera } from './camera.js';
import { World } from './ecs.js';
import {
  PlayerPathSystem,
  AnimationSystem,
  MovementSystem,
  NetworkInterpolationSystem,
  SoundListenerSystem,
  SoundPlayerSystem,
} from './systems.js';
import { InputState } from './input.js';
import { TextureManager } from './texture-manager.js';
import { NameTagSystem } from './name-tags.js';
import { EnemyHoverSystem } from './enemy-hover.js';
import { customizeMap } from './map-customization.js';
import { ThreeRenderSystem } from './three-renderer.js';
import { createMobileControls } from './mobile-controls.js';

export async function createGame(canvas, mapConfig = null) {
  const camera = new Camera({ terrain: mapConfig?.terrain ?? null });
  const world = new World();
  const textureManager = new TextureManager();
  await customizeMap(world, mapConfig, textureManager);
  camera.setTerrain(mapConfig?.terrain ?? null);
  const pointLights = (mapConfig?.entities ?? [])
    .filter((entity) => entity.type === 'pointLight')
    .map((entity) => ({
      position: entity.position,
      color: entity.light?.color,
      intensity: entity.light?.intensity,
      distance: entity.light?.distance,
    }));
  const configuredLighting = mapConfig?.lighting ?? {};
  const lighting = {
    ...configuredLighting,
    ambientIntensity: Math.min(1.2, Math.max(0, Number(configuredLighting.ambientIntensity ?? 1) || 0)),
    directional: {
      ...(configuredLighting.directional ?? {}),
      intensity: Math.min(1.5, Math.max(0, Number(configuredLighting.directional?.intensity ?? 0.8) || 0)),
    },
    pointLights,
  };
  const fog = {
    color: mapConfig?.scene?.fog?.color ?? [0.63, 0.69, 0.68],
    near: Number(mapConfig?.scene?.fog?.near ?? 180),
    far: Number(mapConfig?.scene?.fog?.far ?? 850),
  };
  const input = new InputState();
  createMobileControls({ input, camera });
  const renderSystem = new ThreeRenderSystem(
    canvas,
    camera,
    mapConfig?.scene?.skyColor ?? [0.039, 0.051, 0.047],
    lighting,
    fog,
  );

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    camera.zoom(event.deltaY * 0.01);
  }, { passive: false });
  const rotateSensitivity = 0.005;
  let isRightDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 2) return;
    isRightDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  });
  window.addEventListener('mousemove', (event) => {
    if (!isRightDragging) return;
    camera.rotateOrbit(
      (event.clientX - lastMouseX) * rotateSensitivity,
      (event.clientY - lastMouseY) * rotateSensitivity,
    );
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 2) isRightDragging = false;
  });

  return {
    camera,
    world,
    textureManager,
    input,
    animationSystem: new AnimationSystem(),
    movementSystem: new MovementSystem(input, mapConfig),
    networkInterpolationSystem: new NetworkInterpolationSystem(),
    soundListenerSystem: new SoundListenerSystem(),
    soundPlayerSystem: new SoundPlayerSystem(),
    PlayerPathSystem: new PlayerPathSystem(canvas, camera),
    nameTagSystem: new NameTagSystem(canvas, camera),
    enemyHoverSystem: new EnemyHoverSystem(canvas, camera),
    renderSystem,
  };
}
