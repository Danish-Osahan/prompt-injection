// art-v9 OFFICE test level (2 Nov 2026): a lower 30-degree perspective render with real depth layers, a directing camera,
// rendered inspect close-ups, swaps that visibly change the room, Noor reacting, and slow pressure.
// Gameplay, collision, exits and tests stay in the OLD logical floor coordinates; the office is drawn in perspective VIEW
// space (1440x810 overscan render, view = render px - (80,45)). At render time every logical-space object is moved through
// the floor homography H (and scaled by s(y)); view-space objects (layers, overlays, plate anchors, code view) are skipped.
import Phaser from 'phaser';
import tokens from './tokens.json';
import type { GameScene } from './game';
import { OFFICE9, type View9 } from './office9art';
import { BAR_Y } from './words';
import { Plate } from './plate';

const C = tokens.color;
const hex = (s: string) => parseInt(s.slice(1), 16);
type Img = Phaser.GameObjects.Image;

export class ViewMap {
  constructor(public v: View9) {}
  private h(M: number[][], x: number, y: number) { const w = M[2][0] * x + M[2][1] * y + M[2][2]; return { x: (M[0][0] * x + M[0][1] * y + M[0][2]) / w, y: (M[1][0] * x + M[1][1] * y + M[1][2]) / w }; }
  P(x: number, y: number) { return this.h(this.v.H, x, y); }
  L(x: number, y: number) { return this.h(this.v.Hinv, x, y); }
  s(x: number, y: number) { const c = this.v.scale; return c[0] + c[1] * x + c[2] * y; }
}

/** world bounds of the rendered overscan in view space */
const VB = { x0: -80, y0: -45, x1: 1360, y1: 765 };
export type CamMode = 'establish' | 'play' | 'inspect' | 'close' | 'noor';

/** The directing camera: establishing pull-back on entry, slow drift + look-ahead in play, push-in on inspect,
 *  a tight close-up on Noor for the phone beat, letterbox bars for story beats. Stays still and snappy in combat.
 *  Reduce-motion: no drift / look-ahead / zooms (cuts + bars only). */
export class DirectorCam {
  mode: CamMode = 'play'; modeT = 0; zoom: number; cx = 640; cy = 360; lb = 0; lbWant = 0;
  look = { x: 0, y: 0 }; focus: { x: number; y: number } | null = null; holdUntil = 0;
  bars: Phaser.GameObjects.Rectangle[]; title: Phaser.GameObjects.Text;
  constructor(private s: GameScene, public base: number) {
    this.zoom = base * 1.07;
    const vw = Math.round(1280 * base), px = Math.round((1280 - vw) / 2);
    this.bars = [0, 1].map(i => s.add.rectangle(px, i ? BAR_Y : 0, vw, 1, 0x000000, 1).setOrigin(0, i ? 1 : 0).setScrollFactor(0).setDepth(3960));
    this.title = s.add.text(640, BAR_Y - 30, '', { fontFamily: 'JetBrains Mono', fontSize: '15px', fontStyle: 'bold', color: C.inkBright, letterSpacing: 4 } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setScrollFactor(0).setDepth(3961).setAlpha(0);
    s.objs.push(...this.bars, this.title);
  }
  get reduce() { return !!this.s.save.settings?.reduceMotion; }
  get playZoom() { return this.base * (this.s.inCombat() ? 1.0 : 1.07); }
  set(mode: CamMode, focus: { x: number; y: number } | null = null, hold = 0) { this.mode = mode; this.modeT = 0; this.focus = focus; this.holdUntil = this.s.t + hold; }
  establish(title: string) {
    this.title.setText(title);
    if (this.reduce) { this.lb = this.lbWant = 0; this.set('play'); this.snap(); this.s.tweens.add({ targets: this.title, alpha: { from: 0, to: 1 }, duration: 300, yoyo: true, hold: 1400 }); return; }
    this.set('establish', null, 2.3); this.zoom = this.base * 0.905; this.cx = 640; this.cy = 345; this.lb = 1;
    this.s.tweens.add({ targets: this.title, alpha: { from: 0, to: 1 }, duration: 500, delay: 250 });
    this.s.tweens.add({ targets: this.title, alpha: 0, duration: 500, delay: 2000 });
  }
  snap() { const t = this.target(); this.zoom = t.z; this.cx = t.x; this.cy = t.y; }
  private target() {
    const s = this.s, n = s.vm!.P(s.x, s.y), r = this.reduce;
    let z = this.playZoom, x = n.x + (r ? 0 : this.look.x), y = n.y - 40 + (r ? 0 : this.look.y), lb = 0;
    if (this.mode === 'establish') { z = this.base * 0.905; x = 640; y = 345; lb = 1; }
    if (this.mode === 'inspect' && this.focus) { z = r ? this.playZoom : this.playZoom * 1.13; x = (n.x + this.focus.x) / 2; y = (n.y - 40 + this.focus.y) / 2; lb = 0.55; }
    if (this.mode === 'close' && this.focus) { z = r ? this.playZoom : this.playZoom * 1.2; x = this.focus.x; y = this.focus.y; lb = 1; }
    if (this.mode === 'noor') { z = r ? this.playZoom : this.base * 1.85; x = n.x; y = n.y - 70 * s.vm!.s(s.x, s.y); lb = 1; }
    if (!r && this.mode === 'play' && !s.inCombat()) { x += Math.sin(s.t * 0.21) * 5; y += Math.sin(s.t * 0.17 + 1) * 3; }
    this.lbWant = lb;
    return { z, x, y };
  }
  update(dt: number, mvx: number, mvy: number) {
    const s = this.s; this.modeT += dt;
    if (this.mode === 'establish' && s.t > this.holdUntil) this.set('play');
    if ((this.mode === 'inspect' || this.mode === 'noor') && s.t > this.holdUntil && this.holdUntil > 0) this.set('play');
    // look-ahead toward where Noor is heading (eased, never in combat)
    const la = this.reduce || s.inCombat() ? 0 : 1;
    this.look.x += (mvx * 70 * la - this.look.x) * Math.min(1, dt * 1.5); this.look.y += (mvy * 40 * la - this.look.y) * Math.min(1, dt * 1.5);
    const t = this.target();
    const k = this.reduce ? 60 : s.inCombat() ? 6 : this.mode === 'establish' ? 0.9 : this.mode === 'play' ? 1.7 : 3.2;
    const a = 1 - Math.exp(-dt * k);
    this.zoom += (t.z - this.zoom) * a; this.cx += (t.x - this.cx) * a; this.cy += (t.y - this.cy) * a;
    this.lb += (this.lbWant - this.lb) * (1 - Math.exp(-dt * (this.reduce ? 30 : 5)));
    const cam = s.cameras.main; const hw = cam.width / this.zoom / 2, hh = cam.height / this.zoom / 2;
    const cx = Phaser.Math.Clamp(this.cx, VB.x0 + hw, VB.x1 - hw), cy = Phaser.Math.Clamp(this.cy, VB.y0 + hh, VB.y1 - hh);
    cam.setZoom(this.zoom).centerOn(cx, cy);
    const h = Math.round(46 * this.lb); for (const b of this.bars) { b.height = h; b.setVisible(h > 0); }
  }
}

/** a parallax layer: f < 1 sits behind the gameplay plane, f > 1 in front (moves more, scales more) */
interface Layer { o: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite; x: number; y: number; f: number }
const CLOSE_FOR: Record<string, (s: GameScene) => string | null> = {
  o_phone: s => s.plateById('o_phone')?.slotWord === 'UP' ? 'phone' : null,
  o_kabir: () => 'kabir', o_coffee: () => 'coffee', o_sticky: () => 'whiteboard', o_rain: s => s.plateById('o_rain')?.slotWord === 'HAPPY' ? 'rain_happy' : 'rain',
  o_photo: s => s.plateById('o_photo')?.slotWord === 'UP' ? 'photo_up' : 'photo',
  o_monitor: s => s.save.seen.includes('claim9') && s.save.seen.includes('sc1') ? 'monitor' : null,
};

export class Office9 {
  vm: ViewMap; cam: DirectorCam; layers: Layer[] = []; vars: Record<string, { im: Img; layer: string }[]> = {};
  card: Phaser.GameObjects.Container; cardImg: Img; cardCode: Img; cardLine: Phaser.GameObjects.Text; cardOn: string | null = null; cardT = 0; cardPlate = '';
  cardTw: Phaser.Tweens.Tween | null = null;
  // Noor reactions
  idle9 = 0; idleK = 0; lookT = 0; reacting = '';
  // pressure
  roomT = 0; nextUnread = 50; glitchT = 14; glitchN = 0; draftT = 26; draftShown = false; glimpse: Phaser.GameObjects.Sprite | null = null; phoneGlow: Img;
  claimShown = false; rainK = 1; win = { x0: 0, x1: 0, y0: 0, y1: 0 };
  constructor(private s: GameScene) {
    const O = OFFICE9, vs = (o: Phaser.GameObjects.GameObject) => { s.vs.add(o); s.objs.push(o); return o; };
    this.vm = new ViewMap(O.view); s.vm = this.vm;
    vs(s.add.rectangle(-200, -200, 1700, 1200, 0x05090d).setOrigin(0).setDepth(-1001));
    const lay = (key: string, x: number, y: number, depth: number, f: number) => { const im = s.add.image(x, y, key).setOrigin(0).setDepth(depth); vs(im); this.layers.push({ o: im, x, y, f }); return im; };
    lay('o9_back', -80, -45, -1000, 0.95); lay('o9_mid', -80, -45, -999, 1);
    s.fgImgs = {};
    for (const l of O.fg) { const near = l.name === 'near'; const im = lay('o9fg_' + l.name, l.x, l.y, near ? 2200 : l.baseY, near ? 1.14 : 1); s.fgImgs[l.name] = im; }
    // swap variants: small rendered crops crossfaded over their layer (depth: just above the fg overlay they overlap)
    for (const v of O.var) {
      let d = v.layer === 'back' ? -999.5 : -998.9;
      // small change regions sit just above the desk overlay they belong to (so a desk never hides its own photo/monitor);
      // big lighting regions stay under every overlay (else they would cover Noor)
      if (v.w * v.h < 60000) for (const l of O.fg) { if (l.name === 'near') continue; const im = s.fgImgs[l.name]; if (v.layer === 'mid' && im && v.x < l.x + im.width && v.x + v.w > l.x && v.y < l.y + im.height && v.y + v.h > l.y) d = Math.max(d, l.baseY + 0.5); }
      const im = lay(`o9v_${v.file}`, v.x, v.y, d, v.layer === 'back' ? 0.95 : 1).setAlpha(0);
      (this.vars[v.v] ??= []).push({ im, layer: v.layer });
    }
    // ambient loops (view space)
    for (const a of O.amb) {
      const key = 'o9a_' + a.name; if (!s.textures.exists(key)) continue;
      const spr = s.add.sprite(a.x, a.y, key, 0).setOrigin(0).setDepth(a.baseY < 0 ? -998 : a.baseY); vs(spr); this.layers.push({ o: spr, x: a.x, y: a.y, f: a.baseY < 216 ? 0.95 : 1 });
      s.amb.push({ def: { key, name: a.name, state: '', file: a.file, x: a.x, y: a.y, w: a.w, h: a.h, frames: a.frames, fps: a.fps, baseY: a.baseY, mode: '' }, spr, dir: 1, speed: 1, t: Math.random() * 10, ox: a.x, oy: a.y });
    }
    // plates: anchors in view space
    for (const p of s.plates) { const a = O.view.anchors[p.def.id]; if (a) p.container.setPosition(a[0], a[1]); else { const q = this.vm.P(p.def.sx, p.def.sy); p.container.setPosition(q.x, q.y); } s.vs.add(p.container); }
    this.phoneGlow = vs(s.add.image(0, 0, 'pool').setBlendMode(Phaser.BlendModes.ADD).setTint(0x78e4e8).setAlpha(0).setScale(0.35, 0.22).setDepth(-998.5)) as Img;
    const pa = O.view.anchors.o_phone; this.phoneGlow.setPosition(pa[0], pa[1] + 12);
    // close-up card (UI camera, inside the framed world viewport)
    const vw = Math.round(1280 * s.frameZoom), px = Math.round((1280 - vw) / 2);
    this.card = s.add.container(640, BAR_Y / 2).setScrollFactor(0).setDepth(3950).setVisible(false); s.objs.push(this.card);
    this.cardImg = s.add.image(0, 0, '__WHITE'); this.cardCode = s.add.image(0, 0, '__WHITE').setAlpha(0);
    this.cardLine = s.add.text(0, BAR_Y / 2 - 96, '', { fontFamily: 'JetBrains Mono', fontSize: '22px', fontStyle: 'bold', color: C.inkBright, backgroundColor: 'rgba(2,16,20,0.85)', padding: { x: 12, y: 6 } }).setOrigin(0.5).setAlpha(0);
    this.card.add([this.cardImg, this.cardCode, this.cardLine]); this.card.setSize(vw, BAR_Y); void px;
    this.cam = new DirectorCam(s, s.frameZoom);
  }

  /** render-time parallax: each layer is placed relative to the camera centre by its depth factor */
  parallax() {
    const cam = this.s.cameras.main, c = cam.midPoint, zr = cam.zoom / (this.cam.base * 1.07);
    for (const l of this.layers) {
      if (l.f === 1) { l.o.x = l.x; l.o.y = l.y; l.o.setScale(1); continue; }
      const S = (1 + (zr - 1) * l.f) / zr, dx = (c.x - 640) * (1 - l.f), dy = (c.y - 360) * (1 - l.f);
      l.o.setScale(S); l.o.x = c.x + (l.x - c.x) * S + dx; l.o.y = c.y + (l.y - c.y) * S + dy;
    }
  }

  // ---------- inspect: push-in, then the rendered close-up card ----------
  inspect(id: string) {
    const s = this.s, a = OFFICE9.view.anchors[id]; if (!a) return;
    const name = CLOSE_FOR[id]?.(s) ?? null;
    if (!name || !s.textures.exists('o9c_' + name)) { this.cam.set('inspect', { x: a[0], y: a[1] }, 1.6); return; }
    if (id === 'o_phone' && !this.reacting) {    // the emotional beat: tight on Noor, she looks at the phone, then the card
      this.cam.set('noor', null, 1.5); this.react('phone', 1);
      s.time.delayedCall(this.cam.reduce ? 200 : 1300, () => this.openCard(name, id));
      return;
    }
    this.cam.set('inspect', { x: a[0], y: a[1] }, 0);
    s.time.delayedCall(this.cam.reduce ? 0 : 380, () => this.openCard(name, id));
  }
  openCard(name: string, id: string) {
    const s = this.s, a = OFFICE9.view.anchors[id]; if (!s.plateById(id)) return;
    this.cam.set('close', { x: a[0], y: a[1] });
    const vw = Math.round(1280 * s.frameZoom), tex = s.textures.get('o9c_' + name).getSourceImage() as HTMLImageElement;
    const sc = Math.max(vw / tex.width, BAR_Y / tex.height);
    this.cardImg.setTexture('o9c_' + name).setTint(name === 'rain_happy' ? 0xffd6a8 : 0xffffff); this.cardCode.setTexture('o9c_' + name + '_code');
    this.cardOn = name; this.cardPlate = id; this.cardT = 0;
    const L = s.plateById(id)!.codeLine(); this.cardLine.setText(`${L.lhs}${L.val};`);
    this.cardTw?.stop(); this.card.setVisible(true).setAlpha(0);
    const k = { v: 0 };
    this.cardTw = s.tweens.add({ targets: k, v: 1, duration: this.cam.reduce ? 120 : 420, ease: 'Sine.easeOut', onUpdate: () => {
      this.card.setAlpha(k.v); const z = sc * (this.cam.reduce ? 1 : 1.08 - 0.08 * k.v); this.cardImg.setScale(z); this.cardCode.setScale(z);
    } });
    const ov = s.words.override; if (ov && ov.id === id) ov.until = s.t + 6;
  }
  closeCard() {
    if (!this.cardOn) return; const s = this.s; this.cardOn = null; this.cam.set('play');
    this.cardTw?.stop(); this.cardTw = s.tweens.add({ targets: this.card, alpha: 0, duration: this.cam.reduce ? 80 : 340, onComplete: () => this.card.setVisible(false) });
  }

  // ---------- swaps visibly change the room ----------
  toys(initial: boolean) {
    const s = this.s, w = (id: string) => s.plateById(id)?.slotWord;
    const happy = w('o_rain') === 'HAPPY', flipped = w('o_photo') === 'UP';
    this.fade('toys', happy ? 1 : 0, initial ? 0 : 1600);
    this.rainK = happy ? 0.4 : 1;
    for (const a of s.amb.filter(a => a.def.name === 'rain')) { a.speed = this.rainK; a.spr.setTint(happy ? 0xffe2b0 : 0xffffff); }
    const vs = this.vars.flip ?? [];
    if (initial) for (const v of vs) v.im.setAlpha(flipped ? 1 : 0).setScale(1, 1);
    else for (const v of vs) {   // the photo / phone flip: squash closed, swap, open
      s.tweens.killTweensOf(v.im);
      const cx = v.im.x + v.im.width / 2, cy = v.im.y + v.im.height / 2; void cx;
      v.im.setOrigin(0.5).setPosition(v.im.x + v.im.width / 2, cy);
      const lay = this.layers.find(l => l.o === v.im); if (lay) { lay.x = v.im.x; lay.y = v.im.y; lay.f = 1; }
      if (flipped) { v.im.setAlpha(1).setScale(1, 0.05); s.tweens.add({ targets: v.im, scaleY: 1, duration: 320, ease: 'Back.easeOut' }); }
      else s.tweens.add({ targets: v.im, scaleY: 0.05, duration: 220, ease: 'Quad.easeIn', onComplete: () => v.im.setAlpha(0).setScale(1, 1) });
    }
    if (!initial) this.react('surprise');
  }
  fade(v: string, to: number, ms: number) { for (const x of this.vars[v] ?? []) { this.s.tweens.killTweensOf(x.im); if (!ms) x.im.setAlpha(to); else this.s.tweens.add({ targets: x.im, alpha: to, duration: ms, ease: 'Sine.easeInOut' }); } }
  /** code vision reveals claim.status = DENIED: the monitor turns red, and stays red */
  claim(initial: boolean) {
    if (this.claimShown) return; this.claimShown = true;
    if (initial) { this.fade('claim', 1, 0); return; }
    const s = this.s; for (const x of this.vars.claim ?? []) { s.tweens.add({ targets: x.im, alpha: { from: 0, to: 1 }, duration: 90, yoyo: true, repeat: 2, onComplete: () => x.im.setAlpha(1) }); }
    if (!s.save.seen.includes('claim9')) { s.save.seen.push('claim9'); }
  }

  // ---------- Noor reacts (rendered sheets: lookL/lookR, phone, shadow, surprise) ----------
  react(kind: 'phone' | 'shadow' | 'surprise', repeat = 0) {
    const s = this.s; const d = kind === 'surprise' ? s.dir : (['S', 'SE', 'SW'].includes(s.dir) ? s.dir : 'S');
    const key = `noor_${kind}_${d}`; if (!s.anims.exists(key)) return;
    s.dir = d; this.reacting = kind; s.noor.play({ key, repeat }, true);
    s.noor.once('animationcomplete', () => { if (this.reacting === kind) { this.reacting = ''; s.noor.play(`noor_idle_${s.dir}`); } });
  }
  /** per frame (after the main update): reactions, close-up card, pressure */
  update(dt: number, moving: boolean, mvx: number, mvy: number, interact: boolean) {
    const s = this.s; const calm = !s.busy && !s.cutscene && !s.dying && !s.composer;
    this.roomT += dt;
    // card: code vision during a close-up shows the object's code line; any move or E closes it
    if (this.cardOn) {
      this.cardT += dt; const ca = s.words.codeA;
      this.cardCode.setAlpha(ca); this.cardImg.setAlpha(1 - ca * 0.85); this.cardLine.setAlpha(ca).setColor(ca > 0.5 ? C.state : C.inkBright);
      if (this.cardT > 0.5 && (moving || (interact && ca < 0.1))) this.closeCard();
      else if (this.cardT > 7 && ca < 0.1) this.closeCard();
    }
    if (Math.hypot(mvx, mvy) > 0.1 || !calm) { this.idle9 = 0; if (this.reacting && this.reacting !== 'surprise') { this.reacting = ''; } }
    else this.idle9 += dt;
    // head/gaze toward the nearest inspectable while standing
    if (Math.hypot(mvx, mvy) < 0.1 && calm && !this.reacting && /^noor_(idle|look)/.test(s.noor.anims.currentAnim?.key ?? '')) {
      const p = s.plates.filter(q => q.visible && q.def.kind !== 'secret' && q.def.kind !== 'unlock').map(q => ({ q, d: Math.hypot(q.def.sx - s.x, q.def.sy - s.y) })).sort((a, b) => a.d - b.d)[0];
      let want = `noor_idle_${s.dir}`;
      if (p && p.d < 260) {
        const fa = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'].indexOf(s.dir) * Math.PI / 4;
        let da = Math.atan2(p.q.def.sy - s.y, p.q.def.sx - s.x) - fa; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        // screen-space: a positive angle (clockwise on screen) is toward Noor's right hand
        if (da > 0.35 && da < 2.0) want = `noor_lookR_${s.dir}`; else if (da < -0.35 && da > -2.0) want = `noor_lookL_${s.dir}`;
      }
      if (s.anims.exists(want) && s.noor.anims.currentAnim?.key !== want) s.noor.play(want, true);
    }
    // idles after a few seconds still: phone, then the missing shadow (alternating)
    if (this.idle9 > 4.2 && !this.reacting) { this.idle9 = -5; this.react(this.idleK++ % 2 ? 'shadow' : 'phone'); }
    // pressure: never a timer, just atmosphere
    if (this.roomT > this.nextUnread) { this.nextUnread = this.roomT + 40 + Math.random() * 30; this.tickUnread(); }
    this.glitchT -= dt;
    if (this.glitchT <= 0) { this.glitchT = Math.max(9, 22 - this.roomT * 0.08) * (0.8 + Math.random() * 0.4); if (!this.cam.reduce && calm) this.glitch(); }
    if (!this.draftShown && this.roomT > this.draftT && calm && !this.cardOn) this.draftGlimpse();
    if (this.glimpse) {   // crop the silhouette to the glass, every frame (frame px = (world - frame origin) / scale)
      const g = this.glimpse, sc = g.scaleX, fx = g.x - 96 * sc, fy = g.y - 160 * sc, W = this.win;
      const cx0 = Phaser.Math.Clamp((W.x0 - fx) / sc, 0, 192), cx1 = Phaser.Math.Clamp((W.x1 - fx) / sc, 0, 192), cy0 = Phaser.Math.Clamp((W.y0 - fy) / sc, 0, 192), cy1 = Phaser.Math.Clamp((W.y1 - fy) / sc, 0, 192);
      if (cx1 - cx0 < 1 || cy1 - cy0 < 1) g.setVisible(false); else g.setVisible(true).setCrop(cx0, cy0, cx1 - cx0, cy1 - cy0);
    }
    this.cam.update(dt, mvx, mvy);
  }
  tickUnread() {
    const s = this.s; s.save.unread = (s.save.unread ?? 37) + 1; Plate.vars.N = String(s.save.unread);
    this.phoneGlow.setAlpha(0); s.tweens.add({ targets: this.phoneGlow, alpha: 0.85, duration: 260, yoyo: true, hold: 500 });
    s.words.key = '';    // rebuild the caption if the phone is its subject
  }
  /** subtle chromatic flicker: offset red/cyan copies of the mid plate + a short tear band; grows (slowly) with time in the room */
  glitch() {
    const s = this.s; this.glitchN++;
    const amp = Math.min(3, 1 + this.roomT / 90), a = Math.min(0.16, 0.07 + this.roomT / 2000);
    const mk = (dx: number, col: number) => { const im = s.add.image(-80 + dx, -45, 'o9_mid').setOrigin(0).setDepth(-998.2).setTint(col).setAlpha(a).setBlendMode(Phaser.BlendModes.ADD); s.vs.add(im); s.objs.push(im); return im; };
    const r = mk(amp, 0xff3050), c = mk(-amp, 0x30e0ff);
    const band = s.add.image(-80 + amp * 3, -45, 'o9_mid').setOrigin(0).setDepth(-998.1).setAlpha(0.8); s.vs.add(band); s.objs.push(band);
    const y0 = 120 + Math.random() * 420; band.setCrop(0, y0, 1440, 10 + Math.random() * 14);
    s.time.delayedCall(70, () => band.destroy());
    s.time.delayedCall(140, () => { r.destroy(); c.destroy(); });
  }
  /** a brief Draft silhouette passing behind the rain glass (a dark, faceless copy of Noor, cropped to the window) */
  draftGlimpse() {
    const s = this.s; this.draftShown = true; const W = OFFICE9.view.window;
    const x0 = Math.min(...W.map(p => p[0])), x1 = Math.max(...W.map(p => p[0])), y1 = Math.max(...W.map(p => p[1]));
    const g = s.add.sprite(x0 - 30, y1 + 8, 'noor_walk').setOrigin(96 / 192, 160 / 192).play('noor_walk_E').setScale(0.62).setTint(0x020406).setAlpha(0).setDepth(-999.6);
    s.vs.add(g); s.objs.push(g); this.glimpse = g;
    this.win = { x0: x0 + 6, x1: x1 - 6, y0: 70, y1: y1 - 4 };
    s.tweens.add({ targets: g, alpha: 0.78, duration: 500 });
    s.tweens.add({ targets: g, x: x1 + 30, duration: 3600, ease: 'Sine.easeInOut', onComplete: () => { g.destroy(); this.glimpse = null; } });
    s.tweens.add({ targets: g, alpha: 0, delay: 3000, duration: 600 });
    // Noor glances at the window
    s.time.delayedCall(900, () => { if (!this.reacting && !s.busy) { const k = `noor_lookR_${s.dir}`; if (s.anims.exists(k)) s.noor.play(k, true); } });
  }
  state() {
    return { mode: this.cam.mode, zoom: +this.cam.zoom.toFixed(3), base: this.cam.base, lb: +this.cam.lb.toFixed(2), card: this.cardOn, cardA: +this.card.alpha.toFixed(2), cardCode: +this.cardCode.alpha.toFixed(2), cardLine: this.cardLine.text,
      vars: Object.fromEntries(Object.entries(this.vars).map(([k, v]) => [k, +(v[0]?.im.alpha ?? 0).toFixed(2)])), rainK: this.rainK, reacting: this.reacting, anim: this.s.noor.anims.currentAnim?.key ?? '',
      glitchN: this.glitchN, cx: Math.round(this.s.cameras.main.midPoint.x), cy: Math.round(this.s.cameras.main.midPoint.y), playZoom: this.cam.playZoom, draft: this.draftShown, glimpse: !!this.glimpse, unread: this.s.save.unread ?? 37, roomT: this.roomT, reduce: this.cam.reduce, layers: this.layers.length };
  }
}
