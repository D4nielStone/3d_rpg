import {
  EnemyIdentity,
  EnemyHealthBar,
  AnimationPlayer,
  Material,
  MeshRenderer,
  NameTag,
  NetworkTransform,
  OutlineRenderer,
  ShadowRenderer,
  Transform,
} from './components.js';
import { cubeIndices, cubeVertices } from './cube.js';

function createRatPart({ size, position, color }) {
  const vertices = new Float32Array(cubeVertices.length);
  for (let index = 0; index < cubeVertices.length; index += 3) {
    vertices[index] = -(cubeVertices[index] * size[0] + position[0]);
    vertices[index + 1] = cubeVertices[index + 1] * size[1] + position[1];
    vertices[index + 2] = -(cubeVertices[index + 2] * size[2] + position[2]);
  }
  return {
    vertices,
    indices: cubeIndices,
    material: new Material({ diffuseColor: color }),
  };
}

export function createDefaultRatRenderer() {
  return new MeshRenderer({ meshes: [
    createRatPart({ size: [0.42, 0.28, 0.62], position: [0, 0.38, 0], color: [0.42, 0.3, 0.24] }),
    createRatPart({ size: [0.34, 0.27, 0.34], position: [0, 0.48, -0.62], color: [0.5, 0.36, 0.28] }),
    createRatPart({ size: [0.2, 0.14, 0.24], position: [0, 0.4, -0.92], color: [0.58, 0.4, 0.3] }),
    createRatPart({ size: [0.11, 0.14, 0.06], position: [-0.22, 0.82, -0.62], color: [0.62, 0.36, 0.38] }),
    createRatPart({ size: [0.11, 0.14, 0.06], position: [0.22, 0.82, -0.62], color: [0.62, 0.36, 0.38] }),
    createRatPart({ size: [0.045, 0.05, 0.035], position: [-0.16, 0.57, -0.94], color: [0.03, 0.02, 0.02] }),
    createRatPart({ size: [0.045, 0.05, 0.035], position: [0.16, 0.57, -0.94], color: [0.03, 0.02, 0.02] }),
    createRatPart({ size: [0.07, 0.06, 0.05], position: [0, 0.4, -1.17], color: [0.75, 0.22, 0.28] }),
    createRatPart({ size: [0.06, 0.06, 0.38], position: [0, 0.3, 0.82], color: [0.65, 0.3, 0.28] }),
    createRatPart({ size: [0.045, 0.045, 0.28], position: [0, 0.25, 1.45], color: [0.65, 0.3, 0.28] }),
  ]});
}

export function addRemoteEnemy(world, enemyAssets, enemy) {
  const asset = enemyAssets?.get(enemy?.model);

  const entity = world.createEntity();
  const scale = Number(enemy.scale) || 1;
  world.addComponent(entity, new Transform({
    position: enemy.position,
    scale: [scale, scale, scale],
  }));
  world.addComponent(entity, new EnemyIdentity({
    enemyId: enemy.id,
    type: enemy.type,
  }));
  world.addComponent(entity, new EnemyHealthBar({
    hp: enemy.hp,
    maxHp: enemy.maxHp,
  }));
  world.addComponent(entity, new NetworkTransform());
  world.addComponent(entity, new OutlineRenderer());
  world.addComponent(entity, new NameTag({
    text: enemy.name,
    level: enemy.level,
    alerted: enemy.alerted,
  }));
  const mesh = asset
    ? new MeshRenderer({ meshes: asset.mesh.meshes })
    : createDefaultRatRenderer();
  world.addComponent(entity, mesh);
  if (asset?.animations?.length && asset.animationMixer) {
    world.addComponent(entity, new AnimationPlayer({
      animations: asset.animations,
      mixer: asset.animationMixer,
      onUpdate: asset.animationUpdate,
    }));
  }
  if (asset?.texture) world.addComponent(entity, asset.texture);
  world.addComponent(entity, new ShadowRenderer());
  return entity;
}