import test from 'node:test';
import assert from 'node:assert/strict';

import { migrateWorldResources } from '../src/resources/resource-library.js';

 test('migra materiais legados para recursos com IDs reutilizáveis', () => {
  const migrated = migrateWorldResources({
    version: 2,
    shaders: [{
      path: 'materials/water.mat',
      source: JSON.stringify({ shader: 'Water', diffuseColor: [0.1, 0.2, 0.3], roughness: 0.2 }),
    }],
    entities: [
      { id: 'lake-a', shader: { file: 'materials/water.mat' }, materials: [{ name: 'Lake' }] },
      { id: 'lake-b', shader: { file: 'materials/water.mat' }, materials: [{ name: 'Lake' }] },
    ],
  });

  assert.equal(migrated.version, 3);
  assert.equal(migrated.entities[0].materials[0].materialId, 'material:materials/water.mat');
  assert.equal(migrated.entities[1].materials[0].materialId, 'material:materials/water.mat');
  assert.equal(migrated.resources.materials.length, 1);
  assert.equal(migrated.resources.materials[0].shaderId, 'builtin/water');
  assert.deepEqual(migrated.resources.materials[0].parameters.diffuseColor, [0.1, 0.2, 0.3]);
});

test('preserva recursos explícitos e adiciona shaders built-in', () => {
  const migrated = migrateWorldResources({
    version: 3,
    resources: {
      shaders: [{ id: 'shader:toon', name: 'Toon', source: 'void main() {}' }],
      materials: [{ id: 'material:toon', name: 'Toon Material', shaderId: 'shader:toon', parameters: { roughness: 0.4 } }],
    },
    entities: [{ id: 'cube', materials: [{ materialId: 'material:toon' }] }],
  });

  assert.ok(migrated.resources.shaders.some((shader) => shader.id === 'builtin/standard'));
  assert.ok(migrated.resources.shaders.some((shader) => shader.id === 'shader:toon'));
  assert.equal(migrated.resources.materials[0].shaderId, 'shader:toon');
  assert.equal(migrated.entities[0].materials[0].materialId, 'material:toon');
});
