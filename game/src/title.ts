// Boot splash + title menu over a dimmed full-bleed office plate.
// Typographic UI, existing rain amb + a code-drawn lamp flicker. No new renders.
import Phaser from 'phaser';
import tokens from './tokens.json';
import { hasSave, wipeSave } from './save';
import { loadSettings, writeSettings, shouldSkipTitle } from './settings';
import { bindSfxScene, sfx, setMasterVolume, getMasterVolume } from './sfx';

const C = tokens.color;
const FONT = 'JetBrains Mono';
const UI = 'IBM Plex Mono';

type Pane = 'splash' | 'menu' | 'settings' | 'credits';

interface Item { id: string; label: () => string; disabled?: () => boolean; run: () => void }

export class TitleScene extends Phaser.Scene {
  pane: Pane = 'splash';
  cursor = 0;
  volume = 1;
  items: Item[] = [];
  ui: Phaser.GameObjects.GameObject[] = [];
  hint?: Phaser.GameObjects.Text;
  lamp?: Phaser.GameObjects.Ellipse;
  rain?: Phaser.GameObjects.Sprite;
  splashT = 0;
  keys?: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; enter: Phaser.Input.Keyboard.Key; space: Phaser.Input.Keyboard.Key; esc: Phaser.Input.Keyboard.Key; w: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  constructor() { super('title'); }

  create() {
    bindSfxScene(this);
    const st = loadSettings();
    this.volume = st.volume;
    setMasterVolume(this.volume);

    // Full-bleed office plate, dimmed.
    const bg = this.add.image(0, 0, 'bg_office_base').setOrigin(0).setDepth(0);
    bg.setTint(0x8aa0b0);
    this.add.rectangle(640, 360, 1280, 720, 0x04080c, 0.46).setDepth(2);

    // Rain over the window (existing office amb sheet).
    if (this.textures.exists('amb_office_base_rain')) {
      if (!this.anims.exists('title_rain')) {
        const tex = this.textures.get('amb_office_base_rain');
        const n = tex.frameTotal;
        this.anims.create({ key: 'title_rain', frames: this.anims.generateFrameNumbers('amb_office_base_rain', { start: 0, end: Math.max(0, n - 2) }), frameRate: 12, repeat: -1 });
      }
      this.rain = this.add.sprite(765 + 390 / 2, 78 + 126 / 2, 'amb_office_base_rain').setDepth(1);
      try { this.rain.play('title_rain'); } catch { /* */ }
    }

    // Desk-lamp flicker (the buzzing lamp, roughly on desk_podW).
    this.lamp = this.add.ellipse(178, 268, 90, 70, 0xf6c684, 0.22).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: this.lamp, alpha: { from: 0.08, to: 0.38 }, duration: 90, yoyo: true, repeat: -1, ease: 'Sine.inOut', hold: 180, repeatDelay: 420 });

    const k = this.input.keyboard!;
    this.keys = {
      up: k.addKey('UP'), down: k.addKey('DOWN'), w: k.addKey('W'), s: k.addKey('S'),
      enter: k.addKey('ENTER'), space: k.addKey('SPACE'), esc: k.addKey('ESC'),
      left: k.addKey('LEFT'), right: k.addKey('RIGHT'),
    };

    this.input.on('pointerdown', () => { if (this.pane === 'splash') { this.tweens.killAll(); this.showMenu(); } });
    this.installHooks();
    if (shouldSkipTitle()) { this.startGame(hasSave() ? 'continue' : 'new'); return; }
    this.showSplash();
  }

  showSplash() {
    this.pane = 'splash';
    this.splashT = 0;
    this.clearUi();
    const a = this.add.text(640, 330, 'AFTER HOURS', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: C.inkBright, letterSpacing: 8 } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setDepth(10).setAlpha(0);
    const b = this.add.text(640, 372, 'presents', { fontFamily: UI, fontSize: '16px', color: C.dim }).setOrigin(0.5).setDepth(10).setAlpha(0);
    this.ui.push(a, b);
    this.tweens.add({ targets: [a, b], alpha: 1, duration: 500, ease: 'Quad.easeOut' });
    this.time.delayedCall(1600, () => {
      this.tweens.add({ targets: [a, b], alpha: 0, duration: 350, onComplete: () => this.showMenu() });
    });
  }

  showMenu() {
    this.pane = 'menu';
    this.clearUi();
    this.items = [
      { id: 'new', label: () => 'New Game', run: () => this.startGame('new') },
      { id: 'continue', label: () => 'Continue', disabled: () => !hasSave(), run: () => this.startGame('continue') },
      { id: 'settings', label: () => 'Settings', run: () => this.showSettings() },
      { id: 'credits', label: () => 'Credits', run: () => this.showCredits() },
    ];
    if (this.items[this.cursor]?.disabled?.()) this.cursor = 0;
    const title = this.add.text(640, 188, 'PROMPT INJECTION', {
      fontFamily: FONT, fontSize: '52px', fontStyle: 'bold', color: C.inkBright, letterSpacing: 6,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setDepth(10);
    const sub = this.add.text(640, 242, 'LEVEL 1', { fontFamily: UI, fontSize: '16px', color: C.cyan, letterSpacing: 6 } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setDepth(10);
    this.ui.push(title, sub);
    this.drawItems(320);
    this.hint = this.add.text(640, 680, 'WASD / arrows  ·  Enter or click  ·  Esc back', { fontFamily: UI, fontSize: '14px', color: C.faint }).setOrigin(0.5).setDepth(10);
    this.ui.push(this.hint);
    sfx('tell');
  }

  showSettings() {
    this.pane = 'settings';
    this.clearUi();
    this.items = [
      { id: 'vol', label: () => `Volume    ${Math.round(this.volume * 100)}%`, run: () => this.nudgeVolume(0.1) },
      { id: 'full', label: () => `Fullscreen    ${this.scale.isFullscreen ? 'ON' : 'OFF'}`, run: () => this.toggleFull() },
      { id: 'back', label: () => 'Back', run: () => this.showMenu() },
    ];
    this.cursor = 0;
    const h = this.add.text(640, 200, 'SETTINGS', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: C.inkBright, letterSpacing: 4 } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setDepth(10);
    this.ui.push(h);
    this.drawItems(300);
    const note = this.add.text(640, 620, 'Left / Right to adjust volume', { fontFamily: UI, fontSize: '14px', color: C.faint }).setOrigin(0.5).setDepth(10);
    this.ui.push(note);
  }

  showCredits() {
    this.pane = 'credits';
    this.clearUi();
    this.items = [{ id: 'back', label: () => 'Back', run: () => this.showMenu() }];
    this.cursor = 0;
    const h = this.add.text(640, 140, 'CREDITS', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: C.inkBright, letterSpacing: 4 } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setDepth(10);
    const body = [
      'Kenney  —  furniture, Mini Characters, Interface Sounds  (CC0)',
      'Quaternius  —  character bases  (CC0)',
      'IBM Plex Mono, JetBrains Mono  (SIL OFL)',
      'Office plates, lift and desk lamp  —  original Blender / paint',
      'Full-bleed office plate  —  inpainted extension of the office art',
      '',
      'A small game. See CREDITS.md for the full log.',
    ].join('\n');
    const t = this.add.text(640, 380, body, { fontFamily: UI, fontSize: '16px', color: C.ink, align: 'center', lineSpacing: 8 }).setOrigin(0.5).setDepth(10);
    this.ui.push(h, t);
    this.drawItems(560);
  }

  drawItems(y0: number) {
    this.items.forEach((it, i) => {
      const y = y0 + i * 64;
      const disabled = !!it.disabled?.();
      const box = this.add.rectangle(640, y, 420, 56, 0x04121a, 0.0001).setDepth(10).setInteractive({ useHandCursor: !disabled });
      const caret = this.add.text(430, y, i === this.cursor ? '>' : ' ', { fontFamily: FONT, fontSize: '22px', color: C.cyan }).setOrigin(0, 0.5).setDepth(11);
      const lab = this.add.text(460, y, it.label(), { fontFamily: FONT, fontSize: '22px', color: disabled ? C.faint : (i === this.cursor ? C.inkBright : C.ink) }).setOrigin(0, 0.5).setDepth(11);
      if (i === this.cursor && !disabled) {
        const hi = this.add.rectangle(640, y, 420, 56, 0x78e4e8, 0.08).setDepth(10);
        hi.setStrokeStyle(1.5, 0x78e4e8, 0.7);
        this.ui.push(hi);
      }
      box.on('pointerover', () => { if (!disabled && this.cursor !== i) { this.cursor = i; this.refresh(); } });
      box.on('pointerdown', () => { if (!disabled) { this.cursor = i; this.activate(); } });
      this.ui.push(box, caret, lab);
    });
  }

  refresh() {
    if (this.pane === 'menu') this.showMenu();
    else if (this.pane === 'settings') this.showSettings();
    else if (this.pane === 'credits') this.showCredits();
  }

  clearUi() {
    for (const o of this.ui) { try { o.destroy(); } catch { /* */ } }
    this.ui = [];
    this.hint = undefined;
  }

  activate() {
    const it = this.items[this.cursor];
    if (!it || it.disabled?.()) { sfx('block'); return; }
    sfx('key');
    it.run();
  }

  nudgeVolume(dir: number) {
    this.volume = Math.max(0, Math.min(1, Math.round((this.volume + dir) * 10) / 10));
    setMasterVolume(this.volume);
    writeSettings({ volume: this.volume });
    sfx('tell');
    this.refresh();
  }

  toggleFull() {
    try {
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else this.scale.startFullscreen();
    } catch { /* browser block */ }
    this.time.delayedCall(80, () => this.refresh());
  }

  startGame(mode: 'new' | 'continue') {
    if (mode === 'continue' && !hasSave()) { sfx('block'); return; }
    if (mode === 'new') wipeSave();
    this.scene.start('game', { fromTitle: true, mode });
  }

  update(_t: number, d: number) {
    const dt = d / 1000;
    if (this.pane === 'splash') {
      this.splashT += dt;
      // Click / Enter skips the splash into the menu
      if (this.keys && (Phaser.Input.Keyboard.JustDown(this.keys.enter) || Phaser.Input.Keyboard.JustDown(this.keys.space) || Phaser.Input.Keyboard.JustDown(this.keys.esc))) {
        this.tweens.killAll();
        this.showMenu();
      }
      return;
    }
    if (!this.keys) return;
    const k = this.keys;
    if (Phaser.Input.Keyboard.JustDown(k.up) || Phaser.Input.Keyboard.JustDown(k.w)) this.moveCursor(-1);
    if (Phaser.Input.Keyboard.JustDown(k.down) || Phaser.Input.Keyboard.JustDown(k.s)) this.moveCursor(1);
    if (Phaser.Input.Keyboard.JustDown(k.enter) || Phaser.Input.Keyboard.JustDown(k.space)) this.activate();
    if (Phaser.Input.Keyboard.JustDown(k.esc) && this.pane !== 'menu') this.showMenu();
    if (this.pane === 'settings' && this.items[this.cursor]?.id === 'vol') {
      if (Phaser.Input.Keyboard.JustDown(k.left)) this.nudgeVolume(-0.1);
      if (Phaser.Input.Keyboard.JustDown(k.right)) this.nudgeVolume(0.1);
    }
  }

  private moveCursor(dir: number) {
    if (!this.items.length) return;
    let i = this.cursor;
    for (let n = 0; n < this.items.length; n++) {
      i = (i + dir + this.items.length) % this.items.length;
      if (!this.items[i].disabled?.()) { this.cursor = i; sfx('tell'); this.refresh(); return; }
    }
  }

  installHooks() {
    const q = new URLSearchParams(location.search);
    if (!(q.has('test') || q.has('impact'))) return;
    (window as unknown as { __pi: unknown }).__pi = {
      screen: () => this.pane === 'splash' ? 'boot' : 'title',
      pane: () => this.pane,
      cursor: () => this.items[this.cursor]?.id ?? null,
      hasContinue: () => hasSave(),
      volume: () => this.volume,
      fullscreen: () => this.scale.isFullscreen,
      newGame: () => this.startGame('new'),
      continueGame: () => this.startGame('continue'),
      openSettings: () => { if (this.pane === 'splash') this.showMenu(); this.showSettings(); return true; },
      openCredits: () => { if (this.pane === 'splash') this.showMenu(); this.showCredits(); return true; },
      setVolume: (v: number) => { this.volume = Math.max(0, Math.min(1, v)); setMasterVolume(this.volume); writeSettings({ volume: this.volume }); this.refresh(); return this.volume; },
      toggleFullscreen: () => { this.toggleFull(); return true; },
      skipSplash: () => { if (this.pane === 'splash') this.showMenu(); return this.pane; },
      state: () => ({ screen: this.pane === 'splash' ? 'boot' : 'title', pane: this.pane, cursor: this.items[this.cursor]?.id ?? null, hasContinue: hasSave(), volume: this.volume, fullscreen: this.scale.isFullscreen }),
    };
  }
}

export type TitleStartData = { fromTitle?: boolean; mode?: 'new' | 'continue' };
