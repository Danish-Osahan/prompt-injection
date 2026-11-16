// Small diegetic E/F key-cap + verb, anchored near an object (never a fill-ring).
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

export class InteractChip {
  root: Phaser.GameObjects.Container;
  private cap: Phaser.GameObjects.Graphics;
  private letter: Phaser.GameObjects.Text;
  private verb: Phaser.GameObjects.Text;

  constructor(s: Phaser.Scene, depth = 9002) {
    this.root = s.add.container(0, 0).setDepth(depth).setAlpha(0);
    this.cap = s.add.graphics();
    this.letter = s.add.text(0, 0, 'E', {
      fontFamily: 'IBM Plex Mono', fontSize: '12px', fontStyle: '700', color: '#e8fcfc',
    }).setOrigin(0.5);
    this.verb = s.add.text(16, 0, '', {
      fontFamily: 'IBM Plex Mono', fontSize: '12px', fontStyle: '700', color: '#e8fcfc',
      stroke: '#041018', strokeThickness: 4,
    }).setOrigin(0, 0.5);
    this.root.add([this.cap, this.letter, this.verb]);
  }

  /** hold is 0–1 fill inside the key-cap (no ring). */
  show(x: number, y: number, verb: string, hold = 0, key = 'E') {
    this.letter.setText(key).setPosition(0, 0);
    this.verb.setText(verb).setPosition(14, 0);
    this.cap.clear();
    this.cap.fillStyle(0x0a141c, 0.92);
    this.cap.fillRoundedRect(-9, -9, 18, 18, 3);
    if (hold > 0.02) {
      this.cap.fillStyle(0x5ee8e0, 0.82);
      const h = 14 * Math.min(1, hold);
      this.cap.fillRoundedRect(-7, 7 - h, 14, h, 2);
    }
    this.cap.lineStyle(1.5, 0xc8f4f0, 0.95);
    this.cap.strokeRoundedRect(-9, -9, 18, 18, 3);
    this.root.setPosition(x, y).setAlpha(1).setVisible(true);
  }

  hide() { this.root.setAlpha(0).setVisible(false); }
  destroy() { this.root.destroy(); }
}
