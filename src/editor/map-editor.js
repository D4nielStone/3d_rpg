import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { AnimationMixer, LoopOnce, LoopRepeat } from 'three';
import { getColliderDescriptors, getCombinedCollisionScale } from '../../shared/collision-shape.js';
import { createEditorGizmos } from './editor-gizmos.js';
import { normalizeTerrainForExport, isTerrainRemoved } from './terrain-state.js';
import {
  normalizeVector,
  normalizeColor,
  colorToHex,
  uniqueEntityName,
  normalizeCollision,
  createCollisionSurface,
  createCollisionSurfaceGeometry,
  offsetCollisionSurface,
  createPrimitiveObject,
  listEditorEntities,
} from './editor-utils.js';
import {
  defaultTerrainConfig,
  defaultLighting,
  defaultSkyColor,
  defaultFog,
  normalizeSounds,
  normalizeEnemyArea,
  normalizeEnemyType,
  normalizeLighting,
  normalizeSkyColor,
  normalizeFog,
  normalizePointLight,
} from './editor-scene-state.js';
import { buildDefaultWorldConfig, resolveWorldConfig } from './editor-scene-config.js';
import { configureTerrainMesh, applyTerrainBrushToGround } from './editor-terrain.js';
import { createEditorScene } from './editor-scene.js';
import { createWorldController } from './editor-world.js';
import { bindEditorEvents } from './editor-events.js';
import { readSavedMapConfig, saveMapConfig } from '../map-config.js';
import { getMultiplayerHttpUrl } from '../multiplayer-url.js';
import {
  setStatus as domSetStatus,
  setPanelOpen as domSetPanelOpen,
  setInspectorTab as domSetInspectorTab,
  renderSounds as domRenderSounds,
  createSceneTreeGroup as domCreateSceneTreeGroup,
  createSceneTreeNode as domCreateSceneTreeNode,
} from './editor-dom.js';
import {
  normalizeEntityTransform,
  normalizeEntityMaterials,
  normalizeEntityShadows,
  normalizeEntityAnimation,
  applyEntityTransform,
  applyEntityMaterials,
  readObjectMaterials,
  materialIndexForObject,
  markSelectable,
  entitySnapshot,
} from './editor-entity-utils.js';

const httpUrl = getMultiplayerHttpUrl();
const accessTicket = new URLSearchParams(window.location.search).get('access');
const accessResponse = accessTicket ? await fetch(`${httpUrl}/api/map-access?ticket=${encodeURIComponent(accessTicket)}`, { credentials: 'include' }).catch(() => null) : null;
if (!(accessResponse?.ok && (await accessResponse.json()).authorized)) {
  document.body.innerHTML = '<main class="access-denied"><h1>Acesso restrito</h1><p>O editor de mapas está disponível apenas para administradores pelo comando /map.</p></main>';
  throw new Error('Map editor access denied');
}
const canvas = document.querySelector('#map-canvas');
const status = document.querySelector('#map-status');
const coordinates = document.querySelector('#map-coordinates');
const preview = document.querySelector('#json-preview');
const assetList = document.querySelector('#asset-list');
const soundType = document.querySelector('#sound-type');
const soundUrl = document.querySelector('#sound-url');
const soundList = document.querySelector('#sound-list');
const entityList = document.querySelector('#entity-list');
const entityInspector = document.querySelector('#entity-inspector');
const emptyInspector = document.querySelector('#empty-inspector');
const selectedEntityLabel = document.querySelector('#selected-entity-label');
const entityDiffuseColorInput = document.querySelector('#entity-diffuse-color');
const entityTextureFileInput = document.querySelector('#entity-texture-file');
const entityReceiveLightInput = document.querySelector('#entity-receive-light');
const entityCastShadowInput = document.querySelector('#entity-cast-shadow');
const collisionFrictionInput = document.querySelector('#collision-friction');
const collisionFrictionValue = document.querySelector('#collision-friction-value');
const collisionRestitutionInput = document.querySelector('#collision-restitution');
const collisionRestitutionValue = document.querySelector('#collision-restitution-value');
const playerPreviewInspector = document.querySelector('#player-preview-inspector');
const meshList = document.querySelector('#mesh-list');
const meshCount = document.querySelector('#mesh-count');
const animationControls = document.querySelector('#animation-controls');
const animationSelect = document.querySelector('#animation-select');
const animationPlayButton = document.querySelector('#animation-play');
const animationPauseButton = document.querySelector('#animation-pause');
const animationStopButton = document.querySelector('#animation-stop');
const animationLoopInput = document.querySelector('#animation-loop');
const animationSpeedInput = document.querySelector('#animation-speed');
const animationSpeedValue = document.querySelector('#animation-speed-value');
const componentTabs = [...document.querySelectorAll('[data-component-tab]')];
const animationComponentTab = document.querySelector('[data-component-tab="animation"]');
const sceneTree = document.querySelector('#scene-tree');
const ambientColorInput = document.querySelector('#ambient-color');
const ambientIntensityInput = document.querySelector('#ambient-intensity');
const ambientIntensityValue = document.querySelector('#ambient-intensity-value');
const directionalIntensityInput = document.querySelector('#directional-intensity');
const directionalIntensityValue = document.querySelector('#directional-intensity-value');
const directionalCastShadowInput = document.querySelector('#directional-cast-shadow');
const directionalInputs = [
  document.querySelector('#directional-x'),
  document.querySelector('#directional-y'),
  document.querySelector('#directional-z'),
];
const directionalValues = [
  document.querySelector('#directional-x-value'),
  document.querySelector('#directional-y-value'),
  document.querySelector('#directional-z-value'),
];
const pointLightInspector = document.querySelector('#point-light-inspector');
const entityLightColorInput = document.querySelector('#entity-light-color');
const entityLightIntensityInput = document.querySelector('#entity-light-intensity');
const entityLightIntensityValue = document.querySelector('#entity-light-intensity-value');
const entityLightDistanceInput = document.querySelector('#entity-light-distance');
const entityLightDistanceValue = document.querySelector('#entity-light-distance-value');
const skyColorInput = document.querySelector('#sky-color');
const fogColorInput = document.querySelector('#fog-color');
const fogNearInput = document.querySelector('#fog-near');
const fogNearValue = document.querySelector('#fog-near-value');
const fogFarInput = document.querySelector('#fog-far');
const fogFarValue = document.querySelector('#fog-far-value');
const terrainWidthInput = document.querySelector('#terrain-width');
const terrainWidthValue = document.querySelector('#terrain-width-value');
const terrainDepthInput = document.querySelector('#terrain-depth');
const terrainDepthValue = document.querySelector('#terrain-depth-value');
const terrainSegmentsInput = document.querySelector('#terrain-segments');
const terrainSegmentsValue = document.querySelector('#terrain-segments-value');
const terrainAmplitudeInput = document.querySelector('#terrain-amplitude');
const terrainAmplitudeValue = document.querySelector('#terrain-amplitude-value');
const terrainFrequencyInput = document.querySelector('#terrain-frequency');
const terrainFrequencyValue = document.querySelector('#terrain-frequency-value');
const terrainColorInput = document.querySelector('#terrain-color');
const terrainBrushRadiusInput = document.querySelector('#terrain-brush-radius');
const terrainBrushRadiusValue = document.querySelector('#terrain-brush-radius-value');
const terrainBrushStrengthInput = document.querySelector('#terrain-brush-strength');
const terrainBrushStrengthValue = document.querySelector('#terrain-brush-strength-value');
const panelToggles = [
  ['assets-toggle', 'assets-panel'],
  ['inspector-toggle', 'inspector-panel'],
];
const inspectorTabs = [...document.querySelectorAll('[data-inspector-tab]')];

function setStatus(message) {
  domSetStatus(status, message);
}

function setPanelOpen(panelId, open, toggle) {
  domSetPanelOpen(panelId, open, toggle);
}

function setInspectorTab(tabId) {
  domSetInspectorTab(inspectorTabs, tabId);
}

function renderSounds() {
  domRenderSounds(soundList, sounds);
}

function createSceneTreeGroup(label, count, children, open = true) {
  return domCreateSceneTreeGroup(label, count, children, open);
}

function createSceneTreeNode(icon, label, onClick, selected = false) {
  return domCreateSceneTreeNode(icon, label, onClick, selected);
}

let mode = 'select';
let entities = [];
let assets = [];
let sounds = { slash: '', pulse: '', arc: '', 'level-up': '' };
let enemyAreas = [];
let enemyTypes = [];
let terrainConfig = { ...defaultTerrainConfig };
let terrainRemoved = false;
let lighting = { ...defaultLighting, directional: { ...defaultLighting.directional }, point: { ...defaultLighting.point } };
let skyColor = [...defaultSkyColor];
let fog = { ...defaultFog, color: [...defaultFog.color] };
let player = {
  model: '', modelFormat: 'glb',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], speed: 3,
  materials: [],
  status: { level: 1, hp: 20, maxHp: 20, mana: 20, xp: 0, strength: 1, accuracy: 1, magic: 1, money: 0 },
  inventory: [], collision: { enabled: false, shape: 'model', bodyType: 'characterBody' }, animation: { name: '', loop: true, speed: 1 },
};
let selectedEntityId = null;
let selectedEnemyAreaId = null;
let selectedMaterialIndex = 0;
let playerPreview = null;
let nextId = 1;
const terrainEntity = { id: 'terrain', name: 'Terreno', type: 'terrain', object: null, enabled: true, isSpecial: true };
const directionalLightEntity = { id: 'directionalLight', name: 'Luz direta', type: 'directionalLight', object: null, enabled: true, isSpecial: true };
const history = [];
const future = [];
const worldController = createWorldController({
  terrainConfig: () => terrainConfig,
  terrainRemoved: () => terrainRemoved,
  lighting: () => lighting,
  skyColor: () => skyColor,
  fog: () => fog,
  sounds: () => sounds,
  player: () => player,
  assets: () => assets,
  entities: () => entities,
  enemyTypes: () => enemyTypes,
  enemyAreas: () => enemyAreas,
  ground: () => ground,
  entityGroup: () => entityGroup,
  httpUrl: () => httpUrl,
  updateSceneAtmosphere: () => updateSceneAtmosphere(),
  updateLightingInspector: () => updateLightingInspector(),
  setStatus: () => setStatus,
  addEntity: (entity, object, animations) => addEntity(entity, object, animations),
  instantiateAsset: (asset) => instantiateAsset(asset),
  refreshPlayerPreview: () => refreshPlayerPreview(),
  selectEntity: (id) => selectEntity(id),
  createPrimitiveObject: (type) => createPrimitiveObject(type),
  entityGroup: () => entityGroup,
}, {
  terrainConfig: (value) => { terrainConfig = value; },
  terrainRemoved: (value) => { terrainRemoved = Boolean(value); },
  lighting: (value) => { lighting = value; },
  skyColor: (value) => { skyColor = value; },
  fog: (value) => { fog = value; },
  sounds: (value) => { sounds = value; },
  player: (value) => { player = value; },
  assets: (value) => { assets = value; },
  entities: (value) => { entities = value; },
  enemyTypes: (value) => { enemyTypes = value; },
  enemyAreas: (value) => { enemyAreas = value; },
  selectedEntityId: (value) => { selectedEntityId = value; },
  selectedEnemyAreaId: (value) => { selectedEnemyAreaId = value; },
});

function newId(prefix) { let id; do { id = `${prefix}-${nextId++}`; } while ([...assets, ...entities, ...enemyAreas].some((item) => item.id === id)); return id; }
function selectedEntity() {
  if (selectedEntityId === 'terrain') {
    terrainEntity.object = ground;
    terrainEntity.enabled = !terrainRemoved;
    return terrainEntity;
  }
  if (selectedEntityId === 'directionalLight') {
    directionalLightEntity.object = directionalLight;
    directionalLightEntity.enabled = lighting.directional.enabled !== false;
    return directionalLightEntity;
  }
  return entities.find((entity) => entity.id === selectedEntityId) ?? null;
}
function updateSceneAtmosphere() {
  editorScene.updateSceneAtmosphere(skyColor, fog);
  skyColorInput.value = colorToHex(skyColor);
  fogColorInput.value = colorToHex(fog.color);
  fogNearInput.value = fog.near;
  fogNearValue.textContent = fog.near.toFixed(2);
  fogFarInput.value = fog.far;
  fogFarValue.textContent = fog.far.toFixed(2);
}
const updateSkyColor = () => updateSceneAtmosphere();
function updateSceneAmbientLight() {
  editorScene.updateSceneAmbientLight(lighting);
}
function updateLightingInspector() {
  ambientColorInput.value = `#${lighting.ambientColor.map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')}`;
  ambientIntensityInput.value = lighting.ambientIntensity;
  ambientIntensityValue.textContent = lighting.ambientIntensity.toFixed(2);
  directionalInputs.forEach((input, index) => {
    input.value = lighting.directional.direction[index];
    directionalValues[index].textContent = Number(lighting.directional.direction[index]).toFixed(2);
  });
  directionalIntensityInput.value = lighting.directional.intensity;
  directionalIntensityValue.textContent = lighting.directional.intensity.toFixed(2);
  directionalCastShadowInput.checked = lighting.directional.castShadow !== false;
  updateSceneAmbientLight();
}
function captureState() { return exportConfig(); }
function pushHistory() { history.push(captureState()); if (history.length > 20) history.shift(); future.length = 0; }
async function undo() { const state = history.pop(); if (!state) return; future.push(captureState()); await loadWorld(state); setStatus(status, 'Alteração desfeita'); }
async function redo() { const state = future.pop(); if (!state) return; history.push(captureState()); await loadWorld(state); setStatus(status, 'Alteração refeita'); }

const editorScene = createEditorScene({
  canvas,
  terrainConfig,
  lighting,
  skyColor,
  fog,
});
const renderer = editorScene.renderer;
const scene = editorScene.scene;
const camera = editorScene.camera;
const orbit = editorScene.orbit;
const ambientLight = editorScene.ambientLight;
const directionalLight = editorScene.directionalLight;
const worldGroup = editorScene.worldGroup;
const ground = editorScene.ground;
const gridHelper = editorScene.gridHelper;
const enemyAreaVisuals = editorScene.enemyAreaVisuals;
const entityGroup = editorScene.entityGroup;
const collisionGroup = editorScene.collisionGroup;
const raycaster = editorScene.raycaster;
const pointer = editorScene.pointer;
const hover = editorScene.hover;
let gizmoDragging = false;
let terrainBrushActive = false;
const gizmos = createEditorGizmos({
  camera,
  canvas,
  scene,
  onDraggingChanged: (event) => { gizmoDragging = event.value; orbit.enabled = !event.value; if (event.value) pushHistory(); },
  onObjectChange: () => { syncSelectedFromObject(); const entity = selectedEntity(); if (entity) updateCollisionVisual(entity); updateInspector(); updateSummary(); },
});

function resize() { editorScene.resize(); }
function disposeObject(object) { editorScene.disposeObject(object); }
function clearCollisionVisual(entity) {
  const visual = collisionGroup.getObjectByName(`collision-${entity.id}`);
  if (!visual) return;
  collisionGroup.remove(visual);
  disposeObject(visual);
}
function createCollisionSurfaceVisual(surface, material) {
  if (surface?.mesh) {
    const geometry = createCollisionSurfaceGeometry(surface);
    if (geometry) return new THREE.LineSegments(new THREE.EdgesGeometry(geometry), material);
  }

  const columns = Math.floor(Number(surface?.columns));
  const rows = Math.floor(Number(surface?.rows));
  const heights = surface?.heights;
  if (!Number.isInteger(columns) || columns < 2 || !Number.isInteger(rows) || rows < 2 || !Array.isArray(heights) || heights.length !== columns * rows) return null;
  const vertices = [];
  const minX = Number(surface.minX);
  const maxX = Number(surface.maxX);
  const minZ = Number(surface.minZ);
  const maxZ = Number(surface.maxZ);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const x = THREE.MathUtils.lerp(minX, maxX, column / (columns - 1));
      const z = THREE.MathUtils.lerp(minZ, maxZ, row / (rows - 1));
      const y = Number(heights[index]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      if (column < columns - 1) {
        const next = index + 1;
        vertices.push(x, y, z, THREE.MathUtils.lerp(minX, maxX, (column + 1) / (columns - 1)), Number(heights[next]), z);
      }
      if (row < rows - 1) {
        const next = index + columns;
        vertices.push(x, y, z, x, Number(heights[next]), THREE.MathUtils.lerp(minZ, maxZ, (row + 1) / (rows - 1)));
      }
    }
  }
  if (!vertices.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  return new THREE.LineSegments(geometry, material);
}
function updateCollisionVisual(entity) {
  clearCollisionVisual(entity);
  if (!entity?.object || !entity.collision?.enabled) return;
  normalizeCollision(entity);
  const collisionScale = entity.collision.scale;
  const group = new THREE.Group();
  group.name = `collision-${entity.id}`;
  const material = new THREE.LineBasicMaterial({ color: 0x42ff72, depthTest: false, transparent: true, opacity: 0.95 });
  if (entity.collision.shape === 'model') {
    const surface = createCollisionSurface(entity.object, 32, collisionScale);
    const surfaceVisual = createCollisionSurfaceVisual(surface, material);
    if (surfaceVisual) group.add(surfaceVisual);
  } else {
    const scale = getCombinedCollisionScale(entity);
    const descriptors = getColliderDescriptors(entity.collision.shape, scale);
    if (entity.collision.shape === 'box' || entity.collision.shape === 'convex') {
      const halfExtents = descriptors[0].halfExtents;
      const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(
        halfExtents[0] * 2, halfExtents[1] * 2, halfExtents[2] * 2,
      )), material);
      group.add(box);
    } else if (entity.collision.shape === 'capsule') {
      const radius = descriptors[0].radius;
      const cylinderHeight = descriptors[0].height;
      const capsule = new THREE.LineSegments(new THREE.EdgesGeometry(
        new THREE.CapsuleGeometry(radius, cylinderHeight, 8, 16),
      ), material);
      group.add(capsule);
    }
  }
  const offset = entity.collision.offset ?? [0, 0, 0];
  group.position.set(
    entity.position[0] + (Number(offset[0]) || 0),
    entity.position[1] + (Number(offset[1]) || 0),
    entity.position[2] + (Number(offset[2]) || 0),
  );
  group.renderOrder = 20;
  collisionGroup.add(group);
}
function renderEnemyAreaVisuals() {
  while (enemyAreaVisuals.children.length) { const child = enemyAreaVisuals.children.pop(); disposeObject(child); }
  enemyAreas.forEach((area) => {
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(area.width, 0.08, area.depth));
    const material = new THREE.LineBasicMaterial({ color: area.id === selectedEnemyAreaId ? 0xffd166 : 0xe76f51, transparent: true, opacity: area.id === selectedEnemyAreaId ? 1 : 0.7, depthTest: false });
    const outline = new THREE.LineSegments(geometry, material);
    outline.position.set(...area.center); outline.position.y += 0.04; outline.renderOrder = 8;
    enemyAreaVisuals.add(outline);
  });
}
// Adiciona uma entidade à cena, normalizando seus dados e aplicando transformações e materiais.
function addEntity(entity, object = null, animations = []) {
  if (!entity || typeof entity !== 'object') {
    console.warn('Ignorando entidade inválida ao carregar a cena.', entity);
    return;
  }
  entity.name = uniqueEntityName(entity.name, entities, entity.id);
  normalizeEntityTransform(entity);
  normalizeEntityAnimation(entity);
  normalizeCollision(entity);
  normalizeEntityShadows(entity);
  if (entity.type === 'pointLight') normalizePointLight(entity);
  entity.object = object ?? new THREE.Group();
  entity.animations = animations;
  entity.animationMixer = animations.length ? new AnimationMixer(entity.object) : null;
  entity.animationAction = null;
  normalizeEntityMaterials(entity);
  entity.object.name = entity.name;
  markSelectable(entity.object, entity.id);
  applyEntityTransform(entity);
  applyEntityMaterials(entity);
  entity.object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = entity.castShadow;
    child.receiveShadow = entity.receiveLight;
  });
  applyEntityAnimation(entity);
  entityGroup.add(entity.object);
  updateCollisionVisual(entity);
  entities.push(entity); selectEntity(entity.id); renderEntities(); updateSummary();
}
function syncPlayerFromPreview(entity) {
  if (!entity?.isPlayerPreview) return;
  player.position = [...entity.position];
  player.rotation = [...entity.rotation];
  player.scale = [...entity.scale];
  player.materials = entity.materials.map((material) => ({ ...material, diffuseColor: [...material.diffuseColor], texture: material.texture ?? null }));
  updatePlayerInspector();
}
async function applyStoredTextures(entity) {
  for (const [index, definition] of (entity.materials ?? []).entries()) {
    if (!definition.texture) continue;
    const texture = await new THREE.TextureLoader().loadAsync(definition.texture);
    let materialIndex = 0;
    entity.object.traverse((child) => {
      if (!child.isMesh) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (materialIndex === index) {
          material.map = texture;
          material.needsUpdate = true;
        }
        materialIndex += 1;
      });
    });
  }
}
function removePlayerPreview() {
  if (!playerPreview) return;
  clearCollisionVisual(playerPreview);
  if (playerPreview.object) {
    entityGroup.remove(playerPreview.object);
    disposeObject(playerPreview.object);
  }
  entities = entities.filter((entity) => entity !== playerPreview);
  playerPreview = null;
}
async function refreshPlayerPreview() {
  removePlayerPreview();
  const asset = assets.find((item) => item.id === player.assetId);
  let object;
  let animations = [];
  if (asset?.url) {
    const loaded = await loadModel(asset.url, asset.format, asset.dependencies);
    object = loaded.object;
    animations = loaded.animations;
  } else {
    object = createPrimitiveObject('box');
  }
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  playerPreview = {
    id: 'player-preview',
    name: 'Player (Preview)',
    isPlayerPreview: true,
    assetId: player.assetId ?? null,
    type: 'player',
    position: [...player.position],
    rotation: [...player.rotation],
    scale: [...player.scale],
    materials: player.materials?.length ? player.materials.map((material) => ({ ...material, diffuseColor: [...material.diffuseColor] })) : readObjectMaterials(object),
    animation: { ...player.animation },
    collision: { ...player.collision },
    object,
  };
  addEntity(playerPreview, object, animations);
  await applyStoredTextures(playerPreview);
  selectEntity(null);
  renderEntities();
}
function createPrimitive(type) {
  const labels = { box: 'Cubo', sphere: 'Esfera', cylinder: 'Cilindro', cone: 'Cone', capsule: 'Cápsula', plane: 'Plano' };
  const object = createPrimitiveObject(type);
  if (!object) return;
  pushHistory();
  const entity = { ...createEntity(labels[type] ?? 'Primitiva'), primitive: type, materials: readObjectMaterials(object), object };
  addEntity(entity, object);
  setMode('translate');
  setStatus(`${labels[type] ?? 'Primitiva'} adicionada à cena`);
}
function createPointLight() {
  pushHistory();
  const entity = {
    ...createEntity('Luz pontual'),
    type: 'pointLight',
    light: { color: [1, 0.72, 0.45], intensity: 2, distance: 18 },
    position: [0, 8, 0],
  };
  const object = new THREE.PointLight(0xffb873, entity.light.intensity, entity.light.distance);
  object.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb873 }),
  ));
  addEntity(entity, object);
  setMode('translate');
  setStatus('Luz pontual adicionada à cena');
}
function removeEntity(id) {
  const entity = entities.find((item) => item.id === id); if (!entity) return;
  clearCollisionVisual(entity);
  if (entity.object) { entityGroup.remove(entity.object); disposeObject(entity.object); }
  entities = entities.filter((item) => item.id !== id); if (selectedEntityId === id) selectEntity(null); renderEntities(); updateSummary();
}
function cloneEntityObject(object) {
  const clone = object.clone(true);
  clone.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry = child.geometry?.clone();
    if (Array.isArray(child.material)) child.material = child.material.map((material) => material.clone());
    else if (child.material) child.material = child.material.clone();
  });
  return clone;
}
function duplicateSelectedEntity() {
  const source = selectedEntity();
  if (!source) return;
  pushHistory();
  const duplicate = {
    ...source,
    id: newId('entity'),
    name: uniqueEntityName(`${source.name} cópia`),
    position: [...source.position],
    rotation: [...source.rotation],
    scale: [...source.scale],
    materials: source.materials.map((material) => ({ ...material, diffuseColor: [...material.diffuseColor] })),
    animation: { ...source.animation },
    collision: { ...source.collision },
    object: cloneEntityObject(source.object),
  };
  duplicate.position[0] += 1;
  addEntity(duplicate, duplicate.object, source.animations ?? []);
  setMode('translate');
  setStatus(`Entidade ${duplicate.name} criada`);
}
function selectEntity(id) {
  if (gizmoDragging && id !== selectedEntityId) return;
  selectedEntityId = id; selectedMaterialIndex = 0; const entity = selectedEntity();
  if (entity?.object && entity.type !== 'terrain' && entity.type !== 'directionalLight') { gizmos.attach(entity.object); }
  else if (entity?.type === 'terrain') { gizmos.detach(); }
  else if (entity?.type === 'directionalLight') { gizmos.detach(); }
  else { gizmos.detach(); }
  selectedEntityLabel.textContent = entity?.name ?? 'Nenhuma';
  updateInspector(); renderEntities();
}
function setComponentTab(tabId) {
  componentTabs.forEach((tab) => {
    const active = tab.dataset.componentTab === tabId;
    tab.classList.toggle('component-tab-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-component-panel]').forEach((panel) => {
    panel.classList.toggle('component-panel-active', panel.dataset.componentPanel === tabId);
  });
}
function applyEntityAnimation(entity) {
  if (!entity?.animationMixer || !entity.animations.length) return;
  const selected = entity.animations.find((clip) => clip.name === entity.animation.name) ?? entity.animations[0];
  entity.animation.name = selected.name;
  entity.animationAction?.stop();
  entity.animationAction = entity.animationMixer.clipAction(selected);
  entity.animationAction.reset();
  entity.animationAction.setLoop(entity.animation.loop ? LoopRepeat : LoopOnce, entity.animation.loop ? Infinity : 1);
  entity.animationAction.clampWhenFinished = !entity.animation.loop;
  entity.animationAction.timeScale = entity.animation.speed;
  if (entity.animation.playing) entity.animationAction.play();
}
function updateAnimationInspector() {
  const entity = selectedEntity();
  const available = entity?.animations?.length > 0;
  animationControls.hidden = !available;
  animationComponentTab.hidden = !available;
  if (!available && animationComponentTab.classList.contains('component-tab-active')) setComponentTab('transform');
  if (!available) return;
  animationSelect.replaceChildren(...entity.animations.map((clip) => {
    const option = document.createElement('option');
    option.value = clip.name;
    option.textContent = clip.name;
    option.selected = clip.name === entity.animation.name;
    return option;
  }));
  animationLoopInput.checked = entity.animation.loop;
  animationSpeedInput.value = entity.animation.speed;
  animationSpeedValue.textContent = `${entity.animation.speed.toFixed(2)}x`;
}
function setAnimationPlaying(playing) {
  const entity = selectedEntity();
  if (!entity?.animationMixer) return;
  entity.animation.playing = playing;
  entity.animationAction?.play();
  if (entity.animationAction) entity.animationAction.paused = !playing;
  updateAnimationInspector();
}
function stopAnimation() {
  const entity = selectedEntity();
  if (!entity?.animationAction) return;
  entity.animation.playing = false;
  entity.animationAction.stop();
  entity.animationAction.reset();
  updateAnimationInspector();
}
function syncSelectedFromObject() {
  const entity = selectedEntity();
  if (!entity?.object) return;
  entity.position = normalizeVector(entity.object.position.toArray(), [0, 0, 0]);
  entity.rotation = normalizeVector([entity.object.rotation.x, entity.object.rotation.y, entity.object.rotation.z], [0, 0, 0]); entity.scale = normalizeVector(entity.object.scale.toArray(), [1, 1, 1]);
}
function createEntity(name = 'Entidade vazia', assetId = null) {
  return {
    id: newId('entity'), name: uniqueEntityName(name), assetId, position: [0, 0, 0],
    rotation: [0, 0, 0], scale: [1, 1, 1], materials: [], object: null
  };
}
function renderEntities() {
  const editorEntities = listEditorEntities(entities);
  entityList.replaceChildren(...editorEntities.map((entity) => {
    const button = document.createElement('button');
    button.className = `entity-item${entity.id === selectedEntityId ? ' entity-item-selected' : ''}`;
    button.type = 'button';
    const icon = entity.type === 'terrain' ? 'T' : entity.type === 'directionalLight' ? 'L' : entity.isPlayerPreview ? 'P' : entity.assetId ? '◆' : '○';
    button.innerHTML = `<span class="asset-icon">${icon}</span><span>${entity.name}</span>`;
    button.addEventListener('click', () => selectEntity(entity.id));
    return button;
  }));
  document.querySelector('#entity-count').textContent = String(editorEntities.length);
  renderSceneTree();
}
function selectedEnemyArea() { return enemyAreas.find((area) => area.id === selectedEnemyAreaId) ?? null; }
function renderEnemyTypes() {
  const list = document.querySelector('#enemy-type-list');
  list.replaceChildren(...enemyTypes.map((type) => {
    const button = document.createElement('button');
    button.className = `entity-item${type.id === selectedEnemyTypeId ? ' entity-item-selected' : ''}`;
    button.type = 'button';
    button.innerHTML = `<span class="asset-icon">E</span><span>${type.name}</span>`;
    button.addEventListener('click', () => { selectedEnemyTypeId = type.id; updateEnemyTypeInspector(); renderEnemyTypes(); });
    return button;
  }));
  document.querySelector('#enemy-type-count').textContent = String(enemyTypes.length);
}
function renderEnemyAreas() {
  const list = document.querySelector('#enemy-area-list');
  list.replaceChildren(...enemyAreas.map((area) => { const button = document.createElement('button'); button.className = `entity-item${area.id === selectedEnemyAreaId ? ' entity-item-selected' : ''}`; button.type = 'button'; button.innerHTML = `<span class="asset-icon">⚔</span><span>${area.id}</span>`; button.addEventListener('click', () => selectEnemyArea(area.id)); return button; }));
  document.querySelector('#enemy-area-count').textContent = String(enemyAreas.length);
  renderEnemyAreaVisuals();
  renderSceneTree();
}
function updateTerrainInspector() {
  const terrainButton = document.querySelector('#delete-terrain-button');
  if (terrainButton) terrainButton.textContent = terrainRemoved ? 'Restaurar terreno' : 'Excluir terreno';
  if (ground) ground.visible = !terrainRemoved;
}
function setTerrainRemoved(removed) {
  terrainRemoved = Boolean(removed);
  if (ground) {
    ground.visible = !terrainRemoved;
    ground.userData.removed = terrainRemoved;
  }
  terrainEntity.enabled = !terrainRemoved;
  updateTerrainInspector();
  renderSceneTree();
  updateSummary();
}
function renderSceneTree() {
  if (!sceneTree) return;
  const terrainNode = createSceneTreeNode('T', terrainRemoved ? 'Terreno (removido)' : 'Terreno', () => {
    selectEntity('terrain');
    setPanelOpen('inspector-panel', true, document.querySelector('#inspector-toggle'));
    setStatus(terrainRemoved ? 'Terreno removido da cena' : 'Terreno selecionado');
  }, selectedEntityId === 'terrain');
  const lightNode = createSceneTreeNode('L', 'Luz direta', () => {
    selectEntity('directionalLight');
    setPanelOpen('inspector-panel', true, document.querySelector('#inspector-toggle'));
    setStatus('Luz direcional selecionada');
  }, selectedEntityId === 'directionalLight');
  const entityNodes = listEditorEntities(entities).slice(2).map((entity) => createSceneTreeNode(entity.isPlayerPreview ? 'P' : entity.assetId ? 'M' : 'E', entity.name, () => selectEntity(entity.id), entity.id === selectedEntityId));
  const areaNodes = enemyAreas.map((area) => createSceneTreeNode('A', area.id, () => selectEnemyArea(area.id), area.id === selectedEnemyAreaId));
  const assetNodes = assets.map((asset) => createSceneTreeNode('3D', asset.name, () => instantiateAsset(asset)));
  const settingsNode = createSceneTreeNode('S', 'Luz e cor do céu', () => {
    selectEntity('directionalLight');
    setPanelOpen('inspector-panel', true, document.querySelector('#inspector-toggle'));
  }, selectedEntityId === 'directionalLight');
  sceneTree.replaceChildren(createSceneTreeGroup('Cena', 2 + (terrainRemoved ? 0 : 1), [terrainNode, lightNode, settingsNode]), createSceneTreeGroup('Entidades', listEditorEntities(entities).length, entityNodes), createSceneTreeGroup('Áreas inimigas', enemyAreas.length, areaNodes), createSceneTreeGroup('Assets', assets.length, assetNodes));
  document.querySelector('#scene-tree-count').textContent = String(listEditorEntities(entities).length + enemyAreas.length + assets.length + 1);
}
function selectEnemyArea(id) { selectedEnemyAreaId = id; updateEnemyAreaInspector(); renderEnemyAreas(); }
let selectedEnemyTypeId = null;
function selectedEnemyType() { return enemyTypes.find((type) => type.id === selectedEnemyTypeId) ?? null; }
function updateEnemyTypeInspector() {
  const type = selectedEnemyType();
  const inspector = document.querySelector('#enemy-type-inspector');
  inspector.hidden = !type;
  if (!type) return;
  document.querySelector('#enemy-type-id').value = type.id;
  document.querySelector('#enemy-type-name').value = type.name;
  const modelSelect = document.querySelector('#enemy-type-model');
  modelSelect.replaceChildren(...assets.map((asset) => new Option(asset.name, asset.url)));
  if (type.model && !assets.some((asset) => asset.url === type.model)) modelSelect.append(new Option(type.model, type.model));
  modelSelect.value = type.model;
  ['level', 'maxHp', 'speed', 'defense', 'damage', 'experience', 'scale'].forEach((field) => { document.querySelector(`#enemy-type-${field}`).value = type[field]; });
  document.querySelector('#enemy-type-gold-min').value = type.gold.min;
  document.querySelector('#enemy-type-gold-max').value = type.gold.max;
  document.querySelector('#enemy-type-drops').value = JSON.stringify(type.itemDrops, null, 2);
}
function updateEnemyTypeField(input) {
  const type = selectedEnemyType();
  if (!type) return;
  pushHistory();
  const field = input.dataset.enemyTypeField;
  if (field === 'itemDrops') {
    try { type.itemDrops = JSON.parse(input.value); } catch { setStatus('Drops inválidos: use um JSON de lista'); return; }
  } else if (field === 'gold.min' || field === 'gold.max') {
    type.gold[field.split('.')[1]] = Number(input.value);
  } else if (field === 'model') {
    const asset = assets.find((item) => item.url === input.value);
    type.model = input.value;
    type.modelFormat = asset?.format ?? assetFormat(input.value);
  } else type[field] = input.value;
  normalizeEnemyType(type);
  updateEnemyTypeInspector();
  renderEnemyTypes();
  updateSummary();
}
function createEnemyType() {
  const type = normalizeEnemyType({ id: newId('enemy'), name: 'Novo inimigo', model: assets[0]?.url ?? '', gold: { min: 0, max: 0 }, itemDrops: [] });
  enemyTypes.push(type); selectedEnemyTypeId = type.id; renderEnemyTypes(); updateEnemyTypeInspector(); updateSummary();
}
function updateEnemyAreaInspector() {
  const area = selectedEnemyArea(); const inspector = document.querySelector('#enemy-area-inspector'); inspector.hidden = !area; if (!area) return;
  document.querySelector('#enemy-area-id').value = area.id;
  document.querySelectorAll('[data-area-vector="center"] input').forEach((input) => { input.value = Number(area.center[Number(input.dataset.index)]).toFixed(2); });
  const typeSelect = document.querySelector('#enemy-area-type');
  typeSelect.replaceChildren(...enemyTypes.map((type) => new Option(type.name, type.id)));
  typeSelect.value = area.enemyType;
  document.querySelectorAll('[data-area-field]:not(#enemy-area-type)').forEach((input) => { input.value = area[input.dataset.areaField]; });
}
function createEnemyArea() { return normalizeEnemyArea({ id: newId('enemy-area'), center: [0, 0, 0], width: 25, depth: 25, maxEnemies: 5, enemyType: 'rat', areaLevel: 1, spawnIntervalMs: 3000 }); }
function updateEnemyAreaField(input) {
  const area = selectedEnemyArea(); if (!area) return; pushHistory(); const field = input.dataset.areaField; const value = field === 'enemyType' ? input.value.trim() || 'rat' : Number(input.value); area[field] = field === 'enemyType' ? value : (Number.isFinite(value) ? value : 0); normalizeEnemyArea(area); updateEnemyAreaInspector(); renderEnemyAreaVisuals(); updateSummary();
}
function makeAreaVectorFields() {
  const container = document.querySelector('[data-area-vector="center"]');
  container.replaceChildren(...['x', 'y', 'z'].map((axis, index) => { const label = document.createElement('label'); label.textContent = axis.toUpperCase(); const input = document.createElement('input'); input.type = 'number'; input.step = '0.1'; input.dataset.areaIndex = String(index); input.addEventListener('change', () => { const area = selectedEnemyArea(); if (!area) return; pushHistory(); const value = Number(input.value); area.center[index] = Number.isFinite(value) ? value : 0; normalizeEnemyArea(area); updateEnemyAreaInspector(); renderEnemyAreaVisuals(); updateSummary(); }); label.append(input); return label; }));
}
function assetFormat(name) { return name.split('?')[0].split('.').pop().toLowerCase(); }
function readFileAsDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.addEventListener('load', () => resolve(String(reader.result))); reader.addEventListener('error', () => reject(reader.error ?? new Error('Não foi possível ler o arquivo'))); reader.readAsDataURL(file); }); }
function readFileAsText(file) { return file.text(); }
function renderAssets() {
  assetList.replaceChildren(...assets.map((asset) => { const item = document.createElement('div'); item.className = 'asset-item'; const addButton = document.createElement('button'); addButton.className = 'asset-add'; addButton.type = 'button'; addButton.innerHTML = `<span class="asset-icon">3D</span><span>${asset.name}</span>`; addButton.title = 'Adicionar à cena'; addButton.addEventListener('click', () => instantiateAsset(asset)); const removeButton = document.createElement('button'); removeButton.className = 'asset-remove icon-button'; removeButton.type = 'button'; removeButton.textContent = '×'; removeButton.title = `Remover ${asset.name}`; removeButton.addEventListener('click', () => removeAsset(asset.id)); item.append(addButton, removeButton); return item; }));
  document.querySelector('#asset-count').textContent = String(assets.length);
  renderSceneTree();
}
function removeAsset(assetId) {
  const asset = assets.find((item) => item.id === assetId); if (!asset) return;
  pushHistory();
  entities.filter((entity) => entity.assetId === assetId).forEach((entity) => { clearCollisionVisual(entity); if (entity.object) { entityGroup.remove(entity.object); disposeObject(entity.object); } });
  entities = entities.filter((entity) => entity.assetId !== assetId);
  if (selectedEntityId && !selectedEntity()) { selectedEntityId = null; gizmos.detach(); }
  assets = assets.filter((item) => item.id !== assetId);
  if (player.assetId === assetId) {
    player.assetId = null;
    player.model = '';
    player.modelFormat = 'glb';
  }
  renderAssets(); renderEntities(); updateInspector(); updatePlayerInspector(); updateSummary(); setStatus(`Asset ${asset.name} removido`);
}
function makeVectorFields() {
  document.querySelectorAll('[data-vector]').forEach((container) => {
    const vector = container.dataset.vector;
    container.replaceChildren(...['x', 'y', 'z'].map((axis, index) => { const label = document.createElement('label'); label.textContent = axis.toUpperCase(); const input = document.createElement('input'); input.type = 'number'; input.step = vector === 'rotation' ? '1' : '0.1'; input.dataset.vector = vector; input.dataset.index = String(index); input.addEventListener('change', () => updateVector(input)); label.append(input); return label; }));
  });
}
function renderMeshList(entity) {
  const materials = entity?.materials ?? [];
  meshCount.textContent = String(materials.length);
  meshList.replaceChildren(...materials.map((material, index) => {
    const button = document.createElement('button');
    button.className = `mesh-item${index === selectedMaterialIndex ? ' mesh-item-selected' : ''}`;
    button.type = 'button';
    button.innerHTML = `<span class="mesh-swatch" style="background:${colorToHex(material.diffuseColor)}"></span><span>Mesh ${index + 1} · ${material.name}</span>`;
    button.addEventListener('click', () => { selectedMaterialIndex = index; updateInspector(); });
    return button;
  }));
}
function updateInspector() {
  const entity = selectedEntity(); const active = Boolean(entity); entityInspector.hidden = !active; emptyInspector.hidden = active; playerPreviewInspector.hidden = !entity?.isPlayerPreview; if (!entity) { updateAnimationInspector(); return; }
  document.querySelector('#entity-name').value = entity.name;

  const isTerrain = entity.type === 'terrain';
  const isDirectionalLight = entity.type === 'directionalLight';
  const isPointLight = entity.type === 'pointLight';
  pointLightInspector.hidden = !isPointLight;

  if (isTerrain) {
    entityInspector.querySelectorAll('.component-tab').forEach((tab) => tab.hidden = tab.dataset.componentTab !== 'transform');
    entityInspector.querySelectorAll('.component-panel').forEach((panel) => { panel.hidden = panel.dataset.componentPanel !== 'transform'; });
    setComponentTab('transform');
    if (ground) {
      terrainEntity.position = normalizeVector(ground.position.toArray(), [0, 0, 0]);
      terrainEntity.rotation = normalizeVector([ground.rotation.x, ground.rotation.y, ground.rotation.z], [0, 0, 0]);
      terrainEntity.scale = normalizeVector(ground.scale.toArray(), [1, 1, 1]);
    }
    entityInspector.querySelectorAll('.vector-fields[data-vector] input').forEach((input) => {
      const value = terrainEntity[input.dataset.vector][Number(input.dataset.index)];
      input.value = input.dataset.vector === 'rotation' ? THREE.MathUtils.radToDeg(value).toFixed(1) : Number(value).toFixed(2);
    });
    return;
  }

  if (isDirectionalLight) {
    entityInspector.querySelectorAll('.component-tab').forEach((tab) => tab.hidden = tab.dataset.componentTab !== 'transform');
    entityInspector.querySelectorAll('.component-panel').forEach((panel) => { panel.hidden = panel.dataset.componentPanel !== 'transform'; });
    setComponentTab('transform');
    directionalLightEntity.position = normalizeVector([lighting.directional.direction[0], lighting.directional.direction[1], lighting.directional.direction[2]], [0, 0, 0]);
    directionalLightEntity.rotation = [0, 0, 0];
    directionalLightEntity.scale = [1, 1, 1];
    entityInspector.querySelectorAll('.vector-fields[data-vector] input').forEach((input) => {
      const value = directionalLightEntity[input.dataset.vector][Number(input.dataset.index)];
      input.value = input.dataset.vector === 'rotation' ? THREE.MathUtils.radToDeg(value).toFixed(1) : Number(value).toFixed(2);
    });
    return;
  }

  entityInspector.querySelectorAll('.component-panel').forEach((panel) => { panel.hidden = false; });
  entityInspector.querySelectorAll('.component-tab').forEach((tab) => { tab.hidden = false; });

  if (isPointLight) {
    normalizePointLight(entity);
    entityLightColorInput.value = colorToHex(entity.light.color);
    entityLightIntensityInput.value = entity.light.intensity;
    entityLightIntensityValue.textContent = entity.light.intensity.toFixed(2);
    entityLightDistanceInput.value = entity.light.distance;
    entityLightDistanceValue.textContent = entity.light.distance.toFixed(2);
  }
  if (entity.isPlayerPreview) updatePlayerInspector();
  normalizeEntityShadows(entity);
  entityReceiveLightInput.checked = entity.receiveLight;
  entityCastShadowInput.checked = entity.castShadow;
  if (selectedMaterialIndex >= (entity.materials?.length ?? 0)) selectedMaterialIndex = 0;
  renderMeshList(entity);
  entityDiffuseColorInput.value = colorToHex(entity.materials?.[selectedMaterialIndex]?.diffuseColor ?? [1, 1, 1]);
  normalizeCollision(entity);
  document.querySelector('#collision-enabled').checked = entity.collision.enabled;
  document.querySelector('#collision-shape').value = entity.collision.shape;
  document.querySelector('#collision-body-type').value = entity.collision.bodyType;
  collisionFrictionInput.value = entity.collision.friction;
  collisionFrictionValue.textContent = entity.collision.friction.toFixed(2);
  collisionRestitutionInput.value = entity.collision.restitution;
  collisionRestitutionValue.textContent = entity.collision.restitution.toFixed(2);
  entityInspector.querySelectorAll('[data-collision-vector] input').forEach((input) => {
    const vector = input.parentElement.parentElement.dataset.collisionVector;
    input.value = Number(entity.collision[vector][Number(input.dataset.index)]).toFixed(2);
  });
  entityInspector.querySelectorAll('.vector-fields[data-vector] input').forEach((input) => { const value = entity[input.dataset.vector][Number(input.dataset.index)]; input.value = input.dataset.vector === 'rotation' ? THREE.MathUtils.radToDeg(value).toFixed(1) : Number(value).toFixed(2); });
  updateAnimationInspector();
}
function updateVector(input) {
  const entity = selectedEntity(); if (!entity) return; const vector = input.dataset.vector; const index = Number(input.dataset.index); const value = Number(input.value); const safeValue = Number.isFinite(value) ? value : 0;

  if (entity.type === 'terrain') {
    if (!ground) return;
    if (vector === 'position') ground.position.setComponent(index, safeValue);
    else if (vector === 'rotation') ground.rotation.set(index === 0 ? THREE.MathUtils.degToRad(safeValue) : ground.rotation.x, index === 1 ? THREE.MathUtils.degToRad(safeValue) : ground.rotation.y, index === 2 ? THREE.MathUtils.degToRad(safeValue) : ground.rotation.z);
    else if (vector === 'scale') ground.scale.setComponent(index, safeValue);
    terrainEntity.position = normalizeVector(ground.position.toArray(), [0, 0, 0]);
    terrainEntity.rotation = normalizeVector([ground.rotation.x, ground.rotation.y, ground.rotation.z], [0, 0, 0]);
    terrainEntity.scale = normalizeVector(ground.scale.toArray(), [1, 1, 1]);
    updateInspector(); updateSummary(); return;
  }

  if (entity.type === 'directionalLight') {
    const direction = [...lighting.directional.direction];
    direction[index] = safeValue;
    lighting.directional.direction = normalizeVector(direction, [-0.45, 0.85, 0.35]);
    updateSceneAmbientLight();
    updateLightingInspector();
    updateSummary();
    return;
  }

  normalizeEntityTransform(entity); entity[vector][index] = vector === 'rotation' ? THREE.MathUtils.degToRad(safeValue) : safeValue; applyEntityTransform(entity); updateCollisionVisual(entity); gizmos.update(entity.object); if (entity.isPlayerPreview) syncPlayerFromPreview(entity); updateInspector(); updateSummary();
}
function setMode(next) { mode = next; document.querySelectorAll('.mode-button').forEach((button) => button.classList.toggle('mode-button-active', button.dataset.mode === mode)); orbit.enabled = mode !== 'terrain'; gizmos.setMode(mode); canvas.style.cursor = mode === 'terrain' ? 'crosshair' : 'default'; }
function exportConfig() {
  return worldController.exportConfig();
}
function updateSummary() {
  worldController.updateSummary();
}
function updatePlayerInspector() {
  const set = (id, value) => { const input = document.querySelector(`#${id}`); if (input) input.value = value; };
  const assetSelect = document.querySelector('#player-asset');
  if (assetSelect) {
    assetSelect.replaceChildren(new Option('Modelo padrão', ''));
    assets.forEach((asset) => assetSelect.add(new Option(asset.name, asset.id)));
    assetSelect.value = player.assetId ?? '';
  }
  const selectedAsset = assets.find((asset) => asset.id === player.assetId);
  set('player-model-format', selectedAsset?.format ?? player.modelFormat);
  const maxHp = Math.max(1, Number(player.status?.maxHp ?? 20) || 20);
  set('player-speed', player.speed); set('player-hp', Math.min(maxHp, Math.max(0, Number(player.status?.hp ?? maxHp)))); set('player-max-hp', maxHp); set('player-animation', player.animation.name); set('player-status', JSON.stringify(player.status)); set('player-inventory', JSON.stringify(player.inventory));
}
function readPlayerInspector() {
  const json = (id, fallback) => { try { const value = JSON.parse(document.querySelector(`#${id}`).value); return value && typeof value === 'object' ? value : fallback; } catch { return fallback; } };
  const selectedAsset = assets.find((asset) => asset.id === document.querySelector('#player-asset').value);
  player.assetId = selectedAsset?.id ?? null;
  if (selectedAsset) {
    player.model = selectedAsset.url;
    player.modelFormat = selectedAsset.format;
  } else {
    player.model = player.model || '';
    player.modelFormat = document.querySelector('#player-model-format').value;
  }
  player.speed = Math.max(0, Number(document.querySelector('#player-speed').value) || 0);
  player.animation.name = document.querySelector('#player-animation').value.trim();
  player.status = json('player-status', player.status);
  player.status.maxHp = Math.max(1, Number(document.querySelector('#player-max-hp').value) || 1);
  player.status.hp = Math.min(player.status.maxHp, Math.max(0, Number(document.querySelector('#player-hp').value) || 0));
  player.inventory = Array.isArray(json('player-inventory', [])) ? json('player-inventory', []) : [];
  const previewEntity = playerPreview;
  if (previewEntity) {
    player.position = [...previewEntity.position];
    player.rotation = [...previewEntity.rotation];
    player.scale = [...previewEntity.scale];
    player.collision = { ...previewEntity.collision };
    previewEntity.assetId = player.assetId;
    previewEntity.animation = { ...player.animation };
    previewEntity.collision = { ...player.collision };
  }
  updateSummary();
}
async function loadModel(url, format = null, dependencies = null) { const extension = format ?? url.split('?')[0].split('.').pop().toLowerCase(); if (extension === 'obj') { const loader = new OBJLoader(); const mtlName = Object.keys(dependencies ?? {}).find((name) => name.toLowerCase().endsWith('.mtl')); const mtlData = mtlName ? dependencies[mtlName] : null; try { if (mtlData) { let text = await (await fetch(mtlData)).text(); text = text.replace(/^\s*map_Kd\s+(.+)$/gim, (line, path) => { const key = path.trim().replaceAll('\\', '/').split('/').pop(); return dependencies[key] ? `map_Kd ${dependencies[key]}` : line; }); const materials = new MTLLoader().parse(text, '/'); materials.preload(); loader.setMaterials(materials); } } catch { /* OBJ sem MTL continua usando material padrão. */ } return { object: await loader.loadAsync(url), animations: [] }; } const manager = new THREE.LoadingManager();
manager.setURLModifier((resourceUrl) => {
  const key = decodeURIComponent(resourceUrl).replaceAll('\\', '/').split('/').pop().toLowerCase();
  const dependency = Object.entries(dependencies ?? {}).find(([name]) => (
    name.replaceAll('\\', '/').split('/').pop().toLowerCase() === key
  ));
  return dependency?.[1] ?? resourceUrl;
});
const result = await new GLTFLoader(manager).loadAsync(url); return { object: result.scene, animations: result.animations }; }
async function instantiateAsset(asset) { if (!asset || typeof asset !== 'object') return; try { setStatus(`Carregando ${asset.name}...`); const loaded = await loadModel(asset.url, asset.format, asset.dependencies); const object = loaded.object; object.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } }); const entity = asset._definition ? { ...asset._definition, object } : { ...createEntity(asset.name, asset.id), materials: readObjectMaterials(object), object }; addEntity(entity, object, loaded.animations); setMode('translate'); setStatus(`${asset.name} adicionado à cena`); } catch (error) { setStatus(`Falha ao carregar ${asset?.name ?? 'asset'}: ${error.message}`); } }
async function registerAsset(url, name, source = url, format = assetFormat(name), dependencies = null) { const asset = { id: newId('asset'), name, url, source, format, dependencies }; assets.push(asset); renderAssets(); updatePlayerInspector(); updateSummary(); await instantiateAsset(asset); }
function download() { return worldController.download(); }
let applyingMap = false;
async function applyToGame() {
  if (applyingMap) return;
  applyingMap = true;
  setStatus('Aplicando mundo no jogo...');
  try {
    readPlayerInspector();
    const config = exportConfig();
    const response = await fetch(`${httpUrl}/api/map-config`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(config),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus(result?.error ?? `Não foi possível aplicar o mundo (HTTP ${response.status})`);
      return;
    }
    try { saveMapConfig(config); } catch { /* O mapa já foi salvo no servidor. */ }
    setStatus('Mundo aplicado no jogo');
  } catch {
    setStatus('Falha de conexão ao aplicar o mundo no jogo');
  } finally {
    applyingMap = false;
  }
}
// Carrega o mundo a partir de uma configuração JSON, normalizando os dados e atualizando a cena.
async function loadWorld(config) {
  return worldController.loadWorld(config);
}
// Carrega o mundo salvo do servidor ou do armazenamento local.
async function loadSavedWorld() {
  return worldController.loadSavedWorld();
}

const editorEventContext = {
  setMode, setStatus, setPanelOpen, setInspectorTab, setComponentTab,
  updateEnemyTypeField, updateEnemyAreaField, updateVector, updateSummary,
  renderSounds, renderEnemyAreas, renderEnemyTypes, renderEntities, updateInspector,
  updateTerrainInspector, updateSceneAtmosphere, updateSceneAmbientLight, updateLightingInspector,
  updatePlayerInspector, readPlayerInspector, refreshPlayerPreview, applyToGame, undo, redo,
  loadWorld, registerAsset, instantiateAsset, assetFormat, readFileAsDataUrl, addEntity,
  createEntity, createPrimitive, createPointLight, createEnemyArea, createEnemyType,
  duplicateSelectedEntity, removeEntity, updateEnemyAreaInspector, selectedEnemyArea,
  selectedEntity, pushHistory, setTerrainRemoved,
  applyTerrainBrushToGround: (point) => applyTerrainBrushToGround(ground, terrainConfig, point),
  updateCollisionVisual, renderSceneTree, updateAnimationInspector, setAnimationPlaying,
  stopAnimation, applyEntityAnimation, syncPlayerFromPreview, renderMeshList,
  normalizeCollision, normalizeEntityMaterials, applyEntityMaterials, configureTerrainMesh,
  download, exportConfig, loadSavedWorld, listEditorEntities, newId, clearCollisionVisual,
  selectEntity, selectEnemyArea, materialIndexForObject, resize, lights: [],
  entityNameInput: document.querySelector('#entity-name'),
  collisionEnabledInput: document.querySelector('#collision-enabled'),
  collisionShapeInput: document.querySelector('#collision-shape'),
  collisionBodyTypeInput: document.querySelector('#collision-body-type'),
  selectedEntityLabel, entityInspector, emptyInspector, playerPreviewInspector,
  pointLightInspector, meshCount, meshList, animationPlayButton, animationPauseButton,
  animationStopButton, animationSelect, animationLoopInput, animationSpeedInput,
  animationSpeedValue, componentTabs, soundType, soundUrl, soundList, status, canvas,
  ground, raycaster, pointer, camera, entityGroup, coordinates, hover,
  orbit, collisionFrictionInput, collisionRestitutionInput,
  entityLightIntensityValue, entityLightDistanceValue, terrainWidthInput, terrainDepthInput,
  terrainSegmentsInput, terrainAmplitudeInput, terrainFrequencyInput, terrainColorInput,
  terrainBrushRadiusInput, terrainBrushStrengthInput, ambientColorInput, ambientIntensityInput,
  directionalIntensityInput, directionalCastShadowInput, directionalInputs, directionalValues,
  skyColorInput, fogColorInput, fogNearInput, fogFarInput, terrainWidthValue, terrainDepthValue,
  terrainSegmentsValue, terrainAmplitudeValue, terrainFrequencyValue, terrainBrushRadiusValue,
  terrainBrushStrengthValue, ambientIntensityValue, directionalIntensityValue, sceneTree,
  panelToggles,
  entityDiffuseColorInput: document.querySelector('#entity-diffuse-color'),
  entityTextureFileInput: document.querySelector('#entity-texture-file'),
  entityReceiveLightInput: document.querySelector('#entity-receive-light'),
  entityCastShadowInput: document.querySelector('#entity-cast-shadow'),
  entityLightColorInput: document.querySelector('#entity-light-color'),
  entityLightIntensityInput: document.querySelector('#entity-light-intensity'),
  entityLightDistanceInput: document.querySelector('#entity-light-distance'),
};
Object.defineProperties(editorEventContext, {
  entities: { get: () => entities, set: (value) => { entities = value; } },
  assets: { get: () => assets, set: (value) => { assets = value; } },
  sounds: { get: () => sounds, set: (value) => { sounds = value; } },
  enemyAreas: { get: () => enemyAreas, set: (value) => { enemyAreas = value; } },
  enemyTypes: { get: () => enemyTypes, set: (value) => { enemyTypes = value; } },
  terrainConfig: { get: () => terrainConfig, set: (value) => { terrainConfig = value; } },
  lighting: { get: () => lighting, set: (value) => { lighting = value; } },
  skyColor: { get: () => skyColor, set: (value) => { skyColor = value; } },
  fog: { get: () => fog, set: (value) => { fog = value; } },
  player: { get: () => player, set: (value) => { player = value; } },
  selectedEntityId: { get: () => selectedEntityId, set: (value) => { selectedEntityId = value; } },
  selectedEnemyAreaId: { get: () => selectedEnemyAreaId, set: (value) => { selectedEnemyAreaId = value; } },
  mode: { get: () => mode, set: (value) => { mode = value; } },
  terrainRemoved: { get: () => terrainRemoved, set: (value) => { terrainRemoved = Boolean(value); } },
  terrainBrushActive: { get: () => terrainBrushActive, set: (value) => { terrainBrushActive = value; } },
  gizmoDragging: { get: () => gizmoDragging, set: (value) => { gizmoDragging = value; } },
  selectedMaterialIndex: { get: () => selectedMaterialIndex, set: (value) => { selectedMaterialIndex = value; } },
});
bindEditorEvents(editorEventContext);

makeVectorFields(); makeAreaVectorFields(); normalizeSkyColor(); normalizeFog(); updateSceneAtmosphere(); normalizeLighting(); updateLightingInspector(); renderEnemyAreas(); await loadSavedWorld(); resize(); setMode('select');
let lastFrameTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const delta = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  entities.forEach((entity) => entity.animationMixer?.update(delta));
  editorScene.renderFrame(delta);
}
animate();
