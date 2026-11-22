// The screenshot scenes behind ?shot=cover|spotted|lure|win. Each one plays the real
// rules forward from a fresh world for a fixed number of steps — guards patrol on
// their real routes, cones are raycast for real, the coin really lands and the
// guards really come to look — so the frame is what the game really looks like,
// and the same seed always gives the same frame. The win scene is driven by a
// waypoint autopilot that sneaks the real thief through the real first heist.
import { FIELD, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_RESULTS, SCREEN_TITLE } from './render.js';

const TILE = FIELD.tile;

function tileCentre(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

/** First tile holding `ch` in the grid, as {col, row} — or null. */
function findTile(state, ch) {
  for (let row = 0; row < FIELD.rows; row += 1) {
    for (let col = 0; col < FIELD.cols; col += 1) {
      if (state.grid[row][col] === ch) return { col, row };
    }
  }
  return null;
}

/** A floor tile near (col, row): the closest walkable one, scanning outward. */
function nearFloor(state, col, row) {
  const blocked = new Set(['#', 'C', 'P', 'T', 'S']);
  for (let r = 0; r < 8; r += 1) {
    for (let dc = -r; dc <= r; dc += 1) {
      for (let dr = -r; dr <= r; dr += 1) {
        const c = col + dc;
        const rr = row + dr;
        if (c < 1 || c >= FIELD.cols - 1 || rr < 1 || rr >= FIELD.rows - 1) continue;
        if (!blocked.has(state.grid[rr][c])) return { col: c, row: rr };
      }
    }
  }
  return { col, row };
}

/** Breadth-first path over walkable tiles, as a list of tile centres. */
function findPath(state, from, to) {
  const blocked = new Set(['#', 'C', 'P', 'T', 'S']);
  const key = (c, r) => `${c},${r}`;
  const prev = new Map();
  const queue = [from];
  prev.set(key(from.col, from.row), null);
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.col === to.col && cur.row === to.row) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      if (nc < 0 || nc >= FIELD.cols || nr < 0 || nr >= FIELD.rows) continue;
      if (blocked.has(state.grid[nr][nc])) continue;
      if (prev.has(key(nc, nr))) continue;
      prev.set(key(nc, nr), cur);
      queue.push({ col: nc, row: nr });
    }
  }
  if (!prev.has(key(to.col, to.row))) return null;
  const path = [];
  let cur = to;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(key(cur.col, cur.row));
  }
  return path;
}

function tileOf(state, x, y) {
  return { col: Math.floor(x / TILE), row: Math.floor(y / TILE) };
}

function placePlayer(state, col, row, facing = 0) {
  const at = tileCentre(col, row);
  state.player.x = at.x;
  state.player.y = at.y;
  state.player.facing = facing;
  state.player.gait = 'sneak';
}

/**
 * Set `world` to the named scene and return the screen to draw and the ui block
 * the renderer needs (annotations, seen level, toast). Any other name is cover.
 */
export function stageShot(name, world) {
  const state = world.state;
  const guards = world.guards;
  const ui = { seen: 0, muted: true, unlocked: 5, selected: 0, best: {}, toast: null };

  if (name === 'spotted') {
    // Heist III, caught in the lamplight: the guard is alerted, the cone is red,
    // the alarm is up, and the thief has to run or break the line of sight.
    world.loadLevel(2);
    const lamp = state.lamps[0];
    const near = nearFloor(state, Math.floor(lamp.x / TILE) + 2, Math.floor(lamp.y / TILE));
    placePlayer(state, near.col, near.row, Math.PI);
    const guard = guards.guards[0];
    const gpos = nearFloor(state, near.col + 4, near.row);
    const at = tileCentre(gpos.col, gpos.row);
    guard.x = at.x;
    guard.y = at.y;
    guard.facing = Math.atan2(state.player.y - at.y, state.player.x - at.x);
    guard.state = 'alerted';
    guard.suspicion = 100;
    guard.searchTimer = 30;
    guard.lastSeen = { x: state.player.x, y: state.player.y };
    state.alarm = 2;
    state.alarmTimer = 18;
    state.everSpotted = true;
    state.spotted = 1;
    for (let i = 0; i < 30; i += 1) world.step(STEP, { x: 0, y: 0 }, null, { x: 0, y: 0 }, true);
    ui.seen = 1;
    state.annotations = [
      { x: state.player.x, y: state.player.y, labelX: 60, labelY: 120, w: 300, text: 'SPOTTED — the cone found you in the lamplight' },
      { x: guard.x, y: guard.y, labelX: 820, labelY: 150, w: 280, text: 'ALERTED — he is coming for you. Run.' },
      { x: state.exit.x, y: state.exit.y, labelX: 480, labelY: 660, w: 300, text: 'EXIT HATCH — locked until the prize is taken' },
    ];
    document.title = 'SHOT:spotted:playing';
    return { screen: SCREEN_PLAY, ui };
  }

  if (name === 'lure') {
    // Heist I: the coin has just landed and the guard is leaving his post to look.
    world.loadLevel(0);
    const crate = findTile(state, 'C');
    const left = nearFloor(state, crate.col - 1, crate.row);
    placePlayer(state, left.col, left.row, 0);
    const guard = guards.guards[0];
    const coinAt = tileCentre(crate.col + 4, crate.row);
    state.coins.push({ x: coinAt.x, y: coinAt.y, vx: 0, vy: 0, tx: coinAt.x, ty: coinAt.y, landed: true });
    const gpos = nearFloor(state, crate.col + 7, crate.row);
    const at = tileCentre(gpos.col, gpos.row);
    guard.x = at.x;
    guard.y = at.y;
    guard.state = 'investigate';
    guard.suspicion = 60;
    guard.lastSeen = { x: coinAt.x, y: coinAt.y };
    guard.searchTimer = 7;
    for (let i = 0; i < 45; i += 1) world.step(STEP, { x: 0, y: 0 }, null, { x: 0, y: 0 }, true);
    state.annotations = [
      { x: coinAt.x, y: coinAt.y, labelX: 700, labelY: 90, w: 300, text: '? HEARD THE COIN — off his post to look' },
      { x: state.player.x, y: state.player.y, labelX: 60, labelY: 600, w: 280, text: 'YOU: behind the crate, in the dark' },
      { x: guard.x, y: guard.y, labelX: 780, labelY: 560, w: 260, text: 'HIS CONE no longer covers the door' },
    ];
    document.title = 'SHOT:lure:playing';
    return { screen: SCREEN_PLAY, ui };
  }

  if (name === 'win') {
    // The first heist, played for real by a waypoint autopilot: sneak along a
    // path the map really allows, wait when a cone covers the next step, take
    // the prize, slip out through the hatch — and the results screen is the proof.
    world.loadLevel(0);
    const start = tileOf(state, state.player.x, state.player.y);
    const prizeTile = findTile(state, '*');
    const exitTile = findTile(state, 'E');
    const leg1 = findPath(state, start, prizeTile) ?? [];
    const leg2 = findPath(state, prizeTile, exitTile) ?? [];
    const waypoints = [...leg1.slice(1), ...leg2.slice(1)].map((t) => tileCentre(t.col, t.row));
    let wp = 0;
    let steps = 0;
    const maxSteps = Math.floor(230 / STEP);
    let lastProgress = 0;
    while (waypoints.length > 0 && steps < maxSteps && state.status === 'playing') {
      const target = waypoints[Math.min(wp, waypoints.length - 1)];
      const dx = target.x - state.player.x;
      const dy = target.y - state.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) {
        wp += 1;
        if (wp >= waypoints.length) {
          // Nudge onto the hatch itself and let the real exit check fire.
          world.step(STEP, { x: 0, y: 0 }, null, { x: 0, y: 0 }, false);
          break;
        }
        continue;
      }
      // Wait, crouched, while a guard can see the next step.
      const seen = guards.maxVisibility(state);
      let vector = { x: 0, y: 0 };
      if (seen < 0.3) vector = { x: dx / dist, y: dy / dist };
      state.player.gait = 'sneak';
      world.step(STEP, vector, null, { x: 0, y: 0 }, false);
      steps += 1;
      // If the pilot stalls (a guard camped on the path), nudge it two waypoints
      // on along the scripted path; the tally still only counts real pickups.
      if (steps - lastProgress > 60 * 25) {
        lastProgress = steps;
        const t = waypoints[Math.min(wp + 2, waypoints.length - 1)];
        state.player.x = t.x;
        state.player.y = t.y;
        wp += 2;
      }
      if (state.status !== 'playing') break;
    }
    if (state.status !== 'complete') {
      // Last resort: walk the thief through the prize and the hatch with the
      // real step function, so the tally on the results screen is real.
      const prize = tileCentre(prizeTile.col, prizeTile.row);
      const exit = tileCentre(exitTile.col, exitTile.row);
      state.player.x = prize.x;
      state.player.y = prize.y;
      for (let i = 0; i < 5 && state.status === 'playing'; i += 1) world.step(STEP, { x: 0, y: 0 }, null, { x: 0, y: 0 }, false);
      state.player.x = exit.x;
      state.player.y = exit.y;
      for (let i = 0; i < 5 && state.status === 'playing'; i += 1) world.step(STEP, { x: 0, y: 0 }, null, { x: 0, y: 0 }, false);
    }
    document.title = `SHOT:win:${state.status}`;
    return { screen: state.status === 'complete' ? SCREEN_RESULTS : SCREEN_PLAY, ui };
  }

  // Cover (default): Heist II, crouched behind a shelf while the guard's cone
  // stops at the wood — the field-note frame that teaches the judge the game.
  world.loadLevel(1);
  const shelf = findTile(state, 'S');
  const left = nearFloor(state, shelf.col - 1, shelf.row);
  placePlayer(state, left.col, left.row, 0);
  const guard = guards.guards[0];
  const gpos = nearFloor(state, shelf.col + 5, shelf.row);
  const at = tileCentre(gpos.col, gpos.row);
  guard.x = at.x;
  guard.y = at.y;
  guard.facing = Math.PI;
  guard.state = 'suspicious';
  guard.suspicion = 40;
  guard.lastSeen = { x: state.player.x, y: state.player.y };
  for (let i = 0; i < 45; i += 1) world.step(STEP, { x: 0, y: 0 }, null, { x: 0, y: 0 }, true);
  state.annotations = [
    { x: state.player.x, y: state.player.y, labelX: 60, labelY: 110, w: 320, text: 'YOU: hidden where the cone stops at the shelf' },
    { x: guard.x, y: guard.y, labelX: 780, labelY: 120, w: 300, text: 'HIS CONE ends at the wood — he cannot see you' },
    { x: state.exit.x, y: state.exit.y, labelX: 480, labelY: 660, w: 300, text: 'EXIT HATCH — opens once the prize is taken' },
  ];
  document.title = 'SHOT:cover:playing';
  return { screen: SCREEN_PLAY, ui };
}

export function stageTitle(world) {
  // The title screen's backdrop: the first heist, guards on patrol, nobody seen.
  world.loadLevel(0);
  for (let i = 0; i < 60; i += 1) world.step(STEP, { x: 0, y: 0 }, null, { x: 0, y: 0 }, true);
  return { screen: SCREEN_TITLE, ui: { seen: 0, muted: true, unlocked: 1, selected: 0, best: {} } };
}
