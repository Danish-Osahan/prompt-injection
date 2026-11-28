// Archive (GB-5) soft-lock suite: real key presses only for the puzzle (F send/write, arrows select, E hold take, Q recall).
// Setup (teleports, pinning the Keeper's lamp away with archiveAim) uses test hooks; the trade itself never does.
import { sleep, DESKTOP } from './helpers.mjs';

export async function archiveSoftlock(browser, { ok, st, pi, waitFor, URL_ }) {
  const clear = (page) => page.evaluate(() => { const s = window.__game.scene.getScene('game'); try { s.dialogue?.clear(); } catch {} s.busy = false; });
  const info = (s) => { const a = s.archive; return `phase ${a.phase} carried ${a.carried ?? '-'} dez "${s.plates.a_dez.words}" keeper "${s.plates.a_keeper.words}" caret ${s.caret.mode} dezCard ${a.dezCard.state}/${a.dezCard.blankWord ?? '-'} keeperCard ${a.keeperCard.state} bounces ${a.bounces} filed ${a.filedN}`; };
  async function fresh() {
    const ctx = await browser.newContext(DESKTOP); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => window.__pi, null, { timeout: 15000 });
    try { await pi(page, 'skipSplash'); } catch {} await sleep(400);
    await pi(page, 'newGame');
    await page.waitForFunction(() => { try { return window.__pi.state().screen === 'game' && window.__pi.state().room === 'office'; } catch { return false; } }, null, { timeout: 15000 });
    await sleep(500); try { await pi(page, 'skipIntro'); } catch {} await sleep(600);
    await pi(page, 'goto', 'corridor'); await sleep(1200); await clear(page);   // the corridor hands Noor the Caret
    await pi(page, 'goto', 'archive'); await sleep(2600); await clear(page);
    await pi(page, 'archiveAim', 430, 175);   // lamp pinned on the far wall so the light never files Noor during setup
    return { ctx, page, errs };
  }
  const key = async (page, k, ms = 160) => { await page.keyboard.press(k); await sleep(ms); };
  const atDez = (page) => pi(page, 'teleport', 170, 390).then(() => sleep(200));
  const atKeeper = (page) => pi(page, 'teleport', 420, 440).then(() => sleep(350));
  const openDez = async (page) => { await atDez(page); await key(page, 'f', 700); await clear(page); };
  const pick = async (page, n = 2) => { for (let i = 0; i < n; i++) await key(page, 'ArrowRight', 110); await sleep(100); };
  const hold = async (page) => { await page.keyboard.down('e'); await sleep(700); await page.keyboard.up('e'); await sleep(250); };
  const takeAsleep = async (page) => { await openDez(page); await pick(page); await hold(page); };
  const untouched = (s) => s.plates.a_dez.words === 'DEZ IS ASLEEP' && s.plates.a_keeper.words === 'KEEPER IS AWAKE';
  async function finish(page, tag, { cross = false } = {}) {
    let s = await st(page);
    if (!s.archive.traded) {
      if (s.archive.phase !== 'carry') { await key(page, 'q', 900); s = await st(page); if (s.archive.phase !== 'idle') await sleep(900); await takeAsleep(page); }
      await atKeeper(page); await key(page, 'f', 900); await pick(page); await key(page, 'f', 300);
    }
    s = await waitFor(page, s => s.archive.traded, 2500);
    ok(`archive softlock ${tag}: the trade still lands (KEEPER IS ASLEEP / DEZ IS AWAKE)`, s.plates.a_keeper.words === 'KEEPER IS ASLEEP' && s.plates.a_dez.words === 'DEZ IS AWAKE' && s.archive.carried === null, info(s));
    s = await waitFor(page, s => s.bridgeDown, 9000);
    ok(`archive softlock ${tag}: the bridge comes down`, s.bridgeDown, info(s));
    if (cross) {
      await clear(page); await pi(page, 'teleport', 420, 420); await page.keyboard.down('d'); await sleep(2400); await page.keyboard.up('d'); s = await st(page);
      ok(`archive softlock ${tag}: Noor crosses the bridge`, s.player.x > 840, `x ${Math.round(s.player.x)}`);
      await pi(page, 'teleport', 1180, 420); await page.keyboard.down('d'); s = await waitFor(page, s => s.room === 'arena', 4000); await page.keyboard.up('d');
      ok(`archive softlock ${tag}: the east exit opens`, s.room === 'arena', s.room);
    }
  }
  let page, ctx, errs, s;

  // A. mashing F: at Dez, while flying to the Keeper, and inside the Keeper line before the selection is made
  ({ ctx, page, errs } = await fresh());
  await atDez(page); for (let i = 0; i < 6; i++) await key(page, 'f', 45); await sleep(800); await clear(page); s = await st(page);
  ok('archive softlock A: F mashed at Dez leaves the Caret in his line or home, never stuck in flight', ['inDez', 'idle'].includes(s.archive.phase) && untouched(s) && ['sent', 'follow'].includes(s.caret.mode), info(s));
  if (s.archive.phase !== 'inDez') { await key(page, 'f', 800); await clear(page); }
  await pick(page); await hold(page); s = await st(page);
  ok('archive softlock A: E hold takes ASLEEP after the mash', s.archive.carried === 'ASLEEP' && s.archive.phase === 'carry', info(s));
  await atKeeper(page); for (let i = 0; i < 6; i++) await key(page, 'f', 45); await sleep(700); s = await st(page);
  ok('archive softlock A: F mashed at the Keeper lands the Caret in its line; nothing is written yet, the word is not lost', s.archive.phase === 'inKeeper' && s.archive.carried === 'ASLEEP' && untouched(s), info(s));
  await pick(page); await key(page, 'f', 60); for (let i = 0; i < 4; i++) await key(page, 'f', 45);
  await finish(page, 'A (mash F)', { cross: true });
  ok('archive softlock A: no page errors', !errs.length, errs.slice(0, 3).join(' | ')); await ctx.close();

  // B. recall mid-trade: Q inside Dez's line, Q during the flight to the Keeper, Q inside the Keeper line, Q while carrying
  ({ ctx, page, errs } = await fresh());
  await openDez(page); await key(page, 'q', 900); s = await st(page);
  ok('archive softlock B: Q in Dez\u2019s line calls the Caret home, nothing changes', s.archive.phase === 'idle' && s.caret.mode === 'follow' && untouched(s) && s.archive.dezCard.state === 'hidden', info(s));
  await takeAsleep(page); await atKeeper(page); await key(page, 'f', 40); await key(page, 'q', 1400); s = await st(page);
  ok('archive softlock B: Q during the flight is queued; on landing the Caret comes home and ASLEEP goes back to Dez', s.archive.phase === 'idle' && s.archive.carried === null && s.caret.mode === 'follow' && untouched(s) && !s.archive.dezCard.blankWord, info(s));
  await takeAsleep(page); await atKeeper(page); await key(page, 'f', 900); await key(page, 'q', 1000); s = await st(page);
  ok('archive softlock B: Q inside the Keeper line recalls cleanly (word home, plates untouched)', s.archive.phase === 'idle' && s.archive.carried === null && untouched(s) && s.archive.keeperCard.state === 'hidden', info(s));
  await takeAsleep(page); await key(page, 'q', 900); s = await st(page);
  ok('archive softlock B: Q while carrying sends ASLEEP back to Dez', s.archive.carried === null && s.archive.phase === 'idle' && untouched(s), info(s));
  await finish(page, 'B (recall)');
  ok('archive softlock B: no page errors', !errs.length, errs.slice(0, 3).join(' | ')); await ctx.close();

  // C. filed while carrying (and while the Caret is inside the Keeper line)
  ({ ctx, page, errs } = await fresh());
  await takeAsleep(page); const hp0 = (await st(page)).hp;
  await pi(page, 'teleport', 300, 560); await pi(page, 'archiveAim', 300, 560); await sleep(2700); s = await st(page);
  ok('archive softlock C: about a second in the lamp files Noor back to the doorway, no damage', s.archive.filedN === 1 && Math.hypot(s.player.x - 100, s.player.y - 420) < 30 && s.hp === hp0, `${info(s)} at ${Math.round(s.player.x)},${Math.round(s.player.y)} hp ${s.hp}/${hp0}`);
  ok('archive softlock C: filing snaps everything home: no word on the Caret, both cards as they were', s.archive.carried === null && ['idle'].includes(s.archive.phase) && untouched(s) && !s.archive.dezCard.blankWord && s.caret.mode === 'follow', info(s));
  await pi(page, 'archiveAim', 430, 175); await sleep(1500); await clear(page);
  await takeAsleep(page); await atKeeper(page); await key(page, 'f', 900);
  await pi(page, 'archiveAim', 420, 440); await sleep(2700); s = await st(page);
  ok('archive softlock C: filed while the Caret sits in the Keeper line: recalled, nothing written', s.archive.filedN === 2 && s.archive.phase === 'idle' && s.archive.carried === null && untouched(s) && s.archive.keeperCard.state === 'hidden', info(s));
  await pi(page, 'archiveAim', 430, 175); await sleep(1500); await clear(page);
  await finish(page, 'C (filed)');
  ok('archive softlock C: no page errors', !errs.length, errs.slice(0, 3).join(' | ')); await ctx.close();

  // D. wrong words bounce: DEZ and IS will not come off; F with a word out of range bounces off the shut line;
  //    an empty Caret bounces off the Keeper; writing over the wrong word bounces and ASLEEP goes home
  ({ ctx, page, errs } = await fresh());
  await openDez(page); await hold(page); s = await st(page);
  ok('archive softlock D: E hold on DEZ (a name) takes nothing', s.archive.carried === null && s.archive.phase === 'inDez' && s.archive.bounces >= 1 && untouched(s), info(s));
  await pick(page, 1); await hold(page); s = await st(page);
  ok('archive softlock D: E hold on IS takes nothing', s.archive.carried === null && s.archive.phase === 'inDez' && s.archive.bounces >= 2 && untouched(s), info(s));
  await key(page, 'q', 900);
  await atKeeper(page); s = await st(page);
  ok('archive softlock D: no open-line sign on the Keeper with an empty Caret', !s.archive.ready && s.archive.keeperCard.state === 'hidden', info(s));
  const b0 = s.archive.bounces; await key(page, 'f', 1200); s = await st(page);
  ok('archive softlock D: F with an empty Caret near the Keeper bounces off the shut line, Caret home', s.archive.bounces > b0 && s.archive.phase === 'idle' && s.caret.mode === 'follow' && untouched(s), info(s));
  await takeAsleep(page); await pi(page, 'teleport', 200, 620); await sleep(300); s = await st(page);
  const b1 = s.archive.bounces;
  ok('archive softlock D: out of range, the Keeper shows no sign', !s.archive.ready, info(s));
  await key(page, 'f', 1400); s = await st(page);
  ok('archive softlock D: F with ASLEEP out of range bounces (SHUT) and the word goes home to Dez', s.archive.bounces > b1 && s.archive.carried === null && s.archive.phase === 'idle' && untouched(s) && !s.archive.dezCard.blankWord, info(s));
  await takeAsleep(page); await atKeeper(page); await key(page, 'f', 900); const b2 = (await st(page)).archive.bounces;
  await key(page, 'f', 900); s = await st(page);
  ok('archive softlock D: writing ASLEEP over KEEPER bounces; ASLEEP goes home, nothing is written', s.archive.bounces > b2 && s.archive.carried === null && untouched(s), info(s));
  await finish(page, 'D (wrong words)', { cross: true });
  ok('archive softlock D: no page errors', !errs.length, errs.slice(0, 3).join(' | ')); await ctx.close();
}
