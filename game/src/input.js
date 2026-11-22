// Keyboard and pointer input. Held keys give a steering vector; one-shot presses
// (confirm, pause, gadget keys, gait keys) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.
// Mouse position is kept in playfield coordinates for throwing the coin.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_COIN = 4;
export const ACTION_SMOKE = 8;
export const ACTION_DOUSE = 16;
export const ACTION_CRICKET = 32;
export const ACTION_MUTE = 64;
export const ACTION_GAIT_SNEAK = 128;
export const ACTION_GAIT_WALK = 256;
export const ACTION_GAIT_SPRINT = 512;
export const ACTION_GAIT_CYCLE = 1024;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false };
  let actions = 0;
  const mouse = { x: FIELD.width / 2, y: FIELD.height / 2, inside: false };

  function trackMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (FIELD.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (FIELD.height / rect.height);
    mouse.inside = true;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (event.code === 'KeyQ') { if (!event.repeat) actions |= ACTION_COIN; }
    else if (event.code === 'KeyF') { if (!event.repeat) actions |= ACTION_SMOKE; }
    else if (event.code === 'KeyR') { if (!event.repeat) actions |= ACTION_DOUSE; }
    else if (event.code === 'KeyG') { if (!event.repeat) actions |= ACTION_CRICKET; }
    else if (event.code === 'KeyM') { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (event.code === 'Digit1') { if (!event.repeat) actions |= ACTION_GAIT_SNEAK; }
    else if (event.code === 'Digit2') { if (!event.repeat) actions |= ACTION_GAIT_WALK; }
    else if (event.code === 'Digit3') { if (!event.repeat) actions |= ACTION_GAIT_SPRINT; }
    else if (event.code === 'KeyC') { if (!event.repeat) actions |= ACTION_GAIT_CYCLE; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = false;
  });
  canvas.addEventListener('pointermove', trackMouse);
  canvas.addEventListener('pointerdown', (event) => {
    trackMouse(event);
    actions |= ACTION_CONFIRM | ACTION_COIN;
  });

  return {
    /** Normalised steering vector from the held movement keys. */
    vector() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    moving() {
      return held.up || held.down || held.left || held.right;
    },
    mouse: { get x() { return mouse.x; }, get y() { return mouse.y; }, get inside() { return mouse.inside; } },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
