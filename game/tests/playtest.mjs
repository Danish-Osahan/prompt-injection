// Prompt Injection Phase 1 headless playtest: node tests/playtest.mjs
// Serves dist/ with `vite preview` (unless GAME_URL is set), walks all 6 rooms, solves the puzzles
// through test hooks + real keyboard/touch input, screenshots every room, and fails on console errors.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { launch, open, sleep, MOBILE, DESKTOP } from './helpers.mjs';
import { office11 } from './office11.mjs';
import { combatGreybox } from './combat_greybox.mjs';
const PORT = 4175;
const URL_ = process.env.GAME_URL ?? `http://localhost:${PORT}/?test=1&new=1`;
const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
const PHASE1 = new URL('../../mock-steal/phase1/stills/', import.meta.url).pathname;

const results = [];
mkdirSync(SHOTS, { recursive: true });
mkdirSync(PHASE1, { recursive: true });

const ok = (name, pass, info = '') => { results.push({ name, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  - ' + info : ''}`); };
const st = (page) => page.evaluate(() => window.__pi.state());
const pi = (page, fn, ...a) => page.evaluate(([fn, a]) => window.__pi[fn](...a), [fn, a]);
async function waitFor(page, pred, ms = 15000) { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await st(page); if (pred(s)) return s; await sleep(100); } return s; }
async function shot(page, name) { await sleep(250); await page.screenshot({ path: `${SHOTS}${name}.png` }); }
async function still1(page, name) {
  await sleep(250);
  const dest = `${PHASE1}${name}.png`;
  await page.screenshot({ path: dest });
  await page.screenshot({ path: `${SHOTS}phase1-${name}.png` });
}
async function steal(page, from, to) {
  const took = await pi(page, 'steal', 'take', from);
  await sleep(180);
  const threw = await pi(page, 'steal', 'throw', to);
  await sleep(450);
  return { took, threw };
}


async function meanLum(page, clip) {
  const b64 = (await page.screenshot({ clip })).toString('base64');
  return page.evaluate((b64) => new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let t = 0; for (let i = 0; i < d.length; i += 4) t += (d[i] + d[i + 1] + d[i + 2]) / 3; res(t / (d.length / 4)); }; im.src = 'data:image/png;base64,' + b64; }), b64);
}

/** art-v9 OFFICE test level: directing camera, layers, close-ups, swap visuals, Noor reactions, pressure, reduce motion */
async function office9(browser, legacy = false) {
  // art-v11: legacy = the DEFAULT old-angle office (same directing camera / close-up shots / reactions); the lower angle runs with ?v9
  const log = { errors: [], external: [] };
  const { ctx, page, input } = await open(browser, DESKTOP, legacy ? URL_ : URL_ + '&v9', log);
  const T = legacy ? 'office' : 'v9';
  await page.waitForFunction(() => window.__pi, null, { timeout: 10000 });
  const o9 = async () => (await st(page)).office9;
  let o = await o9(), s;
  ok(legacy ? 'office: the default office is the old-angle plate (office9 only behind ?v9)' : 'v9: office runs the art-v9 perspective level', !!o && (legacy ? o.legacy && o.layers === 0 : o.layers >= 10), JSON.stringify(o && { layers: o.layers, legacy: o.legacy }));
  ok(T + ' camera: room entry opens on an establishing shot with letterbox bars', o.mode === 'establish' && o.lb > 0.5 && (legacy ? o.zoom > o.base * 1.2 : o.zoom < o.base), `${o.mode} lb ${o.lb} zoom ${o.zoom}`);
  await shot(page, (legacy ? 'v11-' : 'v9-') + '01-establishing');
  o = (await waitFor(page, s => s.office9.mode === 'play' && s.office9.lb < 0.1, 20000)).office9;
  ok(T + ' camera: establishing shot settles to gameplay framing', o.mode === 'play' && o.lb < 0.1, `${o.mode} lb ${o.lb}`);
  await shot(page, (legacy ? 'v11-' : 'v9-') + '02-office-new-angle');
  // drift + look-ahead: walking right moves the camera centre right of Noor's last position
  await pi(page, 'teleport', 560, 450); await sleep(2500); const c0 = (await o9()).cx; await input.move(1, 0); await sleep(900); await input.stop(); o = await o9();
  if (!legacy) ok(T + ' camera: follows with look-ahead (centre moves with Noor)', o.cx > c0 + 20, `cx ${c0} -> ${o.cx}`);
  else ok('office camera: the whole room stays framed in play (soft clamp, no jitter)', Math.abs(o.cx - 640) <= 1 && Math.abs(o.cy - 360) <= 1, `cx ${o.cx} cy ${o.cy}`);
  // push-in on inspect (no close-up for Dez's desk)
  await pi(page, 'read', 'o_dez'); o = (await waitFor(page, s => s.office9.mode === 'inspect' && s.office9.zoom > s.office9.playZoom * 1.05, 6000)).office9;
  ok(T + ' camera: inspect pushes in', o.mode === 'inspect' && o.zoom > o.playZoom * 1.05, `zoom ${o.zoom} play ${o.playZoom.toFixed(3)}`);
  await shot(page, (legacy ? 'v11-' : 'v9-') + '03-inspect-push-in');
  await waitFor(page, s => s.office9.mode === 'play', 8000);
  // rendered close-up + code vision inside it
  await pi(page, 'read', 'o_kabir'); o = (await waitFor(page, s => s.office9.card === 'kabir' && s.office9.cardA > 0.95, 8000)).office9;
  ok(T + ' close-up: inspecting Kabir\'s note cuts to its rendered close-up', o.card === 'kabir' && o.cardA > 0.95, JSON.stringify({ card: o.card, a: o.cardA }));
  { const seen = new Set([o.ph]); const t0 = Date.now(); while (Date.now() - t0 < 4000 && o.ph !== 'still') { o = await o9(); seen.add(o.ph); await sleep(60); }
  ok(T + ' close-up: one continuous shot (approach -> dissolve -> rendered dolly -> still)', o.ph === 'still' && seen.has('dolly'), [...seen].join('>')); }
  await shot(page, (legacy ? 'v11-' : 'v9-') + '04-kabir-close');
  await page.keyboard.down('e'); o = (await waitFor(page, s => s.office9.cardCode > 0.9, 4000)).office9; await shot(page, (legacy ? 'v11-' : 'v9-') + '04b-kabir-close-code'); await page.keyboard.up('e');
  ok(T + ' close-up: code vision shows that object\'s code line on the card', o.cardCode > 0.9 && o.cardLine === 'kabir.note = "miss you";', o.cardLine);
  await sleep(300); await input.move(0, 1); await sleep(250); await input.stop(); o = (await waitFor(page, s => !s.office9.card && s.office9.mode === 'play', 4000)).office9;
  ok(T + ' close-up: moving returns smoothly to play', !o.card && o.mode === 'play', `${o.card} ${o.mode}`);
  // the phone beat: tight on Noor, she looks at her phone, then the card
  await pi(page, 'read', 'o_phone'); o = (await waitFor(page, s => s.office9.mode === 'noor', 4000)).office9;
  await waitFor(page, s => s.office9.lb > 0.6, 4000); const beat = (await o9()); await sleep(300); await shot(page, (legacy ? 'v11-' : 'v9-') + '05-phone-noor-closeup');
  ok(T + ' camera: phone = emotional close-up on Noor, letterboxed, phone anim', o.mode === 'noor' && /noor_phone_/.test(beat.anim) && beat.lb > 0.5, `${o.mode} ${beat.anim} lb ${beat.lb}`);
  o = (await waitFor(page, s => s.office9.card === 'phone' && s.office9.cardA > 0.95, 8000)).office9; await shot(page, (legacy ? 'v11-' : 'v9-') + '06-phone-close');
  ok(T + ' close-up: phone card follows the Noor beat', o.card === 'phone');
  await pi(page, 'o9', 'closeCard'); await waitFor(page, s => s.office9.mode === 'play', 4000);
  // swaps visibly change the room
  await pi(page, 'teleport', 900, 300); await sleep(1200); await shot(page, (legacy ? 'v11-' : 'v9-') + '07a-rain-sad');
  await pi(page, 'swap', 'o_rain', 'o_lamp'); o = await o9();
  ok(T + ' Noor: a swap gets a surprised reaction', o.reacting === 'surprise' && /noor_surprise_/.test(o.anim), `${o.reacting} ${o.anim}`);
  o = (await waitFor(page, s => legacy || s.office9.vars.toys > 0.98, 8000)).office9; await sleep(1900); o = await o9(); await shot(page, (legacy ? 'v11-' : 'v9-') + '07b-rain-happy');
  ok(T + ' swap: rain SAD -> HAPPY warms the window light and slows the rain', (legacy ? o.refl > 0.3 : o.vars.toys > 0.98) && o.rainK < 0.5, JSON.stringify(o.vars) + ' rainK ' + o.rainK);
  await pi(page, 'swap', 'o_photo', 'o_phone'); o = (await waitFor(page, s => legacy || s.office9.vars.flip > 0.98, 6000)).office9;
  s = await st(page);
  ok(T + ' swap: PHOTO LIES DOWN <-> PHONE LIES UP flips the photo (and the phone)', (legacy || o.vars.flip > 0.98) && s.plates.o_photo.words === 'PHOTO LIES UP' && s.plates.o_phone.words === 'PHONE LIES DOWN', `${s.plates.o_photo.words} / ${s.plates.o_phone.words}`);
  ok(T + ' swap: toy pairs only trade inside their pair', !(await pi(page, 'swap', 'o_photo', 'o_rain')));
  await pi(page, 'teleport', 330, 640); await sleep(1400); await shot(page, (legacy ? 'v11-' : 'v9-') + '08-photo-flipped');
  await pi(page, 'read', 'o_photo'); o = (await waitFor(page, s => s.office9.card === 'photo_up' && s.office9.cardA > 0.95, 8000)).office9; await shot(page, (legacy ? 'v11-' : 'v9-') + '08b-photo-up-close');
  ok(T + ' close-up: the flipped photo has its own face-up close-up', o.card === 'photo_up');
  await pi(page, 'o9', 'closeCard'); await sleep(400);
  // claim: code vision near the monitor reveals DENIED and the monitor stays red
  await pi(page, 'teleport', 990, 642); await sleep(900);
  await page.keyboard.down('e'); s = await waitFor(page, s => (legacy || s.office9.vars.claim > 0.5) && s.codeView, 5000); await sleep(400); await shot(page, (legacy ? 'v11-' : 'v9-') + '09-code-vision-new-angle'); await page.keyboard.up('e');
  ok(T + ' code vision: perspective wireframe + code lines anchored at the new angle', s.codeView && s.codeLines.includes('claim.status = DENIED;') && s.codeLines.length >= 4, s.codeLines.join(' | '));
  if (!legacy) { o = (await waitFor(page, s => s.office9.vars.claim > 0.98, 4000)).office9; await sleep(500); await shot(page, (legacy ? 'v11-' : 'v9-') + '10-claim-red');
  ok(T + ' swap visuals: claim.status DENIED turns the monitor red after the reveal', o.vars.claim > 0.98); }
  // Noor reacts: gaze toward the nearest inspectable, idles after a few seconds
  await pi(page, 'teleport', 330, 560); await input.move(0, 1); await sleep(60); await input.stop(); o = (await waitFor(page, s => /noor_look[LR]_/.test(s.office9.anim), 4000)).office9;
  ok(T + ' Noor: head turns toward the nearest inspectable while standing', /noor_look[LR]_/.test(o.anim), o.anim);
  await pi(page, 'teleport', 640, 500); await sleep(200); await pi(page, 'o9', 'idle', 4.5); o = (await waitFor(page, s => /noor_(phone|shadow)_/.test(s.office9.anim), 4000)).office9;
  await sleep(400); await shot(page, (legacy ? 'v11-' : 'v9-') + '11-noor-idle');
  ok(T + ' Noor: idles after a few seconds still (phone / looks for her shadow)', /noor_(phone|shadow)_/.test(o.anim), o.anim);
  // pressure: unread ticks, glitch, the Draft in the glass
  const u0 = o.unread; await pi(page, 'o9', 'unread'); await pi(page, 'teleport', 165, 400); s = await waitFor(page, s => s.caption.includes(`${u0 + 1} unread`), 4000);
  ok(T + ' pressure: the phone unread count ticks up (and the caption says so)', s.office9.unread === u0 + 1 && s.caption.includes(`${u0 + 1} unread`), s.caption.slice(0, 90));
  const g0 = s.office9.glitchN; await pi(page, 'o9', 'glitch'); o = await o9();
  ok(T + ' pressure: a subtle chromatic glitch can fire', o.glitchN === g0 + 1);
  await pi(page, 'teleport', 900, 260); await sleep(1500); await pi(page, 'o9', 'draft'); o = (await waitFor(page, s => s.office9.glimpse, 3000)).office9; await sleep(1400); await shot(page, (legacy ? 'v11-' : 'v9-') + '12-draft-glimpse');
  ok(T + ' pressure: a brief Draft silhouette passes behind the glass', o.draft && o.glimpse);
  ok(T + ' pressure: never punishes lingering (no damage, no timer)', (await st(page)).hp === 4);
  // reduce motion
  await pi(page, 'reduceMotion', true); await pi(page, 'goto', 'office'); s = await waitFor(page, s => s.room === 'office' && s.office9 && s.office9.roomT > 0.2, 8000); o = s.office9;
  ok(T + ' reduce motion: no establishing move, bars off', o.reduce && o.mode === 'play' && o.lb < 0.1, `${o.mode} lb ${o.lb}`);
  await pi(page, 'read', 'o_dez'); await sleep(700); o = await o9();
  ok(T + ' reduce motion: no push-in zoom', Math.abs(o.zoom - o.playZoom) < 0.01, `zoom ${o.zoom} play ${o.playZoom}`);
  await pi(page, 'reduceMotion', false);
  ok(T + ': zero console errors', log.errors.length === 0, log.errors.slice(0, 5).join(' | '));
  await ctx.close();
}

async function serve() {
  if (process.env.GAME_URL) return null;
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return p; } catch { /* not up yet */ } await sleep(200); }
  throw new Error('preview server did not start (run npm run build first)');
}

async function linger(browser) {
  const log = { errors: [], external: [] };
  const { ctx, page } = await open(browser, DESKTOP, URL_ + '&swap=1', log);
  await page.waitForFunction(() => window.__pi, null, { timeout: 10000 });
  let s;
  for (const r of ['office', 'hub', 'corridor', 'archive', 'arena', 'message']) {
    await pi(page, 'goto', r); s = await waitFor(page, s => s.room === r && s.state === 'play', 8000);
    if (s.cutscene) { await page.keyboard.down('x'); await sleep(900); await page.keyboard.up('x'); }
    await sleep(500); s = await st(page);
    ok(`linger ${r}: >=4 inspectable story objects`, s.looks.length >= 4, s.looks.join(','));
    // ENVELOP + static cam: world fills 1280×720; caption HUD overlays (no world letterbox crop).
    ok(`linger ${r}: world camera fills the plate (HUD caption overlays)`, s.cam.y === 0 && s.cam.h === 720 && Math.abs(s.cam.zoom - 1) < 0.05, `bottom ${s.cam.bottom.toFixed(1)} bar ${s.cam.barY} z ${s.cam.zoom}`);
    const vis = s.amb.filter(a => a.visible && a.name !== 'line');
    const f0 = s.amb.map(a => a.frame); await sleep(700); const s2 = await st(page);
    const moved = s2.amb.filter((a, i) => a.frames > 1 && a.frame !== f0[i]).length;
    ok(`linger ${r}: >=2 Blender ambient loops, frames advancing`, vis.length >= 2 && moved >= 1, vis.map(a => a.name + ':' + a.frames).join(' ') + ` moved ${moved}`);
    const first = s.looks[0];
    await pi(page, 'read', first); await sleep(350); s = await st(page);
    await shot(page, `linger-${r}-inspect`);
    ok(`linger ${r}: reading a story object logs it`, s.save.looked.includes(first), first);
    const unlocked = await pi(page, 'readAll'); await sleep(200);
    ok(`linger ${r}: inspect-all unlocks the room's extra code line`, unlocked === true);
    s = await st(page); const ln = s.lineIds.find(l => l.visible);
    if (r === 'arena') ok('linger arena: unsent line hidden until the Draft falls', s.lineIds.every(l => !l.visible));
    else { const n = s.save.lines.length; await pi(page, 'read', ln?.id); await sleep(300); s = await st(page); ok(`linger ${r}: collectible unsent line picked up`, s.save.lines.length === n + 1, `${s.save.lines.length}/6`); }
    if (r === 'corridor') ok('corridor: no code-drawn cyan floor bars', s.corridorBars === false);
    // global fix: the longest caption line in every room wraps (<= 2 lines) and never clips at the screen edges
    const caps = await pi(page, 'captions'); const longest = caps.sort((a, b) => b.t.length - a.t.length)[0];
    await pi(page, 'capForce', longest.id, longest.t); await sleep(350); s = await st(page);
    const rows = s.captionRows; if (r === 'office' || longest.t.length > 70) await shot(page, `v9-caption-wrap-${r}`);
    if (r === 'office') ok('caption office (clarity): no screenplay caption rows; lore lives in cards', rows.length === 0, JSON.stringify(rows)); else ok(`caption wrap ${r}: longest line (${longest.t.length} chars) fits in <= 2 lines`, rows.length >= 1 && rows.length <= 2 && rows.every(q => q.x0 >= 16 && q.x1 <= 1264), JSON.stringify(rows) + ' ' + longest.t.slice(0, 40));
    await pi(page, 'capForce', null);
    if (r === 'corridor' || r === 'archive') { const sm = s.amb.filter(a => ['moth', 'drip', 'duck'].includes(a.name)); ok(`linger ${r}: small ambient loops are readable at game size (>= 20 px)`, sm.length > 0 && sm.every(a => Math.min(a.w, a.h) >= 20), sm.map(a => `${a.name} ${a.w}x${a.h}`).join(' ')); }
    if (r === 'hub') {   // global fix: the dash gap is a lit shaft, not a hard black band
      await pi(page, 'teleport', 640, 560); await sleep(400); await shot(page, 'v9-hub-gap');
      const lum = await meanLum(page, { x: 300, y: 228, width: 600, height: 40 });
      ok('hub: the gap reads as a shaft, not a hard black band', lum > 14, `mean luminance ${lum.toFixed(1)}`);
    }
  }
  await pi(page, 'goto', 'office'); await waitFor(page, s => s.room === 'office', 5000); await sleep(400);
  // strict (art-v9 fix): the stand-still narrator line must actually show in the subtitle box
  await pi(page, 'teleport', 640, 500); await pi(page, 'idle', 6.5);
  await sleep(2500); s = await st(page);
  ok('linger: standing still in the clarity office stays quiet (no idle narrator line)', s.sub === '' && s.clar.caption === '', `sub "${s.sub}" cap "${s.clar.caption}"`);
  const ok1 = await pi(page, 'swap', 'o_rain', 'o_lamp'); s = await st(page);
  ok('linger: code-vision toy swaps with its partner', !!ok1 && s.plates.o_rain.words !== 'RAIN FEELS SAD', s.plates.o_rain.words + ' / ' + s.plates.o_lamp.words);
  ok('linger: toys only swap with toys', !(await pi(page, 'swap', 'o_rain', 'o_coffee')));
  await pi(page, 'teleport', 420, 520); await sleep(300); await page.keyboard.down('d'); await sleep(60); await page.keyboard.press('Space'); await sleep(110);
  await page.screenshot({ path: `${SHOTS}linger-dash-hair.png` }); await page.keyboard.up('d'); await sleep(900);
  await page.keyboard.down('e'); await sleep(650); s = await st(page); await shot(page, 'linger-wire-noor'); await page.keyboard.up('e');
  ok('code view: Noor ghost is a wireframe sheet', (s.ghostTex ?? '').endsWith('_wire'), s.ghostTex);
  ok('linger: zero console errors', log.errors.length === 0, log.errors.slice(0, 5).join(' | '));
  await ctx.close();
}

async function desktop(browser) {
  const log = { errors: [], external: [] };
  const { ctx, page, input } = await open(browser, DESKTOP, URL_, log);
  await page.waitForFunction(() => window.__pi, null, { timeout: 10000 });
  let s = await st(page);
  ok('desktop: starts in R0 real office', s.room === 'office', s.room);
  await shot(page, 'desktop-01-office');
  // movement (real keys)
  const x0 = s.player.x, y0 = s.player.y;
  await input.move(1, -1); await sleep(600); await input.stop(); s = await st(page);
  ok('desktop: 8-dir walk (diagonal) moves Noor', s.player.x - x0 > 30 && y0 - s.player.y > 30, `dx ${Math.round(s.player.x - x0)} dy ${Math.round(s.player.y - y0)}`);
  // dash
  const dx0 = s.player.x; await input.move(1, 0); await sleep(40); await input.press('dash'); await sleep(60);
  s = await st(page); const dashIframes = s.iframes > 0 && s.dashing;
  await sleep(150); await input.stop(); s = await st(page);
  ok('desktop: dash bursts forward with i-frames', s.player.x - dx0 > 100 && dashIframes, `moved ${Math.round(s.player.x - dx0)}px, iframes during dash ${dashIframes}`);
  ok('desktop: dash cooldown ~1s', s.dashCd > 0.6 && s.dashCd <= 1.0, `cd left ${s.dashCd.toFixed(2)}`);
  // OFFICE: dead-lift beat (no READ / typist / caption chips)
  const lamp = await page.evaluate(() => {
    const s = window.__game.scene.getScene('game');
    return s.impactLab ? s.impactLab.lampPos : { x: 178, y: 291 };
  });
  await pi(page, 'teleport', lamp.x + 36, lamp.y + 48); await sleep(200);
  const lit = await pi(page, 'openLift');
  s = await waitFor(page, s => s.liftDone || s.doorOpen || (s.plates.o_door && s.plates.o_door.words === 'DOOR IS OPEN'), 8000);
  ok('office: lamp spark thrown into the lift panel opens the doors', !!(s.liftDone || s.doorOpen || (s.plates.o_door && s.plates.o_door.words.includes('OPEN'))), `lit ${lit} door ${s.plates.o_door && s.plates.o_door.words} done ${s.liftDone}`);
  await sleep(900);
  await still1(page, 'office-doors-open');
  await shot(page, 'desktop-02-office-lift');
  await pi(page, 'teleport', 200, 168); await sleep(500);
  s = await waitFor(page, s => s.room === 'hub', 6000);
  ok('office: walking into the open cab goes to the Mirror Hub', s.room === 'hub', s.room);
  const raw = await page.evaluate(() => JSON.parse(localStorage.getItem('pi.save.v1')));
  ok('desktop: room transition autosaves to localStorage', raw?.room === 'hub', raw?.room);

  // HUB: take OPEN from the lamp, throw at the door
  await sleep(400);
  if (s.cutscene) { await page.keyboard.down('x'); await sleep(900); await page.keyboard.up('x'); await sleep(200); }
  await pi(page, 'teleport', 256, 556); await sleep(150);
  const hub = await steal(page, 'h_lamp', 'h_door');
  s = await waitFor(page, s => s.flags.door, 4000);
  ok('hub: take OPEN from the lamp, throw it at the door', s.flags.door && s.plates.h_door.words === 'DOOR IS OPEN' && s.plates.h_lamp.words === 'LAMP IS SHUT', `${s.plates.h_door.words} / ${s.plates.h_lamp.words} ${JSON.stringify(hub)}`);
  ok('hub: door throw is the checkpoint', s.save.checkpoint.plate === 'h_door');
  await still1(page, 'hub-door-open');
  await shot(page, 'desktop-04-hub-door');
  await pi(page, 'teleport', 640, 505); await sleep(200);
  await input.move(0, -1); await sleep(700); await input.stop(); s = await st(page);
  ok('hub: walk through the open door', s.player.y < 400, `y ${Math.round(s.player.y)}`);
  const deaths0 = s.save.deaths;
  await input.move(0, -1); s = await waitFor(page, s => s.dying, 3000); await input.stop();
  ok('hub: walking into the gap kills (UNDO)', s.dying);
  await shot(page, 'desktop-05-undo');
  s = await waitFor(page, s => !s.dying && s.lastRespawnMs > 0, 3000);
  ok('hub: respawn under 1s at checkpoint, door stays open', s.lastRespawnMs > 0 && s.lastRespawnMs < 1000 && s.flags.door && s.save.deaths === deaths0 + 1, `${Math.round(s.lastRespawnMs)}ms door ${s.flags.door} y ${Math.round(s.player.y)}`);
  await pi(page, 'teleport', 640, 350); await sleep(400);
  await input.move(0, -1); await sleep(30); await input.press('dash'); await sleep(250); await input.stop(); s = await st(page);
  ok('hub: dash crosses the gap', !s.dying && s.player.y < 250, `y ${Math.round(s.player.y)} dying ${s.dying}`);
  await input.move(0, -1); s = await waitFor(page, s => s.room === 'corridor', 4000); await input.stop();
  ok('hub: north exit leads to the Dark Corridor', s.room === 'corridor');

  // CORRIDOR: switch ON → lamp, clock QUICK → dummy, then attack
  await sleep(400); await shot(page, 'desktop-06-corridor-dark');
  s = await st(page);
  ok('corridor: Fern note hidden in the dark', !s.plates.c_note.visible);
  await pi(page, 'teleport', 205, 226); await sleep(120);
  await steal(page, 'c_switch', 'c_light');
  s = await waitFor(page, s => s.flags.lit, 4000);
  ok('corridor: take ON from the switch, throw it into the lamp', s.flags.lit && s.plates.c_note.visible, s.plates.c_light.words);
  await still1(page, 'corridor-lamp-on');
  await shot(page, 'desktop-08-corridor-lit');
  await pi(page, 'teleport', 1110, 560); await sleep(100);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('j'); await sleep(260); }
  s = await st(page); const dummy0 = s.enemies.find(e => e.kind === 'dummy');
  ok('corridor: Paper Dummy ignores hits while still', dummy0.hp === 6 && dummy0.state === 'idle');
  await pi(page, 'teleport', 1110, 202); await sleep(120);
  await steal(page, 'c_clock', 'c_dummy');
  s = await waitFor(page, s => s.flags.quick, 3000);
  ok('corridor: take QUICK from the clock, throw it at the dummy', s.flags.quick && s.plates.c_dummy.words === 'DUMMY IS QUICK');
  await pi(page, 'teleport', 1110, 560); await input.move(0, -1); await sleep(30); await input.stop();
  let swings = 0; for (let i = 0; i < 30; i++) { s = await st(page); if (s.enemies[0].dead) break; await page.keyboard.press('j'); swings++; await sleep(230); if (swings === 2) await shot(page, 'desktop-09-dummy-fight'); }
  s = await st(page);
  ok('corridor: TYPE combo defeats the woken dummy', s.enemies[0].dead, `${swings} swings, hp ${s.hp}`);
  await pi(page, 'teleport', 1150, 420); await input.move(1, 0); s = await waitFor(page, s => s.room === 'archive', 4000); await input.stop();
  ok('corridor: alcove exit opens -> Flooded Archive', s.room === 'archive');

  // ARCHIVE: drawer LOW → water, stairs DOWN → bridge
  await sleep(400); await shot(page, 'desktop-10-archive-flooded');
  s = await st(page);
  ok('archive: STAIRS GO DOWN is underwater (hidden)', !s.plates.a_stairs.visible);
  const early = await pi(page, 'steal', 'take', 'a_stairs');
  ok('archive: order matters, DOWN cannot be taken first', early === false);
  await pi(page, 'teleport', 100, 594); await sleep(120);
  const wrong = await steal(page, 'a_drawer', 'a_bridge');
  s = await st(page);
  ok('archive: LOW thrown at the bridge rebounds (does not lower it)', !s.flags.bridge, s.plates.a_bridge.words);
  await pi(page, 'steal', 'undo'); await sleep(200);
  await steal(page, 'a_drawer', 'a_water');
  s = await waitFor(page, s => s.flags.drained && s.plates.a_stairs.visible, 4000);
  ok('archive: take LOW from the drawer, throw it into the water', s.flags.drained && s.plates.a_stairs.visible, `${s.plates.a_water.words} / ${s.plates.a_drawer.words}`);
  await pi(page, 'teleport', 560, 220); await sleep(120);
  await steal(page, 'a_stairs', 'a_bridge');
  s = await waitFor(page, s => s.flags.bridge, 4000);
  ok('archive: take DOWN from the stairs, throw it at the bridge', s.flags.bridge && s.plates.a_bridge.words === 'BRIDGE IS DOWN', s.plates.a_stairs.words);
  await still1(page, 'archive-bridge-down');
  await pi(page, 'teleport', 420, 420); await input.move(1, 0); await sleep(2400); await input.stop(); s = await st(page);
  ok('archive: Noor walks across the bridge', s.player.x > 840, `x ${Math.round(s.player.x)}`);
  await shot(page, 'desktop-11-archive-bridge');
  await pi(page, 'invuln', 60);
  const maxDiving = async (ms) => { let m = 0; const t0 = Date.now(); while (Date.now() - t0 < ms) { const q = await st(page); m = Math.max(m, q.enemies.filter(e => e.kind === 'note' && (e.state === 'windup' || e.state === 'dive')).length); await pi(page, 'invuln', 60); await sleep(60); } return m; };
  await pi(page, 'teleport', 1000, 520); const together = await maxDiving(3500);
  ok('archive: notes still group-dive before APART', together >= 2, `max simultaneous ${together}`);
  await pi(page, 'teleport', 1170, 560); await sleep(120);
  await steal(page, 'a_books', 'a_notes');
  await pi(page, 'teleport', 900, 300); await sleep(1600); await pi(page, 'invuln', 60); s = await st(page);
  await pi(page, 'teleport', 1000, 520); const apart = await maxDiving(4000); s = await st(page);
  ok('archive: take APART from the books, throw it at the notes', s.flags.apart && apart === 1, `${s.plates.a_notes.words}, max simultaneous ${apart}`);
  await pi(page, 'teleport', 1140, 248); await sleep(120);
  await steal(page, 'a_towel', 'a_ink'); s = await st(page);
  const sc = s.enemies.find(e => e.kind === 'scribble'); await pi(page, 'teleport', sc.x - 40, sc.y); await input.move(1, 0); await sleep(20); await input.stop(); await page.keyboard.press('j'); await sleep(150); s = await st(page);
  ok('archive: take DRY from the towel, throw it at the ink', s.flags.dry && s.enemies.find(e => e.kind === 'scribble').hp <= 1, `${s.plates.a_ink.words}, scribble hp ${s.enemies.find(e => e.kind === 'scribble').hp}`);
  await shot(page, 'desktop-11b-archive-cracks');
  for (let i = 0; i < 60; i++) {
    s = await st(page); const es = s.enemies.filter(e => !e.dead); if (!es.length) break;
    es.sort((a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y));
    await pi(page, 'teleport', es[0].x - 40, es[0].y); await input.move(1, 0); await sleep(20); await input.stop(); await page.keyboard.press('j'); await sleep(200);
  }
  s = await st(page);
  ok('archive: Scribble and sticky-note swarm can be defeated', s.enemies.every(e => e.dead), s.enemies.map(e => `${e.kind}:${e.hp}`).join(' '));
  await pi(page, 'teleport', 1180, 420); await input.move(1, 0); s = await waitFor(page, s => s.room === 'arena', 4000); await input.stop();
  ok('archive: east exit -> Draft arena', s.room === 'arena');

  // ARENA: peel WEAK from the pillar, throw it at the Draft
  s = await waitFor(page, s => s.boss && s.boss.state !== 'intro' && s.state === 'play', 5000);
  ok('arena: Draft fight starts (36 HP, guarded)', s.boss?.hp === 36 && s.boss.guarded, JSON.stringify(s.boss));
  const near = async () => { const b = (await st(page)).boss; await pi(page, 'teleport', b.x, b.y + 60); await input.move(0, -1); await sleep(30); await input.stop(); };
  await pi(page, 'bossFreeze', true); await pi(page, 'invuln', 60); await near(); await page.keyboard.press('j'); await sleep(150); s = await st(page);
  ok('arena: STRONG guard blocks most damage (x0.25)', Math.abs(s.boss.hp - 35.75) < 0.01, `hp ${s.boss.hp}`);
  await pi(page, 'invuln', 60); await pi(page, 'bossAttack', 'swipe'); await sleep(250); s = await st(page);
  ok('arena: Paper Swipe telegraphs (floor flash wind-up)', s.boss.state === 'swipeTell', s.boss.state);
  await shot(page, 'desktop-12-draft-telegraph');
  await pi(page, 'invuln', 60); await pi(page, 'bossAttack', 'toss'); await sleep(450); await shot(page, 'desktop-13-draft-toss-tell'); s = await waitFor(page, s => s.boss.balls >= 3, 2000);
  ok('arena: Crumple Toss throws 3 balls', s.boss.balls >= 3, `balls ${s.boss.balls}`);
  await pi(page, 'invuln', 60); await pi(page, 'bossAttack', 'ring'); s = await waitFor(page, s => s.boss.ring, 3000); await shot(page, 'desktop-14-rephrase-ring');
  s = await waitFor(page, s => s.boss.state === 'punish', 2000);
  ok('arena: REPHRASE ring then 2s punish window', s.boss.state === 'punish' && s.boss.punishCount >= 1);
  const hpP = s.boss.hp; await near(); await page.keyboard.press('j'); await sleep(120); s = await st(page);
  ok('arena: punish window doubles damage', Math.abs(hpP - s.boss.hp - 0.5) < 0.01, `took ${(hpP - s.boss.hp).toFixed(2)} (guarded 0.25 x2)`);
  await pi(page, 'bossFreeze', true);
  await pi(page, 'teleport', 403, 222); await sleep(150);
  await steal(page, 'r_weak', 'r_guard');
  s = await waitFor(page, s => s.boss && !s.boss.guarded, 4000);
  ok('arena: take WEAK from the pillar, throw it at the Draft', !s.boss.guarded && /WEAK/.test(s.boss.sign || ''), `${s.boss.sign} guardT ${s.boss.guardT}`);
  await still1(page, 'arena-guard-broken');
  await near(); await shot(page, 'desktop-15-guard-broken');
  const hpG = s.boss.hp; await page.keyboard.press('j'); await sleep(150); s = await st(page);
  ok('arena: broken guard takes full damage', Math.abs(hpG - s.boss.hp - 1) < 0.01, `took ${(hpG - s.boss.hp).toFixed(2)}`);
  await pi(page, 'bossFreeze', true); await near(); await sleep(1600);
  await page.keyboard.down('j'); await sleep(900); await page.keyboard.up('j'); await sleep(150); s = await st(page);
  ok('move: SELECT hold-drag line hits the Draft', s.selectN >= 1 && s.selectHits >= 1, `selects ${s.selectN} hits ${s.selectHits}`);
  await pi(page, 'perfectDodge', 'ball'); s = await st(page);
  ok('move: perfect dodge CUTs the attack', s.stored === 'ball' && s.perfectN >= 1);
  const hpC = s.boss.hp; await page.keyboard.press('j'); await sleep(400); s = await st(page);
  ok('move: next press PASTEs it back (3 dmg)', s.pasteN >= 1 && s.stored === null && hpC - s.boss.hp >= 2.9, `took ${(hpC - s.boss.hp).toFixed(2)}`);
  await pi(page, 'bossHp', 18.6); await near(); await page.keyboard.press('j'); await sleep(250); s = await st(page);
  ok('arena: half health splits into two shadowless Drafts', s.boss.split && s.boss.fake, JSON.stringify(s.boss));
  await pi(page, 'reguard'); await sleep(200); s = await st(page);
  const top = s.save.wordLog[0]?.word ?? 'STRONG';
  ok('arena: split sign uses the most-placed word (tease)', s.boss.sign === `THE DRAFT IS ${top === 'WEAK' ? 'STRONG' : top}` && s.boss.guarded, `${s.boss.sign} (top ${top})`);
  await pi(page, 'bossFreeze', true); await shot(page, 'desktop-16-draft-split');
  await near(); await page.keyboard.press('j'); await sleep(450); s = await st(page);
  ok('arena: hitting the real Draft dispels the fake', !s.boss.fake);
  await page.keyboard.press('r'); await sleep(100); s = await st(page);
  ok('move: FERN ROOT pins the Draft', s.rootN === 1 && s.rootUsed && s.boss.pinT > 1.0, `pin ${s.boss.pinT.toFixed(2)} growth ${s.save.fernGrowth}`);
  await page.keyboard.press('r'); await sleep(100); s = await st(page);
  ok('move: FERN ROOT is once per fight', s.rootN === 1);
  await pi(page, 'kill'); s = await waitFor(page, s => !s.dying && s.lastRespawnMs > 0 && s.boss && s.boss.hp === 36, 3000);
  ok('arena: death restarts the fight at the arena door', s.boss.hp === 36 && !s.boss.split && Math.abs(s.player.y - 660) < 5 && s.boss.guarded, `hp ${s.boss.hp} y ${Math.round(s.player.y)}`);
  s = await waitFor(page, s => s.boss.state !== 'intro', 3000);
  await pi(page, 'bossFreeze', true); await pi(page, 'invuln', 60); await pi(page, 'bossHp', 0.2); await near(); await page.keyboard.press('j'); await sleep(400); s = await st(page);
  ok('arena: win drops the claim shard', s.boss.won && s.save.defeated.includes('shard1') && s.save.defeated.includes('draft'));
  await sleep(500); await shot(page, 'desktop-17-draft-defeated');
  await pi(page, 'teleport', 640, 175); await input.move(0, -1); s = await waitFor(page, s => s.room === 'message', 4000); await input.stop();
  ok('arena: north door -> Message Room', s.room === 'message');

  // MESSAGE
  s = await waitFor(page, s => s.save.phaseComplete, 20000);
  ok('message: chat plays, PHASE 1 COMPLETE saved', s.save.phaseComplete);
  await still1(page, 'message-complete');
  await shot(page, 'desktop-18-message-complete');
  ok('systems: Phase 1 rooms solved on the steal path', s.flags && s.save.defeated.includes('draft') && s.save.phaseComplete, `helped ${s.save.helped.join(',')} wilted ${s.save.wilted.join(',')}`);
  ok('systems: word memory records thrown qualities', s.save.swapLog.length >= 4, (s.save.wordLog || []).map(w => w.word + 'x' + w.count).join(' '));

  await pi(page, 'goto', 'message'); s = await waitFor(page, s => s.room === 'message' && s.cutscene === 'sc5', 3000);
  await page.keyboard.down('x'); await sleep(900); await page.keyboard.up('x'); await sleep(200); s = await st(page);
  ok('cutscene: hold X skips a seen cutscene', s.cutscene === null && s.state === 'play', `cutscene ${s.cutscene}`);
  await page.keyboard.press('Escape'); await sleep(200); s = await st(page);
  ok('pause: Esc opens the controls menu', s.paused);
  await shot(page, 'desktop-19-pause');
  await page.keyboard.press('Escape'); await page.keyboard.press('Backquote'); await sleep(200);
  await shot(page, 'desktop-20-debug');

  await page.goto(URL_.replace('&new=1', '')); await page.waitForFunction(() => window.__pi, null, { timeout: 10000 }); await sleep(500); s = await st(page);
  ok('save: reload resumes in the saved room', s.room === 'message' && s.save.phaseComplete, s.room);
  await pi(page, 'goto', 'archive'); await sleep(600); s = await st(page);
  ok('save: puzzle progress kept on revisit', s.flags.bridge && s.flags.drained);
  ok('desktop: zero console errors', log.errors.length === 0, log.errors.slice(0, 5).join(' | '));
  ok('desktop: no external requests', log.external.length === 0, log.external.slice(0, 3).join(' '));
  await ctx.close();
}

async function mobile(browser) {
  const log = { errors: [], external: [] };
  const { ctx, page, input } = await open(browser, MOBILE, URL_ + '&swap=1', log);
  await page.waitForFunction(() => window.__pi, null, { timeout: 10000 }); await sleep(300);
  let s = await st(page);
  ok('mobile: touch input detected, touch prompts shown', s.inputKind === 'touch' && s.clar?.caption === 'Drag to walk', s.clar?.caption);
  await shot(page, 'mobile-01-office');
  { // clarity office on touch: tap the SHUT tag, tap TYPE = combo, hold TYPE + release = beam
    await pi(page, 'teleport', 205, 236); await sleep(500); let q = await st(page); await input.tap(q.clar.tag.x, q.clar.tag.y); await sleep(300); q = await st(page);
    ok('mobile clarity: tapping the SHUT tag opens the picker', q.clar.picker === 'o_door', String(q.clar.picker)); await shot(page, 'mobile-v11c-picker'); await pi(page, 'clar', 'close');
    const d = q.clar.dummy; await pi(page, 'teleport', d.x - 80, d.y + 4); await sleep(300);
    for (let i = 0; i < 3; i++) { await input.press('attack'); await sleep(240); } await sleep(300); q = await st(page);
    ok('mobile clarity: tapping the attack button lands the 3-hit combo', q.clar.combo >= 3, `hits ${q.clar.combo}`);
    await input.hold('attack', 750); await sleep(400); q = await st(page);
    ok('mobile clarity: holding then releasing the attack button fires the beam', q.clar.beam >= 1, `beam hits ${q.clar.beam}`);
    await pi(page, 'teleport', 110, 470); await sleep(300);
  }
  const x0 = s.player.x; await input.move(1, 0); await sleep(500); s = await st(page);
  ok('mobile: virtual stick moves Noor', s.player.x - x0 > 50, `${Math.round(s.player.x - x0)}px`);
  const d0 = s.player.x; await input.press('dash'); await sleep(200); await input.stop(); s = await st(page);
  ok('mobile: DASH button dashes', s.player.x - d0 > 100 && s.dashCd > 0, `${Math.round(s.player.x - d0)}px`);
  await pi(page, 'teleport', 232, 655); await sleep(100); await input.press('interact'); await sleep(200); s = await st(page);
  ok('mobile: READ button reads', s.save.lore.includes('o_coffee'));
  // hub drag-swap on touch
  await pi(page, 'goto', 'hub'); await sleep(700);
  await pi(page, 'read', 'h_lamp'); await pi(page, 'teleport', 640, 560); await sleep(1300); s = await st(page);
  const shutChip = s.chips.find(c => c.id === 'h_door' && c.where === 'cap');
  ok('mobile: caption shows SHUT as a chip; touch buttons sit above the caption bar', !!shutChip && s.handChip.y < 626, JSON.stringify(s.chips));
  const cdp = await ctx.newCDPSession(page);
  const toPage = (x, y) => page.evaluate(([x, y]) => { const s = window.__game.scale; const b = s.canvasBounds; return { x: b.left + x / s.displayScale.x, y: b.top + y / s.displayScale.y }; }, [x, y]);
  const a = await toPage(s.handChip.x, s.handChip.y), b = await toPage(shutChip.x, shutChip.y);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 7 }] });
  for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 8, y: a.y + (b.y - a.y) * i / 8, id: 7 }] }); await sleep(30); }
  await shot(page, 'mobile-02-hub-drag');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
  s = await st(page);
  ok('mobile: drag the word chip onto SHUT opens the door', s.flags.door, s.plates.h_door.words);
  // global fix: after a touch drag-swap the page must not be panned and the HUD must sit fully inside the canvas
  const geo = await page.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); const sc = window.__game.scene.getScene('game'); const b = sc.hud.path.getBounds(); return { sx: window.scrollX, vv: window.visualViewport ? window.visualViewport.offsetLeft : 0, cl: c.left, cw: c.width, hx: b.x, hv: sc.hud.path.visible && sc.hud.title.visible }; });
  ok('mobile: HUD not clipped after a touch drag-swap (no page pan, HUD inside the canvas)', geo.sx === 0 && geo.vv === 0 && geo.cl >= 0 && geo.hx >= 20 && geo.hv, JSON.stringify(geo));
  await shot(page, 'mobile-03-hub-open');
  // hold READ (touch) = code view
  const rb = await toPage(1178, 392);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rb.x, y: rb.y, id: 9 }] }); await sleep(650); s = await st(page);
  await shot(page, 'mobile-04-hold-read-code');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(200);
  ok('mobile: holding READ opens code vision', s.codeView, `codeView ${s.codeView}`);
  ok('mobile: zero console errors', log.errors.length === 0, log.errors.slice(0, 5).join(' | '));
  await ctx.close();
}

const server = await serve();
const browser = await launch();
const T11 = { ok, st, pi, waitFor, shot, URL_ };
try { if (process.env.ONLY_COMBAT) { await combatGreybox(browser, T11); } else if (process.env.ONLY_V11) { await office11(browser, { ...T11, URL_: URL_ + '&swap=1' }); } else if (process.env.ONLY_V9) { await office9(browser); } else { if (!process.env.ONLY_LINGER) await desktop(browser); await linger(browser); if (process.env.ONLY_LINGER) { await browser.close(); process.exit(0); } await office11(browser, { ...T11, URL_: URL_ + '&swap=1' }); await combatGreybox(browser, T11); if (process.env.V9) await office9(browser); await mobile(browser); } }
catch (e) { ok('playtest ran without exceptions', false, (e && e.message) + ' ' + (e && e.stack)); }
finally { await browser.close(); server?.kill(); }
const fails = results.filter(r => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} passed`);
process.exit(fails.length ? 1 : 0);
