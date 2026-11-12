/**
 * Extra room layouts used by the roguelite generator (the classic 12 layouts in
 * Levels.js are also part of the pool). Same 11-column legend as Levels.js.
 * Boss arenas use extended chars: C = core, W = weak point.
 */
export const ROOM_LAYOUTS = [
  {
    name: 'Split',
    tags: ['gap'],
    rows: ['1111.1111.1', '.2222222222', '333.333.333', '4444444.444', '555.555.555'],
  },
  {
    name: 'Spiral',
    tags: ['stair'],
    rows: [
      '11111111111',
      '.2222222222',
      '..333333333',
      '...44444444',
      '....5555555',
      '.....666666',
    ],
  },
  {
    name: 'Columns',
    tags: ['lattice'],
    rows: ['.1.1.1.1.1.', '.2.2.2.2.2.', '.3.3.3.3.3.', '.4.4.4.4.4.', '.5.5.5.5.5.'],
  },
  {
    name: 'Crown',
    tags: ['pyramid'],
    rows: ['.....7.....', '....676....', '...65556...', '..5444455..', '.433333334.', '32222222223'],
  },
  {
    name: 'Rings',
    tags: ['core'],
    rows: [
      '..HHHHHHH..',
      '.H.......H.',
      '.H.55555.H.',
      '.H.5...5.H.',
      '.H.55555.H.',
      '.H.......H.',
      '..HHHHHHH..',
    ],
  },
  {
    name: 'Vortex',
    tags: ['river'],
    rows: ['7.6.5.4.3.2', '.6.5.4.3.2.', '6.5.4.3.2.1', '.5.4.3.2.1.', '5.4.3.2.1.P'],
  },
  {
    name: 'Bastion',
    tags: ['fortress'],
    rows: ['X.HHHHHHH.X', '..S.....S..', '..S.PPP.S..', '..S.....S..', 'X.HHHHHHH.X'],
  },
  {
    name: 'Scatter',
    tags: ['chaos'],
    rows: ['.2.H.2.H.2.', 'H.3.P.3.H.4', '.2.H.2.H.2.', '6.5.6.5.6.5', '.4.4.4.4.4.'],
  },
];

export const BOSS_ARENAS = {
  guardian: {
    name: 'THE GUARDIAN',
    rows: [
      '..HHHHHHH..',
      '.H.W...W.H.',
      '.H..CCC..H.',
      '.H..CCC..H.',
      '.H.W...W.H.',
      '..HHHHHHH..',
      '...........',
    ],
    barrierRow: 6,
  },
  destroyer: {
    name: 'THE DESTROYER',
    rows: [
      '.HHHHHHHHH.',
      'H...W.W...H',
      'H..CCCCC..H',
      'H...W.W...H',
      '.HHHHHHHHH.',
      '...........',
    ],
    barrierRow: 5,
  },
  core: {
    name: 'THE CORE',
    rows: [
      '..HHHHHHH..',
      '.H.......H.',
      '.H.SSSSS.H.',
      '.H.SCCCS.H.',
      '.H.SSSSS.H.',
      '.H.......H.',
      '..HHHHHHH..',
      '...........',
    ],
    barrierRow: 7,
  },
  core_final: {
    name: 'THE CORE // FINAL FORM',
    rows: [
      '..HHHHHHH..',
      '.HW.....WH.',
      '.H.SSSSS.H.',
      '.H.SCCCS.H.',
      '.H.SSSSS.H.',
      '.HW.....WH.',
      '..HHHHHHH..',
      '...........',
    ],
    barrierRow: 7,
  },
};

export function roomLayoutByName(name) {
  return ROOM_LAYOUTS.find((layout) => layout.name === name) ?? null;
}
