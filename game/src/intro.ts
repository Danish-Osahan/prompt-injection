// Skippable New-Game opening in the real office. ~40–60s camera piece.
// Fade from black on office hum, slow pan across the night floor to Noor at
// her desk, then a glitch (tear, stuttering lights, freeze mid-motion).
// Lines arrive after beats. No HUD, no letterbox bars, no off-screen speakers.
import Phaser from 'phaser';
import tokens from './tokens.json';
import { sfx, startHum, stopHum } from './sfx';
import type { GameScene } from './game';
import { writeSave } from './save';
import { showRoomCard } from './flow';

const C = tokens.color;
const FONT = 'JetBrains Mono';
const UI = 'IBM Plex Mono';
// Feet south of desk_noor (solid ends ~y=507) so she sits in front of the desk, not through it.
const DESK = { x: 995, y: 615 };
const LAMP = { x: 178, y: 268 };

export class IntroCutscene {
  s: GameScene;
  playing = false;
  finished = false;
  objs: Phaser.GameObjects.GameObject[] = [];
  timers: Phaser.Time.TimerEvent[] = [];
  lampFx?: Phaser.GameObjects.Ellipse;
  flicker?: Phaser.GameObjects.Rectangle;
  freezeVeil?: Phaser.GameObjects.Rectangle;
  skipHint?: Phaser.GameObjects.Text;
  camTweens: Phaser.Tweens.Tween[] = [];
  released = false;

  constructor(s: GameScene) { this.s = s; }

  shouldPlay() {
    const q = new URLSearchParams(location.search);
    if (this.s.labMode || this.s.swapMode || q.has('combat') || q.has('skipIntro')) return false;
    return this.s.startMode === 'new';
  }

  start() {
    if (this.playing || this.finished) return;
    this.playing = true;
    this.s.busy = true;
    this.s.cutscene = { id: 'intro', skip: () => this.skip() };
    this.s.introPending = true;
    this.s.setHudVisible(false);

    const s = this.s;
    s.x = DESK.x; s.y = DESK.y; s.dir = 'N';
    try { s.unstick(); } catch { /* */ }
    // unstick can shove her; re-seat if she drifted onto the desktop
    if (s.y < 580) { s.x = DESK.x; s.y = DESK.y; }
    s.noor.setPosition(s.x, s.y).setDepth(s.y + 24);
    try { s.shadow?.setPosition(s.x, s.y + 8).setDepth(s.y - 1); } catch { /* */ }
    try { s.noor.play('noor_type1_N', true); } catch { try { s.noor.play('noor_idle_N'); } catch { /* */ } }
    s.noor.on('animationcomplete', this.onType);

    this.lampFx = s.add.ellipse(LAMP.x, LAMP.y, 110, 88, 0xf6c684, 0).setDepth(500).setBlendMode(Phaser.BlendModes.ADD);
    this.objs.push(this.lampFx);
    this.flicker = s.add.rectangle(640, 360, 1600, 1000, 0x03070c, 0).setDepth(6100).setScrollFactor(0);
    this.objs.push(this.flicker);
    this.freezeVeil = s.add.rectangle(640, 360, 1600, 1000, 0x0a1420, 0).setDepth(6090).setScrollFactor(0);
    this.objs.push(this.freezeVeil);

    this.skipHint = s.add.text(1256, 696, 'Esc to skip', {
      fontFamily: UI, fontSize: '12px', color: C.faint,
    }).setOrigin(1, 1).setDepth(8200).setScrollFactor(0).setAlpha(0);
    this.objs.push(this.skipHint);

    this.rigCamera();
    try { startHum(0.05); } catch { /* */ }

    // Beat 1 — fade up on the window, then a slow move across the empty office.
    this.at(2200, () => {
      if (this.skipHint) s.tweens.add({ targets: this.skipHint, alpha: 0.55, duration: 500 });
    });
    this.at(8000, () => {
      if (this.skipHint) s.tweens.add({ targets: this.skipHint, alpha: 0, duration: 600 });
    });

    // Beat 2 — arrive on Noor. Quiet time card, then her line, both after a hold.
    this.at(20000, () => this.lineCard(640, 86, '11:48 PM', 28, C.inkBright, 6, 2800));
    this.at(24200, () => this.worldLine(s.x, s.y - 108, 'Rephrase. Again.', 2600));
    this.at(24600, () => { try { sfx('key'); } catch { /* */ } });

    // Beat 3 — the glitch: tear, lights stutter, then the world freezes mid-motion.
    this.at(28600, () => this.glitchBurst());
    this.at(29400, () => this.stutterLights(5));
    this.at(30800, () => this.glitchBurst());
    this.at(31800, () => {
      this.freezeWorld();
      this.stutterLights(3);
    });

    // Beat 4 — a held silence, then one quiet line. No Fern (she isn't on screen).
    this.at(36000, () => this.lineCard(640, 92, 'The office goes still.', 18, C.ink, 1, 3200));

    // Fade into play around 48s.
    this.at(43000, () => this.finish());
  }

  skip() { this.finish(true); }

  finish(skipped = false) {
    if (this.finished) return;
    this.finished = true;
    this.playing = false;
    for (const t of this.timers) { try { t.remove(false); } catch { /* */ } }
    this.timers = [];
    for (const tw of this.camTweens) { try { tw.stop(); } catch { /* */ } }
    this.camTweens = [];
    this.s.tweens.killTweensOf(this.objs);
    if (this.lampFx) this.s.tweens.killTweensOf(this.lampFx);
    try { stopHum(skipped ? 0.25 : 0.6); } catch { /* */ }

    const go = () => {
      if (this.released) return;
      this.released = true;
      this.clear();
      this.pauseRain(false);
      const s = this.s;
      try { s.noor.anims.resume(); } catch { /* */ }
      s.noor.off('animationcomplete', this.onType);
      s.x = s.room.spawn.x; s.y = s.room.spawn.y; s.dir = 'S';
      try { s.unstick(); } catch { /* */ }
      s.noor.setPosition(s.x, s.y).setDepth(s.y + 24);
      try { s.shadow?.setPosition(s.x, s.y + 8).setDepth(s.y - 1); } catch { /* */ }
      try { s.noor.play('noor_idle_S'); } catch { /* */ }
      s.setupStaticCamera();
      s.setHudVisible(true);
      s.busy = false;
      s.cutscene = null;
      s.introPending = false;
      if (!s.save.seen.includes('intro')) s.save.seen.push('intro');
      writeSave(s.save);
      s.cameras.main.fadeIn(320, 4, 8, 12);
      s.time.delayedCall(480, () => {
        try { showRoomCard(s, 'office'); } catch { /* */ }
        this.showControls();
      });
    };

    const cam = this.s.cameras.main;
    try { cam.fadeOut(skipped ? 180 : 400, 4, 8, 12); } catch { /* */ }
    cam.once('camerafadeoutcomplete', go);
    // If fade is already at black (e.g. start failed to fade in), don't hang.
    this.s.time.delayedCall(skipped ? 280 : 520, () => { if (this.s.introPending) go(); });
  }

  showControls() {
    const s = this.s;
    if (s.save.tutorials.includes('controls')) return;
    const text = s.ctl.last === 'touch'
      ? 'drag to move   ·   READ to take   ·   throw   ·   TYPE to attack   ·   DASH'
      : 'WASD move   ·   E take   ·   F throw   ·   J attack   ·   SPACE dash';
    this.skipHint = undefined;
    const hint = s.add.text(640, 670, text, {
      fontFamily: UI, fontSize: '16px', color: C.inkBright,
      backgroundColor: 'rgba(4,12,18,0.72)', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(8000).setScrollFactor(0).setAlpha(0);
    s.objs.push(hint);
    s.tweens.add({ targets: hint, alpha: 1, duration: 280 });
    s.time.delayedCall(6200, () => {
      s.tweens.add({ targets: hint, alpha: 0, duration: 400, onComplete: () => hint.destroy() });
    });
    s.save.tutorials.push('controls');
    writeSave(s.save);
  }

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
    return true;
  }

  private rigCamera() {
    const cam = this.s.cameras.main;
    try { cam.stopFollow(); } catch { /* */ }
    try { cam.resetFX(); } catch { /* */ }
    // Expanded bounds so the opening can look at the rain window without clamping.
    cam.setViewport(0, 0, 1280, 720);
    cam.setBounds(-280, -240, 1840, 1200);
    cam.setZoom(1.28);
    cam.centerOn(940, 210);
    cam.fadeIn(1600, 4, 8, 12);

    // Window → mid floor → Noor at her desk.
    this.s.time.delayedCall(1400, () => {
      if (!this.playing) return;
      cam.pan(620, 360, 9000, 'Sine.easeInOut');
      cam.zoomTo(1.14, 9000, 'Sine.easeInOut');
    });
    this.s.time.delayedCall(10800, () => {
      if (!this.playing) return;
      cam.pan(995, 520, 9000, 'Sine.easeInOut');
      cam.zoomTo(1.32, 9000, 'Sine.easeInOut');
    });
  }

  private lineCard(x: number, y: number, text: string, size: number, color: string, tracking: number, hold: number) {
    const t = this.s.add.text(x, y, text, {
      fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, letterSpacing: tracking,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setDepth(7000).setScrollFactor(0).setAlpha(0);
    this.objs.push(t);
    this.s.tweens.add({ targets: t, alpha: 1, duration: 600 });
    this.s.time.delayedCall(hold, () => {
      if (!this.playing) return;
      this.s.tweens.add({ targets: t, alpha: 0, duration: 450 });
    });
    return t;
  }

  private worldLine(x: number, y: number, text: string, hold: number) {
    const t = this.s.add.text(x, y, text, {
      fontFamily: UI, fontSize: '16px', color: C.inkBright,
    }).setOrigin(0.5, 1).setDepth(7200).setAlpha(0);
    this.objs.push(t);
    this.s.tweens.add({ targets: t, alpha: 1, y: y - 6, duration: 500, ease: 'Quad.easeOut' });
    this.s.time.delayedCall(hold, () => {
      if (!this.playing) return;
      this.s.tweens.add({ targets: t, alpha: 0, duration: 400 });
    });
    return t;
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

  private glitchBurst() {
    const s = this.s;
    try { s.cameras.main.shake(220, 0.005); } catch { /* */ }
    try { s.cameras.main.flash(50, 200, 230, 236, false); } catch { /* */ }
    try { sfx('impact_snap'); } catch { /* */ }
    for (let i = 0; i < 7; i++) {
      const y = 40 + Math.random() * 640;
      const h = 4 + Math.random() * 22;
      const col = Math.random() > 0.5 ? 0x78e4e8 : 0xf08ab0;
      const bar = s.add.rectangle(640 + (Math.random() - 0.5) * 140, y, 1280, h, col, 0.42).setDepth(7100).setScrollFactor(0);
      this.objs.push(bar);
      s.tweens.add({
        targets: bar,
        alpha: 0,
        x: bar.x + (Math.random() - 0.5) * 70,
        scaleX: 1 + Math.random() * 0.08,
        duration: 140 + i * 30,
        onComplete: () => bar.destroy(),
      });
    }
  }

  private stutterLights(n: number) {
    if (!this.flicker) return;
    const s = this.s;
    for (let i = 0; i < n; i++) {
      this.at(i * 140 + (i % 2 === 0 ? 0 : 40), () => {
        if (!this.flicker || !this.playing) return;
        this.flicker.setAlpha(i % 2 === 0 ? 0.55 : 0.12);
        if (this.lampFx) this.lampFx.setAlpha(i % 2 === 0 ? 0.05 : 0.4);
      });
    }
    this.at(n * 140 + 80, () => {
      if (this.flicker) this.flicker.setAlpha(0);
    });
    void s;
  }

  private freezeWorld() {
    this.pauseRain(true);
    try { this.s.noor.anims.pause(); } catch { /* */ }
    if (this.freezeVeil) {
      this.s.tweens.add({ targets: this.freezeVeil, alpha: 0.28, duration: 700 });
    }
    try { sfx('impact_hum'); } catch { /* */ }
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
    this.lampFx = undefined;
    this.flicker = undefined;
    this.freezeVeil = undefined;
    this.skipHint = undefined;
  }
}
