// Staged scenes for the screenshots. Each scene puts the game into a state that
// shows several systems at once — the city, traffic, pedestrians, the wanted level
// with police, a mission objective, the HUD and the minimap — then the shot mode
// paints it twice and the browser takes the picture. The scenes are deterministic:
// same seed, same scene, same frame, so the dossier and the screenshots agree.
import { LANDMARKS, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { makeCar } from './vehicles.js';
import { pick, range } from './random.js';

// Place the player in a car on a main road, mid-city, with traffic around.
function playerInCar(game) {
  const car = makeCar(1600, 900, 0, '#e63946', 'player');
  car.speed = 300;
  game.player.enterCar(car);
  game.player.state.x = car.x;
  game.player.state.y = car.y;
  game.player.state.angle = 0;
  return car;
}

// A few traffic cars and pedestrians near the player, so the street is alive.
// Cars go on the roads and pedestrians on the sidewalks, never on the grass.
function busyStreet(game, random, near) {
  for (let i = 0; i < 6; i += 1) {
    const p = randomRoadPoint(random);
    const car = makeCar(p.x, p.y, pick(random, [0, Math.PI / 2, Math.PI, -Math.PI / 2]), pick(random, ['#e9c46a', '#457b9d', '#f4f4f4', '#8ecae6']), 'traffic');
    car.speed = range(random, 80, 160);
    game.traffic.cars.push(car);
  }
  for (let i = 0; i < 10; i += 1) {
    const p = randomSidewalkPoint(random);
    game.traffic.peds.push({
      x: p.x,
      y: p.y,
      angle: random() * Math.PI * 2,
      speed: range(random, 40, 70),
      color: pick(random, ['#e76f51', '#2a9d8f', '#e9c46a', '#f4f4f4']),
      walkPhase: random() * Math.PI * 2,
      panic: 0,
      down: 0,
    });
  }
}

export function stageShot(name, game, random) {
  const player = game.player;
  const missions = game.missions;
  const police = game.police;
  const combat = game.combat;

  if (name === 'cover') {
    // The cover: Dex driving through Downtown at speed, traffic and pedestrians
    // around him, the HUD and minimap on, a mission marker ahead.
    playerInCar(game);
    busyStreet(game, random, { x: 1600, y: 900 });
    player.state.money = 1250;
    missions.start();
    missions.say('Mission: The First Job — Deliver the package to Dock 9', 10);
    return { tint: 'day' };
  }

  if (name === 'onfoot') {
    // On foot at the Marina Bank, the Big Score about to start: the vault marker,
    // two guards, the HUD and minimap on.
    player.reset({ x: LANDMARKS.bank.x, y: LANDMARKS.bank.y + 120 });
    player.state.money = 2400;
    missions.restore(3, false);
    missions.start();
    combat.addEnemy(LANDMARKS.bank.x - 60, LANDMARKS.bank.y - 40, 60);
    combat.addEnemy(LANDMARKS.bank.x + 60, LANDMARKS.bank.y - 40, 60);
    busyStreet(game, random, { x: LANDMARKS.bank.x, y: LANDMARKS.bank.y });
    return { tint: 'day' };
  }

  if (name === 'chase') {
    // A three-star police chase at dusk: two police cars on Dex's tail, sirens
    // flashing, the wanted stars lit, the minimap showing the pursuit.
    playerInCar(game);
    busyStreet(game, random, { x: 1600, y: 900 });
    player.state.money = 800;
    player.raiseWanted(3);
    const cop1 = makeCar(1600 - 180, 900 + 60, 0, '#1d4ed8', 'police');
    cop1.speed = 320;
    cop1.flashing = 0.2;
    const cop2 = makeCar(1600 - 260, 900 - 40, 0, '#1d4ed8', 'police');
    cop2.speed = 300;
    cop2.flashing = 0.6;
    police.cars.push(cop1, cop2);
    missions.say('WANTED — Lose the cops! Get to the safehouse.', 10);
    return { tint: 'dusk' };
  }

  if (name === 'mission') {
    // The Big Score in progress at night: Dex on foot at the bank, the vault
    // cracking, guards down, a police car closing in, the mission objective on
    // the HUD.
    player.reset({ x: LANDMARKS.bank.x, y: LANDMARKS.bank.y + 60 });
    player.state.money = 3500;
    player.state.ammo = 18;
    missions.restore(3, false);
    missions.start();
    // The vault is already being cracked: advance to the hold step and show it
    // part-way through, so the objective reads "Hold E to crack the vault".
    missions.reach();
    missions.holdTime = 1.8;
    const guard = combat.addEnemy(LANDMARKS.bank.x - 60, LANDMARKS.bank.y - 40, 60);
    guard.alive = false;
    combat.addEnemy(LANDMARKS.bank.x + 60, LANDMARKS.bank.y - 40, 60);
    player.raiseWanted(2);
    // The closing police car sits on the road below the bank, not on a building.
    const cop = makeCar(2800, 900, -Math.PI / 2, '#1d4ed8', 'police');
    cop.flashing = 0.3;
    police.cars.push(cop);
    missions.say('Cracking the vault… hold on!', 10);
    return { tint: 'night' };
  }

  // Unknown scene name: fall back to the cover.
  return stageShot('cover', game, random);
}
