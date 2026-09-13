import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_JSON_BODY_BYTES, readJson } from '../server/multiplayer/json.js';

function requestFrom(chunks, headers = {}) {
  return {
    headers,
    async *[Symbol.asyncIterator]() {
      yield* chunks;
    },
  };
}

test('rejeita payload HTTP maior que o limite antes de montar o JSON', async () => {
  const oversized = Buffer.alloc(MAX_JSON_BODY_BYTES + 1, 'x');

  await assert.rejects(
    readJson(requestFrom([oversized])),
    (error) => error.statusCode === 413 && error.message === 'Payload too large',
  );
});

test('rejeita content-length acima do limite sem consumir o corpo', async () => {
  let consumed = false;
  const request = {
    headers: { 'content-length': String(MAX_JSON_BODY_BYTES + 1) },
    async *[Symbol.asyncIterator]() {
      consumed = true;
      yield Buffer.from('{}');
    },
  };

  await assert.rejects(readJson(request), (error) => error.statusCode === 413);
  assert.equal(consumed, false);
});