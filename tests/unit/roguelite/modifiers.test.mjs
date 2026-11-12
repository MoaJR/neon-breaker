import assert from 'node:assert/strict';
import test from 'node:test';
import { createHarness } from '../../helpers/harness.mjs';
import { RoomFactory } from '../../../src/roguelite/RoomFactory.js';
import { Rng } from '../../../src/roguelite/Rng.js';

test('sector armor and room modifiers change the real level grid', () => {
  const factory = new RoomFactory({ rng: new Rng('armor-test') });
  const armored = factory.applyArmor(['11111111111'], 1, new Rng('always'));
  assert.equal(armored[0], 'SSSSSSSSSSS', '100% armor chance converts every normal block');

  const boss = factory.create({
    node: { id: 'b', sectorId: 'core-system', floor: 4, type: 'boss', col: 0 },
    floor: 4,
    roomNumber: 20,
    modifiers: [],
  });
  assert.equal(boss.rows.some((row) => row.includes('C')), true, 'boss layouts keep their core');
});

test('INFLATION evolves block HP during a run, LOW GRAVITY reaches physics and FAST BALL raises speed', () => {
  const { engine, rl } = createHarness();
  rl.startRun({ seed: 'modifier-seed' });
  const factory = new RoomFactory({ rng: new Rng('modifier-room') });
  const node = { id: 'modifier-room', sectorId: 'void-dimension', floor: 2, type: 'combat', col: 0 };
  const room = factory.create({
    node,
    floor: 2,
    roomNumber: 12,
    modifiers: ['inflation', 'low_gravity', 'fast_ball'],
  });
  rl.currentNode = node;
  rl.currentRoom = room;
  rl.screen = 'none';
  engine.startRoom(room);

  assert.equal(engine.gravity, 110, 'low gravity is applied to the physics hook');
  assert.ok(room.speed > 1.05, 'fast ball raised the room speed');
  assert.equal(engine.roomModifierEffects.inflation, 1);

  const block = engine.level.blocks.find((item) => item.alive && !item.indestructible);
  const hp = block.hp;
  engine.updateRoomModifiers(30.1);
  assert.ok(block.hp > hp, 'inflation added resistance');
  assert.equal(block.inflationStacks, 1);
  engine.updateRoomModifiers(30.1);
  assert.equal(block.inflationStacks, 2);
  engine.updateRoomModifiers(30.1);
  assert.equal(block.inflationStacks, 2, 'inflation is capped at +2');
});

test('chaos and darkness are announced effects consumed by the engine/renderer', () => {
  const { engine, rl } = createHarness();
  rl.startRun({ seed: 'chaos-seed' });
  const factory = new RoomFactory({ rng: new Rng('chaos-room') });
  const node = { id: 'chaos-room', sectorId: 'void-dimension', floor: 2, type: 'combat', col: 0 };
  const room = factory.create({ node, floor: 2, roomNumber: 12, modifiers: ['chaos', 'darkness', 'mirror'] });
  assert.equal(room.modifierEffects.chaos, 1);
  assert.equal(room.modifierEffects.darkness, 1);
  assert.equal(room.modifierEffects.mirror, 1);
  const level = engine.level.buildDefinition(room, engine.world);
  assert.ok(level.blocks.length > 0);
  rl.currentNode = node;
  rl.currentRoom = room;
  rl.screen = 'none';
  engine.startRoom(room);
  assert.equal(engine.roomModifierEffects.chaos, 1);
  const ball = engine.stickBall();
  ball.vx = 300;
  ball.vy = -500;
  ball.speed = 583;
  engine.effectRuntime.onPaddleHit(ball);
  assert.ok(Number.isFinite(ball.vx) && Number.isFinite(ball.vy));
});
