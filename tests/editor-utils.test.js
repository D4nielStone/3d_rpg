import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeVector,
  normalizeColor,
  colorToHex,
  uniqueEntityName,
  listEditorEntities,
  createPrimitiveObject,
  createCollisionMesh,
  createCollisionSurfaceGeometry,
} from '../src/editor/editor-utils.js';
import { getColliderDescriptors, getCombinedCollisionScale } from '../shared/collision-shape.js';

test('normalizeVector usa fallback para valores inválidos', () => {
  assert.deepEqual(normalizeVector([1, 2], [0, 0, 0]), [1, 2, 0]);
  assert.deepEqual(normalizeVector({ 0: 5 }, [1, 2, 3]), [5, 2, 3]);
});

test('normalizeColor limita canais para 0..1', () => {
  assert.deepEqual(normalizeColor([2, -1, 0.4], [1, 1, 1]), [1, 0, 0.4]);
});

test('colorToHex converte RGB para hexadecimal', () => {
  assert.equal(colorToHex([1, 0.5, 0]), '#ff8000');
});

test('uniqueEntityName evita nomes duplicados', () => {
  const entities = [{ id: 'a', name: 'Portal' }, { id: 'b', name: 'Portal 2' }];
  assert.equal(uniqueEntityName('Portal', entities), 'Portal 3');
  assert.equal(uniqueEntityName('Novo', entities), 'Novo');
  assert.equal(uniqueEntityName('Portal', entities, 'a'), 'Portal');
  assert.equal(uniqueEntityName('Portal', entities, 'b'), 'Portal 2');
});

test('listEditorEntities inclui terreno e luz direcional como entidades editáveis', () => {
  const entities = [{ id: 'entity-1', name: 'Cubo', type: 'entity' }];
  const list = listEditorEntities(entities);
  assert.deepEqual(list.map((entity) => entity.type), ['terrain', 'directionalLight', 'entity']);
  assert.equal(list[0].name, 'Terreno');
  assert.equal(list[1].name, 'Luz direta');
});

test('malha de colisao preserva a escala do modelo', () => {
  const object = createPrimitiveObject('box');
  object.scale.set(2, 3, 4);

  const mesh = createCollisionMesh(object);
  const xCoordinates = mesh.vertices.filter((_, index) => index % 3 === 0);
  const yCoordinates = mesh.vertices.filter((_, index) => index % 3 === 1);
  const zCoordinates = mesh.vertices.filter((_, index) => index % 3 === 2);

  assert.equal(Math.max(...xCoordinates), 1);
  assert.equal(Math.max(...yCoordinates), 1.5);
  assert.equal(Math.max(...zCoordinates), 2);
});

test('geometria visual do colisor usa triangulos do modelo em vez da grelha aproximada', () => {
  const object = createPrimitiveObject('box');
  const mesh = createCollisionMesh(object);
  const geometry = createCollisionSurfaceGeometry({ mesh, columns: 4, rows: 4, minX: -1, maxX: 1, minZ: -1, maxZ: 1 });

  assert.ok(geometry);
  assert.equal(geometry.index.count, mesh.indices.length);
  assert.equal(geometry.attributes.position.count, mesh.vertices.length / 3);
});

test('dimensoes do preview de box e capsule seguem o descritor da fisica', () => {
  const scale = getCombinedCollisionScale({ scale: [2, 3, 4], collision: { scale: [1, 0.5, 0.25] } });
  const box = getColliderDescriptors('box', scale)[0];
  assert.deepEqual(box.halfExtents, [1, 0.75, 0.5]);

  const capsule = getColliderDescriptors('capsule', scale);
  assert.equal(capsule[0].radius, 0.5);
  assert.equal(capsule[0].height, 0.5);
  assert.deepEqual(capsule.slice(1).map((descriptor) => descriptor.translation[1]), [0.25, -0.25]);
});
