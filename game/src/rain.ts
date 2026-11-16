// Night rain seen only through the office window panes: near and far streaks
// plus droplets on the glass, an occasional lightning flash, and a CC0 rain bed.
// Nothing is drawn on the wall, the frame, the mullions, or the room floor.
import Phaser from 'phaser';
import { getSfxVolume } from './sfx';
import type { GameScene } from './game';

/** Outer window frame (reference). Rain is clipped to PANES, inset from the frame. */
export const OFFICE_WINDOW = { x: 760, y: 72, w: 400, h: 126 };

/** Interiors of the three glass panes — inside the frame and mullions. */
export const PANES: { x: number; y: number; w: number; h: number }[] = [
  { x: 764, y: 78, w: 124, h: 108 },
  { x: 898, y: 78, w: 124, h: 108 },
  { x: 1032, y: 78, w: 124, h: 108 },
];

type Drop = { x: number; y: number; vy: number; len: number; a: number; ang: number; pane: number };
type Streak = { x: number; y: number; vy: number; len: number; a: number; ang: number; w: number; near: boolean; pane: number };

export class GlassRain {
  s: GameScene;
  g: Phaser.GameObjects.Graphics;
  roomFlash: Phaser.GameObjects.Rectangle;
  paused = false;
  drops: Drop[] = [];
  streaks: Streak[] = [];
  t = 0;
  nextFlash = 6 + Math.random() * 8;
  flash = 0;
  amb: Phaser.Sound.BaseSound | null = null;
  ambVol = 0.42;

  constructor(s: GameScene) {
    this.s = s;
    this.g = s.add.graphics().setDepth(205);
    s.objs.push(this.g);
    this.roomFlash = s.add.rectangle(640, 360, 1280, 720, 0xc8dff0, 0).setDepth(430).setBlendMode(Phaser.BlendModes.ADD);
    s.objs.push(this.roomFlash);
    for (let i = 0; i < 16; i++) this.drops.push(this.spawnDrop(true));
    for (let i = 0; i < 36; i++) this.streaks.push(this.spawnStreak(false));
    for (let i = 0; i < 14; i++) this.streaks.push(this.spawnStreak(true));
    this.startAmb();
  }

  pause(on: boolean) {
    this.paused = on;
    this.applyAmbVol();
  }

  /** Trigger a lightning flash (window + faint room wash). */
  strike(hold = 0.18) {
    this.flash = Math.max(this.flash, hold);
    this.nextFlash = this.t + 7 + Math.random() * 10;
    try { this.s.cameras.main.shake(140, 0.003); } catch { /* */ }
    this.rumble();
  }

  update(dt: number) {
    if (!this.paused) {
      this.t += dt;
      for (const d of this.drops) {
        const P = PANES[d.pane];
        d.y += d.vy * dt;
        d.x += d.ang * d.vy * dt;
        // Keep the bead on this pane; respawn at the top when it reaches the sill.
        if (d.x < P.x + 2 || d.x > P.x + P.w - 2) d.x = Phaser.Math.Clamp(d.x, P.x + 2, P.x + P.w - 2);
        if (d.y > P.y + P.h - 2) Object.assign(d, this.spawnDrop(false, d.pane));
      }
      for (const s of this.streaks) {
        const P = PANES[s.pane];
        s.y += s.vy * dt;
        s.x += s.ang * s.vy * dt * 0.15;
        if (s.x < P.x + 2 || s.x > P.x + P.w - 2) s.x = Phaser.Math.Clamp(s.x, P.x + 2, P.x + P.w - 2);
        if (s.y - s.len > P.y + P.h) Object.assign(s, this.spawnStreak(s.near, true, s.pane));
      }
      if (this.flash <= 0 && this.t >= this.nextFlash) this.strike();
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    this.draw();
  }

  destroy() {
    this.stopAmb();
    try { this.g.destroy(); } catch { /* */ }
    try { this.roomFlash.destroy(); } catch { /* */ }
  }

  private startAmb() {
    this.stopAmb();
    try {
      if (!this.s.cache.audio.exists('sfx_rain')) return;
      const snd = this.s.sound.add('sfx_rain', { loop: true, volume: 0 });
      snd.play({ loop: true, volume: 0 });
      this.amb = snd;
      this.applyAmbVol(true);
    } catch { /* */ }
  }

  private stopAmb() {
    const a = this.amb; this.amb = null;
    if (!a) return;
    try { a.stop(); a.destroy(); } catch { /* */ }
  }

  private applyAmbVol(fadeIn = false) {
    if (!this.amb) return;
    const vol = this.paused ? 0 : this.ambVol * getSfxVolume();
    try {
      const snd = this.amb as unknown as { setVolume?: (v: number) => void; volume?: number };
      if (fadeIn) {
        snd.setVolume?.(0.0001);
        this.s.tweens.add({
          targets: snd, volume: vol, duration: 900, onUpdate: () => snd.setVolume?.(snd.volume ?? vol),
        });
      } else {
        snd.setVolume?.(vol);
        if (snd.volume !== undefined) snd.volume = vol;
      }
    } catch { /* */ }
  }

  private rumble() {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const c = new AC();
      const t = c.currentTime;
      const buf = c.createBuffer(1, c.sampleRate * 0.9, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const e = 1 - i / d.length;
        d[i] = (Math.random() * 2 - 1) * e * e * 0.55;
      }
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
      const g = c.createGain(); g.gain.value = 0.22 * getSfxVolume();
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start();
      src.onended = () => { try { c.close(); } catch { /* */ } };
    } catch { /* */ }
  }

  private spawnDrop(anywhere: boolean, pane = Math.floor(Math.random() * PANES.length)): Drop {
    const P = PANES[pane];
    const x = P.x + 4 + Math.random() * (P.w - 8);
    const y = anywhere ? P.y + 6 + Math.random() * (P.h - 16) : P.y + 3 + Math.random() * 6;
    return {
      x, y, pane,
      vy: 16 + Math.random() * 20,
      len: 5 + Math.random() * 8,
      a: 0.45 + Math.random() * 0.35,
      ang: 0.12 + Math.random() * 0.1,
    };
  }

  private spawnStreak(near: boolean, fromTop = false, pane = Math.floor(Math.random() * PANES.length)): Streak {
    const P = PANES[pane];
    return {
      x: P.x + 3 + Math.random() * (P.w - 6),
      y: fromTop ? P.y + 2 : P.y + Math.random() * P.h,
      vy: near ? 200 + Math.random() * 80 : 130 + Math.random() * 60,
      len: near ? 14 + Math.random() * 12 : 8 + Math.random() * 10,
      a: near ? 0.5 + Math.random() * 0.28 : 0.24 + Math.random() * 0.16,
      ang: 0.2 + Math.random() * 0.08,
      w: near ? 1.4 + Math.random() * 0.5 : 0.9,
      near,
      pane,
    };
  }

  /** Draw a line only where it crosses a pane. */
  private lineOnGlass(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, pane: number) {
    const P = PANES[pane];
    const left = P.x + 0.5, right = P.x + P.w - 0.5, top = P.y + 0.5, bot = P.y + P.h - 0.5;
    // Liang-Barsky
    let t0 = 0, t1 = 1;
    const dx = x1 - x0, dy = y1 - y0;
    const clip = (p: number, q: number) => {
      if (p === 0) return q >= 0;
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
      return true;
    };
    if (!clip(-dx, x0 - left) || !clip(dx, right - x0) || !clip(-dy, y0 - top) || !clip(dy, bot - y0)) return;
    if (t0 > t1) return;
    g.lineBetween(x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1);
  }

  private draw() {
    const g = this.g;
    const bolt = this.flash > 0 ? Math.min(1, this.flash * 6) : 0;
    g.clear();
    for (const P of PANES) {
      // Night veil, only on the glass.
      const bands = 6;
      for (let i = 0; i < bands; i++) {
        const a = (0.12 * (1 - i / bands) + 0.03) * (1 - bolt * 0.7);
        g.fillStyle(0x061018, a);
        g.fillRect(P.x, P.y + (P.h / bands) * i, P.w, P.h / bands + 1);
      }
      if (bolt > 0) {
        g.fillStyle(0xd8e8f8, 0.16 + bolt * 0.4);
        g.fillRect(P.x, P.y, P.w, P.h);
      }
    }
    for (const s of this.streaks) {
      if (s.near) continue;
      const dx = s.len * s.ang;
      g.lineStyle(s.w, 0xa8c0d0, s.a);
      this.lineOnGlass(g, s.x, s.y - s.len, s.x + dx, s.y, s.pane);
    }
    for (const s of this.streaks) {
      if (!s.near) continue;
      const dx = s.len * s.ang;
      g.lineStyle(s.w + 0.7, 0xc8dce8, s.a * 0.35);
      this.lineOnGlass(g, s.x, s.y - s.len, s.x + dx, s.y, s.pane);
      g.lineStyle(s.w, 0xe8f4fc, s.a);
      this.lineOnGlass(g, s.x, s.y - s.len, s.x + dx, s.y, s.pane);
    }
    for (const d of this.drops) {
      const P = PANES[d.pane];
      const dx = d.len * d.ang;
      g.lineStyle(1.2, 0xd0e4f0, d.a * 0.7);
      this.lineOnGlass(g, d.x - dx, d.y - d.len, d.x, d.y, d.pane);
      // Bead only if it still sits on the pane (cool white, never a brown blob).
      if (d.x > P.x + 1 && d.x < P.x + P.w - 1 && d.y > P.y + 1 && d.y < P.y + P.h - 1) {
        g.fillStyle(0xeef6fb, d.a);
        g.fillCircle(d.x, d.y, 1.35);
      }
    }
    this.roomFlash.setAlpha(bolt > 0 ? 0.08 + bolt * 0.22 : 0);
  }
}
