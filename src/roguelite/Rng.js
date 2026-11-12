/**
 * Deterministic pseudo-random generator used by the roguelite layer.
 * Gameplay physics keeps using Math.random (feel), while maps, offers,
 * shops and events use seeded streams so a run is reproducible/testable.
 */
export function hashString(value) {
  const text = String(value ?? '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32 — tiny, fast, good enough for game generation. */
export class Rng {
  constructor(seed = 1) {
    this.seed = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
    this.state = this.seed || 1;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(min = 0, max = 1) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    if (max < min) return min;
    return Math.floor(this.float(min, max + 1));
  }

  chance(probability) {
    return this.next() < probability;
  }

  pick(list) {
    if (!list || list.length === 0) return null;
    return list[Math.floor(this.next() * list.length)];
  }

  shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /** entries: [{ weight, ... }] → returns one entry. */
  weighted(entries) {
    if (!entries || entries.length === 0) return null;
    let total = 0;
    for (const entry of entries) total += Math.max(0, entry.weight ?? 0);
    if (total <= 0) return this.pick(entries);
    let roll = this.next() * total;
    for (const entry of entries) {
      roll -= Math.max(0, entry.weight ?? 0);
      if (roll <= 0) return entry;
    }
    return entries[entries.length - 1];
  }

  /** Fork a child stream so subsystems do not consume each other's numbers. */
  fork(label = '') {
    return new Rng((this.seed ^ hashString(label)) >>> 0);
  }
}

export function createRunSeed() {
  const now = Date.now().toString(36);
  const random = Math.floor(Math.random() * 0xffffffff).toString(36);
  return `${now}-${random}`;
}

export function createRunId(seed) {
  return `run_${hashString(seed).toString(36)}${String(Date.now() % 100000).padStart(5, '0')}`;
}
