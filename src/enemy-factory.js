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
  RayCaster,
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

/** Esse rato foi gerado com ajuda de um agente de IA */
export function createDefaultRatRenderer() {
  const fur = [0.38, 0.27, 0.21];
  const furLight = [0.48, 0.34, 0.26];
  const muzzle = [0.56, 0.39, 0.29];
  const ear = [0.62, 0.34, 0.36];
  const eye = [0.015, 0.01, 0.008];
  const nose = [0.72, 0.18, 0.22];
  const tail = [0.55, 0.24, 0.24];

  return new MeshRenderer({
    meshes: [
      // Corpo — mais comprido e baixo
      createRatPart({
        size: [0.46, 0.26, 0.68],
        position: [0, 0.34, 0],
        color: fur,
      }),

      // Peito/pescoço — cria uma transição melhor para a cabeça
      createRatPart({
        size: [0.38, 0.28, 0.30],
        position: [0, 0.43, -0.52],
        color: furLight,
      }),

      // Cabeça
      createRatPart({
        size: [0.34, 0.29, 0.38],
        position: [0, 0.49, -0.70],
        color: furLight,
      }),

      // Focinho — mais estreito e projetado para frente
      createRatPart({
        size: [0.23, 0.17, 0.27],
        position: [0, 0.40, -0.98],
        color: muzzle,
      }),

      // Bochecha esquerda
      createRatPart({
        size: [0.13, 0.15, 0.20],
        position: [-0.17, 0.43, -0.89],
        color: muzzle,
      }),

      // Bochecha direita
      createRatPart({
        size: [0.13, 0.15, 0.20],
        position: [0.17, 0.43, -0.89],
        color: muzzle,
      }),

      // Orelha esquerda
      createRatPart({
        size: [0.13, 0.17, 0.07],
        position: [-0.25, 0.78, -0.66],
        color: ear,
      }),

      // Orelha direita
      createRatPart({
        size: [0.13, 0.17, 0.07],
        position: [0.25, 0.78, -0.66],
        color: ear,
      }),

      // Olho esquerdo
      createRatPart({
        size: [0.05, 0.055, 0.035],
        position: [-0.19, 0.59, -0.94],
        color: eye,
      }),

      // Olho direito
      createRatPart({
        size: [0.05, 0.055, 0.035],
        position: [0.19, 0.59, -0.94],
        color: eye,
      }),

      // Nariz
      createRatPart({
        size: [0.075, 0.065, 0.055],
        position: [0, 0.40, -1.24],
        color: nose,
      }),

      // Cauda — base mais grossa
      createRatPart({
        size: [0.075, 0.065, 0.40],
        position: [0, 0.29, 0.78],
        color: tail,
      }),

      // Cauda — afinando na ponta
      createRatPart({
        size: [0.055, 0.05, 0.32],
        position: [0, 0.25, 1.46],
        color: tail,
      }),

      // Patas dianteiras
      createRatPart({
        size: [0.11, 0.16, 0.18],
        position: [-0.28, 0.18, -0.35],
        color: fur,
      }),

      createRatPart({
        size: [0.11, 0.16, 0.18],
        position: [0.28, 0.18, -0.35],
        color: fur,
      }),

      // Patas traseiras
      createRatPart({
        size: [0.14, 0.15, 0.22],
        position: [-0.30, 0.17, 0.40],
        color: fur,
      }),

      createRatPart({
        size: [0.14, 0.15, 0.22],
        position: [0.30, 0.17, 0.40],
        color: fur,
      }),
    ],
  });
}

export function addRemoteEnemy(world, enemyAssets, enemy) {
  const asset = enemyAssets?.get(enemy?.model);

  const entity = world.createEntity();
  const scale = Number(enemy.scale) || 1;
  world.addComponent(entity, new Transform({
    position: enemy.position,
    scale: [scale, scale, scale],
  }));
  world.addComponent(entity, new RayCaster());
  world.addComponent(entity, new EnemyIdentity({
    enemyId: enemy.id,
    type: enemy.type,
  }));
  world.addComponent(entity, new EnemyHealthBar({
    hp: enemy.hp,
    maxHp: enemy.maxHp,
  }));
  world.addComponent(entity, new NetworkTransform());
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