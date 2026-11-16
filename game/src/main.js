// TIDEWARDEN — game state, loop, economy and waves.
// One job: own the game object and advance it. Rendering lives in render.js,
// input in input.js, entity rules in enemies.js / towers.js / projectiles.js.

import {
  VIEW_W, VIEW_H, FIELD_W, START_PEARLS, START_LIVES, TOTAL_WAVES,
  TOWERS, TOWER_ORDER, computePlots, waveClearBonus,
} from './config.js';
import { mulberry32 } from './random.js';
import { buildWave, waveLabel } from './levels.js';
import { makeEnemy, updateEnemy } from './enemies.js';
import { makeTower, updateTower, towerStats, upgradeCostFor, sellValue, applyUpgrade } from './towers.js';
import { makeProjectile, updateProjectiles, makeFx, spawnBurst, spawnFloat, updateFx } from './projectiles.js';
import { draw } from './render.js';
import { attachInput } from './input.js';
import { sfx, unlockAudio, setMuted, isMuted } from './audio.js';

const STEP = 1 / 60;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rng = mulberry32(20261116);
    this.plots = computePlots();
    this.reset();
    this.best = 0;
    try {
      this.best = Number(window.localStorage.getItem('tidewarden-best') || 0) || 0;
    } catch (_e) { /* storage unavailable: best stays 0 */ }
    this.muted = isMuted();
    this.time = 0;
    this.leakFlash = 0;
    this.message = '';
    this.messageUntil = 0;
    this.acc = 0;
    this.lastTs = 0;
    this.hover = null;
    this.quiet = false;
  }

  reset() {
    this.state = 'title';
    this.pearls = START_PEARLS;
    this.lives = START_LIVES;
    this.score = 0;
    this.wave = 1;
    this.waveActive = false;
    this.kills = 0;
    this.earned = 0;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.fx = makeFx();
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.selected = null;
    this.speed = 1;
    this.leakFlash = 0;
  }

  // --- Player actions -------------------------------------------------------
  onUserGesture() {
    unlockAudio();
  }

  startGame() {
    if (this.state !== 'title') return;
    this.reset();
    this.state = 'playing';
    this.showMessage('Build towers, then press START WAVE');
    sfx.click();
  }

  restart() {
    this.reset();
    this.state = 'playing';
    this.showMessage('Build towers, then press START WAVE');
    sfx.click();
  }

  selectBuild(key) {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    this.selected = { kind: 'build', key };
    sfx.click();
  }

  selectTower(tower) {
    this.selected = { kind: 'tower', tower };
    sfx.click();
  }

  deselect() {
    this.selected = null;
  }

  placeTowerAt(plot) {
    if (this.state !== 'playing') return;
    if (this.towers.some((t) => t.plot === plot)) return;
    const key = this.selected && this.selected.kind === 'build' ? this.selected.key : null;
    if (!key) return;
    const def = TOWERS[key];
    if (this.pearls < def.cost) {
      this.showMessage(`Not enough pearls — ${def.name} costs ${def.cost}`);
      return;
    }
    this.pearls -= def.cost;
    const tower = makeTower(key, plot);
    this.towers.push(tower);
    this.recomputeBuffs();
    spawnBurst(this.fx, plot.x, plot.y, def.color, 10);
    if (!this.quiet) sfx.place();
  }

  upgradeSelected() {
    const t = this.selected && this.selected.kind === 'tower' ? this.selected.tower : null;
    if (!t) return;
    const cost = upgradeCostFor(t);
    if (cost === null) {
      this.showMessage('Already at max level');
      return;
    }
    if (this.pearls < cost) {
      this.showMessage(`Not enough pearls — upgrade costs ${cost}`);
      return;
    }
    this.pearls -= cost;
    applyUpgrade(t);
    this.recomputeBuffs();
    spawnBurst(this.fx, t.x, t.y, '#fde68a', 12);
    if (!this.quiet) sfx.upgrade();
  }

  sellSelected() {
    const t = this.selected && this.selected.kind === 'tower' ? this.selected.tower : null;
    if (!t) return;
    const value = sellValue(t);
    this.pearls += value;
    this.towers = this.towers.filter((o) => o !== t);
    this.deselect();
    this.recomputeBuffs();
    spawnFloat(this.fx, t.x, t.y - 10, `+${value}`, '#fde68a');
    if (!this.quiet) sfx.sell();
  }

  startWave() {
    if (this.state !== 'playing' || this.waveActive) return;
    if (this.wave > TOTAL_WAVES) return;
    this.spawnQueue = buildWave(this.wave, this.rng);
    this.spawnTimer = 0;
    this.waveActive = true;
    this.showMessage(waveLabel(this.wave), 2);
    if (!this.quiet) sfx.horn();
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
    } else if (this.state === 'paused') {
      this.state = 'playing';
    }
    sfx.click();
  }

  cycleSpeed() {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
    sfx.click();
  }

  toggleMute() {
    setMuted(!isMuted());
    this.muted = isMuted();
  }

  showMessage(text, seconds = 2.5) {
    this.message = text;
    this.messageUntil = this.time + seconds;
  }

  // --- Simulation -----------------------------------------------------------
  recomputeBuffs() {
    const beacons = this.towers.filter((t) => t.key === 'beacon');
    for (const t of this.towers) {
      t.buffed = beacons.some(
        (b) => b !== t && Math.hypot(b.x - t.x, b.y - t.y) <= (TOWERS.beacon.auraRange || 0),
      );
    }
  }

  fireTower(tower, target, stats) {
    const p = makeProjectile(tower, target, stats);
    this.projectiles.push(p);
    if (!this.quiet) sfx.shoot(tower.key);
  }

  onKill(e, tower) {
    this.pearls += e.reward;
    this.earned += e.reward;
    this.score += 10;
    this.kills += 1;
    if (tower) tower.kills += 1;
    spawnBurst(this.fx, e.x, e.y, e.def.color, e.boss ? 22 : 8);
    spawnFloat(this.fx, e.x, e.y - e.radius - 4, `+${e.reward}`, '#fef08a');
    if (!this.quiet) {
      sfx.coin();
      if (e.boss) sfx.boss();
    }
  }

  onLeak(e) {
    this.lives -= e.lives;
    this.leakFlash = 0.6;
    this.showMessage(`${e.name} slipped past! -${e.lives} ${e.lives === 1 ? 'life' : 'lives'}`, 2);
    if (!this.quiet) sfx.leak();
    if (this.lives <= 0) {
      this.lives = 0;
      this.endGame(false);
    }
  }

  endGame(won) {
    this.state = won ? 'victory' : 'defeat';
    this.waveActive = false;
    if (won) this.score += this.lives * 50;
    if (this.score > this.best) {
      this.best = this.score;
      try {
        window.localStorage.setItem('tidewarden-best', String(this.best));
      } catch (_e) { /* ignore */ }
    }
    if (!this.quiet) {
      if (won) sfx.victory();
      else sfx.defeat();
    }
  }

  update(dt) {
    this.time += dt;
    if (this.leakFlash > 0) this.leakFlash -= dt;
    // Ambient bubbles.
    if (this.fx.bubbles.length < 22 && this.rng() < 0.06) {
      this.fx.bubbles.push({ x: this.rng() * FIELD_W, y: VIEW_H + 8, r: 2 + this.rng() * 3.5, v: 14 + this.rng() * 22 });
    }
    for (const b of this.fx.bubbles) {
      b.y -= b.v * dt;
      b.x += Math.sin(this.time * 1.5 + b.r * 7) * 8 * dt;
    }
    this.fx.bubbles = this.fx.bubbles.filter((b) => b.y > -10);
    updateFx(this.fx, dt);

    if (this.state !== 'playing') return;

    // Spawn the wave.
    if (this.waveActive) {
      this.spawnTimer += dt;
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].at <= this.spawnTimer) {
        const s = this.spawnQueue.shift();
        this.enemies.push(makeEnemy(s.type, this.wave, this.rng));
      }
    }

    // Enemies walk.
    for (const e of this.enemies) {
      if (updateEnemy(e, dt, this.time) === 'leaked') this.onLeak(e);
    }
    this.enemies = this.enemies.filter((e) => !e.dead && !e.leaked);

    // Towers shoot.
    this.recomputeBuffs();
    for (const t of this.towers) {
      updateTower(t, dt, this.enemies, (tower, target, stats) => this.fireTower(tower, target, stats));
    }

    // Projectiles fly and hit.
    updateProjectiles(this.projectiles, dt, this.enemies, this.fx, (e, tower) => this.onKill(e, tower), this.time);
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);

    // Wave cleared?
    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      const bonus = waveClearBonus(this.wave);
      this.pearls += bonus;
      this.earned += bonus;
      this.score += this.wave * 100;
      this.showMessage(`Wave ${this.wave} cleared! +${bonus} pearls`, 2.5);
      if (!this.quiet) sfx.coin();
      this.wave += 1;
      if (this.wave > TOTAL_WAVES) this.endGame(true);
    }
  }

  frame(ts) {
    if (!this.lastTs) this.lastTs = ts;
    let raw = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    if (raw > 0.25) raw = 0.25;
    this.acc += raw * this.speed;
    let steps = 0;
    while (this.acc >= STEP && steps < 12) {
      this.update(STEP);
      this.acc -= STEP;
      steps += 1;
    }
    if (steps === 12) this.acc = 0; // drop backlog rather than spiral
    draw(this.ctx, this);
    requestAnimationFrame((t) => this.frame(t));
  }

  start() {
    requestAnimationFrame((t) => this.frame(t));
  }

  // --- Autopilot: a legal scripted player, used by ?shot= setups and by
  // balance testing. Buys by a fixed priority list, upgrades when the list
  // is exhausted, and starts each wave as soon as the last one clears. -----
  autoPlayStep() {
    // Plots ranked by how much path they cover: nearest the three long
    // horizontal runs, preferring the middle of the field.
    if (!this._rankedPlots) {
      this._rankedPlots = [...this.plots].sort((a, b) => {
        const near = (p) => Math.min(Math.abs(p.y - 110), Math.abs(p.y - 300), Math.abs(p.y - 490));
        const score = (p) => -near(p) + (p.x > 200 && p.x < 700 ? 40 : 0);
        return score(b) - score(a);
      });
    }
    const buildOrder = ['coral', 'coral', 'kelp', 'pearl', 'coral', 'sniper', 'beacon', 'kelp', 'pearl', 'coral', 'sniper', 'pearl', 'kelp'];
    // Once the opening order is done, keep filling good plots by cycling,
    // but stop at 18 towers: past that, upgrades beat more towers.
    const cycle = ['pearl', 'sniper', 'coral', 'kelp', 'beacon'];
    const nextKey = this.towers.length < buildOrder.length
      ? buildOrder[this.towers.length]
      : this.towers.length < 18
        ? cycle[(this.towers.length - buildOrder.length) % cycle.length]
        : null;
    if (nextKey) {
      const def = TOWERS[nextKey];
      const plot = this._rankedPlots.find((p) => !this.towers.some((t) => t.plot === p));
      if (plot && this.pearls >= def.cost) {
        this.selected = { kind: 'build', key: nextKey };
        this.placeTowerAt(plot);
        this.selected = null;
        return;
      }
      // Not affordable yet: save for it instead of spending on upgrades.
      // Only upgrade when the next tower is affordable alongside the upgrade.
      const cheapestUp = this.towers
        .map((t) => upgradeCostFor(t))
        .filter((c) => c !== null)
        .sort((a, b) => a - b)[0];
      if (cheapestUp === undefined || this.pearls < def.cost + cheapestUp) return;
    }
    // Otherwise upgrade the lowest-level tower we can afford.
    const upgradable = this.towers.filter((t) => upgradeCostFor(t) !== null).sort((a, b) => a.level - b.level || a.invested - b.invested);
    for (const t of upgradable) {
      const cost = upgradeCostFor(t);
      if (cost !== null && this.pearls >= cost) {
        this.selected = { kind: 'tower', tower: t };
        this.upgradeSelected();
        this.selected = null;
        return;
      }
    }
  }

  // Run the simulation forward `seconds` of game time without rendering.
  fastForward(seconds) {
    const wasQuiet = this.quiet;
    this.quiet = true;
    const wasMuted = isMuted();
    setMuted(true);
    const steps = Math.round(seconds / STEP);
    for (let i = 0; i < steps; i++) this.update(STEP);
    setMuted(wasMuted);
    this.quiet = wasQuiet;
  }

  // Play whole waves with the autopilot until `targetWave` starts, then
  // fast-forward `extraSeconds` into it. Used by ?shot= setups.
  autoPlayUntil(targetWave, extraSeconds) {
    this.reset();
    this.state = 'playing';
    let guard = 0;
    while (this.wave < targetWave && this.state === 'playing' && guard < 400) {
      guard += 1;
      this.autoPlayStep();
      if (!this.waveActive) this.startWave();
      this.fastForward(5);
      // Spend between waves too.
      this.autoPlayStep();
    }
    if (this.state === 'playing') {
      if (!this.waveActive && this.wave <= TOTAL_WAVES) this.startWave();
      this.fastForward(extraSeconds);
    }
  }

  setupShot(shot, seed) {
    this.rng = mulberry32(seed || 7);
    if (shot === 'play') {
      this.autoPlayUntil(6, 12);
    } else if (shot === 'boss') {
      this.autoPlayUntil(10, 28);
    } else if (shot === 'victory') {
      this.autoPlayUntil(21, 0);
    }
    // 'title' (or anything else): leave the title screen as-is.
  }
}

// --- Boot -------------------------------------------------------------------
const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game; // debug handle for play-testing (screenshots, state checks)
attachInput(canvas, game);
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) game.setupShot(shot, Number(params.get('seed') || 7));
game.start();
