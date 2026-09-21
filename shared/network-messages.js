export const FIXED_DT = 1 / 60;
export const MAX_INPUTS_PER_SECOND = 90;
export const MAX_INPUT_PACKET_BYTES = 512;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizePlayerInput(input) {
  if (!input || !Number.isInteger(input.sequence) || input.sequence < 0
    || !Number.isInteger(input.tick) || input.tick < 0) return null;
  const moveX = Number(input.moveX);
  const moveZ = Number(input.moveZ);
  if (!Number.isFinite(moveX) || !Number.isFinite(moveZ)) return null;
  return {
    sequence: input.sequence,
    tick: input.tick,
    moveX: clamp(moveX, -1, 1),
    moveZ: clamp(moveZ, -1, 1),
    jump: input.jump === true,
    sprint: input.sprint === true,
  };
}

export function isPlayerInputMessage(message) {
  return message?.type === 'player_input' && normalizePlayerInput(message.input ?? message);
}

export function createPlayerInputMessage(input) {
  return { type: 'player_input', input: normalizePlayerInput(input) };
}