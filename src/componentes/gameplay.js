import { Material, MeshRenderer } from './render.js';

function createSwordBox(size, center, color) {
  const [width, height, depth] = size;
  const [centerX, centerY, centerZ] = center;
  const vertices = new Float32Array([
    centerX - width, centerY - height, centerZ + depth,
    centerX + width, centerY - height, centerZ + depth,
    centerX + width, centerY + height, centerZ + depth,
    centerX - width, centerY + height, centerZ + depth,
    centerX - width, centerY - height, centerZ - depth,
    centerX - width, centerY + height, centerZ - depth,
    centerX + width, centerY + height, centerZ - depth,
    centerX + width, centerY - height, centerZ - depth,
    centerX - width, centerY + height, centerZ - depth,
    centerX - width, centerY + height, centerZ + depth,
    centerX + width, centerY + height, centerZ + depth,
    centerX + width, centerY + height, centerZ - depth,
    centerX - width, centerY - height, centerZ - depth,
    centerX + width, centerY - height, centerZ - depth,
    centerX + width, centerY - height, centerZ + depth,
    centerX - width, centerY - height, centerZ + depth,
    centerX + width, centerY - height, centerZ - depth,
    centerX + width, centerY + height, centerZ - depth,
    centerX + width, centerY + height, centerZ + depth,
    centerX + width, centerY - height, centerZ + depth,
    centerX - width, centerY - height, centerZ - depth,
    centerX - width, centerY - height, centerZ + depth,
    centerX - width, centerY + height, centerZ + depth,
    centerX - width, centerY + height, centerZ - depth,
  ]);
  const vertexCount = vertices.length / 3;
  const colors = new Float32Array(Array.from({ length: vertexCount }, () => color).flat());
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ]);
  return { vertices, colors, indices, material: new Material({ diffuseColor: color }) };
}

export class SwordRenderer {
  constructor({ visible = true } = {}) {
    this.visible = visible;
    this.offset = [0.55, 0.2, -0.25];
    this.attackStartedAt = -Infinity;
    this.attackDuration = 260;
    this.meshRenderer = new MeshRenderer({
      meshes: [
        createSwordBox([0.055, 0.62, 0.025], [0, 0.72, 0], [0.78, 0.84, 0.92]),
        createSwordBox([0.018, 0.52, 0.032], [0, 0.75, 0], [0.92, 0.94, 1.0]),
        createSwordBox([0.035, 0.10, 0.027], [0, 1.34, 0], [0.88, 0.91, 0.98]),
        createSwordBox([0.19, 0.035, 0.055], [0, 0.075, 0], [0.82, 0.48, 0.08]),
        createSwordBox([0.055, 0.055, 0.065], [0, 0.075, 0], [0.95, 0.68, 0.16]),
        createSwordBox([0.052, 0.19, 0.052], [0, -0.15, 0], [0.20, 0.08, 0.035]),
        createSwordBox([0.062, 0.025, 0.06], [0, -0.055, 0], [0.78, 0.46, 0.08]),
        createSwordBox([0.062, 0.025, 0.06], [0, -0.245, 0], [0.78, 0.46, 0.08]),
        createSwordBox([0.085, 0.055, 0.07], [0, -0.30, 0], [0.72, 0.42, 0.08]),
        createSwordBox([0.035, 0.035, 0.08], [0, -0.30, 0], [1.0, 0.72, 0.18]),
      ],
    });
  }

  attack(time = performance.now()) { this.attackStartedAt = time; }

  getAttackPose(time = performance.now()) {
    const progress = Math.min(1, Math.max(0, (time - this.attackStartedAt) / this.attackDuration));
    const swing = Math.sin(progress * Math.PI);
    return { rotation: swing * 2.2, lift: swing * 0.18 };
  }
}

export class Water {
  constructor({ color = [0.08, 0.45, 0.72] } = {}) {
    this.color = color;
  }
}

export class DirectionalLightRenderer {
  constructor({
    color = [1, 0.95, 0.85],
    direction = [-0.45, 0.85, 0.35],
    intensity = 0.8,
    castShadow = true,
  } = {}) {
    this.color = [...color];
    this.direction = [...direction];
    this.intensity = Number(intensity) || 0;
    this.castShadow = castShadow !== false;
  }
}
