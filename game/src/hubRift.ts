// Hub rift puzzle visuals (code-drawn, no AI art): broken chasm edges, falling debris,
// the etched word on the south lip, the FLOOR span that materialises across the rift,
// and the hub floor lamp whose FLOOR the player takes.
import Phaser from 'phaser';

export const RIFT = { x0: 80, x1: 1200, ny: 248, face: 28, sy: 404 };
/** The only crossable lane. The etched word and the span live here. */
export const LANE = { x0: 592, x1: 688 };
export const RIFT_WORD = { x: 640, y: 420 };
export const LAMP = { x: 256, y: 574 };

type Scene = Phaser.Scene & { objs: Phaser.GameObjects.GameObject[]; t: number };

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const poly = (g: Phaser.GameObjects.Graphics, pts: number[][]) => g.fillPoints(pts.map(p => ({ x: p[0], y: p[1] })) as unknown as Phaser.Math.Vector2[], true);

/** Broken, lit edges and depth variation over the existing black drop. Purely visual; collision is RIFT/LANE. */
export function drawRiftDetail(s: Scene) {
  const { x0, x1, ny, face, sy } = RIFT; const foot = ny + face;
  const r = rng(4471);
  // art-v12: the chasm itself is a Blender render (storeys of slab, ceiling void and rebar sinking into cold fog),
  // composited 1:1 under the lips. The code keeps only the south-lip bites, the lane stubs and the falling debris.
  if (s.textures.exists('hub_rift')) {
    const im = s.add.image(0, 236, 'hub_rift').setOrigin(0).setDepth(-960); im.name = 'hub-rift-render'; s.objs.push(im);
  }
  const rendered = s.textures.exists('hub_rift');
  // Depth: faint cold shafts far down, uneven along the length (not a uniform strip).
  const deep = s.add.graphics().setDepth(-966).setVisible(!rendered); deep.name = 'hub-rift-deep'; s.objs.push(deep);
  for (const c of [{ x: 190, w: 70, a: 0.05 }, { x: 452, w: 46, a: 0.035 }, { x: 905, w: 90, a: 0.045 }, { x: 1110, w: 40, a: 0.03 }]) {
    for (let i = 0; i < 7; i++) {
      deep.fillStyle(0x2a5a6a, c.a * (1 - i / 7));
      deep.fillRect(c.x - c.w / 2 + i * 3, foot + 30 + i * 9, c.w - i * 6, 10);
    }
  }
  // Floating broken slabs at different depths: lit top edge, dark mass, smaller + dimmer as they recede.
  const slabs = s.add.graphics().setDepth(-958).setVisible(!rendered); slabs.name = 'hub-rift-slabs'; s.objs.push(slabs);
  for (const f of [{ x: 236, y: 330, w: 64, k: 1 }, { x: 812, y: 318, w: 44, k: 0.7 }, { x: 1010, y: 352, w: 30, k: 0.45 }, { x: 390, y: 362, w: 22, k: 0.35 }]) {
    const h = 9 * f.k + 4;
    slabs.fillStyle(0x0d151c, 1);
    poly(slabs, [[f.x - f.w / 2, f.y], [f.x + f.w / 2, f.y + 2], [f.x + f.w / 2 - 6, f.y + h], [f.x + 4, f.y + h + 5 * f.k], [f.x - f.w / 2 + 5, f.y + h - 1]]);
    slabs.fillStyle(0x6a8a98, 0.35 * f.k + 0.08).fillRect(f.x - f.w / 2 + 1, f.y, f.w - 3, 1.5);
    slabs.lineStyle(1, 0x3a4650, 0.5 * f.k).lineBetween(f.x - 6, f.y + h, f.x - 8, f.y + h + 9 * f.k);
  }
  // North face: a ragged broken underside with hanging chunks and rebar, not a ruler line.
  const nf = s.add.graphics().setDepth(121).setVisible(!rendered); nf.name = 'hub-rift-northbreak'; s.objs.push(nf);
  for (let x = x0; x < x1;) {
    const w = 14 + r() * 34, d = 3 + r() * (r() < 0.2 ? 22 : 10);
    if (x + w > LANE.x0 - 4 && x < LANE.x1 + 4) { x += w; continue; }
    nf.fillStyle(0x1a2a36, 1);
    poly(nf, [[x, foot - 1], [x + w, foot - 1], [x + w - 3, foot + d * 0.6], [x + w * 0.55, foot + d], [x + 3, foot + d * 0.5]]);
    nf.fillStyle(0x060a0e, 0.7).fillRect(x + 2, foot + d * 0.45, w - 5, 2);
    if (r() < 0.3) { nf.lineStyle(1.4, 0x56626c, 0.75); nf.lineBetween(x + w * 0.4, foot + d * 0.7, x + w * 0.4 + (r() - 0.5) * 6, foot + d + 6 + r() * 8); }
    x += w;
  }
  // South lip: bites taken out of the edge, lit cold from above, cracks running back into the slab.
  const sl = s.add.graphics().setDepth(-934); sl.name = 'hub-rift-southbreak'; s.objs.push(sl);
  for (let x = x0; x < x1;) {
    const w = 18 + r() * 40;
    if (x + w > LANE.x0 - 6 && x < LANE.x1 + 6) { x += w; continue; }
    const bite = r() < 0.45 ? 3 + r() * 7 : 0;
    if (bite) {
      sl.fillStyle(0x000000, 1);
      poly(sl, [[x, sy - 3], [x + w * 0.3, sy - 3 + bite], [x + w * 0.7, sy - 3 + bite * 0.6], [x + w, sy - 3]]);
      sl.fillStyle(0x9ab8c4, 0.5).fillRect(x + w * 0.3, sy - 3 + bite, w * 0.4, 1);
    }
    if (r() < 0.25) { sl.lineStyle(1, 0x0a121a, 0.7); const cx = x + w * 0.5; sl.beginPath(); sl.moveTo(cx, sy); sl.lineTo(cx + (r() - 0.5) * 10, sy + 8 + r() * 6); sl.lineTo(cx + (r() - 0.5) * 16, sy + 16 + r() * 10); sl.strokePath(); }
    x += w;
  }
  // The lane: two broken stubs that clearly used to meet. Their ends face each other.
  const stub = s.add.graphics().setDepth(-930); stub.name = 'hub-rift-stubs'; s.objs.push(stub);
  stub.fillStyle(0x24323e, 1);
  poly(stub, [[LANE.x0, sy - 2], [LANE.x1, sy - 2], [LANE.x1 - 6, sy - 22], [LANE.x0 + 58, sy - 30], [LANE.x0 + 30, sy - 18], [LANE.x0 + 6, sy - 26]]);
  stub.fillStyle(0x6a8696, 0.55).fillRect(LANE.x0 + 4, sy - 3, LANE.x1 - LANE.x0 - 8, 1.5);
  stub.fillStyle(0x0c141a, 0.9);
  poly(stub, [[LANE.x0 + 6, sy - 26], [LANE.x0 + 30, sy - 18], [LANE.x0 + 58, sy - 30], [LANE.x1 - 6, sy - 22], [LANE.x1 - 8, sy - 18], [LANE.x0 + 8, sy - 20]]);
  stub.lineStyle(1.6, 0x56626c, 0.85); stub.lineBetween(LANE.x0 + 22, sy - 22, LANE.x0 + 19, sy - 36); stub.lineBetween(LANE.x1 - 24, sy - 24, LANE.x1 - 20, sy - 38);
  const ns = s.add.graphics().setDepth(122); ns.name = 'hub-rift-stub-north'; s.objs.push(ns);
  ns.fillStyle(0x1e2e3a, 1);
  poly(ns, [[LANE.x0, foot - 2], [LANE.x1, foot - 2], [LANE.x1 - 4, foot + 16], [LANE.x0 + 40, foot + 24], [LANE.x0 + 4, foot + 12]]);
  ns.fillStyle(0x060a0e, 0.8).fillRect(LANE.x0 + 6, foot + 10, LANE.x1 - LANE.x0 - 12, 2);
  ns.lineStyle(1.6, 0x56626c, 0.85); ns.lineBetween(LANE.x0 + 28, foot + 18, LANE.x0 + 26, foot + 32);
  return { stubS: stub, stubN: ns };
}

/** Bits of floor keep breaking off the lips and falling out of sight. */
export function startRiftDebris(s: Scene) {
  const g = s.add.graphics().setDepth(-946); g.name = 'hub-rift-debris'; s.objs.push(g);
  type D = { x: number; y: number; vy: number; vx: number; s: number; a: number; y0: number };
  const ds: D[] = [];
  const r = Math.random;
  const spawn = (): D => {
    let x = RIFT.x0 + 30 + r() * (RIFT.x1 - RIFT.x0 - 60);
    if (x > LANE.x0 - 10 && x < LANE.x1 + 10) x += 140;
    const fromN = r() < 0.5, y = fromN ? RIFT.ny + RIFT.face + 4 : RIFT.sy - 2;
    return { x, y, y0: y, vy: fromN ? 20 : -10, vx: (r() - 0.5) * 10, s: 2 + r() * 3, a: 0.9 };
  };
  for (let i = 0; i < 6; i++) { const d = spawn(); d.y += r() * 40; ds.push(d); }
  const tick = () => {
    if (!g.active) return;
    g.clear();
    for (const d of ds) {
      d.vy += 260 * 0.033; d.y += d.vy * 0.033; d.x += d.vx * 0.033;
      const fall = Math.max(0, d.y - d.y0);
      const k = Math.max(0, 1 - fall / 120);
      if (k <= 0.02) { Object.assign(d, spawn()); continue; }
      g.fillStyle(0x3a4a56, d.a * k).fillRect(d.x, d.y, d.s * (0.4 + 0.6 * k), d.s * (0.4 + 0.6 * k));
      g.fillStyle(0x9ab8c4, 0.4 * k).fillRect(d.x, d.y, d.s * (0.4 + 0.6 * k), 0.8);
    }
    s.time.delayedCall(33, tick);
  };
  tick();
}

/** The word etched into the south lip stub. Flickers like failing text, never a floating tag. */
export class RiftWord {
  t: Phaser.GameObjects.Text; sh: Phaser.GameObjects.Text; word = 'VOID';
  constructor(private s: Scene) {
    const st = { fontFamily: 'JetBrains Mono', fontSize: '18px', fontStyle: 'bold', color: '#bfe9ee' };
    this.sh = s.add.text(RIFT_WORD.x + 1, RIFT_WORD.y + 2, 'VOID', { ...st, color: '#02060a' }).setOrigin(0.5).setDepth(-899).setAlpha(0.9);
    this.t = s.add.text(RIFT_WORD.x, RIFT_WORD.y, 'VOID', st).setOrigin(0.5).setDepth(-898);
    this.t.setLetterSpacing(5); this.sh.setLetterSpacing(5);
    this.t.name = 'hub-rift-word'; s.objs.push(this.sh, this.t);
  }
  set(w: string) { this.word = w; this.t.setText(w); this.sh.setText(w); this.t.setColor(w === 'VOID' ? '#bfe9ee' : '#f2dcb0'); }
  /** right edge, where a trapped caret blinks. */
  end() { return { x: this.t.x + this.t.width / 2 + 7, y: this.t.y }; }
  update() {
    const tt = this.s.t;
    const flick = this.word === 'VOID' ? (Math.sin(tt * 23) > 0.93 ? 0.35 : 0.72 + 0.18 * Math.sin(tt * 2.3)) : 0.85;
    this.t.setAlpha(flick);
    this.t.x = RIFT_WORD.x + (this.word === 'VOID' && Math.sin(tt * 17.3) > 0.97 ? 2 : 0);
  }
}

/** FLOOR made solid across the lane: tiles write themselves in, south to north. */
export class RiftSpan {
  g: Phaser.GameObjects.Graphics; p = 0;
  constructor(private s: Scene) { this.g = s.add.graphics().setDepth(123); this.g.name = 'hub-rift-span'; s.objs.push(this.g); }
  set(on: boolean, initial: boolean) {
    this.s.tweens.killTweensOf(this);
    if (initial) { this.p = on ? 1 : 0; this.draw(); return; }
    this.s.tweens.add({ targets: this, p: on ? 1 : 0, duration: on ? 900 : 400, ease: on ? 'Cubic.easeOut' : 'Quad.easeIn', onUpdate: () => this.draw() });
  }
  draw() {
    const g = this.g; g.clear(); if (this.p <= 0.001) return;
    const top = RIFT.ny - 2, bot = RIFT.sy, H = bot - top, L = LANE.x0, R = LANE.x1;
    const y0 = bot - H * this.p;
    // shadow the slab throws down the far face, then the slab's thickness on its east edge (the side the camera sees)
    g.fillStyle(0x000000, 0.35).fillRect(L + 6, y0 + 10, R - L - 2, bot - y0 - 6);
    g.fillStyle(0x0b1620, 1); poly(g, [[R, y0], [R + 7, y0 + 9], [R + 7, bot + 6], [R, bot]]);
    // one continuous deck: lighter where it meets the south floor, sinking darker toward the far lip (no rows, no steps)
    const bands = 14;
    for (let i = 0; i < bands; i++) {
      const ya = y0 + (bot - y0) * i / bands, yb = y0 + (bot - y0) * (i + 1) / bands;
      const k = (ya - top) / H;   // 0 far, 1 near
      g.fillStyle(Phaser.Display.Color.GetColor(18 + 14 * k, 40 + 22 * k, 58 + 26 * k), 1).fillRect(L, ya, R - L, yb - ya + 0.5);
    }
    // grain runs along the span (north-south), like the room's floor boards turned to cross
    for (const gx of [L + 19, L + 38, L + 58, L + 77]) g.lineStyle(1, 0x2c5470, 0.35).lineBetween(gx, y0 + 2, gx, bot - 2);
    // lit edges + the far end resting on the north lip
    g.fillStyle(0x7aa4b8, 0.7).fillRect(L, y0, 1.5, bot - y0); g.fillStyle(0x3a5a6c, 0.8).fillRect(R - 1.5, y0, 1.5, bot - y0);
    if (this.p > 0.98) g.fillStyle(0x0a121a, 0.9).fillRect(L, top, R - L, 3);
    // the edge being written right now glows warm
    if (this.p < 0.999) { g.fillStyle(0xf2dcb0, 0.85).fillRect(L, y0, R - L, 2); g.fillStyle(0xf2dcb0, 0.25).fillRect(L, y0 + 2, R - L, 5); }
  }
}

/** A standing floor lamp: weighted base, pole, angled fabric shade, warm light shaped by the shade. */
export class HubLamp {
  light: Phaser.GameObjects.Graphics; body: Phaser.GameObjects.Graphics; hole: Phaser.GameObjects.Graphics; tag: Phaser.GameObjects.Text;
  onFloor = true; private bob = 0;
  constructor(private s: Scene) {
    const { x, y } = LAMP;
    this.hole = s.add.graphics().setDepth(y - 6); this.hole.name = 'hub-lamp-hole'; s.objs.push(this.hole);
    this.light = s.add.graphics().setDepth(-905).setBlendMode(Phaser.BlendModes.ADD); this.light.name = 'hub-lamp-light'; s.objs.push(this.light);
    this.body = s.add.graphics().setDepth(y); this.body.name = 'hub-lamp'; s.objs.push(this.body);
    // Floor stencil under the lamp: the word it stands on, painted in the light.
    this.tag = s.add.text(x + 2, y + 24, 'FLOOR', { fontFamily: 'JetBrains Mono', fontSize: '11px', fontStyle: 'bold', color: '#b8925a' }).setOrigin(0.5).setDepth(-899).setAlpha(0.8);
    this.tag.setLetterSpacing(4); s.objs.push(this.tag);
    this.drawBody(0); this.drawLight(1);
  }
  private drawBody(dy: number) {
    const { x, y } = LAMP; const g = this.body; g.clear();
    const by = y + dy;
    g.fillStyle(0x000000, this.onFloor ? 0.3 : 0).fillRect(x - 19, y + 1, 40, 3);
    // weighted plinth: lit top face (warm, from the shade above), brass rim, mid-tone front face
    g.fillStyle(0x5a4a3a, 1); poly(g, [[x - 16, by], [x + 16, by], [x + 16, by - 5], [x - 16, by - 5]]);
    g.fillStyle(0xb89a6e, 1); poly(g, [[x - 16, by - 5], [x + 16, by - 5], [x + 11, by - 11], [x - 11, by - 11]]);
    g.fillStyle(0xe8c890, 0.9).fillRect(x - 16, by - 5.5, 32, 1.2);
    g.fillStyle(0x2a2218, 1).fillRect(x - 2.5, by - 12, 5, 3);
    g.fillStyle(0x3a322a, 1).fillRect(x - 1.5, by - 104, 3, 98);
    g.fillStyle(0x8a7a62, 0.6).fillRect(x - 1.5, by - 104, 1, 98);
    // shade: angled trapezoid, lit from inside
    const st = by - 134, sb = by - 102;
    g.fillStyle(0x9a7a4e, 1); poly(g, [[x - 12, st], [x + 12, st], [x + 23, sb], [x - 23, sb]]);
    g.fillStyle(0xe8c48a, 1); poly(g, [[x - 9, st + 2], [x + 6, st + 2], [x + 15, sb - 2], [x - 18, sb - 2]]);
    g.fillStyle(0xfff1c8, 0.95).fillRect(x - 22, sb - 2, 44, 2);
    g.fillStyle(0x5a4630, 1).fillRect(x - 12, st - 1, 24, 2);
  }
  private drawLight(a: number) {
    const { x, y } = LAMP; const g = this.light; g.clear();
    const sb = y - 102;
    // cone out of the shade's open bottom, widening to the floor
    for (let i = 0; i < 3; i++) {
      const w0 = 22 + i * 4, w1 = 52 + i * 18;
      g.fillStyle(0xf6c684, 0.05 * a);
      poly(g, [[x - w0, sb], [x + w0, sb], [x + w1, y + 6], [x - w1, y + 6]]);
    }
    // floor pool: a flattened trapezoid set by the shade, not a disc
    for (let i = 0; i < 4; i++) {
      const w = 58 + i * 16, h = 10 + i * 4;
      g.fillStyle(0xf6c684, 0.07 * a);
      poly(g, [[x - w * 0.7, y - h], [x + w * 0.7, y - h], [x + w, y + h * 0.6], [x - w, y + h * 0.6]]);
    }
    // a little spill up out of the shade top
    g.fillStyle(0xf6c684, 0.06 * a); poly(g, [[x - 12, y - 134], [x + 12, y - 134], [x + 6, y - 160], [x - 6, y - 160]]);
  }
  /** FLOOR taken: the tile under it goes, the lamp hangs on over nothing, its light falters. */
  setFloor(on: boolean) {
    this.onFloor = on;
    this.tag.setVisible(on);
    const g = this.hole; g.clear();
    if (!on) {
      const { x, y } = LAMP;
      const hole = [[x - 30, y - 4], [x - 8, y - 9], [x + 22, y - 6], [x + 32, y + 4], [x + 10, y + 11], [x - 24, y + 8]];
      g.fillStyle(0x0a1620, 1); poly(g, hole);
      g.fillStyle(0x1e3a48, 0.9); poly(g, [[x - 22, y - 2], [x - 6, y - 6], [x + 18, y - 4], [x + 24, y + 2], [x - 18, y + 1]]);
      g.fillStyle(0x03060a, 1); poly(g, [[x - 18, y + 2], [x + 22, y + 3], [x + 8, y + 9], [x - 16, y + 7]]);
      g.lineStyle(1, 0x8ab4c4, 0.7); g.beginPath(); g.moveTo(hole[0][0], hole[0][1]); for (const [px, py] of hole.slice(1, 4)) g.lineTo(px, py); g.strokePath();
    }
  }
  update() {
    const tt = this.s.t;
    if (this.onFloor) { if (this.bob) { this.bob = 0; this.drawBody(0); } this.drawLight(0.95 + 0.05 * Math.sin(tt * 1.7)); return; }
    this.bob = -6 + 2 * Math.sin(tt * 2.2); this.drawBody(this.bob);
    this.drawLight(Math.sin(tt * 19) > 0.8 ? 0.25 : 0.6);
  }
}
