// Towers: creation, targeting, firing, upgrades and selling.
// One job: what a tower is and what it does each tick. No DOM here.

import { TOWERS, MAX_TOWER_LEVEL, SELL_RATE, towerDamage, towerRange, upgradeCost } from './config.js';

export function makeTower(key, plot) {
  const def = TOWERS[key];
  return {
    key,
    def,
    name: def.name,
    level: 1,
    x: plot.x,
    y: plot.y,
    plot,
    cooldown: 0,
    invested: def.cost,
    kills: 0,
    angle: -Math.PI / 2,
    buffed: false, // a Lumen Beacon stands nearby
    flash: 0, // muzzle flash timer
  };
}

export function towerStats(t) {
  const dmg = towerDamage(t.def, t.level) * (t.buffed ? 1 + (TOWERS.beacon.aura || 0) : 1);
  return { damage: Math.round(dmg), range: towerRange(t.def, t.level) };
}

export function upgradeCostFor(t) {
  if (t.level >= MAX_TOWER_LEVEL) return null;
  return upgradeCost(t.def, t.level);
}

export function sellValue(t) {
  return Math.round(t.invested * SELL_RATE);
}

export function applyUpgrade(t) {
  const cost = upgradeCostFor(t);
  if (cost === null) return false;
  t.invested += cost;
  t.level += 1;
  return true;
}

// Pick the target: the enemy furthest along the path that is in range.
export function acquireTarget(t, range, enemies) {
  let best = null;
  let bestDist = -1;
  for (const e of enemies) {
    if (e.dead || e.leaked) continue;
    const d = Math.hypot(e.x - t.x, e.y - t.y);
    if (d <= range + e.radius && e.dist > bestDist) {
      best = e;
      bestDist = e.dist;
    }
  }
  return best;
}

// Tick one tower. `fire` is called as fire(tower, target, stats) when the
// tower's cooldown is ready and a target is in range.
export function updateTower(t, dt, enemies, fire) {
  if (t.flash > 0) t.flash -= dt;
  t.cooldown -= dt;
  const { damage, range } = towerStats(t);
  const target = acquireTarget(t, range, enemies);
  if (target) {
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    if (t.cooldown <= 0) {
      t.cooldown = 1 / t.def.rate;
      t.flash = 0.08;
      fire(t, target, { damage, range });
    }
  }
}
