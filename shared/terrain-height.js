export const TERRAIN_BASE_Y = -0.7;
export const PLAYER_HEIGHT = 1.4;

export function sampleTerrainHeight(terrain, x, z) {
  const width = Number(terrain?.width);
  const depth = Number(terrain?.depth);
  const segments = Math.floor(Number(terrain?.segments));
  const heights = terrain?.heights;
  if (!Number.isFinite(width) || !Number.isFinite(depth) || !Number.isInteger(segments) || segments < 1 || !Array.isArray(heights)) return null;
  const columns = segments + 1;
  if (heights.length !== columns * columns) return null;

  const gridX = Math.max(0, Math.min(segments, ((Number(x) + width / 2) / width) * segments));
  const gridZ = Math.max(0, Math.min(segments, ((Number(z) + depth / 2) / depth) * segments));
  const left = Math.floor(gridX);
  const top = Math.floor(gridZ);
  const right = Math.min(segments, left + 1);
  const bottom = Math.min(segments, top + 1);
  const fractionX = gridX - left;
  const fractionZ = gridZ - top;
  const topLeft = Number(heights[top * columns + left]) || 0;
  const topRight = Number(heights[top * columns + right]) || 0;
  const bottomLeft = Number(heights[bottom * columns + left]) || 0;
  const bottomRight = Number(heights[bottom * columns + right]) || 0;
  const topHeight = topLeft + (topRight - topLeft) * fractionX;
  const bottomHeight = bottomLeft + (bottomRight - bottomLeft) * fractionX;
  return TERRAIN_BASE_Y + topHeight + (bottomHeight - topHeight) * fractionZ;
}

export function canTraverseTerrain(terrain, from, to) {
  if (!Array.isArray(from) || !Array.isArray(to)) return true;
  const steps = Math.max(2, Math.ceil(Math.hypot(to[0] - from[0], to[2] - from[2]) / 0.2));
  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const x = from[0] + (to[0] - from[0]) * progress;
    const z = from[2] + (to[2] - from[2]) * progress;
    const height = sampleTerrainHeight(terrain, x, z);
    if (height !== null && (height > TERRAIN_BASE_Y + PLAYER_HEIGHT || height < TERRAIN_BASE_Y - PLAYER_HEIGHT)) {
      return false;
    }
  }
  return true;
}
