// Missions and the story: Dex Marlowe owes $50,000 to Sal Bianchi, and Sal's jobs
// are the only way out. Four missions, each a short chain of objectives with a
// marker in the world and on the minimap; finishing one unlocks the next and pays.
// The last one clears the debt and ends the story, after which Solmar is free roam.
import { LANDMARKS } from './city.js';

export const MISSIONS = [
  {
    id: 'first-job',
    title: 'The First Job',
    briefing: "Sal wants a package moved. Pick it up at the Marina Pier and drop it at Dock 9. Don't make a scene.",
    reward: 500,
    steps: [
      { text: 'Pick up the package at Marina Pier', at: LANDMARKS.marina, radius: 46 },
      { text: 'Deliver the package to Dock 9', at: LANDMARKS.docks, radius: 46 },
    ],
  },
  {
    id: 'getaway',
    title: 'Getaway Driver',
    briefing: "Mia needs a lift from The Velvet Room. The cops are already on her tail — get her to the safehouse in one piece.",
    reward: 1000,
    steps: [
      { text: 'Pick up Mia at The Velvet Room', at: LANDMARKS.club, radius: 46 },
      { text: 'Lose the cops and reach the safehouse', at: LANDMARKS.safehouse, radius: 60 },
    ],
  },
  {
    id: 'pickup',
    title: 'The Pickup',
    briefing: "Sal's money is sitting in three dead drops around the city. Collect it all, then bring it home. The PD is watching.",
    reward: 900,
    steps: [
      { text: 'Collect the drop at Old Town', at: { x: 400, y: 1400 }, radius: 46 },
      { text: 'Collect the drop at The Strip', at: { x: 1600, y: 1400 }, radius: 46 },
      { text: 'Collect the drop at Marina Bay', at: { x: 2800, y: 900 }, radius: 46 },
      { text: 'Bring the cash to the safehouse', at: LANDMARKS.safehouse, radius: 60 },
    ],
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    briefing: 'One last job and the debt is gone: hit the Marina Bank, grab the cash and vanish into the Hillside hideout. Every cop in Solmar will be coming.',
    reward: 5000,
    steps: [
      { text: 'Reach the Marina Bank', at: LANDMARKS.bank, radius: 50 },
      { text: 'Hold E to crack the vault', at: LANDMARKS.bank, radius: 50, hold: 3 },
      { text: 'Escape to the Hillside hideout', at: LANDMARKS.hideout, radius: 60 },
    ],
  },
];

export function createMissions() {
  let index = 0; // which mission is current
  let stepIndex = 0;
  let active = false;
  let done = false;
  let holdTime = 0;
  let message = '';
  let messageTimer = 0;

  function current() {
    return index < MISSIONS.length ? MISSIONS[index] : null;
  }

  function currentStep() {
    const m = current();
    return m ? m.steps[stepIndex] : null;
  }

  return {
    get index() { return index; },
    get active() { return active; },
    get done() { return done; },
    get message() { return message; },
    get messageTimer() { return messageTimer; },
    get holdTime() { return holdTime; },
    set holdTime(v) { holdTime = v; },
    current,
    currentStep,
    /** The objective text the HUD shows, or the free-roam line. */
    objective() {
      if (done) return 'Debt paid. Solmar is yours — free roam.';
      if (!active) return 'Go to the yellow marker to start: ' + (current() ? current().title : '');
      const step = currentStep();
      return step ? step.text : '';
    },
    /** Start the current mission (called at its marker). */
    start() {
      const m = current();
      if (!m || active) return false;
      active = true;
      stepIndex = 0;
      holdTime = 0;
      // Keep the toast short: the title and the first step, not the whole briefing.
      message = m.title + ' — ' + m.steps[0].text;
      messageTimer = 6;
      return true;
    },
    /** Advance one step when the player reaches the marker; returns 'step' | 'done' | null. */
    reach() {
      const m = current();
      if (!m || !active) return null;
      stepIndex += 1;
      holdTime = 0;
      if (stepIndex >= m.steps.length) {
        active = false;
        message = m.title + ' complete! +$' + m.reward;
        messageTimer = 5;
        index += 1;
        if (index >= MISSIONS.length) done = true;
        return 'done';
      }
      message = currentStep().text;
      messageTimer = 4;
      return 'step';
    },
    /** Fail the active mission (busted or wasted): back to its start. */
    fail(reason) {
      if (!active) return;
      active = false;
      stepIndex = 0;
      holdTime = 0;
      message = reason + ' — mission failed. Go back to the marker to retry.';
      messageTimer = 5;
    },
    /** Hold-to-progress for vault-style steps; returns true while holding. */
    hold(dt, holding) {
      const step = currentStep();
      if (!step || !step.hold) return false;
      if (holding) {
        holdTime += dt;
        if (holdTime >= step.hold) {
          holdTime = 0;
          return 'complete';
        }
        return 'holding';
      }
      holdTime = Math.max(0, holdTime - dt * 2);
      return false;
    },
    /** The marker the HUD and minimap point at right now. */
    marker() {
      if (done) return null;
      if (!active) {
        // Before a mission starts, the marker is its first step.
        const m = current();
        return m ? { x: m.steps[0].at.x, y: m.steps[0].at.y, kind: 'start' } : null;
      }
      const step = currentStep();
      return step ? { x: step.at.x, y: step.at.y, kind: 'objective' } : null;
    },
    tick(dt) {
      if (messageTimer > 0) messageTimer -= dt;
    },
    say(text, seconds) {
      message = text;
      messageTimer = seconds || 4;
    },
    /** Restore progress from a save. */
    restore(missionIndex, storyDone) {
      index = Math.min(missionIndex, MISSIONS.length);
      done = storyDone === true || index >= MISSIONS.length;
      active = false;
      stepIndex = 0;
    },
  };
}
