// Reusable hit-feel tiers. LIGHT = freeze+spark+tint (no zoom/flash).
// HEAVY/BIG = silhouette of real sprite alpha (Noor / chain / gust) — never a door rect.
import Phaser from 'phaser';
import type { GameScene } from '../game';
import { sfx } from '../sfx';

export type ImpactTierName = 'light' | 'heavy' | 'big';

export interface ImpactTier {
  name: ImpactTierName;
  hitStopMs: number;
  punchZoom: number;
  punchHoldMs: number;
  punchEaseMs: number;
  shakeAmp: number;
  shakeMs: number;
  silFrames: number;
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
    sparkScale: 0.95, knockback: 14,
  },
  big: {
    name: 'big', hitStopMs: 200, punchZoom: 1.06, punchHoldMs: 120, punchEaseMs: 380,
    shakeAmp: 0.016, shakeMs: 240, silFrames: 2, silMs: 120, slowMo: 0.45, slowMoMs: 280,
    sparkScale: 1.2, knockback: 20,
  },
};

export interface ImpactOpts {
  tier: ImpactTierName;
  x: number; y: number;
  dir?: { x: number; y: number };
  /** Optional tint/squash target — must have real alpha (sprite/image with transparency). JPG doors are rejected. */
  target?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  attacker?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  /** Extra silhouette sources (chain links, gust) — preferred over door. */
  silhouettes?: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Image)[];
  onHitStopEnd?: () => void;
}

const FAILSAFE_MS = 400;

export class ImpactFX {
  private veil?: Phaser.GameObjects.Rectangle;
  private silSprites: Phaser.GameObjects.Image[] = [];
  private lines?: Phaser.GameObjects.Graphics;
  private punchTw?: Phaser.Tweens.Tween;
  private baseZoom = 1;
  private sparkSpr?: Phaser.GameObjects.Sprite;
  private resumeTimer?: ReturnType<typeof setTimeout>;

  constructor(private s: GameScene) {}

  fire(opts: ImpactOpts) {
    const t = TIERS[opts.tier];
    const dir = opts.dir ?? { x: 1, y: 0 };
    const L = Math.hypot(dir.x, dir.y) || 1;
    const dx = dir.x / L, dy = dir.y / L;

    // Hit-stop via scene clock + REAL-TIME failsafe (never leave the game frozen)
    this.s.hitStopT = Math.max(this.s.hitStopT, t.hitStopMs / 1000);
    try { this.s.noor.anims.pause(); } catch { /* */ }

    this.burstSpark(opts.x, opts.y, dx, dy, t.sparkScale);

    // Only tint/squash targets with usable alpha (skip JPG door plates)
    if (opts.target && this.hasAlpha(opts.target)) this.hitTarget(opts.target, dx, dy, t);

    const cam = this.s.cameras.main;
    this.baseZoom = this.s.frameZoom || cam.zoom || 1;
    if (t.shakeAmp > 0) {
      cam.shake(t.shakeMs, t.shakeAmp);
      const kick = (opts.tier === 'light' ? 2.5 : 6) * (t.shakeAmp / 0.008);
      cam.scrollX += dx * kick;
      cam.scrollY += dy * kick * 0.4;
    }
    if (t.punchZoom > 1.001) {
      const targetZ = this.baseZoom * t.punchZoom;
      this.punchTw?.stop();
      cam.setZoom(targetZ);
      // Ease-back on real time so a paused Phaser clock can't strand zoom
      window.setTimeout(() => {
        try {
          this.punchTw = this.s.tweens.add({
            targets: cam, zoom: this.baseZoom, duration: t.punchEaseMs, ease: 'Sine.easeInOut',
            onComplete: () => { try { cam.setZoom(this.baseZoom); cam.centerOn(640, 360); } catch { /* */ } },
          });
        } catch { try { cam.setZoom(this.baseZoom); } catch { /* */ } }
      }, t.punchHoldMs + Math.min(t.hitStopMs, 120));
    }

    if (t.silFrames > 0) {
      this.runSilhouetteFrames(t, opts, dx, dy);
      this.speedLines(opts.x, opts.y, dx, dy, opts.tier === 'big' ? 12 : 8);
    }

    // Resume schedule: real-time timer (independent of Phaser timeScale / hitStop)
    const totalMs = t.slowMo < 1 ? t.hitStopMs + t.slowMoMs : t.hitStopMs;
    this.armResume(Math.min(totalMs, FAILSAFE_MS), t, opts);
    // Also start soft slow-mo after hit-stop via real time
    if (t.slowMo < 1) {
      window.setTimeout(() => {
        if (this.s.hitStopT > 0) this.s.hitStopT = 0;
        this.s.timeScale = t.slowMo;
      }, t.hitStopMs);
    }

    if (opts.tier === 'light') sfx('hit');
    else if (opts.tier === 'heavy') sfx('impact_heavy');
    else sfx('impact_big');
  }

  /** Always clear hit-stop / timeScale / anims — real wall clock. */
  private armResume(ms: number, t: ImpactTier, opts: ImpactOpts) {
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = undefined;
      this.s.hitStopT = 0;
      this.s.timeScale = 1;
      try { this.s.noor.anims.resume(); } catch { /* */ }
      this.clearSil();
      opts.onHitStopEnd?.();
    }, Math.min(ms, FAILSAFE_MS));
  }

  /** JPG / opaque full-bleed textures silhouette as a grey rect — reject those. */
  private hasAlpha(src: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): boolean {
    try {
      const key = src.texture?.key ?? '';
      // Door lift frames are JPEGs under o11door_*
      if (key.startsWith('o11door_')) return false;
      const srcImg = src.texture?.getSourceImage?.() as HTMLImageElement | HTMLCanvasElement | undefined;
      if (!srcImg) return true;
      // Heuristic: jpeg paths / no canvas alpha
      const url = (srcImg as HTMLImageElement).src ?? '';
      if (/\.jpe?g($|\?)/i.test(url)) return false;
      return true;
    } catch { return false; }
  }

  private hitTarget(
    spr: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    dx: number, dy: number, t: ImpactTier,
  ) {
    const ox = spr.x, oy = spr.y, sx = spr.scaleX, sy = spr.scaleY;
    spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    window.setTimeout(() => { try { spr.clearTint(); spr.setTintMode(Phaser.TintModes.MULTIPLY); } catch { /* */ } }, 55);
    const kb = t.knockback;
    this.s.tweens.add({
      targets: spr,
      x: ox + dx * kb, y: oy + dy * kb * 0.3,
      scaleX: sx * 1.1, scaleY: sy * 0.85,
      duration: 50, ease: 'Quad.easeOut',
      onComplete: () => {
        this.s.tweens.add({
          targets: spr, x: ox + dx * kb * 0.35, y: oy, scaleX: sx, scaleY: sy,
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
      .setDepth(8500).setScale(scale).setAngle(ang);
    this.sparkSpr = sp;
    let fi = 0;
    const tick = () => {
      fi++;
      if (fi < 4 && this.s.textures.exists('fx_hit_spark_' + fi)) sp.setTexture('fx_hit_spark_' + fi);
      else { try { sp.destroy(); } catch { /* */ } if (this.sparkSpr === sp) this.sparkSpr = undefined; return; }
      window.setTimeout(tick, 40);
    };
    window.setTimeout(tick, 40);
  }

  private runSilhouetteFrames(t: ImpactTier, opts: ImpactOpts, dx: number, dy: number) {
    this.clearSil();
    this.veil = this.s.add.rectangle(640, 360, 1280, 720, 0x05080c, 0.72)
      .setScrollFactor(0).setDepth(8800);

    const sources: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Image)[] = [];
    const atk = opts.attacker ?? this.s.noor;
    if (atk) sources.push(atk);
    for (const s of opts.silhouettes ?? []) if (s && this.hasAlpha(s)) sources.push(s);
    // Never add door JPG as silhouette
    if (opts.target && this.hasAlpha(opts.target)) sources.push(opts.target);

    const drawSil = (invert: boolean) => {
      this.clearSilSpritesOnly();
      const fill = invert ? 0x0a0c10 : 0xffffff;
      if (this.veil) this.veil.setFillStyle(invert ? 0xf2f0ea : 0x05080c, invert ? 0.9 : 0.72);
      for (const src of sources) {
        const frame = (src as Phaser.GameObjects.Sprite).frame?.name;
        const im = this.s.add.image(src.x, src.y, src.texture.key, frame)
          .setOrigin(src.originX, src.originY)
          .setScale(src.scaleX, src.scaleY)
          .setFlip(src.flipX, src.flipY)
          .setAngle(src.angle)
          .setDepth(8900);
        im.setTint(fill).setTintMode(Phaser.TintModes.FILL);
        this.silSprites.push(im);
      }
      if (this.s.textures.exists('fx_hit_spark_0')) {
        const ang = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
        const sp = this.s.add.image(opts.x, opts.y, 'fx_hit_spark_0')
          .setDepth(8950).setScale(TIERS[opts.tier].sparkScale).setAngle(ang);
        sp.setTint(fill).setTintMode(Phaser.TintModes.FILL);
        this.silSprites.push(sp);
      }
    };

    drawSil(false);
    if (t.silFrames >= 2) {
      window.setTimeout(() => {
        drawSil(true);
        window.setTimeout(() => this.clearSil(), t.silMs);
      }, t.silMs);
    } else {
      window.setTimeout(() => this.clearSil(), t.silMs);
    }
  }

  private speedLines(x: number, y: number, dx: number, dy: number, n: number) {
    this.lines?.destroy();
    const g = this.s.add.graphics().setDepth(8750);
    this.lines = g;
    const base = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
    for (let i = 0; i < n; i++) {
      const a = Phaser.Math.DegToRad(base + (i - n / 2) * 14 + (i % 2 ? 5 : -5));
      const r0 = 24 + (i % 3) * 8;
      const r1 = r0 + 36 + (i % 2) * 16;
      g.lineStyle(3.2 - (i % 3) * 0.5, 0xffffff, 0.8);
      g.lineBetween(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    }
    window.setTimeout(() => {
      try { this.s.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() }); }
      catch { try { g.destroy(); } catch { /* */ } }
    }, 50);
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
    window.setTimeout(() => { try { em.destroy(); } catch { /* */ } }, 600);
  }
}
