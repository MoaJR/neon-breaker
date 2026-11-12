import { TUNING } from '../core/Config.js';

/**
 * Temporary mirrored paddle created by the CLONE upgrade.
 * Exposes the same fields PhysicsEngine expects from a paddle.
 */
export class PaddleClone {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.width = TUNING.paddle.baseWidth;
    this.height = TUNING.paddle.height;
    this.velocity = 0;
    this.life = 0;
    this.maxLife = 1;
  }

  spawn(x, y, width, duration) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = TUNING.paddle.height;
    this.velocity = 0;
    this.life = duration;
    this.maxLife = duration;
  }

  update(dt) {
    if (!this.active) return;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }

  get centerX() {
    return this.x + this.width * 0.5;
  }
}
