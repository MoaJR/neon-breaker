import { GAME_STATE, PALETTE, TIMINGS, TUNING, WORLD_WIDTH } from '../core/Config.js';
import { clamp, damp, rand } from '../core/MathUtils.js';
import { Ball } from '../entities/Ball.js';
import { Paddle } from '../entities/Paddle.js';
import { LevelManager } from '../levels/LevelManager.js';
import { PhysicsEngine } from '../physics/PhysicsEngine.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { PowerUpManager } from '../systems/PowerUpManager.js';
import { COINS, COMBO } from '../roguelite/RogueliteConfig.js';
import { CoinSystem } from '../roguelite/CoinSystem.js';
import { EffectRuntime } from '../roguelite/EffectRuntime.js';
import { BossManager } from '../roguelite/BossManager.js';

const BASE_HEIGHT = 750;

/** Owns the game state, the level flow and every gameplay rule. */
export class GameEngine {
  constructor({ renderer, ui, audio, storage, input }) {
    this.renderer = renderer;
    this.ui = ui;
    this.audio = audio;
    this.storage = storage;
    this.input = input;

    this.world = { width: WORLD_WIDTH, height: BASE_HEIGHT, playTop: 56, hudInset: 56 };

    this.level = new LevelManager();
    this.paddle = new Paddle();
    this.balls = [];
    for (let i = 0; i < TUNING.ball.max; i += 1) this.balls.push(new Ball());

    this.particles = new ParticleSystem();
    this.powerUpManager = new PowerUpManager(this);
    this.powerUps = this.powerUpManager.pool;
    this.physics = new PhysicsEngine(this);

    // ── roguelite integration (inert in classic mode)
    this.roguelite = null;
    this.mode = 'classic';
    this.run = null;
    this.room = null;
    this.build = null;
    this.roomModifierEffects = null;
    this.boss = null;
    this.bossHandled = false;
    this.coins = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.maxLives = TUNING.lives.max;
    this.survival = 0;
    this.buildSlow = false;
    this.gravity = 0;
    this.phoenixUsed = false;
    this.inflationTimer = 0;
    this.extraPaddles = [];
    this.coinSystem = new CoinSystem(this);
    this.effectRuntime = new EffectRuntime(this);

    this.state = GAME_STATE.MENU;
    this.previousState = null;
    this.score = 0;
    this.best = this.storage.getBest();
    this.lives = TUNING.lives.start;
    this.levelScore = 0;
    this.newRecord = false;

    this.accumulator = 0;
    this.readyTimer = 0;
    this.lifeTimer = 0;
    this.transitionTimer = 0;
    this.hudTimer = 0;
    this.time = 0;
    this.slowFactor = 1;
    this.speedScale = 1;
    this.targetSpeed = TUNING.ball.baseSpeed;
    this.quality = 'high';
    this.soundClock = Object.create(null);
    this.overlayShown = false;
    this.lastHeight = this.world.height;

    this.ui.updateScore(this.score, this.best);
    this.ui.updateLives(this.lives);
  }

  /* ───────────────────────────── setup / resize ───────────────────────────── */

  resize(cssWidth, cssHeight, dpr, hudInsetPx = 0) {
    if (!cssWidth || !cssHeight) return;
    const height = WORLD_WIDTH * (cssHeight / cssWidth);
    const previousHeight = this.lastHeight || height;

    this.world.height = height;
    this.world.hudInset = hudInsetPx * (WORLD_WIDTH / cssWidth);
    this.renderer.resize(cssWidth, cssHeight, dpr);

    if (this.level.blocks.length) {
      this.level.relayout(this.world);
      this.world.playTop = Math.max(this.world.hudInset * 0.8, this.level.geometry.originY - 34);
      this.renderer.prepare(this.level);
      const ratio = height / previousHeight;
      for (let i = 0; i < this.balls.length; i += 1) {
        const ball = this.balls[i];
        if (!ball.active) continue;
        ball.y *= ratio;
        ball.trailCount = 0;
      }
    } else {
      this.world.playTop = Math.max(this.world.hudInset * 0.8, 24);
    }

    this.lastHeight = height;
    this.paddle.setWorldBounds(this.world.width, this.world.height);
    if (this.state === GAME_STATE.MENU) this.paddle.centerAt(this.world.width * 0.5, this.world.width);
    this.refreshSpeed();
    this.syncStuckBalls();
  }

  refreshSpeed() {
    const heightFactor = clamp(this.world.height / BASE_HEIGHT, 1, 1.22);
    const buildSlowFactor = this.buildSlow ? 0.72 : 1;

    if (this.mode === 'run' && this.room) {
      const base = TUNING.ball.baseSpeed * (this.build?.ballSpeedMult ?? 1);
      this.speedScale = (this.room.speed ?? 1) * heightFactor;
      this.targetSpeed = base * this.speedScale * this.slowFactor * buildSlowFactor;
      return;
    }

    const level = this.level.current;
    this.speedScale = (level?.speed ?? 1) * heightFactor;
    this.targetSpeed =
      (TUNING.ball.baseSpeed + this.level.index * TUNING.ball.speedPerLevel) *
      this.speedScale *
      this.slowFactor;
  }

  /** Called by the roguelite controller whenever the compiled build changes. */
  setBuild(build) {
    this.build = build;
    if (this.mode === 'run') {
      this.applyBuildToPaddle();
      const max = this.run?.maxLives ?? TUNING.lives.max;
      this.maxLives = max;
      if (this.lives > max) {
        this.lives = max;
        this.ui.updateLives(this.lives);
        if (this.run) this.run.lives = this.lives;
      }
      this.refreshSpeed();
      for (let i = 0; i < this.balls.length; i += 1) {
        const ball = this.balls[i];
        if (ball.active) ball.setSpeed(this.targetSpeed);
      }
    }
  }

  applyBuildToPaddle() {
    const paddle = this.paddle;
    const width = TUNING.paddle.baseWidth * (this.build?.paddleWidthMult ?? 1);
    paddle.baseWidth = width;
    paddle.targetWidth = width;
    paddle.width = Math.min(width, this.world.width);
    paddle.height = TUNING.paddle.height * (1 + (this.build?.paddleHeightBonus ?? 0));
    paddle.applyWide(this.powerUpManager?.isActive('wide'));
    paddle.setWorldBounds(this.world.width, this.world.height);
  }

  setBuildSlow(active) {
    if (this.buildSlow === active) return;
    this.buildSlow = active;
    this.refreshSpeed();
    for (let i = 0; i < this.balls.length; i += 1) {
      const ball = this.balls[i];
      if (ball.active && !ball.stuck) ball.setSpeed(this.targetSpeed);
    }
  }

  getGravity() {
    return this.mode === 'run' ? this.gravity : 0;
  }

  shouldPierce(ball, block) {
    if (this.mode !== 'run') return false;
    return this.effectRuntime?.shouldPierce(ball, block) ?? false;
  }

  attachRoguelite(controller) {
    this.roguelite = controller;
  }

  /* ───────────────────────────── public actions ───────────────────────────── */

  startGame() {
    this.audio.init();
    this.mode = 'classic';
    this.run = null;
    this.room = null;
    this.build = null;
    this.roomModifierEffects = null;
    this.boss = null;
    this.bossHandled = false;
    this.coins = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.maxLives = TUNING.lives.max;
    this.survival = 0;
    this.buildSlow = false;
    this.gravity = 0;
    this.inflationTimer = 0;
    this.extraPaddles.length = 0;
    this.level.objective = 'clear';
    this.score = 0;
    this.lives = TUNING.lives.start;
    this.newRecord = false;
    this.levelScore = 0;
    this.ui.updateScore(this.score, this.best);
    this.ui.updateLives(this.lives);
    this.ui.updateCoins?.(0);
    this.ui.updateRunHud?.({ mode: 'classic' });
    this.ui.hideAllScreens();
    this.ui.hideLevelClear();
    this.audio.play('start');
    this.startLevel(0);
  }

  startLevel(index) {
    this.mode = 'classic';
    this.run = null;
    this.room = null;
    this.build = null;
    this.roomModifierEffects = null;
    this.boss = null;
    this.bossHandled = false;
    this.extraPaddles.length = 0;
    this.gravity = 0;
    this.coins = 0;
    if (this.roguelite) {
      this.roguelite.screen = 'none';
      this.roguelite.overlay?.close?.();
    }
    this.ui.updateRunHud?.({ mode: 'classic' });
    this.ui.hideBossBar?.();
    this.level.build(index, this.world);
    this.world.playTop = Math.max(this.world.hudInset * 0.8, this.level.geometry.originY - 34);
    this.renderer.prepare(this.level);
    this.renderer.setSectorAccent?.('#38dcff');
    this.refreshSpeed();

    this.levelScore = this.score;
    this.powerUpManager.reset();
    this.particles.clear();
    this.effectRuntime.resetRoom();
    this.coinSystem.reset();
    this.resetBalls();

    this.paddle.baseWidth = TUNING.paddle.baseWidth;
    this.paddle.targetWidth = TUNING.paddle.baseWidth;
    this.paddle.width = TUNING.paddle.baseWidth;
    this.paddle.height = TUNING.paddle.height;
    this.paddle.setWorldBounds(this.world.width, this.world.height);
    this.paddle.centerAt(this.world.width * 0.5, this.world.width);
    this.paddle.stun = 0;

    this.stickBall();
    this.readyTimer = TIMINGS.readyDelay;
    this.accumulator = 0;
    this.transitionTimer = 0;
    this.overlayShown = false;
    this.state = GAME_STATE.PLAYING;

    this.ui.setScreen(null);
    this.ui.updateLevel(index);
    this.ui.showLevelIntro(index, this.level.current.name);
    this.ui.showLaunchHint(true);
    this.syncStuckBalls();
  }

  /** Starts a roguelite room. The controller is responsible for run state. */
  startRoom(room) {
    this.mode = 'run';
    this.room = room;
    this.bossHandled = false;
    this.roomModifierEffects = room.modifierEffects ?? null;
    this.gravity = room.modifierEffects?.gravity ?? 0;
    this.inflationTimer = 0;

    this.level.buildDefinition(room, this.world);
    this.world.playTop = Math.max(this.world.hudInset * 0.8, this.level.geometry.originY - 34);
    this.renderer.prepare(this.level);
    this.renderer.setSectorAccent?.(room.accent);
    this.refreshSpeed();

    this.levelScore = this.score;
    this.powerUpManager.reset();
    this.particles.clear();
    this.effectRuntime.resetRoom();
    this.coinSystem.reset();
    this.resetBalls();
    this.extraPaddles.length = 0;
    this.paddle.stun = 0;
    this.boss = room.objective === 'boss' ? new BossManager(this, room) : null;
    this.applyBuildToPaddle();
    this.paddle.centerAt(this.world.width * 0.5, this.world.width);
    this.effectRuntime.startRoom();

    const startingBalls = 1 + (this.build?.extraBalls ?? 0);
    for (let i = 0; i < startingBalls; i += 1) {
      const offset = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * 26 * Math.ceil(i / 2);
      this.stickBall(offset);
    }

    this.readyTimer = TIMINGS.readyDelay + (room.objective === 'boss' ? 1.4 : 0);
    this.accumulator = 0;
    this.transitionTimer = 0;
    this.overlayShown = false;
    this.state = GAME_STATE.PLAYING;
    this.combo = 0;
    this.comboTimer = 0;

    this.ui.setScreen(null);
    this.ui.updateLevel(room.roomNumber ?? 1);
    this.ui.updateRunHud?.({
      mode: 'run',
      coins: this.coins,
      sector: room.sectorName,
      sectorIndex: room.sectorIndex,
      roomNumber: room.roomNumber,
      objective: room.objective,
    });
    this.ui.showLevelIntro((room.roomNumber ?? 1) - 1, room.name);
    this.ui.showLaunchHint(true);
    this.ui.updateShields?.(this.effectRuntime.shieldCharges);
    this.syncStuckBalls();
    this.updateComboHud();
  }

  /** Freeze the simulation while a roguelite overlay is open. */
  enterOverlay() {
    if (this.state === GAME_STATE.OVERLAY) return;
    this.previousState = this.state;
    this.state = GAME_STATE.OVERLAY;
    this.ui.showLaunchHint?.(false);
  }

  exitOverlay(nextState = null) {
    if (this.state !== GAME_STATE.OVERLAY) return;
    this.state = nextState ?? this.previousState ?? GAME_STATE.PLAYING;
    this.previousState = null;
    this.accumulator = 0;
  }

  clearField() {
    this.level.blocks.length = 0;
    this.level.grid.length = 0;
    this.level.breakableRemaining = 0;
    this.level.breakableTotal = 0;
    this.level.transients.length = 0;
    this.level.bossDefeated = false;
    this.level.objective = 'clear';
    this.renderer.prepare(this.level);
    this.boss = null;
    this.resetBalls();
    this.extraPaddles.length = 0;
    this.coinSystem.reset();
    this.effectRuntime.resetRoom();
    this.particles.clear();
    this.powerUpManager.reset();
  }

  restart() {
    this.startGame();
  }

  goMenu() {
    this.state = GAME_STATE.MENU;
    this.previousState = null;
    this.mode = 'classic';
    this.run = null;
    this.room = null;
    this.build = null;
    this.roomModifierEffects = null;
    this.boss = null;
    this.coins = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.buildSlow = false;
    this.gravity = 0;
    this.inflationTimer = 0;
    this.extraPaddles.length = 0;
    this.resetBalls();
    this.powerUpManager.reset();
    this.particles.clear();
    this.coinSystem.reset();
    this.effectRuntime.resetRoom();
    this.level.blocks.length = 0;
    this.level.grid.length = 0;
    this.level.breakableRemaining = 0;
    this.level.breakableTotal = 0;
    this.level.transients.length = 0;
    this.level.objective = 'clear';
    this.level.bossDefeated = false;
    this.renderer.prepare(this.level);
    this.renderer.setSectorAccent?.('#38dcff');
    this.paddle.baseWidth = TUNING.paddle.baseWidth;
    this.paddle.targetWidth = TUNING.paddle.baseWidth;
    this.paddle.width = TUNING.paddle.baseWidth;
    this.paddle.height = TUNING.paddle.height;
    this.paddle.setWorldBounds(this.world.width, this.world.height);
    this.paddle.centerAt(this.world.width * 0.5, this.world.width);
    this.ui.hideLevelIntro();
    this.ui.hideLevelClear();
    this.ui.showLaunchHint(false);
    this.ui.updateScore(this.score, this.best);
    this.ui.updateCoins?.(0);
    this.ui.updateRunHud?.({ mode: 'classic' });
    this.ui.updateCombo?.(0, 0);
    this.ui.updateShields?.(0);
    this.ui.hideBossBar?.();
    this.ui.setScreen('menu');
  }

  handlePrimaryAction() {
    this.audio.init();
    if (this.state === GAME_STATE.OVERLAY) return;
    switch (this.state) {
      case GAME_STATE.MENU:
        if (this.roguelite?.startRun) this.roguelite.startRun();
        else this.startGame();
        break;
      case GAME_STATE.PLAYING:
        if (this.hasStuckBalls()) this.launchBalls();
        break;
      case GAME_STATE.PAUSED:
        this.resume();
        break;
      case GAME_STATE.GAME_OVER:
      case GAME_STATE.VICTORY:
        this.startGame();
        break;
      default:
        break;
    }
  }

  togglePause() {
    if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.LIFE_LOST) {
      this.previousState = this.state;
      this.state = GAME_STATE.PAUSED;
      this.ui.setScreen('pause');
      this.audio.play('ui');
    } else if (this.state === GAME_STATE.PAUSED) {
      this.resume();
    }
  }

  resume() {
    if (this.state !== GAME_STATE.PAUSED) return;
    this.state = this.previousState || GAME_STATE.PLAYING;
    this.previousState = null;
    this.accumulator = 0;
    this.ui.setScreen(null);
    this.audio.play('ui');
  }


  /* ───────────────────────────── main loop ───────────────────────────── */

  frame(dt) {
    this.update(dt);
    this.render();
  }

  render() {
    this.renderer.draw(this);
  }

  update(dt) {
    const delta = Math.min(Math.max(dt, 0), TUNING.maxFrameDelta);
    this.time += delta;
    this.renderer.update(delta);

    switch (this.state) {
      case GAME_STATE.PLAYING:
        this.updatePlaying(delta);
        break;
      case GAME_STATE.LIFE_LOST:
        this.updateLifeLost(delta);
        break;
      case GAME_STATE.LEVEL_CLEAR:
        this.updateLevelClear(delta);
        break;
      case GAME_STATE.GAME_OVER:
        this.updateGameOver(delta);
        break;
      case GAME_STATE.VICTORY:
        this.particles.update(delta);
        break;
      case GAME_STATE.OVERLAY:
        this.level.update(delta);
        this.particles.update(delta);
        break;
      case GAME_STATE.MENU:
        this.updateMenu(delta);
        break;
      default:
        // PAUSED — simulation fully frozen
        break;
    }
  }

  updateMenu(dt) {
    this.paddle.update(dt, this.world.width);
    this.particles.update(dt);
    this.updateHud(dt);
  }

  updatePlaying(dt) {
    if (this.mode === 'run') this.survival += dt;

    this.updatePaddle(dt);
    this.syncStuckBalls();
    this.updateMagnet(dt);

    if (this.readyTimer > 0) {
      this.readyTimer = Math.max(0, this.readyTimer - dt);
      if (this.readyTimer === 0 && this.hasStuckBalls()) this.launchBalls();
    }

    this.accumulator += dt;
    const step = TUNING.fixedStep;
    let steps = 0;
    while (this.accumulator >= step && steps < TUNING.maxSteps) {
      this.physics.step(step);
      this.accumulator -= step;
      steps += 1;
    }
    if (steps === TUNING.maxSteps) this.accumulator = 0;

    for (let i = 0; i < this.balls.length; i += 1) {
      const ball = this.balls[i];
      if (ball.active && !ball.stuck) ball.pushTrail();
    }

    this.level.update(dt);
    this.powerUpManager.update(dt);
    this.coinSystem.update(dt);
    this.effectRuntime.update(dt);
    this.boss?.update(dt);
    this.updateRoomModifiers(dt);
    this.particles.update(dt);
    this.updateCombo(dt);
    this.updateHud(dt);

    if (!this.hasActiveBalls()) {
      this.handleAllBallsLost();
      return;
    }

    if (this.level.cleared) this.handleRoomCleared();
  }

  updateMagnet(dt) {
    let released = false;
    for (let i = 0; i < this.balls.length; i += 1) {
      const ball = this.balls[i];
      if (!ball.active || !ball.stuck || ball.magnetTimer <= 0) continue;
      ball.magnetTimer -= dt;
      if (ball.magnetTimer <= 0) released = true;
    }
    if (released) this.launchBalls();
  }

  /** Room-wide modifiers that evolve during play (currently INFLATION). */
  updateRoomModifiers(dt) {
    if (!this.roomModifierEffects?.inflation) return;
    this.inflationTimer += dt;
    if (this.inflationTimer < 30) return;
    this.inflationTimer -= 30;
    let grown = 0;
    for (const block of this.level.blocks) {
      if (!block.alive || block.indestructible || block.inflationStacks >= 2) continue;
      block.hp += 1;
      block.maxHp += 1;
      block.inflationStacks += 1;
      grown += 1;
    }
    if (grown > 0) {
      this.ui.toast?.('INFLATION: BLOCOS MAIS RESISTENTES', '#a86bff');
      this.particles.ring(this.world.width * 0.5, this.level.geometry.originY + 120, '#a86bff', 60, 0.7, 3);
    }
  }

  updateLifeLost(dt) {
    this.particles.update(dt);
    this.level.update(dt);
    this.updateHud(dt);
    this.lifeTimer -= dt;
    if (this.lifeTimer <= 0) this.respawn();
  }

  updateLevelClear(dt) {
    this.particles.update(dt);
    this.level.update(dt);
    this.updateHud(dt);
    this.transitionTimer -= dt;
    if (this.transitionTimer > 0) return;

    this.ui.hideLevelClear();
    if (this.mode === 'run') {
      if (this.overlayShown) return;
      this.overlayShown = true;
      this.roguelite?.onRoomClearFinished?.(this);
      return;
    }

    if (this.level.isLast) {
      this.handleVictory();
    } else {
      this.startLevel(this.level.index + 1);
    }
  }

  updateGameOver(dt) {
    this.particles.update(dt);
    this.level.update(dt);
    this.transitionTimer -= dt;
    if (this.transitionTimer > 0 || this.overlayShown) return;
    this.overlayShown = true;
    this.saveBest();
    this.audio.play('gameover');
    this.ui.showGameOver({ score: this.score, best: this.best, record: this.newRecord });
  }

  updateHud(dt) {
    this.hudTimer += dt;
    if (this.hudTimer < 0.08) return;
    this.hudTimer = 0;
    this.ui.updateScore(this.score, this.best);
    this.ui.updateEffects(this.powerUpManager.getEffectChips());
    if (this.mode === 'run') {
      this.ui.updateCoins?.(this.coins);
      this.ui.updateCombo?.(this.combo, this.bestCombo);
      this.ui.updateShields?.(this.effectRuntime.shieldCharges);
    }
  }

  toggleSound() {
    const enabled = !this.audio.enabled;
    this.audio.setEnabled(enabled);
    this.storage.setSettings({ ...this.storage.getSettings(), sound: enabled });
    this.ui.setSoundState(enabled);
    if (enabled) this.audio.play('ui');
  }

  setQuality(effects) {
    this.quality = effects ? 'high' : 'low';
    this.particles.setQuality(effects ? 1 : 0.35);
    this.renderer.setQuality(this.quality);
    this.storage.setSettings({ ...this.storage.getSettings(), effects });
    this.ui.setEffectsState(effects);
  }


  /* ───────────────────────────── paddle & balls ───────────────────────────── */

  updatePaddle(dt) {
    const paddle = this.paddle;
    const axis = this.input ? this.input.axis() : 0;
    const stunned = paddle.stun > 0;

    if (!stunned) {
      if (axis !== 0) {
        paddle.x = clamp(paddle.x + axis * TUNING.paddle.keyboardSpeed * dt, 0, this.world.width - paddle.width);
      } else if (this.input && this.input.usingPointer) {
        const targetX = clamp(this.input.pointerTarget - paddle.width * 0.5, 0, this.world.width - paddle.width);
        paddle.x = damp(paddle.x, targetX, TUNING.paddle.follow, dt);
      }
    }

    paddle.update(dt, this.world.width);
  }

  hasActiveBalls() {
    for (let i = 0; i < this.balls.length; i += 1) {
      if (this.balls[i].active) return true;
    }
    return false;
  }

  hasStuckBalls() {
    for (let i = 0; i < this.balls.length; i += 1) {
      const ball = this.balls[i];
      if (ball.active && ball.stuck) return true;
    }
    return false;
  }

  freeBall() {
    for (let i = 0; i < this.balls.length; i += 1) {
      if (!this.balls[i].active) return this.balls[i];
    }
    return null;
  }

  resetBalls() {
    for (let i = 0; i < this.balls.length; i += 1) this.balls[i].reset();
  }

  stickBall(offset = 0) {
    const ball = this.freeBall();
    if (!ball) return null;
    ball.reset();
    ball.active = true;
    ball.stuck = true;
    ball.stuckOffset = offset;
    ball.pierce = this.powerUpManager.isActive('fire');
    ball.speed = this.targetSpeed;
    ball.x = this.paddle.centerX + offset;
    ball.y = this.paddle.y - ball.radius - 0.5;
    return ball;
  }

  syncStuckBalls() {
    for (let i = 0; i < this.balls.length; i += 1) {
      const ball = this.balls[i];
      if (!ball.active || !ball.stuck) continue;
      ball.x = clamp(this.paddle.centerX + ball.stuckOffset, ball.radius, this.world.width - ball.radius);
      ball.y = this.paddle.y - ball.radius - 0.5;
    }
  }

  launchBalls() {
    let launched = false;
    for (let i = 0; i < this.balls.length; i += 1) {
      const ball = this.balls[i];
      if (!ball.active || !ball.stuck) continue;
      ball.launch(-Math.PI * 0.5 + rand(-0.3, 0.3), this.targetSpeed);
      launched = true;
    }
    if (launched) {
      this.audio.play('launch');
      this.ui.showLaunchHint(false);
    }
    return launched;
  }

  spawnExtraBalls(count) {
    let source = null;
    for (let i = 0; i < this.balls.length; i += 1) {
      const ball = this.balls[i];
      if (ball.active && !ball.stuck) {
        source = ball;
        break;
      }
    }
    if (!source) {
      for (let i = 0; i < this.balls.length; i += 1) {
        if (this.balls[i].active) {
          source = this.balls[i];
          break;
        }
      }
    }
    if (!source) return;

    let baseAngle = Math.atan2(source.vy, source.vx);
    if (!Number.isFinite(baseAngle) || source.vy > -0.05) baseAngle = -Math.PI * 0.5;
    const speed = source.speed || this.targetSpeed;

    let spawned = 0;
    for (let i = 0; i < this.balls.length && spawned < count; i += 1) {
      const ball = this.balls[i];
      if (ball.active) continue;
      const spread = (spawned + 1) * 0.38 * (spawned % 2 === 0 ? 1 : -1);
      ball.reset();
      ball.active = true;
      ball.place(source.x, source.y);
      ball.pierce = this.powerUpManager.isActive('fire');
      ball.launch(baseAngle + spread, speed);
      spawned += 1;
    }
  }

  respawn() {
    this.powerUpManager.clearEffects();
    this.stickBall();
    this.readyTimer = TIMINGS.readyDelay;
    this.state = GAME_STATE.PLAYING;
    this.ui.showLaunchHint(true);
    this.syncStuckBalls();
  }


  handleAllBallsLost() {
    if (this.mode === 'run') {
      const outcome = this.effectRuntime.onAllBallsLost();
      if (outcome === 'recover') {
        this.recoverBall();
        return;
      }
      if (outcome === 'split') {
        this.stickBall(0);
        this.stickBall(30);
        this.readyTimer = 0.7;
        this.state = GAME_STATE.PLAYING;
        this.ui.showLaunchHint(true);
        this.syncStuckBalls();
        this.renderer.addFlash('#a86bff', 0.16);
        return;
      }
      if (this.maybePhoenix()) return;
    }

    this.lives = Math.max(0, this.lives - 1);
    this.ui.updateLives(this.lives);
    this.powerUpManager.clearEffects();
    this.ui.showLaunchHint(false);
    this.audio.play('lose');
    this.renderer.addShake(8);
    this.renderer.addFlash('#ff2f8d', 0.18);
    this.combo = 0;
    this.comboTimer = 0;
    this.updateComboHud();

    for (let i = 0; i < 3; i += 1) {
      this.particles.burst(
        rand(this.world.width * 0.35, this.world.width * 0.65),
        this.world.height - rand(10, 40),
        '#ff4a8d',
        7,
        { speedMin: 80, speedMax: 320, lifeMin: 0.3, lifeMax: 0.8, sizeMin: 1.2, sizeMax: 3.2, gravity: 340 },
      );
    }

    if (this.mode === 'run') {
      this.syncRunLive();
      if (this.lives <= 0) {
        this.state = GAME_STATE.OVERLAY;
        this.roguelite?.onRunLost?.(this);
        return;
      }
    }

    if (this.lives <= 0) {
      this.state = GAME_STATE.GAME_OVER;
      this.transitionTimer = TIMINGS.gameOverDelay;
      this.overlayShown = false;
    } else {
      this.state = GAME_STATE.LIFE_LOST;
      this.lifeTimer = TIMINGS.lifeLostDelay;
    }
  }

  recoverBall() {
    this.stickBall(0);
    this.readyTimer = 0.85;
    this.state = GAME_STATE.PLAYING;
    this.ui.showLaunchHint(true);
    this.syncStuckBalls();
    this.coinSystem.update(0);
  }

  maybePhoenix() {
    if (this.mode !== 'run' || this.phoenixUsed) return false;
    if (!((this.build?.revive ?? 0) > 0)) return false;
    if (this.lives > 1) return false;
    this.phoenixUsed = true;
    this.lives = Math.min(this.run?.maxLives ?? TUNING.lives.max, 2);
    if (this.run) this.run.lives = this.lives;
    this.ui.updateLives(this.lives);
    this.ui.toast?.('PHOENIX — RENASCIDO', '#ffd24a');
    this.audio.play('life');
    this.renderer.addFlash('#ffd24a', 0.3);
    this.renderer.addShake(7);
    this.particles.ring(this.world.width * 0.5, this.world.height * 0.5, '#ffd24a', 90, 1.1, 4);
    this.recoverBall();
    return true;
  }

  syncRunLive() {
    if (!this.run) return;
    this.run.score = Math.max(0, Math.floor(this.score));
    this.run.coins = Math.max(0, Math.floor(this.coins));
    this.run.lives = Math.max(0, Math.floor(this.lives));
    this.run.combo = this.combo;
    this.run.bestCombo = this.bestCombo;
    this.run.survivalTime = this.survival;
  }

  handleRoomCleared() {
    if (this.mode === 'run' && this.room) {
      const sectorIndex = this.room.sectorIndex ?? 0;
      const scoreBonus =
        TUNING.score.levelClearBase +
        (this.room.roomNumber ?? 1) * TUNING.score.levelClearPerLevel +
        this.lives * TUNING.score.levelClearPerLife;
      const coinBonus =
        COINS.roomClear +
        sectorIndex * COINS.roomClearPerSector +
        (this.room.elite ? COINS.eliteBonus : 0) +
        (this.room.objective === 'boss' ? COINS.bossBonus : 0);
      const levelScore = Math.max(0, this.score - this.levelScore);

      this.addScore(scoreBonus);
      this.coinSystem.collectAll();
      this.addCoins(coinBonus, this.paddle.centerX, this.paddle.y - 40, true);
      this.syncRunLive();
      this.ui.showLevelClear(coinBonus, levelScore);
      this.ui.showLaunchHint(false);
      this.audio.play(this.room.objective === 'boss' ? 'record' : 'levelclear');
      this.renderer.addFlash(this.room.objective === 'boss' ? '#ffd24a' : '#43f59b', 0.2);
      this.renderer.addShake(this.room.objective === 'boss' ? 9 : 6);
      this.spawnClearParticles();
      this.state = GAME_STATE.LEVEL_CLEAR;
      this.transitionTimer = this.room.objective === 'boss' ? 2 : 1.2;
      return;
    }

    const bonus =
      TUNING.score.levelClearBase +
      this.level.index * TUNING.score.levelClearPerLevel +
      this.lives * TUNING.score.levelClearPerLife;
    const levelScore = Math.max(0, this.score - this.levelScore);

    this.addScore(bonus);
    this.ui.showLevelClear(bonus, levelScore);
    this.ui.showLaunchHint(false);
    this.audio.play('levelclear');
    this.renderer.addFlash('#43f59b', 0.2);
    this.renderer.addShake(6);
    this.spawnClearParticles();

    this.state = GAME_STATE.LEVEL_CLEAR;
    this.transitionTimer = TIMINGS.levelClearDelay;
  }

  // Backwards-compatible alias (old name used by the classic flow/tests).
  handleLevelCleared() {
    this.handleRoomCleared();
  }

  spawnClearParticles() {
    for (let i = 0; i < 6; i += 1) {
      const block = this.level.blocks[(Math.random() * this.level.blocks.length) | 0];
      const color = block ? PALETTE[block.colorIndex].core : '#43f59b';
      this.particles.burst(
        rand(this.world.width * 0.15, this.world.width * 0.85),
        rand(this.level.geometry.originY, this.level.geometry.originY + this.world.height * 0.25),
        color,
        10,
        { speedMin: 60, speedMax: 280, lifeMin: 0.4, lifeMax: 1.1, sizeMin: 1.4, sizeMax: 3.4, gravity: 280 },
      );
    }
  }

  handleVictory() {
    this.state = GAME_STATE.VICTORY;
    this.saveBest();
    this.audio.play('record');
    this.renderer.addFlash('#ffe14d', 0.24);
    this.ui.showVictory({ score: this.score, best: this.best, record: this.newRecord });
  }

  /* ───────────────────────────── gameplay hooks ───────────────────────────── */

  addScore(points) {
    this.score += points;
    if (this.score > this.best) {
      this.best = this.score;
      this.newRecord = true;
    }
  }

  saveBest() {
    const stored = this.storage.getBest();
    if (this.best > stored) this.storage.setBest(this.best);
  }

  sfx(name, minIntervalMs = 0, options) {
    if (minIntervalMs > 0) {
      const now = performance.now();
      if (now - (this.soundClock[name] || 0) < minIntervalMs) return;
      this.soundClock[name] = now;
    }
    this.audio.play(name, options);
  }

  onPaddleHit(ball, contactX) {
    this.paddle.hit(contactX);
    this.sfx('paddle', 35);
    this.particles.burst(contactX, this.paddle.y + 2, '#7de9ff', 8, {
      speedMin: 60,
      speedMax: 240,
      lifeMin: 0.14,
      lifeMax: 0.42,
      sizeMin: 1,
      sizeMax: 2.6,
      gravity: 140,
      angle: -Math.PI * 0.5,
      spread: Math.PI * 0.9,
    });
    this.renderer.addShake(1.6);
    if (this.mode === 'run') this.effectRuntime.onPaddleHit(ball);
  }

  onWallHit(ball) {
    this.sfx('wall', 45);
    this.particles.burst(ball.x, ball.y, '#8fe8ff', 3, {
      speedMin: 30,
      speedMax: 120,
      lifeMin: 0.1,
      lifeMax: 0.3,
      sizeMin: 0.8,
      sizeMax: 1.8,
      gravity: 0,
    });
    this.renderer.addShake(0.7);
  }

  onBallLost(ball) {
    this.particles.burst(ball.x, ball.y, '#9fefff', 6, {
      speedMin: 40,
      speedMax: 160,
      lifeMin: 0.2,
      lifeMax: 0.5,
      sizeMin: 1,
      sizeMax: 2.4,
      gravity: 120,
    });
  }


  damageBlock(block, ball) {
    if (!block || !block.alive) return;
    if (this.mode === 'run') {
      this.effectRuntime.onBallHitBlock(block, ball ?? { x: block.centerX, y: block.centerY });
      return;
    }
    this.applyBlockDamage(block, 1, { source: 'ball', ball });
  }

  /**
   * Single damage entry point used by the ball, explosions, chains, burns,
   * lasers, orbitals and boss collisions. Keeps scoring/visuals/effects in one
   * place and returns true when the block was destroyed.
   */
  applyBlockDamage(block, amount = 1, options = {}) {
    if (!block || !block.alive) return false;

    if (block.indestructible) {
      block.hitFlash = 1;
      this.sfx('steel', 30);
      this.particles.burst(block.centerX, block.centerY, '#dfeaff', 4, {
        speedMin: 60,
        speedMax: 200,
        lifeMin: 0.12,
        lifeMax: 0.32,
        sizeMin: 0.8,
        sizeMax: 2,
        gravity: 60,
      });
      this.renderer.addShake(1.2);
      return false;
    }

    if (block.shielded || (this.boss && this.boss.blocksDamage(block))) {
      block.hitFlash = 1;
      this.sfx('steel', 40);
      this.particles.ring(block.centerX, block.centerY, '#38dcff', 16, 0.3, 2);
      return false;
    }

    const damage = Math.max(1, Math.round(amount));
    const color = PALETTE[block.colorIndex].core;
    const destroyed = block.damage(damage);
    this.run?.recordDamage?.(damage);
    this.boss?.onBossBlockDamaged?.(block, damage, destroyed);

    if (!destroyed) {
      this.sfx('block', 16, { colorIndex: block.colorIndex });
      this.particles.burst(block.centerX, block.centerY, color, options.crit ? 8 : 5, {
        speedMin: 50,
        speedMax: 190,
        lifeMin: 0.14,
        lifeMax: 0.38,
        sizeMin: 1,
        sizeMax: 2.4,
        gravity: 180,
      });
      this.renderer.addShake(1);
      return false;
    }

    this.level.grid[block.row * this.level.cols + block.col] = null;
    this.level.onBlockDestroyed(block);

    const comboMult = 1 + Math.min(this.combo, COMBO.maxSteps) * COMBO.bonusPerStep * (1 + (this.build?.comboBonus ?? 0));
    const scoreMult = this.build?.scoreMult ?? 1;
    const value = block.value * scoreMult * (options.crit ? 2 : 1) * (this.mode === 'run' ? comboMult : 1);
    this.addScore(Math.max(1, Math.round(value)));
    if (this.mode === 'run') this.registerCombo();

    this.dropCoins(block);

    this.particles.burst(block.centerX, block.centerY, color, 11, {
      speedMin: 70,
      speedMax: 300,
      lifeMin: 0.22,
      lifeMax: 0.62,
      sizeMin: 1,
      sizeMax: 2.8,
      gravity: 220,
    });
    this.particles.shards(block.centerX, block.centerY, color, 7);
    this.particles.ring(block.centerX, block.centerY, color, Math.max(block.width, block.height) * 0.45, 0.38, 2.4);

    this.renderer.addShake(2);
    this.sfx('shatter', 22, { colorIndex: block.colorIndex });

    if (block.bossRole !== 'barrier') {
      const dropped = this.powerUpManager.spawn(block.centerX, block.centerY, block.guaranteedDrop);
      if (dropped) {
        this.particles.ring(block.centerX, block.centerY, dropped.color, 14, 0.5, 2);
      }
    }

    if (this.mode === 'run') this.effectRuntime.onBlockDestroyed(block, options);
    return true;
  }

  dropCoins(block) {
    if (!(block.baseValue > 0)) return;
    if (Math.random() > COINS.dropChance) return;
    const range = COINS.amounts[block.kind] ?? COINS.amounts.normal;
    const amount = Math.floor(rand(range[0], range[1] + 1));
    if (amount <= 0) return;
    this.coinSystem.spawn(block.centerX, block.centerY, amount);
  }

  registerCombo() {
    if (this.mode !== 'run') return;
    this.combo += 1;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    this.comboTimer = COMBO.window + (this.build?.comboWindowBonus ?? 0);
    if (this.run) {
      this.run.combo = this.combo;
      this.run.bestCombo = this.bestCombo;
    }
    this.updateComboHud();
  }

  updateCombo(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer === 0 && this.combo > 0) {
        this.combo = 0;
        this.updateComboHud();
      }
    }
  }

  updateComboHud() {
    this.ui.updateCombo?.(this.combo, this.bestCombo);
  }

  catchBall(ball) {
    if (!ball || !ball.active || ball.stuck) return;
    ball.stuck = true;
    ball.vx = 0;
    ball.vy = 0;
    ball.magnetTimer = 2.6;
    ball.stuckOffset = clamp(ball.x - this.paddle.centerX, -this.paddle.width * 0.4, this.paddle.width * 0.4);
    this.syncStuckBalls();
    this.ui.showLaunchHint(true);
    this.ui.toast?.('MAGNETIC HOLD', '#38dcff');
  }

  addCoins(amount, x = null, y = null, silent = false) {
    if (!amount) return this.coins;
    const multiplier = amount > 0 ? this.build?.coinMult ?? 1 : 1;
    const value = Math.round(amount * multiplier);
    this.coins = Math.max(0, this.coins + value);
    if (this.run) {
      if (value > 0) this.run.stats.coinsEarned += value;
      this.run.coins = this.coins;
    }
    this.ui.updateCoins?.(this.coins);
    if (!silent && value > 0) {
      const px = x ?? this.world.width * 0.5;
      const py = y ?? this.world.height * 0.5;
      this.particles.dot(px, py, '#ffd24a', 3.5, 0.5, 0, -60);
      this.sfx('coin', 55);
    }
    return this.coins;
  }

  spendCoins(amount) {
    const cost = Math.max(0, Math.floor(amount));
    if (this.coins < cost) return false;
    this.coins -= cost;
    if (this.run) this.run.coins = this.coins;
    this.ui.updateCoins?.(this.coins);
    return true;
  }

  onBossProjectileHit(shot) {
    const build = this.build ?? {};
    if (this.effectRuntime.shieldCharges > 0) {
      this.effectRuntime.shieldCharges -= 1;
      this.ui.updateShields?.(this.effectRuntime.shieldCharges);
      this.ui.toast?.('ESCUDO ABSORVEU O IMPACTO', '#43f59b');
      this.paddle.stun = Math.max(this.paddle.stun, 0.3);
      this.renderer.addFlash('#43f59b', 0.16);
      this.audio.play('life');
      return;
    }
    const resist = build.stunResist ?? 0;
    this.paddle.stun = Math.max(this.paddle.stun, Math.max(0.25, 1.1 * (1 - resist)));
    this.renderer.addFlash('#ff2f8d', 0.2);
    this.renderer.addShake(6);
    this.audio.play('lose');
    this.lives = Math.max(0, this.lives - 1);
    this.ui.updateLives(this.lives);
    this.ui.toast?.('IMPACTO DE CHEFE — −1 VIDA', '#ff4a55');
    this.syncRunLive();
    if (this.lives <= 0) {
      if (this.maybePhoenix()) return;
      this.state = GAME_STATE.OVERLAY;
      this.roguelite?.onRunLost?.(this);
    }
  }

  onBossDefeated() {
    this.ui.bossDefeat?.(this.boss?.view?.());
    this.ui.toast?.('CHEFE DESTRUÍDO', '#ffd24a');
  }

  onPowerUpCaught(type, x, y) {
    this.addScore(TUNING.powerUp.catchScore);
    this.powerUpManager.apply(type);
    this.ui.toast(type.label, type.color);
    this.audio.play(type.id === 'life' ? 'life' : 'powerup');

    this.particles.burst(x, y, type.color, 14, {
      speedMin: 90,
      speedMax: 320,
      lifeMin: 0.25,
      lifeMax: 0.7,
      sizeMin: 1.2,
      sizeMax: 3,
      gravity: 160,
    });
    this.particles.ring(x, y, type.color, 18, 0.5, 3);
    this.renderer.addFlash(type.color, 0.1);
    this.renderer.addShake(2.4);
  }

  applySlow(active) {
    this.slowFactor = active ? TUNING.ball.slowFactor : 1;
    this.refreshSpeed();
    for (let i = 0; i < this.balls.length; i += 1) {
      const ball = this.balls[i];
      if (ball.active) ball.setSpeed(this.targetSpeed);
    }
  }

  applyPierce(active) {
    for (let i = 0; i < this.balls.length; i += 1) {
      const ball = this.balls[i];
      if (ball.active) ball.pierce = active;
    }
  }

  addLife() {
    const cap = this.mode === 'run' ? this.run?.maxLives ?? TUNING.lives.max : TUNING.lives.max;
    this.lives = Math.min(cap, this.lives + 1);
    if (this.run) this.run.lives = this.lives;
    this.ui.updateLives(this.lives);
  }

  /** Used by the run controller for start-of-run / event life changes. */
  setLives(value, { maxLives = null } = {}) {
    if (maxLives !== null) this.run.maxLives = Math.max(1, Math.min(TUNING.lives.max, maxLives));
    const cap = this.mode === 'run' ? this.run?.maxLives ?? TUNING.lives.max : TUNING.lives.max;
    this.lives = Math.max(0, Math.min(cap, Math.floor(value)));
    if (this.run) this.run.lives = this.lives;
    this.ui.updateLives(this.lives);
    return this.lives;
  }

  setCoins(value) {
    this.coins = Math.max(0, Math.floor(value));
    if (this.run) this.run.coins = this.coins;
    this.ui.updateCoins?.(this.coins);
    return this.coins;
  }

  /** Snapshot used by the debug API and the automated tests. */
  getSnapshot() {
    let blocksAlive = 0;
    for (let i = 0; i < this.level.blocks.length; i += 1) {
      if (this.level.blocks[i].alive) blocksAlive += 1;
    }
    let ballsActive = 0;
    let ballSpeed = 0;
    for (let i = 0; i < this.balls.length; i += 1) {
      const ball = this.balls[i];
      if (ball.active) {
        ballsActive += 1;
        if (!ballSpeed) ballSpeed = Math.round(ball.speed);
      }
    }

    return {
      state: this.state,
      mode: this.mode,
      score: this.score,
      best: this.best,
      lives: this.lives,
      maxLives: this.mode === 'run' ? this.run?.maxLives ?? this.maxLives : this.maxLives,
      coins: this.coins,
      combo: this.combo,
      bestCombo: this.bestCombo,
      level: this.level.index,
      levelName: this.level.current?.name ?? '',
      totalLevels: this.level.count,
      blocksAlive,
      breakableRemaining: this.level.breakableRemaining,
      ballsActive,
      ballSpeed,
      paddleWidth: Math.round(this.paddle.width),
      paddleX: Math.round(this.paddle.x),
      paddleStun: this.paddle.stun,
      effects: { ...this.powerUpManager.effects },
      shields: this.effectRuntime.shieldCharges,
      world: {
        width: this.world.width,
        height: Math.round(this.world.height),
        playTop: Math.round(this.world.playTop),
      },
      newRecord: this.newRecord,
      room: this.room
        ? {
            id: this.room.id,
            type: this.room.type,
            name: this.room.name,
            sector: this.room.sectorId,
            sectorIndex: this.room.sectorIndex,
            floor: this.room.floor,
            objective: this.room.objective,
            modifiers: [...(this.room.modifiers ?? [])],
          }
        : null,
      run: this.run
        ? {
            id: this.run.id,
            seed: this.run.seed,
            platformId: this.run.platformId,
            sectorIndex: this.run.sectorIndex,
            roomNumber: this.run.roomNumber,
            roomsCleared: this.run.roomsCleared,
            bossesDefeated: this.run.bossesDefeated,
            coins: this.run.coins,
            bestCombo: this.run.bestCombo,
            survivalTime: this.run.survivalTime,
            upgrades: { ...this.run.upgrades },
            relics: [...this.run.relics],
            synergies: [...this.run.synergies],
            modifiersNextRoom: [...this.run.modifiersNextRoom],
          }
        : null,
      boss: this.boss ? this.boss.view() : null,
      upgrades: this.run ? { ...this.run.upgrades } : {},
      relics: this.run ? [...this.run.relics] : [],
      synergies: this.run ? [...this.run.synergies] : [],
      roguelite: this.roguelite?.view?.() ?? null,
    };
  }
}

