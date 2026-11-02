// Locked hybrid word system (2 Nov 2026):
//   normal view  = subtitle CAPTIONS (screenplay line about the nearest 1-2 objects, swappable words are chips),
//   hold READ    = full CODE VISION (teal wireframe plate + one code line per object, swap between any lines),
//   lens secrets = a hidden line that only shows inside a small lens around Noor while READ is held nearby.
import Phaser from 'phaser';
import tokens from './tokens.json';
import type { GameScene } from './game';
import type { Plate } from './plate';
import { writeSave } from './save';

const C = tokens.color;
const hex = (s: string) => parseInt(s.slice(1), 16);
export const BAR_Y = 626;                       // caption bar top (screen space, 1280x720)
const CAP_R = 210;                              // caption subjects: plates whose reach point is this close
const TYPE_CPS = 70;                            // typewriter speed
const D = 4100;                                 // caption depth (above world, under touch buttons 5000)
const DC = 2300;                                // code view depth (above world/fg, under HUD)
interface Chip { plate: Plate; r: Phaser.Geom.Rectangle; zone: Phaser.GameObjects.Zone; where: 'cap' | 'code'; t?: Phaser.GameObjects.Text }

export class WordUI {
  bar: Phaser.GameObjects.Graphics;
  heading: Phaser.GameObjects.Text;
  lineObjs: Phaser.GameObjects.GameObject[] = [];
  chips: Chip[] = [];
  segs: { t: Phaser.GameObjects.Text; from: number; full: string }[] = [];
  chipG: Phaser.GameObjects.Graphics;
  key = ''; typeC = 0; total = 0;
  override: { id: string; text: string; until: number } | null = null;
  subjects: Plate[] = [];
  hl: Phaser.GameObjects.Image[] = [];
  dragging: { plate: Plate; moved: boolean } | null = null;
  // code view
  held = 0; codeA = 0; codeOn = false;
  codeImg: Phaser.GameObjects.Image | null = null; codeBk: Phaser.GameObjects.Rectangle | null = null;
  ghost: Phaser.GameObjects.Sprite | null = null; codeG: Phaser.GameObjects.Graphics | null = null;
  codeObjs: Phaser.GameObjects.GameObject[] = []; codeKey = ''; noorLine: Phaser.GameObjects.Text | null = null;
  codeLines: { plate: Plate; objs: Phaser.GameObjects.Text[]; w: number }[] = [];
  // lens
  lensTex: Phaser.Textures.CanvasTexture | null = null; lensImg: Phaser.GameObjects.Image | null = null; lensRim: Phaser.GameObjects.Graphics | null = null;
  secretText: Phaser.GameObjects.Text | null = null; secret: Plate | null = null; revealT = 0; lensA = 0;
  lens = { x: 0, y: 0, r: 130 };

  constructor(private s: GameScene) {
    const sc = s;
    sc.input.dragDistanceThreshold = 8;
    this.bar = sc.add.graphics().setScrollFactor(0).setDepth(D);
    this.bar.fillGradientStyle(0x02060a, 0x02060a, 0x02060a, 0x02060a, 0.0, 0.0, 0.92, 0.92).fillRect(0, BAR_Y - 26, 1280, 26);
    this.bar.fillStyle(0x02060a, 0.92).fillRect(0, BAR_Y, 1280, 720 - BAR_Y);
    this.bar.lineStyle(1, hex(C.faint), 0.55).lineBetween(420, BAR_Y + 4, 860, BAR_Y + 4);
    this.heading = sc.add.text(640, BAR_Y + 16, '', { fontFamily: 'JetBrains Mono', fontSize: '13px', fontStyle: 'bold', color: C.dim, letterSpacing: 2 } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1);
    this.chipG = sc.add.graphics().setScrollFactor(0).setDepth(D + 1);
    for (let i = 0; i < 2; i++) this.hl.push(sc.add.image(0, 0, 'pool').setBlendMode(Phaser.BlendModes.ADD).setDepth(2050).setAlpha(0));
  }

  /** called from buildRoom after the plates exist */
  resetRoom() {
    const s = this.s; this.key = ''; this.codeKey = ''; this.override = null; this.secret = null; this.revealT = 0; this.held = 0; this.codeA = 0; this.codeOn = false; this.lensA = 0;
    this.clearLine(); this.clearCode();
    this.heading.setText(s.room.heading);
    // code view layers (room objects: destroyed by clearRoom via s.objs)
    this.codeBk = s.add.rectangle(0, 0, 1280, 720, 0x02080c, 1).setOrigin(0).setDepth(DC - 1).setAlpha(0); s.objs.push(this.codeBk);
    this.codeImg = s.add.image(0, 0, '__WHITE').setOrigin(0).setDepth(DC).setAlpha(0); s.objs.push(this.codeImg);
    this.codeG = s.add.graphics().setDepth(DC + 6); s.objs.push(this.codeG);
    this.ghost = s.add.sprite(0, 0, 'noor_idle').setOrigin(96 / 192, 160 / 192).setDepth(DC + 5).setTint(hex(C.cyan)).setTintMode(Phaser.TintModes.HARD_LIGHT).setAlpha(0); s.objs.push(this.ghost);
    this.noorLine = s.add.text(0, 0, '', { fontFamily: 'JetBrains Mono', fontSize: '14px', fontStyle: 'bold', color: C.coral }).setOrigin(0.5, 0).setDepth(DC + 8).setAlpha(0); s.objs.push(this.noorLine);
    this.noorLine.setText('noor.shadow = null;');
    if (!s.textures.exists('lensdark')) this.lensTex = s.textures.createCanvas('lensdark', 1280, 720); else this.lensTex = s.textures.get('lensdark') as Phaser.Textures.CanvasTexture;
    this.lensImg = s.add.image(0, 0, 'lensdark').setOrigin(0).setDepth(DC + 20).setAlpha(0); s.objs.push(this.lensImg);
    this.lensRim = s.add.graphics().setDepth(DC + 22); s.objs.push(this.lensRim);
    this.secretText = s.add.text(0, 0, '', { fontFamily: 'JetBrains Mono', fontSize: '17px', fontStyle: 'bold', color: C.fern, backgroundColor: 'rgba(20,6,22,0.8)', padding: { x: 8, y: 4 } }).setOrigin(0.5).setDepth(DC + 21).setAlpha(0); s.objs.push(this.secretText);
  }

  codeState() {
    const s = this.s, f = s.flags, id = s.room.id;
    return id === 'corridor' ? (f.lit ? 'lit' : 'dark') : id === 'archive' ? (f.drained ? 'L' : 'H') : 'base';
  }
  /** lore read / secret found: show its text as the caption for a moment */
  showLore(p: Plate, text: string) { this.override = { id: p.def.id, text, until: this.s.t + 3.2 }; this.key = ''; }

  // ---------------- chips (shared by caption + code lines) ----------------
  private makeChip(plate: Plate, r: Phaser.Geom.Rectangle, where: 'cap' | 'code', world: boolean, t?: Phaser.GameObjects.Text) {
    const s = this.s;
    const z = s.add.zone(r.centerX, r.centerY, r.width + 10, r.height + 10).setDepth(where === 'cap' ? D + 3 : DC + 12).setInteractive({ draggable: true, useHandCursor: true });
    if (!world) z.setScrollFactor(0);
    z.on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev?.stopPropagation(); s.ctl.uiPointer = p.id; this.dragging = { plate, moved: false }; });
    z.on('pointerup', () => { if (this.dragging && !this.dragging.moved) this.tap(plate); this.dragging = null; s.ctl.uiPointer = null; });
    z.on('dragstart', () => { if (!this.dragging) this.dragging = { plate, moved: true }; this.dragging.moved = true; if (s.hand?.from !== plate.def.id) { if (s.hand) s.hand = null; s.read(plate); } });
    z.on('drag', (p: Phaser.Input.Pointer) => { s.hud.hand.setPosition(p.x, p.y - 30); });
    z.on('dragend', (p: Phaser.Input.Pointer) => { s.ctl.uiPointer = null; this.dragging = null; this.dropAt(p.x, p.y); s.hud.hand.setPosition(640, BAR_Y - 32); });
    const c: Chip = { plate, r, zone: z, where, t }; this.chips.push(c); return c;
  }
  tap(plate: Plate) {
    const s = this.s; s.markTut('tapchip');
    if (s.hand && s.hand.from !== plate.def.id) { s.swap(s.hand.from, plate.def.id); return; }
    if (s.hand && s.hand.from === plate.def.id) { s.hand = null; plate.setOpts({ ...plate.opts, selected: false }); return; }
    s.read(plate);
  }
  /** drop the carried word at a screen point: caption chips, then code-line values, then the world object */
  dropAt(x: number, y: number) {
    const s = this.s; if (!s.hand) return false;
    for (const c of this.chips) {
      if (c.plate.def.id === s.hand.from || !c.zone.active) continue;
      const r = new Phaser.Geom.Rectangle(c.r.x - 14, c.r.y - 14, c.r.width + 28, c.r.height + 28);
      if (r.contains(x, y)) return s.swap(s.hand.from, c.plate.def.id);
    }
    return s.dropHand(x, y);
  }
  chipPositions() { return this.chips.filter(c => c.zone.active).map(c => ({ id: c.plate.def.id, word: c.plate.slotWord, where: c.where, x: c.r.centerX, y: c.r.centerY })); }

  // ---------------- caption ----------------
  private clearLine() {
    for (const o of this.lineObjs) o.destroy(); this.lineObjs = []; this.segs = [];
    for (const c of this.chips.filter(c => c.where === 'cap')) c.zone.destroy();
    this.chips = this.chips.filter(c => c.where !== 'cap'); this.chipG.clear();
  }
  private pickSubjects() {
    const s = this.s;
    const ps = s.plates.filter(p => p.visible && p.def.kind !== 'secret' && Math.hypot(p.def.x - s.x, p.def.y - s.y) < CAP_R)
      .sort((a, b) => Math.hypot(a.def.x - s.x, a.def.y - s.y) - Math.hypot(b.def.x - s.x, b.def.y - s.y));
    return ps.slice(0, 2);
  }
  private buildLine() {
    const s = this.s; this.clearLine();
    const rows: { p: Plate; size: number; y: number; col: string; quote?: string }[] = [];
    const ov = this.override && this.override.until > s.t ? this.override : null;
    if (ov) { const p = s.plateById(ov.id); if (p) { rows.push({ p, size: 23, y: BAR_Y + 46, col: C.inkBright }); const norm = (t: string) => t.toLowerCase().replace(/[^a-z ]/g, '').trim(); if (ov.text && !norm(p.def.cap ?? '').includes(norm(ov.text))) rows.push({ p, size: 19, y: BAR_Y + 76, col: C.lamp, quote: ov.text }); } }
    else this.subjects.forEach((p, i) => rows.push({ p, size: i === 0 ? 23 : 19, y: BAR_Y + 46 + i * 30, col: i === 0 ? C.inkBright : C.dim }));
    let from = 0;
    for (const row of rows) {
      const parts: { str: string; chip?: Plate; red?: boolean }[] = [];
      if (row.quote) parts.push({ str: `\u201C${row.quote.charAt(0)}${row.quote.slice(1).toLowerCase()}\u201D` });
      else { const c = row.p.caption(true); parts.push({ str: c.pre }); if (c.word) parts.push({ str: c.word, chip: c.chip ? row.p : undefined, red: c.red }); if (c.post) parts.push({ str: c.post }); }
      const ts = parts.map(pt => {
        const chip = !!pt.chip;
        const t = s.add.text(0, row.y, pt.str, { fontFamily: chip ? 'JetBrains Mono' : 'IBM Plex Mono', fontSize: `${row.size}px`, fontStyle: chip ? 'bold' : row.size > 20 ? '500' : 'normal', color: pt.red ? C.faint : chip ? C.state : row.col }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 2);
        this.lineObjs.push(t); return { t, chip: pt.chip, pad: chip ? 8 : 0 };
      });
      const W = ts.reduce((a, b) => a + b.t.width + b.pad * 2, 0); let x = 640 - W / 2;
      for (const q of ts) {
        x += q.pad; q.t.setX(Math.round(x)); const w = q.t.width;
        this.segs.push({ t: q.t, from, full: q.t.text }); from += q.t.text.length; q.t.setText('');
        if (q.chip) this.makeChip(q.chip, new Phaser.Geom.Rectangle(x - 6, row.y - row.size * 0.72, w + 12, row.size * 1.44), 'cap', false, q.t);
        x += w + q.pad;
      }
    }
    this.total = from; this.typeC = 0;
  }
  private drawChips() {
    const s = this.s; const g = this.chipG; g.clear();
    for (const c of this.chips) {
      if (c.where !== 'cap') continue;
      const held = s.hand?.from === c.plate.def.id; const near = s.hand && !held;
      const t = c.t; const shown = !!t && !!c.plate.slotWord && t.text.length === c.plate.slotWord.length;
      if (!shown) continue;
      if (held) { g.fillStyle(hex(C.cyan), 1).fillRoundedRect(c.r.x, c.r.y, c.r.width, c.r.height, 5); t!.setColor('#04121a'); }
      else { t!.setColor(near ? C.inkBright : C.state); g.fillStyle(0x0a2a2e, 0.9).fillRoundedRect(c.r.x, c.r.y, c.r.width, c.r.height, 5); g.lineStyle(near ? 2 : 1.5, near ? hex(C.cyan) : hex(C.state), near ? 0.6 + 0.4 * Math.sin(s.t * 8) : 0.7).strokeRoundedRect(c.r.x, c.r.y, c.r.width, c.r.height, 5); }
      // dotted underline = "this word can change"
      g.fillStyle(hex(held ? '#04121a' : C.state), 0.9); for (let dx = 6; dx < c.r.width - 6; dx += 7) g.fillRect(c.r.x + dx, c.r.bottom - 5, 3, 1.5);
    }
  }

  update(dt: number, readHeld: boolean) {
    const s = this.s;
    const hide = s.busy && !!s.composer;
    const vis = !s.composer && !s.paused;
    this.bar.setVisible(vis).setAlpha(s.y > BAR_Y - 40 ? 0.6 : 1); this.heading.setVisible(vis); this.chipG.setVisible(vis);
    // subjects + highlight
    this.subjects = this.pickSubjects();
    if (this.override) { const p = s.plateById(this.override.id); if (!p || this.override.until < s.t || Math.hypot(p.def.x - s.x, p.def.y - s.y) > CAP_R + 40) this.override = null; }
    for (const p of s.plates) p.setFocus(this.subjects[0] === p || (s.hand?.from !== p.def.id && this.subjects.includes(p) && p.def.slot >= 0 && !!s.hand));
    const ov = this.override && this.override.until > s.t ? this.override.id + this.override.text : '';
    const key = vis ? `${ov}|${this.subjects.map(p => p.def.id + ':' + p.words.join(' ') + ':' + p.visible).join(',')}` : 'hidden';
    if (key !== this.key) { this.key = key; if (vis) this.buildLine(); else this.clearLine(); }
    for (const o of this.lineObjs) (o as Phaser.GameObjects.Text).setVisible(vis && !hide);
    if (this.typeC < this.total) {
      this.typeC = Math.min(this.total, this.typeC + TYPE_CPS * dt);
      const c = Math.floor(this.typeC);
      for (const q of this.segs) q.t.setText(q.full.slice(0, Math.max(0, c - q.from)));
    }
    this.drawChips();
    this.hl.forEach((im, i) => {
      const p = this.subjects[i];
      if (!p || this.codeA > 0.5) { im.setAlpha(Math.max(0, im.alpha - dt * 4)); return; }
      const col = p.glowT > 0 ? p.glowCol : p.def.slot >= 0 ? C.state : C.lamp;
      im.setPosition(p.container.x, p.container.y).setTint(hex(col)).setScale(i === 0 ? 1.05 : 0.8, i === 0 ? 0.8 : 0.6)
        .setAlpha((i === 0 ? 0.22 : 0.1) + (p.glowT > 0 ? 0.3 : 0) + 0.05 * Math.sin(s.t * 3));
    });
    for (const p of s.plates) p.glowT = Math.max(0, p.glowT - dt);
    this.updateCode(dt, readHeld);
  }

  // ---------------- code view ----------------
  private clearCode() {
    for (const o of this.codeObjs) o.destroy(); this.codeObjs = []; this.codeLines = [];
    for (const c of this.chips.filter(c => c.where === 'code')) c.zone.destroy();
    this.chips = this.chips.filter(c => c.where !== 'code');
  }
  private buildCode() {
    const s = this.s; this.clearCode();
    const ps = s.plates.filter(p => p.visible && p.def.kind !== 'secret');
    const placed: Phaser.Geom.Rectangle[] = [];
    for (const p of ps.sort((a, b) => a.container.y - b.container.y)) {
      const L = p.codeLine();
      const mk = (str: string, col: string) => { const t = s.add.text(0, 0, str, { fontFamily: 'JetBrains Mono', fontSize: '15px', fontStyle: 'bold', color: col }).setOrigin(0, 0.5).setDepth(DC + 10); this.codeObjs.push(t); return t; };
      const valCol = p.def.redact ? C.coral : L.chip ? C.state : C.noun;
      const objs = [mk(L.lhs, C.ink), mk(L.val, valCol), mk(';', C.dim)];
      const w = objs.reduce((a, t) => a + t.width, 0) + 12;
      let cx = Phaser.Math.Clamp(p.container.x, w / 2 + 10, 1270 - w / 2), cy = Phaser.Math.Clamp(p.container.y, 70, BAR_Y - 40);
      let r = new Phaser.Geom.Rectangle(cx - w / 2 - 6, cy - 13, w + 12, 26);
      for (let k = 0; k < 8 && placed.some(q => Phaser.Geom.Intersects.RectangleToRectangle(q, r)); k++) { cy += 28; r = new Phaser.Geom.Rectangle(cx - w / 2 - 6, cy - 13, w + 12, 26); }
      placed.push(r);
      const bg = s.add.rectangle(r.centerX, r.centerY, r.width, r.height, 0x021014, 0.82).setStrokeStyle(1, hex(C.faint), 0.9).setDepth(DC + 9); this.codeObjs.push(bg);
      let x = cx - w / 2 + 6; for (const t of objs) { t.setPosition(x, cy); x += t.width; }
      if (L.chip) this.makeChip(p, new Phaser.Geom.Rectangle(objs[1].x - 4, cy - 12, objs[1].width + 8, 24), 'code', true);
      this.codeLines.push({ plate: p, objs, w });
    }
  }
  private updateCode(dt: number, readHeld: boolean) {
    const s = this.s; if (!this.codeImg) return;
    const can = !s.busy && !s.dying && !s.paused && !s.composer;
    this.held = readHeld && can ? this.held + dt : 0;
    const want = this.held > 0.25;
    if (want && !this.codeOn) s.markTut('holdread');
    this.codeOn = want;
    this.codeA = Phaser.Math.Clamp(this.codeA + (want ? dt * 7 : -dt * 6), 0, 1);
    const a = this.codeA; const on = a > 0.01;
    const key = on ? `${this.codeState()}|${s.plates.map(p => p.words.join(' ') + p.visible + (s.hand?.from === p.def.id)).join(',')}` : '';
    if (key !== this.codeKey) { this.codeKey = key; if (on) { const k = `code_${s.room.id}_${this.codeState()}`; if (s.textures.exists(k)) this.codeImg.setTexture(k); this.buildCode(); } else this.clearCode(); }
    this.codeBk!.setAlpha(a * 0.9); this.codeImg.setAlpha(a);
    const fightA = s.fight ? 0.8 : 1;   // in combat the world shows through a little (REWRITE slow-mo still applies)
    this.codeBk!.setAlpha(a * 0.9 * fightA); this.codeImg.setAlpha(a * fightA);
    s.shadow.setVisible(a < 0.5);
    this.ghost!.setAlpha(a * 0.95).setPosition(s.noor.x, s.noor.y).setTexture(s.noor.texture.key, s.noor.frame.name);
    this.noorLine!.setAlpha(a).setPosition(Math.round(s.x), Math.round(Math.min(s.y + 10, BAR_Y - 48)));
    for (const l of this.codeLines) {
      const held = s.hand?.from === l.plate.def.id;
      for (const t of l.objs) t.setAlpha(a);
      l.objs[1].setBackgroundColor(held ? C.cyan : 'transparent').setColor(held ? '#04121a' : l.plate.def.redact ? C.coral : l.plate.def.slot >= 0 ? C.state : C.noun);
      if (l.plate.def.id === 'r_guard') { const x = Phaser.Math.Clamp(l.plate.container.x, l.w / 2 + 10, 1270 - l.w / 2) - l.w / 2 + 6; let xx = x; for (const t of l.objs) { t.setPosition(xx, l.plate.container.y); xx += t.width; } const c = this.chips.find(c => c.plate === l.plate && c.where === 'code'); if (c) { c.r.setPosition(l.objs[1].x - 4, l.plate.container.y - 12); c.zone.setPosition(c.r.centerX, c.r.centerY); } }
    }
    for (const o of this.codeObjs) if (o instanceof Phaser.GameObjects.Rectangle) o.setAlpha(a);
    const g = this.codeG!; g.clear();
    if (on) {
      // enemies as wireframes + hp lines
      for (const e of s.enemies) { if (e.dead) continue; g.lineStyle(1.5, hex(C.coral), 0.8 * a).strokeEllipse(e.x, e.y - 30, 70, 80); g.lineStyle(1, hex(C.coral), 0.4 * a).lineBetween(e.x - 40, e.y, e.x + 40, e.y); }
      // leader dots from each line to its object
      for (const l of this.codeLines) { g.fillStyle(hex(C.cyan), a * 0.9).fillCircle(l.plate.container.x, l.plate.container.y + 18, 2.5); }
    }
    this.updateLens(dt, on);
  }

  // ---------------- lens secrets ----------------
  private updateLens(dt: number, on: boolean) {
    const s = this.s;
    const sec = on ? s.plates.filter(p => p.def.kind === 'secret' && p.visible && Math.hypot(p.def.x - s.x, p.def.y - s.y) < 260)[0] ?? null : null;
    this.secret = sec;
    this.lensA = Phaser.Math.Clamp(this.lensA + (sec ? dt * 5 : -dt * 5), 0, 1);
    const la = this.lensA * this.codeA;
    const v = s.dirVec(); const tx = s.x + v.x * 60, ty = s.y - 40 + v.y * 40;
    this.lens.x += (tx - this.lens.x) * Math.min(1, dt * 10); this.lens.y += (ty - this.lens.y) * Math.min(1, dt * 10);
    if (la < 0.01) { this.lensImg!.setAlpha(0); this.lensRim!.clear(); this.secretText!.setAlpha(0); this.revealT = 0; if (!sec) { this.lens.x = tx; this.lens.y = ty; } return; }
    const L = this.lens, r = L.r;
    const ctx = this.lensTex!.getContext(); ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, 1280, 720);
    ctx.fillStyle = 'rgba(0,3,6,0.66)'; ctx.fillRect(0, 0, 1280, 720);
    ctx.globalCompositeOperation = 'destination-out';
    const gr = ctx.createRadialGradient(L.x, L.y, r * 0.8, L.x, L.y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(L.x, L.y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    this.lensTex!.refresh(); this.lensImg!.setAlpha(la);
    const g = this.lensRim!; g.clear();
    g.lineStyle(10, hex(C.cyan), 0.12 * la).strokeCircle(L.x, L.y, r + 3);
    g.lineStyle(3, hex(C.cyan), 0.95 * la).strokeCircle(L.x, L.y, r);
    for (let k = 0; k < 3; k++) { const a0 = s.t * (1.4 + k * 0.5) + k * 2.1; g.lineStyle(2, hex(k === 1 ? C.fern : C.inkBright), 0.8 * la).beginPath(); g.arc(L.x, L.y, r + 8 + k * 3, a0, a0 + 0.5 + 0.2 * k); g.strokePath(); }
    for (let k = 0; k < 4; k++) { const a0 = k * Math.PI / 2 + s.t * 0.3; g.lineStyle(2, hex(C.cyan), 0.7 * la).lineBetween(L.x + Math.cos(a0) * (r - 10), L.y + Math.sin(a0) * (r - 10), L.x + Math.cos(a0) * (r + 2), L.y + Math.sin(a0) * (r + 2)); }
    if (sec) {
      const L2 = sec.codeLine(); this.secretText!.setText(`${L2.lhs}${L2.val};`).setPosition(sec.container.x, sec.container.y);
      const d = Math.hypot(sec.container.x - L.x, sec.container.y - L.y);
      const cov = Phaser.Math.Clamp(1 - (d - r * 0.45) / (r * 0.55), 0, 1);
      this.secretText!.setAlpha(cov * la).setScale(1 + 0.03 * Math.sin(s.t * 20) * (1 - cov));
      this.revealT = cov > 0.8 ? this.revealT + dt : 0;
      const tag = 'secret:' + sec.def.id;
      if (this.revealT > 0.45 && !s.save.tutorials.includes(tag)) {
        s.save.tutorials.push(tag); writeSave(s.save); s.sfxSwap();
        this.showLore(sec, sec.def.text ?? '');
        s.say('fern', sec.def.id === 'h_fern' ? "You found me. Don't tell the Draft." : "That wall isn't true. Not yet.", 2400);
      }
    } else this.secretText!.setAlpha(0);
  }
  secretsFound() { return this.s.save.tutorials.filter(t => t.startsWith('secret:')).map(t => t.slice(7)); }
}
