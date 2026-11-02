// Copied from /workspace/games/_shared/helpers.mjs (button layout adapted to 1280x720). Shared Playwright helpers: real keyboard on desktop, real CDP multi-touch on mobile.
import { chromium } from 'playwright';
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const MOBILE = {
  viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
};
export const DESKTOP = { viewport: { width: 1280, height: 720 } };

export async function launch() { return chromium.launch(); }

export async function open(browser, opts, url, log) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') log.errors.push(`[console] ${m.text()}`); });
  page.on('pageerror', e => log.errors.push(`[pageerror] ${e.message}`));
  page.on('request', r => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && !['localhost', '127.0.0.1'].includes(u.hostname)) log.external.push(r.url()); });
  await page.goto(url);
  const t0 = Date.now();
  while (Date.now() - t0 < 10000) {
    const ok = await page.evaluate(() => !!(window.__game && window.__game.scene.getScene('game') && window.__game.scene.getScene('game').sys.isActive() && window.__game.scene.getScene('game').getTestState)).catch(() => false);
    if (ok) break; await sleep(100);
  }
  await sleep(300);
  const input = opts.hasTouch ? await touchInput(page) : keyInput(page);
  return { ctx, page, input };
}

export const state = (page) => page.evaluate(() => window.__game.scene.getScene('game').getTestState());

async function toPage(page, x, y) {
  return page.evaluate(([x, y]) => { const s = window.__game.scale; const b = s.canvasBounds; return { x: b.left + x / s.displayScale.x, y: b.top + y / s.displayScale.y }; }, [x, y]);
}

export function keyInput(page) {
  const held = new Set();
  const set = async (want) => {
    for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  return {
    kind: 'keyboard',
    async move(dx, dy) { const w = new Set(); if (dx > 0.3) w.add('d'); if (dx < -0.3) w.add('a'); if (dy > 0.3) w.add('s'); if (dy < -0.3) w.add('w'); await set(w); },
    async stop() { await set(new Set()); },
    async press(btn) { const k = { attack: 'j', dash: 'Space', interact: 'e' }[btn]; await page.keyboard.press(k); },
    async restart() { await page.keyboard.press('r'); },
  };
}

async function touchInput(page) {
  const cdp = await page.context().newCDPSession(page);
  const JOY = { x: 220, y: 500 };
  const btnPos = { attack: { x: 1182, y: 530 }, dash: { x: 1046, y: 572 }, interact: { x: 1178, y: 392 } };
  let joy = null; // page coords of current joystick finger
  const send = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  return {
    kind: 'touch',
    async move(dx, dy) {
      const m = Math.hypot(dx, dy) || 1; const base = await toPage(page, JOY.x, JOY.y);
      const tip = await toPage(page, JOY.x + dx / m * 50, JOY.y + dy / m * 50);
      if (!joy) { await send('touchStart', [{ x: base.x, y: base.y, id: 1 }]); await sleep(30); }
      joy = tip; await send('touchMove', [{ x: tip.x, y: tip.y, id: 1 }]);
    },
    async stop() { if (joy) { await send('touchEnd', []); joy = null; } },
    async press(btn) {
      const p = await toPage(page, btnPos[btn].x, btnPos[btn].y);
      const pts = joy ? [{ x: joy.x, y: joy.y, id: 1 }] : [];
      await send(pts.length ? 'touchMove' : 'touchStart', [...pts, { x: p.x, y: p.y, id: 2 }].length && pts.length ? [...pts, { x: p.x, y: p.y, id: 2 }] : [{ x: p.x, y: p.y, id: 2 }]);
      await sleep(40);
      if (pts.length) await send('touchMove', pts); else await send('touchEnd', []);
    },
    async hold(btn, ms) { const p = await toPage(page, btnPos[btn].x, btnPos[btn].y); await send('touchStart', [{ x: p.x, y: p.y, id: 2 }]); await sleep(ms); await send('touchEnd', []); },
    async tap(x, y) { const p = await toPage(page, x, y); await send('touchStart', [{ x: p.x, y: p.y, id: 4 }]); await sleep(40); await send('touchEnd', []); },
    async restart() { const p = await toPage(page, 640, 300); await send('touchStart', [{ x: p.x, y: p.y, id: 3 }]); await sleep(40); await send('touchEnd', []); joy = null; },
  };
}

/** Steer toward a point; returns distance. */
export async function steer(input, from, to, stopAt = 30) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
  if (d > stopAt) await input.move(dx / d, dy / d); else await input.stop();
  return d;
}
