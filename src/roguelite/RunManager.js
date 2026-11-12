import { RUN } from './RogueliteConfig.js';
import { createRunId } from './Rng.js';

/**
 * Authoritative run document (mirrored by GameEngine for the live simulation).
 * No DOM and no engine imports: safe to unit test and serialize.
 */
export class RunManager {
  constructor() {
    this.run = null;
  }

  start({ seed, platform, meta, id = null } = {}) {
    const baseLives = meta ? meta.startingLives() : RUN.startingLives;
    const coins = meta ? meta.startingCoins() : 0;
    this.run = {
      id: id ?? createRunId(seed),
      seed,
      platformId: platform?.id ?? 'standard',
      sectorIndex: 0,
      sectorId: '',
      floor: 0,
      roomNumber: 0,
      score: 0,
      coins,
      lives: baseLives,
      baseMaxLives: baseLives,
      maxLives: baseLives,
      combo: 0,
      bestCombo: 0,
      upgrades: Object.create(null),
      relics: [],
      synergies: [],
      modifiersNextRoom: [],
      eventBonuses: { damageBonus: 0 },
      pending: { lifeNextRoom: 0 },
      rerollsLeft: RUN.rerollsPerRun + (meta ? meta.bonusRerolls() : 0),
      survivalTime: 0,
      roomsCleared: 0,
      bossesDefeated: 0,
      stats: {
        blocksDestroyed: 0,
        crits: 0,
        coinsEarned: 0,
        damageDealt: 0,
        shieldsUsed: 0,
      },
      path: [],
      startedAt: Date.now(),
      ended: false,
      victory: false,
    };
    return this.run;
  }

  get state() {
    return this.run;
  }

  get active() {
    return Boolean(this.run) && !this.run.ended;
  }

  setSector(index, id) {
    if (!this.run) return;
    this.run.sectorIndex = index;
    this.run.sectorId = id;
  }

  setFloor(floor) {
    if (!this.run) return;
    this.run.floor = floor;
  }

  enterRoom({ nodeId = null, type = 'combat', floor = 0, roomNumber = null } = {}) {
    if (!this.run) return;
    this.run.roomNumber = roomNumber ?? this.run.roomNumber + 1;
    this.run.floor = floor;
    if (nodeId && !this.run.path.includes(nodeId)) this.run.path.push(nodeId);
  }

  syncLive({ score, coins, lives, combo, bestCombo, survivalTime } = {}) {
    if (!this.run) return;
    if (Number.isFinite(score)) this.run.score = Math.max(0, Math.floor(score));
    if (Number.isFinite(coins)) this.run.coins = Math.max(0, Math.floor(coins));
    if (Number.isFinite(lives)) this.run.lives = Math.max(0, Math.floor(lives));
    if (Number.isFinite(combo)) this.run.combo = Math.max(0, Math.floor(combo));
    if (Number.isFinite(bestCombo)) this.run.bestCombo = Math.max(0, Math.floor(bestCombo));
    if (Number.isFinite(survivalTime)) this.run.survivalTime = Math.max(0, survivalTime);
  }

  addCoins(amount) {
    if (!this.run) return 0;
    const delta = Math.floor(amount);
    this.run.coins = Math.max(0, this.run.coins + delta);
    if (delta > 0) this.run.stats.coinsEarned += delta;
    return this.run.coins;
  }

  spendCoins(amount) {
    if (!this.run) return false;
    const cost = Math.max(0, Math.floor(amount));
    if (this.run.coins < cost) return false;
    this.run.coins -= cost;
    return true;
  }

  addUpgrade(id, level) {
    if (!this.run) return;
    this.run.upgrades[id] = level;
  }

  setUpgrades(map) {
    if (!this.run) return;
    this.run.upgrades = { ...map };
  }

  addRelic(id) {
    if (!this.run || this.run.relics.includes(id)) return;
    this.run.relics.push(id);
  }

  addSynergy(id) {
    if (!this.run || this.run.synergies.includes(id)) return;
    this.run.synergies.push(id);
  }

  setMaxLives(value) {
    if (!this.run) return;
    this.run.maxLives = Math.max(1, Math.min(RUN.maxLives, Math.floor(value)));
  }

  setRerolls(value) {
    if (!this.run) return;
    this.run.rerollsLeft = Math.max(0, Math.floor(value));
  }

  registerRoomClear({ type = 'combat' } = {}) {
    if (!this.run) return;
    this.run.roomsCleared += 1;
    if (type === 'boss') this.run.bossesDefeated += 1;
  }

  recordBlocks(count) {
    if (this.run) this.run.stats.blocksDestroyed += count;
  }

  recordCrit() {
    if (this.run) this.run.stats.crits += 1;
  }

  recordDamage(amount) {
    if (this.run) this.run.stats.damageDealt += Math.max(0, amount);
  }

  addEventBonus(bonus = {}) {
    if (!this.run) return;
    for (const [key, value] of Object.entries(bonus)) {
      if (typeof value !== 'number') continue;
      this.run.eventBonuses[key] = (this.run.eventBonuses[key] ?? 0) + value;
    }
  }

  pendingLife(amount) {
    if (!this.run) return;
    this.run.pending.lifeNextRoom = (this.run.pending.lifeNextRoom ?? 0) + Math.floor(amount);
  }

  clearPending() {
    if (!this.run) return null;
    const pending = { ...this.run.pending };
    this.run.pending = { lifeNextRoom: 0 };
    return pending;
  }

  forceModifiers(ids = []) {
    if (!this.run) return;
    for (const id of ids) {
      if (!this.run.modifiersNextRoom.includes(id)) this.run.modifiersNextRoom.push(id);
    }
  }

  clearModifiers(count = 1) {
    if (!this.run) return 0;
    const removed = Math.min(count, this.run.modifiersNextRoom.length);
    this.run.modifiersNextRoom.splice(this.run.modifiersNextRoom.length - removed, removed);
    return removed;
  }

  consumeNextModifiers() {
    if (!this.run) return [];
    const ids = [...this.run.modifiersNextRoom];
    this.run.modifiersNextRoom.length = 0;
    return ids;
  }

  end({ victory = false } = {}) {
    if (!this.run) return null;
    this.run.ended = true;
    this.run.victory = victory;
    this.run.survivalTime = Math.max(0, this.run.survivalTime);
    return this.run;
  }

  summary() {
    if (!this.run) return null;
    return {
      id: this.run.id,
      seed: this.run.seed,
      platformId: this.run.platformId,
      score: this.run.score,
      coins: this.run.coins,
      lives: this.run.lives,
      bestCombo: this.run.bestCombo,
      roomsCleared: this.run.roomsCleared,
      bossesDefeated: this.run.bossesDefeated,
      survivalTime: this.run.survivalTime,
      upgrades: { ...this.run.upgrades },
      relics: [...this.run.relics],
      synergies: [...this.run.synergies],
      victory: this.run.victory,
      stats: { ...this.run.stats },
    };
  }

  toJSON() {
    return this.run ? JSON.parse(JSON.stringify(this.run)) : null;
  }

  restore(run) {
    if (!run) {
      this.run = null;
      return null;
    }
    this.run = {
      stats: { blocksDestroyed: 0, crits: 0, coinsEarned: 0, damageDealt: 0, shieldsUsed: 0 },
      pending: { lifeNextRoom: 0 },
      eventBonuses: { damageBonus: 0 },
      modifiersNextRoom: [],
      relics: [],
      synergies: [],
      upgrades: {},
      ...run,
    };
    this.run.stats = {
      blocksDestroyed: 0,
      crits: 0,
      coinsEarned: 0,
      damageDealt: 0,
      shieldsUsed: 0,
      ...(run.stats ?? {}),
    };
    this.run.pending = { lifeNextRoom: 0, ...(run.pending ?? {}) };
    this.run.eventBonuses = { damageBonus: 0, ...(run.eventBonuses ?? {}) };
    this.run.upgrades = { ...(run.upgrades ?? {}) };
    this.run.relics = Array.isArray(run.relics) ? [...run.relics] : [];
    this.run.synergies = Array.isArray(run.synergies) ? [...run.synergies] : [];
    this.run.modifiersNextRoom = Array.isArray(run.modifiersNextRoom) ? [...run.modifiersNextRoom] : [];
    return this.run;
  }
}
