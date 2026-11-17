// Readable Noor reactions for the opening hook and meeting: existing
// sheets (look, surprise, idle) plus squash, hops, leans, emote marks.
import Phaser from 'phaser';
import tokens from './tokens.json';
import type { GameScene } from './game';

const FONT = 'JetBrains Mono';
const C = tokens.color;

export type EmoteKind = '!' | '?' | 'sweat' | '...';
export type ActKind = 'hesitate' | 'leanIn' | 'startle' | 'lookAround' | 'stepBack' | 'handUp' | 'chairPush' | 'idle';

export class NoorActing {
  s: GameScene;
  marks: Phaser.GameObjects.GameObject[] = [];
  private chair?: Phaser.GameObjects.Image;
  private chair0?: { x: number; y: number };
  private base = { x: 0, y: 0, sx: 1, sy: 1, rot: 0 };
  private looking = false;

  constructor(s: GameScene) { this.s = s; }

  capture() {
    const n = this.s.noor;
    this.base = { x: n.x, y: n.y, sx: n.scaleX, sy: n.scaleY, rot: n.rotation };
    this.findChair();
  }

  clear() {
    for (const o of this.marks) { try { o.destroy(); } catch { /* */ } }
    this.marks = [];
    this.looking = false;
    try { this.s.noor?.setData('poseLock', false); } catch { /* */ }
    try { this.s.tweens.killTweensOf(this.s.noor); } catch { /* */ }
    if (this.chair) try { this.s.tweens.killTweensOf(this.chair); } catch { /* */ }
  }

  resetPose(idle = 'N') {
    const n = this.s.noor;
    try { this.s.tweens.killTweensOf(n); } catch { /* */ }
    n.setScale(this.base.sx || 1, this.base.sy || 1);
    n.setRotation(0);
    n.setData('poseLock', false);
    try { n.play(`noor_idle_${idle}`, true); } catch { /* */ }
  }

  private lockPose() {
    this.s.noor?.setData('poseLock', true);
  }

  emote(kind: EmoteKind, ms = 1100) {
    const s = this.s;
    const n = s.noor;
    const x = n.x + 8, y = n.y - 118;
    if (kind === 'sweat') {
      const d = s.add.ellipse(x + 16, y + 8, 7, 10, 0x9ad8f0, 0.95).setDepth(n.depth + 40);
      this.marks.push(d);
      s.tweens.add({
        targets: d, y: y + 36, alpha: 0, duration: ms, ease: 'Quad.easeIn',
        onComplete: () => { try { d.destroy(); } catch { /* */ } },
      });
      return;
    }
    const label = kind === '...' ? '···' : kind;
    const t = s.add.text(x, y, label, {
      fontFamily: FONT, fontSize: kind === '...' ? '22px' : '28px', fontStyle: 'bold',
      color: kind === '!' ? C.coral : C.inkBright,
    }).setOrigin(0.5).setDepth(n.depth + 40).setAlpha(0);
    if (kind !== '...') t.setShadow(0, 0, kind === '!' ? C.coral : C.cyan, 10, true, true);
    this.marks.push(t);
    s.tweens.add({
      targets: t, alpha: 1, y: y - 10, duration: 160, ease: 'Back.easeOut',
      onComplete: () => {
        s.tweens.add({
          targets: t, alpha: 0, y: t.y - 8, duration: 240, delay: Math.max(200, ms - 400),
          onComplete: () => { try { t.destroy(); } catch { /* */ } },
        });
      },
    });
  }

  act(kind: ActKind) {
    switch (kind) {
      case 'hesitate': this.hesitate(); break;
      case 'leanIn': this.leanIn(); break;
      case 'startle': this.startle(); break;
      case 'lookAround': this.lookAround(); break;
      case 'stepBack': this.stepBack(); break;
      case 'handUp': this.handUp(); break;
      case 'chairPush': this.chairPush(); break;
      default: this.resetPose('N');
    }
  }

  private hesitate() {
    const s = this.s, n = s.noor;
    try { n.play('noor_idle_N', true); } catch { /* */ }
    this.squash(1.08, 0.9, 140);
    s.tweens.add({
      targets: n, rotation: -0.06, y: n.y + 3, duration: 280, yoyo: true, ease: 'Sine.easeInOut',
    });
    this.emote('...', 900);
  }

  private leanIn() {
    const s = this.s, n = s.noor;
    try { n.play('noor_idle_N', true); } catch { /* */ }
    s.tweens.add({
      targets: n, scaleX: 0.94, scaleY: 1.08, y: n.y - 6, rotation: 0.05,
      duration: 260, ease: 'Cubic.easeOut',
    });
    this.emote('?', 1000);
  }

  private startle() {
    const s = this.s, n = s.noor;
    this.lockPose();
    try { n.play('noor_surprise_S', true); } catch {
      try { n.play('noor_surprise_N', true); } catch { /* */ }
    }
    const y0 = n.y;
    s.tweens.add({
      targets: n, y: y0 - 14, scaleX: 0.9, scaleY: 1.12, duration: 90, ease: 'Quad.easeOut',
      onComplete: () => {
        s.tweens.add({
          targets: n, y: y0, scaleX: 1, scaleY: 1, duration: 180, ease: 'Bounce.easeOut',
        });
      },
    });
    this.emote('!', 800);
  }

  private lookAround() {
    if (this.looking) return;
    this.looking = true;
    const s = this.s, n = s.noor;
    this.lockPose();
    const play = (key: string) => { try { n.play(key, true); } catch { /* */ } };
    play('noor_lookL_S');
    s.time.delayedCall(420, () => { if (n.active) play('noor_lookR_S'); });
    s.time.delayedCall(900, () => { if (n.active) play('noor_lookL_N'); });
    s.time.delayedCall(1300, () => {
      this.looking = false;
      n.setData('poseLock', false);
      if (n.active) play('noor_idle_N');
    });
    this.emote('?', 900);
  }

  private stepBack() {
    const s = this.s, n = s.noor;
    const x = n.x + 10, y = n.y + 18;
    s.tweens.add({
      targets: n, x, y, scaleX: 0.96, scaleY: 1.04, duration: 280, ease: 'Cubic.easeOut',
      onComplete: () => {
        s.x = n.x; s.y = n.y;
        try { s.shadow?.setPosition(n.x, n.y + 8); } catch { /* */ }
        n.setDepth(n.y + 24);
      },
    });
    try { s.shadow && s.tweens.add({ targets: s.shadow, x, y: y + 8, duration: 280, ease: 'Cubic.easeOut' }); } catch { /* */ }
  }

  private handUp() {
    const s = this.s, n = s.noor;
    this.lockPose();
    try { n.play('noor_surprise_N', true); } catch {
      try { n.play('noor_phone_N', true); } catch { /* */ }
    }
    this.squash(0.92, 1.1, 160);
  }

  private chairPush() {
    this.findChair();
    const s = this.s;
    if (this.chair && this.chair0) {
      s.tweens.add({
        targets: this.chair,
        x: this.chair0.x + 10,
        y: this.chair0.y + 14,
        duration: 320,
        ease: 'Cubic.easeOut',
      });
    }
    this.stepBack();
  }

  private squash(sx: number, sy: number, ms: number) {
    const s = this.s, n = s.noor;
    s.tweens.add({
      targets: n, scaleX: sx, scaleY: sy, duration: ms / 2, yoyo: true, ease: 'Quad.easeOut',
    });
  }

  private findChair() {
    if (this.chair && this.chair.active) return;
    for (const o of this.s.objs) {
      const img = o as Phaser.GameObjects.Image;
      if (img?.texture?.key === 'o11fg_chair_noor') {
        this.chair = img;
        this.chair0 = { x: img.x, y: img.y };
        return;
      }
    }
  }
}
