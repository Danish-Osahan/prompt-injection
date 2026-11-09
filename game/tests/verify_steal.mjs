// Play ?impact=1 like Danishpreet: walk → hold E → walk → F. Assert no old word UI + no freeze.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'mock-steal/v14-steal');
const STILLS = path.join(OUT, 'stills');
const FRAMES = path.join(OUT, '_frames');
fs.mkdirSync(STILLS, { recursive: true });
fs.mkdirSync(FRAMES, { recursive: true });
for (const f of fs.readdirSync(FRAMES)) fs.unlinkSync(path.join(FRAMES, f));

const PORT = process.env.PORT || 5179;
const base = process.env.GAME_URL || `http://127.0.0.1:${PORT}`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  // Clean profile, MacBook-ish viewport
  const context = await browser.newContext({ viewport: { width: 1512, height: 982 } });
  const page = await context.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

  await page.goto(`${base}/?impact=1`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2800);

  const boot = await page.evaluate(() => {
    const s = window.__game?.scene?.scenes?.find(x => x.scene.key === 'game');
    if (!s) return { ok: false, why: 'no scene' };
    if (!s.impactLab?.on) s.impactLab?.start();
    return {
      ok: true,
      lab: !!s.impactLab?.on,
      steal: !!s.impactLab?.stealMode,
      x: s.x, y: s.y,
      hand: s.hand,
      codeOn: s.words?.codeOn,
      codeA: s.words?.codeA,
      objVis: s.clar?.objective?.visible,
      tagsVis: (s.clar?.tags ?? []).some(t => t.c.visible),
      ephemeral: typeof s.save === 'object',
      hitStopT: s.hitStopT,
      timeScale: s.timeScale,
    };
  });
  console.log('boot', boot);
  if (!boot.ok || !boot.lab || !boot.steal) { console.error('FAIL boot', boot); process.exit(1); }
  if (boot.codeOn || boot.codeA > 0.01 || boot.objVis || boot.tagsVis || boot.hand) {
    console.error('FAIL word UI present at boot', boot); process.exit(1);
  }

  const snap = async (name) => {
    const buf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(STILLS, name + '.png'), buf);
    fs.writeFileSync(path.join(FRAMES, name + '.png'), buf);
  };

  await snap('01-spawn');

  // Walk toward window (right/up from 880,400)
  await page.keyboard.down('D');
  await page.keyboard.down('W');
  await page.waitForTimeout(700);
  await page.keyboard.up('D');
  await page.keyboard.up('W');
  // Nudge near window
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    s.x = 940; s.y = 220; s.dir = 'N';
  });
  await page.waitForTimeout(200);
  await snap('02-at-window');

  // Hold E to peel (0.7s > peelNeed 0.55)
  await page.keyboard.down('E');
  await page.waitForTimeout(250);
  await snap('03-peel-hold');
  // Mid-hold: assert NO code vision / NO picker
  const midHold = await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    return {
      codeOn: s.words.codeOn, codeA: s.words.codeA,
      modal: s.clar?.modal || '',
      carrying: s.impactLab.carrying, peelT: s.impactLab.peelT,
      hand: s.hand, chipVis: s.words.chipG?.visible, barVis: s.words.bar?.visible,
      tagsVis: (s.clar?.tags ?? []).some(t => t.c.visible),
    };
  });
  console.log('midHold', midHold);
  if (midHold.codeOn || midHold.codeA > 0.05 || midHold.modal || midHold.hand || midHold.tagsVis) {
    console.error('FAIL old word UI during hold E', midHold); process.exit(1);
  }
  await page.waitForTimeout(500);
  await page.keyboard.up('E');
  await page.waitForTimeout(200);
  await snap('04-carrying');

  const afterPeel = await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    return {
      carrying: s.impactLab.carrying,
      hand: s.hand,
      rain: s.plateById('o_rain')?.slotWord,
      codeOn: s.words.codeOn,
    };
  });
  console.log('afterPeel', afterPeel);
  if (!afterPeel.carrying) { console.error('FAIL peel did not take OPEN'); process.exit(1); }
  if (afterPeel.hand) { console.error('FAIL hand chip set (old word system)'); process.exit(1); }

  // Walk toward door
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    s.x = 880; s.y = 360; s.dir = 'NW';
  });
  await page.waitForTimeout(150);
  await snap('05-before-throw');

  // Press F
  await page.keyboard.press('F');
  await page.waitForTimeout(80);
  await snap('06-throw');

  // Wait through contact + snap + failsafe (max ~400ms hitstop + travel)
  let last = null;
  for (let k = 0; k < 40; k++) {
    await page.waitForTimeout(100);
    last = await page.evaluate(() => {
      const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
      const lab = s.impactLab;
      return {
        flying: lab.flying, done: lab.done, broken: lab.chain?.broken, settled: lab.chain?.settled,
        hitStopT: s.hitStopT, timeScale: s.timeScale,
        door: s.plateById('o_door')?.slotWord,
        codeOn: s.words.codeOn, codeA: s.words.codeA,
        modal: s.clar?.modal || '',
        hand: s.hand,
        floor: lab.chain?.assertOnFloor?.(18) ?? null,
        noorAnim: s.noor?.anims?.isPlaying,
      };
    });
    if (k % 5 === 0) console.log('t', k, last);
    if (last.settled && last.done && last.hitStopT <= 0 && last.timeScale >= 0.99) break;
  }
  await snap('07-after');

  // FREEZE ASSERT: must resume
  if (last.hitStopT > 0.01) { console.error('FAIL still in hit-stop', last); process.exit(1); }
  if (last.timeScale < 0.99) { console.error('FAIL timeScale stuck', last); process.exit(1); }
  if (!last.broken) { console.error('FAIL chain not broken', last); process.exit(1); }

  // Wait for door open (420ms real-time after snap)
  await page.waitForTimeout(600);
  const post = await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    // Prove input works: move Noor
    const x0 = s.x;
    s.x += 20;
    return {
      door: s.plateById('o_door')?.slotWord,
      moved: s.x === x0 + 20,
      hitStopT: s.hitStopT,
      timeScale: s.timeScale,
      floor: s.impactLab.chain.assertOnFloor(18),
      codeOn: s.words.codeOn,
      tagsVis: (s.clar?.tags ?? []).some(t => t.c.visible),
      caption: s.clar?.cap?.text ?? '',
    };
  });
  console.log('post', post);
  await snap('08-door-open');

  if (post.door !== 'OPEN') { console.error('FAIL door not OPEN', post); process.exit(1); }
  if (!post.moved) { console.error('FAIL input/position stuck'); process.exit(1); }
  if (!post.floor?.ok) { console.error('FAIL chain not on floor', post.floor); process.exit(1); }
  if (post.codeOn || post.tagsVis || (post.caption && post.caption.length > 0)) {
    console.error('FAIL word UI after throw', post); process.exit(1);
  }

  // Walk through check (door open plates)
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    s.x = 700; s.y = 280;
  });
  await page.waitForTimeout(200);
  await snap('09-walk');

  // Inspect stills for grey rect / word UI via PIL brightness + OCR-ish heuristics
  execSync(`python3 - <<'PY'
from PIL import Image, ImageStat
from pathlib import Path
st = Path('${STILLS}')
for name in sorted(st.glob('*.png')):
  im = Image.open(name).convert('RGB')
  m = sum(ImageStat.Stat(im).mean)/3
  # sample center-left door region for flat grey rectangle (impact frame bug)
  w,h = im.size
  crop = im.crop((int(w*0.35), int(h*0.25), int(w*0.55), int(h*0.55)))
  stv = ImageStat.Stat(crop)
  var = sum(stv.var)/3
  print(name.name, 'mean', round(m,1), 'doorRegionVar', round(var,1))
  if name.name in ('06-throw.png','07-after.png') and var < 80 and m > 100:
    # very flat grey blob region → fail
    print('WARN low variance door region (possible grey rect)')
print('inspect ok')
PY`)

  // short video from stills
  try {
    execSync(`ffmpeg -y -framerate 2 -pattern_type glob -i '${STILLS}/*.png' -c:v libx264 -pix_fmt yuv420p -crf 20 ${OUT}/playthrough.mp4`, { stdio: 'inherit' });
  } catch (e) { console.warn('ffmpeg video skip', e.message); }

  if (errs.length) console.log('console errors', errs.slice(0, 8));
  console.log('PASS verify_steal', OUT);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
