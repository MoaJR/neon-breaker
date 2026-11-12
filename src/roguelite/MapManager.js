import { RUN, SECTORS } from './RogueliteConfig.js';

export const NODE_TYPES = {
  combat: { id: 'combat', label: 'COMBATE', icon: '◆', color: '#38dcff', short: 'Sala normal com blocos.' },
  elite: { id: 'elite', label: 'ELITE', icon: '✦', color: '#ff8c2b', short: 'Sala difícil, recompensa melhor.' },
  treasure: { id: 'treasure', label: 'TESOURO', icon: '▣', color: '#ffd24a', short: 'Escolha uma relíquia.' },
  shop: { id: 'shop', label: 'LOJA', icon: '⌂', color: '#43f59b', short: 'Gaste moedas em upgrades.' },
  event: { id: 'event', label: 'EVENTO', icon: '?', color: '#a86bff', short: 'Uma escolha e suas consequências.' },
  rest: { id: 'rest', label: 'DESCANSO', icon: '+', color: '#8fe8ff', short: 'Recupere vida ou melhore um upgrade.' },
  boss: { id: 'boss', label: 'CHEFE', icon: '☠', color: '#ff4a55', short: 'Um confronto especial.' },
  unknown: { id: 'unknown', label: '???', icon: '·', color: '#5a6a85', short: 'Sinal perdido.' },
};

const TYPE_WEIGHTS = {
  combat: 55,
  elite: 8,
  treasure: 8,
  shop: 11,
  event: 12,
  rest: 6,
};

/**
 * Procedural sector graph: 5 floors, 2→1 branches, guaranteed connectivity and
 * a boss reachable from every branch. Reveals only what the player needs.
 */
export class MapManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.sector = null;
    this.sectorIndex = 0;
    this.floors = [];
    this.nodes = new Map();
    this.currentId = null;
    this.clearedIds = [];
    this.visitedIds = [];
    this.sectorComplete = false;
    this.rng = null;
  }

  startSector({ sectorIndex = 0, rng } = {}) {
    const sector = SECTORS[sectorIndex] ?? SECTORS[0];
    this.reset();
    this.sector = sector;
    this.sectorIndex = sector.index;
    this.rng = rng;
    this.floors = this.generate(sector);
    for (const floor of this.floors) {
      for (const node of floor) this.nodes.set(node.id, node);
    }
    this.refreshStates(this.floors);
    return this;
  }

  generate(sector) {
    const counts = RUN.nodesPerFloor;
    const floors = counts.map((count, floor) => {
      const nodes = [];
      for (let col = 0; col < count; col += 1) {
        nodes.push({
          id: `${sector.id}-f${floor}-n${col}`,
          sectorId: sector.id,
          floor,
          col,
          type: this.pickType(sector, floor),
          next: [],
          state: 'locked',
          revealed: 'hidden',
        });
      }
      return nodes;
    });

    this.ensureType(floors, 'shop');
    this.ensureType(floors, 'event');

    for (let floor = 0; floor < floors.length - 1; floor += 1) {
      this.connectFloors(floors[floor], floors[floor + 1]);
    }

    this.refreshStates(floors);
    return floors;
  }

  pickType(sector, floor) {
    if (floor === 0) return 'combat';
    if (floor === RUN.floorsPerSector - 1) return 'boss';
    const eliteWeight = (sector.eliteWeight ?? 0) > 0 ? (sector.eliteWeight ?? 0) + (floor >= 2 ? 8 : 0) : 0;
    const weights = {
      combat: TYPE_WEIGHTS.combat,
      elite: eliteWeight,
      treasure: TYPE_WEIGHTS.treasure,
      shop: TYPE_WEIGHTS.shop,
      event: TYPE_WEIGHTS.event,
      rest: TYPE_WEIGHTS.rest,
    };
    const entries = Object.entries(weights).map(([type, weight]) => ({ type, weight }));
    return this.rng?.weighted(entries)?.type ?? 'combat';
  }

  ensureType(floors, type) {
    const middle = floors.slice(1, -1).flat();
    if (middle.some((node) => node.type === type)) return;
    const candidates = middle.filter((node) => node.type === 'combat');
    const target = this.rng?.pick(candidates.length ? candidates : middle);
    if (target) target.type = type;
  }

  connectFloors(current, next) {
    for (const node of current) {
      const candidates = next.filter((candidate) => Math.abs(candidate.col - node.col) <= 1);
      const pool = candidates.length ? candidates : next;
      const linkCount = Math.min(pool.length, this.rng?.chance(0.6) ? 2 : 1);
      const chosen = this.rng ? this.rng.shuffle(pool).slice(0, linkCount) : pool.slice(0, linkCount);
      for (const target of chosen) {
        if (!node.next.includes(target.id)) node.next.push(target.id);
      }
    }
    for (const target of next) {
      const hasParent = current.some((node) => node.next.includes(target.id));
      if (hasParent) continue;
      let best = current[0];
      let bestDistance = Infinity;
      for (const node of current) {
        const distance = Math.abs(node.col - target.col);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = node;
        }
      }
      if (!best.next.includes(target.id)) best.next.push(target.id);
    }
  }

  refreshStates(floors) {
    const current = this.currentId ? this.nodes.get(this.currentId) : null;
    const currentFloor = current ? current.floor : -1;
    const cleared = new Set(this.clearedIds);
    for (const floor of floors) {
      for (const node of floor) {
        node.revealed = node.floor <= currentFloor + 2 ? 'known' : 'hidden';
        if (cleared.has(node.id)) node.state = 'cleared';
        else if (node.id === this.currentId) node.state = 'current';
        else if (this.isAvailableId(node.id)) node.state = 'available';
        else node.state = 'locked';
      }
    }
  }

  isAvailableId(id) {
    if (!this.currentId) {
      const node = this.nodes.get(id);
      return Boolean(node) && node.floor === 0;
    }
    if (this.clearedIds.includes(this.currentId)) {
      const current = this.nodes.get(this.currentId);
      return Boolean(current) && current.next.includes(id);
    }
    return false;
  }

  availableNodes() {
    const result = [];
    for (const floor of this.floors) {
      for (const node of floor) {
        if (node.state === 'available') result.push(node);
      }
    }
    return result;
  }

  canEnter(id) {
    const node = this.nodes.get(id);
    return Boolean(node) && this.isAvailableId(id);
  }

  enter(id) {
    if (!this.canEnter(id)) return null;
    const node = this.nodes.get(id);
    this.currentId = id;
    if (!this.visitedIds.includes(id)) this.visitedIds.push(id);
    this.refreshStates(this.floors);
    return node;
  }

  completeCurrent() {
    if (!this.currentId) return null;
    const node = this.nodes.get(this.currentId);
    if (!node) return null;
    if (!this.clearedIds.includes(node.id)) this.clearedIds.push(node.id);
    if (node.type === 'boss') this.sectorComplete = true;
    this.refreshStates(this.floors);
    return node;
  }

  get currentNode() {
    return this.currentId ? this.nodes.get(this.currentId) : null;
  }

  get progress() {
    const total = this.floors.length || RUN.floorsPerSector;
    return {
      current: this.currentNode?.floor ?? 0,
      total,
      cleared: this.clearedIds.length,
    };
  }

  /** Serializable view used by the map UI and save snapshots. */
  view() {
    return {
      sectorId: this.sector?.id ?? '',
      sectorIndex: this.sectorIndex,
      name: this.sector?.name ?? '',
      subtitle: this.sector?.subtitle ?? '',
      brief: this.sector?.brief ?? '',
      accent: this.sector?.accent ?? '#38dcff',
      accent2: this.sector?.accent2 ?? '#ff2f8d',
      floors: this.floors.map((floor) =>
        floor.map((node) => ({
          id: node.id,
          floor: node.floor,
          col: node.col,
          type: node.revealed === 'known' ? node.type : 'unknown',
          realType: node.type,
          revealed: node.revealed,
          state: node.state,
          next: [...node.next],
        })),
      ),
      currentId: this.currentId,
      clearedIds: [...this.clearedIds],
      visitedIds: [...this.visitedIds],
      bossId: this.sector?.boss ?? 'guardian',
      sectorComplete: this.sectorComplete,
      progress: this.progress,
    };
  }

  toJSON() {
    return {
      sectorIndex: this.sectorIndex,
      currentId: this.currentId,
      clearedIds: [...this.clearedIds],
      visitedIds: [...this.visitedIds],
    };
  }

  /** Rebuild the deterministic map and restore progress (used by run resume). */
  restore(saved = {}) {
    if (!this.sector) return this;
    this.currentId = saved.currentId ?? null;
    this.clearedIds = Array.isArray(saved.clearedIds) ? [...saved.clearedIds] : [];
    this.visitedIds = Array.isArray(saved.visitedIds) ? [...saved.visitedIds] : [];
    this.sectorComplete = this.clearedIds.some((id) => this.nodes.get(id)?.type === 'boss');
    this.refreshStates(this.floors);
    return this;
  }
}
