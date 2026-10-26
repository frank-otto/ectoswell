// Music, all played on recorded samples (VSCO 2 CE, CC0): an original bouncy "goo polka" in D minor – an oom-pah contrabass pizzicato,
// off-beat violin pizzicato chords, a sneaky xylophone tune, harp runs and timpani – plus a menu nocturne. Intensity I (gulp chain, the
// goal in reach, the dawn close) adds layers; the Big Gulp stops the groove for a choir/organ chord.
import { note, play } from './audio.js';
const CH = { Dm: { b: [38, 45, 41, 43], p: [62, 65, 69, 74], o: [50, 53, 57] }, Bb: { b: [34, 41, 38, 39], p: [58, 62, 65, 70], o: [50, 53, 58] }, Gm: { b: [31, 38, 34, 36], p: [55, 58, 62, 67], o: [50, 55, 58] },
  A: { b: [33, 40, 37, 38], p: [57, 61, 64, 69], o: [49, 52, 57] }, F: { b: [29, 36, 33, 34], p: [57, 60, 65, 69], o: [48, 53, 57] }, C: { b: [36, 43, 40, 41], p: [55, 60, 64, 67], o: [48, 52, 55] }, E7: { b: [28, 35, 32, 33], p: [56, 59, 62, 64], o: [50, 52, 56] } };
const tp = (m, k) => play('tp_4', k, Math.pow(2, (((m - 40) % 12 + 12) % 12 - (((m - 40) % 12 + 12) % 12 > 6 ? 12 : 0)) / 12), 0, .4);
export const GROOVES = {
  menu: { bpm: 72, beats: 6, prog: ['Dm', 'Dm', 'Bb', 'A', 'Gm', 'Dm', 'E7', 'A'], bar(b, c, k) { const E = [];
    E.push([0, () => note('cb', c.b[0], .26 * k, 0, 0, .5)]); E.push([3, () => note('cb', c.b[1], .18 * k, 0, 0, .5)]); E.push([0, () => c.o.forEach(m => note('org', m, .04 * k, 4.8, 0, .8))]);
    [0, 1, 2, 3, 4, 5].forEach((q, i) => E.push([q, () => note('hp', c.p[i % 4] + (i > 3 ? 12 : 0), .05 * k, 0, 0, .65, (i - 2.5) * .15)])); if (b % 2) E.push([4.5, () => note('xy', c.p[3] + 12, .04 * k, 0, 0, .6)]); return E; } },
  // the roll: oom-pah bass, off-beat pizzicato chords, a sneaky xylophone tune; harp, timpani and kick come in with intensity
  roll: { bpm: 112, beats: 4, prog: ['Dm', 'A', 'Dm', 'A', 'Gm', 'Dm', 'E7', 'A'], bar(b, c, k, I) { const E = [];
    [0, 2].forEach((q, i) => E.push([q, () => note('cb', c.b[i ? 1 : 0], .3 * k, 0, 0, .35)])); [1, 3].forEach(q => E.push([q + 0, () => [c.p[0], c.p[1], c.p[2]].forEach((m, j) => note('pz', m, .05 * k, 0, j * .008, .4, (j - 1) * .3))]));
    const tune = [[0, 3], [.5, 2], [1, 1], [1.5, 2], [2.5, 3], [3, 1]]; if (b % 2 === 0) tune.forEach(([q, j]) => E.push([q, () => note('xy', c.p[j] + 12, .055 * k, 0, 0, .45, .2)])); else [[0, 2], [1, 0], [2, 1], [2.5, 2], [3, 3]].forEach(([q, j]) => E.push([q, () => note('xy', c.p[j] + 12, .05 * k, 0, 0, .45, -.2)]));
    if (I > .3) [0, .5, 1, 1.5].forEach((q, i) => E.push([q + 2, () => note('hp', c.p[i % 4] + 12, .035 * k, 0, 0, .55, (i - 1.5) * .2)]));
    if (I > .55) { E.push([0, () => tp(c.b[0], .11 * k)]); E.push([2, () => tp(c.b[1], .08 * k)]); }
    if (I > .8) { E.push([0, () => play('bd', .14 * k, .9, 0, .4)]); E.push([2, () => play('bd', .1 * k, .9, 0, .4)]); }
    if (b % 8 === 0) E.push([0, () => c.o.forEach(m => note('org', m, .022 * k, 3.5, 0, .8))]); if (b % 8 === 7) E.push([2, () => play('cymcresc', .05 * k, 1, 0, .5, 1)]); return E; } }
};
export class Player {
  constructor() { this.g = null; this.on = false; this.vol = 1; this.I = 0; this.tr = 0; }
  start(name, t0, opt = {}) { if (this.on && this.name === name && !opt.force) return; this.g = GROOVES[name]; this.name = name; this.t0 = t0; this.bpm = opt.bpm || this.g.bpm; this.spb = 60 / this.bpm; this.bar = -1; this.q = []; this.on = true; this.tr = opt.tr || 0; this.prog = opt.prog || this.g.prog; this.bar0 = opt.bar0 || 0; }
  stop() { this.on = false; this.q = []; this.name = null; }
  step(t) { if (!this.on || !Number.isFinite(t)) return; const nb = this.g.beats; const b = Math.floor((t - this.t0) / this.spb / nb);
    while (this.bar < b + 1) { this.bar++; if (this.bar < 0) continue; const nm = this.prog[(this.bar + this.bar0) % this.prog.length], c0 = CH[nm], tr = this.tr;
      const c = { b: c0.b.map(m => m + tr), p: c0.p.map(m => m + tr), o: c0.o.map(m => m + tr) };
      for (const [be, f] of this.g.bar(this.bar + this.bar0, c, this.vol, this.I)) this.q.push([this.t0 + (this.bar * nb + be) * this.spb, f]); this.q.sort((a, b2) => a[0] - b2[0]); }
    while (this.q.length && this.q[0][0] <= t) { const [, f] = this.q.shift(); f(); } }
}
