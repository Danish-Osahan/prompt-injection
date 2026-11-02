// art-v11 CLARITY office motion check at REAL game speed: records the browser (Playwright video) while driving the office, logs the
// time of each beat, then cuts MP4 + GIF clips with ffmpeg.  node tests/motion12.mjs [outdir]  (needs npm run build)
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';
import { sleep, keyInput, steer } from './helpers.mjs';
const OUT = process.argv[2] ?? new URL('../screenshots/motion12/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const VID = '/tmp/motion12vid/'; rmSync(VID, { recursive: true, force: true }); mkdirSync(VID, { recursive: true }); const PORT = 4179;
const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { } await sleep(200); }
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-gpu-rasterization'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: VID, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage(); const T0 = Date.now(); const marks = [];
await page.goto(`http://localhost:${PORT}/?test=1&new=1`);
await page.waitForFunction(() => window.__pi, null, { timeout: 15000 });
const input = keyInput(page);
const pi = (fn, ...a) => page.evaluate(([fn, a]) => window.__pi[fn](...a), [fn, a]);
const st = () => page.evaluate(() => window.__pi.state());
const mark = (n) => marks.push([n, (Date.now() - T0) / 1000]);
const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (f(await st())) return; await sleep(60); } };
mark('entry'); await sleep(2600);
const go = async (to, r = 14) => { for (let i = 0; i < 200; i++) { const p = (await st()).player; if (await steer(input, p, to, r) <= r) break; await sleep(40); } };
for (const w of [{ x: 250, y: 440 }, { x: 255, y: 262 }, { x: 205, y: 240 }]) { await go(w); } await input.stop(); await sleep(700);
await input.press('interact'); await sleep(900); await input.press('interact'); await until(s => s.clar.doorK >= 1, 3000); await sleep(600);
await input.move(0, -1); await until(s => s.room === 'hub', 5000); await sleep(900); await input.stop(); mark('/entry');
await pi('goto', 'office'); await until(s => s.room === 'office' && !!s.clar, 5000); await sleep(3600);
await pi('teleport', 600, 380); await sleep(500); mark('card'); await input.move(1, -0.4); await until(s => s.clar.near === 'o_kabir', 2500); await input.stop(); await sleep(600);
await input.press('interact'); await sleep(2600); await input.press('interact'); await sleep(900); mark('/card');
const d = (await st()).clar.dummy; await pi('teleport', d.x - 130, d.y - 50); await sleep(600); mark('dummy');
for (let i = 0; i < 100; i++) { const p = (await st()).player; if (await steer(input, p, { x: d.x - 70, y: d.y }, 10) <= 10) break; await sleep(40); } await input.stop(); await sleep(200); for (let i = 0; i < 3; i++) { await input.press('attack'); await sleep(260); } await sleep(1000);
await input.move(-1, 0); await sleep(500); await input.stop(); await sleep(300); await page.keyboard.down('j'); await sleep(800); await page.keyboard.up('j'); await sleep(1300); mark('/dummy');
await ctx.close(); await b.close(); srv.kill();
const vid = VID + readdirSync(VID).filter(f => f.endsWith('.webm')).sort().pop();
const seg = {}; for (const [n, t] of marks) { const k = n.replace('/', ''); seg[k] ??= {}; seg[k][n.startsWith('/') ? 'b' : 'a'] = t; }
for (const [k, { a, b: e }] of Object.entries(seg)) {
  const d = (e - a + 0.3).toFixed(2), ss = Math.max(0, a - 0.2).toFixed(2);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss, '-t', d, '-i', vid, '-vf', 'fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', OUT + `v12-${k}.mp4`]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss, '-t', d, '-i', vid, '-vf', 'fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3', OUT + `v12-${k}.gif`]);
}
writeFileSync(OUT + 'marks.json', JSON.stringify({ marks, video: vid }, null, 1));
console.log('motion12', JSON.stringify(marks));
