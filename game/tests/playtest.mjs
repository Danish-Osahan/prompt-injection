// Prompt Injection Phase 1 headless playtest: node tests/playtest.mjs
// Serves dist/ with `vite preview` (unless GAME_URL is set), walks all 6 rooms, solves the puzzles
// through test hooks + real keyboard/touch input, screenshots every room, and fails on console errors.
import { spawn } from 'node:child_process';
import { launch, open, sleep, MOBILE, DESKTOP } from './helpers.mjs';
const PORT = 4175;
const URL_ = process.env.GAME_URL ?? `http://localhost:${PORT}/?test=1&new=1`;
const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  - ' + info : ''}`); };
const st = (page) => page.evaluate(() => window.__pi.state());
const pi = (page, fn, ...a) => page.evaluate(([fn, a]) => window.__pi[fn](...a), [fn, a]);
async function waitFor(page, pred, ms = 15000) { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await st(page); if (pred(s)) return s; await sleep(100); } return s; }
async function shot(page, name) { await sleep(250); await page.screenshot({ path: `${SHOTS}${name}.png` }); }

async function serve() {
  if (process.env.GAME_URL) return null;
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return p; } catch { /* not up yet */ } await sleep(200); }
  throw new Error('preview server did not start (run npm run build first)');
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
  ok('desktop: 8-dir walk (diagonal) moves Noor', s.player.x - x0 > 60 && y0 - s.player.y > 60, `dx ${Math.round(s.player.x - x0)} dy ${Math.round(s.player.y - y0)}`);
  // dash
  const dx0 = s.player.x; await input.move(1, 0); await sleep(40); await input.press('dash'); await sleep(60);
  s = await st(page); const dashIframes = s.iframes > 0 && s.dashing;
  await sleep(150); await input.stop(); s = await st(page);
  ok('desktop: dash bursts forward with i-frames', s.player.x - dx0 > 120 && dashIframes, `moved ${Math.round(s.player.x - dx0)}px, iframes during dash ${dashIframes}`);
  ok('desktop: dash cooldown ~1s', s.dashCd > 0.6 && s.dashCd <= 1.0, `cd left ${s.dashCd.toFixed(2)}`);
  // inspect coffee with a real E press
  await pi(page, 'teleport', 232, 655); await sleep(900); s = await st(page);
  ok('caption: scene heading + screenplay line about the nearest object', s.heading.startsWith('INT. ') && s.caption.includes('Cold since August'), `${s.heading} | ${s.caption}`);
  await page.keyboard.press('e'); await sleep(200); s = await st(page);
  ok('desktop: E reads a lore plate (coffee)', s.save.lore.includes('o_coffee'), s.save.lore.join(','));
  for (const id of ['o_dez', 'o_kabir']) await pi(page, 'read', id);
  await shot(page, 'desktop-02-office-read');
  // the narrator lies: the claim status is redacted in the caption, code vision shows it
  await pi(page, 'teleport', 990, 642); await sleep(1100); s = await st(page);
  ok('caption: the narrator redacts the claim (\u2588\u2588)', s.caption.includes('Your claim was \u2588'), s.caption);
  await page.keyboard.down('e'); await sleep(650); s = await st(page); await shot(page, 'desktop-02b-office-code-view');
  await page.keyboard.up('e');
  ok('code view: hold E shows a code line per object + noor.shadow = null;', s.codeView && s.codeLines.includes('claim.status = DENIED;') && s.codeLines.length >= 4 && s.noorLine === 'noor.shadow = null;', s.codeLines.join(' | '));
  await sleep(300); s = await st(page);
  ok('code view: releasing E returns to the caption view', !s.codeView);
  await pi(page, 'read', 'o_monitor');
  s = await waitFor(page, s => s.composer === 0, 6000);
  ok('desktop: monitor opens the composer', s.composer === 0);
  for (let i = 0; i < 5; i++) { await page.keyboard.press('j'); await sleep(120); }
  await shot(page, 'desktop-03-composer');
  s = await waitFor(page, s => s.room === 'hub', 15000);
  ok('desktop: SC2 hook drops Noor into the Mirror Hub', s.room === 'hub', s.room);
  const raw = await page.evaluate(() => JSON.parse(localStorage.getItem('pi.save.v1')));
  ok('desktop: room transition autosaves to localStorage', raw?.room === 'hub', raw?.room);

  // HUB: door puzzle with real E presses
  await sleep(400);
  await pi(page, 'teleport', 300, 540); await sleep(1200); s = await st(page);
  await shot(page, 'desktop-03b-hub-caption');
  const chip = s.chips.find(c => c.id === 'h_lamp' && c.where === 'cap');
  ok('caption: OPEN is a tappable chip in the lamp line', !!chip && s.caption.includes('It is OPEN'), s.caption);
  const cp = await page.evaluate(([x, y]) => { const sc = window.__game.scale; const b = sc.canvasBounds; return { x: b.left + x / sc.displayScale.x, y: b.top + y / sc.displayScale.y }; }, [chip.x, chip.y]);
  await page.mouse.click(cp.x, cp.y); await sleep(150); s = await st(page);
  ok('hub: clicking OPEN in the caption picks it up', s.hand?.word === 'OPEN' && s.hand.from === 'h_lamp', JSON.stringify(s.hand));
  await pi(page, 'teleport', 640, 505); await sleep(120); s = await st(page);
  ok('hub: swap prompt shown while holding a word', s.prompts.some(p => p.includes('SHUT IN THE CAPTION')), s.prompts.join(' | '));
  await sleep(900); s = await st(page);
  ok('hub: the door is the caption subject (highlighted)', s.plates.h_door.focused && s.caption.includes('The door is SHUT'), s.caption);
  await shot(page, 'desktop-04-hub-door-caption');
  await page.keyboard.down('e'); await sleep(650); s = await st(page); await shot(page, 'desktop-04b-hub-code-view');
  ok('code view: hub lines incl. door.state after the swap', s.codeView && s.codeLines.includes('door.state = OPEN;') && s.codeLines.includes('lamp.state = SHUT;'), s.codeLines.join(' | '));
  await page.keyboard.up('e'); await sleep(300); s = await st(page);
  ok('hub: SHUT <-> OPEN swap opens the door', s.flags.door && s.plates.h_door.words === 'DOOR IS OPEN' && s.plates.h_lamp.words === 'LAMP IS SHUT', `${s.plates.h_door.words} / ${s.plates.h_lamp.words}`);
  ok('hub: swap logged in word memory', s.save.wordLog.some(w => w.word === 'OPEN') && s.save.swapLog.length === 1);
  ok('hub: swapped plate becomes the checkpoint', s.save.checkpoint.plate === 'h_door');
  // walk through the door (real keys)
  await input.move(0, -1); await sleep(700); await input.stop(); s = await st(page);
  ok('hub: walk through the open door', s.player.y < 400, `y ${Math.round(s.player.y)}`);
  // death: walk into the gap -> UNDO -> respawn at checkpoint in <1s
  const deaths0 = s.save.deaths;
  await input.move(0, -1); s = await waitFor(page, s => s.dying, 3000); await input.stop();
  ok('hub: walking into the gap kills (UNDO)', s.dying);
  await shot(page, 'desktop-05-undo');
  s = await waitFor(page, s => !s.dying && s.lastRespawnMs > 0, 3000);
  ok('hub: respawn under 1s at checkpoint', s.lastRespawnMs > 0 && s.lastRespawnMs < 1000 && Math.abs(s.player.y - 505) < 5 && s.save.deaths === deaths0 + 1, `${Math.round(s.lastRespawnMs)}ms at y ${Math.round(s.player.y)}`);
  // dash over the gap
  await pi(page, 'teleport', 640, 350); await sleep(1100);
  await input.move(0, -1); await sleep(30); await input.press('dash'); await sleep(250); await input.stop(); s = await st(page);
  ok('hub: dash crosses the gap', !s.dying && s.player.y < 250, `y ${Math.round(s.player.y)} dying ${s.dying}`);
  await input.move(0, -1); s = await waitFor(page, s => s.room === 'corridor', 4000); await input.stop();
  ok('hub: north exit leads to the Dark Corridor', s.room === 'corridor');

  // CORRIDOR
  await sleep(400); await shot(page, 'desktop-06-corridor-dark');
  s = await st(page);
  ok('corridor: Fern note hidden in the dark', !s.plates.c_note.visible);
  // lens-only secret: hold READ near the bricked-in wall
  await pi(page, 'teleport', 540, 400); await input.move(0, -1); await sleep(40); await input.stop();
  await page.keyboard.down('e'); s = await waitFor(page, s => s.secretText, 3000); await shot(page, 'desktop-06b-corridor-lens-secret');
  await sleep(700); await page.keyboard.up('e'); s = await st(page);
  ok('lens: hidden line shows only inside the lens around Noor', s.secrets.includes('c_wall') && (await st(page)).secretText === null, `secrets ${s.secrets.join(',')}`);
  await sleep(200); await pi(page, 'teleport', 110, 400); await page.keyboard.down('e'); await sleep(600); s = await st(page); await page.keyboard.up('e');
  ok('lens: no lens away from a secret (full code view only)', s.codeView && !s.lens && !s.secretText);
  await pi(page, 'setStuck', 46); await sleep(200); s = await st(page);
  ok("corridor: Fern's leaf hint after 45s stuck", s.hintOn);
  await shot(page, 'desktop-07-hint');
  await pi(page, 'swap', 'c_switch', 'c_light'); await sleep(700); s = await st(page);
  ok('corridor: OFF <-> ON lights the corridor', s.flags.lit && s.plates.c_note.visible, s.plates.c_light.words);
  ok('corridor: hint wilt applied (-1 growth)', s.save.wilted.includes('corridor'));
  await pi(page, 'read', 'c_note');
  await shot(page, 'desktop-08-corridor-lit');
  // dummy: still until QUICK
  await pi(page, 'teleport', 1110, 560); await sleep(100);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('j'); await sleep(260); }
  s = await st(page); const dummy0 = s.enemies.find(e => e.kind === 'dummy');
  ok('corridor: Paper Dummy ignores hits while STILL', dummy0.hp === 6 && dummy0.state === 'idle');
  await pi(page, 'swap', 'c_clock', 'c_dummy'); await sleep(200); s = await st(page);
  ok('corridor: DUMMY IS QUICK wakes it', s.flags.quick && s.plates.c_dummy.words === 'DUMMY IS QUICK');
  await pi(page, 'teleport', 1110, 560); await input.move(0, -1); await sleep(30); await input.stop();
  let swings = 0; for (let i = 0; i < 30; i++) { s = await st(page); if (s.enemies[0].dead) break; await page.keyboard.press('j'); swings++; await sleep(230); if (swings === 2) await shot(page, 'desktop-09-dummy-fight'); }
  s = await st(page);
  ok('corridor: TYPE combo defeats the woken dummy', s.enemies[0].dead, `${swings} swings, hp ${s.hp}`);
  await pi(page, 'teleport', 1150, 420); await input.move(1, 0); s = await waitFor(page, s => s.room === 'archive', 4000); await input.stop();
  ok('corridor: alcove exit opens -> Flooded Archive', s.room === 'archive');

  // ARCHIVE
  await sleep(400); await shot(page, 'desktop-10-archive-flooded');
  s = await st(page);
  ok('archive: STAIRS GO DOWN is underwater (hidden)', !s.plates.a_stairs.visible);
  const early = await pi(page, 'read', 'a_stairs');
  ok('archive: order matters, DOWN cannot be taken first', early === false);
  await pi(page, 'swap', 'a_drawer', 'a_bridge'); await sleep(100); s = await st(page);
  ok('archive: BRIDGE IS LOW does not lower it', !s.flags.bridge, s.plates.a_bridge.words);
  await pi(page, 'swap', 'a_drawer', 'a_bridge'); // swap back
  await pi(page, 'swap', 'a_drawer', 'a_water'); await sleep(1000); s = await st(page);
  ok('archive: step 1 HIGH <-> LOW drains the water, reveals stairs plate', s.flags.drained && s.plates.a_stairs.visible, `${s.plates.a_water.words} / ${s.plates.a_drawer.words}`);
  await pi(page, 'swap', 'a_stairs', 'a_bridge'); await sleep(200); s = await st(page);
  ok('archive: step 2 UP <-> DOWN lowers the bridge', s.flags.bridge && s.plates.a_bridge.words === 'BRIDGE IS DOWN', s.plates.a_stairs.words);
  await pi(page, 'teleport', 420, 420); await input.move(1, 0); await sleep(1900); await input.stop(); s = await st(page);
  ok('archive: Noor walks across the bridge', s.player.x > 840, `x ${Math.round(s.player.x)}`);
  await shot(page, 'desktop-11-archive-bridge');
  // crack swaps
  await pi(page, 'invuln', 60);
  const maxDiving = async (ms) => { let m = 0; const t0 = Date.now(); while (Date.now() - t0 < ms) { const q = await st(page); m = Math.max(m, q.enemies.filter(e => e.kind === 'note' && (e.state === 'windup' || e.state === 'dive')).length); await pi(page, 'invuln', 60); await sleep(60); } return m; };
  await pi(page, 'teleport', 1000, 520); const together = await maxDiving(3500);
  ok('archive: NOTES STICK TOGETHER -> group dive', together >= 2, `max simultaneous ${together}`);
  await pi(page, 'swap', 'a_books', 'a_notes'); await pi(page, 'teleport', 900, 300); await sleep(1600); await pi(page, 'invuln', 60); s = await st(page);
  await pi(page, 'teleport', 1000, 520); const apart = await maxDiving(4000); s = await st(page);
  ok('archive: TOGETHER -> APART: notes dive one at a time', s.flags.apart && apart === 1, `${s.plates.a_notes.words}, max simultaneous ${apart}`);
  await pi(page, 'swap', 'a_towel', 'a_ink'); s = await st(page);
  const sc = s.enemies.find(e => e.kind === 'scribble'); await pi(page, 'teleport', sc.x - 40, sc.y); await input.move(1, 0); await sleep(20); await input.stop(); await page.keyboard.press('j'); await sleep(150); s = await st(page);
  ok('archive: INK IS WET -> DRY: Scribble takes double damage', s.flags.dry && s.enemies.find(e => e.kind === 'scribble').hp <= 1, `${s.plates.a_ink.words}, scribble hp ${s.enemies.find(e => e.kind === 'scribble').hp}`);
  await shot(page, 'desktop-11b-archive-cracks');
  // fight: Scribble + notes
  for (let i = 0; i < 60; i++) {
    s = await st(page); const es = s.enemies.filter(e => !e.dead); if (!es.length) break;
    es.sort((a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y));
    await pi(page, 'teleport', es[0].x - 40, es[0].y); await input.move(1, 0); await sleep(20); await input.stop(); await page.keyboard.press('j'); await sleep(200);
  }
  s = await st(page);
  ok('archive: Scribble and sticky-note swarm can be defeated', s.enemies.every(e => e.dead), s.enemies.map(e => `${e.kind}:${e.hp}`).join(' '));
  await pi(page, 'teleport', 1180, 420); await input.move(1, 0); s = await waitFor(page, s => s.room === 'arena', 4000); await input.stop();
  ok('archive: east exit -> Draft arena', s.room === 'arena');

  // ARENA: the Draft
  s = await waitFor(page, s => s.boss && s.boss.state !== 'intro' && s.state === 'play', 5000);
  ok('arena: Draft fight starts (36 HP, guarded)', s.boss?.hp === 36 && s.boss.guarded, JSON.stringify(s.boss));
  const near = async () => { const b = (await st(page)).boss; await pi(page, 'teleport', b.x, b.y + 60); await input.move(0, -1); await sleep(30); await input.stop(); };
  await pi(page, 'bossFreeze', true); await pi(page, 'invuln', 60); await near(); await page.keyboard.press('j'); await sleep(150); s = await st(page);
  ok('arena: STRONG guard blocks most damage (x0.25)', Math.abs(s.boss.hp - 35.75) < 0.01, `hp ${s.boss.hp}`);
  ok('arena: guard sign follows the Draft', Math.abs(s.boss.signX - s.boss.x) < 2);
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
  // REWRITE: reading the WEAK sign in combat slows time
  await pi(page, 'read', 'r_weak'); await sleep(100); s = await st(page);
  ok('move: REWRITE bullet time while holding a word in combat', s.timeScale === 0.25 && s.hand?.word === 'WEAK', `timeScale ${s.timeScale}`);
  await pi(page, 'swap', 'r_weak', 'r_guard'); await sleep(200); s = await st(page);
  ok('arena: STRONG -> WEAK breaks the guard (7s)', !s.boss.guarded && s.boss.sign === 'THE DRAFT IS WEAK' && s.timeScale === 1, `${s.boss.sign} guardT ${s.boss.guardT.toFixed(1)}`);
  await near(); await shot(page, 'desktop-15-guard-broken');
  const hpG = s.boss.hp; await page.keyboard.press('j'); await sleep(150); s = await st(page);
  ok('arena: broken guard takes full damage', Math.abs(hpG - s.boss.hp - 1) < 0.01, `took ${(hpG - s.boss.hp).toFixed(2)}`);
  // SELECT
  await pi(page, 'bossFreeze', true); await near(); await sleep(1600);
  await page.keyboard.down('j'); await sleep(900); await page.keyboard.up('j'); await sleep(150); s = await st(page);
  ok('move: SELECT hold-drag line hits the Draft', s.selectN >= 1 && s.selectHits >= 1, `selects ${s.selectN} hits ${s.selectHits}`);
  // CUT / PASTE
  await pi(page, 'perfectDodge', 'ball'); s = await st(page);
  ok('move: perfect dodge CUTs the attack', s.stored === 'ball' && s.perfectN >= 1);
  const hpC = s.boss.hp; await page.keyboard.press('j'); await sleep(400); s = await st(page);
  ok('move: next press PASTEs it back (3 dmg)', s.pasteN >= 1 && s.stored === null && hpC - s.boss.hp >= 2.9, `took ${(hpC - s.boss.hp).toFixed(2)}`);
  // SPLIT
  await pi(page, 'bossHp', 18.6); await near(); await page.keyboard.press('j'); await sleep(250); s = await st(page);
  ok('arena: half health splits into two shadowless Drafts', s.boss.split && s.boss.fake, JSON.stringify(s.boss));
  await pi(page, 'reguard'); await sleep(200); s = await st(page);
  const top = s.save.wordLog[0]?.word ?? 'STRONG';
  ok('arena: split sign uses the most-placed word (tease)', s.boss.sign === `THE DRAFT IS ${top === 'WEAK' ? 'STRONG' : top}` && s.boss.guarded, `${s.boss.sign} (top ${top})`);
  await pi(page, 'bossFreeze', true); await shot(page, 'desktop-16-draft-split');
  await near(); await page.keyboard.press('j'); await sleep(450); s = await st(page);
  ok('arena: hitting the real Draft dispels the fake', !s.boss.fake);
  // FERN ROOT
  await page.keyboard.press('r'); await sleep(100); s = await st(page);
  ok('move: FERN ROOT pins the Draft (2s at Leafy)', s.rootN === 1 && s.rootUsed && s.boss.pinT > 1.5, `pin ${s.boss.pinT.toFixed(2)} growth ${s.save.fernGrowth}`);
  await page.keyboard.press('r'); await sleep(100); s = await st(page);
  ok('move: FERN ROOT is once per fight', s.rootN === 1);
  // death restarts the fight at the arena door
  await pi(page, 'kill'); s = await waitFor(page, s => !s.dying && s.lastRespawnMs > 0 && s.boss && s.boss.hp === 36, 3000);
  ok('arena: death restarts the fight at the arena door', s.boss.hp === 36 && !s.boss.split && Math.abs(s.player.y - 660) < 5 && s.boss.guarded, `hp ${s.boss.hp} y ${Math.round(s.player.y)}`);
  // win
  s = await waitFor(page, s => s.boss.state !== 'intro', 3000);
  await pi(page, 'bossFreeze', true); await pi(page, 'invuln', 60); await pi(page, 'bossHp', 0.2); await near(); await page.keyboard.press('j'); await sleep(400); s = await st(page);
  ok('arena: win drops the claim shard', s.boss.won && s.save.defeated.includes('shard1') && s.save.defeated.includes('draft'));
  ok('arena: +2 Fern growth for no last-bar death', s.save.defeated.includes('draft_clean') && s.save.fernGrowth === 9, `growth ${s.save.fernGrowth}`);
  await sleep(500); await shot(page, 'desktop-17-draft-defeated');
  await pi(page, 'teleport', 640, 175); await input.move(0, -1); s = await waitFor(page, s => s.room === 'message', 4000); await input.stop();
  ok('arena: north door -> Message Room', s.room === 'message');

  // MESSAGE
  s = await waitFor(page, s => s.save.phaseComplete, 20000);
  ok('message: chat plays, PHASE 1 COMPLETE saved', s.save.phaseComplete);
  await shot(page, 'desktop-18-message-complete');
  ok('systems: Fern growth tracked', s.save.fernGrowth === 9 && s.save.lore.length === 5 && s.save.helped.length === 3, `growth ${s.save.fernGrowth}, lore ${s.save.lore.length}, helped ${s.save.helped.join(',')}, wilted ${s.save.wilted.join(',')}`);
  ok('systems: word memory log', s.save.swapLog.length >= 6, s.save.wordLog.map(w => w.word + 'x' + w.count).join(' '));

  // skip a seen cutscene
  await pi(page, 'goto', 'message'); s = await waitFor(page, s => s.room === 'message' && s.cutscene === 'sc5', 3000);
  await page.keyboard.down('x'); await sleep(900); await page.keyboard.up('x'); await sleep(200); s = await st(page);
  ok('cutscene: hold X skips a seen cutscene', s.cutscene === null && s.state === 'play', `cutscene ${s.cutscene}`);
  // pause menu + debug overlay
  await page.keyboard.press('Escape'); await sleep(200); s = await st(page);
  ok('pause: Esc opens the controls menu', s.paused);
  await shot(page, 'desktop-19-pause');
  await page.keyboard.press('Escape'); await page.keyboard.press('Backquote'); await sleep(200);
  await shot(page, 'desktop-20-debug');

  // reload resumes from save
  await page.goto(URL_.replace('&new=1', '')); await page.waitForFunction(() => window.__pi, null, { timeout: 10000 }); await sleep(500); s = await st(page);
  ok('save: reload resumes in the saved room', s.room === 'message' && s.save.swapLog.length >= 6, s.room);
  await pi(page, 'goto', 'archive'); await sleep(600); s = await st(page);
  ok('save: puzzle progress kept on revisit', s.flags.bridge && s.flags.drained);
  ok('desktop: zero console errors', log.errors.length === 0, log.errors.slice(0, 5).join(' | '));
  ok('desktop: no external requests', log.external.length === 0, log.external.slice(0, 3).join(' '));
  await ctx.close();
}

async function mobile(browser) {
  const log = { errors: [], external: [] };
  const { ctx, page, input } = await open(browser, MOBILE, URL_, log);
  await page.waitForFunction(() => window.__pi, null, { timeout: 10000 }); await sleep(300);
  let s = await st(page);
  ok('mobile: touch input detected, touch prompts shown', s.inputKind === 'touch' && s.prompts.some(p => p.includes('DRAG TO WALK')), s.prompts.join(' | '));
  await shot(page, 'mobile-01-office');
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
try { await desktop(browser); await mobile(browser); }
catch (e) { ok('playtest ran without exceptions', false, e.message); }
finally { await browser.close(); server?.kill(); }
const fails = results.filter(r => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} passed`);
process.exit(fails.length ? 1 : 0);
