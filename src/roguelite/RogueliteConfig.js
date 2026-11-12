/**
 * Central tuning for the roguelite layer.
 * Every probability, price, multiplier and limit lives here so balance can be
 * adjusted without touching gameplay code.
 */

export const SAVE_VERSION = 2;
export const STORAGE_KEY_SAVE = 'neonBreaker.save.v2';

/* ───────────────────────────── rarity ───────────────────────────── */

export const RARITIES = {
  common: {
    id: 'common',
    label: 'Comum',
    short: 'COM',
    weight: 55,
    price: 45,
    color: '#a8bcd6',
    soft: 'rgba(168, 188, 214, 0.16)',
    glow: 'rgba(168, 188, 214, 0.42)',
    order: 0,
  },
  uncommon: {
    id: 'uncommon',
    label: 'Incomum',
    short: 'INC',
    weight: 25,
    price: 75,
    color: '#43f59b',
    soft: 'rgba(67, 245, 155, 0.16)',
    glow: 'rgba(67, 245, 155, 0.46)',
    order: 1,
  },
  rare: {
    id: 'rare',
    label: 'Raro',
    short: 'RAR',
    weight: 13,
    price: 120,
    color: '#38dcff',
    soft: 'rgba(56, 220, 255, 0.16)',
    glow: 'rgba(56, 220, 255, 0.5)',
    order: 2,
  },
  epic: {
    id: 'epic',
    label: 'Épico',
    short: 'EPI',
    weight: 6,
    price: 180,
    color: '#a86bff',
    soft: 'rgba(168, 107, 255, 0.18)',
    glow: 'rgba(168, 107, 255, 0.55)',
    order: 3,
  },
  legendary: {
    id: 'legendary',
    label: 'Lendário',
    short: 'LGD',
    weight: 3,
    price: 280,
    color: '#ffd24a',
    soft: 'rgba(255, 210, 74, 0.2)',
    glow: 'rgba(255, 210, 74, 0.6)',
    order: 4,
  },
};

export const RARITY_IDS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export function rarityOf(id) {
  return RARITIES[id] || RARITIES.common;
}

export function rarityAtLeast(id, floorId) {
  return rarityOf(id).order >= rarityOf(floorId).order;
}

/* ───────────────────────────── sectors ───────────────────────────── */

export const SECTORS = [
  {
    id: 'neon-district',
    index: 0,
    name: 'NEON DISTRICT',
    subtitle: 'Setor 01 // Zona de entrada',
    brief: 'Camadas simples, leitura limpa. Aprenda a construir.',
    accent: '#38dcff',
    accent2: '#ff2f8d',
    speed: 1,
    hpBonus: 0,
    armorChance: 0,
    extraModifiers: 0,
    eliteWeight: 0,
    boss: 'guardian',
    unlock: null,
    layouts: ['Ignition', 'Cascade', 'Armor', 'Lattice', 'Pyramid'],
  },
  {
    id: 'cyber-factory',
    index: 1,
    name: 'CYBER FACTORY',
    subtitle: 'Setor 02 // Linha de montagem',
    brief: 'Blocos resistentes e bola mais rápida. O erro custa caro.',
    accent: '#ff8c2b',
    accent2: '#ffe14d',
    speed: 1.06,
    hpBonus: 0,
    armorChance: 0.08,
    extraModifiers: 1,
    eliteWeight: 10,
    boss: 'destroyer',
    unlock: null,
    layouts: ['Foundry', 'Diamond', 'Rivers', 'Crossfire', 'Core'],
  },
  {
    id: 'void-dimension',
    index: 2,
    name: 'VOID DIMENSION',
    subtitle: 'Setor 03 // Fenda instável',
    brief: 'Layouts complexos, modificadores hostis e o vazio olhando de volta.',
    accent: '#a86bff',
    accent2: '#38dcff',
    speed: 1.12,
    hpBonus: 1,
    armorChance: 0.16,
    extraModifiers: 1,
    eliteWeight: 16,
    boss: 'core',
    unlock: 'sector_void',
    layouts: ['Fortress', 'Overdrive', 'Diamond', 'Lattice', 'Rivers'],
  },
  {
    id: 'core-system',
    index: 3,
    name: 'CORE SYSTEM',
    subtitle: 'Setor 04 // Núcleo do sistema',
    brief: 'A última camada. Tudo o que você construiu será testado.',
    accent: '#ffd24a',
    accent2: '#ff4a55',
    speed: 1.18,
    hpBonus: 1,
    armorChance: 0.28,
    extraModifiers: 2,
    eliteWeight: 22,
    boss: 'core_final',
    unlock: 'sector_core',
    layouts: ['Overdrive', 'Fortress', 'Crossfire', 'Foundry', 'Pyramid'],
  },
];

export function sectorById(id) {
  return SECTORS.find((sector) => sector.id === id) || SECTORS[0];
}

/* ───────────────────────────── run rules ───────────────────────────── */

export const RUN = {
  floorsPerSector: 5,
  nodesPerFloor: [2, 3, 3, 2, 1],
  startingLives: 3,
  maxLives: 8,
  relicCap: 3,
  upgradeMaxLevel: 5,
  rewardChoices: 3,
  rerollsPerRun: 1,
  minRoomsPerSector: 5,
  survivalTick: 1,
  offerPity: 5,
  maxOffersRemembered: 8,
};

export const COMBO = {
  window: 2.4,
  windowPerLevel: 0.2,
  bonusPerStep: 0.04,
  bonusPerLevel: 0.05,
  maxSteps: 25,
};

export const COINS = {
  dropChance: 0.55,
  amounts: {
    normal: [1, 3],
    hard: [2, 5],
    armored: [3, 7],
    power: [2, 4],
    steel: [0, 0],
    boss: [2, 4],
  },
  roomClear: 12,
  roomClearPerSector: 6,
  eliteBonus: 25,
  bossBonus: 60,
  magnetRadius: 150,
  magnetSpeed: 620,
  fallSpeed: 190,
  maxOnScreen: 48,
  autoCollectRatio: 1,
};

/* ───────────────────────────── luck / rarity rolling ───────────────────────────── */

export const LUCK = {
  shift: 0.035,
  categoryBias: 0.4,
  gambleFlatten: 0.35,
};

/* ───────────────────────────── difficulty ───────────────────────────── */

export const DIFFICULTY = {
  speedPerFloor: 0.012,
  eliteHpBonus: 1,
  eliteValueMult: 1.35,
  eliteRewardBias: 'rare',
  bossRewardBias: 'epic',
  sectorHpBonus: [0, 0, 1, 1],
  modifierCount: [1, 1, 2, 2],
  armorPerSector: [0, 0.08, 0.16, 0.28],
  valuePerSector: [1, 1.1, 1.2, 1.35],
};

/* ───────────────────────────── economy ───────────────────────────── */

export const SHOP = {
  upgradeSlots: 3,
  relicSlots: 1,
  healPrice: 70,
  rerollBase: 20,
  rerollStep: 15,
  sectorPriceMult: [1, 1.12, 1.26, 1.42],
  relicPrice: {
    common: 110,
    uncommon: 150,
    rare: 220,
    epic: 320,
    legendary: 440,
  },
  maxRerolls: 4,
  healUses: 1,
};

export const META_DATA = {
  perRoom: 4,
  perBoss: 12,
  perScore: 600,
  perCoins: 25,
  perSynergy: 5,
  perVictory: 25,
  maxBonusMultiplier: 2.2,
};

/* ───────────────────────────── platforms ───────────────────────────── */

export const PLATFORMS = {
  standard: {
    id: 'standard',
    name: 'STANDARD',
    title: 'Plataforma equilibrada',
    desc: 'Sem desvios. O melhor ponto de partida para qualquer build.',
    accent: '#38dcff',
    widthMult: 1,
    ballSpeedMult: 1,
    scoreMult: 1,
    coinMult: 1,
    luck: 0,
    categoryBias: null,
    gamble: false,
    unlock: null,
  },
  speedster: {
    id: 'speedster',
    name: 'SPEEDSTER',
    title: 'Raquete curta, ritmo alto',
    desc: '−12% de largura, +8% de velocidade da bola e +5% de pontuação.',
    accent: '#ffe14d',
    widthMult: 0.88,
    ballSpeedMult: 1.08,
    scoreMult: 1.05,
    coinMult: 1,
    luck: 0,
    categoryBias: null,
    gamble: false,
    unlock: 'platform_speedster',
  },
  defender: {
    id: 'defender',
    name: 'DEFENDER',
    title: 'Controle e sobrevivência',
    desc: '+18% de largura, −5% de velocidade e +15% de drops de power-up.',
    accent: '#43f59b',
    widthMult: 1.18,
    ballSpeedMult: 0.95,
    scoreMult: 1,
    coinMult: 1,
    luck: 0,
    categoryBias: null,
    dropBonus: 0.15,
    gamble: false,
    unlock: 'platform_defender',
  },
  engineer: {
    id: 'engineer',
    name: 'ENGINEER',
    title: 'Especialista em tecnologia',
    desc: 'Ofertas puxam mais para upgrades ofensivos e especiais.',
    accent: '#ff8c2b',
    widthMult: 1,
    ballSpeedMult: 1,
    scoreMult: 1,
    coinMult: 1,
    luck: 1,
    categoryBias: ['offensive', 'special'],
    gamble: false,
    unlock: 'platform_engineer',
  },
  gambler: {
    id: 'gambler',
    name: 'GAMBLER',
    title: 'Alta variância, alta recompensa',
    desc: 'Raridades mais voláteis e +1 de sorte nas ofertas.',
    accent: '#a86bff',
    widthMult: 1,
    ballSpeedMult: 1,
    scoreMult: 1,
    coinMult: 1,
    luck: 1,
    categoryBias: null,
    gamble: true,
    unlock: 'platform_gambler',
  },
};

export const DEFAULT_PLATFORM = 'standard';

export function platformById(id, meta) {
  const def = PLATFORMS[id] || PLATFORMS[DEFAULT_PLATFORM];
  const unlocked = !def.unlock || (meta ? meta.hasNode(def.unlock) : true);
  return { ...def, unlocked };
}

/* ───────────────────────────── meta progression ───────────────────────────── */

export const META_NODES = [
  {
    id: 'platform_speedster',
    name: 'SPEEDSTER',
    desc: 'Desbloqueia a plataforma SPEEDSTER.',
    cost: 80,
    icon: 'SPD',
    branch: 'platform',
    requires: null,
  },
  {
    id: 'platform_defender',
    name: 'DEFENDER',
    desc: 'Desbloqueia a plataforma DEFENDER.',
    cost: 110,
    icon: 'DEF',
    branch: 'platform',
    requires: null,
  },
  {
    id: 'platform_engineer',
    name: 'ENGINEER',
    desc: 'Desbloqueia a plataforma ENGINEER.',
    cost: 150,
    icon: 'ENG',
    branch: 'platform',
    requires: 'platform_speedster',
  },
  {
    id: 'platform_gambler',
    name: 'GAMBLER',
    desc: 'Desbloqueia a plataforma GAMBLER.',
    cost: 200,
    icon: 'GMB',
    branch: 'platform',
    requires: 'platform_defender',
  },
  {
    id: 'sector_void',
    name: 'VOID DIMENSION',
    desc: 'Abre o setor 3 em novas runs.',
    cost: 160,
    icon: 'S3',
    branch: 'sector',
    requires: null,
  },
  {
    id: 'sector_core',
    name: 'CORE SYSTEM',
    desc: 'Abre o setor final e o chefe definitivo.',
    cost: 320,
    icon: 'S4',
    branch: 'sector',
    requires: 'sector_void',
  },
  {
    id: 'pack_relics',
    name: 'ARSENAL DE RELÍQUIAS',
    desc: 'Libera 4 relíquias avançadas no pool.',
    cost: 130,
    icon: 'REL',
    branch: 'pool',
    requires: null,
  },
  {
    id: 'pack_experimental',
    name: 'PROTÓTIPOS',
    desc: 'Libera 5 upgrades experimentais no pool.',
    cost: 180,
    icon: 'EXP',
    branch: 'pool',
    requires: null,
  },
  {
    id: 'bonus_life',
    name: 'NÚCLEO EXTRA',
    desc: '+1 vida inicial por run (efeito único e moderado).',
    cost: 190,
    icon: '+HP',
    branch: 'bonus',
    requires: null,
  },
  {
    id: 'bonus_coins',
    name: 'CRÉDITO INICIAL',
    desc: '+20 moedas no início de cada run.',
    cost: 90,
    icon: 'CR',
    branch: 'bonus',
    requires: null,
  },
  {
    id: 'bonus_reroll',
    name: 'RECALIBRAGEM',
    desc: '+1 reroll de recompensa por run.',
    cost: 120,
    icon: 'RR',
    branch: 'bonus',
    requires: null,
  },
  {
    id: 'skin_cyan',
    name: 'SKIN: ION',
    desc: 'Paleta ciano intensa para a plataforma.',
    cost: 40,
    icon: 'ION',
    branch: 'skin',
    requires: null,
  },
  {
    id: 'skin_amber',
    name: 'SKIN: EMBER',
    desc: 'Paleta âmbar para a plataforma.',
    cost: 60,
    icon: 'EMB',
    branch: 'skin',
    requires: 'skin_cyan',
  },
  {
    id: 'skin_violet',
    name: 'SKIN: VOID',
    desc: 'Paleta violeta para a plataforma.',
    cost: 80,
    icon: 'VOD',
    branch: 'skin',
    requires: 'skin_amber',
  },
];

export const META_NODE_MAP = new Map(META_NODES.map((node) => [node.id, node]));

/* ───────────────────────────── presentation timings ───────────────────────────── */

export const TIMING = {
  rewardDelay: 1.1,
  bossIntro: 1.8,
  bossDefeat: 2.2,
  coinToast: 1.1,
  mapEnter: 0.35,
  synergyBanner: 2.6,
  toastsCooldown: 0.4,
};

export const REWARD_CONTEXTS = {
  room: { label: 'SALA LIMPA', sub: 'Escolha uma melhoria', choices: 3 },
  elite: { label: 'ELITE DESTRUÍDA', sub: 'Recompensa reforçada', choices: 3, bias: 'rare' },
  boss: { label: 'CHEFE DERROTADO', sub: 'Recompensa de chefe', choices: 3, bias: 'epic' },
  event: { label: 'ESCOLHA', sub: 'Uma escolha, uma consequência', choices: 2 },
};

export const BOSS_REWARDS = {
  coins: 60,
  relicChance: 0.65,
  guaranteedRelic: true,
};
