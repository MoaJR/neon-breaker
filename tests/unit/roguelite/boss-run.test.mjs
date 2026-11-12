import assert from 'node:assert/strict';
import test from 'node:test';
import { createHarness, createStorage, step } from '../../helpers/harness.mjs';
import { RoomFactory } from '../../../src/roguelite/RoomFactory.js';
import { Rng } from '../../../src/roguelite/Rng.js';

test('boss rooms run phases, take damage and advance the sector after the reward', () => {
  const { engine, rl } = createHarness();
  rl.startRun({ seed: 'boss-seed' });
  const factory = new RoomFactory({ rng: new Rng('boss-room') });
  const bossNode = { id: 'boss-node', sectorId: 'neon-district', floor: 4, type: 'boss', col: 0 };
  rl.currentNode = bossNode;
  rl.currentRoom = factory.create({ node: bossNode, floor: 4, roomNumber: 5, modifiers: [] });
  rl.screen = 'none';
  engine.startRoom(rl.currentRoom);

  assert.ok(engine.boss, 'boss runtime exists');
  assert.equal(engine.boss.def.id, 'guardian');
  assert.ok(engine.boss.hp > 0);
  const startHp = engine.boss.hp;
  const core = engine.level.blocks.find((block) => block.bossRole === 'core' && block.alive);
  engine.applyBlockDamage(core, 4, { source: 'test' });
  assert.ok(engine.boss.hp < startHp, 'damaging a boss block reduces boss HP');

  let guard = 0;
  while (!engine.boss.defeated && guard < 80) {
    for (const block of engine.level.blocks) {
      if (block.alive && block.bossRole) engine.applyBlockDamage(block, 6, { source: 'test' });
    }
    guard += 1;
  }
  assert.equal(engine.boss.defeated, true);
  assert.equal(engine.level.cleared, true);
  engine.update(1 / 60);
  assert.equal(engine.state, 'levelClear');
  step(engine, 160);
  assert.equal(rl.screen, 'reward');
  rl.pickReward(0);
  assert.equal(rl.run.sectorIndex, 1, 'sector advances after the boss reward');
  assert.equal(rl.screen, 'map');
  assert.match(rl.map.view().name, /CYBER FACTORY/);
});

test('boss projectile hits consume a shield before lives', () => {
  const { engine, rl } = createHarness();
  rl.startRun({ seed: 'boss-shield' });
  rl.addUpgrade('shield');
  const factory = new RoomFactory({ rng: new Rng('boss-shield-room') });
  const bossNode = { id: 'boss-shield-node', sectorId: 'neon-district', floor: 4, type: 'boss', col: 0 };
  rl.currentNode = bossNode;
  rl.currentRoom = factory.create({ node: bossNode, floor: 4, roomNumber: 5, modifiers: [] });
  rl.screen = 'none';
  engine.startRoom(rl.currentRoom);
  const lives = engine.lives;
  engine.onBossProjectileHit({ x: 0, y: 0 });
  assert.equal(engine.lives, lives, 'shield absorbed the hit');
  assert.equal(engine.effectRuntime.shieldCharges, 0);
  engine.onBossProjectileHit({ x: 0, y: 0 });
  assert.equal(engine.lives, lives - 1, 'second hit costs a life');
});

test('losing the last life ends the run, awards DATA and clears the saved run', () => {
  const { engine, rl, meta, save } = createHarness();
  rl.startRun({ seed: 'loss-seed' });
  const node = rl.map.availableNodes()[0];
  rl.enterNode(node.id);
  rl.startRoomPlay();
  engine.score = 900;
  engine.lives = 1;
  for (const ball of engine.balls) ball.active = false;
  engine.update(1 / 60);
  assert.equal(rl.screen, 'summary');
  assert.equal(rl.run.ended, true);
  assert.equal(rl.run.victory, false);
  assert.ok(meta.data > 0, 'DATA was awarded');
  assert.equal(save.activeRun, null, 'active run cleared');
});

test('run state can be resumed from the map after a reload', () => {
  const storage = createStorage();
  const first = createHarness(storage);
  first.rl.startRun({ seed: 'resume-seed' });
  first.rl.addUpgrade('wide_paddle');
  first.rl.addUpgrade('shield');
  first.rl.addRelic('golden_core');
  first.rl.showMap();
  const savedId = first.rl.run.id;
  assert.ok(first.save.activeRun);

  const second = createHarness(storage);
  assert.equal(second.rl.hasSavedRun(), true);
  assert.equal(second.rl.continueSavedRun(), true);
  assert.equal(second.rl.run.id, savedId);
  assert.equal(second.rl.screen, 'map');
  assert.equal(second.rl.engine.mode, 'run');
  assert.equal(second.rl.upgrades.levelOf('wide_paddle'), 1);
  assert.equal(second.rl.relics.has('golden_core'), true);
  assert.equal(second.rl.map.availableNodes().length, 2);
});

test('defeating the final available sector ends the run as a victory with DATA', () => {
  const { engine, rl, meta } = createHarness();
  rl.startRun({ seed: 'victory-seed' });
  rl.startSector(1);
  assert.equal(rl.run.sectorIndex, 1);
  const factory = new RoomFactory({ rng: new Rng('victory-boss') });
  const node = { id: 'final-boss', sectorId: 'cyber-factory', floor: 4, type: 'boss', col: 0 };
  rl.currentNode = node;
  rl.currentRoom = factory.create({ node, floor: 4, roomNumber: 10, modifiers: [] });
  assert.equal(rl.currentRoom.bossId, 'destroyer');
  rl.screen = 'none';
  engine.startRoom(rl.currentRoom);
  engine.boss.shieldTime = 0;
  engine.boss.timers.shield = 1e9;
  engine.boss.hp = 1;
  const core = engine.level.blocks.find((block) => block.bossRole === 'core' && block.alive);
  engine.applyBlockDamage(core, 4, { source: 'test' });
  assert.equal(engine.boss.defeated, true);
  engine.update(1 / 60);
  for (let i = 0; i < 240 && rl.screen !== 'reward'; i += 1) engine.update(1 / 60);
  assert.equal(rl.screen, 'reward');
  rl.pickReward(0);
  assert.equal(rl.screen, 'summary');
  assert.equal(rl.run.victory, true);
  assert.equal(meta.meta.stats.victories, 1);
  assert.ok(meta.data > 0);
});

test('shop purchases and rerolls mutate the real run and economy', () => {
  const { engine, rl } = createHarness();
  rl.startRun({ seed: 'shop-seed' });
  const node = rl.map.availableNodes()[0];
  rl.map.enter(node.id);
  rl.currentNode = node;
  rl.openShop();
  assert.equal(rl.screen, 'shop');
  engine.setCoins(600);
  const item = rl.shop.stock.find((entry) => entry.kind === 'upgrade' && !entry.sold);
  const coinsBefore = engine.coins;
  assert.equal(rl.buyShopItem(item.itemId), true);
  assert.ok(engine.coins < coinsBefore);
  assert.equal(rl.upgrades.levelOf(item.id) > 0, true);
  assert.equal(item.sold, true);
  assert.equal(rl.buyShopItem(item.itemId), false);

  const rerollBefore = rl.shop.rerolls;
  assert.equal(rl.rerollShop(), true);
  assert.equal(rl.shop.rerolls, rerollBefore + 1);
  rl.leaveNode('shop');
  assert.equal(rl.screen, 'map');
  assert.equal(rl.map.currentNode.state, 'cleared');
});
