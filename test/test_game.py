"""Ectoswell – full headless test suite (Chrome + SwiftShader WebGL over a local web server).
Run: python3 test/test_game.py   (exit code 0 = all checks passed; screenshots → test/shots/)"""
SUR = bytes([79, 116, 116, 111]).decode()  # the surname that must never appear (spelled as bytes so this file stays clean)
FAM = [bytes(x).decode() for x in ([84, 104, 101, 111, 100, 111, 114], [77, 97, 114, 116, 104, 97], [69, 108, 105, 115, 97, 98, 101, 116, 104], [65, 110, 110, 97])]
# third-party names / phrases that must never appear in visible text
TM = r'candy|katamari|damacy|ghostbusters|ecto-?1|slimer|gobble|blob\s*(?:the|bros)|agar\.io|hole\.io|donut\s*county|saga|crush|haunted\s*mansion|whac|grok(?!\s*bot)|howl|luigi|ghostbusters|phasmophobia|pac-?man|casper|boo\s*radley|hide\s*(?:and|&|n)\s*seek|marco\s*polo|slender|five\s*nights|poltergeist|beetlejuice|who\s*you\s*gonna'
import asyncio, os, re, glob, json, sys
from playwright.async_api import async_playwright
import threading, http.server, functools, socketserver
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class _Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
_srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); _srv.daemon_threads = True
threading.Thread(target=_srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/index.html' % _srv.server_address[1]
OUT = ROOT + '/test/shots/'; os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
R = []
def check(n, ok, info=''): R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f' — {info}' if info != '' else ''), flush=True)
CLEAR = "try{if(!sessionStorage.getItem('esInit')){sessionStorage.setItem('esInit','1'); localStorage.clear();}}catch(e){}"
TXT = "window.__txt=[];(function(){const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(s,...a){try{window.__txt.push(String(s))}catch(e){}return f.call(this,s,...a)};})();"
async def page(b, skip=False, manual=True, locale='en-US', vp=(1280, 800)):
    ctx = await b.new_context(accept_downloads=True, locale=locale, viewport={'width': vp[0], 'height': vp[1]})
    init = 'window.__esSeed = 4242; window.__esPDB = true; window.__esNoAutoQ = true;' + ('window.__esManual = true;' if manual else '') + ('window.__esSkipIntro = true;' if skip else '') + CLEAR + TXT
    await ctx.add_init_script(init)
    pg = await ctx.new_page(); pg.set_default_timeout(300000); logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR {e}'))
    await pg.goto(URL); await pg.wait_for_function('document.body.classList.contains("ready") && window.__es', timeout=120000)
    return ctx, pg, logs
def pxs(im): return im.get_flattened_data() if hasattr(im, 'get_flattened_data') else list(im.getdata())
def mean(path): im = Image.open(path).convert('L'); px = pxs(im); return sum(px) / len(px)
def diff(a, b):
    A = Image.open(a).convert('L').resize((160, 100)); B = Image.open(b).convert('L').resize((160, 100)); pa, pb = pxs(A), pxs(B); return sum(abs(x - y) for x, y in zip(pa, pb)) / len(pa)
def white_share(path):
    im = Image.open(path).convert('RGB').resize((200, 125)); px = pxs(im); return sum(1 for r, g, b in px if r > 245 and g > 245 and b > 245) / len(px)
async def ev(pg, js): return await pg.evaluate(js)
async def shot(pg, name, n=1):
    await pg.evaluate(f'__es.step(1/30, {n})')
    for k in (1, 2):
        try: await pg.screenshot(path=OUT + name, timeout=180000 if k == 1 else 240000); return OUT + name
        except Exception as e:
            if k == 2 or 'Timeout' not in str(e): raise
            print(f'RETRY screenshot {name} (capture timeout)', flush=True); await pg.evaluate('__es.step(1/30, 1)')
async def run_until(pg, cond, frames=3000, dt='1/30'):
    return await ev(pg, f'(() => {{ for (let i = 0; i < {frames}; i++) {{ if ({cond}) return i; __es.stepq({dt}, 1); }} return ({cond}) ? {frames} : -1; }})()')
HITTEST = "(ids => ids.map(id => { const el = document.getElementById(id); const r = el.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return [id, Math.round(r.width), Math.round(r.height), !!e && (e === el || el.contains(e))]; }))"
GO = "(() => { const Q = __es.roll(), g = Q.goalObj; __es.worldStick(g.x - Q.b.x, g.z - Q.b.z); })()"
TOGOAL = "(() => { __es.auto(false); __es.setStick(null); __es.worldStick(null); const Q = __es.roll(), g = Q.goalObj; Q.growTo(g.s / Q.D.eatK + .05); Q.b.x = g.x; Q.b.z = g.z + g.s + Q.b.r + 4; Q.b.vx = Q.b.vz = 0; })()"
GULP = "(() => { const Q = __es.roll(); for (let i = 0; i < 400 && Q.state !== 'gulp'; i++) { " + GO[7:-3] + " __es.stepq(1/30, 1); } __es.worldStick(null); return Q.state; })()"
import math
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        # ================= 1) the opening: the Big Gulp from frame 0, rewind, title, one click → play =================
        ctx, pg, logs = await page(b)
        await shot(pg, 'o0.png', 1)
        st = await ev(pg, '[__es.S.state, __es.roll().state, +__es.roll().b.r.toFixed(1), __es.roll().gulpObj && __es.roll().gulpObj.type, __es.roll().stuck.length, __es.S.cine, document.title, __es.S.lang]')
        check('frame 0 is mid-BIG GULP: a giant blob (r > 10) full of stuck houses/trees swallowing the church – not black, no title card', st[0] == 'intro' and st[1] == 'gulp' and st[2] > 10 and st[3] == 'church' and st[4] >= 40 and mean(OUT + 'o0.png') > 30, (st, round(mean(OUT + 'o0.png'), 1)))
        check('page title + English by default for en-US', 'Ectoswell' in st[6] and st[7] == 'en', st[6:])
        await shot(pg, 'o1.png', 8); check('the opening moves from frame 0 (frames differ)', diff(OUT + 'o0.png', OUT + 'o1.png') > 2, round(diff(OUT + 'o0.png', OUT + 'o1.png'), 2))
        n = await run_until(pg, '__es.S.titleT >= 0', 300)
        r = await ev(pg, '[+__es.roll().b.r.toFixed(2), __es.roll().state]')
        check('then it rewinds to a marble-sized blob next to one sweet, and the ECTO/SWELL title lands', n >= 0 and r[0] < .6 and r[1] == 'roll', (n, r))
        await shot(pg, 'o2.png', 6)
        n2 = await run_until(pg, '__es.S.state === "menu"', 400)
        check('after the opening the start screen with ONE big PLAY button appears', n2 >= 0 and await ev(pg, 'document.getElementById("menu").classList.contains("show")'), n2)
        await shot(pg, 'menu.png', 30); await pg.wait_for_timeout(900)
        hit = await ev(pg, HITTEST + '(["btnPlay", "btnGear", "btnLang"])')
        check('PLAY is big (≥ 260×64 px), gear + language ≥ 44 px, all really clickable', hit[0][1] >= 260 and hit[0][2] >= 64 and all(h[1] >= 44 and h[2] >= 44 and h[3] for h in hit), hit)
        pb = await ev(pg, '(() => { const r = document.getElementById("btnPlay").getBoundingClientRect(); return [r.top / innerHeight, r.bottom <= innerHeight]; })()')
        check('PLAY sits in the lower half (thumb zone) and fully on screen', pb[0] > .45 and pb[1], pb)
        check('no scrolling (page fits the viewport)', await ev(pg, 'document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1'))
        await ctx.close()
        # one click anywhere on the opening → straight into Night I with sound
        ctx, pg, logs = await page(b)
        await ev(pg, '__es.step(1/30, 10)'); await pg.mouse.click(640, 300); await ev(pg, '__es.stepq(1/30, 10)')
        st = await ev(pg, '[__es.S.state, __es.S.mode, __es.S.night, __es.audioState(), document.getElementById("hint").classList.contains("show"), __es.roll().state]')
        check('one click anywhere on the opening → playing Night I immediately, audio unlocked, short hint shown', st[0] == 'play' and st[1] == 'night' and st[2] == 0 and st[3] == 'running' and st[4], st)
        await shot(pg, 'p0.png', 30)
        # ================= 2) controls =================
        await ev(pg, '__es.stepq(1/30, 40)')
        r0 = await ev(pg, '[__es.roll().b.x, __es.roll().b.z, __es.S.yaw]')
        await pg.keyboard.down('ArrowUp'); await ev(pg, '__es.stepq(1/30, 30)'); await pg.keyboard.up('ArrowUp')
        r1 = await ev(pg, '[__es.roll().b.x, __es.roll().b.z]')
        fwd = (r1[0] - r0[0]) * math.sin(r0[2]) + (r1[1] - r0[1]) * math.cos(r0[2])
        check('keyboard: ↑ rolls the blob forward (away from the camera)', fwd > 1.0, (round(fwd, 2), r1))
        await ev(pg, '__es.stepq(1/30, 60)')
        r0 = await ev(pg, '[__es.roll().b.x, __es.roll().b.z]')
        await pg.mouse.move(640, 600); await pg.mouse.down(); await pg.mouse.move(640, 520, steps=4); await ev(pg, '__es.step(1/30, 1)')
        sv = await ev(pg, '[document.getElementById("stick").classList.contains("show"), document.getElementById("stick").style.left]')
        await ev(pg, '__es.stepq(1/30, 30)'); await pg.mouse.up()
        r1 = await ev(pg, '[__es.roll().b.x, __es.roll().b.z]')
        check('drag anywhere: a virtual stick appears under the finger and the blob rolls', sv[0] and sv[1] == '640px' and math.hypot(r1[0] - r0[0], r1[1] - r0[1]) > 1, (sv, r0, r1))
        # ================= 3) gulping, chains, bumping =================
        await ev(pg, '__es.auto(true, {acc: .95, react: .3})')
        r = await ev(pg, '(() => { const Q = __es.roll(); const r0 = Q.b.r; __es.stepq(1/30, 600); return [Q.gulps, Q.score, +r0.toFixed(2), +Q.b.r.toFixed(2), Q.bestCombo, (window.__pops || []).length, __es.log.length]; })()')
        check('rolling over smaller things gulps them: score, size and gulp chains grow, pops + sounds fire', r[0] >= 15 and r[1] > 100 and r[3] > r[2] * 1.5 and r[4] >= 3 and r[5] > 0 and r[6] > 10, r)
        await shot(pg, 'p1.png', 2)
        hud = await ev(pg, '[document.getElementById("hScore").textContent, document.getElementById("hSize").textContent, document.getElementById("goalN").textContent]')
        check('HUD shows score, size (m) and the goal with the size it needs', hud[0] not in ('', '0') and ' m' in hud[1] and 'Giant Pumpkin' in hud[2], hud)
        gm = await ev(pg, '[getComputedStyle(document.getElementById("goalMark")).display, document.getElementById("goalTxt").textContent]')
        check('goal marker shows where the giant is (🔒 + size while too small)', gm[0] == 'flex' and ('🔒' in gm[1] or '🎯' in gm[1]), gm)
        r = await ev(pg, """(() => { __es.auto(false); const Q = __es.roll(); Q.growTo(2.2); __es.stepq(1/30, 1); const h = Q.objs.filter(o => o.alive && !Q.edible(o) && o.s < Q.b.r * 2.5 && o.type !== 'church').sort((a, b) => Math.hypot(a.x - Q.b.x, a.z - Q.b.z) - Math.hypot(b.x - Q.b.x, b.z - Q.b.z))[0];
          const k0 = Q.bumps; Q.b.x = h.x; Q.b.z = h.z + h.s + Q.b.r + 3; Q.b.vx = 0; Q.b.vz = -Q.maxSpeed(); __es.worldStick(0, -1); let i = 0; for (; i < 120 && Q.bumps === k0; i++) __es.stepq(1/30, 1); __es.worldStick(null);
          return [h.type, Q.bumps - k0, Q.lost, Q.b.z > h.z]; })()""")
        check('things that are too big bump you back', r[1] >= 1 and r[3], r)
        # ================= 4) THE BIG GULP =================
        await ev(pg, TOGOAL); await ev(pg, '__es.step(1/30, 2); __es.setUI()')
        gm = await ev(pg, '[document.getElementById("goalMark").className, document.getElementById("goalRow").className]')
        check('big enough → goal marker + goal bar turn ready', 'ready' in gm[0] and 'ready' in gm[1], gm)
        s = await ev(pg, GULP); await ev(pg, '__es.stepq(1/30, 1)')
        r = await ev(pg, '[__es.roll().state, __es.S.cine, __es.S.cineObj && __es.S.cineObj.type, (window.__banners || []).slice(-1)[0]]')
        check('rolling into the giant triggers THE BIG GULP cinematic', s == 'gulp' and r[0] == 'gulp' and r[1] and r[2] == 'bigpump' and 'BIG GULP' in (r[3] or ''), (s, r))
        await shot(pg, 'g0.png', 10); ts = await ev(pg, '+__es.S.ts.toFixed(2)')
        check('slow motion during the Big Gulp', ts < .6, ts)
        await shot(pg, 'g1.png', 25); await shot(pg, 'g2.png', 30)
        check('Big Gulp frames are bright and moving (not black, not frozen)', mean(OUT + 'g1.png') > 30 and diff(OUT + 'g0.png', OUT + 'g2.png') > 2, (round(mean(OUT + 'g1.png'), 1), round(diff(OUT + 'g0.png', OUT + 'g2.png'), 2)))
        n = await run_until(pg, '__es.S.state === "end"', 900)
        await shot(pg, 'end.png', 30); await pg.wait_for_timeout(700)
        r = await ev(pg, '[__es.S.result, __es.S.stars, document.getElementById("end").classList.contains("show"), document.getElementById("eTitle").textContent, document.querySelectorAll("#eStars i.on").length]')
        check('after the gulp the night is won: end panel with title, score and 1–3 stars', n >= 0 and r[0] == 'win' and 1 <= r[1] <= 3 and r[2] and 'Giant Pumpkin' in r[3] and r[4] == r[1], (n, r))
        hit = await ev(pg, HITTEST + '(["btnAgain", "btnMenu", "btnCard", "btnShare"])')
        check('end buttons ≥ 44 px and clickable', all(h[1] >= 44 and h[2] >= 44 and h[3] for h in hit), hit)
        # ================= 5) nights, difficulties, kids, endless, duel =================
        r = await ev(pg, """(() => { const o = []; for (const n of [0, 1, 2]) { __es.toMenu(); document.querySelector(`#nights button[data-n="${n}"]`).click(); __es.start("night"); __es.auto(true, {acc: .97, react: .25});
            const Q = __es.roll(); for (let i = 0; i < 9000 && __es.S.state === "play"; i++) __es.stepq(1/30, 1); o.push([n, Q.goalObj.type, Q.res, Q.stars, Math.round(Q.T - Q.left)]); } return o; })()""")
        check('a good simulated player wins all three nights on Medium (Giant Pumpkin, crypt, church)', all(x[2] == 'win' for x in r) and [x[1] for x in r] == ['bigpump', 'crypt', 'church'], r)
        r = await ev(pg, """(() => { __es.toMenu(); document.querySelector('#diff button[data-d="hard"]').click(); document.querySelector('#nights button[data-n="0"]').click(); __es.start("night"); __es.auto(true, {acc: .5, react: 1.0, speed: .75});
            const Q = __es.roll(); for (let i = 0; i < 9000 && __es.S.state === "play"; i++) __es.stepq(1/30, 1); return [Q.res, Q.dk, Q.gulps]; })()""")
        check('a weak, slow player on Hard runs out of night (the dawn wins) – the game can be lost', r[0] == 'fail' and r[1] == 'hard', r)
        r = await ev(pg, '["easy","medium","hard"].map(d => { document.querySelector(`#diff button[data-d=${d}]`).click(); __es.start("night"); const Q = __es.roll(); return [d, Q.D.grow, Q.D.knock, Q.T]; })')
        check('Easy → Medium → Hard: slower growth, harder knock-offs, shorter nights', r[0][1] > r[1][1] > r[2][1] and r[0][2] < r[1][2] < r[2][2] and r[0][3] > r[1][3] > r[2][3], r)
        r = await ev(pg, """(() => { __es.toMenu(); document.getElementById("btnKids").click(); __es.start("night"); __es.auto(false); const Q = __es.roll(); __es.stepq(1/30, 9000);
            const st = [Q.state !== "end", __es.S.state, Q.D.knock, Q.dk]; __es.toMenu(); document.getElementById("btnKids").click(); return st; })()""")
        check('kids mode: nothing knocks off and the dawn waits – 5 minutes idle and still playing', r[0] and r[1] == 'play' and r[2] == 0 and r[3] == 'kids', r)
        r = await ev(pg, """(() => { __es.toMenu(); document.querySelector('#diff button[data-d="medium"]').click(); __es.start("endless"); __es.auto(true, {acc: .95, react: .3}); const Q = __es.roll();
            for (let i = 0; i < 4 * 60 * 30 && __es.S.state === "play"; i++) __es.stepq(1/30, 1); return [__es.S.mode, Q.goalObj, Q.res, Math.round(Q.t), Q.gulps, +Q.b.r.toFixed(1)]; })()""")
        check('Swell till Dawn (endless): no goal, gulps hold back the dawn, a good player lasts > 2 minutes', r[0] == 'endless' and r[1] is None and r[3] > 120 and r[4] > 100, r)
        await ev(pg, '__es.end("quit"); __es.toMenu(); document.getElementById("btnGear").click()'); await shot(pg, 'more.png', 10); await pg.wait_for_timeout(700)
        hit = await ev(pg, HITTEST + '(["btnEndless", "btnDuel", "btnKids", "btnQ2", "btnSound2", "btnIntro", "btnMoreX"])')
        check('options sheet: every control ≥ 44 px and clickable', all(h[1] >= 44 and h[2] >= 44 and h[3] for h in hit), hit)
        r = await ev(pg, """(() => { document.getElementById("btnDuel").click(); const Q1 = __es.roll(); const a = [__es.S.mode, __es.S.player, Q1.b.x, Q1.b.z]; __es.auto(true, {acc: .95, react: .3}); for (let i = 0; i < 9000 && __es.S.state === "play"; i++) __es.stepq(1/30, 1);
            const h = [__es.S.state, document.getElementById("handover").classList.contains("show"), document.getElementById("hoT").textContent];
            document.getElementById("btnGo").click(); const Q2 = __es.roll(); const b2 = [__es.S.state, __es.S.player, Q2.b.x, Q2.b.z, Q2.objs.every(o => o.alive)]; __es.auto(true, {acc: .7, react: .6});
            for (let i = 0; i < 9000 && __es.S.state === "play"; i++) __es.stepq(1/30, 1);
            return [a, h, b2, __es.S.state, document.getElementById("eTitle").textContent, JSON.stringify(__es.S.duel.map(d => d && d.score))]; })()""")
        check('Player 1 vs Player 2: P1 turn → handover "Player 2" → identical fresh village for P2 → winner title', r[0][0] == 'duel' and r[0][1] == 0 and r[1][0] == 'handover' and 'Player 2' in r[1][2] and r[2][1] == 1 and r[2][2:4] == r[0][2:4] and r[2][4] and r[3] == 'end' and re.search('Player|draw', r[4], re.I), r)
        await shot(pg, 'e-duel.png', 20)
        # ================= 6) share card =================
        r = await ev(pg, '(async () => { window.__txt = []; const u = await __es.cardURL(); const im = new Image(); im.src = u; await im.decode(); return [im.width, im.height, window.__txt]; })()')
        txt = ' '.join(r[2])
        check('share card: 1080×1350, ECTOSWELL title, Player 1/2, countdown credit, NO URL', r[0] == 1080 and r[1] == 1350 and 'ECTOSWELL' in txt and 'Player' in txt and '1 day to Halloween' in txt and not re.search(r'https?:|www\.|github|\.io\b|\.com\b', txt, re.I), (r[:2], txt[:300]))
        await ev(pg, '(async () => { __es.start("night"); __es.auto(true, {acc: .95, react: .3}); __es.stepq(1/30, 900); __es.end("quit"); window.__card = await __es.cardURL(); })()')
        b64 = await ev(pg, 'window.__card.split(",")[1]'); import base64; open(OUT + 'card.jpg', 'wb').write(base64.b64decode(b64))
        check('share card image is not black (the blob with its loot under the moon)', mean(OUT + 'card.jpg') > 25, round(mean(OUT + 'card.jpg'), 1))
        # ================= 7) language =================
        r = await ev(pg, '(() => { __es.toMenu(); const a = document.getElementById("btnPlay").textContent; document.getElementById("btnLang").click(); const b2 = [__es.S.lang, document.getElementById("btnPlay").textContent, document.documentElement.lang, document.querySelector(".kicker").textContent]; __es.toMenu(); document.getElementById("btnLang").click(); return [a, b2, __es.S.lang]; })()')
        check('tiny DE/EN toggle switches every text (PLAY → SPIELEN, countdown in German), and back', 'PLAY' in r[0].upper() and r[1][0] == 'de' and r[1][2] == 'de' and 'SPIELEN' in r[1][1].upper() and 'Noch 1 Tag' in r[1][3] and r[2] == 'en', r)
        # ================= 8) robustness =================
        r = await ev(pg, '(() => { __es.start("night"); const Q = __es.roll(); __es.S.ts = NaN; __es.W.flash = NaN; __es.W.glow = NaN; __es.S.punch = NaN; __es.S.yaw = NaN; __es.stepq(1/30, 3); __es.stepq(NaN, 2); __es.stepq(5, 1); __es.stepq(-1, 1); Q.step(NaN); Q.setStick(NaN, Infinity); __es.stepq(1/30, 2); const c = __es.cam(); return [Q.t, Q.score, Q.left, Q.b.x, Q.b.z, Q.b.r, __es.S.ts, __es.S.gt, __es.W.flash, c.p, c.fov].flat().every(Number.isFinite); })()')
        check('NaN guards: NaN time-scale/flash/glow/camera, NaN/negative/5 s steps and a NaN stick never break the rules or camera', r is True, r)
        r = await ev(pg, '(() => { const l0 = __es.last(); __es.advance(l0 + 16); const l1 = __es.last(); const d = __es.advance(l1 - 500); return [d, __es.last() >= l1]; })()')
        check('frame clock never runs backwards (out-of-order rAF stamps give dt = 0)', r[0] == 0 and r[1], r)
        check('no console errors so far', not logs, logs[:4])
        await ctx.close()
        # ================= 9) GPU resource leak test =================
        ctx, pg, logs = await page(b, skip=True)
        await ev(pg, '__es.start("night"); __es.auto(true, {acc: .95, react: .3})'); await shot(pg, 'x.png', 3)
        async def cycle():
            for q in ['low', 'high', 'ultra', 'mid', 'low', 'mid']:
                await ev(pg, f'__es.quality("{q}")'); await shot(pg, 'x.png', 2)
            for i in range(3):
                await ev(pg, '__es.start("night"); __es.auto(true, {acc: .95, react: .3}); __es.stepq(1/30, 300)'); await shot(pg, 'x.png', 2)
                await ev(pg, TOGOAL); await ev(pg, GULP); await ev(pg, '__es.stepq(1/30, 60)'); await shot(pg, 'x.png', 2)
                await ev(pg, '__es.cardURL()')
                await ev(pg, '__es.end("quit"); __es.toMenu(); __es.stepq(1/30, 90)'); await shot(pg, 'x.png', 2)
            await ev(pg, '__es.start("night")'); await shot(pg, 'x.png', 3)
        await cycle()
        m0 = await ev(pg, '__es.mem()')
        await cycle()
        m1 = await ev(pg, '__es.mem()')
        check('no GPU leaks: geometries / textures / shader programs flat over a 2nd round of 6 quality switches + 3 Big Gulps + share cards + menu', m1['geometries'] <= m0['geometries'] + 1 and m1['textures'] <= m0['textures'] + 1 and m1['programs'] <= m0['programs'] + 2, (m0, m1))
        check('no console errors (leak run)', not logs, logs[:4])
        await ctx.close()
        # ================= 10) German browser → German, auto =================
        ctx, pg, logs = await page(b, locale='de-DE')
        r = await ev(pg, '[__es.S.lang, document.documentElement.lang, document.getElementById("btnSkip").textContent]')
        check('German browser → German texts automatically', r[0] == 'de' and r[1] == 'de' and 'spielen' in r[2].lower(), r)
        await ctx.close()
        # ================= 11) static scans =================
        i18n = open(ROOT + '/src/i18n.js', encoding='utf-8').read()
        strings = ' '.join(a or b2 for a, b2 in re.findall(r"'((?:[^'\\]|\\.)*)'|`([^`]*)`", i18n))
        vis = open(ROOT + '/index.html', encoding='utf-8').read() + strings + open(ROOT + '/README.md', encoding='utf-8').read()
        vis_txt = re.sub(r'<[^>]+>', ' ', vis)
        allsrc = vis + i18n + ''.join(open(f, encoding='utf-8').read() for f in glob.glob(ROOT + '/src/*.js'))
        NM = r'\b' + SUR + r'\b|' + '|'.join(r'\b' + f + r'\b' for f in FAM)
        check('visible texts + README + code: no surname, no family names, no email address', not re.search(NM, allsrc, re.I) and not re.search(r'[\w.+-]+@[\w-]+\.[a-z]{2,}', allsrc), re.findall(NM, allsrc, re.I)[:3])
        check('visible texts say SI, never "AI"/"KI"', not re.search(r'\bAI\b|\bKI\b', vis_txt), re.findall(r'.{20}\b(?:AI|KI)\b.{20}', vis_txt)[:3])
        m = re.findall(TM, vis_txt, re.I); check('no third-party game/film/brand names or known catchphrases in visible text', not m, m[:5])
        src = ''.join(open(f, encoding='utf-8').read() for f in glob.glob(ROOT + '/src/*.js'))
        check('no synthesized beeps (no oscillators) – real recorded sounds only', 'createOscillator' not in src)
        lic = os.listdir(ROOT + '/LICENSES'); check('LICENSES/ has font, three.js, sound credits', any('OFL' in x for x in lic) and any('three' in x.lower() for x in lic) and 'SOUNDS.md' in lic, lic)
        sd = open(ROOT + '/LICENSES/SOUNDS.md', encoding='utf-8').read() if 'SOUNDS.md' in lic else ''
        miss = [os.path.basename(f)[:-4] for f in glob.glob(ROOT + '/sounds/*.mp3') if '`' + os.path.basename(f)[:-4] + '`' not in sd]
        check('every sound file is documented in LICENSES/SOUNDS.md', not miss, miss[:8])
        await b.close()
    print(f'\n{sum(R)}/{len(R)} checks passed'); sys.exit(0 if R and all(R) else 1)
asyncio.run(main())
