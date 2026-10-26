import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { createWorld, updateWorld, applyWorldQuality, QUALITY, gradeShader, ring, MOON_DIR } from './world.js';
import { createFX, sparks, puff, updateFX, seedFX } from './fx.js';
import { Roll, botStep, DIFF, NIGHTS, GULP_LEN, TIERS } from './rules.js';
import { makeLayout, CHURCH, STARTS, MAP_R } from './layout.js';
import { softTex, smokeTex } from './tex.js';
import { Player } from './music.js';
import * as A from './audio.js';
import { T } from './i18n.js';

const $ = id => document.getElementById(id);
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x), fin = (v, d = 0) => Number.isFinite(v) ? v : d;
const fmt = n => Math.round(fin(n)).toLocaleString('en-US'), fmtM = r => (r * 2 < 10 ? (r * 2).toFixed(1) : Math.round(r * 2)) + ' m';
const ROMAN = ['I', 'II', 'III'];
let fxSeed = (window.__esSeed || (Date.now() & 0xffffff)) >>> 0;
function rng() { fxSeed = (fxSeed + 0x6D2B79F5) >>> 0; let t = fxSeed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function autoLang() { try { const l = (navigator.languages && navigator.languages[0]) || navigator.language || ''; return /^de\b|^de-/i.test(l) ? 'de' : 'en'; } catch (e) { return 'en'; } }
const S = { state: 'intro', mode: 'night', night: clamp(+ls.get('es-night', '0') || 0, 0, 2), lang: ls.get('es-lang', '') || autoLang(), diff: ls.get('es-diff', 'medium'), kids: ls.get('es-kids', '0') === '1', q: ls.get('es-q', ''), qUser: !!ls.get('es-q', ''),
  name: ls.get('es-name', 'Player') || 'Player', gt: 0, ts: 1, player: 0, duel: [null, null], result: null, stars: 0, more: false, auto: false, botOpt: {}, introT: 0, titleT: -1, endT: 0, punch: 0, shake: 0, newBest: false,
  hintT: -1, yaw: Math.PI, readyShown: false, cine: 0 };
if (!DIFF[S.diff] || S.diff === 'kids') S.diff = 'medium';
if (!QUALITY[S.q]) { S.q = 'mid'; S.qUser = false; }
const dkey = () => S.kids ? 'kids' : S.diff;
A.setClock(() => S.gt);
const t = (k, g) => { let s = T[S.lang][k] ?? T.en[k] ?? k; if (g !== undefined) s = s.replace('{g}', g); return s; };
let isTouch = matchMedia && matchMedia('(pointer: coarse)').matches;

// ---------------- renderer / scene / post ----------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__esPDB });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const U = { uGlow: { value: 1 }, uGoo: { value: new THREE.Color('#3dff7a') }, uBlob: { value: new THREE.Vector4(0, 1, 0, 1) } };
const LAYOUT = makeLayout(1919);
const W = createWorld(scene, renderer, LAYOUT, U);
const camera = new THREE.PerspectiveCamera(55, 1, .1, 1200);
const F = createFX(scene, softTex(), smokeTex()); F.floor = .03;
let composer, bloom, gradePass, rtOwn;
function disposeComposer() { if (!composer) return; for (const p of composer.passes) { if (p.dispose) p.dispose(); } composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); if (rtOwn) rtOwn.dispose(); composer = null; }
function buildComposer() { disposeComposer();
  rtOwn = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }); composer = new EffectComposer(renderer, rtOwn); composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .6, .45, .95); { const hp = bloom.materialHighPassFilter; hp.fragmentShader = hp.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );', 'vec4 texel = min( texture2D( tDiffuse, vUv ), vec4( 2.4 ) );'); hp.needsUpdate = true; }
  composer.addPass(bloom); composer.addPass(new OutputPass()); gradePass = new ShaderPass(gradeShader); composer.addPass(gradePass); }
function applyQuality(qn, user) { if (!QUALITY[qn]) qn = 'mid'; S.q = qn; if (user) { S.qUser = true; ls.set('es-q', qn); } applyWorldQuality(W, renderer, QUALITY[qn]);
  scene.traverse(o => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(x => x.needsUpdate = true); } }); buildComposer(); resize(); qLabels(); }
function qLabels() { const b = $('btnQ2'); if (b) { b.textContent = `⚙ ${t('q_' + S.q)}${S.qUser ? '' : ' · ' + t('qAuto')}`; b.title = t('qL'); } }
let VW = 1, VH = 1;
function resize() { VW = window.innerWidth; VH = window.innerHeight; const dpr = Math.min(window.devicePixelRatio || 1, QUALITY[S.q].dpr);
  renderer.setPixelRatio(dpr); renderer.setSize(VW, VH, false); if (composer) { composer.setPixelRatio(dpr); composer.setSize(VW, VH); } if (bloom) bloom.resolution.set(VW * dpr / 2, VH * dpr / 2); camera.aspect = VW / VH; camera.updateProjectionMatrix(); }

// ---------------- run state ----------------
let Q = null; const timers = []; const after = (s, f) => timers.push({ t: S.gt + s, f });
const music = new Player();
const bestKey = () => `es-best-${S.mode}-${S.mode === 'night' || S.mode === 'duel' ? S.night : 'x'}-${dkey()}`;
function resetVisuals() { timers.length = 0; S.ts = 1; S.punch = 0; S.shake = 0; S.cine = 0; W.flash = 0; W.glow = 1; W.dawn = 0; W.mouthOpen = 0; W.blobU.uGulp.value = 0; W.trail.pts.length = 0; S.readyShown = false;
  for (let i = 0; i < F.life.length; i++) F.life[i] = 0; for (const p of F.puffs) { p.life = 0; p.s.visible = false; } for (const r of W.rings) r.t = r.dur; $('banner').classList.remove('show'); window.__banners = []; window.__pops = []; }
function newRoll(o) { const R = new Roll(Object.assign({ objs: LAYOUT, seed: 1919 }, o)); W.reset(); return R; }
function start(mode = 'night') { S.mode = ['night', 'endless', 'duel'].includes(mode) ? mode : 'night';
  if (S.mode === 'duel' && S.player !== 1) { S.player = 0; S.duel = [null, null]; }
  resetVisuals(); Q = newRoll({ mode: S.mode === 'duel' ? 'night' : S.mode, night: S.night, diff: S.diff, kids: S.kids }); S.state = 'play'; S.result = null; S.more = false; S.auto = !!window.__esAuto;
  S.yaw = Math.PI; music.start('roll', S.gt + .2, { force: true, bpm: [108, 112, 118][Q.night] + (S.mode === 'endless' ? 4 : 0), tr: [0, -2, 1][Q.night] }); A.sfx.go(); seedFX(1919);
  S.hintT = S.gt; camSnap = true; showHintText(); handleEvents(); setUI(); applyLang(); }
const snapOf = res => ({ score: Q.score, gulps: Q.gulps, best: Q.bestCombo, d: Q.b.r * 2, res });
function endRun(res) { if (S.state !== 'play') return; S.result = res; S.endT = S.gt; stickOff();
  if (S.mode === 'duel' && res !== 'quit') { S.duel[S.player] = snapOf(res); if (S.player === 0) { S.state = 'handover'; S.player = 1; A.sfx.turn(); music.start('menu', S.gt + .5, { force: true }); setUI(); applyLang(); return; } }
  S.stars = Q.stars; S.newBest = false;
  if (S.mode !== 'duel' && res !== 'quit') { const b = +ls.get(bestKey(), '0') || 0; if (Q.score > b) { ls.set(bestKey(), String(Q.score)); S.newBest = Q.score > 0; } }
  S.state = 'end'; if (res === 'win' || (S.mode === 'duel' && res !== 'quit')) { A.sfx.win(); for (let i = 0; i < S.stars; i++) after(.45 + i * .35, () => A.sfx.star(i)); } else if (res !== 'quit') A.sfx.fail();
  music.start('menu', S.gt + 1.2, { force: true }); showEnd(); setUI(); }
function toMenu() { S.state = 'menu'; S.more = false; S.player = 0; resetVisuals(); Q = menuRoll(); S.auto = false; S.titleT = -1; $('opening').style.opacity = 0; stickOff();
  hideHint(); music.start('menu', S.gt + .1, { force: true }); setUI(); applyLang(); }
// behind the start screen the village is alive: a little blob rolls round the pumpkin patch on its own, gulping candy
function menuRoll() { const r = newRoll({ mode: 'night', night: 0, kids: true }); r.state = 'roll'; r.left = 1e9; r.T = 1e9; r.goalObj = null; S.menuBot = {}; camSnap = true; return r; }
// ---------------- the opening: frame 0 is mid-BIG GULP – the giant blob tearing the church off the ground ----------------
function startIntro() { S.state = 'intro'; S.introT = 0; S.titleT = -1; resetVisuals(); seedFX(77); music.stop(); camSnap = true;
  Q = newRoll({ mode: 'night', night: 2, diff: 'medium' }); const b = Q.b; Q.state = 'roll'; b.r = 12.4; const pick = ['house', 'house', 'pine', 'cart', 'lamp', 'deadtree', 'hay', 'barrel', 'scarecrow', 'stone', 'pumpkinM', 'fence', 'pine', 'house'];
  let n = 0; for (const o of LAYOUT) { if (n >= 70) break; if (!o.alive || !pick.includes(o.type) || Math.hypot(o.x, o.z - CHURCH[1]) < 16) continue; if (o.type !== 'house' && rng() < .55) continue;
    b.q = [rng() - .5, rng() - .5, rng() - .5, rng() + .2]; const l = Math.hypot(...b.q); b.q = b.q.map(x => x / l); Q.eat(o); o.eatT = -9; n++; }
  b.r = 12.4; Q.combo = 0; Q.score = 0; const ch = LAYOUT.find(o => o.type === 'church'); b.x = ch.x + 3; b.z = ch.z + ch.s * .78 + b.r * .9 - 1; b.vx = -.4; b.vz = -3; b.q = [0, 0, 0, 1];
  Q.eat(ch); Q.ev = []; ch.eatT = Q.t - .75; Q.gulpT = .75; bigGulpVisuals(ch, true); W.flash = .08; W.glow = 1.7; S.punch = 0; S.shake = .4; S.intro = { stage: 0 }; A.sfx.bigGulp('church'); S.cine = 1; setUI(); applyLang(); }
function endIntro() { $('opening').style.opacity = 0; S.titleT = -1; }
// ---------------- THE BIG GULP ----------------
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _sp = new THREE.Vector3();
const GOO = ['#5dff8f', '#c8ffd6', '#2ee86a', '#ffffff'];
function bigGulpVisuals(o, quiet) { const b = Q.b; S.cineSide = pickCineSide(o); S.cine = 1; S.cineT = 0; S.cineObj = o; W.flash = Math.max(W.flash, .45); W.glow = 4; W.blobU.uGulp.value = 1; W.mouthOpen = 1; S.punch = 1; S.shake = 1;
  ring(W, o.x, o.z, b.r * 3.2 + 20, 1.6); after(.35, () => ring(W, o.x, o.z, b.r * 4.5 + 40, 2.2, '#ffb04a')); after(.8, () => ring(W, b.x, b.z, b.r * 6 + 60, 2.6));
  const top = _v.set(o.x, o.h * .6, o.z); sparks(F, top, 160, { colors: ['#9aa0b0', '#d8d0c0', '#5dff8f', '#ffb04a'], speed: 5 + o.s, up: 4, life: 1.8, size: .25 + o.s * .03, grav: 4 }); puff(F, _w.set(o.x, 1, o.z), 8, '#7a7090', 2 + o.s * .4);
  for (let i = 0; i < 4; i++) after(.2 + i * .25, () => sparks(F, _v.set(o.x + (rng() - .5) * o.s, o.h * (.3 + rng() * .6), o.z + (rng() - .5) * o.s), 50, { colors: GOO, speed: 4, up: 3, life: 1.4, size: .2 + o.s * .02, grav: 2 }));
  if (!quiet) { banner(t('bigGulp')); after(1.1, () => toast(`${t(o.type)} 🟢`)); } }
// ---------------- events from the rules → visuals + sound ----------------
const panOf = (x, z) => { _v.set(x, 0, z).project(camera); return clamp(_v.x, -.85, .85); };
let popLimit = 0;
function handleEvents() {
  if (!Q) return; const evs = Q.ev; if (!evs.length) return; Q.ev = [];
  const live = S.state === 'play';
  for (const e of evs) {
    if (!live) { if (e.type === 'eat' && rng() < .7) A.play(rr2(['plop', 'bite', 'bubble_pop']), .07, 1.3, 0, .5); if (e.type === 'eat') W.mouthOpen = .6; continue; }
    switch (e.type) {
      case 'go': break;
      case 'eat': { const o = e.o; A.sfx.gulp(e, panOf(o.x, o.z), Q.kids); W.mouthOpen = Math.min(1, .35 + o.s / Q.b.r); W.blobU.uGulp.value = Math.max(W.blobU.uGulp.value, Math.min(.6, o.s / Q.b.r * .8));
        sparks(F, _v.set(o.x, Math.min(o.h, Q.b.r) * .6, o.z), 6 + Math.min(30, Math.round(o.s * 8)), { colors: GOO, speed: 1.2 + o.s * 1.2, up: 1.4, life: .7, size: .05 + o.s * .05, grav: 3 });
        if (o.s > Q.b.r * .45 || o.s >= 1.5) { popAt(`+${fmt(e.pts)} ${t(o.type)}`, '#c8ffd6', o.s > 2 ? 'pbig' : '', _w.set(o.x, o.h * .8, o.z)); popLimit = S.gt + .6; S.punch = Math.max(S.punch, .25); if (o.s > 1.5) puff(F, _w.set(o.x, .5, o.z), 2, '#6a6080', 1 + o.s * .3); }
        else if (S.gt > popLimit && e.combo > 1 && e.combo % 5 === 0) { popAt(`${t('chain')} ${e.combo} ×${e.mult}`, '#9affb8', 'small', null); popLimit = S.gt + .4; }
        if ([8, 16, 24, 40, 60].includes(e.combo)) banner(`🟢 ${e.combo} ${t('chain')} · ×${e.mult}`);
        hideHint(); break; }
      case 'tier': { A.sfx.tier(e.tier); banner(`${t('swell')} ${fmtM(Q.b.r)}`); ring(W, Q.b.x, Q.b.z, Q.b.r * 4 + 6, 1.1); W.blobU.uGulp.value = 1; S.punch = Math.max(S.punch, .6); W.flash = Math.max(W.flash, .12);
        sparks(F, _v.set(Q.b.x, Q.b.r, Q.b.z), 60, { colors: GOO, speed: 3 + Q.b.r, up: 2, life: 1.1, size: .1 + Q.b.r * .05, grav: 1.5 }); break; }
      case 'bump': { A.sfx.bump(e, panOf(e.o.x, e.o.z), Q.kids); S.shake = Math.max(S.shake, .25 + e.power * .4); if (e.lost.length) popAt(`−${e.lost.length} ${t('lost')}`, '#ffb08a', 'small', _w.set(Q.b.x, Q.b.r * 2, Q.b.z));
        else if (rng() < .5 && S.gt > popLimit) { popAt(t('tooBig'), '#ffd27a', 'small', _w.set(e.o.x, e.o.h, e.o.z)); popLimit = S.gt + .8; } break; }
      case 'gulp': A.sfx.bigGulp(e.o.type); bigGulpVisuals(e.o, false); break;
      case 'gulpEnd': S.cine = 0; A.sfx.burp(); W.mouthOpen = 1; break;
      case 'dawnWarn': A.sfx.dawnWarn(); toast(t('dawnWarn')); break;
      case 'spawn': A.sfx.spawn(); break;
      case 'end': after(e.res === 'win' ? 1.2 : 1.0, () => endRun(e.res)); if (e.res === 'fail' || e.res === 'over') W.dawn = Math.max(W.dawn, .8); break;
    }
  }
}
const rr2 = a => a[Math.floor(rng() * a.length)];
// ---------------- camera ----------------
let camSnap = true; const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const angWrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// chase camera behind the blob; it swings round to where the blob rolls (so "up" on the stick is always forward) and backs off as it grows
function playCam(tp, tl, dt) { const b = Q.b, r = b.r, a = VW / VH, pv = a < 1; const sp = Math.hypot(b.vx, b.vz);
  if (sp > .4 && !S.cine) { const want = Math.atan2(b.vx, b.vz); const d = angWrap(want - S.yaw); S.yaw += d * Math.min(1, dt * (1.1 + Math.min(1.2, sp / Q.maxSpeed()))); }
  const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw); const D = (pv ? 4.4 : 3.6) + r * (pv ? 5.6 : 4.6), H = (pv ? 2.6 : 2.0) + r * (pv ? 4.2 : 3.2);
  tp.set(b.x - fx * D, H, b.z - fz * D); tl.set(b.x + fx * r * (pv ? 2.2 : 1.6), r * .5, b.z + fz * r * (pv ? 2.2 : 1.6)); return pv ? 64 : 52; }
// the gulp camera picks the side where nothing tall stands between it and the action (no house walls in the shot)
function cinePos(o, side, out) { const b = Q.b, r = b.r; let dx = b.x - o.x, dz = b.z - o.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const pv = VW < VH; const dist = (r * 2.6 + o.s * 2.2 + 6) * (pv ? 1.25 : 1);
  const cx = dx * Math.cos(side) - dz * Math.sin(side), cz = dx * Math.sin(side) + dz * Math.cos(side); return out.set(o.x + cx * dist + dx * r, 1.2 + r * .25, o.z + cz * dist + dz * r); }
function pickCineSide(o) { const b = Q.b; let best = .95, bs = 1e9; const p = new THREE.Vector3();
  for (const side of [.95, -.95, 1.35, -1.35, .55, -.55, 1.8, -1.8]) { cinePos(o, side, p); const mx = lerp(o.x, b.x, .45), mz = lerp(o.z, b.z, .45); let bad = Math.abs(side - .95) * .3;
    for (const q of LAYOUT) { if (!q.alive || q === o || q.h < 1.6) continue; const ax = mx - p.x, az = mz - p.z, L2 = ax * ax + az * az || 1; const u = clamp(((q.x - p.x) * ax + (q.z - p.z) * az) / L2, 0, 1);
      const d = Math.hypot(p.x + ax * u - q.x, p.z + az * u - q.z); if (d < q.s * .95 + 2) bad += q.h * (1.4 - u); }
    if (Math.hypot(p.x, p.z) > 110) bad += 50; if (bad < bs) { bs = bad; best = side; } } return best; }
function cineCam(tp, tl, o, k) { const b = Q.b, r = b.r; let dx = b.x - o.x, dz = b.z - o.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const side = S.cineSide == null ? .95 : S.cineSide, cx = dx * Math.cos(side) - dz * Math.sin(side), cz = dx * Math.sin(side) + dz * Math.cos(side); const dist = r * 2.6 + o.s * 2.2 + 6; const pv = VW < VH;
  tp.set(o.x + cx * dist * (pv ? 1.25 : 1) + dx * r, 1.2 + r * .25 + k * r * .6, o.z + cz * dist * (pv ? 1.25 : 1) + dz * r); tl.set(lerp(o.x, b.x, .45), Math.min(o.h * .55, r * 1.3) + k * r * .3, lerp(o.z, b.z, .45)); return pv ? 72 : 56; }
// menu: a slow orbit round the little blob; it lifts over anything tall between it and the blob
function occluded(px, pz, ph, bx, bz) { let worst = 0; const ax = bx - px, az = bz - pz, L2 = ax * ax + az * az || 1;
  for (const q of LAYOUT) { if (!q.alive || q.h < ph * .6) continue; const u = ((q.x - px) * ax + (q.z - pz) * az) / L2; if (u < -.1 || u > .95) continue; const d = Math.hypot(px + ax * u - q.x, pz + az * u - q.z); if (d < q.s * .8 + .6) worst = Math.max(worst, q.h); } return worst; }
function menuCam(tp, tl) { const b = Q.b, a = VW / VH, pv = a < 1; const s = S.gt * .12; const D = 5 + b.r * 7; const px = b.x + Math.sin(s) * D, pz = b.z + Math.cos(s) * D; let h = 2.4 + b.r * 2.6;
  if ((S.occT = (S.occT || 0) - 1) <= 0) { S.occT = 6; S.occH = occluded(px, pz, h, b.x, b.z); } const lift = S.occH ? S.occH * 1.25 + 1.5 : 0; S.mLift = lerp(S.mLift || 0, lift, .04); h += S.mLift;
  tp.set(px, h, pz); tl.set(b.x, b.r * (pv ? 1.6 : 1.1), b.z); return pv ? 66 : 48; }
function introCam(tp, tl) { const it = S.introT, pv = VW < VH, b = Q.b;
  if (S.intro.stage < 1) { const k = smooth(it / 2.6); const ch = S.cineObj; // low and close, south-east of the church, the moon behind the tower; pushing in
    tp.set(ch.x + lerp(30, 22, k), lerp(3, 6, k), ch.z + lerp(48, 38, k) * (pv ? 1.15 : 1)); tl.set(ch.x - 2, lerp(16, 15, k), ch.z - 4); return pv ? 78 - k * 6 : 58 - k * 4; }
  const k = smooth((it - 2.6) / 1.2); const fp = new THREE.Vector3(), fl = new THREE.Vector3(); const f2 = menuCam(fp, fl);
  tp.set(b.x + 1.2 - k * .4, .7 + k * .3, b.z + 2.4 + k * .3); tl.set(b.x, b.r * .6, b.z - 1.5); return lerp(pv ? 70 : 52, f2, 0); }
function updateCamera(dt) {
  const tp = new THREE.Vector3(), tl = new THREE.Vector3(); let fov = 55, rate = 4;
  if (S.state === 'menu' || S.state === 'end' || S.state === 'handover') { fov = menuCam(tp, tl); rate = 2; }
  else if (S.state === 'intro') { fov = introCam(tp, tl); rate = 30; }
  else if (Q && S.cine && S.cineObj) { const k = smooth(clamp(Q.gulpT / GULP_LEN, 0, 1)); fov = cineCam(tp, tl, S.cineObj, k); rate = 3; }
  else fov = playCam(tp, tl, dt);
  S.punch = fin(S.punch) * Math.exp(-dt * 5); S.shake = fin(S.shake) * Math.exp(-dt * 6); fov += S.punch * -3;
  if (camSnap) { camPos.copy(tp); camLook.copy(tl); camSnap = false; } else { const kk = 1 - Math.exp(-dt * rate); camPos.lerp(tp, kk); camLook.lerp(tl, Math.min(1, kk * 1.4)); }
  const sh = S.shake * .06 * (1 + (Q ? Q.b.r * .3 : 0)); camera.position.copy(camPos).add(_sp.set(Math.sin(S.gt * 53) * sh, Math.cos(S.gt * 47) * sh, 0)); if (camera.position.y < .25) camera.position.y = .25; camera.lookAt(camLook);
  if (S.camOv) { camera.position.set(...S.camOv.p); camera.lookAt(_sp.set(...S.camOv.l)); fov = S.camOv.f; }
  camera.fov = clamp(fin(fov, 55), 30, 95); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); }
// ---------------- input: drag anywhere = a virtual stick ----------------
const stick = { id: null, x0: 0, y0: 0, x: 0, y: 0, on: false };
function stickDir() { if (!stick.on) return [0, 0]; let dx = stick.x - stick.x0, dy = stick.y - stick.y0; const R = Math.max(40, Math.min(70, Math.min(VW, VH) * .12)); const l = Math.hypot(dx, dy); if (l < 4) return [0, 0]; const m = Math.min(1, l / R); return [dx / l * m, -dy / l * m]; }
function stickOff() { stick.on = false; stick.id = null; $('stick').classList.remove('show'); }
function drawStick() { const el = $('stick'); if (!stick.on || S.state !== 'play') { el.classList.remove('show'); return; } el.classList.add('show'); el.style.left = stick.x0 + 'px'; el.style.top = stick.y0 + 'px'; const [sx, sy] = stickDir(); const R = Math.max(40, Math.min(70, Math.min(VW, VH) * .12)); $('knob').style.transform = `translate(${(sx * R).toFixed(1)}px, ${(-sy * R).toFixed(1)}px)`; }
canvas.addEventListener('pointerdown', e => { if (S.state !== 'play' || !Q) return; e.preventDefault(); if (e.pointerType === 'touch' && !isTouch) { isTouch = true; applyLang(); }
  stick.id = e.pointerId; stick.on = true; stick.x0 = stick.x = e.clientX; stick.y0 = stick.y = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} A.unlock(); hideHint(); });
canvas.addEventListener('pointermove', e => { if (stick.id !== e.pointerId || !stick.on) return; stick.x = e.clientX; stick.y = e.clientY; // the stick base follows a finger that drags far (no dead end)
  const R = Math.max(40, Math.min(70, Math.min(VW, VH) * .12)) * 1.6, dx = stick.x - stick.x0, dy = stick.y - stick.y0, l = Math.hypot(dx, dy); if (l > R) { stick.x0 = stick.x - dx / l * R; stick.y0 = stick.y - dy / l * R; } });
const up = e => { if (stick.id === e.pointerId) stickOff(); }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('contextmenu', e => e.preventDefault());
const keys = new Set();
window.addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') return; const k = e.key;
  if (S.state === 'intro' && !e.repeat && (k === ' ' || k === 'Enter')) { e.preventDefault(); playNow(); return; }
  if (S.state === 'handover' && (k === ' ' || k === 'Enter')) { e.preventDefault(); $('btnGo').click(); return; }
  if (k === 'Escape') { if (S.state === 'play') { endRun('quit'); toMenu(); } else if (S.more) { S.more = false; setUI(); } else if (S.state === 'end') toMenu(); return; }
  if (S.state === 'menu' && !S.more && (k === 'Enter' || k === ' ')) { e.preventDefault(); $('btnPlay').click(); return; }
  if (S.state !== 'play') return; const kl = k.toLowerCase(); if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(kl)) { e.preventDefault(); keys.add(kl); hideHint(); } });
window.addEventListener('keyup', e => keys.delete((e.key || '').toLowerCase())); window.addEventListener('blur', () => { keys.clear(); stickOff(); });
// stick (screen: x right, y up) → world, relative to the camera's heading
function steer() { if (!Q || S.state !== 'play') return; let [sx, sy] = stickDir();
  if (keys.size) { sx = 0; sy = 0; if (keys.has('arrowleft') || keys.has('a')) sx--; if (keys.has('arrowright') || keys.has('d')) sx++; if (keys.has('arrowup') || keys.has('w')) sy++; if (keys.has('arrowdown') || keys.has('s')) sy--; const l = Math.hypot(sx, sy) || 1; sx /= l; sy /= l; }
  if (S.auto) return; if (S.testWorld) { Q.setStick(S.testWorld[0], S.testWorld[1]); return; } if (S.testStick) [sx, sy] = S.testStick;
  const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), rx = -Math.cos(S.yaw), rz = Math.sin(S.yaw); Q.setStick(fx * sy + rx * sx, fz * sy + rz * sx); }
// ---------------- UI ----------------
const nightName = () => `${t('night')} ${ROMAN[S.night]} · ${t('n' + S.night)}`;
function modeName() { return S.mode === 'duel' ? t('duelT') : S.mode === 'endless' ? t('endless') : nightName(); }
const goalNeed = () => Q && Q.goalObj ? Q.goalObj.s / Q.D.eatK : 0;
function setUI() { const st = S.state; const b = document.body; b.dataset.state = st; b.dataset.mode = S.mode; b.dataset.kids = S.kids ? '1' : '0'; b.classList.toggle('touch', isTouch);
  if (st !== 'menu') S.more = false; $('menu').classList.toggle('show', st === 'menu'); $('more').classList.toggle('show', st === 'menu' && !!S.more); b.dataset.more = S.more ? '1' : '0'; $('btnGear').setAttribute('aria-expanded', S.more ? 'true' : 'false');
  $('end').classList.toggle('show', st === 'end'); $('handover').classList.toggle('show', st === 'handover');
  if (st !== 'play' || !Q) { delete b.dataset.phase; b.classList.remove('cine'); return; }
  b.dataset.phase = Q.state; b.classList.toggle('cine', !!S.cine);
  $('hScore').textContent = fmt(Q.score); $('hSize').textContent = fmtM(Q.b.r); const mult = 1 + Math.min(4, Math.floor((Q.combo - 1) / 4)); const hot = Q.t - Q.lastEat < .8 && Q.combo > 1;
  $('hCombo').textContent = hot ? `${Q.combo} ×${mult}` : '–'; $('cCombo').classList.toggle('hot', hot && mult >= 2);
  const dawn = clamp(Q.left / Math.max(1, Q.T), 0, 1); $('dawnB').style.transform = `scaleX(${dawn.toFixed(4)})`; $('dawnRow').classList.toggle('low', dawn < .2 && !Q.D.noFail);
  if (Q.goalObj) { const need = goalNeed(), k = clamp(Q.b.r / need, 0, 1); $('goalB').style.transform = `scaleX(${k.toFixed(4)})`; $('goalRow').classList.toggle('ready', k >= 1); $('goalN').textContent = k >= 1 ? '✔ ' + t(Q.goalObj.type) : `${t(Q.goalObj.type)} · ${fmtM(need)}`; $('goalRow').style.display = ''; }
  else { $('goalRow').style.display = 'none'; }
  $('mNight').textContent = S.mode === 'endless' ? t('endless') : S.mode === 'duel' ? `${t(S.player ? 'p2' : 'p1')} · ${t('n' + S.night)}` : nightName(); $('mNightR').textContent = S.kids ? t('kidsT') : t(S.diff); }
function applyLang() { document.documentElement.lang = S.lang; document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t)); $('btnLang').textContent = S.lang === 'en' ? 'DE' : 'EN'; $('btnLang').setAttribute('aria-label', S.lang === 'en' ? 'Deutsch' : 'English');
  $('keysTip').textContent = t('keysHint'); $('oSub').textContent = t('countdown'); $('btnSkip').textContent = t(isTouch ? 'tapPlay' : 'clickPlay');
  $('btnKids').classList.toggle('on', S.kids); $('btnKids').setAttribute('aria-pressed', S.kids ? 'true' : 'false');
  document.querySelectorAll('#diff button').forEach(b => b.classList.toggle('on', !S.kids && b.dataset.d === S.diff)); document.querySelectorAll('#nights button').forEach(b => b.classList.toggle('on', +b.dataset.n === S.night));
  $('playL').textContent = `${nightName()} · ${S.kids ? t('kidsT') : t(S.diff)}`; const m = A.isMuted(); $('btnSound').textContent = m ? '🔇' : '🔊'; $('btnSound2').textContent = t(m ? 'soundOff' : 'soundOn'); qLabels();
  if (S.state === 'end') showEnd(); if (S.state === 'handover') { $('hoT').textContent = t('duelTurn2'); $('hoS').textContent = `${t('p1')}: ${fmt(S.duel[0] ? S.duel[0].score : 0)}`; } showHintText(); setUI(); }
function showEnd() { const r = S.result, duel = S.mode === 'duel'; let title;
  if (duel && S.duel[0] && S.duel[1]) { const a = S.duel[0].score, b = S.duel[1].score; title = a > b ? t('duelWin1') : b > a ? t('duelWin2') : t('duelTie'); }
  else title = r === 'win' ? `🟢 ${t('win')} ${Q && Q.goalObj ? t(Q.goalObj.type) : ''}`.trim() : r === 'fail' ? `🌅 ${t('fail')}` : r === 'over' ? `🌅 ${t('endlessEnd')}` : t('quitT');
  $('eTitle').textContent = title; $('eMode').textContent = `${modeName()} · ${S.kids ? t('kidsT') : t(S.diff)}`; $('eScore').textContent = duel && S.duel[1] ? `${fmt(S.duel[0].score)} : ${fmt(S.duel[1].score)}` : fmt(Q ? Q.score : 0);
  $('eStars').innerHTML = S.mode === 'night' && r === 'win' ? [0, 1, 2].map(i => `<i class="${i < S.stars ? 'on' : ''}">★</i>`).join('') : '';
  $('eBest').textContent = duel ? '' : S.newBest ? t('newBest') : `${t('bestL')}: ${fmt(+ls.get(bestKey(), '0') || 0)}`;
  $('eStats').innerHTML = duel && S.duel[0] && S.duel[1] ? [0, 1].map(i => `<div><b>${t(i ? 'p2' : 'p1')}</b> 🟢 ${fmtM(S.duel[i].d / 2)} · 🍬 ${S.duel[i].gulps} · 🔗 ${S.duel[i].best}</div>`).join('')
    : Q ? `<div>🟢 ${t('stSize')}: <b>${fmtM(Q.b.r)}</b> · 🍬 ${t('stGulps')}: <b>${Q.gulps}</b></div><div>🔗 ${t('stBest')}: <b>${Q.bestCombo}</b>${Q.biggest ? ` · 🏆 ${t('stBiggest')}: <b>${t(Q.biggest.type)}</b>` : ''}</div>` : '';
  $('btnAgain').textContent = duel ? t('againD') : t('again'); $('eName').value = S.name; }
function showHintText() { $('hintT').textContent = t(isTouch ? 'hintTouch' : 'hintKeys'); const g = Q && Q.goalObj ? t('g' + NIGHTS.findIndex(n => n.goal === Q.goalObj.type)) : ''; $('hintG').textContent = g ? `${t('hintGoal')} ${g} 🎯` : t('endlessInfo'); }
function hideHint() { if (S.hintT < 0) return; S.hintT = -1; $('hint').classList.remove('show'); }
function popAt(txt, col, cls, at) { (window.__pops = window.__pops || []).push(txt); let x = 0, y = -VH * .08; if (at) { _sp.copy(at).project(camera); if (_sp.z < 1) { x = clamp(_sp.x * .5 * VW, -VW * .36, VW * .36); y = clamp(-_sp.y * .5 * VH, -VH * .3, VH * .25); } }
  const el = document.createElement('div'); el.className = 'pop ' + (cls || ''); el.textContent = txt; el.style.color = col; el.style.left = x + 'px'; el.style.top = y + 'px'; el.dataset.t0 = S.gt; $('pops').appendChild(el); const hw = el.offsetWidth * (cls === 'pbig' ? .62 : .55) + 8; if (hw * 2 < VW) el.style.left = clamp(x, -VW / 2 + hw, VW / 2 - hw) + 'px'; if ($('pops').children.length > 7) $('pops').firstChild.remove(); }
function banner(s) { if (!s) return; (window.__banners = window.__banners || []).push(s); const el = $('banner'); el.textContent = s; el.dataset.t0 = S.gt; el.classList.add('show'); el.style.transform = 'translate(-50%,-50%)'; el.dataset.fit = Math.min(1, innerWidth * .92 / Math.max(1, el.scrollWidth)).toFixed(3); }
function toast(s) { if (S.state !== 'play') return; const el = $('toast'); el.textContent = s; el.classList.add('show'); el.dataset.t0 = S.gt; }
function toScreen(p) { _sp.copy(p).project(camera); return { x: (_sp.x * .5 + .5) * VW, y: (-_sp.y * .5 + .5) * VH, z: _sp.z }; }
// the goal marker: floats over the night's giant; off screen it sits at the edge and points to it
function updateGoalMark() { const el = $('goalMark'); if (S.state !== 'play' || !Q || !Q.goalObj || !Q.goalObj.alive || S.cine) { el.style.display = 'none'; return; }
  const o = Q.goalObj, ready = Q.edible(o); const p = toScreen(_v.set(o.x, o.h + 1.2, o.z)); const behind = p.z > 1; let x = p.x, y = p.y; const m = 34, top = VH * .2, bot = VH * .8;
  let edge = behind || x < m || x > VW - m || y < top || y > bot; if (behind) { x = VW - x; y = bot; } x = clamp(x, m, VW - m); y = clamp(y, top, bot);
  el.style.display = 'flex'; el.style.left = x + 'px'; el.style.top = y + 'px'; el.classList.toggle('ready', ready); el.classList.toggle('edge', edge);
  const ang = Math.atan2(p.y - VH / 2, (behind ? VW - p.x : p.x) - VW / 2); $('goalArrow').style.transform = `rotate(${ang}rad)`; $('goalTxt').textContent = ready ? '🎯' : '🔒 ' + fmtM(goalNeed());
  if (ready && !S.readyShown) { S.readyShown = true; A.sfx.ready(); toast(t('readyTip', t(o.type))); } }
function updateOverlays() {
  const bn = $('banner'); if (bn.classList.contains('show')) { const a = S.gt - (+bn.dataset.t0), fit = +bn.dataset.fit || 1; const k = a < .18 ? a / .18 : a > 1.5 ? Math.max(0, 1 - (a - 1.5) / .3) : 1; bn.style.opacity = k; bn.style.transform = `translate(-50%,-50%) scale(${((a < .18 ? 1 + .4 * (1 - a / .18) : 1 + a * .02) * fit).toFixed(3)})`; if (a > 1.85) bn.classList.remove('show'); }
  const ts = $('toast'); if (ts.classList.contains('show') && S.gt - (+ts.dataset.t0) > 2.4) ts.classList.remove('show');
  if (S.state === 'play' && S.hintT >= 0) { const a = S.gt - S.hintT; $('hint').classList.toggle('show', a > .2 && a < 6.5 && !S.cine); if (a >= 6.5) hideHint(); }
  for (const el of [...$('pops').children]) { const a = S.gt - (+el.dataset.t0); if (a > 1.0) { el.remove(); continue; } el.style.opacity = a < .08 ? a / .08 : 1 - Math.max(0, (a - .6) / .4); el.style.transform = `translate(-50%,-50%) translateY(${-a * 44}px) scale(${a < .1 ? .6 + a / .1 * .5 : 1.1 - Math.min(.1, a * .2)})`; }
  const op = $('opening'); if (S.state === 'intro' && S.titleT >= 0) { const a = S.introT - S.titleT; const sIn = a < .28 ? 3.2 - 2.2 * smooth(a / .28) : 1; const rec = smooth((a - 1.6) / 2.2);
    op.style.opacity = a < .08 ? a / .08 : 1 - smooth((a - 2.6) / 1.0); $('oTitle').style.transform = `translateY(${-rec * VH * .14}px) scale(${(sIn * (1 - rec * .5)).toFixed(3)})`; } else if (S.state !== 'intro') op.style.opacity = 0;
  updateGoalMark(); drawStick(); }
function audioBadge() { document.body.dataset.audio = A.state() === 'running' ? 'on' : 'locked'; }
// ---------------- buttons ----------------
$('btnPlay').onclick = () => { A.unlock(); start('night'); };
$('btnGear').onclick = () => { if (S.state === 'play') return; A.unlock(); if (S.state !== 'menu') toMenu(); S.more = !S.more; A.sfx.ui(); setUI(); };
$('btnMoreX').onclick = $('moreBg').onclick = () => { S.more = false; A.sfx.ui(); setUI(); };
$('btnEndless').onclick = () => { A.unlock(); start('endless'); }; $('btnDuel').onclick = () => { A.unlock(); S.player = 0; start('duel'); };
document.querySelectorAll('#diff button').forEach(b => b.onclick = () => { S.diff = b.dataset.d; S.kids = false; ls.set('es-diff', S.diff); ls.set('es-kids', '0'); A.sfx.ui(); applyLang(); });
document.querySelectorAll('#nights button').forEach(b => b.onclick = () => { S.night = +b.dataset.n; ls.set('es-night', String(S.night)); A.sfx.ui(); applyLang(); });
$('btnKids').onclick = () => { S.kids = !S.kids; ls.set('es-kids', S.kids ? '1' : '0'); A.sfx.ui(); applyLang(); };
$('btnQ2').onclick = () => { const o = ['low', 'mid', 'high', 'ultra']; applyQuality(o[(o.indexOf(S.q) + 1) % o.length], true); A.sfx.ui(); };
$('btnIntro').onclick = () => { A.unlock(); startIntro(); };
$('btnLang').onclick = () => { S.lang = S.lang === 'en' ? 'de' : 'en'; ls.set('es-lang', S.lang); A.sfx.ui(); applyLang(); };
const toggleSound = () => { A.unlock(); A.setMuted(!A.isMuted()); ls.set('es-mute', A.isMuted() ? '1' : '0'); applyLang(); }; $('btnSound').onclick = toggleSound; $('btnSound2').onclick = toggleSound;
$('btnQuit').onclick = () => { if (S.state === 'play') endRun('quit'); toMenu(); };
$('btnAgain').onclick = () => { A.unlock(); if (S.mode === 'duel') { S.player = 0; start('duel'); } else start(S.mode); }; $('btnMenu').onclick = () => toMenu();
$('btnCard').onclick = () => saveCard(false); $('btnShare').onclick = () => saveCard(true);
$('btnGo').onclick = () => { A.unlock(); start('duel'); }; $('handover').addEventListener('click', e => { if (e.target.id !== 'btnGo') $('btnGo').click(); });
$('eName').addEventListener('keydown', e => e.stopPropagation()); $('eName').addEventListener('input', () => { S.name = ($('eName').value || '').slice(0, 18); });
if (ls.get('es-mute', '0') === '1') A.setMuted(true);
// ---- ONE TAP TO PLAY: the first tap/click anywhere on the opening goes straight into Night I (sound unlocks on that same tap) ----
let eatClick = 0;
function playNow() { if (S.state !== 'intro') return; A.unlock(); setTimeout(audioBadge, 60); endIntro(); start('night'); }
function introTap(e) { if (S.state !== 'intro' || (e.target && e.target.closest && e.target.closest('#top'))) return; if (e.pointerType === 'touch' && !isTouch) isTouch = true; eatClick = performance.now() + 450; playNow(); }
window.addEventListener('pointerup', introTap);
window.addEventListener('click', e => { if (performance.now() < eatClick) { e.stopPropagation(); e.preventDefault(); eatClick = 0; return; } introTap(e); }, true);
for (const ev of ['touchend', 'click', 'keydown', 'pointerup']) window.addEventListener(ev, () => { A.unlock(); setTimeout(audioBadge, 80); }, { capture: true, passive: true });
window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !isTouch) { isTouch = true; applyLang(); } }, { passive: true });
window.addEventListener('resize', resize);
// ---------------- share card (1080×1350, no URL): the blob with all its loot under the moon ----------------
async function makeCard() {
  S.name = ($('eName').value || '').trim().slice(0, 18) || 'Player'; ls.set('es-name', S.name); try { await document.fonts.load('700 40px Fredoka'); } catch (e) {}
  const CW = 1080, CH = 1350; renderer.setPixelRatio(1); renderer.setSize(CW, CH, false); composer.setPixelRatio(1); composer.setSize(CW, CH);
  const old = { a: camera.aspect, f: camera.fov, p: camera.position.clone(), q: camera.quaternion.clone() };
  const b = Q ? Q.b : { x: 0, z: 0, r: 1 }; const r = b.r; const dx = -MOON_DIR.x, dz = -MOON_DIR.z; // stand on the far side of the blob from the moon, looking up past it at the moon
  camera.aspect = CW / CH; camera.fov = 58; camera.position.set(b.x + dx * (r * 3.4 + 2.5), r * .55 + .4, b.z + dz * (r * 3.4 + 2.5)); camera.lookAt(b.x, r * 1.25, b.z); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  if (Q) updateWorld(W, Q, 0, S.gt, camera, {}); composer.render();
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const k = c.getContext('2d'); k.drawImage(renderer.domElement, 0, 0, CW, CH);
  camera.aspect = old.a; camera.fov = old.f; camera.position.copy(old.p); camera.quaternion.copy(old.q); resize();
  const gr = k.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, 'rgba(4,10,8,.88)'); gr.addColorStop(.2, 'rgba(4,10,8,.08)'); gr.addColorStop(.6, 'rgba(4,10,8,.05)'); gr.addColorStop(.73, 'rgba(4,10,8,.8)'); gr.addColorStop(1, 'rgba(4,10,8,.97)'); k.fillStyle = gr; k.fillRect(0, 0, CW, CH);
  const Fo = (w, s) => `${w} ${s}px Fredoka, "Arial Rounded MT Bold", sans-serif`; k.textAlign = 'center'; k.lineJoin = 'round';
  const txt = (s, x, y, fill, stroke = 'rgba(4,20,10,.9)', lw = 8) => { if (lw) { k.strokeStyle = stroke; k.lineWidth = lw; k.strokeText(s, x, y); } k.fillStyle = fill; k.fillText(s, x, y); };
  k.font = Fo(700, 128); txt('ECTOSWELL', CW / 2, 132, '#d8ffe2', 'rgba(4,40,16,.92)', 12);
  const duel = S.mode === 'duel' && S.duel[0] && S.duel[1];
  if (duel) { k.font = Fo(700, 112); txt(`${fmt(S.duel[0].score)} : ${fmt(S.duel[1].score)}`, CW / 2, 1040, '#f4fff6', 'rgba(4,30,12,.9)', 14); k.font = Fo(600, 50); txt($('eTitle').textContent, CW / 2, 1110, '#a8ffc0'); k.font = Fo(500, 34); txt(`${t('p1')} · ${t('p2')}`, CW / 2, 194, '#ffffff'); }
  else { k.font = Fo(600, 46); txt(`${modeName()} · ${S.kids ? t('kidsT') : t(S.diff)}`, CW / 2, 962, '#c8ffd6'); k.font = Fo(700, 150); txt(fmt(Q ? Q.score : 0), CW / 2, 1104, '#ffffff', 'rgba(4,30,12,.9)', 16);
    if (S.result === 'win' && S.mode === 'night') { k.font = Fo(700, 70); txt('★'.repeat(S.stars) + '☆'.repeat(3 - S.stars), CW / 2, 1182, '#ffd27a', 'rgba(30,20,0,.9)', 8); } else { k.font = Fo(600, 46); txt($('eTitle').textContent || '', CW / 2, 1178, '#a8ffc0'); }
    k.font = Fo(500, 34); txt(`${t('by')} ${S.name}`, CW / 2, 194, '#ffffff'); }
  // size badge
  k.save(); k.translate(CW - 168, 352); k.rotate(-.16); k.fillStyle = 'rgba(6,30,14,.92)'; k.strokeStyle = '#7dffa0'; k.lineWidth = 6; k.beginPath(); k.arc(0, 0, 116, 0, 7); k.fill(); k.stroke();
  k.font = Fo(700, 26); txt(S.lang === 'de' ? 'GRÖSSE' : 'SIZE', 0, -34, '#a8ffc0', 'rgba(0,0,0,0)', 0); k.font = Fo(700, 56); txt(fmtM(duel ? Math.max(S.duel[0].d, S.duel[1].d) / 2 : r), 0, 24, '#fff', 'rgba(0,0,0,0)', 0); k.font = Fo(600, 24); txt('🟢', 0, 66, '#fff', 'rgba(0,0,0,0)', 0); k.restore();
  const gul = duel ? S.duel[0].gulps + S.duel[1].gulps : Q ? Q.gulps : 0; k.font = Fo(600, 40); txt(`🍬 ${gul} · ${t('cardTag')}`, CW / 2, 1262, '#ffffff'); k.font = Fo(500, 30); txt(t('credit'), CW / 2, 1316, '#8fd8a4', 'rgba(0,0,0,0)', 0);
  return c; }
async function saveCard(share) { const c = await makeCard(); const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'my-ectoswell.png', { type: 'image/png' });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: `Ectoswell · ${t('cardTag')}` }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my-ectoswell.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast(t('saved')); }
// ---------------- simulation ----------------
let ambT = 5;
function beds() { const play = (S.state === 'play' || S.state === 'menu') && Q; const sp = Q ? Math.hypot(Q.b.vx, Q.b.vz) : 0, r = Q ? Q.b.r : 1; const k = Q ? clamp(sp / Q.maxSpeed(), 0, 1) : 0;
  A.loop('roll_loop', play && !S.cine ? k * (S.state === 'menu' ? .05 : .22) : 0, clamp(1.3 - Math.log2(r + 1) * .22, .5, 1.4), .3); A.loop('roll_heavy', play && r > 2.5 && !S.cine ? k * clamp((r - 2.5) / 6, 0, 1) * .35 : 0, clamp(1.1 - r * .02, .6, 1.1), .4);
  A.loop('wind', .06 + W.dawn * .05, 1, 1); A.loop('night_loop', .08 * (1 - W.dawn * .5), 1, 1.5); }
function ambient(dt) { ambT -= dt; if (ambT <= 0) { ambT = 7 + rng() * 9; const r = rng(); if (r < .3) A.sfx.owl(); else if (r < .55) A.sfx.crow(); else A.sfx.far(); } }
function step(dt) {
  dt = Math.max(0, Math.min(fin(dt), 1 / 20));
  let want = 1; if (Q && S.cine && Q.state === 'gulp') { const u = Q.gulpT; want = u < .1 ? 1 : u < 1.8 ? .38 : lerp(.38, 1, smooth((u - 1.8) / .8)); }
  S.ts = clamp(fin(want, 1), .05, 1.5); const gdt = dt * S.ts; S.gt += gdt;
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i] && timers[i].t <= S.gt) { const f = timers[i].f; timers.splice(i, 1); f(); }
  for (const k of ['flash', 'glow', 'dawn']) if (!Number.isFinite(W[k])) W[k] = k === 'glow' ? 1 : 0; for (const k of ['punch', 'shake', 'yaw']) if (!Number.isFinite(S[k])) S[k] = 0;
  if (S.state === 'play' && Q) { const near = Q.goalObj ? Q.b.r / goalNeed() : 0; music.I = clamp(Q.combo / 16 + (near >= 1 ? .45 : near * .25) + (Q.left / Q.T < .2 && !Q.D.noFail ? .3 : 0), 0, 1); music.vol = S.cine ? .2 : 1; } else { music.I = .2; music.vol = 1; } music.step(S.gt);
  ambient(gdt); beds();
  if (S.state === 'intro') { S.introT += dt; const it = S.introT;
    if (S.intro.stage === 0) { Q.gulpT = Math.min(Q.gulpT, GULP_LEN - .6); Q.step(gdt); Q.ev = []; W.glow = Math.max(W.glow, 1.6); if (it > 2.6) { S.intro.stage = 1; A.sfx.rewind(); W.flash = .6; S.cine = 0; camSnap = true; // the rewind: back to a marble-sized blob next to one candy
        Q = newRoll({ mode: 'night', night: 0, kids: true }); Q.state = 'roll'; Q.goalObj = null; const c = LAYOUT.find(o => o.alive && o.type === 'candy' && Math.hypot(o.x - Q.b.x, o.z - Q.b.z) < 9); if (c) { Q.b.x = c.x; Q.b.z = c.z + 1.6; S.introCandy = c; } resetVisuals(); W.flash = .5; S.intro.stage = 1; } }
    else { if (S.introCandy) { const c = S.introCandy; const dx = c.x - Q.b.x, dz = c.z - Q.b.z, l = Math.hypot(dx, dz) || 1; Q.setStick(it > 3.0 ? dx / l * .6 : 0, it > 3.0 ? dz / l * .6 : 0); } Q.step(gdt); if (Q.ev.some(e => e.type === 'eat')) { A.sfx.gulp({ o: { s: .4, type: 'candy' }, r: .3, combo: 1 }, 0); W.mouthOpen = 1; } Q.ev = [];
      if (it >= 3.55 && S.intro.stage < 3) { S.intro.stage = 3; S.titleT = it; A.sfx.title(); W.flash = .25; S.punch = .7; } }
    if (S.titleT >= 0 && it - S.titleT > 3.6) toMenu(); }
  else if (S.state === 'play' && Q) { const was = Q.state; steer(); if (S.auto) botStep(Q, gdt, S.botSt = S.botSt || {}, S.botOpt); Q.step(gdt); handleEvents(); if (Q && Q.state !== was) setUI();
    W.dawn = Q.D.noFail ? 0 : clamp(1 - Q.left / Math.min(Q.T, 60), 0, 1) * .85; }
  else if (Q) { botStep(Q, gdt, S.menuBot = S.menuBot || {}, { acc: .8, react: .6, speed: .55 }); Q.step(gdt); handleEvents(); if (Q.b.r > 1.6) { const keep = Q.b.x, kz = Q.b.z; Q = menuRoll(); Q.b.x = keep; Q.b.z = kz; } }
  W.flash = fin(W.flash) * Math.exp(-gdt * 2.2); W.glow = 1 + (fin(W.glow, 1) - 1) * Math.exp(-gdt * (S.cine ? .3 : 1.2));
  updateCamera(dt);
  if (Q) updateWorld(W, Q, gdt, S.gt, camera, { face: S.state !== 'intro' || S.intro.stage > 0 }); updateFX(F, gdt, VH * 1.5 * renderer.getPixelRatio());
  bloom.strength = .62 * QUALITY[S.q].bloom * (1 + W.flash * .3); const gu = gradePass.uniforms; gu.uFlash.value = W.flash; gu.uDawn.value = W.dawn;
  updateOverlays(); if ((S.uiT = (S.uiT || 0) + dt) > .1) { S.uiT = 0; setUI(); } }
function render() { composer.render(); }
const fps = { n: 0, acc: 0, frames: 0, bad: 0, since: 0 };
function fpsTick(dt) { if (document.hidden) return; fps.since += dt; if (fps.since < 6 || dt > .25) return; fps.acc += dt; fps.frames++;
  if (fps.acc >= 1) { const f = fps.frames / fps.acc; fps.acc = 0; fps.frames = 0; fps.n++; fps.bad = f < 32 ? fps.bad + 1 : 0; fps.last = f;
    if (!S.qUser && !window.__esNoAutoQ && fps.bad >= 4 && S.q !== 'low') { const o = ['low', 'mid', 'high', 'ultra']; const nq = o[o.indexOf(S.q) - 1]; applyQuality(nq); toast(`${t('autoQ')} ${t('q_' + nq)} (${Math.round(f)} fps)`); fps.bad = 0; fps.since = 0; } } }
applyQuality(S.q); resize();
let last = performance.now();
function advance(now) { const dt = Math.max(0, (now - last) / 1000) || 0; last = Math.max(last, now || 0); if (!window.__esManual) { step(dt); fpsTick(dt); } return dt; }
function frameLoop(now) { advance(now); if (!window.__esManual) render(); requestAnimationFrame(frameLoop); }
if (window.__esSkipIntro) { startIntro(); toMenu(); } else startIntro();
applyLang(); audioBadge();
step(0); requestAnimationFrame(frameLoop);
window.__es = { S, W, F, step: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); render(); }, stepq: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); }, render, log: A.log, quality: q => q ? applyQuality(q, true) : S.q, renderer,
  start, end: endRun, toMenu, startIntro, endIntro, playNow, roll: () => Q, auto: (v, opt) => { S.auto = !!v; S.botSt = {}; if (opt) S.botOpt = opt; if (!v && Q) Q.setStick(0, 0); }, setStick: (x, y) => { S.testStick = x === null ? null : [x, y]; }, worldStick: (x, z) => { S.testWorld = x === null ? null : [x, z]; },
  setUI, applyLang, handleEvents, card: saveCard, cardURL: async () => (await makeCard()).toDataURL('image/jpeg', .9), fps, fpsTick, advance, last: () => last, play: A.play, sfx: A.sfx, audioState: A.state,
  mem: () => ({ ...renderer.info.memory, programs: renderer.info.programs ? renderer.info.programs.length : 0 }), screen: (x, y, z) => toScreen(new THREE.Vector3(x, y, z)), cam: () => ({ p: camera.position.toArray(), fov: camera.fov }),
  blobScreen: () => Q ? toScreen(new THREE.Vector3(Q.b.x, Q.b.r, Q.b.z)) : null, blobRadiusPx: () => { if (!Q) return 0; const a = toScreen(new THREE.Vector3(Q.b.x, Q.b.r, Q.b.z)), b2 = toScreen(_w.set(Q.b.x, Q.b.r * 2, Q.b.z)); return Math.abs(a.y - b2.y); },
  aheadScreen: () => { if (!Q) return null; const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), r = Q.b.r; return [2, 4, 7].map(k => toScreen(new THREE.Vector3(Q.b.x + fx * (r * k + 1), 0, Q.b.z + fz * (r * k + 1)))); },
  goalScreen: () => Q && Q.goalObj ? toScreen(new THREE.Vector3(Q.goalObj.x, Q.goalObj.h * .5, Q.goalObj.z)) : null, sparks: () => { let n = 0; for (let i = 0; i < F.life.length; i++) if (F.life[i] > 0) n++; return n; }, _dbg: { scene, camera, composer, bloom, THREE } };
try { const hid = []; scene.traverse(o => { if (!o.visible) { hid.push(o); o.visible = true; } }); renderer.compile(scene, camera); hid.forEach(o => { o.visible = false; }); } catch (e) {}
document.body.classList.add('ready');
