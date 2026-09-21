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
  tick() {
    this.serverTick += 1;
    for (const state of this.players.values()) {
      const input = state.inputBuffer.takeNext();
      if (input) {
        const speed = this.getSpeed(state.player) * (input.sprint ? 1.5 : 1);
        const angle = Math.atan2(input.moveX, input.moveZ);
        const magnitude = Math.min(1, Math.hypot(input.moveX, input.moveZ));
        this.physics.movePlayer(state.player.peerId, state.player.position, angle, speed * magnitude, FIXED_DT, false);
        state.lastProcessedInput = input.sequence;
      } else this.physics.stopPlayer(state.player.peerId);
      this.physics.step(FIXED_DT);
      const body = this.physics.getPlayerBody(state.player.peerId, state.player.position);
      state.player.position = [body.position.x, body.position.y, body.position.z];
      state.player.linearVelocity = [body.velocity.x, body.velocity.y, body.velocity.z];
      state.player.grounded = body.position.y <= 0.71;
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