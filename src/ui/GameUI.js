import { POWER_UP_TYPES, TUNING } from '../core/Config.js';
import { formatScore } from '../core/MathUtils.js';

const HEART_PATH =
  'M12 20.9 4.5 13.5a5 5 0 0 1 0-7.1 5 5 0 0 1 7.1 0l.4.4.4-.4a5 5 0 0 1 7.1 0 5 5 0 0 1 0 7.1z';

/** All DOM chrome: HUD, overlays, toasts. The canvas only draws the game. */
export class GameUI {
  constructor(root = document) {
    const byId = (id) => document.getElementById(id);

    this.el = {
      hudScore: byId('hud-score'),
      hudBest: byId('hud-best'),
      hudLives: byId('hud-lives'),
      hudLevel: byId('hud-level'),
      hudSector: byId('hud-sector'),
      hudEffects: byId('hud-effects'),
      hudCombo: byId('hud-combo'),
      hudShields: byId('hud-shields'),
      hudCoins: byId('hud-coins'),
      hudCoinsWrap: byId('hud-coins-wrap'),
      menuPlatform: byId('menu-platform'),
      bossBar: byId('boss-bar'),
      bossName: byId('boss-name'),
      bossPhase: byId('boss-phase'),
      bossFill: byId('boss-fill'),
      bossSub: byId('boss-sub'),
      btnInventory: byId('btn-inventory'),
      menuBest: byId('menu-best'),
      overScore: byId('over-score'),
      overBest: byId('over-best'),
      overRecord: byId('over-record'),
      victoryScore: byId('victory-score'),
      victoryBest: byId('victory-best'),
      victoryRecord: byId('victory-record'),
      levelIntro: byId('level-intro'),
      levelIntroIndex: byId('level-intro-index'),
      levelIntroName: byId('level-intro-name'),
      levelClear: byId('level-clear'),
      levelClearBonus: byId('level-clear-bonus'),
      levelClearScore: byId('level-clear-score'),
      toasts: byId('toasts'),
      countdown: byId('countdown'),
      iconSoundOn: byId('icon-sound-on'),
      iconSoundOff: byId('icon-sound-off'),
      btnPause: byId('btn-pause'),
      btnSound: byId('btn-sound'),
      btnMenuSound: byId('btn-menu-sound'),
      btnMenuQuality: byId('btn-menu-quality'),
    };

    this.screens = {
      menu: byId('screen-menu'),
      pause: byId('screen-pause'),
      over: byId('screen-over'),
      victory: byId('screen-victory'),
    };

    this.root = root;
    this.handlers = {};
    this.livesRendered = -1;
    this.maxLivesSeen = TUNING.lives.start;
    this.effectsSignature = '';
    this.bossSignature = '';
    this.scoreBumpTimer = 0;
    this.introTimer = 0;
    this.toasts = [];

    this.bindButtons();
  }

  bindButtons() {
    const click = (id, handler) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.addEventListener('click', (event) => {
        event.preventDefault();
        handler?.(event);
      });
    };

    click('btn-play', () => this.handlers.play?.());
    click('btn-classic', () => this.handlers.classic?.());
    click('btn-continue', () => this.handlers.continue?.());
    click('btn-meta', () => this.handlers.meta?.());
    click('btn-inventory', () => this.handlers.inventory?.());
    click('btn-resume', () => this.handlers.resume?.());
    click('btn-restart', () => this.handlers.restart?.());
    click('btn-pause-menu', () => this.handlers.menu?.());
    click('btn-again', () => this.handlers.restart?.());
    click('btn-over-menu', () => this.handlers.menu?.());
    click('btn-victory-again', () => this.handlers.restart?.());
    click('btn-victory-menu', () => this.handlers.menu?.());
    click('btn-pause', () => this.handlers.pause?.());
    click('btn-sound', () => this.handlers.toggleSound?.());
    click('btn-menu-sound', () => this.handlers.toggleSound?.());
    click('btn-menu-quality', () => this.handlers.toggleEffects?.());
  }

  bind(handlers) {
    this.handlers = handlers;
  }

  setScreen(name) {
    for (const [key, element] of Object.entries(this.screens)) {
      if (!element) continue;
      element.classList.toggle('is-active', key === name);
    }
  }

  updateScore(score, best) {
    if (this.el.hudScore) {
      const text = formatScore(score);
      if (this.el.hudScore.textContent !== text) {
        this.el.hudScore.textContent = text;
        this.el.hudScore.classList.add('is-bump');
        window.clearTimeout(this.scoreBumpTimer);
        this.scoreBumpTimer = window.setTimeout(() => {
          this.el.hudScore?.classList.remove('is-bump');
        }, 140);
      }
    }
    if (this.el.hudBest) this.el.hudBest.textContent = formatScore(best);
    if (this.el.menuBest) this.el.menuBest.textContent = formatScore(best);
  }

  updateLevel(index) {
    if (this.el.hudLevel) this.el.hudLevel.textContent = `LEVEL ${index + 1}`;
  }

  updateCoins(value) {
    if (!this.el.hudCoins) return;
    this.el.hudCoins.textContent = formatScore(Math.max(0, value || 0));
  }

  updateRunHud(info = {}) {
    const isRun = info.mode === 'run';
    if (this.el.hudCoinsWrap) this.el.hudCoinsWrap.classList.toggle('is-hidden', !isRun);
    if (this.el.btnInventory) this.el.btnInventory.classList.toggle('is-hidden', !isRun);
    if (this.el.hudSector) {
      this.el.hudSector.textContent = isRun
        ? `${info.sector ?? ''} · SALA ${String(info.roomNumber ?? 1).padStart(2, '0')}${info.objective === 'boss' ? ' · BOSS' : ''}`
        : '';
    }
    if (isRun && this.el.hudLevel) this.el.hudLevel.textContent = `SALA ${String(info.roomNumber ?? 1).padStart(2, '0')}`;
    if (!isRun && this.el.hudCombo) this.el.hudCombo.textContent = '';
    if (!isRun && this.el.hudShields) this.el.hudShields.textContent = '';
    if (!isRun) this.updateCoins(0);
  }

  updateCombo(combo, best = 0) {
    if (!this.el.hudCombo) return;
    if (!combo || combo < 2) {
      this.el.hudCombo.textContent = '';
      this.el.hudCombo.classList.remove('is-active');
      return;
    }
    this.el.hudCombo.textContent = `COMBO ×${combo}${best > combo ? `  ·  BEST ×${best}` : ''}`;
    this.el.hudCombo.classList.add('is-active');
  }

  updateShields(count) {
    if (!this.el.hudShields) return;
    if (!count) {
      this.el.hudShields.textContent = '';
      return;
    }
    this.el.hudShields.innerHTML = Array.from({ length: Math.min(6, count) }, () => '<span class="shield-pip">◈</span>').join('');
    this.el.hudShields.setAttribute('aria-label', `Escudos: ${count}`);
  }

  showBossBar(view) {
    if (!this.el.bossBar || !view) return;
    this.el.bossBar.classList.add('is-active');
    this.el.bossBar.setAttribute('aria-hidden', 'false');
    this.el.hudCombo?.classList.add('is-suppressed');
    this.updateBossBar(view);
  }

  updateBossBar(view) {
    if (!this.el.bossBar || !view) return;
    const signature = `${view.name}|${view.hp}|${view.phase}|${view.phases}|${view.shield > 0}`;
    if (signature === this.bossSignature) return;
    this.bossSignature = signature;
    if (this.el.bossName) this.el.bossName.textContent = view.name;
    if (this.el.bossPhase) this.el.bossPhase.textContent = `FASE ${view.phase}/${view.phases}`;
    if (this.el.bossSub) this.el.bossSub.textContent = view.subtitle ?? '';
    if (this.el.bossFill) {
      this.el.bossFill.style.width = `${Math.max(0, Math.min(100, view.ratio * 100)).toFixed(1)}%`;
      this.el.bossBar.style.setProperty('--boss-color', view.color ?? '#38dcff');
    }
    this.el.bossBar.classList.toggle('is-shielded', (view.shield ?? 0) > 0);
  }

  hideBossBar() {
    if (!this.el.bossBar) return;
    this.el.bossBar.classList.remove('is-active', 'is-shielded');
    this.el.bossBar.setAttribute('aria-hidden', 'true');
    this.el.hudCombo?.classList.remove('is-suppressed');
    this.bossSignature = '';
  }

  bossIntro(view) {
    if (!view) return;
    this.showBossBar(view);
    this.toast(`${view.name} — ${view.subtitle ?? ''}`, view.weakColor ?? '#ff4a55');
  }

  bossDefeat(view) {
    if (view) this.toast(`${view.name} DESTRUÍDO`, '#ffd24a');
    this.hideBossBar();
  }

  setPlatformName(name) {
    if (this.el.menuPlatform) this.el.menuPlatform.textContent = `PLATAFORMA: ${name}`;
  }

  updateLives(lives) {
    if (!this.el.hudLives || this.livesRendered === lives) return;
    const grew = lives > this.livesRendered;
    this.livesRendered = lives;
    this.maxLivesSeen = Math.max(this.maxLivesSeen, lives, TUNING.lives.start);
    const slots = Math.max(TUNING.lives.start, this.maxLivesSeen);

    let html = '';
    for (let i = 0; i < slots; i += 1) {
      const lost = i >= lives;
      const pulse = grew && i === lives - 1 ? ' heart--pulse' : '';
      html += `<svg class="heart${lost ? ' heart--lost' : ''}${pulse}" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART_PATH}"/></svg>`;
    }
    this.el.hudLives.innerHTML = html;
    this.el.hudLives.setAttribute('aria-label', `Vidas: ${lives}`);
  }

  updateEffects(chips) {
    if (!this.el.hudEffects) return;
    const signature = chips.map((chip) => `${chip.id}:${chip.ratio.toFixed(2)}`).join('|');
    if (signature === this.effectsSignature) return;
    this.effectsSignature = signature;

    if (!chips.length) {
      this.el.hudEffects.innerHTML = '';
      return;
    }

    let html = '';
    for (const chip of chips) {
      const type = POWER_UP_TYPES[chip.id];
      if (!type) continue;
      const fill = Math.max(0, Math.min(1, chip.ratio)).toFixed(3);
      html += `<span class="chip" style="--chip:${type.color};--fill:${fill}">${type.glyph}<span class="chip__bar"></span></span>`;
    }
    this.el.hudEffects.innerHTML = html;
  }

  showLevelIntro(index, name) {
    if (!this.el.levelIntro) return;
    if (this.el.levelIntroIndex) this.el.levelIntroIndex.textContent = String(index + 1).padStart(2, '0');
    if (this.el.levelIntroName) this.el.levelIntroName.textContent = name;
    this.el.levelIntro.classList.add('is-active');
    window.clearTimeout(this.introTimer);
    this.introTimer = window.setTimeout(() => {
      this.el.levelIntro?.classList.remove('is-active');
    }, 1450);
  }

  hideLevelIntro() {
    window.clearTimeout(this.introTimer);
    this.el.levelIntro?.classList.remove('is-active');
  }

  showLevelClear(bonus, levelScore = 0) {
    if (!this.el.levelClear) return;
    if (this.el.levelClearBonus) this.el.levelClearBonus.textContent = `+${formatScore(bonus)}`;
    if (this.el.levelClearScore) this.el.levelClearScore.textContent = `${formatScore(levelScore)} PTS`;
    this.el.levelClear.classList.add('is-active');
  }

  hideLevelClear() {
    this.el.levelClear?.classList.remove('is-active');
  }

  toast(text, color = '#38dcff') {
    if (!this.el.toasts) return;
    const element = document.createElement('div');
    element.className = 'toast';
    element.style.setProperty('--toast', color);
    element.textContent = text;
    this.el.toasts.appendChild(element);
    this.toasts.push(element);

    while (this.toasts.length > 3) {
      const oldest = this.toasts.shift();
      oldest?.remove();
    }

    window.setTimeout(() => {
      element.classList.add('is-out');
      window.setTimeout(() => {
        element.remove();
        this.toasts = this.toasts.filter((item) => item !== element);
      }, 380);
    }, 1400);
  }

  showLaunchHint(show) {
    if (!this.el.countdown) return;
    this.el.countdown.classList.toggle('is-active', Boolean(show));
    this.el.countdown.textContent = show ? 'CLIQUE / ESPAÇO PARA LANÇAR' : '';
  }

  setSoundState(enabled) {
    this.el.iconSoundOn?.classList.toggle('is-hidden', !enabled);
    this.el.iconSoundOff?.classList.toggle('is-hidden', enabled);
    this.el.btnSound?.setAttribute('aria-label', enabled ? 'Desativar som' : 'Ativar som');
    this.el.btnMenuSound?.setAttribute('aria-pressed', String(enabled));
  }

  setEffectsState(enabled) {
    this.el.btnMenuQuality?.setAttribute('aria-pressed', String(enabled));
  }

  showGameOver({ score, best, record }) {
    if (this.el.overScore) this.el.overScore.textContent = formatScore(score);
    if (this.el.overBest) this.el.overBest.textContent = formatScore(best);
    this.el.overRecord?.classList.toggle('is-hidden', !record);
    this.setScreen('over');
  }

  showVictory({ score, best, record }) {
    if (this.el.victoryScore) this.el.victoryScore.textContent = formatScore(score);
    if (this.el.victoryBest) this.el.victoryBest.textContent = formatScore(best);
    this.el.victoryRecord?.classList.toggle('is-hidden', !record);
    this.setScreen('victory');
  }

  hideAllScreens() {
    this.setScreen(null);
  }
}

