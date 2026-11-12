/**
 * Upgrade library — pure data. Adding an upgrade means adding an entry here
 * (with its per-level bonuses); the engine reads the compiled BuildStats object,
 * so no engine file needs to change.
 */

export const UPGRADE_CATEGORIES = {
  offensive: { id: 'offensive', label: 'Ofensivo', color: '#ff6b8a' },
  defensive: { id: 'defensive', label: 'Defensivo', color: '#43f59b' },
  support: { id: 'support', label: 'Suporte', color: '#ffe14d' },
  special: { id: 'special', label: 'Especial', color: '#a86bff' },
};

const lv = (rows) => rows.map(([desc, bonus]) => ({ desc, bonus }));

const offensive = [
  {
    id: 'fireball',
    name: 'FIREBALL',
    category: 'offensive',
    rarity: 'rare',
    glyph: 'FB',
    maxLevel: 5,
    lore: 'A bola queima o que toca.',
    levels: lv([
      ['A bola aplica queimadura: 1 de dano a cada 0,8s por 2,5s.', { fireLevel: 1, burnDps: 0.8 }],
      ['Queimadura mais intensa e duradoura.', { fireLevel: 2, burnDps: 1.4 }],
      ['O fogo se espalha para 1 bloco vizinho (50%).', { fireLevel: 3, fireSpread: 0.5 }],
      ['Maior área de propagação (75%).', { fireLevel: 4, fireSpread: 0.75 }],
      ['Blocos destruídos liberam uma nova de fogo.', { fireLevel: 5, fireSpread: 0.75, fireNova: 1 }],
    ]),
  },
  {
    id: 'electric_ball',
    name: 'ELECTRIC BALL',
    category: 'offensive',
    rarity: 'rare',
    glyph: 'EL',
    maxLevel: 5,
    lore: 'Descargas saltam entre as camadas.',
    levels: lv([
      ['Cada impacto libera uma descarga em 1 bloco próximo.', { electricLevel: 1, electricTargets: 1, electricDamage: 1 }],
      ['A descarga atinge 2 blocos.', { electricLevel: 2, electricTargets: 2, electricDamage: 1 }],
      ['Alcance elétrico ampliado.', { electricLevel: 3, electricTargets: 2, electricDamage: 1, electricRange: 40 }],
      ['Descargas causam 2 de dano.', { electricLevel: 4, electricTargets: 2, electricDamage: 2, electricRange: 40 }],
      ['Descargas podem causar crítico.', { electricLevel: 5, electricTargets: 3, electricDamage: 2, electricRange: 50, electricCrit: 1 }],
    ]),
  },
  {
    id: 'explosive_impact',
    name: 'EXPLOSIVE IMPACT',
    category: 'offensive',
    rarity: 'uncommon',
    glyph: 'EX',
    maxLevel: 5,
    lore: 'Cada bloco destruído é uma granada.',
    levels: lv([
      ['Blocos destruídos explodem e danificam vizinhos (raio 62).', { explosionLevel: 1, explosionRadius: 62 }],
      ['Raio da explosão aumentado.', { explosionLevel: 2, explosionRadius: 78 }],
      ['Explosões causam 2 de dano.', { explosionLevel: 3, explosionRadius: 78, explosionDamage: 2 }],
      ['Raio ainda maior.', { explosionLevel: 4, explosionRadius: 96, explosionDamage: 2 }],
      ['Explosão devastadora (raio 112, dano 3).', { explosionLevel: 5, explosionRadius: 112, explosionDamage: 3 }],
    ]),
  },
  {
    id: 'piercing',
    name: 'PIERCING',
    category: 'offensive',
    rarity: 'uncommon',
    glyph: 'PR',
    maxLevel: 5,
    lore: 'Atravesse a camada sem desacelerar.',
    levels: lv([
      ['20% de chance de atravessar um bloco.', { pierceChance: 0.2 }],
      ['30% de chance de atravessar.', { pierceChance: 0.3 }],
      ['40% de chance de atravessar.', { pierceChance: 0.4 }],
      ['50% de chance de atravessar.', { pierceChance: 0.5 }],
      ['60% de chance de atravessar.', { pierceChance: 0.6 }],
    ]),
  },
  {
    id: 'critical_hit',
    name: 'CRITICAL HIT',
    category: 'offensive',
    rarity: 'common',
    glyph: 'CR',
    maxLevel: 5,
    lore: 'Precisão vale mais que força.',
    levels: lv([
      ['8% de chance de crítico (×2 dano e pontos).', { critChance: 0.08 }],
      ['13% de chance de crítico.', { critChance: 0.13 }],
      ['18% de chance de crítico.', { critChance: 0.18 }],
      ['23% de chance de crítico.', { critChance: 0.23 }],
      ['28% de chance de crítico.', { critChance: 0.28 }],
    ]),
  },
  {
    id: 'multiball',
    name: 'MULTIBALL',
    category: 'offensive',
    rarity: 'rare',
    glyph: '3X',
    maxLevel: 3,
    lore: 'Mais bolas, mais caos controlado.',
    levels: lv([
      ['+1 bola no início de cada sala.', { extraBalls: 1 }],
      ['+2 bolas no início de cada sala.', { extraBalls: 2 }],
      ['+3 bolas no início de cada sala.', { extraBalls: 3 }],
    ]),
  },
  {
    id: 'laser_paddle',
    name: 'LASER PADDLE',
    category: 'offensive',
    rarity: 'uncommon',
    glyph: 'LZ',
    maxLevel: 5,
    lore: 'A plataforma também ataca.',
    levels: lv([
      ['A plataforma dispara um laser a cada 4,5s.', { laserLevel: 1, laserInterval: 4.5, laserDamage: 1 }],
      ['Cadência de 3,9s.', { laserLevel: 2, laserInterval: 3.9, laserDamage: 1 }],
      ['Laser causa 2 de dano.', { laserLevel: 3, laserInterval: 3.3, laserDamage: 2 }],
      ['Cadência de 2,7s e dano 2.', { laserLevel: 4, laserInterval: 2.7, laserDamage: 2 }],
      ['Dois feixes por disparo (dano 3).', { laserLevel: 5, laserInterval: 2.2, laserDamage: 3, laserBarrage: 1 }],
    ]),
  },
  {
    id: 'chain_reaction',
    name: 'CHAIN REACTION',
    category: 'offensive',
    rarity: 'epic',
    glyph: 'CH',
    maxLevel: 3,
    lore: 'Uma destruição nunca termina sozinha.',
    levels: lv([
      ['25% de chance de desencadear reação em vizinhos.', { chainLevel: 1, chainChance: 0.25 }],
      ['45% de chance de reação em cadeia.', { chainLevel: 2, chainChance: 0.45 }],
      ['65% de chance de reação em cadeia.', { chainLevel: 3, chainChance: 0.65 }],
    ]),
  },
  {
    id: 'momentum',
    name: 'MOMENTUM',
    category: 'offensive',
    rarity: 'common',
    glyph: 'MO',
    maxLevel: 3,
    lore: 'Velocidade é pontuação.',
    levels: lv([
      ['+3% de velocidade da bola e +8% de pontos.', { ballSpeedBonus: 0.03, scoreBonus: 0.08 }],
      ['+6% de velocidade e +16% de pontos.', { ballSpeedBonus: 0.06, scoreBonus: 0.16 }],
      ['+9% de velocidade e +24% de pontos.', { ballSpeedBonus: 0.09, scoreBonus: 0.24 }],
    ]),
  },
  {
    id: 'salvage',
    name: 'SALVAGE',
    category: 'offensive',
    rarity: 'common',
    glyph: 'SV',
    maxLevel: 3,
    lore: 'Nada se perde no vazio.',
    levels: lv([
      ['Blocos blindados rendem +1 moeda.', { salvageLevel: 1 }],
      ['Blocos blindados rendem +2 moedas.', { salvageLevel: 2 }],
      ['Blocos blindados rendem +3 moedas.', { salvageLevel: 3 }],
    ]),
  },
];

const defensive = [
  {
    id: 'wide_paddle',
    name: 'WIDE PADDLE',
    category: 'defensive',
    rarity: 'common',
    glyph: 'WP',
    maxLevel: 5,
    lore: 'Mais área, mais controle.',
    levels: lv([
      ['+8% de largura na plataforma.', { paddleWidthBonus: 0.08 }],
      ['+16% de largura.', { paddleWidthBonus: 0.16 }],
      ['+24% de largura.', { paddleWidthBonus: 0.24 }],
      ['+32% de largura.', { paddleWidthBonus: 0.32 }],
      ['+40% de largura.', { paddleWidthBonus: 0.4 }],
    ]),
  },
  {
    id: 'magnetic_paddle',
    name: 'MAGNETIC PADDLE',
    category: 'defensive',
    rarity: 'uncommon',
    glyph: 'MG',
    maxLevel: 3,
    lore: 'Segure a bola. Escolha o momento.',
    levels: lv([
      ['25% de chance de segurar a bola ao rebater.', { magneticChance: 0.25 }],
      ['50% de chance de segurar a bola.', { magneticChance: 0.5 }],
      ['75% de chance de segurar a bola.', { magneticChance: 0.75 }],
    ]),
  },
  {
    id: 'shield',
    name: 'SHIELD',
    category: 'defensive',
    rarity: 'rare',
    glyph: 'SH',
    maxLevel: 3,
    lore: 'Uma camada entre você e o erro.',
    levels: lv([
      ['1 carga de escudo por sala.', { shieldCharges: 1 }],
      ['2 cargas de escudo por sala.', { shieldCharges: 2 }],
      ['3 cargas de escudo por sala.', { shieldCharges: 3 }],
    ]),
  },
  {
    id: 'second_chance',
    name: 'SECOND CHANCE',
    category: 'defensive',
    rarity: 'uncommon',
    glyph: '2C',
    maxLevel: 3,
    lore: 'O sistema reinicia a bola. Às vezes.',
    levels: lv([
      ['20% de chance de recuperar a bola perdida.', { secondChance: 0.2 }],
      ['35% de chance de recuperar a bola.', { secondChance: 0.35 }],
      ['50% de chance de recuperar a bola.', { secondChance: 0.5 }],
    ]),
  },
  {
    id: 'slow_motion',
    name: 'SLOW MOTION',
    category: 'defensive',
    rarity: 'uncommon',
    glyph: 'SM',
    maxLevel: 3,
    lore: 'O tempo cede por alguns instantes.',
    levels: lv([
      ['A cada 14s a bola desacelera por 1,6s.', { slowInterval: 14, slowDuration: 1.6 }],
      ['A cada 11s a bola desacelera.', { slowInterval: 11, slowDuration: 1.6 }],
      ['A cada 8s a bola desacelera.', { slowInterval: 8, slowDuration: 1.6 }],
    ]),
  },
  {
    id: 'reinforced_platform',
    name: 'REINFORCED PLATFORM',
    category: 'defensive',
    rarity: 'common',
    glyph: 'RP',
    maxLevel: 3,
    lore: 'Estrutura reforçada, impacto controlado.',
    levels: lv([
      ['+10% de altura, +10% de controle e −30% de stun.', { paddleHeightBonus: 0.1, englishBonus: 0.1, stunResist: 0.3 }],
      ['+20% de altura, +20% de controle e −60% de stun.', { paddleHeightBonus: 0.2, englishBonus: 0.2, stunResist: 0.6 }],
      ['+30% de altura, +30% de controle e −90% de stun.', { paddleHeightBonus: 0.3, englishBonus: 0.3, stunResist: 0.9 }],
    ]),
  },
];

const support = [
  {
    id: 'lucky',
    name: 'LUCKY',
    category: 'support',
    rarity: 'common',
    glyph: 'LK',
    maxLevel: 5,
    lore: 'O sistema gosta de você.',
    levels: lv([
      ['+1 de sorte nas ofertas.', { luck: 1 }],
      ['+2 de sorte.', { luck: 2 }],
      ['+3 de sorte.', { luck: 3 }],
      ['+4 de sorte.', { luck: 4 }],
      ['+5 de sorte.', { luck: 5 }],
    ]),
  },
  {
    id: 'gold_rush',
    name: 'GOLD RUSH',
    category: 'support',
    rarity: 'common',
    glyph: 'GR',
    maxLevel: 5,
    lore: 'Cada bloco é uma moeda.',
    levels: lv([
      ['+12% de moedas.', { coinBonus: 0.12 }],
      ['+24% de moedas.', { coinBonus: 0.24 }],
      ['+36% de moedas.', { coinBonus: 0.36 }],
      ['+48% de moedas.', { coinBonus: 0.48 }],
      ['+60% de moedas.', { coinBonus: 0.6 }],
    ]),
  },
  {
    id: 'treasure_hunter',
    name: 'TREASURE HUNTER',
    category: 'support',
    rarity: 'uncommon',
    glyph: 'TH',
    maxLevel: 3,
    lore: 'Relíquias deixam rastros.',
    levels: lv([
      ['+15% de chance/qualidade de relíquias.', { relicBonus: 0.15 }],
      ['+30% de chance/qualidade de relíquias.', { relicBonus: 0.3 }],
      ['+45% e uma opção extra em salas de tesouro.', { relicBonus: 0.45 }],
    ]),
  },
  {
    id: 'experience_boost',
    name: 'EXPERIENCE BOOST',
    category: 'support',
    rarity: 'uncommon',
    glyph: 'XP',
    maxLevel: 3,
    lore: 'O sistema aprende com você.',
    levels: lv([
      ['+15% de DATA ao fim da run.', { dataBonus: 0.15 }],
      ['+30% de DATA ao fim da run.', { dataBonus: 0.3 }],
      ['+45% de DATA ao fim da run.', { dataBonus: 0.45 }],
    ]),
  },
  {
    id: 'combo_master',
    name: 'COMBO MASTER',
    category: 'support',
    rarity: 'uncommon',
    glyph: 'CM',
    maxLevel: 5,
    lore: 'Sequências são a verdadeira moeda.',
    levels: lv([
      ['+0,2s de janela e +5% de bônus de combo.', { comboWindowBonus: 0.2, comboBonus: 0.05 }],
      ['+0,4s de janela e +10% de bônus.', { comboWindowBonus: 0.4, comboBonus: 0.1 }],
      ['+0,6s de janela e +15% de bônus.', { comboWindowBonus: 0.6, comboBonus: 0.15 }],
      ['+0,8s de janela e +20% de bônus.', { comboWindowBonus: 0.8, comboBonus: 0.2 }],
      ['+1,0s de janela e +25% de bônus.', { comboWindowBonus: 1, comboBonus: 0.25 }],
    ]),
  },
];


const special = [
  {
    id: 'void_ball',
    name: 'VOID BALL',
    category: 'special',
    rarity: 'epic',
    glyph: 'VB',
    maxLevel: 3,
    lore: 'A bola aprende a desaparecer.',
    levels: lv([
      ['A cada 12s uma bola se teletransporta.', { voidLevel: 1, voidInterval: 12 }],
      ['A cada 9s uma bola se teletransporta.', { voidLevel: 2, voidInterval: 9 }],
      ['A cada 7s e deixa uma fenda que danifica blocos.', { voidLevel: 3, voidInterval: 7 }],
    ]),
  },
  {
    id: 'gravity_well',
    name: 'GRAVITY WELL',
    category: 'special',
    rarity: 'epic',
    glyph: 'GW',
    maxLevel: 3,
    lore: 'A trajetória não é mais sua.',
    levels: lv([
      ['A cada 10s atrai a bola para o aglomerado de blocos.', { gravityLevel: 1, gravityInterval: 10 }],
      ['A cada 8s atrai a bola.', { gravityLevel: 2, gravityInterval: 8 }],
      ['A cada 6s atrai a bola por mais tempo.', { gravityLevel: 3, gravityInterval: 6, gravityDuration: 1.8 }],
    ]),
  },
  {
    id: 'clone',
    name: 'CLONE',
    category: 'special',
    rarity: 'epic',
    glyph: 'CL',
    maxLevel: 3,
    lore: 'Duas plataformas, uma mente.',
    levels: lv([
      ['Uma plataforma clone espelhada por 6s.', { cloneLevel: 1, cloneDuration: 6, cloneCooldown: 18 }],
      ['Clone por 8s.', { cloneLevel: 2, cloneDuration: 8, cloneCooldown: 15 }],
      ['Clone por 10s e cooldown menor.', { cloneLevel: 3, cloneDuration: 10, cloneCooldown: 12 }],
    ]),
  },
  {
    id: 'orbital',
    name: 'ORBITAL',
    category: 'special',
    rarity: 'rare',
    glyph: 'OR',
    maxLevel: 5,
    lore: 'Pequenos satélites de destruição.',
    levels: lv([
      ['2 orbes orbitam a plataforma e danificam blocos.', { orbitalLevel: 1, orbitalCount: 2, orbitalDamage: 1 }],
      ['3 orbes.', { orbitalLevel: 2, orbitalCount: 3, orbitalDamage: 1 }],
      ['4 orbes (dano 2).', { orbitalLevel: 3, orbitalCount: 4, orbitalDamage: 2 }],
      ['5 orbes (dano 2).', { orbitalLevel: 4, orbitalCount: 5, orbitalDamage: 2 }],
      ['6 orbes (dano 3).', { orbitalLevel: 5, orbitalCount: 6, orbitalDamage: 3 }],
    ]),
  },
  {
    id: 'black_hole',
    name: 'BLACK HOLE',
    category: 'special',
    rarity: 'legendary',
    glyph: 'BH',
    maxLevel: 3,
    lore: 'O vazio não devolve nada.',
    levels: lv([
      ['A cada 16s cria um campo que danifica blocos próximos.', { blackHoleLevel: 1, blackHoleInterval: 16, blackHoleRadius: 100, blackHoleDamage: 1 }],
      ['Campo maior e mais frequente (13s).', { blackHoleLevel: 2, blackHoleInterval: 13, blackHoleRadius: 120, blackHoleDamage: 2 }],
      ['Campo devastador a cada 10s.', { blackHoleLevel: 3, blackHoleInterval: 10, blackHoleRadius: 145, blackHoleDamage: 3 }],
    ]),
  },
];

const experimental = [
  {
    id: 'frost_ball',
    name: 'FROST BALL',
    category: 'special',
    rarity: 'rare',
    glyph: 'FR',
    maxLevel: 3,
    unlock: 'pack_experimental',
    lore: 'Frio desacelera até o núcleo.',
    levels: lv([
      ['Aumenta em 25% o cooldown dos ataques de chefe.', { frostLevel: 0.25 }],
      ['Aumenta em 50% o cooldown dos chefes.', { frostLevel: 0.5 }],
      ['Aumenta em 75% o cooldown dos chefes.', { frostLevel: 0.75 }],
    ]),
  },
  {
    id: 'vampire_ball',
    name: 'VAMPIRE BALL',
    category: 'special',
    rarity: 'epic',
    glyph: 'VM',
    maxLevel: 3,
    unlock: 'pack_experimental',
    lore: 'A destruição alimenta a plataforma.',
    levels: lv([
      ['A cada 35 blocos destruídos, 35% de chance de +1 vida.', { vampireLevel: 1 }],
      ['A cada 28 blocos, 45% de chance de +1 vida.', { vampireLevel: 2 }],
      ['A cada 22 blocos, 55% de chance de +1 vida.', { vampireLevel: 3 }],
    ]),
  },
  {
    id: 'quantum_split',
    name: 'QUANTUM SPLIT',
    category: 'special',
    rarity: 'epic',
    glyph: 'QS',
    maxLevel: 3,
    unlock: 'pack_experimental',
    lore: 'A perda vira multiplicação.',
    levels: lv([
      ['25% de chance de dividir a bola ao invés de perdê-la.', { quantumLevel: 1, quantumChance: 0.25 }],
      ['40% de chance de dividir.', { quantumLevel: 2, quantumChance: 0.4 }],
      ['55% de chance de dividir.', { quantumLevel: 3, quantumChance: 0.55 }],
    ]),
  },
];

export const UPGRADE_LIBRARY = [...offensive, ...defensive, ...support, ...special, ...experimental];

export const UPGRADE_LIBRARY_MAP = new Map(UPGRADE_LIBRARY.map((def) => [def.id, def]));

export function upgradeById(id) {
  return UPGRADE_LIBRARY_MAP.get(id) ?? null;
}

export const UPGRADE_IDS_BY_RARITY = Object.fromEntries(
  ['common', 'uncommon', 'rare', 'epic', 'legendary'].map((rarity) => [
    rarity,
    UPGRADE_LIBRARY.filter((def) => def.rarity === rarity),
  ]),
);

export function unlockedUpgrades(meta) {
  if (!meta) return UPGRADE_LIBRARY;
  return UPGRADE_LIBRARY.filter((def) => !def.unlock || meta.isUnlocked(def.unlock));
}

