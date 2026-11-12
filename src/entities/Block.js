import { BLOCK_KIND, PALETTE } from '../core/Config.js';

/** A breakable (or steel) block living on the level grid. */
export class Block {
  constructor(col, row, x, y, width, height, colorIndex, kind, hp, value) {
    this.col = col;
    this.row = row;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.colorIndex = colorIndex;
    this.color = PALETTE[colorIndex % PALETTE.length];
    this.kind = kind;
    this.hp = hp;
    this.maxHp = hp;
    this.value = value;
    this.baseValue = value;
    this.alive = true;
    this.dying = 0;
    this.hitFlash = 0;
    this.guaranteedDrop = kind === BLOCK_KIND.POWER;
    this.bossRole = null;
    this.shielded = false;
    this.counted = true;
    this.inflationStacks = 0;
  }

  get indestructible() {
    return this.kind === BLOCK_KIND.STEEL;
  }

  get breakable() {
    return this.alive && !this.indestructible && this.dying === 0;
  }

  get centerX() {
    return this.x + this.width * 0.5;
  }

  get centerY() {
    return this.y + this.height * 0.5;
  }

  /** Apply one hit. Returns true when this hit destroys the block. */
  damage(amount = 1) {
    if (!this.alive || this.indestructible) return false;
    this.hp -= amount;
    this.hitFlash = 1;
    if (this.hp <= 0) {
      this.alive = false;
      this.dying = 1;
      return true;
    }
    return false;
  }

  update(dt) {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 5.5);
    if (this.dying > 0) this.dying = Math.max(0, this.dying - dt * 4.6);
  }
}
