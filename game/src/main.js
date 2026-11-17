// SOLMAR — boot and the one loop. Input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves between
// screens: title, play, paused, busted, wasted and story complete. The player is
// Dex Marlowe, a wheelman working off a $50,000 debt to Sal Bianchi in the
// sun-soaked coastal city of Solmar.
//
// ?shot=cover|onfoot|chase|mission (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { CAR, PALETTE, STEP, VIEW, WORLD } from './config.js';
import { createRandom, intRange, pick, range } from './random.js';
import { createCity, LANDMARKS } from './city.js';
import { createPlayer } from './player.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions, MISSIONS } from './missions.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, ACTION_PUNCH, ACTION_SHOOT, createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { driveCar, makeCar, separateCars } from './vehicles.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const PED_HIT_COOLDOWN = 2;
const START_SPAWN = { x: 1600, y: 900 };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const city = createCity(random);
const player = createPlayer(city, START_SPAWN);
const traffic = createTraffic(random, city);
const police = createPolice(random);
const combat = createCombat(random);
const missions = createMissions();
const renderer = createRenderer(canvas);
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);

const game = {
  city, player, traffic, police, combat, missions, renderer, hud, audio,
  particles: [],
  hint: '',
  time: 0,
  tint: 'day',
  screen: 'title',
};

// Test hook: ?debug=1 exposes the live game for a browser play-test. The shipped
// game never reads it; it only lets a test drive the city, steal a car and check
// the wanted level and missions change as they should.
if (params.get('debug')) window.__solmar = game;

// A parked car the player left behind, waiting to be driven again.
const parkedCars = [];

function addParticles(x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = random() * Math.PI * 2;
    const s = range(random, speed * 0.4, speed);
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(random, 0.3, 0.7), maxLife: 0.7, color, size: range(random, 2, 5) });
  }
}

function scatterPickups() {
  const spots = [
    { kind: 'health', x: LANDMARKS.hospital.x, y: LANDMARKS.hospital.y + 90 },
    { kind: 'ammo', x: LANDMARKS.ammo.x, y: LANDMARKS.ammo.y + 90 },
    { kind: 'health', x: 1000, y: 1400 },
    { kind: 'ammo', x: 2200, y: 1900 },
    { kind: 'cash', x: 1600, y: 400 },
    { kind: 'cash', x: 400, y: 900 },
    { kind: 'health', x: 2800, y: 400 },
    { kind: 'ammo', x: 1000, y: 1900 },
    { kind: 'cash', x: 2200, y: 400 },
    { kind: 'health', x: 1600, y: 1900 },
  ];
  for (const s of spots) combat.addPickup(s.kind, s.x, s.y, s.kind === 'health' ? 50 : s.kind === 'ammo' ? 24 : 150);
}

function saveGame() {
  writeSave({
    money: player.state.money,
    mission: missions.index,
    bestHaul: player.state.totalEarned,
    storyDone: missions.done,
  });
}

function loadGame() {
  const save = loadSave();
  if (!save) return false;
  player.state.money = save.money;
  player.state.totalEarned = save.bestHaul;
  missions.restore(save.mission, save.storyDone);
  return true;
}

function announce(message) {
  status.textContent = message;
}

let pedHitCooldown = 0;

function crimeSeen(dist) {
  const near = police.nearest(player.state.x, player.state.y);
  return near !== null && near.dist < dist;
}

function runOverPedestrians(car) {
  if (pedHitCooldown > 0) return;
  for (const ped of traffic.peds) {
    if (ped.down > 0) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 34) {
      ped.down = 4;
      ped.panic = 2;
      addParticles(ped.x, ped.y, '#c9a06b', 10, 120);
      audio.crash();
      player.raiseWanted(1);
      audio.wanted();
      missions.say('You hit a pedestrian! Wanted level up.', 3);
      pedHitCooldown = PED_HIT_COOLDOWN;
      break;
    }
  }
}

function stealCar(car) {
  // Pull the car out of traffic (or the parked list) and hand it to the player.
  const ti = traffic.cars.indexOf(car);
  if (ti >= 0) traffic.cars.splice(ti, 1);
  const pi = parkedCars.indexOf(car);
  if (pi >= 0) parkedCars.splice(pi, 1);
  traffic.spawnOne();
  player.enterCar(car);
  if (crimeSeen(600)) {
    player.raiseWanted(1);
    audio.wanted();
    missions.say('The cops saw you jack that car!', 3);
  } else {
    missions.say('Car stolen. Drive safe, Dex.', 3);
  }
  audio.click();
}

function exitCar() {
  const car = player.state.inCar;
  player.exitCar();
  if (car) {
    car.speed = 0;
    parkedCars.push(car);
  }
  audio.click();
}

function nearestEnterableCar() {
  const p = player.state;
  let best = null;
  let bestD = 70;
  for (const car of traffic.cars) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  for (const car of parkedCars) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function missionMarkerReached() {
  const marker = missions.marker();
  if (!marker) return false;
  const p = player.state;
  return Math.hypot(marker.x - p.x, marker.y - p.y) < 56;
}

function startMissionIfAtMarker() {
  if (missions.active || missions.done) return false;
  if (!missionMarkerReached()) return false;
  if (!missions.start()) return false;
  audio.mission();
  const m = missions.current();
  if (m.id === 'getaway') {
    // The getaway starts hot: two stars on Dex the moment Mia gets in.
    player.raiseWanted(2);
    audio.wanted();
  }
  if (m.id === 'pickup') {
    player.raiseWanted(1);
    audio.wanted();
  }
  if (m.id === 'big-score') {
    // Two guards watch the bank.
    combat.addEnemy(LANDMARKS.bank.x - 60, LANDMARKS.bank.y - 40, 60);
    combat.addEnemy(LANDMARKS.bank.x + 60, LANDMARKS.bank.y - 40, 60);
  }
  saveGame();
  return true;
}

function advanceMissionIfAtMarker() {
  if (!missions.active) return;
  const step = missions.currentStep();
  if (!step) return;
  if (step.hold) return; // handled by the hold logic
  if (!missionMarkerReached()) return;
  const result = missions.reach();
  if (result === 'done') {
    const m = MISSIONS[missions.index - 1];
    player.earn(m.reward);
    audio.mission();
    combat.clearEnemies();
    if (missions.done) {
      game.screen = 'story';
      announce('Story complete. Dex paid off Sal. Solmar is yours.');
    }
    saveGame();
  } else {
    audio.pickup();
  }
}

function holdVault(dt, holdingE) {
  if (!missions.active) return;
  const step = missions.currentStep();
  if (!step || !step.hold) return;
  if (!missionMarkerReached()) return;
  const result = missions.hold(dt, holdingE);
  if (result === 'holding') {
    game.hint = 'Cracking the vault… hold E (' + Math.ceil(step.hold - missions.holdTime) + 's)';
  } else if (result === 'complete') {
    player.raiseWanted(4);
    audio.wanted();
    missions.say('Vault open! $5,000 in the bag — RUN!', 4);
    const done = missions.reach();
    if (done === 'done') {
      player.earn(5000);
      audio.mission();
      if (missions.done) game.screen = 'story';
      saveGame();
    }
  }
}

function onBusted() {
  const fine = Math.min(500, Math.floor(player.state.money * 0.1));
  player.state.money -= fine;
  player.clearWanted();
  police.clear();
  combat.clearEnemies();
  missions.fail('BUSTED');
  player.reset(LANDMARKS.policeStation);
  game.screen = 'busted';
  audio.busted();
  announce('Busted. You lost $' + fine + ' in fines.');
  saveGame();
}

function onWasted() {
  const lost = Math.min(300, Math.floor(player.state.money * 0.1));
  player.state.money -= lost;
  player.clearWanted();
  police.clear();
  combat.clearEnemies();
  missions.fail('WASTED');
  player.reset(LANDMARKS.hospital);
  game.screen = 'wasted';
  audio.busted();
  announce('Wasted. You woke up at Solmar General, $' + lost + ' lighter.');
  saveGame();
}

function stepWorld(dt, vec, actions, holdingE) {
  const p = player.state;
  game.time += dt;
  if (pedHitCooldown > 0) pedHitCooldown -= dt;

  // Driving or walking.
  if (p.inCar) {
    const car = p.inCar;
    // W/S is forward/back, A/D steers; vec.y is -1 for W (up) in screen terms.
    const fwd = -vec.y;
    const steer = vec.x;
    const hit = driveCar(city, car, dt, fwd, steer, false);
    if (hit) {
      audio.crash();
      addParticles(car.x, car.y, '#888888', 6, 90);
    }
    if (car.skid > 0.3) addParticles(car.x, car.y, '#bbbbbb', 1, 30);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    runOverPedestrians(car);
    // Separate from other cars.
    for (const other of traffic.cars) separateCars(car, other);
    for (const other of police.cars) separateCars(car, other);
    for (const other of parkedCars) separateCars(car, other);
    if (car.health <= 0) {
      addParticles(car.x, car.y, '#ff8844', 24, 220);
      audio.crash();
      exitCar();
      car.health = 100;
    }
    audio.engine(Math.abs(car.speed) / 540);
  } else {
    player.stepOnFoot(dt, vec.x, vec.y, false);
    audio.engine(0);
  }

  // Interact: enter/exit a car, or start a mission.
  if (actions & ACTION_INTERACT) {
    if (p.inCar) exitCar();
    else {
      const car = nearestEnterableCar();
      if (car) stealCar(car);
      else startMissionIfAtMarker();
    }
  }
  // Punch and shoot, on foot only.
  if (!p.inCar && (actions & ACTION_PUNCH)) {
    if (player.punch()) {
      audio.punch();
      combat.punch(player, traffic, (what) => {
        if (what === 'ped' && crimeSeen(500)) {
          player.raiseWanted(1);
          audio.wanted();
        }
      });
    }
  }
  if (!p.inCar && (actions & ACTION_SHOOT)) {
    if (player.shoot()) {
      audio.gunshot();
      const aim = input.aim();
      const camX = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, p.x)) - VIEW.width / 2;
      const camY = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, p.y)) - VIEW.height / 2;
      const wx = camX + aim.x;
      const wy = camY + aim.y;
      const angle = Math.atan2(wy - p.y, wx - p.x);
      combat.fireBullet(p.x + Math.cos(angle) * 20, p.y + Math.sin(angle) * 20, angle, true);
      if (crimeSeen(600)) {
        player.raiseWanted(1);
        audio.wanted();
      }
    }
  }

  // The living city.
  const danger = p.inCar ? { x: p.x, y: p.y } : null;
  traffic.step(dt, danger, p.inCar);
  police.step(dt, player, p.inCar, city, onBusted);
  combat.step(dt, city, player, traffic, police, () => {
    if (p.health <= 0) onWasted();
  });
  if (p.health <= 0) onWasted();

  // Missions.
  advanceMissionIfAtMarker();
  holdVault(dt, holdingE);
  missions.tick(dt);

  // Hint line.
  if (!p.inCar) {
    if (nearestEnterableCar()) game.hint = 'E — Steal car';
    else if (!missions.active && !missions.done && missionMarkerReached()) game.hint = 'E — Start mission: ' + (missions.current() ? missions.current().title : '');
    else if (missions.active && missions.currentStep() && missions.currentStep().hold && missionMarkerReached()) game.hint = 'Hold E — Crack the vault';
    else game.hint = 'WASD — Move    F — Punch    Click — Shoot    E — Enter car    P — Pause';
  } else {
    game.hint = 'W/S — Drive    A/D — Steer    E — Get out    P — Pause';
  }

  // Police siren while wanted.
  audio.siren(p.wanted > 0 && police.cars.length > 0);
}

function runShot(name) {
  const scene = stageShot(name, game, random);
  game.tint = scene.tint || 'day';
  game.screen = 'play';
  let painted = 0;
  function paint() {
    renderer.draw(game, game.time, game.tint);
    hud.draw(renderer.hudTransform(), game, game.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const hasSave = loadGame();
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();
  let holdingE = false;

  scatterPickups();

  function startGame() {
    player.reset(START_SPAWN);
    police.clear();
    combat.clearEnemies();
    const save = loadSave();
    missions.restore(save ? save.mission : 0, save ? save.storyDone : false);
    screen = 'play';
    audio.unlock();
    announce('Playing. Dex owes Sal $50,000. Follow the yellow marker.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    const vec = input.vector();
    holdingE = holdingE || (actions & ACTION_INTERACT) !== 0;
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') { screen = 'paused'; saveGame(); announce('Paused.'); }
      else if (screen === 'paused') { screen = 'play'; announce('Playing.'); }
    } else if (actions & ACTION_CONFIRM) {
      if (screen === 'title' || screen === 'busted' || screen === 'wasted' || screen === 'story') startGame();
    }
    if (screen === 'play') {
      while (accumulator >= STEP) {
        stepWorld(STEP, vec, actions, holdingE);
        accumulator -= STEP;
        if (game.screen === 'busted' || game.screen === 'wasted' || game.screen === 'story') {
          screen = game.screen;
          game.screen = 'play';
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    // Draw.
    if (screen === 'title') drawTitle();
    else if (screen === 'paused') drawPaused();
    else if (screen === 'busted') drawEnd('BUSTED', 'The Solmar PD took you in. You lost 10% of your cash.', 'Press Space to get back out there');
    else if (screen === 'wasted') drawEnd('WASTED', 'You woke up at Solmar General, 10% lighter.', 'Press Space to get back out there');
    else if (screen === 'story') drawEnd('DEBT PAID', 'Dex paid off Sal Bianchi. Solmar is yours — free roam.', 'Press Space to keep playing');
    else {
      renderer.draw(game, game.time, game.tint);
      hud.draw(renderer.hudTransform(), game, game.time);
    }
  }

  function drawTitle() {
    renderer.draw(game, game.time, 'day');
    const ctx = renderer.hudTransform();
    ctx.fillStyle = 'rgba(10, 14, 22, 0.66)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.hudGold;
    ctx.font = 'bold 84px ' + 'system-ui, sans-serif';
    ctx.fillText('SOLMAR', VIEW.width / 2, 190);
    ctx.fillStyle = '#f2f4f7';
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText('An open-world crime story', VIEW.width / 2, 232);
    ctx.fillStyle = '#c8d0dc';
    ctx.font = '19px system-ui, sans-serif';
    const lines = [
      "Dex Marlowe owes Sal Bianchi $50,000.",
      'Drive, steal, run and fight your way out of debt.',
      '',
      'WASD — Move / Drive    E — Enter car / Start mission    F — Punch',
      'Click — Shoot    P — Pause    The yellow marker is your next job.',
      '',
      hasSave ? 'Save found — your money and missions are kept.' : 'No save yet — a new story begins.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 300 + i * 30));
    ctx.fillStyle = PALETTE.hudGold;
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText('Press Space or click to start', VIEW.width / 2, 560);
  }

  function drawPaused() {
    renderer.draw(game, game.time, game.tint);
    const ctx = renderer.hudTransform();
    ctx.fillStyle = 'rgba(10, 14, 22, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2f4f7';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('PAUSED', VIEW.width / 2, 320);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = '#c8d0dc';
    ctx.fillText('Progress saved. Press P to resume.', VIEW.width / 2, 370);
  }

  function drawEnd(title, line, prompt) {
    renderer.draw(game, game.time, game.tint);
    const ctx = renderer.hudTransform();
    ctx.fillStyle = 'rgba(10, 14, 22, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = title === 'DEBT PAID' ? PALETTE.hudGold : PALETTE.hudRed;
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.fillText(title, VIEW.width / 2, 300);
    ctx.fillStyle = '#f2f4f7';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText(line, VIEW.width / 2, 360);
    ctx.fillStyle = PALETTE.hudGold;
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText(prompt, VIEW.width / 2, 430);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      saveGame();
      announce('Paused.');
    }
  });

  announce('Solmar. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
