// Save and load: the player's money, which mission is unlocked, and the best
// haul, kept in localStorage so a visit picks up where the last one left off.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      money: typeof data.money === 'number' ? data.money : 0,
      mission: typeof data.mission === 'number' ? data.mission : 0,
      bestHaul: typeof data.bestHaul === 'number' ? data.bestHaul : 0,
      storyDone: data.storyDone === true,
    };
  } catch {
    return null;
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
