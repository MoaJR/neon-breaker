import { DEG, clamp } from '../core/MathUtils.js';
import { TUNING } from '../core/Config.js';
import {
  HIT,
  PADDLE_CONTACT,
  WALL_HIT,
  resolveWalls,
  testCircleRect,
  testPaddleContact,
} from './CollisionSystem.js';

/**
 * Integrates ball motion and resolves every collision.
 * Runs on a fixed timestep; the displacement per step is always smaller than the
 * ball radius, so tunnelling cannot happen even at max speed.
 */
export class PhysicsEngine {
  constructor(game) {
    this.game = game;
    this.maxBounceAngle = TUNING.paddle.maxBounceAngle * DEG;
  }

  step(dt) {
    const { balls } = this.game;
    for (let i = 0; i < balls.length; i += 1) {
      const ball = balls[i];
      if (!ball.active || ball.stuck) continue;
      this.integrateBall(ball, dt);
    }
  }

  integrateBall(ball, dt) {
    const world = this.game.world;
    const level = this.game.level;
    const paddle = this.game.paddle;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    const gravity = this.game.getGravity ? this.game.getGravity() : 0;
    if (gravity) {
      ball.vy += gravity * dt;
      ball.clampSpeed(TUNING.ball.maxSpeed * 1.08);
    }

    const wallHit = resolveWalls(ball, world);
    if (wallHit !== WALL_HIT.NONE) {
      ball.guardAngle();
      this.game.onWallHit(ball, wallHit);
    }

    if (testPaddleContact(ball, paddle, PADDLE_CONTACT)) {
      this.bounceOffPaddle(ball, paddle, PADDLE_CONTACT.rel, PADDLE_CONTACT.contactX);
    } else {
      const clones = this.game.extraPaddles;
      if (clones) {
        for (let i = 0; i < clones.length; i += 1) {
          const clone = clones[i];
          if (!clone.active) continue;
          if (!testPaddleContact(ball, clone, PADDLE_CONTACT)) continue;
          this.bounceOffPaddle(ball, clone, PADDLE_CONTACT.rel, PADDLE_CONTACT.contactX);
          break;
        }
      }
    }

    this.collideBlocks(ball, level);

    if (ball.y - ball.radius > world.height) {
      ball.active = false;
      ball.stuck = false;
      this.game.onBallLost(ball);
    }
  }

  bounceOffPaddle(ball, paddle, rel, contactX) {
    const maxAngle = this.maxBounceAngle;
    const englishStrength = TUNING.paddle.english + (this.game.build?.englishBonus ?? 0);
    const english = clamp(paddle.velocity / TUNING.paddle.keyboardSpeed, -1, 1) * englishStrength;
    const angle = clamp(-Math.PI * 0.5 + rel * maxAngle + english * 0.6, -Math.PI * 0.5 - maxAngle, -Math.PI * 0.5 + maxAngle);

    ball.y = paddle.y - ball.radius - 0.35;
    ball.launch(angle, ball.speed);
    ball.guardAngle();
    ball.pushTrail();
    this.game.onPaddleHit(ball, contactX);
  }

  collideBlocks(ball, level) {
    const geometry = level.geometry;
    const r = ball.radius;
    const colSpan = geometry.cellW + geometry.gap;
    const rowSpan = geometry.cellH + geometry.gap;
    const cols = level.cols;
    const rows = level.rows;

    let c0 = Math.floor((ball.x - r - geometry.originX) / colSpan);
    let c1 = Math.floor((ball.x + r - geometry.originX) / colSpan);
    let r0 = Math.floor((ball.y - r - geometry.originY) / rowSpan);
    let r1 = Math.floor((ball.y + r - geometry.originY) / rowSpan);

    if (c1 < 0 || r1 < 0 || c0 >= cols || r0 >= rows) return;

    if (c0 < 0) c0 = 0;
    if (r0 < 0) r0 = 0;
    if (c1 > cols - 1) c1 = cols - 1;
    if (r1 > rows - 1) r1 = rows - 1;

    for (let row = r0; row <= r1; row += 1) {
      const rowOffset = row * cols;
      for (let col = c0; col <= c1; col += 1) {
        const block = level.grid[rowOffset + col];
        if (!block || !block.alive) continue;
        if (!testCircleRect(ball, block.x, block.y, block.width, block.height, HIT)) continue;

        const pierced = !block.indestructible && (ball.pierce || this.game.shouldPierce?.(ball, block));
        this.game.damageBlock(block, ball, HIT.nx, HIT.ny);

        if (pierced) continue;

        const vn = ball.vx * HIT.nx + ball.vy * HIT.ny;
        if (vn < 0) {
          ball.vx -= 2 * vn * HIT.nx;
          ball.vy -= 2 * vn * HIT.ny;
        }
        ball.x += HIT.nx * (HIT.penetration + 0.05);
        ball.y += HIT.ny * (HIT.penetration + 0.05);
        ball.guardAngle();
        ball.pushTrail();
        return;
      }
    }
  }
}
