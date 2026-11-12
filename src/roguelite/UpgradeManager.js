import { LUCK, RARITIES, RARITY_IDS, RUN, rarityOf } from './RogueliteConfig.js';
import { UPGRADE_LIBRARY, upgradeById, unlockedUpgrades } from './UpgradeLibrary.js';
import { Rng } from './Rng.js';

/**
 * Owns upgrade levels, offer rolling (rarity weights, luck, pity, platform bias)
 * and level-up behaviour. Pure logic — no DOM, no engine imports.
 */
export class UpgradeManager {
  constructor({ meta = null, rng = new Rng(1), platform = null } = {}) {
    this.meta = meta;
    this.rng = rng;
    this.platform = platform;
    this.owned = Object.create(null);
    this.pity = 0;
  }

  reset({ meta = this.meta, platform = this.platform, rng = this.rng } = {}) {
    this.meta = meta;
    this.platform = platform;
    this.rng = rng;
    this.owned = Object.create(null);
    this.pity = 0;
  }

  levelOf(id) {
    return this.owned[id] ?? 0;
  }

  has(id) {
    return this.levelOf(id) > 0;
  }

  maxLevelOf(def) {
    return def?.maxLevel ?? RUN.upgradeMaxLevel;
  }

  isMaxed(id) {
    const def = upgradeById(id);
    return Boolean(def) && this.levelOf(id) >= this.maxLevelOf(def);
  }

  add(id) {
    const def = upgradeById(id);
    if (!def) return { ok: false, reason: 'Upgrade inexistente.' };
    const current = this.levelOf(id);
    if (current >= this.maxLevelOf(def)) {
      return { ok: false, reason: 'Nível máximo.', level: current, maxed: true };
    }
    const next = current + 1;
    this.owned[id] = next;
    return { ok: true, def, level: next, leveledUp: current > 0, maxed: next >= this.maxLevelOf(def) };
  }

  remove(id) {
    const current = this.levelOf(id);
    if (!current) return false;
    this.owned[id] = current - 1;
    if (this.owned[id] <= 0) delete this.owned[id];
    return true;
  }

  /** [{ def, level }] for BuildStats compilation. */
  entries() {
    return Object.entries(this.owned)
      .map(([id, level]) => ({ def: upgradeById(id), level }))
      .filter((entry) => Boolean(entry.def));
  }

  ownedList() {
    return this.entries()
      .map(({ def, level }) => ({ ...def, level, maxLevel: this.maxLevelOf(def) }))
      .sort((a, b) => rarityOf(b.rarity).order - rarityOf(a.rarity).order);
  }

  availableDefs() {
    const pool = this.meta ? unlockedUpgrades(this.meta) : UPGRADE_LIBRARY;
    return pool.filter((def) => this.levelOf(def.id) < this.maxLevelOf(def));
  }

  /** Rarity weights after luck, platform variance and reward bias. */
  rarityWeights({ luck = 0, bias = null, gamble = false } = {}) {
    const weights = Object.fromEntries(RARITY_IDS.map((id) => [id, RARITIES[id].weight]));

    const shift = Math.min(
      weights.common * 0.75,
      weights.common * LUCK.shift * Math.max(0, luck) + Math.max(0, luck) * 0.6,
    );
    if (shift > 0) {
      weights.common -= shift;
      weights.rare += shift * 0.55;
      weights.epic += shift * 0.3;
      weights.legendary += shift * 0.15;
    }

    if (gamble) {
      const average = RARITY_IDS.reduce((sum, id) => sum + weights[id], 0) / RARITY_IDS.length;
      for (const id of RARITY_IDS) {
        weights[id] = weights[id] * (1 - LUCK.gambleFlatten) + average * LUCK.gambleFlatten;
      }
    }

    if (bias) {
      const floor = rarityOf(bias).order;
      let removed = 0;
      for (const id of RARITY_IDS) {
        if (rarityOf(id).order < floor) {
          removed += weights[id];
          weights[id] = 0;
        }
      }
      const high = RARITY_IDS.filter((id) => rarityOf(id).order >= floor);
      const highTotal = high.reduce((sum, id) => sum + weights[id], 0);
      if (highTotal > 0) {
        for (const id of high) weights[id] += (removed * weights[id]) / highTotal;
      } else {
        weights[rarityOf(bias).id] = 1;
      }
    }

    return weights;
  }

  rollRarity({ luck = 0, bias = null, gamble = false } = {}) {
    const weights = this.rarityWeights({ luck, bias, gamble });
    return this.rng.weighted(RARITY_IDS.map((id) => ({ id, weight: weights[id] })))?.id ?? 'common';
  }

  /**
   * Roll `count` distinct upgrades.
   * Options: count, luck, bias (minimum rarity), categoryBias, gamble.
   */
  rollOffers({ count = RUN.rewardChoices, luck = 0, bias = null, categoryBias = null, gamble = false } = {}) {
    const offers = [];
    const used = new Set();
    const pool = this.availableDefs();
    if (pool.length === 0) return offers;

    const forcedBias = this.pity >= RUN.offerPity ? 'rare' : bias;
    let rareSeen = false;

    for (let i = 0; i < count; i += 1) {
      const effectiveBias = i === 0 ? forcedBias : bias;
      let rarity = this.rollRarity({ luck, bias: effectiveBias, gamble });
      let candidates = this.filterPool(pool, rarity, used, categoryBias);
      let guard = 0;
      while (candidates.length === 0 && guard < 8) {
        const index = RARITY_IDS.indexOf(rarity);
        rarity = RARITY_IDS[Math.max(0, index - 1)];
        candidates = this.filterPool(pool, rarity, used, categoryBias);
        guard += 1;
        if (rarity === 'common') break;
      }
      if (candidates.length === 0) candidates = pool.filter((def) => !used.has(def.id));
      if (candidates.length === 0) break;

      const def = this.rng.pick(candidates);
      used.add(def.id);
      const level = this.levelOf(def.id) + 1;
      offers.push({
        kind: 'upgrade',
        id: def.id,
        def,
        rarity: def.rarity,
        level,
        maxLevel: this.maxLevelOf(def),
        isLevelUp: level > 1,
      });
      if (rarityOf(def.rarity).order >= rarityOf('rare').order) rareSeen = true;
    }

    this.pity = rareSeen ? 0 : Math.min(RUN.maxOffersRemembered, this.pity + offers.length);
    return offers;
  }

  filterPool(pool, rarity, used, categoryBias) {
    let candidates = pool.filter((def) => def.rarity === rarity && !used.has(def.id));
    if (candidates.length && categoryBias && this.rng.chance(LUCK.categoryBias)) {
      const biased = candidates.filter((def) => categoryBias.includes(def.category));
      if (biased.length) candidates = biased;
    }
    return candidates;
  }

  toJSON() {
    return { ...this.owned };
  }
}
