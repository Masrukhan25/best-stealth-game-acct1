// THE EMBER LEDGER — every tuning number, colour and level in one place.
// A top-down stealth game: one screen per level, tile grid 32x18, tile 40px.
// Canvas is a fixed 1280x720 logical area; the renderer scales it to the window.
//
// Legend for the ASCII maps (each level is 18 rows of 32 characters):
//   # wall        . floor      , tall grass (hides you)   ~ canal water (slows you, guards see through)
//   C crate       P pillar    T planter     S shelf       (all four block movement and sight)
//   L lamp        E exit hatch (locked until the prize is taken)   * the level prize   o loot
//   X player start
// Guard patrols, cameras and lasers live in the level record beside its map.
export const FIELD = { width: 1280, height: 800, cols: 32, rows: 18, tile: 40, mapHeight: 720 };

/** The simulation's fixed step, in seconds. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  sneakSpeed: 62,
  walkSpeed: 128,
  sprintSpeed: 218,
  // Noise radius in pixels while moving: sneak is silent, walk is a whisper, sprint is loud.
  sneakNoise: 0,
  walkNoise: 64,
  sprintNoise: 175,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 62,
  searchSpeed: 96,
  chaseSpeed: 168,
  viewRange: 252,
  viewNear: 96,
  fov: (70 * Math.PI) / 180,
  // Suspicion 0..100. Rates per second at full visibility; light and gait scale them.
  stareRate: 62,
  investigateAt: 55,
  alertAt: 100,
  decayRate: 22,
  searchSeconds: 7,
  // Tall grass hides you unless a guard is closer than this (pixels).
  grassReveal: 46,
  // Lamp light level a player must be under to count as "lit" (0..1).
  litThreshold: 0.3,
};

export const CAMERA = { range: 196, halfAngle: (22 * Math.PI) / 180, sweep: 0.55 };
export const LASER = { width: 4 };

export const LEVEL_TIME = 240;
export const STRIKES = 3;

export const GADGETS = {
  coin: { name: 'Brass coin', start: 3, range: 260, noise: 240 },
  smoke: { name: 'Smoke pellet', start: 2, radius: 90, seconds: 6 },
  douse: { name: 'Lamp douse', start: 2, range: 130 },
  cricket: { name: 'Clockwork cricket', start: 1, range: 300, chirpNoise: 150 },
};

export const RANKS = [
  { maxSpotted: 0, maxTime: 0, name: 'GHOST' },
  { maxSpotted: 0, maxTime: 1e9, name: 'SHADOW' },
  { maxSpotted: 2, maxTime: 1e9, name: 'CUTPURSE' },
  { maxSpotted: 1e9, maxTime: 1e9, name: 'RUCKUS' },
];

export const PALETTE = {
  backdrop: '#0d0f14',
  floor: '#2a3345',
  floorAlt: '#2e3849',
  wall: '#12161f',
  wallTop: '#2e3748',
  grass: '#2c4a2e',
  grassDark: '#243d26',
  water: '#16324a',
  waterEdge: '#1d4258',
  crate: '#5a4632',
  crateEdge: '#7a6248',
  pillar: '#3a4356',
  pillarEdge: '#4d5a70',
  planter: '#2e5230',
  planterEdge: '#4a7a44',
  shelf: '#4a3826',
  shelfEdge: '#6b5238',
  lampGlow: '#ffd27a',
  lampHot: '#ffe9a8',
  exit: '#39d98a',
  exitDark: '#1d7a4e',
  prize: '#ffd166',
  loot: '#f2c94c',
  player: '#6ff0dd',
  playerDark: '#2b8f82',
  guard: '#c65a3c',
  guardDark: '#8f2f2a',
  conePatrol: 'rgba(255, 210, 122, 0.20)',
  coneSuspicious: 'rgba(255, 214, 64, 0.30)',
  coneSearch: 'rgba(255, 154, 46, 0.34)',
  coneAlert: 'rgba(231, 76, 60, 0.42)',
  camera: '#e8b13c',
  laser: '#ff4d6d',
  text: '#eef1f5',
  muted: '#9aa3b2',
  dim: '#6b7280',
  panel: '#171c26',
  panelEdge: '#2c3444',
  gold: '#ffd166',
  red: '#e74c3c',
};

export const FONT = 'Georgia, "Times New Roman", serif';
export const FONT_UI = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'ember-ledger.save.v1';

// ---------------------------------------------------------------------------
// Levels. Five heists across the canal city of Emberwick. Rook, a quiet thief,
// steals one named prize per house and slips out through the green hatch.
// ---------------------------------------------------------------------------
export const LEVELS = [
  {
    name: 'The Salt Wharf',
    sub: 'Heist I — the tide warehouse',
    prize: 'Brass Tide-Seal',
    prizeValue: 400,
    par: 75,
    guards: [
      { name: 'Bram', route: [[6, 3], [13, 3], [13, 14], [6, 14]], pause: 1.6 },
      { name: 'Fenna', route: [[24, 5], [24, 13], [17, 13], [17, 5]], pause: 1.2 },
    ],
    cameras: [],
    lasers: [],
    map: [
      '################################',
      '#X......,......C......o........#',
      '#..............................#',
      '#..,,....o.....#....C..........#',
      '#..,,..........#...............#',
      '#.......C......#......L........#',
      '#..............................#',
      '#..o......C.........o..........#',
      '#..P...........#...............#',
      '#.............#....C...........#',
      '#..o..........#................#',
      '#......L......#......P.........#',
      '#..............................#',
      '#....C........#....o...........#',
      '#..............................#',
      '#.............#......E.........#',
      '#.............#......*.........#',
      '################################',
    ],
  },
  {
    name: "The Inkbinders' Bindery",
    sub: 'Heist II — the bookbinders’ loft',
    prize: 'Gilded Quill',
    prizeValue: 550,
    par: 90,
    guards: [
      { name: 'Odo', route: [[4, 2], [15, 2], [15, 8], [4, 8]], pause: 1.4 },
      { name: 'Mirel', route: [[20, 3], [27, 3], [27, 12], [20, 12]], pause: 1.8 },
      { name: 'Kasper', route: [[8, 12], [8, 15], [22, 15], [22, 12]], pause: 1.1 },
    ],
    cameras: [],
    lasers: [],
    map: [
      '################################',
      '#X....S.......o........T.......#',
      '#.....S........................#',
      '#..o..S.....,,.....C...........#',
      '#.....S.....,,.................#',
      '#.....S..........L.............#',
      '#...................o..........#',
      '#..C.......S.......o.....P.....#',
      '#.........S....................#',
      '#..T......S....C...............#',
      '#.........S.........L..........#',
      '#..o......S....................#',
      '#..............................#',
      '#.....,,.....S......o..........#',
      '#.....,,.....S.................#',
      '#..........L..S.......E........#',
      '#.............S......*.........#',
      '################################',
    ],
  },
  {
    name: 'The Chimeworks',
    sub: 'Heist III — the bell-founders’ hall',
    prize: "Bellmaster's Cog",
    prizeValue: 700,
    par: 110,
    guards: [
      { name: 'Tobin', route: [[5, 2], [12, 2], [12, 9], [5, 9]], pause: 1.5 },
      { name: 'Ansel', route: [[18, 4], [25, 4], [25, 11], [18, 11]], pause: 1.3 },
      { name: 'Greta', route: [[7, 13], [14, 13], [14, 16], [7, 16]], pause: 1.9 },
      { name: 'Halden', route: [[21, 14], [28, 14], [28, 8], [21, 8]], pause: 1.0 },
    ],
    cameras: [{ x: 16, y: 1, base: Math.PI / 2, arc: 1.1 }],
    lasers: [],
    map: [
      '################################',
      '#X......P......o.......C.......#',
      '#.............P................#',
      '#..,,.....o...P.....,,.........#',
      '#..,,.........P.....,,.........#',
      '#.......C.....P......L.........#',
      '#..............................#',
      '#..o..........P.....o....P.....#',
      '#..............................#',
      '#..T..........P....C...........#',
      '#.............P......L.........#',
      '#..o...........................#',
      '#.......P......................#',
      '#.......P.....o.....C..........#',
      '#.......P......................#',
      '#..L....P..........E...........#',
      '#.......P..........*...........#',
      '################################',
    ],
  },
  {
    name: 'The Ember Exchange',
    sub: 'Heist IV — the coal-merchants’ vault',
    prize: "Coal-Duke's Ruby",
    prizeValue: 900,
    par: 120,
    guards: [
      { name: 'Piotr', route: [[4, 3], [11, 3], [11, 10], [4, 10]], pause: 1.4 },
      { name: 'Sanna', route: [[17, 2], [24, 2], [24, 9], [17, 9]], pause: 1.7 },
      { name: 'Joren', route: [[6, 13], [11, 13], [11, 16], [6, 16]], pause: 1.2 },
      { name: 'Willem', route: [[20, 12], [27, 12], [27, 15], [20, 15]], pause: 1.6 },
    ],
    cameras: [
      { x: 15, y: 1, base: Math.PI / 2, arc: 1.0 },
      { x: 28, y: 8, base: Math.PI, arc: 0.9 },
    ],
    lasers: [{ x1: 15, y1: 6, x2: 15, y2: 11 }],
    map: [
      '################################',
      '#X.....~~......o......C........#',
      '#......~~......................#',
      '#..,,..~~..o......P............#',
      '#..,,..~~.........P............#',
      '#......~~....L....P.....,,.....#',
      '#......~~.........P.....,,.....#',
      '#..o...~~....C...........T.....#',
      '#......~~......................#',
      '#......~~....P......o..........#',
      '#......~~....P......L..........#',
      '#..C...~~....P.................#',
      '#......~~......................#',
      '#.....,,.....P.....o....C......#',
      '#.....,,.....P.................#',
      '#..L...~~....P.....E...........#',
      '#......~~....P.....*...........#',
      '################################',
    ],
  },
  {
    name: 'The Grand Archive',
    sub: 'Heist V — the vault of the Starless Ledger',
    prize: 'The Starless Ledger',
    prizeValue: 1500,
    par: 150,
    guards: [
      { name: 'Marta', route: [[4, 2], [10, 2], [10, 8], [4, 8]], pause: 1.5 },
      { name: 'Eamon', route: [[15, 3], [22, 3], [22, 10], [15, 10]], pause: 1.3 },
      { name: 'Dara', route: [[25, 2], [28, 2], [28, 9], [25, 9]], pause: 1.8 },
      { name: 'Silas', route: [[8, 12], [11, 12], [11, 16], [8, 16]], pause: 1.1 },
      { name: 'Petra', route: [[19, 13], [26, 13], [26, 16], [19, 16]], pause: 1.6 },
    ],
    cameras: [
      { x: 13, y: 1, base: Math.PI / 2, arc: 1.0 },
      { x: 28, y: 9, base: Math.PI, arc: 0.9 },
    ],
    lasers: [
      { x1: 14, y1: 5, x2: 14, y2: 10 },
      { x1: 22, y1: 11, x2: 22, y2: 15 },
    ],
    map: [
      '################################',
      '#X....S.......o......T.........#',
      '#.....S........................#',
      '#..o..S.....,,....C............#',
      '#.....S.....,,.................#',
      '#.....S..........L.....P.......#',
      '#.....S................P.......#',
      '#..C..S.......o........P.......#',
      '#.....S................P.......#',
      '#..T..S....C...........P.......#',
      '#.....S.........L......P.......#',
      '#..o..S........................#',
      '#.....S........................#',
      '#.....,,....S......o....C......#',
      '#.....,,....S..................#',
      '#.........L.S.......E..........#',
      '#...........S......*...........#',
      '################################',
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
export const GUARD_COUNT = LEVELS.reduce((n, level) => n + level.guards.length, 0);
export const TREASURE_COUNT = LEVELS.reduce(
  (n, level) => n + level.map.join('').split('').filter((c) => c === 'o').length + 1,
  0,
);
export const GADGET_COUNT = Object.keys(GADGETS).length;
