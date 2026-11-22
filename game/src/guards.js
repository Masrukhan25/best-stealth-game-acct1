// The house's eyes: guard patrols with raycast vision cones, suspicion that builds
// while you are seen and drains while you are not, cameras that sweep, lasers that
// trip the alarm, and the alarm itself, which calls every guard to the trouble.
// A guard's state is one of: patrol, suspicious, investigate, search, alerted, return.
import { CAMERA, FIELD, GADGETS, GUARD, LASER } from './config.js';
import { circleHitsBlocker, conePoints, hasLineOfSight, inCone, lightAt } from './vision.js';

export const EVENT_SPOTTED = 32;
export const EVENT_CAUGHT = 4;

const STATE = {
  PATROL: 'patrol',
  SUSPICIOUS: 'suspicious',
  INVESTIGATE: 'investigate',
  SEARCH: 'search',
  ALERTED: 'alerted',
  RETURN: 'return',
};

function tileCentre(col, row) {
  return { x: col * FIELD.tile + FIELD.tile / 2, y: row * FIELD.tile + FIELD.tile / 2 };
}

export function createGuards() {
  const inventory = { coin: 0, smoke: 0, douse: 0, cricket: 0 };
  let guards = [];
  let cameras = [];
  let lasers = [];

  function loadLevel(level, grid) {
    inventory.coin = GADGETS.coin.start;
    inventory.smoke = GADGETS.smoke.start;
    inventory.douse = GADGETS.douse.start;
    inventory.cricket = GADGETS.cricket.start;
    guards = level.guards.map((def) => {
      const start = tileCentre(def.route[0][0], def.route[0][1]);
      const second = tileCentre(def.route[1][0], def.route[1][1]);
      return {
        name: def.name,
        route: def.route.map(([c, r]) => tileCentre(c, r)),
        pause: def.pause,
        x: start.x,
        y: start.y,
        facing: Math.atan2(second.y - start.y, second.x - start.x),
        waypoint: 1,
        pauseTimer: 0,
        lookTimer: 0,
        state: STATE.PATROL,
        suspicion: 0,
        lastSeen: null,
        searchTimer: 0,
        speed: GUARD.patrolSpeed,
        lantern: true,
      };
    });
    cameras = level.cameras.map((def) => {
      const at = tileCentre(def.x, def.y);
      return { x: at.x, y: at.y, base: def.base, arc: def.arc, angle: def.base, sweep: 0, seen: false };
    });
    lasers = level.lasers.map((def) => {
      const a = tileCentre(def.x1, def.y1);
      const b = tileCentre(def.x2, def.y2);
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, tripped: false, tripTimer: 0 };
    });
  }

  function reset(grid) {
    for (const guard of guards) {
      const start = guard.route[0];
      guard.x = start.x;
      guard.y = start.y;
      guard.waypoint = 1;
      const next = guard.route[1];
      guard.facing = Math.atan2(next.y - start.y, next.x - start.x);
      guard.state = STATE.PATROL;
      guard.suspicion = 0;
      guard.lastSeen = null;
      guard.searchTimer = 0;
      guard.pauseTimer = 0;
    }
    for (const camera of cameras) camera.seen = false;
    for (const laser of lasers) {
      laser.tripped = false;
      laser.tripTimer = 0;
    }
  }

  /** How visible the player is to a watcher at (x, y): 0 = unseen, 1 = in full view. */
  function visibility(state, x, y) {
    const player = state.player;
    const dist = Math.hypot(player.x - x, player.y - y);
    if (dist < GUARD.viewNear) return 1;
    if (dist > GUARD.viewRange) return 0;
    if (!hasLineOfSight(state.grid, x, y, player.x, player.y)) return 0;
    // Smoke swallows sight.
    for (const smoke of state.smokes) {
      if (segmentHitsCircle(x, y, player.x, player.y, smoke.x, smoke.y, smoke.radius)) return 0;
    }
    // Tall grass hides you unless the watcher is almost on top of you.
    if (player.inGrass && dist > GUARD.grassReveal) return 0;
    // Light is the whole game: lit and close is a shout, dark and far is a whisper.
    const lit = player.lit;
    const closeness = 1 - dist / GUARD.viewRange;
    let seen = 0.25 + 0.75 * lit;
    seen *= 0.4 + 0.6 * closeness;
    if (player.gait === 'sneak') seen *= 0.55;
    if (player.gait === 'sprint') seen *= 1.25;
    return Math.min(1, seen);
  }

  function segmentHitsCircle(x0, y0, x1, y1, cx, cy, r) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((cx - x0) * dx + (cy - y0) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    return (px - cx) ** 2 + (py - cy) ** 2 < r * r;
  }

  function moveToward(guard, tx, ty, speed, dt, grid) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return true;
    const step = Math.min(dist, speed * dt);
    const nx = guard.x + (dx / dist) * step;
    const ny = guard.y + (dy / dist) * step;
    if (!circleHitsBlocker(grid, nx, guard.y, GUARD.radius)) guard.x = nx;
    if (!circleHitsBlocker(grid, guard.x, ny, GUARD.radius)) guard.y = ny;
    guard.facing = Math.atan2(dy, dx);
    return Math.hypot(tx - guard.x, ty - guard.y) < 6;
  }

  function investigatePoint(guard, x, y) {
    guard.state = STATE.INVESTIGATE;
    guard.lastSeen = { x, y };
    guard.suspicion = Math.max(guard.suspicion, GUARD.investigateAt);
  }

  /**
   * One fixed step for every guard, camera and laser. Returns EVENT_SPOTTED when
   * a guard first goes alert, EVENT_CAUGHT when one lays hands on the player.
   */
  function update(dt, state, harmless) {
    let events = 0;
    const player = state.player;
    const grid = state.grid;

    // --- Cameras sweep; a camera that sees you calls the guards. ---
    for (const camera of cameras) {
      camera.sweep += dt * CAMERA.sweep;
      camera.angle = camera.base + Math.sin(camera.sweep) * camera.arc;
      if (harmless) continue;
      const seen = inCone(grid, camera.x, camera.y, camera.angle, CAMERA.halfAngle, CAMERA.range, player.x, player.y)
        && player.lit > 0.15
        && !player.inGrass;
      if (seen && !camera.seen) {
        camera.seen = true;
        state.alarm = Math.min(3, state.alarm + 1);
        state.alarmTimer = 18;
        for (const guard of guards) investigatePoint(guard, player.x, player.y);
        events |= EVENT_SPOTTED;
      } else if (!seen) {
        camera.seen = false;
      }
    }

    // --- Lasers: cross the beam and the whole house knows. ---
    for (const laser of lasers) {
      const crossed = segmentHitsCircle(laser.x1, laser.y1, laser.x2, laser.y2, player.x, player.y, 14)
        && pointOnSegment(player.x, player.y, laser, 16);
      if (crossed && laser.tripTimer <= 0 && !harmless) {
        laser.tripped = true;
        laser.tripTimer = 3;
        state.alarm = Math.min(3, state.alarm + 1);
        state.alarmTimer = 18;
        for (const guard of guards) investigatePoint(guard, player.x, player.y);
        events |= EVENT_SPOTTED;
      }
      if (laser.tripTimer > 0) laser.tripTimer -= dt;
    }

    // --- Guards. ---
    for (const guard of guards) {
      const seen = harmless ? 0 : visibility(state, guard.x, guard.y) *
        (inCone(grid, guard.x, guard.y, guard.facing, GUARD.fov / 2, GUARD.viewRange, player.x, player.y) ? 1 : 0);

      if (!harmless && seen > 0) {
        guard.suspicion = Math.min(100, guard.suspicion + GUARD.stareRate * seen * dt);
        guard.lastSeen = { x: player.x, y: player.y };
        if (guard.suspicion >= GUARD.alertAt && guard.state !== STATE.ALERTED) {
          guard.state = STATE.ALERTED;
          state.alarm = Math.min(3, state.alarm + 1);
          state.alarmTimer = 18;
          events |= EVENT_SPOTTED;
        } else if (guard.suspicion >= GUARD.investigateAt && guard.state === STATE.PATROL) {
          guard.state = STATE.SUSPICIOUS;
        }
      } else if (!harmless) {
        guard.suspicion = Math.max(0, guard.suspicion - GUARD.decayRate * dt);
        if (guard.state === STATE.SUSPICIOUS && guard.suspicion < GUARD.investigateAt * 0.5) {
          guard.state = STATE.PATROL;
        }
      }

      // A noise nearby pulls a patrolling guard off their route to look.
      if (!harmless && guard.state === STATE.PATROL) {
        for (const noise of state.noise) {
          if (Math.hypot(noise.x - guard.x, noise.y - guard.y) < noise.radius) {
            investigatePoint(guard, noise.x, noise.y);
            break;
          }
        }
      }

      // --- Movement by state. ---
      if (guard.state === STATE.PATROL) {
        if (guard.pauseTimer > 0) {
          guard.pauseTimer -= dt;
          // Stop and look around at the end of a leg: a slow, suspicious turn.
          guard.lookTimer += dt;
          guard.facing += Math.sin(guard.lookTimer * 1.4) * dt * 0.9;
        } else {
          const target = guard.route[guard.waypoint];
          if (moveToward(guard, target.x, target.y, GUARD.patrolSpeed, dt, grid)) {
            guard.waypoint = (guard.waypoint + 1) % guard.route.length;
            guard.pauseTimer = guard.pause;
            guard.lookTimer = 0;
          }
        }
      } else if (guard.state === STATE.SUSPICIOUS) {
        // Stare at where you thought you saw something, then go and look.
        if (guard.lastSeen && moveToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.searchSpeed, dt, grid)) {
          guard.state = STATE.INVESTIGATE;
          guard.searchTimer = GUARD.searchSeconds;
        }
      } else if (guard.state === STATE.INVESTIGATE || guard.state === STATE.SEARCH) {
        if (guard.lastSeen) moveToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.searchSpeed, dt, grid);
        guard.searchTimer -= dt;
        // Look around while searching: sweep the facing back and forth.
        guard.facing += Math.sin(state.elapsed * 2.2 + guard.x) * dt * 1.6;
        if (guard.searchTimer <= 0) {
          guard.state = STATE.RETURN;
          guard.suspicion = Math.max(0, guard.suspicion - 40);
        }
      } else if (guard.state === STATE.ALERTED) {
        // Chase the player while they are seen; lose them and search the last spot.
        const chasing = seen > 0;
        const target = chasing ? { x: player.x, y: player.y } : guard.lastSeen;
        if (target) moveToward(guard, target.x, target.y, GUARD.chaseSpeed, dt, grid);
        if (!chasing) {
          guard.searchTimer -= dt;
          if (guard.searchTimer <= 0) {
            guard.state = STATE.SEARCH;
            guard.searchTimer = GUARD.searchSeconds;
          }
        } else {
          guard.searchTimer = 2;
        }
        // Caught: an alerted guard close enough lays hands on the thief.
        if (!harmless && Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.radius + 14) {
          events |= EVENT_CAUGHT;
        }
      } else if (guard.state === STATE.RETURN) {
        // Walk back to the nearest waypoint, then resume the patrol.
        let best = guard.route[0];
        let bestDist = Infinity;
        for (const point of guard.route) {
          const d = Math.hypot(point.x - guard.x, point.y - guard.y);
          if (d < bestDist) {
            bestDist = d;
            best = point;
          }
        }
        if (moveToward(guard, best.x, best.y, GUARD.patrolSpeed, dt, grid)) {
          guard.waypoint = guard.route.indexOf(best);
          guard.state = STATE.PATROL;
          guard.suspicion = 0;
        }
      }
    }

    return events;
  }

  /** The most any guard or camera can see the player right now, 0..1 (the HUD eye). */
  function maxVisibility(state) {
    let best = 0;
    for (const guard of guards) {
      const inView = inCone(state.grid, guard.x, guard.y, guard.facing, GUARD.fov / 2, GUARD.viewRange, state.player.x, state.player.y);
      if (inView) best = Math.max(best, visibility(state, guard.x, guard.y));
    }
    for (const camera of cameras) {
      const inView = inCone(state.grid, camera.x, camera.y, camera.angle, CAMERA.halfAngle, CAMERA.range, state.player.x, state.player.y);
      if (inView && state.player.lit > 0.15 && !state.player.inGrass) best = Math.max(best, 0.8);
    }
    return best;
  }

  /** Cone polygons for the renderer, coloured by state. */
  function conePolygons(state) {
    const out = [];
    for (const guard of guards) {
      out.push({
        points: conePoints(state.grid, guard.x, guard.y, guard.facing, GUARD.fov / 2, GUARD.viewRange),
        state: guard.state,
      });
    }
    for (const camera of cameras) {
      out.push({
        points: conePoints(state.grid, camera.x, camera.y, camera.angle, CAMERA.halfAngle, CAMERA.range),
        state: 'camera',
      });
    }
    return out;
  }

  return { inventory, loadLevel, reset, update, conePolygons, maxVisibility, get guards() { return guards; }, get cameras() { return cameras; }, get lasers() { return lasers; } };
}

function pointOnSegment(px, py, laser, tolerance) {
  const dx = laser.x2 - laser.x1;
  const dy = laser.y2 - laser.y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - laser.x1) * dx + (py - laser.y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = laser.x1 + dx * t;
  const cy = laser.y1 + dy * t;
  return Math.hypot(px - cx, py - cy) < tolerance;
}
