import assert from 'node:assert/strict';
import test from 'node:test';
import { SaveManager, defaultMetaState } from '../../../src/roguelite/SaveManager.js';
import { MetaProgressionManager } from '../../../src/roguelite/MetaProgressionManager.js';
import { STORAGE_KEY_SAVE, RUN, SAVE_VERSION } from '../../../src/roguelite/RogueliteConfig.js';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    read(key, fallback) {
      if (!map.has(key)) return fallback;
      return JSON.parse(JSON.stringify(map.get(key)));
    },
    write(key, value) {
      map.set(key, JSON.parse(JSON.stringify(value)));
    },
    getBest: () => 0,
    setBest() {},
    getSettings: () => ({ sound: true, effects: true }),
    setSettings() {},
  };
}

test('save manager creates a valid v2 document with defaults', () => {
  const storage = memoryStorage();
  const save = new SaveManager(storage);
  assert.equal(save.data.version, SAVE_VERSION);
  assert.equal(save.meta.selectedPlatform, 'standard');
  assert.deepEqual(save.meta.nodes, []);
  assert.equal(save.activeRun, null);
  const stored = storage.read(STORAGE_KEY_SAVE, null);
  assert.equal(stored, null, 'defaults are not written until an action');
  save.setPlatform('standard');
  assert.ok(storage.read(STORAGE_KEY_SAVE, null));
});

test('save manager migrates legacy data and sanitizes corrupted documents', () => {
  const legacy = memoryStorage({
    [STORAGE_KEY_SAVE]: { version: 1, best: 4321, meta: { data: '9', nodes: 'oops', platforms: [] } },
  });
  const migrated = new SaveManager(legacy);
  assert.equal(migrated.data.version, 2);
  assert.equal(migrated.meta.data, 9);
  assert.deepEqual(migrated.meta.nodes, []);
  assert.ok(migrated.meta.platforms.includes('standard'));

  const broken = memoryStorage({ [STORAGE_KEY_SAVE]: 'not-an-object' });
  const safe = new SaveManager(broken);
  assert.equal(safe.data.version, 2);
  assert.equal(safe.meta.selectedPlatform, 'standard');

  const future = memoryStorage({ [STORAGE_KEY_SAVE]: { version: 99, meta: defaultMetaState() } });
  const clamped = new SaveManager(future);
  assert.equal(clamped.data.version, SAVE_VERSION);
});

test('meta progression buys nodes, enforces requirements and unlocks content', () => {
  const storage = memoryStorage();
  const save = new SaveManager(storage);
  const meta = new MetaProgressionManager(save);
  save.meta.data = 1000;

  assert.equal(meta.availableSectors().length, 2);
  assert.equal(meta.canBuy('sector_core').ok, false, 'requires sector_void');
  assert.equal(meta.buy('sector_void').ok, true);
  assert.equal(meta.buy('sector_core').ok, true);
  assert.equal(meta.availableSectors().length, 4);
  assert.equal(meta.buy('sector_void').ok, false, 'already owned');

  assert.equal(meta.platform('speedster').unlocked, false);
  assert.equal(meta.buy('platform_speedster').ok, true);
  assert.equal(meta.platform('speedster').unlocked, true);
  assert.equal(meta.setPlatform('speedster').ok, true);
  assert.equal(save.meta.selectedPlatform, 'speedster');
  assert.equal(meta.startingLives(), RUN.startingLives);
  assert.equal(meta.buy('bonus_life').ok, true);
  assert.equal(meta.startingLives(), RUN.startingLives + 1);
  assert.equal(meta.buy('bonus_coins').ok, true);
  assert.equal(meta.startingCoins(), 20);
  assert.equal(meta.buy('bonus_reroll').ok, true);
  assert.equal(meta.bonusRerolls(), 1);
});

test('data awarded at the end of a run reflects performance and codex', () => {
  const storage = memoryStorage();
  const save = new SaveManager(storage);
  const meta = new MetaProgressionManager(save);
  const run = {
    score: 12000,
    roomsCleared: 8,
    bossesDefeated: 2,
    coins: 300,
    stats: { coinsEarned: 300 },
    upgrades: { fireball: 2, shield: 1 },
    relics: ['golden_core'],
    synergies: ['overload', 'aegis'],
  };
  const reward = meta.awardRun(run, { victory: true, bonusMultiplier: 1.5 });
  assert.ok(reward.base > 0);
  assert.ok(reward.total >= reward.base);
  assert.equal(save.meta.data, reward.total);
  assert.equal(save.meta.stats.runs, 1);
  assert.equal(save.meta.stats.victories, 1);
  assert.equal(save.meta.stats.bosses, 2);
  assert.equal(save.meta.stats.bestScore, 12000);
  assert.equal(save.meta.codex.upgrades.length, 2);
  assert.ok(save.meta.codex.relics.includes('golden_core'));
  assert.equal(save.meta.codex.synergies.length, 2);

  const reloaded = new SaveManager(storage);
  assert.equal(reloaded.meta.data, reward.total);
  assert.ok(reloaded.meta.nodes.every((id) => typeof id === 'string'));
});

test('active run persistence survives a reload and can be cleared', () => {
  const storage = memoryStorage();
  const save = new SaveManager(storage);
  save.setActiveRun({ run: { id: 'abc', seed: 's', ended: false }, map: { currentId: 'n1' } });
  const reloaded = new SaveManager(storage);
  assert.equal(reloaded.activeRun.run.id, 'abc');
  reloaded.clearActiveRun();
  assert.equal(reloaded.activeRun, null);

  const malformed = memoryStorage({
    [STORAGE_KEY_SAVE]: { version: 2, meta: defaultMetaState(), activeRun: { nonsense: true } },
  });
  assert.equal(new SaveManager(malformed).activeRun, null);
});
