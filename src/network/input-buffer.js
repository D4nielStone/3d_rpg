export class InputBuffer {
  constructor() { this.pendingInputs = []; }
  add(input) { this.pendingInputs.push(input); }
  acknowledge(sequence) { this.pendingInputs = this.pendingInputs.filter((input) => input.sequence > sequence); }
  values() { return [...this.pendingInputs]; }
  get size() { return this.pendingInputs.length; }
}