import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeVector, normalizeColor, colorToHex, uniqueEntityName } from '../src/editor/editor-utils.js';

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
