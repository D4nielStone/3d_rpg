export class SoundListener {
  constructor({ context = null } = {}) {
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    this.context = context ?? (AudioContextClass ? new AudioContextClass() : null);
  }

  resume() {
    return this.context?.resume?.() ?? Promise.resolve();
  }

  dispose() {
    this.context?.close?.();
  }
}

export class SoundPlayer {
  constructor({ sounds = {}, volume = 1, loop = false, spatial = true } = {}) {
    this.sounds = new Map(Object.entries(sounds));
    this.volume = Math.max(0, Number(volume) || 0);
    this.loop = loop;
    this.spatial = spatial;
    this.context = null;
    this.output = null;
    this.position = [0, 0, 0];
    this.activeSources = new Set();
  }

  setContext(context) {
    if (this.context === context) return;
    this.output?.disconnect();
    this.context = context;
    this.output = context?.createGain?.() ?? null;
    if (this.output) {
      this.output.gain.value = this.volume;
      this.output.connect(context.destination);
    }
  }

  setPosition(position) {
    this.position = [...position];
    for (const source of this.activeSources) {
      const panner = source.panner;
      if (!panner) continue;
      setAudioParam(panner.positionX, this.position[0]);
      setAudioParam(panner.positionY, this.position[1]);
      setAudioParam(panner.positionZ, this.position[2]);
      panner.setPosition?.(...this.position);
    }
  }

  async load(name, source = this.sounds.get(name)) {
    if (!this.context || !source) return null;
    if (typeof source === 'function') {
      const buffer = source(this.context);
      this.sounds.set(name, buffer);
      return buffer;
    }
    if (source?.duration !== undefined && source?.getChannelData) return source;
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Nao foi possivel carregar o som ${name}.`);
    const buffer = await response.arrayBuffer();
    const decoded = await this.context.decodeAudioData(buffer);
    this.sounds.set(name, decoded);
    return decoded;
  }

  async play(name, { loop = this.loop, volume = 1 } = {}) {
    if (!this.context || !this.output) return null;
    await this.context.resume?.();
    const buffer = await this.load(name);
    if (!buffer) return null;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    const gain = this.context.createGain();
    gain.gain.value = Math.max(0, Number(volume) || 0);
    const panner = this.spatial ? this.createPanner() : null;
    source.connect(gain);
    gain.connect(panner ?? this.output);
    panner?.connect(this.output);
    const activeSource = { source, panner };
    this.activeSources.add(activeSource);
    source.addEventListener('ended', () => this.activeSources.delete(activeSource), { once: true });
    this.setPosition(this.position);
    source.start();
    return source;
  }

  stopAll() {
    for (const { source } of this.activeSources) source.stop();
    this.activeSources.clear();
  }

  createPanner() {
    const panner = this.context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 100;
    panner.rolloffFactor = 1;
    return panner;
  }

  dispose() {
    this.stopAll();
    this.output?.disconnect();
  }
}

function setAudioParam(param, value) {
  param?.setValueAtTime?.(value, param.context?.currentTime ?? 0);
  if (param && !param.setValueAtTime) param.value = value;
}
