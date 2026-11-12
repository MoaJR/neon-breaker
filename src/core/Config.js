/**
 * Global tuning constants for NEON BREAKER.
 * The world uses a fixed logical width (1000 units). Height is derived from the
 * real canvas aspect ratio, so the physics stay identical on every screen.
 */

export const WORLD_WIDTH = 1000;

/** Neon palette — row order matches the reference art (pink → purple). */
export const PALETTE = [
  { id: 'rose', core: '#ff2f8d', light: '#ff9dd0', dark: '#5c072f', value: 70 },
  { id: 'red', core: '#ff4a55', light: '#ffa6ab', dark: '#5c0a10', value: 60 },
  { id: 'orange', core: '#ff8c2b', light: '#ffc98a', dark: '#5c2c04', value: 50 },
  { id: 'yellow', core: '#ffe14d', light: '#fff3ad', dark: '#5c4b06', value: 40 },
  { id: 'green', core: '#43f59b', light: '#a9ffd6', dark: '#045c33', value: 30 },
  { id: 'cyan', core: '#38dcff', light: '#a8efff', dark: '#044a5c', value: 20 },
  { id: 'purple', core: '#a86bff', light: '#d8c2ff', dark: '#35146e', value: 10 },
];

export const BLOCK_KIND = {
  NORMAL: 'normal',
  HARD: 'hard',
  ARMORED: 'armored',
  STEEL: 'steel',
  POWER: 'power',
  BOSS_CORE: 'bossCore',
  BOSS_WEAK: 'bossWeak',
};

export const POWER_UP_TYPES = {
  multiball: {
    id: 'multiball',
    label: 'Multi Ball',
    glyph: 'M',
    color: '#a86bff',
    light: '#e2d0ff',
    weight: 16,
  },
  wide: {
    id: 'wide',
    label: 'Wide Paddle',
    glyph: 'W',
    color: '#38dcff',
    light: '#c9f6ff',
    weight: 26,
  },
  slow: {
    id: 'slow',
    label: 'Slow Ball',
    glyph: 'S',
    color: '#43f59b',
    light: '#ccffe6',
    weight: 22,
  },
  fire: {
    id: 'fire',
    label: 'Fire Ball',
    glyph: 'F',
    color: '#ff8c2b',
    light: '#ffd9b0',
    weight: 16,
  },
  life: {
    id: 'life',
    label: 'Extra Life',
    glyph: '+',
    color: '#ff2f8d',
    light: '#ffc6e4',
    weight: 7,
  },
};

export const POWER_UP_LIST = Object.values(POWER_UP_TYPES);

export const TUNING = {
  fixedStep: 1 / 120,
  maxSteps: 8,
  maxFrameDelta: 0.1,

  paddle: {
    baseWidth: 178,
    height: 16,
    wideFactor: 1.62,
    bottomMargin: 54,
    keyboardSpeed: 1350,
    follow: 26,
    maxBounceAngle: 62,
    english: 0.16,
  },

  ball: {
    radius: 9.5,
    baseSpeed: 560,
    speedPerLevel: 20,
    maxSpeed: 1150,
    minSpeed: 360,
    trail: 16,
    max: 8,
    slowFactor: 0.7,
    minVertical: 0.26,
    minHorizontal: 0.13,
  },

  blocks: {
    cols: 11,
    sideMargin: 38,
    gap: 6,
    topOffset: 24,
    heightRatio: 0.46,
    minHeight: 15,
    maxBottomRatio: 0.6,
  },

  powerUp: {
    width: 54,
    height: 23,
    fallSpeed: 240,
    dropChance: 0.085,
    maxOnScreen: 4,
    catchScore: 25,
  },

  particles: {
    max: 560,
    maxLow: 200,
  },

  score: {
    levelClearBase: 250,
    levelClearPerLevel: 40,
    levelClearPerLife: 120,
  },

  lives: {
    start: 3,
    max: 6,
  },
};

export const GAME_STATE = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  LEVEL_CLEAR: 'levelClear',
  LIFE_LOST: 'lifeLost',
  GAME_OVER: 'gameOver',
  VICTORY: 'victory',
  OVERLAY: 'overlay',
};

export const STORAGE_KEYS = {
  best: 'neonBreaker.best.v1',
  settings: 'neonBreaker.settings.v1',
};

/** Frames of reference used by the launch/ready flow. */
export const TIMINGS = {
  readyDelay: 1.35,
  lifeLostDelay: 1.15,
  levelClearDelay: 2.4,
  gameOverDelay: 1.1,
};
