// WebAudio for the embedded CC0 recordings (window.ES_SOUNDS): slurps, plops, bites and gulps, wood/stone/pumpkin crunches, rolling beds,
// bells, booms, choir, owls and crows, and a real contrabass, pizzicato, organ, harp, xylophone and timpani (VSCO 2 CE).
// Nothing is synthesized; the village echo is a generated convolution reverb.
// Every sound (and every loop level change) is logged so tests and the video mix can replay it exactly.
let ctx = null, master = null, dry = null, conv = null, bufs = {}, ready = false, muted = false; const loops = {};
export const log = [];
let clock = () => 0;
export function setClock(f) { clock = f; }
function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
export const INS = {
  org: Object.fromEntries([48, 51, 54, 57, 60, 63, 66, 69, 72, 75].map(m => [m, m])),
  ped: Object.fromEntries([24, 27, 30, 33, 36, 39, 42].map(m => [m, m])),
  pz: { D3: 50, A3: 57, C4: 60, E4: 64, G4: 67, D5: 74 },
  cb: { E1: 28, Fs1: 30, A1: 33, Cs2: 37, E2: 40 },
  hp: { D4: 62, A4: 69 },
  xy: { C5: 72, G5: 79, C6: 84 }
};
const SORTED = Object.fromEntries(Object.entries(INS).map(([k, v]) => [k, Object.entries(v).sort((a, b) => a[1] - b[1])]));
export function sampleFor(ins, m) { const L = SORTED[ins]; let best = L[0]; for (const e of L) if (Math.abs(e[1] - m) < Math.abs(best[1] - m)) best = e; return { n: ins + '_' + best[0], r: Math.pow(2, (m - best[1]) / 12) }; }
function makeIR(sec = 3.6) { const sr = ctx.sampleRate, n = Math.floor(sr * sec), ir = ctx.createBuffer(2, n, sr); let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const t = i / sr; lp += (rnd() - lp) * (.5 - .38 * t / sec); d[i] = lp * Math.exp(-t * 1.9) * (i < sr * .02 ? i / (sr * .02) : 1); } } return ir; }
function kick() { try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {} } // a silent sample inside the gesture unlocks iOS Safari
export function state() { return ctx ? ctx.state : 'none'; }
export function isReady() { return ready; }
export async function unlock() {
  if (ctx) { if (ctx.state !== 'running') { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); kick(); } return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} // iOS 17+: play even with the ring/silent switch on silent
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : .9; if (ctx.state !== 'running') { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } kick();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .2; master.connect(comp); comp.connect(ctx.destination);
  dry = ctx.createGain(); dry.connect(master); conv = ctx.createConvolver(); conv.buffer = makeIR(); const wet = ctx.createGain(); wet.gain.value = .32; conv.connect(wet); wet.connect(master);
  const src = window.ES_SOUNDS || {};
  // base64 → bytes is synchronous: do it a few sounds per tick so the first tap never freezes a frame (beds and loops first)
  const keys = Object.keys(src).sort((a, b) => (b.endsWith('_loop') || b === 'wind' || b === 'heart') - (a.endsWith('_loop') || a === 'wind' || a === 'heart')); const jobs = [];
  for (let i = 0; i < keys.length; i += 4) { for (const k of keys.slice(i, i + 4)) jobs.push(new Promise(res => { try { ctx.decodeAudioData(b64(src[k]), b => { bufs[k] = b; res(); }, () => res()); } catch (e) { res(); } })); await new Promise(r => setTimeout(r, 0)); }
  await Promise.all(jobs);
  ready = true; window.__esAudioReady = Object.keys(bufs).length; for (const k in loops) startLoop(k);
}
export function play(n, vol = 1, rate = 1, delay = 0, rev = .4, dur = 0, pan = 0) {
  if (!Number.isFinite(vol)) vol = 0; if (!Number.isFinite(rate) || rate <= 0) rate = 1; if (!Number.isFinite(delay)) delay = 0; if (!Number.isFinite(rev)) rev = 0; if (!Number.isFinite(dur)) dur = 0; if (!Number.isFinite(pan)) pan = 0;
  delay = Math.max(0, delay); log.push({ n, t: clock() + delay, v: vol, r: rate, rv: rev, d: dur, p: pan });
  if (log.length > 8000) log.splice(0, 1500);
  if (!ready || !bufs[n] || !(vol > 0)) return null;
  const s = ctx.createBufferSource(); s.buffer = bufs[n]; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(g); let out = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
  out.connect(dry); if (rev > 0) { const sg = ctx.createGain(); sg.gain.value = rev; out.connect(sg); sg.connect(conv); }
  const t0 = ctx.currentTime + delay; s.start(t0);
  if (dur > 0) { g.gain.setValueAtTime(vol, t0 + dur); g.gain.exponentialRampToValueAtTime(.0008, t0 + dur + .4); s.stop(t0 + dur + .45); }
  return s;
}
export function note(ins, m, vol = .7, dur = 0, delay = 0, rev = .4, pan = 0) { const { n, r } = sampleFor(ins, m); return play(n, vol, r, delay, rev, dur, pan); }
// looping beds (rain, coil buzz, bubbling, mob): level/rate changes are logged as '~name'
function startLoop(k) { const L = loops[k]; if (!ready || L.src || !bufs[k]) return; L.g = ctx.createGain(); L.g.gain.value = L.v; L.src = ctx.createBufferSource(); L.src.buffer = bufs[k]; L.src.loop = true; L.src.playbackRate.value = L.r; L.src.connect(L.g); L.g.connect(dry); const sg = ctx.createGain(); sg.gain.value = .25; L.g.connect(sg); sg.connect(conv); L.src.start(); }
export function loop(k, v, r = 1, fade = .4) {
  if (!Number.isFinite(v)) v = 0; if (!Number.isFinite(r) || r <= 0) r = 1; if (!Number.isFinite(fade)) fade = .4;
  const L = loops[k] || (loops[k] = { v: 0, r: 1 }); if (Math.abs(L.v - v) < .004 && Math.abs(L.r - r) < .004) return; L.v = v; L.r = r;
  log.push({ n: '~' + k, t: clock(), v, r, f: fade }); startLoop(k);
  if (L.g) { const t = ctx.currentTime; L.g.gain.cancelScheduledValues(t); L.g.gain.setValueAtTime(L.g.gain.value, t); L.g.gain.linearRampToValueAtTime(v, t + fade); L.src.playbackRate.setTargetAtTime(r, t, .15); }
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : .9; }
export function isMuted() { return muted; }
const R = Math.random, rr = a => a[Math.floor(R() * a.length)], jit = (k = .06) => 1 + (R() - .5) * 2 * k;
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const MAT = { stone: 'stone', crypt: 'stone', church: 'stone', skull: 'bone', fence: 'iron', lamp: 'iron', lantern: 'iron', cart: 'wood', barrel: 'wood', house: 'wood', deadtree: 'wood', pine: 'wood', scarecrow: 'straw', hay: 'straw', pumpkinS: 'pump', pumpkinM: 'pump', bigpump: 'pump', apple: 'pump', crow: 'bird' };
export const sfx = {
  ui() { play('plop', .25, 1.1, 0, .15); },
  go() { play('bell_far', .3, 1, 0, .7); play('slime', .28, 1.1, .05, .4); },
  // every gulp: a wet slurp sized to the thing, its material, and a rising note of the gulp chain (a melody you play by rolling)
  gulp(e, pan, kids) { const s = e.o.s, rel = Math.min(1.6, s / Math.max(.05, e.r)), big = s > 1.2; const m = MAT[e.o.type];
    const rate = Math.max(.45, Math.min(1.7, 1.25 - Math.log2(s / .2) * .14)) * jit(.05);
    if (s < .3) play(rr(['plop', 'bubble_pop', 'bite', 'bite_b']), .22 + rel * .2, rate * 1.1, 0, .25, 0, pan);
    else play(rr(['gulp', 'slime', 'slime_b']), Math.min(.6, .2 + s * .12), rate, 0, .35, 0, pan);
    if (m === 'stone') play(s > 3 ? 'stone_crash' : rr(['stone_1', 'stone_2']), Math.min(.55, .2 + s * .1), .9 * jit(), .03, .4, 0, pan);
    else if (m === 'wood') play(s > 3 ? 'topple' : rr(['thud_wood', 'crunch_b']), Math.min(.5, .18 + s * .08), .9 * jit(), .03, .4, 0, pan);
    else if (m === 'pump') play(rr(['crunch', 'splat']), Math.min(.45, .12 + s * .2), 1.1 * jit(), .02, .3, 0, pan);
    else if (m === 'iron') play('clank', .18, 1.1 * jit(), .02, .4, 0, pan); else if (m === 'bone') play('bone_hit', .2, 1.1 * jit(), .02, .4, 0, pan); else if (m === 'straw') play('straw', .25, 1 * jit(), .02, .3, 0, pan);
    else if (m === 'bird') play('crow', .14, 1.1 * jit(), .02, .5, 0, pan);
    if (big) play('boom_bass', Math.min(.5, s * .08), 1, .02, .4);
    const c = Math.min(e.combo - 1, PENTA.length - 1); note('xy', 72 + PENTA[c], .08 + Math.min(.08, c * .01), 0, .03, .5, pan); if (e.combo >= 4 && e.combo % 4 === 0) note('hp', 62 + PENTA[Math.min(c, 8)], .16, 0, .05, .6); },
  bump(e, pan, kids) { const p = Math.min(1, e.power); play(rr(['thump', 'wall_1', 'bounce_1']), .18 + p * .3, .8 * jit(), 0, .3, 0, pan); play('slime_b', .22, .8, .02, .3, 0, pan);
    if (MAT[e.o.type] === 'stone') play('stone_1', .25, .8, 0, .4, 0, pan); else if (MAT[e.o.type] === 'wood') play('thud_wood', .3, .8, 0, .4, 0, pan); else if (MAT[e.o.type] === 'iron') play('clank', .25, .8, 0, .4, 0, pan);
    if (e.lost.length) { play('swish_a', .2, 1.1, .03, .4, 0, pan); e.lost.slice(0, 4).forEach((o, i) => play('plop', .18, 1 + i * .08, .35 + i * .07, .3, 0, pan)); } },
  tier(n) { play('magic', .38, .9 + n * .03, 0, .6); play('swoosh_rise', .3, .9, 0, .5); play('slime', .3, .7, .05, .4); [0, 4, 7, 12].forEach((d, i) => note('hp', 55 + n * 2 + d, .2, 0, .06 + i * .07, .7)); if (n >= 4) play('choir_ah', .22, 1, .1, .7); },
  ready() { play('riser', .22, 1, 0, .5); play('chime_b', .3, 1, .1, .6); },
  // THE BIG GULP
  bigGulp(type) { const ch = type === 'church';
    play('gulp', .9, ch ? .42 : .55, 0, .5); play('slime', .7, .5, .1, .5); play('boom_cine', .85, .85, .05, .5); play('sub', .7, 1, 0, .2); play('rumble', .55, .9, 0, .5);
    play(type === 'bigpump' ? 'crunch' : 'stone_crash', .7, .7, .25, .5); play('crumble', .5, .8, .45, .6); if (ch) { play('bells_peal', .55, .95, .6, .8); play('bell_deep', .6, 1, .4, .8); play('bell_strike', .45, .8, 1.0, .8); }
    play('choir_swell', .45, .9, .4, .8); [26, 33, 38].forEach((m, i) => note('ped', m, .4, 3.4, .5 + i * .02, .8)); [50, 54, 57, 62].forEach((m, i) => note('org', m, .15, 3.2, .55 + i * .03, .8));
    play('fw_burst', .3, .9, 1.6, .6); play('fw_crackle', .25, 1, 1.8, .6); play('gulp', .5, .7, 2.5, .5); },
  burp() { play('slime_b', .5, .55, 0, .5); play('gulp', .4, .5, .1, .5); },
  dawnWarn() { play('bell_far', .35, 1, 0, .7); play('bell_far', .3, 1, .9, .7); play('heart', .3, 1, .2, .2); play('crow', .2, 1, 1.2, .6); },
  spawn() { if (R() < .3) play('plop', .06, 1.3 * jit(), 0, .6); },
  win() { play('success', .4, 1, 0, .5); play('applause', .25, 1, .4, .5, 2.8); play('cheer', .2, 1, .6, .5); play('laugh_kids', .14, 1, .9, .6); },
  star(i) { play('bell_strike', .42, [.9, 1, 1.12][i] || 1, 0, .6); play('harp', .25, [.9, 1, 1.12][i] || 1, .02, .6); },
  fail() { [50, 53, 56].forEach((m, i) => note('org', m, .2, 2, i * .04, .7)); note('ped', 26, .4, 2.4, 0, .7); play('crow', .3, .9, .2, .6); play('wind', .3, .9, 0, .4, 2); play('slime_b', .3, .6, .4, .5); },
  turn() { play('bell_far', .38, 1, 0, .6); play('gate_creak', .2, 1, .3, .6); },
  owl() { play('owl', .1, 1, 0, .6, 0, (R() - .5) * 1.4); }, crow() { play('crow', .09, .95 * jit(), 0, .6, 0, (R() - .5) * 1.2); },
  far() { const n = rr(['howl', 'gate_creak', 'bell_far', 'whisper', 'owl']); play(n, n === 'whisper' ? .06 : .08, 1 * jit(.04), 0, .8, 0, (R() - .5) * 1.4); },
  rewind() { play('glissup', .3, .7, 0, .6); play('swoosh_rise', .35, .6, 0, .6); play('whoosh', .3, .8, .1, .5); },
  title() { play('boom_cine', .9, .9, 0, .5); play('hit_dram', .6, .85, 0, .5); play('gulp', .5, .8, .05, .4); [26, 38].forEach((m, i) => note('ped', m, .5, 3, i * .02, .7)); [50, 57, 62, 66].forEach((m, i) => note('org', m, .2, 3, .03 + i * .02, .7)); play('laugh_kids', .14, 1.1, .6, .7); }
};
