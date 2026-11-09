// Capture contain-framing stills at common desktop sizes → game/screenshots/fit2/
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'game/screenshots/fit2');
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [
  ['1280x800', 1280, 800],
  ['1440x900', 1440, 900],
  ['1512x982', 1512, 982],
  ['1920x1080', 1920, 1080],
  ['1366x768', 1366, 768],
];

const PORT = process.env.PORT || 5181;
const base = process.env.GAME_URL || `http://127.0.0.1:${PORT}`;

async function main() {
  let vite = null;
  if (!process.env.GAME_URL) {
    vite = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
      cwd: path.join(ROOT, 'game'), stdio: 'pipe',
    });
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 400));
      try { await fetch(base); break; } catch { /* */ }
    }
  }

  const browser = await chromium.launch({ headless: true });
  for (const [name, w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${base}/?impact=1`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2800);
    const info = await page.evaluate(() => {
      const s = window.__game?.scene?.scenes?.find(x => x.scene.key === 'game');
      if (!s) return null;
      const cam = s.cameras.main;
      return {
        lab: !!s.impactLab?.on,
        ephemeral: true,
        x: Math.round(s.x), y: Math.round(s.y),
        zoom: +cam.zoom.toFixed(4),
        vp: { x: cam.x, y: cam.y, w: cam.width, h: cam.height },
        debugOn: s.debugOn,
        room: s.room?.id,
      };
    });
    console.log(name, info);
    await page.screenshot({ path: path.join(OUT, `lab-${name}.png`), type: 'png' });
    // also normal office (no impact) for comparison — use ephemeral wipe via new so we don't need save
    await page.goto(`${base}/?new=1`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(OUT, `play-${name}.png`), type: 'png' });
    await page.close();
  }
  await browser.close();
  try { vite?.kill(); } catch {}
  console.log('DONE', OUT);
}
main().catch(e => { console.error(e); process.exit(1); });
