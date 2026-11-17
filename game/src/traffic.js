// Traffic and pedestrians: the city alive. Traffic cars cruise the road grid,
// turning at intersections and slowing for the car ahead; pedestrians stroll the
// sidewalks and cross at crossings. Both are pure simulation — no drawing here.
import { PALETTE, PEDESTRIAN_COUNT, ROADS_X, ROADS_Y, ROAD_WIDTH, TRAFFIC_COUNT, WORLD } from './config.js';
import { onRoad, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { driveCar, makeCar, separateCars } from './vehicles.js';
import { pick, range } from './random.js';

const TRAFFIC_SPEED = 150;
const PED_SPEED = 55;

/** A traffic car picks a road and a direction and follows it, turning at random. */
function makeTrafficCar(random, city) {
  const p = randomRoadPoint(random);
  const onVertical = ROADS_X.some((x) => Math.abs(p.x - x) < ROAD_WIDTH / 2);
  const angle = onVertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
  const car = makeCar(p.x, p.y, angle, pick(random, PALETTE.trafficCar), 'traffic');
  car.cruise = range(random, 120, 190);
  car.turnAt = range(random, 4, 14);
  return car;
}

function makePedestrian(random) {
  const p = randomSidewalkPoint(random);
  return {
    x: p.x, y: p.y,
    angle: random() * Math.PI * 2,
    speed: range(random, 40, 70),
    color: pick(random, PALETTE.pedestrian),
    walkPhase: random() * Math.PI * 2,
    panic: 0,
    down: 0,
  };
}

export function createTraffic(random, city) {
  const cars = [];
  const peds = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) cars.push(makeTrafficCar(random, city));
  for (let i = 0; i < PEDESTRIAN_COUNT; i += 1) peds.push(makePedestrian(random));

  /** Keep a car on its road: at an intersection it may turn; it slows for traffic ahead. */
  function steerTraffic(car, dt, others) {
    car.turnAt -= dt;
    const nearIntersection = ROADS_X.some((x) => Math.abs(car.x - x) < 46) && ROADS_Y.some((y) => Math.abs(car.y - y) < 46);
    if (nearIntersection && car.turnAt <= 0) {
      car.turnAt = range(random, 5, 16);
      const turn = pick(random, [-Math.PI / 2, 0, Math.PI / 2]);
      car.angle += turn;
    }
    // Slow for the car ahead on the same road.
    let ahead = Infinity;
    for (const other of others) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const across = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along > 0 && along < 130 && across < 34) ahead = Math.min(ahead, along);
    }
    const throttle = ahead < 70 ? 0 : 0.55;
    driveCar(city, car, dt, throttle, 0, false);
    car.speed = Math.min(car.speed, car.cruise);
  }

  function stepPed(ped, dt, danger) {
    if (ped.down > 0) { ped.down -= dt; return; }
    if (danger) ped.panic = 1.2;
    if (ped.panic > 0) {
      ped.panic -= dt;
      // Flee only while there is still a danger to run from; once it is gone
      // (the player got out of the car) the panic just fades.
      if (!danger) return;
      // Run away from the danger point.
      const dx = ped.x - danger.x;
      const dy = ped.y - danger.y;
      const len = Math.hypot(dx, dy) || 1;
      ped.x += (dx / len) * 190 * dt;
      ped.y += (dy / len) * 190 * dt;
      ped.angle = Math.atan2(dy, dx);
      return;
    }
    ped.walkPhase += dt * 6;
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    // Stay on walkable ground: turn around at buildings, water and the world edge.
    if (ped.x < 30 || ped.x > WORLD.width - 30 || ped.y < 30 || ped.y > WORLD.height - 30 || !onRoad(ped.x, ped.y)) {
      // Only turn when the way ahead is blocked or off the sidewalk.
      const aheadX = ped.x + Math.cos(ped.angle) * 30;
      const aheadY = ped.y + Math.sin(ped.angle) * 30;
      let blocked = aheadX < 20 || aheadX > WORLD.width - 20 || aheadY < 20 || aheadY > WORLD.height - 20;
      if (!blocked) {
        for (const b of city.buildings) {
          if (b.park) continue;
          if (aheadX > b.x && aheadX < b.x + b.w && aheadY > b.y && aheadY < b.y + b.h) { blocked = true; break; }
        }
      }
      if (blocked) ped.angle += Math.PI / 2 + (random() - 0.5) * 0.6;
    }
    if (random() < 0.002) ped.angle += (random() - 0.5) * 1.2;
  }

  return {
    cars,
    peds,
    /** Add a fresh traffic car to the streets (replaces one the player stole). */
    spawnOne() {
      cars.push(makeTrafficCar(random, city));
    },
    /** One fixed step for every car and pedestrian. danger is a point to flee from (or null). */
    step(dt, danger, playerCar) {
      const allCars = [...cars];
      if (playerCar) allCars.push(playerCar);
      for (const car of cars) steerTraffic(car, dt, allCars);
      for (let i = 0; i < cars.length; i += 1) {
        for (let j = i + 1; j < cars.length; j += 1) separateCars(cars[i], cars[j]);
      }
      for (const ped of peds) stepPed(ped, dt, danger);
    },
    /** A pedestrian close to the point, or null. */
    pedNear(x, y, radius) {
      for (const ped of peds) {
        if (ped.down > 0) continue;
        if (Math.hypot(ped.x - x, ped.y - y) < radius) return ped;
      }
      return null;
    },
    /** A traffic car close to the point, or null. */
    carNear(x, y, radius) {
      for (const car of cars) {
        if (Math.hypot(car.x - x, car.y - y) < radius) return car;
      }
      return null;
    },
    /** Respawn a car that drove off the map or was wrecked, keeping the streets full. */
    respawnCar(car) {
      const fresh = makeTrafficCar(random, city);
      car.x = fresh.x;
      car.y = fresh.y;
      car.angle = fresh.angle;
      car.speed = 0;
      car.color = fresh.color;
      car.cruise = fresh.cruise;
      car.health = 100;
      car.dead = false;
    },
  };
}
