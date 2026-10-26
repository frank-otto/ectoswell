// Procedural canvas textures (no image files): the painted village ground (grass, roads, cobbled square, pumpkin-patch rows, graveyard moss,
// stubble field, forest floor), a detail noise, soft sprites, smoke and a shockwave ring.
import * as THREE from 'three';
import { ZONES, CHURCH, MAP_R } from './layout.js';
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
let seed = 19; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
export function tex(c, { srgb = true, rep = true, mip = true } = {}) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (!mip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; } return t; }
function blotch(k, x0, y0, w, h, n, hue, sat, l0, l1, a, r0, r1) { for (let i = 0; i < n; i++) { const x = x0 + R() * w, y = y0 + R() * h, rr = r0 + R() * (r1 - r0), l = l0 + R() * (l1 - l0); const g = k.createRadialGradient(x, y, 0, x, y, rr);
  g.addColorStop(0, `hsla(${hue + (R() - .5) * 24},${sat}%,${l}%,${a})`); g.addColorStop(1, `hsla(${hue},${sat}%,${l}%,0)`); k.fillStyle = g; k.fillRect(x - rr, y - rr, rr * 2, rr * 2); } }
export const GROUND_EXT = 200;
export function groundTex(S = 2048) {
  const [c, k] = cv(S, S); const E = GROUND_EXT, px = S / (2 * E); const X = x => (x + E) * px, Y = z => (z + E) * px;
  k.fillStyle = '#26382a'; k.fillRect(0, 0, S, S); blotch(k, 0, 0, S, S, 900, 120, 22, 12, 26, .35, 20, 120);
  const zone = (z, fn) => { const [x, y, r] = z; k.save(); k.beginPath(); k.ellipse(X(x), Y(y), r * px * 1.08, r * px * 1.08, 0, 0, 7); k.clip(); fn(X(x), Y(y), r * px); k.restore(); };
  const soft = (x, y, r, col) => { const g = k.createRadialGradient(x, y, r * .6, x, y, r * 1.1); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); k.fillStyle = g; k.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4); };
  // pumpkin patch: dark soil with furrows
  soft(X(ZONES.patch[0]), Y(ZONES.patch[1]), ZONES.patch[2] * px, 'rgba(58,38,22,.95)'); zone(ZONES.patch, (x, y, r) => { k.strokeStyle = 'rgba(30,18,10,.55)'; k.lineWidth = 2.6 * px; for (let i = -r; i < r; i += 2.2 * px) { k.beginPath(); k.moveTo(x - r, y + i); k.lineTo(x + r, y + i + r * .15); k.stroke(); } blotch(k, x - r, y - r, 2 * r, 2 * r, 120, 30, 40, 14, 26, .3, 4, 30); });
  // harvest field: golden stubble rows
  soft(X(ZONES.field[0]), Y(ZONES.field[1]), ZONES.field[2] * px, 'rgba(120,100,48,.9)'); zone(ZONES.field, (x, y, r) => { k.strokeStyle = 'rgba(70,56,24,.5)'; k.lineWidth = 1.2 * px; for (let i = -r; i < r; i += 1.6 * px) { k.beginPath(); k.moveTo(x + i, y - r); k.lineTo(x + i - r * .1, y + r); k.stroke(); } });
  // graveyard moss + forest floor
  soft(X(ZONES.grave[0]), Y(ZONES.grave[1]), ZONES.grave[2] * 1.12 * px, 'rgba(30,44,30,.95)'); zone(ZONES.grave, (x, y, r) => blotch(k, x - r, y - r, 2 * r, 2 * r, 200, 100, 18, 8, 22, .45, 4, 24));
  soft(X(ZONES.forest[0]), Y(ZONES.forest[1]), ZONES.forest[2] * 1.1 * px, 'rgba(26,30,20,.95)'); zone(ZONES.forest, (x, y, r) => blotch(k, x - r, y - r, 2 * r, 2 * r, 200, 30, 30, 8, 18, .4, 4, 22));
  // roads (gravel) + cobbled square + churchyard
  const road = (pts, w) => { k.lineCap = 'round'; k.lineJoin = 'round'; k.strokeStyle = 'rgba(92,80,66,.95)'; k.lineWidth = w * px; k.beginPath(); pts.forEach(([x, z], i) => i ? k.lineTo(X(x), Y(z)) : k.moveTo(X(x), Y(z))); k.stroke();
    k.strokeStyle = 'rgba(120,108,90,.55)'; k.lineWidth = w * px * .55; k.stroke(); };
  road([[0, 126], [0, 60], [0, 0], [0, CHURCH[1] + 12]], 7.5); road([[0, 0], [24, -4], [44, -6], [52, -8]], 5); road([[0, 40], [30, 58], [52, 70]], 4.5); road([[0, 70], [-14, 74], [-26, 76]], 4); road([[0, 0], [-30, -6], [-60, -12]], 4);
  k.fillStyle = 'rgba(98,92,86,.98)'; k.beginPath(); k.arc(X(0), Y(0), 14 * px, 0, 7); k.fill(); k.strokeStyle = 'rgba(40,36,34,.5)'; k.lineWidth = .5 * px;
  for (let r = 2; r < 14; r += 1.2) { k.beginPath(); k.arc(X(0), Y(0), r * px, 0, 7); k.stroke(); } for (let a = 0; a < 6.28; a += .09) { k.beginPath(); k.moveTo(X(Math.cos(a) * 2), Y(Math.sin(a) * 2)); k.lineTo(X(Math.cos(a) * 14), Y(Math.sin(a) * 14)); k.stroke(); }
  k.fillStyle = 'rgba(84,82,80,.95)'; k.beginPath(); k.ellipse(X(CHURCH[0]), Y(CHURCH[1]), 15 * px, 19 * px, 0, 0, 7); k.fill();
  // outside the map: darker
  const g = k.createRadialGradient(X(0), Y(0), (MAP_R - 6) * px, X(0), Y(0), (MAP_R + 30) * px); g.addColorStop(0, 'rgba(8,12,10,0)'); g.addColorStop(1, 'rgba(8,12,10,.85)'); k.fillStyle = g; k.fillRect(0, 0, S, S);
  for (let i = 0; i < 40000; i++) { k.fillStyle = `rgba(${R() < .5 ? '255,255,240' : '0,0,0'},${R() * .07})`; k.fillRect(R() * S, R() * S, 1 + R() * 2, 1 + R() * 2); }
  return tex(c, { rep: false });
}
export function detailTex() { const S = 256, [c, k] = cv(S, S); k.fillStyle = '#808080'; k.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) { const l = 80 + (R() - .5) * 120; k.fillStyle = `rgb(${l},${l},${l})`; k.globalAlpha = .35; const a = R() * 3.14, L = 2 + R() * 6, x = R() * S, y = R() * S; k.fillRect(x, y, 1.2, L); } k.globalAlpha = 1; return tex(c, { srgb: false }); }
export function softTex() { const [c, k] = cv(64, 64); const g = k.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.65)'); g.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = g; k.fillRect(0, 0, 64, 64); return tex(c, { srgb: false, rep: false }); }
export function smokeTex() { const [c, k] = cv(128, 128); for (let i = 0; i < 26; i++) { const x = 34 + R() * 60, y = 34 + R() * 60, r = 14 + R() * 26; const g = k.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = g; k.fillRect(0, 0, 128, 128); } return tex(c, { rep: false }); }
export function ringTex() { const S = 256, [c, k] = cv(S, S); const g = k.createRadialGradient(128, 128, 60, 128, 128, 126); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.6, 'rgba(255,255,255,.12)'); g.addColorStop(.82, 'rgba(255,255,255,1)'); g.addColorStop(.9, 'rgba(255,255,255,.3)'); g.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = g; k.fillRect(0, 0, S, S); return tex(c, { srgb: false, rep: false }); }
export function shadowTex() { const [c, k] = cv(128, 128); const g = k.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(.5, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); k.fillStyle = g; k.fillRect(0, 0, 128, 128); return tex(c, { srgb: false, rep: false }); }
