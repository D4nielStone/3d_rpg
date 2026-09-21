/** @brief Os sistemas são executados no gameloop. */

import {
  multiplyMatrices,
  rotationX,
  rotationY,
  rotationZ,
  scale,
  translation,
} from './math.js';
import { createBuffer, createTexture } from './webgl.js';
import {
  MeshRenderer,
  AnimationPlayer,
  ShadowRenderer,
  OutlineRenderer,
  NetworkTransform,
  Texture,
  Transform,
  Water,
  EnemyAreaRenderer,
  SoundListener,
  SoundPlayer,
  Rigidbody,
  RayCaster,
  NetworkIdentity,
} from './components.js';
import { PhysicsWorld } from '../server/world/physics.js';

function shortestAngleDelta(target, current) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

export class AnimationSystem {
  update(world, deltaSeconds) {
    const updatedMixers = new Set();
    for (const entity of world.query(Transform, AnimationPlayer)) {
      const transform = world.getComponent(entity, Transform);
      const animationPlayer = world.getComponent(entity, AnimationPlayer);
      animationPlayer.update(deltaSeconds, transform, updatedMixers);
    }
  }
}

export class SoundListenerSystem {
  update(world) {
    for (const entity of world.query(Transform, SoundListener)) {
      const transform = world.getComponent(entity, Transform);
      const listener = world.getComponent(entity, SoundListener);
      const audioListener = listener.context?.listener;
      if (!audioListener) continue;
      setAudioParam(audioListener.positionX, transform.position[0]);
      setAudioParam(audioListener.positionY, transform.position[1]);
      setAudioParam(audioListener.positionZ, transform.position[2]);
      const forward = [-Math.sin(transform.rotation[1]), 0, -Math.cos(transform.rotation[1])];
      setAudioParam(audioListener.forwardX, forward[0]);
      setAudioParam(audioListener.forwardY, forward[1]);
      setAudioParam(audioListener.forwardZ, forward[2]);
      setAudioParam(audioListener.upX, 0);
      setAudioParam(audioListener.upY, 1);
      setAudioParam(audioListener.upZ, 0);
      audioListener.setPosition?.(...transform.position);
      audioListener.setOrientation?.(...forward, 0, 1, 0);
    }
  }
}

export class SoundPlayerSystem {
  update(world, listenerContext = null) {
    for (const entity of world.query(Transform, SoundPlayer)) {
      const transform = world.getComponent(entity, Transform);
      const player = world.getComponent(entity, SoundPlayer);
      player.setContext(listenerContext);
      player.setPosition(transform.position);
    }
  }
}

function setAudioParam(param, value) {
  param?.setValueAtTime?.(value, param.context?.currentTime ?? 0);
  if (param && !param.setValueAtTime) param.value = value;
}

function getStaticBounds(entity) {
  if (!entity?.collision?.enabled || !Array.isArray(entity.position)) return null;
  const scale = entity.scale ?? [1, 1, 1];
  const collisionScale = entity.collision.scale ?? [1, 1, 1];
  const offset = entity.collision.offset ?? [0, 0, 0];
  const halfExtents = [0, 1, 2].map((index) => Math.max(
    0.01,
    Math.abs(Number(scale[index]) || 1) * Math.abs(Number(collisionScale[index]) || 1) * 0.5,
  ));
  const center = [0, 1, 2].map((index) => entity.position[index] + (Number(offset[index]) || 0));
  return {
    minX: center[0] - halfExtents[0],
    maxX: center[0] + halfExtents[0],
    minY: center[1] - halfExtents[1],
    maxY: center[1] + halfExtents[1],
    minZ: center[2] - halfExtents[2],
    maxZ: center[2] + halfExtents[2],
  };
}
export class PhysicsSystem {
  constructor(physicsWorld) {
    if (physicsWorld && typeof physicsWorld.step === 'function' && typeof physicsWorld.movePlayer === 'function') {
      this.physicsWorld = physicsWorld;
      this.pendingMovements = new Map();
      return;
    }

    this.physicsWorld = new PhysicsWorld(physicsWorld ?? null);
    this.pendingMovements = new Map();
  }

  setMovement(entity, angle, magnitude) {
    if (!entity) return;
    this.pendingMovements.set(entity, {
      angle: Number.isFinite(angle) ? angle : 0,
      magnitude: Math.max(0, Math.min(1, Number(magnitude) || 0)),
    });
  }

  syncPlayerPosition(entity, position) {
    if (!entity || !Array.isArray(position)) return;
    const body = this.physicsWorld.getPlayerBody?.(entity, position);
    if (!body?.position?.set) return;
    body.position.set(position[0], position[1], position[2]);
  }

  update(world, deltaSeconds) {
    const step = Math.min(
      Math.max(Number(deltaSeconds) || 0, 0),
      0.1,
    );

    if (!step) return;

    // 1. Envia intenção/movimento para a camada de física.
    for (const entity of world.query(Transform, Rigidbody)) {
      const transform = world.getComponent(entity, Transform);
      const body = world.getComponent(entity, Rigidbody);

      if (!body) continue;

      if (!body.physicsId) {
        body.physicsId = entity;
      }

      const movement = this.pendingMovements.get(entity);
      if (body.networkDriven) {
        this.physicsWorld.syncPlayerHorizontalPosition?.(body.physicsId, transform.position);
      }
      if (movement?.magnitude > 0) {
        transform.rotation[1] = movement.angle;
      }

      this.physicsWorld.movePlayer(
        body.physicsId,
        transform.position,
        movement?.angle ?? transform.rotation?.[1] ?? 0,
        (body.speed ?? 0) * (movement?.magnitude ?? 0),
        step,
        false,
      );
    }

    this.physicsWorld.step(step);

    // 2. Recupera a posição física resultante.
    for (const entity of world.query(Transform, Rigidbody)) {
      const transform = world.getComponent(entity, Transform);
      const body = world.getComponent(entity, Rigidbody);

      if (!body?.physicsId) continue;

      const position = this.physicsWorld.getPlayerPosition(body.physicsId);

      if (!position) continue;

      transform.position = position;
    }

  }
}

export class RayCastingSystem {
  constructor(physicsWorld) {
    this.physicsWorld = physicsWorld?.physicsWorld ?? physicsWorld;
  }

  update(world) {
    if (typeof this.physicsWorld?.raycastGround !== 'function') return;

    for (const entity of world.query(Transform, RayCaster)) {
      const transform = world.getComponent(entity, Transform);
      const rayCaster = world.getComponent(entity, RayCaster);
      const identity = world.getComponent(entity, NetworkIdentity);
      if (world.getComponent(entity, Rigidbody)) continue;
      const hit = this.physicsWorld.raycastGround(
        transform.position[0] + rayCaster.origin[0],
        transform.position[2] + rayCaster.origin[2],
        rayCaster.maxDistance,
      );

      rayCaster.hit = hit;
      rayCaster.grounded = Boolean(hit);
      if (!hit) {
        if (rayCaster.lastGroundPosition) {
          transform.position[0] = rayCaster.lastGroundPosition[0];
          transform.position[1] = rayCaster.lastGroundPosition[1];
          transform.position[2] = rayCaster.lastGroundPosition[2];
        }
        continue;
      }

      const groundHeight = hit.height + rayCaster.heightOffset;
      const previousGround = rayCaster.lastGroundHeight;
      if (previousGround !== null && previousGround - groundHeight > rayCaster.maxDrop) {
        transform.position = [...rayCaster.lastGroundPosition];
        continue;
      }

      if (identity?.isLocal) {
        rayCaster.lastGroundHeight = groundHeight;
        rayCaster.lastGroundPosition = [...transform.position];
        continue;
      }

      transform.position[1] = groundHeight;
      rayCaster.lastGroundHeight = groundHeight;
      rayCaster.lastGroundPosition = [...transform.position];
    }
  }
}

export class NetworkInterpolationSystem {
  update(world, deltaSeconds) {
    for (const entity of world.query(Transform, NetworkTransform)) {
      const transform = world.getComponent(entity, Transform);
      const networkTransform = world.getComponent(entity, NetworkTransform);
      if (!networkTransform.targetPosition) continue;

      const amount = 1 - Math.exp(-networkTransform.interpolation * deltaSeconds);
      for (let index = 0; index < 3; index += 1) {
        if (world.getComponent(entity, Rigidbody) && index === 1) continue;
        transform.position[index] +=
          (networkTransform.targetPosition[index] - transform.position[index]) * amount;
      }
      if (networkTransform.targetRotation) {
        transform.rotation[1] += shortestAngleDelta(
          networkTransform.targetRotation[1],
          transform.rotation[1],
        ) * amount;
      }
    }
  }
}

export class RenderSystem {
  constructor(gl, program, locations, camera, lighting = null, shadowProgram = null, shadowLocations = null, sceneConfig = null) {
    this.gl = gl;
    this.program = program;
    this.locations = locations;
    this.camera = camera;
    this.shadowProgram = shadowProgram;
    this.shadowLocations = shadowLocations;
    this.sceneConfig = sceneConfig ?? {};
    this.shadowSize = 2048;
    this.shadowFramebuffer = gl.createFramebuffer();
    this.shadowTexture = gl.createTexture();
    this.shadowDepthBuffer = gl.createRenderbuffer();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.shadowSize, this.shadowSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.shadowTexture, 0);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.shadowDepthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.shadowSize, this.shadowSize);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.shadowDepthBuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.shadowCamera = new Camera({ position: [0, 40, 0], near: 0.1, far: 160 });
    this.ambientColor = [0, 1, 2].map((index) => {
      const value = Number(lighting?.ambientColor?.[index]);
      return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
    });
    const intensity = Number(lighting?.ambientIntensity);
    this.ambientIntensity = Number.isFinite(intensity) ? Math.min(2, Math.max(0, intensity)) : 1;
    const fog = this.sceneConfig.fog ?? {};
    this.fogColor = this.normalizeColor(fog.color, [0.63, 0.69, 0.68]);
    this.fogNear = Number.isFinite(Number(fog.near)) ? Number(fog.near) : 180;
    this.fogFar = Number.isFinite(Number(fog.far)) ? Number(fog.far) : 850;
    if (this.fogFar <= this.fogNear) this.fogFar = this.fogNear + 1;
    this.directionalLightDirection = this.normalizeVector(
      lighting?.directional?.direction,
      [-0.45, 0.85, 0.35],
    );
    this.directionalLightColor = this.normalizeColor(lighting?.directional?.color, [1, 0.95, 0.85]);
    this.directionalLightIntensity = this.normalizeScalar(lighting?.directional?.intensity, 0.8, 0, 4);
    const configuredPointLights = lighting?.pointLights ?? [];
    this.pointLights = configuredPointLights.slice(0, 8).map((point) => ({
      position: this.normalizeVector(point?.position, [0, 8, 0]),
      color: this.normalizeColor(point?.color, [1, 0.72, 0.45]),
      intensity: this.normalizeScalar(point?.intensity, 2, 0, 10),
      distance: this.normalizeScalar(point?.distance, 18, 0.1, 200),
    }));
  }

  normalizeVector(value, fallback) {
    return fallback.map((defaultValue, index) => {
      const number = Number(value?.[index]);
      return Number.isFinite(number) ? number : defaultValue;
    });
  }

  normalizeColor(value, fallback) {
    return this.normalizeVector(value, fallback).map((channel) => Math.min(1, Math.max(0, channel)));
  }

  normalizeScalar(value, fallback, minimum, maximum) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
  }

  prepareMesh(mesh) {
    if (!mesh.positionBuffer) {
      mesh.positionBuffer = createBuffer(this.gl, this.gl.ARRAY_BUFFER, mesh.vertices);
      mesh.colorBuffer = createBuffer(this.gl, this.gl.ARRAY_BUFFER, mesh.colors);
      mesh.normalBuffer = createBuffer(this.gl, this.gl.ARRAY_BUFFER, mesh.normals);
      if (mesh.uvs) mesh.uvBuffer = createBuffer(this.gl, this.gl.ARRAY_BUFFER, mesh.uvs);
      mesh.indexBuffer = createBuffer(this.gl, this.gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
    } else if (mesh.dirty) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, mesh.positionBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, mesh.vertices, this.gl.DYNAMIC_DRAW);
    }
    mesh.dirty = false;
  }

  prepareShadow(shadow) {
    if (shadow.positionBuffer) return;
    shadow.positionBuffer = createBuffer(this.gl, this.gl.ARRAY_BUFFER, shadow.vertices);
    shadow.colorBuffer = createBuffer(this.gl, this.gl.ARRAY_BUFFER, shadow.colors);
    shadow.normalBuffer = createBuffer(this.gl, this.gl.ARRAY_BUFFER, shadow.normals);
    shadow.indexBuffer = createBuffer(this.gl, this.gl.ELEMENT_ARRAY_BUFFER, shadow.indices);
  }

  prepareTexture(texture) {
    if (!texture || texture.glTexture) {
      return;
    }

    texture.glTexture = createTexture(this.gl, texture.image, {
      wrapS: this.gl.CLAMP_TO_EDGE,
      wrapT: this.gl.CLAMP_TO_EDGE,
      minFilter: this.gl.LINEAR,
      magFilter: this.gl.LINEAR,
    });
  }

  prepareLine(line) {
    if (!line.positionBuffer) {
      line.positionBuffer = createBuffer(this.gl, this.gl.ARRAY_BUFFER, line.vertices);
      line.colorBuffer = createBuffer(this.gl, this.gl.ARRAY_BUFFER, line.colors);
      line.indexBuffer = createBuffer(
        this.gl,
        this.gl.ELEMENT_ARRAY_BUFFER,
        line.indices,
      );
    } else if (line.dirty) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, line.positionBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, line.vertices, this.gl.DYNAMIC_DRAW);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, line.colorBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, line.colors, this.gl.DYNAMIC_DRAW);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, line.indexBuffer);
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, line.indices, this.gl.DYNAMIC_DRAW);
    }
    line.dirty = false;
  }

  prepareOutline(outline, transform, time) {
    const vertices = [];
    const colors = [];
    const indices = [];
    const scale = 1 + Math.sin(time * 0.006) * 0.08;
    const outerRadius = outline.radius * scale;
    const innerRadius = outerRadius - outline.thickness;
    const height = transform.position[1] + 0.04;

    if (outline.active) {
      for (let index = 0; index < outline.segments; index += 1) {
        const angle = (index / outline.segments) * Math.PI * 2;
        const nextAngle = ((index + 1) / outline.segments) * Math.PI * 2;
        const first = vertices.length / 3;
        vertices.push(
          transform.position[0] + Math.cos(angle) * outerRadius, height, transform.position[2] + Math.sin(angle) * outerRadius,
          transform.position[0] + Math.cos(angle) * innerRadius, height, transform.position[2] + Math.sin(angle) * innerRadius,
          transform.position[0] + Math.cos(nextAngle) * outerRadius, height, transform.position[2] + Math.sin(nextAngle) * outerRadius,
          transform.position[0] + Math.cos(nextAngle) * innerRadius, height, transform.position[2] + Math.sin(nextAngle) * innerRadius,
        );
        colors.push(...outline.color, ...outline.color, ...outline.color, ...outline.color);
        indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2);
      }
    }

    outline.vertices = new Float32Array(vertices);
    outline.colors = new Float32Array(colors);
    outline.indices = new Uint16Array(indices);
    outline.dirty = true;
  }

  prepareDynamicOutline(outline) {
    if (!outline.positionBuffer) {
      outline.positionBuffer = createBuffer(this.gl, this.gl.ARRAY_BUFFER, outline.vertices);
      outline.colorBuffer = createBuffer(this.gl, this.gl.ARRAY_BUFFER, outline.colors);
      outline.indexBuffer = createBuffer(this.gl, this.gl.ELEMENT_ARRAY_BUFFER, outline.indices);
    } else if (outline.dirty) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, outline.positionBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, outline.vertices, this.gl.DYNAMIC_DRAW);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, outline.colorBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, outline.colors, this.gl.DYNAMIC_DRAW);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, outline.indexBuffer);
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, outline.indices, this.gl.DYNAMIC_DRAW);
    }
    outline.dirty = false;
  }

  getModelMatrix(transform) {
    const [x, y, z] = transform.position;
    const [pitch, yaw, roll] = transform.rotation;
    const [scaleX, scaleY, scaleZ] = transform.scale;
    const rotation = multiplyMatrices(
      rotationY(yaw),
      multiplyMatrices(rotationX(pitch), rotationZ(roll)),
    );

    return multiplyMatrices(
      translation(x, y, z),
      multiplyMatrices(rotation, scale(scaleX, scaleY, scaleZ)),
    );
  }

  getShadowMatrix() {
    const direction = this.directionalLightDirection;
    const length = Math.hypot(direction[0], direction[1], direction[2]) || 1;
    const position = direction.map((value) => value / length * 45);
    this.shadowCamera.position = position;
    this.shadowCamera.lookAt([0, 0, 0]);
    const projection = this.shadowCamera.getProjectionMatrix();
    const view = this.shadowCamera.getViewMatrix();
    const bias = new Float32Array([
      0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1,
    ]);
    return multiplyMatrices(bias, multiplyMatrices(projection, view));
  }

  renderShadowMap(world, shadowMatrix) {
    const { gl, shadowLocations } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
    gl.viewport(0, 0, this.shadowSize, this.shadowSize);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.shadowProgram);
    gl.disableVertexAttribArray(this.locations.color);
    gl.disableVertexAttribArray(this.locations.normal);
    gl.disableVertexAttribArray(this.locations.uv);
    gl.enableVertexAttribArray(shadowLocations.position);
    for (const entity of world.query(Transform, MeshRenderer)) {
      const transform = world.getComponent(entity, Transform);
      const matrix = multiplyMatrices(shadowMatrix, this.getModelMatrix(transform));
      gl.uniformMatrix4fv(shadowLocations.matrix, false, matrix);
      const renderer = world.getComponent(entity, MeshRenderer);
      if (!renderer.castShadow) continue;
      renderer.meshes.forEach((mesh) => {
        this.prepareMesh(mesh);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
        gl.vertexAttribPointer(shadowLocations.position, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
        gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
      });
    }
    gl.disableVertexAttribArray(shadowLocations.position);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.program);
    gl.enableVertexAttribArray(this.locations.position);
    gl.enableVertexAttribArray(this.locations.color);
    gl.enableVertexAttribArray(this.locations.normal);
    gl.enableVertexAttribArray(this.locations.uv);
  }

  render(world, time = 0) {
    const { gl, locations } = this;
    const shadowMatrix = this.getShadowMatrix();
    this.renderShadowMap(world, shadowMatrix);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    const view = this.camera.getViewMatrix();
    const projection = this.camera.getProjectionMatrix();
    gl.uniform3f(locations.ambientColor, ...this.ambientColor);
    gl.uniform1f(locations.ambientIntensity, this.ambientIntensity);
    gl.uniform3f(locations.fogColor, ...this.fogColor);
    gl.uniform1f(locations.fogNear, this.fogNear);
    gl.uniform1f(locations.fogFar, this.fogFar);
    gl.uniform3f(locations.directionalLightDirection, ...this.directionalLightDirection);
    gl.uniform3f(locations.directionalLightColor, ...this.directionalLightColor);
    gl.uniform1f(locations.directionalLightIntensity, this.directionalLightIntensity);
    const pointLightPositions = new Float32Array(8 * 3);
    const pointLightColors = new Float32Array(8 * 3);
    const pointLightIntensities = new Float32Array(8);
    const pointLightDistances = new Float32Array(8);
    this.pointLights.forEach((light, index) => {
      pointLightPositions.set(light.position, index * 3);
      pointLightColors.set(light.color, index * 3);
      pointLightIntensities[index] = light.intensity;
      pointLightDistances[index] = light.distance;
    });
    gl.uniform3fv(locations.pointLightPositions, pointLightPositions);
    gl.uniform3fv(locations.pointLightColors, pointLightColors);
    gl.uniform1fv(locations.pointLightIntensities, pointLightIntensities);
    gl.uniform1fv(locations.pointLightDistances, pointLightDistances);
    gl.uniform1i(locations.pointLightCount, this.pointLights.length);
    gl.uniformMatrix4fv(locations.shadowMatrix, false, shadowMatrix);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture);
    gl.uniform1i(locations.shadowMap, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enableVertexAttribArray(locations.normal);

    for (const entity of world.query(Transform, MeshRenderer)) {
      const transform = world.getComponent(entity, Transform);
      const matrix = multiplyMatrices(
        projection,
        multiplyMatrices(view, this.getModelMatrix(transform)),
      );
      const renderer = world.getComponent(entity, MeshRenderer);
      const water = world.getComponent(entity, Water);
      renderer.meshes.forEach((mesh) => {
        const material = mesh.material;
        const texture = material?.texture ?? world.getComponent(entity, Texture) ?? null;
        this.prepareMesh(mesh);
        this.prepareTexture(texture);
        gl.uniformMatrix4fv(locations.matrix, false, matrix);
        gl.uniformMatrix4fv(locations.modelMatrix, false, this.getModelMatrix(transform));
        gl.uniform3f(locations.diffuseColor, ...(material?.diffuseColor ?? [1, 1, 1]));
        gl.uniform1f(locations.isShadow, 0);
        gl.uniform1f(locations.receiveLight, renderer.receiveLight ? 1 : 0);
        gl.uniform1f(locations.isEnemyArea, 0);
        const enemyArea = world.getComponent(entity, EnemyAreaRenderer);
        gl.uniform1f(locations.isEnemyArea, enemyArea ? 1 : 0);
        const textured = Boolean(texture && mesh.uvs);
        gl.uniform1f(locations.useTexture, textured ? 1 : 0);
        gl.uniform1i(locations.uTexture, 0);
        gl.uniform1f(locations.isWater, water ? 1 : 0);
        gl.uniform1f(locations.time, time);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
        gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
        gl.vertexAttribPointer(locations.color, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
        gl.vertexAttribPointer(locations.normal, 3, gl.FLOAT, false, 0, 0);

        if (textured) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texture.glTexture);
          gl.enableVertexAttribArray(locations.uv);
          gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuffer);
          gl.vertexAttribPointer(locations.uv, 2, gl.FLOAT, false, 0, 0);
        } else {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, null);
          gl.disableVertexAttribArray(locations.uv);
          gl.vertexAttrib2f(locations.uv, 0, 0);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
        gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
      });
    }

    for (const entity of world.query(Transform, OutlineRenderer)) {
      gl.disableVertexAttribArray(locations.normal);
      gl.disableVertexAttribArray(locations.uv);
      gl.vertexAttrib3f(locations.normal, 0, 1, 0);
      gl.vertexAttrib2f(locations.uv, 0, 0);
      const transform = world.getComponent(entity, Transform);
      const outline = world.getComponent(entity, OutlineRenderer);
      this.prepareOutline(outline, transform, time);
      this.prepareDynamicOutline(outline);
      if (outline.indices.length === 0) continue;

      gl.uniformMatrix4fv(locations.matrix, false, multiplyMatrices(projection, view));
      gl.uniform1f(locations.isShadow, 0);
      gl.uniform1f(locations.receiveLight, 0);
      gl.uniform1f(locations.isEnemyArea, 0);
      gl.uniform3f(locations.diffuseColor, 1, 1, 1);
      gl.uniform1f(locations.useTexture, 0);
      gl.uniform1f(locations.isWater, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, outline.positionBuffer);
      gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, outline.colorBuffer);
      gl.vertexAttribPointer(locations.color, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, outline.indexBuffer);
      gl.drawElements(gl.TRIANGLES, outline.indices.length, gl.UNSIGNED_SHORT, 0);
    }

    // Renderizar sombras
    for (const entity of world.query(Transform, ShadowRenderer)) {
      gl.disableVertexAttribArray(locations.normal);
      gl.disableVertexAttribArray(locations.uv);
      gl.vertexAttrib3f(locations.normal, 0, 1, 0);
      gl.vertexAttrib2f(locations.uv, 0, 0);
      const transform = world.getComponent(entity, Transform);
      const shadow = world.getComponent(entity, ShadowRenderer);
      this.prepareShadow(shadow);
      if (shadow.indices.length === 0) continue;

      const matrix = multiplyMatrices(
        projection,
        multiplyMatrices(view, this.getModelMatrix(transform)),
      );
      gl.uniformMatrix4fv(locations.matrix, false, matrix);
      gl.uniformMatrix4fv(locations.modelMatrix, false, this.getModelMatrix(transform));
      gl.uniform1f(locations.isShadow, 1);
      gl.uniform1f(locations.useTexture, 0);
      gl.uniform1f(locations.isWater, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, shadow.positionBuffer);
      gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, shadow.colorBuffer);
      gl.vertexAttribPointer(locations.color, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shadow.indexBuffer);
      gl.drawElements(gl.TRIANGLES, shadow.indices.length, gl.UNSIGNED_SHORT, 0);
    }
  }
}
