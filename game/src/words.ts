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
  force: { id: string; text: string } | null = null;   // test hook: render this exact line (caption wrap test)
  laid: { x0: number; x1: number; y: number; size: number }[] = [];
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
    this.bar.fillStyle(0x02060a, 1).fillRect(0, BAR_Y, 1280, 720 - BAR_Y);
    this.bar.lineStyle(1, hex(C.faint), 0.55).lineBetween(420, BAR_Y + 4, 860, BAR_Y + 4);
    // art-v8 letterbox: the world is framed above the bar (see GameScene.setupCameras); thin pillars + a hairline frame
    const vw = Math.round(1280 * BAR_Y / 720), px = Math.round((1280 - vw) / 2);
    // pillars sit at the bottom of the UI camera's draw order, so the HUD text stays on top of them
    const pil = sc.add.graphics().setScrollFactor(0).setDepth(-100000);
    pil.fillStyle(0x02060a, 1).fillRect(0, 0, px, BAR_Y).fillRect(1280 - px, 0, px, BAR_Y);
    pil.lineStyle(1, hex(C.faint), 0.35).lineBetween(px, 0, px, BAR_Y).lineBetween(1280 - px, 0, 1280 - px, BAR_Y).lineBetween(px, BAR_Y, 1280 - px, BAR_Y);
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
    const v9 = !!s.vm;   // art-v9 office: the code plate is the perspective wireframe, in view space
    this.codeBk = s.add.rectangle(v9 ? -200 : 0, v9 ? -200 : 0, v9 ? 1700 : 1280, v9 ? 1200 : 720, 0x02080c, 1).setOrigin(0).setDepth(DC - 1).setAlpha(0); s.objs.push(this.codeBk);
    this.codeImg = s.add.image(v9 ? -80 : 0, v9 ? -45 : 0, '__WHITE').setOrigin(0).setDepth(DC).setAlpha(0); s.objs.push(this.codeImg);
    this.codeG = s.add.graphics().setDepth(DC + 6); s.objs.push(this.codeG);
    for (const o of [this.codeBk, this.codeImg, this.codeG, ...this.hl]) s.vs.add(o);
    // code-vision Noor: the line-art sheets (art-v8 wire8.py: same frames as her real sheets, so animation stays in sync)
    this.ghost = s.add.sprite(0, 0, s.textures.exists('noor_idle_wire') ? 'noor_idle_wire' : 'noor_idle').setOrigin(96 / 192, 160 / 192).setDepth(DC + 5).setAlpha(0); s.objs.push(this.ghost);
    if (!s.textures.exists('noor_idle_wire')) this.ghost.setTint(hex(C.cyan)).setTintMode(Phaser.TintModes.HARD_LIGHT);
    this.noorLine = s.add.text(0, 0, '', { fontFamily: 'JetBrains Mono', fontSize: '14px', fontStyle: 'bold', color: C.coral }).setOrigin(0.5, 0).setDepth(DC + 8).setAlpha(0); s.objs.push(this.noorLine);
    this.noorLine.setText('noor.shadow = null;');
    if (!s.textures.exists('lensdark')) this.lensTex = s.textures.createCanvas('lensdark', 1280, 720); else this.lensTex = s.textures.get('lensdark') as Phaser.Textures.CanvasTexture;
    this.lensImg = s.add.image(0, 0, 'lensdark').setOrigin(0).setDepth(DC + 20).setAlpha(0); s.objs.push(this.lensImg);
    this.lensRim = s.add.graphics().setDepth(DC + 22); s.objs.push(this.lensRim);
    this.secretText = s.add.text(0, 0, '', { fontFamily: 'JetBrains Mono', fontSize: '17px', fontStyle: 'bold', color: C.fern, backgroundColor: 'rgba(20,6,22,0.8)', padding: { x: 8, y: 4 } }).setOrigin(0.5).setDepth(DC + 21).setAlpha(0); s.objs.push(this.secretText);
  }

  codeState() {
    const s = this.s, f = s.flags, id = s.room.id;
    return id === 'corridor' ? (f.lit ? 'lit' : 'dark') : id === 'archive' ? (f.drained ? 'L' : 'H') : id === 'hub' ? (f.door ? 'open' : 'shut') : 'base';
  }
  /** lore read / secret found: show its text as the caption for a moment */
  showLore(p: Plate, text: string) { this.override = { id: p.def.id, text, until: this.s.t + 3.2 }; this.key = ''; }

  // ---------------- chips (shared by caption + code lines) ----------------
  private makeChip(plate: Plate, r: Phaser.Geom.Rectangle, where: 'cap' | 'code', world: boolean, t?: Phaser.GameObjects.Text) {
    const s = this.s;
    const z = s.add.zone(r.centerX, r.centerY, r.width + 10, r.height + 10).setDepth(where === 'cap' ? D + 3 : DC + 12).setInteractive({ draggable: true, useHandCursor: true });
    if (!world) z.setScrollFactor(0); else s.vs.add(z);
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
    const w = s.toWorld(x, y);   // caption chips live in screen space; code-line chips and objects in the (framed) world
    for (const c of this.chips) {
      if (c.plate.def.id === s.hand.from || !c.zone.active) continue;
      const r = new Phaser.Geom.Rectangle(c.r.x - 14, c.r.y - 14, c.r.width + 28, c.r.height + 28);
      if (c.where === 'cap' ? r.contains(x, y) : r.contains(w.x, w.y)) return s.swap(s.hand.from, c.plate.def.id);
    }
    return s.dropHand(w.x, w.y);
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
    const ps = s.plates.filter(p => p.visible && p.def.kind !== 'secret' && p.def.kind !== 'unlock' && Math.hypot(p.def.x - s.x, p.def.y - s.y) < CAP_R)
      .sort((a, b) => Math.hypot(a.def.x - s.x, a.def.y - s.y) - Math.hypot(b.def.x - s.x, b.def.y - s.y));
    return ps.slice(0, 2);
  }
  /** caption rows -> wrapped lines (global fix, art-v9): every part is split into word tokens and laid out greedily inside
   *  MAX_W; a row first tries one line (shrinking to 19px), then two lines (21 -> 16px). Two lines in total fit the bar, so a
   *  wrapped first row drops the second subject (or the quote). Never clips at the screen edges. */
  private buildLine() {
    const s = this.s; this.clearLine(); this.laid = [];
    const rows: { p: Plate; size: number; col: string; quote?: string }[] = [];
    const ov = this.override && this.override.until > s.t ? this.override : null;
    if (this.force) { const p = s.plateById(this.force.id); if (p) rows.push({ p, size: 23, col: C.inkBright, quote: this.force.text }); }
    else if (ov) { const p = s.plateById(ov.id); if (p) { rows.push({ p, size: 23, col: C.inkBright }); const norm = (t: string) => t.toLowerCase().replace(/[^a-z ]/g, '').trim(); if (ov.text && !norm(p.def.cap ?? '').includes(norm(ov.text))) rows.push({ p, size: 19, col: C.lamp, quote: ov.text }); } }
    else this.subjects.forEach((p, i) => rows.push({ p, size: i === 0 ? 23 : 19, col: i === 0 ? C.inkBright : C.dim }));
    const MAX_W = 1150;
    let from = 0, lineN = 0;
    for (const [ri, row] of rows.entries()) {
      if (lineN >= 2) break;
      const parts: { str: string; chip?: Plate; red?: boolean }[] = [];
      if (row.quote && !this.force) parts.push({ str: `\u201C${row.quote.charAt(0)}${row.quote.slice(1).toLowerCase()}\u201D` });
      else if (row.quote) parts.push({ str: row.quote });
      else { const c = row.p.caption(true); parts.push({ str: c.pre }); if (c.word) parts.push({ str: c.word, chip: c.chip ? row.p : undefined, red: c.red }); if (c.post) parts.push({ str: c.post }); }
      // tokens: words keep their trailing space; a chip is one token
      const toks: { str: string; chip?: Plate; red?: boolean }[] = [];
      for (const pt of parts) { if (pt.chip || pt.red) { toks.push(pt); continue; } for (const w of pt.str.match(/\S+\s*|\s+/g) ?? []) toks.push({ str: w }); }
      const mk = (size: number) => toks.map(tk => {
        const chip = !!tk.chip;
        const t = s.add.text(0, 0, tk.str, { fontFamily: chip ? 'JetBrains Mono' : 'IBM Plex Mono', fontSize: `${size}px`, fontStyle: chip ? 'bold' : size > 20 ? '500' : 'normal', color: tk.red ? C.faint : chip ? C.state : row.col }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 2);
        return { t, chip: tk.chip, pad: chip ? 8 : 0, w: t.width + (chip ? 16 : 0) };
      });
      const wrap = (ts: ReturnType<typeof mk>) => { const lines: (typeof ts)[] = [[]]; let w = 0; for (const q of ts) { const ww = q.w; if (w + ww > MAX_W && lines[lines.length - 1].length) { lines.push([]); w = 0; } lines[lines.length - 1].push(q); w += ww; } return lines; };
      const maxLines = Math.max(1, 2 - lineN);
      let size = row.size, ts = mk(size), lines = wrap(ts);
      while (lines.length > 1 && size > 19) { ts.forEach(q => q.t.destroy()); size -= 2; ts = mk(size); lines = wrap(ts); }
      if (lines.length > 1) { size = Math.min(row.size, 21); ts.forEach(q => q.t.destroy()); ts = mk(size); lines = wrap(ts); while (lines.length > maxLines && size > 15) { ts.forEach(q => q.t.destroy()); size -= 1; ts = mk(size); lines = wrap(ts); } }
      if (lines.length > maxLines) { for (const q of lines.slice(maxLines).flat()) q.t.destroy(); lines = lines.slice(0, maxLines); const lastL = lines[maxLines - 1], last = lastL[lastL.length - 1]; if (last) last.t.setText(last.t.text.trimEnd() + '\u2026'); }
      for (const ln of lines) {
        const y = BAR_Y + (lines.length === 2 || lineN === 1 ? (lineN === 0 ? 43 : 72) : ri === 0 ? 46 : 76);
        const tw = (q: typeof ln[number]) => q === ln[ln.length - 1] && !q.chip ? q.t.text.trimEnd().length / Math.max(1, q.t.text.length) * q.t.width : q.w;
        const W = ln.reduce((a, q) => a + tw(q), 0); let x = 640 - W / 2; const x0 = x;
        for (const q of ln) {
          this.lineObjs.push(q.t); q.t.setY(y);
          x += q.pad; q.t.setX(Math.round(x)); const w = q.t.width;
          this.segs.push({ t: q.t, from, full: q.t.text }); from += q.t.text.length; q.t.setText('');
          if (q.chip) this.makeChip(q.chip, new Phaser.Geom.Rectangle(x - 6, y - size * 0.72, w + 12, size * 1.44), 'cap', false, q.t);
          x += w + q.pad;
        }
        this.laid.push({ x0, x1: x0 + W, y, size }); lineN++;
      }
    }
    this.total = from; this.typeC = 0;
  }
  rowInfo() { return this.laid.map(l => ({ x0: Math.round(l.x0), x1: Math.round(l.x1), y: l.y, size: l.size })); }
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
    this.bar.setVisible(true); this.heading.setVisible(vis); this.chipG.setVisible(vis);
    // subjects + highlight
    this.subjects = this.pickSubjects();
    if (this.override) { const p = s.plateById(this.override.id); if (!p || this.override.until < s.t || Math.hypot(p.def.x - s.x, p.def.y - s.y) > CAP_R + 40) this.override = null; }
    for (const p of s.plates) p.setFocus(this.subjects[0] === p || (s.hand?.from !== p.def.id && this.subjects.includes(p) && p.def.slot >= 0 && !!s.hand));
    const ov = this.override && this.override.until > s.t ? this.override.id + this.override.text : '';
    const key = vis ? `${this.force ? 'F' + this.force.text : ''}${ov}|${this.subjects.map(p => p.def.id + ':' + p.words.join(' ') + ':' + p.visible).join(',')}` : 'hidden';
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
    // rules (puzzle words) always show; story objects only near Noor, so code vision reads as a discovery, not a wall of text
    const ps = s.plates.filter(p => p.visible && p.def.kind !== 'secret' && (p.def.kind === 'rule' || p.def.kind === 'fixed' || p.def.kind === 'unlock' || Math.hypot(p.def.x - s.x, p.def.y - s.y) < 380));
    const placed: Phaser.Geom.Rectangle[] = [];
    for (const p of ps.sort((a, b) => a.container.y - b.container.y)) {
      const L = p.codeLine();
      const mk = (str: string, col: string) => { const t = s.add.text(0, 0, str, { fontFamily: 'JetBrains Mono', fontSize: '15px', fontStyle: 'bold', color: col }).setOrigin(0, 0.5).setDepth(DC + 10); this.codeObjs.push(t); s.vs.add(t); return t; };
      const valCol = p.def.redact || p.def.kind === 'unlock' ? C.coral : L.chip ? C.state : C.noun;
      const objs = [mk(L.lhs, C.ink), mk(L.val, valCol), mk(';', C.dim)];
      const w = objs.reduce((a, t) => a + t.width, 0) + 12;
      const wv = s.cameras.main.worldView;   // keep every line inside what the camera shows (the art-v9 camera moves)
      let cx = Phaser.Math.Clamp(p.container.x, wv.x + w / 2 + 10, wv.right - w / 2 - 10), cy = Phaser.Math.Clamp(p.container.y, wv.y + 70, wv.bottom - 50);
      let r = new Phaser.Geom.Rectangle(cx - w / 2 - 6, cy - 13, w + 12, 26);
      for (let k = 0; k < 8 && placed.some(q => Phaser.Geom.Intersects.RectangleToRectangle(q, r)); k++) { cy += 28; r = new Phaser.Geom.Rectangle(cx - w / 2 - 6, cy - 13, w + 12, 26); }
      placed.push(r);
      const bg = s.add.rectangle(r.centerX, r.centerY, r.width, r.height, 0x021014, 0.82).setStrokeStyle(1, hex(C.faint), 0.9).setDepth(DC + 9); this.codeObjs.push(bg); s.vs.add(bg);
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
    const near = s.plates.filter(p => p.def.kind !== 'rule' && Math.hypot(p.def.x - s.x, p.def.y - s.y) < 380).map(p => p.def.id).join('');
    const key = on ? `${this.codeState()}|${near}|${s.plates.map(p => p.words.join(' ') + p.visible + (s.hand?.from === p.def.id)).join(',')}` : '';
    if (key !== this.codeKey) { this.codeKey = key; if (on) { const k = s.vm ? 'code_office9' : `code_${s.room.id}_${this.codeState()}`; if (s.textures.exists(k)) this.codeImg.setTexture(k); this.buildCode(); } else this.clearCode(); }
    this.codeBk!.setAlpha(a * 0.9); this.codeImg.setAlpha(a);
    const fightA = s.fight ? 0.8 : 1;   // in combat the world shows through a little (REWRITE slow-mo still applies)
    this.codeBk!.setAlpha(a * 0.9 * fightA); this.codeImg.setAlpha(a * fightA);
    s.shadow.setVisible(a < 0.5);
    const wk = s.noor.texture.key + '_wire';
    this.ghost!.setAlpha(a).setPosition(s.noor.x, s.noor.y).setTexture(s.textures.exists(wk) ? wk : s.noor.texture.key, s.noor.frame.name);
    s.noor.setAlpha(s.noor.alpha * (1 - a));
    this.noorLine!.setOrigin(0.5, 1).setAlpha(a).setPosition(s.x, Math.max(s.y - 158, 40));   // art-v10: above her head, clear of the prompt (below her feet) and the plates
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
      for (const e of s.enemies) { if (e.dead) continue; const q = s.vm ? s.vm.P(e.x, e.y) : e; g.lineStyle(1.5, hex(C.coral), 0.8 * a).strokeEllipse(q.x, q.y - 30, 70, 80); g.lineStyle(1, hex(C.coral), 0.4 * a).lineBetween(q.x - 40, q.y, q.x + 40, q.y); }
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
