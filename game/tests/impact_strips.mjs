// Capture J-combo strip on dummy + chain-hit strip → mock-steal/v13-ingame/stills/
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const ST = path.join(ROOT, 'mock-steal/v13-ingame/stills');
const FR = path.join(ROOT, 'mock-steal/v13-ingame/_strips');
fs.mkdirSync(ST, { recursive: true });
fs.mkdirSync(FR, { recursive: true });

const PORT = 5182;
const base = `http://127.0.0.1:${PORT}`;

async function main() {
  let vite = null;
  try { await fetch(base); } catch {
    vite = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
      cwd: path.join(ROOT, 'game'), stdio: 'pipe',
    });
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 400));
      try { await fetch(base); break; } catch { /* */ }
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${base}/?impact=1&test=1`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2800);

  // --- J-combo on dummy ---
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    s.fitRoomCamera?.(48, 626);
    // Stand near dummy
    const d = s.enemies.find(e => e.practice);
    if (d) { s.x = d.x - 70; s.y = d.y + 10; s.dir = 'E'; }
    if (!s.impactLab.on) s.impactLab.start();
  });
  await page.waitForTimeout(200);

  const comboDir = path.join(FR, 'combo');
  fs.mkdirSync(comboDir, { recursive: true });
  let ci = 0;
  const snapC = async () => {
    fs.writeFileSync(path.join(comboDir, `c_${String(ci).padStart(3, '0')}.png`), await page.screenshot({ type: 'png' }));
    ci++;
  };

  // Fire 3 J hits via hooks / keyboard
  for (let h = 0; h < 3; h++) {
    await page.keyboard.down('J');
    await page.waitForTimeout(40);
    await page.keyboard.up('J');
    // capture during hit-stop window
    for (let f = 0; f < 8; f++) { await snapC(); await page.waitForTimeout(30); }
    await page.waitForTimeout(180);
  }
  // pick 8 frames spanning the combo
  const comboPicks = [2, 5, 8, 11, 14, 17, 20, 23].map(i => Math.min(i, ci - 1));
  comboPicks.forEach((i, j) => {
    const src = path.join(comboDir, `c_${String(i).padStart(3, '0')}.png`);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(ST, `combo-${String(j + 1).padStart(2, '0')}.png`));
  });
  console.log('combo frames', ci);

  // --- Chain throw ---
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    s.fitRoomCamera?.(48, 626);
    s.x = 880; s.y = 400; s.dir = 'NW';
    s.impactLab.takeOpen();
  });
  await page.waitForTimeout(200);
  const chainDir = path.join(FR, 'chain');
  fs.mkdirSync(chainDir, { recursive: true });
  let ki = 0;
  const snapK = async () => {
    fs.writeFileSync(path.join(chainDir, `k_${String(ki).padStart(3, '0')}.png`), await page.screenshot({ type: 'png' }));
    ki++;
  };
  for (let i = 0; i < 4; i++) { await snapK(); await page.waitForTimeout(50); }
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    s.impactLab.throwGust();
  });
  for (let i = 0; i < 40; i++) { await snapK(); await page.waitForTimeout(40); }
  // pick around contact
  const st = await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    return { broken: s.impactLab.chain?.broken, settled: s.impactLab.chain?.settled };
  });
  console.log('chain state', st, 'frames', ki);
  const chainPicks = [4, 8, 10, 12, 14, 18, 24, 32].map(i => Math.min(i, ki - 1));
  chainPicks.forEach((i, j) => {
    const src = path.join(chainDir, `k_${String(i).padStart(3, '0')}.png`);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(ST, `chain-${String(j + 1).padStart(2, '0')}.png`));
  });

  // ffmpeg strips
  const mk = (prefix, out) => {
    const ins = Array.from({ length: 8 }, (_, j) => `-i ${ST}/${prefix}-${String(j + 1).padStart(2, '0')}.png`).join(' ');
    execSync(`ffmpeg -y ${ins} -filter_complex "[0:v]scale=160:90[a];[1:v]scale=160:90[b];[2:v]scale=160:90[c];[3:v]scale=160:90[d];[4:v]scale=160:90[e];[5:v]scale=160:90[f];[6:v]scale=160:90[g];[7:v]scale=160:90[h];[a][b][c][d][e][f][g][h]hstack=inputs=8" ${ST}/${out}`, { stdio: 'inherit' });
  };
  mk('combo', 'combo-sequence-strip.png');
  mk('chain', 'chain-sequence-strip.png');

  // Verify lab isolation
  const iso = await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    let raw = null;
    try { raw = localStorage.getItem('pi.save.v1'); } catch { /* */ }
    return {
      labMode: s.labMode, debugOn: s.debugOn, buildStamp: s.buildStamp,
      x: Math.round(s.x), y: Math.round(s.y),
      zoom: +s.cameras.main.zoom.toFixed(4),
      saveTouched: !!raw, // may exist from prior play — lab must not have written
      plates: { ...s.save.plates },
    };
  });
  console.log('isolation', iso);

  await browser.close();
  if (vite) vite.kill();
  console.log('DONE strips');
}
main().catch(e => { console.error(e); process.exit(1); });
