import * as THREE from 'three';
import { normalizeTerrainForExport, isTerrainRemoved } from './terrain-state.js';
import { normalizeVector } from './editor-utils.js';
import {
  normalizeSounds,
  normalizeEnemyArea,
  normalizeEnemyType,
  normalizeLighting,
  normalizeSkyColor,
  normalizeFog,
  normalizePointLight,
} from './editor-scene-state.js';
import { buildDefaultWorldConfig, resolveWorldConfig } from './editor-scene-config.js';
import { readSavedMapConfig, saveMapConfig } from '../map-config.js';

export function createWorldController(getters, setters = {}) {
  const get = (key) => {
    const getter = getters[key];
    if (typeof getter !== 'function') return undefined;
    return getter();
  };

  const set = (key, value) => {
    const setter = setters[key];
    if (typeof setter === 'function') setter(value);
    return value;
  };

  function exportConfig() {
    const terrainConfig = get('terrainConfig');
    const player = get('player');
    const lighting = get('lighting');
    const skyColor = get('skyColor');
    const fog = get('fog');
    const sounds = get('sounds');
    const assets = get('assets');
    const entities = get('entities');
    const enemyTypes = get('enemyTypes');
    const enemyAreas = get('enemyAreas');
    const terrainRemoved = get('terrainRemoved');
    const ground = get('ground');

    const maxHp = Math.max(1, Number(player?.status?.maxHp) || 20);
    const terrainState = normalizeTerrainForExport(
      {
        ...terrainConfig,
        heights: Array.from((ground?.geometry?.attributes?.position?.array ?? [])).filter((_, index) => index % 3 === 1),
      },
      terrainRemoved,
    );

    return {
      format: 'webrpg.world',
      version: 2,
      scene: {
        name: 'main-world',
        units: 'world',
        skyColor: [...(skyColor ?? [0.3, 0.5, 0.8])],
        fog: {
          color: [...(fog?.color ?? [0.4, 0.5, 0.6])],
          near: Number(fog?.near ?? 15),
          far: Number(fog?.far ?? 90),
        },
      },
      terrain: terrainState,
      lighting: {
        ambientColor: [...(lighting?.ambientColor ?? [1, 1, 1])],
        ambientIntensity: Number(lighting?.ambientIntensity ?? 0.5),
        directional: {
          ...(lighting?.directional ?? {}),
          direction: [...(lighting?.directional?.direction ?? [-0.45, 0.85, 0.35])],
          color: [...(lighting?.directional?.color ?? [1, 1, 1])],
          castShadow: lighting?.directional?.castShadow !== false,
          enabled: lighting?.directional?.enabled !== false,
        },
        point: {
          ...(lighting?.point ?? {}),
          position: [...(lighting?.point?.position ?? [0, 4, 0])],
          color: [...(lighting?.point?.color ?? [1, 1, 1])],
        },
      },
      sounds: { ...(sounds ?? {}) },
      player: {
        ...(player ?? {}),
        maxHp,
        position: [...(player?.position ?? [0, 0, 0])],
        rotation: [...(player?.rotation ?? [0, 0, 0])],
        scale: [...(player?.scale ?? [1, 1, 1])],
        materials: (player?.materials ?? []).map((material) => ({
          ...material,
          diffuseColor: [...(material.diffuseColor ?? [1, 1, 1])],
          texture: material.texture ?? null,
        })),
        status: { ...(player?.status ?? {}), maxHp },
        inventory: [...(player?.inventory ?? [])],
        collision: { ...(player?.collision ?? {}) },
        animation: { ...(player?.animation ?? {}) },
      },
      assets: (assets ?? []).map(({ id, name, url, source, format, dependencies }) => ({ id, name, url, source, format, dependencies })),
      entities: (entities ?? []).filter((entity) => !entity.isPlayerPreview).map(({ object, ...entity }) => ({ ...entity })),
      enemyTypes: (enemyTypes ?? []).map((type, index) => normalizeEnemyType({ ...type, gold: { ...type.gold }, itemDrops: [...(type.itemDrops ?? [])] }, index)),
      enemyAreas: (enemyAreas ?? []).map((area) => ({ ...normalizeEnemyArea(area), center: [...area.center] })),
    };
  }

  function updateSummary() {
    const preview = document.querySelector('#json-preview');
    if (preview) preview.textContent = JSON.stringify(exportConfig(), null, 2);
    const entitySummary = document.querySelector('#entity-summary-count');
    if (entitySummary) entitySummary.textContent = String((get('entities') ?? []).filter((entity) => !entity.isPlayerPreview).length);
    const enemyAreaSummary = document.querySelector('#enemy-area-count');
    if (enemyAreaSummary) enemyAreaSummary.textContent = String((get('enemyAreas') ?? []).length);
  }

  async function loadWorld(config) {
    const terrainConfig = get('terrainConfig') ?? {};
    const incomingTerrain = Object.prototype.hasOwnProperty.call(config ?? {}, 'terrain') ? config.terrain : terrainConfig;
    const nextTerrainConfig = { ...terrainConfig, ...incomingTerrain };
    set('terrainConfig', nextTerrainConfig);
    set('terrainRemoved', isTerrainRemoved(incomingTerrain));

    const normalizedTerrain = { ...nextTerrainConfig };
    normalizedTerrain.width = Math.max(16, Number(normalizedTerrain.width) || 128);
    normalizedTerrain.depth = Math.max(16, Number(normalizedTerrain.depth) || 128);
    normalizedTerrain.segments = Math.max(8, Math.floor(Number(normalizedTerrain.segments) || 64));
    normalizedTerrain.amplitude = Math.max(0, Number(normalizedTerrain.amplitude) || 0.15);
    normalizedTerrain.frequency = Math.max(0.05, Number(normalizedTerrain.frequency) || 0.22);
    normalizedTerrain.color = /^#[0-9a-f]{6}$/i.test(normalizedTerrain.color) ? normalizedTerrain.color : '#202522';
    normalizedTerrain.brushRadius = Math.max(0.5, Number(normalizedTerrain.brushRadius) || 3);
    normalizedTerrain.brushStrength = Math.max(0.1, Number(normalizedTerrain.brushStrength) || 0.8);
    set('terrainConfig', normalizedTerrain);

    const ground = get('ground');
    if (ground) {
      ground.material.color.set(normalizedTerrain.color);
      ground.visible = !get('terrainRemoved');
      ground.userData.removed = get('terrainRemoved');
    }

    normalizeSkyColor(config?.scene?.skyColor);
    normalizeFog(config?.scene?.fog);
    const updateSceneAtmosphere = get('updateSceneAtmosphere');
    if (typeof updateSceneAtmosphere === 'function') updateSceneAtmosphere();
    normalizeLighting(config?.lighting);
    const updateLightingInspector = get('updateLightingInspector');
    if (typeof updateLightingInspector === 'function') updateLightingInspector();

    const nextSounds = normalizeSounds(config?.sounds);
    set('sounds', nextSounds);

    const nextPlayer = {
      ...(get('player') ?? {}),
      ...(config?.player ?? {}),
      position: normalizeVector(config?.player?.position, [0, 0, 0]),
      rotation: normalizeVector(config?.player?.rotation, [0, 0, 0]),
      scale: normalizeVector(config?.player?.scale, [1, 1, 1]),
      status: { ...((get('player') ?? {}).status ?? {}), ...(config?.player?.status ?? {}) },
      inventory: Array.isArray(config?.player?.inventory) ? config.player.inventory : [...((get('player') ?? {}).inventory ?? [])],
      collision: { ...((get('player') ?? {}).collision ?? {}), ...(config?.player?.collision ?? {}) },
      animation: { ...((get('player') ?? {}).animation ?? {}), ...(config?.player?.animation ?? {}) },
    };
    nextPlayer.status.maxHp = Math.max(1, Number(config?.player?.maxHp ?? nextPlayer.status.maxHp) || 20);
    nextPlayer.maxHp = nextPlayer.status.maxHp;
    set('player', nextPlayer);

    set('assets', (config?.assets ?? []).filter((asset) => asset.url && !asset.url.startsWith('blob:')).map((asset) => ({
      ...asset,
      format: asset.format ?? asset.name?.split('?')[0].split('.').pop().toLowerCase() ?? 'glb',
    })));
    set('enemyTypes', (Array.isArray(config?.enemyTypes) ? config.enemyTypes : []).map((type, index) => normalizeEnemyType({ ...type, gold: { ...type.gold }, itemDrops: [...(type.itemDrops ?? [])] }, index)));
    set('enemyAreas', (Array.isArray(config?.enemyAreas) ? config.enemyAreas : []).map((area) => normalizeEnemyArea({ ...area })));

    const entityGroup = get('entityGroup');
    if (entityGroup) entityGroup.clear();
    set('entities', []);
    set('selectedEntityId', null);
    set('selectedEnemyAreaId', null);

    const assets = get('assets') ?? [];
    for (const definition of config?.entities ?? []) {
      if (!definition || typeof definition !== 'object') continue;
      if (definition.type === 'pointLight') {
        const object = new THREE.PointLight(
          new THREE.Color(...(definition.light?.color ?? [1, 0.7, 0.45])).getHex(),
          Number(definition.light?.intensity ?? 2),
          Number(definition.light?.distance ?? 18),
        );
        object.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(...(definition.light?.color ?? [1, 0.7, 0.45])) })));
        const addEntity = get('addEntity');
        if (typeof addEntity === 'function') addEntity({ ...definition, object }, object);
      } else {
        const asset = assets.find((item) => item.id === definition.assetId);
        const instantiateAsset = get('instantiateAsset');
        if (asset && typeof instantiateAsset === 'function') {
          await instantiateAsset({ ...asset, _definition: definition });
        } else if (definition.primitive) {
          const createPrimitiveObject = get('createPrimitiveObject');
          if (typeof createPrimitiveObject === 'function') {
            const object = createPrimitiveObject(definition.primitive);
            const addEntity = get('addEntity');
            if (object && typeof addEntity === 'function') addEntity({ ...definition, name: definition.name ?? 'Entidade', object }, object);
          }
        } else {
          const addEntity = get('addEntity');
          if (typeof addEntity === 'function') addEntity({ ...definition, object: null });
        }
      }
    }

    const refreshPlayerPreview = get('refreshPlayerPreview');
    if (typeof refreshPlayerPreview === 'function') await refreshPlayerPreview();

    const selectEntity = get('selectEntity');
    if (typeof selectEntity === 'function') selectEntity(null);
    updateSummary();
  }

  async function loadSavedWorld() {
    const httpUrl = get('httpUrl');
    const response = await fetch(`${httpUrl}/api/map-config`, {
      credentials: 'include',
      cache: 'no-store',
    }).catch(() => null);
    const remoteConfig = response?.ok ? await response.json().catch(() => null) : null;
    const savedConfig = readSavedMapConfig();
    const fallbackConfig = buildDefaultWorldConfig();
    const config = resolveWorldConfig(
      remoteConfig && (remoteConfig.entities || remoteConfig.terrain || remoteConfig.assets || remoteConfig.enemyAreas)
        ? remoteConfig
        : (savedConfig && (savedConfig.entities || savedConfig.terrain || savedConfig.assets || savedConfig.enemyAreas)
          ? savedConfig
          : fallbackConfig),
      fallbackConfig,
    );
    await loadWorld(config);
  }

  function download() {
    const blob = new Blob([JSON.stringify(exportConfig(), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'main-world.world';
    link.click();
    URL.revokeObjectURL(link.href);
    const setStatus = get('setStatus');
    if (typeof setStatus === 'function') setStatus('Cena .world exportada');
  }

  async function applyToGame() {
    const httpUrl = get('httpUrl');
    const config = exportConfig();
    const response = await fetch(`${httpUrl}/api/map-config`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(config),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const setStatus = get('setStatus');
      if (typeof setStatus === 'function') setStatus(result?.error ?? `Não foi possível aplicar o mundo (HTTP ${response.status})`);
      return;
    }
    try { saveMapConfig(config); } catch {}
    const setStatus = get('setStatus');
    if (typeof setStatus === 'function') setStatus('Mundo aplicado no jogo');
  }

  return {
    exportConfig,
    updateSummary,
    loadWorld,
    loadSavedWorld,
    download,
    applyToGame,
  };
}
