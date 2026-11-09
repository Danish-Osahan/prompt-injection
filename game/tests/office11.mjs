// art-v11 CLARITY office: full-width room between objective bar and caption, word tag + picker, close-up cards, one caption line,
// real collision (each desk), WASD/arrows from spawn, practice dummy, breathing idle, the lift exit.
import { open, sleep, DESKTOP } from './helpers.mjs';
export async function office11(browser, { ok, st, pi, waitFor, shot, URL_ }) {
  const log = { errors: [], external: [] };
  const { ctx, page, input } = await open(browser, DESKTOP, URL_, log);
  const c11 = async () => (await st(page)).clar;
  let s = await waitFor(page, s => s.room === 'office' && !!s.clar, 15000);
  const Z = s.cam.zoom; const zooms = [];
  const sample = async () => { const q = await st(page); zooms.push(q.cam.zoom); if (q.chips.length || q.hand) chipsSeen.push(JSON.stringify(q.chips) + JSON.stringify(q.hand)); const c = q.clar; if (c && (c.capLines > 1 || c.capW > 1180)) capBad.push(c.caption); return q; };
  const chipsSeen = [], capBad = [];
  ok('office11: the clarity office is the default (old angle, no Office9 camera)', !!s.clar && !s.office9, JSON.stringify({ clar: !!s.clar, o9: !!s.office9 }));
  ok('office11: world camera fills the HUD band full-width (no side pillars)', s.cam.y === 48 && s.cam.w === 1280 && s.cam.y + s.cam.h === s.cam.barY && s.cam.zoom >= 0.999, JSON.stringify(s.cam));
  await sleep(700); s = await sample();
  ok('office11: the scene heading shows on entry', s.clar.heading > 0.5, String(s.clar.heading));
  ok('office11: the objective reads "Get through the door"', s.clar.objective === 'Get through the door', s.clar.objective);
  ok('office11: the door word is a glowing SHUT tag on the door, with a first-time pointer', s.clar.tag.visible && s.clar.tag.word === 'SHUT' && s.clar.pointer && s.clar.tag.x > 170 && s.clar.tag.x < 260 && s.clar.tag.y > 80 && s.clar.tag.y < 160, JSON.stringify({ ...s.clar.tag, pointer: s.clar.pointer }));
  await shot(page, 'v11c-01-entry');
  // MAJOR: spawn walkable + real WASD / arrows (would have caught the stuck-Noor bug)
  const spawn = (await st(page)).player;
  ok('office11: spawn is not inside any collider', await pi(page, 'canStand', spawn.x, spawn.y) === true, JSON.stringify(spawn));
  await page.keyboard.down('KeyD'); await sleep(700); await page.keyboard.up('KeyD');
  const pD = (await st(page)).player;
  ok('office11: WASD (D) moves Noor from spawn', pD.x > spawn.x + 40, JSON.stringify({ spawn, pD }));
  await page.keyboard.down('ArrowLeft'); await sleep(700); await page.keyboard.up('ArrowLeft');
  const pL = (await st(page)).player;
  ok('office11: arrow keys move Noor', pL.x < pD.x - 40, JSON.stringify({ pD, pL }));
  await pi(page, 'teleport', 685, 300); await sleep(220);
  const u = (await st(page)).player;
  ok('office11: overlapping a desk auto-unsticks to free ground', await pi(page, 'canStand', u.x, u.y) === true && (Math.hypot(u.x - 685, u.y - 300) > 8), JSON.stringify(u));
  await pi(page, 'teleport', spawn.x, spawn.y); await sleep(80);
  await sleep(2500); s = await sample(); ok('office11: the heading fades after entry', s.clar.heading === 0, String(s.clar.heading));
  // nothing at the bottom while walking in open floor
  await pi(page, 'teleport', 650, 470); await input.move(-1, 0); let walkCaps = []; for (let i = 0; i < 4; i++) { await sleep(110); walkCaps.push((await sample()).clar.caption); } await input.stop();
  ok('office11: nothing at the bottom while walking', walkCaps.every(c => c === ''), JSON.stringify(walkCaps));
  await shot(page, 'v11c-02-walk-empty-bottom');
  // the toys are dimmer than the door tag
  const tags = s.clar.tags; const door = tags.find(t => t.id === 'o_door'), toys = tags.filter(t => t.id !== 'o_door');
  ok('office11: the toy swaps use the same tag pattern but dimmer (optional)', toys.length === 4 && toys.every(t => t.visible && t.a < door.a), JSON.stringify(tags.map(t => [t.id, t.a])));
  // near the door: outline + one caption line; click the tag -> attached picker; Esc closes it
  await pi(page, 'teleport', 205, 236); s = await waitFor(page, s => s.clar.near === 'o_door', 3000);
  ok('office11: near the door the caption says what to do (one line)', s.clar.caption === 'Tap the glowing word.' && s.clar.capLines === 1, s.clar.caption);
  await shot(page, 'v11c-03-near-door');
  await page.mouse.click(s.clar.tag.x, s.clar.tag.y); s = await waitFor(page, s => s.clar.picker === 'o_door', 2000);
  ok('office11: clicking the SHUT tag opens the attached picker (SHUT now / OPEN)', s.clar.picker === 'o_door' && s.clar.pickAlt === 'OPEN' && s.clar.modal === 'picker', JSON.stringify({ p: s.clar.picker, alt: s.clar.pickAlt }));
  await shot(page, 'v11c-04-swap-picker');
  await page.keyboard.press('Escape'); s = await waitFor(page, s => !s.clar.modal, 1500);
  ok('office11: Esc closes the picker (no pause menu)', !s.clar.modal && s.state !== 'paused', `${s.clar.modal} ${s.state}`);
  await input.press('interact'); s = await waitFor(page, s => s.clar.picker === 'o_door', 1500); await input.press('interact');
  s = await waitFor(page, s => s.clar.doorK >= 1, 3000); await sleep(200); s = await sample();
  ok('office11: E, E (or tap OPEN) opens the lift door with the rendered frames', s.clar.door && s.clar.doorK === 1 && s.plates.o_door.words === 'DOOR IS OPEN', JSON.stringify({ door: s.clar.door, k: s.clar.doorK, w: s.plates.o_door.words }));
  ok('office11: the objective follows real progress ("Door open. Walk through")', s.clar.objective === 'Door open. Walk through' && s.clar.done, s.clar.objective);
  ok('office11: the swap caption is one line', s.clar.capLines === 1 && /OPEN/.test(s.clar.caption), s.clar.caption);
  await shot(page, 'v11c-05-door-open');
  // a toy through the same picker
  await pi(page, 'clar', 'tap', 'o_rain'); s = await waitFor(page, s => s.clar.picker === 'o_rain', 1500); await pi(page, 'clar', 'pick'); s = await waitFor(page, s => s.plates.o_rain.words === 'RAIN FEELS HAPPY', 2000);
  ok('office11: a toy (rain) swaps through its own tag + picker', s.plates.o_rain.words === 'RAIN FEELS HAPPY', s.plates.o_rain.words);
  await pi(page, 'clar', 'tap', 'o_photo'); await pi(page, 'clar', 'pick'); await sleep(200); s = await sample();
  ok('office11: a long narrator line still fits one line (shrinks, never wraps)', s.clar.capLines === 1 && s.clar.capW <= 1180 && s.clar.capSize >= 18, `${s.clar.capSize}px ${s.clar.capW}px "${s.clar.caption}"`);
  // close-up card (E opens, E closes) - no camera zoom anywhere
  await pi(page, 'teleport', 685, 352); await waitFor(page, s => s.clar.near === 'o_kabir' && s.clar.caption === 'E  look closer', 5000);
  s = await sample(); ok('office11: near an object: "E  look closer"', s.clar.caption === 'E  look closer', s.clar.caption);
  await input.press('interact'); await sleep(320); s = await sample();
  ok('office11: inspect opens a framed close-up card in ~0.25 s', s.clar.card === 'o_kabir' && s.clar.cardA > 0.95 && s.clar.modal === 'card', JSON.stringify({ c: s.clar.card, a: s.clar.cardA }));
  ok('office11: the card carries the one lore line (caption strip is empty)', s.clar.caption === '', s.clar.caption);
  await sleep(1500); await shot(page, 'v11c-06-inspect-card');
  await input.press('interact'); await sleep(320); s = await sample();
  ok('office11: E closes the card', !s.clar.modal && !s.clar.card, s.clar.modal);
  await pi(page, 'teleport', 232, 636); await waitFor(page, s => s.clar.near === 'o_coffee', 2000); await input.press('interact'); await sleep(300);
  s = await st(page); await page.mouse.click(60, 360); await sleep(320); const sc = await st(page);
  ok('office11: a tap / click closes the card too', s.clar.card === 'o_coffee' && !sc.clar.card, `${s.clar.card} -> ${sc.clar.card}`);
  ok('office11: no camera zoom or push anywhere in the flow', zooms.every(z => Math.abs(z - Z) < 1e-6) && Math.abs(sc.cam.zoom - Z) < 1e-6, [...new Set(zooms.map(z => z.toFixed(4)))].join(','));
  ok('office11: no floating word chips (no caption chips, no hand chip)', chipsSeen.length === 0, chipsSeen.slice(0, 2).join(' | '));
  ok('office11: every caption stayed one line inside the screen', capBad.length === 0, capBad.slice(0, 2).join(' | '));
  // collision: Noor cannot walk through any desk (pushes north from just south of each footprint)
  const desks = s.clar.props.filter(p => /^desk|^table/.test(p.name)); const through = [];
  for (const d of desks) {
    const xs = d.poly.map(q => q[0]), ys = d.poly.map(q => q[1]); const cx = (Math.min(...xs) + Math.max(...xs)) / 2, top = Math.min(...ys);
    await pi(page, 'teleport', cx, d.baseY + 26); await sleep(80); await input.move(0, -1); await sleep(1100); await input.stop(); await sleep(60);
    const p = (await st(page)).player; if (p.y < top) through.push(`${d.name} y=${p.y.toFixed(0)} < ${top.toFixed(0)}`);
  }
  ok(`office11 collision: Noor cannot pass through any of the ${desks.length} desks / table`, desks.length >= 7 && through.length === 0, through.join(' | ') || desks.map(d => d.name).join(','));
  const kd = desks.find(d => d.name === 'desk_kabir'); { const xs = kd.poly.map(q => q[0]); await pi(page, 'teleport', Math.min(...xs) - 14, 304); await sleep(60); const p0 = (await st(page)).player; await input.move(1, -1); await sleep(600); await input.stop(); const p1 = (await st(page)).player;
    ok('office11 collision: pushing diagonally into a desk side slides along it (no sticking)', p0.y - p1.y > 40, `(${p0.x.toFixed(0)},${p0.y.toFixed(0)}) -> (${p1.x.toFixed(0)},${p1.y.toFixed(0)})`); }
  ok('office11 collision: the dummy is solid', await pi(page, 'clar', 'blocked', `${s.clar.dummy.x},${s.clar.dummy.y}`));
  // practice dummy: tap = combo, hold + release = beam (auto-aimed)
  await pi(page, 'teleport', s.clar.dummy.x - 80, s.clar.dummy.y + 4); await sleep(400); s = await sample();
  ok('office11 dummy: a one-time hint near the dummy ("Tap attack ... 3-hit combo")', /3-hit combo/.test(s.clar.caption), s.clar.caption);
  for (let i = 0; i < 3; i++) { await input.press('attack'); await sleep(230); } await sleep(400); s = await sample();
  ok('office11 dummy: tapping attack lands the 3-hit combo on the dummy (auto-aim)', s.clar.combo >= 3, `hits ${s.clar.combo}`);
  ok('office11 dummy: then the beam hint ("Hold attack, release: beam")', /beam/.test(s.clar.caption), s.clar.caption);
  await shot(page, 'v11c-07-attack-combo');
  await pi(page, 'teleport', s.clar.dummy.x - 260, s.clar.dummy.y + 10); await sleep(200);
  await page.keyboard.down('j'); await sleep(750); const ch = await st(page); await shot(page, 'v11c-08-beam-charge'); await page.keyboard.up('j'); await sleep(140); await shot(page, 'v11c-09-beam'); await sleep(300); s = await sample();
  ok('office11 dummy: hold shows the charge (no line to drag), release fires the auto-aimed beam into the dummy', ch.attackPending && s.beamN >= 1 && s.clar.beam >= 1, `pending ${ch.attackPending} beamN ${s.beamN} hits ${s.clar.beam}`);
  // idle: plain breathing, no look poses, no idle narrator line
  await pi(page, 'teleport', 560, 520); await sleep(300); const a1 = await pi(page, 'noorAnim'); await sleep(700); const a2 = await pi(page, 'noorAnim');
  ok('office11 Noor: idle is one held frame that breathes (no head sway / tilt)', /^noor_idle_/.test(a1.key) && a1.frame.endsWith('_00') && a2.frame.endsWith('_00') && Math.abs(a1.sy - a2.sy) > 0.001, JSON.stringify([a1, a2]));
  await pi(page, 'idle', 6.5); await sleep(1500); s = await sample(); const a3 = await pi(page, 'noorAnim');
  ok('office11 Noor: standing still: no look/tilt reaction, no idle narrator line', /^noor_idle_/.test(a3.key) && s.clar.caption === '', `${a3.key} "${s.clar.caption}"`);
  await shot(page, 'v11c-10-idle');
  // the exit: walk into the open lift
  await pi(page, 'teleport', 205, 214); await input.move(0, -1); s = await waitFor(page, s => s.room === 'hub', 4000); await input.stop();
  ok('office11: walking into the open lift leaves the office', s.room === 'hub', s.room);
  ok('office11: zero console errors', log.errors.length === 0, log.errors.slice(0, 4).join(' | '));
  await ctx.close();
  // ?debug=collision overlay
  const L2 = { errors: [], external: [] }; const o2 = await open(browser, DESKTOP, URL_ + '&debug=collision', L2); await waitFor(o2.page, s => !!s.clar, 15000); await sleep(4000); await o2.page.screenshot({ path: new URL('../screenshots/v11c-11-debug-collision.png', import.meta.url).pathname });
  ok('office11: ?debug=collision overlay renders without errors', L2.errors.length === 0, L2.errors.slice(0, 2).join(' | ')); await o2.ctx.close();
}
