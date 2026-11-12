import { bossById } from './BossLibrary.js';
import { TAU } from '../core/MathUtils.js';

class BossShot {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = 9;
    this.phase = 0;
  }

  init(x, y, vx, vy, radius) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.phase = 0;
  }
}

/**
 * Boss encounter runtime: HP/phases, projectiles at the paddle, temporary
 * barriers, shield windows, moving formations and layered cores.
 * All bosses reuse the level grid, so the original collision system is intact.
 */
export class BossManager {
  constructor(game, room) {
    this.game = game;
    this.room = room;
    this.def = room.bossDef ?? bossById(room.bossId ?? 'guardian');
    this.maxHp = this.def.hp;
    this.hp = this.def.hp;
    this.active = true;
    this.defeated = false;
    this.phase = 1;
    this.shieldTime = 0;
    this.gravityPulse = 0;
    this.moveTime = 0;
    this.originShift = 0;
    this.timers = {
      shot: (this.def.projectile?.interval ?? 4) * 0.65,
      barrier: (this.def.barrier?.interval ?? 8) * 0.75,
      shield: this.def.shield?.interval ?? 0,
      rebuild: this.def.rebuild?.interval ?? 0,
      gravity: this.def.gravityPulse?.interval ?? 0,
      phaseFlash: 0,
    };
    this.shots = [];
    for (let i = 0; i < 24; i += 1) this.shots.push(new BossShot());
    this.coreBlocks = [];
    this.weakBlocks = [];
    this.armorBlocks = [];
    this.barriers = [];
    this.classifyBlocks();
    this.applyLayerShields();
    this.emitIntro();
  }

  classifyBlocks() {
    this.coreBlocks.length = 0;
    this.weakBlocks.length = 0;
    this.armorBlocks.length = 0;
    for (const block of this.game.level.blocks) {
      if (block.bossRole === 'core') this.coreBlocks.push(block);
      else if (block.bossRole === 'weak') this.weakBlocks.push(block);
      else if (block.bossRole === 'armor') this.armorBlocks.push(block);
    }
  }

  /** The CORE boss keeps its core shielded until the armor rings are gone. */
  applyLayerShields() {
    if (!(this.def.layers > 0)) return;
    const aliveArmor = this.armorBlocks.filter((block) => block.alive).length;
    const shielded = aliveArmor > 0;
    for (const block of this.coreBlocks) block.shielded = shielded;
  }

  emitIntro() {
    this.game.ui?.showBossBar?.(this.view());
    this.game.ui?.bossIntro?.(this.view());
    this.game.audio?.play?.('boss');
  }

  get hpRatio() {
    return Math.max(0, this.hp / this.maxHp);
  }

  isShielded() {
    return this.shieldTime > 0;
  }

  update(dt) {
    if (!this.active) return;
    const build = this.game.build ?? {};
    const frost = 1 + (build.frostLevel ?? 0);
    const speedUp = 1 + (this.phase - 1) * 0.18;

    this.updateMovement(dt);
    this.updateShield(dt);
    this.updateGravity(dt);
    this.updateShots(dt);

    if (this.game.readyTimer <= 0) {
      this.timers.shot -= dt;
      if (this.timers.shot <= 0) {
        this.timers.shot = ((this.def.projectile?.interval ?? 4) / speedUp) * frost;
        this.fireVolley();
      }
    }

    if (this.def.barrier) {
      this.timers.barrier -= dt;
      if (this.timers.barrier <= 0) {
        this.timers.barrier = (this.def.barrier.interval ?? 8) * frost;
        this.spawnBarriers(2);
      }
    }

    if (this.def.rebuild) {
      this.timers.rebuild -= dt;
      if (this.timers.rebuild <= 0) {
        this.timers.rebuild = this.def.rebuild.interval ?? 10;
        this.spawnBarriers(1);
      }
    }

    if (this.timers.phaseFlash > 0) this.timers.phaseFlash = Math.max(0, this.timers.phaseFlash - dt);
    this.game.ui?.updateBossBar?.(this.view());
  }

  updateMovement(dt) {
    if (!this.def.move) return;
    this.moveTime += dt * (this.def.move.speed ?? 0.8) * (1 + (this.phase - 1) * 0.25);
    const range = Math.min(58, this.def.move.range ?? 60);
    const shift = Math.sin(this.moveTime) * range;
    if (Math.abs(shift - this.originShift) > 0.5) {
      this.originShift = shift;
      this.game.level?.setOriginShift(shift, this.game.world);
    }
  }

  updateShield(dt) {
    if (this.shieldTime > 0) {
      this.shieldTime = Math.max(0, this.shieldTime - dt);
      return;
    }
    if (!this.def.shield) return;
    this.timers.shield -= dt;
    if (this.timers.shield <= 0) {
      this.timers.shield = this.def.shield.interval ?? 12;
      this.shieldTime = this.def.shield.duration ?? 3;
      this.game.ui?.toast?.('ESCUDO DE CHEFE', '#38dcff');
      this.game.renderer?.addFlash('#38dcff', 0.12);
    }
  }

  updateGravity(dt) {
    if (!this.def.gravityPulse) return;
    this.timers.gravity -= dt;
    if (this.timers.gravity <= 0) {
      this.timers.gravity = this.def.gravityPulse.interval ?? 11;
      this.gravityPulse = 1.2;
      this.game.ui?.toast?.('PULSO GRAVITACIONAL', '#a86bff');
    }
    if (this.gravityPulse <= 0) return;
    this.gravityPulse -= dt;
    for (const ball of this.game.balls) {
      if (!ball.active || ball.stuck) continue;
      ball.vy += 240 * dt;
      ball.setSpeed(ball.speed);
    }
  }

  updateShots(dt) {
    const world = this.game.world;
    const paddle = this.game.paddle;
    for (const shot of this.shots) {
      if (!shot.active) continue;
      shot.phase += dt;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (shot.y > world.height + 30 || shot.x < -30 || shot.x > world.width + 30) {
        shot.active = false;
        continue;
      }
      if (
        paddle &&
        shot.x + shot.radius > paddle.x &&
        shot.x - shot.radius < paddle.x + paddle.width &&
        shot.y + shot.radius > paddle.y &&
        shot.y - shot.radius < paddle.y + paddle.height + 6
      ) {
        shot.active = false;
        this.game.particles?.burst(shot.x, shot.y, this.def.colors.shot ?? '#ff4a55', 12, {
          speedMin: 60,
          speedMax: 260,
          lifeMin: 0.2,
          lifeMax: 0.55,
          sizeMin: 1.2,
          sizeMax: 3,
          gravity: 160,
        });
        this.game.onBossProjectileHit?.(shot);
      }
    }
  }

  fireVolley() {
    const count = this.phase >= 3 ? 3 : this.phase >= 2 ? 2 : 1;
    const paddle = this.game.paddle;
    const anchor = this.anchorPoint();
    const baseAngle = Math.atan2(paddle.y - anchor.y, paddle.centerX - anchor.x);
    for (let i = 0; i < count; i += 1) {
      const spread = (i - (count - 1) / 2) * (this.def.projectile?.spread ?? 0.9) * 0.5;
      const shot = this.shots.find((item) => !item.active);
      if (!shot) break;
      const speed = (this.def.projectile?.speed ?? 260) * (1 + (this.phase - 1) * 0.08);
      shot.init(
        anchor.x,
        anchor.y,
        Math.cos(baseAngle + spread) * speed,
        Math.sin(baseAngle + spread) * speed,
        this.def.projectile?.radius ?? 9,
      );
    }
    this.game.sfx?.('bossShot', 120);
  }

  anchorPoint() {
    const alive = this.coreBlocks.filter((block) => block.alive);
    const block = alive[Math.floor(Math.random() * alive.length)] ?? this.weakBlocks.find((item) => item.alive);
    if (block) return { x: block.centerX, y: block.centerY };
    return { x: this.game.world.width * 0.5, y: this.game.level.geometry.originY };
  }

  spawnBarriers(count = 2) {
    const level = this.game.level;
    if (!level) return;
    const row = this.room.bossRow ?? level.rows - 1;
    let spawned = 0;
    let attempts = 0;
    while (spawned < count && attempts < 18 && this.barriers.length < 6) {
      attempts += 1;
      const col = Math.floor(Math.random() * level.cols);
      if (level.blockAt(col, row)) continue;
      const hp = this.def.barrier?.hp ?? 2;
      const block = level.addTransientBlock(col, row, {
        kind: 'hard',
        hp,
        value: 25,
        bossRole: 'barrier',
      });
      if (!block) continue;
      this.barriers.push(block);
      spawned += 1;
      this.game.particles?.ring(block.centerX, block.centerY, '#ff8c2b', 14, 0.4, 2);
    }
  }

  /** Engine asks before applying damage: shield windows cancel it. */
  blocksDamage(block) {
    if (block?.bossRole === 'barrier') return false;
    return this.shieldTime > 0 || Boolean(block?.shielded);
  }

  /** Returns the HP actually removed (weak points take double). */
  onBossBlockDamaged(block, damage, destroyed) {
    if (this.defeated || !block) return 0;
    if (block.bossRole === 'barrier') return 0;
    if (this.shieldTime > 0) return 0;
    let amount = Math.max(0, damage);
    if (block.bossRole === 'weak') amount *= 2;
    this.hp = Math.max(0, this.hp - amount);
    this.updatePhase();
    if (destroyed) this.applyLayerShields();
    if (this.hp <= 0 || this.coreBlocks.every((item) => !item.alive)) this.defeat();
    return amount;
  }

  updatePhase() {
    const ratio = this.hpRatio;
    let phase = 1;
    for (const threshold of this.def.phases ?? []) {
      if (ratio <= threshold) phase += 1;
    }
    if (phase !== this.phase) {
      this.phase = phase;
      this.timers.phaseFlash = 1;
      this.game.ui?.toast?.(`FASE ${phase}`, this.def.colors.core ?? '#38dcff');
      this.game.renderer?.addFlash(this.def.colors.core ?? '#38dcff', 0.15);
      this.game.audio?.play?.('bossPhase');
    }
  }

  defeat() {
    if (this.defeated) return;
    this.defeated = true;
    this.active = false;
    this.shieldTime = 0;
    for (const shot of this.shots) shot.active = false;
    const level = this.game.level;
    for (const barrier of this.barriers) level?.removeTransient?.(barrier);
    this.barriers.length = 0;
    if (level) {
      level.bossDefeated = true;
      for (const block of level.blocks) {
        if (!block.alive || !block.bossRole) continue;
        block.alive = false;
        block.dying = 1;
        level.grid[block.row * level.cols + block.col] = null;
      }
    }
    for (let i = 0; i < 24; i += 1) {
      this.game.particles?.burst(
        120 + Math.random() * (this.game.world.width - 240),
        level ? level.geometry.originY + Math.random() * 260 : 200,
        i % 3 === 0 ? '#ffffff' : this.def.colors.core ?? '#38dcff',
        6,
        { speedMin: 40, speedMax: 280, lifeMin: 0.3, lifeMax: 0.9, sizeMin: 1.2, sizeMax: 3.2, gravity: 180 },
      );
    }
    this.game.renderer?.addFlash('#ffffff', 0.3);
    this.game.renderer?.addShake(10);
    this.game.audio?.play?.('bossDefeat');
    this.game.ui?.hideBossBar?.();
    this.game.onBossDefeated?.();
  }

  view() {
    return {
      name: this.def.name,
      subtitle: this.def.subtitle,
      hp: Math.ceil(this.hp),
      maxHp: this.maxHp,
      ratio: this.hpRatio,
      phase: this.phase,
      phases: (this.def.phases?.length ?? 0) + 1,
      shield: this.shieldTime,
      active: this.active,
      color: this.def.colors.core ?? '#38dcff',
      weakColor: this.def.colors.weak ?? '#ff2f8d',
    };
  }

  draw(ctx) {
    if (!this.active && !this.defeated) return;
    for (const shot of this.shots) {
      if (!shot.active) continue;
      const color = this.def.colors.shot ?? '#ff4a55';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.7 + Math.sin(shot.phase * 10) * 0.3;
      ctx.globalAlpha = 0.9 * pulse;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, shot.radius, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.3 * pulse;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, shot.radius * 1.8, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (this.shieldTime > 0) {
      const alive = this.coreBlocks.filter((block) => block.alive);
      if (alive.length) {
        const cx = alive.reduce((sum, block) => sum + block.centerX, 0) / alive.length;
        const cy = alive.reduce((sum, block) => sum + block.centerY, 0) / alive.length;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45 + Math.sin((this.game.renderer?.time ?? 0) * 6) * 0.15;
        ctx.strokeStyle = '#38dcff';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(cx, cy, 118, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}
