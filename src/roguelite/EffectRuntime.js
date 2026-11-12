import { clamp, TAU } from '../core/MathUtils.js';
import { PaddleClone } from '../entities/PaddleClone.js';

const MAX_DEPTH = 3;
const MAGNET_HOLD = 2.6;

/**
 * Event-driven runtime for every upgrade / relic / synergy effect.
 * GameEngine calls the event methods; effects call back into engine primitives
 * (`applyBlockDamage`, `spawnExtraBalls`, …). Timed modules are cleared between
 * rooms so nothing leaks or stacks incorrectly.
 */
export class EffectRuntime {
  constructor(game) {
    this.game = game;
    this.burns = new Map();
    this.lasers = [];
    this.arcs = [];
    this.fields = [];
    this.rifts = [];
    this.clone = new PaddleClone();
    this.shieldCharges = 0;
    this.timers = {};
    this.gravityTarget = null;
    this.gravityTime = 0;
    this.slowActive = false;
    this.vampireCount = 0;
    this.orbitalAngle = 0;
    this.resetRoom();
  }

  resetRoom() {
    for (const id of Object.keys(this.timers)) this.timers[id] = 0;
    this.burns.clear();
    this.lasers.length = 0;
    this.arcs.length = 0;
    this.fields.length = 0;
    this.rifts.length = 0;
    this.gravityTarget = null;
    this.gravityTime = 0;
    this.vampireCount = 0;
    this.orbitalAngle = 0;
    this.clone.active = false;
    if (this.game.extraPaddles) {
      const index = this.game.extraPaddles.indexOf(this.clone);
      if (index >= 0) this.game.extraPaddles.splice(index, 1);
    }
    this.setSlow(false);
  }

  /** Re-apply per-room resources (shields) and reset periodic timers. */
  startRoom() {
    const build = this.game.build ?? {};
    this.resetRoom();
    this.shieldCharges = Math.floor(build.shieldCharges ?? 0);
    this.timers.laser = build.laserLevel > 0 ? build.laserInterval ?? 4.5 : 0;
    this.timers.blackHole = build.blackHoleLevel > 0 ? build.blackHoleInterval ?? 16 : 0;
    this.timers.void = build.voidLevel > 0 ? build.voidInterval ?? 12 : 0;
    this.timers.gravity = build.gravityLevel > 0 ? build.gravityInterval ?? 10 : 0;
    this.timers.slow = build.slowInterval ?? 0;
    this.timers.clone = build.cloneLevel > 0 ? 3 : 0;
    this.timers.orbitalHit = 0.35;
    this.timers.orbitalFire = 4;
  }

  setSlow(active) {
    if (this.slowActive === active) return;
    this.slowActive = active;
    this.game.setBuildSlow?.(active);
  }

  /* ───────────────────────────── update ───────────────────────────── */

  update(dt) {
    const game = this.game;
    const build = game.build ?? {};
    if (game.mode !== 'run' || !game.level || game.state !== 'playing') return;

    this.updateBurns(dt);
    this.updateLasers(dt, build);
    this.updateOrbitals(dt, build);
    this.updateBlackHoles(dt, build);
    this.updateVoid(dt, build);
    this.updateGravity(dt, build);
    this.updateClone(dt, build);
    this.updateSlow(dt, build);
    this.updateVisuals(dt);
  }

  updateBurns(dt) {
    if (this.burns.size === 0) return;
    for (const [block, burn] of this.burns) {
      if (!block.alive) {
        this.burns.delete(block);
        continue;
      }
      burn.time -= dt;
      burn.tick -= dt;
      if (burn.tick <= 0) {
        burn.tick += Math.max(0.25, 1 / Math.max(0.4, burn.dps));
        this.game.applyBlockDamage(block, 1, { source: 'burn' });
        if (!block.alive) {
          this.burns.delete(block);
          continue;
        }
        this.game.particles?.burst(block.centerX, block.y + block.height * 0.8, '#ff8c2b', 2, {
          speedMin: 10,
          speedMax: 70,
          lifeMin: 0.15,
          lifeMax: 0.4,
          sizeMin: 1,
          sizeMax: 2.2,
          gravity: -60,
        });
      }
      if (burn.time <= 0) this.burns.delete(block);
    }
  }

  updateLasers(dt, build) {
    if (!(build.laserLevel > 0)) return;
    this.timers.laser -= dt;
    if (this.timers.laser > 0) return;
    const rate = build.laserRate ? 1 + build.laserRate : 1;
    this.timers.laser = Math.max(0.45, (build.laserInterval ?? 4.5) / rate);
    this.fireLaser(build);
  }

  updateOrbitals(dt, build) {
    if (!(build.orbitalCount > 0)) return;
    this.orbitalAngle += dt * 1.9;
    this.timers.orbitalHit -= dt;
    if (this.timers.orbitalHit > 0) return;
    const rate = 0.55 / (1 + (build.orbitalRate ?? 0) + (build.orbitalFire ? 0.6 : 0));
    this.timers.orbitalHit = rate;
    const positions = this.orbitalPositions(build);
    let budget = 2 + (build.orbitalFire ? 1 : 0);
    for (const point of positions) {
      if (budget <= 0) break;
      const target = this.findNearestBlock(point.x, point.y, 520);
      if (!target) continue;
      budget -= 1;
      this.arcs.push({ x1: point.x, y1: point.y, x2: target.centerX, y2: target.centerY, life: 0.22, color: '#a86bff' });
      this.game.applyBlockDamage(target, build.orbitalDamage ?? 1, { source: 'orbital' });
      this.game.particles?.ring(point.x, point.y, '#a86bff', 8, 0.22, 1.4);
    }
  }

  updateBlackHoles(dt, build) {
    if (!(build.blackHoleLevel > 0)) return;
    this.timers.blackHole -= dt;
    if (this.timers.blackHole <= 0) {
      this.timers.blackHole = build.blackHoleInterval ?? 16;
      const anchor = this.findDenseBlock();
      if (anchor) {
        this.fields.push({
          x: anchor.centerX,
          y: anchor.centerY,
          radius: build.blackHoleRadius ?? 100,
          life: 3,
          maxLife: 3,
          tick: 0,
          damage: build.blackHoleDamage ?? 1,
        });
        this.game.renderer?.addFlash('#a86bff', 0.08);
      }
    }
    for (const field of this.fields) {
      field.life -= dt;
      field.tick -= dt;
      if (field.tick <= 0) {
        field.tick = 0.4;
        for (const block of this.game.level.blocks) {
          if (!block.alive) continue;
          if (this.distanceToPoint(block, field.x, field.y) > field.radius) continue;
          this.game.applyBlockDamage(block, field.damage, { source: 'blackhole' });
        }
      }
    }
    if (build.voidPull && this.fields.length) {
      for (const ball of this.game.balls) {
        if (!ball.active || ball.stuck) continue;
        const field = this.fields[0];
        const dx = field.x - ball.x;
        const dy = field.y - ball.y;
        const distance = Math.hypot(dx, dy) || 1;
        ball.vx += (dx / distance) * 260 * dt;
        ball.vy += (dy / distance) * 260 * dt;
        ball.clampSpeed(clamp(ball.speed, 260, 900));
      }
    }
    this.fields = this.fields.filter((field) => field.life > 0);
  }

  updateVoid(dt, build) {
    if (!(build.voidLevel > 0)) return;
    this.timers.void -= dt;
    if (this.timers.void > 0) return;
    this.timers.void = build.voidInterval ?? 12;
    const ball = this.game.balls.find((item) => item.active && !item.stuck);
    if (!ball) return;
    const target = this.findSafeTeleport();
    if (!target) return;
    this.game.particles?.ring(ball.x, ball.y, '#a86bff', 18, 0.4, 2.4);
    ball.x = target.x;
    ball.y = target.y;
    ball.trailCount = 0;
    ball.guardAngle();
    this.game.particles?.ring(ball.x, ball.y, '#38dcff', 18, 0.4, 2.4);
    if (build.voidLevel >= 3) {
      this.rifts.push({ x: target.x, y: target.y, life: 2.2, tick: 0 });
    }
  }

  updateGravity(dt, build) {
    if (!(build.gravityLevel > 0)) return;
    this.timers.gravity -= dt;
    if (this.timers.gravity <= 0) {
      this.timers.gravity = build.gravityInterval ?? 10;
      const anchor = this.findDenseBlock();
      if (anchor) {
        this.gravityTarget = { x: anchor.centerX, y: anchor.centerY };
        this.gravityTime = build.gravityDuration ?? 1.2;
      }
    }
    if (this.gravityTime > 0 && this.gravityTarget) {
      this.gravityTime -= dt;
      const target = this.gravityTarget;
      for (const ball of this.game.balls) {
        if (!ball.active || ball.stuck) continue;
        const dx = target.x - ball.x;
        const dy = target.y - ball.y;
        const distance = Math.hypot(dx, dy) || 1;
        const pull = 520;
        ball.vx += (dx / distance) * pull * dt;
        ball.vy += (dy / distance) * pull * dt;
        ball.setSpeed(clamp(ball.speed, 260, 900));
      }
      if (this.gravityTime <= 0) this.gravityTarget = null;
    }
  }

  updateClone(dt, build) {
    if (!(build.cloneLevel > 0)) return;
    if (this.clone.active) {
      this.clone.update(dt);
      const paddle = this.game.paddle;
      this.clone.x = clamp(
        this.game.world.width - paddle.centerX - this.clone.width * 0.5,
        0,
        this.game.world.width - this.clone.width,
      );
      this.clone.y = paddle.y;
      if (!this.clone.active) {
        this.timers.clone = build.cloneCooldown ?? 18;
        if (this.game.extraPaddles) {
          const index = this.game.extraPaddles.indexOf(this.clone);
          if (index >= 0) this.game.extraPaddles.splice(index, 1);
        }
      }
      return;
    }
    this.timers.clone -= dt;
    if (this.timers.clone > 0) return;
    const paddle = this.game.paddle;
    const width = paddle.width * 0.72;
    const x = clamp(this.game.world.width - paddle.centerX - width * 0.5, 0, this.game.world.width - width);
    this.clone.spawn(x, paddle.y, width, build.cloneDuration ?? 6);
    this.game.extraPaddles?.push(this.clone);
    this.game.particles?.ring(this.clone.centerX, paddle.y + 8, '#a86bff', 20, 0.4, 2.4);
  }

  updateSlow(dt, build) {
    if (!(build.slowInterval > 0)) return;
    if (this.slowActive) {
      this.timers.slowActive = (this.timers.slowActive ?? build.slowDuration ?? 1.6) - dt;
      if (this.timers.slowActive <= 0) {
        this.setSlow(false);
        this.timers.slow = build.slowInterval;
      }
      return;
    }
    this.timers.slow -= dt;
    if (this.timers.slow <= 0) {
      this.timers.slowActive = build.slowDuration ?? 1.6;
      this.setSlow(true);
      this.game.ui?.toast?.('SLOW MOTION', '#43f59b');
    }
  }

  updateVisuals(dt) {
    for (const laser of this.lasers) laser.life -= dt;
    for (const arc of this.arcs) arc.life -= dt;
    this.lasers = this.lasers.filter((item) => item.life > 0);
    this.arcs = this.arcs.filter((item) => item.life > 0);
    for (const rift of this.rifts) {
      rift.life -= dt;
      rift.tick -= dt;
      if (rift.tick <= 0) {
        rift.tick = 0.5;
        const block = this.findBlockNear(rift.x, rift.y, 52);
        if (block) this.game.applyBlockDamage(block, 1, { source: 'void' });
      }
    }
    this.rifts = this.rifts.filter((item) => item.life > 0);
  }

  /* ───────────────────────────── events ───────────────────────────── */

  onBallHitBlock(block, ball) {
    if (!block?.alive) return;
    const build = this.game.build ?? {};
    const crit = Math.random() < (build.critChance ?? 0);
    const damage = Math.max(0.5, (build.damageMult ?? 1) * (crit ? build.critMult ?? 2 : 1));
    this.game.applyBlockDamage(block, damage, { source: 'ball', ball, crit });

    if (block.alive && build.fireLevel > 0) this.applyBurn(block, build);
    if ((build.electricTargets ?? 0) > 0) this.arc(block, build);
    if (crit) {
      this.game.renderer?.addFlash('#ffe14d', 0.05);
      this.game.particles?.burst(block.centerX, block.centerY, '#ffe14d', 4, {
        speedMin: 40,
        speedMax: 200,
        lifeMin: 0.12,
        lifeMax: 0.35,
        sizeMin: 1,
        sizeMax: 2.4,
        gravity: 0,
      });
    }
  }

  onBlockDestroyed(block, options = {}) {
    const build = this.game.build ?? {};
    const depth = options.depth ?? 0;
    this.game.run?.recordBlocks?.(1);

    if (build.fireNova && options.source !== 'fire') this.fireNova(block, build);
    if ((build.fireSpread ?? 0) > 0 && Math.random() < build.fireSpread) this.spreadFire(block, build);

    if ((build.explosionLevel ?? 0) > 0 && depth < MAX_DEPTH) {
      this.explode(block.centerX, block.centerY, build.explosionRadius ?? 70, build.explosionDamage ?? 1, depth + 1, 'explosion');
    }
    if (build.critExplosion && options.crit && depth < MAX_DEPTH) {
      this.explode(block.centerX, block.centerY, 78, 1, depth + 1, 'explosion');
    }
    if ((build.chainLevel ?? 0) > 0 && Math.random() < (build.chainChance ?? 0)) {
      this.chainFrom(block, build, depth + 1);
    }
    if (build.vampireLevel > 0) this.tickVampire(build);
    if ((build.salvageLevel ?? 0) > 0 && (block.kind === 'armored' || block.kind === 'hard')) {
      this.game.addCoins(build.salvageLevel, block.centerX, block.centerY, true);
    }
  }

  explode(x, y, radius, damage, depth, source) {
    if (!this.game.level) return;
    this.game.particles?.ring(x, y, '#ff8c2b', radius * 0.5, 0.36, 2.2);
    this.game.renderer?.addShake(1.4);
    let hits = 0;
    for (const block of this.game.level.blocks) {
      if (!block.alive || hits >= 14) continue;
      if (this.distanceToPoint(block, x, y) > radius) continue;
      hits += 1;
      this.game.applyBlockDamage(block, damage, { source, depth });
    }
  }

  chainFrom(block, build, depth) {
    if (depth > MAX_DEPTH) return;
    const targets = this.findNearestBlocks(block.centerX, block.centerY, build.chainRadius ?? 70, block, 1 + (build.chainLevel ?? 1));
    for (const target of targets) {
      if (!target.alive) continue;
      this.arcs.push({ x1: block.centerX, y1: block.centerY, x2: target.centerX, y2: target.centerY, life: 0.2, color: '#38dcff' });
      this.game.applyBlockDamage(target, 1, { source: 'chain', depth });
    }
  }

  applyBurn(block, build) {
    if (!block.alive || block.indestructible) return;
    this.burns.set(block, {
      time: 2.5,
      dps: build.burnDps ?? 0.8,
      tick: 0.45,
    });
  }

  spreadFire(block, build) {
    const targets = this.findNearestBlocks(block.centerX, block.centerY, 100, block, 2);
    for (const target of targets) this.applyBurn(target, build);
  }

  fireNova(block, build) {
    this.game.particles?.ring(block.centerX, block.centerY, '#ff8c2b', 46, 0.5, 3);
    const targets = this.findNearestBlocks(block.centerX, block.centerY, 110, block, 6);
    for (const target of targets) this.applyBurn(target, build);
  }

  arc(origin, build) {
    const targets = this.findNearestBlocks(origin.centerX, origin.centerY, build.electricRange ?? 180, origin, build.electricTargets ?? 1);
    for (const target of targets) {
      if (!target.alive) continue;
      let damage = build.electricDamage ?? 1;
      let crit = false;
      if (build.electricCrit && Math.random() < (build.critChance ?? 0)) {
        damage *= build.critMult ?? 2;
        crit = true;
        this.game.run?.recordCrit?.();
      }
      this.arcs.push({ x1: origin.centerX, y1: origin.centerY, x2: target.centerX, y2: target.centerY, life: 0.18, color: '#38dcff' });
      this.game.applyBlockDamage(target, damage, { source: 'electric', crit });
    }
  }

  tickVampire(build) {
    this.vampireCount += 1;
    const threshold = [0, 35, 28, 22][build.vampireLevel] ?? 35;
    const chance = [0, 0.35, 0.45, 0.55][build.vampireLevel] ?? 0.35;
    if (this.vampireCount < threshold) return;
    this.vampireCount = 0;
    if (Math.random() < chance) {
      this.game.addLife();
      this.game.ui?.toast?.('VAMPIRE BALL: +1 VIDA', '#ff2f8d');
    }
  }

  shouldPierce(ball, block) {
    if (ball.pierce) return true;
    if (block?.indestructible) return false;
    return Math.random() < (this.game.build?.pierceChance ?? 0);
  }

  onPaddleHit(ball) {
    const build = this.game.build ?? {};
    if (build.magneticChance > 0 && !ball.stuck && Math.random() < build.magneticChance) {
      this.game.catchBall?.(ball);
    }
    if (this.game.roomModifierEffects?.chaos) {
      const angle = Math.atan2(ball.vy, ball.vx) + (Math.random() - 0.5) * 0.24;
      ball.vx = Math.cos(angle) * ball.speed;
      ball.vy = Math.sin(angle) * ball.speed;
      ball.guardAngle();
    }
  }

  onAllBallsLost() {
    const build = this.game.build ?? {};
    if (this.shieldCharges > 0) {
      this.shieldCharges -= 1;
      this.game.ui?.updateShields?.(this.shieldCharges);
      if (this.game.run?.stats) this.game.run.stats.shieldsUsed += 1;
      this.game.renderer?.addFlash('#43f59b', 0.2);
      this.game.renderer?.addShake(4);
      this.game.audio?.play('life');
      this.game.ui?.toast?.('ESCUDO ABSORVEU A PERDA', '#43f59b');
      return 'recover';
    }
    if (build.secondChance > 0 && Math.random() < build.secondChance) {
      this.game.ui?.toast?.('SECOND CHANCE', '#43f59b');
      this.game.renderer?.addFlash('#43f59b', 0.12);
      return 'recover';
    }
    if (build.quantumChance > 0 && Math.random() < build.quantumChance) {
      this.game.ui?.toast?.('QUANTUM SPLIT', '#a86bff');
      return 'split';
    }
    return 'life';
  }

  /* ───────────────────────────── helpers ───────────────────────────── */

  fireLaser(build) {
    const paddle = this.game.paddle;
    const offsets = build.laserBarrage ? [-paddle.width * 0.32, paddle.width * 0.32] : [0];
    let fired = false;
    for (const offset of offsets) {
      const x = clamp(paddle.centerX + offset, 8, this.game.world.width - 8);
      const block = this.findBlockInColumn(x);
      const endY = block ? block.y + block.height : this.game.world.playTop;
      this.lasers.push({ x, y1: paddle.y, y2: endY, life: 0.14, color: '#38dcff' });
      if (block) {
        this.game.applyBlockDamage(block, build.laserDamage ?? 1, { source: 'laser' });
        fired = true;
      }
    }
    if (fired) this.game.sfx?.('laser', 60);
  }

  findBlockInColumn(x) {
    const level = this.game.level;
    if (!level?.geometry) return null;
    const { originX, cellW, gap } = level.geometry;
    const col = Math.floor((x - originX) / (cellW + gap));
    if (col < 0 || col >= level.cols) return null;
    for (let row = level.rows - 1; row >= 0; row -= 1) {
      const block = level.grid[row * level.cols + col];
      if (block?.alive) return block;
    }
    return null;
  }

  orbitalPositions(build) {
    const paddle = this.game.paddle;
    const count = Math.max(0, build.orbitalCount ?? 0);
    const points = [];
    const radius = 56 + Math.sin(this.orbitalAngle * 0.6) * 8;
    for (let i = 0; i < count; i += 1) {
      const angle = this.orbitalAngle + (i / count) * TAU;
      points.push({
        x: paddle.centerX + Math.cos(angle) * radius,
        y: paddle.y - 16 + Math.sin(angle) * 14,
      });
    }
    return points;
  }

  findBlockNear(x, y, radius) {
    const level = this.game.level;
    if (!level) return null;
    let best = null;
    let bestDistance = radius;
    for (const block of level.blocks) {
      if (!block.alive) continue;
      const distance = Math.hypot(block.centerX - x, block.centerY - y);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = block;
      }
    }
    return best;
  }

  findNearestBlock(x, y, maxDistance) {
    return this.findNearestBlocks(x, y, maxDistance, null, 1)[0] ?? null;
  }

  findNearestBlocks(x, y, maxDistance, exclude, count) {
    const level = this.game.level;
    if (!level) return [];
    const found = [];
    for (const block of level.blocks) {
      if (!block.alive || block === exclude) continue;
      const distance = Math.hypot(block.centerX - x, block.centerY - y);
      if (distance > maxDistance) continue;
      found.push({ block, distance });
    }
    found.sort((a, b) => a.distance - b.distance);
    return found.slice(0, Math.max(1, count)).map((entry) => entry.block);
  }

  findDenseBlock() {
    const level = this.game.level;
    if (!level) return null;
    let best = null;
    let bestScore = -1;
    for (const block of level.blocks) {
      if (!block.alive) continue;
      let score = 0;
      for (const other of level.blocks) {
        if (!other.alive) continue;
        if (this.distanceToPoint(other, block.centerX, block.centerY) < 130) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = block;
      }
    }
    return best;
  }

  distanceToPoint(block, x, y) {
    return Math.hypot(block.centerX - x, block.centerY - y);
  }

  findSafeTeleport() {
    const world = this.game.world;
    const level = this.game.level;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const x = 60 + Math.random() * (world.width - 120);
      const y = world.playTop + 90 + Math.random() * (world.height * 0.36);
      let blocked = false;
      for (const block of level.blocks) {
        if (!block.alive) continue;
        if (
          x > block.x - 18 &&
          x < block.x + block.width + 18 &&
          y > block.y - 18 &&
          y < block.y + block.height + 18
        ) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return { x, y };
    }
    return null;
  }

  /* ───────────────────────────── render ───────────────────────────── */

  draw(ctx) {
    const time = this.game.renderer?.time ?? 0;
    ctx.save();

    if (this.gravityTarget && this.gravityTime > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#38dcff';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 10]);
      for (const ball of this.game.balls) {
        if (!ball.active) continue;
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(this.gravityTarget.x, this.gravityTarget.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    if (this.fields.length) {
      for (const field of this.fields) {
        const progress = 1 - field.life / field.maxLife;
        const radius = field.radius * (0.5 + progress * 0.7);
        ctx.globalCompositeOperation = 'lighter';
        const gradient = ctx.createRadialGradient(field.x, field.y, 1, field.x, field.y, radius);
        gradient.addColorStop(0, 'rgba(168,107,255,0.85)');
        gradient.addColorStop(0.35, 'rgba(56,220,255,0.22)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(field.x, field.y, radius, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#d8c2ff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(field.x, field.y, radius * 0.55, time * 2, time * 2 + Math.PI * 1.3);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    }

    if (this.rifts.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const rift of this.rifts) {
        const alpha = Math.min(1, rift.life / 2.2);
        ctx.globalAlpha = 0.5 * alpha;
        ctx.strokeStyle = '#a86bff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rift.x, rift.y, 16 + Math.sin(time * 8) * 4, 0, TAU);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    if (this.lasers.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const laser of this.lasers) {
        const alpha = Math.max(0, laser.life / 0.14);
        ctx.globalAlpha = alpha;
        const gradient = ctx.createLinearGradient(laser.x, laser.y1, laser.x, laser.y2);
        gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
        gradient.addColorStop(0.5, 'rgba(56,220,255,0.8)');
        gradient.addColorStop(1, 'rgba(56,220,255,0.05)');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(laser.x, laser.y1);
        ctx.lineTo(laser.x, laser.y2);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.5;
        ctx.lineWidth = 8;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    if (this.arcs.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const arc of this.arcs) {
        const alpha = Math.max(0, arc.life / 0.2);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = arc.color ?? '#38dcff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const steps = 5;
        for (let i = 0; i <= steps; i += 1) {
          const t = i / steps;
          const jitter = i === 0 || i === steps ? 0 : (Math.random() - 0.5) * 10 * alpha;
          const x = arc.x1 + (arc.x2 - arc.x1) * t + jitter;
          const y = arc.y1 + (arc.y2 - arc.y1) * t - jitter * 0.5;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    if ((this.game.build?.orbitalCount ?? 0) > 0) {
      const points = this.orbitalPositions(this.game.build);
      ctx.globalCompositeOperation = 'lighter';
      for (const point of points) {
        const pulse = 0.7 + Math.sin(time * 6) * 0.3;
        ctx.globalAlpha = 0.8 * pulse;
        ctx.fillStyle = '#d8c2ff';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.25 * pulse;
        ctx.strokeStyle = '#a86bff';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 9, 0, TAU);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    if (this.burns.size) {
      ctx.globalCompositeOperation = 'lighter';
      for (const block of this.burns.keys()) {
        if (!block.alive) continue;
        const flicker = 0.5 + Math.sin(time * 18 + block.col) * 0.5;
        ctx.globalAlpha = 0.5 * flicker;
        ctx.fillStyle = '#ff8c2b';
        ctx.beginPath();
        ctx.arc(block.centerX, block.y + block.height * 0.55, 5 + flicker * 3, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}
