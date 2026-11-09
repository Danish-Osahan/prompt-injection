// Impact lab: clarity office + OPEN peel at window → F throw → chain break.
// Enter via ?impact=1 or debug key I.
import Phaser from 'phaser';
import type { GameScene } from '../game';
import { O11_DOOR } from '../office11art';
import { ImpactFX } from './ImpactFX';
import { ChainBreak } from './ChainBreak';
import { sfx } from '../sfx';

const DOOR_CHAIN = { x: O11_DOOR.x + 98, y: O11_DOOR.y + 110 }; // handles mid
const WIN = { x: 960, y: 130 };

export class ImpactLab {
  on = false;
  fx!: ImpactFX;
  chain!: ChainBreak;
  carrying = false; // holding OPEN quality
  swirl?: Phaser.GameObjects.Particles.ParticleEmitter;
  projectile?: Phaser.GameObjects.Image;
  trail?: Phaser.GameObjects.Particles.ParticleEmitter;
  flying = false;
  done = false;
  hint!: Phaser.GameObjects.Text;
  private keyF?: Phaser.Input.Keyboard.Key;
  private keyI?: Phaser.Input.Keyboard.Key;
  private peelArmed = false;

  constructor(private s: GameScene) {
    this.fx = new ImpactFX(s);
  }

  /** Call from GameScene.create / enterRoom when ?impact=1 or after I toggles. */
  start() {
    if (this.on) return;
    this.on = true;
    // Ensure Matter
    if (!this.s.matter) {
      console.warn('[ImpactLab] Matter physics not enabled');
    }
    this.chain = new ChainBreak(this.s, DOOR_CHAIN);
    this.chain.spawn();

    // Force door SHUT with chain; window provides OPEN to peel
    const door = this.s.plateById('o_door');
    if (door && door.slotWord !== 'SHUT') {
      door.setSlotWord('SHUT');
      this.s.save.plates[door.def.id] = 'SHUT';
      this.s.evaluate(true);
    }

    this.hint = this.s.add.text(640, 56, 'IMPACT LAB  ·  E at window = take OPEN  ·  F = throw at chain', {
      fontFamily: 'IBM Plex Mono', fontSize: '15px', color: '#7ec8e3',
      backgroundColor: 'rgba(4,10,16,0.65)', padding: { x: 10, y: 5 },
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setScrollFactor(0).setDepth(9500);
    this.s.objs.push(this.hint);

    this.keyF = this.s.input.keyboard?.addKey('F');
    this.s.say('floor', 'Impact lab. Hold E at the rain window, peel OPEN, then F at the chain.', 3200);

    // Place Noor mid-office facing door
    this.s.x = 520; this.s.y = 380;
  }

  stop() {
    this.on = false;
    this.chain?.destroy();
    this.hint?.destroy();
    this.swirl?.stop(); this.swirl?.destroy();
    this.trail?.destroy(); this.projectile?.destroy();
  }

  /** Wire light impacts on J vs practice dummy. */
  onDummyHit(x: number, y: number) {
    if (!this.on && !this.s.clar?.dummy) return;
    this.fx.fire({ tier: 'light', x, y, dir: { x: 1, y: 0 } });
  }

  update(dt: number) {
    // Toggle with I even before start
    if (!this.keyI) this.keyI = this.s.input.keyboard?.addKey('I');
    if (Phaser.Input.Keyboard.JustDown(this.keyI!)) {
      if (!this.on) this.start();
      else { this.stop(); this.s.say('floor', 'Impact lab off.', 1200); }
    }
    if (!this.on) return;

    this.chain?.update();

    // Peel OPEN near window with E (interact held → release)
    const f = this.s.ctl.read();
    const nearWin = Math.hypot(this.s.x - WIN.x, this.s.y - (WIN.y + 80)) < 180;
    if (nearWin && f.interactHeld && !this.carrying && !this.flying) this.peelArmed = true;
    if (this.peelArmed && !f.interactHeld && !this.carrying) { this.peelArmed = false; this.takeOpen(); }

    // Swirl around hand while carrying
    if (this.carrying && this.swirl) {
      const hx = this.s.x + this.handOff().x, hy = this.s.y + this.handOff().y;
      this.swirl.setPosition(hx, hy);
    }

    // F to throw
    if (this.carrying && this.keyF && Phaser.Input.Keyboard.JustDown(this.keyF) && !this.flying) {
      this.throwGust();
    }

    // Projectile flight
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
        // slight arc
        p.y += (dy / dist) * sp - Math.sin((1 - dist / 400) * Math.PI) * 0.6;
        this.trail?.setPosition(p.x, p.y);
      }
    }

    if (this.done && this.chain.settled) {
      this.hint.setText('IMPACT LAB  ·  chain settled  ·  door opening');
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
    this.s.say('floor', 'OPEN in hand. Aim at the chain — press F to throw.', 2400);
    // Swirl emitter
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
    // Face door
    this.s.dir = 'NW';
    try { this.s.noor.play(`noor_throw_${this.s.dir}`, true); } catch {
      try { this.s.noor.play(`noor_type3_${this.s.dir}`, true); } catch { /* */ }
    }
    sfx('impact_whoosh');
    this.projectile = this.s.add.image(hx, hy, 'fx_smoke_soft').setDepth(7000).setScale(1.2).setBlendMode(Phaser.BlendModes.ADD);
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
    // Heavy on contact
    this.fx.fire({
      tier: 'heavy', x: DOOR_CHAIN.x, y: DOOR_CHAIN.y, dir,
      target: this.s.clar?.door,
      onHitStopEnd: () => { /* */ },
    });
    this.chain.hit(dir, () => {
      // Big on snap
      this.fx.fire({ tier: 'big', x: DOOR_CHAIN.x, y: DOOR_CHAIN.y, dir });
      this.fx.dust(DOOR_CHAIN.x, 320, dir, 12);
      this.openDoor();
    });
  }

  private openDoor() {
    this.done = true;
    // Recoil jolt then open via clarity plate
    const door = this.s.clar?.door;
    if (door) {
      this.s.tweens.add({ targets: door, x: door.x - 4, duration: 50, yoyo: true, repeat: 2 });
    }
    const p = this.s.plateById('o_door');
    if (p && p.slotWord !== 'OPEN') {
      this.s.time.delayedCall(400, () => {
        p.setSlotWord('OPEN');
        this.s.save.plates[p.def.id] = 'OPEN';
        this.s.evaluate(false);
        sfx('impact_hum');
        this.s.say('floor', 'Chain broken. Lift opens.', 2200);
      });
    }
  }
}
