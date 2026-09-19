import * as THREE from 'three';
import { normalizeVector, normalizeColor, normalizeCollision, createCollisionSurface } from './editor-utils.js';
import { normalizePointLight } from './editor-scene-state.js';

export function normalizeEntityTransform(entity) {
  entity.position = normalizeVector(entity.position, [0, 0, 0]);
  entity.rotation = normalizeVector(entity.rotation, [0, 0, 0]);
  entity.scale = normalizeVector(entity.scale, [1, 1, 1]);
  return entity;
}

export function normalizeEntityMaterials(entity) {
  entity.materials = Array.isArray(entity.materials)
    ? entity.materials.map((material) => ({ ...material, diffuseColor: normalizeColor(material.diffuseColor) }))
    : [];
  return entity;
}

export function normalizeEntityShadows(entity) {
  entity.receiveLight = entity.receiveLight !== false;
  entity.castShadow = entity.castShadow !== false;
  return entity;
}

export function normalizeEntityAnimation(entity) {
  entity.animation = {
    name: String(entity.animation?.name ?? ''),
    speed: Math.max(0, Number(entity.animation?.speed ?? 1) || 0),
    loop: entity.animation?.loop !== false,
    playing: entity.animation?.playing !== false,
  };
  return entity;
}

export function applyEntityTransform(entity) {
  if (!entity.object) return;
  normalizeEntityTransform(entity);
  entity.object.position.fromArray(entity.position);
  entity.object.rotation.set(...entity.rotation);
  entity.object.scale.fromArray(entity.scale);
  entity.object.updateMatrixWorld(true);
}

export function applyEntityMaterials(entity) {
  if (!entity.object) return;
  normalizeEntityMaterials(entity);

  let index = 0;
  entity.object.traverse((child) => {
    if (!child.isMesh) return;
    const meshMaterials = Array.isArray(child.material) ? child.material : [child.material];
    meshMaterials.forEach((material) => {
      const definition = entity.materials[index++];
      if (!material || !definition) return;
      if (material.color) material.color.setRGB(...definition.diffuseColor);
      if ('vertexColors' in material) material.vertexColors = false;
      material.needsUpdate = true;
    });
  });
}

export function readObjectMaterials(object) {
  const materials = [];
  object.traverse((child) => {
    if (!child.isMesh) return;
    const meshMaterials = Array.isArray(child.material) ? child.material : [child.material];
    meshMaterials.forEach((material) => {
      materials.push({
        name: material?.name || `material-${materials.length}`,
        diffuseColor: material?.color ? [material.color.r, material.color.g, material.color.b] : [1, 1, 1],
      });
    });
  });
  return materials;
}

export function materialIndexForObject(entity, target) {
  let index = 0;
  let result = 0;
  entity.object?.traverse((child) => {
    if (!child.isMesh) return;
    const count = Array.isArray(child.material) ? child.material.length : 1;
    if (child === target) result = index;
    index += count;
  });
  return result;
}

export function markSelectable(object, id) {
  object.userData.entityId = id;
  object.traverse((child) => {
    child.userData.entityId = id;
  });
}

export function entitySnapshot(entity) {
  normalizeEntityTransform(entity);
  normalizeEntityMaterials(entity);
  normalizeEntityAnimation(entity);
  normalizeCollision(entity);
  normalizeEntityShadows(entity);
  applyEntityTransform(entity);

  if (entity.collision.enabled && entity.collision.shape === 'model') {
    const surface = createCollisionSurface(entity.object, 32, entity.collision.scale);
    if (surface) {
      surface.minX -= entity.position[0];
      surface.maxX -= entity.position[0];
      surface.minZ -= entity.position[2];
      surface.maxZ -= entity.position[2];
      surface.heights = surface.heights.map((height) => height - entity.position[1]);
    }
    entity.collision.surface = surface;
  }

  return {
    id: entity.id,
    name: entity.name,
    assetId: entity.assetId,
    primitive: entity.primitive ?? null,
    type: entity.type ?? null,
    light: entity.type === 'pointLight' ? { ...normalizePointLight(entity).light, color: [...entity.light.color] } : null,
    position: [...entity.position],
    rotation: [...entity.rotation],
    scale: [...entity.scale],
    receiveLight: entity.receiveLight,
    castShadow: entity.castShadow,
    materials: entity.materials.map((material) => ({ ...material, diffuseColor: [...material.diffuseColor], texture: material.texture ?? null })),
    animation: { ...entity.animation },
    collision: { ...entity.collision },
  };
}
