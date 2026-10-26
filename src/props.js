// Procedural props (no model files): every prop is merged from simple parts with baked vertex colours and an emissive colour attribute (aE),
// then drawn as ONE InstancedMesh per type. Sizes are in metres and match the footprints in layout.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const C = (h) => new THREE.Color(h);
let PARTS = [];
function part(g, col, { e = null, ek = 1, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], grad = null } = {}) {
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); if (g.attributes.uv1) g.deleteAttribute('uv1');
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scl)); g.applyMatrix4(m);
  const n = g.attributes.position.count, c = new Float32Array(n * 3), ea = new Float32Array(n * 3); const cc = C(col), ce = e ? C(e).multiplyScalar(ek) : null; const P = g.attributes.position;
  let y0 = Infinity, y1 = -Infinity; if (grad) for (let i = 0; i < n; i++) { y0 = Math.min(y0, P.getY(i)); y1 = Math.max(y1, P.getY(i)); }
  for (let i = 0; i < n; i++) { let k = cc; if (grad) { const t = (P.getY(i) - y0) / Math.max(1e-6, y1 - y0); k = grad(t, P.getX(i), P.getY(i), P.getZ(i)); }
    c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b; if (ce) { ea[i * 3] = ce.r; ea[i * 3 + 1] = ce.g; ea[i * 3 + 2] = ce.b; } }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aE', new THREE.BufferAttribute(ea, 3)); PARTS.push(g); return g; }
function done() { const g = mergeGeometries(PARTS, false); PARTS = []; g.computeBoundingSphere(); return g; }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s), sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h), cone = (r, h, s = 12) => new THREE.ConeGeometry(r, h, s);
function tri(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(0, h / 2); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: .02, bevelEnabled: false }); }
function grin(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, h * .2); for (let i = 0; i <= 6; i++) s.lineTo(-w / 2 + w * i / 6, (i % 2 ? h * .05 : h * .35) - (1 - Math.pow((i / 3 - 1), 2)) * h * .25); s.lineTo(w / 2, h * .2); s.quadraticCurveTo(0, -h * 1.1, -w / 2, h * .2); return new THREE.ExtrudeGeometry(s, { depth: .02, bevelEnabled: false }); }
// ribbed pumpkin body (radius 1, ~0.72 tall)
function pumpkinGeo(ribs = 9, sq = .72) { const g = new THREE.SphereGeometry(1, 36, 20); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x); const k = 1 - .085 * Math.pow(Math.abs(Math.sin(a * ribs / 2)), .6); const top = y > 0 ? 1 - .25 * Math.pow(y, 6) : 1; x *= k * top; z *= k * top; y *= sq * (1 - .12 * Math.pow(Math.abs(y), 8)); p.setXYZ(i, x, y, z); } g.computeVertexNormals(); return g; }
function jack(R, col, glow, k = 1, face = true, tall = .72, ribs = 9) {
  part(pumpkinGeo(ribs, tall), col, { pos: [0, R * tall, 0], scl: [R, R, R], grad: (t) => C(col).lerp(C('#3a1a06'), Math.max(0, .5 - t) * .5) });
  part(cyl(R * .07, R * .1, R * .32, 7), '#4a5a22', { pos: [0, R * tall * 2 + R * .1, 0], rot: [.2, 0, .15] });
  if (!face) return; const zf = R * .93, y = R * tall;
  part(tri(R * .26, R * .24), '#ffcf5a', { e: glow, ek: k, pos: [-R * .3, y + R * .18, zf * .92], rot: [-.1, -.3, 0] }); part(tri(R * .26, R * .24), '#ffcf5a', { e: glow, ek: k, pos: [R * .3, y + R * .18, zf * .92], rot: [-.1, .3, 0] });
  part(tri(R * .14, R * .12), '#ffcf5a', { e: glow, ek: k, pos: [0, y, zf * .99] }); part(grin(R * .9, R * .38), '#ffcf5a', { e: glow, ek: k, pos: [0, y - R * .2, zf * .9] });
}
export const BUILD = {
  candy() { part(sph(.09, 12, 8), '#ffffff', { pos: [0, .085, 0], scl: [1.35, 1, 1] }); part(cone(.06, .09, 8), '#ffffff', { pos: [.17, .085, 0], rot: [0, 0, Math.PI / 2] }); part(cone(.06, .09, 8), '#ffffff', { pos: [-.17, .085, 0], rot: [0, 0, -Math.PI / 2] });
    part(cyl(.092, .092, .03, 12), '#ffffff', { pos: [0, .085, 0], rot: [0, 0, Math.PI / 2], scl: [1.02, 1, 1.02] }); },
  corn() { part(cone(.09, .26, 10), '#fff', { pos: [0, .13, 0], grad: t => t > .7 ? C('#fff6e0') : t > .35 ? C('#ff8a1c') : C('#ffd21f') }); },
  apple() { part(sph(.15, 14, 10), '#c8202a', { pos: [0, .15, 0], scl: [1, .9, 1], grad: t => C('#8e1018').lerp(C('#e2463a'), t) }); part(cyl(.012, .012, .08, 5), '#4a3018', { pos: [0, .3, 0] }); part(sph(.04, 6, 4), '#3e8a2a', { pos: [.04, .3, 0], scl: [1.6, .3, .8] }); },
  mushroom() { part(cyl(.05, .07, .16, 8), '#efe6d2', { pos: [0, .08, 0] }); part(sph(.16, 14, 8, 0), '#c4162a', { pos: [0, .16, 0], scl: [1, .55, 1], grad: t => t < .5 ? C('#e8dcc8') : C('#d01f2e') });
    for (let i = 0; i < 5; i++) { const a = i * 1.3; part(sph(.028, 6, 4), '#fff', { pos: [Math.cos(a) * .09, .23, Math.sin(a) * .09] }); } },
  skull() { part(sph(.16, 14, 10), '#e8dfc6', { pos: [0, .19, 0], scl: [1, .95, 1.1] }); part(box(.2, .09, .14), '#ddd3b8', { pos: [0, .07, .06] });
    part(sph(.045, 8, 6), '#140c08', { pos: [-.06, .2, .145] }); part(sph(.045, 8, 6), '#140c08', { pos: [.06, .2, .145] }); part(tri(.04, .05), '#140c08', { pos: [0, .13, .17] }); },
  candle() { part(cyl(.07, .075, .26, 10), '#efe3c2', { pos: [0, .13, 0], grad: t => C('#d8c49a').lerp(C('#fff4d8'), t) }); part(cyl(.006, .006, .04, 4), '#222', { pos: [0, .28, 0] });
    part(sph(.035, 8, 6), '#ffd27a', { e: '#ffb347', ek: 3.2, pos: [0, .33, 0], scl: [1, 1.9, 1] }); },
  pumpkinS() { jack(.32, '#e8741a', '#ffb02e', 0, false, .75, 8); },
  crow() { part(sph(.14, 10, 8), '#101018', { pos: [0, .2, 0], scl: [.8, .85, 1.35] }); part(sph(.09, 10, 8), '#14141e', { pos: [0, .33, .14] }); part(cone(.03, .1, 6), '#d6a21a', { pos: [0, .32, .25], rot: [Math.PI / 2, 0, 0] });
    part(box(.12, .02, .22), '#0c0c12', { pos: [0, .2, -.22], rot: [.4, 0, 0] }); part(sph(.018, 6, 4), '#ffcc33', { e: '#ffcc33', ek: 1.2, pos: [.05, .35, .2] }); part(sph(.018, 6, 4), '#ffcc33', { e: '#ffcc33', ek: 1.2, pos: [-.05, .35, .2] });
    part(cyl(.01, .01, .1, 4), '#a07a18', { pos: [.04, .05, 0] }); part(cyl(.01, .01, .1, 4), '#a07a18', { pos: [-.04, .05, 0] }); },
  lantern() { part(box(.32, .04, .32), '#1c1a1e', { pos: [0, .02, 0] }); part(box(.26, .4, .26), '#ffc871', { e: '#ffa63a', ek: 2.4, pos: [0, .24, 0] });
    for (const [x, z] of [[-.14, -.14], [.14, -.14], [-.14, .14], [.14, .14]]) part(box(.035, .44, .035), '#1c1a1e', { pos: [x, .24, z] }); part(cone(.24, .16, 4), '#1c1a1e', { pos: [0, .52, 0], rot: [0, Math.PI / 4, 0] }); part(new THREE.TorusGeometry(.06, .012, 5, 10), '#1c1a1e', { pos: [0, .64, 0] }); },
  pumpkinM() { jack(.6, '#e66b12', '#ffa82a', 2.6, true, .72, 10); },
  barrel() { const g = new THREE.LatheGeometry([...Array(9)].map((_, i) => new THREE.Vector2(.46 + .08 * Math.sin(i / 8 * Math.PI), i / 8 * 1.05)), 14); part(g, '#6a4426', { grad: (t, x, y, z) => C('#5a3a20').lerp(C('#8a5a32'), .5 + .5 * Math.sin(Math.atan2(z, x) * 14) * .5) });
    for (const y of [.15, .9]) part(new THREE.TorusGeometry(.5, .025, 5, 18), '#2a2622', { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] }); part(cyl(.45, .45, .02, 14), '#4a3018', { pos: [0, 1.05, 0] }); },
  hay() { part(cyl(.62, .62, 1.2, 16), '#d7b14a', { pos: [0, .62, 0], rot: [0, 0, Math.PI / 2], grad: (t, x, y, z) => C('#b48a2e').lerp(C('#e8c860'), .5 + .5 * Math.sin(x * 40 + z * 3)) });
    for (const x of [-.3, .3]) part(new THREE.TorusGeometry(.63, .02, 4, 18), '#7a5a22', { pos: [x, .62, 0], rot: [0, Math.PI / 2, 0] }); },
  stone() { const s = new THREE.Shape(); s.moveTo(-.38, 0); s.lineTo(.38, 0); s.lineTo(.38, .82); s.absarc(0, .82, .38, 0, Math.PI, false); s.lineTo(-.38, 0);
    part(new THREE.ExtrudeGeometry(s, { depth: .18, bevelEnabled: true, bevelSize: .03, bevelThickness: .03, bevelSegments: 2, curveSegments: 10 }), '#7d7f86', { pos: [0, 0, -.09], grad: (t, x, y, z) => C('#4b5a3e').lerp(C('#8a8c94'), Math.min(1, t * 2.2)) });
    part(box(.36, .04, .03), '#3a3b40', { pos: [0, .86, .12] }); part(box(.04, .3, .03), '#3a3b40', { pos: [0, .8, .12] }); part(box(.95, .1, .5), '#55574e', { pos: [0, .03, .1] }); },
  fence() { for (const x of [-1.1, 1.1]) { part(box(.12, 1.25, .12), '#1d1b22', { pos: [x, .62, 0] }); part(cone(.1, .18, 4), '#1d1b22', { pos: [x, 1.32, 0] }); }
    for (const y of [.25, .95]) part(box(2.2, .06, .05), '#24222a', { pos: [0, y, 0] }); for (let i = -4; i <= 4; i++) { part(cyl(.022, .022, 1.0, 5), '#24222a', { pos: [i * .22, .55, 0] }); part(cone(.04, .12, 4), '#2c2a32', { pos: [i * .22, 1.1, 0] }); } },
  scarecrow() { part(cyl(.05, .06, 2.3, 6), '#5a3c22', { pos: [0, 1.15, 0] }); part(cyl(.04, .04, 1.6, 6), '#5a3c22', { pos: [0, 1.65, 0], rot: [0, 0, Math.PI / 2] });
    part(box(.6, .75, .32), '#7a3a2a', { pos: [0, 1.45, 0], grad: (t, x) => C('#5e2c22').lerp(C('#8c4a30'), (Math.floor(x * 10 + 50) % 2)) }); part(box(1.3, .2, .22), '#7a3a2a', { pos: [0, 1.65, 0] });
    part(sph(.24, 12, 10), '#c9a06a', { pos: [0, 2.08, 0] }); part(cyl(.42, .42, .03, 14), '#2a2018', { pos: [0, 2.26, 0] }); part(cone(.2, .5, 10), '#2a2018', { pos: [0, 2.5, 0], rot: [.15, 0, .1] });
    part(tri(.08, .08), '#140a04', { pos: [-.08, 2.12, .22] }); part(tri(.08, .08), '#140a04', { pos: [.08, 2.12, .22] }); part(box(.18, .025, .02), '#140a04', { pos: [0, 1.98, .23] });
    for (const x of [-.66, .66]) part(cone(.07, .2, 5), '#d7b14a', { pos: [x, 1.65, 0], rot: [0, 0, x > 0 ? -1.4 : 1.4] }); },
  lamp() { part(cyl(.07, .11, 3.0, 8), '#1c1a20', { pos: [0, 1.5, 0] }); part(cyl(.2, .24, .3, 8), '#1c1a20', { pos: [0, .15, 0] }); part(box(.36, .5, .36), '#ffd08a', { e: '#ffae4a', ek: 3.0, pos: [0, 3.2, 0] });
    part(cone(.34, .26, 4), '#1c1a20', { pos: [0, 3.58, 0], rot: [0, Math.PI / 4, 0] }); for (const [x, z] of [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]]) part(box(.04, .54, .04), '#1c1a20', { pos: [x, 3.2, z] }); },
  cart() { part(box(2.2, .7, 1.4), '#6e4a2a', { pos: [0, .95, 0], grad: (t, x, y) => C('#4e321c').lerp(C('#8a5e36'), (Math.floor(y * 9 + 20) % 2) * .6 + .2) }); part(box(2.1, .08, 1.3), '#3e2a18', { pos: [0, 1.3, 0] });
    for (const z of [-.75, .75]) { part(new THREE.TorusGeometry(.48, .07, 6, 16), '#3a2614', { pos: [-.3, .5, z] }); part(cyl(.08, .08, .1, 8), '#222', { pos: [-.3, .5, z], rot: [Math.PI / 2, 0, 0] }); for (let i = 0; i < 4; i++) part(box(.9, .05, .05), '#3a2614', { pos: [-.3, .5, z], rot: [0, 0, i * Math.PI / 4] }); }
    for (const z of [-.45, .45]) part(box(1.4, .07, .07), '#5a3c22', { pos: [1.7, .8, z], rot: [0, 0, -.25] }); jack(.34, '#e8741a', '#ffa82a', 0, false); PARTS[PARTS.length - 2].translate(-.3, 1.32, .1); PARTS[PARTS.length - 1].translate(-.3, 1.32, .1);
    jack(.28, '#d9661a', '#ffa82a', 0, false); PARTS[PARTS.length - 2].translate(.5, 1.32, -.25); PARTS[PARTS.length - 1].translate(.5, 1.32, -.25); },
  deadtree() { const bark = (t) => C('#2a2420').lerp(C('#4a3e36'), t); part(cyl(.18, .42, 4.2, 8), '#3a302a', { pos: [0, 2.1, 0], grad: bark });
    const B = [[2.6, .5, 0, 2.2], [3.2, -.6, 2.1, 1.9], [3.8, .7, 4.1, 1.6], [2.2, -.8, 3.4, 1.5], [4.1, .2, 1.2, 1.4]]; for (const [y, tilt, yaw, L] of B) { const g = cyl(.04, .14, L, 6); g.translate(0, L / 2, 0); g.rotateZ(tilt * 1.2); g.rotateY(yaw); g.translate(0, y, 0); part(g, '#3a302a', { grad: bark }); }
    part(cone(.12, 1.4, 6), '#3a302a', { pos: [.1, 4.8, 0], rot: [0, 0, -.2] }); },
  pine() { part(cyl(.16, .28, 1.6, 7), '#3a2a1e', { pos: [0, .8, 0] }); [[2.5, 3.2, 1.3], [2.0, 2.8, 3.0], [1.45, 2.4, 4.6], [.9, 2.0, 6.0], [.45, 1.4, 7.2]].forEach(([r, h, y], i) =>
    part(cone(r, h, 9), '#1d3a2c', { pos: [0, y + h / 2 - .4, 0], rot: [0, i * .6, 0], grad: (t) => C('#0f2a20').lerp(C('#2e5a3e'), t * .7 + .1) })); },
  house() { // timber cottage: walls (instance-tinted), dark roof, chimney, door, glowing windows (not tinted: aE is separate)
    part(box(7, 4.6, 6), '#ffffff', { pos: [0, 2.3, 0], grad: (t) => C('#ffffff').multiplyScalar(.7 + .3 * t) });
    const s = new THREE.Shape(); s.moveTo(-3.9, 0); s.lineTo(3.9, 0); s.lineTo(0, 3.6); s.closePath(); part(new THREE.ExtrudeGeometry(s, { depth: 6.8, bevelEnabled: false }), '#2a2230', { pos: [0, 4.55, -3.4], grad: (t, x, y) => C('#1e1824').lerp(C('#3a3044'), (Math.floor(y * 3) % 2) * .5 + .2) });
    const s2 = new THREE.Shape(); s2.moveTo(-3.5, 0); s2.lineTo(3.5, 0); s2.lineTo(0, 3.2); s2.closePath(); part(new THREE.ExtrudeGeometry(s2, { depth: 6.02, bevelEnabled: false }), '#ffffff', { pos: [0, 4.6, -3.01] });
    part(box(.9, 2.2, .9), '#4a3a3a', { pos: [2.1, 7.4, -1] }); part(box(1.3, 2.3, .12), '#3a2416', { pos: [0, 1.15, 3.02] }); part(sph(.07, 6, 4), '#d8b04a', { pos: [.45, 1.15, 3.1] });
    for (const [x, y] of [[-2.3, 1.6], [2.3, 1.6], [-1.6, 3.6], [1.6, 3.6]]) { part(box(1.2, 1.1, .1), '#ffd27a', { e: '#ffa040', ek: 2.6, pos: [x, y, 3.02] }); part(box(1.36, .1, .14), '#2a1c12', { pos: [x, y - .6, 3.05] }); part(box(.08, 1.1, .12), '#2a1c12', { pos: [x, y, 3.06] }); part(box(1.2, .08, .12), '#2a1c12', { pos: [x, y, 3.06] }); }
    for (const z of [-1.6, 1.6]) part(box(.1, 1.1, 1.2), '#ffd27a', { e: '#ffa040', ek: 2.2, pos: [3.52, 2, z] }); part(box(.1, 1.1, 1.2), '#ffd27a', { e: '#ffa040', ek: 2.2, pos: [-3.52, 2, 0] });
    part(sph(.5, 8, 6), '#2a2a34', { pos: [2.1, 8.8, -1], scl: [1, .5, 1] }); },
  bigpump() { jack(2.05, '#ff7a12', '#ffb43a', 3.4, true, .68, 12); part(new THREE.TorusGeometry(.5, .14, 6, 12), '#3c6a2a', { pos: [.6, 2.95, .2], rot: [1.2, .3, 0] }); part(sph(.5, 8, 6), '#3c7a2a', { pos: [-.7, 2.85, -.3], scl: [1.6, .25, 1] }); },
  crypt() { const st = (t, x, y, z) => C('#5c5e66').lerp(C('#8a8c96'), .3 + .7 * t).lerp(C('#3e4a36'), Math.max(0, .3 - t)); part(box(6.4, .6, 5.6), '#55575e', { pos: [0, .3, 0] }); part(box(5.4, 3.8, 4.6), '#777a82', { pos: [0, 2.5, -.2], grad: st });
    for (const x of [-2.2, -.9, .9, 2.2]) part(cyl(.28, .3, 3.8, 10), '#9a9ca4', { pos: [x, 2.5, 2.3] }); part(box(6, .5, 5.4), '#6a6c74', { pos: [0, 4.6, 0] });
    const s = new THREE.Shape(); s.moveTo(-3.1, 0); s.lineTo(3.1, 0); s.lineTo(0, 1.5); s.closePath(); part(new THREE.ExtrudeGeometry(s, { depth: 5.2, bevelEnabled: false }), '#6e7078', { pos: [0, 4.85, -2.6] });
    part(box(1.8, 2.8, .1), '#1a1a20', { pos: [0, 2, 2.12] }); for (let i = -3; i <= 3; i++) part(box(.05, 2.8, .14), '#2e2c34', { pos: [i * .25, 2, 2.2] }); part(box(1.6, .5, .08), '#7aff9a', { e: '#52ff8a', ek: 2.2, pos: [0, 2.4, 2.1] });
    part(sph(.35, 10, 8), '#8a8c94', { pos: [0, 6.6, 1.5] }); part(box(4.6, .28, .5), '#3a3c44', { pos: [0, 4.0, 2.45] }); },
  church() { // nave, apse, bell tower with belfry + golden bell, spire, rose window, glowing tall windows
    const st = (t) => C('#5a5c66').lerp(C('#8e909a'), .25 + .75 * t); part(box(10, 9, 20), '#7a7c84', { pos: [0, 4.5, -2], grad: st });
    const s = new THREE.Shape(); s.moveTo(-5.6, 0); s.lineTo(5.6, 0); s.lineTo(0, 6); s.closePath(); part(new THREE.ExtrudeGeometry(s, { depth: 20.6, bevelEnabled: false }), '#2a2834', { pos: [0, 8.95, -12.3] });
    part(cyl(4.2, 4.2, 8, 14, 1), '#74767e', { pos: [0, 4, -12.2], grad: st }); part(cone(4.6, 4, 14), '#2a2834', { pos: [0, 10, -12.2] });
    part(box(7, 22, 7), '#80828a', { pos: [0, 11, 9.5], grad: st }); part(box(7.6, .8, 7.6), '#5a5c64', { pos: [0, 22.2, 9.5] });
    for (const [x, z, ry] of [[0, 13.05, 0], [3.55, 9.5, Math.PI / 2], [-3.55, 9.5, Math.PI / 2]]) { part(box(2.2, 3.6, .2), '#0e0c14', { pos: [x, 19.2, z], rot: [0, ry, 0] }); }
    part(sph(1.15, 14, 10), '#d8a83a', { pos: [0, 18.9, 9.5], scl: [1, 1.15, 1], e: '#ffb840', ek: .5 }); part(cone(5.2, 12, 4), '#262430', { pos: [0, 28.6, 9.5], rot: [0, Math.PI / 4, 0] });
    part(sph(.45, 10, 8), '#d8a83a', { pos: [0, 34.9, 9.5], e: '#ffcc60', ek: .8 }); part(cyl(.08, .08, 1.6, 6), '#d8a83a', { pos: [0, 35.7, 9.5] });
    part(cyl(1.6, 1.6, .2, 18), '#ffd890', { e: '#ff9a40', ek: 3.0, pos: [0, 15, 13.1], rot: [Math.PI / 2, 0, 0] }); part(box(2.6, 4.6, .3), '#1a1418', { pos: [0, 2.3, 13.05] });
    for (let i = 0; i < 4; i++) for (const x of [-5.05, 5.05]) { part(box(.2, 4.2, 1.5), '#ffd08a', { e: '#ff9a40', ek: 2.6, pos: [x, 5, -9.5 + i * 4.6] }); part(cyl(.75, .75, .2, 10, 1), '#ffd08a', { e: '#ff9a40', ek: 2.6, pos: [x, 7.1, -9.5 + i * 4.6], rot: [0, 0, Math.PI / 2] }); }
    for (const x of [-3.7, 3.7]) for (const z of [6, 13]) part(box(.8, 6, .8), '#6a6c74', { pos: [x, 3, z] }); }
};
const cache = {};
export function propGeo(type) { if (!cache[type]) { PARTS = []; BUILD[type](); cache[type] = done(); } return cache[type]; }
// material: vertex colours, a separate emissive colour per vertex, world-space grime noise; uGlow = global jack-o'-lantern flare (the Big Gulp)
export function propMaterial(U) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .82, metalness: 0 });
  m.onBeforeCompile = sh => { sh.uniforms.uGlow = U.uGlow; sh.uniforms.uGoo = U.uGoo; sh.uniforms.uBlob = U.uBlob;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aE; varying vec3 vE; varying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvE = aE;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 wp4 = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n wp4 = instanceMatrix * wp4;\n#endif\n vWP = (modelMatrix * wp4).xyz; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlow; uniform vec3 uGoo; uniform vec4 uBlob; varying vec3 vE; varying vec3 vWP;\nfloat hh(vec3 p){ return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }')
      .replace('#include <color_fragment>', '#include <color_fragment>\n float gn = hh(vWP * 7.0) * .5 + hh(vWP * 2.3) * .5; diffuseColor.rgb *= .86 + .22 * gn;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vE * uGlow;\n float bd = length(vWP - uBlob.xyz) - uBlob.w; totalEmissiveRadiance += uGoo * diffuseColor.rgb * .35 * clamp(1.0 - bd / max(1.5, uBlob.w * 1.6), 0.0, 1.0);'); };
  return m;
}
