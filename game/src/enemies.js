// Enemies: creation and movement along the sea path.
// One job: swim from the path start to the lighthouse. No DOM here.

import { ENEMIES, PATH, enemyHpAt, enemyRewardAt } from './config.js';

export function makeEnemy(type, wave, rng) {
  const def = ENEMIES[type];
  const hp = enemyHpAt(type, wave);
  return {
    type,
    def,
    name: def.name,
    hp,
    maxHp: hp,
    baseSpeed: def.speed,
    speed: def.speed,
    reward: enemyRewardAt(type, wave),
    lives: def.lives,
    radius: def.radius,
    boss: !!def.boss,
    regen: def.regen || 0,
    x: PATH[0].x,
    y: PATH[0].y,
    wp: 1, // next waypoint index
    dist: 0, // distance travelled along the path (targeting order)
    slowUntil: -1,
    slowFactor: 1,
    wobble: rng() * Math.PI * 2,
    dead: false,
    leaked: false,
    flash: 0, // hit flash timer
  };
}

// Move one enemy dt seconds forward. Returns 'leaked' when it reaches the
// lighthouse, 'alive' otherwise. `time` is the game's clock (for slow timers).
export function updateEnemy(e, dt, time) {
  if (e.dead || e.leaked) return 'alive';
  if (e.regen > 0 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.regen * dt);
  if (e.flash > 0) e.flash -= dt;

  let speed = e.baseSpeed;
  if (time < e.slowUntil) speed *= (1 - e.slowFactor);
  let move = speed * dt;

  while (move > 0) {
    const target = PATH[e.wp];
    if (!target) {
      e.leaked = true;
      return 'leaked';
    }
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d <= move) {
      e.x = target.x;
      e.y = target.y;
      e.dist += d;
      move -= d;
      e.wp += 1;
      if (e.wp >= PATH.length) {
        e.leaked = true;
        return 'leaked';
      }
    } else {
      e.x += (dx / d) * move;
      e.y += (dy / d) * move;
      e.dist += move;
      move = 0;
    }
  }
  return 'alive';
}

export function damageEnemy(e, amount) {
  if (e.dead) return false;
  e.hp -= amount;
  e.flash = 0.09;
  if (e.hp <= 0) {
    e.dead = true;
    return true;
  }
  return false;
}

export function slowEnemy(e, factor, duration, time) {
  e.slowFactor = Math.max(e.slowFactor, factor);
  e.slowUntil = Math.max(e.slowUntil, time + duration);
}
