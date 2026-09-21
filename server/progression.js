export const GAME_PROGRESSION = {
  player: {
    hp: { base: 20, growth: 1.2 },
    mana: { base: 20, growth: 1.2 },
  },
  xp: { base: 3, levelFactor: 0.1 },
  strengthXp: { factor: 5 },
};

export function calculateMaxAttribute({ base, growth }, level) {
  return Math.round(base * growth ** (level - 1));
}

export function calculateMaxHp(level, base = GAME_PROGRESSION.player.hp.base) {
  return calculateMaxAttribute({ base, growth: GAME_PROGRESSION.player.hp.growth }, level);
}

export function calculateMaxMana(level) {
  return calculateMaxAttribute(GAME_PROGRESSION.player.mana, level);
}

export function calculateMaxXp(level) {
  return Math.ceil(level * (level * GAME_PROGRESSION.xp.levelFactor + GAME_PROGRESSION.xp.base));
}

export function calculateMeleeXp(level) {
  return level ** 2 * GAME_PROGRESSION.strengthXp.factor;
}

export function calculateDefenseXp(defense) {
  const normalizedDefense = Math.max(0, Number(defense) || 0);
  return Math.floor(25 * Math.pow(normalizedDefense, 1.6));
}