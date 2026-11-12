/**
 * Room modifiers announced in the briefing before the room starts.
 * `apply` fields are consumed by RoomFactory / GameEngine; no modifier knows
 * about the engine internals.
 */
export const MODIFIER_LIBRARY = [
  {
    id: 'darkness',
    name: 'DARKNESS',
    icon: 'DRK',
    color: '#6757a8',
    weight: 10,
    desc: 'Visibilidade reduzida: apenas a área ao redor da bola e da plataforma é iluminada.',
    apply: { darkness: 1 },
  },
  {
    id: 'fast_ball',
    name: 'FAST BALL',
    icon: 'SPD',
    color: '#ffe14d',
    weight: 12,
    desc: 'A bola fica 18% mais rápida nesta sala.',
    apply: { ballSpeed: 0.18 },
  },
  {
    id: 'double_trouble',
    name: 'DOUBLE TROUBLE',
    icon: '2X',
    color: '#ff8c2b',
    weight: 11,
    desc: '40% dos blocos normais se tornam resistentes.',
    apply: { hardChance: 0.4 },
  },
  {
    id: 'low_gravity',
    name: 'LOW GRAVITY',
    icon: 'LOW',
    color: '#38dcff',
    weight: 8,
    desc: 'A gravidade puxa a bola para baixo durante toda a sala.',
    apply: { gravity: 110 },
  },
  {
    id: 'chaos',
    name: 'CHAOS',
    icon: 'CHS',
    color: '#ff2f8d',
    weight: 9,
    desc: 'Cada rebatida na plataforma adiciona um desvio aleatório no ângulo.',
    apply: { chaos: 1 },
  },
  {
    id: 'armored',
    name: 'ARMORED',
    icon: 'ARM',
    color: '#9fb2c9',
    weight: 10,
    desc: 'Todos os blocos destrutíveis ganham +1 de resistência.',
    apply: { hpBonus: 1 },
  },
  {
    id: 'mirror',
    name: 'MIRROR',
    icon: 'MIR',
    color: '#43f59b',
    weight: 8,
    desc: 'O layout da sala é espelhado horizontalmente.',
    apply: { mirror: 1 },
  },
  {
    id: 'inflation',
    name: 'INFLATION',
    icon: 'INF',
    color: '#a86bff',
    weight: 7,
    desc: 'A cada 30s os blocos ganham +1 de resistência (até +2).',
    apply: { inflation: 1 },
  },
];

export const MODIFIER_LIBRARY_MAP = new Map(MODIFIER_LIBRARY.map((def) => [def.id, def]));

export function modifierById(id) {
  return MODIFIER_LIBRARY_MAP.get(id) ?? null;
}

/** Merge every modifier effect into one descriptor consumed by the engine. */
export function mergeModifiers(ids = []) {
  const merged = {
    ids: [],
    darkness: 0,
    ballSpeed: 0,
    hardChance: 0,
    gravity: 0,
    chaos: 0,
    hpBonus: 0,
    mirror: 0,
    inflation: 0,
  };
  for (const id of ids) {
    const def = MODIFIER_LIBRARY_MAP.get(id);
    if (!def) continue;
    merged.ids.push(id);
    for (const [key, value] of Object.entries(def.apply)) {
      if (typeof value === 'number') merged[key] += value;
    }
  }
  return merged;
}
