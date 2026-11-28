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

    // No disc/oval glows — the chip is the only lure mark.
    void sg; void tg;
    this.sourceGlow = undefined;
    this.targetGlow = undefined;

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
    // Don't show the peel lure on a target while the Caret is parked / traveling / firing at it.
    const gs = this.s;
    const aiming = gs.caretOwned && (gs.caretMode === 'sent' || gs.caretMode === 'travel' || gs.atkPending || gs.swingT > 0 || gs.selecting);
    if (aiming) {
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
        this.keepOffCards(p);
      } else this.chip?.hide();
    }
  }

  /** GB-4: the F THROW chip never sits on a staff ID card (or the Caret parked beside it). */
  private keepOffCards(p: { x: number; y: number }) {
    const c = this.chip; if (!c) return;
    const keep = (this.s as unknown as { hintKeepOut?: () => { x0: number; y0: number; x1: number; y1: number }[] }).hintKeepOut?.() ?? [];
    if (!keep.length) return;
    const b = c.root.getBounds(); const dx = b.x - c.root.x, dy = b.y - c.root.y, bw = b.width, bh = b.height;
    const hits = (L: number, T: number) => keep.some(k => L < k.x1 && L + bw > k.x0 && T < k.y1 && T + bh > k.y0);
    if (!hits(b.x, b.y)) return;
    const k = keep[0];
    const cands = [[k.x0 + 4, k.y1 + 6], [k.x0 - bw - 6, b.y], [k.x1 + 6, b.y], [k.x0 + 4, k.y0 - bh - 6], [k.x0 + 4, k.y1 + 40]];
    for (const [L, T] of cands) if (!hits(L, T) && L > 8 && L + bw < 1272 && T > 8 && T + bh < 712) { c.root.setPosition(L - dx, T - dy); return; }
    void p;
  }

  chipState() {
    const shown = !!this.chip?.isShown();
    const b = shown && this.chip ? this.chip.root.getBounds() : null;
    return { visible: shown, verb: shown ? (this.chip?.currentVerb() ?? '') : '', key: shown ? (this.chip?.currentKey() ?? '') : '', carrying: this.carrying, box: b ? { x0: b.x, y0: b.y, x1: b.right, y1: b.bottom } : null };
  }

  destroy() {
    this.destroyed = true;
    this.sourceGlow?.destroy();
    this.targetGlow?.destroy();
    this.targetGlyph?.destroy();
    this.chip?.destroy();
  }
}
