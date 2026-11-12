/**
 * End-to-end validation with Playwright (real Chromium).
 * Verifies input, physics, scoring, power-ups, level flow, game over,
 * persistence and the mobile layout. Screenshots land in tests/e2e/screens/.
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, 'screens');

await mkdir(SHOTS, { recursive: true });

const results = [];
const consoleErrors = [];

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

const snapshot = (target) => target.evaluate(() => window.NeonBreaker.snapshot());

/** Moves the pointer to follow the ball, emulating a human player. */
async function trackBall(page, box, durationMs = 3000) {
  const end = Date.now() + durationMs;
  while (Date.now() < end) {
    const ball = await page.evaluate(() => {
      const engine = window.NeonBreaker.engine;
      const live = engine.balls.find((item) => item.active);
      return live ? { x: live.x } : null;
    });
    if (ball) {
      const x = box.x + (ball.x / 1000) * box.width;
      await page.mouse.move(x, box.y + box.height * 0.85);
    }
    await page.waitForTimeout(70);
  }
}

/** Waits for an active playable state and guarantees a live ball. */
async function ensurePlaying(page) {
  await page.waitForFunction(() => window.NeonBreaker.snapshot().state === 'playing', null, { timeout: 8000 });
  await page.evaluate(() => {
    const engine = window.NeonBreaker.engine;
    if (!engine.balls.some((ball) => ball.active)) engine.stickBall(0);
    engine.launchBalls();
  });
  await page.waitForTimeout(120);
}

const browser = await chromium.launch();

try {
  /* ─────────────────────────── desktop ─────────────────────────── */
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.NeonBreaker), null, { timeout: 10000 });
  await page.waitForTimeout(500);

  check('menu overlay visible', await page.isVisible('#screen-menu'));
  await page.screenshot({ path: join(SHOTS, '01-menu.png') });

  await page.click('#btn-classic');
  await page.waitForTimeout(350);
  let snap = await snapshot(page);
  check('state is playing', snap.state === 'playing', snap.state);
  check('level 1 built', snap.level === 0 && snap.blocksAlive >= 50, `blocks=${snap.blocksAlive}`);
  check('three lives', snap.lives === 3, String(snap.lives));
  check('hud level label', (await page.textContent('#hud-level')).includes('LEVEL 1'));

  /* paddle — mouse (the ball is still waiting on the paddle, so no life is lost) */
  const box = await page.locator('#game').boundingBox();
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.8);
  await page.waitForTimeout(420);
  const leftSnap = await snapshot(page);
  await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.8);
  await page.waitForTimeout(520);
  const rightSnap = await snapshot(page);
  check(
    'mouse moves paddle right',
    rightSnap.paddleX > leftSnap.paddleX + 120,
    `${leftSnap.paddleX} -> ${rightSnap.paddleX}`,
  );

  /* paddle — keyboard */
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(280);
  await page.keyboard.up('ArrowLeft');
  const keySnap = await snapshot(page);
  check(
    'keyboard moves paddle left',
    keySnap.paddleX < rightSnap.paddleX - 60,
    `${rightSnap.paddleX} -> ${keySnap.paddleX}`,
  );

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1400);
  await page.keyboard.up('ArrowLeft');
  const edgeSnap = await snapshot(page);
  check('paddle stays inside left wall', edgeSnap.paddleX >= 0, String(edgeSnap.paddleX));

  /* ball launches by itself after the ready delay */
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.85);
  const autoLaunched = await page
    .waitForFunction(() => window.NeonBreaker.snapshot().ballsActive >= 1, null, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  check('ball auto-launched', autoLaunched);
  await page.screenshot({ path: join(SHOTS, '02-playing.png') });

  /* scoring from real collisions, with an auto-tracking paddle */
  await page.evaluate(() => {
    const engine = window.NeonBreaker.engine;
    if (engine.balls.some((ball) => ball.active && !ball.stuck)) return;
    engine.launchBalls();
  });
  await trackBall(page, box, 5000);
  snap = await snapshot(page);
  check('blocks destroyed by ball collisions', snap.score > 0, `score=${snap.score}`);

  /* paddle survives with an active ball (physics + paddle rebound) */
  check('balls kept alive by paddle returns', snap.lives >= 1 && snap.ballsActive >= 1, JSON.stringify({ lives: snap.lives, balls: snap.ballsActive }));
  await page.screenshot({ path: join(SHOTS, '03-score.png') });

  /* pause freezes simulation */
  await ensurePlaying(page);
  await page.evaluate(() => {
    const engine = window.NeonBreaker.engine;
    if (engine.state !== 'playing') return;
    engine.resetBalls();
    engine.stickBall(0);
    engine.launchBalls();
  });
  await page.waitForTimeout(80);
  await page.keyboard.press('p');
  await page.waitForTimeout(220);
  snap = await snapshot(page);
  check('pause state', snap.state === 'paused', snap.state);
  const ballA = await page.evaluate(() => {
    const ball = window.NeonBreaker.engine.balls.find((item) => item.active);
    return ball ? { x: ball.x, y: ball.y } : null;
  });
  await page.waitForTimeout(600);
  const ballB = await page.evaluate(() => {
    const ball = window.NeonBreaker.engine.balls.find((item) => item.active);
    return ball ? { x: ball.x, y: ball.y } : null;
  });
  check(
    'pause freezes ball',
    ballA && ballB && ballA.x === ballB.x && ballA.y === ballB.y,
    JSON.stringify({ ballA, ballB }),
  );
  await page.screenshot({ path: join(SHOTS, '04-pause.png') });
  await page.click('#btn-resume');
  await page.waitForTimeout(220);
  check('resume works', (await snapshot(page)).state === 'playing');

  /* ───────── power-ups (deterministic: simulation frozen, real catch path used) ───────── */
  await page.evaluate(() => {
    const engine = window.NeonBreaker.engine;
    if (!engine.balls.some((ball) => ball.active)) engine.stickBall(0);
    if (engine.state !== 'paused') engine.togglePause();
  });
  await page.waitForTimeout(150);

  const wideResult = await page.evaluate(async () => {
    const { POWER_UP_TYPES } = await import('/src/core/Config.js');
    const engine = window.NeonBreaker.engine;
    engine.powerUpManager.clearEffects();
    const before = engine.paddle.baseWidth;
    const slot = engine.powerUpManager.pool.find((item) => !item.active);
    slot.init(POWER_UP_TYPES.wide, engine.paddle.centerX, engine.paddle.y - 30, 400);
    for (let i = 0; i < 24; i += 1) engine.powerUpManager.update(1 / 60);
    return { before, after: engine.paddle.targetWidth, effect: engine.powerUpManager.effects.wide };
  });
  check(
    'WIDE paddle caught and applied',
    wideResult.after > wideResult.before * 1.25 && wideResult.effect > 0,
    `${wideResult.before} -> ${wideResult.after} (effect ${wideResult.effect.toFixed(1)}s)`,
  );

  const slowResult = await page.evaluate(async () => {
    const { POWER_UP_TYPES } = await import('/src/core/Config.js');
    const engine = window.NeonBreaker.engine;
    const ball = engine.balls.find((item) => item.active);
    const before = ball.speed;
    engine.onPowerUpCaught(POWER_UP_TYPES.slow, engine.paddle.centerX, engine.paddle.y - 30);
    return { before, after: ball.speed, effect: engine.powerUpManager.effects.slow };
  });
  check(
    'SLOW ball reduces speed',
    slowResult.after < slowResult.before && slowResult.effect > 0,
    `${slowResult.before.toFixed(0)} -> ${slowResult.after.toFixed(0)}`,
  );

  const fireOn = await page.evaluate(async () => {
    const { POWER_UP_TYPES } = await import('/src/core/Config.js');
    const engine = window.NeonBreaker.engine;
    engine.onPowerUpCaught(POWER_UP_TYPES.fire, 500, 700);
    const active = engine.balls.filter((ball) => ball.active);
    return active.length > 0 && active.every((ball) => ball.pierce);
  });
  check('FIRE ball pierces', fireOn === true);

  const multiResult = await page.evaluate(async () => {
    const { POWER_UP_TYPES } = await import('/src/core/Config.js');
    const engine = window.NeonBreaker.engine;
    const before = engine.balls.filter((ball) => ball.active).length;
    engine.onPowerUpCaught(POWER_UP_TYPES.multiball, 500, 700);
    return { before, after: engine.balls.filter((ball) => ball.active).length };
  });
  check('MULTIBALL adds balls', multiResult.after >= multiResult.before + 2, `${multiResult.before} -> ${multiResult.after}`);

  const lifeResult = await page.evaluate(async () => {
    const { POWER_UP_TYPES } = await import('/src/core/Config.js');
    const engine = window.NeonBreaker.engine;
    engine.lives = 2;
    engine.ui.updateLives(2);
    engine.onPowerUpCaught(POWER_UP_TYPES.life, 500, 700);
    return engine.lives;
  });
  check('EXTRA LIFE grants a life', lifeResult === 3, `lives=${lifeResult}`);
  await page.screenshot({ path: join(SHOTS, '05-powerups.png') });

  await page.evaluate(() => {
    const engine = window.NeonBreaker.engine;
    if (engine.state === 'paused') engine.resume();
    if (!engine.balls.some((ball) => ball.active)) engine.stickBall(0);
  });
  await page.waitForTimeout(200);

  /* ───────── level clear → next level ───────── */
  await ensurePlaying(page);
  const levelBefore = (await snapshot(page)).level;
  await page.evaluate(() => {
    const engine = window.NeonBreaker.engine;
    for (const block of engine.level.blocks) {
      if (!block.alive || block.indestructible) continue;
      let guard = 0;
      while (block.alive && guard < 8) {
        engine.damageBlock(block, { x: block.centerX, y: block.centerY });
        guard += 1;
      }
    }
  });
  await page.waitForFunction(
    () => window.NeonBreaker.snapshot().state === 'levelClear' || window.NeonBreaker.snapshot().level > 0,
    null,
    { timeout: 4000 },
  );
  await page.screenshot({ path: join(SHOTS, '06-level-clear.png') });
  await page.waitForFunction(
    (previous) => {
      const current = window.NeonBreaker.snapshot();
      return current.level === previous + 1 && current.state === 'playing';
    },
    levelBefore,
    { timeout: 9000 },
  );
  snap = await snapshot(page);
  check('advances to next level', snap.level === levelBefore + 1, `level=${snap.level}`);
  check('next level has blocks', snap.blocksAlive > 20, `blocks=${snap.blocksAlive}`);
  check('score kept after level', snap.score > 100, `score=${snap.score}`);


  /* ───────── game over + restart ───────── */
  await page.evaluate(() => {
    const engine = window.NeonBreaker.engine;
    engine.lives = 1;
    engine.ui.updateLives(1);
    for (const ball of engine.balls) ball.active = false;
  });
  await page.waitForFunction(() => window.NeonBreaker.snapshot().state === 'gameOver', null, { timeout: 4000 });
  await page.waitForSelector('#screen-over.is-active', { timeout: 5000 });
  check('game over overlay shown', await page.isVisible('#screen-over'));
  await page.screenshot({ path: join(SHOTS, '07-game-over.png') });

  const finalScore = Number((await page.textContent('#over-score')).replace(/\D/g, ''));
  const persistedBest = await page.evaluate(() => window.NeonBreaker.storage.getBest());
  check('best saved to localStorage', persistedBest >= finalScore && persistedBest > 0, `${persistedBest} >= ${finalScore}`);

  await page.click('#btn-again');
  await page.waitForTimeout(450);
  snap = await snapshot(page);
  check(
    'restart resets the run',
    snap.state === 'playing' && snap.score === 0 && snap.level === 0 && snap.lives === 3,
    JSON.stringify({ state: snap.state, score: snap.score, level: snap.level, lives: snap.lives }),
  );

  const fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames += 1;
          if (performance.now() - start < 1000) requestAnimationFrame(tick);
          else resolve(frames);
        };
        requestAnimationFrame(tick);
      }),
  );
  check('render loop above 30 fps', fps >= 30, `${fps} fps`);

  /* persistence across reload */
  const bestBeforeReload = await page.evaluate(() => window.NeonBreaker.snapshot().best);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.NeonBreaker), null, { timeout: 10000 });
  await page.waitForTimeout(350);
  const bestAfterReload = await page.evaluate(() => window.NeonBreaker.snapshot().best);
  check('record survives reload', bestAfterReload === bestBeforeReload && bestAfterReload > 0, `${bestBeforeReload} -> ${bestAfterReload}`);

  const painted = await page.evaluate(() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let bright = 0;
    for (let i = 0; i < data.length; i += 4 * 97) {
      if (data[i] + data[i + 1] + data[i + 2] > 90) bright += 1;
    }
    return bright;
  });
  check('canvas renders lit pixels', painted > 50, `${painted} samples`);

  await context.close();

  /* ─────────────────────────── mobile portrait ─────────────────────────── */
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const mPage = await mobile.newPage();
  mPage.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`mobile console: ${message.text()}`);
  });
  mPage.on('pageerror', (error) => consoleErrors.push(`mobile pageerror: ${error.message}`));

  await mPage.goto(BASE, { waitUntil: 'networkidle' });
  await mPage.waitForFunction(() => Boolean(window.NeonBreaker), null, { timeout: 10000 });
  await mPage.waitForTimeout(400);
  await mPage.screenshot({ path: join(SHOTS, '08-mobile-menu.png') });

  const stageBox = await mPage.locator('#stage').boundingBox();
  check(
    'stage fits mobile viewport',
    stageBox.width <= 390.5 && stageBox.height <= 844.5,
    `${Math.round(stageBox.width)}x${Math.round(stageBox.height)}`,
  );

  await mPage.tap('#btn-classic');
  await mPage.waitForTimeout(1900);
  const mSnap = await snapshot(mPage);
  check('mobile starts and launches', mSnap.state === 'playing' && mSnap.ballsActive >= 1, JSON.stringify({ state: mSnap.state, balls: mSnap.ballsActive }));

  const canvasBox = await mPage.locator('#game').boundingBox();
  await mPage.touchscreen.tap(canvasBox.x + canvasBox.width * 0.18, canvasBox.y + canvasBox.height * 0.86);
  await mPage.waitForTimeout(320);
  const mLeft = await snapshot(mPage);
  await mPage.touchscreen.tap(canvasBox.x + canvasBox.width * 0.8, canvasBox.y + canvasBox.height * 0.86);
  await mPage.waitForTimeout(420);
  const mRight = await snapshot(mPage);
  check('touch moves paddle', mRight.paddleX > mLeft.paddleX + 60, `${mLeft.paddleX} -> ${mRight.paddleX}`);
  check('paddle inside mobile world', mRight.paddleX >= 0 && mRight.paddleX + mRight.paddleWidth <= 1000.5, `${mRight.paddleX}+${mRight.paddleWidth}`);

  const scrollY = await mPage.evaluate(() => window.scrollY);
  check('no page scroll during play', scrollY === 0, String(scrollY));

  await mPage.screenshot({ path: join(SHOTS, '09-mobile-playing.png') });
  await mobile.close();
} finally {
  await browser.close();
}

check('no console/page errors', consoleErrors.length === 0, consoleErrors.slice(0, 4).join(' || '));

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (consoleErrors.length) {
  console.log('\nErrors captured:');
  for (const error of consoleErrors) console.log(` - ${error}`);
}
if (failed.length) {
  console.log('\nFailures:');
  for (const failure of failed) console.log(` - ${failure.name} (${failure.detail})`);
  process.exitCode = 1;
}

