// Steal mechanic (docs/design/power-rules.md): hold E peel OPEN at window → F throw → chain break.
// Under ?impact the old word system is fully off — no READ, chips, pickers, captions.
import Phaser from 'phaser';
import type { GameScene } from '../game';
import { O11_DOOR } from '../office11art';
import { TOP } from '../clarity';
import { BAR_Y } from '../words';
import { ImpactFX } from './ImpactFX';
import { ChainBreak } from './ChainBreak';
import { sfx } from '../sfx';

const DOOR_CHAIN = { x: O11_DOOR.x + 98, y: O11_DOOR.y + 110 };
const WIN = { x: 960, y: 130 };

export class ImpactLab {
  on = false;
  /** When true, game must skip word UI / READ / pickers. */
  stealMode = false;
  fx!: ImpactFX;
  chain!: ChainBreak;
  carrying = false;
  swirl?: Phaser.GameObjects.Container;
  projectile?: Phaser.GameObjects.Container;
  trail?: Phaser.GameObjects.Particles.ParticleEmitter;
  flying = false;
  done = false;
  hint?: Phaser.GameObjects.Text;
  private keyF?: Phaser.Input.Keyboard.Key;
  private keyI?: Phaser.Input.Keyboard.Key;
  private peelT = 0;
  private peelNeed = 0.55; // hold E seconds
  private peelFx?: Phaser.GameObjects.Container;
  private shimmer?: Phaser.GameObjects.Image;
  private rainWasOn = true;

  constructor(private s: GameScene) {
    this.fx = new ImpactFX(s);
  }

  start() {
    if (this.on) return;
    this.on = true;
    this.stealMode = true;
    if (!this.s.matter) console.warn('[ImpactLab] Matter physics not enabled');

    this.chain = new ChainBreak(this.s, DOOR_CHAIN);
    this.chain.spawn();

    // Door starts locked for the lab — set slot quietly, no word UI
    const door = this.s.plateById('o_door');
    if (door && door.slotWord !== 'SHUT') {
      door.setSlotWord('SHUT');
      this.s.save.plates[door.def.id] = 'SHUT';
      this.s.evaluate(true);
    }

    this.suppressWordUi(true);

    const debug = new URLSearchParams(location.search).has('debug');
    if (debug) {
      this.hint = this.s.add.text(640, 56, 'STEAL  ·  hold E at window  ·  F throw', {
        fontFamily: 'IBM Plex Mono', fontSize: '13px', color: '#7ec8e3',
        backgroundColor: 'rgba(4,10,16,0.65)', padding: { x: 8, y: 4 },
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setScrollFactor(0).setDepth(9500);
      this.s.objs.push(this.hint);
    }

    this.keyF = this.s.input.keyboard?.addKey('F');
    this.s.fitRoomCamera(TOP, BAR_Y);
    this.s.x = 880; this.s.y = 400; this.s.dir = 'NW';
    this.s.unstick();

    // Soft shimmer near the window (takeable)
    if (this.s.textures.exists('fx_wind_wisp')) {
      this.shimmer = this.s.add.image(WIN.x, WIN.y + 40, 'fx_wind_wisp')
        .setDepth(500).setAlpha(0.35).setScale(1.4).setBlendMode(Phaser.BlendModes.ADD);
      this.s.objs.push(this.shimmer);
    }
  }

  stop() {
    this.on = false;
    this.stealMode = false;
    this.chain?.destroy();
    this.hint?.destroy(); this.hint = undefined;
    this.clearCarryFx();
    this.peelFx?.destroy(); this.peelFx = undefined;
    this.shimmer?.destroy(); this.shimmer = undefined;
    this.suppressWordUi(false);
  }

  /** Block every remnant of the old word system while the steal lab is live. */
  suppressWordUi(on: boolean) {
    const s = this.s;
    if (s.clar?.objective) s.clar.objective.setVisible(false);
    if (s.clar) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = s.clar as any;
      if (c.capMsg) c.capMsg = null;
      if (c.modal) { try { c.modal.destroy(); } catch { /* */ } c.modal = null; }
    }
    // Hide hand chip / word bar chips
    try {
      s.hud.hand.setVisible(!on);
      s.words.chipG.setVisible(false);
      s.words.heading.setVisible(false);
      s.words.pil.setVisible(false);
      if (on) {
        s.hand = null;
        s.words.codeOn = false;
        s.words.codeA = 0;
        s.words.held = 0;
        s.words.clearCode?.();
      }
    } catch { /* */ }
  }

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
      silhouettes: target ? [target] : [],
    });
  }

  update(dt: number) {
    if (!this.keyI) this.keyI = this.s.input.keyboard?.addKey('I');
    if (Phaser.Input.Keyboard.JustDown(this.keyI!)) {
      if (!this.on) this.start();
      else this.stop();
    }
    if (!this.on) return;

    this.suppressWordUi(true);
    this.chain?.update(dt);

    const cam = this.s.cameras.main;
    if (Math.abs(cam.zoom - this.s.frameZoom) < 0.02) cam.centerOn(640, 360);

    // Window lure: shimmer pulse
    if (this.shimmer && !this.carrying) {
      this.shimmer.setAlpha(0.2 + 0.25 * (0.5 + 0.5 * Math.sin(this.s.t * 3)));
      this.shimmer.setScale(1.3 + 0.15 * Math.sin(this.s.t * 2.4));
    }

    const f = this.s.ctl.read();
    const nearWin = Math.hypot(this.s.x - WIN.x, this.s.y - (WIN.y + 80)) < 180;

    // Hold E to peel OPEN — never opens READ / picker
    if (nearWin && f.interactHeld && !this.carrying && !this.flying && !this.done) {
      this.peelT += dt;
      this.drawPeelRip(Math.min(1, this.peelT / this.peelNeed));
      if (this.peelT >= this.peelNeed) {
        this.peelT = 0;
        this.peelFx?.destroy(); this.peelFx = undefined;
        this.takeOpen();
      }
    } else {
      if (this.peelT > 0 && !this.carrying) {
        this.peelT = Math.max(0, this.peelT - dt * 2);
        if (this.peelT <= 0) { this.peelFx?.destroy(); this.peelFx = undefined; }
        else this.drawPeelRip(this.peelT / this.peelNeed);
      }
    }

    if (this.carrying && this.swirl) {
      const h = this.handOff();
      this.swirl.setPosition(this.s.x + h.x, this.s.y + h.y);
      // Soft orbit of streak children
      this.swirl.list.forEach((c, i) => {
        const im = c as Phaser.GameObjects.Image;
        const a = this.s.t * 4 + i * 1.6;
        im.setPosition(Math.cos(a) * 14, Math.sin(a) * 10 - 4);
        im.setAngle((a * 40) % 360);
      });
    }

    if (this.carrying && this.keyF && Phaser.Input.Keyboard.JustDown(this.keyF) && !this.flying) {
      this.throwGust();
    }

    if (this.flying && this.projectile) {
      const p = this.projectile;
      const tx = DOOR_CHAIN.x, ty = DOOR_CHAIN.y;
      const dx = tx - p.x, dy = ty - p.y;
      const dist = Math.hypot(dx, dy);
      const sp = 540 * dt;
      if (dist < sp + 10) {
        p.x = tx; p.y = ty;
        this.onContact();
      } else {
        p.x += (dx / dist) * sp;
        p.y += (dy / dist) * sp - Math.sin((1 - dist / 420) * Math.PI) * 0.7;
        this.trail?.setPosition(p.x, p.y);
        p.rotation += dt * 6;
      }
    }
  }

  private handOff() {
    const d = this.s.dir;
    if (d.includes('W')) return { x: -22, y: -48 };
    if (d.includes('E')) return { x: 22, y: -48 };
    return { x: -18, y: -52 };
  }

  /** Tapered S-curve wind mass ripping free from the window. */
  private drawPeelRip(p: number) {
    this.peelFx?.destroy();
    const c = this.s.add.container(WIN.x - 20, WIN.y + 50).setDepth(7200);
    this.peelFx = c;
    this.s.objs.push(c);
    const n = 3 + Math.floor(p * 3);
    for (let i = 0; i < n; i++) {
      const key = `fx_wind_streak_${i % 4}`;
      if (!this.s.textures.exists(key)) continue;
      const im = this.s.add.image(
        -p * 40 - i * 8,
        Math.sin(i + p * 4) * 12,
        key,
      ).setScale(0.7 + p * 0.5).setAlpha(0.45 + p * 0.4).setBlendMode(Phaser.BlendModes.ADD);
      im.setAngle(-20 - p * 25 + i * 8);
      c.add(im);
    }
    // Pull pose
    try { this.s.noor.play(`noor_type1_${this.s.dir}`, true); } catch { /* */ }
  }

  takeOpen() {
    this.carrying = true;
    // DO NOT set s.hand — that drives the old OPEN chip. Steal is invisible-in-HUD.
    this.s.hand = null;
    sfx('swap');
    this.shimmer?.setVisible(false);

    // Window shuts + rain stops
    this.shutWindow();

    const h = this.handOff();
    this.swirl = this.s.add.container(this.s.x + h.x, this.s.y + h.y).setDepth(7100);
    this.s.objs.push(this.swirl);
    for (let i = 0; i < 3; i++) {
      const key = `fx_wind_streak_${i}`;
      if (!this.s.textures.exists(key)) continue;
      const im = this.s.add.image(0, 0, key).setScale(0.55).setAlpha(0.75).setBlendMode(Phaser.BlendModes.ADD);
      this.swirl.add(im);
    }
  }

  private shutWindow() {
    // Flip rain plate to SHUT quietly if present
    const rain = this.s.plateById('o_rain');
    if (rain && rain.slotWord !== 'SHUT') {
      rain.setSlotWord('SHUT');
      this.s.save.plates[rain.def.id] = 'SHUT';
      try { this.s.evaluate(true); } catch { /* */ }
    }
    // Kill rain particle emitters if clarity owns them
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = this.s.clar as any;
    if (c?.rain) {
      try { c.rain.stop?.(); c.rain.setVisible?.(false); } catch { /* */ }
    }
    if (c?.blinds) {
      try { this.s.tweens.add({ targets: c.blinds, angle: 0, duration: 280 }); } catch { /* */ }
    }
    this.rainWasOn = false;
  }

  throwGust() {
    this.carrying = false;
    this.clearCarryFx();
    this.s.hand = null;
    const h = this.handOff();
    this.s.dir = 'NW';
    try { this.s.noor.play(`noor_throw_${this.s.dir}`, true); } catch {
      try { this.s.noor.play(`noor_type3_${this.s.dir}`, true); } catch { /* */ }
    }
    sfx('impact_whoosh');

    // Gust mass = stacked wind streaks (S-curve), not a glowing ball
    const c = this.s.add.container(this.s.x + h.x, this.s.y + h.y).setDepth(7000);
    this.projectile = c;
    this.s.objs.push(c);
    for (let i = 0; i < 4; i++) {
      const key = `fx_wind_streak_${i}`;
      if (!this.s.textures.exists(key)) continue;
      const im = this.s.add.image((i - 1.5) * 6, (i % 2) * 4 - 2, key)
        .setScale(0.85).setAlpha(0.85).setBlendMode(Phaser.BlendModes.ADD)
        .setAngle(-30 + i * 12);
      c.add(im);
    }
    if (this.s.textures.exists('fx_wind_wisp')) {
      this.trail = this.s.add.particles(c.x, c.y, 'fx_wind_wisp', {
        speed: { min: 8, max: 28 }, lifespan: 260, scale: { start: 0.55, end: 0.05 },
        alpha: { start: 0.7, end: 0 }, frequency: 18, blendMode: 'ADD',
      });
      this.s.objs.push(this.trail);
    }
    this.flying = true;
  }

  private clearCarryFx() {
    this.swirl?.destroy(); this.swirl = undefined;
    this.trail?.stop(); this.trail?.destroy(); this.trail = undefined;
    this.projectile?.destroy(); this.projectile = undefined;
  }

  private onContact() {
    this.flying = false;
    const gustSil = this.projectile;
    this.trail?.stop(); this.trail?.destroy(); this.trail = undefined;
    // Hide gust before silhouette so we don't leave a glowing blob in the freeze frame
    try { gustSil?.setVisible(false); } catch { /* */ }

    const dir = { x: DOOR_CHAIN.x - this.s.x, y: DOOR_CHAIN.y - this.s.y };
    // Silhouette Noor + chain link sprites only — NEVER the door JPG (no alpha → grey rect)
    this.fx.fire({
      tier: 'heavy', x: DOOR_CHAIN.x, y: DOOR_CHAIN.y, dir,
      attacker: this.s.noor,
      silhouettes: this.chain?.links ?? [],
    });

    window.setTimeout(() => { try { gustSil?.destroy(); } catch { /* */ } this.projectile = undefined; }, 90);

    this.chain.hit(dir, () => {
      this.fx.fire({
        tier: 'big', x: DOOR_CHAIN.x, y: DOOR_CHAIN.y, dir,
        attacker: this.s.noor,
        silhouettes: this.chain?.links ?? [],
      });
      this.fx.dust(DOOR_CHAIN.x, 240, dir, 10);
      this.openDoor();
    });
  }

  private openDoor() {
    this.done = true;
    const door = this.s.clar?.door;
    // Recoil jolt — nudge only, no tint-fill (door is a JPG rect)
    if (door) {
      this.s.tweens.add({ targets: door, x: door.x - 3, duration: 50, yoyo: true, repeat: 2 });
    }
    const p = this.s.plateById('o_door');
    if (p && p.slotWord !== 'OPEN') {
      // Real-time so hit-stop / slow-mo can't strand the open
      window.setTimeout(() => {
        p.setSlotWord('OPEN');
        this.s.save.plates[p.def.id] = 'OPEN';
        this.s.evaluate(false);
        // Lab: accelerate the lift open so the beat reads immediately
        if (this.s.clar) {
          this.s.clar.doorWant = 1;
          this.s.clar.doorK = Math.max(this.s.clar.doorK, 0.35);
        }
        sfx('impact_hum');
      }, 280);
    }
  }
}
