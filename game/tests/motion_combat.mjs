// Real-speed combat greybox clips. node tests/motion_combat.mjs
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';
import { sleep, keyInput } from './helpers.mjs';
const OUT = new URL('../screenshots/combat-greybox/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const VID = '/tmp/motion_combat/'; rmSync(VID, { recursive: true, force: true }); mkdirSync(VID, { recursive: true }); const PORT = 4181;
const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { } await sleep(200); }
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: VID, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage(); const T0 = Date.now(); const marks = [];
await page.goto(`http://localhost:${PORT}/?test=1&new=1&combat=1`);
await page.waitForFunction(() => window.__pi, null, { timeout: 15000 });
const input = keyInput(page);
const pi = (fn, ...a) => page.evaluate(([fn, a]) => window.__pi[fn](...a), [fn, a]);
const st = () => page.evaluate(() => window.__pi.state());
const mark = (n) => marks.push([n, (Date.now() - T0) / 1000]);
await sleep(1800); mark('overview');
let s = await st();
const sc = s.combat.enemies.find(e => e.kind === 'scribble');
await pi('teleport', sc.x - 70, sc.y); await pi('invuln', 60); await sleep(400);
mark('combo'); for (let i = 0; i < 8; i++) { await input.press('attack'); await sleep(300); } await sleep(600); mark('/combo');
await pi('combat', 'spawn', 'scribble', '800,450');
await pi('combat', 'give', 'PAPER'); await pi('teleport', 760, 450); await sleep(300);
mark('throw'); await pi('combat', 'throw'); await sleep(900); await input.press('attack'); await sleep(500); mark('/throw');
await pi('combat', 'ink', '100');
const rl = (await st()).combat.enemies.find(e => e.kind === 'redline') || (await pi('combat', 'spawn', 'redline', '520,560'), (await st()).combat.enemies.find(e => e.kind === 'redline'));
await pi('teleport', rl.x, rl.y - 110); mark('redline');
for (let i = 0; i < 50; i++) { const r = (await st()).combat.enemies.find(e => e.kind === 'redline'); if (r && (r.state === 'stun' || r.state === 'charge' || r.state === 'scrape')) { /* keep filming */ } await sleep(100); }
mark('/redline');
await pi('combat', 'ink', '100'); await pi('teleport', 700, 480);
mark('beam'); await page.keyboard.down('j'); await sleep(1000); await page.keyboard.up('j'); await sleep(1200); mark('/beam');
const stpl = (await st()).combat.enemies.find(e => e.kind === 'stapler');
await pi('teleport', stpl.x + 55, stpl.y); await sleep(300);
mark('stapler'); for (let i = 0; i < 4; i++) { await input.press('attack'); await sleep(260); } await sleep(400);
await pi('teleport', stpl.x - 45, stpl.y); await pi('combat', 'peel'); await sleep(900); mark('/stapler');
await sleep(500);
await ctx.close(); await b.close(); srv.kill();
const vid = VID + readdirSync(VID).filter(f => f.endsWith('.webm')).sort().pop();
const seg = {}; for (const [n, t] of marks) { const k = n.replace('/', ''); seg[k] ??= {}; seg[k][n.startsWith('/') ? 'b' : 'a'] = t; }
for (const [k, v] of Object.entries(seg)) {
  if (v.a == null) continue; const e = v.b ?? v.a + 2; const d = (e - v.a + 0.35).toFixed(2), ss = Math.max(0, v.a - 0.15).toFixed(2);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss, '-t', d, '-i', vid, '-vf', 'fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', OUT + `cg-${k}.mp4`]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss, '-t', d, '-i', vid, '-vf', 'fps=15,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3', OUT + `cg-${k}.gif`]);
}
// stills from key moments
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '2.0', '-i', vid, '-frames:v', '1', OUT + 'still-overview.png']);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String((seg.combo?.a ?? 3) + 0.5), '-i', vid, '-frames:v', '1', OUT + 'still-combo.png']);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String((seg.beam?.a ?? 10) + 0.9), '-i', vid, '-frames:v', '1', OUT + 'still-beam.png']);
writeFileSync(OUT + 'marks.json', JSON.stringify({ marks, video: vid }, null, 1));
console.log('motion_combat', JSON.stringify(marks));
console.log('wrote clips to', OUT);
