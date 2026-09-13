import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { createMountainObject } from '../src/editor/mountain-tool.js';

test('cria um terreno em malha com altura positiva e geometria deformável', () => {
  const terrain = createMountainObject();

  assert.ok(terrain instanceof THREE.Mesh);
  assert.ok(terrain.geometry instanceof THREE.BufferGeometry);
  assert.ok(terrain.geometry.attributes.position.count > 0);

  const box = new THREE.Box3().setFromObject(terrain);
  assert.ok(Number.isFinite(box.min.y));
  assert.ok(box.max.y > box.min.y);
  assert.ok(box.getSize(new THREE.Vector3()).lengthSq() > 0);
});
