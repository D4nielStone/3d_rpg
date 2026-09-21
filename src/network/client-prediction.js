import { FIXED_DT } from '../../shared/network-messages.js';
import { InputBuffer } from './input-buffer.js';

export class ClientPrediction {
  constructor({ simulate, getState, setState, send = () => {}, correctionThreshold = 0.35 } = {}) {
    this.simulate = simulate;
    this.getState = getState;
    this.setState = setState;
    this.send = send;
    this.correctionThreshold = correctionThreshold;
    this.inputBuffer = new InputBuffer();
    this.nextSequence = 0;
    this.localTick = 0;
    this.lastConfirmedInput = -1;
    this.reconciliations = 0;
    this.largeCorrections = 0;
    this.averageError = 0;
  }

  update(input) {
    const nextInput = { ...input, sequence: this.nextSequence++, tick: this.localTick++ };
    this.inputBuffer.add(nextInput);
    this.simulate(nextInput, FIXED_DT);
    this.send(nextInput);
    return nextInput;
  }

  reconcile(snapshot) {
    if (!snapshot || snapshot.lastProcessedInput < this.lastConfirmedInput) return false;
    const before = this.getState();
    this.inputBuffer.acknowledge(snapshot.lastProcessedInput);
    const error = Math.hypot(before.position.x - snapshot.position.x, before.position.y - snapshot.position.y, before.position.z - snapshot.position.z);
    if (error > this.correctionThreshold) {
      this.setState(snapshot);
      for (const input of this.inputBuffer.values()) this.simulate(input, FIXED_DT);
    }
    this.averageError = (this.averageError * this.reconciliations + error) / (this.reconciliations + 1);
    this.reconciliations += 1;
    if (error > 1) this.largeCorrections += 1;
    this.lastConfirmedInput = snapshot.lastProcessedInput;
    return true;
  }
}