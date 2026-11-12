import { TUNING } from '../core/Config.js';
import { clamp, damp } from '../core/MathUtils.js';

/** Player paddle — mouse/touch target driven, or keyboard velocity driven. */
export class Paddle {
  constructor() {
    this.width = TUNING.paddle.baseWidth;
    this.baseWidth = TUNING.paddle.baseWidth;
    this.targetWidth = TUNING.paddle.baseWidth;
    this.height = TUNING.paddle.height;
    this.x = 0;
    this.y = 0;
    this.prevX = 0;
    this.velocity = 0;
    this.flash = 0;
    this.impactX = 0;
    this.stun = 0;
  }

  get centerX() {
    return this.x + this.width * 0.5;
  }

  setWorldBounds(worldWidth, worldHeight) {
    this.y = worldHeight - TUNING.paddle.bottomMargin - this.height;
    this.x = clamp(this.x, 0, worldWidth - this.width);
  }

  centerAt(x, worldWidth) {
    this.x = clamp(x - this.width * 0.5, 0, worldWidth - this.width);
  }

  applyWide(active) {
    this.targetWidth = this.baseWidth * (active ? TUNING.paddle.wideFactor : 1);
  }

  update(dt, worldWidth) {
    this.prevX = this.x;
    const previousWidth = this.width;
    this.width = damp(this.width, this.targetWidth, 12, dt);
    this.width = Math.min(this.width, worldWidth);
    this.x -= (this.width - previousWidth) * 0.5;
    this.x = clamp(this.x, 0, worldWidth - this.width);
    this.velocity = dt > 0 ? (this.x - this.prevX) / dt : 0;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 4.2);
    if (this.stun > 0) this.stun = Math.max(0, this.stun - dt);
  }

  hit(impactX) {
    this.flash = 1;
    this.impactX = impactX;
  }
}
