/** Collision primitives shared by the physics step (no allocations in the hot path). */

export const WALL_HIT = { NONE: 0, LEFT: 1, RIGHT: 2, TOP: 3 };

/** Reusable scratch object for circle/rect tests. */
export const HIT = { nx: 0, ny: 0, penetration: 0, inside: false };

/** Reusable scratch object for paddle contacts. */
export const PADDLE_CONTACT = { rel: 0, contactX: 0, speed: 0 };

/**
 * Circle vs axis-aligned rect. Fills `out` with the contact normal pointing away
 * from the rect and the penetration depth. Returns true on overlap.
 */
export function testCircleRect(circle, x, y, w, h, out) {
  const r = circle.radius;
  const nearestX = circle.x < x ? x : circle.x > x + w ? x + w : circle.x;
  const nearestY = circle.y < y ? y : circle.y > y + h ? y + h : circle.y;
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  const distSq = dx * dx + dy * dy;

  if (distSq > r * r) return false;

  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq);
    out.nx = dx / dist;
    out.ny = dy / dist;
    out.penetration = r - dist;
    out.inside = false;
    return true;
  }

  // Circle centre is inside the rect — pick the shallowest axis.
  const left = circle.x - x;
  const right = x + w - circle.x;
  const top = circle.y - y;
  const bottom = y + h - circle.y;
  const min = Math.min(left, right, top, bottom);

  if (min === left) {
    out.nx = -1;
    out.ny = 0;
    out.penetration = r + left;
  } else if (min === right) {
    out.nx = 1;
    out.ny = 0;
    out.penetration = r + right;
  } else if (min === top) {
    out.nx = 0;
    out.ny = -1;
    out.penetration = r + top;
  } else {
    out.nx = 0;
    out.ny = 1;
    out.penetration = r + bottom;
  }
  out.inside = true;
  return true;
}

/** Bounce the ball off the side/top walls. Returns a WALL_HIT code. */
export function resolveWalls(ball, world) {
  const r = ball.radius;
  const top = world.playTop;
  let hit = WALL_HIT.NONE;

  if (ball.x - r < 0) {
    ball.x = r;
    if (ball.vx < 0) ball.vx = -ball.vx;
    hit = WALL_HIT.LEFT;
  } else if (ball.x + r > world.width) {
    ball.x = world.width - r;
    if (ball.vx > 0) ball.vx = -ball.vx;
    hit = WALL_HIT.RIGHT;
  }

  if (ball.y - r < top) {
    ball.y = top + r;
    if (ball.vy < 0) ball.vy = -ball.vy;
    hit = WALL_HIT.TOP;
  }

  return hit;
}

/**
 * Paddle contact test. Only registers when the ball is falling, so a ball that
 * clipped the paddle side while moving up is not re-launched.
 */
export function testPaddleContact(ball, paddle, out) {
  const r = ball.radius;
  if (ball.vy <= 0) return false;
  if (ball.y + r < paddle.y) return false;
  if (ball.y - r > paddle.y + paddle.height) return false;
  if (ball.x + r < paddle.x || ball.x - r > paddle.x + paddle.width) return false;

  const half = paddle.width * 0.5;
  out.rel = Math.max(-1, Math.min(1, (ball.x - (paddle.x + half)) / half));
  out.contactX = ball.x;
  return true;
}
