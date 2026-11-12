import { BLOCK_KIND, PALETTE, TUNING } from '../core/Config.js';
import { Block } from '../entities/Block.js';
import { LEVELS } from './Levels.js';

const KIND_BY_CHAR = {
  H: BLOCK_KIND.HARD,
  S: BLOCK_KIND.ARMORED,
  X: BLOCK_KIND.STEEL,
  P: BLOCK_KIND.POWER,
  C: BLOCK_KIND.BOSS_CORE,
  W: BLOCK_KIND.BOSS_WEAK,
};

const BOSS_ROLE_BY_KIND = {
  [BLOCK_KIND.BOSS_CORE]: 'core',
  [BLOCK_KIND.BOSS_WEAK]: 'weak',
};

const HP_BY_KIND = {
  [BLOCK_KIND.NORMAL]: 1,
  [BLOCK_KIND.HARD]: 2,
  [BLOCK_KIND.ARMORED]: 3,
  [BLOCK_KIND.STEEL]: Infinity,
  [BLOCK_KIND.POWER]: 1,
  [BLOCK_KIND.BOSS_CORE]: 3,
  [BLOCK_KIND.BOSS_WEAK]: 2,
};

/** Builds blocks for a level/room and exposes the regular grid used by collisions. */
export class LevelManager {
  constructor() {
    this.index = 0;
    this.blocks = [];
    this.grid = [];
    this.cols = TUNING.blocks.cols;
    this.rows = 0;
    this.breakableTotal = 0;
    this.breakableRemaining = 0;
    this.geometry = { originX: 0, originY: 0, cellW: 0, cellH: 0, gap: TUNING.blocks.gap };
    this.definition = null;
    this.name = '';
    this.objective = 'clear';
    this.originShift = 0;
    this.bossDefeated = false;
    this.transients = [];
  }

  get count() {
    return LEVELS.length;
  }

  get current() {
    return this.definition ?? LEVELS[Math.min(this.index, LEVELS.length - 1)];
  }

  get isLast() {
    return this.index >= LEVELS.length - 1;
  }

  computeGeometry(world) {
    const { cols, sideMargin, gap, heightRatio, minHeight, topOffset, maxBottomRatio } = TUNING.blocks;
    const width = world.width;
    const height = world.height;
    const cellW = (width - sideMargin * 2 - gap * (cols - 1)) / cols;
    const rows = this.rows || this.current.rows.length;

    const originY = Math.max(world.hudInset + topOffset, height * 0.105);
    const maxBottom = height * maxBottomRatio;
    const available = Math.max(80, maxBottom - originY);
    let cellH = cellW * heightRatio;
    if (rows * cellH + (rows - 1) * gap > available) {
      cellH = Math.max(minHeight, available / rows - gap);
    }

    this.geometry = { originX: sideMargin + (this.originShift || 0), originY, cellW, cellH, gap };
    return this.geometry;
  }

  build(index, world) {
    this.index = index;
    const level = LEVELS[index];
    this.definition = level;
    this.name = level.name;
    this.objective = 'clear';
    this.bossDefeated = false;
    this.originShift = 0;
    this.assemble(level.rows, world, {
      paletteShift: level.paletteShift ?? 0,
      hpBonus: 0,
      valueScale: 1,
      bossRoles: false,
    });
    return this;
  }

  buildDefinition(definition, world) {
    this.index = definition.floor ?? 0;
    this.definition = definition;
    this.name = definition.name ?? 'ROOM';
    this.objective = definition.objective ?? 'clear';
    this.bossDefeated = false;
    this.originShift = 0;
    this.assemble(definition.rows, world, {
      paletteShift: definition.paletteShift ?? 0,
      hpBonus: definition.hpBonus ?? 0,
      valueScale: definition.valueScale ?? 1,
      bossRoles: this.objective === 'boss',
    });
    return this;
  }

  assemble(rows, world, { paletteShift = 0, hpBonus = 0, valueScale = 1, bossRoles = false } = {}) {
    this.rows = rows.length;
    const geometry = this.computeGeometry(world);
    const { originX, originY, cellW, cellH, gap } = geometry;

    this.blocks.length = 0;
    this.transients.length = 0;
    this.grid = new Array(this.cols * this.rows).fill(null);
    let breakable = 0;

    for (let row = 0; row < this.rows; row += 1) {
      const line = rows[row];
      for (let col = 0; col < this.cols; col += 1) {
        const char = line[col];
        if (!char || char === '.') continue;

        const kind = KIND_BY_CHAR[char] || BLOCK_KIND.NORMAL;
        let colorIndex;
        if (kind === BLOCK_KIND.NORMAL) {
          const digit = Number.parseInt(char, 10);
          colorIndex = Number.isFinite(digit) ? digit - 1 : (row + paletteShift) % 7;
        } else {
          colorIndex = (row + paletteShift) % 7;
        }
        colorIndex = ((colorIndex % 7) + 7) % 7;

        let hp = HP_BY_KIND[kind];
        if (Number.isFinite(hp) && hpBonus > 0 && kind !== BLOCK_KIND.POWER) hp += hpBonus;
        const value = Math.round(this.valueFor(colorIndex, kind) * valueScale);
        const block = new Block(
          col,
          row,
          originX + col * (cellW + gap),
          originY + row * (cellH + gap),
          cellW,
          cellH,
          colorIndex,
          kind,
          hp,
          value,
        );
        if (bossRoles) block.bossRole = BOSS_ROLE_BY_KIND[kind] ?? 'armor';
        block.counted = !block.indestructible;
        block.baseValue = block.value;

        this.blocks.push(block);
        this.grid[row * this.cols + col] = block;
        if (!block.indestructible) breakable += 1;
      }
    }

    this.breakableTotal = breakable;
    this.breakableRemaining = breakable;
    return this;
  }

  valueFor(colorIndex, kind) {
    const base = PALETTE[colorIndex % PALETTE.length].value;
    if (kind === BLOCK_KIND.HARD) return base * 2;
    if (kind === BLOCK_KIND.ARMORED) return base * 3;
    if (kind === BLOCK_KIND.POWER) return base * 2;
    if (kind === BLOCK_KIND.BOSS_CORE) return base * 4;
    if (kind === BLOCK_KIND.BOSS_WEAK) return base * 3;
    return base;
  }

  addTransientBlock(col, row, { kind = BLOCK_KIND.HARD, hp = 2, value = 25, bossRole = 'barrier' } = {}) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return null;
    if (this.grid[row * this.cols + col]) return null;
    const { originX, originY, cellW, cellH, gap } = this.geometry;
    const colorIndex = (row + this.rows) % 7;
    const block = new Block(
      col,
      row,
      originX + col * (cellW + gap),
      originY + row * (cellH + gap),
      cellW,
      cellH,
      colorIndex,
      kind,
      hp,
      value,
    );
    block.bossRole = bossRole;
    block.counted = false;
    block.baseValue = value;
    this.blocks.push(block);
    this.grid[row * this.cols + col] = block;
    this.transients.push(block);
    return block;
  }

  removeTransient(block) {
    if (!block) return;
    block.alive = false;
    block.dying = 1;
    if (this.grid[block.row * this.cols + block.col] === block) {
      this.grid[block.row * this.cols + block.col] = null;
    }
    const index = this.transients.indexOf(block);
    if (index >= 0) this.transients.splice(index, 1);
  }

  setOriginShift(shift, world) {
    this.originShift = shift;
    if (world) this.relayout(world);
  }

  relayout(world) {
    if (!this.blocks.length) return;
    const geometry = this.computeGeometry(world);
    const { originX, originY, cellW, cellH, gap } = geometry;
    for (let i = 0; i < this.blocks.length; i += 1) {
      const block = this.blocks[i];
      block.x = originX + block.col * (cellW + gap);
      block.y = originY + block.row * (cellH + gap);
      block.width = cellW;
      block.height = cellH;
    }
  }

  onBlockDestroyed(block) {
    if (block.indestructible) return;
    if (block.counted) {
      block.counted = false;
      this.breakableRemaining = Math.max(0, this.breakableRemaining - 1);
    }
  }

  update(dt) {
    for (let i = 0; i < this.blocks.length; i += 1) {
      const block = this.blocks[i];
      if (!block.alive && block.dying <= 0) continue;
      block.update(dt);
    }
  }

  get cleared() {
    if (this.objective === 'boss') return this.bossDefeated;
    return this.breakableRemaining <= 0;
  }

  blockAt(col, row) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return null;
    return this.grid[row * this.cols + col];
  }
}
