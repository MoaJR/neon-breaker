import { SYNERGY_LIBRARY, meetsRequirement, synergyById } from './SynergyLibrary.js';

/** Detects and stores active synergies for a run. */
export class SynergyManager {
  constructor({ meta = null } = {}) {
    this.meta = meta;
    this.active = [];
  }

  reset({ meta = this.meta } = {}) {
    this.meta = meta;
    this.active = [];
  }

  has(id) {
    return this.active.includes(id);
  }

  activeDefs() {
    return this.active.map((id) => synergyById(id)).filter(Boolean);
  }

  /**
   * Compare the current build with every definition.
   * Returns the definitions that just became active.
   */
  check({ upgrades = {}, relics = [] } = {}) {
    const activated = [];
    for (const def of SYNERGY_LIBRARY) {
      if (this.active.includes(def.id)) continue;
      if (!meetsRequirement(def, { upgrades, relics })) continue;
      this.active.push(def.id);
      activated.push(def);
      if (this.meta?.registerSynergy) this.meta.registerSynergy(def.id);
    }
    return activated;
  }

  toJSON() {
    return [...this.active];
  }
}
