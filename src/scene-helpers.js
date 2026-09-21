import { PlayerHealthBar, Transform } from './components.js';
import { loadPlayer, spawnFallbackPlayer } from './player-factory.js';

const CAMERA_STORAGE_KEY = 'webgl-rpg-player-camera';

export function isMobileCameraViewport() {
  return typeof window !== 'undefined' && (
    window.matchMedia?.('(pointer: coarse) and (max-width: 900px)').matches
    || window.innerWidth <= 900
  );
}

function readCameraSettings() {
  try {
    const value = JSON.parse(window.localStorage.getItem(CAMERA_STORAGE_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return {};
    return ['distance', 'azimuth', 'elevation', 'targetHeight'].every((key) => Number.isFinite(Number(value[key])))
      ? Object.fromEntries(['distance', 'azimuth', 'elevation', 'targetHeight'].map((key) => [key, Number(value[key])]))
      : {};
  } catch {
    return {};
  }
}

function saveCameraSettings(settings) {
  try {
    window.localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // A câmera continua funcionando mesmo quando o armazenamento está bloqueado.
  }
}

export async function loadLocalPlayer(game, definition = {}, assetDefinitions = []) {
  try {
    const entity = await Promise.race([
      loadPlayer(game.world, game.textureManager, definition, assetDefinitions),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error('Tempo limite ao carregar o modelo 3D.')), 10000);
      }),
    ]);
    return { entity, usedFallback: false };
  } catch (error) {
    console.warn(`Modelo do jogador indisponível; usando fallback: ${error.message}`);
    return { entity: spawnFallbackPlayer(game.world, definition), usedFallback: true };
  }
}
// Adiciona o sistema de câmera para seguir o jogador, com configurações salvas no armazenamento local.
export function followPlayer(game, playerEntity) {
  const transform = game.world.getComponent(playerEntity, Transform);
  const settings = readCameraSettings();
  game.camera.orbitalFollow(transform, {
    distance: isMobileCameraViewport() ? 10 : 6,
    azimuth: 0,
    elevation: 0.35,
    targetHeight: 0.5,
    ...settings,
    onChange: saveCameraSettings,
  });
  saveCameraSettings(game.camera.getOrbitSettings());
}

// Remove a tag de nome do jogador local para manter o HUD mais limpo.
export function addPlayerNameTag() {
  return null;
}

export function addPlayerHealthBar(world, playerEntity, hp = 1, maxHp = 1) {
  world.addComponent(playerEntity, new PlayerHealthBar({ hp, maxHp }));
}

// Adiciona um marcador de movimento (linha) que segue o jogador, indicando a direção do movimento.
