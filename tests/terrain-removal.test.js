import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeTerrainForExport } from '../src/editor/terrain-state.js';

test('o terreno removido não é exportado para o mundo', () => {
  const exported = normalizeTerrainForExport({ width: 128, depth: 128, heights: [0, 1] }, true);
  assert.equal(exported, null);
});

test('o terreno ativo mantém o mesmo payload ao exportar', () => {
  const config = { width: 128, depth: 128, heights: [0, 1], color: '#202522' };
  const exported = normalizeTerrainForExport(config, false);

  assert.deepEqual(exported, config);
  assert.notStrictEqual(exported, config);
});
