// Office combat greybox (?combat=1). World-only diegetic words; enemies show material by look, never text.
// Numbers + transform matrix: docs/design/combat.md. No Blender — code-drawn placeholders.
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
/** Form after a thrown word morphs the body. Default = base material look. */
export type Form = 'default' | 'paper' | 'wet' | 'slow' | 'glass';
export type WorldWord = 'PAPER' | 'WET' | 'SLOW' | 'GLASS';

export interface Painted {
  id: string;
  word: WorldWord;
  owner: 'world';
  x: number; y: number;
  style: 'print' | 'marker' | 'stencil' | 'sign';
  col: string;
  ghost?: string;
  peeled?: boolean;
  shim: number;
  /** short surface label under the word, e.g. "printer tray" */
  where: string;
}

export interface Projectile {
  word: WorldWord; x: number; y: number; vx: number; vy: number; life: number; g: Phaser.GameObjects.Text;
}

type GBEnemy = Enemy & {
  gb?: GBKind;
  form?: Form;
  morphT?: number;       // 0..1 morph progress
  morphFrom?: Form;
  shielded?: boolean;    // stapler chrome plating (visual + frontal block) until PAPER/GLASS
  slow?: boolean;
  wet?: boolean;
  faceX?: number; faceY?: number;
  dripG?: Phaser.GameObjects.Graphics;
  skidG?: Phaser.GameObjects.Graphics;
};

/** Effectiveness: ★★★ best, ★★ good, ★ ok, · weak. */
export const TRANSFORM: Record<WorldWord, Record<GBKind | 'dummy', { stars: number; note: string }>> = {
  PAPER: {
    stapler: { stars: 3, note: 'Beats chrome plating; crumples in 1 hit.' },
    scribble: { stars: 2, note: 'Folds the ink ball; 1 HP left.' },
    redline: { stars: 1, note: 'Light paper shell; still fast.' },
    dummy: { stars: 3, note: 'Strips the practice plate; crumples in 1 hit.' },
  },
  WET: {
    scribble: { stars: 3, note: 'Ink runs; melts, −50% speed, weaker attacks.' },
    stapler: { stars: 2, note: 'Rusts the plating; shield softens (0.5× block).' },
    redline: { stars: 1, note: 'Smears the charge line; slight slow.' },
    dummy: { stars: 2, note: 'Sags; slower tells.' },
  },
  SLOW: {
    redline: { stars: 3, note: 'Dried matte marker; charge and telegraphs crawl.' },
    scribble: { stars: 2, note: 'Tangles stiffen; lunge wind-up longer.' },
    stapler: { stars: 1, note: 'Moves slower; shield still up.' },
    dummy: { stars: 1, note: 'Sluggish wobble.' },
  },
  GLASS: {
    stapler: { stars: 3, note: 'Brittle chrome; next hit shatters (kill).' },
    redline: { stars: 2, note: 'Glass pen; shatters on next solid hit.' },
    scribble: { stars: 2, note: 'Frozen glass scribble; shatters on next hit.' },
    dummy: { stars: 3, note: 'Brittle plate; next hit shatters.' },
  },
};

export class CombatGreybox {
  on = true;
  tune: CombatTune = { ...DEFAULT_TUNE };
  ink = 60;
  freePeel = true;
  carried: WorldWord[] = [];
  /** Index into carried armed for throw; null = attack is combo/beam. Tap a carried glyph to arm. */
  armed: number | null = null;
  paints: Painted[] = [];
  beamCd = 0;
  peelT = 0; throwT = 0;
  mode: '' | 'peel' | 'throw' | 'beam' = '';
  projectiles: Projectile[] = [];
  scorch: { x: number; y: number; a: number; g: Phaser.GameObjects.Graphics }[] = [];
  flutter: { x: number; y: number; vx: number; vy: number; rot: number; life: number; g: Phaser.GameObjects.Rectangle }[] = [];
  shards: { x: number; y: number; vx: number; vy: number; life: number; g: Phaser.GameObjects.Rectangle }[] = [];
  lightDip = 0;
  dipRect: Phaser.GameObjects.Rectangle | null = null;
  inkBar!: Phaser.GameObjects.Graphics;
  inkTxt!: Phaser.GameObjects.Text;
  carryG!: Phaser.GameObjects.Container;
  paintG!: Phaser.GameObjects.Graphics;
  tellG!: Phaser.GameObjects.Graphics;
  throwBtn: Phaser.GameObjects.Container | null = null;
  tuneUi: Phaser.GameObjects.Container | null = null;
  showTune = false;
  codeGlow = false; // READ held → peelable words glow harder
  stats = { kills: 0, peels: 0, throws: 0, beams: 0, crashes: 0, blocks: 0, comboKills: 0, wordKills: 0, beamKills: 0, transforms: 0 };
  spawned: GBEnemy[] = [];
  usingSheets = false;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private paintTexts = new Map<string, Phaser.GameObjects.Text>();
  private paintHints = new Map<string, Phaser.GameObjects.Text>();
  private throwKey?: Phaser.Input.Keyboard.Key;

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
    this.usingSheets = s.textures.exists('noor_combo1');
    this.seedWorldPaints();
    this.rewireDummy();
    this.spawnWave();
    this.buildThrowBtn(ui);
    if (showTune) this.buildTune();
    // F = throw armed (or first) carried word — never hijacks J/TYPE
    this.throwKey = s.input.keyboard?.addKey('F');
    s.hp = this.tune.noorHp;
    s.clar?.say('Peel words from the room. Throw with F / THROW. Hold J for beam.', 3400);
  }

  destroy() {
    for (const o of this.objs) o.destroy();
    this.objs = [];
    for (const t of this.paintTexts.values()) t.destroy();
    for (const t of this.paintHints.values()) t.destroy();
    this.paintTexts.clear(); this.paintHints.clear();
  }

  // ---- setup ----
  private seedWorldPaints() {
    // 4 peelable world words near fight lanes — only surfaces with real text
    this.addPaint({ id: 'w_paper', word: 'PAPER', owner: 'world', x: 125, y: 228, style: 'print', col: '#1e2430', where: 'printer tray' });
    this.addPaint({ id: 'w_slow', word: 'SLOW', owner: 'world', x: 640, y: 545, style: 'sign', col: '#c9a227', where: 'wet-floor sign' });
    this.addPaint({ id: 'w_wet', word: 'WET', owner: 'world', x: 1088, y: 420, style: 'stencil', col: '#2a6a9a', where: 'cooler label' });
    this.addPaint({ id: 'w_glass', word: 'GLASS', owner: 'world', x: 960, y: 100, style: 'marker', col: '#6ec8e0', where: 'window etch' });
  }

  private rewireDummy() {
    const d = this.s.enemies.find(e => e.practice) as GBEnemy | undefined;
    if (!d) return;
    // No ARMORED label — a metal plate strapped on (drawn in update via body redraw)
    d.form = 'default'; d.shielded = true; // plate = armour until PAPER/GLASS
    // metal plate = shielded default form
    this.drawEnemy(d, 'dummy');
  }

  private spawnWave() {
    const sc = this.spawnGB('scribble', 780, 420);
    const rl = this.spawnGB('redline', 520, 560);
    const st = this.spawnGB('stapler', 400, 470); // near PAPER on printer (west)
    this.spawned = [sc, rl, st];
  }

  spawnGB(kind: GBKind, x: number, y: number): GBEnemy {
    const s = this.s;
    const g = s.add.container(x, y); const body = s.add.graphics(); g.add(body);
    const sh = s.add.ellipse(0, 0, kind === 'redline' ? 18 : 36, 10, 0, 0.35); g.addAt(sh, 0);
    const hp = kind === 'scribble' ? this.tune.scribbleHp : kind === 'redline' ? this.tune.redlineHp : this.tune.staplerHp;
    const flash = s.add.graphics().setDepth(-600); s.objs.push(flash);
    const e: GBEnemy = {
      kind: kind as Enemy['kind'], x, y, hp, maxHp: hp, g, body, state: 'idle', t: 0.4 + Math.random(),
      kx: 0, ky: 0, tx: x, ty: y, hx: x, hy: y, dead: false, hitBy: -1, phase: 0, flash,
      gb: kind, form: 'default', shielded: kind === 'stapler', morphT: 0,
    };
    this.drawEnemy(e, kind);
    s.enemies.push(e); this.spawned.push(e); s.objs.push(g);
    return e;
  }

  /** Code-drawn bodies that read as material — never text on the creature. */
  drawEnemy(e: GBEnemy, kind: GBKind | 'dummy') {
    const body = e.body; body.clear();
    const form = e.form ?? 'default';
    if (kind === 'dummy') {
      // metal plate strapped on the practice dummy (over the sprite image — draw a plate overlay in container)
      const plate = body;
      plate.fillStyle(0x8a95a3, 0.95).fillRoundedRect(-18, -78, 36, 28, 3);
      plate.fillStyle(0xd0d8e0, 0.7).fillTriangle(-14, -76, -4, -76, -14, -58); // specular
      plate.lineStyle(2, 0x3a4450, 1).strokeRoundedRect(-18, -78, 36, 28, 3);
      plate.lineStyle(1.5, 0x2a3038, 1).lineBetween(-10, -50, -10, -40).lineBetween(10, -50, 10, -40); // straps
      if (form === 'paper') this.drawPaperForm(plate, 0, -60, 28, 40);
      else if (form === 'glass') this.drawGlassForm(plate, 0, -60, 28, 40);
      else if (form === 'wet') this.drawWetOverlay(plate, 0, -60);
      return;
    }
    if (form === 'paper') { this.drawPaperForm(body, 0, kind === 'redline' ? -40 : -28, kind === 'stapler' ? 40 : 28, kind === 'stapler' ? 36 : 32); return; }
    if (form === 'glass') { this.drawGlassForm(body, 0, kind === 'redline' ? -40 : -28, kind === 'stapler' ? 40 : 28, kind === 'redline' ? 50 : 32); return; }

    if (kind === 'scribble') {
      // dense tangled ink ball
      const col = form === 'wet' ? 0x3a5a7a : form === 'slow' ? 0x4a4038 : 0x0c0e1e;
      body.lineStyle(3.5, col, 1);
      for (let ring = 0; ring < 5; ring++) {
        body.beginPath();
        for (let i = 0; i <= 28; i++) {
          const a = i * 0.85 + ring * 0.4, r = 8 + ring * 4 + ((i * 7 + ring * 3) % 5);
          const px = Math.cos(a) * r, py = -22 + Math.sin(a) * r * 0.72;
          if (i) body.lineTo(px, py); else body.moveTo(px, py);
        }
        body.strokePath();
      }
      body.fillStyle(col, 0.35).fillCircle(0, -22, 10);
      if (form === 'wet') this.drawWetOverlay(body, 0, -22);
      body.lineStyle(1.5, hex(C.cyan), 0.55).strokeCircle(-5, -26, 2.5).strokeCircle(5, -26, 2.5);
    } else if (kind === 'redline') {
      // glossy red pen + tip
      const matte = form === 'slow';
      const bodyCol = matte ? 0x6a3030 : 0xc0392b;
      const gloss = matte ? 0x8a5050 : 0xff8878;
      body.fillStyle(bodyCol, 1).fillRoundedRect(-7, -64, 14, 58, 4);
      if (!matte) {
        body.fillStyle(gloss, 0.55).fillRoundedRect(-5, -60, 4, 48, 2); // gloss strip
      }
      body.fillStyle(0x7a1f18, 1).fillCircle(0, -68, 8);
      body.fillStyle(0x2a1010, 1).fillEllipse(0, 0, 18, 8);
      body.fillStyle(0x1a0808, 1).fillTriangle(-3, -4, 3, -4, 0, 8); // tip
      if (form === 'wet') this.drawWetOverlay(body, 0, -40);
    } else {
      // stapler with chrome plating (specular sheen)
      body.fillStyle(0x3a4450, 1).fillRoundedRect(-22, -36, 44, 28, 4);
      body.fillStyle(0x5a6878, 1).fillRoundedRect(-18, -48, 36, 14, 3);
      if (e.shielded && form === 'default') {
        // chrome plate on the front
        body.fillStyle(0xb8c4d0, 0.95).fillRoundedRect(-28, -54, 14, 52, 3);
        body.fillStyle(0xffffff, 0.55).fillTriangle(-26, -52, -18, -52, -26, -20); // specular
        body.lineStyle(2, 0xe8f0f8, 0.9).strokeRoundedRect(-28, -54, 14, 52, 3);
      } else if (form === 'wet') {
        body.fillStyle(0x6a7a4a, 0.5).fillRoundedRect(-28, -54, 14, 52, 3); // rusted
        this.drawWetOverlay(body, -20, -30);
      } else if (form === 'slow') {
        body.fillStyle(0x6a6058, 0.8).fillRoundedRect(-26, -50, 12, 48, 3);
      }
      body.fillStyle(0x1a2028, 1).fillEllipse(0, 0, 34, 10);
    }
  }

  private drawPaperForm(body: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    body.fillStyle(0xe8e0c8, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 2);
    body.lineStyle(1, 0xb0a888, 0.9);
    for (let i = 0; i < 4; i++) body.lineBetween(x - w / 2 + 4, y - h / 2 + 6 + i * (h / 5), x + w / 2 - 4, y - h / 2 + 10 + i * (h / 5));
    body.lineStyle(1.5, 0x8a826e, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 2);
    // folded corner
    body.fillStyle(0xd0c8b0, 1).fillTriangle(x + w / 2 - 10, y - h / 2, x + w / 2, y - h / 2, x + w / 2, y - h / 2 + 10);
  }
  private drawGlassForm(body: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    body.fillStyle(0xa8d8e8, 0.35).fillRoundedRect(x - w / 2, y - h / 2, w, h, 3);
    body.lineStyle(2, 0xd0f0ff, 0.85).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 3);
    body.fillStyle(0xffffff, 0.45).fillTriangle(x - w / 2 + 2, y - h / 2 + 2, x - w / 4, y - h / 2 + 2, x - w / 2 + 2, y);
    body.lineStyle(1, 0xffffff, 0.5).lineBetween(x - 4, y - 8, x + 6, y + 6);
  }
  private drawWetOverlay(body: Phaser.GameObjects.Graphics, x: number, y: number) {
    body.fillStyle(0x4a90c0, 0.45);
    for (let i = 0; i < 5; i++) body.fillCircle(x - 10 + i * 5, y + 8 + (i % 3) * 4, 2 + (i % 2));
    body.fillStyle(0x6ab0d0, 0.5).fillEllipse(x, y + 14, 18, 6);
  }

  addPaint(p: Omit<Painted, 'shim' | 'peeled' | 'owner'> & { owner?: 'world' }): Painted {
    const full: Painted = { shim: 0, peeled: false, owner: 'world', ...p };
    this.paints.push(full);
    return full;
  }

  // ---- per frame ----
  update(dt: number) {
    const s = this.s;
    this.beamCd = Math.max(0, this.beamCd - dt);
    this.peelT = Math.max(0, this.peelT - dt);
    this.throwT = Math.max(0, this.throwT - dt);
    this.codeGlow = s.words?.codeOn ?? false;
    this.tellG.clear();
    this.drawPaints();
    this.drawInk();
    this.drawCarried();
    this.updateThrowBtn();
    this.updateProjectiles(dt);
    this.updateFX(dt);

    // F key throw
    if (this.throwKey && Phaser.Input.Keyboard.JustDown(this.throwKey) && !s.busy && !s.dying && !s.clar?.modal) {
      this.tryThrow();
    }

    for (const e of s.enemies as GBEnemy[]) {
      if (e.dead) continue;
      if (e.practice) {
        // keep metal plate drawn (image + plate graphics)
        if ((e.morphT ?? 0) > 0) { e.morphT = Math.max(0, (e.morphT ?? 0) - dt / 0.3); if (e.morphT === 0) this.drawEnemy(e, 'dummy'); }
        e.g.setPosition(e.x, e.y).setDepth(e.y);
        continue;
      }
      if (!e.gb) continue;
      if ((e.morphT ?? 0) > 0) {
        e.morphT = Math.max(0, (e.morphT ?? 0) - dt / 0.3);
        // pulse scale during morph
        const k = Math.sin((1 - (e.morphT ?? 0)) * Math.PI);
        e.g.setScale(1 + 0.12 * k, 1 - 0.08 * k);
        if (e.morphT === 0) { e.g.setScale(1); this.drawEnemy(e, e.gb); }
      }
      this.tickEnemy(e, e.gb, dt);
      // wet drip particles
      if (e.form === 'wet' && Math.random() < dt * 8) {
        const d = s.add.circle(e.x + (Math.random() - 0.5) * 16, e.y - 20, 2, 0x4a90c0, 0.8).setDepth(e.y + 1);
        s.objs.push(d);
        s.tweens.add({ targets: d, y: e.y + 8, alpha: 0, duration: 400, onComplete: () => d.destroy() });
      }
      // redline skid marks while charging
      if (e.gb === 'redline' && e.state === 'charge' && e.form !== 'paper') {
        const sk = s.add.rectangle(e.x, e.y + 2, 10, 3, e.form === 'slow' ? 0x5a3030 : 0xc0392b, 0.45).setDepth(4).setRotation(Math.atan2(e.ty, e.tx));
        s.objs.push(sk);
        s.tweens.add({ targets: sk, alpha: 0, duration: 700, onComplete: () => sk.destroy() });
      }
    }
  }

  enemyBlocked(x: number, y: number): boolean {
    for (const e of this.s.enemies as GBEnemy[]) {
      if (e.dead) continue;
      if (!e.gb && !e.practice) continue;
      const rx = e.gb === 'redline' ? 12 : e.gb === 'stapler' ? 22 : e.practice ? 26 : 18;
      const ry = e.gb === 'redline' ? 8 : 11;
      if (((x - e.x) / rx) ** 2 + ((y - e.y) / ry) ** 2 < 1) return true;
    }
    return false;
  }

  private tickEnemy(e: GBEnemy, kind: GBKind, dt: number) {
    const s = this.s;
    const spdMul = (e.form === 'slow' || e.form === 'wet' ? 0.5 : 1) * (e.slow ? 0.45 : 1);
    const dmgMul = e.form === 'wet' ? 0.5 : 1;
    void dmgMul;
    e.t -= dt; e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt);
    const dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy) || 1;
    const fl = e.flash!; fl.clear();

    if (kind === 'scribble') {
      const aggro = this.tune.scribbleAggro;
      const fast = e.hp <= e.maxHp / 2 ? 1.25 : 1;
      const wind = this.tune.scribbleLungeWind / fast * (e.form === 'slow' ? 1.4 : 1);
      if (e.state === 'idle') {
        e.g.setScale(1, 1 + 0.05 * Math.sin(s.t * 6));
        if (d < aggro) {
          if (d > 80) this.moveEnemy(e, dx / d * 95 * fast * spdMul * dt, dy / d * 95 * spdMul * dt);
          else if (e.t <= 0) { e.state = 'windup'; e.t = wind; }
        }
      } else if (e.state === 'windup') {
        e.g.setScale(1.25, 0.6);
        fl.fillStyle(hex(C.coral), 0.3).fillEllipse(e.x + dx / d * 40, e.y + dy / d * 40, 50, 18);
        if (e.t <= 0) { e.state = 'lunge'; e.t = this.tune.scribbleLungeActive; e.tx = dx / d; e.ty = dy / d; }
      } else if (e.state === 'lunge') {
        e.g.setScale(0.8, 1.2);
        this.moveEnemy(e, e.tx * 560 * fast * spdMul * dt, e.ty * 560 * fast * spdMul * dt);
        if (d < 32) { s.hurtNoor('lunge'); e.state = 'recover'; e.t = 0.6; }
        else if (e.t <= 0) { e.state = 'stuck'; e.t = this.tune.scribbleStuck; }
      } else if (e.state === 'stuck') {
        e.g.setScale(1.1, 0.9);
        fl.lineStyle(1, hex(C.cyan), 0.5).strokeCircle(e.x, e.y - 20, 26);
        if (e.t <= 0) { e.state = 'idle'; e.t = 0.4; }
      } else if (e.t <= 0) { e.state = 'idle'; e.t = 0.5; }
    }

    if (kind === 'redline') {
      const aggro = this.tune.redlineAggro;
      if (e.state === 'idle') {
        if (d < aggro && e.t <= 0) { e.state = 'scrape'; e.t = this.tune.redlineScrape / spdMul; e.tx = dx / d; e.ty = dy / d; }
        else if (d < aggro) this.moveEnemy(e, -dy / d * 40 * spdMul * dt, dx / d * 40 * spdMul * dt);
      } else if (e.state === 'scrape') {
        const L = 280;
        fl.lineStyle(4, e.form === 'slow' ? 0x886040 : 0xff4040, 0.7).lineBetween(e.x, e.y, e.x + e.tx * L, e.y + e.ty * L);
        fl.fillStyle(0xff4040, 0.2).fillCircle(e.x, e.y, 16);
        if (e.t <= 0) { e.state = 'charge'; e.t = 1.6; }
      } else if (e.state === 'charge') {
        const sp = this.tune.redlineChargeSpd * spdMul;
        const step = sp * dt;
        const nx = e.x + e.tx * step, ny = e.y + e.ty * step;
        if (this.hitsProp(nx, ny)) {
          e.state = 'stun'; e.t = this.tune.redlineStun; this.stats.crashes++;
          s.hitStopT = 0.1; s.cameras.main.shake(150, 0.008); sfx('hit');
          s.clar?.say('Desk crash — stunned', 1200);
        } else {
          e.x = nx; e.y = ny;
          if (Math.hypot(s.x - e.x, s.y - e.y) < 28) { s.hurtNoor('charge'); e.state = 'recover'; e.t = 0.5; }
          else if (e.t <= 0 || e.x < 40 || e.x > 1240 || e.y < 80 || e.y > 680) { e.state = 'recover'; e.t = 0.45; }
        }
      } else if (e.state === 'stun') {
        fl.lineStyle(2, hex(C.lamp), 0.8);
        for (let i = 0; i < 3; i++) fl.strokeCircle(e.x + Math.cos(s.t * 8 + i) * 18, e.y - 50 + Math.sin(s.t * 6 + i) * 6, 3);
        e.g.setRotation(Math.sin(s.t * 20) * 0.15);
        if (e.t <= 0) { e.state = 'idle'; e.t = 0.8; e.g.setRotation(0); }
      } else { e.g.setRotation(0); if (e.t <= 0) { e.state = 'idle'; e.t = 0.6; } }
    }

    if (kind === 'stapler') {
      const aggro = this.tune.staplerAggro;
      const face = Math.atan2(dy, dx);
      if (e.state === 'idle' || e.state === 'guard') {
        e.state = 'guard';
        e.faceX = Math.cos(face); e.faceY = Math.sin(face);
        if (d < aggro) this.moveEnemy(e, dx / d * 55 * spdMul * dt, dy / d * 55 * spdMul * dt);
        if (e.shielded && e.form === 'default') {
          fl.fillStyle(0x9eb0c0, 0.15); fl.beginPath(); fl.moveTo(e.x, e.y); fl.arc(e.x, e.y, 50, face - 0.9, face + 0.9, false); fl.closePath(); fl.fillPath();
          fl.lineStyle(2, 0x9eb0c0, 0.7); fl.beginPath(); fl.arc(e.x, e.y, 50, face - 0.9, face + 0.9, false); fl.strokePath();
        }
        if (d > 40 && d < 65 && e.t <= 0) { e.state = 'snapwind'; e.t = this.tune.staplerSnapWind / spdMul; }
      } else if (e.state === 'snapwind') {
        fl.fillStyle(hex(C.lamp), 0.35).fillCircle(e.x + Math.cos(face) * 30, e.y + Math.sin(face) * 30, 18);
        e.g.setRotation(-0.2);
        if (e.t <= 0) { e.state = 'snap'; e.t = this.tune.staplerSnapActive; e.tx = Math.cos(face); e.ty = Math.sin(face); }
      } else if (e.state === 'snap') {
        this.moveEnemy(e, e.tx * 220 * spdMul * dt, e.ty * 220 * spdMul * dt);
        e.g.setRotation(0.35);
        if (Math.hypot(s.x - e.x, s.y - e.y) < 36) s.hurtNoor('snap');
        if (e.t <= 0) { e.state = 'snaprecover'; e.t = this.tune.staplerSnapRecover; }
      } else if (e.state === 'snaprecover') {
        e.g.setRotation(0.15);
        fl.lineStyle(1, hex(C.cyan), 0.5).strokeCircle(e.x, e.y - 20, 30);
        if (e.t <= 0) { e.state = 'guard'; e.t = 0.5; e.g.setRotation(0); }
      } else if (e.state === 'stun' && e.t <= 0) { e.state = 'guard'; e.t = 0.3; }
    }

    e.g.setPosition(e.x, e.y).setDepth(e.y);
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
    for (const p of O11_PROPS) if (inPoly(p.poly, x, y)) return true;
    return false;
  }
  private hitsEnemy(x: number, y: number, self: Enemy): boolean {
    for (const e of this.s.enemies) if (e !== self && !e.dead && Math.hypot(e.x - x, e.y - y) < 28) return true;
    return false;
  }

  // ---- peel / throw ----
  /** Facing-cone peel: only WORLD paints, strongest score wins (fixes ambiguity). */
  nearestPaint(r = 64): Painted | null {
    const s = this.s; const v = s.dirVec();
    let best: Painted | null = null, bestScore = -1e9;
    for (const p of this.paints) {
      if (p.peeled || p.owner !== 'world') continue;
      const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
      if (d > r) continue;
      const dot = (dx * v.x + dy * v.y) / d;
      // adjacent labels (< 40 px) always peelable; farther ones need a facing cone
      if (d > 40 && dot < 0.2) continue;
      const score = (d <= 40 ? 2 : dot * 2) - d / r;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  }

  tryPeel(): boolean {
    if (this.peelT > 0 || this.mode) return false;
    const p = this.nearestPaint(70);
    if (!p) return false;
    const cost = this.freePeel ? 0 : this.tune.inkPeel;
    if (this.ink < cost) { this.s.clar?.say('Not enough ink', 1200); return true; }
    this.ink -= cost; this.freePeel = false;
    this.peelT = 0.55; this.mode = 'peel'; this.stats.peels++;
    if (this.usingSheets) this.s.noor.play(`noor_peel_${this.s.dir}`, true);
    this.s.time.delayedCall(380, () => {
      if (p.peeled) return;
      p.peeled = true; p.ghost = p.word;
      if (this.carried.length >= 2) {
        // drop oldest as floor ghost pickup
        const dropped = this.carried.shift()!;
        const ghost = this.addPaint({ id: 'drop_' + Date.now(), word: dropped, x: this.s.x, y: this.s.y + 8, style: 'print', col: '#445', where: 'dropped' });
        this.s.time.delayedCall(8000, () => { ghost.peeled = true; });
        if (this.armed !== null) this.armed = Math.max(0, this.armed - 1);
      }
      this.carried.push(p.word);
      this.s.clar?.say(`Peeled ${p.word}`, 1400);
      this.s.markTut('o11peel');
      sfx('swap');
      logSwap(this.s.save, { placed: '', removed: p.word, room: 'office', plate: p.id, t: Date.now() });
      this.mode = '';
    });
    return true;
  }

  /** Arm a carried word by index (tap glyph). Next F / THROW throws it. Attack stays combo/beam. */
  armCarry(i: number) {
    if (i < 0 || i >= this.carried.length) { this.armed = null; return; }
    this.armed = this.armed === i ? null : i;
    this.s.clar?.say(this.armed !== null ? `${this.carried[this.armed]} armed — F / THROW` : 'Disarmed', 1200);
  }

  tryThrow(): boolean {
    if (!this.carried.length || this.throwT > 0) return false;
    const idx = this.armed ?? 0;
    const word = this.carried[idx];
    if (!word) return false;
    this.throwT = 0.52; this.mode = 'throw'; this.stats.throws++;
    if (this.usingSheets) this.s.noor.play(`noor_throw_${this.s.dir}`, true);
    const tgt = this.s.aimTarget(220);
    const v = tgt
      ? (() => { const dx = tgt.x - this.s.x, dy = tgt.y - this.s.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; })()
      : this.s.dirVec();
    this.s.dir = DIRS[(Math.round(Math.atan2(v.y, v.x) / (Math.PI / 4)) + 8) % 8];
    this.s.time.delayedCall(280, () => {
      this.carried.splice(idx, 1);
      this.armed = null;
      const g = this.s.add.text(this.s.x + v.x * 18, this.s.y - 54 + v.y * 8, word, {
        fontFamily: 'JetBrains Mono', fontSize: '15px', fontStyle: 'bold', color: '#04121a', backgroundColor: C.cyan, padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(3600);
      this.s.objs.push(g);
      this.projectiles.push({ word, x: g.x, y: g.y, vx: v.x * 420, vy: v.y * 420, life: 0.7, g });
      this.mode = '';
    });
    return true;
  }

  /** Attack must NOT auto-throw. Only F / THROW / armed+throw btn. */
  preferThrow(): boolean { return false; }

  private updateProjectiles(dt: number) {
    for (const p of [...this.projectiles]) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.g.setPosition(p.x, p.y);
      let hit = false;
      for (const e of this.s.enemies as GBEnemy[]) {
        if (e.dead) continue;
        const cy = e.practice ? e.y - 60 : e.y - 30;
        if (Math.hypot(e.x - p.x, cy - p.y) < 36) { this.applyWord(e, p.word); hit = true; break; }
      }
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
          const drop = this.addPaint({ id: 'drop_' + Date.now(), word: p.word, x: p.x, y: p.y, style: 'print', col: '#333', where: 'dropped' });
          this.s.time.delayedCall(8000, () => { drop.peeled = true; });
        }
      }
    }
  }

  applyWord(e: GBEnemy, word: WorldWord) {
    const s = this.s;
    s.hitStopT = Math.max(s.hitStopT, 0.04);
    const kind: GBKind | 'dummy' = e.gb ?? (e.practice ? 'dummy' : 'scribble');
    const splash = s.add.circle(e.x, e.y - 40, 8, hex(C.cyan), 0.9).setDepth(e.y + 3);
    s.objs.push(splash); s.tweens.add({ targets: splash, scale: 3.2, alpha: 0, duration: 260, onComplete: () => splash.destroy() });
    // ink splat flecks
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 22;
      const fleck = s.add.circle(e.x, e.y - 36, 2 + Math.random() * 2, hex(C.cyan), 0.9).setDepth(e.y + 4);
      s.objs.push(fleck);
      s.tweens.add({ targets: fleck, x: e.x + Math.cos(a) * r, y: e.y - 36 + Math.sin(a) * r * 0.7, alpha: 0, duration: 280, onComplete: () => fleck.destroy() });
    }
    sfx('swap');

    const formMap: Record<WorldWord, Form> = { PAPER: 'paper', WET: 'wet', SLOW: 'slow', GLASS: 'glass' };
    const next = formMap[word];
    e.morphFrom = e.form ?? 'default';
    e.form = next;
    e.morphT = 1;
    this.stats.transforms++;
    this.stats.wordKills++; // counted as word interaction; kill tracked separately

    // mechanical effects
    if (word === 'PAPER') {
      e.shielded = false;
      e.hp = Math.min(e.hp, 1);
      s.clar?.say('PAPER — flimsy. One hit left.', 1600);
    } else if (word === 'WET') {
      e.wet = true;
      if (kind === 'stapler') e.shielded = true; // still has plating but softened in onHurt
      s.clar?.say('WET — ink runs. Slower, weaker.', 1600);
    } else if (word === 'SLOW') {
      e.slow = true;
      s.clar?.say('SLOW — dried out. Telegraphs crawl.', 1600);
    } else if (word === 'GLASS') {
      e.shielded = false;
      (e as GBEnemy & { brittle?: boolean }).brittle = true;
      s.clar?.say('GLASS — brittle. Next hit shatters.', 1600);
    }

    // redraw toward new form immediately (morph animation scales on top)
    this.drawEnemy(e, kind);
    const info = TRANSFORM[word][kind];
    logSwap(s.save, { placed: word, removed: kind, room: 'office', plate: 'combat', t: Date.now() });
    void info;
  }

  onHurt(e: Enemy, dmg: number, _kx: number, _ky: number): { dmg: number; blocked?: boolean } | null {
    const ge = e as GBEnemy;
    if (!ge.gb && !ge.practice) return null;

    // brittle glass: next hit kills
    if ((ge as GBEnemy & { brittle?: boolean }).brittle && dmg > 0) {
      this.shatter(ge);
      return { dmg: Math.max(dmg, ge.hp) };
    }

    if (ge.gb === 'stapler' && ge.shielded && ge.form === 'default') {
      const faceX = ge.faceX ?? 1, faceY = ge.faceY ?? 0;
      const side = faceX * (this.s.x - ge.x) + faceY * (this.s.y - ge.y);
      if (side > 0) {
        this.stats.blocks++;
        this.s.tweens.add({ targets: ge.g, alpha: 0.6, duration: 50, yoyo: true });
        this.s.clar?.say('Blocked', 600);
        return { dmg: 0, blocked: true };
      }
      dmg *= 1.5;
    } else if (ge.gb === 'stapler' && ge.form === 'wet' && ge.shielded) {
      // softened shield: half damage through
      const faceX = ge.faceX ?? 1, faceY = ge.faceY ?? 0;
      const side = faceX * (this.s.x - ge.x) + faceY * (this.s.y - ge.y);
      if (side > 0) { dmg *= 0.5; this.stats.blocks++; }
    }

    // practice dummy plate blocks until transformed
    if (ge.practice && ge.shielded && ge.form === 'default') {
      this.stats.blocks++;
      this.s.tweens.add({ targets: ge.g, alpha: 0.7, duration: 50, yoyo: true });
      return { dmg: 0, blocked: true };
    }

    if (ge.form === 'paper') dmg = Math.max(dmg, ge.hp); // crumple
    return { dmg };
  }

  private shatter(e: GBEnemy) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 120;
      const g = this.s.add.rectangle(e.x, e.y - 30, 4 + Math.random() * 5, 3, 0xc8e8f8, 0.95).setDepth(e.y + 5).setRotation(Math.random() * 4);
      this.s.objs.push(g);
      this.shards.push({ x: e.x, y: e.y - 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.5 + Math.random() * 0.3, g });
    }
    this.s.cameras.main.shake(120, 0.008);
    this.s.clar?.say('Shattered', 1000);
  }

  onKill(e: Enemy, via: 'combo' | 'beam' | 'word' | 'other') {
    if (via === 'combo') this.stats.comboKills++;
    if (via === 'beam') this.stats.beamKills++;
    this.stats.kills++;
  }
  onComboHit(hit: number) {
    this.ink = Math.min(this.tune.inkMax, this.ink + (this.tune.inkHit[hit - 1] ?? 8));
  }

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
    this.lightDip = 0.55; this.spawnFlutter(x0, y0, v, L); this.spawnScorch(x0, y0, v, L);
    const hit = s.enemies.filter(e => {
      if (e.dead) return false;
      const t = Phaser.Math.Clamp(((e.x - s.x) * v.x + (e.y - s.y) * v.y) / L, 0, 1);
      return Math.hypot(e.x - (s.x + v.x * L * t), e.y - (s.y + v.y * L * t)) < 36;
    });
    s.beamHits += hit.length;
    for (const e of hit) {
      const ge = e as GBEnemy;
      if (ge.gb === 'stapler' && ge.shielded && ge.form === 'default') {
        const side = (ge.faceX ?? 1) * (s.x - ge.x) + (ge.faceY ?? 0) * (s.y - ge.y);
        if (side > 0) { this.stats.blocks++; s.clar?.say('Shield blocked the beam', 1000); continue; }
      }
      const preDead = e.dead;
      s.hurtEnemy(e, this.tune.beamDmg, v.x * 360, v.y * 360, true);
      if (!preDead && e.dead) this.onKill(e, 'beam');
      if (e.practice && s.clar) { s.markTut('o11beam'); s.clar.beamHits++; }
    }
    if (hit.length) { s.hitStopT = 0.07; s.noor.anims.pause(); s.cameras.main.shake(160, 0.01); }
    const glow = s.add.graphics().setDepth(y0 + 3).setBlendMode(Phaser.BlendModes.ADD); s.objs.push(glow);
    glow.lineStyle(22, hex(C.cyan), 0.2).lineBetween(x0, y0, x0 + v.x * L, y0 + v.y * L);
    glow.lineStyle(6, 0xffffff, 0.85).lineBetween(x0, y0, x0 + v.x * L, y0 + v.y * L);
    s.tweens.add({ targets: glow, alpha: 0, duration: 420, delay: 120, onComplete: () => glow.destroy() });
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
    this.scorch.push({ x: x0, y: y0, a: 1, g });
  }
  private updateFX(dt: number) {
    if (this.lightDip > 0) { this.lightDip = Math.max(0, this.lightDip - dt); this.dipRect?.setAlpha(0.35 * (this.lightDip / 0.55)); }
    else this.dipRect?.setAlpha(0);
    for (const f of [...this.flutter]) {
      f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 180 * dt;
      f.g.setPosition(f.x, f.y).setRotation(f.g.rotation + f.rot * dt).setAlpha(Math.max(0, f.life));
      if (f.life <= 0) { f.g.destroy(); this.flutter.splice(this.flutter.indexOf(f), 1); }
    }
    for (const sc of [...this.scorch]) {
      sc.a -= dt / 1.2; sc.g.setAlpha(Math.max(0, sc.a));
      if (sc.a <= 0) { sc.g.destroy(); this.scorch.splice(this.scorch.indexOf(sc), 1); }
    }
    for (const sh of [...this.shards]) {
      sh.life -= dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.vy += 220 * dt;
      sh.g.setPosition(sh.x, sh.y).setAlpha(Math.max(0, sh.life * 2));
      if (sh.life <= 0) { sh.g.destroy(); this.shards.splice(this.shards.indexOf(sh), 1); }
    }
  }

  // ---- draw ----
  private drawPaints() {
    const g = this.paintG; g.clear();
    const near = this.nearestPaint(70);
    const glowBoost = this.codeGlow ? 1.4 : 1;
    for (const p of this.paints) {
      if (p.peeled && p.ghost) {
        const w = p.ghost.length * 8;
        g.fillStyle(0xffffff, 0.06).fillRoundedRect(p.x - w / 2, p.y - 8, w, 16, 3);
        continue;
      }
      if (p.peeled) continue;
      const hot = near === p;
      if (hot) p.shim += 0.02; else p.shim *= 0.9;
      const w = Math.max(52, p.word.length * 10);
      const a = (hot ? 0.7 : 0.4) * glowBoost;
      g.fillStyle(0x04101a, Math.min(0.92, a)).fillRoundedRect(p.x - w / 2 - 4, p.y - 12, w + 8, 24, 4);
      if (hot || this.codeGlow) {
        g.lineStyle(2, hex(C.cyan), (0.55 + 0.35 * Math.sin(p.shim * 8)) * glowBoost)
          .strokeRoundedRect(p.x - w / 2 - 4, p.y - 12, w + 8, 24, 4);
        // shimmer
        g.fillStyle(0xffffff, 0.14).fillRect(p.x - w / 2 + ((p.shim * 50) % w), p.y - 12, 12, 24);
      } else {
        g.lineStyle(1, hex(C.cyan), 0.35).strokeRoundedRect(p.x - w / 2 - 4, p.y - 12, w + 8, 24, 4);
      }
    }
    this.ensurePaintTexts(near);
  }

  private ensurePaintTexts(near: Painted | null) {
    const live = new Set<string>();
    for (const p of this.paints) {
      if (p.peeled && !p.ghost) continue;
      live.add(p.id);
      let t = this.paintTexts.get(p.id);
      if (!t) {
        t = this.s.add.text(p.x, p.y, p.word, { fontFamily: 'JetBrains Mono', fontSize: '14px', fontStyle: 'bold', color: p.col }).setOrigin(0.5).setDepth(3510);
        this.s.objs.push(t); this.paintTexts.set(p.id, t);
      }
      let h = this.paintHints.get(p.id);
      if (!h) {
        h = this.s.add.text(p.x, p.y + 14, p.where, { fontFamily: FONT, fontSize: '10px', color: C.dim }).setOrigin(0.5).setDepth(3509);
        this.s.objs.push(h); this.paintHints.set(p.id, h);
      }
      if (p.peeled && p.ghost) {
        t.setText(p.ghost).setAlpha(0.18).setPosition(p.x, p.y);
        h.setAlpha(0);
      } else {
        t.setText(p.word).setColor(near === p || this.codeGlow ? C.cyan : p.col).setAlpha(1).setPosition(p.x, p.y);
        h.setText(p.where).setAlpha(near === p ? 0.85 : 0.35).setPosition(p.x, p.y + 14);
      }
    }
    for (const [id, t] of this.paintTexts) if (!live.has(id)) { t.destroy(); this.paintTexts.delete(id); }
    for (const [id, t] of this.paintHints) if (!live.has(id)) { t.destroy(); this.paintHints.delete(id); }
  }

  private drawInk() {
    const g = this.inkBar; g.clear();
    const x = 20, y = 54, w = 160, h = 12;
    g.fillStyle(0x050c12, 0.85).fillRoundedRect(x, y, w, h, 4);
    g.fillStyle(hex(C.cyan), 0.85).fillRoundedRect(x, y, w * (this.ink / this.tune.inkMax), h, 4);
    g.lineStyle(1, hex(C.cyan), 0.7).strokeRoundedRect(x, y, w, h, 4);
    this.inkTxt.setText(`ink ${Math.round(this.ink)}/${this.tune.inkMax}` + (this.beamCd > 0 ? `  beam ${this.beamCd.toFixed(1)}s` : '') + (this.armed !== null ? `  · ${this.carried[this.armed]} armed` : ''));
  }

  private drawCarried() {
    this.carryG.removeAll(true);
    const s = this.s;
    // fixed UI strip near TYPE button so taps are reliable (not world-orbit only)
    this.carried.forEach((w, i) => {
      const an = s.t * 1.6 + i * Math.PI;
      const hx = s.x, hy = s.y - 58;
      const ox = Math.cos(an) * 26, oy = Math.sin(an) * 9 - 8;
      const sc = s.toScreen(hx + ox, hy + oy);
      const armed = this.armed === i;
      const t = s.add.text(sc.x, sc.y, w, {
        fontFamily: 'JetBrains Mono', fontSize: armed ? '13px' : '12px', fontStyle: 'bold',
        color: armed ? '#04121a' : C.cyan,
        backgroundColor: armed ? C.lamp : 'rgba(4,16,20,0.85)',
        padding: { x: 5, y: 3 },
      }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });
      if (armed) t.setShadow(0, 0, C.lamp, 8, false, true);
      t.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev?.stopPropagation(); this.armCarry(i);
      });
      this.carryG.add(t);
    });
  }

  private buildThrowBtn(ui: <T extends Phaser.GameObjects.GameObject>(o: T) => T) {
    const s = this.s;
    const c = ui(s.add.container(1182, 620).setDepth(4305));
    const bg = s.add.circle(0, 0, 34, 0x04101a, 0.7).setStrokeStyle(2, hex(C.lamp), 0.9).setInteractive({ useHandCursor: true });
    const lab = s.add.text(0, 0, 'THROW\nF', { fontFamily: FONT, fontSize: '11px', color: C.lamp, align: 'center' }).setOrigin(0.5);
    bg.on('pointerdown', () => this.tryThrow());
    c.add([bg, lab]);
    this.throwBtn = c;
  }
  private updateThrowBtn() {
    if (!this.throwBtn) return;
    const on = this.carried.length > 0 && !this.s.busy;
    this.throwBtn.setAlpha(on ? 1 : 0.25);
  }

  handleInteract(): boolean {
    if (this.nearestPaint(70)) return this.tryPeel();
    return false;
  }

  private buildTune() {
    const s = this.s;
    const c = s.add.container(1000, 80).setScrollFactor(0).setDepth(4500);
    s.objs.push(c); this.objs.push(c); this.tuneUi = c;
    c.add(s.add.rectangle(0, 0, 260, 200, 0x050c12, 0.92).setOrigin(0).setStrokeStyle(1, hex(C.cyan), 0.6));
    c.add(s.add.text(12, 10, 'TUNE — world words only', { fontFamily: FONT, fontSize: '13px', color: C.cyan }));
    c.add(s.add.text(12, 40, 'E peel world word\nF / THROW to throw\nTap carried glyph to arm\nHold J = beam\nREAD = glow labels', { fontFamily: FONT, fontSize: '12px', color: C.inkBright }));
  }

  state() {
    const enemyText = this.s.enemies.some(e => {
      // any text object parented under enemy container?
      const ge = e as GBEnemy;
      return !!(ge.gb && false);
    });
    void enemyText;
    return {
      ink: this.ink, carried: [...this.carried], armed: this.armed, beamCd: this.beamCd,
      paints: this.paints.map(p => ({ id: p.id, word: p.word, peeled: !!p.peeled, owner: p.owner, x: p.x, y: p.y, where: p.where })),
      enemies: (this.s.enemies as GBEnemy[]).filter(e => e.gb || e.practice).map(e => ({
        kind: e.gb ?? (e.practice ? 'dummy' : e.kind),
        x: e.x, y: e.y, hp: e.hp, dead: e.dead, state: e.state,
        form: e.form ?? 'default', shielded: !!e.shielded, slow: !!e.slow, wet: !!e.wet,
        brittle: !!(e as GBEnemy & { brittle?: boolean }).brittle,
        hasTextLabel: false,
      })),
      stats: { ...this.stats },
      tune: { ...this.tune },
      usingSheets: this.usingSheets,
      lightDip: this.lightDip, scorch: this.scorch.length, flutter: this.flutter.length,
      worldWordsOnly: true,
      transform: TRANSFORM,
    };
  }
}
