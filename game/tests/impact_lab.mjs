// Capture Impact Lab beat (?impact=1) → mock-steal/v13-ingame/
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'mock-steal/v13-ingame');
const STILLS = path.join(OUT, 'stills');
const FRAMES = path.join(OUT, '_frames');
fs.mkdirSync(STILLS, { recursive: true });
fs.mkdirSync(FRAMES, { recursive: true });
for (const f of fs.readdirSync(FRAMES)) fs.unlinkSync(path.join(FRAMES, f));

const PORT = process.env.PORT || 5179;
const base = process.env.GAME_URL || `http://127.0.0.1:${PORT}`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text()); });
  await page.goto(`${base}/?impact=1&new=1&test=1`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3500);

  const ready = await page.evaluate(() => {
    const game = window.__game;
    if (!game) return { ok: false, why: 'no __game' };
    const s = game.scene?.scenes?.find(x => x.scene.key === 'game');
    if (!s) return { ok: false, why: 'no game scene' };
    if (!s.impactLab) return { ok: false, why: 'no impactLab' };
    if (!s.impactLab.on) s.impactLab.start();
    // Center camera on door/chain area for readable capture
    s.cameras.main.centerOn(280, 220);
    s.x = 380; s.y = 300; s.dir = 'NW';
    return {
      ok: true, on: s.impactLab.on, room: s.room?.id, matter: !!s.matter,
      links: s.impactLab.chain?.links?.length, door: s.plateById('o_door')?.slotWord,
    };
  });
  console.log('ready', ready);
  if (!ready.ok) { await browser.close(); process.exit(1); }

  await page.waitForTimeout(400);

  // Pre-roll a few frames with carry swirl
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    s.impactLab.takeOpen();
  });

  const fps = 15;
  let i = 0;
  const snap = async () => {
    const buf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(FRAMES, `f_${String(i).padStart(4, '0')}.png`), buf);
    i++;
  };

  for (let k = 0; k < 8; k++) { await snap(); await page.waitForTimeout(1000 / fps); }

  // Throw
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    s.x = 380; s.y = 300; s.dir = 'NW';
    s.cameras.main.centerOn(280, 220);
    s.impactLab.throwGust();
  });
  console.log('thrown');

  let hitFrame = -1, snapFrame = -1;
  // Record until settled or timeout (~4s)
  for (let k = 0; k < fps * 4; k++) {
    await snap();
    const st = await page.evaluate(() => {
      const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
      const lab = s.impactLab;
      return {
        flying: lab.flying, done: lab.done, broken: lab.chain?.broken, settled: lab.chain?.settled,
        door: s.plateById('o_door')?.slotWord,
        linksY: lab.chain?.links?.map(l => Math.round(l.y)),
      };
    });
    if (hitFrame < 0 && !st.flying && st.done) hitFrame = i - 1;
    if (snapFrame < 0 && st.broken) snapFrame = i - 1;
    if (k % 15 === 0) console.log('t', k, st);
    if (st.settled && st.done) {
      for (let e = 0; e < 6; e++) { await snap(); await page.waitForTimeout(1000 / fps); }
      break;
    }
    await page.waitForTimeout(1000 / fps);
  }
  console.log('frames', i, 'hitFrame', hitFrame, 'snapFrame', snapFrame);

  // Light dummy still
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    s.cameras.main.centerOn(820, 520);
    s.impactLab?.onDummyHit?.(820, 520);
  });
  await page.waitForTimeout(100);
  fs.writeFileSync(path.join(STILLS, '09-light-dummy.png'), await page.screenshot({ type: 'png' }));

  const hf = hitFrame > 0 ? hitFrame : 16;
  const picks = [
    ['01-carry', 4], ['02-throw', 9], ['03-contact', hf],
    ['04-hitstop', hf + 1], ['05-sil', hf + 2], ['06-snap', Math.max(hf + 3, snapFrame)],
    ['07-scatter', hf + 8], ['08-settle', Math.min(i - 2, hf + 20)],
    ['10-impact-1x', hf],
  ];
  for (const [name, fi] of picks) {
    const src = path.join(FRAMES, `f_${String(Math.max(0, Math.min(fi, i - 1))).padStart(4, '0')}.png`);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STILLS, `${name}.png`));
  }
  const stripIdx = [hf - 2, hf - 1, hf, hf + 1, hf + 2, hf + 4, hf + 8, hf + 14].map(n => Math.max(0, Math.min(n, i - 1)));
  stripIdx.forEach((fi, j) => {
    const src = path.join(FRAMES, `f_${String(fi).padStart(4, '0')}.png`);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STILLS, `impact-${String(j + 1).padStart(2, '0')}-2x.png`));
  });

  await browser.close();

  execSync(`ffmpeg -y -framerate ${fps} -i ${FRAMES}/f_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 ${OUT}/beat.mp4`, { stdio: 'inherit' });
  execSync(`ffmpeg -y -i ${OUT}/beat.mp4 -vf fps=12,scale=640:-1:flags=lanczos -loop 0 ${OUT}/beat.gif`, { stdio: 'inherit' });
  const stripIns = stripIdx.map((_, j) => `-i ${STILLS}/impact-${String(j + 1).padStart(2, '0')}-2x.png`).join(' ');
  execSync(`ffmpeg -y ${stripIns} -filter_complex "[0:v]scale=160:90[a];[1:v]scale=160:90[b];[2:v]scale=160:90[c];[3:v]scale=160:90[d];[4:v]scale=160:90[e];[5:v]scale=160:90[f];[6:v]scale=160:90[g];[7:v]scale=160:90[h];[a][b][c][d][e][f][g][h]hstack=inputs=8" ${STILLS}/impact-sequence-strip.png`, { stdio: 'inherit' });
  console.log('DONE', OUT);
}
main().catch(e => { console.error(e); process.exit(1); });
