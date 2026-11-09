// Office combat greybox (?combat=1). Placeholder enemies, diegetic peel/throw, short beam finisher.
// Numbers: docs/design/combat.md. No Blender — words and bodies are code-drawn; Noor may use sprites12 sheets.
import Phaser from 'phaser';
import tokens from '../tokens.json';
import type { GameScene, Enemy } from '../game';
import { O11_PROPS, O11_DUMMY } from '../office11art';
import { DEFAULT_TUNE, type CombatTune } from './tune';
import { sfx } from '../sfx';
import { logSwap } from '../save';

const C = tokens.color;
const hex = (s: string) => parseInt(s.slice(1), 16);
const FONT = 'IBM Plex Mono';
const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

export type GBKind = 'scribble' | 'redline' | 'stapler';
export type PaintOwner = 'dummy' | 'enemy' | 'world';

export interface Painted {
  id: string;
  word: string;
  owner: PaintOwner;
  enemy?: Enemy;
  x: number; y: number;   // world anchor (centre of paint)
  style: 'scrawl' | 'stencil' | 'print' | 'marker';
  col: string;
  ghost?: string;         // faint leftover after peel
  peeled?: boolean;
  shim: number;
}

export interface Projectile {
  word: string; x: number; y: number; vx: number; vy: number; life: number; g: Phaser.GameObjects.Text;
}

/** Active when location.search has combat=1 and the clarity office is up. */
export class CombatGreybox {
  on = true;
  tune: CombatTune = { ...DEFAULT_TUNE };
  ink = 60;
  freePeel = true;
  carried: string[] = [];
  paints: Painted[] = [];
  beamCd = 0;
  peelT = 0; throwT = 0;
  mode: '' | 'peel' | 'throw' | 'beam' = '';
  projectiles: Projectile[] = [];
  scorch: { x: number; y: number; a: number; g: Phaser.GameObjects.Graphics }[] = [];
  flutter: { x: number; y: number; vx: number; vy: number; rot: number; life: number; g: Phaser.GameObjects.Rectangle }[] = [];
  lightDip = 0;
  dipRect: Phaser.GameObjects.Rectangle | null = null;
  inkBar!: Phaser.GameObjects.Graphics;
  inkTxt!: Phaser.GameObjects.Text;
  carryG!: Phaser.GameObjects.Container;
  paintG!: Phaser.GameObjects.Graphics;
  tellG!: Phaser.GameObjects.Graphics;
  tuneUi: Phaser.GameObjects.Container | null = null;
  showTune = false;
  stats = { kills: 0, peels: 0, throws: 0, beams: 0, crashes: 0, blocks: 0, comboKills: 0, wordKills: 0, beamKills: 0 };
  spawned: Enemy[] = [];
  paperSrc: Painted | null = null;
  slowSrc: Painted | null = null;
  usingSheets = false;
  private objs: Phaser.GameObjects.GameObject[] = [];

  constructor(private s: GameScene, showTune: boolean) {
    this.showTune = showTune;
    this.ink = this.tune.inkStart;
    const ui = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
      s.objs.push(o); this.objs.push(o); return o;
    };
    this.inkBar = ui(s.add.graphics().setDepth(4300));
    this.inkTxt = ui(s.add.text(24, 56, '', { fontFamily: FONT, fontSize: '14px', color: C.cyan }).setDepth(4301));
    this.carryG = ui(s.add.container(0, 0).setDepth(4302));
    this.paintG = s.add.graphics().setDepth(3500); s.objs.push(this.paintG); this.objs.push(this.paintG);
    this.tellG = s.add.graphics().setDepth(3490); s.objs.push(this.tellG); this.objs.push(this.tellG);
    this.dipRect = ui(s.add.rectangle(640, 360, 1280, 720, 0x020508, 0).setDepth(4100));
    // detect sprites12
    this.usingSheets = s.textures.exists('noor_combo1');
    this.seedWorldPaints();
    this.rewireDummy();
    this.spawnWave();
    if (showTune) this.buildTune();
    s.hp = this.tune.noorHp;
    s.clar?.say('Combat greybox. Peel ARMORED / PAPER. Throw. Combo. Hold for beam.', 3200);
  }

  destroy() {
    for (const o of this.objs) o.destroy();
    this.objs = [];
  }

  // ---- setup ----
  private seedWorldPaints() {
    // PAPER on the printer tray (ammo for Scribble / dummy)
    this.paperSrc = this.addPaint({ id: 'w_paper', word: 'PAPER', owner: 'world', x: 125, y: 230, style: 'print', col: '#2a2e36' });
    // SLOW on the whiteboard sticky area (ammo for Redline)
    this.slowSrc = this.addPaint({ id: 'w_slow', word: 'SLOW', owner: 'world', x: 680, y: 110, style: 'marker', col: '#c44' });
  }

  private rewireDummy() {
    const s = this.s;
    const d = s.enemies.find(e => e.practice);
    if (!d) return;
    // ARMORED on the dummy chest
    this.addPaint({ id: 'dummy_armored', word: 'ARMORED', owner: 'dummy', enemy: d, x: O11_DUMMY.x, y: O11_DUMMY.y - 70, style: 'scrawl', col: '#1a1814' });
    (d as Enemy & { word?: string; material?: string }).word = 'ARMORED';
    (d as Enemy & { material?: string }).material = 'armored';
  }

  private spawnWave() {
    const s = this.s;
    // Scribble near open floor east of Kabir desk
    const sc = this.spawnGB('scribble', 780, 420);
    // Redline with clear desk lanes (south of mid desks)
    const rl = this.spawnGB('redline', 520, 560);
    // Stapler near meeting nook / west
    const st = this.spawnGB('stapler', 380, 480);
    this.spawned = [sc, rl, st];
  }

  spawnGB(kind: GBKind, x: number, y: number): Enemy {
    const s = this.s;
    const g = s.add.container(x, y); const body = s.add.graphics(); g.add(body);
    const sh = s.add.ellipse(0, 0, kind === 'redline' ? 18 : 36, 10, 0, 0.35); g.addAt(sh, 0);
    const hp = kind === 'scribble' ? this.tune.scribbleHp : kind === 'redline' ? this.tune.redlineHp : this.tune.staplerHp;
    this.drawBody(body, kind, false, true);
    const flash = s.add.graphics().setDepth(-600); s.objs.push(flash);
    // reuse Enemy shape; kind cast through any for new kinds
    const e = {
      kind: kind as Enemy['kind'], x, y, hp, maxHp: hp, g, body, state: 'idle', t: 0.4 + Math.random(),
      kx: 0, ky: 0, tx: x, ty: y, hx: x, hy: y, dead: false, hitBy: -1, phase: 0, flash,
    } as Enemy & { gb?: GBKind; word?: string; material?: string; shielded?: boolean; slow?: boolean };
    e.gb = kind;
    if (kind === 'scribble') {
      e.word = 'ARMORED'; e.material = 'armored';
      this.addPaint({ id: 'sc_' + s.enemies.length, word: 'ARMORED', owner: 'enemy', enemy: e, x, y: y - 28, style: 'scrawl', col: '#1a1814' });
    } else if (kind === 'redline') {
      e.word = 'FAST'; e.material = 'fast';
      this.addPaint({ id: 'rl_' + s.enemies.length, word: 'FAST', owner: 'enemy', enemy: e, x, y: y - 50, style: 'stencil', col: '#c0392b' });
    } else {
      e.word = 'SHIELDED'; e.shielded = true; e.material = 'shielded';
      this.addPaint({ id: 'st_' + s.enemies.length, word: 'SHIELDED', owner: 'enemy', enemy: e, x, y: y - 40, style: 'stencil', col: '#88a0b0' });
    }
    s.enemies.push(e); this.spawned.push(e); s.objs.push(g);
    return e;
  }

  drawBody(body: Phaser.GameObjects.Graphics, kind: GBKind, paper: boolean, shielded: boolean) {
    body.clear();
    if (kind === 'scribble') {
      const col = paper ? 0xc8c0a8 : 0x0c0e1e;
      body.lineStyle(4, col, 1); body.beginPath();
      for (let i = 0; i <= 24; i++) { const a = i * 0.9, r = 14 + (i % 3) * 6; const px = Math.cos(a) * r, py = -22 + Math.sin(a) * r * 0.7; if (i) body.lineTo(px, py); else body.moveTo(px, py); }
      body.strokePath();
      if (paper) { body.lineStyle(1.5, 0x8a826e, 0.9); for (let i = 0; i < 4; i++) body.lineBetween(-12 + i * 6, -40, -8 + i * 5, -8); }
      body.lineStyle(1.5, hex(C.cyan), 0.7).strokeCircle(-6, -26, 3).strokeCircle(6, -26, 3);
    } else if (kind === 'redline') {
      body.fillStyle(0xc0392b, 1).fillRoundedRect(-7, -64, 14, 58, 4);
      body.fillStyle(0x7a1f18, 1).fillCircle(0, -68, 8);
      body.fillStyle(0x2a1010, 1).fillEllipse(0, 0, 18, 8);
      body.lineStyle(2, 0xff6655, 0.8).lineBetween(0, -4, 0, 6);
    } else {
      // stapler
      body.fillStyle(0x3a4450, 1).fillRoundedRect(-22, -36, 44, 28, 4);
      body.fillStyle(0x5a6878, 1).fillRoundedRect(-18, -48, 36, 14, 3);
      if (shielded) {
        body.fillStyle(0x9eb0c0, 0.85).fillRoundedRect(-26, -52, 12, 48, 3);
        body.lineStyle(2, 0xd0e0f0, 0.9).strokeRoundedRect(-26, -52, 12, 48, 3);
      }
      body.fillStyle(0x1a2028, 1).fillEllipse(0, 0, 34, 10);
    }
  }

  addPaint(p: Omit<Painted, 'shim' | 'peeled'> & { shim?: number }): Painted {
    const full: Painted = { shim: 0, peeled: false, ...p };
    this.paints.push(full);
    return full;
  }

  // ---- per frame ----
  update(dt: number) {
    const s = this.s;
    this.beamCd = Math.max(0, this.beamCd - dt);
    this.peelT = Math.max(0, this.peelT - dt);
    this.throwT = Math.max(0, this.throwT - dt);
    this.tellG.clear();
    this.drawPaints();
    this.drawInk();
    this.drawCarried();
    this.updateProjectiles(dt);
    this.updateFX(dt);
    // AI for greybox enemies
    for (const e of s.enemies) {
      if (e.dead || e.practice) continue;
      const gb = (e as Enemy & { gb?: GBKind }).gb;
      if (!gb) continue;
      this.tickEnemy(e, gb, dt);
      // keep paint anchors on body
      for (const p of this.paints) if (p.enemy === e && !p.peeled) { p.x = e.x; p.y = e.y - (gb === 'redline' ? 50 : gb === 'stapler' ? 40 : 28); }
    }
    // solid enemies for Noor (ellipse footprints)
    // handled in blocked() override via clar hook
  }

  /** Called from Clarity.blocked — enemies are solid. */
  enemyBlocked(x: number, y: number): boolean {
    for (const e of this.s.enemies) {
      if (e.dead) continue;
      const gb = (e as Enemy & { gb?: GBKind }).gb;
      if (!gb && !e.practice) continue;
      const rx = gb === 'redline' ? 12 : gb === 'stapler' ? 22 : e.practice ? 26 : 18;
      const ry = gb === 'redline' ? 8 : 11;
      if (((x - e.x) / rx) ** 2 + ((y - e.y) / ry) ** 2 < 1) return true;
    }
    return false;
  }

  private tickEnemy(e: Enemy, kind: GBKind, dt: number) {
    const s = this.s;
    const slow = !!(e as Enemy & { slow?: boolean }).slow;
    e.t -= dt; e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt);
    const dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy) || 1;
    const fl = e.flash!; fl.clear();

    if (kind === 'scribble') {
      const paper = (e as Enemy & { material?: string }).material === 'paper';
      const aggro = this.tune.scribbleAggro;
      const fast = e.hp <= e.maxHp / 2 ? 1.25 : 1;
      if (e.state === 'idle') {
        e.g.setScale(1, 1 + 0.05 * Math.sin(s.t * 6));
        if (d < aggro) {
          if (d > 80) { this.moveEnemy(e, dx / d * 95 * fast * (paper ? 0.7 : 1) * dt, dy / d * 95 * fast * dt); }
          else if (e.t <= 0) { e.state = 'windup'; e.t = this.tune.scribbleLungeWind / fast; }
        }
      } else if (e.state === 'windup') {
        e.g.setScale(1.25, 0.6);
        fl.fillStyle(hex(C.coral), 0.3).fillEllipse(e.x + dx / d * 40, e.y + dy / d * 40, 50, 18);
        if (e.t <= 0) { e.state = 'lunge'; e.t = this.tune.scribbleLungeActive; e.tx = dx / d; e.ty = dy / d; }
      } else if (e.state === 'lunge') {
        e.g.setScale(0.8, 1.2);
        this.moveEnemy(e, e.tx * 560 * fast * dt, e.ty * 560 * fast * dt);
        if (d < 32) { s.hurtNoor('lunge'); e.state = 'recover'; e.t = 0.6; }
        else if (e.t <= 0) { e.state = 'stuck'; e.t = this.tune.scribbleStuck; }
      } else if (e.state === 'stuck') {
        e.g.setScale(1.1, 0.9);
        fl.lineStyle(1, hex(C.cyan), 0.5).strokeCircle(e.x, e.y - 20, 26);
        if (e.t <= 0) { e.state = 'idle'; e.t = 0.4; }
      } else { if (e.t <= 0) { e.state = 'idle'; e.t = 0.5; } }
    }

    if (kind === 'redline') {
      const aggro = this.tune.redlineAggro;
      const spdMul = slow ? 0.45 : 1;
      if (e.state === 'idle') {
        if (d < aggro && e.t <= 0) { e.state = 'scrape'; e.t = this.tune.redlineScrape + (slow ? 0.2 : 0); e.tx = dx / d; e.ty = dy / d; }
        else if (d < aggro) { this.moveEnemy(e, -dy / d * 40 * dt, dx / d * 40 * dt); } // orbit
      } else if (e.state === 'scrape') {
        // telegraph line on floor
        const L = 280;
        fl.lineStyle(4, 0xff4040, 0.7).lineBetween(e.x, e.y, e.x + e.tx * L, e.y + e.ty * L);
        fl.fillStyle(0xff4040, 0.2).fillCircle(e.x, e.y, 16);
        if (e.t <= 0) { e.state = 'charge'; e.t = 1.6; }
      } else if (e.state === 'charge') {
        const sp = this.tune.redlineChargeSpd * spdMul;
        const step = sp * dt;
        const nx = e.x + e.tx * step, ny = e.y + e.ty * step;
        // desk crash?
        if (this.hitsProp(nx, ny)) {
          e.state = 'stun'; e.t = this.tune.redlineStun; this.stats.crashes++;
          s.hitStopT = 0.1; s.cameras.main.shake(150, 0.008); sfx('hit');
          this.s.clar?.say('Desk crash — stunned', 1200);
        } else {
          e.x = nx; e.y = ny;
          if (Math.hypot(s.x - e.x, s.y - e.y) < 28) { s.hurtNoor('charge'); e.state = 'recover'; e.t = 0.5; }
          else if (e.t <= 0 || e.x < 40 || e.x > 1240 || e.y < 80 || e.y > 680) { e.state = 'recover'; e.t = 0.45; }
        }
      } else if (e.state === 'stun') {
        fl.lineStyle(2, hex(C.lamp), 0.8); for (let i = 0; i < 3; i++) fl.strokeCircle(e.x + Math.cos(s.t * 8 + i) * 18, e.y - 50 + Math.sin(s.t * 6 + i) * 6, 3);
        e.g.setRotation(Math.sin(s.t * 20) * 0.15);
        if (e.t <= 0) { e.state = 'idle'; e.t = 0.8; e.g.setRotation(0); }
      } else { e.g.setRotation(0); if (e.t <= 0) { e.state = 'idle'; e.t = 0.6; } }
    }

    if (kind === 'stapler') {
      const shielded = !!(e as Enemy & { shielded?: boolean }).shielded;
      const aggro = this.tune.staplerAggro;
      // face Noor
      const face = Math.atan2(dy, dx);
      if (e.state === 'idle' || e.state === 'guard') {
        e.state = 'guard';
        if (d < aggro) this.moveEnemy(e, dx / d * 55 * dt, dy / d * 55 * dt);
        // frontal shield arc
        if (shielded) {
          fl.fillStyle(0x9eb0c0, 0.15); fl.beginPath(); fl.moveTo(e.x, e.y); fl.arc(e.x, e.y, 50, face - 0.9, face + 0.9, false); fl.closePath(); fl.fillPath();
          fl.lineStyle(2, 0x9eb0c0, 0.7); fl.beginPath(); fl.arc(e.x, e.y, 50, face - 0.9, face + 0.9, false); fl.strokePath();
        }
        if (d > 40 && d < 65 && e.t <= 0) { e.state = 'snapwind'; e.t = this.tune.staplerSnapWind; }
      } else if (e.state === 'snapwind') {
        fl.fillStyle(hex(C.lamp), 0.35).fillCircle(e.x + Math.cos(face) * 30, e.y + Math.sin(face) * 30, 18);
        e.g.setRotation(-0.2);
        if (e.t <= 0) { e.state = 'snap'; e.t = this.tune.staplerSnapActive; e.tx = Math.cos(face); e.ty = Math.sin(face); }
      } else if (e.state === 'snap') {
        this.moveEnemy(e, e.tx * 220 * dt, e.ty * 220 * dt);
        e.g.setRotation(0.35);
        if (Math.hypot(s.x - e.x, s.y - e.y) < 36) s.hurtNoor('snap');
        if (e.t <= 0) { e.state = 'snaprecover'; e.t = this.tune.staplerSnapRecover; }
      } else if (e.state === 'snaprecover') {
        e.g.setRotation(0.15);
        fl.lineStyle(1, hex(C.cyan), 0.5).strokeCircle(e.x, e.y - 20, 30);
        if (e.t <= 0) { e.state = 'guard'; e.t = 0.5; e.g.setRotation(0); }
      } else if (e.state === 'stun') { if (e.t <= 0) { e.state = 'guard'; e.t = 0.3; } }
    }

    e.g.setPosition(e.x, e.y).setDepth(e.y);
    // clamp softly into room
    e.x = Phaser.Math.Clamp(e.x, 60, 1220); e.y = Phaser.Math.Clamp(e.y, 120, 660);
  }

  private moveEnemy(e: Enemy, dx: number, dy: number) {
    const nx = e.x + dx, ny = e.y + dy;
    if (!this.hitsProp(nx, ny) && !this.hitsEnemy(nx, ny, e)) { e.x = nx; e.y = ny; }
    else if (!this.hitsProp(e.x + dx, e.y) && !this.hitsEnemy(e.x + dx, e.y, e)) e.x += dx;
    else if (!this.hitsProp(e.x, e.y + dy) && !this.hitsEnemy(e.x, e.y + dy, e)) e.y += dy;
  }

  private hitsProp(x: number, y: number): boolean {
    const inPoly = (P: number[][], px: number, py: number) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [x1, y1] = P[i], [x2, y2] = P[j]; if ((y1 > py) !== (y2 > py) && px < (x2 - x1) * (py - y1) / (y2 - y1 + 1e-9) + x1) c = !c; } return c; };
    for (const p of O11_PROPS) {
      if (inPoly(p.poly, x, y)) return true;
    }
    return false;
  }
  private hitsEnemy(x: number, y: number, self: Enemy): boolean {
    for (const e of this.s.enemies) {
      if (e === self || e.dead) continue;
      if (Math.hypot(e.x - x, e.y - y) < 28) return true;
    }
    return false;
  }

  // ---- diegetic peel / throw ----
  nearestPaint(r = 48): Painted | null {
    const s = this.s; let best: Painted | null = null, bd = r;
    for (const p of this.paints) {
      if (p.peeled) continue;
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      // facing bias
      const v = s.dirVec(); const toX = p.x - s.x, toY = p.y - s.y; const dot = (toX * v.x + toY * v.y) / (d || 1);
      if (dot < -0.2 && d > 30) continue;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  tryPeel(): boolean {
    if (this.peelT > 0 || this.mode) return false;
    const p = this.nearestPaint(52);
    if (!p) return false;
    const cost = this.freePeel ? 0 : this.tune.inkPeel;
    if (this.ink < cost) { this.s.clar?.say('Not enough ink', 1200); return true; }
    this.ink -= cost; this.freePeel = false;
    this.peelT = 0.55; this.mode = 'peel'; this.stats.peels++;
    // play peel anim if sheets exist
    if (this.usingSheets) this.s.noor.play(`noor_peel_${this.s.dir}`, true);
    this.s.time.delayedCall(380, () => {
      if (p.peeled) return;
      p.peeled = true; p.ghost = p.word;
      if (this.carried.length >= 2) this.carried.shift();
      this.carried.push(p.word);
      // shield peel special
      if (p.word === 'SHIELDED' && p.enemy) {
        (p.enemy as Enemy & { shielded?: boolean }).shielded = false;
        (p.enemy as Enemy & { word?: string }).word = '';
        this.drawBody(p.enemy.body, 'stapler', false, false);
        this.s.clar?.say('SHIELDED peeled — exposed', 1600);
      } else {
        this.s.clar?.say(`Peeled ${p.word}`, 1400);
      }
      sfx('swap');
      logSwap(this.s.save, { placed: '', removed: p.word, room: 'office', plate: p.id, t: Date.now() });
      this.mode = '';
    });
    return true;
  }

  tryThrow(): boolean {
    if (!this.carried.length || this.throwT > 0) return false;
    const word = this.carried[this.carried.length - 1];
    const tgt = this.s.aimTarget(220);
    if (!tgt && !this.nearestBlankSurface()) {
      // still allow throw toward facing
    }
    this.throwT = 0.52; this.mode = 'throw'; this.stats.throws++;
    if (this.usingSheets) this.s.noor.play(`noor_throw_${this.s.dir}`, true);
    const v = (() => {
      if (tgt) { const dx = tgt.x - this.s.x, dy = tgt.y - this.s.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; }
      return this.s.dirVec();
    })();
    this.s.dir = DIRS[(Math.round(Math.atan2(v.y, v.x) / (Math.PI / 4)) + 8) % 8];
    this.s.time.delayedCall(280, () => {
      this.carried.pop();
      const g = this.s.add.text(this.s.x + v.x * 18, this.s.y - 54 + v.y * 8, word, {
        fontFamily: 'JetBrains Mono', fontSize: '15px', fontStyle: 'bold', color: '#04121a', backgroundColor: C.cyan, padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(3600);
      this.s.objs.push(g);
      this.projectiles.push({ word, x: g.x, y: g.y, vx: v.x * 420, vy: v.y * 420, life: 0.7, g });
      this.mode = '';
    });
    return true;
  }

  private nearestBlankSurface(): { x: number; y: number } | null {
    // place onto dummy / enemy if close without projectile — used as fallback
    return null;
  }

  private updateProjectiles(dt: number) {
    for (const p of [...this.projectiles]) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.g.setPosition(p.x, p.y);
      let hit = false;
      for (const e of this.s.enemies) {
        if (e.dead) continue;
        const cy = e.practice ? e.y - 60 : e.y - 30;
        if (Math.hypot(e.x - p.x, cy - p.y) < 36) { this.applyWord(e, p.word); hit = true; break; }
      }
      // also allow placing PAPER/etc back onto peeled world slots when near
      if (!hit) {
        for (const paint of this.paints) {
          if (!paint.peeled || paint.owner !== 'world') continue;
          if (Math.hypot(paint.x - p.x, paint.y - p.y) < 28) {
            paint.word = p.word; paint.peeled = false; paint.ghost = undefined; hit = true;
            this.s.clar?.say(`Placed ${p.word}`, 1200); break;
          }
        }
      }
      if (hit || p.life <= 0) {
        p.g.destroy();
        this.projectiles.splice(this.projectiles.indexOf(p), 1);
        if (!hit && p.life <= 0) {
          // drop as ghost pickup briefly
          const drop = this.addPaint({ id: 'drop_' + Date.now(), word: p.word, owner: 'world', x: p.x, y: p.y, style: 'print', col: '#333' });
          this.s.time.delayedCall(8000, () => { drop.peeled = true; });
        }
      }
    }
  }

  applyWord(e: Enemy, word: string) {
    const s = this.s;
    s.hitStopT = Math.max(s.hitStopT, 0.04);
    const gb = (e as Enemy & { gb?: GBKind }).gb;
    const mat = (e as Enemy & { material?: string });
    // splash FX
    const splash = s.add.circle(e.x, e.y - 40, 8, hex(C.cyan), 0.9).setDepth(e.y + 3);
    s.objs.push(splash); s.tweens.add({ targets: splash, scale: 3, alpha: 0, duration: 220, onComplete: () => splash.destroy() });
    sfx('swap');

    if (e.practice || gb === 'scribble') {
      if (word === 'PAPER' && (mat.material === 'armored' || e.practice)) {
        mat.material = 'paper'; (e as Enemy & { word?: string }).word = 'PAPER';
        // rewrite paint
        for (const p of this.paints) if (p.enemy === e || (e.practice && p.owner === 'dummy')) {
          if (p.peeled) { p.word = 'PAPER'; p.peeled = false; p.style = 'print'; p.col = '#2a2e36'; }
          else { p.word = 'PAPER'; p.style = 'print'; p.col = '#2a2e36'; }
        }
        if (!e.practice) {
          this.drawBody(e.body, 'scribble', true, false);
          e.hp = 1; // folds after one hit
          s.clar?.say('ARMORED → PAPER', 1600);
        } else {
          s.clar?.say('ARMORED → PAPER', 1600);
          // practice dummy: mark material, next combo "tears" counts as word kill for tests
          (e as Enemy & { folded?: boolean }).folded = true;
        }
        this.stats.wordKills++;
        logSwap(s.save, { placed: 'PAPER', removed: 'ARMORED', room: 'office', plate: 'combat', t: Date.now() });
        return;
      }
    }
    if (gb === 'redline' && word === 'SLOW') {
      (e as Enemy & { slow?: boolean }).slow = true; mat.material = 'slow'; (e as Enemy & { word?: string }).word = 'SLOW';
      for (const p of this.paints) if (p.enemy === e) { p.word = 'SLOW'; p.peeled = false; p.col = '#6688aa'; }
      s.clar?.say('FAST → SLOW', 1600);
      this.stats.wordKills++;
      logSwap(s.save, { placed: 'SLOW', removed: 'FAST', room: 'office', plate: 'combat', t: Date.now() });
      return;
    }
    if (gb === 'stapler' && (word === 'OPEN' || word === 'EXPOSED')) {
      (e as Enemy & { shielded?: boolean }).shielded = false;
      this.drawBody(e.body, 'stapler', false, false);
      s.clar?.say('SHIELDED → exposed', 1600);
      return;
    }
    // incompatible
    s.clar?.say(`${word} fizzles`, 1000);
    if (this.carried.length < 2) this.carried.push(word);
  }

  // ---- combat hooks from GameScene ----
  /** Modify hurtEnemy for greybox rules. Returns true if fully handled. */
  onHurt(e: Enemy, dmg: number, kx: number, ky: number): { dmg: number; blocked?: boolean } | null {
    const gb = (e as Enemy & { gb?: GBKind }).gb;
    if (e.practice) {
      const folded = (e as Enemy & { folded?: boolean }).folded;
      if (folded) { this.stats.comboKills++; (e as Enemy & { folded?: boolean }).folded = false; }
      return null; // let default practice flash run
    }
    if (!gb) return null;

    if (gb === 'stapler' && (e as Enemy & { shielded?: boolean }).shielded) {
      // frontal block
      const face = Math.atan2(this.s.y - e.y, this.s.x - e.x); // noor relative — actually shield faces noor
      const hitAng = Math.atan2(-ky || (e.y - this.s.y), -kx || (e.x - this.s.x));
      let da = Math.abs(face - Math.atan2(this.s.y - e.y, this.s.x - e.x));
      // simpler: if Noor is within ±50° of the front (noor is in front), block
      const toNoor = Math.atan2(this.s.y - e.y, this.s.x - e.x);
      const fromHit = Math.atan2(this.s.y - e.y, this.s.x - e.x); // attack comes from Noor
      // Block if Noor is in the frontal cone (she's attacking from front)
      void hitAng; void da; void fromHit;
      const ang = toNoor; // facing toward noor is shield front
      // Always treat attacks from Noor's position as frontal if within 50 deg of shield facing (toward player)
      // Shield faces player, so all attacks from player while facing are frontal — allow back hits when Noor is behind
      const behind = Math.cos(ang) * (this.s.x - e.x) + Math.sin(ang) * (this.s.y - e.y); // always positive toward noor
      // If Noor is in front (she always is when attacking from her pos), block UNLESS she's more "behind" the facing.
      // Facing = toward Noor, so Noor is always in front by definition. Back hits: Noor dashes behind then hits.
      // Measure: vector from stapler to Noor dotted with last move / we store faceDir
      const faceDir = { x: Math.cos(toNoor), y: Math.sin(toNoor) };
      // Attack originates from Noor — if Noor is within frontal arc of shield (shield faces Noor), it's frontal.
      // For "behind" we check if Noor is on the opposite side of where stapler was facing last frame — store facing
      const facing = (e as Enemy & { faceX?: number; faceY?: number });
      if (facing.faceX === undefined) { facing.faceX = faceDir.x; facing.faceY = faceDir.y; }
      // update facing slowly toward noor when in guard
      if (e.state === 'guard' || e.state === 'idle') { facing.faceX = faceDir.x; facing.faceY = faceDir.y; }
      const side = facing.faceX! * (this.s.x - e.x) + facing.faceY! * (this.s.y - e.y);
      if (side > 0) {
        // frontal — block
        this.stats.blocks++;
        this.s.tweens.add({ targets: e.g, alpha: 0.6, duration: 50, yoyo: true });
        this.s.clar?.say('Blocked', 600);
        void behind;
        return { dmg: 0, blocked: true };
      }
      // behind — 1.5x
      dmg *= 1.5;
    }

    if (gb === 'scribble' && (e as Enemy & { material?: string }).material === 'paper') {
      dmg = Math.max(dmg, e.hp); // one hit fold
    }
    return { dmg };
  }

  onKill(e: Enemy, via: 'combo' | 'beam' | 'word' | 'other') {
    if (via === 'combo') this.stats.comboKills++;
    if (via === 'beam') this.stats.beamKills++;
    if (via === 'word') this.stats.wordKills++;
    this.stats.kills++;
    for (const p of this.paints) if (p.enemy === e) p.peeled = true;
  }

  onComboHit(hit: number) {
    const add = this.tune.inkHit[hit - 1] ?? 8;
    this.ink = Math.min(this.tune.inkMax, this.ink + add);
  }

  /** Short-range beam finisher. Returns true if handled (caller should skip default fireBeam). */
  fireBeam(): boolean {
    const s = this.s;
    if (this.beamCd > 0) { s.clar?.say('Beam cooling', 900); return true; }
    if (this.ink < this.tune.inkBeam) { s.clar?.say('Not enough ink for beam', 1200); return true; }
    this.ink -= this.tune.inkBeam; this.beamCd = this.tune.beamCd; this.stats.beams++;
    const R = this.tune.beamRange;
    const tgt = s.aimTarget(R + 40); let v = s.dirVec();
    if (tgt) { const dx = tgt.x - s.x, dy = tgt.y - s.y, l = Math.hypot(dx, dy) || 1; v = { x: dx / l, y: dy / l }; s.dir = DIRS[(Math.round(Math.atan2(v.y, v.x) / (Math.PI / 4)) + 8) % 8]; }
    const L = Math.min(R, tgt ? Math.hypot(tgt.x - s.x, tgt.y - s.y) + 20 : R);
    const x0 = s.x, y0 = s.y - 52;
    if (this.usingSheets) s.noor.play(`noor_release_${s.dir}`, true);
    else s.noor.play(`noor_type3_${s.dir}`, true);
    s.swingT = 0.45; s.beamN++; sfx('paste');

    // room reactions: light dip, paper flutter, scorched trail
    this.lightDip = 0.55;
    this.spawnFlutter(x0, y0, v, L);
    this.spawnScorch(x0, y0, v, L);

    const hit = s.enemies.filter(e => {
      if (e.dead) return false;
      const t = Phaser.Math.Clamp(((e.x - s.x) * v.x + (e.y - s.y) * v.y) / L, 0, 1);
      return Math.hypot(e.x - (s.x + v.x * L * t), e.y - (s.y + v.y * L * t)) < 36;
    });
    s.beamHits += hit.length;
    for (const e of hit) {
      const pre = e.hp;
      // bypass shield for beam from side — still use hurtEnemy
      const kb = { x: v.x * 36, y: v.y * 36 };
      if ((e as Enemy & { gb?: GBKind }).gb === 'stapler' && (e as Enemy & { shielded?: boolean }).shielded) {
        // beam from front still blocked unless peeled
        const face = (e as Enemy & { faceX?: number; faceY?: number });
        const side = (face.faceX ?? 1) * (s.x - e.x) + (face.faceY ?? 0) * (s.y - e.y);
        if (side > 0) { this.stats.blocks++; s.clar?.say('Shield blocked the beam', 1000); continue; }
      }
      s.hurtEnemy(e, this.tune.beamDmg, kb.x * 10, kb.y * 10, true);
      if (e.dead || e.hp < pre) { if (e.dead) this.onKill(e, 'beam'); }
      if (e.practice && s.clar) { s.markTut('o11beam'); s.clar.beamHits++; }
    }
    if (hit.length) { s.hitStopT = 0.07; s.noor.anims.pause(); s.cameras.main.shake(160, 0.01); }

    // beam visual
    const glow = s.add.graphics().setDepth(y0 + 3).setBlendMode(Phaser.BlendModes.ADD); s.objs.push(glow);
    glow.lineStyle(22, hex(C.cyan), 0.2).lineBetween(x0, y0, x0 + v.x * L, y0 + v.y * L);
    glow.lineStyle(6, 0xffffff, 0.85).lineBetween(x0, y0, x0 + v.x * L, y0 + v.y * L);
    glow.lineStyle(2, hex(C.inkBright), 1).lineBetween(x0, y0, x0 + v.x * L, y0 + v.y * L);
    s.tweens.add({ targets: glow, alpha: 0, duration: 420, delay: 120, onComplete: () => glow.destroy() });
    // recoil
    s.slide(-v.x * 5, -v.y * 5);
    return true;
  }

  private spawnFlutter(x0: number, y0: number, v: { x: number; y: number }, L: number) {
    for (let i = 0; i < 10; i++) {
      const t = 0.15 + Math.random() * 0.7;
      const x = x0 + v.x * L * t + (Math.random() - 0.5) * 30;
      const y = y0 + v.y * L * t + (Math.random() - 0.5) * 20;
      const g = this.s.add.rectangle(x, y, 6 + Math.random() * 5, 4, Math.random() > 0.5 ? 0xe8e0c8 : 0xd0c8b0, 0.95).setDepth(y + 2).setRotation(Math.random() * 4);
      this.s.objs.push(g);
      this.flutter.push({ x, y, vx: v.x * 40 + (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 60, rot: (Math.random() - 0.5) * 8, life: 0.7 + Math.random() * 0.5, g });
    }
  }
  private spawnScorch(x0: number, y0: number, v: { x: number; y: number }, L: number) {
    const g = this.s.add.graphics().setDepth(5); this.s.objs.push(g);
    g.lineStyle(10, 0x1a3040, 0.55).lineBetween(x0, y0 + 40, x0 + v.x * L, y0 + 40 + v.y * L);
    g.lineStyle(2, hex(C.cyan), 0.35);
    for (let i = 0; i < 6; i++) {
      const t = i / 5; const x = x0 + v.x * L * t, y = y0 + 40 + v.y * L * t;
      g.strokeRect(x - 4, y - 3, 8, 6);
    }
    this.scorch.push({ x: x0, y: y0, a: 1, g });
  }
  private updateFX(dt: number) {
    if (this.lightDip > 0) {
      this.lightDip = Math.max(0, this.lightDip - dt);
      this.dipRect?.setAlpha(0.35 * (this.lightDip / 0.55));
    } else this.dipRect?.setAlpha(0);
    for (const f of [...this.flutter]) {
      f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 180 * dt; f.g.setPosition(f.x, f.y).setRotation(f.g.rotation + f.rot * dt).setAlpha(Math.max(0, f.life));
      if (f.life <= 0) { f.g.destroy(); this.flutter.splice(this.flutter.indexOf(f), 1); }
    }
    for (const sc of [...this.scorch]) {
      sc.a -= dt / 1.2; sc.g.setAlpha(Math.max(0, sc.a));
      if (sc.a <= 0) { sc.g.destroy(); this.scorch.splice(this.scorch.indexOf(sc), 1); }
    }
  }

  // ---- draw ----
  private drawPaints() {
    const g = this.paintG; g.clear();
    const near = this.nearestPaint(56);
    for (const p of this.paints) {
      if (p.peeled && p.ghost) {
        // adhesive ghost
        g.lineStyle(1, 0xffffff, 0.15);
        const t = this.s.add.text(0, 0, ''); // measure via graphics text approx
        void t;
        g.fillStyle(0xffffff, 0.08);
        const w = p.ghost.length * 8;
        g.fillRoundedRect(p.x - w / 2, p.y - 8, w, 16, 3);
        continue;
      }
      if (p.peeled) continue;
      const hot = near === p;
      if (hot) p.shim += 0.016; else p.shim = 0;
      const col = hex(p.col.startsWith('#') ? p.col : '#222');
      const w = Math.max(48, p.word.length * 9);
      g.fillStyle(0x04101a, hot ? 0.55 : 0.35).fillRoundedRect(p.x - w / 2 - 4, p.y - 11, w + 8, 22, 4);
      // shimmer band
      if (hot) g.fillStyle(0xffffff, 0.12 + 0.1 * Math.sin(p.shim * 10)).fillRect(p.x - w / 2 + ((p.shim * 40) % w), p.y - 11, 10, 22);
    }
    // text objects pooled via scene — recreate lightly each frame is expensive; use fixed texts
    this.ensurePaintTexts();
  }

  private paintTexts = new Map<string, Phaser.GameObjects.Text>();
  private ensurePaintTexts() {
    const live = new Set<string>();
    for (const p of this.paints) {
      if (p.peeled && !p.ghost) continue;
      live.add(p.id);
      let t = this.paintTexts.get(p.id);
      if (!t) {
        t = this.s.add.text(p.x, p.y, p.word, { fontFamily: 'JetBrains Mono', fontSize: p.style === 'scrawl' ? '13px' : '14px', fontStyle: 'bold', color: p.col }).setOrigin(0.5).setDepth(3510);
        this.s.objs.push(t); this.paintTexts.set(p.id, t);
      }
      if (p.peeled && p.ghost) { t.setText(p.ghost).setAlpha(0.2).setPosition(p.x, p.y); }
      else { t.setText(p.word).setColor(p.col).setAlpha(1).setPosition(p.x, p.y); }
    }
    for (const [id, t] of this.paintTexts) if (!live.has(id)) { t.destroy(); this.paintTexts.delete(id); }
  }

  private drawInk() {
    const g = this.inkBar; g.clear();
    const x = 20, y = 54, w = 160, h = 12;
    g.fillStyle(0x050c12, 0.85).fillRoundedRect(x, y, w, h, 4);
    g.fillStyle(hex(C.cyan), 0.85).fillRoundedRect(x, y, w * (this.ink / this.tune.inkMax), h, 4);
    g.lineStyle(1, hex(C.cyan), 0.7).strokeRoundedRect(x, y, w, h, 4);
    this.inkTxt.setText(`ink ${Math.round(this.ink)}/${this.tune.inkMax}` + (this.beamCd > 0 ? `  beam ${this.beamCd.toFixed(1)}s` : ''));
  }

  private drawCarried() {
    // clear children
    this.carryG.removeAll(true);
    const s = this.s;
    const hx = s.x, hy = s.y - 58;
    this.carried.forEach((w, i) => {
      const an = s.t * 1.6 + i * Math.PI;
      const ox = Math.cos(an) * 26, oy = Math.sin(an) * 9 - 8;
      const sc = s.toScreen(hx + ox, hy + oy);
      const t = s.add.text(sc.x, sc.y, w, { fontFamily: 'JetBrains Mono', fontSize: '12px', fontStyle: 'bold', color: C.cyan, backgroundColor: 'rgba(4,16,20,0.85)', padding: { x: 4, y: 2 } }).setOrigin(0.5).setScrollFactor(0);
      this.carryG.add(t);
    });
  }

  // ---- interact override ----
  /** If true, Clarity should not open picker/card. */
  handleInteract(): boolean {
    // prefer peel when near paint
    if (this.nearestPaint(52)) return this.tryPeel();
    return false;
  }

  /** Attack pressed while holding a carried word → throw instead of combo. */
  preferThrow(): boolean {
    return this.carried.length > 0 && !!this.s.aimTarget(200);
  }

  // ---- tune panel ----
  private buildTune() {
    const s = this.s;
    const c = s.add.container(1000, 80).setScrollFactor(0).setDepth(4500);
    s.objs.push(c); this.objs.push(c); this.tuneUi = c;
    const bg = s.add.rectangle(0, 0, 260, 420, 0x050c12, 0.92).setOrigin(0).setStrokeStyle(1, hex(C.cyan), 0.6);
    c.add(bg);
    c.add(s.add.text(12, 10, 'TUNE (?tune=1)', { fontFamily: FONT, fontSize: '13px', color: C.cyan }));
    const rows: { key: keyof CombatTune; label: string; step: number }[] = [
      { key: 'holdBeam', label: 'beam hold s', step: 0.05 },
      { key: 'beamRange', label: 'beam range', step: 8 },
      { key: 'beamDmg', label: 'beam dmg', step: 1 },
      { key: 'inkBeam', label: 'ink beam', step: 5 },
      { key: 'inkPeel', label: 'ink peel', step: 5 },
      { key: 'scribbleLungeWind', label: 'scrib wind', step: 0.05 },
      { key: 'redlineChargeSpd', label: 'redline spd', step: 20 },
      { key: 'redlineStun', label: 'crash stun', step: 0.1 },
      { key: 'staplerSnapWind', label: 'snap wind', step: 0.05 },
    ];
    rows.forEach((r, i) => {
      const y = 36 + i * 36;
      const lab = s.add.text(12, y, `${r.label}: ${this.tune[r.key]}`, { fontFamily: FONT, fontSize: '12px', color: C.inkBright });
      const minus = s.add.text(200, y, '−', { fontFamily: FONT, fontSize: '16px', color: C.cyan, backgroundColor: '#123', padding: { x: 6, y: 2 } }).setInteractive({ useHandCursor: true });
      const plus = s.add.text(228, y, '+', { fontFamily: FONT, fontSize: '16px', color: C.cyan, backgroundColor: '#123', padding: { x: 6, y: 2 } }).setInteractive({ useHandCursor: true });
      const sync = () => lab.setText(`${r.label}: ${+(this.tune[r.key] as number).toFixed(2)}`);
      minus.on('pointerdown', () => { (this.tune as unknown as Record<string, number>)[r.key] = Math.max(0, (this.tune[r.key] as number) - r.step); sync(); });
      plus.on('pointerdown', () => { (this.tune as unknown as Record<string, number>)[r.key] = (this.tune[r.key] as number) + r.step; sync(); });
      c.add([lab, minus, plus]);
    });
    c.add(s.add.text(12, 380, 'J combo · hold beam · E peel\nattack+carry = throw', { fontFamily: FONT, fontSize: '11px', color: C.dim }));
  }

  state() {
    return {
      ink: this.ink, carried: [...this.carried], beamCd: this.beamCd,
      paints: this.paints.map(p => ({ id: p.id, word: p.word, peeled: !!p.peeled, owner: p.owner, x: p.x, y: p.y })),
      enemies: this.s.enemies.filter(e => !!(e as Enemy & { gb?: string }).gb || e.practice).map(e => ({
        kind: (e as Enemy & { gb?: string }).gb ?? (e.practice ? 'dummy' : e.kind), x: e.x, y: e.y, hp: e.hp, dead: e.dead, state: e.state,
        word: (e as Enemy & { word?: string }).word, material: (e as Enemy & { material?: string }).material,
        shielded: !!(e as Enemy & { shielded?: boolean }).shielded, slow: !!(e as Enemy & { slow?: boolean }).slow,
      })),
      stats: { ...this.stats },
      tune: { ...this.tune },
      usingSheets: this.usingSheets,
      lightDip: this.lightDip, scorch: this.scorch.length, flutter: this.flutter.length,
    };
  }
}
