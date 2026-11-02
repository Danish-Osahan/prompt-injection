// art-v10 dev aid: stills of Noor full-body by a desk, walking frames
import { spawn } from 'node:child_process';
import { launch, open, sleep, DESKTOP } from './helpers.mjs';
const OUT = process.argv[2] ?? '/tmp/look10/'; const PORT = 4178;
const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { } await sleep(200); }
const b = await launch(); const log = { errors: [], external: [] };
const { page } = await open(b, DESKTOP, `http://localhost:${PORT}/?test=1&new=1`, log);
const pi = (fn, ...a) => page.evaluate(([fn, a]) => window.__pi[fn](...a), [fn, a]);
await sleep(4500); await pi('teleport', 300, 600); await sleep(2500); await page.screenshot({ path: OUT + 'desk.png' });
await page.keyboard.down('d'); for (let i = 0; i < 4; i++) { await sleep(150); await page.screenshot({ path: OUT + `walkE${i}.png` }); } await page.keyboard.up('d');
await sleep(400); await page.screenshot({ path: OUT + 'stop.png' });
console.log(log.errors.slice(0, 5).join('\n')); await b.close(); srv.kill();
