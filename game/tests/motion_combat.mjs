// Real-speed combat greybox clips (world words + transforms). node tests/motion_combat.mjs
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
await sleep(1600); mark('overview'); await sleep(800); mark('/overview');

// PAPER peels → Stapler morph → crumple
await pi('invuln', 90);
await pi('teleport', 125, 228); await sleep(300); mark('peel'); await pi('combat', 'peel'); await sleep(900); mark('/peel');
let s = await st(); let stpl = s.combat.enemies.find(e => e.kind === 'stapler');
await pi('teleport', stpl.x + 50, stpl.y); await sleep(300);
mark('paper'); await pi('combat', 'apply', 'stapler', 'PAPER'); await sleep(500);
stpl = (await st()).combat.enemies.find(e => e.kind === 'stapler' && !e.dead);
await pi('teleport', stpl.x - 45, stpl.y); await sleep(150);
for (let i = 0; i < 2; i++) { await input.press('attack'); await sleep(300); }
await sleep(500); mark('/paper');

// WET on Scribble
await pi('combat', 'clear'); await pi('combat', 'give', 'WET');
await pi('combat', 'spawn', 'scribble', '780,430');
mark('wet'); await pi('combat', 'apply', 'scribble', 'WET'); await sleep(900); mark('/wet');

// GLASS shatter
await pi('combat', 'clear'); await pi('combat', 'give', 'GLASS');
await pi('combat', 'spawn', 'stapler', '420,480');
mark('glass'); await pi('combat', 'apply', 'stapler', 'GLASS'); await sleep(500);
const gl = (await st()).combat.enemies.find(e => e.kind === 'stapler' && !e.dead);
await pi('teleport', gl.x - 45, gl.y); await sleep(100); await input.press('attack'); await sleep(700); mark('/glass');

// throw via F (no auto from attack)
await pi('combat', 'clear'); await pi('combat', 'give', 'SLOW');
await pi('combat', 'spawn', 'redline', '520,560');
await pi('teleport', 520, 500); await sleep(200);
mark('throw'); await pi('combat', 'throw'); await sleep(1000); mark('/throw');

// beam
await pi('combat', 'clear'); await pi('combat', 'ink', '100');
await pi('teleport', 700, 450); await sleep(200);
mark('beam'); await page.keyboard.down('j'); await sleep(1100); await page.keyboard.up('j'); await sleep(1000); mark('/beam');

await ctx.close(); await b.close(); srv.kill();
const vid = VID + readdirSync(VID).filter(f => f.endsWith('.webm')).sort().pop();
const seg = {}; for (const [n, t] of marks) { const k = n.replace('/', ''); seg[k] ??= {}; seg[k][n.startsWith('/') ? 'b' : 'a'] = t; }
for (const [k, v] of Object.entries(seg)) {
  if (v.a == null) continue; const e = v.b ?? v.a + 2; const d = Math.max(0.4, e - v.a + 0.3).toFixed(2), ss = Math.max(0, v.a - 0.12).toFixed(2);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss, '-t', d, '-i', vid, '-vf', 'fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', OUT + `cg-${k}.mp4`]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss, '-t', d, '-i', vid, '-vf', 'fps=15,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3', OUT + `cg-${k}.gif`]);
}
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String((seg.paper?.a ?? 4) + 0.3), '-i', vid, '-frames:v', '1', OUT + 'still-paper-stapler.png']);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String((seg.wet?.a ?? 8) + 0.4), '-i', vid, '-frames:v', '1', OUT + 'still-wet.png']);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String((seg.glass?.a ?? 10) + 0.6), '-i', vid, '-frames:v', '1', OUT + 'still-glass.png']);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.5', '-i', vid, '-frames:v', '1', OUT + 'still-overview.png']);
writeFileSync(OUT + 'marks.json', JSON.stringify({ marks, video: vid }, null, 1));
console.log('motion_combat', JSON.stringify(marks));
console.log('wrote', OUT);
