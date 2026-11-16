// Office lookables for Level 1: tap E to look, optional peel of LOUD / HOT, a creepy printer.
// Works during the dead-lift beat (word UI is off). Lore follows docs/story; no echo twist.
import Phaser from 'phaser';
import type { GameScene } from './game';
import type { Frame } from './controls';
import { sfx, getAudioContext, outNode } from './sfx';
import tokens from './tokens.json';

const C = tokens.color;
const UI = 'IBM Plex Mono';

export interface ExploreSpot {
  id: 'photo' | 'calendar' | 'board' | 'phones' | 'coffee' | 'printer';
  x: number;
  y: number;
  r: number;
  label: string;
  steal?: 'LOUD' | 'HOT';
}

const SPOTS: ExploreSpot[] = [
  { id: 'photo', x: 250, y: 575, r: 70, label: 'LOOK' },
  { id: 'calendar', x: 318, y: 128, r: 100, label: 'LOOK' },
  { id: 'board', x: 700, y: 130, r: 100, label: 'LOOK' },
  { id: 'phones', x: 696, y: 280, r: 70, label: 'LOOK', steal: 'LOUD' },
  { id: 'coffee', x: 340, y: 200, r: 45, label: 'LOOK', steal: 'HOT' },
  { id: 'printer', x: 120, y: 220, r: 80, label: 'LOOK' },
];

export class OfficeExplore {
  looked: Record<string, boolean> = {};
  printerFired = false;
  carrying: 'LOUD' | 'HOT' | null = null;
  private prompt?: Phaser.GameObjects.Text;
  private promptRing?: Phaser.GameObjects.Graphics;
  private boardGfx?: Phaser.GameObjects.Container;
  private letter?: Phaser.GameObjects.Container;
  private handChip?: Phaser.GameObjects.Text;
  private flying?: Phaser.GameObjects.Text;
  private flyT = 0;
  private flyFrom = { x: 0, y: 0 };
  private flyTo = { x: 0, y: 0 };
  private flyWord: 'LOUD' | 'HOT' | null = null;
  private nearPhones = false;
  private phonesGain?: GainNode;
  private phonesOsc: OscillatorNode[] = [];
  private peelT = 0;
  private wasHeld = false;
  private destroyed = false;
  private keyF?: Phaser.Input.Keyboard.Key;

  constructor(private s: GameScene) {
    this.drawBoardMarks();
    this.prompt = s.add.text(0, 0, 'E  look', {
      fontFamily: UI, fontSize: '12px', fontStyle: '700', color: '#e8fcfc',
      stroke: '#041018', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(9002).setAlpha(0);
    this.promptRing = s.add.graphics().setDepth(9002).setAlpha(0);
    s.objs.push(this.prompt, this.promptRing);
    this.keyF = s.input.keyboard?.addKey('F');
  }

  state() {
    return { looked: Object.keys(this.looked).filter(k => this.looked[k]), carrying: this.carrying, printer: this.printerFired };
  }

  /** True when a lookable should keep E away from the lift panel / lamp. */
  claimingE() {
    if (this.destroyed || this.carrying) return false;
    return !!this.nearest(this.s.x, this.s.y);
  }

  update(dt: number, f: Frame | null) {
    if (this.destroyed || this.s.busy || this.s.room?.id !== 'office') return;
    const x = this.s.x, y = this.s.y;
    const spot = this.nearest(x, y);
    const blocked = this.blockedByLab(spot);

    if (!this.printerFired && Math.hypot(x - 120, y - 220) < 150) this.firePrinter();

    const useSpot = blocked ? undefined : spot;
    this.updatePrompt(useSpot, blocked);
    const lab = this.s.impactLab;
    if (lab?.lure && !lab.carrying && !lab.state().draining) lab.lure.hidden = !!useSpot || !!this.s.nearLostLine();
    this.tickPhones(dt, Math.hypot(x - 696, y - 280) < 140);
    this.tickCarry(dt, f, useSpot, blocked);
    this.tickFlight(dt);
  }

  tryTap(): boolean {
    if (this.s.busy || this.carrying) return false;
    const lab = this.s.impactLab;
    if (lab && (lab.state().draining || lab.carrying || lab.flying)) return false;
    const spot = this.nearest(this.s.x, this.s.y);
    if (!spot || this.blockedByLab(spot)) return false;
    this.look(spot);
    return true;
  }

  destroy() {
    this.destroyed = true;
    this.stopPhones();
    this.prompt?.destroy(); this.promptRing?.destroy();
    this.boardGfx?.destroy(); this.letter?.destroy();
    this.handChip?.destroy(); this.flying?.destroy();
  }

  /** Panel/lamp win only when they are as close or closer than the lookable. */
  private blockedByLab(spot?: ExploreSpot) {
    const lab = this.s.impactLab;
    if (!lab || lab.done) return false;
    if (lab.carrying || lab.state().draining) return true;
    const x = this.s.x, y = this.s.y;
    // A lookable in its own radius always wins, even if the panel lure also overlaps.
    if (spot) return false;
    if (!lab.lampReady) {
      const d = Math.hypot(x - lab.panelPos.x, y - lab.panelPos.y);
      if (d < 130) return true;
    } else if (lab.lampAlive && !lab.carrying) {
      const d = Math.hypot(x - lab.lampPos.x, y - lab.lampPos.y);
      if (d < 130) return true;
    }
    return false;
  }

  private nearest(x: number, y: number) {
    let best: ExploreSpot | undefined, bd = 9999;
    for (const s of SPOTS) {
      const d = Math.hypot(x - s.x, y - s.y);
      if (d < s.r && d < bd) { best = s; bd = d; }
    }
    return best;
  }

  private updatePrompt(spot: ExploreSpot | undefined, blocked: boolean) {
    const p = this.prompt, g = this.promptRing;
    if (!p || !g) return;
    if (!spot || blocked) { p.setAlpha(0); g.setAlpha(0); return; }
    const stealReady = !!(spot.steal && this.looked[spot.id] && !this.carrying);
    p.setText(stealReady ? `HOLD E  take ${spot.steal}` : 'E  look');
    p.setPosition(spot.x, spot.y - 42).setAlpha(0.9 + 0.1 * Math.sin(this.s.t * 5));
    g.clear().setAlpha(1);
    g.lineStyle(2, 0x5ee8e0, 0.45);
    g.strokeCircle(spot.x, spot.y - 56, 16);
    if (stealReady && this.peelT > 0) {
      g.lineStyle(3, 0xe8fcfc, 0.95);
      g.beginPath();
      g.arc(spot.x, spot.y - 56, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.peelT / 0.4), false);
      g.strokePath();
    }
  }

  private look(spot: ExploreSpot) {
    this.looked[spot.id] = true;
    try { sfx('ui'); } catch { /* */ }
    const say = (who: 'noor' | 'fern', line: string, ms = 2400) => {
      try { this.s.say(who, line, ms); } catch { /* */ }
    };
    if (spot.id === 'photo') {
      say('noor', "Papa. I keep meaning to put this back on my desk.", 2400);
      say('fern', "He looks proud. Something is wrong, that it has to sit face down.", 2800);
    } else if (spot.id === 'calendar') {
      say('noor', "August. We never flipped it.", 2000);
      say('fern', "Don't flip it. August is heavy enough. Look. That's when the fire happened.", 3200);
    } else if (spot.id === 'board') {
      say('noor', "Four four seven one. That's his claim.", 2400);
      say('fern', "They wrote it up like it was any other number. Something is wrong with that circle.", 3000);
    } else if (spot.id === 'phones') {
      say('noor', "Kabir never takes these home.", 2000);
      say('fern', "They're still playing something. I can hear it from the pot.", 2600);
    } else if (spot.id === 'coffee') {
      say('noor', "Still warm. Who made this?", 2000);
      say('fern', "Not me. I don't have hands. I have opinions about temperature.", 2800);
    } else if (spot.id === 'printer') {
      say('noor', this.printerFired ? "I didn't send that again." : "It's been quiet all night.", 2200);
      say('fern', this.printerFired ? "The building is finishing your sentences. That's not supposed to happen." : "Don't stand too close. It has a habit of starting itself.", 3000);
    }
  }

  private tickCarry(dt: number, f: Frame | null, spot: ExploreSpot | undefined, blocked: boolean) {
    if (this.carrying) {
      const h = this.s.dir?.includes('E') ? 22 : -22;
      if (!this.handChip) {
        this.handChip = this.s.add.text(0, 0, this.carrying, {
          fontFamily: 'JetBrains Mono', fontSize: '16px', fontStyle: 'bold', color: C.lamp,
          stroke: '#041018', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(9003);
        this.s.objs.push(this.handChip);
      }
      this.handChip.setText(this.carrying).setPosition(this.s.x + h, this.s.y - 28).setDepth(this.s.y + 28).setVisible(true);
      if (this.keyF && Phaser.Input.Keyboard.JustDown(this.keyF)) this.throwCarried();
      this.peelT = 0;
      this.wasHeld = false;
      return;
    }
    this.handChip?.setVisible(false);
    const canSteal = !blocked && spot?.steal && this.looked[spot.id];
    const held = !!(f && f.interactHeld && canSteal);
    if (held) {
      this.peelT += dt;
      if (this.peelT >= 0.4 && spot?.steal) this.takeWord(spot.steal);
    } else {
      this.peelT = Math.max(0, this.peelT - dt * 2);
    }
    this.wasHeld = held;
  }

  private takeWord(word: 'LOUD' | 'HOT') {
    if (this.carrying) return;
    this.carrying = word;
    this.peelT = 0;
    try { sfx('crackle'); } catch { /* */ }
    try { this.s.say('noor', word === 'LOUD' ? 'The sound came off in my hand.' : 'Warm. Like the word itself.', 1800, { box: false }); } catch { /* */ }
    if (word === 'LOUD') this.stopPhones();
  }

  private throwCarried() {
    if (!this.carrying || this.flying) return;
    const word = this.carrying;
    this.carrying = null;
    this.handChip?.setVisible(false);
    const from = { x: this.s.x, y: this.s.y - 28 };
    const to = word === 'LOUD' ? { x: 1140, y: 330 } : { x: 77, y: 180 };
    // LOUD at the east pod monitor; HOT at the west plant.
    this.flyFrom = from; this.flyTo = to; this.flyT = 0; this.flyWord = word;
    this.flying = this.s.add.text(from.x, from.y, word, {
      fontFamily: 'JetBrains Mono', fontSize: '18px', fontStyle: 'bold', color: C.lamp,
      stroke: '#041018', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(8000);
    this.s.objs.push(this.flying);
    try { sfx('throw'); } catch { /* */ }
  }

  private tickFlight(dt: number) {
    if (!this.flying || !this.flyWord) return;
    this.flyT += dt;
    const u = Math.min(1, this.flyT / 0.28);
    const x = this.flyFrom.x + (this.flyTo.x - this.flyFrom.x) * u;
    const y = this.flyFrom.y + (this.flyTo.y - this.flyFrom.y) * u - Math.sin(u * Math.PI) * 30;
    this.flying.setPosition(x, y);
    if (u < 1) return;
    const word = this.flyWord;
    this.flying.destroy(); this.flying = undefined; this.flyWord = null;
    try { sfx('impact_snap'); } catch { /* */ }
    if (word === 'LOUD') {
      try { this.s.cameras.main.shake(140, 0.008); } catch { /* */ }
      const pulse = this.s.add.ellipse(this.flyTo.x, this.flyTo.y, 20, 14, 0x7ad4d8, 0.5).setDepth(6000).setBlendMode(Phaser.BlendModes.ADD);
      this.s.objs.push(pulse);
      this.s.tweens.add({ targets: pulse, scale: 6, alpha: 0, duration: 420, onComplete: () => pulse.destroy() });
      try { this.s.say('fern', "That's one way to get a screen's attention.", 2400); } catch { /* */ }
    } else {
      const steam = this.s.add.ellipse(this.flyTo.x, this.flyTo.y - 10, 16, 22, 0xffe0b0, 0.5).setDepth(6000).setBlendMode(Phaser.BlendModes.ADD);
      this.s.objs.push(steam);
      this.s.tweens.add({ targets: steam, y: steam.y - 28, alpha: 0, scale: 1.8, duration: 600, onComplete: () => steam.destroy() });
      try { this.s.say('fern', "Careful. Hot and leaves are a love story with an ending.", 2600); } catch { /* */ }
    }
  }

  private firePrinter() {
    if (this.printerFired) return;
    this.printerFired = true;
    try { sfx('impact_hum'); } catch { /* */ }
    try { sfx('ui'); } catch { /* */ }
    const c = this.s.add.container(150, 230).setDepth(260);
    const page = this.s.add.rectangle(0, 0, 36, 46, 0xf4efe4, 1).setStrokeStyle(1, 0xc8c0b4, 1);
    const t1 = this.s.add.text(0, -8, 'CLAIM #4471', { fontFamily: UI, fontSize: '6px', color: '#1a1a18' }).setOrigin(0.5);
    const t2 = this.s.add.text(0, 6, 'DENIED', { fontFamily: UI, fontSize: '8px', fontStyle: '700', color: '#a03030' }).setOrigin(0.5);
    c.add([page, t1, t2]);
    this.s.objs.push(c);
    this.letter = c;
    c.y = 210; c.setAlpha(0);
    this.s.tweens.add({ targets: c, y: 248, alpha: 1, duration: 700, ease: 'Quad.easeOut' });
  }

  private drawBoardMarks() {
    const c = this.s.add.container(700, 118).setDepth(175);
    const nums = [
      { t: '#4412', x: -48, y: -8 },
      { t: '#4471', x: 8, y: 6 },
      { t: '#4502', x: 52, y: -12 },
    ];
    for (const n of nums) {
      const t = this.s.add.text(n.x, n.y, n.t, {
        fontFamily: UI, fontSize: '9px', fontStyle: n.t === '#4471' ? '700' : '500', color: n.t === '#4471' ? '#1a1a18' : '#3a3a38',
      }).setOrigin(0.5);
      c.add(t);
    }
    const ring = this.s.add.ellipse(8, 6, 38, 18).setStrokeStyle(1.6, 0xb43030, 0.95).setFillStyle(0xb43030, 0);
    c.add(ring);
    this.boardGfx = c;
    this.s.objs.push(c);
  }

  private tickPhones(dt: number, near: boolean) {
    void dt;
    if (this.carrying === 'LOUD') { this.stopPhones(); this.nearPhones = false; return; }
    if (near && !this.nearPhones) { this.nearPhones = true; this.startPhones(); }
    if (!near && this.nearPhones) { this.nearPhones = false; this.stopPhones(); }
  }

  private startPhones() {
    if (this.phonesGain) return;
    try {
      const ctx = getAudioContext();
      const out = outNode();
      if (!ctx || !out) return;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      g.connect(out);
      const notes = [220, 277, 330];
      for (let i = 0; i < notes.length; i++) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = notes[i];
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 800;
        const lg = ctx.createGain();
        lg.gain.value = 0.12;
        o.connect(filt); filt.connect(lg); lg.connect(g);
        o.start();
        this.phonesOsc.push(o);
      }
      g.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.3);
      this.phonesGain = g;
    } catch { /* */ }
  }

  private stopPhones() {
    try {
      const ctx = getAudioContext();
      if (ctx && this.phonesGain) {
        this.phonesGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      }
    } catch { /* */ }
    const osc = this.phonesOsc.splice(0);
    const g = this.phonesGain;
    this.phonesGain = undefined;
    setTimeout(() => {
      for (const o of osc) { try { o.stop(); o.disconnect(); } catch { /* */ } }
      try { g?.disconnect(); } catch { /* */ }
    }, 260);
  }
}
