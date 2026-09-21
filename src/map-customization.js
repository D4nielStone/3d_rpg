import { AnimationPlayer, DirectionalLightRenderer, MeshRenderer, Rigidbody, ShadowRenderer, Texture, Transform } from './components.js';
import { loadAsset } from './asset-loader.js';
import { createWater } from './water.js';
import { readSavedMapConfig } from './map-config.js';

export const DEFAULT_MAP_CONFIG = Object.freeze({
  enemyTypes: [{
    id: 'rat',
    name: 'Rato',
    model: '',
    modelFormat: 'glb',
    level: 1,
    maxHp: 3,
    speed: 1.2,
    defense: 1,
    accuracy: 1,
    damage: 1,
    experience: 2,
    scale: 0.35,
    gold: { min: 3, max: 5 },
    itemDrops: [],
  }],
  enemyAreas: [{
    id: 'starting-rat-area',
    center: [0, 0, 0],
    width: 20,
    depth: 20,
    maxEnemies: 5,
    enemyType: 'rat',
    areaLevel: 1,
    spawnIntervalMs: 3000,
  }],
  water: {
    enabled: false,
    size: 50,
    segments: 32,
    level: -0.2,
  },
});

function addConfiguredRigidbody(world, entity, definition) {
  if (definition.collision?.bodyType !== 'rigidBody') return;
  const scale = definition.scale ?? [1, 1, 1];
  const collisionScale = definition.collision.scale ?? [1, 1, 1];
  const halfExtents = [0, 1, 2].map((index) => Math.max(
    0.01,
    Math.abs(Number(scale[index]) || 1) * Math.abs(Number(collisionScale[index]) || 1) * 0.5,
  ));
  world.addComponent(entity, new Rigidbody({
    halfExtents,
    offset: definition.collision.offset,
    gravity: definition.collision.gravity,
    mass: definition.collision.mass,
  }));
}

function createPrimitiveMesh(type) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const segments = 24;
  const addVertex = (position, normal, uv) => {
    positions.push(...position);
    normals.push(...normal);
    uvs.push(...uv);
    return positions.length / 3 - 1;
  };
  const addQuad = (a, b, c, d) => indices.push(a, b, c, a, c, d);
  const addBox = () => {
    const faces = [
      [[0, 0, 1], [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]]],
      [[0, 0, -1], [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]]],
      [[1, 0, 0], [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]]],
      [[-1, 0, 0], [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]]],
      [[0, 1, 0], [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]]],
      [[0, -1, 0], [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]]],
    ];
    faces.forEach(([normal, corners]) => {
      const first = corners.map((corner, index) => addVertex(corner, normal, [index === 1 || index === 2 ? 1 : 0, index >= 2 ? 1 : 0]));
      addQuad(...first);
    });
  };
  if (type === 'box') addBox();
  else if (type === 'plane') {
    const first = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5]].map((corner, index) => addVertex(corner, [0, 1, 0], [index === 1 || index === 2 ? 1 : 0, index >= 2 ? 1 : 0]));
    indices.push(first[0], first[2], first[1], first[0], first[3], first[2]);
  } else {
    const isCone = type === 'cone';
    const isCapsule = type === 'capsule';
    const rings = isCapsule ? 10 : 1;
    const ringIndices = [];
    for (let ring = 0; ring <= rings; ring += 1) {
      const t = ring / rings;
      const y = isCapsule ? -0.5 + t : -0.5 + t;
      const radius = isCone ? 0.5 * (1 - t) : 0.5;
      ringIndices.push(Array.from({ length: segments }, (_, index) => {
        const angle = index / segments * Math.PI * 2;
        return addVertex([Math.cos(angle) * radius, y, Math.sin(angle) * radius], [Math.cos(angle), isCone ? 0.5 : 0, Math.sin(angle)], [index / segments, t]);
      }));
    }
    for (let ring = 0; ring < rings; ring += 1) for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      addQuad(ringIndices[ring][index], ringIndices[ring][next], ringIndices[ring + 1][next], ringIndices[ring + 1][index]);
    }
    if (!isCapsule) {
      const bottom = addVertex([0, -0.5, 0], [0, -1, 0], [0.5, 0.5]);
      const top = addVertex([0, 0.5, 0], [0, 1, 0], [0.5, 0.5]);
      for (let index = 0; index < segments; index += 1) {
        const next = (index + 1) % segments;
        indices.push(bottom, ringIndices[0][next], ringIndices[0][index], top, ringIndices[rings][index], ringIndices[rings][next]);
      }
    }
  }
  if (!positions.length) return null;
  return new MeshRenderer({
    meshes: [{
      vertices: new Float32Array(positions),
      colors: new Float32Array(Array.from({ length: positions.length }, () => 1)),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices),
      material: { diffuseColor: [0.49, 0.71, 1], texture: null },
    }],
  });
}

function createDirectionalLight(world, lightingConfig = {}) {
  const direction = lightingConfig?.directional ?? {};
  if (!direction || typeof direction !== 'object') return;
  const entity = world.createEntity();
  world.addComponent(entity, new Transform({ position: direction.position ?? [0, 0, 0] }));
  world.addComponent(entity, new DirectionalLightRenderer({
    color: direction.color ?? [1, 0.95, 0.85],
    direction: direction.direction ?? [-0.45, 0.85, 0.35],
    intensity: direction.intensity ?? 0.8,
    castShadow: direction.castShadow !== false,
  }));
}

/** Esta função cria as entidades do mundo com base na configuração fornecida. */
async function createWorldEntities(world, config, textureManager) {
  // Cria um mapa de assets para facilitar a busca por ID
  const assets = new Map((config.assets ?? []).map((asset) => [asset.id, asset]));
  // Cria as entidades do mundo com base na configuração fornecida
  for (const definition of config.entities ?? []) {
    if (definition.primitive) {
      const mesh = createPrimitiveMesh(definition.primitive);
      if (!mesh) continue;
      const entity = world.createEntity();
      world.addComponent(entity, new Transform({
        position: definition.position,
        rotation: definition.rotation,
        scale: definition.scale,
      }));
      const material = mesh.meshes[0]?.material;
      mesh.receiveLight = definition.receiveLight !== false;
      mesh.castShadow = definition.castShadow !== false;
      const configuredMaterial = definition.materials?.[0]?.diffuseColor;
      if (Array.isArray(configuredMaterial)) material.diffuseColor = [...configuredMaterial];
      world.addComponent(entity, mesh);
      addConfiguredRigidbody(world, entity, definition);
      if (definition.castShadow !== false) world.addComponent(entity, new ShadowRenderer());
      continue;
    }
    const asset = assets.get(definition.assetId) ?? (
      definition.model
        ? { url: definition.model, format: definition.modelFormat }
        : null
    );
    if (!asset?.url || asset.url.startsWith('blob:') || asset.url.startsWith('local:')) continue;
    try {
      const loaded = await loadAsset(asset.url, asset.format, textureManager, asset.dependencies);
      const entity = world.createEntity();
      world.addComponent(entity, new Transform({
        position: definition.position,
        rotation: definition.rotation,
        scale: definition.scale,
      }));
      (definition.materials ?? []).forEach((materialDefinition, index) => {
        const material = loaded.mesh.meshes[index]?.material;
        if (material && Array.isArray(materialDefinition.diffuseColor)) material.diffuseColor = [...materialDefinition.diffuseColor];
      });
      loaded.mesh.receiveLight = definition.receiveLight !== false;
      loaded.mesh.castShadow = definition.castShadow !== false;
      world.addComponent(entity, loaded.mesh);
      addConfiguredRigidbody(world, entity, definition);
      if (definition.castShadow !== false) world.addComponent(entity, new ShadowRenderer());
      if (loaded.texture) world.addComponent(entity, loaded.texture);
      if (loaded.animations?.length) {
        console.log(`Adicionando animações para a entidade ${entity}:`, loaded.animations.map(a => a.name));
        let ap = world.addComponent(entity, new AnimationPlayer({
          animations: loaded.animations,
          mixer: loaded.animationMixer,
          onUpdate: loaded.animationUpdate,
        }));
        for (const animation of loaded.animations) {
          console.log(`Animação disponível: ${animation.name}`);
          console.log(`Duração: ${animation.duration} segundos`);
          console.log(`Número de quadros: ${animation.tracks.length}`);
        }
        // Se houver uma animação padrão definida, reproduza-a
        ap.play(loaded.animations[0].name, {loop: true});
      }
    } catch {
      // Um asset ausente não deve impedir o carregamento do restante do mundo.
    }
  }
}

export async function customizeMap(world, config = null, textureManager = null) {
  const activeConfig = config ?? readSavedMapConfig() ?? DEFAULT_MAP_CONFIG;
  const normalizedConfig = { ...DEFAULT_MAP_CONFIG, ...(activeConfig ?? {}) };
  if (normalizedConfig.water?.enabled) {
    createWater(world, normalizedConfig.water);
  }
  createDirectionalLight(world, normalizedConfig.lighting);
  if (textureManager && Array.isArray(normalizedConfig.entities)) {
    await createWorldEntities(world, normalizedConfig, textureManager);
  }
}
