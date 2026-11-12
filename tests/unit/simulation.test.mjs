import assert from 'node:assert/strict';
import test from 'node:test';
import { TUNING, WORLD_WIDTH } from '../../src/core/Config.js';
import { clamp } from '../../src/core/MathUtils.js';
import { Ball } from '../../src/entities/Ball.js';
import { Paddle } from '../../src/entities/Paddle.js';
import { LevelManager } from '../../src/levels/LevelManager.js';
import { LEVELS } from '../../src/levels/Levels.js';
import { PhysicsEngine } from '../../src/physics/PhysicsEngine.js';

/** Minimal game stub that wires the real physics engine to a real level. */
function createHarness(levelIndex = 0) {
  const world = { width: WORLD_WIDTH, height: 750, hudInset: 50, playTop: 44 };
  const level = new LevelManager();
  level.build(levelIndex, world);
  world.playTop = Math.max(world.hudInset * 0.8, level.geometry.originY - 34);

  const paddle = new Paddle();
  paddle.setWorldBounds(world.width, world.height);
  paddle.centerAt(world.width * 0.5, world.width);

  const balls = [new Ball()];
  const events = { wall: 0, paddle: 0, lost: 0, destroyed: 0, hits: 0 };
  let score = 0;

  const game = {
    world,
    level,
    paddle,
    balls,
    onWallHit() {
      events.wall += 1;
    },
    onPaddleHit() {
      events.paddle += 1;
    },
    onBallLost() {
      events.lost += 1;
    },
    onPowerUpCaught() {},
    damageBlock(block) {
      if (!block.alive || block.indestructible) return;
      const destroyed = block.damage(1);
      events.hits += 1;
      if (!destroyed) return;
      level.grid[block.row * level.cols + block.col] = null;
      level.onBlockDestroyed(block);
      score += block.value;
      events.destroyed += 1;
    },
  };

  return { game, physics: new PhysicsEngine(game), level, paddle, balls, world, events, score: () => score };
}

test('a tracking player clears every level without the ball escaping the field', () => {
  const step = TUNING.fixedStep;
  const report = [];

  for (let index = 0; index < LEVELS.length; index += 1) {
    const harness = createHarness(index);
    const { physics, paddle, balls, world, level, events } = harness;
    const ball = balls[0];
    ball.active = true;
    ball.speed = 620;
    ball.launch(-Math.PI / 2 + 0.02, 620);

    let time = 0;
    let problems = [];
    const limit = 240;

    while (time < limit && !level.cleared) {
      const wobble = Math.sin(time * 2.2) * paddle.width * 0.3;
      paddle.x = clamp(ball.x - paddle.width * 0.5 + wobble, 0, world.width - paddle.width);
      paddle.update(step, world.width);
      physics.step(step);
      level.update(step);
      time += step;

      if (!Number.isFinite(ball.x) || !Number.isFinite(ball.y)) {
        problems.push('NaN position');
        break;
      }
      if (ball.x < -1 || ball.x > world.width + 1) problems.push(`escaped horizontally at ${ball.x.toFixed(1)}`);
      if (ball.y < world.playTop - 1) problems.push(`escaped above the ceiling at ${ball.y.toFixed(1)}`);
      if (!ball.active) {
        problems.push('ball was lost');
        break;
      }
    }

    problems = problems.concat([]);
    report.push({ level: index + 1, name: LEVELS[index].name, time: Number(time.toFixed(1)), cleared: level.cleared });
    assert.deepEqual(problems, [], `level ${index + 1} (${LEVELS[index].name}) physics problems`);
    assert.equal(level.cleared, true, `level ${index + 1} not cleared after ${limit}s (${level.breakableRemaining} left)`);
    assert.equal(events.lost, 0, `level ${index + 1} lost the ball`);
    assert.ok(events.destroyed > 0);
  }

  console.log('\n  level clear times:', report.map((item) => `L${item.level} ${item.time}s`).join(' · '));
});

test('a max-speed ball never tunnels through a block', () => {
  const harness = createHarness(0);
  const { physics, level, balls, world } = harness;
  const ball = balls[0];
  const target = level.blocks.find((block) => block.row === level.rows - 1);

  ball.active = true;
  ball.x = target.centerX;
  ball.y = target.y + target.height + ball.radius + 6;
  ball.speed = TUNING.ball.maxSpeed;
  ball.vx = 0;
  ball.vy = -TUNING.ball.maxSpeed;

  for (let i = 0; i < 20 && target.alive; i += 1) physics.step(TUNING.fixedStep);

  assert.equal(target.hp < target.maxHp || !target.alive, true, 'block should have been hit');
  assert.ok(ball.y >= world.playTop, 'ball stays in the field');
});

test('paddle keeps the ball in play when the player tracks it', () => {
  const harness = createHarness(1);
  const { physics, paddle, balls, world } = harness;
  const ball = balls[0];
  ball.active = true;
  ball.launch(-Math.PI / 2 - 0.4, 700);

  for (let i = 0; i < 120 * 30; i += 1) {
    paddle.x = clamp(ball.x - paddle.width * 0.5, 0, world.width - paddle.width);
    paddle.update(TUNING.fixedStep, world.width);
    physics.step(TUNING.fixedStep);
    assert.ok(ball.active, 'ball must stay alive with perfect tracking');
  }

  assert.ok(harness.events.paddle > 10, 'paddle bounced many times');
  assert.ok(Math.abs(Math.hypot(ball.vx, ball.vy) - ball.speed) < 1, 'speed is conserved');
});

test('ball bounces climb the block field (no stuck horizontal loop)', () => {
  const harness = createHarness(3);
  const { physics, balls, world, paddle } = harness;
  const ball = balls[0];
  ball.active = true;
  ball.launch(-Math.PI / 2, 600);

  let minY = world.height;
  for (let i = 0; i < 120 * 20; i += 1) {
    paddle.x = clamp(ball.x - paddle.width * 0.5, 0, world.width - paddle.width);
    paddle.update(TUNING.fixedStep, world.width);
    physics.step(TUNING.fixedStep);
    minY = Math.min(minY, ball.y);
  }

  assert.ok(minY < world.height * 0.4, 'ball reaches the block area');
});
