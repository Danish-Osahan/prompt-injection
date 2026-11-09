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
  }

  setCarrying(on: boolean) {
    this.carrying = on;
    if (on) {
      this.sourceGlyph?.setAlpha(0);
      this.sourceGlow?.setAlpha(0);
    }
  }

  update(dt: number) {
    if (this.destroyed) return;
    const t = this.s.t;
    this.sourceAct?.(t, dt);

    const nearSrc = Math.hypot(this.s.x - this.source.x, this.s.y - this.source.y) < this.nearR;
    const nearTgt = Math.hypot(this.s.x - this.target.x, this.s.y - this.target.y) < this.nearR + 40;

    if (!this.carrying) {
      // Source invites: pulse glow always a little; stronger + glyph when near
      const base = 0.18 + 0.12 * Math.sin(t * 4.2);
      this.sourceGlow?.setAlpha(nearSrc ? 0.45 + 0.2 * Math.sin(t * 6) : base);
      this.sourceGlyph?.setAlpha(nearSrc ? 0.85 + 0.15 * Math.sin(t * 5) : 0);
      this.sourceGlyph?.setY(this.source.y - 48 - (nearSrc ? 3 * Math.sin(t * 5) : 0));
      this.targetGlow?.setAlpha(0);
      this.targetGlyph?.setAlpha(0);
      if (nearSrc) this.onNearSource?.();
    } else {
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
  }
}
