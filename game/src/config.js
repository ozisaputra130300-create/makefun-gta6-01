// SOLMAR — tuning numbers, palette and world constants for the open-world crime game.
// One place for every number the systems share, so a tweak lands everywhere at once.

export const WORLD = { width: 3200, height: 2400 };

// The camera shows a 1280x720 logical view; the renderer scales it to the window.
export const VIEW = { width: 1280, height: 720 };

/** Fixed simulation step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Roads are axis-aligned; each entry is a centre line, width is the asphalt width. */
export const ROADS_X = [400, 1000, 1600, 2200, 2800];
export const ROADS_Y = [400, 900, 1400, 1900];
export const ROAD_WIDTH = 120;
export const LANE_OFFSET = 30;

/** The beach strip and the water along the south and east edges. */
export const BEACH_Y = 2180;
export const WATER_Y = 2320;
export const WATER_X = 3040;

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 320,
  health: 100,
  punchRange: 34,
  punchDamage: 25,
  punchCooldown: 0.35,
};

export const CAR = {
  length: 54,
  width: 26,
  maxSpeed: 540,
  reverseSpeed: 180,
  accel: 420,
  brake: 700,
  steer: 2.6,
  grip: 6.5,
  handbrake: 900,
  health: 100,
};

export const POLICE = {
  maxSpeed: 580,
  accel: 480,
  ramDamage: 8,
  bustTime: 1.5,
  sightRange: 700,
  decayDelay: 8,
  decayStep: 8,
};

export const TRAFFIC_COUNT = 14;
export const PEDESTRIAN_COUNT = 26;
export const PICKUP_COUNT = 10;

export const WANTED_MAX = 5;

export const PALETTE = {
  // Sun-soaked coastal city: warm asphalt, pale sidewalks, terracotta roofs.
  grass: '#7fae62',
  sand: '#e8d39a',
  water: '#2f7fb8',
  waterDeep: '#1f5f8f',
  asphalt: '#3d3a38',
  asphaltEdge: '#2e2b2a',
  laneDash: '#e8d44d',
  sidewalk: '#b8b0a0',
  block: '#8a7f6a',
  buildingRoof: ['#c96f4a', '#b85c38', '#d9a05b', '#7d8ba0', '#a06b7a', '#5f8a6b'],
  buildingEdge: '#4a4038',
  park: '#5da24a',
  parkTree: '#2f7a33',
  player: '#2f9e44',
  playerCar: '#e63946',
  policeCar: '#1d4ed8',
  policeLightRed: '#ff2d2d',
  policeLightBlue: '#2d7dff',
  trafficCar: ['#f4f4f5', '#c0c0c8', '#3a3a3a', '#e8b64c', '#4a7fb8', '#8a4a6b', '#5b8a4a'],
  pedestrian: ['#e8e8e8', '#d97b6b', '#6b8ad9', '#d9c06b', '#8a6bd9', '#6bd9a0'],
  hudPanel: 'rgba(12, 16, 24, 0.72)',
  hudText: '#f2f4f7',
  hudGold: '#ffd34d',
  hudRed: '#ff5a5a',
  hudGreen: '#5ad97a',
  marker: '#ffd34d',
  markerPulse: 'rgba(255, 211, 77, 0.35)',
  missionText: '#ffd34d',
  nightTint: 'rgba(20, 30, 80, 0.28)',
  duskTint: 'rgba(255, 120, 40, 0.16)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar.save.v1';

/** The player's starting cash. */
export const START_CASH = 250;
