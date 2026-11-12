import { DIFFICULTY } from './RogueliteConfig.js';
import { MODIFIER_LIBRARY, modifierById } from './ModifierLibrary.js';

/** Rolls the room modifiers announced in the briefing. */
export class RoomModifierManager {
  constructor({ rng }) {
    this.rng = rng;
  }

  reset({ rng = this.rng } = {}) {
    this.rng = rng;
  }

  roll({ sectorIndex = 0, extra = 0, elite = false, firstRoom = false, forced = [] } = {}) {
    const base = DIFFICULTY.modifierCount[Math.min(sectorIndex, DIFFICULTY.modifierCount.length - 1)] ?? 1;
    let count = base + extra + (elite ? 1 : 0);
    if (firstRoom) count = Math.max(0, count - 1);

    const ids = [];
    for (const id of forced) {
      if (modifierById(id) && !ids.includes(id)) ids.push(id);
    }
    const pool = MODIFIER_LIBRARY.filter((def) => !ids.includes(def.id));
    while (ids.length < count) {
      const options = pool.filter((def) => !ids.includes(def.id));
      if (!options.length) break;
      const def = this.rng.weighted(options.map((item) => ({ ...item, weight: item.weight })));
      if (!def) break;
      ids.push(def.id);
    }
    return ids;
  }

  defs(ids = []) {
    return ids.map((id) => modifierById(id)).filter(Boolean);
  }

  /** Pick exactly `count` random modifier ids (events/anomalies). */
  rollExact(count = 1) {
    const ids = [];
    const pool = [...MODIFIER_LIBRARY];
    while (ids.length < count && pool.length) {
      const index = Math.floor((this.rng?.next?.() ?? Math.random()) * pool.length);
      const [def] = pool.splice(index, 1);
      if (def) ids.push(def.id);
    }
    return ids;
  }
}
