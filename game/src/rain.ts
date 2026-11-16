// Night rain seen through glass: a soft dark-blue veil, faint angled streaks,
// a few slow droplets on the pane, and blurred distant city lights. Subtle, not neon.
import Phaser from 'phaser';
import type { GameScene } from './game';

/** Window glass in the office plate (matches amb/clarity box). */
export const OFFICE_WINDOW = { x: 760, y: 72, w: 400, h: 126 };
const MULLIONS = [760 + 133, 760 + 266];

type Drop = { x: number; y: number; vy: number; len: number; a: number; ang: number };
type Streak = { x: number; y0: number; len: number; a: number; ang: number };
type Light = { x: number; y: number; r: number; a: number; col: number };

export class GlassRain {
  s: GameScene;
  g: Phaser.GameObjects.Graphics;
  paused = false;
  drops: Drop[] = [];
  streaks: Streak[] = [];
  lights: Light[] = [];
  t = 0;

  constructor(s: GameScene) {
    this.s = s;
    this.g = s.add.graphics().setDepth(205);
    s.objs.push(this.g);
    const W = OFFICE_WINDOW;
    for (let i = 0; i < 5; i++) this.drops.push(this.spawnDrop(true));
    for (let i = 0; i < 8; i++) {
      const pane = i % 3;
      const x = W.x + 12 + pane * (W.w / 3) + Math.random() * (W.w / 3 - 24);
      this.streaks.push({
        x,
        y0: W.y + 6 + Math.random() * 36,
        len: 16 + Math.random() * 36,
        a: 0.07 + Math.random() * 0.08,
        ang: 0.08 + Math.random() * 0.12, // slight lean to the right
      });
    }
    // Soft, out-of-focus city lights behind the glass — warm and cool, never neon.
    const cols = [0x8a6a4a, 0x6a7a8a, 0x7a5a3a, 0x4a5a6a, 0x9a7a58];
    for (let i = 0; i < 9; i++) {
      this.lights.push({
        x: W.x + 20 + Math.random() * (W.w - 40),
        y: W.y + 28 + Math.random() * (W.h - 44),
        r: 3 + Math.random() * 5,
        a: 0.06 + Math.random() * 0.08,
        col: cols[i % cols.length],
      });
    }
  }

  pause(on: boolean) { this.paused = on; }

  update(dt: number) {
    if (this.paused) { this.draw(); return; }
    this.t += dt;
    const W = OFFICE_WINDOW;
    for (const d of this.drops) {
      d.y += d.vy * dt;
      d.x += d.ang * d.vy * dt;
      if (d.y - d.len > W.y + W.h - 6) Object.assign(d, this.spawnDrop(false));
    }
    this.draw();
  }

  destroy() { try { this.g.destroy(); } catch { /* */ } }

  private spawnDrop(anywhere: boolean): Drop {
    const W = OFFICE_WINDOW;
    const pane = Math.floor(Math.random() * 3);
    const x = W.x + 10 + pane * (W.w / 3) + Math.random() * (W.w / 3 - 20);
    const y = anywhere ? W.y + 8 + Math.random() * (W.h - 20) : W.y + 4 + Math.random() * 8;
    return {
      x, y,
      vy: 8 + Math.random() * 14, // slow on the glass
      len: 4 + Math.random() * 7,
      a: 0.16 + Math.random() * 0.12,
      ang: 0.08 + Math.random() * 0.1,
    };
  }

  private draw() {
    const g = this.g;
    const W = OFFICE_WINDOW;
    g.clear();
    // Soft dark-blue gradient veil (stronger at the top, recessed night).
    const bands = 8;
    for (let i = 0; i < bands; i++) {
      const a = 0.18 * (1 - i / bands) + 0.05;
      g.fillStyle(0x061018, a);
      g.fillRect(W.x, W.y + (W.h / bands) * i, W.w, W.h / bands + 1);
    }
    // Blurred distant city lights.
    for (const L of this.lights) {
      g.fillStyle(L.col, L.a * 0.45);
      g.fillCircle(L.x, L.y, L.r * 2.4);
      g.fillStyle(L.col, L.a);
      g.fillCircle(L.x, L.y, L.r);
    }
    // Few, thin, low-alpha streaks with a slight angle.
    for (const s of this.streaks) {
      const dx = s.len * s.ang;
      g.lineStyle(0.8, 0x8aa4b4, s.a);
      g.lineBetween(s.x, s.y0, s.x + dx, s.y0 + s.len);
    }
    // Slow droplets crawling down the glass.
    for (const d of this.drops) {
      const dx = d.len * d.ang;
      g.lineStyle(0.9, 0xb4c8d4, d.a * 0.55);
      g.lineBetween(d.x - dx, d.y - d.len, d.x, d.y);
      g.fillStyle(0xc8d8e2, d.a * 0.7);
      g.fillCircle(d.x, d.y, 1.1);
    }
    // Mullions + a thin top highlight so it still reads as glass.
    g.lineStyle(3, 0x1a2228, 0.55);
    for (const x of MULLIONS) g.lineBetween(x, W.y, x, W.y + W.h);
    g.lineStyle(1, 0xc0d4e0, 0.12);
    g.lineBetween(W.x + 2, W.y + 2, W.x + W.w - 2, W.y + 2);
  }
}
