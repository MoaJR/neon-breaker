/**
 * Visual QA helper — captures representative screens (not pass/fail).
 * Usage: node tests/e2e/capture.mjs
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'screens');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.NeonBreaker));
await page.waitForTimeout(400);
await page.screenshot({ path: join(OUT, 'cap-01-menu.png') });

/* level 1 with power-ups falling and active chips */
await page.click('#btn-classic');
await page.waitForTimeout(1900);
await page.evaluate(async () => {
  const { POWER_UP_TYPES } = await import('/src/core/Config.js');
  const engine = window.NeonBreaker.engine;
  const types = ['wide', 'fire', 'multiball'];
  types.forEach((id, index) => {
    const slot = engine.powerUpManager.pool.find((item) => !item.active);
    if (!slot) return;
    slot.init(POWER_UP_TYPES[id], engine.paddle.centerX - 120 + index * 120, engine.paddle.y - 210 - index * 60, 90);
  });
  engine.onPowerUpCaught(POWER_UP_TYPES.fire, engine.paddle.centerX + 40, engine.paddle.y - 20);
  engine.onPowerUpCaught(POWER_UP_TYPES.wide, engine.paddle.centerX, engine.paddle.y - 20);
});
await page.waitForTimeout(700);
await page.screenshot({ path: join(OUT, 'cap-02-powerups.png') });

/* mid/late level layouts */
for (const [index, label] of [
  [5, 'pyramid'],
  [7, 'diamond'],
  [11, 'overdrive'],
]) {
  await page.evaluate((levelIndex) => {
    const engine = window.NeonBreaker.engine;
    engine.startLevel(levelIndex);
    engine.readyTimer = 0;
    engine.launchBalls();
  }, index);
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, `cap-0${index + 1}-${label}.png`) });
}

/* victory screen */
await page.evaluate(() => {
  const engine = window.NeonBreaker.engine;
  engine.score = 48250;
  engine.best = 48250;
  engine.newRecord = true;
  engine.startLevel(11);
  for (const block of engine.level.blocks) {
    if (!block.alive || block.indestructible) continue;
    let guard = 0;
    while (block.alive && guard < 5) {
      engine.damageBlock(block, { x: block.centerX, y: block.centerY });
      guard += 1;
    }
  }
});
await page.waitForFunction(() => window.NeonBreaker.snapshot().state === 'victory', null, { timeout: 15000 });
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, 'cap-13-victory.png') });

await browser.close();

const mobile = await chromium.launch();
const mPage = await mobile.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
mPage.on('pageerror', (error) => errors.push(error.message));
await mPage.goto(BASE, { waitUntil: 'networkidle' });
await mPage.waitForFunction(() => Boolean(window.NeonBreaker));
await mPage.waitForTimeout(400);
await mPage.screenshot({ path: join(OUT, 'cap-14-mobile-menu.png') });
await mPage.tap('#btn-classic');
await mPage.waitForTimeout(1900);
await mPage.screenshot({ path: join(OUT, 'cap-15-mobile-play.png') });
await mobile.close();

console.log(errors.length ? `errors: ${errors.join(' | ')}` : 'no errors captured');
console.log('screens written to', OUT);
