// Matter.js door-chain + padlock break. Fake 3/4 with y-offset + drop shadows.
// Hard rule: chain ~40–60% of door width; small chunky links; padlock ≈ handle size.
import Phaser from 'phaser';
import type { GameScene } from '../game';
import { sfx } from '../sfx';

const LINK_N = 6;
/** Floor plane in front of the lift door (world y). */
export const CHAIN_FLOOR_Y = 392;
/** Door art is 196px wide; chain span ≈ 50% across the handles. */
const SPAN = 78;
const LINK_SCALE = 0.72;
const PAD_SCALE = 0.85;

export class ChainBreak {
  links: Phaser.Physics.Matter.Image[] = [];
  shadows: Phaser.GameObjects.Ellipse[] = [];
  pad!: Phaser.Physics.Matter.Image;
  padShadow?: Phaser.GameObjects.Ellipse;
  padOpen = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constraints: any[] = [];
  broken = false;
  settled = false;
  /** Original anchor y — used by tests to assert pieces left the handles. */
  originY = 0;
  originX = 0;
  private bounceLeft: number[] = [];
  private padBounces = 2;
  /** Kinematic scatter state (runs even if Matter was paused during hit-stop). */
  private kin: { vx: number; vy: number; spin: number }[] = [];
  private padKin = { vx: 0, vy: 0, spin: 0 };
  private useKin = false;

  constructor(private s: GameScene, private anchor: { x: number; y: number }) {
    this.originX = anchor.x;
    this.originY = anchor.y;
  }

  spawn() {
    const matter = this.s.matter;
    if (!matter) return;
    const ax = this.anchor.x, ay = this.anchor.y;
    for (let i = 0; i < LINK_N; i++) {
      const u = i / (LINK_N - 1);
      const x = ax - SPAN / 2 + u * SPAN;
      const y = ay + Math.sin(u * Math.PI) * 3;
      const im = matter.add.image(x, y, 'fx_chain_link', undefined, {
        shape: { type: 'circle', radius: 7 },
        friction: 0.5, restitution: 0.4, density: 0.003,
      });
      im.setDepth(ay + 2).setScale(LINK_SCALE + (i % 2) * 0.06);
      im.setIgnoreGravity(true);
      this.links.push(im);
      this.bounceLeft.push(2);
      const sh = this.s.add.ellipse(x, CHAIN_FLOOR_Y, 14, 5, 0x000000, 0.0).setDepth(CHAIN_FLOOR_Y - 1);
      this.shadows.push(sh);
      this.s.objs.push(im, sh);
    }
    this.links[0].setStatic(true);
    this.links[LINK_N - 1].setStatic(true);

    for (let i = 0; i < LINK_N - 1; i++) {
      const c = matter.add.constraint(this.links[i].body as never, this.links[i + 1].body as never, 14, 0.9);
      this.constraints.push(c);
    }

    this.pad = matter.add.image(ax, ay + 14, 'fx_padlock', undefined, {
      shape: { type: 'rectangle', width: 14, height: 18 },
      friction: 0.55, restitution: 0.35, density: 0.006,
    });
    this.pad.setDepth(ay + 3).setScale(PAD_SCALE).setIgnoreGravity(true).setStatic(true);
    this.padShadow = this.s.add.ellipse(ax, CHAIN_FLOOR_Y, 16, 6, 0x000000, 0.0).setDepth(CHAIN_FLOOR_Y - 1);
    this.s.objs.push(this.pad, this.padShadow);
    this.constraints.push(matter.add.constraint(this.links[Math.floor(LINK_N / 2)].body as never, this.pad.body as never, 12, 0.9));
  }

  /** Hit link index (middle) — constraint pair broken on snap. */
  hit(dir: { x: number; y: number }, onSnap?: () => void) {
    if (this.broken) return;
    const matter = this.s.matter;
    const L = Math.hypot(dir.x, dir.y) || 1;
    const dx = dir.x / L, dy = dir.y / L;
    // Taut tug toward throw
    for (let i = 1; i < LINK_N - 1; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = this.links[i].body;
      try { matter.body.setStatic(b, false); } catch { /* */ }
      this.links[i].setStatic(false);
      matter.body.setVelocity(b, { x: dx * 2.2, y: dy * 1.2 - 0.8 });
    }
    sfx('impact_clank');
    // Snap after a short taut beat (independent of hit-stop length)
    this.s.time.delayedCall(100, () => { this.snap(dir); onSnap?.(); });
  }

  private snap(dir: { x: number; y: number }) {
    if (this.broken) return;
    this.broken = true;
    const matter = this.s.matter;
    const L = Math.hypot(dir.x, dir.y) || 1;
    const dx = dir.x / L, dy = dir.y / L;

    // Detach every constraint (break at hit link + the rest)
    for (const c of this.constraints) {
      try { matter.world.removeConstraint(c); } catch { /* */ }
    }
    this.constraints = [];

    // Ensure Matter is running so debris can move
    try { matter.world.resume(); } catch { /* */ }

    for (const l of this.links) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = l.body;
      try { matter.body.setStatic(b, false); } catch { /* */ }
      l.setStatic(false).setIgnoreGravity(true); // kinematic drive below
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pb0: any = this.pad.body;
    try { matter.body.setStatic(pb0, false); } catch { /* */ }
    this.pad.setStatic(false).setIgnoreGravity(true);

    // Impulse: short pop up, land in front of the door (keep on-screen near handles)
    // dx is throw dir (usually toward door from the right → negative x); damp it so pieces don't fly off-canvas
    this.kin = this.links.map((l, i) => {
      const side = (i / (LINK_N - 1)) * 2 - 1; // -1..1
      return {
        vx: side * 55 + dx * 25,
        vy: -160 - (i % 3) * 25,
        spin: (i % 2 ? 1 : -1) * (5 + i * 0.5),
      };
    });
    this.padKin = { vx: dx * 30 + 40, vy: -200, spin: 6 };
    this.useKin = true;

    this.s.time.delayedCall(50, () => {
      this.padOpen = true;
      if (this.s.textures.exists('fx_padlock_open')) this.pad.setTexture('fx_padlock_open');
      sfx('impact_padlock');
    });
    sfx('impact_snap');
  }

  /** dt in seconds — drive scatter + bounce + shadows. */
  update(dt: number) {
    if (!this.broken || !this.useKin) return;
    const g = 980;
    let allDown = true;
    const matter = this.s.matter;

    for (let i = 0; i < this.links.length; i++) {
      const l = this.links[i];
      const k = this.kin[i];
      k.vy += g * dt;
      let nx = l.x + k.vx * dt;
      let ny = l.y + k.vy * dt;
      // Keep debris in the door-front band (on-screen)
      nx = Phaser.Math.Clamp(nx, this.originX - 70, this.originX + 90);
      l.setAngle(l.angle + k.spin);

      if (ny >= CHAIN_FLOOR_Y - 6) {
        ny = CHAIN_FLOOR_Y - 6;
        if (this.bounceLeft[i] > 0 && k.vy > 60) {
          k.vy = -k.vy * 0.4;
          k.vx *= 0.7;
          k.spin *= 0.65;
          this.bounceLeft[i]--;
          sfx('impact_bounce');
          allDown = false;
        } else {
          k.vy = 0; k.vx *= 0.85; k.spin *= 0.8;
          if (Math.abs(k.vx) < 8) k.vx = 0;
        }
        this.shadows[i].setPosition(nx, CHAIN_FLOOR_Y + 2).setAlpha(0.4);
      } else {
        allDown = false;
        const a = Phaser.Math.Clamp(1 - (CHAIN_FLOOR_Y - ny) / 140, 0, 0.35);
        this.shadows[i].setPosition(nx, CHAIN_FLOOR_Y + 2).setAlpha(a);
      }
      l.setPosition(nx, ny).setDepth(ny);
      // Keep Matter body in sync so nothing snaps back on resume
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = l.body;
      try { matter.body.setPosition(b, { x: nx, y: ny }); matter.body.setVelocity(b, { x: 0, y: 0 }); } catch { /* */ }
    }

    // Padlock
    const pk = this.padKin;
    pk.vy += g * dt;
    let px = this.pad.x + pk.vx * dt;
    let py = this.pad.y + pk.vy * dt;
    px = Phaser.Math.Clamp(px, this.originX - 50, this.originX + 70);
    this.pad.setAngle(this.pad.angle + pk.spin);
    if (py >= CHAIN_FLOOR_Y - 8) {
      py = CHAIN_FLOOR_Y - 8;
      if (this.padBounces > 0 && pk.vy > 60) {
        pk.vy = -pk.vy * 0.35;
        pk.vx *= 0.65;
        pk.spin *= 0.6;
        this.padBounces--;
        allDown = false;
        sfx('impact_bounce');
      } else {
        pk.vy = 0; pk.vx *= 0.8; pk.spin *= 0.75;
        if (Math.abs(pk.vx) < 6) pk.vx = 0;
      }
      this.padShadow?.setPosition(px, CHAIN_FLOOR_Y + 2).setAlpha(0.4);
    } else {
      allDown = false;
      const a = Phaser.Math.Clamp(1 - (CHAIN_FLOOR_Y - py) / 140, 0, 0.35);
      this.padShadow?.setPosition(px, CHAIN_FLOOR_Y + 2).setAlpha(a);
    }
    this.pad.setPosition(px, py).setDepth(py);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pb: any = this.pad.body;
    try { matter.body.setPosition(pb, { x: px, y: py }); matter.body.setVelocity(pb, { x: 0, y: 0 }); } catch { /* */ }

    if (allDown) this.settled = true;
  }

  /** Test helper: every link + pad on the floor plane, none still at the handle anchor. */
  assertOnFloor(tol = 14): { ok: boolean; linksY: number[]; padY: number; originY: number } {
    const linksY = this.links.map(l => l.y);
    const padY = this.pad?.y ?? -1;
    const onFloor = linksY.every(y => Math.abs(y - (CHAIN_FLOOR_Y - 6)) <= tol)
      && Math.abs(padY - (CHAIN_FLOOR_Y - 8)) <= tol;
    const leftAnchor = linksY.every(y => y > this.originY + 30) && padY > this.originY + 30;
    return { ok: this.broken && onFloor && leftAnchor, linksY, padY, originY: this.originY };
  }

  destroy() {
    for (const c of this.constraints) {
      try { this.s.matter.world.removeConstraint(c); } catch { /* */ }
    }
    for (const l of this.links) l.destroy();
    for (const sh of this.shadows) sh.destroy();
    this.pad?.destroy();
    this.padShadow?.destroy();
    this.links = []; this.shadows = [];
  }
}
