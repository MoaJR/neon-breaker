import { GameEngine } from '../../src/core/GameEngine.js';
import { SaveManager } from '../../src/roguelite/SaveManager.js';
import { MetaProgressionManager } from '../../src/roguelite/MetaProgressionManager.js';
import { RogueliteManager } from '../../src/roguelite/RogueliteManager.js';

const noop = () => {};

export function createStorage() {
  const map = new Map();
  return {
    map,
    getBest: () => 0,
    setBest: noop,
    getSettings: () => ({ sound: true, effects: true }),
    setSettings: noop,
    read: (key, fallback) => (map.has(key) ? JSON.parse(JSON.stringify(map.get(key))) : fallback),
    write: (key, value) => map.set(key, JSON.parse(JSON.stringify(value))),
  };
}

export function createHarness(storage = createStorage()) {
  const renderer = {
    resize: noop,
    prepare: noop,
    update: noop,
    draw: noop,
    addShake: noop,
    addFlash: noop,
    setQuality: noop,
    setSectorAccent: noop,
    time: 0,
  };
  const ui = new Proxy({}, { get: () => noop });
  const audio = { init: noop, play: noop, setEnabled: noop, enabled: true };
  const overlay = new Proxy({}, { get: () => noop });
  const engine = new GameEngine({ renderer, ui, audio, storage, input: null });
  engine.resize(1000, 750, 1, 50);
  engine.goMenu();
  const save = new SaveManager(storage);
  const meta = new MetaProgressionManager(save);
  const rl = new RogueliteManager({ engine, ui, overlay, audio, save, meta });
  engine.attachRoguelite(rl);
  return { engine, rl, save, meta, storage, overlay, ui, renderer, audio };
}

export function step(engine, frames = 1, dt = 1 / 60) {
  for (let i = 0; i < frames; i += 1) engine.update(dt);
}

export function clearRoom(engine, damage = 5, guard = 60) {
  let iterations = 0;
  while (engine.level.breakableRemaining > 0 && iterations < guard) {
    for (const block of engine.level.blocks) {
      if (block.alive) engine.applyBlockDamage(block, damage, { source: 'test' });
    }
    iterations += 1;
  }
  return iterations;
}
