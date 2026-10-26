"""Quick visual check: screenshots of the opening, menu, gameplay and the Big Gulp (portrait phone + desktop)."""
import asyncio, os, sys, threading, http.server, functools, socketserver, time
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = ROOT + '/test/shots/'
class _Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); srv.daemon_threads = True; threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/index.html' % srv.server_address[1]
VP = sys.argv[1] if len(sys.argv) > 1 else 'p'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        vp = {'width': 390, 'height': 844} if VP == 'p' else {'width': 1280, 'height': 800}
        ctx = await b.new_context(viewport=vp, device_scale_factor=1, locale='en-US'); await ctx.add_init_script('window.__esManual = true; window.__esSeed = 42; window.__esNoAutoQ = true; try{localStorage.clear()}catch(e){}')
        pg = await ctx.new_page(); errs = []; pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        t0 = time.time(); await pg.goto(URL); await pg.wait_for_function('window.__es', timeout=120000); print('load', round(time.time() - t0, 1), errs)
        async def shot(n, steps=1):
            t1 = time.time(); await pg.evaluate(f'__es.step(1/30, {steps})'); await pg.screenshot(path=f'{OUT}{VP}-{n}.png'); print(n, round(time.time() - t1, 1), 's', await pg.evaluate('[__es.S.state, __es.roll().state, +__es.roll().b.r.toFixed(2), __es.roll().gulps]'), errs[-2:])
        await shot('o0'); await shot('o1', 15); await shot('o2', 45); await shot('o3', 30); await shot('o4', 30)
        await pg.evaluate('__es.stepq(1/30, 120)'); await shot('menu')
        await pg.evaluate('__es.start("night"); __es.auto(true, {acc: .95, react: .3})'); await shot('p0', 30)
        await pg.evaluate('__es.stepq(1/30, 420)'); await shot('p1')
        await pg.evaluate('__es.stepq(1/30, 600)'); await shot('p2')
        await pg.evaluate('(() => { const Q = __es.roll(); for (let i = 0; i < 3000 && Q.state !== "gulp" && Q.state !== "end"; i++) __es.stepq(1/30, 1); })()'); await shot('g0', 8); await shot('g1', 20); await shot('g2', 25)
        await pg.evaluate('(() => { for (let i = 0; i < 900 && __es.S.state !== "end"; i++) __es.stepq(1/30, 1); })()'); await shot('end', 20)
        await pg.evaluate('__es.toMenu()'); await shot('menu2', 30); await pg.click('#btnGear'); await shot('more', 10); await pg.click('#btnDuel'); await shot('duel', 60)
        print('errors', errs[:6]); await b.close()
asyncio.run(main())
