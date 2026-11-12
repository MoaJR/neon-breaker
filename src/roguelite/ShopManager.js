import { RARITIES, SHOP, rarityOf } from './RogueliteConfig.js';

/**
 * Shop stock, prices, purchases and reroll logic.
 * The caller owns the coin balance; this class only validates and mutates stock.
 */
export class ShopManager {
  constructor({ rng }) {
    this.rng = rng;
    this.stock = [];
    this.rerolls = 0;
    this.healSold = false;
  }

  open({ upgradeManager, relicManager, sectorIndex = 0, discount = 0, luck = 0 } = {}) {
    this.upgradeManager = upgradeManager;
    this.relicManager = relicManager;
    this.sectorIndex = sectorIndex;
    this.discount = Math.max(0, Math.min(0.5, discount));
    this.rerolls = 0;
    this.healSold = false;
    this.specialSold = false;
    this.stock = this.generate(luck);
    return this.stock;
  }

  generate(luck = 0) {
    const stock = [];
    const upgrades = this.upgradeManager.rollOffers({ count: SHOP.upgradeSlots, luck, bias: null });
    for (const offer of upgrades) {
      stock.push({
        ...offer,
        price: this.upgradePrice(offer),
        sold: false,
        itemId: `up-${offer.id}`,
      });
    }
    if (this.relicManager && !this.relicManager.isFull) {
      const relicOffers = this.relicManager.rollOffers({ count: SHOP.relicSlots, luck });
      for (const offer of relicOffers) {
        stock.push({
          ...offer,
          price: this.relicPrice(offer),
          sold: false,
          itemId: `relic-${offer.id}`,
        });
      }
    }
    if (!this.healSold) {
      stock.push({
        kind: 'heal',
        id: 'heal',
        itemId: 'heal',
        price: this.healPrice(),
        sold: false,
        rarity: 'uncommon',
        name: '+1 VIDA',
        desc: 'Recupera 1 vida (até o máximo).',
        glyph: 'HP',
      });
    }
    if (!this.specialSold) {
      stock.push({
        kind: 'special',
        id: 'reroll_token',
        itemId: 'special-reroll',
        price: Math.max(1, Math.round(90 * this.priceMultiplier())),
        sold: false,
        rarity: 'rare',
        name: 'ECHO TOKEN',
        desc: '+1 reroll de recompensa nesta run.',
        glyph: 'RR',
      });
    }
    return stock;
  }

  priceMultiplier() {
    const sectorMult = SHOP.sectorPriceMult[Math.min(this.sectorIndex, SHOP.sectorPriceMult.length - 1)] ?? 1;
    return sectorMult * (1 - this.discount);
  }

  upgradePrice(offer) {
    const base = RARITIES[offer.rarity]?.price ?? 75;
    const levelMult = offer.level > 1 ? 1 + (offer.level - 1) * 0.3 : 1;
    return Math.max(1, Math.round(base * levelMult * this.priceMultiplier()));
  }

  relicPrice(offer) {
    const base = SHOP.relicPrice[offer.rarity] ?? 150;
    return Math.max(1, Math.round(base * this.priceMultiplier()));
  }

  healPrice() {
    return Math.max(1, Math.round(SHOP.healPrice * this.priceMultiplier()));
  }

  rerollPrice() {
    return Math.max(1, Math.round((SHOP.rerollBase + SHOP.rerollStep * this.rerolls) * this.priceMultiplier()));
  }

  canBuy(itemId, coins) {
    const item = this.stock.find((entry) => entry.itemId === itemId);
    if (!item) return { ok: false, reason: 'Item inexistente.' };
    if (item.sold) return { ok: false, reason: 'Item já comprado.' };
    if (coins < item.price) return { ok: false, reason: 'Moedas insuficientes.' };
    return { ok: true, item };
  }

  /** Mark the item as sold; the caller applies the actual effect. */
  purchase(itemId) {
    const item = this.stock.find((entry) => entry.itemId === itemId);
    if (!item) return null;
    item.sold = true;
    if (item.kind === 'heal') this.healSold = true;
    if (item.kind === 'special') this.specialSold = true;
    return item;
  }

  canReroll(coins) {
    if (this.rerolls >= SHOP.maxRerolls) return { ok: false, reason: 'Limite de rerolls.' };
    const price = this.rerollPrice();
    if (coins < price) return { ok: false, reason: 'Moedas insuficientes.' };
    return { ok: true, price };
  }

  reroll({ coins, luck = 0 } = {}) {
    const check = this.canReroll(coins);
    if (!check.ok) return check;
    return this.rerollPaid({ luck, price: check.price });
  }

  /** Reroll after the caller has already charged the price. */
  rerollPaid({ luck = 0, price = null } = {}) {
    if (this.rerolls >= SHOP.maxRerolls) return { ok: false, reason: 'Limite de rerolls.' };
    const charged = price ?? this.rerollPrice();
    this.rerolls += 1;
    this.stock = this.generate(luck);
    return { ok: true, price: charged, stock: this.stock };
  }

  view(coins) {
    return {
      stock: this.stock.map((item) => ({
        ...item,
        affordable: coins >= item.price && !item.sold,
      })),
      rerollPrice: this.rerollPrice(),
      rerollAvailable: this.canReroll(coins).ok,
      discount: this.discount,
      sectorIndex: this.sectorIndex,
    };
  }
}
