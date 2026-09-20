import { LoopOnce, LoopRepeat } from 'three';

export class AnimationPlayer {
  constructor({ animations = {}, mixer = null, onUpdate = null, initialAnimation = null, speed = 1 } = {}) {
    this.animations = Array.isArray(animations)
      ? Object.fromEntries(animations.map((animation) => [animation.name, animation]))
      : animations;
    this.mixer = mixer;
    this.onUpdate = onUpdate;
    this.action = null;
    this.currentAnimation = null;
    this.elapsed = 0;
    this.speed = Math.max(0, Number(speed) || 0);
    this.playing = false;
    const firstAnimation = initialAnimation ?? Object.keys(this.animations)[0];
    if (firstAnimation !== undefined) this.play(firstAnimation);
  }

  play(name, { loop = true, reset = true } = {}) {
    const animation = this.animations[name];
    if (!animation) return false;
    this.currentAnimation = name;
    this.loop = loop;
    if (reset) this.elapsed = 0;
    if (this.mixer) {
      this.action?.stop();
      this.action = this.mixer.clipAction(animation);
      this.action.reset();
      this.action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
      this.action.clampWhenFinished = !loop;
      this.action.play();
    }
    this.playing = true;
    return true;
  }

  pause() { this.playing = false; }
  resume() { if (this.currentAnimation) this.playing = true; }

  stop() {
    this.action?.stop();
    this.playing = false;
    this.elapsed = 0;
  }

  update(deltaSeconds, transform, updatedMixers = null) {
    if (!this.playing || this.currentAnimation === null) return;
    const animation = this.animations[this.currentAnimation];
    if (this.mixer) {
      if (!updatedMixers || !updatedMixers.has(this.mixer)) {
        this.mixer.update(deltaSeconds * this.speed);
        updatedMixers?.add(this.mixer);
      }
      this.onUpdate?.();
      return;
    }
    const duration = Math.max(0, Number(animation.duration) || 0);
    this.elapsed += deltaSeconds * this.speed;
    if (duration > 0 && this.elapsed >= duration) {
      if (this.loop) this.elapsed %= duration;
      else {
        this.elapsed = duration;
        this.playing = false;
      }
    }
    animation.apply?.({
      elapsed: this.elapsed,
      progress: duration > 0 ? this.elapsed / duration : 0,
      transform,
    });
  }

  dispose() {
    this.action?.stop();
    this.mixer?.stopAllAction();
  }
}
