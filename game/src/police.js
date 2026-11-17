// The wanted level and the police who answer it. Stars rise with crimes and fall
// when the player stays out of sight; police cars spawn at the map edge, chase the
// player, ram his car, and on foot a cop who holds him long enough busts him.
// The player is never instantly caught: a bust needs sustained contact.
import { PALETTE, POLICE, WANTED_MAX, WORLD } from './config.js';
import { driveCar, makeCar } from './vehicles.js';
import { pick } from './random.js';

const COP_FOOT_SPEED = 200;

export function createPolice(random) {
  const cars = [];
  const cops = []; // officers on foot
  let hiddenTimer = 0;
  let decayTimer = 0;

  function spawnPoint() {
    const edge = pick(random, ['n', 's', 'e', 'w']);
    if (edge === 'n') return { x: 60 + random() * (WORLD.width - 120), y: 60 };
    if (edge === 's') return { x: 60 + random() * (WORLD.width - 120), y: WORLD.height - 60 };
    if (edge === 'e') return { x: WORLD.width - 60, y: 60 + random() * (WORLD.height - 120) };
    return { x: 60, y: 60 + random() * (WORLD.height - 120) };
  }

  function spawnCar() {
    const p = spawnPoint();
    const car = makeCar(p.x, p.y, random() * Math.PI * 2, PALETTE.policeCar, 'police');
    car.siren = true;
    car.cruise = POLICE.maxSpeed;
    cars.push(car);
    return car;
  }

  function spawnCop(x, y) {
    cops.push({ x, y, angle: 0, holdTime: 0, speed: COP_FOOT_SPEED });
  }

  return {
    cars,
    cops,
    /** How many police cars the wanted level calls for. */
    wantedCars(wanted) {
      return Math.min(wanted, 5);
    },
    /** One fixed step: keep the right number of cars, chase, ram, bust. */
    step(dt, player, playerCar, city, onBusted) {
      const wanted = player.state.wanted;
      // Spawn or retire cars to match the wanted level.
      while (cars.length < this.wantedCars(wanted)) spawnCar();
      while (cars.length > this.wantedCars(wanted)) {
        const car = cars.pop();
        car.dead = true;
      }
      // A cop on foot appears when a police car gets close to a player on foot.
      if (!playerCar && wanted > 0 && cops.length < Math.min(wanted, 3)) {
        for (const car of cars) {
          if (Math.hypot(car.x - player.state.x, car.y - player.state.y) < 320) {
            spawnCop(car.x, car.y);
            break;
          }
        }
      }
      // Police cars chase: steer toward the player and ram, using the same
      // vehicle physics as traffic so they respect buildings and roads.
      for (const car of cars) {
        const targetAngle = Math.atan2(player.state.y - car.y, player.state.x - car.x);
        let diff = targetAngle - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const steer = Math.max(-1, Math.min(1, diff * 2.2));
        driveCar(city, car, dt, 1, steer, false);
        car.speed = Math.min(car.speed, POLICE.maxSpeed);
        car.flashing += dt;
        // Ramming the player's car hurts it and slows both.
        if (playerCar) {
          const d = Math.hypot(car.x - playerCar.x, car.y - playerCar.y);
          if (d < 46) {
            playerCar.health = Math.max(0, playerCar.health - POLICE.ramDamage * dt * 4);
            car.speed *= 0.92;
            playerCar.speed *= 0.94;
          }
        }
      }
      // Officers on foot chase and hold the player.
      for (let i = cops.length - 1; i >= 0; i -= 1) {
        const cop = cops[i];
        const dx = player.state.x - cop.x;
        const dy = player.state.y - cop.y;
        const d = Math.hypot(dx, dy) || 1;
        cop.angle = Math.atan2(dy, dx);
        if (d > 26) {
          cop.x += (dx / d) * cop.speed * dt;
          cop.y += (dy / d) * cop.speed * dt;
          cop.holdTime = 0;
        } else {
          cop.holdTime += dt;
          if (cop.holdTime >= POLICE.bustTime) {
            cops.splice(i, 1);
            onBusted();
            return;
          }
        }
        if (d > 900 || wanted === 0) cops.splice(i, 1);
      }
      // Wanted decays when no police can see the player.
      let seen = false;
      for (const car of cars) {
        if (Math.hypot(car.x - player.state.x, car.y - player.state.y) < POLICE.sightRange) { seen = true; break; }
      }
      if (!seen) {
        hiddenTimer += dt;
        if (hiddenTimer >= POLICE.decayDelay) {
          decayTimer += dt;
          if (decayTimer >= POLICE.decayStep && wanted > 0) {
            player.state.wanted = Math.max(0, wanted - 1);
            decayTimer = 0;
            hiddenTimer = 0;
          }
        }
      } else {
        hiddenTimer = 0;
        decayTimer = 0;
      }
      // Police cars that left the map or were wrecked are removed.
      for (let i = cars.length - 1; i >= 0; i -= 1) {
        const car = cars[i];
        if (car.health <= 0 || car.x < -80 || car.y < -80 || car.x > WORLD.width + 80 || car.y > WORLD.height + 80) {
          cars.splice(i, 1);
        }
      }
    },
    /** The nearest police car, or null when none are out. */
    nearest(x, y) {
      let best = null;
      let bestD = Infinity;
      for (const car of cars) {
        const d = Math.hypot(car.x - x, car.y - y);
        if (d < bestD) { bestD = d; best = car; }
      }
      return best ? { car: best, dist: bestD } : null;
    },
    clear() {
      cars.length = 0;
      cops.length = 0;
    },
  };
}
