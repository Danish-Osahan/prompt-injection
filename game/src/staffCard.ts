import Phaser from 'phaser';

/**
 * World rule: every enemy is a staff record and wears an ID card in a fixed, big-enough spot.
 * Its line (about 4 words) is printed on that card. While the line is hidden the card carries
 * only ragged ink bars; no real text exists anywhere in the display list (the face is a canvas
 * and nothing is drawn as letters until the line opens).
 *
 * Only the corridor guard is implemented. The other mounts are named so later enemies can use them.
 */
export type StaffMount = 'clip' | 'tape' | 'holder' | 'lanyard';
export interface StaffRecord {
  /** the default line; the plate's live words override it */
  line: string;
  /** card bottom-centre in the enemy rig's local space (1x px): where the mount holds it */
  anchor: { x: number; y: number };
  /** card size multiplier (1 = 62 x 42 px) */
  scale: number;
  mount: StaffMount;
  /** name printed in the footer (red while it guards, grey once it is stopped) */
  name: string;
  /** resting tilt on the mount, radians */
  tilt?: number;
}

export const STAFF_RECORDS: Record<string, StaffRecord> = {
  // the sentinel's head is a blank ID card on its pole; this card replaces it, clipped where the pole enters
  c_dummy: { line: 'GUARD IS QUICK', anchor: { x: 0, y: -158 }, scale: 1, mount: 'clip', name: 'NOOR', tilt: -0.04 },
};

export type CardState = 'hidden' | 'open' | 'still';
export const CARD_W = 62, CARD_H = 42;
const SS = 4;          // the face is drawn at 4x and shown at 1x
const PAD = 7;         // room for the thickness edge, contact shadow and clip
const INK = 'rgb(18,22,32)', TEAL = 'rgb(0,60,72)', TEAL_EDGE = 'rgb(0,38,48)', RED = 'rgb(196,64,56)', GREY = 'rgb(112,110,106)';
const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
const ROWS = [{ top: 8, base: 16.5 }, { top: 19, base: 27.5 }];
const INNER_L = 4, INNER_R = CARD_W - 4;

type Box = { x: number; y: number; w: number; h: number; row: number };

/** Split a line into two rows, balanced by length (ties keep the longer first row). */
export function cardRows(words: string[]): string[][] {
  if (words.length < 2) return [words.slice(), []];
  let best = 1, bestScore = Infinity;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' ').length, b = words.slice(k).join(' ').length;
    const score = Math.max(a, b) * 10 + (a < b ? 1 : 0);
    if (score < bestScore) { bestScore = score; best = k; }
  }
  return [words.slice(0, best), words.slice(best)];
}

export class StaffCard {
  readonly root: Phaser.GameObjects.Container;
  readonly rec: StaffRecord;
  private img: Phaser.GameObjects.Image;
  private tex: Phaser.Textures.CanvasTexture;
  private scene: Phaser.Scene;
  state: CardState = 'hidden';
  words: string[] = [];
  sel = -1;
  awake = true;
  /** index of a word being re-printed and the print-head progress (1 = done) */
  fresh = -1;
  wipe = 1;
  /** the words currently drawn as letters on the face ('' while hidden) */
  printed = '';
  lean = 0;
  private boxes: Box[] = [];

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, rec: StaffRecord, key: string) {
    this.scene = scene; this.rec = rec;
    if (rec.mount !== 'clip') console.warn(`staffCard: mount '${rec.mount}' not built yet, using clip`);
    const tw = (CARD_W + PAD * 2) * SS, th = (CARD_H + PAD * 2) * SS;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.tex = scene.textures.createCanvas(key, tw, th)!;
    this.root = scene.add.container(rec.anchor.x, rec.anchor.y);
    this.img = scene.add.image(0, 0, key)
      .setOrigin((PAD + CARD_W / 2) / (CARD_W + PAD * 2), (PAD + CARD_H) / (CARD_H + PAD * 2))
      .setScale(rec.scale / SS);
    this.root.add(this.img);
    parent.add(this.root);
    this.words = rec.line.split(' ');
    this.setLean(0);
    this.draw();
  }

  /** The rig leans about its feet: the card goes with it (position and angle). */
  setLean(a: number) {
    this.lean = a;
    const { x, y } = this.rec.anchor;
    this.root.setPosition(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));
    this.root.setRotation((this.rec.tilt ?? 0) + a);
  }

  setAwake(on: boolean) { if (on !== this.awake) { this.awake = on; this.draw(); } }

  /** Show the card for a line. state 'hidden' prints bars only. A slot word that changed is re-printed with a wipe. */
  show(words: string[], state: CardState) {
    const prev = this.words, prevState = this.state;
    this.words = words.slice();
    this.state = state;
    if (state !== 'open') this.sel = -1;
    this.scene.tweens.killTweensOf(this);
    if (state === 'still' && prevState !== 'still') {
      const i = words.findIndex((w, k) => prev[k] !== undefined && prev[k] !== w);
      this.fresh = i >= 0 ? i : words.length - 1;
      this.wipe = 0;
      this.scene.tweens.add({ targets: this, wipe: 1, duration: 260, ease: 'Sine.easeInOut', onUpdate: () => this.draw(), onComplete: () => this.draw() });
    } else if (state !== 'still') { this.fresh = -1; this.wipe = 1; }
    this.draw();
  }

  setSel(i: number) {
    const n = this.state === 'open' ? i : -1;
    if (n !== this.sel) { this.sel = n; this.draw(); }
  }

  /** World box (centre, size) of word i on the card face. */
  wordBox(i: number): { x: number; y: number; w: number; h: number } | null {
    const b = this.boxes[i]; if (!b) return null;
    const s = this.rec.scale;
    const m = this.root.getWorldTransformMatrix();
    const p = m.transformPoint((b.x + b.w / 2 - CARD_W / 2) * s, (b.y + b.h / 2 - CARD_H) * s);
    return { x: p.x, y: p.y, w: b.w * s, h: b.h * s };
  }

  /** Where the Caret stands while word i is selected: just past the card's right edge, on that word's row. */
  caretSpot(i: number, footDrop = 33): { x: number; y: number } | null {
    const b = this.boxes[i]; if (!b) return null;
    const s = this.rec.scale;
    const m = this.root.getWorldTransformMatrix();
    const p = m.transformPoint((CARD_W / 2 + 11) * s, (b.y + b.h / 2 - CARD_H) * s + footDrop);
    return { x: p.x, y: p.y };
  }

  /** Right edge of the card in world space (for floor text etc.). */
  edge(): { x: number; y: number } {
    const p = this.root.getWorldTransformMatrix().transformPoint((CARD_W / 2) * this.rec.scale, -CARD_H / 2 * this.rec.scale);
    return { x: p.x, y: p.y };
  }

  /** A copy of the card for a dash afterimage: same face texture, placed where the card sits in the rig (rig-local). */
  ghostImage(scene: Phaser.Scene): Phaser.GameObjects.Image {
    const im = scene.add.image(this.root.x, this.root.y, this.tex.key).setOrigin(this.img.originX, this.img.originY).setScale(this.img.scaleX).setRotation(this.root.rotation);
    return im;
  }

  testState() {
    return {
      state: this.state, printed: this.printed, sel: this.sel, selWord: this.sel >= 0 ? this.words[this.sel] ?? null : null,
      rows: cardRows(this.words).map(r => r.join(' ')), fresh: this.fresh >= 0 ? this.words[this.fresh] : null, wipe: this.wipe,
      rot: this.root.rotation, lean: this.lean, parented: !!this.root.parentContainer, visible: this.root.visible && this.img.visible,
      awake: this.awake, font: FONT,
    };
  }

  // ---------------------------------------------------------------- drawing
  private draw() {
    const c = this.tex.getContext();
    const s = SS, ox = PAD * s, oy = PAD * s, W = CARD_W * s, H = CARD_H * s;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.tex.width, this.tex.height);
    const rr = (x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
    // contact shadow + card thickness
    c.save(); c.filter = `blur(${2.2 * s}px)`; c.fillStyle = 'rgba(2,4,8,0.5)'; rr(ox + 1 * s, oy + 2.5 * s, W, H, 2 * s); c.fill(); c.restore();
    c.fillStyle = 'rgb(46,52,60)'; rr(ox + 0.5 * s, oy + 1 * s, W, H, 2 * s); c.fill();
    // face: PVC card in the corridor's light, matched to the paper body it is clipped to (sampled from
    // sentinel.png): the warm lamp keys it from the right like the body's lit faces, the cool fill from the
    // left matches its shaded faces, and the lower edge falls off toward the shadowed chest. A little
    // dimmer once the guard is stopped.
    const base = this.awake ? [146, 141, 133] : [132, 129, 124];
    const col = (k: number) => `rgb(${Math.round(base[0] * k)},${Math.round(base[1] * k)},${Math.round(base[2] * k)})`;
    const g = c.createLinearGradient(ox, 0, ox + W, 0);
    g.addColorStop(0, 'rgb(118,122,124)'); g.addColorStop(0.35, col(0.98)); g.addColorStop(0.75, col(1.06)); g.addColorStop(1, this.awake ? 'rgb(170,156,136)' : 'rgb(152,142,128)');
    c.fillStyle = g; rr(ox, oy, W, H, 2 * s); c.fill();
    const fall = c.createLinearGradient(0, oy, 0, oy + H);
    fall.addColorStop(0, 'rgba(255,248,236,0.07)'); fall.addColorStop(0.45, 'rgba(0,0,0,0)'); fall.addColorStop(1, 'rgba(8,10,16,0.16)');
    c.fillStyle = fall; rr(ox, oy, W, H, 2 * s); c.fill();
    c.save(); rr(ox, oy, W, H, 2 * s); c.clip();
    // magstripe and top lip
    c.fillStyle = 'rgb(34,38,48)'; c.fillRect(ox, oy + 2.5 * s, W, 3.25 * s);
    c.fillStyle = 'rgba(185,210,220,0.5)'; c.fillRect(ox + 2 * s, oy + 0.4 * s, W - 4 * s, 0.45 * s);
    // layout
    const rows = cardRows(this.words);
    this.boxes = [];
    const paper = col(1.0);
    let wi = 0;
    const printed: string[] = [];
    rows.forEach((row, ri) => {
      if (!row.length) return;
      const R = ROWS[ri];
      let cap = R.base - R.top;
      const measure = (cp: number) => {
        c.font = `800 ${(cp / 0.70) * s}px ${FONT}`;
        try { (c as unknown as { letterSpacing: string }).letterSpacing = `${0.2 * s}px`; } catch { /* */ }
        const ws = row.map(w => c.measureText(w).width);
        const sp = 0.42 * cp * s;
        return { ws, sp, total: ws.reduce((a, b) => a + b, 0) + sp * (row.length - 1) };
      };
      let m = measure(cap);
      while (m.total > (INNER_R - INNER_L) * s && cap > 5) { cap -= 0.25; m = measure(cap); }
      let x = ox + INNER_L * s;
      const baseY = oy + R.base * s;
      row.forEach((w, k) => {
        const idx = wi++;
        const bw = m.ws[k];
        this.boxes[idx] = { x: (x - ox) / s, y: R.base - cap - 1, w: bw / s, h: cap + 2.6, row: ri };
        const top = baseY - cap * s;
        if (this.state === 'hidden') {
          this.inkBar(c, x - 1.4 * s, top - 0.9 * s, bw + 2.8 * s, cap * s + 2.0 * s, idx);
        } else if (idx === this.sel) {
          // reverse print: a block of ink, the word knocked out to the card colour
          c.fillStyle = INK; c.fillRect(x - 1.2 * s, top - 1.3 * s, bw + 2.4 * s, cap * s + 3.0 * s);
          c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x - 1.2 * s, top - 1.3 * s, bw + 2.4 * s, 0.6 * s);
          c.fillStyle = paper; c.fillText(w, x, baseY); this.qTail(c, w, x, baseY, cap * s, paper); printed.push(w);
        } else if (idx === this.fresh) {
          // fresh re-print in teal, revealed by a short wipe with a print-head line
          const reveal = bw * this.wipe;
          c.save(); c.beginPath(); c.rect(x - 1 * s, top - 2 * s, reveal + 1 * s, cap * s + 5 * s); c.clip();
          // a heavier print than the black words: a dark teal edge thickens every stroke so it holds at 1x
          c.strokeStyle = TEAL_EDGE; c.lineWidth = 0.55 * s; c.lineJoin = 'round'; c.strokeText(w, x, baseY);
          c.fillStyle = TEAL; c.fillText(w, x, baseY); this.qTail(c, w, x, baseY, cap * s, TEAL);
          c.fillStyle = TEAL_EDGE; c.fillRect(x, baseY + 1.1 * s, bw, 1.1 * s);
          c.restore();
          if (this.wipe < 1) { c.fillStyle = 'rgba(214,248,255,0.85)'; c.fillRect(x + reveal - 0.3 * s, top - 1.5 * s, 0.6 * s, cap * s + 3.5 * s); }
          printed.push(w);
        } else {
          c.fillStyle = INK; c.fillText(w, x, baseY); this.qTail(c, w, x, baseY, cap * s, INK); printed.push(w);
        }
        x += bw + m.sp;
      });
    });
    this.printed = this.state === 'hidden' ? '' : printed.join(' ');
    // footer: name and a staff-record barcode
    c.font = `800 ${(4.75 / 0.70) * s}px ${FONT}`;
    c.fillStyle = this.awake ? RED : GREY; c.fillText(this.rec.name, ox + INNER_L * s, oy + 37.5 * s);
    c.fillStyle = 'rgba(18,22,32,0.75)';
    let bx = ox + (CARD_W - 4 - 17) * s; let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    while (bx < ox + (CARD_W - 4) * s) {
      const w = [1, 1, 2, 3][Math.floor(rnd() * 4)] * 0.35 * s;
      c.fillRect(bx, oy + 33 * s, w, 4.5 * s); bx += w + [1, 2][Math.floor(rnd() * 2)] * 0.35 * s;
    }
    // sheen + the corridor's light: cool fill from the left, the warm lamp on the right edge
    const sh = c.createLinearGradient(ox, oy, ox + W * 0.8, oy + H);
    sh.addColorStop(0, 'rgba(235,245,255,0)'); sh.addColorStop(0.40, 'rgba(235,245,255,0)'); sh.addColorStop(0.49, 'rgba(235,245,255,0.13)'); sh.addColorStop(0.58, 'rgba(235,245,255,0)'); sh.addColorStop(1, 'rgba(235,245,255,0)');
    c.fillStyle = sh; c.fillRect(ox, oy, W, H);
    const wr = c.createLinearGradient(ox + W * 0.82, 0, ox + W, 0); wr.addColorStop(0, 'rgba(246,198,132,0)'); wr.addColorStop(1, 'rgba(246,198,132,0.14)');
    c.fillStyle = wr; c.fillRect(ox, oy, W, H);
    const cl = c.createLinearGradient(ox, 0, ox + W * 0.2, 0); cl.addColorStop(0, 'rgba(60,120,140,0.12)'); cl.addColorStop(1, 'rgba(60,120,140,0)');
    c.fillStyle = cl; c.fillRect(ox, oy, W, H);
    // the clip shades the face just above it (contact occlusion, as the body's plates shade each other)
    const ao = c.createRadialGradient(ox + W / 2, oy + H, 0, ox + W / 2, oy + H, 10 * s);
    ao.addColorStop(0, 'rgba(6,8,12,0.28)'); ao.addColorStop(1, 'rgba(6,8,12,0)');
    c.fillStyle = ao; c.fillRect(ox, oy, W, H);
    c.restore();
    // lit right edge, shaded left edge: the card's own thickness picks up the lamp like the body's plate edges
    c.fillStyle = 'rgba(248,214,160,0.55)'; c.fillRect(ox + W - 0.7 * s, oy + 2 * s, 0.7 * s, H - 4 * s);
    c.fillStyle = 'rgba(10,14,20,0.35)'; c.fillRect(ox, oy + 2 * s, 0.6 * s, H - 4 * s);
    // the mount: a small bulldog clip where the pole enters the card
    const cx = ox + (CARD_W / 2) * s, cy = oy + (CARD_H - 2) * s;
    c.fillStyle = 'rgb(40,46,54)'; rr(cx - 4.5 * s, cy, 9 * s, 5.5 * s, 0.8 * s); c.fill();
    c.fillStyle = 'rgb(120,138,148)'; c.fillRect(cx - 4 * s, cy + 0.4 * s, 8 * s, 0.7 * s);
    c.fillStyle = 'rgb(12,14,18)'; c.fillRect(cx - 0.6 * s, cy + 2 * s, 1.2 * s, 3 * s);
    c.fillStyle = 'rgb(22,26,32)'; c.fillRect(cx - 4 * s, cy + 4.6 * s, 8 * s, 0.6 * s);
    this.tex.refresh();
  }

  /** At 1x Barlow's Q tail is about a pixel and reads as O: print it a little heavier. */
  private qTail(c: CanvasRenderingContext2D, w: string, x: number, baseY: number, capPx: number, fill: string) {
    for (let k = 0; k < w.length; k++) {
      if (w[k] !== 'Q') continue;
      const qx = x + (k ? c.measureText(w.slice(0, k)).width : 0), qw = c.measureText('Q').width;
      c.save(); c.strokeStyle = fill; c.lineCap = 'butt'; c.lineWidth = capPx * 0.19;
      c.beginPath(); c.moveTo(qx + qw * 0.50, baseY - capPx * 0.22); c.lineTo(qx + qw * 0.92, baseY + capPx * 0.20); c.stroke(); c.restore();
    }
  }

  /** A felt-marker pass over where a word would be: ragged ends, two strokes, no letters underneath. */
  private inkBar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, idx: number) {
    let seed = 31 + idx * 17;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const pass = (dy: number, hh: number, a: number) => {
      c.beginPath();
      const steps = 6;
      c.moveTo(x + rnd() * 2 * SS, y + dy);
      c.lineTo(x + w - rnd() * 2 * SS, y + dy + (rnd() - 0.5) * 0.6 * SS);
      for (let i = 1; i <= steps; i++) c.lineTo(x + w - rnd() * 1.6 * SS, y + dy + (hh * i) / steps);
      c.lineTo(x + rnd() * 1.6 * SS, y + dy + hh + (rnd() - 0.5) * 0.6 * SS);
      for (let i = steps - 1; i >= 1; i--) c.lineTo(x + rnd() * 1.8 * SS, y + dy + (hh * i) / steps);
      c.closePath();
      c.fillStyle = `rgba(14,15,18,${a})`; c.fill();
    };
    pass(0, h * 0.62, 0.95);
    pass(h * 0.36, h * 0.64, 0.9);
    c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x + 1.5 * SS, y + 0.6 * SS, w - 3 * SS, 0.5 * SS);
  }
}
