// Ectoswell rules engine – pure and deterministic (no three.js, no DOM): the goo blob, steering, rolling, gulping, growing, bumping,
// knocking things off, the gulp chain, the dawn clock, nights, Endless, the duel, kids rules and a human-like autoplayer.
// It only emits events (this.ev); visuals and sounds react to them.
import { makeLayout, mulberry, TYPES, LANDMARK, STARTS, MAP_R, valueOf } from './layout.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), fin = (v, d = 0) => Number.isFinite(v) ? v : d;
// quaternions [x, y, z, w]
export const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
export const qinv = q => [-q[0], -q[1], -q[2], q[3]];
export const qaxis = (x, y, z, ang) => { const s = Math.sin(ang / 2); return [x * s, y * s, z * s, Math.cos(ang / 2)]; };
export const qrot = (q, v) => { const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), qinv(q)); return [p[0], p[1], p[2]]; };
const qnorm = q => { const l = Math.hypot(...q) || 1; return q.map(x => x / l); };
export const DIFF = {
  kids:   { eatK: 1.18, grow: .42, knock: 0, speed: 1.0, magnet: 1.0, time: [150, 150, 240], noFail: true },
  easy:   { eatK: 1.02, grow: .34, knock: 1, speed: 1.0, magnet: .5, time: [150, 150, 250] },
  medium: { eatK: .94, grow: .29, knock: 3, speed: 1.0, magnet: .25, time: [120, 115, 210] },
  hard:   { eatK: .88, grow: .26, knock: 5, speed: 1.06, magnet: 0, time: [100, 100, 185] }
};
export const NIGHTS = [{ goal: 'bigpump', start: 0, r0: .28 }, { goal: 'crypt', start: 1, r0: .42 }, { goal: 'church', start: 2, r0: .32 }];
export const TIERS = [.5, 1, 2, 3.5, 5.5, 8, 11, 15, 20];
export const GULP_LEN = 3.4;
export class Roll {
  constructor(o = {}) {
    this.mode = o.mode || 'night'; this.night = clamp(o.night | 0, 0, 2); this.dk = o.kids ? 'kids' : (DIFF[o.diff] ? o.diff : 'medium'); this.D = DIFF[this.dk]; this.kids = !!o.kids;
    this.seed = (o.seed ?? 1919) >>> 0; this.rnd = mulberry(this.seed ^ 0x9e37); const N = this.mode === 'endless' ? NIGHTS[2] : NIGHTS[this.night]; this.N = N;
    this.objs = o.objs || makeLayout(this.seed); this.goalObj = this.mode === 'endless' ? null : this.objs.find(x => x.type === N.goal);
    for (const x of this.objs) { x.alive = true; x.stuck = false; x.y = 0; x.x = x.x0; x.z = x.z0; x.dropT = undefined; x.eatT = undefined; x.lp = null; x.keys = []; }
    this.cell = 6; this.grid = new Map(); for (const x of this.objs) this.gridAdd(x);
    const st = STARTS[N.start]; this.b = { x: st[0], z: st[1], vx: 0, vz: 0, r: N.r0, q: [0, 0, 0, 1], spin: 0 };
    this.T = this.mode === 'endless' ? 75 : this.D.time[this.night]; this.left = this.T; this.t = 0; this.state = 'count'; this.countT = 1.2;
    this.score = 0; this.combo = 0; this.bestCombo = 0; this.lastEat = -9; this.gulps = 0; this.bumps = 0; this.lost = 0; this.tier = this.tierOf(this.b.r); this.res = null; this.stars = 0;
    this.stuck = []; this.ev = []; this.stick = [0, 0]; this.bumpCd = 0; this.gulpT = 0; this.gulpObj = null; this.respawn = []; this.wave = 0; this.biggest = null; this.warned = false; this.landmarks = 0;
  }
  tierOf(r) { let k = 0; while (k < TIERS.length && r * 2 >= TIERS[k]) k++; return k; }
  gridKeys(x) { const c = this.cell, r = x.s + 1, K = []; for (let i = Math.floor((x.x - r) / c); i <= Math.floor((x.x + r) / c); i++) for (let j = Math.floor((x.z - r) / c); j <= Math.floor((x.z + r) / c); j++) K.push(i * 4096 + j); return K; }
  gridAdd(x) { x.keys = this.gridKeys(x); for (const k of x.keys) { if (!this.grid.has(k)) this.grid.set(k, new Set()); this.grid.get(k).add(x); } }
  gridDel(x) { for (const k of x.keys || []) { const S = this.grid.get(k); if (S) S.delete(x); } x.keys = []; }
  near(x, z, rad) { const c = this.cell, out = new Set(); for (let i = Math.floor((x - rad) / c); i <= Math.floor((x + rad) / c); i++) for (let j = Math.floor((z - rad) / c); j <= Math.floor((z + rad) / c); j++) { const S = this.grid.get(i * 4096 + j); if (S) for (const o of S) out.add(o); } return out; }
  edible(o) { return o.s <= this.b.r * this.D.eatK; }
  setStick(x, z) { x = fin(x); z = fin(z); const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; } this.stick = [x, z]; }
  maxSpeed() { return this.D.speed * (2.7 + 1.55 * Math.pow(this.b.r, .82)); }
  get diam() { return this.b.r * 2; }
  step(dt) {
    dt = fin(dt); if (!(dt > 0)) return; dt = Math.min(dt, .1); this.t += dt;
    if (this.state === 'end') return;
    if (this.state === 'count') { this.countT -= dt; if (this.countT <= 0) { this.state = 'roll'; this.ev.push({ type: 'go' }); } this.roll(dt * .0, dt); return; }
    if (this.state === 'gulp') { this.gulpT += dt; this.roll(dt, dt, true); if (this.gulpT >= GULP_LEN) { this.state = 'roll'; this.ev.push({ type: 'gulpEnd', o: this.gulpObj });
      if (this.mode !== 'endless') this.finish('win'); } return; }
    this.roll(dt, dt);
    // dawn clock
    if (!(this.D.noFail && this.left <= 0)) this.left -= dt;
    if (this.D.noFail) this.left = Math.max(0, this.left);
    if (!this.warned && this.left < Math.min(20, this.T * .2) && !this.D.noFail) { this.warned = true; this.ev.push({ type: 'dawnWarn' }); }
    if (this.left <= 0 && !this.D.noFail) this.finish(this.mode === 'endless' ? 'over' : 'fail');
    // Endless: eaten things grow back out of sight, bolder waves (more time per gulp is the fuel)
    if (this.mode === 'endless') { for (let i = this.respawn.length - 1; i >= 0; i--) { const [o, at] = this.respawn[i]; if (this.t < at) continue;
        const d = Math.hypot(o.x - this.b.x, o.z - this.b.z); if (d < this.b.r * 7 + 18) { this.respawn[i][1] = this.t + 2; continue; }
        this.respawn.splice(i, 1); this.unstick(o); o.alive = true; o.y = 0; this.gridAdd(o); this.ev.push({ type: 'spawn', o }); } }
  }
  roll(dt, rdt, gulping) {
    const b = this.b; rdt = fin(rdt);
    const ms = this.maxSpeed(), acc = ms * 2.3; const sx = gulping ? 0 : this.stick[0], sz = gulping ? 0 : this.stick[1];
    if (dt > 0) { b.vx += sx * acc * dt; b.vz += sz * acc * dt; }
    const drag = Math.exp(-rdt * ((Math.hypot(sx, sz) > .1 ? .9 : 2.2) + (gulping ? 2.5 : 0))); b.vx *= drag; b.vz *= drag;
    let sp = Math.hypot(b.vx, b.vz); if (sp > ms) { b.vx *= ms / sp; b.vz *= ms / sp; sp = ms; }
    b.x += b.vx * rdt; b.z += b.vz * rdt;
    const dc = Math.hypot(b.x, b.z), lim = MAP_R - b.r * .6; if (dc > lim) { const nx = b.x / dc, nz = b.z / dc; b.x = nx * lim; b.z = nz * lim; const vn = b.vx * nx + b.vz * nz; if (vn > 0) { b.vx -= 1.4 * vn * nx; b.vz -= 1.4 * vn * nz; } }
    if (sp > 1e-4) { const ang = sp * rdt / Math.max(.05, b.r); b.q = qnorm(qmul(qaxis(b.vz / sp, 0, -b.vx / sp, ang), b.q)); }
    b.spin = sp; this.bumpCd = Math.max(0, this.bumpCd - rdt);
    if (!(dt > 0) || gulping) return;
    // contacts
    const reach = b.r * (1 + this.D.magnet * .55);
    for (const o of this.near(b.x, b.z, b.r + 12)) {
      if (!o.alive) continue; const dx = o.x - b.x, dz = o.z - b.z, d = Math.hypot(dx, dz);
      if (this.edible(o)) { if (d < reach * .9 + o.s * .55) this.eat(o); continue; }
      const touch = b.r * .92 + o.s * .78; if (d >= touch || d < 1e-6) continue;
      const nx = dx / d, nz = dz / d; b.x -= nx * (touch - d); b.z -= nz * (touch - d); const vn = b.vx * nx + b.vz * nz;
      if (vn > 0) { b.vx -= 1.45 * vn * nx; b.vz -= 1.45 * vn * nz; }
      if (vn > ms * .3 && this.bumpCd <= 0) { this.bumpCd = .55; this.bumps++; const lost = this.knockOff(vn / ms, nx, nz); this.combo = 0; this.ev.push({ type: 'bump', o, power: vn / ms, lost, nx, nz }); }
    }
  }
  eat(o) {
    const b = this.b; o.alive = false; this.gridDel(o); this.gulps++;
    // stick it where it touched: a point on the blob's surface in the blob's own rolling frame
    let dx = o.x - b.x, dz = o.z - b.z, dy = Math.min(o.h * .5, b.r * 1.2) - b.r; const l = Math.hypot(dx, dy, dz) || 1;
    const depth = b.r * (.86 + this.rnd() * .1); const w = [dx / l * depth, dy / l * depth, dz / l * depth]; const loc = qrot(qinv(b.q), w);
    const tilt = qaxis(this.rnd() - .5, 0, this.rnd() - .5, (this.rnd() - .5) * 1.4); const lq = qmul(qinv(b.q), qmul(tilt, qaxis(0, 1, 0, o.yaw)));
    o.stuck = true; o.lp = loc; o.lq = lq; o.eatT = this.t; o.rAt = b.r; this.stuck.push(o);
    const r0 = b.r; b.r = Math.sqrt(b.r * b.r + this.D.grow * o.s * o.s * (o.type === 'church' ? .6 : 1));
    this.combo = this.t - this.lastEat < .8 ? this.combo + 1 : 1; this.lastEat = this.t; this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = 1 + Math.min(4, Math.floor((this.combo - 1) / 4)); const pts = o.v * mult; this.score += pts;
    if (!this.biggest || o.s > this.biggest.s) this.biggest = o;
    if (this.mode === 'endless') { const add = o.type === 'church' ? 25 : LANDMARK.includes(o.type) ? 6 : .5 * Math.min(1, Math.pow(o.s / (r0 * .55), 1.3)) + .05; this.left = Math.min(this.T, this.left + add); if (!LANDMARK.includes(o.type)) this.respawn.push([o, this.t + 30]); }
    const tier = this.tierOf(b.r), up = tier > this.tier; this.tier = Math.max(this.tier, tier);
    const land = o === this.goalObj || (this.mode === 'endless' && o.type === 'church'); this.ev.push({ type: 'eat', o, combo: this.combo, mult, pts, land, r: b.r });
    if (up) this.ev.push({ type: 'tier', tier, diam: b.r * 2 });
    if (land) { this.landmarks++; this.state = 'gulp'; this.gulpT = 0; this.gulpObj = o; b.vx *= .3; b.vz *= .3; this.ev.push({ type: 'gulp', o }); if (this.mode !== 'endless') this.left = Math.max(0, this.left); }
  }
  unstick(o) { const i = this.stuck.indexOf(o); if (i >= 0) this.stuck.splice(i, 1); o.stuck = false; }
  knockOff(power, nx, nz) {
    const n = Math.round(this.D.knock * clamp(power * 1.6, .5, 1.6)); const out = []; if (!n) return out; const b = this.b;
    for (let i = this.stuck.length - 1; i >= 0 && out.length < n; i--) { const o = this.stuck[i]; if (LANDMARK.includes(o.type) || o.s < b.r * .14 || o.s > b.r * .7 || this.t - o.eatT < .4) continue;
      this.stuck.splice(i, 1); o.stuck = false; const a = Math.atan2(-nz, -nx) + (this.rnd() - .5) * 2.2, d = b.r * 1.3 + o.s + 1 + this.rnd() * 2;
      o.fromX = b.x; o.fromZ = b.z; o.x = clamp(b.x + Math.cos(a) * d, -MAP_R, MAP_R); o.z = clamp(b.z + Math.sin(a) * d, -MAP_R, MAP_R); o.alive = true; o.y = 0; o.dropT = this.t; this.gridAdd(o);
      b.r = Math.max(this.N.r0, Math.sqrt(Math.max(.01, b.r * b.r - this.D.grow * .8 * o.s * o.s))); out.push(o); this.lost++; }
    return out;
  }
  finish(res) { if (this.state === 'end') return; this.state = 'end'; this.res = res; const k = this.left / this.T;
    this.stars = res === 'win' ? (k >= .4 ? 3 : k >= .18 ? 2 : 1) : 0; if (res === 'win') this.score += Math.round(this.left * 40); this.ev.push({ type: 'end', res, stars: this.stars }); }
  quit() { this.finish('quit'); }
  // test/video helpers
  growTo(r) { this.b.r = Math.max(this.b.r, r); this.tier = this.tierOf(this.b.r); }
}
// a human-like autoplayer: it only steers towards things a player can see near the blob, re-thinks every `react` seconds, and its aim wobbles
export function botStep(Q, dt, st, opt = {}) {
  if (Q.state !== 'roll') { Q.setStick(0, 0); return; }
  st.t = (st.t || 0) - dt; st.rnd = st.rnd || mulberry(opt.seed || 77); const b = Q.b, acc = opt.acc ?? .9;
  if (st.t <= 0 || !st.tg || !st.tg.alive) { st.t = opt.react ?? .45;
    let best = null, bs = -1; const view = 16 + b.r * 9;
    for (const o of Q.near(b.x, b.z, view)) { if (!o.alive || !Q.edible(o)) continue; const d = Math.hypot(o.x - b.x, o.z - b.z); if (d > view) continue;
      let sc = Math.pow(o.s / b.r, 1.2) * 3 + .15; if (Q.goalObj === o) sc += 60; sc /= (d + 2 + b.r); if (sc > bs) { bs = sc; best = o; } }
    // nothing edible in view: head for the goal or the busiest zone
    if (Q.goalObj && Q.goalObj.alive && Q.edible(Q.goalObj)) best = Q.goalObj;
    st.tg = best; if (!best) { const g = Q.goalObj && Q.goalObj.alive ? Q.goalObj : null; st.wander = g ? [g.x, g.z] : [(st.rnd() - .5) * 120, (st.rnd() - .5) * 120]; }
    st.noise = (st.rnd() - .5) * 2 * (1 - acc) * 1.4; }
  // unstick: if the blob barely moves for a second, roll off in a fresh direction for a moment
  st.slow = Q.b.spin < Q.maxSpeed() * .12 ? (st.slow || 0) + dt : 0; if (st.slow > 1) { st.slow = 0; st.esc = .9; st.escA = st.rnd() * 6.283; }
  if (st.esc > 0) { st.esc -= dt; Q.setStick(Math.cos(st.escA) * (opt.speed ?? 1), Math.sin(st.escA) * (opt.speed ?? 1)); return; }
  const tx = st.tg ? st.tg.x : st.wander[0], tz = st.tg ? st.tg.z : st.wander[1];
  let dx = tx - b.x, dz = tz - b.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  // steer round things that are too big
  for (const o of Q.near(b.x + dx * b.r * 2, b.z + dz * b.r * 2, b.r * 2.5 + 4)) { if (!o.alive || Q.edible(o) || o === st.tg) continue; const ox = o.x - b.x, oz = o.z - b.z, d = Math.hypot(ox, oz); if (d < 1e-3) continue;
    const ahead = (ox * dx + oz * dz) / d; if (ahead < .2) continue; const clear = d - b.r - o.s; if (clear > b.r * 2.5 + 3) continue;
    const sgn = Math.sign(dx * oz - dz * ox) || 1, w = 1.6 / (1 + Math.max(0, clear)) * ahead, px = dz * sgn, pz = -dx * sgn; dx += px * w; dz += pz * w; }
  const c = Math.cos(st.noise), s = Math.sin(st.noise); const ex = dx * c - dz * s, ez = dx * s + dz * c; const k = Math.hypot(ex, ez) || 1;
  Q.setStick(ex / k * (opt.speed ?? 1), ez / k * (opt.speed ?? 1));
}
export { TYPES, LANDMARK, MAP_R };
