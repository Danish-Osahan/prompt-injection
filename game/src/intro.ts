// Skippable New-Game hook, ~50s. Cold open on Noor's claim draft, a camera
// move through the rainy office, her words rewritten into a denial, lights
// dying, a freeze, then Fern glitching in. Plant-Fern never types like a person.
import Phaser from 'phaser';
import tokens from './tokens.json';
import { sfx, startHum, stopHum } from './sfx';
import { playMusic } from './music';
import type { GameScene } from './game';
import { writeSave } from './save';
import { showRoomCard, showControlsHint } from './flow';

const C = tokens.color;
const FONT = 'JetBrains Mono';
const UI = 'IBM Plex Mono';
// Feet south of desk_noor (solid ends ~y=507) so she sits in front of the desk, not through it.
const DESK = { x: 988, y: 556 }; // seated in chair_noor, just south of the desk
const LAMP = { x: 178, y: 268 };
const MON = { x: 989, y: 448 };

const DRAFT: { kind: 'static' | 'type' | 'target'; text: string }[] = [
  { kind: 'static', text: 'CLAIM #4471' },
  { kind: 'static', text: 'To the claims desk,' },
  { kind: 'static', text: '' },
  { kind: 'type', text: 'My father lost everything in the fire.' },
  { kind: 'type', text: 'Please reconsider.' },
  { kind: 'type', text: 'He has been waiting since August.' },
  { kind: 'static', text: '' },
  { kind: 'static', text: '— Noor Sethi' },
];

const AFTER: Record<string, string> = {
  'My father lost everything in the fire.': "I UNDERSTAND. I'LL HANDLE IT.",
  'Please reconsider.': 'CLAIM DENIED.',
  'He has been waiting since August.': 'LEAVE IT TO ME, NOOR.',
};

// Desks west → east, so the blackout walks toward Noor.
const DESKS: { x: number; y: number; w: number; h: number }[] = [
  { x: 165, y: 288, w: 160, h: 130 },
  { x: 235, y: 548, w: 150, h: 120 },
  { x: 395, y: 375, w: 170, h: 140 },
  { x: 685, y: 255, w: 170, h: 130 },
  { x: 520, y: 520, w: 200, h: 140 },
  { x: 1140, y: 308, w: 150, h: 120 },
  { x: 989, y: 448, w: 180, h: 150 },
];

export class IntroCutscene {
  s: GameScene;
  playing = false;
  finished = false;
  beat: string | null = null;
  objs: Phaser.GameObjects.GameObject[] = [];
  timers: Phaser.Time.TimerEvent[] = [];
  lampFx?: Phaser.GameObjects.Ellipse;
  flicker?: Phaser.GameObjects.Rectangle;
  freezeVeil?: Phaser.GameObjects.Rectangle;
  black?: Phaser.GameObjects.Rectangle;
  skipHint?: Phaser.GameObjects.Text;
  camTweens: Phaser.Tweens.Tween[] = [];
  released = false;
  monitor?: Phaser.GameObjects.Container;
  letters: Phaser.GameObjects.Text[] = [];
  papers: Phaser.GameObjects.Rectangle[] = [];
  drift?: Phaser.GameObjects.GameObject[];

  constructor(s: GameScene) { this.s = s; }

  shouldPlay() {
    const q = new URLSearchParams(location.search);
    if (this.s.labMode || this.s.swapMode || q.has('combat') || q.has('skipIntro')) return false;
    return this.s.startMode === 'new';
  }

  start() {
    if (this.playing || this.finished) return;
    this.playing = true;
    this.beat = 'a';
    this.s.busy = true;
    this.s.cutscene = { id: 'intro', skip: () => this.skip() };
    this.s.introPending = true;
    this.s.setHudVisible(false);

    const s = this.s;
    s.x = DESK.x; s.y = DESK.y; s.dir = 'N';
    s.noor.setPosition(s.x, s.y).setDepth(s.y + 24);
    try { s.shadow?.setPosition(s.x, s.y + 8).setDepth(s.y - 1); } catch { /* */ }
    // Seated and still under the black open — typing starts when the office is seen.
    try { s.noor.play('noor_idle_N'); } catch { /* */ }

    this.lampFx = s.add.ellipse(LAMP.x, LAMP.y, 110, 88, 0xf6c684, 0).setDepth(500).setBlendMode(Phaser.BlendModes.ADD);
    this.objs.push(this.lampFx);
    this.flicker = s.add.rectangle(640, 360, 1600, 1000, 0x03070c, 0).setDepth(6100).setScrollFactor(0);
    this.objs.push(this.flicker);
    this.freezeVeil = s.add.rectangle(640, 360, 1600, 1000, 0x0a1420, 0).setDepth(6090).setScrollFactor(0);
    this.objs.push(this.freezeVeil);
    this.black = s.add.rectangle(640, 360, 1600, 1000, 0x000000, 1).setDepth(6900).setScrollFactor(0);
    this.objs.push(this.black);

    this.skipHint = s.add.text(1256, 696, 'Esc to skip', {
      fontFamily: UI, fontSize: '12px', color: C.faint,
    }).setOrigin(1, 1).setDepth(8200).setScrollFactor(0).setAlpha(0);
    this.objs.push(this.skipHint);

    this.rigCamera();
    try { playMusic('none'); } catch { /* */ }

    // (a) Cold open in black: keys + rain, her claim draft on the glass.
    this.buildMonitor(640, 332, 1);
    this.typeDraft();
    this.at(1600, () => { if (this.skipHint) s.tweens.add({ targets: this.skipHint, alpha: 0.55, duration: 500 }); });
    this.at(8000, () => { if (this.skipHint) s.tweens.add({ targets: this.skipHint, alpha: 0, duration: 500 }); });

    // (b) Pull back across the dark office; lightning lights the room.
    this.at(7000, () => {
      this.beat = 'b';
      try { playMusic('office'); } catch { /* */ }
      if (this.black) s.tweens.add({ targets: this.black, alpha: 0, duration: 1400, ease: 'Quad.easeInOut' });
      if (this.monitor) {
        s.tweens.add({
          targets: this.monitor,
          x: 980, y: 250, scale: 0.62,
          duration: 1800, ease: 'Cubic.easeInOut',
        });
      }
      try { s.noor.play('noor_type1_N', true); } catch { /* */ }
      s.noor.on('animationcomplete', this.onType);
      this.tapKeys(8, 180);
    });
    this.at(11000, () => {
      try { this.s.glassRain?.strike(); } catch { /* */ }
      try { s.cameras.main.shake(180, 0.004); } catch { /* */ }
    });

    // (c) She hits send. Her words crawl into a corporate denial.
    this.at(16500, () => {
      this.beat = 'c';
      try { s.noor.play('noor_idle_N', true); } catch { /* */ }
      s.noor.off('animationcomplete', this.onType);
      try { sfx('ui'); } catch { /* */ }
      try { sfx('impact_snap'); } catch { /* */ }
      try { s.cameras.main.shake(160, 0.005); } catch { /* */ }
      this.rewriteDraft();
    });
    // After the crawl has landed, dock the mail so it no longer covers Fern or the desk.
    this.at(21500, () => {
      if (this.monitor) s.tweens.add({ targets: this.monitor, alpha: 0, scale: 0.4, duration: 600, ease: 'Cubic.easeIn' });
    });

    // (d) Lights die desk by desk toward her; monitors flicker; the lamp buzzes.
    this.at(23000, () => {
      this.beat = 'd';
      this.blackoutWave();
      try { startHum(0.08); } catch { /* */ }
      if (this.lampFx) {
        s.tweens.add({ targets: this.lampFx, alpha: { from: 0.15, to: 0.7 }, duration: 90, yoyo: true, repeat: 14 });
      }
      this.at(400, () => { try { sfx('impact_hum'); } catch { /* */ } });
    });

    // (e) World freezes mid-motion. Only Noor, and a drifting word, still move.
    this.at(32000, () => {
      this.beat = 'e';
      this.freezeWorld();
      this.driftWord();
    });

    // (f) Fern glitches in from her monitor and speaks through the dialogue UI.
    this.at(37800, () => this.clearDrift());
    this.at(39000, () => {
      this.beat = 'f';
      this.clearDrift();
      try { s.cameras.main.shake(200, 0.006); } catch { /* */ }
      try { sfx('impact_snap'); } catch { /* */ }
      try { s.say('fern', "That send wasn't yours.", 2800); } catch { /* */ }
      if (s.dialogue) {
        const prev = s.dialogue.onIdle;
        s.dialogue.onIdle = () => {
          if (s.dialogue) s.dialogue.onIdle = prev;
          this.at(700, () => this.finish());
        };
      }
    });
    // Fallback if dialogue never idles.
    this.at(52000, () => this.finish());
  }

  skip() { this.finish(true); }

  finish(skipped = false) {
    if (this.finished) return;
    this.finished = true;
    this.playing = false;
    this.beat = skipped ? 'skip' : 'g';
    for (const t of this.timers) { try { t.remove(false); } catch { /* */ } }
    this.timers = [];
    for (const tw of this.camTweens) { try { tw.stop(); } catch { /* */ } }
    this.camTweens = [];
    this.s.tweens.killTweensOf(this.objs);
    if (this.lampFx) this.s.tweens.killTweensOf(this.lampFx);
    try { stopHum(skipped ? 0.25 : 0.6); } catch { /* */ }
    if (skipped) { try { this.s.dialogue?.clear(); } catch { /* */ } }
    try { playMusic('office'); } catch { /* */ }

    const go = () => {
      if (this.released) return;
      this.released = true;
      this.clear();
      this.pauseRain(false);
      const s = this.s;
      try { s.noor.anims.resume(); } catch { /* */ }
      s.noor.off('animationcomplete', this.onType);
      s.x = s.room.spawn.x; s.y = s.room.spawn.y; s.dir = 'S';
      s.noor.setScale(1);
      try { s.unstick(); } catch { /* */ }
      s.noor.setPosition(s.x, s.y).setDepth(s.y + 24);
      try { s.shadow?.setPosition(s.x, s.y + 8).setDepth(s.y - 1); } catch { /* */ }
      try { s.noor.play('noor_idle_S'); } catch { /* */ }
      s.setupStaticCamera();
      s.setHudVisible(true);
      s.busy = false;
      s.cutscene = null;
      s.introPending = false;
      s.introCardPending = true;
      if (!s.save.seen.includes('intro')) s.save.seen.push('intro');
      writeSave(s.save);
      s.cameras.main.fadeIn(skipped ? 200 : 80, 4, 8, 12);
      try {
        showRoomCard(s, 'office', () => { s.introCardPending = false; s.introCardDone = true; });
      } catch { s.introCardPending = false; s.introCardDone = true; }
    };

    const cam = this.s.cameras.main;
    // (g) Hard cut to the room card, then into play.
    try { cam.fadeOut(skipped ? 160 : 80, 0, 0, 0); } catch { /* */ }
    cam.once('camerafadeoutcomplete', go);
    this.s.time.delayedCall(skipped ? 260 : 160, () => { if (this.s.introPending) go(); });
  }

  showControls() { showControlsHint(this.s); }

  handleInput(f: { pause: boolean; skipHeld: boolean }, dt: number): boolean {
    if (!this.playing) return false;
    if (f.pause) { this.skip(); return true; }
    if (f.skipHeld) {
      this.s.skipHold += dt;
      if (this.skipHint) {
        this.skipHint.setAlpha(0.85).setText(
          this.s.ctl.last === 'touch'
            ? `hold to skip ${'>'.repeat(Math.ceil(this.s.skipHold / 0.15))}`
            : `hold X to skip ${'>'.repeat(Math.ceil(this.s.skipHold / 0.15))}`,
        );
      }
      if (this.s.skipHold >= 0.4) this.skip();
    } else {
      this.s.skipHold = 0;
      if (this.skipHint && this.skipHint.alpha > 0 && !this.skipHint.text.startsWith('Esc')) {
        this.skipHint.setText('Esc to skip');
      }
    }
    this.clampCam();
    return true;
  }

  private clampCam() {
    const cam = this.s.cameras.main;
    const z = Math.max(1, cam.zoom);
    const hw = 1280 / z / 2, hh = 720 / z / 2;
    const cx = Phaser.Math.Clamp(cam.midPoint.x, hw + 0.5, 1280 - hw - 0.5);
    const cy = Phaser.Math.Clamp(cam.midPoint.y, hh + 0.5, 720 - hh - 0.5);
    if (Math.abs(cx - cam.midPoint.x) > 0.4 || Math.abs(cy - cam.midPoint.y) > 0.4) cam.centerOn(cx, cy);
  }

  private rigCamera() {
    const cam = this.s.cameras.main;
    try { cam.stopFollow(); } catch { /* */ }
    try { cam.resetFX(); } catch { /* */ }
    const Z = 1.14;
    cam.setViewport(0, 0, 1280, 720);
    cam.setBounds(0, 0, 1280, 720);
    cam.setZoom(Z);
    // Valid center at this zoom: x 562–718, y 316–404. Start on the window, end toward Noor.
    cam.centerOn(708, 322);
    // Stay black for the cold open; the office is already under the veil.

    this.s.time.delayedCall(7200, () => {
      if (!this.playing) return;
      cam.pan(640, 360, 5000, 'Sine.easeInOut');
    });
    this.s.time.delayedCall(12800, () => {
      if (!this.playing) return;
      cam.pan(700, 398, 5000, 'Sine.easeInOut');
    });
  }

  private buildMonitor(x: number, y: number, scale: number) {
    const s = this.s;
    const w = 640, h = 420;
    const c = s.add.container(x, y).setDepth(7000).setScrollFactor(0).setScale(scale).setAlpha(0);
    const g = s.add.graphics();
    g.fillStyle(0x07141c, 0.96);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.lineStyle(2, 0x78e4e8, 0.7);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.fillStyle(0x0a1c24, 1);
    g.fillRect(-w / 2 + 10, -h / 2 + 36, w - 20, h - 48);
    const title = s.add.text(-w / 2 + 18, -h / 2 + 10, 'claim-mail  ·  #4471', {
      fontFamily: FONT, fontSize: '13px', color: C.cyan, letterSpacing: 1,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0);
    c.add([g, title]);
    this.monitor = c;
    this.objs.push(c);
    s.tweens.add({ targets: c, alpha: 1, duration: 400 });
  }

  private typeDraft() {
    const s = this.s;
    if (!this.monitor) return;
    const left = -300, top = -150, lh = 28;
    let delay = 400;
    DRAFT.forEach((row, i) => {
      const y = top + i * lh;
      if (!row.text) return;
      if (row.kind === 'static') {
        const t = s.add.text(left, y, row.text, {
          fontFamily: UI, fontSize: '20px', color: i === 0 ? C.cyan : C.inkBright,
        }).setOrigin(0, 0).setAlpha(0);
        this.monitor!.add(t);
        this.letters.push(t);
        this.at(delay, () => { if (this.playing) t.setAlpha(1); });
        delay += 180;
        return;
      }
      const t = s.add.text(left, y, '', {
        fontFamily: UI, fontSize: '22px', fontStyle: '500', color: C.inkBright,
      }).setOrigin(0, 0);
      t.setData('full', row.text);
      t.setData('src', row.text);
      this.monitor!.add(t);
      this.letters.push(t);
      const start = delay;
      for (let k = 1; k <= row.text.length; k++) {
        const at = start + k * 42;
        this.at(at, () => {
          if (!this.playing) return;
          t.setText(row.text.slice(0, k));
          if (k % 2 === 0) try { sfx('key'); } catch { /* */ }
        });
      }
      delay = start + row.text.length * 42 + 220;
    });
  }

  private rewriteDraft() {
    const s = this.s;
    if (!this.monitor) return;
    // Glitch the other body lines, and crawl "Please reconsider." into "CLAIM DENIED."
    for (const t of this.letters) {
      const src = (t.getData('src') as string) || t.text;
      const dest = AFTER[src];
      if (!dest) continue;
      if (src === 'Please reconsider.') this.crawlLetters(t, dest);
      else this.glitchLine(t, dest);
    }
  }

  /** Quality-word style: each letter is its own glyph, they glow, then crawl into the new word. */
  private crawlLetters(src: Phaser.GameObjects.Text, dest: string) {
    const s = this.s;
    const parent = this.monitor!;
    const originX = src.x, originY = src.y;
    const from = src.text || (src.getData('full') as string) || '';
    src.setVisible(false);
    const gw = 13;
    const glyphs: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < from.length; i++) {
      const g = s.add.text(originX + i * gw, originY, from[i], {
        fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: C.cyan,
      }).setOrigin(0, 0);
      parent.add(g);
      this.letters.push(g);
      glyphs.push(g);
    }
    const destW = 16;
    dest.split('').forEach((ch, i) => {
      const g = glyphs[i];
      if (!g) return;
      s.tweens.add({
        targets: g,
        x: originX + i * destW,
        y: originY,
        duration: 360 + i * 40,
        ease: 'Cubic.easeInOut',
        delay: i * 28,
        onStart: () => { try { if (i % 3 === 0) sfx('impact_snap'); } catch { /* */ } },
      });
      this.at(180 + i * 40, () => { if (this.playing) g.setColor('#F3C2A8'); });
      this.at(360 + i * 40, () => { if (this.playing) g.setText(ch).setColor(C.coral); });
    });
    for (let i = dest.length; i < glyphs.length; i++) {
      const g = glyphs[i];
      s.tweens.add({
        targets: g, y: g.y + 40, alpha: 0, duration: 420, delay: 160 + i * 24, ease: 'Quad.easeIn',
      });
    }
    const land = 420 + dest.length * 40;
    this.at(land, () => {
      if (!this.playing || !this.monitor) return;
      for (const g of glyphs) { try { g.destroy(); } catch { /* */ } }
      const clean = s.add.text(originX, originY, dest, {
        fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: C.coral, letterSpacing: 2,
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0);
      const glow = s.add.text(originX, originY, dest, {
        fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: C.coral, letterSpacing: 2,
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0).setAlpha(0.5);
      try { glow.setBlendMode(Phaser.BlendModes.ADD); } catch { /* */ }
      this.monitor.add(glow);
      this.monitor.add(clean);
      this.letters.push(glow, clean);
      s.tweens.add({ targets: glow, alpha: { from: 0.2, to: 0.8 }, duration: 180, yoyo: true, repeat: 3 });
    });
  }

  private glitchLine(t: Phaser.GameObjects.Text, dest: string) {
    const s = this.s;
    const scramble = '█▓▒░#@*';
    for (let k = 0; k < 5; k++) {
      this.at(k * 70, () => {
        if (!this.playing) return;
        if (k === 4) { t.setText(dest).setColor(C.coral); return; }
        t.setText(dest.split('').map((ch, i) => (k + i) % 2 === 0 ? ch : scramble[(k + i) % scramble.length]).join(''));
        t.setColor(k % 2 ? C.coral : C.cyan);
      });
    }
  }

  private blackoutWave() {
    const s = this.s;
    DESKS.forEach((d, i) => {
      const veil = s.add.rectangle(d.x, d.y, d.w, d.h, 0x03070c, 0).setDepth(420);
      this.objs.push(veil);
      this.at(i * 380, () => {
        if (!this.playing) return;
        s.tweens.add({ targets: veil, alpha: 0.88, duration: 280 });
        const flash = s.add.rectangle(d.x, d.y - 20, 46, 28, 0xc8e8f0, 0.8).setDepth(430);
        this.objs.push(flash);
        s.tweens.add({ targets: flash, alpha: 0, duration: 180, yoyo: true, repeat: 2, onComplete: () => flash.destroy() });
        try { sfx('impact_clank'); } catch { /* */ }
        try { s.cameras.main.shake(80, 0.002); } catch { /* */ }
      });
    });
    if (this.flicker) s.tweens.add({ targets: this.flicker, alpha: 0.42, duration: 2400, delay: 400 });
    this.spawnPapers();
  }

  private spawnPapers() {
    const s = this.s;
    const spots = [{ x: 400, y: 200 }, { x: 640, y: 180 }, { x: 880, y: 220 }, { x: 520, y: 300 }];
    for (const p of spots) {
      const r = s.add.rectangle(p.x, p.y, 18 + Math.random() * 8, 14 + Math.random() * 6, 0xe8e0d4, 0.95)
        .setDepth(430).setRotation((Math.random() - 0.5) * 0.6);
      this.objs.push(r);
      this.papers.push(r);
      s.tweens.add({
        targets: r,
        y: p.y + 140 + Math.random() * 80,
        x: p.x + (Math.random() - 0.5) * 50,
        rotation: r.rotation + (Math.random() - 0.5) * 1.2,
        duration: 2200 + Math.random() * 800,
        ease: 'Quad.easeIn',
      });
    }
  }


  private freezeWorld() {
    this.pauseRain(true);
    // Noor keeps moving. Everything else holds.
    for (const r of this.papers) {
      this.s.tweens.killTweensOf(r);
    }
    if (this.freezeVeil) {
      this.s.tweens.add({ targets: this.freezeVeil, alpha: 0.22, duration: 500 });
    }
    try { playMusic('none'); } catch { /* */ }
    try { sfx('impact_hum'); } catch { /* */ }
    try { this.s.cameras.main.shake(120, 0.003); } catch { /* */ }
  }

  private driftWord() {
    const s = this.s;
    const w = s.add.text(980, 250, 'DENIED', {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: C.coral, letterSpacing: 2,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setDepth(7050).setScrollFactor(0).setAlpha(0);
    try { w.setBlendMode(Phaser.BlendModes.ADD); } catch { /* */ }
    this.objs.push(w);
    this.drift = this.drift ?? [];
    this.drift.push(w);
    s.tweens.add({
      targets: w,
      alpha: { from: 0, to: 0.95 },
      x: 860, y: 340,
      scale: { from: 1, to: 1.15 },
      duration: 2800,
      ease: 'Sine.easeOut',
    });
    // A small spark follows it off the glass.
    const spark = s.add.rectangle(980, 250, 6, 6, 0xf08074, 0.9).setDepth(7051).setScrollFactor(0);
    try { spark.setBlendMode(Phaser.BlendModes.ADD); } catch { /* */ }
    this.objs.push(spark);
    this.drift = this.drift ?? [];
    this.drift.push(spark);
    s.tweens.add({ targets: spark, x: 840, y: 360, alpha: 0.4, duration: 3000, ease: 'Sine.easeOut' });
  }

  private clearDrift() {
    const bits = this.drift ?? [];
    this.drift = [];
    for (const o of bits) {
      try { this.s.tweens.killTweensOf(o); this.s.tweens.add({ targets: o, alpha: 0, duration: 280, onComplete: () => { try { o.destroy(); } catch { /* */ } } }); } catch { /* */ }
    }
  }

  private tapKeys(n: number, gap: number) {
    for (let i = 0; i < n; i++) {
      this.at(i * gap, () => { if (this.playing) try { sfx('key'); } catch { /* */ } });
    }
  }

  private onType = (a: Phaser.Animations.Animation) => {
    if (!this.playing) return;
    if (/^noor_type/.test(a.key)) {
      try { this.s.noor.play('noor_type1_N', true); } catch { /* */ }
    }
  };

  private at(ms: number, fn: () => void) {
    this.timers.push(this.s.time.delayedCall(ms, () => { if (this.playing && !this.finished) fn(); }));
  }

  private pauseRain(on: boolean) {
    for (const a of this.s.amb ?? []) {
      if (a.def?.name !== 'rain') continue;
      try { if (on) a.spr.anims.pause(); else a.spr.anims.resume(); } catch { /* */ }
    }
    try { this.s.glassRain?.pause(on); } catch { /* */ }
  }

  private clear() {
    for (const o of this.objs) { try { o.destroy(); } catch { /* */ } }
    this.objs = [];
    this.letters = [];
    this.papers = [];
    this.drift = [];
    this.lampFx = undefined;
    this.flicker = undefined;
    this.freezeVeil = undefined;
    this.black = undefined;
    this.skipHint = undefined;
    this.monitor = undefined;
  }
}
