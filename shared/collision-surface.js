export function sampleCollisionSurface(surface, x, z) {
  const minX = Number(surface?.minX);
  const maxX = Number(surface?.maxX);
  const minZ = Number(surface?.minZ);
  const maxZ = Number(surface?.maxZ);
  const columns = Math.floor(Number(surface?.columns));
  const rows = Math.floor(Number(surface?.rows));
  const heights = surface?.heights;
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX <= minX
    || !Number.isFinite(minZ) || !Number.isFinite(maxZ) || maxZ <= minZ
    || !Number.isInteger(columns) || columns < 2 || !Number.isInteger(rows) || rows < 2
    || !Array.isArray(heights) || heights.length !== columns * rows) return null;
  if (x < minX || x > maxX || z < minZ || z > maxZ) return null;

  const gridX = ((x - minX) / (maxX - minX)) * (columns - 1);
  const gridZ = ((z - minZ) / (maxZ - minZ)) * (rows - 1);
  const left = Math.min(columns - 1, Math.floor(gridX));
  const top = Math.min(rows - 1, Math.floor(gridZ));
  const right = Math.min(columns - 1, left + 1);
  const bottom = Math.min(rows - 1, top + 1);
  const fractionX = gridX - left;
  const fractionZ = gridZ - top;
  const value = (row, column) => Number(heights[row * columns + column]);
  const topHeight = value(top, left) + (value(top, right) - value(top, left)) * fractionX;
  const bottomHeight = value(bottom, left) + (value(bottom, right) - value(bottom, left)) * fractionX;
  return topHeight + (bottomHeight - topHeight) * fractionZ;
}