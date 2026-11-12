import { COINS } from './RogueliteConfig.js';
import { TAU } from '../core/MathUtils.js';

class Coin {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.value = 1;
    this.radius = 6;
    this.phase = 0;
    this.collected = 0;
  }

  init(x, y, value) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 90;
    this.vy = COINS.fallSpeed * 0.4;
    this.value = Math.max(1, Math.round(value));
    this.radius = 5 + Math.min(4, this.value * 0.35);
    this.phase = Math.random() * TAU;
    this.collected = 0;
  }
}

/** Pooled falling coins with optional magnetic attraction (relic). */
export class CoinSystem {
  constructor(game) {
    this.game = game;
    this.pool = [];
    for (let i = 0; i < COINS.maxOnScreen; i += 1) this.pool.push(new Coin());
  }

  reset() {
    for (const coin of this.pool) {
      coin.active = false;
      coin.collected = 0;
    }
  }

  get activeCount() {
    let count = 0;
    for (const coin of this.pool) if (coin.active) count += 1;
    return count;
  }

  spawn(x, y, value) {
    if (value <= 0) return null;
    for (const coin of this.pool) {
      if (coin.active) continue;
      coin.init(x, y, value);
      return coin;
    }
    return null;
  }

  update(dt) {
    const game = this.game;
    const paddle = game.paddle;
    if (!paddle) return;
    const magnet = Boolean(game.build?.coinMagnet);
    const magnetRadius = COINS.magnetRadius;
    const px = paddle.x + paddle.width * 0.5;

    for (const coin of this.pool) {
      if (!coin.active) continue;
      coin.phase += dt;

      if (coin.collected > 0) {
        coin.collected = Math.min(1, coin.collected + dt * 5);
        coin.y -= dt * 260;
        if (coin.collected >= 1) coin.active = false;
        continue;
      }

      coin.vy += 120 * dt * 0.25;
      coin.vy = Math.min(coin.vy, COINS.fallSpeed * 1.6);
      coin.vx *= Math.max(0, 1 - 1.6 * dt);

      if (magnet) {
        const dx = px - coin.x;
        const dy = paddle.y - coin.y;
        const distance = Math.hypot(dx, dy);
        if (distance < magnetRadius && distance > 0.001) {
          const pull = COINS.magnetSpeed * (1 - distance / magnetRadius) + 80;
          coin.vx += (dx / distance) * pull * dt;
          coin.vy += (dy / distance) * pull * dt;
        }
      }

      coin.x += coin.vx * dt;
      coin.y += coin.vy * dt;

      if (coin.y > game.world.height + 30) {
        coin.active = false;
        continue;
      }

      if (
        coin.x + coin.radius > paddle.x &&
        coin.x - coin.radius < paddle.x + paddle.width &&
        coin.y + coin.radius > paddle.y &&
        coin.y - coin.radius < paddle.y + paddle.height
      ) {
        coin.collected = 0.001;
        this.collect(coin);
      }
    }
  }

  collect(coin) {
    const value = coin.value;
    this.game.addCoins(value, coin.x, coin.y);
  }

  collectAll() {
    let total = 0;
    for (const coin of this.pool) {
      if (!coin.active || coin.collected > 0) continue;
      total += coin.value;
      coin.active = false;
    }
    if (total > 0) this.game.addCoins(total, this.game.paddle?.x ?? 0, this.game.paddle?.y ?? 0, true);
    return total;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const coin of this.pool) {
      if (!coin.active) continue;
      const pulse = 0.72 + Math.sin(coin.phase * 5) * 0.28;
      const color = coin.value >= 4 ? '#ffd24a' : coin.value >= 2 ? '#ffe14d' : '#ffc96b';
      ctx.globalAlpha = (coin.collected > 0 ? 1 - coin.collected : 0.9) * pulse;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.35 * pulse;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius * 1.9, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
