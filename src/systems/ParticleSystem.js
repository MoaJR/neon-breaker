import { TUNING } from '../core/Config.js';
import { rand, TAU } from '../core/MathUtils.js';

const SHAPE_SPARK = 0;
const SHAPE_SHARD = 1;
const SHAPE_RING = 2;
const SHAPE_DOT = 3;

/** Pooled particle system — zero allocations while playing. */
export class ParticleSystem {
  constructor(max = TUNING.particles.max) {
    this.pool = new Array(max);
    for (let i = 0; i < max; i += 1) {
      this.pool[i] = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        endSize: 0,
        color: '#ffffff',
        alpha: 1,
        shape: SHAPE_SPARK,
        rot: 0,
        spin: 0,
        gravity: 0,
        drag: 0,
        streak: 1,
      };
    }
    this.cursor = 0;
    this.limit = TUNING.particles.max;
    this.quality = 1;
  }

  setQuality(quality) {
    this.quality = quality;
    this.limit = Math.max(60, Math.floor(TUNING.particles.max * quality));
  }

  clear() {
    for (let i = 0; i < this.pool.length; i += 1) this.pool[i].active = false;
  }

  next() {
    for (let attempt = 0; attempt < this.limit; attempt += 1) {
      const particle = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.limit;
      if (!particle.active) return particle;
    }
    return null;
  }

  spawn(x, y, vx, vy, color, life, size, shape, options) {
    const particle = this.next();
    if (!particle) return;
    particle.active = true;
    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.color = color;
    particle.life = life;
    particle.maxLife = life;
    particle.size = size;
    particle.endSize = options?.endSize ?? 0;
    particle.alpha = options?.alpha ?? 1;
    particle.shape = shape;
    particle.rot = options?.rot ?? 0;
    particle.spin = options?.spin ?? 0;
    particle.gravity = options?.gravity ?? 0;
    particle.drag = options?.drag ?? 0;
    particle.streak = options?.streak ?? 1;
  }

  burst(x, y, color, count, options = {}) {
    const amount = Math.max(1, Math.round(count * this.quality));
    const speedMin = options.speedMin ?? 60;
    const speedMax = options.speedMax ?? 260;
    const lifeMin = options.lifeMin ?? 0.28;
    const lifeMax = options.lifeMax ?? 0.7;
    const sizeMin = options.sizeMin ?? 1.6;
    const sizeMax = options.sizeMax ?? 3.4;
    const spread = options.spread ?? TAU;
    const baseAngle = options.angle ?? 0;

    for (let i = 0; i < amount; i += 1) {
      const angle = baseAngle + rand(-spread * 0.5, spread * 0.5);
      const speed = rand(speedMin, speedMax);
      this.spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color,
        rand(lifeMin, lifeMax),
        rand(sizeMin, sizeMax),
        SHAPE_SPARK,
        { gravity: options.gravity ?? 260, drag: 1.6 },
      );
    }
  }

  shards(x, y, color, count) {
    const amount = Math.max(1, Math.round(count * this.quality));
    for (let i = 0; i < amount; i += 1) {
      const angle = rand(0, TAU);
      const speed = rand(70, 240);
      this.spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, rand(0.35, 0.8), rand(2.5, 5), SHAPE_SHARD, {
        gravity: 620,
        drag: 0.9,
        spin: rand(-9, 9),
        rot: rand(0, TAU),
        streak: rand(0.5, 1.4),
      });
    }
  }

  dot(x, y, color, size = 3, life = 0.4, vx = 0, vy = 0) {
    this.spawn(x, y, vx, vy, color, life, size, SHAPE_DOT, { drag: 1.4, gravity: -30 });
  }

  ring(x, y, color, radius = 26, life = 0.42, width = 3) {
    this.spawn(x, y, 0, 0, color, life, radius, SHAPE_RING, {
      endSize: radius * 2.35,
      streak: width,
    });
  }

  update(dt) {
    const pool = this.pool;
    for (let i = 0; i < this.limit; i += 1) {
      const particle = pool[i];
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      if (particle.drag > 0) {
        const damping = Math.max(0, 1 - particle.drag * dt);
        particle.vx *= damping;
        particle.vy *= damping;
      }
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.rot += particle.spin * dt;
    }
  }

  draw(ctx) {
    const pool = this.pool;
    const previousOperation = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < this.limit; i += 1) {
      const particle = pool[i];
      if (!particle.active) continue;
      const progress = 1 - particle.life / particle.maxLife;
      const alpha = particle.alpha * (1 - progress * progress);
      if (alpha <= 0.01) continue;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;

      if (particle.shape === SHAPE_RING) {
        const radius = particle.size + (particle.endSize - particle.size) * progress;
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = particle.streak * (1 - progress * 0.6);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, Math.max(1, radius), 0, TAU);
        ctx.stroke();
      } else if (particle.shape === SHAPE_SHARD) {
        const size = particle.size * (1 - progress * 0.45);
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rot);
        ctx.fillRect(-size * 0.5, -size * 0.5, size, size * particle.streak);
        ctx.restore();
      } else if (particle.shape === SHAPE_DOT) {
        const size = particle.size * (1 - progress * 0.7);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, Math.max(0.6, size), 0, TAU);
        ctx.fill();
      } else {
        const size = Math.max(0.7, particle.size * (1 - progress * 0.55));
        ctx.fillRect(particle.x - size * 0.5, particle.y - size * 0.5, size, size);
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = previousOperation;
  }
}
