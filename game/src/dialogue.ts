// Speaker-anchored dialogue. Fern is a large hologram that rises from a
// flickering monitor or lamp — never a face at the screen's own tiny size.
import Phaser from 'phaser';
import tokens from './tokens.json';
import { sfx } from './sfx';
import { thud, voiceBlip, type VoiceWho } from './voice';
import type { GameScene } from './game';

const C = tokens.color;
const FONT = 'JetBrains Mono';
const UI = 'IBM Plex Mono';
const DEPTH = 3600;
const UI_DEPTH = 8200;
const WRAP = 300;
const LONG_LINE = 88;

export type SayWho = 'noor' | 'ai' | 'fern' | 'papa' | 'floor' | 'draft';

const QUALITY_FX: Record<string, 'frost' | 'heavy' | 'glow' | 'wave' | 'flicker' | 'dim'> = {
  cold: 'frost', heavy: 'heavy', light: 'glow', spark: 'flicker',
  wet: 'wave', water: 'wave', lit: 'flicker', on: 'flicker',
  dead: 'dim', off: 'dim', still: 'dim', weak: 'dim',
  open: 'glow', shut: 'dim', dry: 'glow', glass: 'glow',
  paper: 'glow', slow: 'dim', quick: 'flicker', buzz: 'flicker', buzzing: 'flicker',
};

type Source = { id: string; x: number; y: number; kind: 'monitor' | 'lamp' | 'body' };

const OFFICE_SOURCES: Source[] = [
  { id: 'lamp', x: 178, y: 268, kind: 'lamp' },
  { id: 'floorlamp', x: 1185, y: 400, kind: 'lamp' },
  { id: 'mon_noor', x: 989, y: 448, kind: 'monitor' },
  { id: 'mon_kabir', x: 685, y: 255, kind: 'monitor' },
  { id: 'mon_dez', x: 395, y: 375, kind: 'monitor' },
  { id: 'mon_mug', x: 235, y: 548, kind: 'monitor' },
  { id: 'mon_podW', x: 165, y: 288, kind: 'monitor' },
  { id: 'mon_podE', x: 1140, y: 308, kind: 'monitor' },
];

type Job = { who: SayWho; line: string; ms: number };

export class Dialogue {
  s: GameScene;
  queue: Job[] = [];
  busy = false;
  waiting = false;
  root?: Phaser.GameObjects.Container;
  holo?: Phaser.GameObjects.Container;
  private holoBaseY?: number;
  source?: Source;
  timers: Phaser.Time.TimerEvent[] = [];
  private typed = '';
  private full = '';
  private who: SayWho = 'floor';
  private angry = false;
  private question = false;
  private letterBits: Phaser.GameObjects.Text[] = [];
  private arrow?: Phaser.GameObjects.Text;
  private onKey?: (ev: KeyboardEvent) => void;
  private onClick?: () => void;
  onIdle?: () => void;
  private baseX = 0;

  constructor(s: GameScene) {
    this.s = s;
    this.onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Enter') this.advance();
    };
    this.onClick = () => this.advance();
    try { window.addEventListener('keydown', this.onKey); } catch { /* */ }
    try { s.input.on('pointerdown', this.onClick); } catch { /* */ }
  }

  enqueue(who: SayWho, line: string, ms = 2200) {
    if (!line) { this.queue.push({ who, line, ms }); if (!this.busy) this.kick(); return; }
    this.queue.push({ who, line, ms });
    if (!this.busy) this.kick();
  }

  advance() {
    if (!this.busy) return;
    if (this.typed.length < this.full.length) {
      this.typed = this.full;
      this.refreshBits(true);
      this.showArrow();
      return;
    }
    if (this.waiting) this.finishJob();
  }

  update(_dt: number) {
    if (this.arrow && this.arrow.visible) {
      this.arrow.setAlpha(0.45 + 0.55 * Math.sin(this.s.t * 6));
    }
    if (this.angry && this.root) {
      this.root.x = this.baseX + Math.sin(this.s.t * 48) * 1.4;
    }
    if (this.holo && this.holo.active) {
      const bob = Math.sin(this.s.t * 2.1) * 2.6;
      if (this.holoBaseY != null) this.holo.y = this.holoBaseY + bob;
      const flick = 0.92 + Math.sin(this.s.t * 19) * 0.05 + (Math.random() < 0.03 ? -0.08 : 0);
      this.holo.setAlpha(Math.max(0.78, Math.min(1, flick)));
    }
  }

  clear() {
    for (const t of this.timers) { try { t.remove(false); } catch { /* */ } }
    this.timers = [];
    this.queue = [];
    this.busy = false;
    this.waiting = false;
    this.typed = ''; this.full = '';
    this.letterBits = [];
    this.root?.destroy(); this.root = undefined;
    this.holo?.destroy(); this.holo = undefined; this.holoBaseY = undefined;
    this.arrow = undefined;
    this.source = undefined;
    try { this.s.hud.sub.setVisible(false); this.s.hud.fern.setVisible(false); } catch { /* */ }
  }

  destroy() {
    this.clear();
    if (this.onKey) try { window.removeEventListener('keydown', this.onKey); } catch { /* */ }
    if (this.onClick) try { this.s.input.off('pointerdown', this.onClick); } catch { /* */ }
  }

  private kick() {
    if (this.busy) return;
    const job = this.queue.shift();
    if (!job) { this.busy = false; try { this.onIdle?.(); } catch { /* */ } return; }
    if (!job.line) { this.at(job.ms, () => { this.busy = false; this.kick(); }); this.busy = true; return; }
    this.busy = true;
    this.waiting = false;
    this.who = job.who;
    this.full = job.line;
    this.typed = '';
    this.question = /\?\s*$/.test(job.line);
    this.angry = /!/.test(job.line) || (job.line.length > 6 && job.line.replace(/[^A-Z]/g, '').length / job.line.replace(/[^A-Za-z]/g, '').length > 0.7);
    try { this.s.hud.sub.setVisible(false); this.s.hud.fern.setVisible(false); } catch { /* */ }

    const useBox = this.shouldBox(job);
    if (job.who === 'fern' && !useBox) {
      this.summonFern(() => this.beginBubble(job, false));
    } else if (useBox) {
      if (job.who === 'fern') this.summonFern(() => this.beginBox(job));
      else this.beginBox(job);
    } else {
      this.beginBubble(job, true);
    }
  }

  private shouldBox(job: Job) {
    if (job.line.length >= LONG_LINE) return true;
    if (job.who === 'floor' || job.who === 'papa') return true;
    if (job.who === 'ai' || job.who === 'draft') {
      // Draft in the arena can use a box so the fight stays readable.
      if (this.s.room?.id === 'arena' || this.s.fight) return true;
    }
    if (job.who === 'fern' && !this.fernSource() && !this.bodyFern()) return true;
    return false;
  }

  private bodyFern(): Source | null {
    if (this.s.room?.id !== 'hub') return null;
    return { id: 'hub_fern', x: 1005, y: 470, kind: 'body' };
  }

  private fernSource(): Source | null {
    const body = this.bodyFern();
    if (body) return body;
    const room = this.s.room?.id;
    const list = room === 'office' ? OFFICE_SOURCES : [];
    if (!list.length) return null;
    const line = this.full.toLowerCase();
    if (/\blamp\b|\bbuzz/.test(line)) {
      const lamp = list.find(s => s.id === 'lamp') || list.find(s => s.kind === 'lamp');
      if (lamp) return lamp;
    }
    const nx = this.s.x ?? 640, ny = this.s.y ?? 360;
    let best = list[0], bestD = Infinity;
    for (const src of list) {
      const d = (src.x - nx) ** 2 + (src.y - ny) ** 2;
      if (d < bestD) { best = src; bestD = d; }
    }
    return best;
  }

  private summonFern(done: () => void) {
    const src = this.fernSource();
    if (!src) { done(); return; }
    // Already up at a nearby source — stay, small glitch, then speak.
    if (this.holo && this.source && this.source.id === src.id) {
      this.glitchSource(src, 180);
      this.at(200, done);
      return;
    }
    // Hop: dismiss the old projection, then rise from the new source.
    if (this.holo) {
      const old = this.holo;
      this.s.tweens.add({ targets: old, alpha: 0, y: old.y + 16, duration: 180, onComplete: () => old.destroy() });
      this.holo = undefined;
    }
    this.source = src;
    this.glitchSource(src, 420);
    this.at(400, () => {
      if (!this.busy) return;
      this.spawnHolo(src);
      this.at(420, done);
    });
  }

  private glitchSource(src: Source, ms: number) {
    const s = this.s;
    try { sfx('tell'); } catch { /* */ }
    const col = src.kind === 'lamp' ? 0xf6c684 : 0x78e4e8;
    const glow = s.add.ellipse(src.x, src.y, src.kind === 'lamp' ? 54 : 46, src.kind === 'lamp' ? 36 : 28, col, 0.0)
      .setDepth(DEPTH - 20).setBlendMode(Phaser.BlendModes.ADD);
    s.tweens.add({ targets: glow, alpha: { from: 0.15, to: 0.8 }, duration: 70, yoyo: true, repeat: Math.max(2, Math.floor(ms / 90)) });
    this.at(ms, () => { try { glow.destroy(); } catch { /* */ } });
    for (let i = 0; i < 5; i++) {
      const bar = s.add.rectangle(src.x + (Math.random() - 0.5) * 16, src.y - 6 + Math.random() * 16, 28 + Math.random() * 24, 2 + Math.random() * 3, Math.random() > 0.5 ? 0x78e4e8 : 0xe27bd8, 0.7)
        .setDepth(DEPTH - 19);
      s.tweens.add({ targets: bar, alpha: 0, x: bar.x + (Math.random() - 0.5) * 18, duration: 140 + i * 40, onComplete: () => bar.destroy() });
    }
  }

  private spawnHolo(src: Source) {
    const s = this.s;
    if (src.kind === 'body') {
      this.holo = s.add.container(src.x, src.y).setDepth(DEPTH);
      this.holoBaseY = src.y;
      return;
    }
    const BODY_H = 110; // displayed plant height, in the 90–120px brief
    const SCALE = BODY_H / 151;
    const pos = this.holoPos(src, BODY_H);
    const c = s.add.container(src.x, src.y - 8).setDepth(DEPTH).setAlpha(0);

    const glow = s.add.sprite(0, 0, 'fern_plant', 'fern_plant_S_00')
      .setOrigin(0.5, 0.92).setScale(SCALE * 1.1)
      .setTint(0x7ee8ee).setAlpha(0.4);
    try { glow.setBlendMode(Phaser.BlendModes.ADD); } catch { /* */ }
    try { glow.play('fern_plant_S'); } catch { /* */ }

    const body = s.add.sprite(0, 0, 'fern_plant', 'fern_plant_S_00')
      .setOrigin(0.5, 0.92).setScale(SCALE)
      .setTint(0xd8f7fb);
    try { body.play('fern_plant_S'); } catch { /* */ }

    // Scanlines clipped to the plant silhouette — never a rectangular box.
    const scan = s.add.graphics();
    const top = -Math.round(200 * SCALE * 0.92);
    const half = 36;
    for (let y = top + 4; y < 10; y += 3) {
      scan.lineStyle(1, 0x9ad8e8, 0.2);
      scan.lineBetween(-half, y, half, y);
    }
    // Lines stay inside the typical silhouette width; a texture mask is not in this Phaser typings.

    // Projection beam from the source (below the pot) up into Fern.
    const beam = s.add.triangle(0, 6, -11, 46, 11, 46, 0, 0, 0x8fd0dc, 0.3);
    try { beam.setBlendMode(Phaser.BlendModes.ADD); } catch { /* */ }

    c.add([beam, glow, body, scan]);
    s.tweens.add({
      targets: c,
      alpha: 1,
      x: pos.x,
      y: pos.y,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => { this.holoBaseY = pos.y; },
    });
    this.holo = c;
    this.holoBaseY = pos.y;
    try { sfx('tell'); } catch { /* */ }
  }

  /** Sit the pot just above the source, keep the 110px plant off the lift and the menu. */
  private holoPos(src: Source, bodyH: number) {
    const lift = { x: 140, y: 60, w: 150, h: 155 };
    let x = src.x + (src.x < 500 ? 62 : -62);
    let y = src.y - 18;
    const top = y - bodyH;
    const hitsLift = top < lift.y + lift.h && y > lift.y && x > lift.x - 30 && x < lift.x + lift.w + 30;
    if (hitsLift) { x = lift.x + lift.w + 48; y = Math.max(y, lift.y + 24); }
    x = Phaser.Math.Clamp(x, 64, 1216);
    y = Phaser.Math.Clamp(y, 56 + bodyH, 640);
    return { x, y };
  }

  private beginBubble(job: Job, fromSpeaker: boolean) {
    const s = this.s;
    const anchor = this.bubbleAnchor(job.who, fromSpeaker);
    const box = this.makeLineBox(anchor.x, anchor.y, job, false, anchor.flip);
    this.root = box;
    this.baseX = box.x;
    this.typewrite(job);
  }

  private beginBox(job: Job) {
    const s = this.s;
    const c = s.add.container(640, 628).setScrollFactor(0).setDepth(UI_DEPTH).setAlpha(0);
    const w = 760, h = 118;
    const bg = s.add.rectangle(0, 0, w, h, 0x061018, 0.92).setStrokeStyle(2, job.who === 'fern' ? 0xe27bd8 : job.who === 'draft' || job.who === 'ai' ? 0xf08074 : 0x78e4e8, 0.85);
    const portrait = this.makePortrait(job.who);
    portrait.setPosition(-w / 2 + 58, 0);
    const name = this.tagFor(job.who);
    const tag = s.add.text(-w / 2 + 118, -h / 2 + 10, name, {
      fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: this.colFor(job.who), letterSpacing: 3,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    const words = this.layoutWords(job.line, -w / 2 + 118, -18, 560, false);
    this.arrow = s.add.text(w / 2 - 22, h / 2 - 22, '▾', { fontFamily: FONT, fontSize: '16px', color: C.cyan }).setOrigin(0.5).setVisible(false);
    c.add([bg, portrait, tag, this.arrow, ...words]);
    this.root = c;
    this.baseX = c.x;
    s.tweens.add({ targets: c, alpha: 1, y: 618, duration: 220, ease: 'Quad.easeOut' });
    this.typewrite(job);
  }

  private bubbleAnchor(who: SayWho, fromSpeaker: boolean) {
    if (who === 'fern' && this.holo) {
      const right = this.holo.x + 70 + WRAP / 2 < 1240;
      const x = right ? this.holo.x + 70 : this.holo.x - 70;
      const y = Phaser.Math.Clamp(this.holo.y - 56, 64, 520);
      return { x, y, flip: !right };
    }
    if (who === 'noor' || fromSpeaker) {
      const x0 = this.s.noor?.x ?? this.s.x;
      const y0 = (this.s.noor?.y ?? this.s.y) - 100;
      const flip = x0 > 900;
      return { x: Phaser.Math.Clamp(flip ? x0 - 40 : x0 + 40, 80, 1200), y: Phaser.Math.Clamp(y0, 64, 520), flip };
    }
    return { x: 640, y: 160, flip: false };
  }

  private makeLineBox(x: number, y: number, job: Job, _box: boolean, flip: boolean) {
    const s = this.s;
    const c = s.add.container(x, y).setDepth(DEPTH + 20).setAlpha(0);
    const name = this.tagFor(job.who);
    const tag = s.add.text(0, -22, name, {
      fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: this.colFor(job.who), letterSpacing: 2,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(flip ? 1 : 0, 1);
    const words = this.layoutWords(job.line, 0, 0, WRAP, flip);
    // Measure after layout.
    let maxW = 80, maxH = 20;
    for (const w of words) {
      maxW = Math.max(maxW, (flip ? -w.x : w.x) + w.width);
      maxH = Math.max(maxH, w.y + w.height);
    }
    const padX = 12, padY = 10;
    const bg = s.add.rectangle(flip ? -4 : -4, -4, maxW + padX * 2, maxH + padY * 2 + 16, 0x07141c, 0.9)
      .setOrigin(flip ? 1 : 0, 0)
      .setStrokeStyle(2, this.hexFor(job.who), 0.9);
    bg.setPosition(flip ? 8 : -8, -18);
    const tail = s.add.triangle(
      flip ? 18 : -18, maxH + 10,
      0, 0, flip ? 12 : -12, 14, flip ? -6 : 6, 0,
      0x07141c, 0.9,
    );
    tag.setPosition(flip ? -10 : 10, -6);
    this.arrow = s.add.text(flip ? -16 : maxW, maxH + 2, '▾', { fontFamily: FONT, fontSize: '13px', color: C.cyan }).setOrigin(flip ? 1 : 0, 0).setVisible(false);
    c.add([bg, tail, tag, this.arrow, ...words]);
    s.tweens.add({ targets: c, alpha: 1, y: y - 6, duration: 200, ease: 'Quad.easeOut' });
    return c;
  }

  private layoutWords(line: string, left: number, top: number, wrap: number, flip: boolean) {
    const bits: Phaser.GameObjects.Text[] = [];
    const parts = line.split(/(\s+)/);
    let x = 0, y = 0, rowH = 22;
    const align = flip ? 1 : 0;
    for (const part of parts) {
      if (!part) continue;
      const raw = part;
      const key = part.toLowerCase().replace(/[^a-z]/g, '');
      const isQ = !!QUALITY_FX[key];
      const style: Phaser.Types.GameObjects.Text.TextStyle = {
        fontFamily: UI, fontSize: '16px', fontStyle: isQ ? 'bold' : '500',
        color: isQ ? C.cyan : C.inkBright,
      };
      const t = this.s.add.text(0, 0, raw, style).setOrigin(align, 0).setAlpha(0);
      t.setData('full', raw);
      if (isQ) t.setShadow(0, 0, C.cyan, 10, true, true);
      if (x + t.width > wrap && raw.trim()) { x = 0; y += rowH; }
      t.setPosition(flip ? -x : left + x, top + y);
      x += t.width;
      bits.push(t);
    }
    this.letterBits = bits;
    return bits;
  }

  private typewrite(job: Job) {
    const chars = job.line;
    let i = 0;
    const tick = () => {
      if (!this.busy) return;
      if (this.typed.length >= chars.length) { this.showArrow(); this.wait(job.ms); return; }
      // Reveal by character across the word sprites.
      i += 1;
      this.typed = chars.slice(0, i);
      this.refreshBits(false);
      const ch = chars[i - 1];
      if (ch && /[A-Za-z0-9]/.test(ch)) {
        try { voiceBlip(this.voiceWho(job.who), i, { question: this.question, angry: this.angry }); } catch { /* */ }
      }
      const delay = ch === ' ' ? 18 : this.who === 'fern' ? 26 : 30;
      this.at(delay, tick);
    };
    tick();
  }

  private refreshBits(all: boolean) {
    let seen = 0;
    for (const t of this.letterBits) {
      const full = (t.getData('full') as string) ?? t.text;
      if (all || seen + full.length <= this.typed.length) {
        t.setText(full);
        if (t.alpha < 1) { t.setAlpha(1); this.playWordFx(t); }
        else t.setAlpha(1);
      } else if (seen < this.typed.length) {
        t.setText(full.slice(0, this.typed.length - seen));
        t.setAlpha(1);
      } else {
        t.setText(full); // keep full width so later words never shuffle
        t.setAlpha(0);
      }
      seen += full.length;
    }
  }

  private playWordFx(t: Phaser.GameObjects.Text) {
    if (t.getData('fxDone')) return;
    const key = t.text.toLowerCase().replace(/[^a-z]/g, '');
    const fx = QUALITY_FX[key];
    if (!fx) return;
    t.setData('fxDone', true);
    if (fx === 'frost') {
      t.setColor('#d7f7ff');
      t.setShadow(0, 0, '#9ad8ff', 14, true, true);
      this.s.tweens.add({ targets: t, y: t.y - 1, duration: 700, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
      // Tiny frost ticks
      for (let i = 0; i < 4; i++) {
        const d = this.s.add.rectangle(t.x + Math.random() * t.width, t.y - 4 - Math.random() * 8, 2, 2 + Math.random() * 3, 0xd7f7ff, 0.9).setDepth(t.depth + 1);
        this.root?.add(d);
        this.s.tweens.add({ targets: d, y: d.y + 10, alpha: 0, duration: 700 + i * 80, onComplete: () => d.destroy() });
      }
    } else if (fx === 'heavy') {
      const y0 = t.y;
      t.y = y0 - 16;
      this.s.tweens.add({
        targets: t, y: y0, duration: 280, ease: 'Bounce.easeOut',
        onComplete: () => { try { thud(); } catch { /* */ } },
      });
    } else if (fx === 'wave') {
      this.s.tweens.add({ targets: t, y: t.y + 3, duration: 380, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
    } else if (fx === 'flicker') {
      this.s.tweens.add({ targets: t, alpha: { from: 1, to: 0.45 }, duration: 80, yoyo: true, repeat: 5 });
    } else if (fx === 'dim') {
      t.setColor(C.dim);
    } else {
      t.setShadow(0, 0, C.cyan, 12, true, true);
      this.s.tweens.add({ targets: t, alpha: { from: 1, to: 0.75 }, duration: 220, yoyo: true, repeat: 2 });
    }
  }

  private showArrow() { if (this.arrow) this.arrow.setVisible(true); }

  private wait(ms: number) {
    this.waiting = true;
    this.at(Math.max(700, ms), () => { if (this.waiting) this.finishJob(); });
  }

  private finishJob() {
    this.waiting = false;
    const root = this.root;
    this.root = undefined;
    this.letterBits = [];
    this.arrow = undefined;
    if (root) {
      this.s.tweens.add({
        targets: root, alpha: 0, duration: 180,
        onComplete: () => root.destroy(),
      });
    }
    // Keep Fern's hologram up briefly between her lines; dismiss if the next job isn't hers.
    const next = this.queue[0];
    if (!next || next.who !== 'fern') {
      const h = this.holo;
      this.holo = undefined;
      this.source = undefined;
      if (h) this.s.tweens.add({ targets: h, alpha: 0, y: h.y + 18, duration: 280, onComplete: () => h.destroy() });
    }
    this.at(200, () => { this.busy = false; this.kick(); });
  }

  private makePortrait(who: SayWho) {
    if (who === 'fern' && this.s.textures.exists('fern_plant')) {
      const spr = this.s.add.sprite(0, 6, 'fern_plant', 'fern_plant_S_00');
      spr.setOrigin(0.5, 0.55).setScale(0.42).setTint(0xd8f7fb);
      try { spr.play('fern_plant_S'); } catch { /* */ }
      return spr;
    }
    if (who === 'noor' && this.s.textures.exists('noor_idle')) {
      const spr = this.s.add.sprite(0, 8, 'noor_idle', 'noor_idle_S_00');
      try { spr.setCrop(50, 40, 90, 80); } catch { /* */ }
      spr.setOrigin(0.5, 0.55).setScale(1.05);
      return spr;
    }
    const g = this.s.add.graphics();
    const col = this.hexFor(who);
    g.fillStyle(col, 0.25).fillEllipse(0, 0, 64, 72);
    g.lineStyle(2, col, 0.8).strokeEllipse(0, 0, 64, 72);
    return g;
  }

  private tagFor(who: SayWho) {
    if (who === 'fern') return 'FERN';
    if (who === 'noor') return 'NOOR';
    if (who === 'draft' || who === 'ai') return 'THE DRAFT';
    if (who === 'papa') return 'PAPA';
    return '';
  }
  private colFor(who: SayWho) {
    if (who === 'fern') return C.fern;
    if (who === 'draft' || who === 'ai') return C.coral;
    if (who === 'papa') return '#F6E6C8';
    if (who === 'floor') return C.ink;
    return C.cyan;
  }
  private hexFor(who: SayWho) {
    if (who === 'fern') return 0xe27bd8;
    if (who === 'draft' || who === 'ai') return 0xf08074;
    if (who === 'papa') return 0xf6e6c8;
    return 0x78e4e8;
  }
  private voiceWho(who: SayWho): VoiceWho {
    if (who === 'ai') return 'draft';
    return who;
  }

  private at(ms: number, fn: () => void) {
    this.timers.push(this.s.time.delayedCall(ms, fn));
  }
}

