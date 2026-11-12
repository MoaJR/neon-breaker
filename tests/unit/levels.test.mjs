import assert from 'node:assert/strict';
import test from 'node:test';
import { BLOCK_KIND, TUNING } from '../../src/core/Config.js';
import { LevelManager } from '../../src/levels/LevelManager.js';
import { LEVELS } from '../../src/levels/Levels.js';

const WORLD = { width: 1000, height: 750, hudInset: 50, playTop: 60 };
const VALID_CHAR = /^[.\dHSXP]$/;

test('every level has the expected grid shape', () => {
  assert.ok(LEVELS.length >= 10, 'at least 10 levels');
  for (const level of LEVELS) {
    assert.ok(level.name?.length > 0, 'level name');
    assert.ok(level.rows.length >= 4 && level.rows.length <= 9, `${level.name} row count`);
    for (const row of level.rows) {
      assert.equal(row.length, TUNING.blocks.cols, `${level.name}: "${row}" must have ${TUNING.blocks.cols} columns`);
      for (const char of row) assert.match(char, VALID_CHAR, `${level.name}: invalid char "${char}"`);
    }
  }
});

test('every level is buildable, has breakable blocks and stays in bounds', () => {
  for (let index = 0; index < LEVELS.length; index += 1) {
    const manager = new LevelManager();
    manager.build(index, WORLD);
    assert.ok(manager.breakableTotal > 0, `${LEVELS[index].name} needs breakable blocks`);
    assert.equal(manager.breakableRemaining, manager.breakableTotal);
    assert.equal(manager.blocks.length > 0, true);

    for (const block of manager.blocks) {
      assert.ok(block.width > 10 && block.height > 10, 'block size');
      assert.ok(block.x >= 0 && block.x + block.width <= WORLD.width + 0.001, 'block inside width');
      assert.ok(block.y >= WORLD.hudInset, 'block below HUD');
      assert.ok(block.y + block.height <= WORLD.height * TUNING.blocks.maxBottomRatio + 1, 'blocks do not reach the paddle');
      assert.equal(manager.blockAt(block.col, block.row), block, 'grid index matches');
    }

    const damageable = manager.blocks.filter((block) => !block.indestructible);
    for (const block of damageable) {
      let guard = 0;
      while (block.alive && guard < 5) {
        manager.grid[block.row * manager.cols + block.col] = null;
        const destroyed = block.damage(1);
        if (destroyed) manager.onBlockDestroyed(block);
        guard += 1;
      }
      assert.equal(block.alive, false, 'block destroyed');
    }
    assert.equal(manager.breakableRemaining, 0);
    assert.equal(manager.cleared, true, `${LEVELS[index].name} should be clearable`);
  }
});

test('steel blocks are indestructible and never block the clear condition', () => {
  const manager = new LevelManager();
  const steelIndex = LEVELS.findIndex((level) => level.rows.some((row) => row.includes('X')));
  assert.ok(steelIndex >= 0, 'a level with steel blocks exists');
  manager.build(steelIndex, WORLD);

  const steel = manager.blocks.filter((block) => block.kind === BLOCK_KIND.STEEL);
  assert.ok(steel.length > 0);
  for (const block of steel) {
    assert.equal(block.damage(1), false);
    assert.equal(block.alive, true);
    assert.equal(block.hp, Infinity);
  }

  const breakable = manager.breakableTotal;
  assert.ok(breakable < manager.blocks.length, 'steel is not counted as breakable');
});

test('destroyed blocks leave the grid so they cannot be hit twice', () => {
  const manager = new LevelManager();
  manager.build(0, WORLD);
  const block = manager.blocks.find((item) => item.kind === BLOCK_KIND.NORMAL);
  manager.grid[block.row * manager.cols + block.col] = null;
  block.damage(1);
  manager.onBlockDestroyed(block);
  assert.equal(manager.blockAt(block.col, block.row), null);
  assert.equal(manager.breakableRemaining, manager.breakableTotal - 1);
});

test('relayout keeps damage state and warning-free geometry on resize', () => {
  const manager = new LevelManager();
  manager.build(2, WORLD);
  const target = manager.blocks.find((block) => block.kind === BLOCK_KIND.HARD);
  target.damage(1);
  const hp = target.hp;

  manager.relayout({ width: 1000, height: 1333, hudInset: 140, playTop: 140 });
  assert.equal(target.hp, hp);
  for (const block of manager.blocks) {
    assert.ok(Number.isFinite(block.x) && Number.isFinite(block.y));
    assert.ok(block.y >= 140 - 0.001);
    assert.ok(block.y + block.height <= 1333 * TUNING.blocks.maxBottomRatio + 1);
  }
});

test('level metadata drives ball speed scaling', () => {
  for (let index = 1; index < LEVELS.length; index += 1) {
    assert.ok(LEVELS[index].speed >= LEVELS[index - 1].speed, 'speed must not decrease');
  }
});
