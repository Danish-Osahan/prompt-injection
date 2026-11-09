// art-v11 CLARITY office (approved mock-clarity/, 2 Nov 2026). Office only, old near-overhead angle (v8 plate).
//  - world camera CONTAINS the full 1280×720 room in the HUD band (no top/bottom furniture crop; small side pillars OK)
//  - inspect = a framed close-up CARD over the dimmed room (rendered close-up still, slow push, the one lore line)
//  - minimal text: nothing at the bottom while walking; ONE caption line on interaction (shrinks to fit, never wraps)
//  - objective bar driven by the room's real progress; the swappable word is a tag ON the object (+ attached picker)
//  - real collision: per-prop floor footprints from the Blender layout (office11.py), a foot ellipse for Noor,
//    depth-sorted overlays cut from the plate; ?debug=collision draws them
import Phaser from 'phaser';
import tokens from './tokens.json';
import type { GameScene } from './game';
import type { Plate, PlateDef } from './plate';
import { BAR_Y } from './words';
import { O11_PROPS, O11_DOOR, O11_DUMMY } from './office11art';
import { OFFICE8C } from './office8art';
import { recomputeGrowth, writeSave, logSwap } from './save';
import { sfx } from './sfx';

const C = tokens.color; const hex = (s: string) => parseInt(s.slice(1), 16);
export const TOP = 48;                       // objective bar height (screen px)
const D = 4200;                              // UI depth
const FONT = 'IBM Plex Mono';
type Box = [number, number, number, number];
interface Inter { box: Box; tag?: [number, number]; main?: boolean; close?: string | ((s: GameScene) => string); head?: string }
// plate-space boxes (from the footprint overlay, art/render/rooms11) + where each word tag sits on its object
const INTER: Record<string, Inter> = {
  o_door: { box: [150, 80, 112, 120], tag: [205, 142], main: true, head: 'the lift door is' },
  o_rain: { box: [760, 72, 400, 118], tag: [960, 92], head: 'the rain feels', close: s => s.plateById('o_rain')?.slotWord === 'HAPPY' ? 'rain_happy' : 'rain' },
  o_lamp: { box: [1168, 372, 36, 104], tag: [1186, 388], head: 'the lamp feels' },
  o_photo: { box: [242, 566, 42, 26], tag: [263, 560], head: 'the photo lies', close: s => s.plateById('o_photo')?.slotWord === 'UP' ? 'photo_up' : 'photo' },
  o_phone: { box: [146, 306, 40, 26], tag: [166, 300], head: 'your phone lies', close: 'phone' },
  o_coffee: { box: [210, 538, 46, 34], close: 'coffee' },
  o_dez: { box: [344, 360, 112, 78] },
  o_kabir: { box: [632, 240, 106, 62], close: 'kabir' },
  o_monitor: { box: [940, 428, 98, 58], close: 'monitor' },
  o_calendar: { box: [280, 92, 40, 48] },
  o_sticky: { box: [658, 98, 44, 32], close: 'whiteboard' },
  o_printer: { box: [92, 196, 66, 52] },
  o_line: { box: [1088, 590, 42, 26] },
};
export const DOOR_DEF: PlateDef = { id: 'o_door', words: ['DOOR', 'IS', 'SHUT'], slot: 2, x: 205, y: 226, sx: 205, sy: 142, kind: 'rule', cap: 'The lift door is {}.', code: 'lift.door' };
const LIFT = { x: 165, y: 150, w: 80, h: 56 };           // walkable inside the open lift; the exit trigger is its back half
const FOOT = { rx: 13, ry: 5 };
const inPoly = (P: number[][], x: number, y: number) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [x1, y1] = P[i], [x2, y2] = P[j]; if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-9) + x1) c = !c; } return c; };

interface Tag { id: string; c: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; t: Phaser.GameObjects.Text; w: number; main: boolean }

export class Clarity {
  modal: '' | 'card' | 'picker' = '';
  objective!: Phaser.GameObjects.Container; objT!: Phaser.GameObjects.Text; objIcon!: Phaser.GameObjects.Text; objBg!: Phaser.GameObjects.Graphics;
  cap!: Phaser.GameObjects.Text; capMsg: { text: string; until: number } | null = null; capNow = ''; capSize = 24;
  heading!: Phaser.GameObjects.Text; headT = 0;
  glow!: Phaser.GameObjects.Graphics; pointer!: Phaser.GameObjects.Text;
  tags: Tag[] = [];
  picker: Phaser.GameObjects.Container | null = null; pickFor: Plate | null = null; pickAlt = ''; pickHot = 0;
  card: Phaser.GameObjects.Container | null = null; cardDim: Phaser.GameObjects.Rectangle | null = null; cardImg: Phaser.GameObjects.Image | null = null; cardT = 0; cardFor = ''; cardBase = { w: 0, h: 0, cw: 0, ch: 0, cx: 0, cy: 0 }; cardClosing = false;
  door!: Phaser.GameObjects.Image; doorK = 0; doorWant = 0;
  dummy: { x: number; y: number } | null = null; comboHits = 0; beamHits = 0;
  debugG: Phaser.GameObjects.Graphics | null = null; near: string | null = null;
  objs: Phaser.GameObjects.GameObject[] = [];
  constructor(private s: GameScene) {
    // Contain the full 1280×720 room in the HUD band (no top/bottom crop through furniture).
    s.fitRoomCamera(TOP, BAR_Y);
    const ui = <T extends Phaser.GameObjects.GameObject>(o: T) => { (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0); s.objs.push(o); return o; };
    // depth-sorted overlays (exact plate pixels) + the lift door
    for (const p of O11_PROPS) if (p.fg) s.objs.push(s.add.image(p.x!, p.y!, 'o11fg_' + p.name).setOrigin(0).setDepth(p.baseY));
    this.door = s.add.image(O11_DOOR.x, O11_DOOR.y, 'o11door_0').setOrigin(0).setDepth(-999.4); s.objs.push(this.door);
    // objective bar
    this.objBg = ui(s.add.graphics().setDepth(D)); this.objIcon = ui(s.add.text(0, 24, '\u25C6', { fontFamily: FONT, fontSize: '17px', color: C.cyan }).setOrigin(0.5).setDepth(D + 1));
    this.objT = ui(s.add.text(0, 25, '', { fontFamily: FONT, fontSize: '19px', fontStyle: '500', color: C.inkBright }).setOrigin(0, 0.5).setDepth(D + 1));
    this.objective = ui(s.add.container(0, 0, [this.objBg, this.objIcon, this.objT]).setDepth(D));
    // the one caption line
    this.cap = ui(s.add.text(640, BAR_Y + 47, '', { fontFamily: FONT, fontSize: '24px', fontStyle: '500', color: C.inkBright }).setOrigin(0.5).setDepth(D + 2));
    this.heading = ui(s.add.text(640, TOP + (BAR_Y - TOP) * 0.46, s.room.heading, { fontFamily: 'JetBrains Mono', fontSize: '22px', fontStyle: 'bold', color: C.inkBright, letterSpacing: 2, backgroundColor: 'rgba(4,10,16,0.55)', padding: { x: 14, y: 8 } } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setDepth(D + 3).setAlpha(0));
    this.glow = ui(s.add.graphics().setDepth(D - 5));
    this.pointer = ui(s.add.text(0, 0, '\u25BC', { fontFamily: FONT, fontSize: '20px', color: C.cyan }).setOrigin(0.5, 1).setDepth(D + 4).setVisible(false));
    this.pointer.setShadow(0, 0, C.cyan, 10, false, true);
    for (const id of Object.keys(INTER)) if (INTER[id].tag) this.makeTag(id);
    if (s.debugCollision) this.debugG = s.add.graphics().setDepth(5000);
    if (this.debugG) s.objs.push(this.debugG);
  }
  /** after plates + evaluate: the dummy, first-visit captions */
  start() {
    const s = this.s, e = s.spawnEnemy('dummy', O11_DUMMY.x, O11_DUMMY.y); e.practice = true; e.body.clear();
    const im = s.add.image(0, 0, 'o11_dummy'); im.setOrigin(O11_DUMMY.ox / im.width, O11_DUMMY.oy / im.height); e.g.add(im); this.dummy = { x: O11_DUMMY.x, y: O11_DUMMY.y };
    this.headT = 0.001;
  }
  get doorOpen() { return this.s.plateById('o_door')?.slotWord === 'OPEN'; }
  destroy() { /* objects live in s.objs */ }

  // ---------- word tags ----------
  private makeTag(id: string) {
    const s = this.s, main = !!INTER[id].main;
    const bg = s.add.graphics(); const t = s.add.text(0, 1, '', { fontFamily: 'JetBrains Mono', fontSize: main ? '17px' : '13px', fontStyle: 'bold', color: C.cyan }).setOrigin(0.5);
    const c = s.add.container(0, 0, [bg, t]).setScrollFactor(0).setDepth(D - 2); s.objs.push(c);
    c.setSize(80, 30).setInteractive({ useHandCursor: true });
    c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev?.stopPropagation(); this.openPicker(id); });
    this.tags.push({ id, c, bg, t, w: 80, main });
  }
  private drawTags() {
    const s = this.s, first = !s.save.tutorials.includes('o11door');
    // Impact Lab: no word tags over gameplay (story/dialogue only)
    if (s.impactLab?.on) {
      for (const g of this.tags) g.c.setVisible(false);
      this.pointer.setVisible(false);
      return;
    }
    for (const g of this.tags) {
      const p = s.plateById(g.id); const vis = !!p && p.visible && !this.modal && !(g.main && this.doorOpen && this.doorK > 0.98);
      g.c.setVisible(vis); if (!vis || !p) continue;
      const [tx, ty] = INTER[g.id].tag!; const sc = s.toScreen(tx, ty); const word = p.slotWord!;
      const near = this.near === g.id, pulse = 0.5 + 0.5 * Math.sin(s.t * 3.2);
      const col = g.main ? (this.doorOpen ? C.ok : C.cyan) : C.state;
      if (g.t.text !== word) g.t.setText(word);
      const w = g.t.width + (g.main ? 22 : 14), h = g.main ? 30 : 22; g.w = w;
      const a = g.main ? 1 : near ? 0.95 : 0.55;           // toys are dimmer and optional
      g.bg.clear();
      if (g.main) { const halo = (first ? 0.22 + 0.18 * pulse : 0.1 + 0.08 * pulse) * (near ? 1.4 : 1); g.bg.fillStyle(hex(col), halo).fillRoundedRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 9); }
      g.bg.fillStyle(0x04101a, 0.92).fillRoundedRect(-w / 2, -h / 2, w, h, 5).lineStyle(g.main ? 2 : 1.2, hex(col), g.main ? 0.75 + 0.25 * pulse : 0.8).strokeRoundedRect(-w / 2, -h / 2, w, h, 5);
      g.t.setColor(col); g.c.setPosition(Math.round(sc.x), Math.round(sc.y)).setAlpha(a).setSize(w + 12, h + 12);
      if (g.c.input) { g.c.input.hitArea.setTo(0, 0, w + 12, h + 12); }
    }
    // first time: one soft pointer at the door's word, visible from anywhere in the room
    const d = this.tags.find(t => t.main)!; const showP = first && d.c.visible && !this.modal;
    this.pointer.setVisible(showP); if (showP) this.pointer.setPosition(d.c.x, d.c.y - 24 - 5 * Math.abs(Math.sin(s.t * 3))).setAlpha(0.75 + 0.25 * Math.sin(s.t * 3));
  }
  openPicker(id: string) {
    const s = this.s, p = s.plateById(id); if (!p || !p.visible || this.modal || s.busy || s.dying) return false;
    this.closePicker(); const def = INTER[id];
    let alt = ''; if (id === 'o_door') alt = p.slotWord === 'OPEN' ? 'SHUT' : 'OPEN';
    else { const partner = s.plates.find(q => q !== p && q.def.toy && (q.def.pair ?? '') === (p.def.pair ?? '')); alt = partner?.slotWord ?? ''; }
    if (!alt) return false;
    const [tx, ty] = def.tag!; const sc = s.toScreen(tx, ty), right = sc.x < 900;
    const W = 200, Hh = 118, bx = right ? 36 : -36 - W, by = -Hh / 2;
    const c = s.add.container(Math.round(sc.x), Math.round(Phaser.Math.Clamp(sc.y, TOP + Hh / 2 + 4, BAR_Y - Hh / 2 - 4))).setScrollFactor(0).setDepth(D + 20); s.objs.push(c);
    const g = s.add.graphics(); g.fillStyle(0x050c12, 0.96).fillRoundedRect(bx, by, W, Hh, 10).lineStyle(1.5, hex(C.cyan), 0.9).strokeRoundedRect(bx, by, W, Hh, 10);
    const ay = Phaser.Math.Clamp(sc.y - c.y, by + 12, by + Hh - 12); g.fillStyle(hex(C.cyan), 1).fillTriangle(right ? bx : bx + W, ay - 8, right ? bx - 12 : bx + W + 12, ay, right ? bx : bx + W, ay + 8);
    c.add(g); c.add(s.add.text(bx + 16, by + 20, (def.head ?? 'it is') + '\u2026', { fontFamily: FONT, fontSize: '15px', color: C.dim }).setOrigin(0, 0.5));
    const opt = (w: string, i: number, hot: boolean) => {
      const y = by + 56 + i * 38; const r = s.add.rectangle(bx + W / 2, y, W - 24, 32, hot ? hex(C.cyan) : 0xffffff, hot ? 0.16 : 0.04).setInteractive({ useHandCursor: hot });
      const t = s.add.text(bx + 28, y + 1, w, { fontFamily: 'JetBrains Mono', fontSize: '18px', fontStyle: 'bold', color: hot ? C.cyan : '#5f747a' }).setOrigin(0, 0.5);
      if (hot) t.setShadow(0, 0, C.cyan, 8, false, true);
      c.add([r, t]); if (!hot) c.add(s.add.text(bx + W - 24, y + 1, '(now)', { fontFamily: FONT, fontSize: '13px', color: '#5f747a' }).setOrigin(1, 0.5));
      r.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev?.stopPropagation(); if (hot) this.choose(); else this.closePicker(); });
    };
    opt(p.slotWord!, 0, false); opt(alt, 1, true);
    c.setAlpha(0).setScale(0.96); s.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 160, ease: 'Quad.easeOut' });
    this.picker = c; this.pickFor = p; this.pickAlt = alt; this.modal = 'picker'; sfx('swap');
    if (id === 'o_door') s.markTut('o11tap');
    return true;
  }
  closePicker() { if (this.picker) { const c = this.picker; this.s.tweens.add({ targets: c, alpha: 0, duration: 120, onComplete: () => c.destroy() }); } this.picker = null; this.pickFor = null; if (this.modal === 'picker') this.modal = ''; }
  choose() {
    const s = this.s, p = this.pickFor; if (!p) return false; const alt = this.pickAlt; this.closePicker();
    if (p.def.id === 'o_door') {
      const was = p.slotWord!; p.setSlotWord(alt); s.save.plates[p.def.id] = alt; logSwap(s.save, { placed: alt, removed: was, room: 'office', plate: p.def.id, t: Date.now() });
      sfx('swap'); s.cameras.main.flash(90, 120, 228, 232); s.setCheckpoint(p); s.evaluate(false); writeSave(s.save);
      if (alt === 'OPEN') { s.markTut('o11door'); this.say(`${was} \u2192 OPEN. The door listens.`, 2600); }
      return true;
    }
    const partner = s.plates.find(q => q !== p && q.def.toy && (q.def.pair ?? '') === (p.def.pair ?? '') && q.slotWord === alt);
    if (!partner) return false;
    s.inspectOff = true; s.read(p); s.inspectOff = false;  // picks the word up (bookkeeping), then trade it with the pair
    return s.swap(p.def.id, partner.def.id);
  }
  /** game evaluate() hook: SHUT/OPEN drives the rendered lift frames, the walkable lift and the objective */
  setDoor(open: boolean, initial: boolean) {
    this.doorWant = open ? 1 : 0; if (initial) { this.doorK = this.doorWant; this.drawDoor(); }
    this.s.extraWalk.lift = open ? LIFT : null;
  }
  private drawDoor() { const n = O11_DOOR.frames.length; const k = Math.round(this.doorK * (n - 1)); const key = 'o11door_' + k; if (this.door.texture.key !== key) this.door.setTexture(key); }

  // ---------- close-up card ----------
  openCard(p: Plate) {
    const s = this.s; if (this.modal) return false; const def = INTER[p.def.id]; if (!def) return false;
    // bookkeeping (what read() did, without the old caption / dolly / composer-on-read)
    if (p.def.kind === 'line') s.collectLine(p);
    else { s.noteLooked(p); if (p.def.kind === 'lore' && !s.save.lore.includes(p.def.id)) { s.save.lore.push(p.def.id); recomputeGrowth(s.save); } if (!p.def.toy) s.setCheckpoint(p); writeSave(s.save); }
    const cl = typeof def.close === 'function' ? def.close(s) : def.close;
    const cw = 820, ch = 461, cx = 640, cy = TOP + (BAR_Y - TOP) / 2 - 22;
    const dim = s.add.rectangle(640, 360, 1280, 720, 0x020508, 1).setScrollFactor(0).setDepth(D + 30).setAlpha(0).setInteractive(); s.objs.push(dim);
    dim.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev?.stopPropagation(); this.closeCard(); });
    const c = s.add.container(cx, cy).setScrollFactor(0).setDepth(D + 31); s.objs.push(c);
    const fr = s.add.graphics(); fr.fillStyle(0x070d12, 1).fillRoundedRect(-cw / 2 - 14, -ch / 2 - 14, cw + 28, ch + 86, 14).lineStyle(1.5, hex(C.cyan), 0.45).strokeRoundedRect(-cw / 2 - 14, -ch / 2 - 14, cw + 28, ch + 86, 14);
    c.add(fr);
    let im: Phaser.GameObjects.Image;
    if (cl && s.textures.exists('o8c_' + cl)) { im = s.add.image(0, 0, 'o8c_' + cl); this.cardBase = { w: im.width, h: im.height, cw, ch, cx: 0, cy: 0 }; }
    else {   // no rendered close-up for this object: a 16:9 crop of the plate around it (same render, nearer)
      const [bx, by, bw, bh] = def.box; const w = Math.max(240, bw * 2.4, bh * 2.4 * 16 / 9), h = w * 9 / 16; const x0 = Phaser.Math.Clamp(bx + bw / 2 - w / 2, 0, 1280 - w), y0 = Phaser.Math.Clamp(by + bh / 2 - h / 2, 0, 720 - h);
      im = s.add.image(0, 0, 'bg_office_base'); this.cardBase = { w, h, cw, ch, cx: x0 + w / 2, cy: y0 + h / 2 };
    }
    c.add(im); this.cardImg = im;
    const line = this.loreLine(p);
    const t = s.add.text(0, ch / 2 + 36, line, { fontFamily: FONT, fontSize: '23px', fontStyle: '500', color: C.inkBright }).setOrigin(0.5); this.fit(t, cw - 20, 23, 17); c.add(t);
    c.add(s.add.text(cw / 2, -ch / 2 - 30, s.ctl.last === 'touch' ? 'tap to close' : 'E  close', { fontFamily: FONT, fontSize: '14px', color: C.dim }).setOrigin(1, 0.5));
    this.card = c; this.cardDim = dim; this.cardT = 0; this.cardFor = p.def.id; this.cardClosing = false; this.modal = 'card'; this.pushCard(0);
    c.setAlpha(0).setScale(0.965); s.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 250, ease: 'Quad.easeOut' }); s.tweens.add({ targets: dim, alpha: 0.72, duration: 250 });
    return true;
  }
  loreLine(p: Plate) {
    if (p.def.kind === 'line') return '\u201C' + (p.def.line ?? '') + '\u201D';
    const c = p.caption(true); return (c.pre + c.word + c.post).replace(/\s+/g, ' ').trim();
  }
  /** the slow push inside the card: a shrinking centred crop drawn at a constant size (no mask needed) */
  private pushCard(u: number) {
    const im = this.cardImg!, b = this.cardBase, k = 1 - 0.045 * u; const w = b.w * k, h = b.h * k;
    const fx = b.cx ? b.cx - w / 2 : (im.width - w) / 2, fy = b.cy ? b.cy - h / 2 : (im.height - h) / 2;
    im.setCrop(fx, fy, w, h); const sc = Math.max(b.cw / w, b.ch / h); im.setScale(sc);
    // with a crop, the image still lays out from its full frame: shift so the crop centre sits at the card centre
    im.setOrigin(0.5).setPosition(-(fx + w / 2 - im.width / 2) * sc, -(fy + h / 2 - im.height / 2) * sc);
  }
  closeCard() {
    const s = this.s; if (!this.card || this.cardClosing) return; this.cardClosing = true; const c = this.card, dim = this.cardDim!, id = this.cardFor;
    s.tweens.add({ targets: c, alpha: 0, scale: 0.975, duration: 250, ease: 'Quad.easeIn', onComplete: () => c.destroy() }); s.tweens.add({ targets: dim, alpha: 0, duration: 250, onComplete: () => dim.destroy() });
    s.time.delayedCall(250, () => { this.card = null; this.cardDim = null; this.cardImg = null; this.cardFor = ''; if (this.modal === 'card') this.modal = ''; if (id === 'o_monitor' && !s.save.seen.includes('sc1')) s.openComposer(); });
  }
  closeAll() { if (this.modal === 'picker') this.closePicker(); else if (this.modal === 'card') this.closeCard(); }

  // ---------- input ----------
  /** E / READ: close what is open, choose in the picker, else the nearest interactable */
  interact(): boolean {
    if (this.modal === 'card') { this.closeCard(); return true; }
    if (this.modal === 'picker') { this.choose(); return true; }
    if (this.s.combat?.handleInteract()) { this.s.markTut('o11peel'); return true; }
    const p = this.nearest(); if (!p) return false;
    if (INTER[p.def.id].tag) return this.openPicker(p.def.id);
    return this.openCard(p);
  }
  nearest(r = 96): Plate | null {
    const s = this.s; let best: Plate | null = null, bd = r;
    for (const p of s.plates) { if (!p.visible || !INTER[p.def.id]) continue; const d = Math.hypot(p.def.x - s.x, p.def.y - s.y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  say(text: string, ms = 2600) { this.capMsg = { text, until: this.s.t + ms / 1000 }; }

  // ---------- collision ----------
  blocked(x: number, y: number) {
    const pts: [number, number][] = [[x, y]]; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; pts.push([x + Math.cos(a) * FOOT.rx, y + Math.sin(a) * FOOT.ry]); }
    for (const p of O11_PROPS) { const b = p.poly; if (x < Math.min(...b.map(q => q[0])) - 16 || x > Math.max(...b.map(q => q[0])) + 16 || y < Math.min(...b.map(q => q[1])) - 8 || y > p.baseY + 8) continue; if (pts.some(([u, v]) => inPoly(b, u, v))) return true; }
    for (const e of this.s.enemies) if (!e.dead && e.practice && ((x - e.x) / 26) ** 2 + ((y - e.y) / 11) ** 2 < 1) return true;
    if (this.s.combat?.enemyBlocked(x, y)) return true;
    return false;
  }

  // ---------- per frame ----------
  update(dt: number, moving: boolean) {
    const s = this.s;
    // door frames ease toward the wanted state (0.8 s)
    if (this.doorK !== this.doorWant) { this.doorK = Phaser.Math.Clamp(this.doorK + Math.sign(this.doorWant - this.doorK) * dt / 0.8, 0, 1); this.drawDoor(); }
    if (this.doorOpen && this.doorK > 0.95 && !s.transitioning && s.x > LIFT.x && s.x < LIFT.x + LIFT.w && s.y < LIFT.y + 26) s.goRoom('hub');
    this.near = this.modal ? null : this.nearest()?.def.id ?? null;
    // objective (real progress) — hidden during Impact Lab (no words over gameplay)
    if (s.impactLab?.on) {
      this.objective.setVisible(false);
    } else {
      this.objective.setVisible(true);
      const done = this.doorOpen; const ot = done ? 'Door open. Walk through' : 'Get through the door';
      if (this.objT.text !== ot) this.objT.setText(ot);
      const w = this.objT.width + 58, x0 = 640 - w / 2; this.objT.setX(x0 + 40); this.objIcon.setX(x0 + 21).setText(done ? '\u2713' : '\u25C6').setColor(done ? C.ok : C.cyan);
      this.objBg.clear().fillStyle(0x050c12, 0.9).fillRoundedRect(x0, 7, w, 34, 17).lineStyle(1.5, hex(done ? C.ok : C.cyan), 0.85).strokeRoundedRect(x0, 7, w, 34, 17);
    }
    // heading: once on entry, then gone
    if (this.headT > 0) { this.headT += dt; const t = this.headT; this.heading.setAlpha(t < 0.4 ? t / 0.4 : t < 2.4 ? 1 : Math.max(0, 1 - (t - 2.4) / 0.6)); if (t > 3.1) { this.headT = 0; this.heading.setAlpha(0); } }
    // near-glow outline on the object Noor can use
    this.glow.clear();
    if (this.near && !s.words.codeOn) { const [bx, by, bw, bh] = INTER[this.near].box; const a = s.toScreen(bx, by), b = s.toScreen(bx + bw, by + bh); const k = 0.55 + 0.3 * Math.sin(s.t * 4);
      const col = INTER[this.near].tag ? hex(C.cyan) : hex(C.lamp);
      this.glow.lineStyle(6, col, 0.12 * k).strokeRoundedRect(a.x - 6, a.y - 6, b.x - a.x + 12, b.y - a.y + 12, 9).lineStyle(1.5, col, 0.7 * k).strokeRoundedRect(a.x - 4, a.y - 4, b.x - a.x + 8, b.y - a.y + 8, 7); }
    this.drawTags();
    // card push
    if (this.card && !this.cardClosing) { this.cardT += dt; this.pushCard(Math.min(1, this.cardT / 7)); }
    this.caption(moving);
    if (this.debugG) this.drawDebug();
  }
  /** what the single caption line says right now (priority: a timed line > dummy hint > the near object > first steps > nothing) */
  private caption(moving: boolean) {
    const s = this.s, kb = s.ctl.last !== 'touch'; let t = '';
    if (s.impactLab?.on) { this.cap.setText('').setVisible(false); return; }
    this.cap.setVisible(true);
    if (this.capMsg && this.capMsg.until > s.t) t = this.capMsg.text; else this.capMsg = null;
    if (!t && this.modal === 'picker') t = kb ? `Pick ${this.pickAlt}.  E` : `Tap ${this.pickAlt}.`;
    if (!t && !this.modal && this.dummy && Math.hypot(s.x - this.dummy.x, s.y - this.dummy.y) < 170) {
      if (s.combat) {
        if (!s.save.tutorials.includes('o11peel')) t = kb ? 'E near a room label: peel PAPER / WET / SLOW / GLASS' : 'READ a room label to peel it';
        else if (!s.save.tutorials.includes('o11combo')) t = kb ? 'F / THROW to hurl a word · tap attack: combo' : 'THROW then TYPE for combo';
        else if (!s.save.tutorials.includes('o11beam')) t = kb ? 'Hold attack 0.85s, release: short beam' : 'Hold TYPE, release: short beam';
      } else {
        if (!s.save.tutorials.includes('o11combo')) t = kb ? 'Tap attack (J / click): 3-hit combo' : 'Tap TYPE: 3-hit combo';
        else if (!s.save.tutorials.includes('o11beam')) t = kb ? 'Hold attack, release: beam' : 'Hold TYPE, release: beam';
      }
    }
    if (!t && !this.modal && this.near) {
      const p = s.plateById(this.near)!;
      if (INTER[this.near].main) t = s.save.tutorials.includes('o11door') ? (kb ? `E  change ${p.slotWord}` : `Tap ${p.slotWord}`) : 'Tap the glowing word.';
      else if (INTER[this.near].tag) t = kb ? `E  change ${p.slotWord}  (optional)` : `Tap ${p.slotWord}  (optional)`;
      else t = kb ? 'E  look closer' : 'READ  look closer';
    }
    if (!t && !this.modal && s.moved < 80 && !moving && (s.save.visits.office ?? 1) <= 1) t = kb ? 'WASD to walk' : 'Drag to walk';
    if (s.busy || s.composer || this.modal === 'card') t = '';
    if (t !== this.capNow) { this.capNow = t; this.cap.setText(t); this.capSize = this.fit(this.cap, 1180, 24, 18); }
    void moving;
  }
  /** shrink a single line to fit `max` px (never wraps); returns the size used */
  fit(t: Phaser.GameObjects.Text, max: number, big: number, small: number) {
    let z = big; t.setFontSize(z); while (t.width > max && z > small) { z--; t.setFontSize(z); }
    if (t.width > max) { let s = t.text; while (t.width > max && s.length > 4) { s = s.slice(0, -2); t.setText(s + '\u2026'); } }
    return z;
  }
  private drawDebug() {
    const g = this.debugG!, s = this.s; g.clear();
    for (const r of s.room.walk) g.lineStyle(1, 0x00ff88, 0.6).strokeRect(r.x, r.y, r.w, r.h);
    for (const r of Object.values(s.extraWalk)) if (r) g.lineStyle(1, 0x00ff88, 0.9).strokeRect(r.x, r.y, r.w, r.h);
    for (const p of O11_PROPS) { g.lineStyle(2, 0xff4040, 0.9).fillStyle(0xff4040, 0.18); g.beginPath(); g.moveTo(p.poly[0][0], p.poly[0][1]); for (const q of p.poly.slice(1)) g.lineTo(q[0], q[1]); g.closePath(); g.fillPath(); g.strokePath(); g.lineStyle(1, 0xffff00, 0.5).lineBetween(p.poly[0][0], p.baseY, p.poly[0][0] + 30, p.baseY); }
    for (const e of s.enemies) if (!e.dead && e.practice) g.lineStyle(2, 0xff9040, 0.9).strokeEllipse(e.x, e.y, 52, 22);
    for (const e of s.enemies) if (!e.dead && (e as { gb?: string }).gb) g.lineStyle(2, 0xff60c0, 0.9).strokeEllipse(e.x, e.y, 40, 22);
    g.lineStyle(2, 0x40c0ff, 1).strokeEllipse(s.x, s.y, FOOT.rx * 2, FOOT.ry * 2);
  }
  state() {
    const s = this.s; const d = this.tags.find(t => t.main)!;
    return { objective: this.objT.text, done: this.doorOpen, caption: this.capNow, capW: Math.round(this.cap.width), capSize: this.capSize, capLines: this.cap.text.split('\n').length,
      modal: this.modal, card: this.cardFor, cardA: this.card ? +this.card.alpha.toFixed(2) : 0, picker: this.pickFor?.def.id ?? null, pickAlt: this.pickAlt,
      door: this.doorOpen, doorK: +this.doorK.toFixed(2), tag: { x: d.c.x, y: d.c.y, visible: d.c.visible, word: d.t.text }, pointer: this.pointer.visible,
      tags: this.tags.map(t => ({ id: t.id, x: t.c.x, y: t.c.y, visible: t.c.visible, a: +t.c.alpha.toFixed(2) })), near: this.near, heading: +this.heading.alpha.toFixed(2),
      combo: this.comboHits, beam: this.beamHits, dummy: this.dummy, props: O11_PROPS.map(p => ({ name: p.name, poly: p.poly, baseY: p.baseY })) };
  }
}
