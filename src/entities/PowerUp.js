import { TUNING } from '../core/Config.js';

/** Falling bonus capsule. Pooled by the engine. */
export class PowerUp {
  constructor() {
    this.active = false;
    this.type = null;
    this.x = 0;
    this.y = 0;
    this.width = TUNING.powerUp.width;
    this.height = TUNING.powerUp.height;
    this.vy = 0;
    this.rotation = 0;
    this.phase = 0;
    this.caught = 0;
  }

  init(type, x, y, speed) {
    this.active = true;
    this.type = type;
    this.x = x - this.width * 0.5;
    this.y = y - this.height * 0.5;
    this.vy = speed;
    this.rotation = 0;
    this.phase = 0;
    this.caught = 0;
  }

  update(dt) {
    if (!this.active) return;
    this.phase += dt;
    this.rotation = Math.sin(this.phase * 3.4) * 0.09;
    if (this.caught > 0) {
      this.caught = Math.min(1, this.caught + dt * 6);
      return;
    }
    this.y += this.vy * dt;
  }

  get centerX() {
    return this.x + this.width * 0.5;
  }

  get centerY() {
    return this.y + this.height * 0.5;
  }

  /** Axis-aligned overlap test against the paddle. */
  overlapsRect(rx, ry, rw, rh) {
    return this.x < rx + rw && this.x + this.width > rx && this.y < ry + rh && this.y + this.height > ry;
  }
}
