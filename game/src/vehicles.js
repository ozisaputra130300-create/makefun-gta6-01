// Cars: their physics and their collisions. A car is a rectangle that accelerates,
// steers with its speed and slides on its tyres; it stops at buildings and bounces
// off other cars. Traffic, police and the player's car are all the same object,
// driven by different brains.
import { CAR, WORLD } from './config.js';
import { inWater } from './city.js';

let nextId = 1;

export function makeCar(x, y, angle, color, kind) {
  return {
    id: nextId,
    x,
    y,
    angle,
    speed: 0,
    color,
    kind, // 'player' | 'traffic' | 'police'
    driver: null, // 'player' when Dex is driving, else null
    health: CAR.health,
    skid: 0,
    flashing: 0,
    siren: false,
    dead: false,
  };
}

/** True when the car's front bumper point is inside a building or water. */
function hitsBuilding(city, x, y) {
  if (x < 10 || y < 10 || x > WORLD.width - 10 || y > WORLD.height - 10) return true;
  if (inWater(x, y)) return true;
  for (const b of city.buildings) {
    if (b.park) continue;
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

/** The car's four corner points, for collision checks. */
function corners(car) {
  const hl = CAR.length / 2;
  const hw = CAR.width / 2;
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  const pts = [
    { x: hl, y: -hw }, { x: hl, y: hw }, { x: -hl, y: -hw }, { x: -hl, y: hw },
  ];
  return pts.map((p) => ({ x: car.x + p.x * cos - p.y * sin, y: car.y + p.x * sin + p.y * cos }));
}

/**
 * Drive one car one fixed step. throttle is -1..1 (reverse..forward), steer is
 * -1..1, handbrake is a boolean. Returns true when it hit something solid.
 */
export function driveCar(city, car, dt, throttle, steer, handbrake) {
  const oldX = car.x;
  const oldY = car.y;
  const oldAngle = car.angle;

  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.handbrake * dt);
    car.angle += steer * CAR.steer * 1.4 * dt * Math.sign(car.speed || 1) * Math.min(1, Math.abs(car.speed) / 120);
    car.skid = Math.min(1, Math.abs(car.speed) / 200);
  } else {
    if (throttle > 0) car.speed += CAR.accel * throttle * dt;
    else if (throttle < 0) {
      if (car.speed > 0) car.speed -= CAR.brake * dt;
      else car.speed += CAR.accel * 0.5 * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
    }
    car.speed = Math.max(-CAR.reverseSpeed, Math.min(CAR.maxSpeed, car.speed));
    const steerAuthority = Math.min(1, Math.abs(car.speed) / 90);
    car.angle += steer * CAR.steer * steerAuthority * dt * Math.sign(car.speed || 1);
    car.skid = 0;
  }

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Buildings and water stop the car: step back and lose speed.
  const pts = corners(car);
  let hit = false;
  for (const p of pts) {
    if (hitsBuilding(city, p.x, p.y)) { hit = true; break; }
  }
  if (hit) {
    car.x = oldX;
    car.y = oldY;
    car.angle = oldAngle;
    car.speed *= -0.25;
    car.health -= 2;
  }
  return hit;
}

/** Push two overlapping cars apart and trade a little speed between them. */
export function separateCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = CAR.length * 0.72;
  if (dist === 0 || dist >= minDist) return false;
  const push = (minDist - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.7;
  b.speed = avg * 0.7;
  return true;
}
