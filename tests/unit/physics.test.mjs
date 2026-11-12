import assert from 'node:assert/strict';
import test from 'node:test';
import { TUNING } from '../../src/core/Config.js';
import { Ball } from '../../src/entities/Ball.js';
import { Paddle } from '../../src/entities/Paddle.js';
import {
  HIT,
  PADDLE_CONTACT,
  WALL_HIT,
  resolveWalls,
  testCircleRect,
  testPaddleContact,
} from '../../src/physics/CollisionSystem.js';

const circle = (x, y, radius = 10) => ({ x, y, radius });

test('circle/rect detects every face normal', () => {
  const rect = { x: 100, y: 100, w: 50, h: 20 };

  assert.equal(testCircleRect(circle(90, 110), rect.x, rect.y, rect.w, rect.h, HIT), true);
  assert.equal(HIT.nx, -1);
  assert.equal(HIT.ny, 0);

  assert.equal(testCircleRect(circle(160, 110), rect.x, rect.y, rect.w, rect.h, HIT), true);
  assert.equal(HIT.nx, 1);
  assert.equal(HIT.ny, 0);

  assert.equal(testCircleRect(circle(120, 92), rect.x, rect.y, rect.w, rect.h, HIT), true);
  assert.equal(HIT.nx, 0);
  assert.equal(HIT.ny, -1);

  assert.equal(testCircleRect(circle(120, 128), rect.x, rect.y, rect.w, rect.h, HIT), true);
  assert.equal(HIT.nx, 0);
  assert.equal(HIT.ny, 1);
});

test('circle/rect misses when far away and handles a centred circle', () => {
  const rect = { x: 100, y: 100, w: 50, h: 20 };
  assert.equal(testCircleRect(circle(300, 300), rect.x, rect.y, rect.w, rect.h, HIT), false);

  assert.equal(testCircleRect(circle(104, 110), rect.x, rect.y, rect.w, rect.h, HIT), true);
  assert.equal(HIT.inside, true);
  assert.ok(HIT.penetration > 0);
});

test('wall bounces clamp the ball and flip the correct axis', () => {
  const world = { width: 1000, height: 750, playTop: 60 };
  const ball = new Ball();
  ball.vx = -400;
  ball.vy = 120;
  ball.x = 4;
  ball.y = 400;

  assert.equal(resolveWalls(ball, world), WALL_HIT.LEFT);
  assert.equal(ball.x, ball.radius);
  assert.ok(ball.vx > 0);

  ball.x = 999;
  ball.vx = 400;
  ball.y = 400;
  assert.equal(resolveWalls(ball, world), WALL_HIT.RIGHT);
  assert.ok(ball.vx < 0);

  ball.y = 61;
  ball.vy = -300;
  assert.equal(resolveWalls(ball, world), WALL_HIT.TOP);
  assert.ok(ball.vy > 0);
  assert.equal(ball.y, world.playTop + ball.radius);
});

test('paddle contact only triggers for a falling ball overlapping the paddle', () => {
  const paddle = new Paddle();
  paddle.setWorldBounds(1000, 750);
  paddle.centerAt(500, 1000);

  const ball = new Ball();
  ball.x = paddle.centerX - 60;
  ball.y = paddle.y - ball.radius + 2;
  ball.vy = 300;
  ball.vx = 0;

  assert.equal(testPaddleContact(ball, paddle, PADDLE_CONTACT), true);
  assert.ok(PADDLE_CONTACT.rel < -0.4);

  ball.vy = -300;
  assert.equal(testPaddleContact(ball, paddle, PADDLE_CONTACT), false);

  ball.vy = 300;
  ball.x = paddle.x - 100;
  assert.equal(testPaddleContact(ball, paddle, PADDLE_CONTACT), false);
});

test('angle guard removes pure horizontal and vertical trajectories', () => {
  const ball = new Ball();
  ball.speed = 600;

  ball.vx = 0;
  ball.vy = -600;
  ball.guardAngle();
  assert.ok(Math.abs(ball.vx) >= TUNING.ball.minHorizontal * 600 * 0.98);
  assert.ok(Math.hypot(ball.vx, ball.vy) > 590);

  ball.vx = -600;
  ball.vy = 0;
  ball.guardAngle();
  assert.ok(Math.abs(ball.vy) >= TUNING.ball.minVertical * 600 * 0.98);
  assert.ok(ball.vy > 0, 'direction is preserved');

  ball.vx = 240;
  ball.vy = -560;
  ball.guardAngle();
  assert.ok(Math.abs(ball.vy) > Math.abs(ball.vx));
});

test('ball speed changes keep the direction', () => {
  const ball = new Ball();
  ball.launch(-Math.PI / 2, 600);
  const ratioX = ball.vx / ball.vy;
  ball.setSpeed(400);
  assert.ok(Math.abs(Math.hypot(ball.vx, ball.vy) - 400) < 0.001);
  assert.ok(Math.abs(ball.vx / ball.vy - ratioX) < 0.001);
  assert.equal(ball.speed, 400);
});

test('trail buffer stays inside its fixed size', () => {
  const ball = new Ball(8);
  for (let i = 0; i < 50; i += 1) {
    ball.x = i;
    ball.y = i * 2;
    ball.pushTrail();
  }
  assert.equal(ball.trailCount, 8);
  assert.equal(ball.trail[0], 49);
  assert.equal(ball.trail[1], 98);
});
