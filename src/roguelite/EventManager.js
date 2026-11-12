import { EVENT_LIBRARY, eventById } from './EventLibrary.js';

/**
 * Resolves declarative event choices against a small API supplied by the run
 * controller. Keeps events data-driven and testable.
 */
export class EventManager {
  constructor({ rng }) {
    this.rng = rng;
  }

  reset({ rng = this.rng } = {}) {
    this.rng = rng;
  }

  pick() {
    return this.rng.pick(EVENT_LIBRARY);
  }

  /** Returns { ok, event, choice, lines, followUp } or { ok:false, reason }. */
  resolve(eventId, choiceId, api) {
    const event = eventById(eventId);
    if (!event) return { ok: false, reason: 'Evento inexistente.' };
    const choice = event.choices.find((item) => item.id === choiceId);
    if (!choice) return { ok: false, reason: 'Escolha inexistente.' };

    for (const op of choice.ops) {
      if (op.type === 'pay' && api.coins() < op.amount) {
        return { ok: false, reason: 'Moedas insuficientes.' };
      }
    }

    const lines = [];
    let followUp = null;

    for (const op of choice.ops) {
      switch (op.type) {
        case 'coins': {
          api.addCoins(op.amount);
          lines.push(op.amount >= 0 ? `+${op.amount} moedas.` : `${op.amount} moedas.`);
          break;
        }
        case 'pay': {
          api.addCoins(-op.amount);
          lines.push(`−${op.amount} moedas pagas.`);
          break;
        }
        case 'life': {
          const current = api.lives();
          const max = api.maxLives();
          const next = Math.max(1, Math.min(max, current + op.amount));
          const delta = next - current;
          api.changeLives(delta);
          lines.push(delta === 0 ? 'Vida não alterada (limite atingido).' : delta > 0 ? `+${delta} vida.` : `${delta} vida.`);
          break;
        }
        case 'data': {
          api.addData(op.amount);
          lines.push(`+${op.amount} DATA permanente.`);
          break;
        }
        case 'pendingLife': {
          api.pendingLife(op.amount);
          lines.push(`${op.amount} vida na próxima sala.`);
          break;
        }
        case 'relicRandom': {
          const relic = api.addRandomRelic(op.bias ?? null);
          lines.push(relic ? `Relíquia: ${relic.name}.` : 'Sem espaço para relíquia — +80 moedas.');
          break;
        }
        case 'upgradeRandom': {
          const names = api.addRandomUpgrades(op.bias ?? null, op.count ?? 1);
          lines.push(names.length ? `Upgrades: ${names.join(', ')}.` : 'Nenhum upgrade disponível.');
          break;
        }
        case 'sacrificeUpgrade': {
          const removed = api.removeRandomUpgrade();
          lines.push(removed ? `Upgrade perdido: ${removed}.` : 'Nada para sacrificar.');
          break;
        }
        case 'forceModifier': {
          const modifiers = api.forceModifiers(op.count ?? 1);
          lines.push(modifiers.length ? `Próxima sala: ${modifiers.join(', ')}.` : 'A anomalia não respondeu.');
          break;
        }
        case 'clearModifier': {
          const removed = api.clearModifiers(op.count ?? 1);
          lines.push(removed ? 'A próxima sala perdeu um modificador.' : 'Nenhum modificador para remover.');
          break;
        }
        case 'eventBonus': {
          api.addEventBonus(op);
          if (op.damageBonus) lines.push(`+${Math.round(op.damageBonus * 100)}% de dano pelo resto da run.`);
          break;
        }
        case 'reward': {
          followUp = { type: 'reward', bias: op.bias ?? null, count: op.count ?? 2 };
          lines.push('Escolha sua recompensa.');
          break;
        }
        case 'mysteryItem': {
          const roll = this.rng.next();
          if (roll < 0.6) {
            const names = api.addRandomUpgrades('rare', 1);
            lines.push(names.length ? `O item era: ${names[0]}.` : 'O item implodiu em silêncio.');
          } else if (roll < 0.85) {
            const relic = api.addRandomRelic('uncommon');
            lines.push(relic ? `O item era: ${relic.name}.` : 'O item era uma relíquia — sem espaço, virou 60 moedas.');
          } else {
            lines.push('O item era... nada. O mercador já foi embora.');
          }
          break;
        }
        case 'unstableCoins': {
          if (this.rng.chance(op.winChance)) {
            api.addCoins(op.win);
            lines.push(`O cofre explode em luz: +${op.win} moedas.`);
          } else {
            const loss = Math.floor(api.coins() * op.loseRatio);
            api.addCoins(-loss);
            lines.push(`O cofre colapsa: −${loss} moedas.`);
          }
          break;
        }
        default:
          break;
      }
    }

    return { ok: true, event, choice, lines, followUp };
  }
}
