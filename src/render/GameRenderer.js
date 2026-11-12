import { PALETTE, POWER_UP_LIST, TUNING, WORLD_WIDTH } from '../core/Config.js';
import { clamp, rand, TAU } from '../core/MathUtils.js';
import {
  createBackground,
  createBallSprite,
  createBlockSprite,
  createPowerUpSprite,
  roundRectPath,
} from './SpriteFactory.js';

/** Draws the whole scene. Owns sprite caches, screen shake and flash effects. */
export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.dpr = 1;
    this.cssWidth = 0;
    this.cssHeight = 0;
    this.scale = 1;
    this.pixelScale = 1;
    this.spriteRatio = 2;
    this.background = null;
    this.ballSprite = null;
    this.blockSprites = new Map();
    this.powerSprites = new Map();
    this.trailStops = [];
    this.motes = [];
    this.time = 0;
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#ffffff';
    this.quality = 'high';
    this.reducedMotion = false;
    this.preparedSignature = '';
    this.sectorAccent = '#38dcff';
    this.paddleAccent = '#5fe4ff';
  }

  setPaddleAccent(color = '#5fe4ff') {
    if (!color) return;
    this.paddleAccent = color;
  }

  setSectorAccent(color = '#38dcff') {
    if (!color || this.sectorAccent === color) return;
    this.sectorAccent = color;
  }

  resize(cssWidth, cssHeight, dpr) {
    if (!cssWidth || !cssHeight) return;
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.dpr = clamp(dpr || 1, 1, 3);

    this.canvas.width = Math.round(cssWidth * this.dpr);
    this.canvas.height = Math.round(cssHeight * this.dpr);
    this.scale = cssWidth / WORLD_WIDTH;
    this.pixelScale = this.scale * this.dpr;
    const ratio = clamp(this.pixelScale, 1.25, 2.6);
    if (Math.abs(ratio - this.spriteRatio) > 0.001) {
      this.spriteRatio = ratio;
      this.blockSprites.clear();
      this.powerSprites.clear();
      this.preparedSignature = '';
    }

    this.background = createBackground({ width: cssWidth, height: cssHeight, ratio: this.dpr });
    this.ballSprite = createBallSprite(TUNING.ball.radius, this.spriteRatio);
    this.buildTrailStops();
    this.buildMotes();
  }

  buildTrailStops() {
    const stops = [];
    for (let i = 0; i < TUNING.ball.trail; i += 1) {
      const t = 1 - i / TUNING.ball.trail;
      stops.push(`rgba(150,242,255,${(0.5 * Math.pow(t, 1.25)).toFixed(3)})`);
    }
    this.trailStops = stops;
  }

  buildMotes() {
    const count = this.quality === 'low' ? 12 : 26;
    this.motes.length = 0;
    for (let i = 0; i < count; i += 1) {
      this.motes.push({
        x: Math.random(),
        y: Math.random(),
        size: rand(0.6, 1.9),
        speed: rand(0.004, 0.018),
        alpha: rand(0.05, 0.22),
        phase: rand(0, Math.PI * 2),
      });
    }
  }

  setQuality(quality) {
    this.quality = quality;
    this.buildMotes();
  }

  /** Bake every block state for a level so gameplay never allocates sprites. */
  prepare(level) {
    const signature = `${this.spriteRatio}|${level.name}|${level.index}|${level.rows}|${level.blocks.length}|${level.blocks[0]?.colorIndex ?? -1}`;
    if (this.preparedSignature === signature) return;
    this.preparedSignature = signature;
    this.blockSprites.clear();
    for (let i = 0; i < level.blocks.length; i += 1) {
      const block = level.blocks[i];
      if (block.indestructible) {
        this.ensureBlockSprite(block, 'inf');
        continue;
      }
      for (let hp = block.maxHp; hp >= 1; hp -= 1) this.ensureBlockSprite(block, hp);
    }
    this.ensurePowerSprites();
  }

  ensurePowerSprites() {
    for (const type of POWER_UP_LIST) {
      if (this.powerSprites.has(type.id)) continue;
      this.powerSprites.set(
        type.id,
        createPowerUpSprite({
          type,
          width: TUNING.powerUp.width,
          height: TUNING.powerUp.height,
          ratio: this.spriteRatio,
        }),
      );
    }
  }

  ensureBlockSprite(block, hp) {
    const key = `${block.colorIndex}|${block.kind}|${hp}`;
    const cached = this.blockSprites.get(key);
    if (cached) return cached;
    const damaged = block.maxHp > 1 && hp !== 'inf' ? (block.maxHp - hp) / block.maxHp : 0;
    const sprite = createBlockSprite({
      color: PALETTE[block.colorIndex],
      width: block.width,
      height: block.height,
      ratio: this.spriteRatio,
      damaged,
      kind: block.kind,
    });
    this.blockSprites.set(key, sprite);
    return sprite;
  }

  spriteFor(block) {
    const hp = block.indestructible ? 'inf' : Math.max(1, block.hp);
    const key = `${block.colorIndex}|${block.kind}|${hp}`;
    return this.blockSprites.get(key) || this.ensureBlockSprite(block, hp);
  }

  addShake(amount) {
    if (this.reducedMotion) return;
    this.shake = Math.min(16, this.shake + amount);
  }

  addFlash(color, alpha = 0.25) {
    if (this.reducedMotion) return;
    this.flash = Math.max(this.flash, alpha);
    this.flashColor = color;
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 42);
    this.flash = Math.max(0, this.flash - dt * 3.4);
    for (let i = 0; i < this.motes.length; i += 1) {
      const mote = this.motes[i];
      mote.y -= mote.speed * dt;
      if (mote.y < -0.05) {
        mote.y = 1.05;
        mote.x = Math.random();
      }
    }
  }

  draw(game) {
    const ctx = this.ctx;
    const world = game.world;

    ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    if (this.background) {
      ctx.drawImage(this.background.canvas, 0, 0, world.width, world.height);
    } else {
      ctx.fillStyle = '#04060d';
      ctx.fillRect(0, 0, world.width, world.height);
    }

    this.drawMotes(ctx, world);
    this.drawSectorAccent(ctx, world);

    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);
    }

    this.drawField(ctx, game);
    this.drawBlocks(ctx, game);
    this.drawPowerUps(ctx, game);
    this.drawPaddle(ctx, game);
    this.drawClones(ctx, game);
    this.drawBalls(ctx, game);
    game.coinSystem?.draw?.(ctx);
    game.boss?.draw?.(ctx);
    game.effectRuntime?.draw?.(ctx);
    game.particles.draw(ctx);

    ctx.restore();

    if (this.flash > 0.002) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.flash;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, world.width, world.height);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    if (game.roomModifierEffects?.darkness) this.drawDarkness(ctx, game);
  }

  drawSectorAccent(ctx, world) {
    if (!this.sectorAccent) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.055;
    const gradient = ctx.createRadialGradient(
      world.width * 0.5,
      -world.height * 0.1,
      0,
      world.width * 0.5,
      -world.height * 0.1,
      world.height * 1.1,
    );
    gradient.addColorStop(0, this.sectorAccent);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, world.width, world.height);
    ctx.restore();
  }

  drawClones(ctx, game) {
    const clones = game.extraPaddles;
    if (!clones) return;
    for (let i = 0; i < clones.length; i += 1) {
      const clone = clones[i];
      if (!clone.active) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      const body = ctx.createLinearGradient(0, clone.y, 0, clone.y + clone.height);
      body.addColorStop(0, 'rgba(216,194,255,0.95)');
      body.addColorStop(0.45, '#a86bff');
      body.addColorStop(1, 'rgba(52,20,110,0.65)');
      roundRectPath(ctx, clone.x, clone.y, clone.width, clone.height, clone.height * 0.5);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#d8c2ff';
      ctx.lineWidth = 1.4;
      roundRectPath(ctx, clone.x - 3, clone.y - 3, clone.width + 6, clone.height + 6, clone.height * 0.6);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  drawDarkness(ctx, game) {
    const world = game.world;
    let cx = game.paddle.centerX;
    let cy = game.paddle.y - 30;
    for (const ball of game.balls) {
      if (!ball.active) continue;
      cx = ball.x;
      cy = ball.y;
      break;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const radius = Math.max(240, Math.min(world.width, world.height) * 0.42);
    const gradient = ctx.createRadialGradient(cx, cy, 40, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(2,4,10,0)');
    gradient.addColorStop(0.55, 'rgba(2,4,10,0.38)');
    gradient.addColorStop(1, 'rgba(2,4,10,0.78)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, world.width, world.height);

    const paddleGlow = ctx.createRadialGradient(
      game.paddle.centerX,
      game.paddle.y,
      10,
      game.paddle.centerX,
      game.paddle.y,
      170,
    );
    paddleGlow.addColorStop(0, 'rgba(2,4,10,0)');
    paddleGlow.addColorStop(1, 'rgba(2,4,10,0.72)');
    ctx.fillStyle = paddleGlow;
    ctx.fillRect(0, 0, world.width, world.height);
    ctx.restore();
  }

  drawMotes(ctx, world) {
    if (this.quality === 'low' || !this.motes.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#bfeaff';
    for (let i = 0; i < this.motes.length; i += 1) {
      const mote = this.motes[i];
      const twinkle = 0.55 + Math.sin(this.time * 1.6 + mote.phase) * 0.45;
      ctx.globalAlpha = mote.alpha * twinkle;
      ctx.fillRect(mote.x * world.width, mote.y * world.height, mote.size, mote.size);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Walls, arena glow and the bottom danger band. */
  drawField(ctx, game) {
    const world = game.world;
    const top = world.playTop;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const topGlow = ctx.createLinearGradient(0, top - 26, 0, top + 6);
    topGlow.addColorStop(0, 'rgba(56,220,255,0)');
    topGlow.addColorStop(1, 'rgba(56,220,255,0.16)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, top - 26, world.width, 32);

    ctx.fillStyle = 'rgba(140,235,255,0.30)';
    ctx.fillRect(0, top - 1.5, world.width, 1.5);

    const sideGlow = ctx.createLinearGradient(0, 0, 34, 0);
    sideGlow.addColorStop(0, 'rgba(56,220,255,0.16)');
    sideGlow.addColorStop(1, 'rgba(56,220,255,0)');
    ctx.fillStyle = sideGlow;
    ctx.fillRect(0, top, 34, world.height - top);

    const sideGlowRight = ctx.createLinearGradient(world.width, 0, world.width - 34, 0);
    sideGlowRight.addColorStop(0, 'rgba(56,220,255,0.16)');
    sideGlowRight.addColorStop(1, 'rgba(56,220,255,0)');
    ctx.fillStyle = sideGlowRight;
    ctx.fillRect(world.width - 34, top, 34, world.height - top);

    const danger = ctx.createLinearGradient(0, world.height - 54, 0, world.height);
    danger.addColorStop(0, 'rgba(255,47,141,0)');
    danger.addColorStop(1, 'rgba(255,47,141,0.18)');
    ctx.fillStyle = danger;
    ctx.fillRect(0, world.height - 54, world.width, 54);

    ctx.fillStyle = 'rgba(255,90,150,0.35)';
    ctx.fillRect(0, world.height - 1.5, world.width, 1.5);

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawBlocks(ctx, game) {
    const level = game.level;
    const blocks = level.blocks;

    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (!block.alive && block.dying <= 0) continue;

      const sprite = this.spriteFor(block);
      const pad = sprite.pad;
      const w = sprite.w;
      const h = sprite.h;

      if (block.dying > 0) {
        const progress = 1 - block.dying;
        const scale = 1 + progress * 0.35;
        ctx.globalAlpha = block.dying;
        ctx.save();
        ctx.translate(block.centerX, block.centerY);
        ctx.scale(scale, scale);
        ctx.drawImage(sprite.canvas, -block.width * 0.5 - pad, -block.height * 0.5 - pad, w, h);
        ctx.restore();
        ctx.globalAlpha = 1;
        continue;
      }

      ctx.drawImage(sprite.canvas, block.x - pad, block.y - pad, w, h);

      if (block.hitFlash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = block.hitFlash * 0.8;
        ctx.fillStyle = '#ffffff';
        roundRectPath(ctx, block.x + 1, block.y + 1, block.width - 2, block.height - 2, block.height * 0.3);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      if (block.bossRole) this.drawBossMarker(ctx, block);
    }
  }

  /** Readability overlay for boss weak points / cores / armor. */
  drawBossMarker(ctx, block) {
    const role = block.bossRole;
    if (!role || role === 'barrier') return;
    const color = role === 'weak' ? '#ff2f8d' : role === 'core' ? '#ffffff' : '#9fb2c9';
    const pulse = 0.6 + Math.sin(this.time * 5 + block.col) * 0.4;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.lineWidth = role === 'armor' ? 1.2 : 2.2;
    ctx.globalAlpha = role === 'armor' ? 0.16 : 0.55 * pulse;
    roundRectPath(ctx, block.x + 2.5, block.y + 2.5, block.width - 5, block.height - 5, block.height * 0.28);
    ctx.stroke();
    if (role === 'core' || role === 'weak') {
      ctx.globalAlpha = 0.8 * pulse;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(block.centerX, block.centerY, Math.max(2.5, Math.min(block.width, block.height) * 0.2), 0, TAU);
      ctx.fill();
    }
    if (block.shielded) {
      ctx.globalAlpha = 0.4 + Math.sin(this.time * 7) * 0.15;
      ctx.strokeStyle = '#38dcff';
      ctx.lineWidth = 2.4;
      roundRectPath(ctx, block.x - 2, block.y - 2, block.width + 4, block.height + 4, block.height * 0.34);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawPowerUps(ctx, game) {
    const powerUps = game.powerUps;
    if (!powerUps.length) return;

    ctx.save();
    for (let i = 0; i < powerUps.length; i += 1) {
      const powerUp = powerUps[i];
      if (!powerUp.active || !powerUp.type) continue;
      const sprite = this.powerSprites.get(powerUp.type.id);
      if (!sprite) continue;

      const pulse = 0.65 + Math.sin(powerUp.phase * 6) * 0.35;
      const cx = powerUp.centerX;
      const cy = powerUp.centerY;

      ctx.globalCompositeOperation = 'lighter';
      const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, powerUp.width * 0.95);
      halo.addColorStop(0, powerUp.type.color);
      halo.addColorStop(0.45, 'rgba(255,255,255,0.12)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.32 * pulse;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, powerUp.width * 0.95, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = powerUp.caught > 0 ? 1 - powerUp.caught : 1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(powerUp.rotation);
      ctx.drawImage(sprite.canvas, -powerUp.width * 0.5 - sprite.pad, -powerUp.height * 0.5 - sprite.pad, sprite.w, sprite.h);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }


  drawPaddle(ctx, game) {
    const paddle = game.paddle;
    const { x, y, width, height } = paddle;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // outer halo
    const halo = ctx.createLinearGradient(0, y - height, 0, y + height * 2.2);
    halo.addColorStop(0, 'rgba(56,220,255,0)');
    halo.addColorStop(0.5, 'rgba(56,220,255,0.22)');
    halo.addColorStop(1, 'rgba(56,220,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - 14, y - height, width + 28, height * 3.2);

    // body
    const body = ctx.createLinearGradient(0, y, 0, y + height);
    body.addColorStop(0, 'rgba(232,253,255,0.98)');
    body.addColorStop(0.35, this.paddleAccent);
    body.addColorStop(0.72, '#1c9fe0');
    body.addColorStop(1, 'rgba(10,70,140,0.9)');
    roundRectPath(ctx, x, y, width, height, height * 0.5);
    ctx.fillStyle = body;
    ctx.fill();

    // bright core line
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    roundRectPath(ctx, x + width * 0.06, y + height * 0.2, width * 0.88, Math.max(1.4, height * 0.16), height * 0.1);
    ctx.fill();

    // glowing end caps
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#cdf7ff';
    ctx.beginPath();
    ctx.arc(x + height * 0.42, y + height * 0.5, height * 0.42, 0, Math.PI * 2);
    ctx.arc(x + width - height * 0.42, y + height * 0.5, height * 0.42, 0, Math.PI * 2);
    ctx.fill();

    // impact flash
    if (paddle.flash > 0) {
      const fx = clamp(paddle.impactX, x, x + width);
      const flash = ctx.createRadialGradient(fx, y + height * 0.4, 0, fx, y + height * 0.4, width * 0.42);
      flash.addColorStop(0, `rgba(255,255,255,${0.55 * paddle.flash})`);
      flash.addColorStop(0.5, `rgba(120,240,255,${0.25 * paddle.flash})`);
      flash.addColorStop(1, 'rgba(120,240,255,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(fx, y + height * 0.4, width * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawBalls(ctx, game) {
    const balls = game.balls;
    const showTrail = this.quality !== 'low';

    for (let i = 0; i < balls.length; i += 1) {
      const ball = balls[i];
      if (!ball.active) continue;

      if (showTrail && ball.trailCount > 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        const trail = ball.trail;
        for (let t = ball.trailCount - 1; t > 0; t -= 1) {
          const x1 = trail[t * 2];
          const y1 = trail[t * 2 + 1];
          const x2 = trail[(t - 1) * 2];
          const y2 = trail[(t - 1) * 2 + 1];
          ctx.strokeStyle = this.trailStops[t] || 'rgba(140,240,255,0.1)';
          ctx.lineWidth = Math.max(1.1, ball.radius * 1.45 * (1 - t / ball.trailCount));
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.restore();
      }

      const sprite = this.ballSprite;
      if (sprite) {
        ctx.drawImage(sprite.canvas, ball.x - sprite.size * 0.5, ball.y - sprite.size * 0.5, sprite.size, sprite.size);
      } else {
        ctx.fillStyle = '#eafcff';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (ball.pierce) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.6 + Math.sin(this.time * 14) * 0.4;
        ctx.globalAlpha = 0.5 * pulse;
        ctx.strokeStyle = '#ff9a3d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius * 2.1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      if (ball.stuck) {
        // aim hint while the ball waits on the paddle
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 + Math.sin(this.time * 4) * 0.15;
        ctx.strokeStyle = '#9fefff';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y - ball.radius - 6);
        ctx.lineTo(ball.x, ball.y - ball.radius - game.world.height * 0.16);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      }
    }
  }
}

