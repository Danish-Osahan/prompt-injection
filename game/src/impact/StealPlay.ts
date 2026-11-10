// Phase 1 steal/throw for hub → corridor → archive → arena.
// One held quality, E to take / peel back, F to throw, U to undo.
// Plates stay the state backend; word chips and READ stay off.
import Phaser from 'phaser';
import type { GameScene } from '../game';
import type { RoomId } from '../save';
import { writeSave, logSwap } from '../save';
import { ImpactFX } from './ImpactFX';
import { OnboardLure } from './OnboardLure';
import { sfx } from '../sfx';

const OPP: Record<string, string> = {
  OPEN: 'SHUT', SHUT: 'OPEN',
  ON: 'OFF', OFF: 'ON',
  QUICK: 'STILL', STILL: 'QUICK',
  HIGH: 'LOW', LOW: 'HIGH',
  UP: 'DOWN', DOWN: 'UP',
  WET: 'DRY', DRY: 'WET',
  TOGETHER: 'APART', APART: 'TOGETHER',
  WEAK: 'TORN', TORN: 'WEAK',
};

const STICKS: Record<string, string[]> = {
  OPEN: ['h_door', 'o_door'],
  SHUT: ['h_door', 'o_door', 'h_lamp'],
  ON: ['c_light'],
  OFF: ['c_switch', 'c_light'],
  QUICK: ['c_dummy', 'c_clock'],
  STILL: ['c_dummy', 'c_clock'],
  LOW: ['a_water', 'a_drawer'],
  HIGH: ['a_water', 'a_drawer'],
  DOWN: ['a_bridge', 'a_stairs'],
  UP: ['a_bridge', 'a_stairs'],
  DRY: ['a_ink', 'a_towel', 'a_notes', 'a_water'],
  WET: ['a_ink', 'a_towel', 'a_water'],
  APART: ['a_notes'],
  TOGETHER: ['a_notes', 'a_books'],
  WEAK: ['r_guard', 'r_weak'],
  PAPER: ['c_dummy', 'r_guard'],
};

const ENEMY_COUNTER: Record<string, string[]> = {
  QUICK: ['dummy'], STILL: ['dummy'], PAPER: ['dummy', 'scribble', 'stapler'],
  WET: ['scribble'], DRY: ['note', 'scribble'],
  SLOW: ['redline'], WEAK: ['draft'], GLASS: ['dummy', 'stapler', 'redline'],
};

export const STEAL_ROOMS: RoomId[] = ['hub', 'corridor', 'archive', 'arena'];

interface Link { src: string; quality: string; dst: string }

const LINKS: Partial<Record<RoomId, Link[]>> = {
  hub: [{ src: 'h_lamp', quality: 'OPEN', dst: 'h_door' }],
  corridor: [
    { src: 'c_switch', quality: 'ON', dst: 'c_light' },
    { src: 'c_clock', quality: 'QUICK', dst: 'c_dummy' },
  ],
  archive: [
    { src: 'a_drawer', quality: 'LOW', dst: 'a_water' },
    { src: 'a_stairs', quality: 'DOWN', dst: 'a_bridge' },
    { src: 'a_towel', quality: 'DRY', dst: 'a_ink' },
    { src: 'a_books', quality: 'APART', dst: 'a_notes' },
    { src: 'a_ink', quality: 'WET', dst: 'a_towel' },
  ],
  arena: [{ src: 'r_weak', quality: 'WEAK', dst: 'r_guard' }],
};

const FERN = { x: 1005, y: 545 };
const NEAR = 130;

export class StealPlay {
  on = false;
  held: { word: string; from: string } | null = null;
  fx: ImpactFX;
  lure?: OnboardLure;
  private keyF?: Phaser.Input.Keyboard.Key;
  private keyU?: Phaser.Input.Keyboard.Key;
  private peelT = 0;
  private peelNeed = 0.4;
  private orb?: Phaser.GameObjects.GameObject;
  private flying = false;
  private lastApply: { from: string; word: string; onto: string; prev: string } | null = null;
  private fernSaid = false;
  private lastLink: Link | null = null;

  constructor(private s: GameScene) { this.fx = new ImpactFX(s); }

  start() {
    if (this.on) return;
    const id = this.s.room.id;
    if (!STEAL_ROOMS.includes(id)) return;
    this.on = true;
    this.held = null;
    this.flying = false;
    this.lastApply = null;
    this.suppressWordUi(true);
    this.keyF = this.s.input.keyboard?.addKey('F');
    this.keyU = this.s.input.keyboard?.addKey('U');
    const beat = this.currentLink();
    if (beat) this.makeLure(beat);
  }

  stop() {
    this.on = false;
    this.clearOrb();
    this.lure?.destroy(); this.lure = undefined;
    this.held = null;
    this.flying = false;
    this.suppressWordUi(false);
  }

  leaveRoom() {
    // Export is banned: a held quality snaps home. Solved throws stay.
    if (this.held) { this.returnTo(this.held.from, this.held.word); this.held = null; this.clearOrb(); this.s.evaluate(false); }
    this.stop();
  }

  /** Undo key: revert last throw and any held quality. */
  snapHome() {
    if (this.lastApply) this.revertLast();
    this.snapHeld();
  }
  /** Death / threshold: only a carried quality snaps home. Solved throws stay (checkpoint-safe). */
  snapHeld() {
    if (!this.held) { this.clearOrb(); this.lure?.setCarrying(false); return; }
    this.returnTo(this.held.from, this.held.word);
    this.held = null;
    this.clearOrb();
    this.lure?.setCarrying(false);
    this.s.evaluate(false);
  }

  update(dt: number) {
    if (!this.on) return;
    this.suppressWordUi(true);
    this.syncLure();
    this.lure?.update(dt);
    if (this.orb && this.held && !this.flying) {
      const h = this.handOff();
      (this.orb as Phaser.GameObjects.Image).setPosition(this.s.x + h.x, this.s.y + h.y);
    }
    if (this.flying) return;
    const f = this.s.ctl.read();
    if (this.keyU && Phaser.Input.Keyboard.JustDown(this.keyU)) this.undo();
    if (this.held && this.keyF && Phaser.Input.Keyboard.JustDown(this.keyF)) {
      this.throwAt();
      return;
    }
    const near = this.nearTakeable();
    if (near && f.interactHeld && !this.held) {
      this.peelT += dt;
      try { this.s.noor.play(`noor_type1_${this.s.dir}`, true); } catch { /* */ }
      if (this.peelT >= this.peelNeed) { this.peelT = 0; this.take(near); }
    } else if (!this.held && near && f.interactHeld && this.lastApply?.onto === near) {
      this.peelT += dt;
      if (this.peelT >= this.peelNeed) { this.peelT = 0; this.undo(); }
    } else this.peelT = Math.max(0, this.peelT - dt * 2);
  }

  take(id?: string): boolean {
    if (this.flying) return false;
    const pid = id ?? this.nearTakeable();
    if (!pid) return false;
    if (this.lastApply && this.lastApply.onto === pid && !this.held) return this.undo();
    const p = this.s.plateById(pid); if (!p || !p.visible) return false;
    const word = p.slotWord; if (!word) return false;
    const link = this.links().find(l => l.src === pid && l.quality === word);
    // Allow taking a designed source quality, or peeling an applied quality back (undo path already handled).
    if (!link && !this.canTakeLoose(pid, word)) return false;
    if (this.held) this.returnTo(this.held.from, this.held.word);
    const opp = OPP[word];
    if (!opp) return false;
    this.setPlate(pid, opp);
    this.held = { word, from: pid };
    this.s.hand = null;
    this.lure?.setCarrying(true);
    this.spawnOrb();
    sfx('swap');
    this.s.evaluate(false);
    return true;
  }

  throwAt(id?: string): boolean {
    if (!this.held || this.flying) return false;
    const word = this.held.word, from = this.held.from;
    const dest = id ?? this.pickDest(word);
    const hx = this.s.x, hy = this.s.y - 50;
    let tx = hx + 40, ty = hy - 20;
    if (dest === 'fern') { tx = FERN.x; ty = FERN.y; }
    else if (dest === 'draft' || dest === 'r_guard') {
      tx = this.s.fight?.real.x ?? 640; ty = (this.s.fight?.real.y ?? 320) - 40;
    } else if (dest && dest.startsWith('en:')) {
      const e = this.s.enemies[+dest.slice(3)];
      if (e) { tx = e.x; ty = e.y - 30; }
    } else if (dest) {
      const p = this.s.plateById(dest);
      if (p) { tx = p.def.sx; ty = p.def.sy; }
    }
    this.flying = true;
    const orb = this.orb as Phaser.GameObjects.Image | undefined;
    if (orb) {
      this.s.tweens.add({
        targets: orb, x: tx, y: ty, duration: 160, ease: 'Quad.easeOut',
        onComplete: () => this.resolveThrow(word, from, dest, tx, ty),
      });
    } else this.resolveThrow(word, from, dest, tx, ty);
    return true;
  }

  undo(): boolean {
    if (this.flying) return false;
    if (this.held) { this.returnTo(this.held.from, this.held.word); this.held = null; this.clearOrb(); this.lure?.setCarrying(false); this.s.evaluate(false); return true; }
    if (!this.lastApply) return false;
    this.revertLast();
    this.s.evaluate(false);
    sfx('swap');
    return true;
  }

  state() {
    return {
      on: this.on, held: this.held, flying: this.flying,
      last: this.lastApply, peelT: this.peelT,
      beat: this.currentLink(),
    };
  }

  private links() { return LINKS[this.s.room.id] ?? []; }

  private currentLink(): Link | null {
    const ls = this.links();
    if (this.held) return ls.find(l => l.quality === this.held!.word) ?? ls.find(l => l.src === this.held!.from) ?? null;
    for (const l of ls) {
      const p = this.s.plateById(l.src);
      const d = this.s.plateById(l.dst);
      if (l.src === 'a_stairs' && !this.s.flags.drained) continue;
      if (p?.visible && p.slotWord === l.quality && d?.slotWord !== l.quality) return l;
    }
    return null;
  }

  private canTakeLoose(id: string, word: string) {
    return this.links().some(l => l.src === id && l.quality === word);
  }

  private nearTakeable(): string | null {
    let best: string | null = null, bd = NEAR;
    for (const l of this.links()) {
      const p = this.s.plateById(l.src);
      if (!p?.visible || p.slotWord !== l.quality) continue;
      if (l.src === 'a_stairs' && !this.s.flags.drained) continue;
      const d = Math.hypot(p.def.sx - this.s.x, p.def.sy - this.s.y);
      if (d < bd) { bd = d; best = l.src; }
    }
    if (!best && this.lastApply) {
      const p = this.s.plateById(this.lastApply.onto);
      if (p && Math.hypot(p.def.sx - this.s.x, p.def.sy - this.s.y) < NEAR) return this.lastApply.onto;
    }
    return best;
  }

  private pickDest(word: string): string | null {
    const sticks = STICKS[word] ?? [];
    const link = this.links().find(l => l.quality === word);
    // Prefer the designed target if in range, else any compatible plate, else a counter-enemy, else miss.
    const cands: { id: string; d: number }[] = [];
    if (link) {
      const p = this.s.plateById(link.dst);
      if (p?.visible) cands.push({ id: link.dst, d: Math.hypot(p.def.sx - this.s.x, p.def.sy - this.s.y) });
    }
    for (const id of sticks) {
      const p = this.s.plateById(id);
      if (!p?.visible) continue;
      if (id === this.held?.from) continue;
      cands.push({ id, d: Math.hypot(p.def.sx - this.s.x, p.def.sy - this.s.y) });
    }
    cands.sort((a, b) => a.d - b.d);
    const near = cands.find(c => c.d < 280);
    if (near) return near.id;
    const kinds = ENEMY_COUNTER[word] ?? [];
    let ed = 280, ei = -1;
    this.s.enemies.forEach((e, i) => {
      if (e.dead) return;
      if (!kinds.includes(e.kind) && !(word === 'WEAK' && e.kind === 'draft')) return;
      const d = Math.hypot(e.x - this.s.x, e.y - this.s.y);
      if (d < ed) { ed = d; ei = i; }
    });
    if (ei >= 0) return kinds.includes('draft') || word === 'WEAK' ? 'draft' : 'en:' + ei;
    // Close to Fern?
    if (this.s.room.id === 'hub' && Math.hypot(this.s.x - FERN.x, this.s.y - FERN.y) < 160) return 'fern';
    return null;
  }

  private resolveThrow(word: string, from: string, dest: string | null, tx: number, ty: number) {
    this.flying = false;
    this.clearOrb();
    this.lure?.setCarrying(false);
    const ok = dest != null && dest !== 'fern' && this.compatible(word, dest);
    if (!ok) {
      this.fx.fire({ tier: 'light', x: tx, y: ty, dir: { x: tx - this.s.x, y: ty - this.s.y } });
      if (dest === 'fern') {
        if (!this.fernSaid) { this.s.say('fern', 'Not me.', 1600); this.fernSaid = true; }
      }
      this.returnTo(from, word);
      this.held = null;
      this.s.evaluate(false);
      sfx('hit');
      return;
    }
    this.fx.fire({ tier: dest === 'draft' || dest === 'r_guard' ? 'heavy' : 'light', x: tx, y: ty, dir: { x: tx - this.s.x, y: ty - this.s.y } });
    this.applyTo(dest!, word, from);
    this.held = null;
    sfx('impact_snap');
    this.s.evaluate(false);
    this.syncLure();
  }

  private compatible(word: string, dest: string) {
    if (dest === 'draft' || dest === 'r_guard') return word === 'WEAK' || word === 'PAPER';
    if (dest.startsWith('en:')) {
      const e = this.s.enemies[+dest.slice(3)];
      return !!e && (ENEMY_COUNTER[word] ?? []).includes(e.kind);
    }
    return (STICKS[word] ?? []).includes(dest);
  }

  private applyTo(dest: string, word: string, from: string) {
    if (dest === 'draft' || dest === 'r_guard') {
      const g = this.s.plateById('r_guard');
      const prev = g?.slotWord ?? 'STRONG';
      if (g) this.setPlate('r_guard', word);
      this.s.fight?.setGuardWord(word);
      this.lastApply = { from, word, onto: 'r_guard', prev };
      return;
    }
    if (dest.startsWith('en:')) {
      const e = this.s.enemies[+dest.slice(3)];
      if (e && !e.dead) {
        if (word === 'DRY' || word === 'APART') { /* flags come from plates if we also mark them */ }
        this.s.hurtEnemy(e, word === 'DRY' || word === 'PAPER' ? 2 : 1, 80, 0);
        this.s.floorText(e.x, e.y - 70, word, '#78E4E8', 13, 700);
      }
      // Spent on an enemy — lastApply stays as a snap-back to the source (undo restores it).
      this.lastApply = { from, word, onto: dest, prev: '' };
      return;
    }
    const p = this.s.plateById(dest); if (!p) { this.returnTo(from, word); return; }
    const prev = p.slotWord ?? '';
    this.setPlate(dest, word);
    this.lastApply = { from, word, onto: dest, prev };
    logSwap(this.s.save, { placed: word, removed: prev, room: this.s.room.id, plate: dest, t: Date.now() });
    if (dest === 'h_door' && word === 'OPEN') this.s.setCheckpoint(p);
  }

  private revertLast() {
    const a = this.lastApply; if (!a) return;
    if (a.onto === 'r_guard') {
      this.setPlate('r_guard', a.prev || 'STRONG');
      this.s.fight?.setGuardWord(a.prev || 'STRONG');
    } else if (!a.onto.startsWith('en:') && a.prev) this.setPlate(a.onto, a.prev);
    this.returnTo(a.from, a.word);
    this.lastApply = null;
  }

  private returnTo(id: string, word: string) {
    const p = this.s.plateById(id); if (!p) return;
    this.setPlate(id, word);
  }

  private setPlate(id: string, word: string) {
    const p = this.s.plateById(id); if (!p || p.def.slot < 0) return;
    p.setSlotWord(word);
    this.s.save.plates[id] = word;
    try { writeSave(this.s.save); } catch { /* */ }
  }

  private makeLure(link: Link) {
    this.lure?.destroy();
    const src = this.pos(link.src), dst = this.pos(link.dst);
    this.lure = new OnboardLure(this.s, src, dst, { nearR: NEAR });
    this.lastLink = link;
    if (this.held) this.lure.setCarrying(true);
  }

  private syncLure() {
    const beat = this.currentLink();
    if (!beat) { this.lure?.destroy(); this.lure = undefined; this.lastLink = null; return; }
    if (!this.lure || this.lastLink?.src !== beat.src || this.lastLink?.dst !== beat.dst) this.makeLure(beat);
    else {
      const s = this.pos(beat.src), d = this.pos(beat.dst);
      this.lure.source.x = s.x; this.lure.source.y = s.y;
      this.lure.target.x = d.x; this.lure.target.y = d.y;
    }
  }

  private pos(id: string) {
    if (id === 'r_guard' || id === 'draft') return { x: this.s.fight?.real.x ?? 640, y: (this.s.fight?.real.y ?? 300) - 30 };
    const p = this.s.plateById(id);
    return { x: p?.def.sx ?? 640, y: p?.def.sy ?? 360 };
  }

  private spawnOrb() {
    this.clearOrb();
    const h = this.handOff();
    const key = this.s.textures.exists('fx_spark_orb_0') ? 'fx_spark_orb_0' : (this.s.textures.exists('fx_spark_core') ? 'fx_spark_core' : '');
    if (key) {
      const im = this.s.add.sprite(this.s.x + h.x, this.s.y + h.y, key).setDepth(7100).setScale(1.2).setBlendMode(Phaser.BlendModes.ADD);
      this.s.objs.push(im); this.orb = im;
    } else {
      const g = this.s.add.ellipse(this.s.x + h.x, this.s.y + h.y, 18, 18, 0x7ec8e3, 0.9).setDepth(7100).setBlendMode(Phaser.BlendModes.ADD);
      this.s.objs.push(g); this.orb = g;
    }
  }

  private clearOrb() { try { this.orb?.destroy(); } catch { /* */ } this.orb = undefined; }
  private handOff() {
    const d = this.s.dir;
    if (d.includes('W')) return { x: -22, y: -52 };
    if (d.includes('E')) return { x: 22, y: -52 };
    return { x: -16, y: -56 };
  }

  private suppressWordUi(on: boolean) {
    const s = this.s;
    try {
      s.hud.hand.setVisible(!on);
      s.words.chipG.setVisible(false);
      s.words.heading.setVisible(false);
      s.words.pil.setVisible(false);
      if (on) { s.hand = null; s.words.codeOn = false; s.words.codeA = 0; s.words.held = 0; s.words.clearCode?.(); }
    } catch { /* */ }
  }
}
