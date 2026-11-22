// Sight and light: the two senses every stealth decision hangs on. No drawing
// here, only geometry over the tile grid — a ray that stops at the first blocker,
// a cone test, and how much lamp light falls on a point.
import { FIELD } from './config.js';

/** Tiles that block both movement and sight. */
export function isBlocker(tile) {
  return tile === '#' || tile === 'C' || tile === 'P' || tile === 'T' || tile === 'S';
}

/** Tile character at a pixel position (out of bounds counts as wall). */
export function tileAt(grid, x, y) {
  const col = Math.floor(x / FIELD.tile);
  const row = Math.floor(y / FIELD.tile);
  if (col < 0 || col >= FIELD.cols || row < 0 || row >= FIELD.rows) return '#';
  return grid[row][col];
}

/** True when the straight segment between two points crosses no blocker tile. */
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (isBlocker(tileAt(grid, x0 + dx * t, y0 + dy * t))) return false;
  }
  return true;
}

/** Distance from (x, y) along `angle` to the first blocker, capped at `maxDist`. */
export function castRay(grid, x, y, angle, maxDist) {
  const step = 6;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let d = step; d <= maxDist; d += step) {
    if (isBlocker(tileAt(grid, x + cos * d, y + sin * d))) return d;
  }
  return maxDist;
}

/** Polygon points of a vision cone (origin + raycast fan), for drawing and tests. */
export function conePoints(grid, x, y, angle, halfAngle, range, rays = 26) {
  const points = [{ x, y }];
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const d = castRay(grid, x, y, a, range);
    points.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
  }
  return points;
}

/** Is `target` inside a cone from (x, y) facing `angle` (range, half-angle, LOS)? */
export function inCone(grid, x, y, angle, halfAngle, range, tx, ty) {
  const dx = tx - x;
  const dy = ty - y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 1) return true;
  let diff = Math.atan2(dy, dx) - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > halfAngle) return false;
  return hasLineOfSight(grid, x, y, tx, ty);
}

/**
 * Lamp light at a point, 0..1. Each lit lamp contributes by distance (a soft falloff)
 * and only when nothing blocks the way. Douse a lamp and its pool of safety dies.
 */
export function lightAt(grid, lamps, x, y) {
  let light = 0;
  for (const lamp of lamps) {
    if (!lamp.on) continue;
    const dx = x - lamp.x;
    const dy = y - lamp.y;
    const dist = Math.hypot(dx, dy);
    if (dist > lamp.radius) continue;
    if (!hasLineOfSight(grid, lamp.x, lamp.y, x, y)) continue;
    const falloff = 1 - (dist / lamp.radius) * (dist / lamp.radius);
    light = Math.max(light, falloff);
  }
  return Math.min(1, light);
}

/** True when a circle of `radius` at (x, y) overlaps any blocker tile. */
export function circleHitsBlocker(grid, x, y, radius) {
  const minCol = Math.floor((x - radius) / FIELD.tile);
  const maxCol = Math.floor((x + radius) / FIELD.tile);
  const minRow = Math.floor((y - radius) / FIELD.tile);
  const maxRow = Math.floor((y + radius) / FIELD.tile);
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (col < 0 || col >= FIELD.cols || row < 0 || row >= FIELD.rows) return true;
      if (!isBlocker(grid[row][col])) continue;
      const nearestX = Math.max(col * FIELD.tile, Math.min(x, (col + 1) * FIELD.tile));
      const nearestY = Math.max(row * FIELD.tile, Math.min(y, (row + 1) * FIELD.tile));
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < radius * radius) return true;
    }
  }
  return false;
}
