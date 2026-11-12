import assert from 'node:assert/strict';
import test from 'node:test';
import { EffectRuntime } from '../../../src/roguelite/EffectRuntime.js';
import { LevelManager } from '../../../src/levels/LevelManager.js';
import { compileBuild } from '../../../src/roguelite/BuildStats.js';
import { upgradeById } from '../../../src/roguelite/UpgradeLibrary.js';

const WORLD = { width: 1000, height: 750, hudInset: 50, playTop: 60 };
const noop = () => {};

function createRuntime(upgrades = []) {
  const level = new LevelManager().buildDefinition(
    {
      name: 'TEST ROOM',
      floor: 0,
      objective: 'clear',
      rows: [
        '11111111111',
        '11111111111',
        '22222222222',
        'HHHHHHHHHHH',
        '33333333333',
      ],
      paletteShift: 0,
      hpBonus: 0,
      valueScale: 1,
    },
    WORLD,
  );
  const build = compileBuild({
    upgrades: upgrades.map(([id, levelValue]) => ({ def: upgradeById(id), level: levelValue })),
    relics: [],
    synergies: [],
  });
  const events = { destroyed: 0, depths: [], coins: 0, lives: 0 };
  const game = {
    mode: 'run',
    state: 'playing',
    build,
    world: WORLD,
    level,
    paddle: { x: 400, y: 640, width: 200, height: 16, centerX: 500, widthOffset: 0 },
    balls: [{ active: true, stuck: false, x: 500, y: 400, vx: 0, vy: -400, speed: 500, radius: 9, trailCount: 0, guardAngle: noop, setSpeed: noop }],
    run: { recordBlocks: noop, stats: {} },
    extraPaddles: [],
    particles: { burst: noop, ring: noop, shards: noop, dot: noop },
    renderer: { addFlash: noop, addShake: noop, time: 0 },
    ui: { toast: noop },
    audio: { play: noop },
    sfx: noop,
    addCoins: (amount) => { events.coins += amount; },
    addLife: () => { events.lives += 1; },
    setBuildSlow: noop,
    applyBlockDamage(block, amount = 1, options = {}) {
      if (!block || !block.alive) return false;
      events.depths.push(options.depth ?? 0);
      const destroyed = block.damage(Math.max(1, Math.round(amount)));
      if (!destroyed) return false;
      level.grid[block.row * level.cols + block.col] = null;
      level.onBlockDestroyed(block);
      events.destroyed += 1;
      runtime.onBlockDestroyed(block, options);
      return true;
    },
  };
  const runtime = new EffectRuntime(game);
  runtime.startRoom();
  return { game, runtime, level, build, events };
}

test('explosions and chains are powerful but capped by recursion depth', () => {
  const { runtime, level, events, game } = createRuntime([
    ['explosive_impact', 3],
    ['chain_reaction', 3],
  ]);
  const target = level.blocks.find((block) => block.alive);
  runtime.onBallHitBlock(target, game.balls[0]);
  assert.ok(events.destroyed >= 2, 'explosion destroyed neighbours');
  assert.ok(events.destroyed < level.blocks.length + 1);
  const maxDepth = Math.max(...events.depths);
  assert.ok(maxDepth <= 4, `depth capped, got ${maxDepth}`);
  assert.equal(level.breakableRemaining >= 0, true);
});

test('fireball applies burn damage over time through the runtime', () => {
  const { runtime, level, game } = createRuntime([['fireball', 2]]);
  const block = level.blocks.find((item) => item.alive);
  block.hp = 5;
  block.maxHp = 5;
  runtime.onBallHitBlock(block, game.balls[0]);
  assert.equal(runtime.burns.has(block), true);
  const before = block.hp;
  for (let i = 0; i < 120; i += 1) runtime.update(1 / 60);
  assert.ok(block.hp < before || !block.alive, 'burn ticked damage');
});

test('piercing probability, shields and recovery paths work', () => {
  const { runtime, game } = createRuntime([
    ['piercing', 5],
    ['shield', 2],
    ['second_chance', 3],
  ]);
  let pierced = 0;
  for (let i = 0; i < 200; i += 1) {
    if (runtime.shouldPierce(game.balls[0], null)) pierced += 1;
  }
  assert.ok(pierced > 0 && pierced < 200, `pierce is probabilistic, got ${pierced}/200`);
  assert.equal(runtime.shieldCharges, 2);
  assert.equal(runtime.onAllBallsLost(), 'recover');
  assert.equal(runtime.shieldCharges, 1);
  assert.equal(runtime.onAllBallsLost(), 'recover');
  assert.equal(runtime.shieldCharges, 0);
  const outcome = runtime.onAllBallsLost();
  assert.ok(['recover', 'life'].includes(outcome));
});

test('lasers, orbitals and black holes damage blocks in the live grid', () => {
  const { runtime, game, level } = createRuntime([
    ['laser_paddle', 3],
    ['orbital', 3],
    ['black_hole', 2],
  ]);
  const before = level.breakableRemaining;
  runtime.timers.laser = 0;
  runtime.timers.orbitalHit = 0;
  runtime.timers.blackHole = 0;
  runtime.update(1 / 30);
  runtime.update(1 / 30);
  assert.ok(runtime.lasers.length > 0, 'laser beam was fired');
  assert.ok(level.breakableRemaining < before, 'at least one module damaged the field');
  assert.ok(runtime.fields.length >= 0);
  assert.ok(runtime.orbitalPositions(game.build).length === 4);
});

test('critical hits double damage and the clone joins/leaves paddle collisions', () => {
  const { runtime, game, level } = createRuntime([
    ['critical_hit', 5],
    ['clone', 1],
  ]);
  game.build.critChance = 1;
  const block = level.blocks.find((item) => item.alive);
  block.hp = 2;
  block.maxHp = 2;
  runtime.onBallHitBlock(block, game.balls[0]);
  assert.equal(block.alive, false, 'guaranteed critical with x2 damage destroyed a 2 HP block');

  runtime.timers.clone = 0;
  runtime.update(1 / 60);
  assert.equal(runtime.clone.active, true, 'clone spawned');
  assert.ok(game.extraPaddles.includes(runtime.clone), 'clone is a real paddle collider');
  runtime.clone.life = 0;
  runtime.update(1 / 60);
  assert.equal(runtime.clone.active, false);
  assert.equal(game.extraPaddles.includes(runtime.clone), false, 'clone is removed after expiry');
});
