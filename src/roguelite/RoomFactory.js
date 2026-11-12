import { LEVELS } from '../levels/Levels.js';
import { BOSS_ARENAS, ROOM_LAYOUTS } from '../levels/RoomLayouts.js';
import { bossById } from './BossLibrary.js';
import { DIFFICULTY, SECTORS } from './RogueliteConfig.js';
import { mergeModifiers } from './ModifierLibrary.js';

const NORMAL_CHARS = new Set(['1', '2', '3', '4', '5', '6', '7', 'P']);

/**
 * Turns a map node into a concrete RoomDef (layout rows, modifiers, objective,
 * speed and scaling). Deterministic through the injected RNG.
 */
export class RoomFactory {
  constructor({ rng }) {
    this.rng = rng;
    this.lastLayout = new Map();
  }

  reset({ rng = this.rng } = {}) {
    this.rng = rng;
    this.lastLayout.clear();
  }

  create({ node, floor = 0, roomNumber = 1, modifiers = [] } = {}) {
    const sectorIndex = node?.sectorId
      ? Math.max(0, SECTORS.findIndex((sector) => sector.id === node.sectorId))
      : 0;
    const sector = SECTORS[sectorIndex] ?? SECTORS[0];
    const type = node?.type ?? 'combat';
    const elite = type === 'elite';
    const boss = type === 'boss';
    const merged = mergeModifiers(modifiers);

    let layout;
    let bossDef = null;
    if (boss) {
      bossDef = bossById(sector.boss);
      const arena = BOSS_ARENAS[bossDef.arena] ?? BOSS_ARENAS.guardian;
      layout = { name: bossDef.name, rows: arena.rows, bossRow: arena.barrierRow };
    } else {
      layout = this.pickLayout(sector, elite);
    }

    const rows = this.applyArmor(
      this.transformRows(layout.rows, {
        mirror: merged.mirror,
        hardChance: boss ? 0 : merged.hardChance,
        rng: this.rng,
      }),
      boss ? 0 : (sector.armorChance ?? 0) + (elite ? 0.12 : 0),
      this.rng,
    );

    const hpBonus = boss
      ? 0
      : (sector.hpBonus ?? 0) +
        (elite ? DIFFICULTY.eliteHpBonus : 0) +
        (merged.hpBonus ?? 0);

    const speed = (sector.speed ?? 1) * (1 + floor * DIFFICULTY.speedPerFloor) * (1 + (boss ? 0 : merged.ballSpeed ?? 0));
    const valueScale =
      (DIFFICULTY.valuePerSector[sectorIndex] ?? 1) * (elite ? DIFFICULTY.eliteValueMult : 1);

    return {
      id: node?.id ?? `room-${roomNumber}`,
      nodeId: node?.id ?? null,
      type,
      boss: boss ? sector.boss : null,
      bossId: bossDef?.id ?? null,
      bossDef,
      sectorId: sector.id,
      sectorIndex,
      sectorName: sector.name,
      floor,
      roomNumber,
      name: boss ? bossDef.name : layout.name,
      layoutName: layout.name,
      rows,
      bossRow: layout.bossRow ?? null,
      paletteShift: layout.paletteShift ?? (sectorIndex * 2) % 7,
      speed,
      hpBonus,
      valueScale,
      elite,
      dropChance: elite ? 0.11 : undefined,
      modifiers: [...modifiers],
      modifierEffects: merged,
      objective: boss ? 'boss' : 'clear',
      accent: sector.accent,
      accent2: sector.accent2,
      rewardBias: boss ? 'epic' : elite ? 'rare' : null,
    };
  }

  pickLayout(sector, elite) {
    const classic = LEVELS.filter((level) => sector.layouts?.includes(level.name));
    const extra = ROOM_LAYOUTS;
    let pool = [...classic, ...extra];
    if (elite) {
      const hard = pool.filter((level) => level.rows.some((row) => /[HSX]/.test(row)));
      if (hard.length) pool = hard;
    }
    const previous = this.lastLayout.get(sector.id);
    let candidates = pool.filter((level) => level.name !== previous);
    if (!candidates.length) candidates = pool;
    const layout = this.rng?.pick(candidates) ?? candidates[0] ?? LEVELS[0];
    this.lastLayout.set(sector.id, layout.name);
    return layout;
  }

  transformRows(rows, { mirror = 0, hardChance = 0, rng } = {}) {
    let result = rows.map((row) => (mirror ? [...row].reverse().join('') : row));
    if (hardChance > 0 && rng) {
      result = result.map((row) =>
        [...row]
          .map((char) => (NORMAL_CHARS.has(char) && char !== 'P' && rng.chance(hardChance) ? 'H' : char))
          .join(''),
      );
    }
    return result;
  }

  /** Sector armor: a fraction of normal blocks become armored (3 HP). */
  applyArmor(rows, chance, rng) {
    if (!(chance > 0) || !rng) return rows;
    return rows.map((row) =>
      [...row]
        .map((char) => (/[1-7]/.test(char) && rng.chance(chance) ? 'S' : char))
        .join(''),
    );
  }
}
