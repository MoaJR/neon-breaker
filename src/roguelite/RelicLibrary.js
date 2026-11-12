/**
 * Relic library — permanent run modifiers that change rules rather than stats.
 */
export const RELIC_LIBRARY = [
  {
    id: 'heart_of_the_void',
    name: 'HEART OF THE VOID',
    rarity: 'rare',
    glyph: 'HV',
    desc: 'Concede +1 vida máxima nesta run.',
    lore: 'Um coração que bate fora do peito.',
    bonus: { maxLivesBonus: 1 },
  },
  {
    id: 'golden_core',
    name: 'GOLDEN CORE',
    rarity: 'uncommon',
    glyph: 'GC',
    desc: 'Todas as moedas rendem +30%.',
    lore: 'O núcleo de uma civilização que só sabia contar.',
    bonus: { coinBonus: 0.3 },
  },
  {
    id: 'broken_clock',
    name: 'BROKEN CLOCK',
    rarity: 'rare',
    glyph: 'BC',
    desc: '−12% de velocidade da bola, mas +25% de pontuação.',
    lore: 'O tempo quebrou. A pontuação agradece.',
    bonus: { ballSpeedBonus: -0.12, scoreBonus: 0.25 },
  },
  {
    id: 'chaos_engine',
    name: 'CHAOS ENGINE',
    rarity: 'epic',
    glyph: 'CE',
    desc: 'Cada sala recebe 1 modificador aleatório extra; +20% moedas.',
    lore: 'Não pergunte o que ele faz. Ele já fez.',
    bonus: { extraModifiers: 1, coinBonus: 0.2 },
  },
  {
    id: 'phoenix',
    name: 'PHOENIX',
    rarity: 'legendary',
    glyph: 'PH',
    desc: 'Uma vez por run, revive automaticamente com 2 vidas.',
    lore: 'A morte é só uma transição de estado.',
    bonus: { revive: 1 },
  },
  {
    id: 'gamblers_dice',
    name: "GAMBLER'S DICE",
    rarity: 'epic',
    glyph: 'GD',
    desc: '+2 de sorte em ofertas, mas +1 modificador por sala.',
    lore: 'Os dados estão viciados. A favor de quem?',
    bonus: { luck: 2, extraModifiers: 1 },
  },
  {
    id: 'glass_cannon',
    name: 'GLASS CANNON',
    rarity: 'epic',
    glyph: 'GL',
    desc: '+35% de dano em tudo, mas −1 vida máxima.',
    lore: 'Vidro temperado com um pouco de raiva.',
    bonus: { damageBonus: 0.35, maxLivesBonus: -1 },
  },
  {
    id: 'magnetic_core',
    name: 'MAGNETIC CORE',
    rarity: 'uncommon',
    glyph: 'MC',
    desc: 'Moedas são atraídas para a plataforma; +10% de valor.',
    lore: 'Um ímã de arrependimentos e créditos.',
    bonus: { coinMagnet: 1, coinBonus: 0.1 },
  },
  {
    id: 'aegis_core',
    name: 'AEGIS CORE',
    rarity: 'rare',
    glyph: 'AC',
    desc: 'Comece cada sala com 1 carga de escudo.',
    lore: 'A defesa mais antiga do sistema.',
    bonus: { shieldCharges: 1 },
  },
  {
    id: 'time_fracture',
    name: 'TIME FRACTURE',
    rarity: 'epic',
    glyph: 'TF',
    desc: 'A cada 12s, a bola desacelera por 1,4s.',
    lore: 'Um segundo roubado de outra run.',
    bonus: { slowInterval: 12, slowDuration: 1.4 },
  },
  {
    id: 'black_market',
    name: 'BLACK MARKET',
    rarity: 'rare',
    glyph: 'BM',
    desc: 'Preços da loja caem 20%.',
    lore: 'Tudo tem dois preços: o visível e o real.',
    bonus: { shopDiscount: 0.2 },
  },
  {
    id: 'echo_shard',
    name: 'ECHO SHARD',
    rarity: 'uncommon',
    glyph: 'ES',
    desc: '+1 reroll de recompensa por run.',
    lore: 'Uma segunda opinião, gravada em cristal.',
    bonus: { rerolls: 1 },
  },
  {
    id: 'void_lens',
    name: 'VOID LENS',
    rarity: 'rare',
    glyph: 'VL',
    desc: 'Reduz em 50% o stun causado por projéteis de chefe.',
    lore: 'Olhar o vazio de perto sai caro.',
    bonus: { stunResist: 0.5 },
    unlock: 'pack_relics',
  },
  {
    id: 'prism_core',
    name: 'PRISM CORE',
    rarity: 'epic',
    glyph: 'PC',
    desc: '+1 projétil orbital mesmo sem o upgrade.',
    lore: 'Luz dividida em pequenos predadores.',
    bonus: { orbitalCount: 1, orbitalDamage: 1 },
    unlock: 'pack_relics',
  },
  {
    id: 'chrono_anchor',
    name: 'CHRONO ANCHOR',
    rarity: 'epic',
    glyph: 'CA',
    desc: 'Slow Motion periódico permanente na run.',
    lore: 'A âncora segura o presente por um instante.',
    bonus: { slowInterval: 14, slowDuration: 1.2 },
    unlock: 'pack_relics',
  },
  {
    id: 'obsidian_heart',
    name: 'OBSIDIAN HEART',
    rarity: 'legendary',
    glyph: 'OH',
    desc: '+20% de dano e +20% de moedas, mas −1 vida máxima.',
    lore: 'Bate devagar. Bate forte.',
    bonus: { damageBonus: 0.2, coinBonus: 0.2, maxLivesBonus: -1 },
    unlock: 'pack_relics',
  },
];

export const RELIC_LIBRARY_MAP = new Map(RELIC_LIBRARY.map((def) => [def.id, def]));

export function relicById(id) {
  return RELIC_LIBRARY_MAP.get(id) ?? null;
}

export function unlockedRelics(meta) {
  if (!meta) return RELIC_LIBRARY;
  return RELIC_LIBRARY.filter((def) => !def.unlock || meta.isUnlocked(def.unlock));
}
