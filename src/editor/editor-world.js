import * as THREE from 'three';
import { normalizeVector } from './editor-utils.js';
import {
  defaultEnemyTypes,
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
import { entitySnapshot } from './editor-entity-utils.js';
import { migrateWorldResources } from '../resources/resource-library.js';

export function createWorldController(getters, setters = {}) {
  const get = (key) => {
    const getter = getters[key];
    if (typeof getter !== 'function') return undefined;
    return getter();
  };

  const getCallback = (key) => (typeof getters[key] === 'function' ? getters[key] : undefined);

  const set = (key, value) => {
    const setter = setters[key];
    if (typeof setter === 'function') setter(value);
    return value;
  };

  function exportConfig() {
    const player = get('player');
    const lighting = get('lighting');
    const skyColor = get('skyColor');
    const fog = get('fog');
    const sounds = get('sounds');
    const shaders = get('shaders');
    const materials = get('materials');
    const assets = get('assets');
    const entities = get('entities');
    const enemyTypes = get('enemyTypes');
    const enemyAreas = get('enemyAreas');
    const maxHp = Math.max(1, Number(player?.status?.maxHp) || 20);
    return {
      format: 'webrpg.world',
      version: 3,
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
      resources: {
        shaders: (shaders ?? []).map((shader) => ({ ...shader, properties: { ...(shader.properties ?? {}) } })),
        materials: (materials ?? []).map((material) => ({
          ...material,
          parameters: { ...(material.parameters ?? {}) },
          state: { ...(material.state ?? {}) },
        })),
      },
      shaders: (shaders ?? []).map((shader) => ({ ...shader, properties: { ...(shader.properties ?? {}) } })),
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
        collision: {
          ...(player?.collision ?? {}),
          offset: [...(player?.collision?.offset ?? [0, 0, 0])],
          scale: [...(player?.collision?.scale ?? [1, 1, 1])],
        },
        animation: { ...(player?.animation ?? {}) },
      },
      assets: (assets ?? []).map(({ id, name, url, source, format, dependencies, kind, mime }) => ({ id, name, url, source, format, dependencies, kind, mime })),
      entities: (entities ?? [])
        .filter((entity) => !entity.isPlayerPreview)
        .map((entity) => entitySnapshot(entity)),
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
    const migratedConfig = migrateWorldResources(config);
    const nextSkyColor = normalizeSkyColor(migratedConfig.scene?.skyColor);
    set('skyColor', nextSkyColor);
    const nextFog = normalizeFog(migratedConfig.scene?.fog);
    set('fog', nextFog);
    const updateSceneAtmosphere = getCallback('updateSceneAtmosphere');
    if (typeof updateSceneAtmosphere === 'function') updateSceneAtmosphere();
    const nextLighting = normalizeLighting(migratedConfig.lighting);
    set('lighting', nextLighting);
    const updateLightingInspector = getCallback('updateLightingInspector');
    if (typeof updateLightingInspector === 'function') updateLightingInspector();

    const nextSounds = normalizeSounds(migratedConfig.sounds);
    set('sounds', nextSounds);
    const nextShaders = (migratedConfig.resources?.shaders ?? []).filter((shader) => shader?.id);
    set('shaders', nextShaders);
    set('materials', migratedConfig.resources?.materials ?? []);
    getCallback('renderShaders')?.();

    const nextPlayer = {
      ...(get('player') ?? {}),
      ...(migratedConfig.player ?? {}),
      position: normalizeVector(migratedConfig.player?.position, [0, 0, 0]),
      rotation: normalizeVector(migratedConfig.player?.rotation, [0, 0, 0]),
      scale: normalizeVector(migratedConfig.player?.scale, [1, 1, 1]),
      status: { ...((get('player') ?? {}).status ?? {}), ...(migratedConfig.player?.status ?? {}) },
      inventory: Array.isArray(migratedConfig.player?.inventory) ? migratedConfig.player.inventory : [...((get('player') ?? {}).inventory ?? [])],
      collision: {
        ...((get('player') ?? {}).collision ?? {}),
        ...(migratedConfig.player?.collision ?? {}),
        offset: normalizeVector(migratedConfig.player?.collision?.offset ?? ((get('player') ?? {}).collision?.offset), [0, 0, 0]),
        scale: normalizeVector(migratedConfig.player?.collision?.scale ?? ((get('player') ?? {}).collision?.scale), [1, 1, 1]),
      },
      animation: { ...((get('player') ?? {}).animation ?? {}), ...(migratedConfig.player?.animation ?? {}) },
    };
    nextPlayer.status.maxHp = Math.max(1, Number(migratedConfig.player?.maxHp ?? nextPlayer.status.maxHp) || 20);
    nextPlayer.maxHp = nextPlayer.status.maxHp;
    set('player', nextPlayer);

    set('assets', (migratedConfig.assets ?? []).filter((asset) => asset.url && !asset.url.startsWith('blob:')).map((asset) => ({
      ...asset,
      format: asset.format ?? asset.name?.split('?')[0].split('.').pop().toLowerCase() ?? 'glb',
    })));
    set('enemyTypes', (Array.isArray(migratedConfig.enemyTypes) ? migratedConfig.enemyTypes : defaultEnemyTypes).map((type, index) => normalizeEnemyType({ ...type, gold: { ...type.gold }, itemDrops: [...(type.itemDrops ?? [])] }, index)));
    set('enemyAreas', (Array.isArray(migratedConfig.enemyAreas) ? migratedConfig.enemyAreas : []).map((area) => normalizeEnemyArea({ ...area })));
    getCallback('renderAssets')?.();
    getCallback('renderEnemyTypes')?.();
    getCallback('renderEnemyAreas')?.();

    const entityGroup = get('entityGroup');
    if (entityGroup) entityGroup.clear();
    set('entities', []);
    set('selectedEntityId', null);
    set('selectedEnemyAreaId', null);

    const assets = get('assets') ?? [];
    for (const definition of migratedConfig.entities ?? []) {
      if (!definition || typeof definition !== 'object') continue;
      if (definition.type === 'pointLight') {
        const object = new THREE.PointLight(
          new THREE.Color(...(definition.light?.color ?? [1, 0.7, 0.45])).getHex(),
          Number(definition.light?.intensity ?? 2),
          Number(definition.light?.distance ?? 18),
        );
        object.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(...(definition.light?.color ?? [1, 0.7, 0.45])) })));
        const addEntity = getCallback('addEntity');
        if (typeof addEntity === 'function') addEntity({ ...definition, object }, object);
      } else {
        const asset = assets.find((item) => item.id === definition.assetId);
        const instantiateAsset = getCallback('instantiateAsset');
        if (asset && typeof instantiateAsset === 'function') {
          try {
            await instantiateAsset({ ...asset, _definition: definition });
          } catch (error) {
            console.error(`Falha ao carregar a entidade ${definition.name ?? definition.id}.`, error);
            const addEntity = getCallback('addEntity');
            if (typeof addEntity === 'function') addEntity({ ...definition, object: null });
            getCallback('setStatus')?.(`Asset ${asset.name ?? asset.id} falhou; entidade preservada`);
          }
        } else if (definition.primitive) {
          const createPrimitiveObject = getCallback('createPrimitiveObject');
          if (typeof createPrimitiveObject === 'function') {
            const object = createPrimitiveObject(definition.primitive);
            const addEntity = getCallback('addEntity');
            if (object && typeof addEntity === 'function') addEntity({ ...definition, name: definition.name ?? 'Entidade', object }, object);
          }
        } else {
          const addEntity = getCallback('addEntity');
          if (typeof addEntity === 'function') addEntity({ ...definition, object: null });
        }
      }
    }

    const refreshPlayerPreview = getCallback('refreshPlayerPreview');
    if (typeof refreshPlayerPreview === 'function') await refreshPlayerPreview();

    const selectEntity = getCallback('selectEntity');
    if (typeof selectEntity === 'function') selectEntity(null);
    updateSummary();
  }

  async function loadSavedWorld() {
    const httpUrl = get('httpUrl');
    const response = await fetch(`${httpUrl}/api/map-config`, {
      credentials: 'include',
      cache: 'no-store',
    }).catch(() => null);
    if (!response?.ok) getCallback('setStatus')?.(`Banco indisponível; usando o mapa local (HTTP ${response?.status ?? 'sem resposta'})`);
    const remoteConfig = response?.ok ? await response.json().catch(() => null) : null;
    const savedConfig = readSavedMapConfig();
    const fallbackConfig = buildDefaultWorldConfig();
    const config = resolveWorldConfig(
      remoteConfig && (remoteConfig.entities || remoteConfig.assets || remoteConfig.enemyAreas || remoteConfig.shaders || remoteConfig.resources)
        ? remoteConfig
        : (savedConfig && (savedConfig.entities || savedConfig.assets || savedConfig.enemyAreas || savedConfig.shaders || savedConfig.resources)
          ? savedConfig
          : fallbackConfig),
      fallbackConfig,
    );
    try {
      await loadWorld(config);
    } catch (error) {
      getCallback('setStatus')?.(`Falha ao carregar o mundo: ${error.message}`);
      console.error('Falha ao carregar o mundo persistido.', error);
    }
  }

  async function refreshShaders() {
    const httpUrl = get('httpUrl');
    const response = await fetch(`${httpUrl}/api/map-config`, {
      credentials: 'include',
      cache: 'no-store',
    }).catch(() => null);
    const remoteConfig = response?.ok ? await response.json().catch(() => null) : null;
    const savedConfig = readSavedMapConfig();
    const config = remoteConfig?.resources?.shaders
      ? remoteConfig
      : Array.isArray(remoteConfig?.shaders)
      ? remoteConfig
      : (savedConfig?.resources?.shaders || Array.isArray(savedConfig?.shaders) ? savedConfig : null);
    if (!config) return false;
    const migratedConfig = migrateWorldResources(config);
    const nextShaders = migratedConfig.resources?.shaders ?? [];
    set('shaders', nextShaders);
    set('materials', migratedConfig.resources?.materials ?? []);
    getCallback('renderShaders')?.();
    getCallback('setStatus')?.('Shaders atualizados do mundo publicado');
    return true;
  }

  function download() {
    const blob = new Blob([JSON.stringify(exportConfig(), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'main-world.world';
    link.click();
    URL.revokeObjectURL(link.href);
    const setStatus = getCallback('setStatus');
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
      const setStatus = getCallback('setStatus');
      if (typeof setStatus === 'function') setStatus(result?.error ?? `Não foi possível aplicar o mundo (HTTP ${response.status})`);
      return;
    }
    try { saveMapConfig(config); } catch {}
    const setStatus = getCallback('setStatus');
    if (typeof setStatus === 'function') setStatus('Mundo aplicado no jogo');
  }

  return {
    exportConfig,
    updateSummary,
    loadWorld,
    loadSavedWorld,
    refreshShaders,
    download,
    applyToGame,
  };
}
