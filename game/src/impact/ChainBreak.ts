// Matter.js door-chain + padlock break. Fake 3/4 with y-offset + drop shadows.
import Phaser from 'phaser';
import type { GameScene } from '../game';
import { sfx } from '../sfx';

const LINK_N = 7;
const FLOOR_Y = 250;

export class ChainBreak {
  links: Phaser.Physics.Matter.Image[] = [];
  shadows: Phaser.GameObjects.Ellipse[] = [];
  pad!: Phaser.Physics.Matter.Image;
  padOpen = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constraints: any[] = [];
  broken = false;
  settled = false;

  constructor(private s: GameScene, private anchor: { x: number; y: number }) {}

  spawn() {
    const matter = this.s.matter;
    if (!matter) return;
    const ax = this.anchor.x, ay = this.anchor.y;
    const span = 92;
    for (let i = 0; i < LINK_N; i++) {
      const u = i / (LINK_N - 1);
      const x = ax - span / 2 + u * span;
      const y = ay + Math.sin(u * Math.PI) * 4;
      const im = matter.add.image(x, y, 'fx_chain_link', undefined, {
        shape: { type: 'circle', radius: 14 },
        friction: 0.45, restitution: 0.35, density: 0.004,
      });
      im.setDepth(ay + 2).setScale(1.35 + (i % 2) * 0.1);
      im.setIgnoreGravity(true);
      this.links.push(im);
      const sh = this.s.add.ellipse(x, FLOOR_Y, 18, 7, 0x000000, 0.0).setDepth(FLOOR_Y - 1);
      this.shadows.push(sh);
      this.s.objs.push(im, sh);
    }
    this.links[0].setStatic(true);
    this.links[LINK_N - 1].setStatic(true);

    for (let i = 0; i < LINK_N - 1; i++) {
      const c = matter.add.constraint(this.links[i].body as never, this.links[i + 1].body as never, 18, 0.85);
      this.constraints.push(c);
    }

    this.pad = matter.add.image(ax, ay + 22, 'fx_padlock', undefined, {
      shape: { type: 'rectangle', width: 28, height: 32 },
      friction: 0.5, restitution: 0.4, density: 0.008,
    });
    this.pad.setDepth(ay + 3).setScale(1.25).setIgnoreGravity(true).setStatic(true);
    this.s.objs.push(this.pad);
    this.constraints.push(matter.add.constraint(this.links[3].body as never, this.pad.body as never, 16, 0.9));
  }

  hit(dir: { x: number; y: number }, onSnap?: () => void) {
    if (this.broken) return;
    const matter = this.s.matter;
    for (let i = 1; i < LINK_N - 1; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = this.links[i].body;
      matter.body.setVelocity(b, { x: dir.x * 1.5, y: dir.y * 1.5 - 0.5 });
    }
    sfx('impact_clank');
    this.s.time.delayedCall(90, () => { this.snap(dir); onSnap?.(); });
  }

  private snap(dir: { x: number; y: number }) {
    if (this.broken) return;
    this.broken = true;
    const matter = this.s.matter;
    for (const c of this.constraints) {
      try { matter.world.removeConstraint(c); } catch { /* */ }
    }
    this.constraints = [];
    this.links[0].setStatic(false).setIgnoreGravity(false);
    this.links[LINK_N - 1].setStatic(false).setIgnoreGravity(false);
    for (const l of this.links) l.setIgnoreGravity(false);
    // End anchors need a shove so they leave the handles and fall onto the floor plane
    for (const i of [0, LINK_N - 1]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = this.links[i].body;
      matter.body.setVelocity(b, { x: i === 0 ? -2.5 : 2.5, y: -2.5 });
      matter.body.setAngularVelocity(b, i === 0 ? -0.2 : 0.2);
    }
    this.pad.setStatic(false).setIgnoreGravity(false);

    this.links.forEach((l, i) => {
      const side = i < 3 ? -1 : i > 3 ? 1 : 0.2;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = l.body;
      matter.body.setVelocity(b, {
        x: side * (3.5 + Math.abs(i - 3) * 0.8) + dir.x * 2,
        y: -4.5 - (i % 3) * 0.8,
      });
      matter.body.setAngularVelocity(b, (i % 2 ? 1 : -1) * (0.25 + i * 0.04));
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pb: any = this.pad.body;
    matter.body.setVelocity(pb, { x: 3.2, y: -5.5 });
    matter.body.setAngularVelocity(pb, 0.35);

    this.s.time.delayedCall(40, () => {
      this.padOpen = true;
      if (this.s.textures.exists('fx_padlock_open')) this.pad.setTexture('fx_padlock_open');
      sfx('impact_padlock');
    });
    sfx('impact_snap');
  }

  update() {
    if (!this.broken) return;
    let allDown = true;
    for (let i = 0; i < this.links.length; i++) {
      const l = this.links[i];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = l.body;
      if (l.y > FLOOR_Y - 6) {
        const matter = this.s.matter;
        if (b.velocity.y > 0) {
          matter.body.setPosition(b, { x: l.x, y: FLOOR_Y - 8 });
          matter.body.setVelocity(b, { x: b.velocity.x * 0.7, y: -b.velocity.y * 0.35 });
          if (Math.abs(b.velocity.y) > 1.5) sfx('impact_bounce');
        }
        this.shadows[i].setPosition(l.x, FLOOR_Y + 2).setAlpha(0.35);
      } else {
        allDown = false;
        const a = Phaser.Math.Clamp(1 - (FLOOR_Y - l.y) / 120, 0, 0.35);
        this.shadows[i].setPosition(l.x, FLOOR_Y + 2).setAlpha(a);
      }
      l.setDepth(l.y);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pb: any = this.pad.body;
    if (this.pad.y > FLOOR_Y - 10) {
      const matter = this.s.matter;
      if (pb.velocity.y > 0) {
        matter.body.setPosition(pb, { x: this.pad.x, y: FLOOR_Y - 12 });
        matter.body.setVelocity(pb, { x: pb.velocity.x * 0.65, y: -pb.velocity.y * 0.3 });
        matter.body.setAngularVelocity(pb, pb.angularVelocity * 0.7);
      }
    } else allDown = false;
    this.pad.setDepth(this.pad.y);
    if (allDown) this.settled = true;
  }

  destroy() {
    for (const c of this.constraints) {
      try { this.s.matter.world.removeConstraint(c); } catch { /* */ }
    }
    for (const l of this.links) l.destroy();
    for (const sh of this.shadows) sh.destroy();
    this.pad?.destroy();
    this.links = []; this.shadows = [];
  }
}
