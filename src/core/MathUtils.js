/** Small, allocation-free math helpers shared by every system. */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential smoothing. */
export function damp(current, target, smoothing, dt) {
  return lerp(current, target, 1 - Math.exp(-smoothing * dt));
}

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function pick(list) {
  return list[(Math.random() * list.length) | 0];
}

export function signOr(value, fallback) {
  return value < 0 ? -1 : value > 0 ? 1 : fallback;
}

export function formatScore(value) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  try {
    return safe.toLocaleString('pt-BR');
  } catch {
    return String(safe);
  }
}
