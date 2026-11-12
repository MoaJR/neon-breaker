/**
 * Secondary E2E suite: UI flows that are easy to break
 * (pause buttons, restart, menu, settings persistence, mid-game resize, landscape).
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const results = [];
const errors = [];

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

const snapshot = (page) => page.evaluate(() => window.NeonBreaker.snapshot());

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1180, height: 760 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.NeonBreaker));
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.NeonBreaker));
  await page.waitForTimeout(300);

  /* ── settings ── */
  await page.click('#btn-menu-sound');
  let soundOff = await page.evaluate(() => ({
    enabled: window.NeonBreaker.audio.enabled,
    iconHidden: document.getElementById('icon-sound-on').classList.contains('is-hidden'),
    stored: JSON.parse(window.localStorage.getItem('neonBreaker.settings.v1') || '{}').sound,
    pressed: document.getElementById('btn-menu-sound').getAttribute('aria-pressed'),
  }));
  check(
    'sound toggle mutes + persists',
    soundOff.enabled === false && soundOff.stored === false && soundOff.pressed === 'false',
    JSON.stringify(soundOff),
  );
  check('muted icon swaps', soundOff.iconHidden === true);
  await page.click('#btn-menu-sound');
  soundOff = await page.evaluate(() => ({
    enabled: window.NeonBreaker.audio.enabled,
    stored: JSON.parse(window.localStorage.getItem('neonBreaker.settings.v1') || '{}').sound,
  }));
  check('sound toggle restores', soundOff.enabled === true && soundOff.stored === true);

  await page.click('#btn-menu-quality');
  const low = await page.evaluate(() => ({
    quality: window.NeonBreaker.renderer.quality,
    particleQuality: window.NeonBreaker.engine.particles.quality,
    stored: JSON.parse(window.localStorage.getItem('neonBreaker.settings.v1') || '{}').effects,
  }));
  check('effects toggle lowers quality', low.quality === 'low' && low.particleQuality < 1 && low.stored === false, JSON.stringify(low));
  await page.click('#btn-menu-quality');
  check('effects toggle restores', (await page.evaluate(() => window.NeonBreaker.renderer.quality)) === 'high');

  /* ── pause / restart / menu ── */
  await page.click('#btn-classic');
  await page.waitForTimeout(400);
  await page.click('#btn-pause');
  await page.waitForTimeout(250);
  check('HUD pause button pauses', (await snapshot(page)).state === 'paused');
  check('pause overlay visible', await page.isVisible('#screen-pause'));
  await page.click('#btn-resume');
  await page.waitForTimeout(200);
  check('CONTINUAR resumes', (await snapshot(page)).state === 'playing');

  await page.evaluate(() => window.NeonBreaker.engine.addScore(500));
  await page.click('#btn-pause');
  await page.waitForTimeout(200);
  await page.click('#btn-restart');
  await page.waitForTimeout(400);
  let snap = await snapshot(page);
  check(
    'REINICIAR resets the run',
    snap.state === 'playing' && snap.score === 0 && snap.level === 0 && snap.lives === 3,
    JSON.stringify(snap),
  );

  await page.click('#btn-pause');
  await page.waitForTimeout(200);
  await page.click('#btn-pause-menu');
  await page.waitForTimeout(350);
  snap = await snapshot(page);
  check('MENU returns to menu', snap.state === 'menu' && (await page.isVisible('#screen-menu')));
  check('menu shows best score', (await page.textContent('#menu-best')).length > 0);

  /* ── mid-game resize ── */
  await page.click('#btn-classic');
  await page.waitForTimeout(1400);
  const beforeResize = await snapshot(page);
  await page.setViewportSize({ width: 720, height: 900 });
  await page.waitForTimeout(700);
  const afterResize = await snapshot(page);
  check(
    'resize keeps the level valid',
    afterResize.blocksAlive === beforeResize.blocksAlive && afterResize.world.height > beforeResize.world.height,
    `${beforeResize.world.height} -> ${afterResize.world.height}`,
  );
  check(
    'resize keeps the paddle inside the field',
    afterResize.paddleX >= 0 && afterResize.paddleX + afterResize.paddleWidth <= 1000,
    `${afterResize.paddleX}+${afterResize.paddleWidth}`,
  );
  await page.waitForTimeout(600);
  check('game keeps running after resize', (await snapshot(page)).state === 'playing');

  /* ── victory → restart ── */
  await page.evaluate(() => window.NeonBreaker.engine.startLevel(11));
  await page.waitForTimeout(350);
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
  await page.waitForFunction(() => window.NeonBreaker.snapshot().state === 'victory', null, { timeout: 12000 });
  await page.waitForSelector('#screen-victory.is-active', { timeout: 5000 });
  await page.waitForTimeout(350);
  check('victory overlay', await page.isVisible('#screen-victory'));
  await page.click('#btn-victory-again');
  await page.waitForTimeout(400);
  snap = await snapshot(page);
  check(
    'victory restart works',
    snap.state === 'playing' && snap.level === 0 && snap.score === 0,
    JSON.stringify({ state: snap.state, level: snap.level, score: snap.score }),
  );

  await context.close();

  /* ── mobile landscape ── */
  const landscape = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const lPage = await landscape.newPage();
  lPage.on('pageerror', (error) => errors.push(error.message));
  lPage.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await lPage.goto(BASE, { waitUntil: 'networkidle' });
  await lPage.waitForFunction(() => Boolean(window.NeonBreaker));
  await lPage.waitForTimeout(300);
  const stage = await lPage.locator('#stage').boundingBox();
  check(
    'landscape stage fits',
    stage.width <= 844.5 && stage.height <= 390.5,
    `${Math.round(stage.width)}x${Math.round(stage.height)}`,
  );
  await lPage.tap('#btn-classic');
  await lPage.waitForTimeout(1700);
  const lSnap = await snapshot(lPage);
  check(
    'landscape plays',
    lSnap.state === 'playing' && lSnap.blocksAlive > 0,
    JSON.stringify({ state: lSnap.state, blocks: lSnap.blocksAlive }),
  );
  await landscape.close();
} finally {
  await browser.close();
}

check('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' || '));

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} flow checks passed`);
if (failed.length) {
  console.log('Failures:');
  for (const failure of failed) console.log(` - ${failure.name} (${failure.detail})`);
  process.exitCode = 1;
}

