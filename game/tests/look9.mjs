// quick art-v9 office look (dev aid): node tests/look9.mjs [outdir]
import { spawn } from 'node:child_process';
import { launch, open, sleep, DESKTOP } from './helpers.mjs';
const OUT = process.argv[2] ?? '/tmp/look9/'; const PORT = 4176;
const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { } await sleep(200); }
const b = await launch(); const log = { errors: [], external: [] };
const { page } = await open(b, DESKTOP, `http://localhost:${PORT}/?test=1&new=1`, log);
const pi = (fn, ...a) => page.evaluate(([fn, a]) => window.__pi[fn](...a), [fn, a]);
const st = () => page.evaluate(() => window.__pi.state());
await sleep(200); await page.screenshot({ path: OUT + 'a-establish.png' });
await sleep(3500); await page.screenshot({ path: OUT + 'b-play.png' }); console.log(JSON.stringify((await st()).office9));
await pi('teleport', 600, 560); await sleep(1500); await page.screenshot({ path: OUT + 'c-mid.png' });
await page.keyboard.down('e'); await sleep(700); await page.screenshot({ path: OUT + 'd-code.png' }); await page.keyboard.up('e');
await pi('read', 'o_phone'); await sleep(600); await page.screenshot({ path: OUT + 'e-phone-noor.png' }); await sleep(1600); await page.screenshot({ path: OUT + 'f-phone-card.png' }); console.log(JSON.stringify((await st()).office9));
await pi('o9', 'closeCard'); await sleep(600);
await pi('swap', 'o_rain', 'o_lamp'); await sleep(2000); await page.screenshot({ path: OUT + 'g-happy.png' });
await pi('swap', 'o_photo', 'o_phone'); await sleep(1200); await page.screenshot({ path: OUT + 'h-flip.png' });
await pi('o9', 'draft'); await sleep(1500); await page.screenshot({ path: OUT + 'i-draft.png' });
console.log(log.errors.slice(0, 5).join('\n'));
await b.close(); srv.kill();
