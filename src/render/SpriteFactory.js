/** Offscreen sprite generation: all neon glow is baked once, then blitted. */

export function roundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

/**
 * Block sprite with baked outer glow, gradient body and bevel highlight.
 */
export function createBlockSprite({ color, width, height, ratio, damaged = 0, kind = 'normal' }) {
  const pad = Math.max(12, width * 0.26);
  const w = width + pad * 2;
  const h = height + pad * 2;
  const canvas = makeCanvas(w * ratio, h * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);

  const x = pad;
  const y = pad;
  const radius = Math.max(3, height * 0.3);
  const isSteel = kind === 'steel';
  const isPower = kind === 'power';
  const core = isSteel ? '#64748f' : color.core;
  const light = isSteel ? '#b3c3da' : color.light;
  const dark = isSteel ? '#101724' : color.dark;
  const alpha = 1 - damaged * 0.18;

  // ── glow pass
  ctx.save();
  ctx.globalAlpha = isSteel ? 0.16 : 0.85;
  ctx.shadowColor = isSteel ? 'rgba(150,180,220,0.7)' : core;
  ctx.shadowBlur = (isPower ? 22 : 15) * ratio * 0.5 + 9;
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = core;
  ctx.fill();
  ctx.restore();

  // ── body gradient
  const body = ctx.createLinearGradient(0, y, 0, y + height);
  body.addColorStop(0, light);
  body.addColorStop(0.28, core);
  body.addColorStop(0.62, core);
  body.addColorStop(1, dark);
  ctx.globalAlpha = alpha;
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = body;
  ctx.fill();

  // ── inner shade (depth)
  const shade = ctx.createLinearGradient(0, y + height * 0.45, 0, y + height);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = shade;
  ctx.fill();

  // ── top bevel highlight
  ctx.globalAlpha = 0.5 * alpha;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  roundRectPath(ctx, x + width * 0.06, y + height * 0.12, width * 0.88, Math.max(1.5, height * 0.11), height * 0.08);
  ctx.fill();

  // ── rim
  ctx.globalAlpha = 0.45 * alpha;
  ctx.lineWidth = Math.max(1, height * 0.045);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  roundRectPath(ctx, x + 0.75, y + 0.75, width - 1.5, height - 1.5, radius);
  ctx.stroke();

  // ── damage cracks
  if (damaged > 0) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(6,10,18,0.9)';
    ctx.lineWidth = Math.max(1, height * 0.05);
    ctx.beginPath();
    ctx.moveTo(x + width * 0.18, y + height * 0.85);
    ctx.lineTo(x + width * 0.36, y + height * 0.42);
    ctx.lineTo(x + width * 0.52, y + height * 0.6);
    ctx.lineTo(x + width * 0.72, y + height * 0.2);
    ctx.stroke();
    if (damaged > 0.5) {
      ctx.beginPath();
      ctx.moveTo(x + width * 0.62, y + height * 0.92);
      ctx.lineTo(x + width * 0.78, y + height * 0.55);
      ctx.stroke();
    }
  }

  // ── steel cross-hatch
  if (isSteel) {
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = 'rgba(210,228,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i += 1) {
      const px = x + (width / 4) * i;
      ctx.moveTo(px, y + height * 0.18);
      ctx.lineTo(px, y + height * 0.82);
    }
    ctx.stroke();
  }

  // ── reinforced corner brackets (hard blocks)
  if (kind === 'hard') {
    const inset = Math.max(3, height * 0.16);
    const len = Math.min(width, height) * 0.22;
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = Math.max(1.4, height * 0.07);
    ctx.beginPath();
    // top-left
    ctx.moveTo(x + inset, y + inset + len);
    ctx.lineTo(x + inset, y + inset);
    ctx.lineTo(x + inset + len, y + inset);
    // top-right
    ctx.moveTo(x + width - inset - len, y + inset);
    ctx.lineTo(x + width - inset, y + inset);
    ctx.lineTo(x + width - inset, y + inset + len);
    // bottom-right
    ctx.moveTo(x + width - inset, y + height - inset - len);
    ctx.lineTo(x + width - inset, y + height - inset);
    ctx.lineTo(x + width - inset - len, y + height - inset);
    // bottom-left
    ctx.moveTo(x + inset + len, y + height - inset);
    ctx.lineTo(x + inset, y + height - inset);
    ctx.lineTo(x + inset, y + height - inset - len);
    ctx.stroke();
  }

  // ── armour plating (3-hit blocks)
  if (kind === 'armored') {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(8,12,20,0.85)';
    ctx.lineWidth = Math.max(1, height * 0.06);
    ctx.beginPath();
    for (let i = 1; i <= 3; i += 1) {
      const px = x + (width / 4) * i;
      ctx.moveTo(px - height * 0.22, y + height * 0.24);
      ctx.lineTo(px + height * 0.22, y + height * 0.76);
    }
    ctx.stroke();

    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1, height * 0.05);
    roundRectPath(ctx, x + 2.5, y + 2.5, width - 5, height - 5, radius * 0.7);
    ctx.stroke();
  }

  // ── power marker (diamond)
  if (isPower) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffffff';
    const cx = x + width * 0.5;
    const cy = y + height * 0.5;
    const s = Math.min(width, height) * 0.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s, cy);
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  return { canvas, w, h, pad };
}

/** Radial glow ball sprite. */
export function createBallSprite(radius, ratio, color = '#eafcff', glow = '#8ff0ff') {
  const pad = radius * 2.6;
  const size = (radius + pad) * 2;
  const canvas = makeCanvas(size * ratio, size * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  const cx = size * 0.5;
  const cy = size * 0.5;

  const halo = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius + pad);
  halo.addColorStop(0, glow);
  halo.addColorStop(0.18, 'rgba(150,240,255,0.55)');
  halo.addColorStop(0.45, 'rgba(90,200,255,0.18)');
  halo.addColorStop(1, 'rgba(40,120,220,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + pad, 0, Math.PI * 2);
  ctx.fill();

  const core = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.55, color);
  core.addColorStop(1, glow);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  return { canvas, size, pad };
}

/** Power-up capsule sprite with glyph. */
export function createPowerUpSprite({ type, width, height, ratio }) {
  const pad = width * 0.42;
  const w = width + pad * 2;
  const h = height + pad * 2;
  const canvas = makeCanvas(w * ratio, h * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);

  const x = pad;
  const y = pad;
  const radius = height * 0.5;

  ctx.save();
  ctx.shadowColor = type.color;
  ctx.shadowBlur = 20;
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = type.color;
  ctx.fill();
  ctx.restore();

  const body = ctx.createLinearGradient(0, y, 0, y + height);
  body.addColorStop(0, type.light);
  body.addColorStop(0.42, type.color);
  body.addColorStop(1, 'rgba(0,0,0,0.55)');
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = body;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.2;
  roundRectPath(ctx, x + 0.7, y + 0.7, width - 1.4, height - 1.4, radius - 0.7);
  ctx.stroke();

  // inner slot
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000000';
  roundRectPath(ctx, x + 3, y + height * 0.62, width - 6, height * 0.26, height * 0.14);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(6,12,22,0.92)';
  ctx.font = `900 ${Math.round(height * 0.72)}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(type.glyph, x + width * 0.5, y + height * 0.52);

  return { canvas, w, h, pad };
}

/** Static background: deep navy gradient, faint grid, ambient blooms. */
export function createBackground({ width, height, ratio }) {
  const canvas = makeCanvas(width * ratio, height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);

  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#070d1b');
  base.addColorStop(0.45, '#050912');
  base.addColorStop(1, '#03060d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const bloomTop = ctx.createRadialGradient(width * 0.5, -height * 0.15, 0, width * 0.5, -height * 0.15, height * 0.95);
  bloomTop.addColorStop(0, 'rgba(42,120,220,0.3)');
  bloomTop.addColorStop(0.5, 'rgba(30,70,150,0.1)');
  bloomTop.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bloomTop;
  ctx.fillRect(0, 0, width, height);

  const bloomBottom = ctx.createRadialGradient(width * 0.5, height * 1.05, 0, width * 0.5, height * 1.05, height * 0.8);
  bloomBottom.addColorStop(0, 'rgba(120,50,190,0.22)');
  bloomBottom.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bloomBottom;
  ctx.fillRect(0, 0, width, height);

  // faint grid
  ctx.strokeStyle = 'rgba(96,170,255,0.055)';
  ctx.lineWidth = 1;
  const step = Math.max(26, width / 22);
  ctx.beginPath();
  for (let x = step; x < width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = step; y < height; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  // vignette
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.48,
    Math.min(width, height) * 0.28,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.78,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  return { canvas, width, height };
}

