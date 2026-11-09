// Reusable hit-feel tiers (docs/design/impact-spec.md). Phaser 4.
import Phaser from 'phaser';
import type { GameScene } from '../game';
import { sfx } from '../sfx';

export type ImpactTierName = 'light' | 'heavy' | 'big';

export interface ImpactTier {
  name: ImpactTierName;
  hitStopMs: number;
  punchZoom: number;
  punchMs: number;
  shakeAmp: number;
  shakeMs: number;
  flashMs: number;
  flashAlpha: number;
  silFrames: number;
  silMs: number;
  slowMo: number;
  slowMoMs: number;
  sparkScale: number;
}

export const TIERS: Record<ImpactTierName, ImpactTier> = {
  light: { name: 'light', hitStopMs: 70, punchZoom: 1.08, punchMs: 120, shakeAmp: 0.003, shakeMs: 70, flashMs: 40, flashAlpha: 0.18, silFrames: 0, silMs: 0, slowMo: 1, slowMoMs: 0, sparkScale: 0.5 },
  // Flash kept to 1–2 short frames; Noor + door stay readable
  heavy: { name: 'heavy', hitStopMs: 110, punchZoom: 1.22, punchMs: 220, shakeAmp: 0.009, shakeMs: 140, flashMs: 55, flashAlpha: 0.22, silFrames: 2, silMs: 42, slowMo: 0.5, slowMoMs: 260, sparkScale: 0.95 },
  big:   { name: 'big',   hitStopMs: 140, punchZoom: 1.32, punchMs: 280, shakeAmp: 0.012, shakeMs: 180, flashMs: 60, flashAlpha: 0.28, silFrames: 2, silMs: 45, slowMo: 0.4, slowMoMs: 340, sparkScale: 1.2 },
};

export interface ImpactOpts {
  tier: ImpactTierName;
  x: number; y: number;
  dir?: { x: number; y: number };
  target?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  onHitStopEnd?: () => void;
  /** When false (chain break), Matter keeps stepping so debris flies during hit-stop. Default true for light. */
  pausePhysics?: boolean;
}

export class ImpactFX {
  private flash?: Phaser.GameObjects.Rectangle;
  private sil?: Phaser.GameObjects.Rectangle;
  private punchTw?: Phaser.Tweens.Tween;
  private baseZoom = 1;

  constructor(private s: GameScene) {}

  fire(opts: ImpactOpts) {
    const t = TIERS[opts.tier];
    const dir = opts.dir ?? { x: -1, y: 0 };
    const L = Math.hypot(dir.x, dir.y) || 1;
    const dx = dir.x / L, dy = dir.y / L;
    const pausePhys = opts.pausePhysics !== false && opts.tier === 'light';

    this.s.hitStopT = Math.max(this.s.hitStopT, t.hitStopMs / 1000);
    try { this.s.noor.anims.pause(); } catch { /* */ }
    if (pausePhys) {
      try { this.s.matter?.world?.pause?.(); } catch { /* */ }
      this.s.time.delayedCall(t.hitStopMs, () => { try { this.s.matter?.world?.resume?.(); } catch { /* */ } });
    }

    // Short readable flash (1–2 frames feel) — low alpha, fast fade
    this.flash?.destroy();
    this.flash = this.s.add.rectangle(640, 360, 1280, 720, 0xffffff, t.flashAlpha)
      .setScrollFactor(0).setDepth(9000).setBlendMode(Phaser.BlendModes.ADD);
    this.s.tweens.add({ targets: this.flash, alpha: 0, duration: t.flashMs, onComplete: () => this.flash?.destroy() });

    const cam = this.s.cameras.main;
    this.baseZoom = cam.zoom || 1;
    // Soft punch — keep framing readable (no hard pan off the room)
    const targetZ = this.baseZoom * t.punchZoom;
    this.punchTw?.stop();
    this.punchTw = this.s.tweens.add({
      targets: cam, zoom: targetZ, duration: t.punchMs * 0.35, ease: 'Sine.easeOut',
      onComplete: () => {
        this.s.tweens.add({ targets: cam, zoom: this.baseZoom, duration: t.punchMs * 0.65, ease: 'Sine.easeInOut' });
      },
    });
    cam.shake(t.shakeMs, t.shakeAmp);
    // Soft directional kick without shifting the room into a side pillar
    const kick = 3 * t.shakeAmp * 100;
    cam.scrollX += dx * kick * 0.35; cam.scrollY += dy * kick * 0.35;

    if (opts.target) {
      const spr = opts.target;
      spr.setTint(0xffffff);
      this.s.time.delayedCall(t.hitStopMs * 0.5, () => { try { spr.clearTint(); } catch { /* */ } });
    }

    this.burstSpark(opts.x, opts.y, dx, dy, t.sparkScale);
    if (t.silFrames > 0) this.runSilFrames(t);

    if (t.slowMo < 1) {
      this.s.time.delayedCall(t.hitStopMs, () => {
        this.s.timeScale = t.slowMo;
        this.s.time.delayedCall(t.slowMoMs, () => {
          this.s.timeScale = 1;
          try { this.s.noor.anims.resume(); } catch { /* */ }
          opts.onHitStopEnd?.();
        });
      });
    } else {
      this.s.time.delayedCall(t.hitStopMs, () => {
        try { this.s.noor.anims.resume(); } catch { /* */ }
        opts.onHitStopEnd?.();
      });
    }

    if (opts.tier === 'light') sfx('hit');
    else if (opts.tier === 'heavy') sfx('impact_heavy');
    else sfx('impact_big');
  }

  private burstSpark(x: number, y: number, dx: number, dy: number, scale: number) {
    if (this.s.textures.exists('fx_spark_core')) {
      const em = this.s.add.particles(x, y, 'fx_spark_core', {
        speed: { min: 90 * scale, max: 240 * scale },
        angle: { min: Phaser.Math.RadToDeg(Math.atan2(dy, dx)) - 55, max: Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 55 },
        scale: { start: 0.7 * scale, end: 0.05 },
        alpha: { start: 1, end: 0 },
        lifespan: 240,
        quantity: 8,
        blendMode: 'ADD',
        emitting: false,
      });
      em.explode(12);
      this.s.time.delayedCall(350, () => em.destroy());
    }

    // Comic hard-edged spark (NORMAL blend so the dark outline reads)
    if (this.s.textures.exists('fx_hit_spark_0')) {
      const sp = this.s.add.sprite(x, y, 'fx_hit_spark_0')
        .setDepth(8000).setScale(scale * 0.95).setBlendMode(Phaser.BlendModes.NORMAL);
      let fi = 0;
      this.s.time.addEvent({
        delay: 38, repeat: 3, callback: () => {
          fi++;
          if (fi < 4 && this.s.textures.exists('fx_hit_spark_' + fi)) sp.setTexture('fx_hit_spark_' + fi);
          else sp.destroy();
        },
      });
    }
  }

  /** 1–2 brief high-contrast frames — keep Noor + door readable (no full bleach). */
  private runSilFrames(t: ImpactTier) {
    this.sil?.destroy();
    // Frame 1: light warm add
    this.sil = this.s.add.rectangle(640, 360, 1280, 720, 0xffe0c0, 0.18)
      .setScrollFactor(0).setDepth(8900).setBlendMode(Phaser.BlendModes.ADD);
    this.s.time.delayedCall(t.silMs, () => {
      if (!this.sil) return;
      // Frame 2: mild dark multiply (graphic cut without invert washout)
      this.sil.setFillStyle(0x101820, 0.28).setBlendMode(Phaser.BlendModes.MULTIPLY);
      this.s.time.delayedCall(t.silMs, () => { this.sil?.destroy(); this.sil = undefined; });
    });
  }

  dust(x: number, y: number, dir: { x: number; y: number }, n = 8) {
    if (!this.s.textures.exists('fx_dust_puff')) return;
    const em = this.s.add.particles(x, y, 'fx_dust_puff', {
      speed: { min: 20, max: 70 },
      angle: { min: -20, max: 20 },
      scale: { start: 0.55, end: 1.2 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 480,
      gravityY: 40,
      emitting: false,
    });
    em.setParticleSpeed(dir.x * 40, dir.y * 20);
    em.explode(n);
    this.s.time.delayedCall(600, () => em.destroy());
  }
}
