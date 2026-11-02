// art-v10 motion check at REAL game speed: records the browser (Playwright video) while driving the office, logs the
// time of each beat, then cuts MP4 + GIF clips with ffmpeg.  node tests/motion10.mjs [outdir]  (needs npm run build)
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { sleep, keyInput } from './helpers.mjs';
const OUT = process.argv[2] ?? new URL('../screenshots/motion10/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const VID = '/tmp/motion10vid/'; mkdirSync(VID, { recursive: true }); const PORT = 4179;
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
mark('reveal'); await sleep(4200); mark('/reveal');
const fps = await page.evaluate(() => window.__game.loop.actualFps); 
await pi('teleport', 640, 520); await sleep(900);
mark('walk');
for (const [dx, dy] of [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]) { await input.move(dx, dy); await sleep(700); await input.stop(); await sleep(500); }
mark('/walk');
await pi('teleport', 500, 520); await sleep(700); mark('dash'); await input.move(1, 0); await sleep(120); await input.press('dash'); await sleep(400); await input.stop(); await sleep(700); mark('/dash');
mark('attack'); for (let i = 0; i < 3; i++) { await input.press('attack'); await sleep(260); } await sleep(900); mark('/attack');
await pi('teleport', 300, 380); await sleep(1500); mark('phone'); await pi('read', 'o_phone');
await until(s => s.office9.ph === 'still', 9000); await sleep(1600); await pi('o9', 'closeCard'); await until(s => s.office9.mode === 'play' && !s.office9.ph, 6000); await sleep(1200); mark('/phone');
await pi('teleport', 640, 420); await sleep(1500); mark('kabir'); await pi('read', 'o_kabir');
await until(s => s.office9.ph === 'still', 9000); await sleep(1600); await pi('o9', 'closeCard'); await until(s => s.office9.mode === 'play' && !s.office9.ph, 6000); await sleep(1200); mark('/kabir');
await pi('teleport', 900, 300); await sleep(1800); mark('rain'); await pi('swap', 'o_rain', 'o_lamp'); await sleep(3200); mark('/rain');
await ctx.close(); await b.close(); srv.kill();
const vid = VID + readdirSync(VID).filter(f => f.endsWith('.webm')).sort().pop();
const seg = {}; for (const [n, t] of marks) { const k = n.replace('/', ''); seg[k] ??= {}; seg[k][n.startsWith('/') ? 'b' : 'a'] = t; }
for (const [k, { a, b: e }] of Object.entries(seg)) {
  const d = (e - a + 0.3).toFixed(2), ss = Math.max(0, a - 0.2).toFixed(2);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss, '-t', d, '-i', vid, '-vf', 'fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', OUT + `v10-${k}.mp4`]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss, '-t', d, '-i', vid, '-vf', 'fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3', OUT + `v10-${k}.gif`]);
}
writeFileSync(OUT + 'marks.json', JSON.stringify({ marks, fps, video: vid }, null, 1));
console.log('motion10', JSON.stringify(marks), 'fps', fps);
