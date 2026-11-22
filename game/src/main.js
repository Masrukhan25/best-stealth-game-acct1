// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// five screens: title (with level select), play, paused, results and failed.
//
// ?shot=cover|spotted|lure|win (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { FIELD, GADGETS, LEVEL_COUNT, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_COMPLETE, EVENT_FAILED, EVENT_GADGET, EVENT_PICKUP, EVENT_PRIZE, EVENT_SPOTTED } from './world.js';
import {
  ACTION_COIN, ACTION_CONFIRM, ACTION_CRICKET, ACTION_DOUSE, ACTION_GAIT_CYCLE,
  ACTION_GAIT_SNEAK, ACTION_GAIT_SPRINT, ACTION_GAIT_WALK, ACTION_MUTE, ACTION_PAUSE,
  ACTION_SMOKE, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_FAILED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_RESULTS, SCREEN_TITLE } from './render.js';
import { stageShot, stageTitle } from './shots.js';

const MAX_FRAME = 0.25;
const GAITS = ['sneak', 'walk', 'sprint'];

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas, world);
const audio = createAudio();

function readSave() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
    if (saved && typeof saved.unlocked === 'number') return saved;
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
  return { unlocked: 1, best: {}, campaign: 0 };
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Ignore: the game still plays, it just forgets between visits.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const save = readSave();
  let screen = SCREEN_TITLE;
  let selected = 0;
  let accumulator = 0;
  let last = performance.now();
  let toast = null;
  let toastTimer = 0;
  let muted = false;
  let titleScene = stageTitle(world);

  function announce(message) {
    status.textContent = message;
  }

  function uiBlock() {
    return {
      seen: screen === SCREEN_PLAY ? world.guards.maxVisibility(world.state) : 0,
      muted,
      unlocked: save.unlocked,
      selected,
      best: save.best,
      toast,
    };
  }

  function startLevel(index) {
    audio.unlock();
    world.loadLevel(index);
    selected = index;
    screen = SCREEN_PLAY;
    accumulator = 0;
    toast = null;
    announce(`Heist ${index + 1}: ${world.state.level.name}. Steal the ${world.state.level.prize}.`);
  }

  function finishLevel() {
    const result = world.state.result;
    const key = String(world.state.levelIndex);
    const line = `$${result.total} · ${result.rank}`;
    if (!save.best[key] || result.total > (save.best[key].total ?? 0)) {
      save.best[key] = { total: result.total, rank: result.rank };
    }
    save.campaign = Math.max(save.campaign, result.campaignScore);
    save.unlocked = Math.max(save.unlocked, Math.min(LEVEL_COUNT, world.state.levelIndex + 2));
    writeSave(save);
    screen = SCREEN_RESULTS;
    audio.complete();
    announce(`${result.rank}. ${result.levelName} clear. Score $${result.total}.`);
  }

  function failLevel() {
    screen = SCREEN_FAILED;
    audio.failed();
    announce(`Heist failed. ${world.state.result.reason}`);
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        if (selected < save.unlocked) startLevel(selected);
      }
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_RESULTS) {
      if (world.state.levelIndex + 1 < LEVEL_COUNT && world.state.levelIndex + 1 < save.unlocked) {
        startLevel(world.state.levelIndex + 1);
      } else {
        titleScene = stageTitle(world);
        screen = SCREEN_TITLE;
      }
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_FAILED) {
      startLevel(world.state.levelIndex);
    }
  }

  function handleGait(actions) {
    const player = world.state.player;
    if (actions & ACTION_GAIT_SNEAK) player.gait = 'sneak';
    else if (actions & ACTION_GAIT_WALK) player.gait = 'walk';
    else if (actions & ACTION_GAIT_SPRINT) player.gait = 'sprint';
    else if (actions & ACTION_GAIT_CYCLE) {
      player.gait = GAITS[(GAITS.indexOf(player.gait) + 1) % GAITS.length];
    }
  }

  function step(actions) {
    handleGait(actions);
    let gadget = null;
    if (actions & ACTION_COIN) gadget = 'coin';
    else if (actions & ACTION_SMOKE) gadget = 'smoke';
    else if (actions & ACTION_DOUSE) gadget = 'douse';
    else if (actions & ACTION_CRICKET) gadget = 'cricket';
    const vector = input.vector();
    const events = world.step(STEP, vector, gadget, input.mouse, false);
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_PRIZE) {
      audio.prize();
      toast = `Prize taken — ${world.state.level.prize}! Reach the green hatch.`;
      toastTimer = 3;
    }
    if (events & EVENT_GADGET) audio.coin();
    if (events & EVENT_SPOTTED) {
      audio.spotted();
      audio.setAlarm(world.state.alarm);
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      toast = `CAUGHT! Strike ${world.state.strikes} of 3 — dragged back to the door.`;
      toastTimer = 2.5;
    }
    if (events & EVENT_COMPLETE) finishLevel();
    else if (events & EVENT_FAILED) failLevel();
    if (world.state.player.moving) audio.footstep(world.state.player.gait);
  }

  let titleDirY = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    accumulator += dt;
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toast = null;
    }
    const actions = input.takeActions();
    // Title-screen level choice rides on the movement keys (edge-triggered).
    if (screen === SCREEN_TITLE) {
      const vector = input.vector();
      const dirY = vector.y < 0 ? -1 : vector.y > 0 ? 1 : 0;
      if (dirY !== 0 && titleDirY === 0) {
        selected = Math.max(0, Math.min(LEVEL_COUNT - 1, selected + dirY));
      }
      titleDirY = dirY;
      // The backdrop keeps patrolling behind the title.
      world.step(STEP, { x: 0, y: 0 }, null, { x: 0, y: 0 }, true);
    }
    handleActions(actions);
    if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, uiBlock());
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Ember Ledger. Choose a heist, press Space to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
