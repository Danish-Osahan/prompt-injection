// Generic source/target onboarding: object glow + a key-cap chip by the object (no fill-ring).
import Phaser from 'phaser';
import type { GameScene } from '../game';
import { InteractChip, placeChip } from '../ui/InteractChip';

export interface LurePoint {
  x: number;
  y: number;
  radius?: number;
}

export class OnboardLure {
  source: LurePoint;
  target: LurePoint;
  nearR: number;
  targetGlyph?: Phaser.GameObjects.Image;
  sourceGlow?: Phaser.GameObjects.Ellipse;
  targetGlow?: Phaser.GameObjects.Ellipse;
  sourceAct?: (t: number, dt: number) => void;
  onNearSource?: () => void;
  carrying = false;
  hidden = false;
  verb = 'take';
  private destroyed = false;
  private chip?: InteractChip;
  private holdP = 0;

  constructor(
    private s: GameScene,
    source: LurePoint,
    target: LurePoint,
    opts?: {
      sourceKey?: string;
      targetKey?: string;
      nearR?: number;
      sourceGlowSize?: { w: number; h: number };
      targetGlowSize?: { w: number; h: number };
    },
  ) {
    this.source = source;
    this.target = target;
    this.nearR = opts?.nearR ?? 110;

    const tk = opts?.targetKey ?? 'fx_key_f';
    const sg = opts?.sourceGlowSize ?? { w: 40, h: 48 };
    const tg = opts?.targetGlowSize ?? { w: 28, h: 40 };

    this.sourceGlow = s.add.ellipse(source.x, source.y - 8, sg.w, sg.h, 0xffe08a, 0)
      .setDepth(source.y + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.targetGlow = s.add.ellipse(target.x, target.y, tg.w, tg.h, 0x7ec8e3, 0)
      .setDepth(target.y + 1).setBlendMode(Phaser.BlendModes.ADD);
    s.objs.push(this.sourceGlow, this.targetGlow);

    if (s.textures.exists(tk)) {
      this.targetGlyph = s.add.image(target.x, target.y - 40, tk)
        .setDepth(9000).setScale(0.95).setAlpha(0);
      s.objs.push(this.targetGlyph);
    }
    this.chip = new InteractChip(s, 9001);
  }

  /** 0–1 fill inside the E key-cap. */
  setHold(p: number) {
    this.holdP = Math.max(0, Math.min(1, p));
  }

  setVerb(v: string) { this.verb = v; }

  setCarrying(on: boolean) {
    this.carrying = on;
    if (on) {
      this.sourceGlow?.setAlpha(0);
      this.chip?.hide();
    }
  }

  update(dt: number) {
    if (this.destroyed) return;
    void dt;
    if (this.hidden) {
      this.sourceGlow?.setAlpha(0);
      this.targetGlow?.setAlpha(0);
      this.targetGlyph?.setAlpha(0);
      this.chip?.hide();
      return;
    }
    const t = this.s.t;
    this.sourceAct?.(t, dt);
    this.sourceGlow?.setPosition(this.source.x, this.source.y - 8);
    this.targetGlow?.setPosition(this.target.x, this.target.y);
    this.targetGlyph?.setX(this.target.x);

    const nearSrc = Math.hypot(this.s.x - this.source.x, this.s.y - this.source.y) < this.nearR;
    const nearTgt = Math.hypot(this.s.x - this.target.x, this.s.y - this.target.y) < this.nearR + 40;

    if (!this.carrying) {
      const hold = this.holdP;
      const base = 0.16 + 0.1 * Math.sin(t * 4.2);
      const nearA = 0.4 + 0.12 * Math.sin(t * 6) + 0.45 * hold;
      this.sourceGlow?.setAlpha(nearSrc || hold > 0.01 ? nearA : base);
      if (nearSrc || hold > 0.01) {
        const p = placeChip(this.source.x, this.source.y, this.s.x, this.s.y, 34, 6);
        this.chip?.show(p.x, p.y, this.verb, hold, 'E');
      } else this.chip?.hide();
      this.targetGlow?.setAlpha(0);
      this.targetGlyph?.setAlpha(0);
      if (nearSrc) this.onNearSource?.();
    } else {
      this.sourceGlow?.setAlpha(0);
      this.targetGlow?.setAlpha(0);
      this.targetGlyph?.setAlpha(0);
      if (nearTgt) {
        const p = placeChip(this.target.x, this.target.y, this.s.x, this.s.y, 34, 6);
        this.chip?.show(p.x, p.y, 'throw', 0, 'F');
      } else this.chip?.hide();
    }
  }

  destroy() {
    this.destroyed = true;
    this.sourceGlow?.destroy();
    this.targetGlow?.destroy();
    this.targetGlyph?.destroy();
    this.chip?.destroy();
  }
}
