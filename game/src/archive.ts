// GB-5: the Flooded Archive. Records come here when nobody reads them.
//
// One idea on top of the corridor's: cards give words too, and a swap between two people is a trade.
//   F near Dez's desk sends the Caret into his card (DEZ IS ASLEEP). Left/right select, E (hold) takes ASLEEP;
//   the Caret comes home carrying it. Near the water the Keeper's shut card shows the open-line sign (print
//   readable under a grey wash, a pale cyan edge): only then will it take the word. F sends the Caret, word and
//   all, into KEEPER IS AWAKE; left/right to AWAKE, F writes ASLEEP. AWAKE goes back to Dez: DEZ IS AWAKE.
//   The Keeper sets its lamp on the water, Dez wakes and lowers the bridge.
// Shut lines still bounce (the corridor rule): F with a word and no sign showing sends the Caret at the card,
// it bounces off, and the word goes home to Dez.
// The Keeper's lamp sweeps the left floor in a slow arc. About a second in its light files Noor: a soft fade
// back to the doorway, no damage, any carried word goes home.
// Soft-lock safety: the plates only ever change in one atomic trade; a carried word is a view state (Dez's slot
// shows a blank) that snaps home on recall, bounce, filing or leaving; input during the Caret's flight is held.
import Phaser from 'phaser';
import type { GameScene } from './game';
import { StaffCard, STAFF_RECORDS, CARD_H } from './staffCard';
import { A13 } from './archive13art';
import { sfx, getMasterVolume } from './sfx';
import { writeSave, logSwap } from './save';
import { InteractChip } from './ui/InteractChip';

export const A13_POS = {
  dez: { x: 300, y: 390 },        // desk front centre on the floor (sprite anchor)
  keeper: { x: 676, y: 612 },     // the Keeper's feet at the waterline
  door: { x: 100, y: 420 },       // where filing puts Noor back
};
const KS = 0.92;                   // the Keeper at 0.92 of its render: about twice Noor's height
const DEZ_REACH = 175;             // F sends the Caret into Dez's card from this close (to the card)
const KEEPER_REACH = 320;          // a carried word opens the Keeper's line from this close (to the card)
const TAKE_HOLD = 0.4;
const LIGHT_FILE = 1.0;            // seconds in the lamp's light before Noor is filed
const SWEEP_T = 10, SWEEP_A = 0.55, SWEEP_C = -0.14, HALF = 0.17;
const LAND = { x0: 60, x1: 440, y0: 180, y1: 690 };
const FAR_X = 150;                 // the light dies out before the doorway column (x < 160 is always dark)
const DESK = { x0: 238, y0: 344, x1: 362, y1: 392 };   // Dez's desk on screen (the shadow it throws from the lamp)
const SLOT = 2;
const CH = CARD_H * 1.35;           // the archive's cards are 1.35x (84 x 57 px) so the line reads at 1x

type Phase = 'idle' | 'toDez' | 'inDez' | 'home' | 'carry' | 'toKeeper' | 'inKeeper' | 'bounce' | 'done';

export class ArchiveRoom {
  phase: Phase = 'idle';
  carried: string | null = null;           // the word riding on the Caret (view state; plates are unchanged)
  holdBridge = false;
  private dezRig: Phaser.GameObjects.Container;
  private keeperRig: Phaser.GameObjects.Container;
  private dez: Phaser.GameObjects.Image;
  private keeper: Phaser.GameObjects.Image;
  private lantern: Phaser.GameObjects.Image;
  private pole: Phaser.GameObjects.Graphics;
  private beam: Phaser.GameObjects.Graphics;
  private beamMaskG: Phaser.GameObjects.Graphics;
  private waterLine: Phaser.GameObjects.Graphics;
  private warm: Phaser.GameObjects.Rectangle;
  private lampGlow: Phaser.GameObjects.Graphics;
  private chip: InteractChip;
  private wordChip: Phaser.GameObjects.Container;
  private wordChipText: Phaser.GameObjects.Text;
  dezCard: StaffCard;
  keeperCard: StaffCard;
  private keyF?: Phaser.Input.Keyboard.Key;
  private keyL?: Phaser.Input.Keyboard.Key;
  private keyR?: Phaser.Input.Keyboard.Key;
  private keyQ?: Phaser.Input.Keyboard.Key;
  private sel = 0;
  private takeT = 0;
  private landedAt = -9;
  private recallQueued = false;
  private sweepT = 0;
  private theta = SWEEP_C;
  private lastDir = 0;
  private lightT = 0;
  private graceT = 0;
  private filing = false;
  frozen: number | null = null;              // test hook: a fixed lamp angle (radians), or null to sweep
  private breath?: Phaser.Sound.BaseSound;
  private wrongSaidAt = -9;
  filedN = 0;
  bounces = 0;
  tradedAt = -1;

  constructor(private s: GameScene) {
    const P = A13_POS;
    // Dez at his desk: the desk and Dez are one render (asleep / awake), his card hangs off the desk's front lip
    this.dezRig = s.add.container(P.dez.x, P.dez.y).setDepth(P.dez.y);
    const da = A13.dez_asleep;
    this.dez = s.add.image(0, 0, 'a13_dez_asleep').setOrigin(da.desk_front[0] / da.w, da.desk_front[1] / da.h).setScale(0.5);
    this.dezRig.add(this.dez);
    STAFF_RECORDS.a_dez.anchor = { x: -30, y: -51.6 + CH };   // hung over the desk's front lip, left of Dez
    this.dezCard = new StaffCard(s, this.dezRig, STAFF_RECORDS.a_dez, 'card_a_dez');
    this.dezCard.setAwake(false);
    // The Keeper: stilts in the water, archive boxes for a body, a card-catalogue drawer for a head, card on a lanyard
    this.keeperRig = s.add.container(P.keeper.x, P.keeper.y).setDepth(P.keeper.y);
    const ka = A13.keeper_awake;
    this.keeper = s.add.image(0, 0, 'a13_keeper_awake').setOrigin(ka.foot[0] / ka.w, ka.foot[1] / ka.h).setScale(0.5 * KS);
    this.keeperRig.add(this.keeper);
    STAFF_RECORDS.a_keeper.anchor = { x: (ka.card[0] - ka.foot[0]) * KS, y: (ka.card[1] - ka.foot[1]) * KS + CH };
    this.keeperCard = new StaffCard(s, this.keeperRig, STAFF_RECORDS.a_keeper, 'card_a_keeper');
    this.waterLine = s.add.graphics().setDepth(P.keeper.y + 1);
    this.pole = s.add.graphics().setDepth(P.keeper.y + 2);
    this.lantern = s.add.image(0, 0, 'a13_keeper_lantern').setOrigin(A13.keeper_lantern.hook[0] / A13.keeper_lantern.w, A13.keeper_lantern.hook[1] / A13.keeper_lantern.h).setScale(0.5).setDepth(P.keeper.y + 3);
    // the lamp's light on the floor (additive), masked to the land so it never paints the water or walls
    this.beam = s.add.graphics().setDepth(-990).setBlendMode(Phaser.BlendModes.ADD);
    this.beamMaskG = s.make.graphics({}, false); this.beamMaskG.fillStyle(0xffffff, 1).fillRect(LAND.x0, LAND.y0, LAND.x1 - LAND.x0, LAND.y1 - LAND.y0);
    this.beam.setMask(this.beamMaskG.createGeometryMask());
    this.lampGlow = s.add.graphics().setDepth(P.keeper.y - 2).setBlendMode(Phaser.BlendModes.ADD);
    this.warm = s.add.rectangle(0, 0, 1280, 720, 0xffe2c0, 1).setOrigin(0).setAlpha(0).setDepth(-985).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.chip = new InteractChip(s, 9004);
    // the word riding on the Caret: a torn slip of card with the word printed on it
    this.wordChip = s.add.container(0, 0).setDepth(3610).setVisible(false);
    const slip = s.add.graphics(); slip.fillStyle(0x0a0e14, 0.5).fillRect(-26, -7, 54, 17); slip.fillStyle(0xe8e0cc, 1).fillRect(-27, -9, 54, 17); slip.lineStyle(1, 0x3a3226, 1).strokeRect(-27, -9, 54, 17);
    this.wordChipText = s.add.text(0, -1, '', { fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif', fontSize: '13px', fontStyle: '800', color: '#12161f' }).setOrigin(0.5);
    this.wordChip.add([slip, this.wordChipText]);
    s.objs.push(this.dezRig, this.keeperRig, this.waterLine, this.pole, this.lantern, this.beam, this.beamMaskG, this.lampGlow, this.warm, this.chip.root, this.wordChip);
    s.dyn.a13desk = { x: DESK.x0 + 2, y: 356, w: DESK.x1 - DESK.x0 - 4, h: 34 };
    const kb = s.input.keyboard;
    if (kb) { this.keyF = kb.addKey('F'); this.keyL = kb.addKey('LEFT'); this.keyR = kb.addKey('RIGHT'); this.keyQ = kb.addKey('Q'); }
    if (this.traded()) this.setTradedLook(true);
    else this.startBreath();
    this.refreshCards();
    this.update(0);
  }

  destroy() { try { this.breath?.stop(); this.breath?.destroy(); } catch { /* */ } this.breath = undefined; }

  // ------------------------------------------------------------------ state
  private w(id: string) { return this.s.plateById(id)?.slotWord ?? null; }
  traded() { return this.w('a_keeper') === 'ASLEEP' && this.w('a_dez') === 'AWAKE'; }
  inLine() { return this.phase === 'inDez' || this.phase === 'inKeeper'; }
  busyFlight() { return this.phase === 'toDez' || this.phase === 'toKeeper' || this.phase === 'home' || this.phase === 'bounce'; }
  dezSpot() { return this.traded() ? { x: A13_POS.dez.x + 104, y: A13_POS.dez.y - 62 } : { x: A13_POS.dez.x + 18, y: A13_POS.dez.y - 66 }; }
  private cardCentre(c: StaffCard) { const b = c.bounds(0); return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }; }
  private distTo(c: StaffCard) { const p = this.cardCentre(c); return Math.hypot(p.x - this.s.x, p.y - (this.s.y - 40)); }
  nearDez() { return this.distTo(this.dezCard) < DEZ_REACH; }
  keeperReady() { return this.carried !== null && this.phase === 'carry' && this.distTo(this.keeperCard) < KEEPER_REACH && !this.traded(); }
  cardBounds() { return [this.dezCard.bounds(6), this.keeperCard.bounds(6)].map(b => ({ ...b, x1: b.x1 + 26 })); }
  holding() { return this.carried !== null; }

  /** cards show what the room is doing: Dez's line opens with the Caret in it, the Keeper's shows the sign */
  private refreshCards() {
    const dw = this.s.plateById('a_dez')?.words ?? ['DEZ', 'IS', 'ASLEEP'];
    const kw = this.s.plateById('a_keeper')?.words ?? ['KEEPER', 'IS', 'AWAKE'];
    const done = this.traded();
    const dState = done ? 'still' : this.phase === 'inDez' ? 'open' : 'hidden';
    const kState = done ? 'still' : this.phase === 'inKeeper' ? 'open' : this.keeperReady() ? 'ready' : 'hidden';
    if (this.dezCard.state !== dState || this.dezCard.words.join(' ') !== dw.join(' ')) this.dezCard.show(dw, dState);
    if (this.keeperCard.state !== kState || this.keeperCard.words.join(' ') !== kw.join(' ')) this.keeperCard.show(kw, kState);
    // while a line is open the card is never hidden by Noor standing in front of it
    this.dezRig.setDepth(this.phase === 'inDez' ? 3590 : A13_POS.dez.y);
    this.keeperRig.setDepth(this.phase === 'inKeeper' ? 3590 : A13_POS.keeper.y);
    this.dezCard.setBlank(this.carried && !done ? SLOT : -1);
    this.dezCard.setSel(this.phase === 'inDez' ? this.sel : -1);
    this.keeperCard.setSel(this.phase === 'inKeeper' ? this.sel : -1);
    this.keeperCard.setAwake(!done);
  }

  // ------------------------------------------------------------------ input
  /** called from GameScene.update after movement: F / arrows / Q / E-hold for the archive */
  input(dt: number, control: boolean, eHeld: boolean) {
    const s = this.s, J = Phaser.Input.Keyboard.JustDown;
    const f = !!this.keyF && J(this.keyF), l = !!this.keyL && J(this.keyL), r = !!this.keyR && J(this.keyR), q = !!this.keyQ && J(this.keyQ);
    if (!control || this.filing || !s.caretOwned) { this.takeT = 0; return; }
    if (this.busyFlight()) { if (q) this.recallQueued = true; this.takeT = 0; return; }   // mashing during a flight is held, a recall waits for landing
    if (this.inLine()) {
      const n = (this.phase === 'inDez' ? this.dezCard : this.keeperCard).words.length;
      if (l) this.select(this.sel - 1, n); if (r) this.select(this.sel + 1, n);
      if (q) { this.recall(); return; }
    }
    if (this.phase === 'inDez') {
      if (f) { this.recall(); return; }   // empty hands: F calls the Caret home
      if (eHeld) {
        this.takeT += dt;
        if (this.takeT >= TAKE_HOLD) { this.takeT = 0; this.tryTake(); }
      } else this.takeT = Math.max(0, this.takeT - dt * 2);
      return;
    }
    this.takeT = 0;
    if (this.phase === 'inKeeper') {
      if (f && s.t - this.landedAt > 0.35) this.write();
      return;
    }
    if (q && this.phase === 'carry') { this.recall(); return; }   // Q with a word on the Caret: it goes back to Dez
    if (!f || this.traded()) return;
    if (this.phase === 'carry') { if (this.keeperReady()) this.sendToKeeper(); else this.bounceOffShut(); return; }
    if (this.phase === 'idle') { if (this.nearDez()) this.sendToDez(); else if (this.distTo(this.keeperCard) < KEEPER_REACH) this.bounceOffShut(); }
  }

  private select(i: number, n: number) {
    const k = Phaser.Math.Clamp(i, 0, n - 1);
    if (k !== this.sel) { this.sel = k; sfx('impact_whoosh', 0.2); this.refreshCards(); }   // the highlight moves on this very press
    if (k === SLOT) this.s.caretPickedQuick = true;
  }

  // ------------------------------------------------------------------ the Caret's trips
  private fly(to: { x: number; y: number }, ms: number, done: () => void) {
    const c = this.s.caret; this.s.tweens.killTweensOf(c);
    c.setVisible(true).setAlpha(1); this.s.caretMode = 'travel';
    this.s.tweens.add({ targets: c, x: to.x, y: to.y, duration: ms, ease: 'Cubic.easeOut', onUpdate: () => c.setDepth(3600), onComplete: done });
  }
  private spot(card: StaffCard, i: number) { return card.caretSpot(i) ?? this.cardCentre(card); }

  sendToDez() {
    this.phase = 'toDez'; this.sel = 0; this.recallQueued = false;
    sfx('impact_whoosh', 0.4);
    this.fly(this.spot(this.dezCard, 0), 300, () => {
      this.phase = 'inDez'; this.landedAt = this.s.t; this.s.caretMode = 'sent'; this.s.caretWriting = 'a_dez'; this.s.caretSendOnce = true;
      sfx('swap'); this.refreshCards();
      if (!this.s.save.seen.includes('a13take')) { this.s.save.seen.push('a13take'); writeSave(this.s.save); this.s.say('fern', 'Cards give words too. Take his.', 2600, { box: true }); }
      if (this.recallQueued) this.recall();
    });
  }

  private tryTake() {
    const words = this.dezCard.words, wd = words[this.sel];
    if (this.sel !== SLOT || wd !== 'ASLEEP') {
      this.bounces++;
      if (this.s.t - this.wrongSaidAt > 1.2) { this.wrongSaidAt = this.s.t; const c = this.cardCentre(this.dezCard); this.s.floorText(c.x, c.y - 40, this.sel === 0 ? 'A NAME STAYS PUT' : 'IS HOLDS THE LINE', '#e8e2d0', 13, 1200); sfx('block'); }
      return;
    }
    this.carried = 'ASLEEP'; sfx('steal'); this.s.markTut('take');
    this.refreshCards();
    // the Caret comes home with the word on it
    this.phase = 'home'; this.s.caretWriting = undefined;
    this.fly({ x: this.s.x - 46, y: this.s.y - 56 }, 260, () => { this.phase = 'carry'; this.s.caretMode = 'follow'; this.refreshCards(); this.recallQueued = false; });
  }

  sendToKeeper() {
    this.phase = 'toKeeper'; this.sel = 0; this.recallQueued = false;
    sfx('impact_whoosh', 0.5);
    this.fly(this.spot(this.keeperCard, 0), 340, () => {
      this.phase = 'inKeeper'; this.landedAt = this.s.t; this.s.caretMode = 'sent'; this.s.caretWriting = 'a_keeper';
      sfx('swap'); this.s.cameras.main.shake(100, 0.002); this.refreshCards();
      if (this.recallQueued) this.recall();
    });
  }

  /** F at a shut line (no sign): the Caret flies at it and bounces off; a carried word goes home to Dez */
  bounceOffShut() {
    const c = this.s.caret, from = { x: c.x, y: c.y }, tgt = this.cardCentre(this.keeperCard);
    const mid = { x: from.x + (tgt.x - from.x) * 0.45, y: from.y + (tgt.y - from.y) * 0.45 };
    this.phase = 'bounce'; this.bounces++; sfx('impact_bounce', 0.6);
    const word = this.carried;
    this.fly(mid, 200, () => {
      this.s.floorText(mid.x, mid.y - 18, 'SHUT', '#e8e2d0', 13, 900);
      if (word) this.wordHome();
      this.fly({ x: this.s.x - 46, y: this.s.y - 56 }, 240, () => { this.phase = 'idle'; this.s.caretMode = 'follow'; this.refreshCards(); this.recallQueued = false; });
    });
  }

  private write() {
    if (!this.carried) { this.recall(); return; }   // empty Caret in the Keeper's line: F calls it home
    const kw = this.keeperCard.words;
    if (this.sel !== SLOT || kw[SLOT] !== 'AWAKE') {
      // wrong slot: the word won't sit there; it bounces and goes home to Dez. The Caret stays in the line.
      const b = this.keeperCard.wordBox(this.sel); this.bounces++; sfx('impact_bounce', 0.6);
      if (b) this.s.floorText(b.x, b.y - 26, "WON'T FIT THERE", '#e8e2d0', 13, 1100);
      this.wordHome();
      this.refreshCards();
      return;
    }
    this.trade();
  }

  /** the one atomic change: KEEPER IS ASLEEP and DEZ IS AWAKE together */
  private trade() {
    const s = this.s;
    this.setPlate('a_keeper', 'ASLEEP'); this.setPlate('a_dez', 'AWAKE');
    logSwap(s.save, { placed: 'ASLEEP', removed: 'AWAKE', room: 'archive', plate: 'a_keeper', t: Date.now() });
    logSwap(s.save, { placed: 'AWAKE', removed: 'ASLEEP', room: 'archive', plate: 'a_dez', t: Date.now() });
    try { writeSave(s.save); } catch { /* */ }
    this.carried = null; this.tradedAt = s.t; this.phase = 'done';
    s.caretWriting = undefined; s.caretMode = 'follow'; s.caret.setAlpha(1);
    sfx('swap'); s.cameras.main.shake(140, 0.003);
    // AWAKE flies from the Keeper's card to Dez's
    const a = this.keeperCard.wordBox(SLOT), d = this.dezCard.wordBox(SLOT);
    if (a && d) {
      const t = s.add.text(a.x, a.y, 'AWAKE', { fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif', fontSize: '13px', fontStyle: '800', color: '#12161f', backgroundColor: '#e8e0cc', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(3620);
      s.objs.push(t); s.tweens.add({ targets: t, x: d.x, y: d.y, duration: 620, ease: 'Sine.easeInOut', onComplete: () => t.destroy() });
    }
    this.holdBridge = true;
    s.evaluate(false);
    this.setTradedLook(false);
    s.time.delayedCall(900, () => {
      s.say('dez', 'Monday came. Nobody read it.', 2600, { box: true });
      s.say('dez', "The winch. I've got it.", 2000, { box: true, onStart: () => { s.time.delayedCall(700, () => { this.holdBridge = false; s.evaluate(false); }); } });
    });
    // never leave the bridge held if the dialogue is skipped or cleared
    s.time.delayedCall(6500, () => { if (this.holdBridge) { this.holdBridge = false; s.evaluate(false); } });
  }

  private setPlate(id: string, word: string) {
    const p = this.s.plateById(id); if (!p || p.def.slot < 0) return;
    p.setSlotWord(word); this.s.save.plates[id] = word;
    try { writeSave(this.s.save); } catch { /* */ }
  }

  /** a carried word goes back into Dez's card (blank fills) */
  private wordHome() {
    if (!this.carried) return;
    const from = { x: this.wordChip.x, y: this.wordChip.y }, d = this.dezCard.wordBox(SLOT);
    this.carried = null;
    if (d) {
      const t = this.s.add.text(from.x, from.y, 'ASLEEP', { fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif', fontSize: '13px', fontStyle: '800', color: '#12161f', backgroundColor: '#e8e0cc', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(3620);
      this.s.objs.push(t); this.s.tweens.add({ targets: t, x: d.x, y: d.y, alpha: 0.6, duration: 420, ease: 'Sine.easeIn', onComplete: () => t.destroy() });
    }
    this.refreshCards();
  }

  /** Q / Esc / F with empty hands (and recall from GameScene): the Caret comes home; a carried word goes to Dez */
  recall(): boolean {
    if (this.busyFlight()) { this.recallQueued = true; return true; }
    if (this.phase === 'idle' || this.phase === 'done') return false;
    if (this.carried) this.wordHome();
    this.phase = 'idle'; this.recallQueued = false;
    this.s.caretWriting = undefined; this.s.caretMode = 'follow'; this.s.caret.setAlpha(1);
    sfx('impact_whoosh', 0.35);
    this.refreshCards();
    return true;
  }

  /** hard reset of every transient (filing, leaving the room): no tween left mid-air, word home, Caret at Noor */
  snapAll() {
    const s = this.s;
    s.tweens.killTweensOf(s.caret);
    this.carried = null; this.recallQueued = false; this.takeT = 0;
    if (this.phase !== 'done') this.phase = 'idle';
    s.caretWriting = undefined; if (s.caretOwned) { s.caretMode = 'follow'; s.caret.setAlpha(1).setPosition(s.x - 46, s.y - 56); }
    this.refreshCards();
  }

  // ------------------------------------------------------------------ the lamp
  private lampPoints() {
    const k = A13.keeper_awake, P = A13_POS.keeper;
    const hand = { x: P.x + (k.hand[0] - k.foot[0]) * KS, y: P.y + (k.hand[1] - k.foot[1]) * KS };
    const sw = (this.theta - SWEEP_C) / SWEEP_A;   // -1..1 across the sweep
    const tip = { x: hand.x - 56, y: hand.y - 34 + sw * 16 };
    const L = { x: tip.x, y: tip.y + (A13.keeper_lantern.glow[1] - A13.keeper_lantern.hook[1]) };
    return { hand, tip, L };
  }
  private ray(L: { x: number; y: number }, a: number, x: number) { return { x, y: L.y + (L.x - x) * Math.tan(a) }; }
  private deskArc(L: { x: number; y: number }) {
    const cs = [[DESK.x0, DESK.y0], [DESK.x1, DESK.y0], [DESK.x0, DESK.y1], [DESK.x1, DESK.y1]].map(([x, y]) => Math.atan2(y - L.y, L.x - x));
    return { a0: Math.min(...cs), a1: Math.max(...cs) };
  }
  /** is the floor point lit by the lamp right now (desk shadow counted) */
  litAt(x: number, y: number) {
    if (this.traded() || x > LAND.x1 || x < FAR_X + 10) return false;
    const { L } = this.lampPoints(); const a = Math.atan2(y - L.y, L.x - x);
    if (Math.abs(a - this.theta) > HALF * 0.85) return false;
    const d = this.deskArc(L);
    if (a > d.a0 && a < d.a1 && x < DESK.x1) return false;   // behind the desk: Dez's shadow
    return true;
  }
  private drawBeam() {
    const g = this.beam; g.clear();
    if (this.traded()) return;
    const { L } = this.lampPoints(); const d = this.deskArc(L);
    const bands: [number, number, number][] = [];
    for (let i = 0, n = 14; i < n; i++) { const x0 = LAND.x1 - (LAND.x1 - FAR_X) * i / n, x1 = LAND.x1 - (LAND.x1 - FAR_X) * (i + 1) / n; const t = (i + 0.5) / n; bands.push([x0, x1, Math.min(1, 1.15 - t * t * 1.05)]); }
    const layers: [number, number][] = [[HALF * 1.4, 0.035], [HALF * 1.15, 0.045], [HALF * 0.9, 0.06], [HALF * 0.65, 0.07], [HALF * 0.4, 0.06]];
    for (const [hw, al] of layers) {
      // split the wedge where the desk throws its shadow
      const a0 = this.theta - hw, a1 = this.theta + hw;
      const parts: [number, number, boolean][] = [];
      const c0 = Math.max(a0, d.a0), c1 = Math.min(a1, d.a1);
      if (c1 > c0) { if (c0 > a0) parts.push([a0, c0, false]); parts.push([c0, c1, true]); if (a1 > c1) parts.push([c1, a1, false]); } else parts.push([a0, a1, false]);
      for (const [p0, p1, shaded] of parts) for (const [xn, xf, k] of bands) {
        const far = shaded ? Math.max(xf, DESK.x1) : xf; if (far >= xn) continue;
        const pts = [this.ray(L, p0, xn), this.ray(L, p1, xn), this.ray(L, p1, far), this.ray(L, p0, far)];
        g.fillStyle(0xffc98a, al * k); g.fillPoints(pts as unknown as Phaser.Math.Vector2[], true);
      }
    }
  }
  private drawKeeperBits() {
    const done = this.traded(), P = A13_POS.keeper;
    const wl = this.waterLine; wl.clear();
    // the waterline at the stilts: two short flat strokes (no rings)
    const k = done ? A13.keeper_asleep : A13.keeper_awake;
    const sl = { x: P.x + (k.stiltL[0] - k.foot[0]) * KS, y: P.y }, sr = { x: P.x + (k.stiltR[0] - k.foot[0]) * KS, y: P.y };
    wl.lineStyle(1.5, 0x5a8a96, 0.55); wl.lineBetween(sl.x - 9, sl.y, sl.x + 9, sl.y); wl.lineBetween(sr.x - 9, sr.y, sr.x + 9, sr.y);
    wl.lineStyle(1, 0x2a4a54, 0.5); wl.lineBetween(sl.x - 5, sl.y + 4, sr.x + 5, sr.y + 4);
    const pg = this.pole; pg.clear();
    const lg = this.lampGlow; lg.clear();
    if (!done) {
      const { hand, tip } = this.lampPoints();
      pg.lineStyle(3, 0x1a1c20, 1).lineBetween(hand.x, hand.y, tip.x, tip.y);
      pg.lineStyle(1, 0x5a5e66, 0.8).lineBetween(hand.x, hand.y - 1, tip.x, tip.y - 1);
      this.lantern.setPosition(tip.x, tip.y).setRotation(0);
      // its reflection: a vertical warm streak on the black water under the lamp
      const rx = tip.x, ry = Math.max(tip.y + 40, 470);
      for (let i = 0; i < 6; i++) { lg.fillStyle(0xffb870, 0.035); lg.fillRect(rx - 3 + i * 0.3, ry, 6 - i * 0.6, 84 - i * 13); }
    } else {
      // set down on the water beside its feet: a warm streak, still
      const lx = P.x - 56, ly = P.y + 8; this.lantern.setPosition(lx, ly - 30);
      for (let i = 0; i < 6; i++) { lg.fillStyle(0xffb870, 0.05); lg.fillRect(lx - 5 + i * 0.6, ly, 10 - i * 1.2, 70 - i * 11); }
    }
  }

  private file() {
    const s = this.s; this.filing = true; this.filedN++; this.lightT = 0;
    s.floorText(s.x, s.y - 110, 'FILED', '#f0d8b0', 18, 1100);
    this.playSample('sfx_filed', 0.7);
    if (!s.save.seen.includes('a13filed')) { s.save.seen.push('a13filed'); writeSave(s.save); s.say('fern', 'Its light files you. Keep to the dark.', 2600, { box: true }); }
    this.snapAll();
    s.busy = true;
    s.tweens.add({ targets: [s.noor, s.caret], alpha: 0, duration: 380, onComplete: () => {
      s.x = A13_POS.door.x; s.y = A13_POS.door.y; s.noor.setPosition(s.x, s.y); s.caret.setPosition(s.x - 46, s.y - 56);
      s.tweens.add({ targets: [s.noor, s.caret], alpha: 1, duration: 380, onComplete: () => { s.busy = false; this.filing = false; this.graceT = 1.2; s.noor.clearTint(); } });
    } });
  }

  // ------------------------------------------------------------------ sound
  private playSample(key: string, vol: number) {
    try { if (this.s.cache.audio.exists(key)) this.s.sound.play(key, { volume: vol * getMasterVolume() }); } catch { /* */ }
  }
  private startBreath() {
    try { if (this.s.cache.audio.exists('sfx_dez_breath')) { this.breath = this.s.sound.add('sfx_dez_breath', { loop: true, volume: 0 }); this.breath.play(); } } catch { /* */ }
  }

  private setTradedLook(initial: boolean) {
    const s = this.s, ks = A13.keeper_asleep;
    this.keeper.setTexture('a13_keeper_asleep').setOrigin(ks.foot[0] / ks.w, ks.foot[1] / ks.h);
    const anc = { x: (ks.card[0] - ks.foot[0]) * KS, y: (ks.card[1] - ks.foot[1]) * KS + CH };
    STAFF_RECORDS.a_keeper.anchor = anc; STAFF_RECORDS.a_keeper.tilt = 0.16;
    if (initial) { this.keeperCard.setLean(0); this.warm.setAlpha(1); }
    else { s.tweens.add({ targets: this.keeperCard.root, x: anc.x, y: anc.y, rotation: 0.16, duration: 700, ease: 'Sine.easeInOut' }); s.tweens.add({ targets: this.warm, alpha: 1, duration: 1600 }); }
    const aw = A13.dez_awake; this.dez.setTexture('a13_dez_awake').setOrigin(aw.desk_front[0] / aw.w, aw.desk_front[1] / aw.h);
    try { this.breath?.stop(); } catch { /* */ }
    if (!initial) { this.playSample('sfx_dez_wake', 0.8); this.playSample('sfx_keeper_clunk', 0.6); }
    this.refreshCards();
  }

  // ------------------------------------------------------------------ per frame
  update(dt: number) {
    const s = this.s, done = this.traded();
    // the sweep
    if (!done) {
      this.sweepT += dt;
      const prev = this.theta;
      this.theta = this.frozen ?? SWEEP_C + SWEEP_A * Math.sin((this.sweepT / SWEEP_T) * Math.PI * 2);
      const dir = Math.sign(this.theta - prev);
      if (dir && this.lastDir && dir !== this.lastDir && this.frozen === null) {   // the Keeper shifts its stilts at each end of the arc
        this.playSample('sfx_keeper_clunk', 0.35 * this.near(A13_POS.keeper, 900));
        s.tweens.add({ targets: this.keeper, y: 2, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
      }
      if (dir) this.lastDir = dir;
    }
    this.drawBeam(); this.drawKeeperBits();
    // the light on Noor
    this.graceT = Math.max(0, this.graceT - dt);
    const lit = !done && !this.filing && this.graceT <= 0 && s.caretOwned && !s.dying && this.litAt(s.x, s.y);
    if (lit) this.lightT += dt; else this.lightT = Math.max(0, this.lightT - dt * 0.5);
    if (!this.filing) { if (this.lightT > 0.02) { const k = Math.min(1, this.lightT / LIGHT_FILE); const c = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(255, 255, 255), new Phaser.Display.Color(255, 206, 140), 100, Math.round(k * 100)); s.noor.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b)); } else s.noor.clearTint(); }
    if (this.lightT >= LIGHT_FILE && !this.filing) this.file();
    // breath gets louder as Noor comes close to Dez
    if (this.breath && !done) { try { (this.breath as Phaser.Sound.WebAudioSound).setVolume(0.5 * getMasterVolume() * this.near(A13_POS.dez, 520)); } catch { /* */ } }
    // the carried word rides on the Caret
    const ride = !!this.carried && (this.phase === 'carry' || this.phase === 'home' || this.phase === 'toKeeper' || this.phase === 'inKeeper' || this.phase === 'bounce');
    this.wordChip.setVisible(ride);
    if (ride) { this.wordChipText.setText(this.carried!); this.wordChip.setPosition(s.caret.x + 2, s.caret.y - 44 + Math.sin(s.t * 4) * 1.5); }
    if (this.phase === 'carry' || this.phase === 'idle') this.refreshCards();
    this.keeperCard.setGlow(0.55 + 0.45 * Math.sin(s.t * 4));
    this.updateChip();
  }
  private near(p: { x: number; y: number }, r: number) { return Math.max(0, 1 - Math.hypot(p.x - this.s.x, p.y - this.s.y) / r); }

  /** the Caret sits in a line: on the selected word, just past the card's edge */
  updateCaretSent(dt: number) {
    const card = this.phase === 'inDez' ? this.dezCard : this.phase === 'inKeeper' ? this.keeperCard : null;
    const c = this.s.caret;
    if (!card) return;
    c.setDepth(3600).setAlpha(0.7 + 0.3 * (Math.sin(this.s.t * 7) > -0.3 ? 1 : 0)).setScale(0.5);
    const sp = card.caretSpot(this.sel); if (!sp) return;
    c.x += (sp.x - c.x) * Math.min(1, dt * 18); c.y += (sp.y + Math.sin(this.s.t * 5) * 1.2 - c.y) * Math.min(1, dt * 18);
  }

  private updateChip() {
    const s = this.s; let show: [number, number, string, number, string] | null = null;
    const top = (c: StaffCard) => { const b = c.bounds(0); return { x: (b.x0 + b.x1) / 2, y: b.y0 - 18 }; };
    if (!this.traded() && !this.filing && !s.dialogue?.busy) {
      if (this.phase === 'inDez' && this.sel === SLOT && !this.carried) { const p = top(this.dezCard); show = [p.x, p.y, 'take', this.takeT / TAKE_HOLD, 'E']; }
      else if (this.phase === 'idle' && this.nearDez() && s.caretMode === 'follow') { const p = top(this.dezCard); show = [p.x, p.y, 'send', 0, 'F']; }
      else if (this.keeperReady()) { const p = top(this.keeperCard); show = [p.x, p.y, 'send', 0, 'F']; }
      else if (this.phase === 'inKeeper' && this.carried && this.sel === SLOT) { const p = top(this.keeperCard); show = [p.x, p.y, 'write', 0, 'F']; }
    }
    if (show) this.chip.show(show[0], show[1], show[2], show[3], show[4]); else this.chip.hide();
  }

  state() {
    return {
      phase: this.phase, carried: this.carried, sel: this.sel, theta: this.theta, lightT: this.lightT, filing: this.filing, filedN: this.filedN, bounces: this.bounces,
      ready: this.keeperReady(), nearDez: this.nearDez(), traded: this.traded(), holdBridge: this.holdBridge, frozen: this.frozen, litNoor: this.litAt(this.s.x, this.s.y),
      dezCard: { ...this.dezCard.testState(), bounds: this.dezCard.bounds(0) }, keeperCard: { ...this.keeperCard.testState(), bounds: this.keeperCard.bounds(0) },
      chip: { visible: this.chip.isShown(), key: this.chip.currentKey(), verb: this.chip.currentVerb() }, wordChip: this.wordChip.visible ? this.wordChipText.text : null,
      lamp: this.lampPoints().L, keeper: this.keeper.texture.key, dez: this.dez.texture.key,
    };
  }
  /** test hook: point the lamp at a floor point (frozen) or let it sweep again */
  aim(x: number | null, y = 0) {
    if (x === null) { this.frozen = null; return; }
    // the lamp hangs from the pole, so its point moves with the angle: settle it in a few passes
    for (let i = 0; i < 6; i++) { const { L } = this.lampPoints(); this.frozen = Math.atan2(y - L.y, L.x - x); this.theta = this.frozen; }
  }
}
