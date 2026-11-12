import assert from 'node:assert/strict';
import test from 'node:test';
import { createHarness, step, clearRoom } from '../../helpers/harness.mjs';
import { RoomFactory } from '../../../src/roguelite/RoomFactory.js';
import { Rng } from '../../../src/roguelite/Rng.js';

test('a run starts on the map and a cleared room grants a real upgrade reward', () => {
  const { engine, rl } = createHarness();
  rl.startRun({ seed: 'integration-seed' });
  assert.equal(rl.screen, 'map');
  assert.equal(engine.mode, 'run');
  assert.equal(rl.map.availableNodes().length, 2);
  assert.equal(engine.getSnapshot().run.roomNumber, 0);

  const node = rl.map.availableNodes()[0];
  rl.enterNode(node.id);
  assert.equal(rl.screen, 'briefing');
  assert.ok(rl.currentRoom.rows.length >= 4);
  assert.equal(engine.state, 'overlay');

  rl.startRoomPlay();
  assert.equal(engine.state, 'playing');
  assert.ok(engine.level.blocks.length > 0);
  assert.equal(engine.balls.filter((ball) => ball.active).length, 1);

  clearRoom(engine);
  engine.update(1 / 60);
  assert.equal(engine.state, 'levelClear');
  step(engine, 100);
  assert.equal(rl.screen, 'reward');
  assert.ok(rl.rewardOffers.length >= 1);
  const offer = rl.rewardOffers[0];
  const before = rl.upgrades.levelOf(offer.id);
  rl.pickReward(0);
  assert.equal(rl.upgrades.levelOf(offer.id), before + 1);
  assert.equal(rl.screen, 'map');
  assert.equal(rl.run.roomsCleared, 1);
  assert.equal(rl.map.currentNode.state, 'cleared');
  assert.ok(rl.build);
});

test('upgrade effects reach the live engine: width, multiball, shields and burn', () => {
  const { engine, rl } = createHarness();
  rl.startRun({ seed: 'effects-seed' });
  for (const id of ['wide_paddle', 'wide_paddle', 'multiball', 'shield', 'fireball', 'laser_paddle']) {
    rl.addUpgrade(id);
  }
  const node = rl.map.availableNodes()[0];
  rl.enterNode(node.id);
  rl.startRoomPlay();

  assert.ok(engine.paddle.baseWidth > 178, 'wide paddle applies to the real paddle');
  assert.equal(engine.balls.filter((ball) => ball.active).length, 2, 'multiball grants an extra ball');
  assert.equal(engine.effectRuntime.shieldCharges, 1);
  assert.ok(engine.build.fireLevel >= 1);
  assert.ok(engine.build.laserLevel >= 1);

  const target = engine.level.blocks.find((block) => block.alive && !block.indestructible);
  target.hp = 3;
  target.maxHp = 3;
  const hpBefore = target.hp;
  engine.damageBlock(target, { x: target.centerX, y: target.centerY });
  assert.ok(engine.effectRuntime.burns.has(target), 'fireball applied a burn to the live block');
  step(engine, 40);
  assert.ok(target.hp < hpBefore || !target.alive, 'burn dealt damage over time');
});

test('timed effects reset between rooms without stacking', () => {
  const { engine, rl } = createHarness();
  rl.startRun({ seed: 'reset-seed' });
  for (const id of ['shield', 'wide_paddle', 'wide_paddle', 'multiball']) rl.addUpgrade(id);
  const firstNode = rl.map.availableNodes()[0];
  rl.enterNode(firstNode.id);
  rl.startRoomPlay();
  assert.equal(engine.effectRuntime.shieldCharges, 1);
  assert.equal(engine.balls.filter((ball) => ball.active).length, 2);

  clearRoom(engine);
  engine.update(1 / 60);
  for (let i = 0; i < 240 && rl.screen !== 'reward'; i += 1) engine.update(1 / 60);
  assert.equal(rl.screen, 'reward', 'reward screen opened after the clear delay');
  rl.pickReward(0);
  assert.equal(rl.screen, 'map', 'reward returns to the map');
  rl.addUpgrade('multiball');
  const factory = new RoomFactory({ rng: new Rng('reset-room-2') });
  const node = { id: 'reset-room-2', sectorId: 'neon-district', floor: 1, type: 'combat', col: 0 };
  rl.currentNode = node;
  rl.currentRoom = factory.create({ node, floor: 1, roomNumber: 2, modifiers: [] });
  rl.screen = 'none';
  rl.overlay?.close?.();
  engine.startRoom(rl.currentRoom);

  assert.equal(engine.paddle.baseWidth, 178 * rl.build.paddleWidthMult, 'paddle width matches the compiled build exactly');
  assert.equal(engine.effectRuntime.shieldCharges, 1, 'shields are replenished, not stacked');
  assert.equal(
    engine.balls.filter((ball) => ball.active).length,
    1 + (rl.build.extraBalls ?? 0),
    'multiball count matches the compiled build',
  );
  assert.equal(engine.effectRuntime.burns.size, 0, 'burns are cleared between rooms');
});
