import assert from 'node:assert/strict';
import test from 'node:test';
import { createHarness } from '../../helpers/harness.mjs';

test('relics change rules: coin multiplier, max life and Phoenix revival', () => {
  const { engine, rl } = createHarness();
  rl.startRun({ seed: 'relic-seed' });
  rl.addRelic('golden_core');
  rl.addRelic('heart_of_the_void');
  rl.addRelic('phoenix');
  assert.equal(rl.relics.size, 3);

  engine.setCoins(0);
  engine.addCoins(100, null, null, true);
  assert.equal(engine.coins, 130, 'GOLDEN CORE multiplies coin income by 1.3');
  assert.equal(rl.run.coins, 130);

  assert.equal(rl.run.maxLives, 4, 'HEART OF THE VOID grants +1 max life');
  assert.equal(engine.maxLives, 4);

  const node = rl.map.availableNodes()[0];
  rl.enterNode(node.id);
  rl.startRoomPlay();
  engine.lives = 1;
  for (const ball of engine.balls) ball.active = false;
  engine.update(1 / 60);
  assert.equal(rl.screen, 'none', 'PHOENIX prevents the run summary');
  assert.equal(rl.run.ended, false);
  assert.equal(engine.lives, 2, 'PHOENIX revives with 2 lives');
  assert.equal(engine.phoenixUsed, true);
  assert.equal(engine.balls.some((ball) => ball.active), true, 'a ball is restored');
});

test('relic cap prevents a fourth relic from being acquired', () => {
  const { rl } = createHarness();
  rl.startRun({ seed: 'relic-cap' });
  rl.addRelic('golden_core');
  rl.addRelic('heart_of_the_void');
  rl.addRelic('phoenix');
  const fourth = rl.addRelic('magnetic_core');
  assert.equal(fourth.ok, false);
  assert.equal(rl.relics.size, 3);
});
