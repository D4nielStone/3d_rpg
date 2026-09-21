import * as THREE from 'three';
import { MeshRenderer, OutlineRenderer, ShadowRenderer, SwordRenderer, Texture, Transform, Water, EnemyAreaRenderer, DirectionalLightRenderer } from './components.js';

function colorFrom(value, fallback = [1, 1, 1]) {
  const channels = Array.isArray(value) ? value : fallback;
  return new THREE.Color(...channels);
}

function geometryFromMesh(mesh) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.vertices ?? new Float32Array(), 3));
  if (mesh.normals?.length) geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  if (mesh.colors?.length) geometry.setAttribute('color', new THREE.BufferAttribute(mesh.colors, 3));
  if (mesh.uvs?.length) geometry.setAttribute('uv', new THREE.BufferAttribute(mesh.uvs, 2));
  if (mesh.indices?.length) geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  if (!mesh.normals?.length) geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function configureShadowState(object, { castShadow = true, receiveShadow = true } = {}) {
  if (!object) return object;
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = castShadow;
    child.receiveShadow = receiveShadow;
  });
  return object;
}

function textureFrom(texture) {
  if (!texture?.image) return null;
  if (!texture.threeTexture) {
    texture.threeTexture = new THREE.Texture(texture.image);
    texture.threeTexture.colorSpace = THREE.SRGBColorSpace;
    texture.threeTexture.needsUpdate = true;
  }
  return texture.threeTexture;
}

function createMaterial(mesh, texture, transparent = false) {
  return new THREE.MeshLambertMaterial({
    color: colorFrom(mesh.material?.diffuseColor),
    map: textureFrom(mesh.material?.texture ?? texture),
    vertexColors: Boolean(mesh.colors?.length),
    flatShading: true,
    transparent,
    opacity: transparent ? 0.24 : 1,
    side: THREE.DoubleSide,
  });
}

export class ThreeRenderSystem {
  constructor(canvas, camera, skyColor, lighting = {}, fog = {}) {
    this.canvas = canvas;
    this.sourceCamera = camera;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.setRenderCamera(this.camera);
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    } catch (error) {
      const message = 'Erro ao carregar contexto webgl.';
      throw new Error(message, { cause: error });
    }
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      console.error('El contexto WebGL se perdio; recarga la pagina para intentar recuperarlo.');
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = colorFrom(skyColor, [0.039, 0.051, 0.047]);
    this.scene.fog = new THREE.Fog(colorFrom(fog.color, [0.63, 0.69, 0.68]), Number(fog.near ?? 180), Number(fog.far ?? 850));
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.entityObjects = new Map();
    this.slashEffects = [];
    this.slashGeometry = null;
    this.physicsDebugGroup = new THREE.Group();
    this.physicsDebugGroup.visible = false;
    this.scene.add(this.physicsDebugGroup);

    const ambient = lighting.ambientColor ?? [1, 1, 1];
    const ambientLight = new THREE.AmbientLight(colorFrom(ambient), Number(lighting.ambientIntensity ?? 0.04));
    this.scene.add(ambientLight);
    this.directionalLightObjects = new Map();
    for (const point of lighting.pointLights ?? []) {
      const light = new THREE.PointLight(colorFrom(point.color, [1, 0.72, 0.45]), point.intensity ?? 2, point.distance ?? 18);
      light.position.set(...(point.position ?? [0, 8, 0]));
      this.scene.add(light);
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.sourceCamera.setAspect(this.camera.aspect);
  }

  syncCamera() {
    const source = this.sourceCamera;
    source.updatePosition();
    this.camera.position.set(...source.position);
    const direction = new THREE.Vector3(
      -Math.sin(source.yaw) * Math.cos(source.pitch),
      Math.sin(source.pitch),
      -Math.cos(source.yaw) * Math.cos(source.pitch),
    );
    this.camera.lookAt(this.camera.position.clone().add(direction));
  }

  updatePhysicsDebug(physicsWorld) {
    if (!this.physicsDebugGroup.visible || typeof physicsWorld?.getDebugColliders !== 'function') return;
    while (this.physicsDebugGroup.children.length) {
      const child = this.physicsDebugGroup.children.pop();
      child.geometry?.dispose();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
      else child.material?.dispose();
    }
    for (const collider of physicsWorld.getDebugColliders()) {
      const bounds = collider.bounds;
      if (!bounds) continue;
      const center = new THREE.Vector3(
        (bounds.minX + bounds.maxX) * 0.5,
        (bounds.minY + bounds.maxY) * 0.5,
        (bounds.minZ + bounds.maxZ) * 0.5,
      );
      const size = new THREE.Vector3(
        Math.max(0.01, bounds.maxX - bounds.minX),
        Math.max(0.01, bounds.maxY - bounds.minY),
        Math.max(0.01, bounds.maxZ - bounds.minZ),
      );
      const color = collider.type === 'player' ? 0x33ddff : collider.type === 'model' ? 0xff5522 : 0x66ff66;
      let colliderObject;
      if (collider.type === 'player' && collider.shape === 'capsule') {
        const capsuleHeight = Math.max(collider.radius * 2, collider.height);
        colliderObject = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.CapsuleGeometry(collider.radius, capsuleHeight - collider.radius * 2, 8, 4)),
          new THREE.LineBasicMaterial({ color, depthTest: false }),
        );
      } else if (collider.type !== 'model') {
        colliderObject = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)),
          new THREE.LineBasicMaterial({ color, depthTest: false }),
        );
      }
      if (colliderObject) {
        colliderObject.position.copy(center);
        colliderObject.renderOrder = 20;
        this.physicsDebugGroup.add(colliderObject);
      }

      if (collider.type !== 'model' || !collider.mesh?.vertices?.length) continue;
      const geometry = new THREE.BufferGeometry();
      const vertices = [];
      const indices = collider.mesh.indices ?? [];
      for (let index = 0; index + 2 < indices.length; index += 3) {
        for (const vertexIndex of [
          indices[index], indices[index + 1],
          indices[index + 1], indices[index + 2],
          indices[index + 2], indices[index],
        ]) {
          const source = vertexIndex * 3;
          vertices.push(
            collider.mesh.vertices[source],
            collider.mesh.vertices[source + 1],
            collider.mesh.vertices[source + 2],
          );
        }
      }
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      const meshLines = new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({ color: 0xff5522, depthTest: false }),
      );
      meshLines.position.set(...collider.position);
      meshLines.rotation.set(...collider.rotation);
      meshLines.renderOrder = 21;
      this.physicsDebugGroup.add(meshLines);
    }
  }

  setPhysicsDebugVisible(visible) {
    this.physicsDebugGroup.visible = Boolean(visible);
    if (!visible) {
      while (this.physicsDebugGroup.children.length) {
        const child = this.physicsDebugGroup.children.pop();
        child.geometry?.dispose();
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
        else child.material?.dispose();
      }
    }
  }

  updateDirectionalShadow(light, direction) {
    const source = this.sourceCamera;
    const focus = source.orbit?.target?.position ?? [
      this.camera.position.x + direction.x * 24,
      this.camera.position.y + direction.y * 24,
      this.camera.position.z + direction.z * 24,
    ];
    const shadowDistance = Math.max(24, Math.min(96, source.orbit?.distance ?? 48));
    const halfHeight = Math.tan(this.camera.fov * Math.PI / 360) * shadowDistance;
    const halfWidth = halfHeight * this.camera.aspect;
    const shadowSize = Math.max(halfWidth, halfHeight) * 1.35;

    light.position.set(...focus).addScaledVector(direction, -45);
    light.target.position.set(...focus);
    light.target.updateMatrixWorld();
    light.shadow.camera.left = -shadowSize;
    light.shadow.camera.right = shadowSize;
    light.shadow.camera.top = shadowSize;
    light.shadow.camera.bottom = -shadowSize;
    light.shadow.camera.updateProjectionMatrix();
  }

  createObject(renderer, texture, isWater, isEnemyArea) {
    const group = new THREE.Group();
    const castShadow = renderer.castShadow !== false;
    const receiveShadow = renderer.receiveLight !== false;
    for (const mesh of renderer.meshes ?? []) {
      const geometry = geometryFromMesh(mesh);
      const material = createMaterial(mesh, texture, isEnemyArea);
      const meshWrapper = new THREE.Group();
      const object = new THREE.Mesh(geometry, material);
      object.castShadow = castShadow;
      object.receiveShadow = receiveShadow;
      object.renderOrder = 1;
      if (isWater) object.material.color.setRGB(0.08, 0.45, 0.7);
      meshWrapper.userData.mainMesh = object;
      meshWrapper.add(object);
      group.add(meshWrapper);
    }
    configureShadowState(group, { castShadow, receiveShadow });
    return group;
  }

  updateObject(entity, world) {
    const transform = world.getComponent(entity, Transform);
    const renderer = world.getComponent(entity, MeshRenderer);
    const texture = world.getComponent(entity, Texture);
    const water = world.getComponent(entity, Water);
    let object = this.entityObjects.get(entity);
    if (!object) {
      object = this.createObject(renderer, texture, Boolean(water), Boolean(world.getComponent(entity, EnemyAreaRenderer)));
      this.root.add(object);
      this.entityObjects.set(entity, object);
    }
    renderer.meshes.forEach((mesh, index) => {
      if (!mesh.dirty) return;
      const meshWrapper = object.children[index];
      const meshObject = meshWrapper?.userData?.mainMesh;
      if (!meshObject || !meshObject.geometry) return;
      const position = meshObject.geometry.getAttribute('position');
      const normal = meshObject.geometry.getAttribute('normal');
      if (!position) return;
      position.copyArray(mesh.vertices);
      position.needsUpdate = true;
      if (normal && mesh.normals?.length) {
        normal.copyArray(mesh.normals);
        normal.needsUpdate = true;
      }
      meshObject.geometry.computeBoundingSphere();
      mesh.dirty = false;
    });
    object.position.set(...transform.position);
    object.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2]);
    object.scale.set(...transform.scale);
    return object;
  }

  updateSwordObject(entity, world, time) {
    const transform = world.getComponent(entity, Transform);
    const sword = world.getComponent(entity, SwordRenderer);
    const key = `sword-${entity}`;
    let object = this.entityObjects.get(key);
    if (!object) {
      object = this.createObject(sword.meshRenderer, null, false, false);
      this.root.add(object);
      this.entityObjects.set(key, object);
    }
    object.position.set(...transform.position);
    object.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2]);
    object.scale.set(...transform.scale);
    object.translateX(sword.offset[0]);
    const pose = sword.getAttackPose(time);
    object.translateY(sword.offset[1] + pose.lift);
    object.translateZ(sword.offset[2]);
    object.rotateX(pose.rotation);
    return object;
  }

  updateRing(component, transform, time, color) {
    const baseRadius = component.getRadius?.(transform) ?? component.radius;
    const radius = baseRadius * (1 + Math.sin(time * 0.006) * 0.08);
    const thickness = component.thickness * Math.max(1, Math.max(Math.abs(transform.scale[0] ?? 1), Math.abs(transform.scale[2] ?? 1)));
    const tubeRadius = Math.max(0.02, thickness);
    const shape = new THREE.TorusGeometry(Math.max(0.01, radius - tubeRadius), tubeRadius, 8, component.segments);
    const material = new THREE.MeshBasicMaterial({
      color: colorFrom(color),
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
    });
    const ring = new THREE.Mesh(shape, material);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(transform.position[0], transform.position[1] + 0.04, transform.position[2]);
    ring.renderOrder = 3;
    return ring;
  }

  spawnSlash(position, rotation = 0) {
    if (!this.slashGeometry) {
      const shape = new THREE.Shape();
      shape.moveTo(-0.72, -0.5);
      shape.quadraticCurveTo(0.05, -0.18, 0.72, 0.58);
      shape.lineTo(0.52, 0.72);
      shape.quadraticCurveTo(-0.08, 0.18, -0.82, -0.28);
      shape.closePath();
      this.slashGeometry = new THREE.ShapeGeometry(shape);
    }

    const group = new THREE.Group();
    const glow = new THREE.Mesh(
      this.slashGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const core = new THREE.Mesh(
      this.slashGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    glow.scale.setScalar(1.18);
    glow.material.depthTest = false;
    glow.material.depthWrite = false;
    glow.renderOrder = 100;
    core.material.depthTest = false;
    core.material.depthWrite = false;
    core.renderOrder = 101;
    group.add(glow, core);
    group.position.set(position[0], position[1] + 0.85, position[2]);
    group.rotation.set(0, rotation, 0);
    group.scale.setScalar(0.35);
    group.renderOrder = 100;
    this.root.add(group);
    this.slashEffects.push({ group, glow, core, startedAt: performance.now() });
  }

  updateSlashEffects(time) {
    this.slashEffects = this.slashEffects.filter((effect) => {
      const progress = Math.min(1, Math.max(0, (time - effect.startedAt) / 260));
      if (progress >= 1) {
        this.root.remove(effect.group);
        effect.glow.material.dispose();
        effect.core.material.dispose();
        return false;
      }
      const fade = 1 - progress;
      effect.group.scale.setScalar(0.35 + progress * 0.95);
      effect.group.rotation.z = -0.45 + progress * 0.9;
      effect.glow.material.opacity = fade * 0.35;
      effect.core.material.opacity = fade * 0.95;
      return true;
    });
  }

  render(world, time = 0) {
    this.syncCamera();
    this.updateSlashEffects(time);

    const livingEntities = new Set();
    for (const entity of world.query(Transform, MeshRenderer)) livingEntities.add(entity);
    for (const entity of world.query(Transform, OutlineRenderer)) livingEntities.add(entity);
    for (const entity of world.query(Transform, ShadowRenderer)) livingEntities.add(entity);
    for (const entity of world.query(Transform, SwordRenderer)) {
      if (world.getComponent(entity, SwordRenderer).visible) livingEntities.add(`sword-${entity}`);
    }

    for (const [key, object] of [...this.entityObjects.entries()]) {
      if (typeof key === 'number') {
        if (!livingEntities.has(key)) {
          this.root.remove(object);
          this.entityObjects.delete(key);
        }
        continue;
      }

      const suffix = Number(key.split('-').at(-1));
      if (!Number.isInteger(suffix) || !livingEntities.has(suffix)) {
        this.root.remove(object);
        this.entityObjects.delete(key);
      }
    }

    const livingDirectionalLights = new Set();
    for (const entity of world.query(Transform, DirectionalLightRenderer)) {
      livingDirectionalLights.add(entity);
      const lightComponent = world.getComponent(entity, DirectionalLightRenderer);
      const transform = world.getComponent(entity, Transform);
      let light = this.directionalLightObjects.get(entity);
      if (!light) {
        light = new THREE.DirectionalLight(colorFrom(lightComponent.color, [1, 0.95, 0.85]), Number(lightComponent.intensity ?? 0.8));
        light.castShadow = lightComponent.castShadow !== false;
        light.shadow.mapSize.set(2024, 2024);
        light.shadow.camera.left = -80;
        light.shadow.camera.right = 80;
        light.shadow.camera.top = 80;
        light.shadow.camera.bottom = -80;
        light.shadow.camera.near = 1;
        light.shadow.camera.far = 180;
        light.shadow.bias = -0.0002;
        light.shadow.normalBias = 0.03;
        light.shadow.camera.updateProjectionMatrix();
        this.scene.add(light.target);
        this.scene.add(light);
        this.directionalLightObjects.set(entity, light);
      }
      light.color.setRGB(...lightComponent.color);
      light.intensity = Number(lightComponent.intensity ?? 0.8);
      light.castShadow = lightComponent.castShadow !== false;
      const direction = new THREE.Vector3(...(lightComponent.direction ?? [-0.45, 0.85, 0.35]));
      if (direction.lengthSq() === 0) direction.set(-0.45, 0.85, 0.35);
      direction.normalize();
      this.updateDirectionalShadow(light, direction);
    }
    for (const [entity, light] of [...this.directionalLightObjects.entries()]) {
      if (!livingDirectionalLights.has(entity)) {
        this.scene.remove(light.target);
        this.scene.remove(light);
        this.directionalLightObjects.delete(entity);
      }
    }
    for (const entity of world.query(Transform, MeshRenderer)) {
      const object = this.updateObject(entity, world);
      const renderer = world.getComponent(entity, MeshRenderer);
      if (object) configureShadowState(object, {
        castShadow: renderer.castShadow !== false,
        receiveShadow: renderer.receiveLight !== false,
      });
    }
    for (const entity of world.query(Transform, SwordRenderer)) {
      const sword = world.getComponent(entity, SwordRenderer);
      if (sword.visible) this.updateSwordObject(entity, world, time);
    }
    for (const entity of world.query(Transform, ShadowRenderer)) {
      const object = this.entityObjects.get(entity);
      if (object) configureShadowState(object, { castShadow: true, receiveShadow: true });
    }
    for (const entity of world.query(Transform, OutlineRenderer)) {
      const outline = world.getComponent(entity, OutlineRenderer);
      const transform = world.getComponent(entity, Transform);
      const key = `outline-${entity}`;
      const old = this.entityObjects.get(key);
      if (old) this.root.remove(old);
      if (outline.active) {
        const ring = this.updateRing(outline, transform, time, outline.color);
        this.root.add(ring);
        this.entityObjects.set(key, ring);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
