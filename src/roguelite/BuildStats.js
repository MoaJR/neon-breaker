/**
 * Aggregated runtime stats for a run build.
 * Upgrades, relics, synergies and the platform all contribute numeric bonuses;
 * gameplay reads this object instead of knowing individual upgrade ids.
 */

export function createBuild() {
  return {
    // ── damage / hit effects
    damageBonus: 0,
    critChance: 0,
    critMult: 2,
    pierceChance: 0,
    explosionLevel: 0,
    explosionRadius: 0,
    explosionDamage: 1,
    chainLevel: 0,
    chainChance: 0,
    chainRadius: 70,
    electricLevel: 0,
    electricTargets: 0,
    electricDamage: 1,
    electricRange: 180,
    electricCrit: 0,
    fireLevel: 0,
    burnDps: 0.8,
    fireSpread: 0,
    fireNova: 0,
    // ── balls / paddle
    extraBalls: 0,
    ballSpeedBonus: 0,
    paddleWidthBonus: 0,
    paddleHeightBonus: 0,
    englishBonus: 0,
    stunResist: 0,
    magneticChance: 0,
    shieldCharges: 0,
    startShields: 0,
    secondChance: 0,
    slowInterval: 0,
    slowDuration: 1.6,
    // ── support / economy
    coinBonus: 0,
    luck: 0,
    relicBonus: 0,
    dataBonus: 0,
    comboWindowBonus: 0,
    comboBonus: 0,
    scoreBonus: 0,
    salvageLevel: 0,
    rerolls: 0,
    shopDiscount: 0,
    dropChanceBonus: 0,
    // ── tech modules
    laserLevel: 0,
    laserInterval: 0,
    laserDamage: 1,
    laserBarrage: 0,
    orbitalLevel: 0,
    orbitalCount: 0,
    orbitalDamage: 1,
    orbitalFire: 0,
    // ── special modules
    voidLevel: 0,
    voidInterval: 12,
    gravityLevel: 0,
    gravityInterval: 10,
    gravityDuration: 1.2,
    cloneLevel: 0,
    cloneDuration: 6,
    cloneCooldown: 18,
    blackHoleLevel: 0,
    blackHoleInterval: 16,
    blackHoleRadius: 100,
    blackHoleDamage: 1,
    voidPull: 0,
    frostLevel: 0,
    vampireLevel: 0,
    quantumLevel: 0,
    quantumChance: 0,
    // ── relic rule changes
    maxLivesBonus: 0,
    revive: 0,
    coinMagnet: 0,
    extraModifiers: 0,
    // ── derived multipliers (computed in finalizeBuild)
    damageMult: 1,
    coinMult: 1,
    scoreMult: 1,
    paddleWidthMult: 1,
    ballSpeedMult: 1,
  };
}

export function applyBonus(build, bonus) {
  if (!bonus || typeof bonus !== 'object') return build;
  for (const [key, value] of Object.entries(bonus)) {
    if (!(key in build)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) {
      build[key] += value;
    } else if (typeof value === 'boolean') {
      build[key] = build[key] || value;
    }
  }
  return build;
}

export function finalizeBuild(build, platform = null) {
  build.damageMult = Math.max(0.2, 1 + build.damageBonus);
  build.coinMult = Math.max(0.2, 1 + build.coinBonus);
  build.scoreMult = Math.max(0.2, 1 + build.scoreBonus);
  build.paddleWidthMult = Math.max(0.5, 1 + build.paddleWidthBonus);
  build.ballSpeedMult = Math.max(0.6, 1 + build.ballSpeedBonus);

  if (platform) {
    build.paddleWidthMult *= platform.widthMult ?? 1;
    build.ballSpeedMult *= platform.ballSpeedMult ?? 1;
    build.scoreMult *= platform.scoreMult ?? 1;
    build.coinMult *= platform.coinMult ?? 1;
    build.luck += platform.luck ?? 0;
    build.shopDiscount += platform.shopDiscount ?? 0;
    build.dropChanceBonus += platform.dropBonus ?? 0;
  }

  // Defensive caps: no build is allowed to become permanently invulnerable.
  build.shieldCharges = Math.min(4, Math.max(0, Math.floor(build.shieldCharges)));
  build.secondChance = Math.min(0.85, Math.max(0, build.secondChance));
  build.pierceChance = Math.min(0.9, Math.max(0, build.pierceChance));
  build.critChance = Math.min(0.75, Math.max(0, build.critChance));
  build.magneticChance = Math.min(0.85, Math.max(0, build.magneticChance));
  build.extraBalls = Math.min(6, Math.max(0, Math.floor(build.extraBalls)));
  build.orbitalCount = Math.min(6, Math.max(0, Math.floor(build.orbitalCount)));
  build.luck = Math.min(8, Math.max(0, build.luck));
  build.maxLivesBonus = Math.max(-3, Math.min(3, build.maxLivesBonus));
  build.revive = Math.min(1, Math.max(0, Math.floor(build.revive)));
  build.extraModifiers = Math.max(0, Math.min(3, Math.floor(build.extraModifiers)));
  build.chainChance = Math.min(0.9, Math.max(0, build.chainChance));
  build.fireSpread = Math.min(1, Math.max(0, build.fireSpread));
  build.shopDiscount = Math.min(0.5, Math.max(0, build.shopDiscount));
  return build;
}

/**
 * Compile every source into one build object.
 * sources: { upgrades: [{def, level}], relics: [def], synergies: [def], platform }
 */
export function compileBuild(sources = {}) {
  const build = createBuild();
  for (const entry of sources.upgrades ?? []) {
    const level = Math.max(1, Math.min(entry.def.maxLevel ?? 5, entry.level ?? 1));
    applyBonus(build, entry.def.levels?.[level - 1]?.bonus);
  }
  for (const relic of sources.relics ?? []) {
    applyBonus(build, relic.bonus);
  }
  for (const synergy of sources.synergies ?? []) {
    applyBonus(build, synergy.bonus);
  }
  applyBonus(build, sources.extraBonus);
  return finalizeBuild(build, sources.platform ?? null);
}

export function buildHas(build, key) {
  const value = build?.[key];
  return typeof value === 'number' ? value > 0 : Boolean(value);
}
