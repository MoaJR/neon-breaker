import { GAME_STATE } from './core/Config.js';
import { GameEngine } from './core/GameEngine.js';
import { InputController } from './input/InputController.js';
import { GameRenderer } from './render/GameRenderer.js';
import { AudioManager } from './systems/AudioManager.js';
import { StorageService } from './systems/StorageService.js';
import { GameUI } from './ui/GameUI.js';
import { RogueliteUI } from './ui/RogueliteUI.js';
import { SaveManager } from './roguelite/SaveManager.js';
import { MetaProgressionManager } from './roguelite/MetaProgressionManager.js';
import { RogueliteManager } from './roguelite/RogueliteManager.js';

const canvas = document.getElementById('game');
const stage = document.getElementById('stage');
const hud = document.getElementById('hud');
const continueButton = document.getElementById('btn-continue');

const storage = new StorageService();
const settings = storage.getSettings();
const save = new SaveManager(storage);
const meta = new MetaProgressionManager(save);

const audio = new AudioManager({ enabled: settings.sound });
const renderer = new GameRenderer(canvas);
const ui = new GameUI(document);
const engine = new GameEngine({ renderer, ui, audio, storage, input: null });
const overlay = new RogueliteUI(document);
const roguelite = new RogueliteManager({ engine, ui, overlay, audio, save, meta });
engine.attachRoguelite(roguelite);

const input = new InputController({ stage, canvas, engine });
engine.input = input;

function refreshContinueButton() {
  if (!continueButton) return;
  const show = roguelite.hasSavedRun() && engine.state === GAME_STATE.MENU;
  continueButton.classList.toggle('is-hidden', !show);
}

ui.bind({
  play: () => {
    roguelite.startRun();
    refreshContinueButton();
  },
  continue: () => {
    if (roguelite.continueSavedRun()) refreshContinueButton();
  },
  classic: () => {
    overlay.close();
    engine.startGame();
    refreshContinueButton();
  },
  meta: () => roguelite.openMeta(),
  inventory: () => roguelite.toggleInventory(),
  resume: () => engine.resume(),
  restart: () => {
    if (engine.mode === 'run' && roguelite.run && !roguelite.run.ended) {
      roguelite.quitToMenu();
      roguelite.startRun();
    } else {
      engine.restart();
    }
    refreshContinueButton();
  },
  menu: () => {
    if (engine.mode === 'run' || roguelite.run) roguelite.quitToMenu();
    else engine.goMenu();
    refreshContinueButton();
  },
  pause: () => engine.togglePause(),
  toggleSound: () => engine.toggleSound(),
  toggleEffects: () => {
    const current = storage.getSettings();
    engine.setQuality(!current.effects);
  },
});

if (continueButton) {
  continueButton.addEventListener('click', () => {
    if (!roguelite.continueSavedRun()) {
      ui.toast('SEM RUN SALVA', '#ff4a55');
      return;
    }
    refreshContinueButton();
  });
}

/* ───────────────────────────── responsive layout ───────────────────────────── */

function layout() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const hudHeight = hud ? hud.getBoundingClientRect().height : 0;
  engine.resize(rect.width, rect.height, window.devicePixelRatio || 1, hudHeight);
}

let resizeQueued = false;
function queueLayout() {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    layout();
  });
}

if ('ResizeObserver' in window) {
  const observer = new ResizeObserver(queueLayout);
  observer.observe(stage);
}
window.addEventListener('resize', queueLayout);
window.addEventListener('orientationchange', () => window.setTimeout(layout, 260));

/* ───────────────────────────── boot ───────────────────────────── */

input.attach();
ui.setSoundState(settings.sound);
ui.setEffectsState(settings.effects);
ui.setPlatformName(meta.platform().name);
renderer.setPaddleAccent(meta.skinColor());
engine.setQuality(settings.effects);
engine.goMenu();
layout();
overlay.close();
refreshContinueButton();

const unlockAudio = () => audio.init();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

/* ───────────────────────────── main loop ───────────────────────────── */

const perf = { frames: 0, elapsed: 0, degraded: false };
let last = performance.now();
let rafId = 0;

function loop(now) {
  rafId = requestAnimationFrame(loop);
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(Math.max(raw, 0), 0.05);

  engine.frame(dt);

  if (!perf.degraded && engine.state === GAME_STATE.PLAYING) {
    perf.frames += 1;
    perf.elapsed += raw;
    if (perf.frames >= 90) {
      const average = perf.elapsed / perf.frames;
      if (average > 0.024) {
        perf.degraded = true;
        renderer.setQuality('low');
        engine.particles.setQuality(0.45);
      }
      perf.frames = 0;
      perf.elapsed = 0;
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && (engine.state === GAME_STATE.PLAYING || engine.state === GAME_STATE.LIFE_LOST)) {
    engine.togglePause();
  }
  last = performance.now();
});

document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });

rafId = requestAnimationFrame(loop);

window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  cancelAnimationFrame(rafId);
  last = performance.now();
  rafId = requestAnimationFrame(loop);
  if (engine.state === GAME_STATE.PLAYING) engine.togglePause();
});

window.addEventListener('pagehide', () => {
  cancelAnimationFrame(rafId);
  engine.saveBest();
  save.save();
});

/** Small public surface used for automated tests and debugging. */
window.NeonBreaker = {
  engine,
  renderer,
  ui,
  overlay,
  input,
  audio,
  storage,
  save,
  meta,
  roguelite,
  version: '2.0.0',
  snapshot: () => engine.getSnapshot(),
};
