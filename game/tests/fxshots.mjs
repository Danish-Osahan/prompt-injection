// In-game captures of the v7 dash + 3-hit TYPE combo FX: node tests/fxshots.mjs (needs `npm run build`)
import { spawn } from 'node:child_process';
import { launch, open, sleep, DESKTOP } from './helpers.mjs';
const PORT = 4177, SHOTS = new URL('../screenshots/', import.meta.url).pathname;
const pi = (page, fn, ...a) => page.evaluate(([fn, a]) => window.__pi[fn](...a), [fn, a]);
const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch {} await sleep(200); }
const browser = await launch(); const log = { errors: [], external: [] };
const { page } = await open(browser, DESKTOP, `http://localhost:${PORT}/?test=1&new=1`, log);
const shot = (n) => page.screenshot({ path: `${SHOTS}${n}.png` });
await pi(page, 'goto', 'corridor'); await sleep(1200);
await pi(page, 'swap', 'c_switch', 'c_light'); await sleep(900);
await pi(page, 'swap', 'c_clock', 'c_dummy'); await sleep(300);
// dash east along the corridor
await pi(page, 'teleport', 640, 420); await page.keyboard.down('d'); await sleep(80); await page.keyboard.press('Space'); await sleep(95); await shot('fx-dash-burst');
await page.keyboard.up('d'); await sleep(600);
await pi(page, 'teleport', 380, 430); await page.keyboard.down('a'); await sleep(60); await page.keyboard.up('a'); await sleep(50);
await page.keyboard.down('d'); await sleep(40); await page.keyboard.press('Space'); await sleep(40); await shot('fx-dash-start'); await page.keyboard.up('d'); await sleep(1100);
// combo on the (awake) dummy: each capture is its own string of presses inside the 0.5 s combo window
const run = async (hits, name, wait, extra) => {
  await pi(page, 'teleport', 1045, 505); await page.keyboard.down('d'); await sleep(30); await page.keyboard.up('d');
  for (let i = 0; i < hits; i++) { await page.keyboard.press('j'); if (i < hits - 1) await sleep(250); }
  await sleep(wait); await shot(name); if (extra) { await sleep(extra[1]); await shot(extra[0]); } await sleep(1000);
};
await run(1, 'fx-type1-jab', 70);
await run(2, 'fx-type2-slash', 70);
await run(3, 'fx-type3-typed-line', 150, ['fx-type3-delete-back', 30]);
console.log('errors', log.errors.length, log.errors.slice(0, 3)); await browser.close(); p.kill();
