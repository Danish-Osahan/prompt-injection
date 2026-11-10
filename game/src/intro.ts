// Skippable New-Game intro in the real office. Existing sprites + typographic cards only.
// Beats: 11:48 / Floor 2, Noor working, a glitch, stillness, the lamp buzzes, Fern appears.
// Then a short fade into controllable play and a one-time controls hint.
import Phaser from 'phaser';
import tokens from './tokens.json';
import { sfx } from './sfx';
import type { GameScene } from './game';
import { writeSave } from './save';

const C = tokens.color;
const FONT = 'JetBrains Mono';
const UI = 'IBM Plex Mono';
const DESK = { x: 1000, y: 540 };
const FERN = { x: 250, y: 400 };
const LAMP = { x: 178, y: 268 };

export class IntroCutscene {
  s: GameScene;
  playing = false;
  finished = false;
  objs: Phaser.GameObjects.GameObject[] = [];
  timers: Phaser.Time.TimerEvent[] = [];
  fern?: Phaser.GameObjects.Sprite;
  lampFx?: Phaser.GameObjects.Ellipse;
  dim?: Phaser.GameObjects.Rectangle;
  hint?: Phaser.GameObjects.Text;

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

    const s = this.s;
    s.x = DESK.x; s.y = DESK.y; s.dir = 'N';
    try { s.unstick(); } catch { /* */ }
    s.noor.setPosition(s.x, s.y);
    try { s.shadow?.setPosition(s.x, s.y + 8); } catch { /* */ }
    try { s.noor.play('noor_type1_N', true); } catch { try { s.noor.play('noor_idle_N'); } catch { /* */ } }
    s.noor.on('animationcomplete', this.onType);

    this.dim = s.add.rectangle(640, 360, 1280, 720, 0x04080c, 0.22).setDepth(6200).setScrollFactor(0);
    this.objs.push(this.dim);
    this.lampFx = s.add.ellipse(LAMP.x, LAMP.y, 100, 80, 0xf6c684, 0).setDepth(500).setBlendMode(Phaser.BlendModes.ADD);
    this.objs.push(this.lampFx);

    const skip = s.add.text(640, 692, 'Esc or hold X to skip', { fontFamily: UI, fontSize: '13px', color: C.faint }).setOrigin(0.5).setDepth(8200).setScrollFactor(0);
    this.objs.push(skip);
    s.hud.skip.setVisible(false);

    // Beat 1 — establishing card
    const floor = this.card(640, 300, 'FLOOR 2', 18, C.cyan, 6);
    const time = this.card(640, 348, '11:48 PM', 42, C.inkBright, 4);
    floor.setAlpha(0); time.setAlpha(0);
    s.tweens.add({ targets: [floor, time], alpha: 1, duration: 500 });

    this.at(1600, () => {
      s.tweens.add({ targets: [floor, time], alpha: 0, duration: 350 });
      s.say('noor', 'Rephrase. Again.', 1600);
      try { sfx('key'); } catch { /* */ }
    });

    // Beat 2 — something glitches
    this.at(3200, () => {
      this.glitch();
      s.say('ai', "I'LL HANDLE IT.", 1400);
    });

    // Beat 3 — the office goes still
    this.at(4800, () => {
      s.subQueue.length = 0;
      this.pauseRain(true);
      s.tweens.add({ targets: this.dim, alpha: 0.55, duration: 500 });
      try { s.noor.play('noor_idle_N'); } catch { /* */ }
      const still = this.card(640, 200, 'The office goes still.', 20, C.ink, 0);
      still.setAlpha(0);
      s.tweens.add({ targets: still, alpha: 1, duration: 400 });
      this.at(1800, () => s.tweens.add({ targets: still, alpha: 0, duration: 350 }));
    });

    // Beat 4 — the lamp starts buzzing
    this.at(7000, () => {
      if (this.lampFx) {
        this.lampFx.setAlpha(0.12);
        s.tweens.add({ targets: this.lampFx, alpha: { from: 0.08, to: 0.45 }, duration: 80, yoyo: true, repeat: -1, hold: 70, repeatDelay: 160 });
      }
      try { sfx('impact_hum'); } catch { /* */ }
    });

    // Beat 5 — Fern appears
    this.at(8200, () => {
      this.fern = s.add.sprite(FERN.x, FERN.y, 'fern_seated').setOrigin(0.5, 0.83).setScale(0.75).setAlpha(0).setDepth(FERN.y + 10);
      try { this.fern.play('fern_seated_S'); } catch { /* */ }
      this.objs.push(this.fern);
      s.tweens.add({ targets: this.fern, alpha: 1, duration: 700, ease: 'Quad.easeOut' });
      try { sfx('tell'); } catch { /* */ }
    });

    // Fade into play
    this.at(10200, () => this.finish());
  }

  skip() { this.finish(true); }

  finish(skipped = false) {
    if (this.finished) return;
    this.finished = true;
    this.playing = false;
    for (const t of this.timers) { try { t.remove(false); } catch { /* */ } }
    this.timers = [];
    this.s.tweens.killTweensOf(this.objs);
    if (this.lampFx) this.s.tweens.killTweensOf(this.lampFx);

    const go = () => {
      this.clear();
      this.pauseRain(false);
      const s = this.s;
      s.noor.off('animationcomplete', this.onType);
      s.x = s.room.spawn.x; s.y = s.room.spawn.y; s.dir = 'S';
      try { s.unstick(); } catch { /* */ }
      s.noor.setPosition(s.x, s.y);
      try { s.shadow?.setPosition(s.x, s.y + 8); } catch { /* */ }
      try { s.noor.play('noor_idle_S'); } catch { /* */ }
      s.busy = false;
      s.cutscene = null;
      s.introPending = false;
      if (!s.save.seen.includes('intro')) s.save.seen.push('intro');
      writeSave(s.save);
      s.cameras.main.fadeIn(280, 4, 8, 12);
      s.time.delayedCall(400, () => {
        s.say('fern', "That lamp's been buzzing since you sat down. The lift is dead.", 2800);
        this.showControls();
      });
    };

    if (skipped) {
      this.s.cameras.main.fadeOut(180, 4, 8, 12);
      this.s.cameras.main.once('camerafadeoutcomplete', go);
    } else {
      this.s.cameras.main.fadeOut(280, 4, 8, 12);
      this.s.cameras.main.once('camerafadeoutcomplete', go);
    }
  }

  showControls() {
    const s = this.s;
    if (s.save.tutorials.includes('controls')) return;
    const text = s.ctl.last === 'touch'
      ? 'drag to move   ·   READ to take   ·   throw   ·   TYPE to attack   ·   DASH'
      : 'WASD move   ·   E take   ·   F throw   ·   J attack   ·   SPACE dash';
    this.hint = s.add.text(640, 670, text, {
      fontFamily: UI, fontSize: '16px', color: C.inkBright,
      backgroundColor: 'rgba(4,12,18,0.72)', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(8000).setScrollFactor(0).setAlpha(0);
    s.objs.push(this.hint);
    s.tweens.add({ targets: this.hint, alpha: 1, duration: 280 });
    s.time.delayedCall(6200, () => {
      if (!this.hint) return;
      s.tweens.add({ targets: this.hint, alpha: 0, duration: 400, onComplete: () => { this.hint?.destroy(); this.hint = undefined; } });
    });
    s.save.tutorials.push('controls');
    writeSave(s.save);
  }

  handleInput(f: { pause: boolean; skipHeld: boolean }, dt: number): boolean {
    if (!this.playing) return false;
    if (f.pause) { this.skip(); return true; }
    if (f.skipHeld) {
      this.s.skipHold += dt;
      this.s.hud.skip.setVisible(true).setText(this.s.ctl.last === 'touch' ? `hold here to skip ${'>'.repeat(Math.ceil(this.s.skipHold / 0.15))}` : `hold X to skip ${'>'.repeat(Math.ceil(this.s.skipHold / 0.15))}`);
      if (this.s.skipHold >= 0.4) this.skip();
    } else {
      this.s.skipHold = 0;
      this.s.hud.skip.setVisible(false);
    }
    return true;
  }

  private onType = (a: Phaser.Animations.Animation) => {
    if (!this.playing) return;
    if (/^noor_type/.test(a.key)) {
      try { this.s.noor.play('noor_type1_N', true); } catch { /* */ }
    }
  };

  private card(x: number, y: number, text: string, size: number, color: string, tracking = 0) {
    const t = this.s.add.text(x, y, text, {
      fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, letterSpacing: tracking,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setDepth(7000).setScrollFactor(0);
    this.objs.push(t);
    return t;
  }

  private at(ms: number, fn: () => void) {
    this.timers.push(this.s.time.delayedCall(ms, () => { if (this.playing && !this.finished) fn(); }));
  }

  private glitch() {
    const s = this.s;
    try { s.cameras.main.shake(280, 0.006); } catch { /* */ }
    try { s.cameras.main.flash(80, 180, 220, 230, false); } catch { /* */ }
    try { sfx('impact_snap'); } catch { /* */ }
    for (let i = 0; i < 5; i++) {
      const y = 80 + Math.random() * 560;
      const h = 6 + Math.random() * 18;
      const bar = s.add.rectangle(640 + (Math.random() - 0.5) * 80, y, 1280, h, Math.random() > 0.5 ? 0x78e4e8 : 0xf08ab0, 0.35).setDepth(7100).setScrollFactor(0);
      this.objs.push(bar);
      s.tweens.add({ targets: bar, alpha: 0, x: bar.x + (Math.random() - 0.5) * 40, duration: 180 + i * 40, onComplete: () => bar.destroy() });
    }
  }

  private pauseRain(on: boolean) {
    for (const a of this.s.amb ?? []) {
      if (a.def?.name !== 'rain') continue;
      try { if (on) a.spr.anims.pause(); else a.spr.anims.resume(); } catch { /* */ }
    }
  }

  private clear() {
    for (const o of this.objs) { try { o.destroy(); } catch { /* */ } }
    this.objs = [];
    this.fern = undefined;
    this.lampFx = undefined;
    this.dim = undefined;
  }
}
