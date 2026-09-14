export function isTerrainRemoved(terrain) {
  if (terrain === null) return true;
  if (!terrain || typeof terrain !== 'object') return false;
  if (terrain.removed === true) return true;
  return false;
}

export function normalizeTerrainForExport(terrain, removed = false) {
  if (removed || terrain?.removed === true) return null;
  if (!terrain || typeof terrain !== 'object') return null;

  const { removed: _removed, ...sanitized } = terrain;
  return sanitized;
}
