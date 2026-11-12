import { RARITIES, RUN, SHOP, rarityOf } from '../roguelite/RogueliteConfig.js';
import { NODE_TYPES } from '../roguelite/MapManager.js';
import { UPGRADE_CATEGORIES } from '../roguelite/UpgradeLibrary.js';
import { formatScore } from '../core/MathUtils.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const pips = (level, max) =>
  Array.from({ length: max }, (_, index) => `<span class="rl-pip${index < level ? ' is-on' : ''}"></span>`).join('');

const categoryLabel = (id) => UPGRADE_CATEGORIES[id]?.label ?? 'MELHORIA';
const categoryColor = (id) => UPGRADE_CATEGORIES[id]?.color ?? '#38dcff';

/**
 * DOM renderer for every roguelite overlay. The screens own no game state:
 * they receive data + handlers from RogueliteManager and emit intent.
 */
export class RogueliteUI {
  constructor(root = document) {
    this.root = root.getElementById('rl-overlay');
    this.screen = 'none';
    this.handlers = {};
  }

  isActive() {
    return this.screen !== 'none';
  }

  close() {
    if (!this.root) return;
    this.root.classList.remove('is-active');
    this.root.innerHTML = '';
    this.root.style.pointerEvents = 'none';
    this.screen = 'none';
    this.handlers = {};
  }

  setContent(html, screen = 'screen', className = '') {
    if (!this.root) return;
    this.root.innerHTML = `<div class="rl-screen ${className}">${html}</div>`;
    this.root.classList.add('is-active');
    this.root.style.pointerEvents = 'auto';
    this.screen = screen;
    this.root.scrollTop = 0;
  }

  bind(selector, event, handler) {
    if (!this.root) return;
    this.root.querySelectorAll(selector).forEach((element) => {
      element.addEventListener(event, (domEvent) => {
        domEvent.preventDefault();
        domEvent.stopPropagation();
        handler(element, domEvent);
      });
    });
  }

  runStrip(run) {
    if (!run) return '';
    return `
      <div class="rl-strip">
        <span class="rl-strip__item"><b>${run.lives}</b>/${run.maxLives} VIDA</span>
        <span class="rl-strip__item rl-strip__item--coins"><b>${formatScore(run.coins)}</b> MOEDAS</span>
        <span class="rl-strip__item">SALA <b>${String(run.roomNumber ?? 0).padStart(2, '0')}</b></span>
        <span class="rl-strip__item">UP <b>${run.upgrades?.length ?? Object.keys(run.upgrades ?? {}).length}</b></span>
        <span class="rl-strip__item">REL <b>${run.relics?.length ?? 0}</b></span>
      </div>`;
  }

  banner(title, text = '', color = '#38dcff') {
    const stage = this.root?.parentElement;
    if (!stage) return;
    const element = document.createElement('div');
    element.className = 'rl-banner';
    element.style.setProperty('--banner', color);
    element.innerHTML = `<strong>${esc(title)}</strong>${text ? `<span>${esc(text)}</span>` : ''}`;
    stage.appendChild(element);
    window.setTimeout(() => element.classList.add('is-out'), 2200);
    window.setTimeout(() => element.remove(), 2700);
  }

  /* ───────────────────────────── map ───────────────────────────── */

  showMap(data, handlers) {
    this.handlers = handlers;
    const map = data.map;
    const nodes = map.floors.flat();
    const positions = new Map();
    for (const node of nodes) {
      const count = map.floors[node.floor]?.length ?? 1;
      positions.set(node.id, {
        x: 10 + ((node.col + 0.5) / count) * 80,
        y: 88 - node.floor * 18,
      });
    }

    let lines = '';
    for (const node of nodes) {
      const from = positions.get(node.id);
      for (const nextId of node.next) {
        const to = positions.get(nextId);
        if (!from || !to) continue;
        const target = nodes.find((item) => item.id === nextId);
        const visible = node.revealed === 'known' && target?.revealed === 'known';
        const active = node.state === 'available' || node.state === 'current';
        lines += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="rl-map__line${visible ? '' : ' is-hidden'}${active ? ' is-active' : ''}" />`;
      }
    }

    let nodeHtml = '';
    for (const node of nodes) {
      const point = positions.get(node.id);
      const meta = NODE_TYPES[node.type] ?? NODE_TYPES.unknown;
      const isAvailable = node.state === 'available';
      const isCleared = node.state === 'cleared';
      const unknown = node.revealed !== 'known';
      const label = unknown ? '???' : meta.label;
      const content = `
        <span class="rl-node__icon" style="--node:${meta.color}">${unknown ? '·' : meta.icon}</span>
        <span class="rl-node__label">${esc(label)}</span>
        ${isCleared ? '<span class="rl-node__tick">✓</span>' : ''}`;
      if (isAvailable) {
        nodeHtml += `<button class="rl-node rl-node--${node.type} is-available" style="--x:${point.x}%;--y:${point.y}%;--node:${meta.color}" data-node="${esc(node.id)}" type="button">${content}</button>`;
      } else {
        nodeHtml += `<div class="rl-node rl-node--${node.type} ${isCleared ? 'is-cleared' : 'is-locked'}${unknown ? ' is-unknown' : ''}" style="--x:${point.x}%;--y:${point.y}%;--node:${meta.color}">${content}</div>`;
      }
    }

    const html = `
      <div class="rl-map" style="--accent:${map.accent};--accent2:${map.accent2}">
        <header class="rl-head">
          <div>
            <p class="rl-eyebrow">${esc(map.subtitle)}</p>
            <h2 class="rl-title">${esc(map.name)}</h2>
            <p class="rl-sub">${esc(map.brief)}</p>
          </div>
          <div class="rl-head__side">
            <span class="rl-progress">ANDAR ${Math.min(map.progress.total, Math.max(1, (map.progress.current ?? 0) + 1))}/${map.progress.total}</span>
            <button class="btn btn--ghost btn--small" data-action="abandon" type="button">ABANDONAR</button>
          </div>
        </header>
        ${this.runStrip(data.run)}
        <div class="rl-map__body">
          <svg class="rl-map__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
          <div class="rl-map__nodes">${nodeHtml}</div>
        </div>
        <footer class="rl-map__foot">
          <span>Escolha um caminho. Andares distantes mostram apenas rumores.</span>
          <span class="rl-map__legend">◆ combate · ✦ elite · ⌂ loja · ? evento · ▣ tesouro · + descanso · ☠ chefe</span>
        </footer>
      </div>`;

    this.setContent(html, 'map', 'rl-screen--wide');
    this.bind('[data-node]', 'click', (element) => this.handlers.onEnter?.(element.dataset.node));
    this.bind('[data-action="abandon"]', 'click', () => this.handlers.onAbandon?.());
  }

  /* ───────────────────────────── briefing / reward ───────────────────────────── */

  upgradeCard(offer, index) {
    if (offer.kind === 'coins') {
      const rarity = rarityOf('uncommon');
      return `
        <button class="rl-card rl-card--${rarity.id}" type="button" data-pick="${index}"
          style="--rarity:${rarity.color};--rarity-soft:${rarity.soft};--rarity-glow:${rarity.glow};--cat:#ffd24a">
          <span class="rl-card__top"><span class="rl-card__rarity">MOEDAS</span><span class="rl-card__key">${index + 1}</span></span>
          <span class="rl-card__glyph">◈</span>
          <span class="rl-card__name">+${offer.amount ?? 80} MOEDAS</span>
          <span class="rl-card__cat">RECOMPENSA ALTERNATIVA</span>
          <span class="rl-card__desc">Nenhuma melhoria disponível no momento. O sistema converte a recompensa em crédito imediato.</span>
          <span class="rl-card__level">CRÉDITO</span>
        </button>`;
    }
    const def = offer.def;
    const rarity = rarityOf(offer.rarity ?? def.rarity);
    const level = offer.level ?? 1;
    const max = offer.maxLevel ?? def.maxLevel ?? 5;
    const desc = def.levels?.[Math.max(0, level - 1)]?.desc ?? def.lore ?? '';
    return `
      <button class="rl-card rl-card--${rarity.id}" type="button" data-pick="${index}"
        style="--rarity:${rarity.color};--rarity-soft:${rarity.soft};--rarity-glow:${rarity.glow};--cat:${categoryColor(def.category)}">
        <span class="rl-card__top">
          <span class="rl-card__rarity">${rarity.short}</span>
          <span class="rl-card__key">${index + 1}</span>
        </span>
        <span class="rl-card__glyph">${esc(def.glyph ?? def.name?.slice(0, 2))}</span>
        <span class="rl-card__name">${esc(def.name)}</span>
        <span class="rl-card__cat">${esc(categoryLabel(def.category))}</span>
        <span class="rl-card__desc">${esc(desc)}</span>
        <span class="rl-card__pips">${pips(level, max)}</span>
        <span class="rl-card__level">${offer.isLevelUp || level > 1 ? `LV ${level - 1} → ${level}` : 'NOVO · LV 1'}</span>
      </button>`;
  }

  showBriefing(data, handlers) {
    this.handlers = handlers;
    const room = data.room;
    const modifiers = data.modifiers ?? [];
    const isBoss = room.objective === 'boss';
    const modifierHtml = modifiers.length
      ? modifiers
          .map(
            (modifier) => `
        <div class="rl-mod" style="--mod:${modifier.color}">
          <span class="rl-mod__icon">${esc(modifier.icon)}</span>
          <div><strong>${esc(modifier.name)}</strong><p>${esc(modifier.desc)}</p></div>
        </div>`,
          )
          .join('')
      : '<p class="rl-empty">Nenhum modificador nesta sala.</p>';

    const html = `
      <div class="rl-brief${isBoss ? ' rl-brief--boss' : ''}" style="--accent:${room.accent};--accent2:${room.accent2}">
        <header class="rl-head">
          <div>
            <p class="rl-eyebrow">${esc(data.sector?.subtitle ?? '')} · ${esc(room.type.toUpperCase())}</p>
            <h2 class="rl-title">${esc(room.name)}</h2>
            <p class="rl-sub">${isBoss ? esc(room.bossDef?.intro ?? 'Um confronto especial.') : room.elite ? 'Sala elite: blocos mais resistentes, recompensa melhor.' : 'Sala de combate. Destrua todos os blocos.'}</p>
          </div>
          <div class="rl-head__side">
            <span class="rl-badge">SALA ${String(room.roomNumber ?? 1).padStart(2, '0')}</span>
            ${room.elite ? '<span class="rl-badge rl-badge--elite">ELITE</span>' : ''}
            ${isBoss ? '<span class="rl-badge rl-badge--boss">CHEFE</span>' : ''}
          </div>
        </header>
        ${this.runStrip(data.run)}
        <div class="rl-brief__body">
          <div class="rl-brief__col">
            <h3 class="rl-section-title">MODIFICADORES DA SALA</h3>
            <div class="rl-mods">${modifierHtml}</div>
          </div>
          <div class="rl-brief__col rl-brief__col--stats">
            <h3 class="rl-section-title">LEITURA DO SISTEMA</h3>
            <ul class="rl-stats">
              <li><span>Velocidade</span><b>${(room.speed ?? 1).toFixed(2)}×</b></li>
              <li><span>Resistência extra</span><b>+${room.hpBonus ?? 0}</b></li>
              <li><span>Valor dos blocos</span><b>${(room.valueScale ?? 1).toFixed(2)}×</b></li>
              <li><span>Objetivo</span><b>${isBoss ? 'DERROTAR O CHEFE' : 'LIMPAR A SALA'}</b></li>
            </ul>
            ${isBoss && room.bossDef ? `<p class="rl-boss-note">${esc(room.bossDef.intro)}</p>` : ''}
          </div>
        </div>
        <footer class="rl-actions">
          <button class="btn btn--primary btn--xl" data-action="start" type="button">INICIAR SALA</button>
        </footer>
      </div>`;

    this.setContent(html, 'briefing', 'rl-screen--wide');
    this.bind('[data-action="start"]', 'click', () => this.handlers.onStart?.());
  }

  showReward(data, handlers) {
    this.handlers = handlers;
    const offers = data.offers ?? [];
    const cards = offers.length
      ? offers.map((offer, index) => this.upgradeCard(offer, index)).join('')
      : '<p class="rl-empty">Nenhuma melhoria disponível. O sistema está sem opções.</p>';
    const html = `
      <div class="rl-reward" style="--accent:#38dcff;--accent2:#a86bff">
        <header class="rl-head rl-head--center">
          <p class="rl-eyebrow">${esc(data.label ?? 'RECOMPENSA')}</p>
          <h2 class="rl-title">${esc(data.sub ?? 'Escolha uma melhoria')}</h2>
          <p class="rl-sub">Uma escolha. O resto desaparece.</p>
        </header>
        ${this.runStrip(data.run)}
        <div class="rl-cards">${cards}</div>
        <footer class="rl-actions">
          <button class="btn btn--ghost btn--small" data-action="reroll" type="button" ${data.rerolls > 0 ? '' : 'disabled'}>
            REROLL (${data.rerolls ?? 0})
          </button>
          <span class="rl-hint">Teclas 1–${offers.length || 3} escolhem · ${formatScore(data.coins ?? 0)} moedas</span>
        </footer>
      </div>`;
    this.setContent(html, 'reward', 'rl-screen--wide');
    this.bind('[data-pick]', 'click', (element) => this.handlers.onPick?.(Number(element.dataset.pick)));
    this.bind('[data-action="reroll"]', 'click', () => this.handlers.onReroll?.());
  }

  /* ───────────────────────────── shop / events / rest / treasure ───────────────────────────── */

  shopItemCard(item, coins) {
    const rarity = rarityOf(item.rarity);
    const name = item.name ?? item.def?.name ?? 'ITEM';
    const desc =
      item.desc ?? item.def?.levels?.[(item.level ?? 1) - 1]?.desc ?? item.def?.desc ?? '';
    const kind =
      item.kind === 'relic'
        ? 'RELÍQUIA'
        : item.kind === 'heal'
          ? 'RECUPERAÇÃO'
          : item.kind === 'special'
            ? 'ESPECIAL'
            : 'UPGRADE';
    const affordable = coins >= item.price && !item.sold;
    return `
      <article class="rl-shop-card${item.sold ? ' is-sold' : ''}" style="--rarity:${rarity.color};--rarity-soft:${rarity.soft};--rarity-glow:${rarity.glow}">
        <div class="rl-shop-card__top">
          <span class="rl-shop-card__kind">${kind}</span>
          <span class="rl-shop-card__price">${item.sold ? 'VENDIDO' : `${formatScore(item.price)} ◈`}</span>
        </div>
        <span class="rl-shop-card__glyph">${esc(item.glyph ?? item.def?.glyph ?? '??')}</span>
        <h4>${esc(name)}${item.level ? ` <small>LV ${item.level}</small>` : ''}</h4>
        <p>${esc(desc)}</p>
        <button class="btn btn--primary btn--small" type="button" data-buy="${esc(item.itemId)}" ${affordable ? '' : 'disabled'}>
          ${item.sold ? 'ADQUIRIDO' : 'COMPRAR'}
        </button>
      </article>`;
  }

  showShop(data, handlers) {
    this.handlers = handlers;
    const view = data.view ?? { stock: [], rerollPrice: 0, rerollAvailable: false };
    const cards = view.stock.map((item) => this.shopItemCard(item, data.coins)).join('');
    const html = `
      <div class="rl-shop" style="--accent:#43f59b;--accent2:#ffe14d">
        <header class="rl-head">
          <div>
            <p class="rl-eyebrow">NÓ DE COMÉRCIO</p>
            <h2 class="rl-title">LOJA</h2>
            <p class="rl-sub">Tudo tem preço. Alguns você paga com decisões.</p>
          </div>
          <div class="rl-head__side">
            <span class="rl-coins">${formatScore(data.coins)} ◈</span>
            ${view.discount > 0 ? `<span class="rl-badge">−${Math.round(view.discount * 100)}%</span>` : ''}
          </div>
        </header>
        ${this.runStrip(data.run)}
        <div class="rl-shop__grid">${cards}</div>
        <footer class="rl-actions">
          <button class="btn btn--ghost btn--small" type="button" data-action="reroll" ${view.rerollAvailable ? '' : 'disabled'}>
            ATUALIZAR OFERTAS (${formatScore(view.rerollPrice)} ◈)
          </button>
          <button class="btn btn--primary btn--small" type="button" data-action="leave">SAIR DA LOJA</button>
        </footer>
      </div>`;
    this.setContent(html, 'shop', 'rl-screen--wide');
    this.bind('[data-buy]', 'click', (element) => this.handlers.onBuy?.(element.dataset.buy));
    this.bind('[data-action="reroll"]', 'click', () => this.handlers.onReroll?.());
    this.bind('[data-action="leave"]', 'click', () => this.handlers.onLeave?.());
  }

  showEvent(data, handlers) {
    this.handlers = handlers;
    const event = data.event;
    const choices = event.choices
      .map(
        (choice, index) => `
        <button class="rl-choice" type="button" data-choice="${esc(choice.id)}" style="--choice:${event.color}">
          <span class="rl-choice__key">${index + 1}</span>
          <span class="rl-choice__label">${esc(choice.label)}</span>
          <span class="rl-choice__hint">${esc(choice.hint)}</span>
        </button>`,
      )
      .join('');
    const html = `
      <div class="rl-event" style="--accent:${event.color};--accent2:#a86bff">
        <header class="rl-head">
          <div>
            <p class="rl-eyebrow">EVENTO · ANOMALIA DE SISTEMA</p>
            <h2 class="rl-title">${esc(event.title)}</h2>
          </div>
          <span class="rl-event__icon">${esc(event.icon)}</span>
        </header>
        ${this.runStrip(data.run)}
        <p class="rl-event__text">${esc(event.text)}</p>
        <div class="rl-choices">${choices}</div>
        <footer class="rl-actions"><span class="rl-hint">Escolhas têm consequências reais.</span></footer>
      </div>`;
    this.setContent(html, 'event', 'rl-screen');
    this.bind('[data-choice]', 'click', (element) => this.handlers.onChoose?.(element.dataset.choice));
  }

  showEventResult(data, handlers) {
    this.handlers = handlers;
    const lines = (data.lines ?? []).map((line) => `<li>${esc(line)}</li>`).join('');
    const html = `
      <div class="rl-event" style="--accent:${data.event?.color ?? '#a86bff'};--accent2:#38dcff">
        <header class="rl-head rl-head--center">
          <p class="rl-eyebrow">CONSEQUÊNCIA</p>
          <h2 class="rl-title">${esc(data.choice?.label ?? 'RESULTADO')}</h2>
        </header>
        <ul class="rl-result">${lines || '<li>O sistema não respondeu.</li>'}</ul>
        <footer class="rl-actions">
          <button class="btn btn--primary" type="button" data-action="continue">CONTINUAR</button>
          <span class="rl-hint">Enter / Espaço</span>
        </footer>
      </div>`;
    this.setContent(html, 'eventResult', 'rl-screen');
    this.bind('[data-action="continue"]', 'click', () => this.handlers.onContinue?.());
  }

  showRest(data, handlers) {
    this.handlers = handlers;
    const healLabel = data.canHeal ? '+1 VIDA' : '+40 MOEDAS (vida cheia)';
    const upgradeLabel = data.canUpgrade ? `MELHORAR ${data.upgradeName}` : 'SEM UPGRADE PARA MELHORAR';
    const html = `
      <div class="rl-rest" style="--accent:#8fe8ff;--accent2:#43f59b">
        <header class="rl-head rl-head--center">
          <p class="rl-eyebrow">NÓ DE DESCANSO</p>
          <h2 class="rl-title">PONTO DE PAUSA</h2>
          <p class="rl-sub">O sistema permite uma única recuperação.</p>
        </header>
        ${this.runStrip(data.run)}
        <div class="rl-choices">
          <button class="rl-choice" type="button" data-action="heal" style="--choice:#43f59b">
            <span class="rl-choice__key">1</span><span class="rl-choice__label">RECUPERAR</span>
            <span class="rl-choice__hint">${esc(healLabel)}</span>
          </button>
          <button class="rl-choice" type="button" data-action="upgrade" style="--choice:#38dcff" ${data.canUpgrade ? '' : 'disabled'}>
            <span class="rl-choice__key">2</span><span class="rl-choice__label">REFORÇAR</span>
            <span class="rl-choice__hint">${esc(upgradeLabel)}</span>
          </button>
          <button class="rl-choice" type="button" data-action="leave" style="--choice:#ffe14d">
            <span class="rl-choice__key">3</span><span class="rl-choice__label">SEGUIR</span>
            <span class="rl-choice__hint">+30 moedas</span>
          </button>
        </div>
      </div>`;
    this.setContent(html, 'rest', 'rl-screen');
    this.bind('[data-action="heal"]', 'click', () => this.handlers.onHeal?.());
    this.bind('[data-action="upgrade"]', 'click', () => this.handlers.onUpgrade?.());
    this.bind('[data-action="leave"]', 'click', () => this.handlers.onLeave?.());
  }

  showTreasure(data, handlers) {
    this.handlers = handlers;
    const offers = data.offers ?? [];
    const cards = offers.length
      ? offers
          .map((offer, index) => {
            const relic = offer.def;
            const rarity = rarityOf(relic.rarity);
            return `
              <button class="rl-card rl-card--${rarity.id}" type="button" data-pick="${index}"
                style="--rarity:${rarity.color};--rarity-soft:${rarity.soft};--rarity-glow:${rarity.glow};--cat:#ffd24a">
                <span class="rl-card__top"><span class="rl-card__rarity">${rarity.short}</span><span class="rl-card__key">${index + 1}</span></span>
                <span class="rl-card__glyph">${esc(relic.glyph)}</span>
                <span class="rl-card__name">${esc(relic.name)}</span>
                <span class="rl-card__cat">RELÍQUIA</span>
                <span class="rl-card__desc">${esc(relic.desc)}</span>
                <span class="rl-card__level">${esc(relic.lore ?? '')}</span>
              </button>`;
          })
          .join('')
      : `<p class="rl-empty">${data.full ? 'Limite de relíquias atingido.' : 'O cofre está vazio.'}</p>`;
    const html = `
      <div class="rl-treasure" style="--accent:#ffd24a;--accent2:#ff8c2b">
        <header class="rl-head rl-head--center">
          <p class="rl-eyebrow">NÓ DE TESOURO</p>
          <h2 class="rl-title">TESOURO</h2>
          <p class="rl-sub">Escolha uma relíquia. Efeitos permanentes até o fim da run.</p>
        </header>
        ${this.runStrip(data.run)}
        <div class="rl-cards">${cards}</div>
        <footer class="rl-actions">
          <button class="btn btn--ghost btn--small" type="button" data-action="coins">CONVERTER EM 120 MOEDAS</button>
        </footer>
      </div>`;
    this.setContent(html, 'treasure', 'rl-screen--wide');
    this.bind('[data-pick]', 'click', (element) => this.handlers.onPick?.(Number(element.dataset.pick)));
    this.bind('[data-action="coins"]', 'click', () => this.handlers.onCoins?.());
  }

  /* ───────────────────────────── summary / meta / inventory ───────────────────────────── */

  fmtTime(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  showSummary(data, handlers) {
    this.handlers = handlers;
    const summary = data.summary ?? {};
    const reward = data.reward ?? { breakdown: {}, total: 0, multiplier: 1 };
    const run = data.run ?? {};
    const upgrades = (run.upgrades ?? [])
      .map((upgrade) => `<span class="rl-chip" style="--chip:${rarityOf(upgrade.rarity).color}">${esc(upgrade.name)} <b>LV${upgrade.level}</b></span>`)
      .join('');
    const relics = (run.relics ?? [])
      .map((relic) => `<span class="rl-chip" style="--chip:${rarityOf(relic.rarity).color}">${esc(relic.name)}</span>`)
      .join('');
    const synergies = (run.synergies ?? [])
      .map((synergy) => `<li style="--syn:${synergy.color}"><b>${esc(synergy.name)}</b><span>${esc(synergy.desc)}</span></li>`)
      .join('');
    const breakdown = reward.breakdown ?? {};
    const breakdownHtml = Object.entries(breakdown)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => `<span class="rl-data-chip">${esc(key.toUpperCase())} +${value}</span>`)
      .join('');

    const html = `
      <div class="rl-summary${data.victory ? ' rl-summary--victory' : ''}" style="--accent:${data.victory ? '#ffd24a' : '#ff4a55'};--accent2:#a86bff">
        <header class="rl-head rl-head--center">
          <p class="rl-eyebrow">${data.victory ? 'SETOR FINAL CONCLUÍDO' : 'SINAL PERDIDO'}</p>
          <h2 class="rl-title">${data.victory ? 'RUN COMPLETA' : 'RUN ENCERRADA'}</h2>
          <p class="rl-sub">${data.victory ? 'O sistema reconhece sua build.' : 'O sistema registrou seus dados. Tente outra combinação.'}</p>
        </header>
        <div class="rl-summary__grid">
          <div class="rl-stat"><span>PONTUAÇÃO</span><b>${formatScore(summary.score ?? 0)}</b></div>
          <div class="rl-stat"><span>SALAS</span><b>${summary.roomsCleared ?? 0}</b></div>
          <div class="rl-stat"><span>CHEFES</span><b>${summary.bossesDefeated ?? 0}</b></div>
          <div class="rl-stat"><span>MOEDAS</span><b>${formatScore(summary.coins ?? 0)}</b></div>
          <div class="rl-stat"><span>MELHOR COMBO</span><b>×${summary.bestCombo ?? 0}</b></div>
          <div class="rl-stat"><span>TEMPO</span><b>${this.fmtTime(summary.survivalTime)}</b></div>
        </div>
        <div class="rl-data">
          <div class="rl-data__head">
            <span>DATA CONQUISTADA</span>
            <b>+${reward.total ?? 0}</b>
          </div>
          <div class="rl-data__chips">${breakdownHtml || '<span class="rl-data-chip">SEM BÔNUS</span>'}</div>
          <p class="rl-hint">Multiplicador de DATA: ×${(reward.multiplier ?? 1).toFixed(2)} · Saldo: ${formatScore(data.data ?? 0)}</p>
        </div>
        <div class="rl-build">
          <div class="rl-build__col">
            <h3 class="rl-section-title">UPGRADES</h3>
            <div class="rl-chips">${upgrades || '<span class="rl-empty">Nenhum.</span>'}</div>
          </div>
          <div class="rl-build__col">
            <h3 class="rl-section-title">RELÍQUIAS</h3>
            <div class="rl-chips">${relics || '<span class="rl-empty">Nenhuma.</span>'}</div>
          </div>
          <div class="rl-build__col">
            <h3 class="rl-section-title">SINERGIAS</h3>
            <ul class="rl-syn-list">${synergies || '<li class="rl-empty">Nenhuma sinergia ativada.</li>'}</ul>
          </div>
        </div>
        <footer class="rl-actions">
          <button class="btn btn--primary" type="button" data-action="retry">NOVA RUN</button>
          <button class="btn btn--ghost" type="button" data-action="menu">MENU</button>
        </footer>
      </div>`;
    this.setContent(html, 'summary', 'rl-screen--wide');
    this.bind('[data-action="retry"]', 'click', () => this.handlers.onRetry?.());
    this.bind('[data-action="menu"]', 'click', () => this.handlers.onMenu?.());
  }

  showMeta(data, handlers) {
    this.handlers = handlers;
    const branchLabels = {
      platform: 'PLATAFORMAS',
      sector: 'SETORES',
      pool: 'BIBLIOTECAS',
      bonus: 'BÔNUS PERMANENTES',
      skin: 'SKINS',
    };
    const branches = Object.keys(branchLabels)
      .map((branch) => {
        const nodes = (data.nodes ?? []).filter((node) => node.branch === branch);
        if (!nodes.length) return '';
        const cards = nodes
          .map((node) => {
            const canBuy = node.status === 'available';
            return `
              <button class="rl-meta-node is-${node.status}" type="button" data-meta="${esc(node.id)}" ${canBuy ? '' : 'disabled'}>
                <span class="rl-meta-node__icon">${esc(node.icon)}</span>
                <span class="rl-meta-node__name">${esc(node.name)}</span>
                <span class="rl-meta-node__desc">${esc(node.desc)}</span>
                <span class="rl-meta-node__cost">${node.status === 'owned' ? 'DESBLOQUEADO' : node.status === 'locked' ? 'BLOQUEADO' : `${node.cost} DATA`}</span>
              </button>`;
          })
          .join('');
        return `<section class="rl-meta-branch"><h3 class="rl-section-title">${branchLabels[branch]}</h3><div class="rl-meta-grid">${cards}</div></section>`;
      })
      .join('');

    const platforms = (data.platforms ?? [])
      .map(
        (platform) => `
        <button class="rl-platform${platform.id === data.selected ? ' is-selected' : ''}${platform.unlocked ? '' : ' is-locked'}"
          type="button" data-platform="${esc(platform.id)}" ${platform.unlocked ? '' : 'disabled'}
          style="--platform:${platform.accent}">
          <strong>${esc(platform.name)}</strong>
          <span>${esc(platform.desc)}</span>
        </button>`,
      )
      .join('');

    const stats = data.stats ?? {};
    const codex = data.codex ?? {};
    const html = `
      <div class="rl-meta" style="--accent:#ffd24a;--accent2:#a86bff">
        <header class="rl-head">
          <div>
            <p class="rl-eyebrow">PROGRESSÃO PERMANENTE</p>
            <h2 class="rl-title">ÁRVORE DE DESBLOQUEIOS</h2>
            <p class="rl-sub">DATA não compra vitórias. Compra possibilidades.</p>
          </div>
          <div class="rl-head__side">
            <span class="rl-coins">${formatScore(data.data ?? 0)} DATA</span>
            ${data.hasSavedRun ? '<button class="btn btn--primary btn--small" type="button" data-action="continue">CONTINUAR RUN</button>' : ''}
          </div>
        </header>
        <section class="rl-meta-platforms">
          <h3 class="rl-section-title">PLATAFORMA ATIVA</h3>
          <div class="rl-platforms">${platforms}</div>
        </section>
        ${branches}
        <div class="rl-meta-foot">
          <div class="rl-meta-stats">
            <h3 class="rl-section-title">ESTATÍSTICAS</h3>
            <ul class="rl-stats">
              <li><span>Runs</span><b>${stats.runs ?? 0}</b></li>
              <li><span>Vitórias</span><b>${stats.victories ?? 0}</b></li>
              <li><span>Melhor score</span><b>${formatScore(stats.bestScore ?? 0)}</b></li>
              <li><span>Chefes</span><b>${stats.bosses ?? 0}</b></li>
              <li><span>Sinergias descobertas</span><b>${(codex.synergies ?? []).length}</b></li>
              <li><span>Codex</span><b>${(codex.upgrades ?? []).length} UP · ${(codex.relics ?? []).length} REL</b></li>
            </ul>
          </div>
          <div class="rl-meta-codex">
            <h3 class="rl-section-title">CÓDEX</h3>
            <p class="rl-hint">Sinergias registradas: ${(codex.synergies ?? []).map((id) => esc(id)).join(', ') || 'nenhuma ainda'}.</p>
          </div>
        </div>
        <footer class="rl-actions">
          <button class="btn btn--ghost" type="button" data-action="close">VOLTAR AO MENU</button>
        </footer>
      </div>`;
    this.setContent(html, 'meta', 'rl-screen--wide');
    this.bind('[data-meta]', 'click', (element) => this.handlers.onBuy?.(element.dataset.meta));
    this.bind('[data-platform]', 'click', (element) => this.handlers.onSelectPlatform?.(element.dataset.platform));
    this.bind('[data-action="continue"]', 'click', () => this.handlers.onContinue?.());
    this.bind('[data-action="close"]', 'click', () => this.handlers.onClose?.());
  }

  showInventory(data, handlers) {
    this.handlers = handlers;
    const run = data.run ?? {};
    const upgrades = (run.upgrades ?? [])
      .map(
        (upgrade) => `
        <div class="rl-inv-item" style="--rarity:${rarityOf(upgrade.rarity).color}">
          <span class="rl-inv-item__glyph">${esc(upgrade.glyph)}</span>
          <div>
            <strong>${esc(upgrade.name)} <small>LV ${upgrade.level}/${upgrade.maxLevel}</small></strong>
            <span>${esc(categoryLabel(upgrade.category))}</span>
            <div class="rl-card__pips">${pips(upgrade.level, upgrade.maxLevel)}</div>
          </div>
        </div>`,
      )
      .join('');
    const relics = (run.relics ?? [])
      .map(
        (relic) => `
        <div class="rl-inv-item" style="--rarity:${rarityOf(relic.rarity).color}">
          <span class="rl-inv-item__glyph">${esc(relic.glyph)}</span>
          <div><strong>${esc(relic.name)}</strong><span>${esc(relic.desc)}</span></div>
        </div>`,
      )
      .join('');
    const synergies = (run.synergies ?? [])
      .map((synergy) => `<li style="--syn:${synergy.color}"><b>${esc(synergy.name)}</b><span>${esc(synergy.desc)}</span></li>`)
      .join('');
    const modifiers = (data.modifiers ?? [])
      .map((modifier) => `<span class="rl-chip" style="--chip:${modifier.color}">${esc(modifier.name)}</span>`)
      .join('');
    const build = data.build ?? {};
    const stats = [
      ['DANO', `×${(build.damageMult ?? 1).toFixed(2)}`],
      ['CRÍTICO', `${Math.round((build.critChance ?? 0) * 100)}%`],
      ['PIERCE', `${Math.round((build.pierceChance ?? 0) * 100)}%`],
      ['MOEDAS', `+${Math.round(((build.coinMult ?? 1) - 1) * 100)}%`],
      ['ESCUDOS', build.shieldCharges ?? 0],
      ['ORBITAIS', build.orbitalCount ?? 0],
      ['LASER', build.laserLevel ?? 0],
      ['FOGO', build.fireLevel ?? 0],
      ['EXPLOSÃO', build.explosionLevel ?? 0],
      ['CHAIN', build.chainLevel ?? 0],
    ]
      .map(([label, value]) => `<li><span>${label}</span><b>${value}</b></li>`)
      .join('');

    const html = `
      <div class="rl-inventory" style="--accent:#38dcff;--accent2:#a86bff">
        <header class="rl-head">
          <div>
            <p class="rl-eyebrow">PAUSA TÁTICA · SALA ${String(run.roomNumber ?? 0).padStart(2, '0')}</p>
            <h2 class="rl-title">INVENTÁRIO</h2>
            <p class="rl-sub">${esc(data.room?.name ?? 'Sala atual')}</p>
          </div>
          <button class="btn btn--ghost btn--small" type="button" data-action="close">FECHAR (I)</button>
        </header>
        ${this.runStrip(run)}
        <div class="rl-inventory__grid">
          <div><h3 class="rl-section-title">UPGRADES</h3><div class="rl-inv-list">${upgrades || '<p class="rl-empty">Nenhum upgrade.</p>'}</div></div>
          <div><h3 class="rl-section-title">RELÍQUIAS (${(run.relics ?? []).length}/${RUN.relicCap})</h3><div class="rl-inv-list">${relics || '<p class="rl-empty">Nenhuma relíquia.</p>'}</div></div>
          <div><h3 class="rl-section-title">SINERGIAS</h3><ul class="rl-syn-list">${synergies || '<li class="rl-empty">Nenhuma sinergia ativa.</li>'}</ul>
            <h3 class="rl-section-title">MODIFICADORES DA SALA</h3><div class="rl-chips">${modifiers || '<span class="rl-empty">Nenhum.</span>'}</div>
          </div>
          <div><h3 class="rl-section-title">STATS COMPILADOS</h3><ul class="rl-stats">${stats}</ul></div>
        </div>
      </div>`;
    this.setContent(html, 'inventory', 'rl-screen--wide');
    this.bind('[data-action="close"]', 'click', () => this.handlers.onClose?.());
  }
}
