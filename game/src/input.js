// Input: mouse and keyboard, translated into game actions.
// One job: turn clicks and keys into calls on the game object. No DOM
// creation here — the canvas and the game are handed in by main.js.

import { FIELD_W } from './config.js';
import { panelLayout } from './render.js';

function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function attachInput(canvas, game) {
  function toGameCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function plotAt(x, y) {
    let best = null;
    let bestD = 34;
    for (const p of game.plots) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  function towerAt(x, y) {
    let best = null;
    let bestD = 30;
    for (const t of game.towers) {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bestD) {
        best = t;
        bestD = d;
      }
    }
    return best;
  }

  canvas.addEventListener('mousemove', (e) => {
    const { x, y } = toGameCoords(e);
    game.hover = { x, y, plot: x < FIELD_W ? plotAt(x, y) : null };
  });

  canvas.addEventListener('mouseleave', () => {
    game.hover = null;
  });

  canvas.addEventListener('click', (e) => {
    const { x, y } = toGameCoords(e);
    game.onUserGesture();
    if (game.state === 'title') {
      game.startGame();
      return;
    }
    if (game.state === 'victory' || game.state === 'defeat') {
      if (x < FIELD_W) game.restart();
      return;
    }
    const L = panelLayout();
    // Panel buttons work in every non-title state.
    for (const card of L.cards) {
      if (inRect(x, y, card)) {
        game.selectBuild(card.key);
        return;
      }
    }
    if (inRect(x, y, L.upgrade)) {
      game.upgradeSelected();
      return;
    }
    if (inRect(x, y, L.sell)) {
      game.sellSelected();
      return;
    }
    if (inRect(x, y, L.startWave)) {
      game.startWave();
      return;
    }
    if (inRect(x, y, L.speed)) {
      game.cycleSpeed();
      return;
    }
    if (inRect(x, y, L.pause)) {
      game.togglePause();
      return;
    }
    if (inRect(x, y, L.mute)) {
      game.toggleMute();
      return;
    }
    if (x >= FIELD_W) return; // clicks elsewhere on the panel do nothing
    if (game.state !== 'playing') return;
    const plot = plotAt(x, y);
    const tower = towerAt(x, y);
    if (game.selected && game.selected.kind === 'build') {
      if (plot) game.placeTowerAt(plot);
      else game.deselect();
      return;
    }
    if (tower) {
      game.selectTower(tower);
      return;
    }
    game.deselect();
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '5') {
      const keys = ['coral', 'kelp', 'pearl', 'sniper', 'beacon'];
      game.onUserGesture();
      game.selectBuild(keys[Number(k) - 1]);
      return;
    }
    if (k === ' ') {
      e.preventDefault();
      game.onUserGesture();
      if (game.state === 'title') game.startGame();
      else if (game.state === 'victory' || game.state === 'defeat') game.restart();
      else game.startWave();
      return;
    }
    if (k === 'p') {
      game.togglePause();
      return;
    }
    if (k === 'f') {
      game.cycleSpeed();
      return;
    }
    if (k === 'm') {
      game.toggleMute();
      return;
    }
    if (k === 'escape') {
      game.deselect();
    }
  });
}
