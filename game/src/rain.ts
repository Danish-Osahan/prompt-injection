// Night rain seen through glass: faint background streaks, droplets running
// down the pane, a soft glaze over the window. Code-drawn; no new art.
import Phaser from 'phaser';
import type { GameScene } from './game';

/** Window glass in the office plate (matches amb/clarity box). */
export const OFFICE_WINDOW = { x: 760, y: 72, w: 400, h: 126 };
const MULLIONS = [760 + 133, 760 + 266];

type Drop = { x: number; y: number; vy: number; len: number; w: number; a: number; pane: number };

export class GlassRain {
  s: GameScene;
  g: Phaser.GameObjects.Graphics;
  paused = false;
  drops: Drop[] = [];
  streaks: { x: number; y0: number; y1: number; a: number; pane: number }[] = [];
  t = 0;

  constructor(s: GameScene) {
    this.s = s;
    this.g = s.add.graphics().setDepth(205);
    s.objs.push(this.g);
    const W = OFFICE_WINDOW;
    for (let i = 0; i < 14; i++) this.drops.push(this.spawnDrop(true));
    for (let i = 0; i < 7; i++) {
      const pane = i % 3;
      const x = W.x + 10 + pane * (W.w / 3) + Math.random() * (W.w / 3 - 20);
      const y0 = W.y + 8 + Math.random() * 40;
      this.streaks.push({ x, y0, y1: y0 + 18 + Math.random() * 50, a: 0.12 + Math.random() * 0.12, pane });
    }
  }

  pause(on: boolean) { this.paused = on; }

  update(dt: number) {
    if (this.paused) { this.draw(); return; }
    this.t += dt;
    const W = OFFICE_WINDOW;
    for (const d of this.drops) {
      d.y += d.vy * dt;
      d.x += 2 * dt; // slight wind to the right, very mild
      if (d.y - d.len > W.y + W.h - 6) Object.assign(d, this.spawnDrop(false));
    }
    if (Math.random() < 0.08) {
      const i = Math.floor(Math.random() * this.drops.length);
      Object.assign(this.drops[i], this.spawnDrop(false));
    }
    this.draw();
  }

  destroy() { try { this.g.destroy(); } catch { /* */ } }

  private spawnDrop(anywhere: boolean): Drop {
    const W = OFFICE_WINDOW;
    const pane = Math.floor(Math.random() * 3);
    const x = W.x + 8 + pane * (W.w / 3) + Math.random() * (W.w / 3 - 16);
    const y = anywhere ? W.y + Math.random() * W.h : W.y + 4 + Math.random() * 10;
    return { x, y, vy: 22 + Math.random() * 38, len: 6 + Math.random() * 14, w: 1 + Math.random(), a: 0.18 + Math.random() * 0.22, pane };
  }

  private draw() {
    const g = this.g;
    const W = OFFICE_WINDOW;
    g.clear();
    // Soft glaze: a cool dark veil so the night behind the glass reads slightly blurred / recessed.
    g.fillStyle(0x071520, 0.22);
    g.fillRect(W.x, W.y, W.w, W.h);
    g.fillStyle(0x8fb4c8, 0.04);
    g.fillRect(W.x, W.y, W.w, 8);
    // Distant streaks (behind the pane, almost still, darker than the old cyan dashes).
    g.lineStyle(1, 0x4d6e82, 0.16);
    for (let i = 0; i < 18; i++) {
      const x = W.x + ((i * 47 + this.t * 12) % W.w);
      const y = W.y + ((i * 29) % (W.h - 16));
      g.lineBetween(x, y, x + 1.2, y + 10);
    }
    // Condensation streaks stuck to the glass.
    for (const s of this.streaks) {
      g.lineStyle(1.2, 0xa8c4d4, s.a);
      g.lineBetween(s.x, s.y0, s.x + 0.6, s.y1);
      g.fillStyle(0xcfe0ee, s.a + 0.08);
      g.fillCircle(s.x + 0.6, s.y1, 1.3);
    }
    // Running droplets with short trails.
    for (const d of this.drops) {
      g.lineStyle(d.w, 0xc5d8e6, d.a * 0.7);
      g.lineBetween(d.x, d.y - d.len, d.x + 0.8, d.y);
      g.fillStyle(0xd8e6f0, d.a);
      g.fillCircle(d.x + 0.8, d.y, 1.4);
    }
    // Mullions and a thin top highlight so it reads as glass, not a sticker.
    g.lineStyle(3, 0x1a2228, 0.55);
    for (const x of MULLIONS) g.lineBetween(x, W.y, x, W.y + W.h);
    g.lineStyle(1, 0xcfe4f0, 0.18);
    g.lineBetween(W.x + 2, W.y + 2, W.x + W.w - 2, W.y + 2);
  }
}
