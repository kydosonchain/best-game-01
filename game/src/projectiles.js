// Projectiles, impact bursts and floating score text.
// One job: things that fly, hit and fade. No DOM here.

import { damageEnemy, slowEnemy } from './enemies.js';

export function makeProjectile(tower, target, stats) {
  const def = tower.def;
  const dx = target.x - tower.x;
  const dy = target.y - tower.y;
  const d = Math.hypot(dx, dy) || 1;
  return {
    x: tower.x,
    y: tower.y,
    vx: (dx / d) * def.projSpeed,
    vy: (dy / d) * def.projSpeed,
    speed: def.projSpeed,
    tower,
    target,
    damage: stats.damage,
    splash: def.splash || 0,
    slow: def.slow || 0,
    slowTime: def.slowTime || 0,
    color: def.color,
    kind: tower.key,
    radius: def.splash ? 7 : 5,
    dead: false,
    life: 1.6, // fizzle if the target is gone too long
  };
}

// Step projectiles. `fx` collects {bursts, floats} side effects; `onKill`
// is called as onKill(enemy) when a hit kills one. Returns kill count.
export function updateProjectiles(list, dt, enemies, fx, onKill, time) {
  let kills = 0;
  for (const p of list) {
    if (p.dead) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.dead = true;
      continue;
    }
    // Home in on the living target; otherwise fly straight.
    if (p.target && !p.target.dead && !p.target.leaked) {
      const dx = p.target.x - p.x;
      const dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      p.vx = (dx / d) * p.speed;
      p.vy = (dy / d) * p.speed;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Hit test: the target first, then anything in the way.
    let hit = null;
    if (p.target && !p.target.dead && !p.target.leaked) {
      if (Math.hypot(p.target.x - p.x, p.target.y - p.y) <= p.target.radius + 6) hit = p.target;
    }
    if (!hit) {
      for (const e of enemies) {
        if (e.dead || e.leaked) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) <= e.radius + 5) {
          hit = e;
          break;
        }
      }
    }
    if (hit) {
      p.dead = true;
      fx.bursts.push({ x: p.x, y: p.y, color: p.color, n: p.splash ? 14 : 7, t: 0, max: 0.35, size: p.splash ? 90 : 46 });
      if (p.splash > 0) {
        for (const e of enemies) {
          if (e.dead || e.leaked) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) <= p.splash + e.radius) {
            if (damageEnemy(e, p.damage)) {
              kills += 1;
              onKill(e, p.tower);
            }
          }
        }
      } else {
        if (p.slow > 0) slowEnemy(hit, p.slow, p.slowTime, time);
        if (damageEnemy(hit, p.damage)) {
          kills += 1;
          onKill(hit, p.tower);
        }
      }
    }
  }
  return kills;
}

// --- Particles and floating text (plain data, drawn by render.js) ------------
export function makeFx() {
  return { bursts: [], floats: [], bubbles: [] };
}

export function spawnBurst(fx, x, y, color, n) {
  fx.bursts.push({ x, y, color, n, t: 0, max: 0.4, size: 60 });
}

export function spawnFloat(fx, x, y, text, color) {
  fx.floats.push({ x, y, text, color: color || '#fef08a', t: 0, max: 0.9 });
}

export function updateFx(fx, dt) {
  for (const b of fx.bursts) b.t += dt;
  fx.bursts = fx.bursts.filter((b) => b.t < b.max);
  for (const f of fx.floats) {
    f.t += dt;
    f.y -= 34 * dt;
  }
  fx.floats = fx.floats.filter((f) => f.t < f.max);
}
