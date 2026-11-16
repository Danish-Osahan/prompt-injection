// Shaped quality projectiles: no charge ring, no straight laser. Lamp-stream language (additive, short afterglow).
import Phaser from 'phaser';
import type { GameScene } from '../game';
import { sfx } from '../sfx';

export type ShotKind = 'bolt' | 'hot' | 'loud' | 'wet' | 'dart';

export function shotKind(word: string): ShotKind {
  const w = (word || '').toUpperCase();
  if (w === 'WET') return 'wet';
  if (w === 'HOT') return 'hot';
  if (w === 'LOUD') return 'loud';
  if (w === 'SPARK' || w === 'ON' || w === 'LIGHT') return 'bolt';
  return 'dart';
}

export function launchShot(
  s: GameScene,
  kind: ShotKind,
  from: { x: number; y: number },
  to: { x: number; y: number },
  onHit?: () => void,
  dur = 260,
) {
  const g = s.add.graphics().setDepth(8000).setBlendMode(Phaser.BlendModes.ADD);
  s.objs.push(g);
  const tracker = { u: 0 };
  s.tweens.add({
    targets: tracker,
    u: 1,
    duration: dur,
    ease: kind === 'loud' ? 'Sine.easeOut' : 'Quad.easeOut',
    onUpdate: () => {
      g.clear();
      drawShot(g, kind, from, to, tracker.u, s.t);
    },
    onComplete: () => {
      try { sfx('impact_snap'); } catch { /* */ }
      burst(s, kind, to);
      onHit?.();
      s.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
    },
  });
  return g;
}

export function drawForkedBolt(
  g: Phaser.GameObjects.Graphics,
  x0: number, y0: number, x1: number, y1: number,
  t: number, extend = 1,
) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist, ny = dx / dist;
  const xE = x0 + dx * extend, yE = y0 + dy * extend;
  const segs = Math.max(6, Math.floor((dist * extend) / 14));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const jag = (i === 0 || i === segs) ? 0 : Math.sin(u * 18 + t * 40) * 8 + Math.sin(u * 41 + t * 13) * 3;
    pts.push({ x: x0 + (xE - x0) * u + nx * jag, y: y0 + (yE - y0) * u + ny * jag });
  }
  for (const [w, col, a] of [[10, 0x1a60c8, 0.22], [6, 0x50c0ff, 0.55], [2.4, 0xe8ffff, 0.95], [1.1, 0xffffff, 1]] as const) {
    g.lineStyle(w, col, a);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.strokePath();
  }
  for (let i = 2; i < pts.length - 1; i += 2) {
    const p = pts[i];
    const side = i % 4 === 0 ? 1 : -1;
    const bl = 10 + (i % 3) * 5;
    const bx = p.x + nx * bl * side + dx / dist * 6;
    const by = p.y + ny * bl * side + dy / dist * 6;
    g.lineStyle(2.2, 0xb8f0ff, 0.75).lineBetween(p.x, p.y, bx, by);
    g.lineStyle(1, 0xffffff, 0.9).lineBetween(p.x, p.y, bx, by);
  }
}

function drawShot(
  g: Phaser.GameObjects.Graphics,
  kind: ShotKind,
  from: { x: number; y: number },
  to: { x: number; y: number },
  u: number,
  t: number,
) {
  const x = from.x + (to.x - from.x) * u;
  const y = from.y + (to.y - from.y) * u;
  if (kind === 'bolt') {
    drawForkedBolt(g, from.x, from.y, to.x, to.y, t, u);
    g.fillStyle(0xe8ffff, 0.8).fillCircle(x, y, 3);
    return;
  }
  if (kind === 'hot') {
    const arc = Math.sin(u * Math.PI) * 18;
    const px = x, py = y - arc;
    for (let i = 3; i >= 0; i--) {
      const a = 0.18 + i * 0.08;
      g.fillStyle(i === 0 ? 0xfff3c8 : 0xff9a3a, a);
      g.fillEllipse(px, py, 22 + i * 10, 10 + i * 4);
    }
    // trailing heat ripples
    for (let k = 1; k <= 3; k++) {
      const uu = Math.max(0, u - k * 0.12);
      const hx = from.x + (to.x - from.x) * uu;
      const hy = from.y + (to.y - from.y) * uu - Math.sin(uu * Math.PI) * 18;
      g.lineStyle(1.5, 0xffc070, 0.35 / k).strokeEllipse(hx, hy, 16 + k * 8, 8 + k * 3);
    }
    return;
  }
  if (kind === 'loud') {
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    for (let k = 0; k < 4; k++) {
      const uu = Math.max(0, u - k * 0.12);
      if (uu <= 0) continue;
      const r = 16 + uu * 70 + k * 10;
      g.lineStyle(2.4 - k * 0.3, 0x7ad4d8, 0.55 * (1 - uu));
      g.beginPath();
      g.arc(from.x, from.y, r, ang - 0.55, ang + 0.55, false);
      g.strokePath();
    }
    return;
  }
  if (kind === 'wet') {
    const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2 - 40;
    const qx = (1 - u) * (1 - u) * from.x + 2 * (1 - u) * u * mx + u * u * to.x;
    const qy = (1 - u) * (1 - u) * from.y + 2 * (1 - u) * u * my + u * u * to.y;
    for (let i = 0; i < 5; i++) {
      const uu = Math.max(0, u - i * 0.06);
      const dx = (1 - uu) * (1 - uu) * from.x + 2 * (1 - uu) * uu * mx + uu * uu * to.x;
      const dy = (1 - uu) * (1 - uu) * from.y + 2 * (1 - uu) * uu * my + uu * uu * to.y;
      g.fillStyle(0x8ad4f0, 0.7 - i * 0.1);
      g.fillCircle(dx + Math.sin(i * 2) * 3, dy, 3.2 - i * 0.35);
    }
    g.fillStyle(0xe8fbff, 0.85).fillCircle(qx, qy, 3.5);
    return;
  }
  // dart: compact shard, slight lift, short tail — not a beam
  const lift = Math.sin(u * Math.PI) * 16;
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const px = x, py = y - lift;
  const c = Math.cos(ang), sn = Math.sin(ang);
  const tipX = px + c * 10, tipY = py + sn * 10;
  const lX = px - c * 8 + -sn * 5, lY = py - sn * 8 + c * 5;
  const rX = px - c * 8 - -sn * 5, rY = py - sn * 8 - c * 5;
  g.fillStyle(0x9ad8f0, 0.95);
  g.fillTriangle(tipX, tipY, lX, lY, rX, rY);
  g.fillStyle(0xe8ffff, 0.7).fillCircle(px, py, 2.2);
}

function burst(s: GameScene, kind: ShotKind, at: { x: number; y: number }) {
  const g = s.add.graphics().setDepth(8010).setBlendMode(Phaser.BlendModes.ADD);
  s.objs.push(g);
  if (kind === 'bolt') {
    g.fillStyle(0xe8ffff, 0.7).fillCircle(at.x, at.y, 6);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.3;
      const L = 10 + Math.random() * 14;
      g.lineStyle(1.4, 0xb8f0ff, 0.85).lineBetween(at.x, at.y, at.x + Math.cos(a) * L, at.y + Math.sin(a) * L);
    }
  } else if (kind === 'hot') {
    g.fillStyle(0xffc070, 0.5).fillEllipse(at.x, at.y, 36, 20);
  } else if (kind === 'loud') {
    g.lineStyle(3, 0x7ad4d8, 0.6).strokeCircle(at.x, at.y, 18);
    g.lineStyle(2, 0x7ad4d8, 0.35).strokeCircle(at.x, at.y, 32);
  } else if (kind === 'wet') {
    for (let i = 0; i < 8; i++) {
      const a = -0.2 + Math.random() * (Math.PI + 0.4);
      g.fillStyle(0x8ad4f0, 0.8).fillCircle(at.x + Math.cos(a) * 8, at.y + Math.sin(a) * 6, 2.4);
    }
  } else {
    g.fillStyle(0x9ad8f0, 0.7).fillCircle(at.x, at.y, 7);
  }
  s.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
}
