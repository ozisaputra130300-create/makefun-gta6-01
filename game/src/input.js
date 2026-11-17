// Keyboard and mouse input. Held keys give a steering vector; one-shot presses
// (confirm, pause, interact, punch, shoot) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice.
// The mouse position is tracked for aiming the pistol.
import { VIEW } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const SHOOT = new Set(['KeyJ']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false };
  let actions = 0;
  const mouse = { x: VIEW.width / 2, y: VIEW.height / 2, down: false };

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (INTERACT.has(event.code)) { if (!event.repeat) actions |= ACTION_INTERACT; }
    else if (PUNCH.has(event.code)) { if (!event.repeat) actions |= ACTION_PUNCH; }
    else if (SHOOT.has(event.code)) { if (!event.repeat) actions |= ACTION_SHOOT; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = false;
    mouse.down = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * VIEW.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * VIEW.height;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.down = true;
    if (event.button === 0) actions |= ACTION_SHOOT;
    else actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointerup', () => { mouse.down = false; });

  return {
    /** -1/0/1 steering on each axis from the held movement keys. */
    vector() {
      return { x: (keys.right ? 1 : 0) - (keys.left ? 1 : 0), y: (keys.down ? 1 : 0) - (keys.up ? 1 : 0) };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The mouse position in logical view coordinates, for aiming. */
    aim() {
      return mouse;
    },
  };
}
