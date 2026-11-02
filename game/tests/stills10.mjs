// art-v10 stills (dev aid): node tests/stills10.mjs -> screenshots/v10-*.png
import { spawn } from 'node:child_process';
import { launch, open, sleep, DESKTOP } from './helpers.mjs';
const OUT = new URL('../screenshots/', import.meta.url).pathname; const PORT = 4180;
const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { } await sleep(200); }
const b = await launch(); const log = { errors: [], external: [] };
const { page } = await open(b, DESKTOP, `http://localhost:${PORT}/?test=1&new=1`, log);
const pi = (fn, ...a) => page.evaluate(([fn, a]) => window.__pi[fn](...a), [fn, a]);
const st = () => page.evaluate(() => window.__pi.state());
const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (f(await st())) return; await sleep(80); } };
await sleep(4500); await pi('teleport', 300, 600); await sleep(2500); await page.screenshot({ path: OUT + 'v10-noor-desk.png' });
await pi('teleport', 640, 500); await sleep(1500); await page.keyboard.down('e'); await sleep(900); await page.screenshot({ path: OUT + 'v10-code-labels.png' }); await page.keyboard.up('e'); await sleep(600);
for (const [id, nm] of [['o_kabir', 'kabir'], ['o_coffee', 'coffee'], ['o_photo', 'photo'], ['o_sticky', 'whiteboard'], ['o_rain', 'rain']]) {
  await pi('read', id); await until(s => s.office9.ph === 'still', 9000); await sleep(800); await page.screenshot({ path: OUT + `v10-close-${nm}.png` });
  await pi('o9', 'closeCard'); await until(s => !s.office9.ph, 6000); await sleep(400);
}
await pi('swap', 'o_rain', 'o_lamp'); await sleep(2500); await pi('teleport', 900, 320); await sleep(2000); await page.screenshot({ path: OUT + 'v10-rain-happy-room.png' });
await pi('read', 'o_rain'); await until(s => s.office9.ph === 'still', 9000); await sleep(800); await page.screenshot({ path: OUT + 'v10-close-rain_happy.png' }); await pi('o9', 'closeCard'); await sleep(1500);
await pi('teleport', 300, 380); await sleep(800); await pi('read', 'o_phone'); await until(s => s.office9.ph === 'still', 9000); await sleep(800); await page.screenshot({ path: OUT + 'v10-close-phone.png' });
await pi('o9', 'closeCard'); await sleep(1500); await pi('o9', 'draft'); await sleep(3000); await page.screenshot({ path: OUT + 'v10-draft-glimpse.png' });
await pi('goto', 'hub'); await sleep(1500); await pi('teleport', 640, 560); await sleep(1500); await page.screenshot({ path: OUT + 'v10-hub-no-band.png' });
console.log(log.errors.slice(0, 5).join('\n')); await b.close(); srv.kill();
