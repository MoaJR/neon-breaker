import { POWER_UP_LIST, TUNING } from '../core/Config.js';
import { PowerUp } from '../entities/PowerUp.js';

/** Owns falling capsules and the timed power-up effects. */
export class PowerUpManager {
  constructor(game) {
    this.game = game;
    this.pool = [];
    for (let i = 0; i < 8; i += 1) this.pool.push(new PowerUp());
    this.effects = { wide: 0, slow: 0, fire: 0 };
    this.durations = { wide: 14, slow: 9, fire: 8 };
    this.roll = 0;
  }

  reset() {
    for (let i = 0; i < this.pool.length; i += 1) {
      this.pool[i].active = false;
      this.pool[i].type = null;
    }
    this.clearEffects();
  }

  clearEffects() {
    if (this.effects.wide > 0) this.game.paddle.applyWide(false);
    if (this.effects.slow > 0) this.game.applySlow(false);
    if (this.effects.fire > 0) this.game.applyPierce(false);
    this.effects.wide = 0;
    this.effects.slow = 0;
    this.effects.fire = 0;
  }

  get activeCapsules() {
    let count = 0;
    for (let i = 0; i < this.pool.length; i += 1) {
      const powerUp = this.pool[i];
      if (powerUp.active && powerUp.type) count += 1;
    }
    return count;
  }

  pickType() {
    let total = 0;
    for (let i = 0; i < POWER_UP_LIST.length; i += 1) total += POWER_UP_LIST[i].weight;
    let roll = Math.random() * total;
    for (let i = 0; i < POWER_UP_LIST.length; i += 1) {
      roll -= POWER_UP_LIST[i].weight;
      if (roll <= 0) return POWER_UP_LIST[i];
    }
    return POWER_UP_LIST[0];
  }

  spawn(x, y, guaranteed = false) {
    if (this.activeCapsules >= TUNING.powerUp.maxOnScreen) return null;
    const chance =
      (this.game.level.current.dropChance ?? TUNING.powerUp.dropChance) +
      (this.game.build?.dropChanceBonus ?? 0);
    if (!guaranteed && Math.random() > chance) return null;

    let slot = null;
    for (let i = 0; i < this.pool.length; i += 1) {
      if (!this.pool[i].active) {
        slot = this.pool[i];
        break;
      }
    }
    if (!slot) return null;

    const type = this.pickType();
    slot.init(type, x, y, TUNING.powerUp.fallSpeed * this.game.speedScale);
    this.roll += 1;
    return type;
  }

  update(dt) {
    const game = this.game;
    const paddle = game.paddle;
    const world = game.world;

    for (let i = 0; i < this.pool.length; i += 1) {
      const powerUp = this.pool[i];
      if (!powerUp.active) continue;
      powerUp.update(dt);

      if (powerUp.caught > 0) {
        if (powerUp.caught >= 1) {
          powerUp.active = false;
          powerUp.type = null;
        }
        continue;
      }

      if (powerUp.y > world.height + 40) {
        powerUp.active = false;
        powerUp.type = null;
        continue;
      }

      if (powerUp.overlapsRect(paddle.x - 4, paddle.y - 6, paddle.width + 8, paddle.height + 12)) {
        powerUp.caught = 0.001;
        game.onPowerUpCaught(powerUp.type, powerUp.centerX, powerUp.centerY);
      }
    }

    this.tick('wide', dt, () => game.paddle.applyWide(false));
    this.tick('slow', dt, () => game.applySlow(false));
    this.tick('fire', dt, () => game.applyPierce(false));
  }

  tick(key, dt, onExpire) {
    if (this.effects[key] <= 0) return;
    this.effects[key] = Math.max(0, this.effects[key] - dt);
    if (this.effects[key] === 0) onExpire();
  }

  apply(type) {
    const game = this.game;
    switch (type.id) {
      case 'multiball':
        game.spawnExtraBalls(2);
        break;
      case 'wide':
        this.effects.wide = this.durations.wide;
        game.paddle.applyWide(true);
        break;
      case 'slow':
        this.effects.slow = this.durations.slow;
        game.applySlow(true);
        break;
      case 'fire':
        this.effects.fire = this.durations.fire;
        game.applyPierce(true);
        break;
      case 'life':
        game.addLife();
        break;
      default:
        break;
    }
  }

  isActive(key) {
    return this.effects[key] > 0;
  }

  getEffectChips() {
    const chips = [];
    if (this.effects.wide > 0) {
      chips.push({ id: 'wide', ratio: this.effects.wide / this.durations.wide });
    }
    if (this.effects.slow > 0) {
      chips.push({ id: 'slow', ratio: this.effects.slow / this.durations.slow });
    }
    if (this.effects.fire > 0) {
      chips.push({ id: 'fire', ratio: this.effects.fire / this.durations.fire });
    }
    return chips;
  }
}
