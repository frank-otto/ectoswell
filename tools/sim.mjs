// Balance check: a human-like bot (good: acc .9 / react .35 s, weak: acc .6 / react .8 s, slow fingers) plays every night × difficulty.
import { Roll, botStep } from '../src/rules.js';
const run = (night, diff, kids, prof, mode = 'night', maxT = 400) => { const Q = new Roll({ night, diff, kids, mode }); const st = {}; let t = 0;
  while (Q.state !== 'end' && t < maxT) { botStep(Q, 1 / 30, st, prof); Q.step(1 / 30); Q.ev.length = 0; t += 1 / 30; }
  return { res: Q.res || Q.state, t: +Q.t.toFixed(0), left: +Q.left.toFixed(0), d: +(Q.b.r * 2).toFixed(2), stars: Q.stars, score: Q.score, gulps: Q.gulps, bumps: Q.bumps, lost: Q.lost, combo: Q.bestCombo }; };
const P = { good: { acc: .9, react: .35 }, weak: { acc: .5, react: 1.0, speed: .75 } };
for (const night of [0, 1, 2]) for (const dk of ['kids', 'easy', 'medium', 'hard']) for (const pk of ['good', 'weak']) { const r = run(night, dk === 'kids' ? 'medium' : dk, dk === 'kids', P[pk]); console.log(['I', 'II', 'III'][night], dk.padEnd(6), pk.padEnd(4), JSON.stringify(r)); }
for (const pk of ['good', 'weak']) console.log('endless medium', pk, JSON.stringify(run(2, 'medium', false, P[pk], 'endless', 900)));
