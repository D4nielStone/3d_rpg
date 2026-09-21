import { FIXED_DT, MAX_INPUTS_PER_SECOND, normalizePlayerInput } from '../../shared/network-messages.js';
import { InputBuffer } from './input-buffer.js';

export class ServerPhysicsAuthority {
  constructor({ physics, getSpeed = () => 3 } = {}) {
    this.physics = physics;
    this.getSpeed = getSpeed;
    this.players = new Map();
    this.serverTick = 0;
    this.rejectedInputs = 0;
  }
  addPlayer(player) {
    this.players.set(player.peerId, {
      player,
      inputBuffer: new InputBuffer(),
      lastReceivedInput: -1,
      lastProcessedInput: -1,
      inputWindowStartedAt: Date.now(),
      inputCount: 0,
    });
  }
  removePlayer(peerId) { this.players.delete(peerId); }
  receiveInput(player, rawInput) {
    const input = normalizePlayerInput(rawInput);
    const state = this.players.get(player.peerId);
    if (!state || !input || input.sequence <= state.lastReceivedInput) { this.rejectedInputs += 1; return false; }
    const now = Date.now();
    if (now - state.inputWindowStartedAt >= 1000) {
      state.inputWindowStartedAt = now;
      state.inputCount = 0;
    }
    if (state.inputCount >= MAX_INPUTS_PER_SECOND) { this.rejectedInputs += 1; return false; }
    if (!state.inputBuffer.push(input)) { this.rejectedInputs += 1; return false; }
    state.inputCount += 1;
    state.lastReceivedInput = input.sequence;
    return true;
  }
  receiveState(player, rawState) {
    const state = this.players.get(player.peerId);
    const position = rawState?.position;
    const rotation = rawState?.rotation;
    if (!state || !Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) return false;
    if (!Array.isArray(rotation) || rotation.length !== 3 || !rotation.every(Number.isFinite)) return false;

    player.setTransform(position, rotation);
    player.linearVelocity = Array.isArray(rawState.linearVelocity) && rawState.linearVelocity.length === 3
      ? rawState.linearVelocity.map((value) => Number.isFinite(value) ? value : 0)
      : [0, 0, 0];
    player.grounded = rawState.grounded === true;
    return true;
  }
  tick() {
    this.serverTick += 1;
  }
  snapshots() {
    return [...this.players.values()].map(({ player, lastProcessedInput }) => ({
      serverTick: this.serverTick,
      playerId: player.peerId,
      lastProcessedInput,
      position: { x: player.position[0], y: player.position[1], z: player.position[2] },
      rotation: { x: 0, y: player.rotation[1] ?? 0, z: 0, w: 1 },
      linearVelocity: { x: player.linearVelocity?.[0] ?? 0, y: player.linearVelocity?.[1] ?? 0, z: player.linearVelocity?.[2] ?? 0 },
      grounded: player.grounded === true,
    }));
  }
}