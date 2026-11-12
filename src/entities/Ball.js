import { TUNING } from '../core/Config.js';

/**
 * A single ball. Balls are pooled by the engine: `reset()` puts an instance back
 * into service without allocating new objects mid-game.
 */
export class Ball {
  constructor(maxTrail = TUNING.ball.trail) {
    this.radius = TUNING.ball.radius;
    this.speed = TUNING.ball.baseSpeed;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.active = false;
    this.stuck = false;
    this.pierce = false;
    this.stuckOffset = 0;
    this.magnetTimer = 0;
    this.trailMax = maxTrail;
    this.trail = new Float32Array(maxTrail * 2);
    this.trailCount = 0;
  }

  reset() {
    this.active = false;
    this.stuck = false;
    this.pierce = false;
    this.stuckOffset = 0;
    this.magnetTimer = 0;
    this.vx = 0;
    this.vy = 0;
    this.trailCount = 0;
  }

  place(x, y) {
    this.x = x;
    this.y = y;
  }

  /** Launch at `angle` radians (0 = right, -PI/2 = straight up). */
  launch(angle, speed = this.speed) {
    this.speed = speed;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.stuck = false;
    this.active = true;
    this.trailCount = 0;
    this.pushTrail();
  }

  setSpeed(speed) {
    const next = Math.max(TUNING.ball.minSpeed, speed);
    const magnitude = Math.hypot(this.vx, this.vy);
    this.speed = next;
    if (magnitude > 0.0001) {
      const factor = next / magnitude;
      this.vx *= factor;
      this.vy *= factor;
    }
  }

  /** Caps velocity magnitude without changing direction (boss gravity, etc.). */
  clampSpeed(max) {
    const magnitude = Math.hypot(this.vx, this.vy);
    if (magnitude <= max || magnitude <= 0.0001) return;
    const factor = max / magnitude;
    this.vx *= factor;
    this.vy *= factor;
    this.speed = Math.min(this.speed, max);
  }

  /** Keeps the ball out of perfectly horizontal / vertical loops. */
  guardAngle() {
    const minV = TUNING.ball.minVertical;
    const minH = TUNING.ball.minHorizontal;
    const magnitude = Math.hypot(this.vx, this.vy) || this.speed || 1;
    let nx = this.vx / magnitude;
    let ny = this.vy / magnitude;
    const signX = nx < 0 ? -1 : 1;
    const signY = ny < 0 ? -1 : 1;

    if (Math.abs(ny) < minV) {
      ny = signY * minV;
      nx = signX * Math.sqrt(Math.max(0, 1 - minV * minV));
    } else if (Math.abs(nx) < minH) {
      nx = signX * minH;
      ny = signY * Math.sqrt(Math.max(0, 1 - minH * minH));
    }

    const speed = this.speed || magnitude;
    this.vx = nx * speed;
    this.vy = ny * speed;
  }

  pushTrail() {
    const trail = this.trail;
    trail.copyWithin(2, 0, (this.trailMax - 1) * 2);
    trail[0] = this.x;
    trail[1] = this.y;
    if (this.trailCount < this.trailMax) this.trailCount += 1;
  }
}
