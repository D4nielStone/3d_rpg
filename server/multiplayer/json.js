export const MAX_JSON_BODY_BYTES = 256 * 1024;

export async function readJson(request) {
  const contentLength = Number(request.headers?.['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    const error = new Error('Payload too large');
    error.statusCode = 413;
    throw error;
  }

  const chunks = [];
  let bodyLength = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bodyLength += buffer.length;
    if (bodyLength > MAX_JSON_BODY_BYTES) {
      const error = new Error('Payload too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export function sendJson(response, statusCode, body, headers = {}) {
  Object.entries(headers).forEach(([name, value]) => response.setHeader(name, value));
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}