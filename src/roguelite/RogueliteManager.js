import { BOSS_REWARDS, COINS, REWARD_CONTEXTS, RUN } from './RogueliteConfig.js';
import { Rng } from './Rng.js';
import { RunManager } from './RunManager.js';
import { UpgradeManager } from './UpgradeManager.js';
import { RelicManager } from './RelicManager.js';
import { SynergyManager } from './SynergyManager.js';
import { RoomModifierManager } from './RoomModifierManager.js';
import { modifierById } from './ModifierLibrary.js';
import { MapManager } from './MapManager.js';
import { RoomFactory } from './RoomFactory.js';
import { ShopManager } from './ShopManager.js';
import { EventManager } from './EventManager.js';
import { compileBuild } from './BuildStats.js';

/**
 * Orchestrates the entire roguelite flow: runs, map, rooms, rewards, shop,
 * events, bosses, meta progression and the save/resume boundary.
 */
export class RogueliteManager {
  constructor({ engine, ui, overlay, audio, save, meta }) {
    this.engine = engine;
    this.ui = ui;
    this.overlay = overlay;
    this.audio = audio;
    this.save = save;
    this.meta = meta;

    this.runs = new RunManager();
    this.upgrades = new UpgradeManager({ meta });
    this.relics = new RelicManager({ meta });
    this.synergies = new SynergyManager({ meta });
    this.modifiers = new RoomModifierManager({ rng: new Rng(1) });
    this.map = new MapManager();
    this.factory = new RoomFactory({ rng: new Rng(1) });
    this.shop = new ShopManager({ rng: new Rng(1) });
    this.events = new EventManager({ rng: new Rng(1) });

    this.run = null;
    this.rng = null;
    this.platform = null;
    this.build = null;
    this.screen = 'none';
    this.currentNode = null;
    this.currentRoom = null;
    this.currentSector = null;
    this.rewardOffers = [];
    this.rewardContext = 'room';
    this.rewardDone = null;
    this.rewardRerolls = 0;
    this.eventState = null;
    this.shopState = null;
    this.inventoryReturn = null;
  }

  /* ───────────────────────────── helpers ───────────────────────────── */

  isOverlayActive() {
    return this.screen !== 'none';
  }

  view() {
    return {
      screen: this.screen,
      sectorIndex: this.run?.sectorIndex ?? 0,
      sectorName: this.currentSector?.name ?? '',
      roomNumber: this.run?.roomNumber ?? 0,
      coins: this.run?.coins ?? 0,
      offerIds: this.rewardOffers.map((offer) => offer.id),
      rerolls: this.rewardRerolls,
    };
  }

  runView() {
    if (!this.run) return null;
    return {
      ...this.run,
      upgrades: this.upgrades.ownedList(),
      relics: this.relics.entries(),
      synergies: this.synergies.activeDefs(),
      build: this.build,
    };
  }

  computeBuild() {
    if (!this.run) return null;
    const build = compileBuild({
      upgrades: this.upgrades.entries(),
      relics: this.relics.entries(),
      synergies: this.synergies.activeDefs(),
      platform: this.platform,
      extraBonus: this.run.eventBonuses,
    });
    this.build = build;
    const maxLives = Math.max(1, Math.min(RUN.maxLives, (this.run.baseMaxLives ?? RUN.startingLives) + build.maxLivesBonus));
    this.run.maxLives = maxLives;
    this.engine.mode = 'run';
    this.engine.run = this.run;
    this.engine.setBuild(build);
    this.engine.run.maxLives = maxLives;
    if (this.engine.lives > maxLives) this.engine.setLives(maxLives, { maxLives });
    this.engine.ui.updateRunHud?.({
      mode: 'run',
      coins: this.engine.coins,
      sector: this.currentSector?.name ?? '',
      sectorIndex: this.run.sectorIndex,
      roomNumber: this.run.roomNumber,
    });
    return build;
  }

  addUpgrade(id) {
    const result = this.upgrades.add(id);
    if (!result.ok) return result;
    this.runs.setUpgrades(this.upgrades.toJSON());
    this.audio.play('card');
    this.ui.toast?.(
      result.leveledUp ? `${result.def.name} → LV ${result.level}` : `NOVO: ${result.def.name}`,
      result.def.rarity === 'legendary' ? '#ffd24a' : '#38dcff',
    );
    this.checkSynergies();
    this.computeBuild();
    return result;
  }

  addRelic(id) {
    const result = this.relics.add(id);
    if (!result.ok) return result;
    this.runs.addRelic(id);
    this.audio.play('relic');
    this.ui.toast?.(`RELÍQUIA: ${result.def.name}`, '#ffd24a');
    this.checkSynergies();
    this.computeBuild();
    return result;
  }

  checkSynergies() {
    if (!this.run) return [];
    const activated = this.synergies.check({
      upgrades: this.upgrades.toJSON(),
      relics: this.relics.owned,
    });
    for (const def of activated) {
      this.runs.addSynergy(def.id);
      this.audio.play('synergy');
      this.overlay?.banner?.(`SINERGIA: ${def.name}`, def.desc, def.color);
      this.ui.toast?.(`SINERGIA: ${def.name}`, def.color);
    }
    return activated;
  }

  randomRelic(bias = null) {
    const offers = this.relics.rollOffers({ count: 1, bias, luck: this.build?.luck ?? 0 });
    if (!offers.length) {
      this.engine.addCoins(80, this.engine.paddle.centerX, this.engine.paddle.y - 60);
      this.ui.toast?.('SEM ESPAÇO PARA RELÍQUIA: +80 MOEDAS', '#ffd24a');
      return null;
    }
    const result = this.addRelic(offers[0].id);
    return result.ok ? result.def : null;
  }

  randomUpgrades(bias = null, count = 1) {
    const offers = this.upgrades.rollOffers({
      count,
      bias,
      luck: this.build?.luck ?? 0,
    });
    const names = [];
    for (const offer of offers) {
      const result = this.addUpgrade(offer.id);
      if (result.ok) names.push(`${result.def.name} LV${result.level}`);
    }
    return names;
  }

  removeRandomUpgrade() {
    const owned = this.upgrades.ownedList();
    if (!owned.length) return null;
    const target = owned[Math.floor(Math.random() * owned.length)];
    this.upgrades.remove(target.id);
    this.runs.setUpgrades(this.upgrades.toJSON());
    this.computeBuild();
    return `${target.name} (LV ${target.level})`;
  }

  persistRun() {
    if (!this.run || this.run.ended) return;
    this.save.setActiveRun({
      run: this.runs.toJSON(),
      map: this.map.toJSON(),
      savedAt: Date.now(),
    });
  }

  hasSavedRun() {
    const saved = this.save.activeRun;
    return Boolean(saved && saved.run && !saved.run.ended);
  }

  startRun({ seed = null } = {}) {
    const finalSeed = seed ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
    this.rng = new Rng(finalSeed);
    this.platform = this.meta.platform();
    this.run = this.runs.start({ seed: finalSeed, platform: this.platform, meta: this.meta });
    this.engine.audio?.init?.();
    this.engine.mode = 'run';
    this.engine.run = this.run;
    this.engine.score = 0;
    this.engine.coins = 0;
    this.engine.combo = 0;
    this.engine.bestCombo = 0;
    this.engine.survival = 0;
    this.engine.phoenixUsed = false;
    this.engine.levelScore = 0;

    this.upgrades.reset({ meta: this.meta, platform: this.platform, rng: this.rng.fork('upgrades') });
    this.relics.reset({ meta: this.meta, rng: this.rng.fork('relics') });
    this.synergies.reset({ meta: this.meta });
    this.modifiers.reset({ rng: this.rng.fork('modifiers') });
    this.factory.reset({ rng: this.rng.fork('rooms') });
    this.shop.rng = this.rng.fork('shop');
    this.events.rng = this.rng.fork('events');

    this.screen = 'none';
    this.currentNode = null;
    this.currentRoom = null;
    this.rewardOffers = [];
    this.rewardDone = null;
    this.rewardRerolls = 0;

    this.engine.clearField();
    this.engine.ui.hideAllScreens?.();
    this.engine.ui.updateCoins?.(0);
    this.overlay?.close?.();
    this.computeBuild();
    this.engine.setLives(this.run.lives, { maxLives: this.run.maxLives });
    this.engine.setCoins(this.run.coins);
    this.engine.enterOverlay();
    this.ui.updateRunHud?.({
      mode: 'run',
      coins: this.engine.coins,
      sector: 'NEON DISTRICT',
      sectorIndex: 0,
      roomNumber: 0,
    });
    this.startSector(0);
    return this.run;
  }

  continueSavedRun() {
    const saved = this.save.activeRun;
    if (!saved?.run) return false;
    this.rng = new Rng(saved.run.seed);
    this.platform = this.meta.platform(saved.run.platformId);
    this.runs.restore(saved.run);
    this.run = this.runs.state;
    this.engine.mode = 'run';
    this.engine.run = this.run;
    this.engine.score = this.run.score;
    this.engine.coins = this.run.coins;
    this.engine.combo = this.run.combo;
    this.engine.bestCombo = this.run.bestCombo;
    this.engine.survival = this.run.survivalTime;
    this.engine.phoenixUsed = false;

    this.upgrades.reset({ meta: this.meta, platform: this.platform, rng: this.rng.fork('upgrades') });
    this.upgrades.owned = { ...(this.run.upgrades ?? {}) };
    this.relics.reset({ meta: this.meta, rng: this.rng.fork('relics') });
    this.relics.owned = [...(this.run.relics ?? [])];
    this.synergies.reset({ meta: this.meta });
    this.synergies.active = [...(this.run.synergies ?? [])];
    this.modifiers.reset({ rng: this.rng.fork('modifiers') });
    this.factory.reset({ rng: this.rng.fork('rooms') });
    this.shop.rng = this.rng.fork('shop');
    this.events.rng = this.rng.fork('events');

    this.computeBuild();
    this.engine.setLives(this.run.lives, { maxLives: this.run.maxLives });
    this.engine.setCoins(this.run.coins);
    this.engine.clearField();
    this.engine.ui.hideAllScreens?.();
    this.engine.enterOverlay();
    this.startSector(this.run.sectorIndex, saved.map);
    return true;
  }

  startSector(index, restoreMap = null) {
    const available = this.meta.availableSectors();
    const sector = available.find((item) => item.index === index);
    if (!sector) return this.finishRun(true);
    this.currentSector = sector;
    this.map.startSector({
      sectorIndex: sector.index,
      rng: this.rng.fork(`map-${sector.index}-${this.run.id}`),
    });
    if (restoreMap) this.map.restore(restoreMap);
    this.runs.setSector(sector.index, sector.id);
    this.runs.setFloor(0);
    this.currentNode = null;
    this.currentRoom = null;
    this.showMap();
    return true;
  }

  showMap() {
    if (!this.run || this.run.ended) return;
    this.screen = 'map';
    this.engine.enterOverlay();
    this.persistRun();
    this.overlay?.showMap?.(
      {
        map: this.map.view(),
        run: this.runView(),
        sector: this.currentSector,
        canContinue: false,
      },
      {
        onEnter: (id) => this.enterNode(id),
        onAbandon: () => this.abandonRun(),
      },
    );
  }

  enterNode(nodeId) {
    if (this.screen !== 'map') return null;
    const node = this.map.enter(nodeId);
    if (!node) return null;
    this.currentNode = node;
    this.runs.enterRoom({
      nodeId,
      type: node.type,
      floor: node.floor,
      roomNumber: (this.run.roomNumber || 0) + 1,
    });
    this.ui.updateRunHud?.({
      mode: 'run',
      coins: this.engine.coins,
      sector: this.currentSector?.name ?? '',
      sectorIndex: this.run.sectorIndex,
      roomNumber: this.run.roomNumber,
    });
    this.audio.play('map');

    switch (node.type) {
      case 'shop':
        this.openShop();
        break;
      case 'event':
        this.openEvent();
        break;
      case 'rest':
        this.openRest();
        break;
      case 'treasure':
        this.openTreasure();
        break;
      default:
        this.prepareCombatRoom(node);
        break;
    }
    return node;
  }

  prepareCombatRoom(node) {
    const elite = node.type === 'elite';
    const forced = this.runs.consumeNextModifiers();
    let modifiers = this.modifiers.roll({
      sectorIndex: this.currentSector?.index ?? 0,
      extra: this.build?.extraModifiers ?? 0,
      elite,
      firstRoom: node.floor === 0,
      forced,
    });
    // Boss telegraphs are important: never hide them behind DARKNESS, and skip
    // modifiers that only affect normal block layouts.
    if (node.type === 'boss') {
      modifiers = modifiers.filter((id) => !['darkness', 'armored', 'double_trouble'].includes(id));
    }
    const room = this.factory.create({
      node,
      floor: node.floor,
      roomNumber: this.run.roomNumber,
      modifiers,
    });
    this.currentRoom = room;
    this.screen = 'briefing';
    this.engine.enterOverlay();
    this.overlay?.showBriefing?.(
      {
        room,
        modifiers: modifiers.map((id) => modifierById(id)).filter(Boolean),
        sector: this.currentSector,
        run: this.runView(),
      },
      { onStart: () => this.startRoomPlay() },
    );
  }

  startRoomPlay() {
    if (this.screen !== 'briefing' || !this.currentRoom) return;
    const pending = this.runs.clearPending();
    if (pending?.lifeNextRoom) {
      const next = Math.max(1, this.engine.lives + pending.lifeNextRoom);
      this.engine.setLives(next, { maxLives: this.run.maxLives });
      this.ui.toast?.(
        pending.lifeNextRoom < 0 ? 'CONTRATO: −1 VIDA NESTA SALA' : `EVENTO: +${pending.lifeNextRoom} VIDA`,
        pending.lifeNextRoom < 0 ? '#ff4a55' : '#43f59b',
      );
    }
    this.computeBuild();
    this.screen = 'none';
    this.overlay?.close?.();
    this.engine.startRoom(this.currentRoom);
  }

  /* ───────────────────────────── rewards ───────────────────────────── */

  onRoomClearFinished() {
    if (!this.run || this.run.ended) return;
    this.engine.syncRunLive();
    const node = this.currentNode;
    if (node?.type === 'boss' && this.relics.size < this.relics.cap) {
      this.randomRelic('epic');
    }
    this.map.completeCurrent();
    this.runs.registerRoomClear({ type: node?.type ?? 'combat' });
    this.engine.syncRunLive();

    const context = node?.type === 'boss' ? 'boss' : node?.type === 'elite' ? 'elite' : 'room';
    const bias = node?.type === 'boss' ? 'epic' : node?.type === 'elite' ? 'rare' : null;
    this.openReward({ context, bias, count: RUN.rewardChoices, onDone: () => this.afterCombatReward(node) });
  }

  openReward({ context = 'room', bias = null, count = RUN.rewardChoices, onDone = null } = {}) {
    const def = REWARD_CONTEXTS[context] ?? REWARD_CONTEXTS.room;
    const offers = this.upgrades.rollOffers({
      count,
      bias: bias ?? def.bias ?? null,
      luck: this.build?.luck ?? 0,
      categoryBias: this.platform?.categoryBias ?? null,
      gamble: Boolean(this.platform?.gamble),
    });
    if (!offers.length) offers.push({ kind: 'coins', id: 'coins', amount: 80, rarity: 'common' });
    this.rewardContext = context;
    this.rewardOffers = offers;
    this.rewardDone = onDone;
    this.rewardRerolls = this.run?.rerollsLeft ?? 0;
    this.rewardRequest = { context, bias, count };
    this.screen = 'reward';
    this.engine.enterOverlay();
    this.renderReward(def);
  }

  renderReward(def = REWARD_CONTEXTS[this.rewardContext] ?? REWARD_CONTEXTS.room) {
    this.overlay?.showReward?.(
      {
        offers: this.rewardOffers,
        context: this.rewardContext,
        label: def.label,
        sub: def.sub,
        run: this.runView(),
        rerolls: this.rewardRerolls,
        coins: this.engine.coins,
      },
      {
        onPick: (index) => this.pickReward(index),
        onReroll: () => this.rerollReward(),
      },
    );
  }

  rerollReward() {
    if (this.screen !== 'reward' || !this.run) return;
    if (this.run.rerollsLeft <= 0) {
      this.audio.play('error');
      this.ui.toast?.('SEM REROLLS', '#ff4a55');
      return;
    }
    this.run.rerollsLeft -= 1;
    this.rewardRerolls = this.run.rerollsLeft;
    const request = this.rewardRequest ?? { context: this.rewardContext, bias: null, count: RUN.rewardChoices };
    const def = REWARD_CONTEXTS[request.context] ?? REWARD_CONTEXTS.room;
    this.rewardOffers = this.upgrades.rollOffers({
      count: request.count,
      bias: request.bias ?? def.bias ?? null,
      luck: this.build?.luck ?? 0,
      categoryBias: this.platform?.categoryBias ?? null,
      gamble: Boolean(this.platform?.gamble),
    });
    if (!this.rewardOffers.length) this.rewardOffers.push({ kind: 'coins', id: 'coins', amount: 80, rarity: 'common' });
    this.audio.play('card');
    this.renderReward(def);
  }

  pickReward(index) {
    if (this.screen !== 'reward') return;
    const offer = this.rewardOffers[index];
    if (!offer) return;
    if (offer.kind === 'relic') this.addRelic(offer.id);
    else if (offer.kind === 'coins') this.engine.addCoins(offer.amount, null, null, true);
    else this.addUpgrade(offer.id);

    this.engine.syncRunLive();
    this.screen = 'none';
    this.overlay?.close?.();
    const done = this.rewardDone;
    this.rewardDone = null;
    this.rewardOffers = [];
    if (done) done();
  }

  afterCombatReward(node) {
    if (!this.run) return;
    if (node?.type === 'boss') {
      const available = this.meta.availableSectors();
      const position = available.findIndex((sector) => sector.index === this.run.sectorIndex);
      if (position >= 0 && position + 1 < available.length) {
        this.startSector(available[position + 1].index);
      } else {
        this.finishRun(true);
      }
      return;
    }
    this.showMap();
  }

  /* ───────────────────────────── special nodes ───────────────────────────── */

  openShop() {
    this.screen = 'shop';
    this.engine.enterOverlay();
    this.shop.open({
      upgradeManager: this.upgrades,
      relicManager: this.relics,
      sectorIndex: this.currentSector?.index ?? 0,
      discount: this.build?.shopDiscount ?? 0,
      luck: this.build?.luck ?? 0,
    });
    this.renderShop();
  }

  renderShop() {
    this.overlay?.showShop?.(
      {
        view: this.shop.view(this.engine.coins),
        run: this.runView(),
        sector: this.currentSector,
        coins: this.engine.coins,
      },
      {
        onBuy: (itemId) => this.buyShopItem(itemId),
        onReroll: () => this.rerollShop(),
        onLeave: () => this.leaveNode('shop'),
      },
    );
  }

  buyShopItem(itemId) {
    const check = this.shop.canBuy(itemId, this.engine.coins);
    if (!check.ok) {
      this.audio.play('error');
      this.ui.toast?.(check.reason, '#ff4a55');
      return false;
    }
    if (check.item.kind === 'heal' && this.engine.lives >= this.run.maxLives) {
      this.audio.play('error');
      this.ui.toast?.('VIDA JÁ ESTÁ CHEIA', '#ff4a55');
      return false;
    }
    if (!this.engine.spendCoins(check.item.price)) return false;
    const item = this.shop.purchase(itemId);
    if (!item) return false;
    if (item.kind === 'upgrade') this.addUpgrade(item.id);
    else if (item.kind === 'relic') this.addRelic(item.id);
    else if (item.kind === 'heal') this.engine.addLife();
    else if (item.kind === 'special') {
      this.runs.setRerolls(this.run.rerollsLeft + 1);
      this.ui.toast?.('+1 REROLL DE RECOMPENSA', '#ffd24a');
    }
    this.audio.play('shop');
    this.engine.syncRunLive();
    this.renderShop();
    return true;
  }

  rerollShop() {
    const check = this.shop.canReroll(this.engine.coins);
    if (!check.ok) {
      this.audio.play('error');
      this.ui.toast?.(check.reason, '#ff4a55');
      return false;
    }
    if (!this.engine.spendCoins(check.price)) return false;
    this.shop.rerollPaid({ luck: this.build?.luck ?? 0, price: check.price });
    this.audio.play('shop');
    this.renderShop();
    return true;
  }

  openEvent() {
    const event = this.events.pick();
    this.eventState = { event, result: null };
    this.screen = 'event';
    this.engine.enterOverlay();
    this.overlay?.showEvent?.({ event, run: this.runView() }, { onChoose: (choiceId) => this.chooseEvent(choiceId) });
  }

  eventApi() {
    return {
      rng: this.rng,
      coins: () => this.engine.coins,
      addCoins: (amount) => this.engine.addCoins(amount, null, null, true),
      lives: () => this.engine.lives,
      maxLives: () => this.run.maxLives,
      changeLives: (amount) => {
        const next = Math.max(1, Math.min(this.run.maxLives, this.engine.lives + amount));
        this.engine.setLives(next, { maxLives: this.run.maxLives });
      },
      addData: (amount) => {
        this.save.addData(amount);
        this.ui.toast?.(`+${amount} DATA`, '#ffd24a');
      },
      pendingLife: (amount) => this.runs.pendingLife(amount),
      addRandomRelic: (bias) => this.randomRelic(bias),
      addRandomUpgrades: (bias, count) => this.randomUpgrades(bias, count),
      removeRandomUpgrade: () => this.removeRandomUpgrade(),
      forceModifiers: (count) => {
        const ids = this.modifiers.rollExact(count);
        this.runs.forceModifiers(ids);
        return ids.map((id) => modifierById(id)?.name).filter(Boolean);
      },
      clearModifiers: (count) => this.runs.clearModifiers(count),
      addEventBonus: (bonus) => this.runs.addEventBonus(bonus),
    };
  }

  chooseEvent(choiceId) {
    if (this.screen !== 'event' || !this.eventState?.event) return;
    const result = this.events.resolve(this.eventState.event.id, choiceId, this.eventApi());
    if (!result.ok) {
      this.audio.play('error');
      this.ui.toast?.(result.reason, '#ff4a55');
      return;
    }
    this.eventState.result = result;
    this.screen = 'eventResult';
    this.computeBuild();
    this.overlay?.showEventResult?.(
      {
        event: result.event,
        choice: result.choice,
        lines: result.lines,
        run: this.runView(),
      },
      { onContinue: () => this.finishEvent() },
    );
  }

  finishEvent() {
    const result = this.eventState?.result;
    if (result?.followUp?.type === 'reward') {
      this.openReward({
        context: 'event',
        bias: result.followUp.bias ?? null,
        count: result.followUp.count ?? 2,
        onDone: () => this.leaveNode('event'),
      });
      return;
    }
    this.leaveNode('event');
  }

  openRest() {
    const upgradable = this.upgrades.ownedList().filter((upgrade) => upgrade.level < upgrade.maxLevel);
    const candidate = upgradable.length ? upgradable[Math.floor(Math.random() * upgradable.length)] : null;
    this.restUpgrade = candidate;
    this.screen = 'rest';
    this.engine.enterOverlay();
    this.overlay?.showRest?.(
      {
        run: this.runView(),
        canHeal: this.engine.lives < this.run.maxLives,
        canUpgrade: Boolean(candidate),
        upgradeName: candidate?.name ?? null,
      },
      {
        onHeal: () => this.chooseRest('heal'),
        onUpgrade: () => this.chooseRest('upgrade'),
        onLeave: () => this.chooseRest('leave'),
      },
    );
  }

  chooseRest(kind) {
    if (this.screen !== 'rest') return;
    if (kind === 'heal') {
      if (this.engine.lives < this.run.maxLives) {
        this.engine.addLife();
        this.ui.toast?.('DESCANSO: +1 VIDA', '#43f59b');
      } else {
        this.engine.addCoins(40, null, null, true);
        this.ui.toast?.('VIDA CHEIA: +40 MOEDAS', '#43f59b');
      }
    } else if (kind === 'upgrade' && this.restUpgrade) {
      const result = this.addUpgrade(this.restUpgrade.id);
      if (result.ok) this.ui.toast?.(`REFORÇADO: ${result.def.name} LV ${result.level}`, '#38dcff');
    } else {
      this.engine.addCoins(30, null, null, true);
      this.ui.toast?.('DESCANSO: +30 MOEDAS', '#43f59b');
    }
    this.leaveNode('rest');
  }

  openTreasure() {
    const count = 3 + ((this.build?.relicBonus ?? 0) >= 0.45 ? 1 : 0);
    const offers = this.relics.rollOffers({ count, bias: null, luck: this.build?.luck ?? 0 });
    this.treasureOffers = offers;
    this.screen = 'treasure';
    this.engine.enterOverlay();
    this.overlay?.showTreasure?.(
      {
        offers,
        full: this.relics.isFull,
        run: this.runView(),
        coins: this.engine.coins,
      },
      {
        onPick: (index) => this.pickTreasure(index),
        onCoins: () => {
          this.engine.addCoins(120, null, null, true);
          this.ui.toast?.('TESOURO CONVERTIDO: +120 MOEDAS', '#ffd24a');
          this.leaveNode('treasure');
        },
      },
    );
  }

  pickTreasure(index) {
    if (this.screen !== 'treasure') return;
    const offer = this.treasureOffers?.[index] ?? null;
    if (offer) this.addRelic(offer.id);
    this.treasureOffers = [];
    this.leaveNode('treasure');
  }

  leaveNode() {
    if (!this.run || this.run.ended) return;
    this.map.completeCurrent();
    this.engine.syncRunLive();
    this.screen = 'none';
    this.overlay?.close?.();
    this.showMap();
  }

  /* ───────────────────────────── end of run ───────────────────────────── */

  finishRun(victory = false) {
    if (!this.run || this.run.ended) return;
    this.engine.syncRunLive();
    this.engine.saveBest?.();
    this.runs.end({ victory });
    const reward = this.meta.awardRun(this.run, {
      victory,
      bonusMultiplier: 1 + (this.build?.dataBonus ?? 0),
    });
    this.save.clearActiveRun();
    this.screen = 'summary';
    this.engine.enterOverlay();
    this.engine.ui.hideBossBar?.();
    this.audio.play(victory ? 'record' : 'gameover');
    this.overlay?.showSummary?.(
      {
        run: this.runView(),
        summary: this.runs.summary(),
        reward,
        victory,
        sector: this.currentSector,
        data: this.meta.data,
      },
      {
        onRetry: () => this.startRun(),
        onMenu: () => this.quitToMenu(),
      },
    );
  }

  onRunLost() {
    this.finishRun(false);
  }

  abandonRun() {
    this.save.clearActiveRun();
    this.run = null;
    this.screen = 'none';
    this.overlay?.close?.();
    this.engine.run = null;
    this.engine.build = null;
    this.engine.goMenu();
    this.ui.toast?.('RUN ABANDONADA', '#ff4a55');
  }

  quitToMenu() {
    if (this.run && !this.run.ended && this.run.roomsCleared > 0) {
      // Walking away from an active run is an abandon (no DATA awarded).
      this.save.clearActiveRun();
    }
    this.run = null;
    this.screen = 'none';
    this.overlay?.close?.();
    this.engine.run = null;
    this.engine.build = null;
    this.engine.goMenu();
  }

  /* ───────────────────────────── meta / inventory ───────────────────────────── */

  openMeta() {
    this.screen = 'meta';
    this.engine.goMenu();
    this.overlay?.close?.();
    this.renderMeta();
  }

  renderMeta() {
    this.engine.renderer?.setPaddleAccent?.(this.meta.skinColor());
    this.overlay?.showMeta?.(
      {
        data: this.meta.data,
        nodes: this.meta.allNodes(),
        platforms: this.meta.platforms(),
        selected: this.meta.meta.selectedPlatform,
        stats: this.meta.meta.stats,
        codex: this.meta.meta.codex,
        hasSavedRun: this.hasSavedRun(),
      },
      {
        onBuy: (id) => this.buyMetaNode(id),
        onSelectPlatform: (id) => this.selectPlatform(id),
        onContinue: () => {
          this.closeMeta();
          this.continueSavedRun();
        },
        onClose: () => this.closeMeta(),
      },
    );
  }

  buyMetaNode(id) {
    const result = this.meta.buy(id);
    if (!result.ok) {
      this.audio.play('error');
      this.ui.toast?.(result.reason, '#ff4a55');
      return false;
    }
    this.audio.play('relic');
    this.ui.toast?.(`DESBLOQUEADO: ${result.node.name}`, '#ffd24a');
    this.ui.setPlatformName?.(this.meta.platform().name);
    this.renderMeta();
    return true;
  }

  selectPlatform(id) {
    const result = this.meta.setPlatform(id);
    if (!result.ok) {
      this.audio.play('error');
      this.ui.toast?.(result.reason, '#ff4a55');
      return false;
    }
    this.ui.setPlatformName?.(result.platform.name);
    this.ui.toast?.(`PLATAFORMA: ${result.platform.name}`, result.platform.accent);
    this.renderMeta();
    return true;
  }

  closeMeta() {
    this.screen = 'none';
    this.overlay?.close?.();
    this.engine.goMenu();
  }

  toggleInventory() {
    if (this.screen === 'inventory') {
      this.closeInventory();
      return;
    }
    if (!this.run || this.run.ended) return;
    if (this.engine.state !== 'playing') return;
    this.inventoryReturn = this.engine.state;
    this.engine.enterOverlay();
    this.screen = 'inventory';
    this.overlay?.showInventory?.(
      {
        run: this.runView(),
        room: this.engine.room,
        modifiers: (this.engine.room?.modifiers ?? []).map((id) => modifierById(id)).filter(Boolean),
        build: this.build,
      },
      { onClose: () => this.closeInventory() },
    );
  }

  closeInventory() {
    if (this.screen !== 'inventory') return;
    this.screen = 'none';
    this.overlay?.close?.();
    this.engine.exitOverlay();
  }

  handleKey(code) {
    if (this.screen === 'inventory' && (code === 'KeyI' || code === 'Tab' || code === 'Escape')) {
      this.closeInventory();
      return;
    }
    if (this.screen === 'meta' && code === 'Escape') {
      this.closeMeta();
      return;
    }
    if (this.screen === 'reward' && /^Digit[1-3]$/.test(code)) {
      this.pickReward(Number(code.slice(-1)) - 1);
      return;
    }
    if (this.screen === 'event' && /^Digit[1-3]$/.test(code)) {
      const choice = this.eventState?.event?.choices?.[Number(code.slice(-1)) - 1];
      if (choice) this.chooseEvent(choice.id);
      return;
    }
    if (this.screen === 'eventResult' && (code === 'Enter' || code === 'Space' || code === 'Escape')) {
      this.finishEvent();
      return;
    }
    if (this.screen === 'rest' && /^Digit[1-3]$/.test(code)) {
      const index = Number(code.slice(-1));
      if (index === 1) this.chooseRest('heal');
      else if (index === 2) this.chooseRest('upgrade');
      else this.chooseRest('leave');
      return;
    }
    if (this.screen === 'treasure' && /^Digit[1-4]$/.test(code)) {
      const index = Number(code.slice(-1));
      if (index <= (this.treasureOffers?.length ?? 0)) this.pickTreasure(index - 1);
      else this.engine.addCoins(120, null, null, true);
    }
  }
}
