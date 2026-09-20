import test from 'node:test';
import assert from 'node:assert/strict';

import { Camera } from '../src/camera.js';
import { handleCameraWheel } from '../src/three-game-setup.js';

test('orbita a camera em gestos de trackpad', () => {
  const calls = [];
  const camera = {
    rotateOrbit: (...args) => calls.push(['rotateOrbit', ...args]),
    zoom: (...args) => calls.push(['zoom', ...args]),
  };

  handleCameraWheel(camera, {
    deltaX: 12,
    deltaY: 8,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault: () => {},
  });

  assert.deepEqual(calls, [['rotateOrbit', 0.042, -0.028]]);
});

test('calcula destino mesmo enquanto a camera suaviza abaixo do chao', () => {
  const camera = new Camera({ aspect: 1 });
  camera.orbitalFollow({ position: [0, 0, 0] }, {
    distance: 6,
    elevation: 0.35,
    targetHeight: 0.5,
  });
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };

  const target = camera.screenToGround(75, 50, canvas);

  assert.ok(target);
  assert.equal(target[1], 0);
});
