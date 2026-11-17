// Shaped quality shots and the hold-J / F-throw bolt.
// Pose: noor_windup (220ms) → throw from the release frame → throw follow-through.
// Bolt: a crafted zigzag that grows, jitters, and branches over frames, then a tight afterglow.
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

function playKey(s: GameScene, key: string, fps?: number, startFrame?: number) {
  if (!s.anims.exists(key)) return false;
  try {
    const cfg: Phaser.Types.Animations.PlayAnimationConfig = { key };
    if (fps) cfg.frameRate = fps;
    if (startFrame != null) cfg.startFrame = startFrame;
    s.noor.play(cfg, true);
    return true;
  } catch { return false; }
}

export const WIND_MS = 220;

// Right-hand offset from the feet pivot (96, 160) on the noor_windup sheet, per facing, frames 0-2.
const WIND_HAND: Record<string, [number, number][]> = {
  S: [[-52.5, -4.3], [-65.6, -32.8], [19.6, -0.6]],
  SE: [[-48.9, 6.7], [-65.3, -18.6], [33.7, -6.4]],
  E: [[-32.9, 20.2], [-50.3, 0.5], [46.8, -19.7]],
  NE: [[5.7, 27.2], [-4.8, 14.5], [42.7, -42.5]],
  N: [[52.4, -2.9], [64.5, -16.3], [-15.7, -56.5]],
  NW: [[52.2, -8.5], [66.3, -23.4], [-23.4, -54.4]],
  W: [[32.9, -30.2], [50.3, -53.1], [-46.8, -36.5]],
  SW: [[-19.0, -35.1], [-12.6, -66.5], [-35.2, -7.3]],
};

function handPos(s: GameScene, back = false) {
  const d = s.dir || 'S';
  const n = s.noor;
  const onWind = !!n?.anims.currentAnim?.key?.includes('windup');
  const fi = onWind ? (n!.anims.currentFrame?.index ?? 1) : 1;
  const frames = WIND_HAND[d];
  if (frames) {
    const [hx, hy] = frames[Math.min(Math.max(fi, 0), frames.length - 1)];
    return { x: s.x + hx, y: s.y + hy, side: hx >= 0 ? 1 : -1 };
  }
  const side = d.includes('E') ? 1 : d.includes('W') ? -1 : (d.includes('N') ? -1 : 1);
  const x = s.x + (back ? -side * 38 : side * 22);
  const y = s.y - (back ? 16 : 36);
  return { x, y, side };
}

function placeWindFx(s: GameScene) {
  const n = s.noor;
  if (!n) return;
  const h = handPos(s, true);
  const orb = n.getData('windOrb') as Phaser.GameObjects.Ellipse | undefined;
  if (orb?.active) orb.setPosition(h.x, h.y).setDepth(s.y + 32);
  const glow = n.getData('windGlow') as Phaser.GameObjects.Ellipse | undefined;
  if (glow?.active) glow.setPosition(h.x, h.y).setDepth(s.y + 31);
  const dust = n.getData('windDust') as Phaser.GameObjects.Ellipse | undefined;
  if (dust?.active) dust.setPosition(s.x, s.y + 8).setDepth(s.y - 2);
}

export function tickWindupFx(s: GameScene) {
  if (s.noor?.getData('windOn')) placeWindFx(s);
}

export function startWindupPose(s: GameScene) {
  const n = s.noor;
  if (!n) return;
  if (n.getData('windOn')) { placeWindFx(s); return; }
  n.setData('windOn', true);
  const h = handPos(s, true);
  // Dust ring + gathering hand light sit on top of the rendered wind-up frames.
  const glow = s.add.ellipse(h.x, h.y, 22, 18, 0x5ec8ff, 0)
    .setDepth(s.y + 40).setBlendMode(Phaser.BlendModes.ADD);
  const orb = s.add.ellipse(h.x, h.y, 10, 10, 0xe8ffff, 0)
    .setDepth(s.y + 41).setBlendMode(Phaser.BlendModes.ADD);
  s.objs.push(glow, orb);
  s.tweens.add({
    targets: glow, alpha: 0.85, displayWidth: 52, displayHeight: 42,
    duration: WIND_MS, ease: 'Sine.easeOut',
  });
  s.tweens.add({
    targets: orb, alpha: 0.95, displayWidth: 24, displayHeight: 20,
    duration: WIND_MS, ease: 'Sine.easeOut',
  });
  n.setData('windGlow', glow);
  n.setData('windOrb', orb);

  const dust = s.add.ellipse(s.x, s.y + 8, 22, 10, 0xd8c8a0, 0.0)
    .setDepth(s.y - 2).setStrokeStyle(2, 0xe8d8b0, 0.8);
  s.objs.push(dust);
  s.tweens.add({
    targets: dust, alpha: { from: 0.8, to: 0 }, displayWidth: 84, displayHeight: 26,
    duration: WIND_MS + 40, ease: 'Quad.easeOut', onComplete: () => { try { dust.destroy(); } catch { /* */ } },
  });
  n.setData('windDust', dust);
}

export function clearWindupPose(s: GameScene) {
  const n = s.noor;
  if (!n || !n.getData('windOn')) return;
  n.setData('windOn', false);
  const kill = (key: string, fade = true) => {
    const o = n.getData(key) as Phaser.GameObjects.GameObject | undefined;
    n.setData(key, undefined);
    if (!o) return;
    if (fade && 'setAlpha' in o) {
      s.tweens.add({ targets: o, alpha: 0, duration: 120, onComplete: () => { try { o.destroy(); } catch { /* */ } } });
    } else { try { o.destroy(); } catch { /* */ } }
  };
  kill('windOrb'); kill('windGlow'); kill('windDust', false);
}

/** Idempotent: bigger coil + hand-light, charge_in once, then a slow charge_hold loop. */
export function playChargeHold(s: GameScene) {
  startWindupPose(s);
  const dir = s.dir;
  const cur = s.noor.anims.currentAnim?.key ?? '';
  if (cur === `noor_charge_hold_${dir}`) return;
  if (cur === `noor_charge_in_${dir}` && s.noor.anims.isPlaying) return;
  if (cur === `noor_charge_in_${dir}`) {
    if (!playKey(s, `noor_charge_hold_${dir}`, 10)) playKey(s, `noor_type2_${dir}`);
    return;
  }
  if (!playKey(s, `noor_charge_in_${dir}`, 18)) playKey(s, `noor_type2_${dir}`);
}

/**
 * Wind-up then throw. onRelease fires as the bolt leaves the hand.
 * If alreadyWound (hold-J), skip the wind-up sheet and go straight to the throw.
 * Wind-up is WIND_MS (220): noor_windup (coil, drawn-back glowing hand, release) plus dust/light FX.
 */
export function playThrowAttack(s: GameScene, onRelease: () => void, alreadyWound = false) {
  const dir = s.dir;
  const startThrow = () => {
    clearWindupPose(s);
    if (alreadyWound) {
      if (!playKey(s, `noor_throw_${dir}`, 28)) playKey(s, `noor_type3_${dir}`);
      s.time.delayedCall(70, () => { try { onRelease(); } catch { /* */ } });
      return;
    }
    // Wind-up already played the release flick; start the throw sheet on its official release frame.
    if (!playKey(s, `noor_throw_${dir}`, 28, 4)) playKey(s, `noor_type3_${dir}`);
    s.time.delayedCall(40, () => { try { onRelease(); } catch { /* */ } });
  };
  if (alreadyWound) { startThrow(); return; }
  startWindupPose(s);
  const fps = (1000 * 3) / WIND_MS;
  if (!playKey(s, `noor_windup_${dir}`, fps)) {
    if (!playKey(s, `noor_charge_in_${dir}`, 18)) playKey(s, `noor_type2_${dir}`);
  }
  s.time.delayedCall(WIND_MS, startThrow);
}

type Spine = { x: number; y: number; u: number }[];

function makeSpine(from: { x: number; y: number }, to: { x: number; y: number }): Spine {
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const n = Math.max(8, Math.min(18, Math.floor(dist / 16)));
  const pts: Spine = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const env = Math.sin(u * Math.PI);
    // Crafted zigzag (stable shape), not TV-static noise.
    const jag = env * (7 * Math.sin(u * Math.PI * 2.6) + 3.2 * Math.sin(u * Math.PI * 6.1 + 0.6));
    const nx = -dy / dist, ny = dx / dist;
    pts.push({ x: from.x + dx * u + nx * jag, y: from.y + dy * u + ny * jag, u });
  }
  return pts;
}

function jittered(spine: Spine, t: number, extend: number) {
  if (spine.length < 2) return spine.map(p => ({ ...p }));
  const dx = spine[spine.length - 1].x - spine[0].x, dy = spine[spine.length - 1].y - spine[0].y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist, ny = dx / dist;
  return spine.map((p, i) => {
    if (i === 0 || p.u > extend) return { ...p };
    const env = Math.sin(Math.min(1, p.u / Math.max(0.001, extend)) * Math.PI);
    const j = env * Math.sin(t * 52 + i * 1.7) * 1.8;
    return { x: p.x + nx * j, y: p.y + ny * j, u: p.u };
  });
}

function strokePts(g: Phaser.GameObjects.Graphics, pts: { x: number; y: number }[], w: number, col: number, a: number) {
  if (pts.length < 2) return;
  g.lineStyle(w, col, a);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.strokePath();
}

function drawBoltFrame(
  g: Phaser.GameObjects.Graphics,
  spine: Spine,
  t: number,
  extend: number,
  fade = 1,
  glow = false,
) {
  const live = jittered(spine, t, extend).filter(p => p.u <= extend + 0.001);
  if (live.length < 2) {
    const p = spine[0];
    g.fillStyle(0xe8ffff, 0.7 * fade).fillCircle(p.x, p.y, glow ? 5 : 3);
    return;
  }
  const a = fade;
  if (glow) {
    strokePts(g, live, 18, 0x163a88, 0.22 * a);
    strokePts(g, live, 12, 0x3a90d8, 0.36 * a);
  } else {
    strokePts(g, live, 6.5, 0x7ad0ff, 0.75 * a);
    strokePts(g, live, 3.2, 0xe8ffff, 0.95 * a);
    strokePts(g, live, 1.4, 0xffffff, 1 * a);
  }
  // Branches appear after the tip has passed, and grow out over a few frames.
  const dx = spine[spine.length - 1].x - spine[0].x, dy = spine[spine.length - 1].y - spine[0].y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist, ny = dx / dist;
  const slots = [0.22, 0.4, 0.58, 0.74];
  for (let b = 0; b < slots.length; b++) {
    const bu = slots[b];
    if (extend < bu + 0.04) continue;
    const grow = Math.min(1, (extend - bu) / 0.12);
    const src = live.reduce((best, p) => Math.abs(p.u - bu) < Math.abs(best.u - bu) ? p : best, live[0]);
    const side = b % 2 === 0 ? 1 : -1;
    const len = (16 + (b % 3) * 6) * grow;
    const flick = 0.85 + 0.15 * Math.sin(t * 40 + b * 2);
    const bx = src.x + nx * len * side + (dx / dist) * 5 * grow;
    const by = src.y + ny * len * side + (dy / dist) * 5 * grow;
    if (glow) g.lineStyle(5, 0x3a90d8, 0.28 * a * flick).lineBetween(src.x, src.y, bx, by);
    else {
      g.lineStyle(3.0, 0xb8f0ff, 0.8 * a * flick).lineBetween(src.x, src.y, bx, by);
      g.lineStyle(1.3, 0xffffff, 0.95 * a * flick).lineBetween(src.x, src.y, bx, by);
    }
  }
  const tip = live[live.length - 1];
  if (!glow) g.fillStyle(0xffffff, 0.9 * a).fillCircle(tip.x, tip.y, 3.6);
}

export function impactBurst(s: GameScene, at: { x: number; y: number }, dir?: { x: number; y: number }) {
  const g = s.add.graphics().setDepth(8010).setBlendMode(Phaser.BlendModes.ADD);
  s.objs.push(g);
  const L = Math.hypot(dir?.x ?? 1, dir?.y ?? 0) || 1;
  const dx = (dir?.x ?? 1) / L, dy = (dir?.y ?? 0) / L;
  const nx = -dy, ny = dx;
  const streaks: { ax: number; ay: number; bx: number; by: number; a: number }[] = [];
  // Tight cone along the incoming path, plus two short side ticks — not a 12-point star.
  for (let i = 0; i < 5; i++) {
    const ang = (i - 2) * 0.22;
    const c = Math.cos(ang), sn = Math.sin(ang);
    const vx = dx * c - dy * sn, vy = dx * sn + dy * c;
    const len = 16 + (i % 3) * 8;
    streaks.push({ ax: at.x - vx * 3, ay: at.y - vy * 3, bx: at.x + vx * len, by: at.y + vy * len, a: 0.95 });
  }
  for (const side of [-1, 1, -1.4, 1.4]) {
    streaks.push({ ax: at.x, ay: at.y, bx: at.x + nx * 14 * side, by: at.y + ny * 14 * side, a: 0.75 });
  }
  const paint = (u: number) => {
    g.clear();
    const fade = 1 - u;
    g.fillStyle(0x7ad0ff, 0.4 * fade).fillCircle(at.x, at.y, 18 + u * 22);
    g.fillStyle(0xe8ffff, 0.55 * fade).fillCircle(at.x, at.y, 10 + u * 10);
    g.fillStyle(0xffffff, 0.8 * fade).fillCircle(at.x, at.y, 5);
    for (const st of streaks) {
      g.lineStyle(1.6, 0xd8f4ff, st.a * fade).lineBetween(st.ax, st.ay, st.bx, st.by);
      g.lineStyle(0.7, 0xffffff, 0.8 * fade).lineBetween(st.ax, st.ay, st.bx, st.by);
    }
  };
  paint(0);
  const tr = { u: 0 };
  s.tweens.add({
    targets: tr, u: 1, duration: 280, ease: 'Quad.easeOut',
    onUpdate: () => paint(tr.u),
    onComplete: () => g.destroy(),
  });
}

/** Short shake + hit-stop. No punch-zoom (the office camera stays locked). */
export function cameraKick(s: GameScene, ms = 140, amp = 0.008, stop = 0.12) {
  try { s.cameras.main.shake(ms, amp); } catch { /* */ }
  s.hitStopT = Math.max(s.hitStopT ?? 0, stop);
}

export function launchAnimatedBolt(
  s: GameScene,
  from: { x: number; y: number },
  to: { x: number; y: number },
  onHit?: () => void,
  dur = 240,
) {
  const spine = makeSpine(from, to);
  const core = s.add.graphics().setDepth(8000).setBlendMode(Phaser.BlendModes.ADD);
  const glow = s.add.graphics().setDepth(7990).setBlendMode(Phaser.BlendModes.ADD);
  s.objs.push(core, glow);
  const tr = { u: 0 };
  const paint = (extend: number, fade = 1) => {
    core.clear(); glow.clear();
    const lag = Math.max(0, extend - 0.1);
    drawBoltFrame(glow, spine, s.t, lag, fade * 0.85, true);
    drawBoltFrame(core, spine, s.t, extend, fade, false);
  };
  const hit = () => {
    try { sfx('impact_snap'); } catch { /* */ }
    impactBurst(s, to, { x: to.x - from.x, y: to.y - from.y });
    cameraKick(s);
    onHit?.();
    const fade = { a: 1 };
    s.tweens.add({
      targets: fade, a: 0, duration: 200, ease: 'Sine.easeIn',
      onUpdate: () => paint(1, fade.a),
      onComplete: () => { core.destroy(); glow.destroy(); },
    });
  };
  const handle = {
    setU(u: number, fade = 1) { tr.u = u; paint(u, fade); },
    hit,
    destroy() { core.destroy(); glow.destroy(); },
  };
  if (dur > 0) {
    s.tweens.add({
      targets: tr, u: 1, duration: dur, ease: 'Cubic.easeOut',
      onUpdate: () => paint(tr.u, 1),
      onComplete: hit,
    });
  }
  paint(dur > 0 ? 0.08 : 0, 1);
  return handle;
}

/** @deprecated visual helper kept for any leftover full-length draws */
export function drawForkedBolt(
  g: Phaser.GameObjects.Graphics,
  x0: number, y0: number, x1: number, y1: number,
  t: number, extend = 1,
) {
  drawBoltFrame(g, makeSpine({ x: x0, y: y0 }, { x: x1, y: y1 }), t, extend, 1, false);
  drawBoltFrame(g, makeSpine({ x: x0, y: y0 }, { x: x1, y: y1 }), t, Math.max(0, extend - 0.1), 0.7, true);
}

export function launchShot(
  s: GameScene,
  kind: ShotKind,
  from: { x: number; y: number },
  to: { x: number; y: number },
  onHit?: () => void,
  dur = 260,
) {
  if (kind === 'bolt') return launchAnimatedBolt(s, from, to, onHit, dur);
  const g = s.add.graphics().setDepth(8000).setBlendMode(Phaser.BlendModes.ADD);
  s.objs.push(g);
  const tracker = { u: 0 };
  s.tweens.add({
    targets: tracker, u: 1, duration: dur,
    ease: kind === 'loud' ? 'Sine.easeOut' : 'Quad.easeOut',
    onUpdate: () => { g.clear(); drawShot(g, kind, from, to, tracker.u, s.t); },
    onComplete: () => {
      try { sfx('impact_snap'); } catch { /* */ }
      if (kind === 'hot' || kind === 'loud' || kind === 'wet' || kind === 'dart') burst(s, kind, to);
      else impactBurst(s, to, { x: to.x - from.x, y: to.y - from.y });
      cameraKick(s, 70, 0.003, 0.05);
      onHit?.();
      s.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
    },
  });
  return g;
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
  if (kind === 'hot') {
    const arc = Math.sin(u * Math.PI) * 18;
    const px = x, py = y - arc;
    for (let i = 3; i >= 0; i--) {
      g.fillStyle(i === 0 ? 0xfff3c8 : 0xff9a3a, 0.18 + i * 0.08);
      g.fillEllipse(px, py, 22 + i * 10, 10 + i * 4);
    }
    for (let k = 1; k <= 3; k++) {
      const uu = Math.max(0, u - k * 0.12);
      const hx = from.x + (to.x - from.x) * uu;
      const hy = from.y + (to.y - from.y) * uu - Math.sin(uu * Math.PI) * 18;
      g.lineStyle(1.5, 0xffc070, 0.35 / k).strokeEllipse(hx, hy, 16 + k * 8, 8 + k * 3);
    }
    void t;
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
    for (let i = 0; i < 5; i++) {
      const uu = Math.max(0, u - i * 0.06);
      const dx = (1 - uu) * (1 - uu) * from.x + 2 * (1 - uu) * uu * mx + uu * uu * to.x;
      const dy = (1 - uu) * (1 - uu) * from.y + 2 * (1 - uu) * uu * my + uu * uu * to.y;
      g.fillStyle(0x8ad4f0, 0.7 - i * 0.1);
      g.fillCircle(dx + Math.sin(i * 2) * 3, dy, 3.2 - i * 0.35);
    }
    const qx = (1 - u) * (1 - u) * from.x + 2 * (1 - u) * u * mx + u * u * to.x;
    const qy = (1 - u) * (1 - u) * from.y + 2 * (1 - u) * u * my + u * u * to.y;
    g.fillStyle(0xe8fbff, 0.85).fillCircle(qx, qy, 3.5);
    return;
  }
  const lift = Math.sin(u * Math.PI) * 16;
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const px = x, py = y - lift;
  const c = Math.cos(ang), sn = Math.sin(ang);
  g.fillStyle(0x9ad8f0, 0.95);
  g.fillTriangle(px + c * 10, py + sn * 10, px - c * 8 + -sn * 5, py - sn * 8 + c * 5, px - c * 8 - -sn * 5, py - sn * 8 - c * 5);
  g.fillStyle(0xe8ffff, 0.7).fillCircle(px, py, 2.2);
}

function burst(s: GameScene, kind: ShotKind, at: { x: number; y: number }) {
  const g = s.add.graphics().setDepth(8010).setBlendMode(Phaser.BlendModes.ADD);
  s.objs.push(g);
  if (kind === 'hot') g.fillStyle(0xffc070, 0.5).fillEllipse(at.x, at.y, 36, 20);
  else if (kind === 'loud') {
    g.lineStyle(3, 0x7ad4d8, 0.6).strokeCircle(at.x, at.y, 18);
    g.lineStyle(2, 0x7ad4d8, 0.35).strokeCircle(at.x, at.y, 32);
  } else if (kind === 'wet') {
    for (let i = 0; i < 8; i++) {
      const a = -0.2 + Math.random() * (Math.PI + 0.4);
      g.fillStyle(0x8ad4f0, 0.8).fillCircle(at.x + Math.cos(a) * 8, at.y + Math.sin(a) * 6, 2.4);
    }
  } else g.fillStyle(0x9ad8f0, 0.7).fillCircle(at.x, at.y, 7);
  s.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
}

try {
  if (typeof window !== 'undefined' && /[?&](?:test=1|impact)\b/.test(window.location.search)) {
    const w = window as unknown as {
      __launchBolt: typeof launchAnimatedBolt;
      __startWindup: typeof startWindupPose;
    };
    w.__launchBolt = launchAnimatedBolt;
    w.__startWindup = startWindupPose;
  }
} catch { /* */ }
