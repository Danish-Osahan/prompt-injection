// Reusable hit-feel tiers (docs/design/impact-spec.md). Phaser 4.
// LIGHT = freeze + spark + tint (no zoom / no screen flash).
// HEAVY/BIG = true silhouette impact frames of attacker+target+spark, not a screen wash.
import Phaser from 'phaser';
import type { GameScene } from '../game';
import { sfx } from '../sfx';

export type ImpactTierName = 'light' | 'heavy' | 'big';

export interface ImpactTier {
  name: ImpactTierName;
  hitStopMs: number;
  punchZoom: number;   // 1 = none; heavy ≤1.05 held; big a bit more
  punchHoldMs: number; // time at punch before ease-back
  punchEaseMs: number; // slow ease back
  shakeAmp: number;
  shakeMs: number;
  silFrames: number;   // 0 / 1 / 2 true silhouette frames
  silMs: number;
  slowMo: number;
  slowMoMs: number;
  sparkScale: number;
  knockback: number;
}

export const TIERS: Record<ImpactTierName, ImpactTier> = {
  light: {
    name: 'light', hitStopMs: 60, punchZoom: 1, punchHoldMs: 0, punchEaseMs: 0,
    shakeAmp: 0.0015, shakeMs: 40, silFrames: 0, silMs: 0, slowMo: 1, slowMoMs: 0,
    sparkScale: 0.55, knockback: 10,
  },
  heavy: {
    name: 'heavy', hitStopMs: 120, punchZoom: 1.04, punchHoldMs: 80, punchEaseMs: 300,
    shakeAmp: 0.008, shakeMs: 140, silFrames: 1, silMs: 70, slowMo: 1, slowMoMs: 0,
    sparkScale: 0.95, knockback: 18,
  },
  big: {
    name: 'big', hitStopMs: 190, punchZoom: 1.06, punchHoldMs: 120, punchEaseMs: 380,
    shakeAmp: 0.014, shakeMs: 220, silFrames: 2, silMs: 70, slowMo: 0.4, slowMoMs: 360,
    sparkScale: 1.25, knockback: 26,
  },
};

export interface ImpactOpts {
  tier: ImpactTierName;
  x: number; y: number;
  dir?: { x: number; y: number };
  /** Target sprite/image to tint, squash, and silhouette. */
  target?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  /** Attacker (usually Noor) — frozen + silhouetted with the target. */
  attacker?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  onHitStopEnd?: () => void;
  pausePhysics?: boolean;
}

export class ImpactFX {
  private veil?: Phaser.GameObjects.Rectangle;
  private silSprites: Phaser.GameObjects.Image[] = [];
  private lines?: Phaser.GameObjects.Graphics;
  private punchTw?: Phaser.Tweens.Tween;
  private baseZoom = 1;
  private sparkSpr?: Phaser.GameObjects.Sprite;

  constructor(private s: GameScene) {}

  fire(opts: ImpactOpts) {
    const t = TIERS[opts.tier];
    const dir = opts.dir ?? { x: 1, y: 0 };
    const L = Math.hypot(dir.x, dir.y) || 1;
    const dx = dir.x / L, dy = dir.y / L;

    // --- Hit-stop: freeze attacker/target pose so the eye registers contact ---
    this.s.hitStopT = Math.max(this.s.hitStopT, t.hitStopMs / 1000);
    try { this.s.noor.anims.pause(); } catch { /* */ }
    if (opts.attacker && 'anims' in opts.attacker) {
      try { (opts.attacker as Phaser.GameObjects.Sprite).anims.pause(); } catch { /* */ }
    }

    // --- Spark first so it exists during the freeze ---
    this.burstSpark(opts.x, opts.y, dx, dy, t.sparkScale);

    // --- Target white flash (1–2 frames) + knockback squash ---
    if (opts.target) this.hitTarget(opts.target, dx, dy, t);

    // --- Camera: light = tiny shake only; heavy/big = directional shake + optional held punch-in ---
    const cam = this.s.cameras.main;
    this.baseZoom = this.s.frameZoom || cam.zoom || 1;
    if (t.shakeAmp > 0) {
      cam.shake(t.shakeMs, t.shakeAmp);
      // tiny directional bias (light ≈ 2–3px)
      const kick = (opts.tier === 'light' ? 2.5 : 7) * (t.shakeAmp / 0.008);
      cam.scrollX += dx * kick;
      cam.scrollY += dy * kick * 0.5;
    }
    if (t.punchZoom > 1.001) {
      // Held punch-in, then slow ease-back — never a snap in/out
      const targetZ = this.baseZoom * t.punchZoom;
      this.punchTw?.stop();
      cam.setZoom(targetZ);
      this.s.time.delayedCall(t.punchHoldMs + t.hitStopMs * 0.3, () => {
        this.punchTw = this.s.tweens.add({
          targets: cam, zoom: this.baseZoom, duration: t.punchEaseMs, ease: 'Sine.easeInOut',
          onComplete: () => { try { cam.setZoom(this.baseZoom); cam.centerOn(640, 360); } catch { /* */ } },
        });
      });
    }

    // --- True silhouette impact frames (attacker + target + spark only) ---
    if (t.silFrames > 0) {
      this.runSilhouetteFrames(t, opts, dx, dy);
      if (opts.tier !== 'light') this.speedLines(opts.x, opts.y, dx, dy, opts.tier === 'big' ? 14 : 10);
    }

    // --- Slow-mo ease back (big) ---
    const end = () => {
      try { this.s.noor.anims.resume(); } catch { /* */ }
      opts.onHitStopEnd?.();
    };
    if (t.slowMo < 1) {
      this.s.time.delayedCall(t.hitStopMs, () => {
        this.s.timeScale = t.slowMo;
        this.s.time.delayedCall(t.slowMoMs, () => { this.s.timeScale = 1; end(); });
      });
    } else {
      this.s.time.delayedCall(t.hitStopMs, end);
    }

    if (opts.tier === 'light') sfx('hit');
    else if (opts.tier === 'heavy') sfx('impact_heavy');
    else sfx('impact_big');
  }

  private hitTarget(
    spr: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    dx: number, dy: number, t: ImpactTier,
  ) {
    const ox = spr.x, oy = spr.y, sx = spr.scaleX, sy = spr.scaleY;
    // White fill flash for ~2 frames (~50–70ms)
    spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.s.time.delayedCall(55, () => { try { spr.clearTint(); spr.setTintMode(Phaser.TintModes.MULTIPLY); } catch { /* */ } });
    // Knockback + squash
    const kb = t.knockback;
    this.s.tweens.add({
      targets: spr,
      x: ox + dx * kb,
      y: oy + dy * kb * 0.35,
      scaleX: sx * 1.12,
      scaleY: sy * 0.82,
      duration: 50,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.s.tweens.add({
          targets: spr, x: ox + dx * kb * 0.4, y: oy, scaleX: sx, scaleY: sy,
          duration: 120, ease: 'Sine.easeOut',
        });
      },
    });
  }

  private burstSpark(x: number, y: number, dx: number, dy: number, scale: number) {
    this.sparkSpr?.destroy();
    if (!this.s.textures.exists('fx_hit_spark_0')) return;
    const ang = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
    const sp = this.s.add.sprite(x, y, 'fx_hit_spark_0')
      .setDepth(8500).setScale(scale).setAngle(ang)
      .setBlendMode(Phaser.BlendModes.NORMAL);
    this.sparkSpr = sp;
    let fi = 0;
    this.s.time.addEvent({
      delay: 40, repeat: 3, callback: () => {
        fi++;
        if (fi < 4 && this.s.textures.exists('fx_hit_spark_' + fi)) sp.setTexture('fx_hit_spark_' + fi);
        else { sp.destroy(); if (this.sparkSpr === sp) this.sparkSpr = undefined; }
      },
    });
  }

  /**
   * True impact frames: darken the scene, draw solid silhouettes of attacker + target + spark.
   * Frame 1 = white silhouettes on dark; frame 2 (big) = inverted (black on light).
   */
  private runSilhouetteFrames(t: ImpactTier, opts: ImpactOpts, dx: number, dy: number) {
    this.clearSil();
    // Darken everything else
    this.veil = this.s.add.rectangle(640, 360, 1280, 720, 0x05080c, 0.78)
      .setScrollFactor(0).setDepth(8800);

    const drawSil = (invert: boolean) => {
      this.clearSilSpritesOnly();
      const fill = invert ? 0x0a0c10 : 0xffffff;
      if (invert && this.veil) this.veil.setFillStyle(0xf2f0ea, 0.92);
      else if (this.veil) this.veil.setFillStyle(0x05080c, 0.78);

      const addSil = (src?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image) => {
        if (!src || !src.texture) return;
        const frame = (src as Phaser.GameObjects.Sprite).frame?.name;
        const im = this.s.add.image(src.x, src.y, src.texture.key, frame)
          .setOrigin(src.originX, src.originY)
          .setScale(src.scaleX, src.scaleY)
          .setFlip(src.flipX, src.flipY)
          .setAngle(src.angle)
          .setDepth(8900);
        im.setTint(fill).setTintMode(Phaser.TintModes.FILL);
        this.silSprites.push(im);
      };
      addSil(opts.attacker ?? this.s.noor);
      addSil(opts.target);
      // Spark as hard white/black burst at contact
      if (this.s.textures.exists('fx_hit_spark_0')) {
        const ang = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
        const sp = this.s.add.image(opts.x, opts.y, 'fx_hit_spark_0')
          .setDepth(8950).setScale(TIERS[opts.tier].sparkScale * 1.05).setAngle(ang);
        sp.setTint(fill).setTintMode(Phaser.TintModes.FILL);
        this.silSprites.push(sp);
      }
    };

    drawSil(false);
    if (t.silFrames >= 2) {
      this.s.time.delayedCall(t.silMs, () => {
        drawSil(true);
        this.s.time.delayedCall(t.silMs, () => this.clearSil());
      });
    } else {
      this.s.time.delayedCall(t.silMs, () => this.clearSil());
    }
  }

  private speedLines(x: number, y: number, dx: number, dy: number, n: number) {
    this.lines?.destroy();
    const g = this.s.add.graphics().setDepth(8750);
    this.lines = g;
    const base = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
    for (let i = 0; i < n; i++) {
      const a = Phaser.Math.DegToRad(base + (i - n / 2) * 14 + (i % 2 ? 5 : -5));
      const r0 = 28 + (i % 3) * 8;
      const r1 = r0 + 38 + (i % 2) * 18;
      g.lineStyle(3.5 - (i % 3) * 0.6, 0xffffff, 0.85);
      g.lineBetween(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    }
    this.s.tweens.add({
      targets: g, alpha: 0, duration: 180, delay: 40,
      onComplete: () => { g.destroy(); if (this.lines === g) this.lines = undefined; },
    });
  }

  private clearSilSpritesOnly() {
    for (const im of this.silSprites) im.destroy();
    this.silSprites = [];
  }
  private clearSil() {
    this.clearSilSpritesOnly();
    this.veil?.destroy(); this.veil = undefined;
  }

  dust(x: number, y: number, dir: { x: number; y: number }, n = 8) {
    if (!this.s.textures.exists('fx_dust_puff')) return;
    const em = this.s.add.particles(x, y, 'fx_dust_puff', {
      speed: { min: 20, max: 70 }, angle: { min: -20, max: 20 },
      scale: { start: 0.55, end: 1.2 }, alpha: { start: 0.5, end: 0 },
      lifespan: 480, gravityY: 40, emitting: false,
    });
    em.setParticleSpeed(dir.x * 40, dir.y * 20);
    em.explode(n);
    this.s.time.delayedCall(600, () => em.destroy());
  }
}
