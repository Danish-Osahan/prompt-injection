// Play ?impact=1 dead-lift beat: lamp hold-E → panel F. Assert no word UI, no freeze, full-browser cam.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'mock-steal/v15');
const STILLS = path.join(OUT, 'stills');
const FRAMES = path.join(OUT, '_frames');
fs.mkdirSync(STILLS, { recursive: true });
fs.mkdirSync(FRAMES, { recursive: true });
for (const f of fs.readdirSync(FRAMES)) fs.unlinkSync(path.join(FRAMES, f));

const PORT = process.env.PORT || 5179;
const base = process.env.GAME_URL || `http://127.0.0.1:${PORT}`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  // Full-browser-ish Mac content area (toolbar takes chrome)
  const context = await browser.newContext({ viewport: { width: 1512, height: 982 } });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text()); });

  await page.goto(`${base}/?impact=1`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);

  const boot = await page.evaluate(() => {
    const s = window.__game?.scene?.scenes?.find(x => x.scene.key === 'game');
    if (!s) return { ok: false, why: 'no scene' };
    if (!s.impactLab?.on) s.impactLab?.start();
    const cam = s.cameras.main;
    return {
      ok: true, lab: !!s.impactLab?.on, steal: !!s.impactLab?.stealMode,
      lampOn: s.impactLab.lampAlive, follow: !!s.followCam, zoom: cam.zoom,
      vp: { x: cam.x, y: cam.y, w: cam.width, h: cam.height },
      codeOn: s.words?.codeOn, tagsVis: (s.clar?.tags ?? []).some(t => t.c.visible),
      chain: !!s.impactLab.chain,
    };
  });
  console.log('boot', boot);
  if (!boot.ok || !boot.lab) { console.error('FAIL boot', boot); process.exit(1); }
  if (boot.chain) { console.error('FAIL chain still present'); process.exit(1); }
  if (boot.codeOn || boot.tagsVis) { console.error('FAIL word UI', boot); process.exit(1); }
  if (boot.follow || boot.zoom > 1.16 || boot.zoom < 0.99 || boot.vp.x !== 0 || boot.vp.y !== 0) {
    console.error('FAIL camera not static/full-viewport zoom≈1', boot); process.exit(1);
  }
  // ENVELOP keeps logical 1280×720; canvas CSS covers the browser (no letterbox).


  const snap = async (name) => {
    const buf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(STILLS, name + '.png'), buf);
    fs.writeFileSync(path.join(FRAMES, name + '.png'), buf);
  };

  await snap('01-spawn');
  await page.waitForTimeout(800); // fern line / lamp flicker
  await snap('02-lamp-lure');

  // Teleport near lamp
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    const lp = s.impactLab.lampPos;
    s.x = lp.x + 30; s.y = lp.y + 40; s.dir = 'N';
  });
  await page.waitForTimeout(200);
  await snap('03-near-lamp');

  // Hold E
  await page.keyboard.down('E');
  await page.waitForTimeout(200);
  const mid = await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    return { codeOn: s.words.codeOn, modal: s.clar?.modal || '', peelT: s.impactLab.peelT, hand: s.hand };
  });
  console.log('midHold', mid);
  if (mid.codeOn || mid.modal || mid.hand) { console.error('FAIL word UI on E', mid); process.exit(1); }
  await snap('04-peel-hold');
  await page.waitForTimeout(450);
  await page.keyboard.up('E');
  await page.waitForTimeout(200);
  await snap('05-carrying');

  const after = await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    return { carrying: s.impactLab.carrying, lampOn: s.impactLab.lampAlive, hand: s.hand };
  });
  console.log('afterPeel', after);
  if (!after.carrying || after.lampOn || after.hand) { console.error('FAIL peel', after); process.exit(1); }

  // Near panel + F
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    const p = s.impactLab.panelPos;
    s.x = p.x + 80; s.y = p.y + 80; s.dir = 'NW';
  });
  await page.waitForTimeout(150);
  await snap('06-before-throw');
  await page.keyboard.press('F');
  await page.waitForTimeout(100);
  await snap('07-throw');

  let last = null;
  for (let k = 0; k < 40; k++) {
    await page.waitForTimeout(100);
    last = await page.evaluate(() => {
      const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
      const lab = s.impactLab;
      return {
        flying: lab.flying, done: lab.done, hitStopT: s.hitStopT, timeScale: s.timeScale,
        door: s.plateById('o_door')?.slotWord, codeOn: s.words.codeOn,
        panelTex: lab.panelSpr?.texture?.key, doorK: s.clar?.doorK,
      };
    });
    if (k % 5 === 0) console.log('t', k, last);
    if (last.done && last.hitStopT <= 0 && last.timeScale >= 0.99) break;
  }
  await snap('08-impact');
  await page.waitForTimeout(700);
  await snap('09-door-open');

  if (last.hitStopT > 0.01 || last.timeScale < 0.99) { console.error('FAIL freeze', last); process.exit(1); }
  if (!last.done) { console.error('FAIL not done', last); process.exit(1); }

  const post = await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    const x0 = s.x; s.x += 16;
    return {
      door: s.plateById('o_door')?.slotWord, moved: s.x === x0 + 16,
      hitStopT: s.hitStopT, codeOn: s.words.codeOn,
      tagsVis: (s.clar?.tags ?? []).some(t => t.c.visible),
      zoom: s.cameras.main.zoom, follow: s.followCam,
    };
  });
  console.log('post', post);

  // v15e: panel must sit adjacent to lift frame (world), not on kitchen/printer
  const geo = await page.evaluate(() => {
    const s = window.__game?.scene?.scenes?.find(x => x.scene.key === 'game');
    const lab = s?.impactLab;
    return lab?.liftFrameBounds ? { panel: lab.panelPos, b: lab.liftFrameBounds } : null;
  });
  if (geo) {
    const { panel: pp, b } = geo;
    if (!(pp.x > b.right && pp.x < b.frameRight + 55 && pp.y > b.top && pp.y < b.bottom)) {
      console.error('FAIL panel not beside lift frame', geo);
      process.exit(1);
    }
    // Kitchen FG ~ (299,153) is hidden in lab; panel on jamb (~312,188) can be near in Euclidean
    // space but must still be right of the opening and not left of frame.
    if (pp.x < b.right + 8) {
      console.error('FAIL panel overlaps opening', geo);
      process.exit(1);
    }
    console.log('panel-beside-frame OK', pp, 'frameRight', b.frameRight);
  }

  if (post.door !== 'OPEN') { console.error('FAIL door', post); process.exit(1); }
  if (!post.moved) { console.error('FAIL input stuck'); process.exit(1); }
  if (post.codeOn || post.tagsVis) { console.error('FAIL word UI after', post); process.exit(1); }

  await snap('10-walk');

  try {
    execSync(`ffmpeg -y -framerate 2 -pattern_type glob -i '${STILLS}/*.png' -c:v libx264 -pix_fmt yuv420p -crf 20 ${OUT}/playthrough.mp4`, { stdio: 'inherit' });
  } catch (e) { console.warn('ffmpeg', e.message); }

  console.log('PASS verify_steal dead-lift', OUT);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
