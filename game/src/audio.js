// Synthesized sound effects with WebAudio — no audio files, no network.
// One job: every blip, ding and jingle the game plays. Safe to call before
// any user gesture: the context is created lazily and guarded everywhere.

let ctx = null;
let master = null;
let muted = false;
let unlocked = false; // true only after a real user gesture (click/key)

function ensureCtx() {
  // Never create the context before a gesture: creating it early logs an
  // autoplay warning on every sound call and the context stays suspended.
  if (!unlocked) return null;
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch (_e) {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  unlocked = true;
  const c = ensureCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.35;
}
export function isMuted() {
  return muted;
}

function tone(freq, dur, type, vol, slideTo, delay = 0) {
  if (muted) return;
  const c = ensureCtx();
  if (!c || !master) return;
  try {
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.5, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch (_e) { /* sound is decoration, never fatal */ }
}

function noiseBurst(dur, vol, delay = 0) {
  if (muted) return;
  const c = ensureCtx();
  if (!c || !master) return;
  try {
    const t0 = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = vol || 0.3;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1200;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
  } catch (_e) { /* ignore */ }
}

export const sfx = {
  click() { tone(660, 0.06, 'triangle', 0.25); },
  place() { tone(220, 0.12, 'square', 0.3, 440); tone(880, 0.08, 'sine', 0.2, null, 0.06); },
  shoot(kind) {
    if (kind === 'sniper') tone(1400, 0.09, 'sawtooth', 0.16, 300);
    else if (kind === 'pearl') tone(320, 0.1, 'sine', 0.3, 140);
    else if (kind === 'kelp') tone(520, 0.07, 'triangle', 0.18, 700);
    else if (kind === 'beacon') tone(980, 0.08, 'sine', 0.14, 1200);
    else tone(760, 0.05, 'square', 0.1, 500);
  },
  hit() { noiseBurst(0.05, 0.12); },
  coin() { tone(1320, 0.07, 'sine', 0.22); tone(1760, 0.09, 'sine', 0.18, null, 0.05); },
  leak() { tone(180, 0.35, 'sawtooth', 0.4, 60); noiseBurst(0.2, 0.25); },
  horn() { tone(196, 0.3, 'triangle', 0.3); tone(294, 0.3, 'triangle', 0.3, null, 0.12); },
  upgrade() { tone(523, 0.09, 'triangle', 0.25); tone(659, 0.09, 'triangle', 0.25, null, 0.07); tone(784, 0.14, 'triangle', 0.28, null, 0.14); },
  sell() { tone(784, 0.08, 'sine', 0.2, 392); },
  boss() { tone(110, 0.5, 'sawtooth', 0.35, 55); tone(165, 0.5, 'sawtooth', 0.25, 82, 0.15); },
  victory() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.3, null, i * 0.13));
  },
  defeat() {
    [392, 370, 349, 311].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.22, null, i * 0.18));
  },
};
