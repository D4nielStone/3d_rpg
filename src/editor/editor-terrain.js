import * as THREE from 'three';

export function configureTerrainMesh(plane, config = {}) {
  const width = Math.max(1, Number(config.width) || 128);
  const depth = Math.max(1, Number(config.depth) || 128);
  const segments = Math.max(8, Math.floor(Number(config.segments) || 64));
  const geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  const centerX = width / 2;
  const centerZ = depth / 2;

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index) + centerX;
    const z = position.getZ(index) + centerZ;
    const storedHeight = config.heights?.length === position.count ? config.heights[index] : undefined;
    const height = Number.isFinite(storedHeight)
      ? storedHeight
      : config.amplitude * Math.sin(x * config.frequency) * Math.cos(z * config.frequency);
    position.setY(index, height);
  }

  geometry.computeVertexNormals();
  plane.geometry.dispose();
  plane.geometry = geometry;
  plane.position.set(-0.5, -0.16, -0.5);
  return plane;
}

export function applyTerrainBrushToGround(ground, terrainConfig, point) {
  if (!ground || !point || !terrainConfig) return;

  const position = ground.geometry.attributes.position;
  const local = point.clone().applyMatrix4(ground.matrixWorld.clone().invert());

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const dx = x - local.x;
    const dz = z - local.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance > terrainConfig.brushRadius) continue;

    const falloff = 1 - distance / terrainConfig.brushRadius;
    position.setY(index, position.getY(index) + terrainConfig.brushStrength * falloff * falloff);
  }

  position.needsUpdate = true;
  ground.geometry.computeVertexNormals();
  terrainConfig.heights = Array.from(position.array).filter((_, index) => index % 3 === 1);
}
