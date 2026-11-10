// v15i: zoom 1, lift in the back wall at room scale, lamp on desk_podW.
// Captures stills at 1440x800 and 1280x800 with no follow zoom.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'mock-steal/v15i');
const STILLS = path.join(OUT, 'stills');
fs.mkdirSync(STILLS, { recursive: true });
// wipe previous stills (files + aspect folders)
for (const f of fs.readdirSync(STILLS)) {
  const p = path.join(STILLS, f);
  fs.rmSync(p, { recursive: true, force: true });
}

const PORT = process.env.PORT || 5179;
const base = process.env.GAME_URL || `http://127.0.0.1:${PORT}`;

const VIEWPORTS = [
  { w: 1440, h: 800, dir: '1440x800' },
  { w: 1280, h: 800, dir: '1280x800' },
];

function aabbIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function polyAabb(poly) {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

async function assertLayout(page, label) {
  const geo = await page.evaluate(() => {
    const s = window.__game?.scene?.scenes?.find(x => x.scene.key === 'game');
    if (!s?.impactLab) return { ok: false, why: 'no lab' };
    const b = s.impactLab.liftFrameBounds;
    const cam = s.cameras.main;
    // live prop sprites
    const props = {};
    for (const o of s.objs) {
      const key = o?.texture?.key || '';
      if (!key.startsWith('o11fg_')) continue;
      const name = key.slice('o11fg_'.length);
      const w = o.displayWidth ?? o.width, h = o.displayHeight ?? o.height;
      const ox = o.originX ?? 0, oy = o.originY ?? 0;
      props[name] = {
        x: o.x - w * ox, y: o.y - h * oy, w, h,
        sx: o.x, sy: o.y, depth: o.depth,
      };
    }
    const lamp = s.impactLab.lampSprite;
    const lw = lamp ? (lamp.displayWidth ?? lamp.width) : 0;
    const lh = lamp ? (lamp.displayHeight ?? lamp.height) : 0;
    return {
      ok: true,
      b,
      panel: s.impactLab.panelPos,
      lamp: s.impactLab.lampPos,
      lampSpr: lamp ? { x: lamp.x, y: lamp.y, w: lw, h: lh, originY: lamp.originY, scale: lamp.scaleX, depth: lamp.depth } : null,
      zoom: cam.zoom, follow: !!s.followCam,
      vp: { x: cam.x, y: cam.y, w: cam.width, h: cam.height },
      props,
    };
  });
  if (!geo.ok) { console.error('FAIL geo', label, geo); process.exit(1); }

  const fails = [];
  if (geo.follow) fails.push(`follow cam is on (want static)`);
  if (geo.zoom > 1.16 || geo.zoom < 0.99) fails.push(`zoom ${geo.zoom} not ≈1`);
  if (geo.vp.x !== 0 || geo.vp.y !== 0 || geo.vp.w !== 1280 || geo.vp.h !== 720) {
    fails.push(`viewport not full logical 1280x720: ${JSON.stringify(geo.vp)}`);
  }

  const frame = {
    x: geo.b.frameLeft, y: geo.b.frameTop,
    w: geo.b.frameRight - geo.b.frameLeft,
    h: geo.b.frameBottom - geo.b.frameTop,
  };
  const plant = geo.props.plantW;
  const desk = geo.props.desk_podW;
  const printer = geo.props.printer;

  if (plant && aabbIntersect(frame, plant)) {
    fails.push(`lift frame intersects plantW AABB frame=${JSON.stringify(frame)} plant=${JSON.stringify(plant)}`);
  }
  if (desk && aabbIntersect(frame, desk)) {
    fails.push(`lift frame intersects desk_podW AABB frame=${JSON.stringify(frame)} desk=${JSON.stringify(desk)}`);
  }

  // Printer: footprints must not intersect. Sprite AABB may kiss the lower-left
  // jamb (printer draws in front at depth 241 > lift 202) — that's the original plate.
  const printerFoot = polyAabb([[83, 223], [157, 223], [157, 241], [83, 241]]);
  if (aabbIntersect(frame, printerFoot)) {
    fails.push(`lift frame intersects printer footprint frame=${JSON.stringify(frame)} foot=${JSON.stringify(printerFoot)}`);
  }

  const baseGap = Math.abs(geo.b.frameBottom - geo.b.wallFloorY);
  if (baseGap > 6) {
    fails.push(`lift base ${geo.b.frameBottom} is ${baseGap}px from wall-floor ${geo.b.wallFloorY} (want ≤6)`);
  }

  const deskTop = geo.b.desk;
  const ly = geo.lamp.y, lx = geo.lamp.x;
  if (!(ly >= deskTop.y && ly <= deskTop.y + deskTop.topH)) {
    fails.push(`lamp base y=${ly} not on desk top face ${deskTop.y}..${deskTop.y + deskTop.topH}`);
  }
  if (!(lx >= deskTop.x + 8 && lx <= deskTop.x + deskTop.w - 8)) {
    fails.push(`lamp x=${lx} not on desk top x-range`);
  }

  const gap = geo.panel.x - geo.b.frameRight;
  if (!(geo.panel.x > geo.b.frameRight && geo.panel.x < geo.b.frameRight + 24
        && geo.panel.y > geo.b.top && geo.panel.y < geo.b.bottom)) {
    fails.push(`panel not adjacent to frame: panel=${JSON.stringify(geo.panel)} frameRight=${geo.b.frameRight}`);
  }
  if (gap < 2 || gap > 20) {
    fails.push(`panel-to-frame gap ${gap}px not in 2..20`);
  }

  if (fails.length) {
    console.error(`FAIL layout [${label}]`);
    for (const f of fails) console.error('  -', f);
    console.error('geo', JSON.stringify({ b: geo.b, panel: geo.panel, lamp: geo.lamp, zoom: geo.zoom, follow: geo.follow }, null, 2));
    process.exit(1);
  }
  console.log(`layout OK [${label}]`, {
    zoom: geo.zoom, follow: geo.follow,
    frame, baseGap, lamp: geo.lamp, panel: geo.panel, gap,
    plantR: plant && (plant.x + plant.w), printerFoot,
  });
  return geo;
}

async function bootLab(page) {
  await page.goto(`${base}/?impact=1&test=1`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  const boot = await page.evaluate(() => {
    const s = window.__game?.scene?.scenes?.find(x => x.scene.key === 'game');
    if (!s?.impactLab) return { ok: false };
    if (!s.impactLab.on) s.impactLab.start();
    s.setupStaticCamera?.();
    const lp = s.impactLab.lampPos;
    s.x = lp.x + 36; s.y = lp.y + 48; s.dir = 'NW';
    return {
      ok: true,
      zoom: s.cameras.main.zoom,
      follow: !!s.followCam,
      lamp: s.impactLab.lampPos,
      panel: s.impactLab.panelPos,
      b: s.impactLab.liftFrameBounds,
    };
  });
  if (!boot.ok) { console.error('FAIL boot', boot); process.exit(1); }
  return boot;
}

async function runViewport(browser, vp) {
  const dir = path.join(STILLS, vp.dir);
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  page.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text()); });

  const snap = async (name) => {
    const buf = await page.screenshot({ type: 'png' });
    const dest = path.join(dir, name + '.png');
    fs.writeFileSync(dest, buf);
    // also a flat copy with aspect prefix
    fs.writeFileSync(path.join(STILLS, `${vp.dir}-${name}.png`), buf);
    console.log('snap', vp.dir, name);
  };

  await bootLab(page);
  await assertLayout(page, `${vp.dir} boot`);

  // 01 closed lift — whole office, lamp on desk, lift in the wall
  await page.waitForTimeout(400);
  await snap('01-closed-dead-lift');

  // Get spark, throw at panel, snap bolt hit
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    const lp = s.impactLab.lampPos;
    s.x = lp.x + 28; s.y = lp.y + 44; s.dir = 'N';
    s.setupStaticCamera?.();
    if (!s.impactLab.carrying) s.impactLab.takeSpark();
  });
  await page.waitForTimeout(200);

  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    const pp = s.impactLab.panelPos;
    // Stand in the aisle so the bolt path to the panel is readable, lift in view
    s.x = pp.x + 90; s.y = pp.y + 140; s.dir = 'NW';
    s.setupStaticCamera?.();
    s.impactLab.throwBolt();
  });

  let hitOk = false;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(20);
    const st = await page.evaluate(() => {
      const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
      const lab = s.impactLab;
      return { flying: lab.flying, impact: lab.impactFrame, done: lab.done, k: lab.liftDoorOpenK };
    });
    if (st.impact || (!st.flying && (st.done || st.k > 0))) {
      await snap('02-bolt-hit');
      hitOk = true;
      console.log('bolt-hit', st);
      break;
    }
  }
  if (!hitOk) {
    await snap('02-bolt-hit');
    console.warn('WARN bolt-hit snapped without impact flag');
  }

  // Wait for / force doors fully open
  for (let i = 0; i < 30; i++) {
    const st = await page.evaluate(() => {
      const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
      return { done: s.impactLab.done, k: s.impactLab.liftDoorOpenK };
    });
    if (st.k >= 0.99) break;
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    s.impactLab.applyLiftDoorK(1);
    s.setupStaticCamera?.();
  });
  await page.waitForTimeout(150);
  await snap('03-doors-open');

  // Walk into the cab
  await page.evaluate(() => {
    const s = window.__game.scene.scenes.find(x => x.scene.key === 'game');
    const b = s.impactLab.liftFrameBounds;
    s.x = (b.left + b.right) / 2;
    s.y = b.bottom + 18;
    s.dir = 'N';
    s.setupStaticCamera?.();
  });
  await page.waitForTimeout(150);
  await snap('04-walk-in');

  await assertLayout(page, `${vp.dir} after`);
  await page.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  for (const vp of VIEWPORTS) {
    console.log('=== viewport', vp.dir, '===');
    await runViewport(browser, vp);
  }
  await browser.close();
  console.log('DONE', STILLS);
}

main().catch(e => { console.error(e); process.exit(1); });
