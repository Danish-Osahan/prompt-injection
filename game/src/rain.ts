// Night rain on the office window: near and far falling streaks, droplets
// running down the glass, an occasional lightning flash, and a CC0 rain bed.
import Phaser from 'phaser';
import { getSfxVolume } from './sfx';
import type { GameScene } from './game';

/** Window glass in the office plate (matches amb/clarity box). */
export const OFFICE_WINDOW = { x: 760, y: 72, w: 400, h: 126 };
const MULLIONS = [760 + 133, 760 + 266];

type Drop = { x: number; y: number; vy: number; len: number; a: number; ang: number };
type Streak = { x: number; y: number; vy: number; len: number; a: number; ang: number; w: number; near: boolean };
type Light = { x: number; y: number; r: number; a: number; col: number };

export class GlassRain {
  s: GameScene;
  g: Phaser.GameObjects.Graphics;
  roomFlash: Phaser.GameObjects.Rectangle;
  paused = false;
  drops: Drop[] = [];
  streaks: Streak[] = [];
  lights: Light[] = [];
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
    const W = OFFICE_WINDOW;
    for (let i = 0; i < 14; i++) this.drops.push(this.spawnDrop(true));
    // Far layer: many thin streaks seen through the glass.
    for (let i = 0; i < 42; i++) this.streaks.push(this.spawnStreak(false));
    // Near layer: fewer, thicker, brighter streaks in front of the pane.
    for (let i = 0; i < 16; i++) this.streaks.push(this.spawnStreak(true));
    const cols = [0x8a6a4a, 0x6a7a8a, 0x7a5a3a, 0x4a5a6a, 0x9a7a58];
    for (let i = 0; i < 9; i++) {
      this.lights.push({
        x: W.x + 20 + Math.random() * (W.w - 40),
        y: W.y + 28 + Math.random() * (W.h - 44),
        r: 3 + Math.random() * 5,
        a: 0.08 + Math.random() * 0.1,
        col: cols[i % cols.length],
      });
    }
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
      const W = OFFICE_WINDOW;
      for (const d of this.drops) {
        d.y += d.vy * dt;
        d.x += d.ang * d.vy * dt;
        if (d.y - d.len > W.y + W.h - 6) Object.assign(d, this.spawnDrop(false));
      }
      for (const s of this.streaks) {
        s.y += s.vy * dt;
        s.x += s.ang * s.vy * dt;
        if (s.y - s.len > W.y + W.h) Object.assign(s, this.spawnStreak(s.near, true));
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

  private spawnDrop(anywhere: boolean): Drop {
    const W = OFFICE_WINDOW;
    const pane = Math.floor(Math.random() * 3);
    const x = W.x + 10 + pane * (W.w / 3) + Math.random() * (W.w / 3 - 20);
    const y = anywhere ? W.y + 8 + Math.random() * (W.h - 20) : W.y + 4 + Math.random() * 8;
    return {
      x, y,
      vy: 18 + Math.random() * 22,
      len: 6 + Math.random() * 10,
      a: 0.42 + Math.random() * 0.35,
      ang: 0.14 + Math.random() * 0.12,
    };
  }

  private spawnStreak(near: boolean, fromTop = false): Streak {
    const W = OFFICE_WINDOW;
    const pad = near ? 4 : 8;
    return {
      x: W.x + pad + Math.random() * (W.w - pad * 2),
      y: fromTop ? W.y - Math.random() * 20 : W.y + Math.random() * W.h,
      vy: near ? 220 + Math.random() * 90 : 140 + Math.random() * 70,
      len: near ? 18 + Math.random() * 16 : 10 + Math.random() * 12,
      a: near ? 0.48 + Math.random() * 0.28 : 0.22 + Math.random() * 0.16,
      ang: 0.22 + Math.random() * 0.1,
      w: near ? 1.5 + Math.random() * 0.6 : 0.9,
      near,
    };
  }

  private draw() {
    const g = this.g;
    const W = OFFICE_WINDOW;
    const bolt = this.flash > 0 ? Math.min(1, this.flash * 6) : 0;
    g.clear();
    // Night veil, lifted slightly during a flash.
    const bands = 8;
    for (let i = 0; i < bands; i++) {
      const a = (0.16 * (1 - i / bands) + 0.04) * (1 - bolt * 0.7);
      g.fillStyle(0x061018, a);
      g.fillRect(W.x, W.y + (W.h / bands) * i, W.w, W.h / bands + 1);
    }
    if (bolt > 0) {
      g.fillStyle(0xd8e8f8, 0.18 + bolt * 0.45);
      g.fillRect(W.x, W.y, W.w, W.h);
    }
    for (const L of this.lights) {
      const la = L.a * (1 + bolt * 1.6);
      g.fillStyle(L.col, la * 0.45);
      g.fillCircle(L.x, L.y, L.r * 2.4);
      g.fillStyle(L.col, la);
      g.fillCircle(L.x, L.y, L.r);
    }
    // Far streaks first, then near, so depth reads at a glance.
    for (const s of this.streaks) {
      if (s.near) continue;
      const dx = s.len * s.ang;
      g.lineStyle(s.w, 0xa8c0d0, s.a);
      g.lineBetween(s.x, s.y - s.len, s.x + dx, s.y);
    }
    for (const s of this.streaks) {
      if (!s.near) continue;
      const dx = s.len * s.ang;
      g.lineStyle(s.w + 0.8, 0xc8dce8, s.a * 0.35);
      g.lineBetween(s.x, s.y - s.len, s.x + dx, s.y);
      g.lineStyle(s.w, 0xe8f4fc, s.a);
      g.lineBetween(s.x, s.y - s.len, s.x + dx, s.y);
    }
    for (const d of this.drops) {
      const dx = d.len * d.ang;
      g.lineStyle(1.3, 0xd0e4f0, d.a * 0.7);
      g.lineBetween(d.x - dx, d.y - d.len, d.x, d.y);
      g.fillStyle(0xeef6fb, d.a);
      g.fillCircle(d.x, d.y, 1.6);
    }
    g.lineStyle(3, 0x1a2228, 0.7);
    for (const x of MULLIONS) g.lineBetween(x, W.y, x, W.y + W.h);
    g.lineStyle(1, 0xd0e4f0, 0.22 + bolt * 0.35);
    g.lineBetween(W.x + 2, W.y + 2, W.x + W.w - 2, W.y + 2);
    this.roomFlash.setAlpha(bolt > 0 ? 0.08 + bolt * 0.22 : 0);
  }
}
