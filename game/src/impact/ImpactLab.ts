// Impact lab: clarity office + OPEN peel at window → F throw → chain break.
// Enter via ?impact=1 or debug key I. No gameplay captions — story/dialogue only.
import Phaser from 'phaser';
import type { GameScene } from '../game';
import { O11_DOOR } from '../office11art';
import { TOP } from '../clarity';
import { BAR_Y } from '../words';
import { ImpactFX } from './ImpactFX';
import { ChainBreak } from './ChainBreak';
import { sfx } from '../sfx';

const DOOR_CHAIN = { x: O11_DOOR.x + 98, y: O11_DOOR.y + 110 }; // handles mid
const WIN = { x: 960, y: 130 };

export class ImpactLab {
  on = false;
  fx!: ImpactFX;
  chain!: ChainBreak;
  carrying = false;
  swirl?: Phaser.GameObjects.Particles.ParticleEmitter;
  projectile?: Phaser.GameObjects.Image;
  trail?: Phaser.GameObjects.Particles.ParticleEmitter;
  flying = false;
  done = false;
  hint?: Phaser.GameObjects.Text;
  private keyF?: Phaser.Input.Keyboard.Key;
  private keyI?: Phaser.Input.Keyboard.Key;
  private peelArmed = false;
  private savedObjVis?: boolean;

  constructor(private s: GameScene) {
    this.fx = new ImpactFX(s);
  }

  start() {
    if (this.on) return;
    this.on = true;
    if (!this.s.matter) console.warn('[ImpactLab] Matter physics not enabled');

    this.chain = new ChainBreak(this.s, DOOR_CHAIN);
    this.chain.spawn();

    const door = this.s.plateById('o_door');
    if (door && door.slotWord !== 'SHUT') {
      door.setSlotWord('SHUT');
      this.s.save.plates[door.def.id] = 'SHUT';
      this.s.evaluate(true);
    }

    // Hide clarity objective banner — no words over gameplay in the lab
    if (this.s.clar?.objective) {
      this.savedObjVis = this.s.clar.objective.visible;
      this.s.clar.objective.setVisible(false);
    }

    // Debug hint only behind ?debug
    const debug = new URLSearchParams(location.search).has('debug');
    if (debug) {
      this.hint = this.s.add.text(640, 56, 'IMPACT LAB  ·  E = OPEN  ·  F = throw', {
        fontFamily: 'IBM Plex Mono', fontSize: '13px', color: '#7ec8e3',
        backgroundColor: 'rgba(4,10,16,0.65)', padding: { x: 8, y: 4 },
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setScrollFactor(0).setDepth(9500);
      this.s.objs.push(this.hint);
    }

    this.keyF = this.s.input.keyboard?.addKey('F');
    // Contain framing (full room visible) — same as normal play
    this.s.fitRoomCamera(TOP, BAR_Y);

    // Open floor near the rain window (peel OPEN), facing the lift
    this.s.x = 880; this.s.y = 400; this.s.dir = 'NW';
    this.s.unstick();
  }

  stop() {
    this.on = false;
    this.chain?.destroy();
    this.hint?.destroy(); this.hint = undefined;
    this.swirl?.stop(); this.swirl?.destroy();
    this.trail?.destroy(); this.projectile?.destroy();
    if (this.s.clar?.objective && this.savedObjVis !== undefined) {
      this.s.clar.objective.setVisible(this.savedObjVis);
    }
  }

  /** J-combo / throw feel. hit 1–2 = light, hit 3 = heavy. Works even when lab UI is off. */
  onDummyHit(
    x: number, y: number,
    hit = 1,
    target?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  ) {
    if (!this.s.clar?.dummy && !this.on) return;
    const tier = hit >= 3 ? 'heavy' : 'light';
    const dir = { x: x - this.s.x, y: y - this.s.y };
    this.fx.fire({
      tier, x, y, dir,
      attacker: this.s.noor,
      target,
      pausePhysics: false,
    });
  }

  update(dt: number) {
    if (!this.keyI) this.keyI = this.s.input.keyboard?.addKey('I');
    if (Phaser.Input.Keyboard.JustDown(this.keyI!)) {
      if (!this.on) this.start();
      else this.stop();
    }
    if (!this.on) return;

    // Keep objective suppressed every frame (clarity rewrites it)
    if (this.s.clar?.objective?.visible) this.s.clar.objective.setVisible(false);
    // Swallow timed floor captions while the lab is on
    if (this.s.clar) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = this.s.clar as any;
      if (c.capMsg) c.capMsg = null;
    }

    this.chain?.update(dt);

    // After punch-zoom eases back, keep contain framing (full room)
    const cam = this.s.cameras.main;
    if (Math.abs(cam.zoom - this.s.frameZoom) < 0.02) {
      cam.centerOn(640, 360);
    }

    const f = this.s.ctl.read();
    const nearWin = Math.hypot(this.s.x - WIN.x, this.s.y - (WIN.y + 80)) < 180;
    if (nearWin && f.interactHeld && !this.carrying && !this.flying) this.peelArmed = true;
    if (this.peelArmed && !f.interactHeld && !this.carrying) { this.peelArmed = false; this.takeOpen(); }

    if (this.carrying && this.swirl) {
      const hx = this.s.x + this.handOff().x, hy = this.s.y + this.handOff().y;
      this.swirl.setPosition(hx, hy);
    }

    if (this.carrying && this.keyF && Phaser.Input.Keyboard.JustDown(this.keyF) && !this.flying) {
      this.throwGust();
    }

    if (this.flying && this.projectile) {
      const p = this.projectile;
      const tx = DOOR_CHAIN.x, ty = DOOR_CHAIN.y;
      const dx = tx - p.x, dy = ty - p.y;
      const dist = Math.hypot(dx, dy);
      const sp = 520 * dt;
      if (dist < sp + 8) {
        p.x = tx; p.y = ty;
        this.onContact();
      } else {
        p.x += (dx / dist) * sp;
        p.y += (dy / dist) * sp - Math.sin((1 - dist / 400) * Math.PI) * 0.6;
        this.trail?.setPosition(p.x, p.y);
      }
    }
  }

  private handOff() {
    const d = this.s.dir;
    if (d.includes('W')) return { x: -22, y: -48 };
    if (d.includes('E')) return { x: 22, y: -48 };
    return { x: -18, y: -52 };
  }

  takeOpen() {
    this.carrying = true;
    this.s.hand = { word: 'OPEN', from: 'o_rain' };
    sfx('swap');
    if (this.s.textures.exists('fx_wind_wisp')) {
      this.swirl?.destroy();
      const hx = this.s.x + this.handOff().x, hy = this.s.y + this.handOff().y;
      this.swirl = this.s.add.particles(hx, hy, 'fx_wind_wisp', {
        speed: { min: 10, max: 40 }, lifespan: 400, scale: { start: 0.5, end: 0.1 },
        alpha: { start: 0.7, end: 0 }, frequency: 40, blendMode: 'ADD',
      });
      this.s.objs.push(this.swirl);
    }
  }

  throwGust() {
    this.carrying = false;
    this.swirl?.stop(); this.swirl?.destroy(); this.swirl = undefined;
    this.s.hand = null;
    const hx = this.s.x + this.handOff().x, hy = this.s.y + this.handOff().y;
    this.s.dir = 'NW';
    try { this.s.noor.play(`noor_throw_${this.s.dir}`, true); } catch {
      try { this.s.noor.play(`noor_type3_${this.s.dir}`, true); } catch { /* */ }
    }
    sfx('impact_whoosh');
    this.projectile = this.s.add.image(hx, hy, 'fx_smoke_soft').setDepth(7000).setScale(1.05).setBlendMode(Phaser.BlendModes.ADD);
    this.s.objs.push(this.projectile);
    if (this.s.textures.exists('fx_wind_wisp')) {
      this.trail = this.s.add.particles(hx, hy, 'fx_wind_wisp', {
        speed: { min: 5, max: 25 }, lifespan: 280, scale: { start: 0.7, end: 0.05 },
        alpha: { start: 0.8, end: 0 }, frequency: 16, blendMode: 'ADD',
      });
      this.s.objs.push(this.trail);
    }
    this.flying = true;
  }

  private onContact() {
    this.flying = false;
    this.projectile?.destroy(); this.projectile = undefined;
    this.trail?.stop(); this.trail?.destroy(); this.trail = undefined;

    const dir = { x: DOOR_CHAIN.x - this.s.x, y: DOOR_CHAIN.y - this.s.y };
    // Heavy on contact — readable flash, no Matter pause (debris must fly)
    this.fx.fire({
      tier: 'heavy', x: DOOR_CHAIN.x, y: DOOR_CHAIN.y, dir,
      attacker: this.s.noor,
      target: this.s.clar?.door,
      pausePhysics: false,
    });
    this.chain.hit(dir, () => {
      this.fx.fire({
        tier: 'big', x: DOOR_CHAIN.x, y: DOOR_CHAIN.y, dir,
        attacker: this.s.noor, target: this.s.clar?.door, pausePhysics: false,
      });
      this.fx.dust(DOOR_CHAIN.x, 240, dir, 10);
      this.openDoor();
    });
  }

  private openDoor() {
    this.done = true;
    const door = this.s.clar?.door;
    if (door) {
      this.s.tweens.add({ targets: door, x: door.x - 3, duration: 50, yoyo: true, repeat: 2 });
    }
    const p = this.s.plateById('o_door');
    if (p && p.slotWord !== 'OPEN') {
      this.s.time.delayedCall(450, () => {
        p.setSlotWord('OPEN');
        this.s.save.plates[p.def.id] = 'OPEN';
        this.s.evaluate(false);
        sfx('impact_hum');
        // No floor caption — story/dialogue only
      });
    }
  }
}
