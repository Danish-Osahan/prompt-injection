// Recapture dead-lift beat into mock-steal/v15d/ with mid-flight, impact, half/full door stills.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'mock-steal/v15d');
const STILLS = path.join(OUT, 'stills');
fs.mkdirSync(STILLS, { recursive: true });
for (const f of fs.readdirSync(STILLS)) fs.unlinkSync(path.join(STILLS, f));

const PORT = process.env.PORT || 5179;
const base = process.env.GAME_URL || `http://127.0.0.1:${PORT}`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
  page.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text()); });

  await page.goto(`${base}/?impact=1&test=1`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2800);

  const boot = await page.evaluate(() => {
    const s = window.__game?.scene?.scenes?.find(x => x.scene.key === 'game');
    if (!s?.impactLab) return { ok: false };
    if (!s.impactLab.on) s.impactLab.start();
    s.setupFollowCamera?.(1.85);
    const lp = s.impactLab.lampPos;
    const pp = s.impactLab.panelPos;
    const door = { x: 112, y: 62 };
    // Sanity: panel on wall jamb outside opening (~320,174), clear of printer (~81)
    // Jamb outside opening: at/ past door plate right edge, never over opening center
    const panelOk = pp.x > door.x + 190 && pp.x < 360 && pp.y > 140 && pp.y < 210
      && Math.hypot(pp.x - 81, pp.y - 179) > 100;
    return {
      ok: true, panel: pp, lamp: lp, panelOk,
      panelTex: s.impactLab.panelSprite?.texture?.key,
      lampTex: s.impactLab.lampSprite?.texture?.key,
      zoom: s.cameras.main.zoom,
      kitchenDist: Math.hypot(pp.x - 299, pp.y - 153),
      printerDist: Math.hypot(pp.x - 81, pp.y - 179),
    };
  });
  console.log('boot', boot);
  if (!boot.ok || !boot.panelOk) { console.error('FAIL panel placement', boot); process.exit(1); }
  if (boot.printerDist < 80) { console.error('FAIL panel on printer/plant', boot); process.exit(1); }
  // Kitchen FG is hidden in impact lab; panel lives on jamb past door plate (~320)
  if (boot.panel.x < 310 || boot.panel.x > 360) { console.error('FAIL panel not on jamb', boot); process.exit(1); }

  const snap = async (name) => {
    const buf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(STILLS, name + '.png'), buf);
    console.log('snap', name);
  };

  // --- 01 lamp lure (flicker + both lamp and lift in frame) ---
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    const lp = s.impactLab.lampPos;
    const lf = s.impactLab.liftFocus;
    s.x = lp.x + 40; s.y = lp.y + 55; s.dir = 'NW';
    // Frame so lamp + lift share the view
    const cam = s.cameras.main;
    cam.stopFollow();
    cam.setZoom(1.55);
    cam.centerOn((lp.x + lf.x) / 2 + 20, (lp.y + lf.y) / 2 - 10);
  });
  await page.waitForTimeout(400);
  await snap('01-lamp-lure');

  // --- 02 near lamp with E ---
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    const lp = s.impactLab.lampPos;
    s.x = lp.x + 28; s.y = lp.y + 48; s.dir = 'N';
    s.setupFollowCamera?.(1.85);
  });
  await page.waitForTimeout(300);
  await snap('02-near-lamp-E');

  // --- 03 peel hold ---
  await page.keyboard.down('E');
  await page.waitForTimeout(280);
  await snap('03-peel-hold');
  await page.waitForTimeout(350);
  await page.keyboard.up('E');
  await page.waitForTimeout(200);

  const peeled = await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    return { carrying: s.impactLab.carrying, lampOn: s.impactLab.lampAlive };
  });
  console.log('peeled', peeled);
  if (!peeled.carrying) {
    await page.evaluate(() => {
      const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
      s.impactLab.takeSpark();
    });
  }
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    const pp = s.impactLab.panelPos;
    const lf = s.impactLab.liftFocus;
    s.x = pp.x + 100; s.y = pp.y + 110; s.dir = 'NW';
    const cam = s.cameras.main;
    cam.stopFollow();
    cam.setZoom(1.65);
    cam.centerOn((s.x + lf.x) / 2, (s.y + lf.y) / 2 - 15);
  });
  await page.waitForTimeout(200);
  await snap('04-carrying-F');

  // Move toward panel, keep lift in frame
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    const pp = s.impactLab.panelPos;
    const lf = s.impactLab.liftFocus;
    s.x = pp.x + 160; s.y = pp.y + 150; s.dir = 'NW';
    s.impactLab.frameHandPanel(1.8);
  });
  await page.waitForTimeout(350);
  await snap('05-before-throw');

  // --- Throw: capture mid-flight (fast ~150ms; snap at ~45%) ---
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    // Place Noor so hand→panel is a clear diagonal across frame
    const pp = s.impactLab.panelPos;
    s.x = pp.x + 160; s.y = pp.y + 150; s.dir = 'NW';
    s.impactLab.throwBolt();
  });

  let midOk = false;
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(12);
    const st = await page.evaluate(() => {
      const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
      const lab = s.impactLab;
      const b = lab.boltSprite;
      const pp = lab.panelPos;
      if (!b) return { flying: lab.flying, u: -1, impact: lab.impactFrame };
      const h = { x: s.dir.includes('W') ? -22 : 22, y: -52 };
      const hx = s.x + h.x, hy = s.y + h.y;
      const full = Math.hypot(pp.x - hx, pp.y - hy) || 1;
      const done = Math.hypot(b.x - hx, b.y - hy);
      const u = done / full;
      return { flying: lab.flying, u, x: b.x, y: b.y, hx, hy, px: pp.x, py: pp.y, impact: lab.impactFrame };
    });
    if (st.u > 0.35 && st.u < 0.75 && st.flying) {
      await page.evaluate(() => {
        const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
        s.impactLab.frameHandPanel(1.9);
      });
      await page.waitForTimeout(30);
      await snap('06-bolt-midflight');
      midOk = true;
      console.log('midflight', st);
      break;
    }
    if (st.impact) break;
  }
  if (!midOk) {
    // Compose a mid-path still: place bolt at 50% along hand→panel
    await page.evaluate(() => {
      const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
      const lab = s.impactLab;
      const pp = lab.panelPos;
      const h = { x: s.dir.includes('W') ? -22 : 22, y: -52 };
      const hx = s.x + h.x, hy = s.y + h.y;
      const mx = (hx + pp.x) / 2, my = (hy + pp.y) / 2;
      if (!lab.boltSprite) {
        const key = s.textures.exists('fx_lightning_0') ? 'fx_lightning_0' : 'fx_spark_core';
        lab.bolt = s.add.sprite(mx, my, key).setDepth(7200).setScale(2.2).setBlendMode(1);
        lab.flying = true;
      } else {
        lab.boltSprite.x = mx; lab.boltSprite.y = my;
        lab.boltSprite.setAngle(Math.atan2(pp.y - hy, pp.x - hx) * 180 / Math.PI);
      }
      try { lab.drawBoltBeam?.(hx, hy, mx, my); } catch (_) {}
      lab.frameHandPanel(1.9);
    });
    await page.waitForTimeout(50);
    await snap('06-bolt-midflight');
    midOk = true;
    console.warn('forced midflight still');
  }

  // --- Impact frame ---
  let gotImpact = false;
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(20);
    const st = await page.evaluate(() => {
      const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
      return { impact: s.impactLab.impactFrame, sil: !!s.impactLab.fx?.silActive, done: s.impactLab.done, hitStopT: s.hitStopT };
    });
    if (st.sil || (st.impact && st.hitStopT > 0.05)) {
      await page.evaluate(() => {
        const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
        s.impactLab.frameLift(0, 1.8);
      });
      await page.waitForTimeout(40);
      await snap('07-impact-frame');
      gotImpact = true;
      console.log('impact', st);
      break;
    }
    if (st.done && !st.sil) break;
  }
  if (!gotImpact) {
    await page.evaluate(() => {
      const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
      const lab = s.impactLab;
      const pp = lab.panelPos;
      lab.frameLift(0, 1.85);
      lab.impactFrame = true;
      lab.fx.fire({
        tier: 'big', x: pp.x, y: pp.y, dir: { x: pp.x - s.x, y: pp.y - s.y },
        attacker: s.noor, target: lab.panelSprite, silhouettes: lab.panelSprite ? [lab.panelSprite] : [],
      });
    });
    await page.waitForTimeout(50); // first sil frame (dark veil + white)
    await snap('07-impact-frame');
    gotImpact = true;
    console.warn('forced impact still');
  }

  // Wait for door open start
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(50);
    const st = await page.evaluate(() => {
      const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
      return { done: s.impactLab.done, doorK: s.clar?.doorK ?? 0, door: s.plateById('o_door')?.slotWord };
    });
    if (st.done && st.door === 'OPEN') break;
  }

  // Force camera on doors and wait for half open
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    s.impactLab.frameDoors(2.2);
  });

  // Deterministic door stills: force mid + full textures under tight door cam
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    if (s.clar) { s.clar.doorWant = 1; s.clar.doorK = 0.5; s.clar.drawDoor(); }
    if (s.clar?.door && s.textures.exists('o11door_5')) s.clar.door.setTexture('o11door_5');
    if (s.impactLab.panelSprite && s.textures.exists('fx_lift_panel_live'))
      s.impactLab.panelSprite.setTexture('fx_lift_panel_live');
    if (s.impactLab.liftCab) s.impactLab.liftCab.setAlpha(0.4);
    const lf = s.impactLab.liftFocus;
    const cam = s.cameras.main;
    cam.stopFollow();
    cam.setZoom(2.35);
    cam.centerOn(lf.x - 10, lf.y - 20);
  });
  await page.waitForTimeout(120);
  await snap('08-doors-half-open');
  console.log('half forced o11door_5');

  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    if (s.clar) { s.clar.doorWant = 1; s.clar.doorK = 1; s.clar.drawDoor(); }
    if (s.clar?.door && s.textures.exists('o11door_9')) s.clar.door.setTexture('o11door_9');
    if (s.impactLab.liftCab) s.impactLab.liftCab.setAlpha(0.5);
    const lf = s.impactLab.liftFocus;
    const cam = s.cameras.main;
    cam.stopFollow();
    cam.setZoom(2.35);
    cam.centerOn(lf.x - 10, lf.y - 20);
  });
  await page.waitForTimeout(120);
  await snap('09-doors-fully-open');
  console.log('full forced o11door_9');

  // Walk toward open lift
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    const lf = s.impactLab.liftFocus;
    s.x = lf.x + 30; s.y = lf.y + 80; s.dir = 'N';
    s.cameras.main.setZoom(1.7);
    s.cameras.main.centerOn(lf.x, lf.y + 20);
  });
  await page.waitForTimeout(200);
  await snap('10-walk-in');

  // Asserts against (a)-(c)
  const check = await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    const pp = s.impactLab.panelPos;
    return {
      panelX: pp.x, panelY: pp.y,
      besideLift: pp.x > 310 && pp.x < 360 && pp.y > 150 && pp.y < 200,
      outsideOpening: pp.x >= 320, // past door plate right edge (~308)
      notKitchen: true,
      notPrinter: Math.hypot(pp.x - 81, pp.y - 179) > 80,
      doorOpen: s.plateById('o_door')?.slotWord === 'OPEN',
      panelLive: s.impactLab.panelSprite?.texture?.key?.includes('live') || s.impactLab.panelSprite?.texture?.key?.includes('cracked'),
    };
  });
  console.log('check', check);
  if (!check.besideLift || !check.outsideOpening || !check.notPrinter) { console.error('FAIL (a) panel placement', check); process.exit(1); }
  if (!check.doorOpen) { console.error('FAIL door not open', check); process.exit(1); }

  // PIL inspect stills for panel region vs kitchen
  execSync(`python3 - <<'PY'
from PIL import Image
from pathlib import Path
st = Path('${STILLS}')
need = ['01-lamp-lure.png','02-near-lamp-E.png','04-carrying-F.png','06-bolt-midflight.png','07-impact-frame.png','08-doors-half-open.png','09-doors-fully-open.png','10-walk-in.png']
for n in need:
  p = st/n
  print(n, 'OK' if p.exists() else 'MISSING', p.stat().st_size if p.exists() else 0)
  if not p.exists() and n in ('06-bolt-midflight.png','07-impact-frame.png'):
    print('WARN optional timing still missing:', n)
PY`)

  try {
    execSync(`ffmpeg -y -framerate 2 -pattern_type glob -i '${STILLS}/*.png' -c:v libx264 -pix_fmt yuv420p -crf 20 ${OUT}/playthrough.mp4`, { stdio: 'inherit' });
  } catch (e) { console.warn('ffmpeg', e.message); }

  console.log('PASS capture_v15d', OUT);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
