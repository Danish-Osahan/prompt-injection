// Capture dead-lift beat (?impact=1) → mock-steal/v15/ + assert resume / no word UI.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'mock-steal/v15');
const STILLS = path.join(OUT, 'stills');
const FRAMES = path.join(OUT, '_frames_lab');
fs.mkdirSync(STILLS, { recursive: true });
fs.mkdirSync(FRAMES, { recursive: true });
for (const f of fs.readdirSync(FRAMES)) fs.unlinkSync(path.join(FRAMES, f));

const PORT = process.env.PORT || 5179;
const base = process.env.GAME_URL || `http://127.0.0.1:${PORT}`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text()); });
  await page.goto(`${base}/?impact=1&test=1`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2800);

  const ready = await page.evaluate(() => {
    const s = window.__game?.scene?.scenes?.find(x => x.scene.key === 'game');
    if (!s?.impactLab) return { ok: false, why: 'no lab' };
    if (!s.impactLab.on) s.impactLab.start();
    s.setupStaticCamera?.();
    const lp = s.impactLab.lampPos;
    s.x = lp.x + 25; s.y = lp.y + 45; s.dir = 'N';
    return {
      ok: true, on: s.impactLab.on, steal: s.impactLab.stealMode,
      follow: s.followCam, zoom: s.cameras.main.zoom,
      chain: !!s.impactLab.chain, objVis: s.clar?.objective?.visible,
      lampOn: s.impactLab.lampAlive,
    };
  });
  console.log('ready', ready);
  if (!ready.ok || ready.chain || ready.objVis) {
    console.error('FAIL ready', ready); process.exit(1);
  }
  if (ready.follow || ready.zoom > 1.16) {
    console.error('FAIL camera should be static zoom≈1', ready); process.exit(1);
  }

  let i = 0;
  const snap = async () => {
    const buf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(FRAMES, `f_${String(i).padStart(4, '0')}.png`), buf);
    i++;
  };

  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    s.impactLab.takeSpark();
  });
  for (let k = 0; k < 4; k++) { await snap(); await page.waitForTimeout(60); }

  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    const p = s.impactLab.panelPos;
    s.x = p.x + 70; s.y = p.y + 70; s.dir = 'NW';
    s.impactLab.throwBolt();
  });
  console.log('thrown');

  for (let k = 0; k < 45; k++) {
    await snap();
    const st = await page.evaluate(() => {
      const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
      return {
        flying: s.impactLab.flying, done: s.impactLab.done,
        hitStopT: s.hitStopT, door: s.plateById('o_door')?.slotWord,
      };
    });
    if (k % 10 === 0) console.log('t', k, st);
    if (st.done && st.hitStopT <= 0) {
      for (let e = 0; e < 6; e++) { await snap(); await page.waitForTimeout(50); }
      break;
    }
    await page.waitForTimeout(50);
  }

  await page.waitForTimeout(500);
  const resume = await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    const x0 = s.x; s.x += 12;
    return {
      hitStopT: s.hitStopT, timeScale: s.timeScale, done: s.impactLab.done,
      door: s.plateById('o_door')?.slotWord, moved: s.x === x0 + 12,
      codeOn: s.words.codeOn, hand: s.hand, tagsVis: (s.clar?.tags ?? []).some(t => t.c.visible),
      follow: s.followCam, zoom: s.cameras.main.zoom,
    };
  });
  console.log('resume', resume);
  if (resume.hitStopT > 0.01 || resume.timeScale < 0.99 || !resume.done || !resume.moved) {
    console.error('FAIL resume', resume); process.exit(1);
  }
  if (resume.door !== 'OPEN') { console.error('FAIL door', resume); process.exit(1); }
  if (resume.codeOn || resume.hand || resume.tagsVis) { console.error('FAIL word UI', resume); process.exit(1); }
  console.log('PASS resume + dead-lift');

  fs.writeFileSync(path.join(STILLS, 'lab-settle.png'), await page.screenshot({ type: 'png' }));
  // copy a few frames
  for (const [name, fi] of [['lab-carry', 1], ['lab-throw', 5], ['lab-hit', 12]]) {
    const src = path.join(FRAMES, `f_${String(Math.min(fi, i - 1)).padStart(4, '0')}.png`);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STILLS, name + '.png'));
  }

  try {
    execSync(`ffmpeg -y -framerate 12 -i ${FRAMES}/f_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 20 ${OUT}/beat.mp4`, { stdio: 'inherit' });
  } catch (e) { console.warn('ffmpeg', e.message); }

  console.log('DONE', OUT);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
