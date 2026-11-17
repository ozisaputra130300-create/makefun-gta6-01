// SOLMAR, the city: its roads, blocks, buildings, districts and landmarks.
// Everything here is pure data built once from a seed — no drawing, no browser.
// The map is a road grid; blocks between roads hold buildings, parks and plazas.
// The south edge is Palm Row beach and the sea; the east edge is Marina Bay water.
import { BEACH_Y, PALETTE, ROADS_X, ROADS_Y, ROAD_WIDTH, WATER_X, WATER_Y, WORLD } from './config.js';
import { intRange, pick, range } from './random.js';

export const DISTRICTS = [
  { name: 'Hillside', x: 0, y: 0, w: 1000, h: 700 },
  { name: 'Downtown', x: 2200, y: 0, w: 1000, h: 700 },
  { name: 'Old Town', x: 0, y: 700, w: 1000, h: 700 },
  { name: 'The Strip', x: 1000, y: 700, w: 1200, h: 700 },
  { name: 'The Docks', x: 0, y: 1400, w: 1000, h: 780 },
  { name: 'Marina Bay', x: 2200, y: 1400, w: 1000, h: 780 },
  { name: 'Palm Row', x: 1000, y: 1900, w: 1200, h: 500 },
];

/** Named places the missions and the HUD point at. */
export const LANDMARKS = {
  club: { name: "The Velvet Room", x: 1600, y: 900, label: "Sal's club" },
  bank: { name: 'Marina Bank', x: 2800, y: 1900, label: 'Marina Bank' },
  safehouse: { name: 'Dex Safehouse', x: 400, y: 400, label: 'Safehouse' },
  hideout: { name: 'Hillside Hideout', x: 700, y: 400, label: 'Hideout' },
  docks: { name: 'Dock 9 Warehouse', x: 400, y: 1900, label: 'Dock 9' },
  hospital: { name: 'Solmar General', x: 1000, y: 400, label: 'Hospital' },
  ammo: { name: "Rook's Ammo", x: 2200, y: 900, label: 'Ammo shop' },
  marina: { name: 'Marina Pier', x: 2800, y: 1400, label: 'Marina Pier' },
  policeStation: { name: 'Solmar PD Central', x: 2200, y: 1400, label: 'Police HQ' },
};

function roadRects() {
  const rects = [];
  for (const x of ROADS_X) rects.push({ x: x - ROAD_WIDTH / 2, y: 0, w: ROAD_WIDTH, h: WORLD.height, vertical: true });
  for (const y of ROADS_Y) rects.push({ x: 0, y: y - ROAD_WIDTH / 2, w: WORLD.width, h: ROAD_WIDTH, vertical: false });
  return rects;
}

function buildBuildings(random) {
  const buildings = [];
  // Blocks are the cells between neighbouring roads (and the world edges).
  const xs = [0, ...ROADS_X.map((x) => x + ROAD_WIDTH / 2), WORLD.width];
  const ys = [0, ...ROADS_Y.map((y) => y + ROAD_WIDTH / 2), WORLD.height];
  for (let ix = 0; ix < xs.length - 1; ix += 1) {
    for (let iy = 0; iy < ys.length - 1; iy += 1) {
      const bx = xs[ix];
      const by = ys[iy];
      const bw = xs[ix + 1] - bx;
      const bh = ys[iy + 1] - by;
      // Beach and marina stay open; the docks block gets warehouses, not houses.
      if (by >= BEACH_Y - 40 || bx >= WATER_X - 40) continue;
      if (bw < 140 || bh < 140) continue;
      // One park per few blocks, otherwise 1-3 buildings.
      if (random() < 0.16) {
        buildings.push({ x: bx + 24, y: by + 24, w: bw - 48, h: bh - 48, park: true, color: PALETTE.park, roof: PALETTE.park });
        continue;
      }
      const count = intRange(random, 1, 3);
      for (let n = 0; n < count; n += 1) {
        const w = range(random, 90, Math.min(220, bw - 40));
        const h = range(random, 70, Math.min(180, bh - 40));
        const x = bx + 20 + random() * Math.max(1, bw - w - 40);
        const y = by + 20 + random() * Math.max(1, bh - h - 40);
        const roof = pick(random, PALETTE.buildingRoof);
        buildings.push({ x, y, w, h, park: false, color: roof, roof, tall: random() < 0.22 });
      }
    }
  }
  return buildings;
}

function buildTrees(random, buildings) {
  const trees = [];
  for (let i = 0; i < 90; i += 1) {
    const x = range(random, 40, WORLD.width - 40);
    const y = range(random, 40, BEACH_Y - 40);
    if (x > WATER_X - 40) continue;
    if (onRoad(x, y)) continue;
    let inside = false;
    for (const b of buildings) {
      if (x > b.x - 8 && x < b.x + b.w + 8 && y > b.y - 8 && y < b.y + b.h + 8) { inside = true; break; }
    }
    if (!inside) trees.push({ x, y, r: range(random, 7, 12) });
  }
  return trees;
}

/** True when the point is on asphalt (a road). */
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_WIDTH / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_WIDTH / 2) return true;
  return false;
}

/** True when the point is in water (the sea or the marina). */
export function inWater(x, y) {
  return y >= WATER_Y || x >= WATER_X;
}

/** The district name for a point, for the HUD. */
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Solmar';
}

/** A random point on a road, for spawning cars and pedestrians. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    const x = pick(random, ROADS_X) + range(random, -36, 36);
    return { x, y: range(random, 60, WORLD.height - 60) };
  }
  const y = pick(random, ROADS_Y) + range(random, -36, 36);
  return { x: range(random, 60, WORLD.width - 60), y };
}

/** A random point on a sidewalk (just off a road), for pedestrians. */
export function randomSidewalkPoint(random) {
  const p = randomRoadPoint(random);
  const off = 78 + random() * 20;
  if (random() < 0.5) p.x += random() < 0.5 ? off : -off;
  else p.y += random() < 0.5 ? off : -off;
  p.x = Math.max(20, Math.min(WORLD.width - 20, p.x));
  p.y = Math.max(20, Math.min(BEACH_Y - 20, p.y));
  return p;
}

export function createCity(random) {
  const roads = roadRects();
  const buildings = buildBuildings(random);
  const trees = buildTrees(random, buildings);
  return { roads, buildings, trees };
}
