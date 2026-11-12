import { RARITIES, RARITY_IDS, RUN, rarityOf } from './RogueliteConfig.js';
import { RELIC_LIBRARY, relicById, unlockedRelics } from './RelicLibrary.js';
import { Rng } from './Rng.js';

/** Owns relics (permanent during a run) and relic offers. */
export class RelicManager {
  constructor({ meta = null, rng = new Rng(1), cap = RUN.relicCap } = {}) {
    this.meta = meta;
    this.rng = rng;
    this.cap = cap;
    this.owned = [];
  }

  reset({ meta = this.meta, rng = this.rng, cap = this.cap } = {}) {
    this.meta = meta;
    this.rng = rng;
    this.cap = cap;
    this.owned = [];
  }

  get size() {
    return this.owned.length;
  }

  get isFull() {
    return this.owned.length >= this.cap;
  }

  has(id) {
    return this.owned.includes(id);
  }

  entries() {
    return this.owned.map((id) => relicById(id)).filter(Boolean);
  }

  add(id) {
    const def = relicById(id);
    if (!def) return { ok: false, reason: 'Relíquia inexistente.' };
    if (this.owned.includes(id)) return { ok: false, reason: 'Relíquia já adquirida.' };
    if (this.isFull) return { ok: false, reason: 'Limite de relíquias atingido.' };
    this.owned.push(id);
    return { ok: true, def };
  }

  remove(id) {
    const index = this.owned.indexOf(id);
    if (index < 0) return false;
    this.owned.splice(index, 1);
    return true;
  }

  availableDefs() {
    if (this.isFull) return [];
    const pool = this.meta ? unlockedRelics(this.meta) : RELIC_LIBRARY;
    return pool.filter((def) => !this.owned.includes(def.id));
  }

  rollOffers({ count = 3, luck = 0, bias = null } = {}) {
    const offers = [];
    const used = new Set();
    const pool = this.availableDefs();
    if (!pool.length) return offers;

    for (let i = 0; i < count && i < pool.length; i += 1) {
      const weights = Object.fromEntries(RARITY_IDS.map((id) => [id, RARITIES[id].weight]));
      if (luck > 0) {
        const shift = Math.min(weights.common * 0.7, luck * 1.2);
        weights.common -= shift;
        weights.rare += shift * 0.6;
        weights.epic += shift * 0.3;
        weights.legendary += shift * 0.1;
      }
      if (bias) {
        const floor = rarityOf(bias).order;
        for (const id of RARITY_IDS) {
          if (rarityOf(id).order < floor) weights[id] = 0;
        }
      }
      let candidates = [];
      let guard = 0;
      let rarity = this.rng.weighted(RARITY_IDS.map((id) => ({ id, weight: weights[id] })))?.id ?? 'rare';
      while (candidates.length === 0 && guard < 6) {
        candidates = pool.filter((def) => def.rarity === rarity && !used.has(def.id));
        if (candidates.length === 0) {
          rarity = RARITY_IDS[Math.max(0, RARITY_IDS.indexOf(rarity) - 1)];
          guard += 1;
          if (rarity === 'common') break;
        }
      }
      if (!candidates.length) candidates = pool.filter((def) => !used.has(def.id));
      if (!candidates.length) break;
      const def = this.rng.pick(candidates);
      used.add(def.id);
      offers.push({ kind: 'relic', id: def.id, def, rarity: def.rarity });
    }
    return offers;
  }

  toJSON() {
    return [...this.owned];
  }
}
