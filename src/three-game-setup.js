import { Camera } from './camera.js';
import { World } from './ecs.js';
import { normalizeMapConfig } from './map-config.js';
import {
  AnimationSystem,
  NetworkInterpolationSystem,
  PhysicsSystem,
  RayCastingSystem,
  SoundListenerSystem,
  SoundPlayerSystem,
} from './systems.js';
import { InputState } from './input.js';
import { TextureManager } from './texture-manager.js';
import { NameTagSystem } from './name-tags.js';
import { EnemyHoverSystem } from './enemy-hover.js';
import { customizeMap } from './map-customization.js';
import { ThreeRenderSystem } from './three-renderer.js';

export function handleCameraWheel(camera, event) {
  const hasTrackpadPan = Math.abs(event.deltaX) > 0.5 || (event.shiftKey && Math.abs(event.deltaY) > 0.5);
  const isPinchZoom = event.ctrlKey || event.metaKey;

  if (isPinchZoom) {
    event.preventDefault();
    camera.zoom(-event.deltaY * 0.01);
    return;
  }

  if (hasTrackpadPan) {
    event.preventDefault();
    camera.rotateOrbit(
      event.deltaX * 0.0035,
      -event.deltaY * 0.0035,
    );
    return;
  }

  event.preventDefault();
  camera.zoom(event.deltaY * 0.01);
}

export async function createGame(canvas, mapConfig = null) {
  const normalizedMapConfig = normalizeMapConfig(mapConfig ?? {}, null);
  const camera = new Camera();
  const world = new World();
  const textureManager = new TextureManager();
  await customizeMap(world, normalizedMapConfig, textureManager);
  const pointLights = (normalizedMapConfig?.entities ?? [])
    .filter((entity) => entity.type === 'pointLight')
    .map((entity) => ({
      position: entity.position,
      color: entity.light?.color,
      intensity: entity.light?.intensity,
      distance: entity.light?.distance,
    }));
  const configuredLighting = normalizedMapConfig?.lighting ?? {};
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
    color: normalizedMapConfig?.scene?.fog?.color ?? [0.63, 0.69, 0.68],
    near: Number(normalizedMapConfig?.scene?.fog?.near ?? 180),
    far: Number(normalizedMapConfig?.scene?.fog?.far ?? 850),
  };
  const input = new InputState(window, canvas);
  const renderSystem = new ThreeRenderSystem(
    canvas,
    camera,
    mapConfig?.scene?.skyColor ?? [0.039, 0.051, 0.047],
    lighting,
    fog,
  );
  const physicsSystem = new PhysicsSystem(normalizedMapConfig);

  canvas.addEventListener('wheel', (event) => {
    handleCameraWheel(camera, event);
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
    physicsSystem,
    rayCastingSystem: new RayCastingSystem(physicsSystem),
    networkInterpolationSystem: new NetworkInterpolationSystem(),
    soundListenerSystem: new SoundListenerSystem(),
    soundPlayerSystem: new SoundPlayerSystem(),
    nameTagSystem: new NameTagSystem(canvas, camera),
    enemyHoverSystem: new EnemyHoverSystem(canvas, camera),
    renderSystem,
  };
}
