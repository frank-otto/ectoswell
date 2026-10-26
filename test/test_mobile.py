"""Ectoswell – phone start-screen + play-screen regression test (real touch emulation).
WebKit (iPhone 13, iPhone 8 = 375×667, iPhone SE 320×568) + Chromium (Pixel 7), portrait and landscape.
Checks: ONE tap from page load lands in a playable night (quit / sound / DE-EN all tappable, the start hint and the controls never cover the blob);
a real touch drag shows the virtual stick and rolls the blob; every start-screen and options control can be TAPPED (nothing covers it, nothing off-screen, no scrolling);
language auto-detect; no overflow in German; no console errors.
Run: python3 test/test_mobile.py [base-url]   (exit code 0 = all checks passed; screenshots → test/shots/mobile/)"""
import asyncio, os, sys, threading, http.server, functools, socketserver, json
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('ES_SHOTS', ROOT + '/test/shots/mobile/'); os.makedirs(OUT, exist_ok=True)
if len(sys.argv) > 1: URL = sys.argv[1]
else:
    class _Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    _srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); _srv.daemon_threads = True
    threading.Thread(target=_srv.serve_forever, daemon=True).start(); URL = 'http://127.0.0.1:%d/index.html' % _srv.server_address[1]
ONLY = os.environ.get('ES_ONLY', '')
R = []
def check(n, ok, info=''): R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f' — {info}' if info != '' else ''), flush=True)
DEVICES = [  # engine, descriptor, landscape, browser locale
    ('webkit', 'iPhone 13', False, 'en-US'), ('webkit', 'iPhone 13', True, 'de-DE'),
    ('webkit', 'iPhone 8', False, 'de-AT'), ('webkit', 'iPhone 8', True, 'en-US'),
    ('webkit', 'iPhone SE', False, 'en-GB'), ('webkit', 'iPhone SE', True, 'de-DE'),
    ('chromium', 'Pixel 7', False, 'de-DE'), ('chromium', 'Pixel 7', True, 'en-US')]
HIT = """ids => ids.map(sel => { const e = document.querySelector(sel); if (!e) return [sel, 'missing'];
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2) return [sel, 'hidden'];
  if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) return [sel, 'off-screen ' + [r.left, r.top, r.right, r.bottom].map(Math.round)];
  for (const [fx, fy] of [[.5, .5], [.2, .5], [.8, .5]]) { const t = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); if (!t || !(t === e || e.contains(t))) return [sel, 'covered by ' + (t ? (t.id || t.tagName) : 'nothing')]; }
  if (r.height < 44 || r.width < 44) return [sel, 'too small ' + Math.round(r.width) + 'x' + Math.round(r.height)]; return [sel, 'ok']; })"""
COVER = """(() => { const ids = ['hud', 'meters', 'top', 'hint']; const R = ids.map(id => [id, document.getElementById(id).getBoundingClientRect()]).filter(([i, r]) => r.width > 0 && getComputedStyle(document.getElementById(i)).visibility !== 'hidden' && getComputedStyle(document.getElementById(i)).opacity > .1);
  const b = __es.blobScreen(), rad = __es.blobRadiusPx(); const hits = R.filter(([id, r]) => b.x + rad * .5 > r.left && b.x - rad * .5 < r.right && b.y + rad * .5 > r.top && b.y - rad * .5 < r.bottom).map(([id]) => id);
  return { blob: [Math.round(b.x), Math.round(b.y), Math.round(rad)], hits, onScreen: b.x > 0 && b.x < innerWidth && b.y > 0 && b.y < innerHeight }; })()"""
NOSCROLL = "document.scrollingElement.scrollHeight <= innerHeight + 1 && document.scrollingElement.scrollWidth <= innerWidth + 1"
async def ev(pg, js): return await pg.evaluate(js)
async def until(pg, js, secs=20):
    for _ in range(int(secs * 5)):
        try:
            if await pg.evaluate(js): return True
        except Exception: pass
        await pg.wait_for_timeout(200)
    return False
async def tap(pg, sel):
    """Tap with a short settle + one retry: headless WebKit/SwiftShader frames can stall the actionability wait. Same checks, no force."""
    for k in (1, 2):
        try:
            await pg.wait_for_selector(sel, state='visible', timeout=20000); await pg.tap(sel, timeout=20000); return
        except Exception as e:
            if k == 2 or 'Timeout' not in str(e): raise
            print(f'RETRY tap {sel} (timeout, retrying once after 1 s)', flush=True); await pg.wait_for_timeout(1000)
async def run(p, eng, dev, land, loc):
    d = dict(p.devices[dev]); d.pop('default_browser_type', None)
    if land: d['viewport'] = {'width': d['viewport']['height'], 'height': d['viewport']['width']}
    W, H = d['viewport']['width'], d['viewport']['height']; tag = f"{dev.replace(' ', '')}-{'land' if land else 'port'}"; T = f'[{tag} {eng} {W}×{H} {loc}]'
    kw = {} if eng == 'webkit' else dict(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    b = await (p.webkit if eng == 'webkit' else p.chromium).launch(**kw)
    ctx = await b.new_context(**d, locale=loc); await ctx.add_init_script("window.__esNoAutoQ = true; try{if(!sessionStorage.getItem('esInit')){sessionStorage.setItem('esInit','1'); localStorage.clear();}}catch(e){}")
    pg = await ctx.new_page(); pg.set_default_timeout(30000); errs = []
    pg.on('console', lambda m: errs.append(m.text[:160]) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)[:160]))
    await pg.goto(URL); await pg.wait_for_function('document.body.classList.contains("ready") && window.__es', timeout=90000)
    # ---------- 1) ONE TAP from page load → playable night ----------
    await pg.wait_for_timeout(1200); st0 = await ev(pg, '__es.S.state'); await pg.screenshot(path=f'{OUT}{tag}-0-opening.png')
    sk = dict(await ev(pg, f"({HIT})(['#btnSkip'])"))['#btnSkip'] if st0 == 'intro' else 'n/a'
    sktxt = await ev(pg, "document.getElementById('btnSkip').textContent")
    check(f'{T} opens on the cinematic opening (the Big Gulp), "tap to play" label on screen (touch wording)', st0 == 'intro' and (sk == 'ok' or sk.startswith('covered')) and ('Tap' in sktxt or 'Tippen' in sktxt), (st0, sk, sktxt))
    want = 'de' if loc.startswith('de') else 'en'; check(f'{T} language auto-detected from the browser ({want})', await ev(pg, '__es.S.lang') == want and await ev(pg, 'document.documentElement.lang') == want)
    await pg.touchscreen.tap(W / 2, H * .4)  # ONE tap, anywhere
    ok = await until(pg, "__es.S.state === 'play'", 10)
    info = await ev(pg, '[__es.S.state, __es.S.mode, __es.roll() && __es.roll().state]')
    check(f'{T} a single tap goes straight into Night I (count-in / rolling)', ok and info[:2] == ['play', 'night'] and info[2] in ('count', 'roll'), info)
    check(f'{T} sound unlocks on that first tap (sound on by default)', await until(pg, "__es.audioState() !== 'none'", 5) and not await ev(pg, "document.getElementById('btnSound').textContent.includes('🔇')"), await ev(pg, '__es.audioState()'))
    hint = await until(pg, "document.getElementById('hint').classList.contains('show')", 20)
    await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}{tag}-1-play-hint.png')
    await ev(pg, 'window.__esManual = true')
    lay = await ev(pg, """(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const h = r('#hint'), hud = r('#hud'), top = r('#top'), met = r('#meters');
      const ov = (x, y) => !(x.bottom <= y.top || x.top >= y.bottom || x.right <= y.left || x.left >= y.right); const b = __es.blobScreen(), rad = __es.blobRadiusPx();
      return { hint: [h.left, h.top, h.right, h.bottom].map(Math.round), hintBlob: b.x + rad > h.left && b.x - rad < h.right && b.y + rad > h.top && b.y - rad < h.bottom, hintUi: ov(h, hud) || ov(h, top) || ov(h, met), noscroll: """ + NOSCROLL + """ }; })()""")
    check(f'{T} the short start hint shows and covers neither the blob nor the HUD / buttons; no scrolling', hint and not lay['hintBlob'] and not lay['hintUi'] and lay['noscroll'], lay)
    await ev(pg, "document.getElementById('hint').classList.remove('show'); __es.S.hintT = -1")
    cov = []
    for k in range(3):
        await ev(pg, '__es.auto(true, {acc: .95, react: .3}); __es.step(1/30, 150); __es.setUI()'); c = await ev(pg, COVER); cov.append([c['blob'], c['onScreen'], c['hits']])
    await ev(pg, '__es.auto(false)')
    check(f'{T} the controls never cover the blob: HUD, meters and ✕/sound/DE stay clear of it while it rolls and grows', all(x[1] and not x[2] for x in cov), cov)
    sel = ['#btnQuit', '#btnSound', '#btnLang']
    hit = dict(await ev(pg, f'({HIT})({json.dumps(sel)})')); bad = {k: v for k, v in hit.items() if v != 'ok'}
    check(f'{T} play screen: ✕ / sound / DE-EN all on screen, ≥ 44 px, tappable', not bad, bad or 'ok')
    # a real touch drag (touch pointer events on the canvas) → stick + rolling
    r0 = await ev(pg, '[__es.roll().b.x, __es.roll().b.z]')
    await ev(pg, f"""(() => {{ const c = document.getElementById('game'); const o = {{ pointerId: 11, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true }};
      c.dispatchEvent(new PointerEvent('pointerdown', {{ ...o, clientX: {W * .5}, clientY: {H * .7} }})); c.dispatchEvent(new PointerEvent('pointermove', {{ ...o, clientX: {W * .5}, clientY: {H * .7 - 60} }})); }})()""")
    await ev(pg, '__es.step(1/30, 1)'); stk = await ev(pg, "document.getElementById('stick').classList.contains('show')"); await pg.screenshot(path=f'{OUT}{tag}-1b-stick.png')
    await ev(pg, '__es.stepq(1/30, 45)')
    await ev(pg, "document.getElementById('game').dispatchEvent(new PointerEvent('pointerup', { pointerId: 11, pointerType: 'touch', bubbles: true }))")
    r1 = await ev(pg, '[__es.roll().b.x, __es.roll().b.z, document.getElementById("stick").classList.contains("show"), __es.S.isTouch]')
    import math
    check(f'{T} a touch drag shows the virtual stick under the finger and rolls the blob; lifting the finger hides it', stk and math.hypot(r1[0] - r0[0], r1[1] - r0[1]) > 1 and not r1[2], (stk, r0, r1))
    await ev(pg, '__es.step(1/30, 6)')
    await ev(pg, '__es.stepq(1/30, 200)'); await ev(pg, 'window.__esManual = false')
    # ---------- 2) the start screen: one big PLAY, everything else behind the gear ----------
    await ev(pg, '__es.toMenu()'); await pg.wait_for_timeout(1300); await pg.screenshot(path=f'{OUT}{tag}-2-menu.png')
    lay = await ev(pg, """(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const p = r('#btnPlay'), h = r('#menu h1'), c = r('#menu .credit');
      return { p: [p.left, p.top, p.width, p.height].map(Math.round), cy: (p.top + p.height / 2) / innerHeight, overlap: !(h.bottom <= p.top || h.top >= p.bottom) && !(h.right <= p.left || h.left >= p.right),
        scroll: !(""" + NOSCROLL + """) || document.getElementById('menu').scrollHeight > document.getElementById('menu').clientHeight + 1, inView: c.bottom <= innerHeight + 1 && h.top >= 0 }; })()""")
    check(f'{T} start screen: one big glowing PLAY (≥ 60 px tall, ≥ 220 px wide) in the thumb zone, title clear of it, no scrolling', lay['p'][3] >= 60 and lay['p'][2] >= 220 and (.45 if land else .55) <= lay['cy'] <= .92 and not lay['overlap'] and not lay['scroll'] and lay['inView'], lay)
    hit = dict(await ev(pg, f'({HIT})(["#btnPlay", "#btnGear", "#btnLang"])')); bad = {k: v for k, v in hit.items() if v != 'ok'}
    check(f'{T} start screen: PLAY, gear and the tiny DE/EN are all tappable (≥ 44 px, nothing covers them)', not bad, bad or hit)
    l0 = await ev(pg, '__es.S.lang'); await tap(pg, '#btnLang'); l1 = await ev(pg, '__es.S.lang'); await tap(pg, '#btnLang'); l2 = await ev(pg, '__es.S.lang')
    check(f'{T} tap DE/EN toggles the language and back', l0 != l1 and l2 == l0, (l0, l1, l2))
    await ev(pg, "__es.S.lang === 'de' || document.getElementById('btnLang').click()")
    of = await ev(pg, "[...document.querySelectorAll('#menu button, #more button, #menu h1 span, #menu .kicker')].filter(e => e.offsetParent !== null || e.closest('#more')).filter(e => e.scrollWidth > e.clientWidth + 2 || e.getBoundingClientRect().right > innerWidth + 1).map(e => e.id || e.className || e.tagName)")
    check(f'{T} German: no text overflows its button or the screen (menu + options)', not of, of)
    await tap(pg, '#btnGear'); await pg.wait_for_timeout(1500); await pg.screenshot(path=f'{OUT}{tag}-3-options-de.png')
    sh = await ev(pg, "(() => { const m = document.getElementById('more'); return [m.classList.contains('show'), m.scrollHeight > m.clientHeight + 1]; })()")
    sel = ['#btnMoreX', '#btnEndless', '#btnDuel', '#nights button[data-n="0"]', '#nights button[data-n="1"]', '#nights button[data-n="2"]', '#diff button[data-d=easy]', '#diff button[data-d=medium]', '#diff button[data-d=hard]', '#btnKids', '#btnQ2', '#btnSound2', '#btnIntro']
    hit = dict(await ev(pg, f'({HIT})({json.dumps(sel)})')); bad = {k: v for k, v in hit.items() if v != 'ok'}
    check(f'{T} gear sheet: endless, duel, nights I–III, difficulty, kids, quality, sound, intro, close – all on screen, ≥ 44 px, tappable without scrolling', sh[0] and not sh[1] and not bad, (bad or 'ok', sh))
    q0 = await ev(pg, '__es.quality()'); await tap(pg, '#btnQ2'); await pg.wait_for_timeout(600); q1 = await ev(pg, '__es.quality()'); await ev(pg, "__es.quality('mid')")
    await tap(pg, '#btnKids'); k1 = await ev(pg, '__es.S.kids'); await tap(pg, '#btnKids'); k2 = await ev(pg, '__es.S.kids')
    await tap(pg, '#diff button[data-d=easy]'); d1 = await ev(pg, '__es.S.diff'); await tap(pg, '#diff button[data-d=medium]'); d2 = await ev(pg, '__es.S.diff')
    await tap(pg, '#nights button[data-n="1"]'); n1 = await ev(pg, '__es.S.night'); await tap(pg, '#nights button[data-n="0"]'); n0 = await ev(pg, '__es.S.night')
    s0 = await ev(pg, "document.getElementById('btnSound2').textContent"); await tap(pg, '#btnSound2'); s1 = await ev(pg, "document.getElementById('btnSound2').textContent"); await tap(pg, '#btnSound2')
    check(f'{T} options by tap: quality switches, kids on/off, difficulty easy → medium, night II → I, sound off/on', q0 != q1 and k1 and not k2 and d1 == 'easy' and d2 == 'medium' and n1 == 1 and n0 == 0 and s0 != s1, (q0, q1, k1, k2, d1, d2, n1, n0, s0, s1))
    await tap(pg, '#btnMoreX'); await pg.wait_for_timeout(500); closed = not await ev(pg, "document.getElementById('more').classList.contains('show')")
    await tap(pg, '#btnGear'); await pg.wait_for_timeout(600); await tap(pg, '#btnDuel'); duel = await until(pg, "__es.S.state === 'play' && __es.S.mode === 'duel'", 8)
    check(f'{T} close (✕) works; duel (Player 1 vs Player 2) starts by tap', closed and duel, (closed, duel))
    await ev(pg, '__es.toMenu()'); await pg.wait_for_timeout(700); await tap(pg, '#btnGear'); await pg.wait_for_timeout(600); await tap(pg, '#btnEndless'); en = await until(pg, "__es.S.state === 'play' && __es.S.mode === 'endless'", 8)
    await ev(pg, '__es.toMenu()'); await pg.wait_for_timeout(700); await tap(pg, '#btnGear'); await pg.wait_for_timeout(600); await tap(pg, '#btnIntro'); intro = await until(pg, "__es.S.state === 'intro'", 5)
    await pg.wait_for_timeout(800); await pg.touchscreen.tap(W * .5, H * .3); intro2 = await until(pg, "__es.S.state === 'play'", 8)
    check(f'{T} endless, intro replay, and a tap on the replayed intro goes into play', en and intro and intro2, (en, intro, intro2))
    await ev(pg, '__es.toMenu()'); await pg.wait_for_timeout(900); await tap(pg, '#btnPlay'); pl = await until(pg, "__es.S.state === 'play' && __es.S.mode === 'night'", 8)
    check(f'{T} tap PLAY starts the night', pl)
    # end screen fits and is tappable
    await ev(pg, '__es.end("fail")'); await pg.wait_for_timeout(900); await pg.screenshot(path=f'{OUT}{tag}-4-end.png')
    hit = dict(await ev(pg, f'({HIT})(["#btnAgain", "#btnMenu", "#btnCard", "#btnShare", "#eName"])')); bad = {k: v for k, v in hit.items() if v != 'ok'}
    check(f'{T} end screen: play again, menu, save card, share, name field tappable (>=44px, on screen, uncovered)', not bad, bad or hit)
    if land:
        es = await ev(pg, "(() => { const e = document.getElementById('end'), r = e.getBoundingClientRect(); return { sh: e.scrollHeight, ch: e.clientHeight, sw: e.scrollWidth, cw: e.clientWidth, top: Math.round(r.top), bottom: Math.round(r.bottom), page: " + NOSCROLL + " }; })()")
        check(f'{T} landscape end screen fits without any scrolling (panel and page)', es['sh'] <= es['ch'] + 1 and es['sw'] <= es['cw'] + 1 and es['top'] >= 0 and es['bottom'] <= H and es['page'], es)
    check(f'{T} no console errors', not errs, errs[:3])
    await b.close()
async def main():
    async with async_playwright() as p:
        for eng, dev, land, loc in DEVICES:
            if ONLY and ONLY not in dev.replace(' ', '') + ('-land' if land else '-port'): continue
            for attempt in (1, 2):  # headless WPE WebKit's software compositor sometimes segfaults: retry once, say so
                n0 = len(R)
                try: await run(p, eng, dev, land, loc); break
                except Exception as e:
                    import traceback; tb = traceback.extract_tb(e.__traceback__); ln = next((f.lineno for f in reversed(tb) if f.filename.endswith('test_mobile.py')), '?')
                    msg = f'line {ln}: ' + str(e).split('\n')[0][:300]
                    if attempt == 1 and 'crashed' in msg.lower(): del R[n0:]; print(f'RETRY [{dev} {"land" if land else "port"}] browser process crashed ({msg}) – rerunning this device once', flush=True); continue
                    check(f'[{dev} {"land" if land else "port"}] run finished', False, msg)
    print(f'\n{sum(R)}/{len(R)} checks passed'); sys.exit(0 if R and all(R) else 1)
asyncio.run(main())
