// TIDEWARDEN — balance, layout and definitions.
// One job: every number and shape the rest of the game reads. No DOM here.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const FIELD_W = 880; // playfield is x 0..880; side panel is 880..1280
export const PANEL_X = 880;

// The sea path enemies walk: waypoints across the playfield, ending at the lighthouse.
export const PATH = [
  { x: -40, y: 110 }, { x: 790, y: 110 },
  { x: 790, y: 300 }, { x: 90, y: 300 },
  { x: 90, y: 490 }, { x: 790, y: 490 },
  { x: 790, y: 640 }, { x: 855, y: 640 },
];
export const PATH_W = 46;
export const LIGHTHOUSE = { x: 852, y: 596 };

export const START_PEARLS = 200;
export const START_LIVES = 20;
export const TOTAL_WAVES = 20;
export const SELL_RATE = 0.7;
export const MAX_TOWER_LEVEL = 3;

// --- Towers -----------------------------------------------------------------
// damage: per hit. rate: shots per second. range: px. slow: fraction of speed
// removed while slowTime lasts. splash: damage radius on impact. aura: damage
// bonus given to towers inside auraRange. upgrade: cost factor per level step.
export const TOWERS = {
  coral: {
    key: 'coral', name: 'Coral Spire', hotkey: '1', cost: 50,
    range: 115, damage: 9, rate: 2.0, projSpeed: 430,
    color: '#ff7a59', dark: '#c2410c',
    blurb: 'Cheap, fast shots',
  },
  kelp: {
    key: 'kelp', name: 'Kelp Whip', hotkey: '2', cost: 100,
    range: 125, damage: 15, rate: 1.0, projSpeed: 540,
    slow: 0.35, slowTime: 1.6,
    color: '#7ee081', dark: '#15803d',
    blurb: 'Slows what it hits',
  },
  pearl: {
    key: 'pearl', name: 'Pearl Cannon', hotkey: '3', cost: 150,
    range: 135, damage: 28, rate: 0.65, projSpeed: 350,
    splash: 62,
    color: '#f5f0ff', dark: '#7c6bb3',
    blurb: 'Splash damage',
  },
  sniper: {
    key: 'sniper', name: 'Tide Sniper', hotkey: '4', cost: 200,
    range: 270, damage: 78, rate: 0.45, projSpeed: 950,
    color: '#7dd3fc', dark: '#0369a1',
    blurb: 'Long range, heavy hit',
  },
  beacon: {
    key: 'beacon', name: 'Lumen Beacon', hotkey: '5', cost: 175,
    range: 105, damage: 12, rate: 1.0, projSpeed: 470,
    aura: 0.25, auraRange: 135,
    color: '#fde68a', dark: '#b45309',
    blurb: 'Buffs nearby towers +25%',
  },
};
export const TOWER_ORDER = ['coral', 'kelp', 'pearl', 'sniper', 'beacon'];

export function upgradeCost(def, level) {
  // cost to go from `level` to `level + 1` (level is 1-based current level)
  return Math.round(def.cost * (level === 1 ? 0.8 : 1.2));
}
export function towerDamage(def, level) {
  return Math.round(def.damage * Math.pow(1.45, level - 1));
}
export function towerRange(def, level) {
  return Math.round(def.range * Math.pow(1.08, level - 1));
}

// --- Enemies ----------------------------------------------------------------
export const ENEMIES = {
  minnow: { name: 'Minnow', hp: 32, speed: 74, reward: 4, lives: 1, radius: 11, color: '#8fd3ff', dark: '#0369a1' },
  crab: { name: 'Crab', hp: 100, speed: 45, reward: 7, lives: 1, radius: 15, color: '#fb923c', dark: '#9a3412' },
  jelly: { name: 'Jellyfish', hp: 72, speed: 57, reward: 6, lives: 1, radius: 13, color: '#f0abfc', dark: '#a21caf', regen: 5 },
  eel: { name: 'Eel', hp: 88, speed: 90, reward: 8, lives: 1, radius: 12, color: '#a3e635', dark: '#3f6212' },
  shark: { name: 'Shark', hp: 350, speed: 43, reward: 16, lives: 2, radius: 19, color: '#94a3b8', dark: '#334155' },
  bossCrab: { name: 'Crab King', hp: 1150, speed: 35, reward: 120, lives: 5, radius: 27, color: '#ea580c', dark: '#7c2d12', boss: true },
  bossSerpent: { name: 'Abyss Serpent', hp: 2700, speed: 41, reward: 220, lives: 5, radius: 25, color: '#4ade80', dark: '#14532d', boss: true },
  bossShark: { name: 'Great White', hp: 5400, speed: 39, reward: 320, lives: 5, radius: 31, color: '#cbd5e1', dark: '#475569', boss: true },
  kraken: { name: 'KRAKEN', hp: 11500, speed: 31, reward: 800, lives: 10, radius: 39, color: '#c084fc', dark: '#581c87', boss: true },
};

export function enemyHpAt(type, wave) {
  return Math.round(ENEMIES[type].hp * (1 + 0.24 * (wave - 1)));
}
export function enemyRewardAt(type, wave) {
  return Math.round(ENEMIES[type].reward * (1 + 0.035 * (wave - 1)));
}
export function waveClearBonus(wave) {
  return 15 + wave * 3;
}

// --- Build plots ------------------------------------------------------------
// A grid of candidate plots; keep the ones clear of the path and the lighthouse.
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function computePlots() {
  const plots = [];
  for (let gx = 64; gx <= 836; gx += 96) {
    for (let gy = 56; gy <= 672; gy += 88) {
      let clear = true;
      for (let i = 0; i < PATH.length - 1; i++) {
        if (distToSegment(gx, gy, PATH[i].x, PATH[i].y, PATH[i + 1].x, PATH[i + 1].y) < 54) {
          clear = false;
          break;
        }
      }
      if (clear && Math.hypot(gx - LIGHTHOUSE.x, gy - LIGHTHOUSE.y) < 82) clear = false;
      if (clear) plots.push({ x: gx, y: gy, r: 24 });
    }
  }
  return plots;
}
