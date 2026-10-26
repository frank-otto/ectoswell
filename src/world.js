// The night village: sky with moon + stars + dawn glow (one shader), hills, clouds, ground, moonlight with a ball-following shadow camera,
// ~1600 instanced props, the goo blob (wobbling translucent shader, eyes, mouth, inner bubbles, green light), its slime trail, shockwaves.
import * as THREE from 'three';
import { TYPES, CHURCH, MAP_R } from './layout.js';
import { propGeo, propMaterial } from './props.js';
import { groundTex, detailTex, ringTex, shadowTex, smokeTex, GROUND_EXT } from './tex.js';
import { qrot, qmul } from './rules.js';
export const QUALITY = { low: { dpr: 1, shadow: 0, bloom: .5, blobSeg: 3 }, mid: { dpr: 1.5, shadow: 1024, bloom: .5, blobSeg: 4 }, high: { dpr: 2, shadow: 2048, bloom: 1, blobSeg: 5 }, ultra: { dpr: 2.5, shadow: 2048, bloom: 1, blobSeg: 5 } };
export const MOON_DIR = new THREE.Vector3(-.12, .2, -1).normalize();
const TINTS = {
  candy: ['#ff3d6e', '#ffd23a', '#3ad1ff', '#9b5cff', '#5cff8a', '#ff8a2a', '#ffffff'], house: ['#e8dcc0', '#c9d6e6', '#d8e8cf', '#ecc9c4', '#e0cfa8'], scarecrow: ['#ffffff', '#9ab0ff', '#ffd08a'],
  pumpkinS: ['#ffffff', '#ffe0c0', '#ffd0a0', '#fff0d0'], pumpkinM: ['#ffffff', '#ffe6c8'], stone: ['#ffffff', '#d8dce8', '#c8ccc0', '#e8e4dc'], barrel: ['#ffffff', '#d8c8b8'], crow: ['#ffffff'], cart: ['#ffffff', '#d0c0b0']
};
export function createWorld(scene, renderer, layout, U) {
  const W = { scene, U, flash: 0, glow: 1, dawn: 0, t: 0, rings: [], meshes: {}, objs: layout };
  scene.fog = new THREE.FogExp2('#1a1838', .011); scene.background = new THREE.Color('#0c0c22');
  // ---------- sky (gradient + moon disc with maria + halo + twinkling stars + dawn) ----------
  W.skyU = { uMoon: { value: MOON_DIR.clone() }, uDawn: { value: 0 }, uFlash: { value: 0 }, uT: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({ uniforms: W.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uMoon; uniform float uDawn, uFlash, uT; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
      float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y), mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){ vec3 d = normalize(vD); float y = max(d.y, 0.);
        vec3 top = vec3(.008, .01, .045), mid = vec3(.05, .035, .14), hor = vec3(.16, .08, .2);
        vec3 c = mix(hor, mid, smoothstep(0., .18, y)); c = mix(c, top, smoothstep(.15, .7, y));
        vec3 dawnH = vec3(.9, .38, .22), dawnM = vec3(.3, .2, .42); c = mix(c, mix(dawnH, dawnM, smoothstep(0., .35, y)), uDawn * (1. - smoothstep(.2, .9, y)) * .9);
        float md = dot(d, uMoon); float disc = smoothstep(.99915, .99935, md);
        vec3 mp = (d - uMoon * md) * 900.; float mar = n3(mp * .045) * .6 + n3(mp * .11) * .4; vec3 moonC = mix(vec3(1., .95, .82), vec3(.72, .7, .66), smoothstep(.45, .7, mar)) * 2.6;
        c += vec3(.5, .45, .62) * pow(max(md, 0.), 900.) * 1.4 + vec3(.22, .2, .36) * pow(max(md, 0.), 40.) * .6;
        c = mix(c, moonC, disc);
        float st = step(.9965, h(floor(d * 420.))) * smoothstep(.05, .3, y) * (1. - disc) * (1. - uDawn * .8); st *= .5 + .5 * sin(uT * 2. + h(floor(d * 420.) + 3.) * 40.); c += vec3(.8, .85, 1.) * st * 1.4;
        float cl = smoothstep(.55, .85, n3(d * vec3(3., 9., 3.) + vec3(uT * .01, 0., 0.)) * .6 + n3(d * 11.) * .4) * smoothstep(.02, .12, y) * (1. - smoothstep(.35, .6, y)); c = mix(c, vec3(.06, .05, .12) + vec3(.25, .22, .32) * pow(max(md, 0.), 30.), cl * .8);
        c += uFlash * vec3(.25, .6, .35) * (1. - y * .5);
        gl_FragColor = vec4(c, 1.); }` }));
  sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky); W.sky = sky;
  // ---------- distant hills + tree line silhouettes ----------
  { const N = 160, pos = [], idx = []; for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, r = 330; const hgt = 18 + 26 * Math.abs(Math.sin(a * 3.1) * Math.sin(a * 1.7 + 1)) + 9 * Math.sin(a * 13) * Math.sin(a * 7.3) + (i % 3) * 2.5;
      pos.push(Math.cos(a) * r, -4, Math.sin(a) * r, Math.cos(a) * r, hgt, Math.sin(a) * r); if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const hills = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#0a0a1c', side: THREE.DoubleSide, fog: false })); hills.renderOrder = -9; scene.add(hills);
    const g2 = g.clone(); g2.scale(.62, .55, .62); const h2 = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: '#100e24', side: THREE.DoubleSide, fog: false })); h2.rotation.y = .7; h2.renderOrder = -8; scene.add(h2); }
  // ---------- ground ----------
  const gt = groundTex(), det = detailTex(); det.repeat.set(1, 1);
  const gm = new THREE.MeshStandardMaterial({ map: gt, roughness: .95, metalness: 0 });
  gm.onBeforeCompile = sh => { sh.uniforms.uDet = { value: det }; sh.uniforms.uGoo = U.uGoo; sh.uniforms.uBlob = U.uBlob;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP2;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP2 = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uDet; uniform vec3 uGoo; uniform vec4 uBlob; varying vec3 vWP2;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n float dd = texture2D(uDet, vWP2.xz * .45).r * .6 + texture2D(uDet, vWP2.xz * .07).r * .4; diffuseColor.rgb *= .62 + .8 * dd;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n float bd = length(vWP2.xz - uBlob.xz) / max(.5, uBlob.w); totalEmissiveRadiance += uGoo * .05 * exp(-bd * bd * .35) * (1. + 2. * exp(-bd * bd * 1.6));'); };
  const ground = new THREE.Mesh(new THREE.CircleGeometry(GROUND_EXT, 96), gm); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground); W.ground = ground;
  // ---------- lights ----------
  W.hemi = new THREE.HemisphereLight('#7f86d8', '#2a1c30', .9); scene.add(W.hemi);
  W.moon = new THREE.DirectionalLight('#c8d4ff', 1.9); W.moon.position.copy(MOON_DIR).multiplyScalar(60).setY(70); scene.add(W.moon); scene.add(W.moon.target);
  W.moon.shadow.bias = -.0008; W.moon.shadow.normalBias = .04;
  W.gooLight = new THREE.PointLight('#5dff8f', 6, 14, 1.6); scene.add(W.gooLight);
  W.warm = new THREE.PointLight('#ff9a40', 0, 60, 1.4); W.warm.position.set(0, 16, CHURCH[1] + 14); scene.add(W.warm);
  // ---------- props ----------
  W.pmat = propMaterial(U); W.byType = {};
  for (const o of layout) (W.byType[o.type] = W.byType[o.type] || []).push(o);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  for (const [type, list] of Object.entries(W.byType)) {
    const im = new THREE.InstancedMesh(propGeo(type), W.pmat, list.length); im.castShadow = !['candy', 'corn', 'apple', 'mushroom', 'candle', 'skull'].includes(type); im.receiveShadow = true; im.frustumCulled = false;
    list.forEach((o, i) => { o.ii = i; o.mesh = im; const T = TINTS[type]; col.set(T ? T[Math.floor(o.tint * T.length) % T.length] : '#ffffff'); im.setColorAt(i, col); });
    W.meshes[type] = im; scene.add(im); }
  W.place = (o) => { const im = o.mesh; v.set(o.x, o.y || 0, o.z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.yaw); sc.setScalar(o.sc); m4.compose(v, q, sc); im.setMatrixAt(o.ii, m4); im.instanceMatrix.needsUpdate = true; };
  W.reset = () => { for (const o of layout) { o.alive = true; o.stuck = false; o.y = 0; W.place(o); } for (const im of Object.values(W.meshes)) im.instanceColor && (im.instanceColor.needsUpdate = true); };
  W.reset();
  // ---------- the blob ----------
  W.blobU = { uT: { value: 0 }, uGulp: { value: 0 }, uMoon: { value: MOON_DIR.clone() }, uFlash: { value: 0 }, uR: { value: 1 } };
  W.blobMat = new THREE.ShaderMaterial({ uniforms: W.blobU, transparent: true, depthWrite: true,
    vertexShader: `uniform float uT, uGulp; varying vec3 vN, vV, vO; varying float vW;
      void main(){ vec3 p = normalize(position); float w = sin(p.x * 3.1 + uT * 2.3) * sin(p.y * 2.7 + uT * 1.9) * sin(p.z * 3.4 + uT * 2.1); w += .5 * sin(p.x * 7. - uT * 3.) * sin(p.z * 6. + uT * 2.6);
        vW = w; vec3 q = p * (1. + w * .035 + uGulp * .09 * (.5 + .5 * p.y)); vO = p; vec4 mv = modelViewMatrix * vec4(q, 1.); vV = -mv.xyz; vN = normalize(normalMatrix * p); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uT, uGulp, uFlash; uniform vec3 uMoon; varying vec3 vN, vV, vO; varying float vW;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
      void main(){ vec3 N = normalize(vN), V = normalize(vV); float ndv = clamp(dot(N, V), 0., 1.); float fr = pow(1. - ndv, 2.4);
        vec3 deep = vec3(.02, .22, .08), lime = vec3(.35, 1.4, .45), core = vec3(.1, .9, .3);
        vec3 c = mix(deep, core, pow(ndv, 1.5) * .55) + lime * fr * 1.1;
        vec3 L = normalize((viewMatrix * vec4(uMoon, 0.)).xyz); vec3 Hh = normalize(L + V); c += vec3(.8, .95, 1.) * pow(max(dot(N, Hh), 0.), 90.) * 2.2 + vec3(.6, 1., .7) * pow(max(dot(N, Hh), 0.), 12.) * .12;
        vec3 Kk = normalize(vec3(.4, .8, .45)); c += vec3(.9, 1., .9) * pow(max(dot(N, normalize(Kk + V)), 0.), 160.) * 1.4;
        vec3 cell = floor(vO * 9. + vec3(0., uT * .25, 0.)); float bub = step(.93, h(cell)) * smoothstep(.5, .1, length(fract(vO * 9. + vec3(0., uT * .25, 0.)) - .5)); c += vec3(.5, 1.2, .6) * bub * .45 * ndv;
        c *= 1. + vW * .12; c += vec3(.4, 1.2, .5) * uGulp * .5 + uFlash * vec3(.3, .9, .4);
        gl_FragColor = vec4(c, clamp(.5 + fr * .55 + uGulp * .2, 0., .97)); }` });
  W.blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 5), W.blobMat); W.blob.renderOrder = 5; scene.add(W.blob);
  // eyes + mouth (they do not roll: they ride on the front of the blob, looking where it goes)
  const eyeW = new THREE.MeshStandardMaterial({ color: '#f4fff6', emissive: '#a8ffc0', emissiveIntensity: .35, roughness: .25 }), pupil = new THREE.MeshBasicMaterial({ color: '#06140a' }), shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  W.face = new THREE.Group(); W.eyes = [];
  for (const sx of [-1, 1]) { const e = new THREE.Group(); const w = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12), eyeW); w.scale.set(1, 1.12, .62); e.add(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(.11, 12, 10), pupil); p.position.set(0, -.01, .1); p.scale.set(1, 1.15, .5); e.add(p); const s = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), shine); s.position.set(.04, .05, .17); e.add(s);
    e.position.set(sx * .27, .16, 0); W.face.add(e); W.eyes.push(e); }
  W.mouth = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 10), new THREE.MeshBasicMaterial({ color: '#04200c' })); W.mouth.scale.set(1.1, .25, .4); W.mouth.position.set(0, -.2, 0); W.face.add(W.mouth);
  W.face.renderOrder = 6; scene.add(W.face);
  // fake contact shadow + slime trail
  W.cshadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: .8 })); W.cshadow.rotation.x = -Math.PI / 2; W.cshadow.renderOrder = 1; scene.add(W.cshadow);
  const TN = 90; W.trail = { n: TN, pts: [], geo: new THREE.BufferGeometry() }; W.trail.pos = new Float32Array(TN * 2 * 3); W.trail.al = new Float32Array(TN * 2);
  W.trail.geo.setAttribute('position', new THREE.BufferAttribute(W.trail.pos, 3)); W.trail.geo.setAttribute('al', new THREE.BufferAttribute(W.trail.al, 1)); { const sd = new Float32Array(TN * 2); for (let i = 0; i < TN; i++) { sd[i * 2] = -1; sd[i * 2 + 1] = 1; } W.trail.geo.setAttribute('sd', new THREE.BufferAttribute(sd, 1)); } const ti = []; for (let i = 0; i < TN - 1; i++) { const k = i * 2; ti.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } W.trail.geo.setIndex(ti);
  W.trailMesh = new THREE.Mesh(W.trail.geo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: 'attribute float al; attribute float sd; varying float vA; varying float vS; void main(){ vA = al; vS = sd; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying float vA; varying float vS; void main(){ float e = 1. - vS * vS; float g = e * e * .7 + (1. - smoothstep(.0, .25, e)) * .0 + smoothstep(.75, 1., abs(vS)) * .5 * e; gl_FragColor = vec4(vec3(.12, .85, .3) * vA * (e * .55 + .45 * smoothstep(0., .5, e) * (1. - e) * 4.) , 1.); }' })); W.trailMesh.frustumCulled = false; W.trailMesh.renderOrder = 2; scene.add(W.trailMesh);
  // shockwave rings
  const rt = ringTex(); for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: rt, color: '#6dff9a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 3; scene.add(m); W.rings.push({ m, t: 9, dur: 1, R: 10, x: 0, z: 0 }); }
  // low clouds drifting across the moon
  W.clouds = []; const smk = smokeTex(); for (let i = 0; i < 7; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smk, color: '#2a2848', transparent: true, opacity: .55, depthWrite: false, fog: false }));
    s.position.copy(MOON_DIR).multiplyScalar(700).add(new THREE.Vector3((i - 3) * 90, -40 + (i % 3) * 30, 0)); s.scale.set(300, 110, 1); s.renderOrder = -7; scene.add(s); W.clouds.push(s); }
  return W;
}
export function ring(W, x, z, R, dur = 1.2, color = '#6dff9a') { const r = W.rings.find(r => r.t >= r.dur) || W.rings[0]; Object.assign(r, { t: 0, dur, R, x, z }); r.m.material.color.set(color); r.m.visible = true; }
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
// per-frame: blob, face, stuck props, flying props, trail, rings, light, shadow camera
export function updateWorld(W, Q, dt, t, cam, vis) {
  W.t = t; W.skyU.uT.value = t; W.blobU.uT.value = t; const b = Q.b, r = b.r;
  const bob = Math.sin(t * 3) * .02 * r; W.blob.position.set(b.x, r * .97 + bob, b.z); W.blob.quaternion.set(b.q[0], b.q[1], b.q[2], b.q[3]); W.blob.scale.setScalar(r);
  W.U.uBlob.value.set(b.x, r, b.z, r);
  // face looks where the blob rolls (or at the camera when it rests)
  const sp = Math.hypot(b.vx, b.vz); const hx = sp > .3 ? b.vx / sp : cam.position.x - b.x, hz = sp > .3 ? b.vz / sp : cam.position.z - b.z; const hl = Math.hypot(hx, hz) || 1;
  const toC = _v.set(cam.position.x - b.x, 0, cam.position.z - b.z).normalize(); let fx = hx / hl * .45 + toC.x * .55, fz = hz / hl * .45 + toC.z * .55; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
  W.faceDir = W.faceDir || [fx, fz]; W.faceDir[0] += (fx - W.faceDir[0]) * Math.min(1, dt * 6); W.faceDir[1] += (fz - W.faceDir[1]) * Math.min(1, dt * 6); const fd = Math.hypot(...W.faceDir) || 1;
  const ex = W.faceDir[0] / fd, ez = W.faceDir[1] / fd; const el = .32; W.face.position.set(b.x + ex * r * Math.cos(el) * .96, W.blob.position.y + r * Math.sin(el) * .96, b.z + ez * r * Math.cos(el) * .96);
  W.face.lookAt(W.face.position.x + ex, W.face.position.y + Math.sin(el) * .6, W.face.position.z + ez); W.face.scale.setScalar(r * .95);
  const blink = (t % 3.7) < .12 ? .1 : 1; W.eyes.forEach(e => e.scale.y = blink); W.mouthOpen = Math.max(0, (W.mouthOpen || 0) - dt * 4); W.mouth.scale.set(1.1 - W.mouthOpen * .2, .25 + W.mouthOpen * 1.1, .4);
  W.face.visible = vis.face !== false;
  W.cshadow.position.set(b.x, .03, b.z); W.cshadow.scale.setScalar(r * 2.6);
  W.gooLight.position.set(b.x, r * 1.1, b.z); W.gooLight.distance = 6 + r * 9; W.gooLight.intensity = (4 + Math.min(r, 3) * 5 + Math.sqrt(Math.max(0, r - 3)) * 6) * (1 + W.blobU.uGulp.value * 1.2);
  W.blobU.uGulp.value = Math.max(0, W.blobU.uGulp.value - dt * 2.5);
  // props: stuck ones ride on the blob; freshly gulped ones fly in; knocked-off ones arc out and land
  const bq = _q.set(b.q[0], b.q[1], b.q[2], b.q[3]);
  for (const o of Q.objs) {
    if (o.stuck) {
      const lp = qrot(b.q, o.lp); const deep = o.s < r * .09 && Q.t - o.eatT > 1.2 && o.type !== 'church';
      let k = 1; const fly = o === Q.gulpObj && Q.state === 'gulp' ? 2.3 : .28; if (Q.t - o.eatT < fly) k = Math.min(1, (Q.t - o.eatT) / fly); const e = k * k * (3 - 2 * k);
      const px = b.x + lp[0], py = W.blob.position.y + lp[1], pz = b.z + lp[2];
      _v.set(o.x + (px - o.x) * e, (py) * e + (o.y || 0) * (1 - e) + Math.sin(e * Math.PI) * (o === Q.gulpObj ? r * .6 : o.s * 1.5), o.z + (pz - o.z) * e);
      _q2.set(o.lq[0], o.lq[1], o.lq[2], o.lq[3]); const wq = bq.clone().multiply(_q2); const q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.yaw); q0.slerp(wq, e);
      if (o === Q.gulpObj && Q.state === 'gulp' && e < 1) _v.x += Math.sin(t * 50) * .15 * (1 - e) * o.s * .1;
      _s.setScalar(deep ? 0 : o.sc * (o === Q.gulpObj ? 1 : 1 - .15 * Math.min(1, (r * .14 - o.s) / (r * .14)) * (o.s < r * .14 ? 1 : 0))); _m.compose(_v, q0, _s); o.mesh.setMatrixAt(o.ii, _m); o.mesh.instanceMatrix.needsUpdate = true; o._dyn = true; }
    else if (o.alive && o.dropT !== undefined && Q.t - o.dropT < .7) { const k = (Q.t - o.dropT) / .7; _v.set(o.fromX + (o.x - o.fromX) * k, Math.sin(k * Math.PI) * (2 + r) + r * (1 - k), o.fromZ + (o.z - o.fromZ) * k);
      _q2.setFromAxisAngle(new THREE.Vector3(1, 0, 0), k * 7); _s.setScalar(o.sc); _m.compose(_v, _q2, _s); o.mesh.setMatrixAt(o.ii, _m); o.mesh.instanceMatrix.needsUpdate = true; o._dyn = true; }
    else if (o._dyn) { o._dyn = false; if (o.alive) W.place(o); else { _m.makeScale(0, 0, 0); o.mesh.setMatrixAt(o.ii, _m); o.mesh.instanceMatrix.needsUpdate = true; } }
  }
  // trail
  const T = W.trail; const last = T.pts[0]; if (!last || Math.hypot(last[0] - b.x, last[1] - b.z) > Math.max(.15, r * .25)) { T.pts.unshift([b.x, b.z, r, t]); if (T.pts.length > T.n) T.pts.pop(); }
  for (let i = 0; i < T.n; i++) { const p = T.pts[Math.min(i, T.pts.length - 1)] || [b.x, b.z, r, t]; const p2 = T.pts[Math.min(i + 1, T.pts.length - 1)] || p; let dx = p[0] - p2[0], dz = p[1] - p2[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const w = p[2] * .42, a = i >= T.pts.length ? 0 : Math.max(0, 1 - i / T.n) * Math.max(0, 1 - (t - p[3]) / 7) * .42 * Math.min(1, i / 3); const y = .04 + i * .0004;
    T.pos.set([p[0] - dz * w, y, p[1] + dx * w, p[0] + dz * w, y, p[1] - dx * w], i * 6); T.al[i * 2] = T.al[i * 2 + 1] = a; }
  T.geo.attributes.position.needsUpdate = true; T.geo.attributes.al.needsUpdate = true;
  for (const R of W.rings) { if (R.t >= R.dur) { R.m.visible = false; continue; } R.t += dt; const k = Math.min(1, R.t / R.dur); R.m.position.set(R.x, .1, R.z); R.m.scale.setScalar(.5 + R.R * (1 - Math.pow(1 - k, 2.2))); R.m.material.opacity = (1 - k) * 1.1; }
  // moonlight shadow camera follows the blob, sized to what the camera sees
  const ext = 10 + r * 7; const sc = W.moon.shadow.camera; if (sc.right !== ext) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 260; sc.updateProjectionMatrix(); }
  W.moon.target.position.set(b.x, 0, b.z); W.moon.position.set(b.x - MOON_DIR.x * 90, 110, b.z - MOON_DIR.z * 90);
  // fog thins as the blob grows (you see further), the dawn creeps in
  W.scene.fog.density = .016 / (1 + r * .22) + .0018; W.skyU.uDawn.value = W.dawn; W.skyU.uFlash.value = W.flash; W.blobU.uFlash.value = W.flash * .5;
  W.scene.fog.color.setRGB(.1 + W.dawn * .25, .09 + W.dawn * .08, .2 + W.dawn * .02); W.hemi.intensity = .9 + W.dawn * .5 + W.flash * 1.5;
  W.U.uGlow.value = W.glow; W.warm.intensity = (W.glow - 1) * 40;
  for (const [i, c] of W.clouds.entries()) c.position.x += Math.sin(i * 7) * dt * 2;
}
export function applyWorldQuality(W, renderer, Q) {
  const on = Q.shadow > 0; renderer.shadowMap.enabled = on; W.moon.castShadow = on;
  if (on && W.moon.shadow.mapSize.x !== Q.shadow) { W.moon.shadow.mapSize.set(Q.shadow, Q.shadow); if (W.moon.shadow.map) { W.moon.shadow.map.dispose(); W.moon.shadow.map = null; } }
  if (!on && W.moon.shadow.map) { W.moon.shadow.map.dispose(); W.moon.shadow.map = null; }
  const seg = Q.blobSeg; if (W.blobSeg !== seg) { const old = W.blob.geometry; W.blob.geometry = new THREE.IcosahedronGeometry(1, seg); old.dispose(); W.blobSeg = seg; }
  W.pmat.needsUpdate = true; W.ground.material.needsUpdate = true;
}
export const gradeShader = { uniforms: { tDiffuse: { value: null }, uVig: { value: .9 }, uFlash: { value: 0 }, uDawn: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uFlash, uDawn; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 x = c.rgb; float l = dot(x, vec3(.299, .587, .114));
      x = mix(vec3(l), x, 1.12); x *= vec3(.96, 1., 1.06); x += vec3(.0, .012, .02) * (1. - smoothstep(0., .3, l));
      vec2 d = vUv - .5; x *= 1. - uVig * .5 * dot(d, d) * 1.6; x += uFlash * vec3(.05, .16, .08); x = mix(x, x * vec3(1.08, .98, .92), uDawn * .5);
      gl_FragColor = vec4(x, c.a); }` };
