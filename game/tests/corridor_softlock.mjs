// Corridor guard soft-lock suite: real key presses (E hold to take, F to send the Caret / throw, J to strike), several orders.
// Setup (teleports, lighting the hall) uses the test hooks; the puzzle itself never does.
import { sleep, DESKTOP } from './helpers.mjs';

export async function corridorSoftlock(browser, { ok, st, pi, waitFor, URL_ }) {
  const clear = (page) => page.evaluate(() => { const s = window.__game.scene.getScene('game'); try { s.dialogue?.clear(); } catch {} s.busy = false; });
  const info = (s) => { const d = s.enemies.find(e => e.kind === 'dummy'); return `clock ${s.plates.c_clock.words.split(' ').pop()} guard ${s.plates.c_dummy.words.split(' ').pop()} vis ${s.plates.c_dummy.visible} held ${s.steal?.held?.word ?? '-'} caret ${s.caret.mode} dodge ${d?.dodgeN}`; };
  async function fresh() {
    const ctx = await browser.newContext(DESKTOP); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => window.__pi, null, { timeout: 15000 });
    try { await pi(page, 'skipSplash'); } catch {} await sleep(400);
    await pi(page, 'newGame');
    await page.waitForFunction(() => { try { return window.__pi.state().screen === 'game' && window.__pi.state().room === 'office'; } catch { return false; } }, null, { timeout: 15000 });
    await sleep(500); try { await pi(page, 'skipIntro'); } catch {} await sleep(600);
    await pi(page, 'goto', 'corridor'); await sleep(1300); await clear(page);
    await pi(page, 'teleport', 205, 226); await sleep(150);
    await page.keyboard.down('e'); await sleep(700); await page.keyboard.up('e'); await sleep(150);
    await pi(page, 'teleport', 205, 300); await sleep(200);
    await page.keyboard.press('f'); await sleep(1200);
    await waitFor(page, s => s.flags.lit, 4000); await sleep(2200); await clear(page);
    return { ctx, page, errs };
  }
  const take = async (page, x = 1110, y = 235) => { await pi(page, 'teleport', x, y); await sleep(150); await page.keyboard.down('e'); await sleep(700); await page.keyboard.up('e'); await sleep(200); };
  const F = async (page, ms = 1300) => { await page.keyboard.press('f'); await sleep(ms); };
  // Inside the line the Caret starts on GUARD; two right-arrow taps walk it onto QUICK.
  const pick = async (page) => { await page.keyboard.press('ArrowRight'); await sleep(90); await page.keyboard.press('ArrowRight'); await sleep(160); };
  const openLine = async (page) => { await pi(page, 'teleport', 960, 450); await sleep(150); await F(page, 1500); await clear(page); };
  async function finish(page, tag) {
    let s = await waitFor(page, s => s.flags.still, 2500);
    ok(`softlock ${tag}: STILL lands on the guard (no soft lock)`, s.flags.still && s.plates.c_dummy.words === 'GUARD IS STILL' && s.plates.c_clock.words === 'CLOCK IS QUICK', info(s));
    await clear(page);
    await pi(page, 'teleport', 1110, 470); await sleep(150);
    let n = 0; for (; n < 30; n++) { s = await st(page); if (s.enemies[0].dead) break; await page.keyboard.press('j'); await sleep(230); }
    s = await st(page);
    ok(`softlock ${tag}: the STILL guard tears (real J presses)`, s.enemies[0].dead, `${n} swings`);
    await pi(page, 'teleport', 1150, 420); await page.keyboard.down('d'); s = await waitFor(page, s => s.room === 'archive', 4000); await page.keyboard.up('d');
    ok(`softlock ${tag}: the exit opens`, s.room === 'archive', s.room);
  }

  // The guard's line lives on its ID card (staffCard.ts): ink bars while hidden, no Text objects in its rig.
  const cardHidden = (s) => s.card && s.card.state === 'hidden' && s.card.printed === '' && s.card.rigText === 0 && s.card.visible;
  const cardInfo = (s) => JSON.stringify(s.card && { state: s.card.state, printed: s.card.printed, sel: s.card.selWord, rigText: s.card.rigText, rot: +s.card.rot.toFixed(3), lean: s.card.lean });
  let page, ctx, errs, s;
  // A. take STILL first, F sends the Caret in (word stays in hand), F throws
  ({ ctx, page, errs } = await fresh());
  s = await st(page);
  ok('card A: the guard wears its ID card, parented to the rig, line hidden as ink bars (no text in the display list)', cardHidden(s) && s.card.parented && s.card.rows.join('/') === 'GUARD IS/QUICK', cardInfo(s));
  await take(page); s = await st(page);
  ok('softlock A: E hold takes STILL (the clock does not show QUICK while it is in hand)', s.steal?.held?.word === 'STILL' && s.clockWord === 'QUICK' && s.clockShown === 'STILL', info(s) + ' shown ' + s.clockShown);
  await F(page, 1500); s = await st(page);
  ok('softlock A: F with STILL in hand sends the Caret and keeps the word', s.plates.c_dummy.visible && s.steal?.held?.word === 'STILL' && s.caret.mode === 'sent', info(s));
  ok('softlock A: the Caret lands on the first word, GUARD', s.caret.sel === 0 && s.caret.inLine, JSON.stringify(s.caret));
  ok('card A: the open line is printed on the card, GUARD reverse-printed under the Caret', s.card.state === 'open' && s.card.printed === 'GUARD IS QUICK' && s.card.selWord === 'GUARD', cardInfo(s));
  await pick(page); await sleep(300); s = await st(page);
  ok('softlock A: two right arrows select QUICK', s.caret.sel === 2, JSON.stringify(s.caret));
  { const q = s.card.boxes[2], sp = s.card.spot;
    ok('card A: QUICK is reverse-printed and the Caret stands at the card edge on its row, clear of the word', s.card.selWord === 'QUICK' && Math.hypot(s.caret.x - sp.x, s.caret.y - sp.y) < 8 && s.caret.x - 8 > q.x + q.w / 2 && s.caret.x > s.card.edge.x, cardInfo(s) + ' caret ' + Math.round(s.caret.x) + ',' + Math.round(s.caret.y) + ' spot ' + Math.round(sp.x) + ',' + Math.round(sp.y)); }
  await F(page, 1200);
  s = await waitFor(page, s => s.flags.still && s.card && s.card.wipe >= 1, 2500);
  ok('card A: STILL re-prints in teal on the card (wipe done), the card leans with the slumped rig', s.card.state === 'still' && s.card.printed === 'GUARD IS STILL' && s.card.fresh === 'STILL' && s.card.lean > 0.1 && Math.abs(s.card.rot - (s.card.lean - 0.04)) < 0.01 && !s.card.awake, cardInfo(s));
  await finish(page, 'A (take, F, pick, F)'); await ctx.close();

  // B. Caret first, then take, then throw
  ({ ctx, page } = await fresh());
  await openLine(page); await take(page); await pick(page); await F(page, 1200); await finish(page, 'B (Caret, take, pick, throw)'); await ctx.close();

  // C. mashing F while the Caret is still flying in must not waste the word on the dodging guard
  ({ ctx, page } = await fresh());
  await take(page); await page.keyboard.press('f'); await sleep(110); await page.keyboard.press('f'); await sleep(1800); s = await st(page);
  ok('softlock C: F mashed during the Caret flight keeps STILL in hand (not thrown at the dodging guard)', s.steal?.held?.word === 'STILL' && !s.flags.still && (s.enemies.find(e => e.kind === 'dummy').dodgeN ?? 0) === 0, info(s));
  await pick(page); await F(page, 1200); await finish(page, 'C (mash)'); await ctx.close();

  // D. throw from far away: the open line is the aim, it cannot miss
  ({ ctx, page } = await fresh());
  await openLine(page); await take(page); await pi(page, 'teleport', 520, 450); await sleep(200); await pick(page); await F(page, 1300); await finish(page, 'D (far throw)'); await ctx.close();

  // E. throw while the guard is dashing and dodging
  ({ ctx, page } = await fresh());
  await openLine(page); await take(page); await pick(page);
  await page.evaluate(() => { const g = window.__game.scene.getScene('game'); const e = g.enemies.find(n => n.kind === 'dummy'); g.dummyDash(e, e.x - 60, e.y - 10, 0.12); g.hurtEnemy(e, 1, 100, 0); });
  await page.keyboard.press('f'); await sleep(90); await page.evaluate(() => { const g = window.__game.scene.getScene('game'); const e = g.enemies.find(n => n.kind === 'dummy'); g.hurtEnemy(e, 1, 100, 0); });
  await sleep(1300); await finish(page, 'E (throw during a dodge)'); await ctx.close();

  // F. a throw with no open line bounces: the word goes back to the clock and can be taken again
  ({ ctx, page } = await fresh());
  await take(page); await pi(page, 'steal', 'throw', 'c_dummy'); await sleep(900); s = await st(page);
  ok('softlock F: a throw at a shut line bounces and STILL is back on the clock', !s.steal?.held && s.plates.c_clock.words === 'CLOCK IS STILL' && !s.flags.still, info(s));
  await take(page); await F(page, 1500); await pick(page); await F(page, 1200); await finish(page, 'F (bounce, retry)'); await ctx.close();

  // G. recovery: STILL left the clock but nothing landed (old save, reload, lost hand): the clock resets by itself
  ({ ctx, page } = await fresh());
  await page.evaluate(() => { const g = window.__game.scene.getScene('game'); g.plateById('c_clock').setSlotWord('OFF'); g.plateById('c_clock').setSlotWord('QUICK'); g.save.plates.c_clock = 'QUICK'; g.evaluate(false); });
  s = await waitFor(page, s => s.plates.c_clock.words === 'CLOCK IS STILL', 4500);
  ok('softlock G: a clock stuck on QUICK with nothing in hand resets to STILL by itself', s.plates.c_clock.words === 'CLOCK IS STILL' && !s.steal?.held, info(s));
  await openLine(page); await take(page); await pick(page); await F(page, 1200); await finish(page, 'G (recovered)'); await ctx.close();

  // H. wrong word: STILL thrown with the Caret on GUARD, then IS, bounces with a reason and goes home to the clock; QUICK takes it
  ({ ctx, page } = await fresh());
  await openLine(page); await take(page); await F(page, 1000); s = await st(page);
  ok('softlock H: STILL thrown at GUARD bounces, back on the clock, line still open', !s.steal?.held && s.plates.c_clock.words === 'CLOCK IS STILL' && s.plates.c_dummy.words === 'GUARD IS QUICK' && s.caret.inLine, info(s));
  const why = await waitFor(page, s => /GUARD/.test((s.dialogueProg && s.dialogueProg.full) || ''), 2500);
  ok('softlock H: Fern gives a short reason for the GUARD bounce', /GUARD/.test((why.dialogueProg && why.dialogueProg.full) || ''), (why.dialogueProg && why.dialogueProg.full) || '');
  await clear(page);
  await page.keyboard.press('ArrowRight'); await sleep(150); await take(page); await F(page, 1000); s = await st(page);
  ok('softlock H: STILL thrown at IS bounces too, back on the clock', s.caret.sel === 1 && !s.steal?.held && s.plates.c_clock.words === 'CLOCK IS STILL' && !s.flags.still, info(s));
  ok('card H: after the bounce the card still reads GUARD IS QUICK with IS reverse-printed', s.card.state === 'open' && s.card.printed === 'GUARD IS QUICK' && s.card.selWord === 'IS', cardInfo(s));
  await clear(page);
  await page.keyboard.press('ArrowRight'); await sleep(150); await take(page); await F(page, 1200); await finish(page, 'H (wrong word, retry)'); await ctx.close();

  // I. recall: F with empty hands, Q, and Esc each bring the Caret home and close the line; it can be sent again
  ({ ctx, page } = await fresh());
  await openLine(page); await F(page, 700); s = await st(page);
  ok('softlock I: F with empty hands calls the Caret home and the line hides again', s.caret.mode === 'follow' && !s.plates.c_dummy.visible, info(s));
  ok('card I: recall puts the ink bars back, no selection and no text left on the card', cardHidden(s) && s.card.sel === -1, cardInfo(s));
  await F(page, 1400); await clear(page); s = await st(page);
  ok('softlock I: F sends it back in', s.caret.inLine && s.plates.c_dummy.visible, info(s));
  await page.keyboard.press('q'); await sleep(500); s = await st(page);
  ok('softlock I: Q calls it home', s.caret.mode === 'follow' && !s.plates.c_dummy.visible, info(s));
  ok('card I: after Q the card is bars only again', cardHidden(s), cardInfo(s));
  await F(page, 1400); await clear(page); await page.keyboard.press('Escape'); await sleep(500); s = await st(page);
  const paused = await page.evaluate(() => !!window.__game.scene.getScene('game').paused);
  ok('softlock I: Esc calls it home (and does not open the menu)', s.caret.mode === 'follow' && !s.plates.c_dummy.visible && !paused, info(s) + ' paused ' + paused);
  await F(page, 1400); await clear(page); await take(page); await pick(page); await F(page, 1200); await finish(page, 'I (recall, resend)'); await ctx.close();

  // J. the cost: no dash while the Caret is out; dash is back once it's home. Walking still works.
  ({ ctx, page } = await fresh());
  await openLine(page); await pi(page, 'teleport', 700, 450); await sleep(200);
  const dashState = () => page.evaluate(() => { const g = window.__game.scene.getScene('game'); return { dashT: g.dashT, cd: g.dashCd, did: g.didDash, x: g.x }; });
  await page.evaluate(() => { window.__game.scene.getScene('game').didDash = false; });
  await page.keyboard.down('a'); await page.keyboard.press('Space'); await sleep(60); let d0 = await dashState(); await sleep(300); await page.keyboard.up('a');
  s = await st(page);
  ok('softlock J: SPACE does not dash while the Caret is in the line', !d0.did && d0.dashT <= 0 && s.caret.inLine, JSON.stringify(d0));
  ok('softlock J: Noor still walks while the Caret is out', s.player.x < 690, `x ${Math.round(s.player.x)}`);
  await F(page, 700); await sleep(300);
  await page.keyboard.press('Space'); await sleep(60); d0 = await dashState();
  ok('softlock J: dash works again once the Caret is home', d0.did, JSON.stringify(d0));
  await pi(page, 'teleport', 960, 450); await sleep(150); await F(page, 1500); await clear(page); await take(page); await pick(page); await F(page, 1200); await finish(page, 'J (no dash, recall)'); await ctx.close();
  ok('softlock: zero page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
}
