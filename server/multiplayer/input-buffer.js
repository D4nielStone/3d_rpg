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
  takeLatest() {
    if (this.inputs.length === 0) return null;
    const latest = this.inputs.reduce((selected, input) => (
      input.sequence > selected.sequence ? input : selected
    ));
    this.inputs.length = 0;
    return latest;
  }
  get size() { return this.inputs.length; }
}