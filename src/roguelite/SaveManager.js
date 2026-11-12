import { SAVE_VERSION, STORAGE_KEY_SAVE } from './RogueliteConfig.js';

export function defaultMetaState() {
  return {
    data: 0,
    nodes: [],
    platforms: ['standard'],
    selectedPlatform: 'standard',
    codex: { upgrades: [], relics: [], synergies: [] },
    stats: {
      runs: 0,
      victories: 0,
      bestScore: 0,
      bestRoom: 0,
      bosses: 0,
      dataEarned: 0,
      synergies: 0,
    },
  };
}

function asNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const item of value) {
    if (typeof item !== 'string' || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

/**
 * Versioned persistence for the roguelite layer.
 * Reads/writes a single v2 document while keeping the legacy best/settings
 * keys untouched (StorageService still owns them).
 */
export class SaveManager {
  constructor(storage) {
    this.storage = storage;
    this.data = this.load();
  }

  defaults() {
    return {
      version: SAVE_VERSION,
      meta: defaultMetaState(),
      activeRun: null,
      best: asNumber(this.storage?.getBest?.(), 0),
      settings: this.storage?.getSettings?.() ?? { sound: true, effects: true },
    };
  }

  load() {
    const raw = this.storage?.read?.(STORAGE_KEY_SAVE, null);
    if (!raw || typeof raw !== 'object') return this.defaults();
    return this.sanitize(this.migrate(raw));
  }

  /** Accepts older/future documents and normalises to the current schema. */
  migrate(raw) {
    const version = asNumber(raw.version, 1, 1, 999);
    let data = { ...raw };
    if (version < 2) {
      data = {
        version: 2,
        meta: raw.meta ?? defaultMetaState(),
        activeRun: null,
        best: raw.best ?? this.storage?.getBest?.() ?? 0,
        settings: raw.settings ?? this.storage?.getSettings?.() ?? { sound: true, effects: true },
      };
    } else if (version > SAVE_VERSION) {
      data.version = SAVE_VERSION;
    }
    return data;
  }

  sanitize(raw) {
    const defaults = this.defaults();
    const metaRaw = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
    const codexRaw = metaRaw.codex && typeof metaRaw.codex === 'object' ? metaRaw.codex : {};
    const statsRaw = metaRaw.stats && typeof metaRaw.stats === 'object' ? metaRaw.stats : {};
    const platforms = uniqueStrings(metaRaw.platforms);
    const meta = {
      data: asNumber(metaRaw.data, 0),
      nodes: uniqueStrings(metaRaw.nodes),
      platforms: platforms.length ? platforms : ['standard'],
      selectedPlatform: typeof metaRaw.selectedPlatform === 'string' ? metaRaw.selectedPlatform : 'standard',
      codex: {
        upgrades: uniqueStrings(codexRaw.upgrades),
        relics: uniqueStrings(codexRaw.relics),
        synergies: uniqueStrings(codexRaw.synergies),
      },
      stats: {
        runs: asNumber(statsRaw.runs, 0),
        victories: asNumber(statsRaw.victories, 0),
        bestScore: asNumber(statsRaw.bestScore, 0),
        bestRoom: asNumber(statsRaw.bestRoom, 0),
        bosses: asNumber(statsRaw.bosses, 0),
        dataEarned: asNumber(statsRaw.dataEarned, 0),
        synergies: asNumber(statsRaw.synergies, 0),
      },
    };
    if (!meta.platforms.includes('standard')) meta.platforms.unshift('standard');
    if (!meta.platforms.includes(meta.selectedPlatform)) meta.selectedPlatform = 'standard';

    const activeRunRaw = raw.activeRun;
    const activeRun =
      activeRunRaw && typeof activeRunRaw === 'object' && activeRunRaw.run && typeof activeRunRaw.run.id === 'string'
        ? activeRunRaw
        : null;
    return {
      version: SAVE_VERSION,
      meta,
      activeRun,
      best: asNumber(raw.best ?? defaults.best, 0),
      settings: {
        sound: raw.settings?.sound !== false,
        effects: raw.settings?.effects !== false,
      },
    };
  }

  save() {
    this.storage?.write?.(STORAGE_KEY_SAVE, this.data);
  }

  get meta() {
    return this.data.meta;
  }

  get activeRun() {
    return this.data.activeRun;
  }

  setActiveRun(run) {
    this.data.activeRun = run ?? null;
    this.save();
  }

  clearActiveRun() {
    this.data.activeRun = null;
    this.save();
  }

  addData(amount) {
    this.meta.data += asNumber(amount, 0);
    this.meta.stats.dataEarned += asNumber(amount, 0);
    this.save();
  }

  setPlatform(id) {
    this.meta.selectedPlatform = id;
    this.save();
  }
}
