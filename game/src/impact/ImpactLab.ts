// Dead-lift beat (?impact): peel SPARK from flickering desk lamp → F-zap into dead call panel → lift opens.
// No chain/padlock, no window wind. Old word system fully off.
import Phaser from 'phaser';
import type { GameScene } from '../game';
import { O11_DOOR } from '../office11art';
import { ImpactFX } from './ImpactFX';
import { OnboardLure } from './OnboardLure';
import { sfx } from '../sfx';

/** Call panel to the right of the lift doors. */
const PANEL = { x: O11_DOOR.x + 210, y: O11_DOOR.y + 130 };
/** Desk lamp on the west pod desk near the lift. */
const LAMP = { x: 168, y: 268 };

export class ImpactLab {
  on = false;
  stealMode = false;
  fx!: ImpactFX;
  lure?: OnboardLure;
  carrying = false;
  flying = false;
  done = false;
  hint?: Phaser.GameObjects.Text;
  private keyF?: Phaser.Input.Keyboard.Key;
  private keyI?: Phaser.Input.Keyboard.Key;
  private peelT = 0;
  private peelNeed = 0.5;
  private lampSpr?: Phaser.GameObjects.Image;
  private panelSpr?: Phaser.GameObjects.Image;
  private floorInd?: Phaser.GameObjects.Image;
  private heldOrb?: Phaser.GameObjects.Sprite;
  private bolt?: Phaser.GameObjects.Sprite;
  private cover?: Phaser.Physics.Matter.Image;
  private buzzT = 0;
  private lampOn = true;
  private darkGap?: Phaser.GameObjects.Rectangle;

  constructor(private s: GameScene) {
    this.fx = new ImpactFX(s);
  }

  start() {
    if (this.on) return;
    this.on = true;
    this.stealMode = true;

    // Door locked quietly
    const door = this.s.plateById('o_door');
    if (door && door.slotWord !== 'SHUT') {
      door.setSlotWord('SHUT');
      this.s.save.plates[door.def.id] = 'SHUT';
      this.s.evaluate(true);
    }

    this.suppressWordUi(true);
    this.spawnProps();
    this.setupLure();

    const debug = new URLSearchParams(location.search).has('debug');
    if (debug) {
      this.hint = this.s.add.text(640, 40, 'DEAD LIFT  ·  hold E at lamp  ·  F panel', {
        fontFamily: 'IBM Plex Mono', fontSize: '13px', color: '#7ec8e3',
        backgroundColor: 'rgba(4,10,16,0.65)', padding: { x: 8, y: 4 },
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setScrollFactor(0).setDepth(9500);
      this.s.objs.push(this.hint);
    }

    this.keyF = this.s.input.keyboard?.addKey('F');
    // Follow cam, closer zoom — no letterbox contain
    this.s.setupFollowCamera?.(2.0);
    this.s.x = 280; this.s.y = 340; this.s.dir = 'N';
    this.s.unstick();

    // Fern hint (dialogue OK)
    window.setTimeout(() => {
      try {
        // Force fern card path even with clar present
        this.s.subQueue.push({ who: 'fern', line: "That lamp's been angry all morning. The lift's dead — maybe it wants the spark.", ms: 3200 });
        if (!this.s.subBusy) this.s.nextSub();
      } catch { /* */ }
    }, 600);
  }

  stop() {
    this.on = false;
    this.stealMode = false;
    this.lure?.destroy(); this.lure = undefined;
    this.hint?.destroy(); this.hint = undefined;
    this.clearCarryFx();
    this.lampSpr?.destroy(); this.panelSpr?.destroy();
    this.floorInd?.destroy(); this.darkGap?.destroy();
    this.cover?.destroy();
    this.suppressWordUi(false);
  }

  suppressWordUi(on: boolean) {
    const s = this.s;
    if (s.clar?.objective) s.clar.objective.setVisible(false);
    if (s.clar) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = s.clar as any;
      if (c.capMsg) c.capMsg = null;
      if (c.modal) { try { c.modal.destroy(); } catch { /* */ } c.modal = null; }
    }
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

  private spawnProps() {
    // Dark gap between shut lift leaves (reads "no power")
    this.darkGap = this.s.add.rectangle(O11_DOOR.x + 98, O11_DOOR.y + 148, 6, 200, 0x020408, 0.85)
      .setDepth(O11_DOOR.y + 1);
    this.s.objs.push(this.darkGap);

    // Dead call panel
    const ptex = this.s.textures.exists('fx_lift_panel_dead') ? 'fx_lift_panel_dead' : 'fx_spark_core';
    this.panelSpr = this.s.add.image(PANEL.x, PANEL.y, ptex).setDepth(PANEL.y + 2).setScale(1.35);
    this.s.objs.push(this.panelSpr);

    // Floor indicator (off)
    if (this.s.textures.exists('fx_lift_floor_ind_off')) {
      this.floorInd = this.s.add.image(PANEL.x, PANEL.y - 42, 'fx_lift_floor_ind_off')
        .setDepth(PANEL.y + 3).setScale(1.2);
      this.s.objs.push(this.floorInd);
    }

    // Flickering desk lamp
    const ltex = this.s.textures.exists('fx_lamp_on') ? 'fx_lamp_on' : 'fx_spark_core';
    this.lampSpr = this.s.add.image(LAMP.x, LAMP.y, ltex).setDepth(LAMP.y + 2).setScale(1.5);
    this.s.objs.push(this.lampSpr);
  }

  private setupLure() {
    this.lure = new OnboardLure(this.s, LAMP, PANEL, { nearR: 120 });
    this.lure.sourceAct = (t) => {
      if (!this.lampOn || !this.lampSpr) return;
      // Flicker + occasional spark pop
      const flick = Math.sin(t * 17) * Math.sin(t * 3.1);
      const on = flick > -0.55;
      this.lampSpr.setTexture(on ? 'fx_lamp_on' : 'fx_lamp_off');
      this.lampSpr.setAlpha(on ? 1 : 0.7);
      this.buzzT += 1 / 60;
      if (this.buzzT > 0.55 && Math.random() < 0.04) {
        this.buzzT = 0;
        this.popSpark(LAMP.x + 4, LAMP.y - 18);
        try { sfx('impact_whoosh'); } catch { /* soft buzz stand-in */ }
      }
    };
  }

  private popSpark(x: number, y: number) {
    if (!this.s.textures.exists('fx_spark_pop')) return;
    const sp = this.s.add.image(x, y, 'fx_spark_pop').setDepth(y + 10).setScale(0.8)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.s.tweens.add({
      targets: sp, alpha: 0, scale: 1.6, y: y - 16, duration: 220,
      onComplete: () => sp.destroy(),
    });
  }

  onDummyHit(
    x: number, y: number,
    hit = 1,
    target?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  ) {
    if (!this.s.clar?.dummy && !this.on) return;
    const tier = hit >= 3 ? 'heavy' : 'light';
    this.fx.fire({
      tier, x, y, dir: { x: x - this.s.x, y: y - this.s.y },
      attacker: this.s.noor, target, silhouettes: target ? [target] : [],
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
    this.lure?.update(dt);
    this.s.updateFollowCamera?.();

    // Keep fern/hud dialogue visible (words in dialogue OK)
    // Peel hold E near lamp
    const f = this.s.ctl.read();
    const nearLamp = Math.hypot(this.s.x - LAMP.x, this.s.y - LAMP.y) < 120;

    if (nearLamp && f.interactHeld && !this.carrying && !this.flying && !this.done && this.lampOn) {
      this.peelT += dt;
      // Pull pose
      try { this.s.noor.play(`noor_type1_${this.s.dir}`, true); } catch { /* */ }
      if (this.peelT >= this.peelNeed) {
        this.peelT = 0;
        this.takeSpark();
      }
    } else if (!this.carrying) {
      this.peelT = Math.max(0, this.peelT - dt * 2);
    }

    if (this.carrying && this.heldOrb) {
      const h = this.handOff();
      this.heldOrb.setPosition(this.s.x + h.x, this.s.y + h.y);
      const fi = Math.floor(this.s.t * 10) % 4;
      if (this.s.textures.exists('fx_spark_orb_' + fi)) this.heldOrb.setTexture('fx_spark_orb_' + fi);
    }

    if (this.carrying && this.keyF && Phaser.Input.Keyboard.JustDown(this.keyF) && !this.flying) {
      this.throwBolt();
    }

    if (this.flying && this.bolt) {
      const tx = PANEL.x, ty = PANEL.y;
      const dx = tx - this.bolt.x, dy = ty - this.bolt.y;
      const dist = Math.hypot(dx, dy);
      const sp = 900 * dt; // fast zap
      if (dist < sp + 12) {
        this.bolt.x = tx; this.bolt.y = ty;
        this.onPanelHit();
      } else {
        this.bolt.x += (dx / dist) * sp;
        this.bolt.y += (dy / dist) * sp;
        const fi = Math.floor(this.s.t * 20) % 4;
        if (this.s.textures.exists('fx_lightning_' + fi)) this.bolt.setTexture('fx_lightning_' + fi);
        const ang = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
        this.bolt.setAngle(ang);
      }
    }
  }

  private handOff() {
    const d = this.s.dir;
    if (d.includes('W')) return { x: -20, y: -50 };
    if (d.includes('E')) return { x: 20, y: -50 };
    return { x: -14, y: -54 };
  }

  takeSpark() {
    this.carrying = true;
    this.lampOn = false;
    this.s.hand = null;
    this.lure?.setCarrying(true);
    sfx('swap');

    // Lamp dies
    if (this.lampSpr && this.s.textures.exists('fx_lamp_off')) {
      this.lampSpr.setTexture('fx_lamp_off').setAlpha(1);
    }
    this.popSpark(LAMP.x, LAMP.y - 20);

    // Held crackling orb
    const h = this.handOff();
    const key = this.s.textures.exists('fx_spark_orb_0') ? 'fx_spark_orb_0' : 'fx_spark_core';
    this.heldOrb = this.s.add.sprite(this.s.x + h.x, this.s.y + h.y, key)
      .setDepth(7100).setScale(1.45).setBlendMode(Phaser.BlendModes.ADD);
    this.s.objs.push(this.heldOrb);
    // Soft glow on Noor
    try {
      this.s.noor.setTint(0xc8e8ff);
      window.setTimeout(() => { try { this.s.noor.clearTint(); } catch { /* */ } }, 400);
    } catch { /* */ }
  }

  throwBolt() {
    this.carrying = false;
    // Keep lure.carrying so the panel keeps pulsing + F glyph until impact
    this.s.hand = null;
    this.heldOrb?.destroy(); this.heldOrb = undefined;

    const h = this.handOff();
    this.s.dir = this.s.x > PANEL.x ? 'NW' : 'NE';
    // Wind-up then throw
    try { this.s.noor.play(`noor_type2_${this.s.dir}`, true); } catch { /* */ }
    window.setTimeout(() => {
      try { this.s.noor.play(`noor_throw_${this.s.dir}`, true); } catch {
        try { this.s.noor.play(`noor_type3_${this.s.dir}`, true); } catch { /* */ }
      }
    }, 90);

    sfx('impact_whoosh');
    const key = this.s.textures.exists('fx_lightning_0') ? 'fx_lightning_0' : 'fx_spark_core';
    this.bolt = this.s.add.sprite(this.s.x + h.x, this.s.y + h.y, key)
      .setDepth(7000).setScale(1.7).setBlendMode(Phaser.BlendModes.ADD);
    this.s.objs.push(this.bolt);
    this.flying = true;
  }

  private clearCarryFx() {
    this.heldOrb?.destroy(); this.heldOrb = undefined;
    this.bolt?.destroy(); this.bolt = undefined;
  }

  private onPanelHit() {
    this.flying = false;
    this.lure?.setCarrying(false);
    const bolt = this.bolt;
    this.bolt = undefined;

    const dir = { x: PANEL.x - this.s.x, y: PANEL.y - this.s.y };
    // BIG impact — silhouette Noor + panel (+ bolt if still)
    const sils: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Image)[] = [];
    if (this.panelSpr) sils.push(this.panelSpr);
    if (bolt) sils.push(bolt);

    this.fx.fire({
      tier: 'big', x: PANEL.x, y: PANEL.y, dir,
      attacker: this.s.noor,
      target: this.panelSpr,
      silhouettes: sils,
    });

    window.setTimeout(() => { try { bolt?.destroy(); } catch { /* */ } }, 100);

    // Panel cracks → sparks → goes live green
    window.setTimeout(() => {
      if (this.panelSpr && this.s.textures.exists('fx_lift_panel_cracked')) {
        this.panelSpr.setTexture('fx_lift_panel_cracked');
      }
      this.popSpark(PANEL.x, PANEL.y - 10);
      this.popSpark(PANEL.x + 8, PANEL.y + 6);
      sfx('impact_snap');
      this.popCover();
    }, 120);

    window.setTimeout(() => {
      if (this.panelSpr && this.s.textures.exists('fx_lift_panel_live')) {
        this.panelSpr.setTexture('fx_lift_panel_live');
      }
      if (this.floorInd && this.s.textures.exists('fx_lift_floor_ind_on')) {
        this.floorInd.setTexture('fx_lift_floor_ind_on');
      }
      // Lift lights flicker on — flash door area
      try { this.s.cameras.main.flash(180, 40, 80, 60); } catch { /* */ }
      sfx('impact_hum');
      this.openLift();
    }, 280);
  }

  private popCover() {
    if (!this.s.matter || !this.s.textures.exists('fx_lift_panel_cover')) return;
    try {
      this.cover = this.s.matter.add.image(PANEL.x, PANEL.y - 8, 'fx_lift_panel_cover', undefined, {
        shape: { type: 'rectangle', width: 20, height: 24 },
        friction: 0.5, restitution: 0.45, density: 0.004,
      });
      this.cover.setDepth(PANEL.y + 6).setScale(1.1);
      this.cover.setVelocity(120, -280);
      this.cover.setAngularVelocity(0.25);
      this.s.objs.push(this.cover);
      // Settle toward floor after a beat
      window.setTimeout(() => {
        try {
          this.cover?.setVelocity(40, 180);
        } catch { /* */ }
      }, 200);
    } catch { /* */ }
  }

  private openLift() {
    this.done = true;
    this.lure?.destroy(); this.lure = undefined;
    this.darkGap?.destroy(); this.darkGap = undefined;
    const door = this.s.clar?.door;
    if (door) {
      // Grind/shudder
      this.s.tweens.add({
        targets: door, x: door.x - 2, duration: 40, yoyo: true, repeat: 5,
      });
    }
    const p = this.s.plateById('o_door');
    if (p && p.slotWord !== 'OPEN') {
      window.setTimeout(() => {
        p.setSlotWord('OPEN');
        this.s.save.plates[p.def.id] = 'OPEN';
        this.s.evaluate(false);
        if (this.s.clar) {
          this.s.clar.doorWant = 1;
          this.s.clar.doorK = Math.max(this.s.clar.doorK, 0.25);
        }
        sfx('impact_hum');
      }, 200);
    }
  }

  /** Test helpers */
  get lampAlive() { return this.lampOn; }
  get panelPos() { return { ...PANEL }; }
  get lampPos() { return { ...LAMP }; }
}
