/**
 * Event rooms: each choice is a list of operations resolved by EventManager.
 * Operations are declarative so consequences stay testable and transparent.
 */
export const EVENT_LIBRARY = [
  {
    id: 'contract',
    title: 'O CONTRATO',
    icon: 'CT',
    color: '#ff2f8d',
    text: 'Uma figura sem rosto oferece uma relíquia. O preço está escrito em uma linguagem que você quase entende.',
    choices: [
      {
        id: 'accept',
        label: 'ASSINAR',
        hint: 'Relíquia rara, mas comece a próxima sala com −1 vida.',
        ops: [
          { type: 'relicRandom', bias: 'rare' },
          { type: 'pendingLife', amount: -1 },
        ],
      },
      { id: 'refuse', label: 'RECUSAR', hint: '+25 moedas pela educação.', ops: [{ type: 'coins', amount: 25 }] },
    ],
  },
  {
    id: 'unstable_treasure',
    title: 'TESOURO INSTÁVEL',
    icon: 'UT',
    color: '#ffe14d',
    text: 'Um cofre pulsa em frequências erradas. Há algo vivo lá dentro — ou apenas muita energia.',
    choices: [
      {
        id: 'gamble',
        label: 'ABRIR AGORA',
        hint: '65%: +120 moedas. 35%: perde metade das moedas.',
        ops: [{ type: 'unstableCoins', winChance: 0.65, win: 120, loseRatio: 0.5 }],
      },
      { id: 'safe', label: 'DRENAR COM CALMA', hint: '+40 moedas garantidas.', ops: [{ type: 'coins', amount: 40 }] },
    ],
  },
  {
    id: 'sacrifice',
    title: 'SACRIFÍCIO',
    icon: 'SF',
    color: '#a86bff',
    text: 'Um altar aceita conhecimento. Ele devolve algo mais raro — mas nunca o mesmo.',
    choices: [
      {
        id: 'sacrifice',
        label: 'ENTREGAR UM UPGRADE',
        hint: 'Perde um upgrade aleatório e escolhe entre 2 opções raras.',
        ops: [{ type: 'sacrificeUpgrade' }, { type: 'reward', bias: 'rare', count: 2 }],
      },
      { id: 'leave', label: 'DEIXAR O ALTAR', hint: '+30 moedas.', ops: [{ type: 'coins', amount: 30 }] },
    ],
  },
  {
    id: 'anomaly',
    title: 'ANOMALIA',
    icon: 'AN',
    color: '#38dcff',
    text: 'Uma fenda mostra duas versões da próxima sala. Você pode escolher qual delas vai acontecer.',
    choices: [
      {
        id: 'chaos',
        label: 'ESCOLHER O CAOS',
        hint: 'Próxima sala recebe 1 modificador aleatório extra. +30 moedas.',
        ops: [{ type: 'forceModifier', count: 1 }, { type: 'coins', amount: 30 }],
      },
      {
        id: 'order',
        label: 'ESCOLHER A ORDEM',
        hint: '+15 moedas e −1 modificador na próxima sala.',
        ops: [{ type: 'clearModifier', count: 1 }, { type: 'coins', amount: 15 }],
      },
    ],
  },
  {
    id: 'mysterious_merchant',
    title: 'MERCADOR MISTERIOSO',
    icon: 'MM',
    color: '#43f59b',
    text: 'Uma cápsula vende algo sem mostrar o conteúdo. O preço é fixo. A qualidade, não.',
    choices: [
      {
        id: 'pay',
        label: 'PAGAR 60 MOEDAS',
        hint: '60% upgrade raro+, 25% relíquia, 15% nada.',
        ops: [{ type: 'pay', amount: 60 }, { type: 'mysteryItem' }],
      },
      { id: 'walk', label: 'IR EMBORA', hint: '+10 moedas encontradas no chão.', ops: [{ type: 'coins', amount: 10 }] },
    ],
  },
  {
    id: 'core_fragment',
    title: 'FRAGMENTO DE CORE',
    icon: 'CF',
    color: '#ffd24a',
    text: 'Um fragmento de dados puro flutua sobre um campo de força. Tocá-lo custa, mas o sistema paga.',
    choices: [
      {
        id: 'take',
        label: 'TOMAR O FRAGMENTO',
        hint: '+45 DATA permanente, mas −1 vida.',
        ops: [{ type: 'data', amount: 45 }, { type: 'life', amount: -1 }],
      },
      { id: 'scan', label: 'APENAS ESCANEAR', hint: '+15 DATA permanente.', ops: [{ type: 'data', amount: 15 }] },
    ],
  },
  {
    id: 'glitch_shrine',
    title: 'SANTUÁRIO GLITCH',
    icon: 'GS',
    color: '#ff8c2b',
    text: 'Um santuário corrompido promete poder. A instabilidade vai cobrar depois.',
    choices: [
      {
        id: 'power',
        label: 'ACEITAR O PODER',
        hint: '+10% de dano pelo resto da run. Próxima sala recebe 2 modificadores.',
        ops: [{ type: 'eventBonus', damageBonus: 0.1 }, { type: 'forceModifier', count: 2 }],
      },
      { id: 'cleanse', label: 'LIMPAR O SANTUÁRIO', hint: '+20 moedas e cura 1 vida.', ops: [{ type: 'coins', amount: 20 }, { type: 'life', amount: 1 }] },
    ],
  },
];

export const EVENT_LIBRARY_MAP = new Map(EVENT_LIBRARY.map((def) => [def.id, def]));

export function eventById(id) {
  return EVENT_LIBRARY_MAP.get(id) ?? null;
}
