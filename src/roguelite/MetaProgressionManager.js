import {
  META_DATA,
  META_NODE_MAP,
  META_NODES,
  PLATFORMS,
  RUN,
  SECTORS,
  platformById,
  sectorById,
} from './RogueliteConfig.js';

/**
 * Permanent progression: DATA currency, unlock tree, platforms, sectors and codex.
 * All state lives in SaveManager so a single document is persisted.
 */
export class MetaProgressionManager {
  constructor(save) {
    this.save = save;
  }

  get meta() {
    return this.save.meta;
  }

  get data() {
    return Math.floor(this.meta.data || 0);
  }

  hasNode(id) {
    return Boolean(id) && this.meta.nodes.includes(id);
  }

  isUnlocked(unlockId) {
    if (!unlockId) return true;
    return this.hasNode(unlockId);
  }

  canBuy(id) {
    const node = META_NODE_MAP.get(id);
    if (!node) return { ok: false, reason: 'Nó inexistente.' };
    if (this.hasNode(id)) return { ok: false, reason: 'Já desbloqueado.' };
    if (node.requires && !this.hasNode(node.requires)) {
      const requirement = META_NODE_MAP.get(node.requires);
      return { ok: false, reason: `Requer ${requirement?.name ?? node.requires}.` };
    }
    if (this.data < node.cost) return { ok: false, reason: 'DATA insuficiente.' };
    return { ok: true, node };
  }

  buy(id) {
    const check = this.canBuy(id);
    if (!check.ok) return check;
    this.meta.data -= check.node.cost;
    this.meta.nodes.push(id);
    if (id.startsWith('platform_')) {
      const platformId = id.replace('platform_', '');
      if (!this.meta.platforms.includes(platformId)) this.meta.platforms.push(platformId);
    }
    this.save.save();
    return { ok: true, node: check.node };
  }

  nodeStatus(id) {
    const node = META_NODE_MAP.get(id);
    if (!node) return 'unknown';
    if (this.hasNode(id)) return 'owned';
    if (node.requires && !this.hasNode(node.requires)) return 'locked';
    if (this.data < node.cost) return 'unaffordable';
    return 'available';
  }

  allNodes() {
    return META_NODES.map((node) => ({ ...node, status: this.nodeStatus(node.id) }));
  }

  platform(id = this.meta.selectedPlatform) {
    return platformById(id, this);
  }

  platforms() {
    return Object.values(PLATFORMS).map((def) => ({
      ...def,
      unlocked: this.isUnlocked(def.unlock),
    }));
  }

  setPlatform(id) {
    const platform = platformById(id, this);
    if (!platform.unlocked) return { ok: false, reason: 'Plataforma bloqueada.' };
    this.meta.selectedPlatform = platform.id;
    this.save.save();
    return { ok: true, platform };
  }

  availableSectors() {
    return SECTORS.filter((sector) => this.isUnlocked(sector.unlock));
  }

  isSectorUnlocked(id) {
    return this.isUnlocked(sectorById(id).unlock);
  }

  startingLives() {
    return RUN.startingLives + (this.hasNode('bonus_life') ? 1 : 0);
  }

  startingCoins() {
    return this.hasNode('bonus_coins') ? 20 : 0;
  }

  bonusRerolls() {
    return this.hasNode('bonus_reroll') ? 1 : 0;
  }

  /** Cosmetic skin color (last owned skin wins). */
  skinColor() {
    const skins = [
      ['skin_cyan', '#5fe4ff'],
      ['skin_amber', '#ffb347'],
      ['skin_violet', '#c9a0ff'],
    ];
    let color = '#5fe4ff';
    for (const [id, value] of skins) {
      if (this.hasNode(id)) color = value;
    }
    return color;
  }

  /** DATA awarded for one finished run (win or loss). */
  computeRunReward(run, { victory = false, bonusMultiplier = 1 } = {}) {
    const rooms = Math.max(0, Math.floor(run?.roomsCleared ?? 0));
    const bosses = Math.max(0, Math.floor(run?.bossesDefeated ?? 0));
    const score = Math.max(0, Math.floor(run?.score ?? 0));
    const coinsEarned = Math.max(0, Math.floor(run?.stats?.coinsEarned ?? run?.coins ?? 0));
    const synergies = Array.isArray(run?.synergies) ? run.synergies.length : 0;
    const breakdown = {
      rooms: rooms * META_DATA.perRoom,
      bosses: bosses * META_DATA.perBoss,
      score: Math.floor(score / META_DATA.perScore),
      coins: Math.floor(coinsEarned / META_DATA.perCoins),
      synergies: synergies * META_DATA.perSynergy,
      victory: victory ? META_DATA.perVictory : 0,
    };
    const base = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    const multiplier = Math.min(META_DATA.maxBonusMultiplier, Math.max(0.5, Number(bonusMultiplier) || 1));
    const total = Math.max(1, Math.floor(base * multiplier));
    return { breakdown, base, multiplier, total };
  }

  awardRun(run, options = {}) {
    const reward = this.computeRunReward(run, options);
    this.meta.data += reward.total;
    this.meta.stats.dataEarned += reward.total;
    this.meta.stats.runs += 1;
    this.meta.stats.bestScore = Math.max(this.meta.stats.bestScore, Math.floor(run?.score ?? 0));
    this.meta.stats.bestRoom = Math.max(this.meta.stats.bestRoom, Math.floor(run?.roomsCleared ?? 0));
    this.meta.stats.bosses += Math.max(0, Math.floor(run?.bossesDefeated ?? 0));
    this.meta.stats.synergies += Array.isArray(run?.synergies) ? run.synergies.length : 0;
    if (options.victory) this.meta.stats.victories += 1;
    this.registerRunCodex(run);
    this.save.save();
    return reward;
  }

  registerRunCodex(run) {
    const codex = this.meta.codex;
    for (const id of Object.keys(run?.upgrades ?? {})) {
      if (!codex.upgrades.includes(id)) codex.upgrades.push(id);
    }
    for (const id of run?.relics ?? []) {
      if (!codex.relics.includes(id)) codex.relics.push(id);
    }
    for (const id of run?.synergies ?? []) {
      if (!codex.synergies.includes(id)) codex.synergies.push(id);
    }
  }

  registerSynergy(id) {
    if (!this.meta.codex.synergies.includes(id)) {
      this.meta.codex.synergies.push(id);
      this.save.save();
    }
  }
}
