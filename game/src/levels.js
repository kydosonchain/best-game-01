// Wave definitions: what swims in on each of the 20 waves.
// One job: turn a wave number into a spawn list. No DOM here.
//
// A spawn entry is { type, at } — seconds after the wave starts. Bosses
// always come last in their wave so the fight builds to them.

const BOSS_WAVES = { 5: 'bossCrab', 10: 'bossSerpent', 15: 'bossShark', 20: 'kraken' };

function mixFor(wave) {
  // Weighted pool of regular enemies available by this wave.
  const pool = [{ type: 'minnow', w: 10 }];
  if (wave >= 3) pool.push({ type: 'crab', w: 6 });
  if (wave >= 6) pool.push({ type: 'jelly', w: 5 });
  if (wave >= 8) pool.push({ type: 'eel', w: 5 });
  if (wave >= 11) pool.push({ type: 'shark', w: 4 });
  return pool;
}

function pickWeighted(pool, rng) {
  let total = 0;
  for (const p of pool) total += p.w;
  let roll = rng() * total;
  for (const p of pool) {
    roll -= p.w;
    if (roll <= 0) return p.type;
  }
  return pool[0].type;
}

export function buildWave(wave, rng) {
  const count = 8 + wave * 2 + (wave >= 12 ? (wave - 11) * 2 : 0);
  const pool = mixFor(wave);
  const spawns = [];
  let t = 0.5;
  for (let i = 0; i < count; i++) {
    spawns.push({ type: pickWeighted(pool, rng), at: t });
    // Later waves spawn tighter; eels and sharks get a little breathing room.
    t += 0.75 - Math.min(0.35, wave * 0.015) + rng() * 0.25;
  }
  const boss = BOSS_WAVES[wave];
  if (boss) {
    spawns.push({ type: boss, at: t + 1.5 });
    // A couple of escorts swim in with the boss.
    const escorts = wave >= 15 ? ['shark', 'eel', 'eel'] : ['crab', 'minnow', 'minnow'];
    escorts.forEach((type, i) => spawns.push({ type, at: t + 2.2 + i * 0.8 }));
  }
  return spawns;
}

export function waveLabel(wave) {
  if (wave === 20) return 'FINAL WAVE — THE KRAKEN';
  if (BOSS_WAVES[wave]) return `WAVE ${wave} — BOSS`;
  return `WAVE ${wave}`;
}

export function bossOf(wave) {
  return BOSS_WAVES[wave] || null;
}
