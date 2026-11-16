// Rendering: everything the player (and the judge) sees.
// One job: draw the game on one canvas. No game logic lives here, only
// drawing — it reads the game object main.js owns.

import { VIEW_W, VIEW_H, FIELD_W, PANEL_X, PATH, PATH_W, LIGHTHOUSE, TOWERS, TOWER_ORDER, TOTAL_WAVES } from './config.js';
import { towerStats, upgradeCostFor, sellValue } from './towers.js';

// Panel geometry, shared with input.js (same rects for drawing and clicks).
export function panelLayout() {
  const cards = TOWER_ORDER.map((key, i) => ({ key, x: 892, y: 122 + i * 72, w: 376, h: 64 }));
  return {
    cards,
    upgrade: { x: 892, y: 572, w: 182, h: 30 },
    sell: { x: 1086, y: 572, w: 182, h: 30 },
    startWave: { x: 892, y: 618, w: 376, h: 48 },
    speed: { x: 892, y: 674, w: 118, h: 30 },
    pause: { x: 1018, y: 674, w: 118, h: 30 },
    mute: { x: 1144, y: 674, w: 124, h: 30 },
    selectedBox: { x: 892, y: 490, w: 376, h: 120 },
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, game) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#0e7490');
  g.addColorStop(0.45, '#0a4a6b');
  g.addColorStop(1, '#082f49');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD_W, VIEW_H);

  // God rays from the surface.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#e0f2fe';
  for (let i = 0; i < 4; i++) {
    const x0 = 120 + i * 220 + Math.sin(game.time * 0.11 + i * 1.7) * 26;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0 + 70, 0);
    ctx.lineTo(x0 + 190, VIEW_H);
    ctx.lineTo(x0 + 40, VIEW_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Sandy patches on the seabed.
  ctx.fillStyle = 'rgba(194, 168, 120, 0.16)';
  for (const [x, y, rx, ry] of [[180, 640, 150, 26], [640, 60, 170, 22], [420, 380, 130, 24], [760, 220, 90, 20]]) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rising bubbles (ambient).
  ctx.fillStyle = 'rgba(224, 242, 254, 0.35)';
  for (const b of game.fx.bubbles) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPath(ctx) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#8a6d3b';
  ctx.lineWidth = PATH_W + 10;
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();
  ctx.strokeStyle = '#c2a878';
  ctx.lineWidth = PATH_W;
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();
  // Dashed centre line, like a current.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 18]);
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLighthouse(ctx, game) {
  const { x, y } = LIGHTHOUSE;
  const leakFlash = game.leakFlash > 0 ? Math.sin(game.time * 30) * 0.5 + 0.5 : 0;
  // Rotating beam.
  ctx.save();
  ctx.translate(x, y - 52);
  ctx.rotate(game.time * 0.7);
  const beam = ctx.createLinearGradient(0, 0, 320, 0);
  beam.addColorStop(0, 'rgba(253, 230, 138, 0.5)');
  beam.addColorStop(1, 'rgba(253, 230, 138, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(320, -42);
  ctx.lineTo(320, 42);
  ctx.lineTo(0, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Striped tower.
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#f8fafc' : '#dc2626';
    ctx.fillRect(-16, -52 + i * 13, 32, 13);
  }
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-20, -56, 40, 8); // gallery
  ctx.fillStyle = leakFlash > 0.4 ? '#ef4444' : '#fde68a';
  ctx.beginPath();
  ctx.arc(0, -62, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(-12, -70);
  ctx.lineTo(12, -70);
  ctx.lineTo(6, -80);
  ctx.lineTo(-6, -80);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPlots(ctx, game) {
  for (const p of game.plots) {
    const taken = game.towers.some((t) => t.plot === p);
    if (taken) continue;
    const hover = game.hover && game.hover.plot === p;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = hover ? 'rgba(253, 230, 138, 0.5)' : 'rgba(8, 47, 73, 0.55)';
    ctx.fill();
    ctx.strokeStyle = hover ? '#fde68a' : 'rgba(224, 242, 254, 0.45)';
    ctx.lineWidth = hover ? 3 : 2;
    ctx.stroke();
    if (hover && game.selected && game.selected.kind === 'build') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r - 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(253, 230, 138, 0.85)';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', p.x, p.y + 1);
    }
  }
}

function drawTowerShape(ctx, t, time) {
  const def = t.def;
  ctx.save();
  ctx.translate(t.x, t.y);
  // Base ring.
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#0c4a6e';
  ctx.fill();
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  if (t.key === 'coral') {
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const tips = [];
    for (const [a, len] of [[-1.9, 20], [-1.2, 26], [-0.5, 22], [0.3, 25], [1.1, 19]]) {
      const tx = Math.sin(a) * len * 0.7;
      const ty = -len;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.quadraticCurveTo(Math.sin(a) * 8, -len * 0.5, tx, ty);
      ctx.stroke();
      tips.push([tx, ty]);
    }
    // Polyps at the branch tips read as coral at a glance.
    ctx.fillStyle = '#fda4af';
    for (const [tx, ty] of tips) {
      ctx.beginPath();
      ctx.arc(tx, ty, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (t.key === 'kelp') {
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const sway = Math.sin(time * 2 + i * 1.3) * 6;
      ctx.beginPath();
      ctx.moveTo(i * 7, 6);
      ctx.quadraticCurveTo(i * 7 + sway * 0.5, -12, i * 7 + sway, -26);
      ctx.stroke();
    }
  } else if (t.key === 'pearl') {
    ctx.rotate(t.angle);
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, -5, 24, 10);
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(26, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (t.key === 'sniper') {
    // A fixed vertical spire with a barrel that tracks the target.
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.moveTo(-8, 10);
    ctx.lineTo(0, -20);
    ctx.lineTo(8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0c4a6e';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(Math.cos(t.angle) * 24, Math.sin(t.angle) * 24);
    ctx.stroke();
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(0, -8, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (t.key === 'beacon') {
    const pulse = 1 + Math.sin(time * 3) * 0.12;
    ctx.fillStyle = 'rgba(253, 230, 138, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 20 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, -4, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.arc(0, -4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, 6);
    ctx.lineTo(6, 6);
    ctx.stroke();
  }
  // Level pips.
  if (t.level > 1) {
    ctx.fillStyle = '#fde68a';
    for (let i = 0; i < t.level; i++) {
      ctx.beginPath();
      ctx.arc(-10 + i * 10, 16, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (t.flash > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(Math.cos(t.angle) * 26, Math.sin(t.angle) * 26, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemy(ctx, e, time) {
  const wob = Math.sin(time * 6 + e.wobble) * 2;
  ctx.save();
  ctx.translate(e.x, e.y + wob * 0.4);
  const flash = e.flash > 0;
  const body = flash ? '#ffffff' : e.def.color;
  const dark = e.def.dark;
  if (e.type === 'minnow') {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-18, -6);
    ctx.lineTo(-18, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(6, -2, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'crab') {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(-14, -8, 5, 0, Math.PI * 2);
    ctx.arc(14, -8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 10, 8);
      ctx.lineTo(s * 16, 16);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-4, -4, 2.5, 0, Math.PI * 2);
    ctx.arc(5, -4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'jelly') {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, 12, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = body;
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 4, 2);
      ctx.quadraticCurveTo(i * 4 + Math.sin(time * 4 + i) * 3, 10, i * 4, 16);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (e.type === 'eel') {
    ctx.strokeStyle = body;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.quadraticCurveTo(0, Math.sin(time * 8 + e.wobble) * 8, 16, 0);
    ctx.stroke();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(14, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'shark' || e.type === 'bossShark') {
    const s = e.boss ? 1.5 : 1;
    ctx.scale(s, s);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2, -8);
    ctx.lineTo(6, -18);
    ctx.lineTo(12, -7);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-28, -8);
    ctx.lineTo(-28, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(12, -2, 2, 0, Math.PI * 2);
    ctx.fill();
    if (e.boss) {
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (e.type === 'bossCrab') {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.moveTo(-12, -22);
    ctx.lineTo(-6, -34);
    ctx.lineTo(0, -22);
    ctx.lineTo(6, -34);
    ctx.lineTo(12, -22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(-22, -12, 7, 0, Math.PI * 2);
    ctx.arc(22, -12, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'bossSerpent') {
    ctx.strokeStyle = body;
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-26, 4);
    ctx.quadraticCurveTo(0, -14 + Math.sin(time * 5) * 6, 26, 0);
    ctx.stroke();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(28, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(31, -3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.type === 'kraken') {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, -6, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = body;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 10, 12);
      ctx.quadraticCurveTo(i * 14 + Math.sin(time * 3 + i) * 8, 26, i * 10, 36);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-9, -10, 4, 0, Math.PI * 2);
    ctx.arc(9, -10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.arc(-9, -10, 2, 0, Math.PI * 2);
    ctx.arc(9, -10, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Slow tint.
  if (e.slowUntil > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // HP bar.
  if (e.hp < e.maxHp) {
    const w = e.boss ? 64 : 30;
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(2, 20, 40, 0.7)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
    ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#ef4444';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * frac, 5);
  }
}

function drawProjectiles(ctx, game) {
  for (const p of game.projectiles) {
    if (p.dead) continue;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFx(ctx, game) {
  for (const b of game.fx.bursts) {
    const f = 1 - b.t / b.max;
    ctx.save();
    ctx.globalAlpha = f * 0.8;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, (1 - f) * b.size * 0.5 + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const fl of game.fx.floats) {
    const f = 1 - fl.t / fl.max;
    ctx.save();
    ctx.globalAlpha = f;
    ctx.fillStyle = fl.color;
    ctx.fillText(fl.text, fl.x, fl.y);
    ctx.restore();
  }
}

function drawBossBar(ctx, game) {
  const boss = game.enemies.find((e) => e.boss && !e.dead && !e.leaked);
  if (!boss) return;
  const w = 560;
  const x = (FIELD_W - w) / 2;
  const y = 10;
  ctx.fillStyle = 'rgba(2, 20, 40, 0.75)';
  roundRect(ctx, x - 6, y - 4, w + 12, 26, 8);
  ctx.fill();
  ctx.fillStyle = '#7f1d1d';
  roundRect(ctx, x, y, w, 18, 6);
  ctx.fill();
  const frac = Math.max(0, boss.hp / boss.maxHp);
  ctx.fillStyle = '#c084fc';
  roundRect(ctx, x, y, w * frac, 18, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${boss.name}  ${Math.ceil(boss.hp)} / ${boss.maxHp}`, x + w / 2, y + 9);
}

function drawMessage(ctx, game) {
  if (!game.message || game.time > game.messageUntil) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, (game.messageUntil - game.time) * 2);
  ctx.font = 'bold 17px sans-serif';
  const w = ctx.measureText(game.message).width + 32;
  const x = (FIELD_W - w) / 2;
  ctx.fillStyle = 'rgba(2, 20, 40, 0.85)';
  roundRect(ctx, x, 40, w, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#fef08a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(game.message, FIELD_W / 2, 55);
  ctx.restore();
}

function drawPanel(ctx, game) {
  const L = panelLayout();
  ctx.fillStyle = '#0b3550';
  ctx.fillRect(PANEL_X, 0, VIEW_W - PANEL_X, VIEW_H);
  ctx.fillStyle = '#155e75';
  ctx.fillRect(PANEL_X, 0, 3, VIEW_H);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#e0f2fe';
  ctx.font = 'bold 21px sans-serif';
  ctx.fillText('TIDEWARDEN', 892, 30);
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`WAVE ${Math.min(game.wave, TOTAL_WAVES)} / ${TOTAL_WAVES}`, 892, 52);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px sans-serif';
  const alive = game.enemies.filter((e) => !e.dead && !e.leaked).length;
  const queued = game.spawnQueue.length;
  ctx.fillText(game.waveActive ? `Enemies left: ${alive + queued}` : 'Press START WAVE', 892, 70);

  // Stat boxes: pearls, lives, score.
  const stats = [
    { label: 'PEARLS', value: `${game.pearls}`, color: '#fde68a' },
    { label: 'LIVES', value: `${game.lives}`, color: game.lives <= 5 ? '#f87171' : '#fca5a5' },
    { label: 'SCORE', value: `${game.score}`, color: '#e0f2fe' },
  ];
  stats.forEach((s, i) => {
    const x = 892 + i * 128;
    ctx.fillStyle = '#0c4a6e';
    roundRect(ctx, x, 78, 120, 34, 7);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(s.label, x + 8, 92);
    ctx.fillStyle = s.color;
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(s.value, x + 8, 108);
  });

  // Tower shop cards.
  for (const card of L.cards) {
    const def = TOWERS[card.key];
    const afford = game.pearls >= def.cost;
    const sel = game.selected && game.selected.kind === 'build' && game.selected.key === card.key;
    ctx.fillStyle = sel ? '#155e75' : '#0c4a6e';
    roundRect(ctx, card.x, card.y, card.w, card.h, 8);
    ctx.fill();
    ctx.strokeStyle = sel ? '#fde68a' : 'rgba(125, 211, 252, 0.35)';
    ctx.lineWidth = sel ? 2.5 : 1.5;
    roundRect(ctx, card.x, card.y, card.w, card.h, 8);
    ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(card.x + 26, card.y + 32, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0c4a6e';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(def.hotkey, card.x + 26, card.y + 37);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(def.name, card.x + 50, card.y + 24);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText(def.blurb, card.x + 50, card.y + 43);
    ctx.fillStyle = afford ? '#fde68a' : '#f87171';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`◉ ${def.cost}`, card.x + card.w - 14, card.y + 26);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText('range ' + def.range, card.x + card.w - 14, card.y + 45);
    ctx.textAlign = 'left';
  }

  // Selected tower panel or help text.
  const box = L.selectedBox;
  const sel = game.selected && game.selected.kind === 'tower' ? game.selected.tower : null;
  ctx.fillStyle = '#0c4a6e';
  roundRect(ctx, box.x, box.y, box.w, box.h, 8);
  ctx.fill();
  if (sel) {
    const { damage, range } = towerStats(sel);
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${sel.name}  ${'★'.repeat(sel.level)}${'☆'.repeat(3 - sel.level)}`, box.x + 12, box.y + 22);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Damage ${damage}   Range ${range}   Kills ${sel.kills}`, box.x + 12, box.y + 44);
    ctx.fillText(`Invested ◉ ${sel.invested}`, box.x + 12, box.y + 64);
    const up = upgradeCostFor(sel);
    drawButton(ctx, L.upgrade, up === null ? 'MAX LEVEL' : `UPGRADE ◉ ${up}`, up !== null && game.pearls >= up);
    drawButton(ctx, L.sell, `SELL ◉ ${sellValue(sel)}`, true);
  } else {
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('HOW TO PLAY', box.x + 12, box.y + 22);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('1–5 pick a tower, then click a glowing plot.', box.x + 12, box.y + 46);
    ctx.fillText('Click a built tower to upgrade or sell it.', box.x + 12, box.y + 66);
    ctx.fillText('Space: start wave · F: speed · P: pause', box.x + 12, box.y + 86);
    ctx.fillText('Stop 20 waves. The Kraken comes last.', box.x + 12, box.y + 106);
  }

  // Start wave button.
  const canStart = game.state === 'playing' && !game.waveActive;
  drawButton(ctx, L.startWave, game.waveActive ? `WAVE ${game.wave} IN PROGRESS…` : game.wave > TOTAL_WAVES ? 'ALL WAVES CLEARED' : `▶  START WAVE ${game.wave}`, canStart, true);
  // Small buttons.
  drawButton(ctx, L.speed, `SPEED ${game.speed}x`, true);
  drawButton(ctx, L.pause, game.state === 'paused' ? '▶ RESUME' : '❚❚ PAUSE', true);
  drawButton(ctx, L.mute, game.muted ? '🔇 MUTED' : '🔊 SOUND', true);
}

function drawButton(ctx, r, label, enabled, big) {
  ctx.fillStyle = enabled ? (big ? '#ca8a04' : '#155e75') : '#164e63';
  roundRect(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.fill();
  ctx.strokeStyle = enabled ? '#fde68a' : 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.stroke();
  ctx.fillStyle = enabled ? '#fffbeb' : '#94a3b8';
  ctx.font = `bold ${big ? 17 : 13}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

function drawRangePreview(ctx, game) {
  if (!game.selected) return;
  if (game.selected.kind === 'build' && game.hover && game.hover.plot) {
    const def = TOWERS[game.selected.key];
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(game.hover.plot.x, game.hover.plot.y, def.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (game.selected.kind === 'tower') {
    const t = game.selected.tower;
    const { range } = towerStats(t);
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = t.def.color;
    ctx.beginPath();
    ctx.arc(t.x, t.y, range, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = t.def.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(t.x, t.y, range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawTitle(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(2, 20, 40, 0.72)';
  ctx.fillRect(0, 0, FIELD_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('TIDEWARDEN', FIELD_W / 2, 190);
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Defend the lighthouse from the deep', FIELD_W / 2, 232);
  ctx.fillStyle = '#e0f2fe';
  ctx.font = '17px sans-serif';
  ctx.fillText('Build coral towers along the shore. Stop 20 waves of sea creatures.', FIELD_W / 2, 292);
  ctx.fillText('The Kraken comes last. If 20 creatures slip past, the light goes out.', FIELD_W / 2, 320);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px sans-serif';
  ctx.fillText('1–5 pick a tower · click a plot to build · click a tower to upgrade', FIELD_W / 2, 372);
  ctx.fillText('SPACE start wave · F speed · P pause · M mute', FIELD_W / 2, 396);
  if (game.best > 0) {
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`BEST SCORE: ${game.best}`, FIELD_W / 2, 436);
  }
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 24px sans-serif';
  const pulse = 0.65 + Math.sin(game.time * 3) * 0.35;
  ctx.globalAlpha = pulse;
  ctx.fillText('— CLICK TO START —', FIELD_W / 2, 510);
  ctx.restore();
}

function drawEndScreen(ctx, game, won) {
  ctx.save();
  ctx.fillStyle = 'rgba(2, 20, 40, 0.78)';
  ctx.fillRect(0, 0, FIELD_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? '#fde68a' : '#f87171';
  ctx.font = 'bold 46px sans-serif';
  ctx.fillText(won ? 'THE LIGHTHOUSE STANDS!' : 'THE LIGHTHOUSE HAS FALLEN', FIELD_W / 2, 200);
  ctx.fillStyle = '#e0f2fe';
  ctx.font = '20px sans-serif';
  ctx.fillText(
    won ? 'Twenty waves broken on the shore. The Kraken is beaten.' : `The deep broke through on wave ${game.wave}.`,
    FIELD_W / 2,
    248,
  );
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText(`SCORE ${game.score}   •   WAVES ${won ? TOTAL_WAVES : game.wave}   •   KILLS ${game.kills}`, FIELD_W / 2, 300);
  ctx.fillText(`PEARLS EARNED ${game.earned}   •   LIVES LEFT ${Math.max(0, game.lives)}`, FIELD_W / 2, 330);
  if (game.best > 0) {
    ctx.fillStyle = '#fde68a';
    ctx.font = '16px sans-serif';
    ctx.fillText(`BEST SCORE: ${game.best}`, FIELD_W / 2, 366);
  }
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 22px sans-serif';
  const pulse = 0.65 + Math.sin(game.time * 3) * 0.35;
  ctx.globalAlpha = pulse;
  ctx.fillText(won ? '— CLICK TO PLAY AGAIN —' : '— CLICK TO TRY AGAIN —', FIELD_W / 2, 440);
  ctx.restore();
}

function drawPaused(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(2, 20, 40, 0.6)';
  ctx.fillRect(0, 0, FIELD_W, VIEW_H);
  ctx.fillStyle = '#e0f2fe';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', FIELD_W / 2, VIEW_H / 2 - 10);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Press P or click RESUME to keep playing', FIELD_W / 2, VIEW_H / 2 + 28);
  ctx.restore();
}

export function draw(ctx, game) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawBackground(ctx, game);
  drawPath(ctx);
  drawLighthouse(ctx, game);
  drawPlots(ctx, game);
  drawRangePreview(ctx, game);
  for (const t of game.towers) drawTowerShape(ctx, t, game.time);
  for (const e of game.enemies) {
    if (!e.dead && !e.leaked) drawEnemy(ctx, e, game.time);
  }
  drawProjectiles(ctx, game);
  drawFx(ctx, game);
  drawBossBar(ctx, game);
  drawMessage(ctx, game);
  drawPanel(ctx, game);
  if (game.state === 'title') drawTitle(ctx, game);
  else if (game.state === 'victory') drawEndScreen(ctx, game, true);
  else if (game.state === 'defeat') drawEndScreen(ctx, game, false);
  else if (game.state === 'paused') drawPaused(ctx);
}
