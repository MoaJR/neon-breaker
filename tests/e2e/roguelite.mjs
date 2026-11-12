/**
 * End-to-end validation of the roguelite layer in a real browser.
 * Covers map → briefing → room → reward, inventory, shop, events, boss,
 * sector advance, resume-after-reload, meta persistence and mobile layout.
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

const snapshot = (page) => page.evaluate(() => window.NeonBreaker.snapshot());
const rlState = (page) =>
  page.evaluate(() => {
    const rl = window.NeonBreaker.roguelite;
    return {
      screen: rl.screen,
      sectorIndex: rl.run?.sectorIndex ?? 0,
      roomNumber: rl.run?.roomNumber ?? 0,
      coins: rl.engine.coins,
      upgrades: { ...(rl.run?.upgrades ?? {}) },
      relics: [...(rl.run?.relics ?? [])],
      offers: rl.rewardOffers.length,
      runId: rl.run?.id ?? null,
      mapName: rl.map.view().name,
      roomsCleared: rl.run?.roomsCleared ?? 0,
      bosses: rl.run?.bossesDefeated ?? 0,
    };
  });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.NeonBreaker), null, { timeout: 10000 });
await page.waitForTimeout(400);

/* ── map ── */
await page.click('#btn-play');
await page.waitForSelector('.rl-map', { timeout: 6000 });
const mapState = await rlState(page);
check(
  'RUN starts on the sector map',
  mapState.screen === 'map' && mapState.mapName.includes('NEON DISTRICT'),
  JSON.stringify(mapState),
);
check('map offers alternative paths', (await page.locator('[data-node]').count()) >= 2);
check('run HUD shows coins', await page.isVisible('#hud-coins-wrap'));
await page.screenshot({ path: join(SHOTS, '10-roguelite-map.png') });

/* ── briefing + room ── */
await page.locator('[data-node]').first().click();
await page.waitForSelector('.rl-brief', { timeout: 5000 });
const briefing = await rlState(page);
check('briefing announces the room', briefing.screen === 'briefing', briefing.screen);
check(
  'briefing shows room modifiers section',
  (await page.locator('.rl-section-title').allTextContents()).join('|').includes('MODIFICADORES'),
);
await page.screenshot({ path: join(SHOTS, '11-roguelite-briefing.png') });
await page.click('[data-action="start"]');
await page.waitForFunction(() => window.NeonBreaker.snapshot().state === 'playing', null, { timeout: 8000 });
const snap = await snapshot(page);
check(
  'room starts in real gameplay',
  snap.mode === 'run' && snap.room?.objective === 'clear' && snap.blocksAlive > 10,
  `blocks=${snap.blocksAlive}`,
);
check('coins metric is live', snap.coins >= 0);
await page.screenshot({ path: join(SHOTS, '12-roguelite-playing.png') });

/* ── inventory overlay ── */
await page.keyboard.press('i');
await page.waitForSelector('.rl-inventory', { timeout: 4000 });
check(
  'inventory opens with I and freezes the field',
  (await snapshot(page)).state === 'overlay' && (await page.isVisible('.rl-inventory')),
);
await page.screenshot({ path: join(SHOTS, '13-roguelite-inventory.png') });
await page.keyboard.press('i');
await page.waitForFunction(() => window.NeonBreaker.snapshot().state === 'playing', null, { timeout: 4000 });
check('inventory closes back into play', true);

/* ── clear room → reward ── */
await page.evaluate(() => {
  const engine = window.NeonBreaker.engine;
  let guard = 0;
  while (engine.level.breakableRemaining > 0 && guard < 50) {
    for (const block of engine.level.blocks) {
      if (block.alive) engine.applyBlockDamage(block, 6, { source: 'e2e' });
    }
    guard += 1;
  }
});
await page.waitForSelector('.rl-reward', { timeout: 6000 });
check('room clear opens three upgrade cards', (await page.locator('.rl-card').count()) === 3);
const beforePick = await rlState(page);
await page.screenshot({ path: join(SHOTS, '14-roguelite-reward.png') });
await page.locator('[data-pick]').first().click();
await page.waitForSelector('.rl-map', { timeout: 5000 });
const afterPick = await rlState(page);
check(
  'reward applies an upgrade and returns to the map',
  Object.keys(afterPick.upgrades).length === Object.keys(beforePick.upgrades).length + 1 && afterPick.screen === 'map',
  JSON.stringify(afterPick.upgrades),
);
check('room clear is registered', afterPick.roomsCleared === 1, String(afterPick.roomsCleared));

/* ── shop ── */
await page.evaluate(() => {
  const rl = window.NeonBreaker.roguelite;
  rl.engine.setCoins(500);
  rl.openShop();
});
await page.waitForSelector('.rl-shop', { timeout: 4000 });
check('shop shows purchasable stock', (await page.locator('[data-buy]').count()) >= 4);
const coinsBefore = (await rlState(page)).coins;
await page.locator('[data-buy]:not([disabled])').first().click();
await page.waitForTimeout(350);
const coinsAfter = (await rlState(page)).coins;
check('shop purchase spends coins and adds the item', coinsAfter < coinsBefore, `${coinsBefore} -> ${coinsAfter}`);
await page.screenshot({ path: join(SHOTS, '15-roguelite-shop.png') });
await page.click('[data-action="leave"]');
await page.waitForSelector('.rl-map', { timeout: 5000 });
check('leaving the shop refreshes the map', true);

/* ── event ── */
await page.evaluate(() => window.NeonBreaker.roguelite.openEvent());
await page.waitForSelector('.rl-event', { timeout: 4000 });
check('event offers choices', (await page.locator('[data-choice]').count()) >= 2);
await page.screenshot({ path: join(SHOTS, '16-roguelite-event.png') });
await page.locator('[data-choice]').first().click();
await page.waitForTimeout(400);
if (await page.isVisible('[data-action="continue"]')) {
  check('event shows its consequences', true);
  await page.click('[data-action="continue"]');
  await page.waitForTimeout(400);
}
if (await page.isVisible('.rl-reward')) {
  await page.locator('[data-pick]').first().click();
}
await page.waitForSelector('.rl-map', { timeout: 6000 });
check('event resolves back to the map', true);

/* ── boss ── */
await page.evaluate(() => {
  const rl = window.NeonBreaker.roguelite;
  rl.engine.setCoins(500);
  const node = { id: 'e2e-boss', sectorId: 'neon-district', floor: 4, type: 'boss', col: 0 };
  rl.currentNode = node;
  rl.currentRoom = rl.factory.create({ node, floor: 4, roomNumber: 5, modifiers: ['chaos'] });
  rl.screen = 'none';
  rl.overlay.close();
  rl.engine.startRoom(rl.currentRoom);
});
await page.waitForFunction(() => Boolean(window.NeonBreaker.engine.boss), null, { timeout: 5000 });
await page.waitForSelector('.boss-bar.is-active', { timeout: 5000 });
await page.waitForTimeout(350);
const bossBarVisible = await page.evaluate(() => {
  const bar = document.getElementById('boss-bar');
  return getComputedStyle(bar).visibility === 'visible' && bar.getBoundingClientRect().height > 0;
});
check('boss bar becomes visible', bossBarVisible, await page.textContent('#boss-name'));
await page.screenshot({ path: join(SHOTS, '17-roguelite-boss.png') });
await page.evaluate(() => {
  const engine = window.NeonBreaker.engine;
  let guard = 0;
  while (engine.boss && !engine.boss.defeated && guard < 120) {
    engine.boss.shieldTime = 0;
    engine.boss.timers.shield = 1e9;
    for (const block of engine.level.blocks) {
      if (block.alive && block.bossRole) engine.applyBlockDamage(block, 8, { source: 'e2e' });
    }
    guard += 1;
  }
});
await page.waitForSelector('.rl-reward', { timeout: 8000 });
const bossState = await rlState(page);
check('boss defeat grants a reward', bossState.screen === 'reward' && bossState.bosses === 1, JSON.stringify(bossState));
await page.screenshot({ path: join(SHOTS, '18-roguelite-boss-reward.png') });
await page.locator('[data-pick]').first().click();
await page.waitForSelector('.rl-map', { timeout: 6000 });
const sectorState = await rlState(page);
check(
  'sector advances to Cyber Factory',
  sectorState.sectorIndex === 1 && sectorState.mapName.includes('CYBER FACTORY'),
  JSON.stringify(sectorState),
);

/* ── resume after reload ── */
await page.evaluate(() => window.NeonBreaker.roguelite.showMap());
const runId = (await rlState(page)).runId;
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.NeonBreaker), null, { timeout: 10000 });
await page.waitForTimeout(300);
check('saved run exposes CONTINUAR on the menu', await page.isVisible('#btn-continue'));
await page.click('#btn-continue');
await page.waitForSelector('.rl-map', { timeout: 6000 });
const resumed = await rlState(page);
check('run resumes with the same id and sector', resumed.runId === runId && resumed.sectorIndex === 1, JSON.stringify(resumed));
await page.screenshot({ path: join(SHOTS, '19-roguelite-resume.png') });

/* ── meta progression + persistence ── */
await page.evaluate(() => window.NeonBreaker.roguelite.quitToMenu());
await page.waitForTimeout(250);
await page.click('#btn-meta');
await page.waitForSelector('.rl-meta', { timeout: 5000 });
check(
  'meta tree shows DATA and platforms',
  (await page.isVisible('.rl-meta')) && (await page.textContent('.rl-coins')).includes('DATA'),
);
await page.evaluate(() => {
  const nb = window.NeonBreaker;
  nb.meta.meta.data = 500;
  nb.save.save();
  nb.roguelite.renderMeta();
});
await page.waitForTimeout(200);
await page.locator('[data-meta="platform_speedster"]').click();
await page.waitForTimeout(250);
await page.locator('[data-platform="speedster"]').click();
await page.waitForTimeout(250);
await page.screenshot({ path: join(SHOTS, '20-roguelite-meta.png') });
const metaState = await page.evaluate(() => ({
  owned: window.NeonBreaker.meta.hasNode('platform_speedster'),
  selected: window.NeonBreaker.meta.meta.selectedPlatform,
  data: window.NeonBreaker.meta.data,
}));
check('meta purchase and platform selection work', metaState.owned && metaState.selected === 'speedster', JSON.stringify(metaState));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.NeonBreaker), null, { timeout: 10000 });
await page.click('#btn-meta');
await page.waitForSelector('.rl-meta', { timeout: 5000 });
const persisted = await page.evaluate(() => ({
  owned: window.NeonBreaker.meta.hasNode('platform_speedster'),
  selected: window.NeonBreaker.meta.meta.selectedPlatform,
  menuPlatform: document.getElementById('menu-platform').textContent,
}));
check(
  'meta progression persists across reloads',
  persisted.owned && persisted.selected === 'speedster',
  JSON.stringify(persisted),
);

/* ── mobile layout ── */
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const mPage = await mobile.newPage();
mPage.on('pageerror', (error) => consoleErrors.push(`mobile pageerror: ${error.message}`));
await mPage.goto(BASE, { waitUntil: 'networkidle' });
await mPage.waitForFunction(() => Boolean(window.NeonBreaker), null, { timeout: 10000 });
await mPage.tap('#btn-play');
await mPage.waitForSelector('.rl-map', { timeout: 6000 });
const layout = await mPage.evaluate(() => {
  const overlay = document.getElementById('rl-overlay');
  return {
    scrollWidth: overlay.scrollWidth,
    clientWidth: overlay.clientWidth,
    nodes: document.querySelectorAll('[data-node]').length,
  };
});
check(
  'mobile map fits without horizontal scroll',
  layout.scrollWidth <= layout.clientWidth + 2 && layout.nodes >= 2,
  JSON.stringify(layout),
);
await mPage.screenshot({ path: join(SHOTS, '21-roguelite-mobile-map.png') });
await mPage.locator('[data-node]').first().tap();
await mPage.waitForSelector('.rl-brief', { timeout: 5000 });
check('mobile briefing fits and shows START', await mPage.isVisible('[data-action="start"]'));
await mPage.screenshot({ path: join(SHOTS, '22-roguelite-mobile-briefing.png') });
await mPage.tap('[data-action="start"]');
await mPage.waitForFunction(() => window.NeonBreaker.snapshot().state === 'playing', null, { timeout: 8000 });
check('mobile run enters gameplay', (await snapshot(mPage)).mode === 'run');

check(
  'no console/page errors during roguelite flows',
  consoleErrors.length === 0,
  consoleErrors.slice(0, 3).join(' | '),
);

await browser.close();
const passed = results.filter((item) => item.ok).length;
console.log(`\n${passed}/${results.length} roguelite checks passed`);
if (passed !== results.length || consoleErrors.length) process.exit(1);



