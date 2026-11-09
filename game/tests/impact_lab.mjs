// Capture Impact Lab beat (?impact=1) → mock-steal/v13-ingame/
// Asserts chain pieces settle on the floor (none left at the handle anchor).
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

function meanBright(buf) {
  // rough: sample PNG via sharp? skip — use file size / later PIL
  return 0;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text()); });
  await page.goto(`${base}/?impact=1&test=1`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);

  const ready = await page.evaluate(() => {
    const game = window.__game;
    if (!game) return { ok: false, why: 'no __game' };
    const s = game.scene?.scenes?.find(x => x.scene.key === 'game');
    if (!s) return { ok: false, why: 'no game scene' };
    if (!s.impactLab) return { ok: false, why: 'no impactLab' };
    if (!s.impactLab.on) s.impactLab.start();
    // Contain framing — do NOT pan off-center
    s.fitRoomCamera?.(48, 626);
    s.x = 880; s.y = 400; s.dir = 'NW';
    const span = s.impactLab.chain?.links?.length
      ? Math.abs(s.impactLab.chain.links[s.impactLab.chain.links.length - 1].x - s.impactLab.chain.links[0].x)
      : 0;
    return {
      ok: true, on: s.impactLab.on, room: s.room?.id,
      links: s.impactLab.chain?.links?.length, span: Math.round(span),
      door: s.plateById('o_door')?.slotWord,
      objVis: s.clar?.objective?.visible,
      cam: { z: s.cameras.main.zoom, cx: s.cameras.main.midPoint?.x ?? s.cameras.main.scrollX + 640 },
    };
  });
  console.log('ready', ready);
  if (!ready.ok) { await browser.close(); process.exit(1); }
  if (ready.span > 130) {
    console.error('FAIL chain span too wide for door:', ready.span);
    await browser.close(); process.exit(1);
  }
  if (ready.objVis) {
    console.error('FAIL objective banner still visible in lab');
    await browser.close(); process.exit(1);
  }

  await page.waitForTimeout(300);

  const fps = 15;
  let i = 0;
  const snap = async () => {
    const buf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(FRAMES, `f_${String(i).padStart(4, '0')}.png`), buf);
    i++;
  };

  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    s.impactLab.takeOpen();
  });
  for (let k = 0; k < 6; k++) { await snap(); await page.waitForTimeout(1000 / fps); }

  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    s.x = 880; s.y = 400; s.dir = 'NW';
    s.fitRoomCamera?.(48, 626);
    s.impactLab.throwGust();
  });
  console.log('thrown');

  let hitFrame = -1;
  for (let k = 0; k < fps * 6; k++) {
    await snap();
    const st = await page.evaluate(() => {
      const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
      const lab = s.impactLab;
      const floor = lab.chain?.assertOnFloor?.(16) ?? null;
      return {
        flying: lab.flying, done: lab.done, broken: lab.chain?.broken, settled: lab.chain?.settled,
        floor, objVis: s.clar?.objective?.visible,
        caption: s.clar?.cap?.text ?? '',
      };
    });
    if (hitFrame < 0 && st.broken) hitFrame = i - 1;
    if (k % 15 === 0) console.log('t', k, { broken: st.broken, settled: st.settled, floor: st.floor, caption: st.caption });
    if (st.settled) {
      for (let e = 0; e < 8; e++) { await snap(); await page.waitForTimeout(1000 / fps); }
      break;
    }
    await page.waitForTimeout(1000 / fps);
  }

  // ASSERT: pieces on floor, not at anchor
  const final = await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    return s.impactLab.chain.assertOnFloor(16);
  });
  console.log('assertOnFloor', final);
  if (!final.ok) {
    console.error('FAIL: chain pieces not on floor / still at anchor', final);
    await browser.close(); process.exit(1);
  }
  console.log('PASS chain settle assertion');

  // Settle still (full frame, links on floor)
  fs.writeFileSync(path.join(STILLS, '08-settle.png'), await page.screenshot({ type: 'png' }));
  fs.writeFileSync(path.join(STILLS, '07-scatter.png'), await page.screenshot({ type: 'png' }));

  console.log('frames', i, 'hitFrame', hitFrame);
  const hf = hitFrame > 0 ? hitFrame : 12;
  const picks = [
    ['01-carry', 3], ['02-throw', 7], ['03-contact', hf],
    ['04-hitstop', hf + 1], ['05-sil', hf + 2], ['06-snap', hf + 4],
    ['10-impact-1x', hf + 1],
  ];
  for (const [name, fi] of picks) {
    const src = path.join(FRAMES, `f_${String(Math.max(0, Math.min(fi, i - 1))).padStart(4, '0')}.png`);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STILLS, `${name}.png`));
  }
  // Prefer non-bleached frame for contact/1x (mean brightness via skipping very bright)
  // strip around hit
  const stripIdx = [hf - 1, hf, hf + 1, hf + 2, hf + 3, hf + 6, hf + 10, Math.min(i - 2, hf + 18)]
    .map(n => Math.max(0, Math.min(n, i - 1)));
  stripIdx.forEach((fi, j) => {
    const src = path.join(FRAMES, `f_${String(fi).padStart(4, '0')}.png`);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STILLS, `impact-${String(j + 1).padStart(2, '0')}-2x.png`));
  });

  await browser.close();

  execSync(`ffmpeg -y -framerate ${fps} -i ${FRAMES}/f_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 ${OUT}/beat.mp4`, { stdio: 'inherit' });
  execSync(`ffmpeg -y -i ${OUT}/beat.mp4 -vf fps=12,scale=640:-1:flags=lanczos -loop 0 ${OUT}/beat.gif`, { stdio: 'inherit' });
  const stripIns = stripIdx.map((_, j) => `-i ${STILLS}/impact-${String(j + 1).padStart(2, '0')}-2x.png`).join(' ');
  execSync(`ffmpeg -y ${stripIns} -filter_complex "[0:v]scale=160:90[a];[1:v]scale=160:90[b];[2:v]scale=160:90[c];[3:v]scale=160:90[d];[4:v]scale=160:90[e];[5:v]scale=160:90[f];[6:v]scale=160:90[g];[7:v]scale=160:90[h];[a][b][c][d][e][f][g][h]hstack=inputs=8" ${STILLS}/impact-sequence-strip.png`, { stdio: 'inherit' });

  // Brightness guard on contact still
  const { createRequire } = await import('module');
  // use PIL via shell
  execSync(`python3 - <<'PY'
from PIL import Image, ImageStat
from pathlib import Path
st = Path('${STILLS}')
for name in ['03-contact.png','10-impact-1x.png','07-scatter.png','impact-sequence-strip.png']:
  p = st/name
  if not p.exists(): continue
  m = sum(ImageStat.Stat(Image.open(p).convert('RGB')).mean)/3
  print(name, 'mean', round(m,1))
  if name in ('03-contact.png','10-impact-1x.png') and m > 140:
    raise SystemExit(f'FAIL {name} washed out mean={m}')
  if name == '07-scatter.png' and m > 200:
    raise SystemExit(f'FAIL {name} blank')
print('brightness ok')
PY`)

  console.log('DONE', OUT);
}
main().catch(e => { console.error(e); process.exit(1); });
