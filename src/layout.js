// The village map: a deterministic layout (same seed → same map, so a duel is fair). Pure data, no three.js.
// Every prop has a type, a position, a yaw, a scale and a footprint radius s (≈ its size). The blob can gulp anything with s < r·K.
export function mulberry(a) { return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// type table: base footprint s (m), height h, how many points it is worth is derived from s
export const TYPES = {
  candy:    { s: .15, h: .14 }, corn: { s: .13, h: .16 }, apple: { s: .17, h: .2 }, mushroom: { s: .2, h: .25 }, skull: { s: .22, h: .24 },
  candle:   { s: .17, h: .34 }, pumpkinS: { s: .34, h: .5 }, crow: { s: .32, h: .45 }, lantern: { s: .4, h: .7 }, pumpkinM: { s: .62, h: .8 },
  barrel:   { s: .6, h: 1.1 }, hay: { s: .85, h: 1.0 }, stone: { s: .7, h: 1.3 }, fence: { s: 1.1, h: 1.1 }, scarecrow: { s: 1.0, h: 2.4 },
  lamp:     { s: .8, h: 3.4 }, cart: { s: 1.7, h: 1.8 }, deadtree: { s: 2.3, h: 6.5 }, pine: { s: 2.6, h: 8.5 }, house: { s: 4.4, h: 8.5 },
  bigpump: { s: 2.3, h: 3.2 }, crypt: { s: 3.5, h: 5.2 }, church: { s: 10.5, h: 36 }
};
export const LANDMARK = ['bigpump', 'crypt', 'church'];
export const ZONES = { patch: [-26, 76, 27], grave: [52, -8, 24], village: [0, 8, 44], forest: [-74, -12, 30], field: [52, 70, 28] };
export const CHURCH = [0, -38], BIGPUMP = [-30, 64], CRYPT = [58, -16];
export const MAP_R = 124;
export const STARTS = [[-16, 104], [44, 6], [0, 110]];
export const valueOf = s => Math.round(10 * Math.pow(s / .15, 1.55));
export function makeLayout(seed = 1919) {
  const R = mulberry(seed >>> 0), O = [];
  const cell = 3, G = new Map(); const key = (i, j) => i * 4096 + j;
  const free = (x, z, s) => { const r = Math.ceil((s + 2.6) / cell), ci = Math.floor(x / cell), cj = Math.floor(z / cell);
    for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) { const L = G.get(key(i, j)); if (!L) continue; for (const o of L) { const d = Math.hypot(o.x - x, o.z - z); if (d < (o.s + s) * .92 + .05) return false; } } return true; };
  const put = (type, x, z, sc = 1, yaw = R() * Math.PI * 2, force = false, extra) => {
    const T = TYPES[type]; const s = T.s * sc; if (Math.hypot(x, z) > MAP_R - s - 2) return null;
    if (!force && !free(x, z, s)) return null;
    // keep the church yard, the road to it and the landmark plots clear of clutter
    if (!force && type !== 'church' && (Math.hypot(x - CHURCH[0], z - CHURCH[1]) < 14 + s || Math.hypot(x - BIGPUMP[0], z - BIGPUMP[1]) < 3.4 + s || Math.hypot(x - CRYPT[0], z - CRYPT[1]) < 5 + s)) return null;
    const o = Object.assign({ id: O.length, type, x, z, x0: x, z0: z, s, h: T.h * sc, sc, yaw, v: valueOf(s), tint: R() }, extra || {}); O.push(o);
    const ci = Math.floor(x / cell), cj = Math.floor(z / cell); const k = key(ci, cj); if (!G.has(k)) G.set(k, []); G.get(k).push(o); return o; };
  const scatter = (type, n, cx, cz, rad, sc0 = .85, sc1 = 1.15, tries = 30) => { let k = 0; for (let i = 0; i < n * tries && k < n; i++) { const a = R() * Math.PI * 2, d = Math.sqrt(R()) * rad; if (put(type, cx + Math.cos(a) * d, cz + Math.sin(a) * d, sc0 + R() * (sc1 - sc0))) k++; } return k; };
  // --- landmarks
  put('church', CHURCH[0], CHURCH[1], 1, 0, true); put('bigpump', BIGPUMP[0], BIGPUMP[1], 1, .4, true); put('crypt', CRYPT[0], CRYPT[1], 1, -.5, true);
  // --- village: houses round the square and along the road south, lamps, carts, barrels, fences, pumpkins on doorsteps
  const H = [[-17, -14, .3], [17, -14, -.3], [-24, 2, 1.57], [24, 2, -1.57], [-21, 18, 1.4], [21, 18, -1.4], [-15, 34, 1.57], [15, 34, -1.57], [-16, 50, 1.57], [16, 50, -1.57], [-34, -24, .7], [34, -26, -.7], [-38, 12, 1.3], [38, 14, -1.3]];
  H.forEach(([x, z, y], i) => { const o = put('house', x, z, .9 + R() * .25, y + Math.PI, true); if (o) { o.var = i % 4; put('pumpkinM', x + Math.sin(y + Math.PI) * -6 + (R() - .5) * 2, z + Math.cos(y + Math.PI) * -6, .9); } });
  for (let z = -6; z <= 58; z += 10) { put('lamp', -6.5, z, 1, 0); put('lamp', 6.5, z + 5, 1, 0); }
  [[-9, -8], [10, 10], [-11, 26], [10, 42]].forEach(([x, z]) => put('cart', x, z, .95 + R() * .2));
  scatter('barrel', 26, 0, 10, 40); scatter('lantern', 18, 0, 16, 36); scatter('pumpkinS', 40, 0, 10, 40); scatter('candy', 90, 0, 18, 42, .9, 1.2); scatter('corn', 40, 0, 18, 42);
  scatter('pine', 14, 0, 0, 44, .7, 1.0); scatter('scarecrow', 3, 0, 20, 40);
  // --- pumpkin patch (Night I): a sea of pumpkins round the GIANT PUMPKIN, hay bales, scarecrows, candy dropped everywhere
  scatter('candy', 150, ZONES.patch[0], ZONES.patch[1], 30, .9, 1.25); scatter('corn', 60, ZONES.patch[0], ZONES.patch[1], 30); scatter('apple', 30, ZONES.patch[0], ZONES.patch[1], 28);
  scatter('pumpkinS', 90, ZONES.patch[0], ZONES.patch[1], 27, .8, 1.2); scatter('pumpkinM', 34, ZONES.patch[0], ZONES.patch[1], 26, .8, 1.25); scatter('candle', 20, ZONES.patch[0], ZONES.patch[1], 24);
  scatter('hay', 12, ZONES.patch[0], ZONES.patch[1], 28); scatter('scarecrow', 5, ZONES.patch[0], ZONES.patch[1], 26); scatter('crow', 10, ZONES.patch[0], ZONES.patch[1], 28);
  // --- graveyard (Night II): gravestones in rows, skulls, candles, lanterns, crows, dead trees, iron fence ring round THE CRYPT
  for (let row = 0; row < 7; row++) for (let c = 0; c < 9; c++) { const x = ZONES.grave[0] - 18 + c * 4.4 + (R() - .5) * 1.2, z = ZONES.grave[1] - 14 + row * 4.4 + (R() - .5) * 1.2; if (R() < .82) put('stone', x, z, .8 + R() * .45, (R() - .5) * .5); }
  scatter('skull', 44, ZONES.grave[0], ZONES.grave[1], 25); scatter('candle', 36, ZONES.grave[0], ZONES.grave[1], 24); scatter('lantern', 10, ZONES.grave[0], ZONES.grave[1], 24);
  scatter('crow', 16, ZONES.grave[0], ZONES.grave[1], 25); scatter('deadtree', 7, ZONES.grave[0], ZONES.grave[1], 26, .8, 1.2); scatter('candy', 50, ZONES.grave[0], ZONES.grave[1], 26); scatter('mushroom', 30, ZONES.grave[0], ZONES.grave[1], 26);
  for (let a = 0; a < Math.PI * 2; a += .085) { const x = ZONES.grave[0] + Math.cos(a) * 27, z = ZONES.grave[1] + Math.sin(a) * 27; if (Math.abs(a - 3.3) > .3) put('fence', x, z, 1, -a); }
  // --- forest (west): pines and dead trees, mushrooms and apples underneath
  scatter('pine', 46, ZONES.forest[0], ZONES.forest[1], 34, .8, 1.35); scatter('deadtree', 10, ZONES.forest[0], ZONES.forest[1], 34); scatter('mushroom', 70, ZONES.forest[0], ZONES.forest[1], 34, .8, 1.4); scatter('apple', 20, ZONES.forest[0], ZONES.forest[1], 30); scatter('crow', 8, ZONES.forest[0], ZONES.forest[1], 30);
  // --- harvest field (south-east): hay, carts, scarecrows, apples, pumpkins
  scatter('hay', 18, ZONES.field[0], ZONES.field[1], 28); scatter('cart', 4, ZONES.field[0], ZONES.field[1], 24); scatter('scarecrow', 6, ZONES.field[0], ZONES.field[1], 28); scatter('apple', 60, ZONES.field[0], ZONES.field[1], 28);
  scatter('pumpkinS', 40, ZONES.field[0], ZONES.field[1], 28); scatter('pumpkinM', 16, ZONES.field[0], ZONES.field[1], 28); scatter('candy', 50, ZONES.field[0], ZONES.field[1], 28); scatter('barrel', 8, ZONES.field[0], ZONES.field[1], 26);
  // --- everywhere: a trail of candy, lone pumpkins, outer trees ring
  scatter('candy', 120, 0, 30, 110); scatter('pumpkinS', 40, 0, 20, 110); scatter('mushroom', 30, 0, 0, 115); scatter('stone', 10, 0, 0, 110);
  for (let a = 0; a < Math.PI * 2; a += .13) { const d = MAP_R - 9 - R() * 8; put(R() < .7 ? 'pine' : 'deadtree', Math.cos(a) * d, Math.sin(a) * d, .9 + R() * .5); }
  // start trails: candies leading from each start
  STARTS.forEach(([sx, sz]) => { for (let i = 0; i < 22; i++) { const a = R() * 6.28, d = 1 + R() * 7; put(R() < .7 ? 'candy' : 'corn', sx + Math.cos(a) * d, sz + Math.sin(a) * d, .9 + R() * .3); } });
  return O;
}
