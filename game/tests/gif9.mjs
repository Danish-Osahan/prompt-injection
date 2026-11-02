// art-v9 GIF frames (dev aid): node tests/gif9.mjs -> /tmp/gif9/<name>_NN.png
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { launch, open, sleep, DESKTOP } from './helpers.mjs';
const OUT = '/tmp/gif9/'; mkdirSync(OUT, { recursive: true }); const PORT = 4177;
const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { } await sleep(200); }
const b = await launch(); const { page } = await open(b, DESKTOP, `http://localhost:${PORT}/?test=1&new=1`, { errors: [], external: [] });
const pi = (fn, ...a) => page.evaluate(([fn, a]) => window.__pi[fn](...a), [fn, a]);
const grab = async (n, k, ms) => { for (let i = 0; i < k; i++) { await page.screenshot({ path: `${OUT}${n}_${String(i).padStart(2, '0')}.png` }); await sleep(ms); } };
await grab('reveal', 26, 120);
await pi('teleport', 600, 470); await sleep(2500); await pi('read', 'o_kabir'); await grab('pushin', 22, 90);
await pi('o9', 'closeCard'); await pi('teleport', 900, 300); await sleep(2500); await pi('swap', 'o_rain', 'o_lamp'); await grab('rainswap', 24, 110);
await b.close(); srv.kill();
