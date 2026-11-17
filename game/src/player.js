// The player: on foot and behind the wheel. On foot Dex walks the sidewalks and
// can punch, shoot and jack cars; in a car he drives it. Health, money, ammo and
// the wanted level live here, so every system reads one place.
import { CAR, PLAYER, START_CASH, WANTED_MAX, WORLD } from './config.js';
import { districtAt, inWater } from './city.js';

export function createPlayer(city, spawn) {
  const state = {
    x: spawn.x,
    y: spawn.y,
    angle: 0,
    health: PLAYER.health,
    money: START_CASH,
    ammo: 24,
    wanted: 0,
    inCar: null,
    punchTimer: 0,
    shootTimer: 0,
    invulnerable: 0,
    running: false,
    district: 'Solmar',
    totalEarned: 0,
    kills: 0,
  };

  /** True when the circle at (x, y) with radius r hits a building or water. */
  function blocked(x, y, r) {
    if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
    if (inWater(x, y)) return true;
    for (const b of city.buildings) {
      if (b.park) continue;
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }

  function moveOnFoot(dt, vx, vy) {
    const speed = vx !== 0 || vy !== 0 ? (state.running ? PLAYER.runSpeed : PLAYER.walkSpeed) : 0;
    if (speed === 0) return;
    const len = Math.hypot(vx, vy) || 1;
    const nx = state.x + (vx / len) * speed * dt;
    const ny = state.y + (vy / len) * speed * dt;
    // Slide along walls: try each axis on its own.
    if (!blocked(nx, state.y, PLAYER.radius)) state.x = nx;
    if (!blocked(state.x, ny, PLAYER.radius)) state.y = ny;
    state.angle = Math.atan2(vy, vx);
  }

  return {
    state,
    /** The district the player stands in, for the HUD. */
    district() {
      return districtAt(state.x, state.y);
    },
    /** One fixed step on foot; vx/vy is the -1..1 input vector, run is the sprint key. */
    stepOnFoot(dt, vx, vy, run) {
      state.running = run;
      moveOnFoot(dt, vx, vy);
      if (state.punchTimer > 0) state.punchTimer -= dt;
      if (state.shootTimer > 0) state.shootTimer -= dt;
      if (state.invulnerable > 0) state.invulnerable -= dt;
      state.district = districtAt(state.x, state.y);
    },
    punch() {
      if (state.punchTimer > 0) return false;
      state.punchTimer = PLAYER.punchCooldown;
      return true;
    },
    shoot() {
      if (state.shootTimer > 0 || state.ammo <= 0) return false;
      state.shootTimer = 0.22;
      state.ammo -= 1;
      return true;
    },
    hurt(amount) {
      if (state.invulnerable > 0) return false;
      state.health = Math.max(0, state.health - amount);
      state.invulnerable = 0.6;
      return true;
    },
    heal(amount) {
      state.health = Math.min(PLAYER.health, state.health + amount);
    },
    addAmmo(amount) {
      state.ammo += amount;
    },
    earn(amount) {
      state.money += amount;
      state.totalEarned += amount;
    },
    spend(amount) {
      if (state.money < amount) return false;
      state.money -= amount;
      return true;
    },
    /** Raise the wanted level, capped at WANTED_MAX; returns the new level. */
    raiseWanted(by) {
      state.wanted = Math.min(WANTED_MAX, state.wanted + by);
      return state.wanted;
    },
    clearWanted() {
      state.wanted = 0;
    },
    enterCar(car) {
      state.inCar = car;
      car.driver = 'player';
    },
    exitCar() {
      const car = state.inCar;
      state.inCar = null;
      if (car) {
        car.driver = null;
        // Step out beside the car, on the driver's side.
        const side = car.angle + Math.PI / 2;
        state.x = car.x + Math.cos(side) * (CAR.width / 2 + PLAYER.radius + 4);
        state.y = car.y + Math.sin(side) * (CAR.width / 2 + PLAYER.radius + 4);
      }
    },
    reset(spawnPoint) {
      state.x = spawnPoint.x;
      state.y = spawnPoint.y;
      state.angle = 0;
      state.health = PLAYER.health;
      state.wanted = 0;
      state.inCar = null;
      state.invulnerable = 0;
    },
  };
}
