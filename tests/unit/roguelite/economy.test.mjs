import assert from 'node:assert/strict';
import test from 'node:test';
import { Rng } from '../../../src/roguelite/Rng.js';
import { RUN } from '../../../src/roguelite/RogueliteConfig.js';
import { UpgradeManager } from '../../../src/roguelite/UpgradeManager.js';
import { RelicManager } from '../../../src/roguelite/RelicManager.js';
import { ShopManager } from '../../../src/roguelite/ShopManager.js';
import { EventManager } from '../../../src/roguelite/EventManager.js';
import { RunManager } from '../../../src/roguelite/RunManager.js';

const metaMock = { isUnlocked: () => true, registerSynergy: () => {} };

test('relic manager enforces the cap and rejects duplicates', () => {
  const manager = new RelicManager({ meta: metaMock, rng: new Rng('relics'), cap: 2 });
  assert.equal(manager.add('golden_core').ok, true);
  assert.equal(manager.add('golden_core').ok, false);
  assert.equal(manager.add('magnetic_core').ok, true);
  assert.equal(manager.isFull, true);
  assert.equal(manager.add('heart_of_the_void').ok, false);
  assert.equal(manager.rollOffers({ count: 3 }).length, 0);
});

test('shop prices, purchases and rerolls use the economy rules', () => {
  const upgrades = new UpgradeManager({ meta: metaMock, rng: new Rng('shop-up') });
  const relics = new RelicManager({ meta: metaMock, rng: new Rng('shop-rel'), cap: 3 });
  const shop = new ShopManager({ rng: new Rng('shop') });
  shop.open({ upgradeManager: upgrades, relicManager: relics, sectorIndex: 0, discount: 0, luck: 0 });
  assert.ok(shop.stock.length >= 4);
  assert.ok(shop.stock.some((entry) => entry.kind === 'special'), 'shop offers a special item');
  const item = shop.stock.find((entry) => entry.kind === 'upgrade');
  assert.ok(item.price > 0);
  assert.equal(shop.canBuy(item.itemId, 0).ok, false);
  assert.equal(shop.canBuy(item.itemId, item.price).ok, true);
  shop.purchase(item.itemId);
  assert.equal(shop.canBuy(item.itemId, 9999).ok, false);
  const price = shop.rerollPrice();
  assert.equal(shop.canReroll(0).ok, false);
  const result = shop.reroll({ coins: price });
  assert.equal(result.ok, true);
  assert.equal(shop.rerolls, 1);
  assert.ok(shop.rerollPrice() > price);
});

test('events apply consequences through the API and block unaffordable payments', () => {
  const manager = new EventManager({ rng: new Rng('events') });
  const state = { coins: 100, lives: 3, maxLives: 4, data: 0, pending: 0, bonuses: [] };
  const api = {
    rng: new Rng('api'),
    coins: () => state.coins,
    addCoins: (n) => { state.coins = Math.max(0, state.coins + n); },
    lives: () => state.lives,
    maxLives: () => state.maxLives,
    changeLives: (n) => { state.lives = Math.max(1, Math.min(state.maxLives, state.lives + n)); },
    addData: (n) => { state.data += n; },
    pendingLife: (n) => { state.pending += n; },
    addRandomRelic: () => ({ name: 'TEST RELIC' }),
    addRandomUpgrades: () => ['TEST UP'],
    removeRandomUpgrade: () => 'TEST LOSS',
    forceModifiers: () => ['DARKNESS'],
    clearModifiers: () => 1,
    addEventBonus: (bonus) => state.bonuses.push(bonus),
  };
  const contract = manager.resolve('contract', 'accept', api);
  assert.equal(contract.ok, true);
  assert.equal(state.pending, -1);

  state.coins = 10;
  const poor = manager.resolve('mysterious_merchant', 'pay', api);
  assert.equal(poor.ok, false);
  assert.equal(state.coins, 10);

  state.coins = 200;
  const odd = manager.resolve('anomaly', 'chaos', api);
  assert.equal(odd.ok, true);
  assert.equal(state.coins, 230);
});

test('run manager tracks coins, lives, modifiers and summary', () => {
  const runs = new RunManager();
  const meta = {
    startingLives: () => 4,
    startingCoins: () => 20,
    bonusRerolls: () => 1,
  };
  const run = runs.start({ seed: 'run-1', platform: { id: 'standard' }, meta });
  assert.equal(run.lives, 4);
  assert.equal(run.coins, 20);
  assert.equal(run.rerollsLeft, RUN.rerollsPerRun + 1);
  runs.addCoins(30);
  assert.equal(run.coins, 50);
  assert.equal(runs.spendCoins(200), false);
  assert.equal(runs.spendCoins(25), true);
  assert.equal(run.coins, 25);
  runs.pendingLife(-1);
  assert.equal(runs.clearPending().lifeNextRoom, -1);
  runs.forceModifiers(['fast_ball', 'darkness']);
  assert.deepEqual(runs.consumeNextModifiers(), ['fast_ball', 'darkness']);
  runs.enterRoom({ nodeId: 'n1', type: 'combat', floor: 0, roomNumber: 1 });
  runs.registerRoomClear({ type: 'boss' });
  runs.syncLive({ score: 1200, bestCombo: 9 });
  runs.end({ victory: true });
  const summary = runs.summary();
  assert.equal(summary.roomsCleared, 1);
  assert.equal(summary.bossesDefeated, 1);
  assert.equal(summary.victory, true);
  assert.equal(summary.bestCombo, 9);
});
