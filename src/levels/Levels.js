/**
 * Level definitions.
 *
 * Legend (11 columns per row):
 *   '.'        empty cell
 *   '1'..'7'   neon block (palette index, 1 hit)
 *   'H'        hard block (2 hits)
 *   'S'        armored block (3 hits)
 *   'X'        steel block (indestructible, ignored by the clear condition)
 *   'P'        power block (1 hit, always drops a power-up)
 *
 * `speed` multiplies the base ball speed, `dropChance` overrides the power-up
 * drop probability for that level.
 */
export const LEVELS = [
  {
    name: 'Ignition',
    accent: '#38dcff',
    speed: 1,
    rows: [
      '11111111111',
      '22222222222',
      '33333333333',
      '44444444444',
      '55555555555',
    ],
  },
  {
    name: 'Cascade',
    accent: '#43f59b',
    speed: 1.03,
    rows: [
      '77777777777',
      '66666.66666',
      '55555555555',
      '444.444.444',
      '33333333333',
      '222.222.222',
      '11111111111',
    ],
  },
  {
    name: 'Armor',
    accent: '#ff8c2b',
    speed: 1.06,
    paletteShift: 2,
    rows: [
      '.HHHHHHHHH.',
      '.444444444.',
      '.333333333.',
      '.HHH.P.HHH.',
      '.111111111.',
    ],
  },
  {
    name: 'Lattice',
    accent: '#a86bff',
    speed: 1.09,
    rows: [
      '7.7.7.7.7.7',
      '.7.7.7.7.7.',
      '5.5.5.5.5.5',
      '.5.5.5.5.5.',
      '3.3.3.3.3.3',
      '.3.3.3.3.3.',
      '1.1.1.1.1.1',
    ],
  },
  {
    name: 'Core',
    accent: '#38dcff',
    speed: 1.12,
    paletteShift: 1,
    dropChance: 0.12,
    rows: [
      '..HHHHHHH..',
      '.P.......P.',
      '.6.55555.6.',
      '.6.5...5.6.',
      '.6.55555.6.',
      '.P.......P.',
      '..HHHHHHH..',
    ],
  },
  {
    name: 'Pyramid',
    accent: '#ffe14d',
    speed: 1.15,
    rows: [
      '.....1.....',
      '....121....',
      '...12321...',
      '..1234321..',
      '.123454321.',
      '1234P5P4321',
    ],
  },
  {
    name: 'Foundry',
    accent: '#ff4a55',
    speed: 1.18,
    paletteShift: 3,
    rows: [
      'X.HHHHHHH.X',
      '..5555555..',
      '..4444444..',
      '..3333333..',
      '..2222222..',
      'X.HHHHHHH.X',
    ],
  },
  {
    name: 'Diamond',
    accent: '#ff2f8d',
    speed: 1.21,
    rows: [
      '.....5.....',
      '....4H4....',
      '...3H5H3...',
      '..2H454H2..',
      '...3H5H3...',
      '....4H4....',
      '.....5.....',
    ],
  },
  {
    name: 'Rivers',
    accent: '#43f59b',
    speed: 1.24,
    paletteShift: 4,
    rows: [
      'P.7.6.5.4.P',
      '.7.6.5.4.6.',
      '7.6.5.4.6.7',
      '.6.5.4.6.5.',
      '5.4.6.5.4.5',
    ],
  },
  {
    name: 'Crossfire',
    accent: '#ff8c2b',
    speed: 1.27,
    paletteShift: 2,
    dropChance: 0.1,
    rows: [
      '22222S22222',
      '2.2.2S2.2.2',
      '22HHH.HHH22',
      '..2.....2..',
      'PP.77777.PP',
      '..2.....2..',
      '22HHH.HHH22',
      '2.2.2S2.2.2',
      '22222S22222',
    ],
  },
  {
    name: 'Fortress',
    accent: '#a86bff',
    speed: 1.3,
    paletteShift: 5,
    rows: [
      'HHHHHHHHHHH',
      'H.........H',
      'H.6666666.H',
      'H.6.....6.H',
      'H.6.PPP.6.H',
      'H.6.....6.H',
      'H.6666666.H',
      'H.........H',
      'HHHHHHHHHHH',
    ],
  },
  {
    name: 'Overdrive',
    accent: '#ff2f8d',
    speed: 1.34,
    paletteShift: 1,
    dropChance: 0.095,
    rows: [
      'S444444444S',
      'H333333333H',
      'H.P.P.P.P.H',
      'H222222222H',
      'H1.1.1.1.1H',
      'H111111111H',
      'H.P.P.P.P.H',
      'H555555555H',
      'S666666666S',
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
