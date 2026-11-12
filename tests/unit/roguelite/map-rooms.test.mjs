import assert from 'node:assert/strict';
import test from 'node:test';
import { MapManager, NODE_TYPES } from '../../../src/roguelite/MapManager.js';
import { RoomFactory } from '../../../src/roguelite/RoomFactory.js';
import { Rng } from '../../../src/roguelite/Rng.js';
import { SECTORS, RUN, sectorById } from '../../../src/roguelite/RogueliteConfig.js';
import { mergeModifiers } from '../../../src/roguelite/ModifierLibrary.js';
import { LevelManager } from '../../../src/levels/LevelManager.js';
import { BLOCK_KIND } from '../../../src/core/Config.js';

const WORLD = { width: 1000, height: 750, hudInset: 50, playTop: 60 };

test('procedural maps are valid, connected and always end in a boss', () => {
  for (let sectorIndex = 0; sectorIndex < SECTORS.length; sectorIndex += 1) {
    for (let seed = 1; seed <= 60; seed += 1) {
      const manager = new MapManager().startSector({
        sectorIndex,
        rng: new Rng(`${sectorIndex}:${seed}`),
      });
      assert.equal(manager.floors.length, RUN.floorsPerSector);
      const nodes = manager.floors.flat();
      assert.equal(manager.floors[RUN.floorsPerSector - 1].length, 1);
      assert.equal(manager.floors[RUN.floorsPerSector - 1][0].type, 'boss');
      assert.equal(manager.floors[0].every((node) => node.type === 'combat'), true);

      const reachable = new Set();
      const queue = [...manager.floors[0]];
      while (queue.length) {
        const node = queue.pop();
        if (reachable.has(node.id)) continue;
        reachable.add(node.id);
        for (const nextId of node.next) {
          const target = manager.nodes.get(nextId);
          if (target) queue.push(target);
        }
      }
      for (const node of nodes) {
        assert.ok(reachable.has(node.id), `${node.id} is unreachable in seed ${seed}`);
        assert.ok(NODE_TYPES[node.type], `unknown node type ${node.type}`);
        assert.ok(node.next.every((id) => manager.nodes.has(id)));
      }
      const middle = manager.floors.slice(1, -1).flat();
      assert.ok(middle.some((node) => node.type === 'shop'), 'sector must offer a shop');
      assert.ok(middle.some((node) => node.type === 'event'), 'sector must offer an event');
      assert.ok(manager.floors[0].every((node) => node.state === 'available'));
    }
  }
});

test('map availability follows the chosen path and hides distant floors', () => {
  const manager = new MapManager().startSector({ sectorIndex: 0, rng: new Rng('path') });
  assert.equal(manager.availableNodes().length, 2);
  assert.equal(manager.enter('invalid-node'), null);
  const first = manager.availableNodes()[0];
  assert.equal(manager.enter(first.id).id, first.id);
  assert.equal(manager.availableNodes().length, 0, 'no next room until the current one is cleared');
  manager.completeCurrent();
  const next = manager.availableNodes();
  assert.ok(next.length >= 1);
  assert.ok(next.every((node) => first.next.includes(node.id)));

  const view = manager.view();
  const distant = view.floors[4][0];
  assert.equal(distant.revealed, 'hidden');
  assert.equal(distant.type, 'unknown');
  assert.equal(manager.sectorComplete, false);
  const restored = new MapManager()
    .startSector({ sectorIndex: 0, rng: new Rng('path') })
    .restore(manager.toJSON());
  assert.deepEqual(restored.availableNodes().map((node) => node.id), next.map((node) => node.id));
});

test('boss nodes and objective are wired into the level grid', () => {
  const factory = new RoomFactory({ rng: new Rng('factory-boss') });
  const bossNode = { id: 'boss', sectorId: 'neon-district', floor: 4, type: 'boss', col: 0 };
  const room = factory.create({ node: bossNode, floor: 4, roomNumber: 5, modifiers: [] });
  assert.equal(room.objective, 'boss');
  assert.ok(room.bossDef);
  assert.ok(room.rows.some((row) => row.includes('C')));
  assert.equal(room.type, 'boss');

  const level = new LevelManager().buildDefinition(room, WORLD);
  assert.equal(level.objective, 'boss');
  assert.equal(level.cleared, false);
  const bossBlocks = level.blocks.filter((block) => block.bossRole);
  assert.ok(bossBlocks.length > 0);
  assert.ok(bossBlocks.some((block) => block.bossRole === 'core'));
  assert.ok(bossBlocks.some((block) => block.kind === BLOCK_KIND.BOSS_CORE));
  assert.ok(bossBlocks.some((block) => block.bossRole === 'weak'));
  level.bossDefeated = true;
  assert.equal(level.cleared, true);
});

test('room factory applies mirror, armor and scaling modifiers', () => {
  const factory = new RoomFactory({ rng: new Rng('factory-modifiers') });
  const node = { id: 'combat', sectorId: 'void-dimension', floor: 2, type: 'combat', col: 0 };
  const room = factory.create({ node, floor: 2, roomNumber: 12, modifiers: ['mirror', 'armored', 'fast_ball'] });
  assert.equal(room.sectorIndex, 2);
  assert.ok(room.hpBonus >= 1);
  assert.ok(room.speed > 1.1);
  assert.equal(room.modifierEffects.mirror, 1);
  assert.equal(room.modifierEffects.hpBonus, 1);
  const level = new LevelManager().buildDefinition(room, WORLD);
  assert.ok(level.breakableTotal > 0);
  assert.ok(level.blocks.some((block) => Number.isFinite(block.maxHp) && block.maxHp >= 2));
  const merged = mergeModifiers(['armored', 'armored', 'darkness']);
  assert.equal(merged.hpBonus, 2);
  assert.equal(merged.darkness, 1);
  assert.equal(merged.ids.length, 3);
});

test('transient boss barriers can be added and removed safely', () => {
  const factory = new RoomFactory({ rng: new Rng('barriers') });
  const node = { id: 'boss2', sectorId: 'cyber-factory', floor: 4, type: 'boss', col: 0 };
  const room = factory.create({ node, floor: 4, roomNumber: 10, modifiers: [] });
  const level = new LevelManager().buildDefinition(room, WORLD);
  const row = room.bossRow ?? level.rows - 1;
  let added = null;
  for (let col = 0; col < level.cols && !added; col += 1) {
    added = level.addTransientBlock(col, row, { kind: 'hard', hp: 2, value: 20 });
  }
  assert.ok(added);
  assert.equal(level.blockAt(added.col, added.row), added);
  const before = level.breakableRemaining;
  level.removeTransient(added);
  assert.equal(level.blockAt(added.col, added.row), null);
  assert.equal(level.breakableRemaining, before);
  assert.equal(sectorById('neon-district').name, 'NEON DISTRICT');
});
