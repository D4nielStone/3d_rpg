import {
  lerp,
  multiplyMatrices,
  perspective,
  rotationX,
  rotationY,
  translation,
} from './math.js';
import * as THREE from 'three';

export class Camera {
  constructor({
    fieldOfView = Math.PI / 4,
    aspect = 1,
    near = 0.1,
    far = 100,
    position = [0, 0, 5],
    pitch = 0,
    yaw = 0,
  } = {}) {
    this.fieldOfView = fieldOfView;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.position = [...position];
    this.pitch = pitch;
    this.yaw = yaw;
    this.orbit = null;
    this.renderCamera = null;
  }

  setRenderCamera(renderCamera) {
    this.renderCamera = renderCamera;
  }

  setAspect(aspect) {
    this.aspect = aspect;
  }

  getProjectionMatrix() {
    return perspective(this.fieldOfView, this.aspect, this.near, this.far);
  }

    screenToGround(clientX, clientY, canvas, groundY = 0) {
      if (this.renderCamera) {
        const bounds = canvas.getBoundingClientRect();
        const normalizedX = ((clientX - bounds.left) / bounds.width) * 2 - 1;
        const normalizedY = 1 - ((clientY - bounds.top) / bounds.height) * 2;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(normalizedX, normalizedY), this.renderCamera);
        const distance = (groundY - raycaster.ray.origin.y) / raycaster.ray.direction.y;
        if (Number.isFinite(distance) && distance > 0) {
          return raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, distance).toArray();
        }
        return null;
      }

    this.updatePosition();
    const bounds = canvas.getBoundingClientRect();
    const normalizedX = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    const normalizedY = 1 - ((clientY - bounds.top) / bounds.height) * 2;
    const halfHeight = Math.tan(this.fieldOfView / 2);
    const halfWidth = halfHeight * this.aspect;
    const cosinePitch = Math.cos(this.pitch);
    const sinePitch = Math.sin(this.pitch);
    const cosineYaw = Math.cos(this.yaw);
    const sineYaw = Math.sin(this.yaw);
    const forward = [
      -sineYaw * cosinePitch,
      sinePitch,
      -cosineYaw * cosinePitch,
    ];
    const right = [cosineYaw, 0, -sineYaw];
    const up = [
      sineYaw * sinePitch,
      cosinePitch,
      cosineYaw * sinePitch,
    ];
    const direction = [
      forward[0] + right[0] * normalizedX * halfWidth + up[0] * normalizedY * halfHeight,
      forward[1] + right[1] * normalizedX * halfWidth + up[1] * normalizedY * halfHeight,
      forward[2] + right[2] * normalizedX * halfWidth + up[2] * normalizedY * halfHeight,
    ];

    const horizontalLength = Math.hypot(direction[0], direction[2]);
    if (Math.abs(direction[1]) < 0.0001 || horizontalLength < 0.0001) return null;

    const distance = (groundY - this.position[1]) / direction[1];
    if (distance <= 0) {
      const fallbackDistance = Math.max(4, this.orbit?.distance ?? 6);
      return [
        this.position[0] + direction[0] / horizontalLength * fallbackDistance,
        groundY,
        this.position[2] + direction[2] / horizontalLength * fallbackDistance,
      ];
    }

    return [
      this.position[0] + direction[0] * distance,
      groundY,
      this.position[2] + direction[2] * distance,
    ];
  }

  worldToScreen(position, canvas) {
    const bounds = canvas.getBoundingClientRect();
    if (this.renderCamera) {
      const projected = new THREE.Vector3(...position).project(this.renderCamera);
      return {
        visible: projected.z >= -1 && projected.z <= 1,
        x: bounds.left + (projected.x * 0.5 + 0.5) * bounds.width,
        y: bounds.top + (-projected.y * 0.5 + 0.5) * bounds.height,
      };
    }

    const viewProjection = multiplyMatrices(this.getProjectionMatrix(), this.getViewMatrix());
    const [x, y, z] = position;
    const clipX = viewProjection[0] * x + viewProjection[4] * y + viewProjection[8] * z + viewProjection[12];
    const clipY = viewProjection[1] * x + viewProjection[5] * y + viewProjection[9] * z + viewProjection[13];
    const clipZ = viewProjection[2] * x + viewProjection[6] * y + viewProjection[10] * z + viewProjection[14];
    const clipW = viewProjection[3] * x + viewProjection[7] * y + viewProjection[11] * z + viewProjection[15];
    return {
      visible: clipW > 0 && clipZ > -clipW && clipZ < clipW,
      x: bounds.left + (clipX / clipW * 0.5 + 0.5) * bounds.width,
      y: bounds.top + (-clipY / clipW * 0.5 + 0.5) * bounds.height,
    };
  }

  updatePosition() {
    if (this.orbit) {
      const { target, distance, azimuth, elevation, targetHeight } = this.orbit;
      const cosineElevation = Math.cos(elevation);
      const finalX = target.position[0] +
        Math.sin(azimuth) * cosineElevation * distance;
      const finalY = target.position[1] +
        targetHeight + Math.sin(elevation) * distance;
      const finalZ = target.position[2] +
        Math.cos(azimuth) * cosineElevation * distance;
      const smoothing = 0.1;
      this.position[0] = lerp(this.position[0], finalX, smoothing);
      this.position[1] = lerp(this.position[1], finalY, smoothing);
      this.position[2] = lerp(this.position[2], finalZ, smoothing);
      this.lookAt([
        target.position[0],
        target.position[1] + targetHeight,
        target.position[2],
      ], { preserveOrbit: true });
    }
  }

  getViewMatrix() {
    this.updatePosition();
    const [x, y, z] = this.position;
    const inverseRotation = multiplyMatrices(
      rotationX(-this.pitch),
      rotationY(-this.yaw),
    );
    return multiplyMatrices(inverseRotation, translation(-x, -y, -z));
  }

  lookAt(target, { preserveOrbit = false } = {}) {
    const targetPosition = target.position ?? target;
    const [targetX, targetY, targetZ] = targetPosition;
    const directionX = targetX - this.position[0];
    const directionY = targetY - this.position[1];
    const directionZ = targetZ - this.position[2];
    const horizontalDistance = Math.hypot(directionX, directionZ);

    if (Math.hypot(directionX, directionY, directionZ) === 0) {
      return;
    }

    if (!preserveOrbit) {
      this.orbit = null;
    }
    this.yaw = Math.atan2(-directionX, -directionZ);
    this.pitch = Math.atan2(directionY, horizontalDistance);
  }

  orbitalFollow(transform, {
    distance = 6,
    azimuth = 0,
    elevation = 0.35,
    targetHeight = 0,
    onChange = null,
  } = {}) {
    this.orbit = {
      target: transform,
      distance,
      azimuth,
      elevation,
      targetHeight,
      onChange,
    };
  }

  getOrbitSettings() {
    if (!this.orbit) return null;
    const {
      target,
      onChange,
      ...settings
    } = this.orbit;
    return settings;
  }

  zoom(amount, { minDistance = 14, maxDistance = 30 } = {}) {
    if (!this.orbit) return;
    const distance = Math.min(
      maxDistance,
      Math.max(minDistance, this.orbit.distance + amount),
    );
    if (distance === this.orbit.distance) return;
    this.orbit.distance = distance;
    this.orbit.onChange?.(this.getOrbitSettings());
  }

  rotateOrbit(deltaAzimuth, deltaElevation, {
    minElevation = -Math.PI / 2 + 1.7,
    maxElevation = Math.PI / 2 - 1,
  } = {}) {
    if (!this.orbit) return;
    this.orbit.azimuth -= deltaAzimuth;
    this.orbit.elevation = Math.min(
      maxElevation,
      Math.max(minElevation, this.orbit.elevation + deltaElevation),
    );
    this.orbit.onChange?.(this.getOrbitSettings());
  }
}