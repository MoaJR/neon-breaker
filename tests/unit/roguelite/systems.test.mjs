import assert from 'node:assert/strict';
import test from 'node:test';
import { Rng, createRunSeed } from '../../../src/roguelite/Rng.js';
import { RARITY_IDS } from '../../../src/roguelite/RogueliteConfig.js';
import { UpgradeManager } from '../../../src/roguelite/UpgradeManager.js';
import { SynergyManager } from '../../../src/roguelite/SynergyManager.js';
import { compileBuild } from '../../../src/roguelite/BuildStats.js';
import { upgradeById } from '../../../src/roguelite/UpgradeLibrary.js';
import { relicById } from '../../../src/roguelite/RelicLibrary.js';

const metaMock = { isUnlocked: () => true, registerSynergy: () => {} };

test('Rng is deterministic per seed and stays inside ranges', () => {
  const a = new Rng('seed-42');
  const b = new Rng('seed-42');
  for (let i = 0; i < 50; i += 1) {
    const value = a.next();
    assert.equal(value, b.next());
    assert.ok(value >= 0 && value < 1);
  }
  const rng = new Rng(7);
  for (let i = 0; i < 100; i += 1) {
    const value = rng.int(3, 9);
    assert.ok(value >= 3 && value <= 9);
  }
  assert.ok(createRunSeed().length > 0);
});

test('upgrade offers are distinct, respect rarity bias and stop at max level', () => {
  const manager = new UpgradeManager({ meta: metaMock, rng: new Rng('offers') });
  const offers = manager.rollOffers({ count: 3 });
  assert.equal(offers.length, 3);
  assert.equal(new Set(offers.map((offer) => offer.id)).size, 3);
  for (const offer of offers) {
    assert.ok(RARITY_IDS.includes(offer.rarity));
    assert.ok(offer.level >= 1);
    assert.ok(offer.def);
  }

  const rareOffers = manager.rollOffers({ count: 3, bias: 'rare' });
  for (const offer of rareOffers) {
    assert.ok(['rare', 'epic', 'legendary'].includes(offer.rarity), `got ${offer.rarity}`);
  }

  const maxed = 'lucky';
  for (let i = 0; i < 5; i += 1) manager.add(maxed);
  assert.equal(manager.levelOf(maxed), 5);
  assert.equal(manager.isMaxed(maxed), true);
  const later = manager.rollOffers({ count: 10 });
  assert.equal(later.some((offer) => offer.id === maxed), false);
});

test('upgrade levels increase and compile into real build stats', () => {
  const manager = new UpgradeManager({ meta: metaMock, rng: new Rng('levels') });
  assert.equal(manager.add('fireball').level, 1);
  manager.add('fireball');
  const third = manager.add('fireball');
  assert.equal(third.level, 3);
  assert.equal(third.leveledUp, true);
  manager.add('wide_paddle');
  manager.add('wide_paddle');
  manager.add('shield');

  const build = compileBuild({
    upgrades: manager.entries(),
    relics: [relicById('glass_cannon')],
    synergies: [],
    platform: null,
  });
  assert.equal(build.fireLevel, 3);
  assert.ok(build.fireSpread >= 0.5);
  assert.ok(Math.abs(build.paddleWidthMult - 1.16) < 1e-9);
  assert.equal(build.shieldCharges, 1);
  assert.ok(Math.abs(build.damageMult - 1.35) < 1e-9);
  assert.equal(build.maxLivesBonus, -1);
});

test('build caps prevent permanent invulnerability', () => {
  const upgrades = [
    { def: upgradeById('shield'), level: 3 },
    { def: upgradeById('shield'), level: 3 },
    { def: upgradeById('piercing'), level: 5 },
    { def: upgradeById('second_chance'), level: 3 },
    { def: upgradeById('magnetic_paddle'), level: 3 },
  ];
  const build = compileBuild({ upgrades, relics: [], synergies: [] });
  assert.ok(build.shieldCharges <= 4);
  assert.ok(build.pierceChance <= 0.9);
  assert.ok(build.secondChance <= 0.85);
  assert.ok(build.magneticChance <= 0.85);
});

test('luck shifts rarity weights upward and bias removes low tiers', () => {
  const manager = new UpgradeManager({ rng: new Rng('luck') });
  const base = manager.rarityWeights();
  const lucky = manager.rarityWeights({ luck: 5 });
  assert.ok(lucky.common < base.common);
  assert.ok(lucky.rare + lucky.epic + lucky.legendary > base.rare + base.epic + base.legendary);
  const floor = manager.rarityWeights({ bias: 'epic' });
  assert.equal(floor.common, 0);
  assert.equal(floor.uncommon, 0);
  assert.ok(floor.epic > 0 || floor.legendary > 0);
});

test('synergies activate once and contribute bonuses', () => {
  const manager = new SynergyManager({ meta: metaMock });
  const upgrades = { electric_ball: 2, chain_reaction: 1, critical_hit: 1 };
  const first = manager.check({ upgrades, relics: [] });
  assert.equal(first.length, 1);
  assert.equal(first[0].id, 'overload');
  assert.equal(manager.check({ upgrades, relics: [] }).length, 0);
  const build = compileBuild({
    upgrades: [
      { def: upgradeById('electric_ball'), level: 2 },
      { def: upgradeById('chain_reaction'), level: 1 },
      { def: upgradeById('critical_hit'), level: 1 },
    ],
    relics: [],
    synergies: manager.activeDefs(),
  });
  assert.equal(build.electricCrit, 1);
  assert.ok(build.electricTargets >= 2);
});
