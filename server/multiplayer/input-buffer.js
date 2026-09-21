export class InputBuffer {
  constructor({ maxSize = 120 } = {}) {
    this.maxSize = maxSize;
    this.inputs = [];
  }

  push(input) {
    if (this.inputs.length >= this.maxSize) return false;
    this.inputs.push(input);
    this.inputs.sort((left, right) => left.sequence - right.sequence);
    return true;
  }

  takeNext() { return this.inputs.shift() ?? null; }
  get size() { return this.inputs.length; }
}