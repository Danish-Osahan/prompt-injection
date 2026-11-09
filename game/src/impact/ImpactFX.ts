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
  silFrames: number;       // 0–2 high-contrast frames
  silMs: number;           // per sil frame
  slowMo: number;          // timeScale during follow-through
  slowMoMs: number;
  sparkScale: number;
}

export const TIERS: Record<ImpactTierName, ImpactTier> = {
  light: { name: 'light', hitStopMs: 90, punchZoom: 1.12, punchMs: 140, shakeAmp: 0.004, shakeMs: 80, flashMs: 50, flashAlpha: 0.25, silFrames: 0, silMs: 0, slowMo: 1, slowMoMs: 0, sparkScale: 0.55 },
  heavy: { name: 'heavy', hitStopMs: 130, punchZoom: 1.35, punchMs: 280, shakeAmp: 0.012, shakeMs: 180, flashMs: 90, flashAlpha: 0.45, silFrames: 2, silMs: 50, slowMo: 0.45, slowMoMs: 320, sparkScale: 1.0 },
  big:   { name: 'big',   hitStopMs: 170, punchZoom: 1.55, punchMs: 360, shakeAmp: 0.018, shakeMs: 260, flashMs: 110, flashAlpha: 0.55, silFrames: 2, silMs: 55, slowMo: 0.35, slowMoMs: 420, sparkScale: 1.35 },
};

export interface ImpactOpts {
  tier: ImpactTierName;
  x: number; y: number;
  dir?: { x: number; y: number };
  target?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  onHitStopEnd?: () => void;
}

/** Global impact director — hit-stop freezes scene sim via GameScene.hitStopT while FX keep ticking. */
export class ImpactFX {
  private flash?: Phaser.GameObjects.Rectangle;
  private sil?: Phaser.GameObjects.Rectangle;
  private silInvert = false;
  private punchTw?: Phaser.Tweens.Tween;
  private baseZoom = 1;
  private fxAlive = false;

  constructor(private s: GameScene) {}

  /** Fire a tiered impact at world point. */
  fire(opts: ImpactOpts) {
    const t = TIERS[opts.tier];
    const dir = opts.dir ?? { x: -1, y: 0 };
    const L = Math.hypot(dir.x, dir.y) || 1;
    const dx = dir.x / L, dy = dir.y / L;

    // Hit-stop: freeze sim (edt=0 in update) + Matter + tweens; FX keep animating via scene.time
    this.s.hitStopT = Math.max(this.s.hitStopT, t.hitStopMs / 1000);
    try { this.s.noor.anims.pause(); } catch { /* */ }
    try { this.s.matter?.world?.pause?.(); } catch { /* */ }
    try { this.s.tweens.pauseAll(); } catch { /* */ }
    this.s.time.delayedCall(t.hitStopMs, () => {
      try { this.s.matter?.world?.resume?.(); } catch { /* */ }
      try { this.s.tweens.resumeAll(); } catch { /* */ }
    });

    // Full-screen flash (UI camera space)
    this.flash?.destroy();
    this.flash = this.s.add.rectangle(640, 360, 1280, 720, 0xffffff, t.flashAlpha)
      .setScrollFactor(0).setDepth(9000).setBlendMode(Phaser.BlendModes.ADD);
    this.s.tweens.add({ targets: this.flash, alpha: 0, duration: t.flashMs, onComplete: () => this.flash?.destroy() });

    // Camera punch-zoom toward contact + directional shake
    const cam = this.s.cameras.main;
    this.baseZoom = cam.zoom;
    const targetZ = this.baseZoom * t.punchZoom;
    cam.pan(opts.x, opts.y + 40, Math.min(60, t.punchMs * 0.25), 'Sine.easeOut');
    this.punchTw?.stop();
    this.punchTw = this.s.tweens.add({
      targets: cam, zoom: targetZ, duration: t.punchMs * 0.35, ease: 'Sine.easeOut',
      yoyo: false,
      onComplete: () => {
        this.s.tweens.add({ targets: cam, zoom: this.baseZoom, duration: t.punchMs * 0.65, ease: 'Sine.easeInOut' });
      },
    });
    // Directional shake: bias along hit vector
    cam.shake(t.shakeMs, t.shakeAmp);
    // Phaser shake is isotropic; add a short pan kick along dir
    const kick = 10 * t.shakeAmp * 100;
    cam.scrollX += dx * kick; cam.scrollY += dy * kick;

    // Target white flash
    if (opts.target) {
      const spr = opts.target;
      const prev = spr.tintTopLeft;
      spr.setTint(0xffffff);
      this.s.time.delayedCall(t.hitStopMs * 0.6, () => { try { spr.clearTint(); } catch { /* */ } });
      void prev;
    }

    // Spark particles
    this.burstSpark(opts.x, opts.y, dx, dy, t.sparkScale);

    // Silhouette / invert frames from live scene (approx via colour overlay + invert post)
    if (t.silFrames > 0) this.runSilFrames(t);

    // Slow-mo after hit-stop
    if (t.slowMo < 1) {
      this.s.time.delayedCall(t.hitStopMs, () => {
        this.s.timeScale = t.slowMo;
        this.s.time.delayedCall(t.slowMoMs, () => { this.s.timeScale = 1; opts.onHitStopEnd?.(); });
      });
    } else {
      this.s.time.delayedCall(t.hitStopMs, () => { try { this.s.noor.anims.resume(); } catch { /* */ }; opts.onHitStopEnd?.(); });
    }

    if (opts.tier === 'light') sfx('hit');
    else if (opts.tier === 'heavy') sfx('impact_heavy');
    else sfx('impact_big');
  }

  private burstSpark(x: number, y: number, dx: number, dy: number, scale: number) {
    if (!this.s.textures.exists('fx_spark_core')) return;
    const em = this.s.add.particles(x, y, 'fx_spark_core', {
      speed: { min: 80 * scale, max: 220 * scale },
      angle: { min: Phaser.Math.RadToDeg(Math.atan2(dy, dx)) - 50, max: Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 50 },
      scale: { start: 0.9 * scale, end: 0.05 },
      alpha: { start: 1, end: 0 },
      lifespan: 280,
      quantity: 10,
      blendMode: 'ADD',
      emitting: false,
    });
    em.explode(14);
    this.s.time.delayedCall(400, () => em.destroy());

    // Animated spark sprite
    if (this.s.textures.exists('fx_hit_spark_0')) {
      const sp = this.s.add.sprite(x, y, 'fx_hit_spark_0').setDepth(8000).setScale(scale * 1.1).setBlendMode(Phaser.BlendModes.ADD);
      let fi = 0;
      const tim = this.s.time.addEvent({ delay: 40, repeat: 3, callback: () => {
        fi++; if (fi < 4 && this.s.textures.exists('fx_hit_spark_' + fi)) sp.setTexture('fx_hit_spark_' + fi);
        else sp.destroy();
      }});
      void tim;
    }
  }

  /** 1–2 impact frames: brief desat + invert wash over the live camera (readable, not full-white). */
  private runSilFrames(t: ImpactTier) {
    const cam = this.s.cameras.main;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cm: any = null;
    try {
      cm = cam.filters?.internal?.addColorMatrix?.();
      if (cm?.colorMatrix) cm.colorMatrix.saturate(-0.85).contrast(0.35);
    } catch { /* */ }
    this.sil?.destroy();
    // Frame 1: warm multiply (silhouette punch without bleaching)
    this.sil = this.s.add.rectangle(640, 360, 1280, 720, 0xffc98a, 0.35)
      .setScrollFactor(0).setDepth(8900).setBlendMode(Phaser.BlendModes.ADD);
    this.s.time.delayedCall(t.silMs, () => {
      if (!this.sil) return;
      // Frame 2: dark invert-ish multiply (Hades-like graphic cut)
      try { cm?.colorMatrix?.reset?.()?.negative?.().brightness(0.55); } catch { /* */ }
      this.sil.setFillStyle(0x0a1420, 0.4).setBlendMode(Phaser.BlendModes.MULTIPLY);
      this.s.time.delayedCall(t.silMs, () => {
        this.sil?.destroy(); this.sil = undefined;
        try { cm?.destroy?.(); } catch { /* */ }
        try { cam.filters?.internal?.clear?.(); } catch { /* */ }
      });
    });
  }
  dust(x: number, y: number, dir: { x: number; y: number }, n = 8) {
    if (!this.s.textures.exists('fx_dust_puff')) return;
    const em = this.s.add.particles(x, y, 'fx_dust_puff', {
      speed: { min: 20, max: 70 },
      angle: { min: -20, max: 20 },
      scale: { start: 0.6, end: 1.4 },
      alpha: { start: 0.55, end: 0 },
      lifespan: 500,
      gravityY: 40,
      emitting: false,
    });
    em.setParticleSpeed(dir.x * 40, dir.y * 20);
    em.explode(n);
    this.s.time.delayedCall(600, () => em.destroy());
  }
}
