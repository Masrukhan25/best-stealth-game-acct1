// The game's rules and state, with no drawing and no browser in it: the tile map,
// the player and their gaits, loot and the named prize, the green exit, the four
// gadgets, strikes and the clock. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react without the world knowing about
// screens or sound. The guards live in guards.js and read this same state.
import { FIELD, GADGETS, GUARD, LEVEL_TIME, LEVELS, PLAYER, RANKS, STEP, STRIKES } from './config.js';
import { circleHitsBlocker, lightAt, tileAt } from './vision.js';
import { createGuards } from './guards.js';

export const EVENT_PICKUP = 1;
export const EVENT_PRIZE = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_COMPLETE = 8;
export const EVENT_FAILED = 16;
export const EVENT_SPOTTED = 32;
export const EVENT_GADGET = 64;
export const EVENT_NOISE = 128;

const LOOT_VALUE = 50;
const GHOST_BONUS = 500;
const TIME_BONUS_PER_SECOND = 10;
const LAMP_RADIUS = 150;
const COIN_SPEED = 520;
const CRICKET_SPEED = 42;
const CRICKET_LIFE = 9;

function tileCentre(col, row) {
  return { x: col * FIELD.tile + FIELD.tile / 2, y: row * FIELD.tile + FIELD.tile / 2 };
}

export function createWorld(random) {
  const guards = createGuards();
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    grid: [],
    player: { x: 0, y: 0, facing: 0, gait: 'walk', moving: false, lit: 0, inGrass: false, hidden: false },
    loot: [],
    prize: { x: 0, y: 0, taken: false },
    exit: { x: 0, y: 0, open: false },
    lamps: [],
    coins: [],
    smokes: [],
    crickets: [],
    noise: [],
    alarm: 0,
    alarmTimer: 0,
    spotted: 0,
    everSpotted: false,
    strikes: 0,
    score: 0,
    lootValue: 0,
    lootTaken: 0,
    timeLeft: LEVEL_TIME,
    elapsed: 0,
    status: 'playing',
    result: null,
    hint: '',
    annotations: null,
    seed: 1,
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.grid = level.map.map((row) => row.split(''));
    state.loot = [];
    state.lamps = [];
    state.coins = [];
    state.smokes = [];
    state.crickets = [];
    state.noise = [];
    state.alarm = 0;
    state.alarmTimer = 0;
    state.spotted = 0;
    state.everSpotted = false;
    state.strikes = 0;
    state.lootValue = 0;
    state.lootTaken = 0;
    state.timeLeft = LEVEL_TIME;
    state.elapsed = 0;
    state.status = 'playing';
    state.result = null;
    state.annotations = null;
    for (let row = 0; row < FIELD.rows; row += 1) {
      for (let col = 0; col < FIELD.cols; col += 1) {
        const ch = state.grid[row][col];
        const at = tileCentre(col, row);
        if (ch === 'X') state.player = { x: at.x, y: at.y, facing: 0, gait: 'walk', moving: false, lit: 0, inGrass: false, hidden: false };
        else if (ch === 'o') state.loot.push({ x: at.x, y: at.y, taken: false, value: LOOT_VALUE });
        else if (ch === '*') state.prize = { x: at.x, y: at.y, taken: false };
        else if (ch === 'E') state.exit = { x: at.x, y: at.y, open: false };
        else if (ch === 'L') state.lamps.push({ x: at.x, y: at.y, radius: LAMP_RADIUS, on: true });
      }
    }
    guards.loadLevel(level, state.grid);
  }

  function gaitSpeed() {
    if (state.player.gait === 'sneak') return PLAYER.sneakSpeed;
    if (state.player.gait === 'sprint') return PLAYER.sprintSpeed;
    return PLAYER.walkSpeed;
  }

  function gaitNoise() {
    if (state.player.gait === 'sneak') return PLAYER.sneakNoise;
    if (state.player.gait === 'sprint') return PLAYER.sprintNoise;
    return PLAYER.walkNoise;
  }

  function movePlayer(dt, vector) {
    const player = state.player;
    const speed = gaitSpeed();
    const tile = tileAt(state.grid, player.x, player.y);
    const slowed = tile === '~' ? 0.55 : 1;
    const nx = player.x + vector.x * speed * slowed * dt;
    const ny = player.y + vector.y * speed * slowed * dt;
    // Axis-separated so the player slides along walls instead of sticking.
    if (!circleHitsBlocker(state.grid, nx, player.y, PLAYER.radius)) player.x = nx;
    if (!circleHitsBlocker(state.grid, player.x, ny, PLAYER.radius)) player.y = ny;
    player.moving = vector.x !== 0 || vector.y !== 0;
    if (player.moving) player.facing = Math.atan2(vector.y, vector.x);
  }

  function throwCoin(targetX, targetY) {
    const player = state.player;
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    const range = Math.min(dist, GADGETS.coin.range);
    state.coins.push({
      x: player.x,
      y: player.y,
      vx: (dx / dist) * COIN_SPEED,
      vy: (dy / dist) * COIN_SPEED,
      tx: player.x + (dx / dist) * range,
      ty: player.y + (dy / dist) * range,
      landed: false,
    });
  }

  function dropSmoke() {
    state.smokes.push({ x: state.player.x, y: state.player.y, radius: GADGETS.smoke.radius, ttl: GADGETS.smoke.seconds });
  }

  function douseLamp() {
    let best = null;
    let bestDist = GADGETS.douse.range;
    for (const lamp of state.lamps) {
      if (!lamp.on) continue;
      const dist = Math.hypot(lamp.x - state.player.x, lamp.y - state.player.y);
      if (dist < bestDist) {
        best = lamp;
        bestDist = dist;
      }
    }
    if (best) best.on = false;
    return best !== null;
  }

  function deployCricket() {
    state.crickets.push({
      x: state.player.x,
      y: state.player.y,
      dir: state.player.facing,
      chirpTimer: 0.6,
      ttl: CRICKET_LIFE,
    });
  }

  /** Rank for a finished heist: ghost first, then by how often the alarm went up. */
  function rankFor(spotted, elapsed, par) {
    if (spotted === 0 && elapsed <= par) return RANKS[0].name;
    if (spotted === 0) return RANKS[1].name;
    if (spotted <= 2) return RANKS[2].name;
    return RANKS[3].name;
  }

  function finishLevel() {
    const level = state.level;
    const ghost = !state.everSpotted;
    const timeBonus = Math.max(0, Math.round((level.par - state.elapsed) * TIME_BONUS_PER_SECOND));
    const ghostBonus = ghost ? GHOST_BONUS : 0;
    const total = state.lootValue + level.prizeValue + timeBonus + ghostBonus;
    state.score += total;
    state.status = 'complete';
    state.result = {
      levelName: level.name,
      prize: level.prize,
      lootValue: state.lootValue,
      lootTaken: state.lootTaken,
      lootTotal: state.loot.length,
      prizeValue: level.prizeValue,
      timeBonus,
      ghostBonus,
      total,
      rank: rankFor(state.spotted, state.elapsed, level.par),
      elapsed: state.elapsed,
      par: level.par,
      spotted: state.spotted,
      ghost,
      campaignScore: state.score,
    };
  }

  function failLevel(reason) {
    state.status = 'failed';
    state.result = { reason, levelName: state.level.name, campaignScore: state.score };
  }

  function caughtByGuard() {
    state.strikes += 1;
    state.spotted += 1;
    state.everSpotted = true;
    if (state.strikes >= STRIKES) {
      failLevel('Dragged out a third time — the house keeps its ledger.');
      return EVENT_CAUGHT | EVENT_FAILED;
    }
    // Dragged back to the door: the guards reset, the loot stays where it was.
    const start = tileCentre(1, 1);
    state.player.x = start.x;
    state.player.y = start.y;
    state.player.facing = 0;
    state.alarm = 0;
    state.alarmTimer = 0;
    guards.reset(state.grid);
    return EVENT_CAUGHT;
  }

  /**
   * One fixed step. `vector` is the normalised steering input, `gadget` is one of
   * 'coin' | 'smoke' | 'douse' | 'cricket' | null, `mouse` is the coin's target.
   * With `harmless` set (the title screen's backdrop) guards patrol but nobody
   * is ever spotted and nothing scores.
   */
  function step(dt, vector, gadget, mouse, harmless) {
    let events = 0;
    if (state.status !== 'playing') return events;
    state.elapsed += dt;
    state.timeLeft = Math.max(0, LEVEL_TIME - state.elapsed);
    if (state.timeLeft <= 0) {
      failLevel('Dawn broke over Emberwick — out of time.');
      return EVENT_FAILED;
    }

    const player = state.player;
    movePlayer(dt, vector);

    // Footstep noise: sprinting is loud, walking is a whisper, sneaking is silent.
    const noiseRadius = gaitNoise();
    if (player.moving && noiseRadius > 0) {
      state.noise.push({ x: player.x, y: player.y, radius: noiseRadius, ttl: 0.25 });
    }

    if (gadget === 'coin' && guards.inventory.coin > 0) {
      guards.inventory.coin -= 1;
      throwCoin(mouse.x, mouse.y);
      events |= EVENT_GADGET;
    } else if (gadget === 'smoke' && guards.inventory.smoke > 0) {
      guards.inventory.smoke -= 1;
      dropSmoke();
      events |= EVENT_GADGET;
    } else if (gadget === 'douse' && guards.inventory.douse > 0) {
      guards.inventory.douse -= 1;
      if (douseLamp()) events |= EVENT_GADGET;
      else guards.inventory.douse += 1;
    } else if (gadget === 'cricket' && guards.inventory.cricket > 0) {
      guards.inventory.cricket -= 1;
      deployCricket();
      events |= EVENT_GADGET;
    }

    // Coins fly, land with a clink, and keep lying there as a lure.
    for (const coin of state.coins) {
      if (coin.landed) continue;
      coin.x += coin.vx * dt;
      coin.y += coin.vy * dt;
      const left = Math.hypot(coin.tx - coin.x, coin.ty - coin.y);
      if (left < 10 || circleHitsBlocker(state.grid, coin.x, coin.y, 4)) {
        coin.landed = true;
        state.noise.push({ x: coin.x, y: coin.y, radius: GADGETS.coin.noise, ttl: 0.4 });
        events |= EVENT_NOISE;
      }
    }
    // Smoke thins out; crickets walk and chirp; old noise fades.
    for (const smoke of state.smokes) smoke.ttl -= dt;
    state.smokes = state.smokes.filter((s) => s.ttl > 0);
    for (const cricket of state.crickets) {
      cricket.ttl -= dt;
      cricket.chirpTimer -= dt;
      const nx = cricket.x + Math.cos(cricket.dir) * CRICKET_SPEED * dt;
      const ny = cricket.y + Math.sin(cricket.dir) * CRICKET_SPEED * dt;
      if (!circleHitsBlocker(state.grid, nx, ny, 6)) {
        cricket.x = nx;
        cricket.y = ny;
      } else {
        cricket.dir += Math.PI / 2;
      }
      if (cricket.chirpTimer <= 0) {
        cricket.chirpTimer = 1.2;
        state.noise.push({ x: cricket.x, y: cricket.y, radius: GADGETS.cricket.chirpNoise, ttl: 0.5 });
        events |= EVENT_NOISE;
      }
    }
    state.crickets = state.crickets.filter((c) => c.ttl > 0);
    for (const n of state.noise) n.ttl -= dt;
    state.noise = state.noise.filter((n) => n.ttl > 0);

    // Light and cover where the player stands.
    player.lit = lightAt(state.grid, state.lamps, player.x, player.y);
    const tile = tileAt(state.grid, player.x, player.y);
    player.inGrass = tile === ',';
    player.hidden = player.inGrass;

    // Pick up loot and the prize.
    for (const loot of state.loot) {
      if (!loot.taken && Math.hypot(loot.x - player.x, loot.y - player.y) < 26) {
        loot.taken = true;
        state.lootValue += loot.value;
        state.lootTaken += 1;
        events |= EVENT_PICKUP;
      }
    }
    if (!state.prize.taken && Math.hypot(state.prize.x - player.x, state.prize.y - player.y) < 28) {
      state.prize.taken = true;
      state.exit.open = true;
      events |= EVENT_PRIZE;
    }
    // The green hatch, once the prize is in hand.
    if (state.exit.open && Math.hypot(state.exit.x - player.x, state.exit.y - player.y) < 26) {
      finishLevel();
      return events | EVENT_COMPLETE;
    }

    // Guards see, hear, chase and catch.
    const guardEvents = guards.update(dt, state, harmless);
    events |= guardEvents;
    if (guardEvents & EVENT_SPOTTED) {
      state.spotted += 1;
      state.everSpotted = true;
    }
    if (guardEvents & EVENT_CAUGHT) {
      return events | caughtByGuard();
    }

    // The alarm burns down once the house is quiet again.
    if (state.alarm > 0) {
      state.alarmTimer -= dt;
      if (state.alarmTimer <= 0) {
        state.alarm = Math.max(0, state.alarm - 1);
        state.alarmTimer = 18;
      }
    }

    // A hint for the moment, for the player who is stuck.
    if (!state.prize.taken) state.hint = `Steal the ${state.level.prize} — then reach the green hatch.`;
    else state.hint = 'Prize in hand — reach the green hatch, unseen.';
    return events;
  }

  function reset() {
    loadLevel(state.levelIndex);
  }

  loadLevel(0);
  return { state, loadLevel, reset, step, guards };
}
