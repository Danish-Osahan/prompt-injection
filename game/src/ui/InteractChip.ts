// Small diegetic key-cap + verb plate, anchored near an object (never a fill-ring).
// One visual language for every take / throw / look chip and every progressive hint.
import Phaser from 'phaser';

export function placeChip(objX: number, objY: number, noorX: number, noorY: number, ox = 36, oy = 8) {
  const cands = [
    { x: objX + ox, y: objY + oy },
    { x: objX - ox, y: objY + oy },
    { x: objX + ox, y: objY + 28 },
    { x: objX - ox, y: objY + 28 },
    { x: objX, y: objY + 40 },
  ];
  const hx = noorX, hy = noorY - 52;
  for (const c of cands) if (Math.hypot(c.x - hx, c.y - hy) >= 58) return c;
  return { x: objX + ox, y: objY + 44 };
}

/** Parse a hint string like "F  throw" / "HOLD J  the cursor aims" into key + verb. */
export function splitHint(s: string) {
  const i = s.indexOf('  ');
  let key = i > 0 ? s.slice(0, i) : '', verb = i > 0 ? s.slice(i + 2) : s;
  if (/^HOLD /.test(key)) { key = key.slice(5); verb = 'hold \u00b7 ' + verb; }
  return { key, verb };
}

export class InteractChip {
  /** Until the first take, the take chip spells out that E is held. */
  static taughtTake = false;
  root: Phaser.GameObjects.Container;
  private cap: Phaser.GameObjects.Graphics;
  private letter: Phaser.GameObjects.Text;
  private verb: Phaser.GameObjects.Text;
  private rawVerb = '';

  constructor(s: Phaser.Scene, depth = 9002, private centered = false) {
    this.root = s.add.container(0, 0).setDepth(depth).setAlpha(0);
    this.cap = s.add.graphics();
    this.letter = s.add.text(0, 0, 'E', {
      fontFamily: 'IBM Plex Mono', fontSize: '12px', fontStyle: '700', color: '#eafcfb',
    }).setOrigin(0.5);
    this.verb = s.add.text(16, 0, '', {
      fontFamily: 'IBM Plex Mono', fontSize: '11px', fontStyle: '600', color: '#cfeeed',
    }).setOrigin(0, 0.5);
    this.verb.setLetterSpacing(1.5);
    this.root.add([this.cap, this.letter, this.verb]);
  }

  /** hold is 0–1, drawn as a thin bar along the plate (no ring). */
  /** Axis-aligned box of the drawn plate, from the layout (not getBounds — that can lag a frame). */
  box() {
    const kw = Math.max(18, this.letter.width + 10), kh = 18;
    const vw = this.verb.width + 14;
    const total = kw + 4 + vw;
    const ox = this.centered ? -total / 2 + kw / 2 : 0;
    const x0 = this.root.x + ox - kw / 2;
    const y0 = this.root.y - kh / 2;
    const x1 = this.root.x + ox + kw / 2 + 2 + vw;
    const y1 = this.root.y + 9;
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }

  show(x: number, y: number, verb: string, hold = 0, key = 'E') {
    this.rawVerb = verb;
    const shown = verb === 'take' && !InteractChip.taughtTake ? 'hold to take' : verb;
    this.letter.setText(key);
    this.verb.setText(shown.toUpperCase());
    const kw = Math.max(18, this.letter.width + 10), kh = 18;
    const vw = this.verb.width + 14;
    const total = kw + 4 + vw;
    const ox = this.centered ? -total / 2 + kw / 2 : 0;
    this.letter.setPosition(ox, -1);
    this.verb.setPosition(ox + kw / 2 + 10, 0);
    const g = this.cap; g.clear();
    // verb plate: dark glass with a notched left edge that tucks under the key
    const px = ox + kw / 2 + 2, py = -9;
    g.fillStyle(0x050b10, 0.78);
    g.fillRect(px, py, vw, 18);
    g.fillStyle(0x7fd8d4, 0.22).fillRect(px, py, vw, 1);
    if (hold > 0.02) {
      g.fillStyle(0x0e2a2e, 0.9).fillRect(px + 4, py + 15, vw - 8, 2);
      g.fillStyle(0x6ef0e6, 0.95).fillRect(px + 4, py + 15, (vw - 8) * Math.min(1, hold), 2);
    }
    // key-cap: bevelled, lit edge on top, darker lip at the bottom
    g.fillStyle(0x02060a, 0.9).fillRoundedRect(ox - kw / 2, -kh / 2 + 2, kw, kh, 3);
    g.fillStyle(0x0d1a22, 0.97).fillRoundedRect(ox - kw / 2, -kh / 2, kw, kh - 1, 3);
    if (hold > 0.02) {
      const h = (kh - 5) * Math.min(1, hold);
      g.fillStyle(0x3fb8b0, 0.55).fillRect(ox - kw / 2 + 2, kh / 2 - 3 - h, kw - 4, h);
    }
    g.lineStyle(1, 0xa8ece8, 0.9).strokeRoundedRect(ox - kw / 2, -kh / 2, kw, kh - 1, 3);
    g.fillStyle(0xe8fffd, 0.35).fillRect(ox - kw / 2 + 3, -kh / 2 + 1, kw - 6, 1);
    this.root.setPosition(Math.round(x), Math.round(y)).setAlpha(1).setVisible(true);
  }

  hide() { this.root.setAlpha(0).setVisible(false); }
  isShown() { return this.root.visible && this.root.alpha > 0.1; }
  currentVerb() { return this.rawVerb; }
  currentKey() { return this.letter.text; }
  destroy() { this.root.destroy(); }
}
