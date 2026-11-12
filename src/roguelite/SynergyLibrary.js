/**
 * Synergies are discovered combinations. They are detected from owned upgrade
 * levels / relics and contribute extra bonuses to the compiled build.
 */
export const SYNERGY_LIBRARY = [
  {
    id: 'overload',
    name: 'OVERLOAD',
    color: '#38dcff',
    glyph: 'OV',
    desc: 'Descargas elétricas podem causar crítico e atingem mais um bloco.',
    lore: 'A corrente aprendeu a mirar.',
    requires: { upgrades: { electric_ball: 2, chain_reaction: 1, critical_hit: 1 } },
    bonus: { electricTargets: 1, electricCrit: 1 },
  },
  {
    id: 'supernova',
    name: 'SUPERNOVA',
    color: '#ff8c2b',
    glyph: 'SN',
    desc: 'Explosões aplicam fogo e têm raio maior.',
    lore: 'Uma estrela morta, ainda com fome.',
    requires: { upgrades: { explosive_impact: 2, fireball: 1, multiball: 1 } },
    bonus: { explosionRadius: 20, fireNova: 1 },
  },
  {
    id: 'golden_circuit',
    name: 'GOLDEN CIRCUIT',
    color: '#ffe14d',
    glyph: 'GD',
    desc: '+15% de moedas e −10% nos preços da loja.',
    lore: 'O sistema descobriu o capitalismo.',
    requires: { upgrades: { gold_rush: 1, lucky: 1, treasure_hunter: 1 } },
    bonus: { coinBonus: 0.15, shopDiscount: 0.1 },
  },
  {
    id: 'aegis',
    name: 'AEGIS PROTOCOL',
    color: '#43f59b',
    glyph: 'AE',
    desc: '+1 carga de escudo e +10% de largura da plataforma.',
    lore: 'Defesa em camadas, como uma cebola de metal.',
    requires: { upgrades: { wide_paddle: 1, magnetic_paddle: 1, shield: 1 } },
    bonus: { shieldCharges: 1, paddleWidthBonus: 0.1 },
  },
  {
    id: 'swarm',
    name: 'SWARM',
    color: '#a86bff',
    glyph: 'SW',
    desc: 'Orbes orbitais disparam projéteis periodicamente.',
    lore: 'Eles se multiplicam quando você não olha.',
    requires: { upgrades: { orbital: 1, multiball: 1, gravity_well: 1 } },
    bonus: { orbitalFire: 1, orbitalDamage: 1 },
  },
  {
    id: 'glass_storm',
    name: 'GLASS STORM',
    color: '#ff2f8d',
    glyph: 'GS',
    desc: 'Críticos explodem e espalham estilhaços.',
    lore: 'Quando o vidro quebra, tudo quebra junto.',
    requires: { relics: ['glass_cannon'], upgrades: { critical_hit: 2, explosive_impact: 1 } },
    bonus: { critExplosion: 1, explosionRadius: 16 },
  },
  {
    id: 'void_pact',
    name: 'VOID PACT',
    color: '#a86bff',
    glyph: 'VP',
    desc: 'O Black Hole também atrai a bola, criando trajetórias impossíveis.',
    lore: 'Você assinou. Não leu?',
    requires: { upgrades: { void_ball: 1, black_hole: 1, gravity_well: 1 } },
    bonus: { voidPull: 1 },
  },
  {
    id: 'bullet_time',
    name: 'BULLET TIME',
    color: '#38dcff',
    glyph: 'BT',
    desc: 'Lasers e orbes agem 50% mais rápido.',
    lore: 'O tempo é um recurso renovável.',
    requires: { upgrades: { slow_motion: 1, laser_paddle: 1, orbital: 1 } },
    bonus: { laserRate: 0.5, orbitalRate: 0.5 },
  },
];

export const SYNERGY_LIBRARY_MAP = new Map(SYNERGY_LIBRARY.map((def) => [def.id, def]));

export function synergyById(id) {
  return SYNERGY_LIBRARY_MAP.get(id) ?? null;
}

export function meetsRequirement(def, { upgrades = {}, relics = [] } = {}) {
  if (!def?.requires) return false;
  for (const [id, level] of Object.entries(def.requires.upgrades ?? {})) {
    if ((upgrades[id] ?? 0) < level) return false;
  }
  for (const id of def.requires.relics ?? []) {
    if (!relics.includes(id)) return false;
  }
  return true;
}
