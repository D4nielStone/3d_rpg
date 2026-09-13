export function doesAttackHit(accuracy = 1, defense = 0, randomValue = Math.random()) {
  const normalizedAccuracy = Math.max(0, Number(accuracy) || 0);
  const normalizedDefense = Math.max(0, Number(defense) || 0);
  if (normalizedDefense === 0) return true;

  const chance = Math.min(0.95, Math.max(0.1, normalizedAccuracy / (normalizedAccuracy + normalizedDefense)));
  return randomValue < chance;
}