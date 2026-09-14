import * as THREE from 'three';

export function normalizeVector(value, fallback = [0, 0, 0]) {
  return Array.from({ length: 3 }, (_, index) => {
    const item = Array.isArray(value) ? value[index] : value?.[index];
    return item === null || item === undefined || !Number.isFinite(Number(item))
      ? fallback[index]
      : Number(item);
  });
}

export function normalizeColor(value, fallback = [1, 1, 1]) {
  return normalizeVector(value, fallback).map((channel) => Math.min(1, Math.max(0, channel)));
}

export function colorToHex(color) {
  return `#${color
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function uniqueEntityName(name, items = [], ignoredId = null) {
  const baseName = String(name).trim() || 'Entidade vazia';
  const list = Array.isArray(items) ? items : [];
  const normalizedNames = new Set(
    list
      .filter((item) => item && item.id !== ignoredId)
      .map((item) => String(item.name).trim().toLowerCase()),
  );

  let uniqueName = baseName;
  let suffix = 2;
  while (normalizedNames.has(uniqueName.toLowerCase())) {
    uniqueName = `${baseName} ${suffix}`;
    suffix += 1;
  }
  return uniqueName;
}

export function normalizeCollision(entity) {
  const collision = entity.collision ?? {};
  entity.collision = {
    enabled: collision.enabled === true,
    shape: ['model', 'box', 'convex', 'capsule'].includes(collision.shape) ? collision.shape : 'box',
    bodyType: ['rigidBody', 'staticBody', 'characterBody'].includes(collision.bodyType) ? collision.bodyType : 'staticBody',
    offset: normalizeVector(collision.offset, [0, 0, 0]),
    scale: normalizeVector(collision.scale, [1, 1, 1]).map((value) => Math.max(0.01, Math.abs(value))),
    friction: Math.min(1, Math.max(0, Number(collision.friction ?? 0.3) || 0)),
    restitution: Math.min(1, Math.max(0, Number(collision.restitution ?? 0) || 0)),
  };
  return entity;
}

export function createPrimitiveObject(type) {
  const geometries = {
    box: () => new THREE.BoxGeometry(1, 1, 1),
    sphere: () => new THREE.SphereGeometry(0.5, 32, 16),
    cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
    cone: () => new THREE.ConeGeometry(0.5, 1, 32),
    capsule: () => new THREE.CapsuleGeometry(0.35, 0.3, 8, 16),
    plane: () => new THREE.PlaneGeometry(1, 1),
  };

  const geometry = geometries[type]?.();
  if (!geometry) return null;
  if (type === 'plane') geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({ color: 0x7eb6ff, roughness: 0.72, metalness: 0.05 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function listEditorEntities(items = []) {
  const specialEntities = [
    { id: 'terrain', name: 'Terreno', type: 'terrain', scene: 'terrain', enabled: true, isSpecial: true },
    { id: 'directionalLight', name: 'Luz direta', type: 'directionalLight', scene: 'lighting', enabled: true, isSpecial: true },
  ];

  return [...specialEntities, ...(Array.isArray(items) ? items : [])];
}
