// Generic source/target onboarding: self-acting source, near-glow + key glyph, target pulse when carrying.
// Attach to any world point — not tied to a specific quality or object art.
import Phaser from 'phaser';
import type { GameScene } from '../game';

export interface LurePoint {
  x: number;
  y: number;
  /** World radius for "near" prompt. */
  radius?: number;
}

export class OnboardLure {
  source: LurePoint;
  target: LurePoint;
  nearR: number;
  sourceGlyph?: Phaser.GameObjects.Image;
  targetGlyph?: Phaser.GameObjects.Image;
  sourceGlow?: Phaser.GameObjects.Ellipse;
  targetGlow?: Phaser.GameObjects.Ellipse;
  /** Optional hook: source acts on its own each frame (flicker, bang, etc.). */
  sourceAct?: (t: number, dt: number) => void;
  /** Optional hook when near source and not carrying. */
  onNearSource?: () => void;
  carrying = false;
  private destroyed = false;
  private label?: Phaser.GameObjects.Text;
  private ring?: Phaser.GameObjects.Graphics;
  private holdP = 0;

  constructor(
    private s: GameScene,
    source: LurePoint,
    target: LurePoint,
    opts?: {
      sourceKey?: string; // texture for E glyph
      targetKey?: string; // texture for F glyph
      nearR?: number;
      sourceGlowSize?: { w: number; h: number };
      targetGlowSize?: { w: number; h: number };
    },
  ) {
    this.source = source;
    this.target = target;
    this.nearR = opts?.nearR ?? 110;

    const sk = opts?.sourceKey ?? 'fx_key_e';
    const tk = opts?.targetKey ?? 'fx_key_f';
    const sg = opts?.sourceGlowSize ?? { w: 40, h: 48 };
    const tg = opts?.targetGlowSize ?? { w: 28, h: 40 };

    this.sourceGlow = s.add.ellipse(source.x, source.y - 22, sg.w, sg.h, 0xffe08a, 0)
      .setDepth(source.y + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.targetGlow = s.add.ellipse(target.x, target.y, tg.w, tg.h, 0x7ec8e3, 0)
      .setDepth(target.y + 1).setBlendMode(Phaser.BlendModes.ADD);
    s.objs.push(this.sourceGlow, this.targetGlow);

    if (s.textures.exists(sk)) {
      this.sourceGlyph = s.add.image(source.x, source.y - 48, sk)
        .setDepth(9000).setScale(0.95).setAlpha(0);
      s.objs.push(this.sourceGlyph);
    }
    if (s.textures.exists(tk)) {
      this.targetGlyph = s.add.image(target.x, target.y - 40, tk)
        .setDepth(9000).setScale(0.95).setAlpha(0);
      s.objs.push(this.targetGlyph);
    }

    this.label = s.add.text(source.x, source.y - 22, 'HOLD E', {
      fontFamily: 'IBM Plex Mono', fontSize: '11px', fontStyle: '700', color: '#e8fcfc',
      stroke: '#041018', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(9001).setAlpha(0);
    this.ring = s.add.graphics().setDepth(9001).setAlpha(0);
    s.objs.push(this.label, this.ring);
  }

  /** 0–1 fill around the E prompt. 0 leaves an empty ring when near. */
  setHold(p: number) {
    this.holdP = Math.max(0, Math.min(1, p));
    this.drawRing();
  }

  private drawRing() {
    const g = this.ring; if (!g || this.destroyed) return;
    const x = this.source.x, y = (this.sourceGlyph?.y ?? this.source.y - 48);
    const r = 20;
    g.clear();
    g.lineStyle(2, 0x5ee8e0, 0.4);
    g.strokeCircle(x, y, r);
    if (this.holdP > 0.01) {
      g.lineStyle(3.5, 0xe8fcfc, 0.98);
      g.beginPath();
      g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.holdP, false);
      g.strokePath();
    }
  }

  setCarrying(on: boolean) {
    this.carrying = on;
    if (on) {
      this.sourceGlyph?.setAlpha(0);
      this.sourceGlow?.setAlpha(0);
      this.label?.setAlpha(0);
      this.ring?.setAlpha(0);
    }
  }

  update(dt: number) {
    if (this.destroyed) return;
    const t = this.s.t;
    this.sourceAct?.(t, dt);
    this.sourceGlow?.setPosition(this.source.x, this.source.y - 22);
    this.targetGlow?.setPosition(this.target.x, this.target.y);
    this.sourceGlyph?.setX(this.source.x);
    this.targetGlyph?.setX(this.target.x);

    const nearSrc = Math.hypot(this.s.x - this.source.x, this.s.y - this.source.y) < this.nearR;
    const nearTgt = Math.hypot(this.s.x - this.target.x, this.s.y - this.target.y) < this.nearR + 40;

    if (!this.carrying) {
      // Source invites: pulse glow always a little; stronger + "HOLD E" when near
      const base = 0.18 + 0.12 * Math.sin(t * 4.2);
      this.sourceGlow?.setAlpha(nearSrc ? 0.45 + 0.2 * Math.sin(t * 6) : base);
      const glyphA = nearSrc ? 0.85 + 0.15 * Math.sin(t * 5) : 0;
      this.sourceGlyph?.setAlpha(glyphA);
      this.sourceGlyph?.setY(this.source.y - 48 - (nearSrc ? 3 * Math.sin(t * 5) : 0));
      this.label?.setPosition(this.source.x, this.source.y - 22);
      this.label?.setAlpha(nearSrc ? glyphA : 0);
      this.ring?.setAlpha(nearSrc || this.holdP > 0.01 ? 1 : 0);
      if (nearSrc || this.holdP > 0.01) this.drawRing();
      this.targetGlow?.setAlpha(0);
      this.targetGlyph?.setAlpha(0);
      if (nearSrc) this.onNearSource?.();
    } else {
      this.label?.setAlpha(0);
      this.ring?.setAlpha(0);
      // Target invites once carrying
      this.sourceGlow?.setAlpha(0);
      this.sourceGlyph?.setAlpha(0);
      const pulse = 0.3 + 0.25 * Math.sin(t * 5.5);
      this.targetGlow?.setAlpha(pulse);
      this.targetGlyph?.setAlpha(nearTgt || true ? 0.8 + 0.2 * Math.sin(t * 5) : 0.55);
      this.targetGlyph?.setY(this.target.y - 40 - 3 * Math.sin(t * 5));
    }
  }

  destroy() {
    this.destroyed = true;
    this.sourceGlow?.destroy();
    this.targetGlow?.destroy();
    this.sourceGlyph?.destroy();
    this.targetGlyph?.destroy();
    this.label?.destroy();
    this.ring?.destroy();
  }
}
