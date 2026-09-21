export class OutlineRenderer {
  constructor({ radius = 0.65, thickness = 0.08, color = [0.84, 0.66, 0.24], segments = 24 } = {}) {
    this.radius = radius;
    this.thickness = thickness;
    this.color = color;
    this.segments = segments;
    this.active = false;
    this.selected = false;
    this.vertices = new Float32Array();
    this.colors = new Float32Array();
    this.indices = new Uint16Array();
    this.positionBuffer = null;
    this.colorBuffer = null;
    this.indexBuffer = null;
    this.dirty = true;
  }

  getRadius(transform = null) {
    const scale = transform?.scale ?? [1, 1, 1];
    const width = Number(scale[0]) || 1;
    const depth = Number(scale[2]) || 1;
    const scaleFactor = Math.max(1, Math.max(Math.abs(width), Math.abs(depth)));
    return Number(this.radius) * scaleFactor;
  }
}

export class ShadowRenderer {
  constructor({ radius = [0.7, 0.4], segments = 24 } = {}) {
    const [radiusX, radiusZ] = radius;
    const vertices = [0, 0.01, 0];
    const colors = [0.02, 0.02, 0.02];
    const normals = [0, 1, 0];
    const indices = [];
    for (let index = 0; index <= segments; index += 1) {
      const angle = index / segments * Math.PI * 2;
      vertices.push(Math.cos(angle) * radiusX, 0.01, Math.sin(angle) * radiusZ);
      colors.push(0.02, 0.02, 0.02);
      normals.push(0, 1, 0);
      if (index > 0) indices.push(0, index, index + 1);
    }
    this.vertices = new Float32Array(vertices);
    this.colors = new Float32Array(colors);
    this.normals = new Float32Array(normals);
    this.indices = new Uint16Array(indices);
    this.positionBuffer = null;
    this.colorBuffer = null;
    this.normalBuffer = null;
    this.indexBuffer = null;
  }
}

export class EnemyAreaRenderer {}

export class Texture {
  constructor({
    image = null,
    source = null,
    wrapS = 'CLAMP_TO_EDGE',
    wrapT = 'CLAMP_TO_EDGE',
    minFilter = 'LINEAR',
    magFilter = 'LINEAR',
    name = 'texture',
  } = {}) {
    this.image = image ?? source ?? null;
    this.wrapS = wrapS;
    this.wrapT = wrapT;
    this.minFilter = minFilter;
    this.magFilter = magFilter;
    this.name = name;
    this.glTexture = null;
  }
}

export class Material {
  constructor({ diffuseColor = [1, 1, 1], texture = null, name = 'material' } = {}) {
    this.diffuseColor = [...diffuseColor];
    this.texture = texture;
    this.name = name;
  }
}

export class MeshRenderer {
  constructor({ meshes = null, vertices, colors, indices, normals = null, uvs = null, texture = null, material = null, receiveLight = true, castShadow = true, tags = [] }) {
    this.receiveLight = receiveLight;
    this.castShadow = castShadow;
    this.tags = Array.isArray(tags) ? [...tags] : [];
    this.meshes = meshes ?? [{
      vertices,
      colors,
      indices,
      normals,
      uvs,
      material: material ?? new Material({ texture }),
    }];
    this.meshes.forEach((mesh) => {
      if (!mesh.normals) {
        mesh.normals = new Float32Array(mesh.vertices.length).fill(0);
        for (let index = 1; index < mesh.normals.length; index += 3) mesh.normals[index] = 1;
      }
      mesh.positionBuffer = null;
      mesh.colorBuffer = null;
      mesh.indexBuffer = null;
      mesh.uvBuffer = null;
      mesh.dirty = false;
    });
  }

  get vertices() { return this.meshes[0]?.vertices; }
  get colors() { return this.meshes[0]?.colors; }
  get indices() { return this.meshes[0]?.indices; }
  get normals() { return this.meshes[0]?.normals; }
  get uvs() { return this.meshes[0]?.uvs; }
  get texture() { return this.meshes[0]?.material?.texture ?? null; }
}
