import * as THREE from 'three';

function sampleTerrainHeight(x, z, radius, height) {
  const distance = Math.sqrt(x * x + z * z);
  if (distance >= radius) return 0;
  const falloff = 1 - distance / radius;
  return height * falloff * falloff;
}

export function createMountainObject({
  width = 4,
  depth = 4,
  segments = 32,
  radius = 1.6,
  height = 1.8,
} = {}) {
  const geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  const centerX = width * 0.5;
  const centerZ = depth * 0.5;

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index) + centerX;
    const z = position.getZ(index) + centerZ;
    const displacedY = sampleTerrainHeight(x - centerX, z - centerZ, radius, height);
    position.setY(index, displacedY);
  }

  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x7d8c72,
    roughness: 1,
    metalness: 0.02,
  });

  const terrain = new THREE.Mesh(geometry, material);
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  terrain.userData.terrainHeight = height;
  return terrain;
}

export function applyTerrainBrush(object, worldPoint, radius = 3, strength = 1) {
  if (!(object instanceof THREE.Mesh) || !(object.geometry instanceof THREE.BufferGeometry)) return;
  const inverse = new THREE.Matrix4().copy(object.matrixWorld).invert();
  const localPoint = worldPoint.clone().applyMatrix4(inverse);
  const position = object.geometry.attributes.position;
  const vector = new THREE.Vector3();

  for (let index = 0; index < position.count; index += 1) {
    vector.fromBufferAttribute(position, index);
    const dx = vector.x - localPoint.x;
    const dz = vector.z - localPoint.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance > radius) continue;
    const falloff = 1 - distance / radius;
    const raise = strength * falloff * falloff;
    vector.y += raise;
    position.setY(index, vector.y);
  }

  position.needsUpdate = true;
  object.geometry.computeVertexNormals();
}
