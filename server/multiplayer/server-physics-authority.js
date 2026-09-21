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
      currentInput: null,
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
    return false;
  }
  tick() {
    this.serverTick += 0.5;
    for (const state of this.players.values()) {
      const { player } = state;
      let input = state.inputBuffer.takeNext();
      while (state.inputBuffer.size > 0) input = state.inputBuffer.takeNext();
      if (input) {
        state.currentInput = input;
        state.lastProcessedInput = input.sequence;
      }
      input = state.currentInput;
      const movement = input
        ? { angle: Math.atan2(input.moveX, input.moveZ), magnitude: Math.min(1, Math.hypot(input.moveX, input.moveZ)) }
        : { angle: player.rotation[1] ?? 0, magnitude: 0 };
      const speed = this.getSpeed(player) * movement.magnitude;

      this.physics.movePlayer(
        player.peerId,
        player.position,
        movement.angle,
        speed,
        FIXED_DT,
        false,
      );
      if (input) {
        player.rotation[1] = movement.angle;
      }
    }

    this.physics.step(FIXED_DT);
    for (const state of this.players.values()) {
      const { player } = state;
      const position = this.physics.getPlayerPosition(player.peerId);
      const velocity = this.physics.getPlayerVelocity(player.peerId);
      if (position) player.position = position;
      if (velocity) player.linearVelocity = velocity;
    }
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