// Adapted from /workspace/games/_shared/controls.ts: keyboard + mouse + touch (virtual stick left half,
// buttons right). Adds: pause, debug, mouse-click TYPE, and live "last input" detection so the
// floor-text prompts switch between keyboard and touch wording automatically.
import Phaser from 'phaser';

export type Action = 'attack' | 'dash' | 'interact' | 'pause' | 'debug' | 'root';
export interface Frame { mx: number; my: number; attack: boolean; dash: boolean; interact: boolean; pause: boolean; debug: boolean; root: boolean; attackHeld: boolean; skipHeld: boolean; interactHeld: boolean }
export type InputKind = 'kb' | 'touch';

export class Controls {
  last: InputKind;
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private joyId: number | null = null;
  private joyBase = { x: 0, y: 0 };
  private joyVec = { x: 0, y: 0 };
  private base: Phaser.GameObjects.Arc;
  private knob: Phaser.GameObjects.Arc;
  private pressed: Record<Action, boolean> = { attack: false, dash: false, interact: false, pause: false, debug: false, root: false };
  private touchUi: Phaser.GameObjects.GameObject[] = [];
  /** Set by the scene while the player drags a word chip, so the stick and click-attack ignore that pointer. */
  uiPointer: number | null = null;
  private mouseHeld = false; private typeBtnId: number | null = null; private readBtnId: number | null = null; private skipId: number | null = null;
  onKindChange?: (k: InputKind) => void;

  // raised clear of the caption bar (y >= 626)
  static BTN = { attack: { x: 1182, y: 530, r: 56, label: 'TYPE' }, dash: { x: 1046, y: 572, r: 42, label: 'DASH' }, interact: { x: 1178, y: 392, r: 44, label: 'READ' }, root: { x: 1056, y: 456, r: 36, label: 'ROOT' } };
  static MENU = { x: 1230, y: 40 };

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,J,K,SPACE,SHIFT,E,ENTER,ESC,P,BACKTICK,F2,R,X') as Record<string, Phaser.Input.Keyboard.Key>;
    const bind = (names: string[], a: Action) => names.forEach(n => this.keys[n].on('down', () => { this.pressed[a] = true; this.setKind('kb'); }));
    bind(['J', 'ENTER'], 'attack'); bind(['K', 'SPACE', 'SHIFT'], 'dash'); bind(['E'], 'interact'); bind(['ESC', 'P'], 'pause'); bind(['BACKTICK', 'F2'], 'debug'); bind(['R'], 'root');
    kb.on('keydown', () => this.setKind('kb'));
    const dev = scene.sys.game.device.input.touch && (navigator.maxTouchPoints ?? 0) > 0;
    this.last = dev ? 'touch' : 'kb';

    const s = scene;
    this.base = s.add.circle(0, 0, 64, 0xb4eef0, 0.08).setStrokeStyle(2, 0xb4eef0, 0.35).setScrollFactor(0).setDepth(5000).setVisible(false);
    this.knob = s.add.circle(0, 0, 28, 0xb4eef0, 0.3).setScrollFactor(0).setDepth(5001).setVisible(false);
    for (const [id, b] of Object.entries(Controls.BTN) as [Action, { x: number; y: number; r: number; label: string }][]) {
      const bg = s.add.circle(b.x, b.y, b.r, 0x04101a, 0.55).setStrokeStyle(2, 0x78e4e8, 0.7).setScrollFactor(0).setDepth(5000);
      const t = s.add.text(b.x, b.y, b.label, { fontFamily: 'JetBrains Mono', fontStyle: 'bold', fontSize: '16px', color: '#B4EEF0' }).setOrigin(0.5).setScrollFactor(0).setDepth(5001);
      bg.setInteractive(new Phaser.Geom.Circle(b.r, b.r, b.r), Phaser.Geom.Circle.Contains);
      bg.on('pointerdown', (p: Phaser.Input.Pointer) => { this.pressed[id] = true; if (id === 'attack') this.typeBtnId = p.id; if (id === 'interact') this.readBtnId = p.id; this.setKind(p.wasTouch ? 'touch' : this.last); bg.setFillStyle(0x78e4e8, 0.35); });
      const up = () => { bg.setFillStyle(0x04101a, 0.55); if (id === 'attack') this.typeBtnId = null; if (id === 'interact') this.readBtnId = null; }; bg.on('pointerup', up); bg.on('pointerout', up);
      bg.name = 'btn-' + id;
      this.touchUi.push(bg, t);
    }
    s.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (p.wasTouch) this.setKind('touch'); else this.setKind('kb');
      if (over.length || this.uiPointer === p.id) return;
      if (!p.wasTouch) { if (p.leftButtonDown()) { this.pressed.attack = true; this.mouseHeld = true; } return; }
      if (p.x > 640 && p.y < 300) { this.skipId = p.id; return; }
      if (this.joyId !== null || p.x > 640) return;
      this.joyId = p.id; this.joyBase = { x: p.x, y: p.y }; this.joyVec = { x: 0, y: 0 };
      this.base.setPosition(p.x, p.y).setVisible(true); this.knob.setPosition(p.x, p.y).setVisible(true);
    });
    s.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joyId) return;
      let dx = p.x - this.joyBase.x, dy = p.y - this.joyBase.y; const d = Math.hypot(dx, dy), max = 64;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      this.joyVec = { x: dx / max, y: dy / max };
      this.knob.setPosition(this.joyBase.x + dx, this.joyBase.y + dy);
    });
    const release = (p: Phaser.Input.Pointer) => { if (!p.wasTouch) this.mouseHeld = false; if (p.id === this.skipId) this.skipId = null; if (p.id === this.typeBtnId) this.typeBtnId = null; if (p.id === this.readBtnId) this.readBtnId = null; if (p.id !== this.joyId) return; this.joyId = null; this.joyVec = { x: 0, y: 0 }; this.base.setVisible(false); this.knob.setVisible(false); };
    s.input.on('pointerup', release); s.input.on('pointerupoutside', release);
    this.applyKind();
  }

  private setKind(k: InputKind) { if (k === this.last) return; this.last = k; this.applyKind(); this.onKindChange?.(k); }
  private applyKind() { for (const o of this.touchUi) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(this.last === 'touch'); }
  /** Let the scene trigger an action (pause icon, test hooks). */
  trigger(a: Action) { this.pressed[a] = true; }

  read(): Frame {
    const k = this.keys;
    let mx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let my = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (mx === 0 && my === 0 && Math.hypot(this.joyVec.x, this.joyVec.y) > 0.2) { mx = this.joyVec.x; my = this.joyVec.y; }
    const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    const p = this.pressed;
    const f: Frame = { mx, my, ...p, attackHeld: k.J.isDown || k.ENTER.isDown || this.mouseHeld || this.typeBtnId !== null, skipHeld: k.X.isDown || this.skipId !== null, interactHeld: k.E.isDown || this.readBtnId !== null };
    this.pressed = { attack: false, dash: false, interact: false, pause: false, debug: false, root: false };
    return f;
  }
}
