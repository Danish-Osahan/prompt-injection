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
const WRAP = 380;
const LONG_LINE = 70;

export type SayWho = 'noor' | 'ai' | 'fern' | 'papa' | 'floor' | 'draft';

/** Only stealable quality tokens, excluding common English words (on, off, up, down, still). */
const QUALITY_FX: Record<string, 'frost' | 'heavy' | 'glow' | 'wave' | 'flicker' | 'dim'> = {
  wet: 'wave', dry: 'glow',
  quick: 'flicker',
  low: 'dim', high: 'glow',
  apart: 'glow', together: 'glow',
  weak: 'dim', torn: 'dim',
  paper: 'glow', slow: 'dim', glass: 'glow',
  loud: 'flicker', hot: 'glow',
  open: 'glow', shut: 'dim',
  spark: 'flicker',
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

type Job = { who: SayWho; line: string; ms: number; box?: boolean };

export class Dialogue {
  s: GameScene;
  queue: Job[] = [];
  busy = false;
  waiting = false;
  root?: Phaser.GameObjects.Container;
  holo?: Phaser.GameObjects.Container;
  private holoBaseY?: number;
  private beamG?: Phaser.GameObjects.Graphics;
  private beamLife = 0;
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
  onSpeak?: (who: SayWho, line: string) => void;
  private baseX = 0;
  private holoBaseX?: number;
  private holoBody?: Phaser.GameObjects.Sprite;
  private holoGlow?: Phaser.GameObjects.Sprite;
  private portraitSpr?: Phaser.GameObjects.Sprite;
  private portraitEyes?: Phaser.GameObjects.Graphics;
  private fernEmotes: Phaser.GameObjects.GameObject[] = [];
  private fernActUntil = 0;
  private followWorld = false;
  private followWho: SayWho = 'floor';
  private followFromSpeaker = false;
  private followFlip = false;
  private boxW = 0;
  private boxH = 0;
  private boxPadT = 22;
  private tailGfx?: Phaser.GameObjects.Triangle;
  private boxReveal = false;
  constructor(s: GameScene) {
    this.s = s;
    this.onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Enter') this.advance();
    };
    this.onClick = () => this.advance();
    try { window.addEventListener('keydown', this.onKey); } catch { /* */ }
    try { s.input.on('pointerdown', this.onClick); } catch { /* */ }
  }

  enqueue(who: SayWho, line: string, ms = 2200, opts?: { box?: boolean }) {
    this.queue.push({ who, line, ms, box: opts?.box });
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
    try {
      if (!this.busy && this.queue.length && !this.mailBlocking()) this.kick();
      this.placeShieldArm();
      if (this.living(this.arrow) && this.arrow!.visible) {
        this.arrow!.setAlpha(0.45 + 0.55 * Math.sin(this.s.t * 6));
      }
      if (this.followWorld && this.living(this.root)) this.followBubble();
      if (this.angry && this.living(this.root)) {
        this.root!.x = this.baseX + Math.sin(this.s.t * 48) * 1.4;
      }
      if (this.living(this.holo)) {
        const acting = this.s.time.now < this.fernActUntil;
        const bob = acting ? 0 : Math.sin(this.s.t * 2.1) * 2.6;
        if (!acting && this.holoBaseY != null) this.holo!.y = this.holoBaseY + bob;
        const flick = 0.92 + Math.sin(this.s.t * 19) * 0.05 + (Math.random() < 0.03 ? -0.08 : 0);
        this.holo!.setAlpha(Math.max(0.78, Math.min(1, flick)));
        if (this.beamLife > 0) {
          this.beamLife = Math.max(0, this.beamLife - _dt);
          this.drawBeam(this.beamLife / 0.7);
          if (this.beamLife <= 0) { try { this.beamG?.clear(); } catch { /* */ } }
        }
      }
    } catch { /* never let a stale sprite take the page down */ }
  }

  clear() {
    for (const t of this.timers) { try { t.remove(false); } catch { /* */ } }
    this.timers = [];
    this.queue = [];
    this.busy = false;
    this.waiting = false;
    this.typed = ''; this.full = '';
    this.letterBits = [];
    this.clearFernAct();
    this.followWorld = false; this.tailGfx = undefined; this.boxReveal = false;
    this.clearShield();
    this.root?.destroy(); this.root = undefined;
    this.holo?.destroy(); this.holo = undefined; this.holoBaseY = undefined; this.holoBaseX = undefined;
    this.holoBody = undefined; this.holoGlow = undefined;
    this.portraitSpr = undefined; this.portraitEyes = undefined;
    try { this.beamG?.destroy(); } catch { /* */ } this.beamG = undefined; this.beamLife = 0;
    this.arrow = undefined;
    this.source = undefined;
    try { this.s.hud.sub.setVisible(false); this.s.hud.fern.setVisible(false); } catch { /* */ }
  }

  destroy() {
    this.clear();
    if (this.onKey) try { window.removeEventListener('keydown', this.onKey); } catch { /* */ }
    if (this.onClick) try { this.s.input.off('pointerdown', this.onClick); } catch { /* */ }
  }

  private mailBlocking() {
    try { return !!this.s.intro?.mailOpen?.(); } catch { return false; }
  }

  private kick() {
    if (this.busy) return;
    if (this.mailBlocking()) return;
    const job = this.queue.shift();
    if (!job) { this.busy = false; try { this.onIdle?.(); } catch { /* */ } return; }
    if (!job.line || !job.line.trim()) { this.at(job.ms, () => { this.busy = false; this.kick(); }); this.busy = true; return; }
    this.busy = true;
    this.waiting = false;
    this.who = job.who;
    this.full = job.line;
    this.typed = '';
    this.question = /\?\s*$/.test(job.line);
    this.angry = /!/.test(job.line) || (job.line.length > 6 && job.line.replace(/[^A-Z]/g, '').length / job.line.replace(/[^A-Za-z]/g, '').length > 0.7);
    try { this.s.hud.sub.setVisible(false); this.s.hud.fern.setVisible(false); } catch { /* */ }
    try { this.onSpeak?.(job.who, job.line); } catch { /* */ }

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
    if (job.box === true) return true;
    if (job.box === false) return false;
    // Short Noor reactions stay in a bubble even during the hook.
    if (this.s.intro?.playing) return job.who !== 'noor';
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
      this.holoBody = undefined;
      this.holoGlow = undefined;
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
    // Sprite frame is 160×220; opaque plant is ~186px tall. Display ~110px.
    const BODY_H = 110;
    const SCALE = BODY_H / 186;
    const pos = this.holoPos(src, BODY_H);
    const c = s.add.container(src.x, src.y - 8).setDepth(DEPTH).setAlpha(0);

    // Soft glow is a slightly larger copy of the same silhouette — never a box.
    const glow = s.add.sprite(0, 0, 'fern_plant', 'fern_plant_S_00')
      .setOrigin(0.5, 0.93).setScale(SCALE * 1.08)
      .setAlpha(0.32);
    try { glow.setBlendMode(Phaser.BlendModes.ADD); } catch { /* */ }
    try { glow.play('fern_plant_S'); } catch { /* */ }

    const body = s.add.sprite(0, 0, 'fern_plant', 'fern_plant_S_00')
      .setOrigin(0.5, 0.93).setScale(SCALE);
    try { body.play('fern_plant_S'); } catch { /* */ }

    c.add([glow, body]);
    this.holoGlow = glow;
    this.holoBody = body;
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
    this.holoBaseX = pos.x;
    this.holoBaseY = pos.y;
    this.ensureBeam();
    this.beamLife = 0.7;
    this.drawBeam(1);
    try { sfx('tell'); } catch { /* */ }
    this.noorReactToCharge(src);
  }

  private ensureBeam() {
    if (this.beamG && this.beamG.active) return;
    try { this.beamG?.destroy(); } catch { /* */ }
    this.beamG = this.s.add.graphics().setDepth(DEPTH - 8);
  }

  private drawBeam(k = 1) {
    if (!this.beamG || !this.holo || !this.source) return;
    const g = this.beamG;
    g.clear();
    const fade = Math.max(0, Math.min(1, k));
    if (fade <= 0) return;
    const x0 = this.source.x, y0 = this.source.y;
    const x1 = this.holo.x, y1 = this.holo.y + 8;
    try { g.setBlendMode(Phaser.BlendModes.ADD); } catch { /* */ }
    // Soft cone only — no hairline. Fades out after Fern lands.
    const w = 18 + (1 - fade) * 10;
    g.fillStyle(0x8fd0dc, 0.16 * fade);
    g.fillTriangle(x0 - w, y0, x0 + w, y0, x1, y1);
    g.fillStyle(0xb8f0f4, 0.10 * fade);
    g.fillTriangle(x0 - w * 0.45, y0, x0 + w * 0.45, y0, x1, y1);
    // Glitch-pixel dissolve at the source, dying with the cone.
    const n = Math.floor(5 * fade) + 1;
    for (let i = 0; i < n; i++) {
      const px = x0 + (Math.random() - 0.5) * 22;
      const py = y0 + (Math.random() - 0.5) * 14;
      g.fillStyle(Math.random() > 0.5 ? 0xb8f0f4 : 0xe27bd8, 0.55 * fade);
      g.fillRect(px, py, 2 + Math.random() * 5, 2);
    }
  }

  /** Sit the pot in a clear patch of floor near the source — not on the shelf, calendar, or lift. */
  private holoPos(src: Source, bodyH: number) {
    // Named sources get hand-placed spots in open floor.
    if (src.id === 'lamp') return { x: 268, y: 348 };
    if (src.id === 'mon_noor') return { x: 880, y: 430 };
    if (src.id === 'floorlamp') return { x: 1088, y: 430 };
    let x = src.x + (src.x < 500 ? 86 : -86);
    let y = Math.max(src.y + 24, 330);
    const blocked = [
      { x: 130, y: 50, w: 180, h: 180 },   // lift
      { x: 220, y: 60, w: 90, h: 110 },    // August calendar
      { x: 385, y: 100, w: 130, h: 120 },  // bookcase
      { x: 290, y: 140, w: 80, h: 90 },    // kitchen
      { x: 60, y: 110, w: 110, h: 140 },   // printer + plantW
      { x: 1060, y: 470, w: 160, h: 130 }, // boxes by Noor
    ];
    const hits = () => blocked.some(b => x > b.x - 20 && x < b.x + b.w + 20 && y - bodyH < b.y + b.h && y > b.y);
    if (hits()) { x = src.x < 640 ? src.x + 110 : src.x - 110; y = Math.max(y, 340); }
    if (hits()) { y = 360; }
    x = Phaser.Math.Clamp(x, 64, 1216);
    y = Phaser.Math.Clamp(y, 56 + bodyH, 640);
    // Never land on Noor — push the hologram away if she's near the source.
    const nx = this.s.x ?? 640, ny = this.s.y ?? 360;
    const minD = 110;
    let dx = x - nx, dy = y - ny;
    const d = Math.hypot(dx, dy);
    if (d < minD) {
      const ux = d < 4 ? (x >= nx ? 1 : -1) : dx / d;
      const uy = d < 4 ? 0.2 : dy / d;
      x = Phaser.Math.Clamp(nx + ux * minD, 64, 1216);
      y = Phaser.Math.Clamp(ny + uy * minD, 56 + bodyH, 640);
    }
    return { x, y };
  }

  private beginBubble(job: Job, fromSpeaker: boolean) {
    const s = this.s;
    const anchor = this.bubbleAnchor(job.who, fromSpeaker);
    const box = this.makeLineBox(anchor.x, anchor.y, job, false, anchor.flip, anchor.speaker);
    this.root = box;
    this.baseX = box.x;
    this.followWorld = true;
    this.followWho = job.who;
    this.followFromSpeaker = fromSpeaker;
    this.followFlip = anchor.flip;
    this.boxReveal = false;
    box.setAlpha(0);
    if (job.who === 'fern') this.reactFernLine(job.line);
    this.typewrite(job);
  }

  private beginBox(job: Job) {
    const s = this.s;
    const textW = 640;
    const words = this.layoutWords(job.line, 0, 0, textW, false);
    let maxW = 80, maxH = 22;
    for (const w of words) {
      maxW = Math.max(maxW, w.x + w.width);
      maxH = Math.max(maxH, w.y + w.height);
    }
    const padL = 128, padR = 28, padT = 34, padB = 26;
    const w = Math.max(660, Math.min(940, padL + maxW + padR));
    const h = Math.max(120, padT + maxH + padB);
    const y = 720 - 28 - h / 2;
    const c = s.add.container(640, y + 18).setScrollFactor(0).setDepth(UI_DEPTH).setAlpha(0).setScale(0.96);
    const bg = this.cutPanel(0, 0, w, h, 0x07141c, 0.94, this.hexFor(job.who), 12);
    bg.setPosition(-w / 2, -h / 2);
    const accent = s.add.rectangle(-w / 2 + 3, 0, 4, h - 16, this.hexFor(job.who), 0.9);
    const portrait = this.makePortrait(job.who);
    // Vertically centred in the box; 16px inset from the left. Name plate sits
    // over the text column so it never covers the portrait art.
    portrait.setPosition(-w / 2 + 16 + 48, 0);
    const tag = this.namePlate(-w / 2 + padL, -h / 2, this.tagFor(job.who), job.who, false);
    for (const tw of words) tw.setPosition(-w / 2 + padL + tw.x, -h / 2 + padT + tw.y);
    this.arrow = s.add.text(w / 2 - 18, h / 2 - 16, 'E', {
      fontFamily: FONT, fontSize: '12px', color: C.cyan,
    }).setOrigin(0.5).setVisible(false);
    c.add([bg, accent, portrait, tag, this.arrow, ...words]);
    this.root = c;
    this.baseX = c.x;
    this.followWorld = false;
    this.boxReveal = false;
    c.setAlpha(0);
    // Slide to the settled y, but stay hidden until the first character lands.
    s.tweens.add({ targets: c, y, scaleX: 1, scaleY: 1, duration: 220, ease: 'Cubic.easeOut' });
    if (job.who === 'fern') this.reactFernLine(job.line);
    this.typewrite(job);
  }

  private bubbleAnchor(who: SayWho, fromSpeaker: boolean) {
    if (who === 'fern' && this.holo) {
      const right = this.holo.x + 86 + WRAP + 24 < 1260;
      const x = right ? this.holo.x + 86 : this.holo.x - 86;
      const y = Phaser.Math.Clamp(this.holo.y - 70, 72, 500);
      return { x, y, flip: !right, speaker: { x: this.holo.x, y: this.holo.y - 20 } };
    }
    if (who === 'noor' || fromSpeaker) {
      const x0 = this.s.noor?.x ?? this.s.x;
      const y0 = (this.s.noor?.y ?? this.s.y) - 110;
      const flip = x0 > 900;
      return {
        x: Phaser.Math.Clamp(flip ? x0 - 48 : x0 + 48, 90, 1190),
        y: Phaser.Math.Clamp(y0, 72, 500),
        flip,
        speaker: { x: x0, y: (this.s.noor?.y ?? this.s.y) - 70 },
      };
    }
    return { x: 640, y: 160, flip: false, speaker: { x: 640, y: 240 } };
  }

  private makeLineBox(x: number, y: number, job: Job, _box: boolean, flip: boolean, speaker?: { x: number; y: number }) {
    const s = this.s;
    const words = this.layoutWords(job.line, 0, 0, WRAP, false);
    let maxW = 80, maxH = 22;
    for (const w of words) {
      maxW = Math.max(maxW, w.x + w.width);
      maxH = Math.max(maxH, w.y + w.height);
    }
    const padX = 14, padT = 22, padB = 16;
    const bw = maxW + padX * 2;
    const bh = maxH + padT + padB;
    const placed = this.placeBubble({ x, y, flip, speaker }, bw, bh, padT);
    const px = placed.x;
    y = placed.y;
    flip = placed.flip;
    this.followFlip = flip;
    this.boxW = bw; this.boxH = bh; this.boxPadT = padT;
    const c = s.add.container(px, y).setDepth(DEPTH + 20).setAlpha(0).setScale(0.94);
    const ox = flip ? -bw : 0;
    const bg = this.cutPanel(ox, -padT, bw, bh, 0x07141c, 0.94, this.hexFor(job.who), 10);
    const accent = s.add.rectangle(ox + (flip ? bw - 3 : 3), -padT + bh / 2, 4, bh - 10, this.hexFor(job.who), 0.9);
    const tag = this.namePlate(flip ? -12 : 12, -padT, this.tagFor(job.who), job.who, flip);
    // Always lay words left-to-right, even when the bubble sits to the left of the speaker.
    const textLeft = (flip ? ox + padX : padX);
    for (const tw of words) {
      tw.setPosition(textLeft + tw.x, tw.y);
    }
    const tail = this.bubbleTail(ox, -padT, bw, bh, px, y, speaker ?? { x: flip ? px + 40 : px - 40, y: y + 80 }, this.hexFor(job.who));
    this.tailGfx = tail;
    this.arrow = s.add.text(textLeft + maxW, maxH + 2, 'E', {
      fontFamily: FONT, fontSize: '11px', color: C.cyan,
    }).setOrigin(1, 0).setVisible(false);
    c.add([bg, tail, accent, tag, this.arrow, ...words]);
    s.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 180, ease: 'Cubic.easeOut' });
    return c;
  }

  private followBubble() {
    if (!this.root) return;
    const anchor = this.bubbleAnchor(this.followWho, this.followFromSpeaker);
    const placed = this.placeBubble(
      { x: anchor.x, y: anchor.y, flip: this.followFlip, speaker: anchor.speaker },
      this.boxW, this.boxH, this.boxPadT,
    );
    this.root.setPosition(placed.x, placed.y);
    this.baseX = placed.x;
    const ox = this.followFlip ? -this.boxW : 0;
    const speaker = anchor.speaker ?? { x: this.followFlip ? placed.x + 40 : placed.x - 40, y: placed.y + 80 };
    const nxt = this.bubbleTail(ox, -this.boxPadT, this.boxW, this.boxH, placed.x, placed.y, speaker, this.hexFor(this.followWho));
    if (this.tailGfx) {
      const idx = this.root.getIndex(this.tailGfx);
      try { this.tailGfx.destroy(); } catch { /* */ }
      if (idx >= 0) this.root.addAt(nxt, idx);
      else this.root.add(nxt);
    } else this.root.add(nxt);
    this.tailGfx = nxt;
  }

  private noorReactToCharge(src: Source) {
    const s = this.s;
    const n = s.noor;
    if (!n) return;
    const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
    const ang = Math.atan2(src.y - s.y, src.x - s.x);
    s.dir = DIRS[(Math.round(ang / (Math.PI / 4)) + 8) % 8];
    const shield = `noor_shield_${s.dir}`;
    if (s.anims.exists(shield)) n.play(shield, true);
    else if (s.anims.exists(`noor_lookR_${s.dir}`)) n.play(`noor_lookR_${s.dir}`, true);
    else if (s.anims.exists(`noor_idle_${s.dir}`)) n.play(`noor_idle_${s.dir}`, true);
    if (n.getData('chargeReact')) return;
    n.setData('chargeReact', true);
    const back = Math.sign(s.x - src.x) || 1;
    // Step clearly off the hologram's landing spot.
    s.x += back * 22;
    s.y += 8;
    n.setPosition(s.x, s.y).setDepth(s.y + 24);
    try { s.shadow?.setPosition(s.x, s.y + 8).setDepth(s.y - 1); } catch { /* */ }
    s.time.delayedCall(1400, () => this.clearShield());
  }

  private placeShieldArm() {
    const n = this.s.noor;
    if (!n) return;
    if (!n.getData('chargeReact')) return;
    const key = `noor_shield_${this.s.dir}`;
    const cur = n.anims.currentAnim?.key ?? '';
    if (cur !== key && this.s.anims.exists(key)) n.play(key, true);
  }

  private clearShield(_resetFlag = true) {
    this.s.noor?.setData('chargeReact', false);
  }

  /** Tail sits on the box edge and points at the speaker, not straight down. */
  private bubbleTail(ox: number, oy: number, bw: number, bh: number, cx: number, cy: number, speaker: { x: number; y: number }, col: number) {
    const attachX = speaker.x < cx ? ox + 26 : ox + bw - 26;
    const attachY = oy + bh;
    const dx = speaker.x - (cx + attachX);
    const dy = speaker.y - (cy + attachY);
    const len = Math.hypot(dx, dy) || 1;
    const px = (dx / len) * 16, py = (dy / len) * 16;
    const nx = (-py / 16) * 8, ny = (px / 16) * 8;
    const tail = this.s.add.triangle(
      0, 0,
      attachX - nx, attachY - ny,
      attachX + nx, attachY + ny,
      attachX + px, attachY + py,
      0x07141c, 0.94,
    );
    tail.setStrokeStyle(1.5, col, 0.85);
    return tail;
  }

  /** Terminal panel with cut corners, inner gradient, glow and a soft drop shadow. */
  private cutPanel(x: number, y: number, w: number, h: number, fill: number, fa: number, stroke: number, cut: number) {
    const g = this.s.add.graphics();
    const c = Math.min(cut, w / 4, h / 4);
    const path = (ox: number, oy: number, ww: number, hh: number, cc: number) => {
      g.beginPath();
      g.moveTo(ox + cc, oy);
      g.lineTo(ox + ww - cc, oy);
      g.lineTo(ox + ww, oy + cc);
      g.lineTo(ox + ww, oy + hh - cc);
      g.lineTo(ox + ww - cc, oy + hh);
      g.lineTo(ox + cc, oy + hh);
      g.lineTo(ox, oy + hh - cc);
      g.lineTo(ox, oy + cc);
      g.closePath();
    };
    // Drop shadow
    g.fillStyle(0x000000, 0.38);
    path(x + 5, y + 7, w, h, c);
    g.fillPath();
    // Body
    g.fillStyle(fill, fa);
    path(x, y, w, h, c);
    g.fillPath();
    // Inner top-to-bottom gradient (banded, no flat fill)
    const inset = 2;
    const bands = 7;
    for (let i = 0; i < bands; i++) {
      const bh = (h - inset * 2) / bands;
      const tcol = i < 3 ? 0x123040 : 0x0a1c28;
      const ta = i < 3 ? 0.22 - i * 0.04 : 0.05;
      g.fillStyle(tcol, ta);
      g.fillRect(x + inset + 2, y + inset + i * bh, w - inset * 2 - 4, bh + 1);
    }
    // Soft speaker-coloured glow just outside the stroke
    g.lineStyle(5, stroke, 0.18);
    path(x, y, w, h, c);
    g.strokePath();
    g.lineStyle(1.75, stroke, 0.92);
    path(x, y, w, h, c);
    g.strokePath();
    return g;
  }

  private namePlate(x: number, y: number, label: string, who: SayWho, flip: boolean) {
    const t = this.s.add.text(0, 0, label, {
      fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#04121a', letterSpacing: 2,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
    const iconW = 16;
    const w = Math.max(78, t.width + 22 + iconW), h = 22;
    const g = this.s.add.graphics();
    const px = flip ? x - w : x;
    const py = y - h / 2;
    g.fillStyle(this.hexFor(who), 1);
    g.fillRoundedRect(px, py, w, h, 3);
    // Small speaker icon: fern frond or Noor head mark
    const ix = px + 10, iy = y;
    g.fillStyle(0x04121a, 0.9);
    if (who === 'fern') {
      g.fillTriangle(ix, iy + 6, ix - 5, iy - 4, ix + 5, iy - 4);
      g.fillCircle(ix, iy - 5, 2.2);
    } else if (who === 'noor') {
      g.fillCircle(ix, iy - 3, 3);
      g.fillTriangle(ix, iy - 1, ix - 5, iy + 6, ix + 5, iy + 6);
    } else {
      g.fillCircle(ix, iy, 3.2);
    }
    t.setPosition(px + 8 + iconW, y);
    t.setColor('#04121a');
    const c = this.s.add.container(0, 0);
    c.add([g, t]);
    return c;
  }

  private layoutWords(line: string, left: number, top: number, wrap: number, flip: boolean) {
    const bits: Phaser.GameObjects.Text[] = [];
    const parts = line.split(/(\s+)/);
    let x = 0, y = 0, rowH = 32;
    const align = flip ? 1 : 0;
    for (const part of parts) {
      if (!part) continue;
      const raw = part;
      const key = part.toLowerCase().replace(/[^a-z]/g, '');
      const isQ = !!QUALITY_FX[key];
      const style: Phaser.Types.GameObjects.Text.TextStyle = {
        fontFamily: UI, fontSize: '20px', fontStyle: isQ ? 'bold' : '500',
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

  private revealBox() {
    if (this.boxReveal || !this.root) return;
    this.boxReveal = true;
    this.s.tweens.add({ targets: this.root, alpha: 1, duration: 160, ease: 'Cubic.easeOut' });
  }

  private refreshBits(all: boolean) {
    if (this.typed.length > 0) this.revealBox();
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
    this.followWorld = false;
    this.tailGfx = undefined;
    this.letterBits = [];
    this.arrow = undefined;
    this.portraitSpr = undefined;
    this.portraitEyes = undefined;
    if (root) {
      try { this.s.tweens.killTweensOf(root); } catch { /* */ }
      try { for (const child of root.list ?? []) this.s.tweens.killTweensOf(child); } catch { /* */ }
      this.s.tweens.add({
        targets: root, alpha: 0, duration: 180,
        onComplete: () => { try { root.destroy(); } catch { /* */ } },
      });
    }
    // Keep Fern's hologram up briefly between her lines; dismiss if the next job isn't hers.
    const next = this.queue[0];
    if (!next || next.who !== 'fern') {
      const h = this.holo;
      this.holo = undefined;
      this.holoBody = undefined;
      this.holoGlow = undefined;
      this.source = undefined;
      this.clearFernAct();
      if (h) this.s.tweens.add({ targets: h, alpha: 0, y: h.y + 18, duration: 280, onComplete: () => h.destroy() });
    }
    this.at(200, () => { this.busy = false; this.kick(); });
  }

  private makePortrait(who: SayWho) {
    const s = this.s;
    const SIZE = 96;
    const col = this.hexFor(who);
    const c = s.add.container(0, 0);
    const frame = s.add.graphics();
    frame.fillStyle(0x041018, 0.92);
    frame.fillRoundedRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE, 8);
    frame.lineStyle(2.5, col, 0.95);
    frame.strokeRoundedRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE, 8);
    frame.lineStyle(5, col, 0.16);
    frame.strokeRoundedRect(-SIZE / 2 - 1, -SIZE / 2 - 1, SIZE + 2, SIZE + 2, 9);
    c.add(frame);
    if (who === 'fern' && s.textures.exists('fern_plant')) {
      // Opaque plant is 160×153 starting at y=56 in a 160×220 frame; visual centre ~(80, 132).
      // Atlas pivot is (0.5, 0.93) for the floor hologram — force the visual centre here
      // or the pot sits mid-frame with a hole under it.
      const PAD = 8;
      const inner = SIZE - PAD * 2;
      const scale = Math.min(inner / 160, inner / 153);
      const ox = 0.5, oy = 132 / 220;
      const spr = s.add.sprite(0, 0, 'fern_plant', 'fern_plant_S_00');
      spr.setOrigin(ox, oy).setScale(scale);
      try { spr.play('fern_plant_S'); } catch { /* */ }
      spr.setOrigin(ox, oy);
      spr.on('animationupdate', () => { if (spr.active && spr.scene) spr.setOrigin(ox, oy); });
      this.portraitSpr = spr;
      const eyes = s.add.graphics();
      eyes.setData('faceY', (96 - 132) * scale);
      eyes.setData('faceScale', scale);
      this.portraitEyes = eyes;
      c.add(spr);
      c.add(eyes);
    } else if (who === 'noor' && s.textures.exists('noor_idle')) {
      const spr = s.add.sprite(0, 10, 'noor_idle', 'noor_idle_S_00');
      try { spr.setCrop(40, 20, 110, 110); } catch { /* */ }
      spr.setOrigin(0.5, 0.45).setScale(0.95);
      this.portraitSpr = spr;
      c.add(spr);
    } else {
      const g = s.add.graphics();
      g.fillStyle(col, 0.28).fillEllipse(0, 0, 70, 78);
      g.lineStyle(2, col, 0.8).strokeEllipse(0, 0, 70, 78);
      c.add(g);
    }
    return c;
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

  /** Camera-visible world rect with a small margin. */
  private viewRect() {
    const v = this.s.cameras.main.worldView;
    const pad = 18;
    return { x: v.x + pad, y: v.y + pad, w: v.width - pad * 2, h: v.height - pad * 2 };
  }

  private screenToWorldRect(p: { x: number; y: number; w: number; h: number }) {
    const cam = this.s.cameras.main;
    const tl = cam.getWorldPoint(p.x, p.y);
    const br = cam.getWorldPoint(p.x + p.w, p.y + p.h);
    const x = Math.min(tl.x, br.x), y = Math.min(tl.y, br.y);
    return { x, y, w: Math.abs(br.x - tl.x), h: Math.abs(br.y - tl.y) };
  }

  private avoidRects() {
    const rects: { x: number; y: number; w: number; h: number }[] = [];
    try {
      const panels = this.s.intro?.panelBounds?.() ?? [];
      for (const p of panels) {
        rects.push(p.screen ? this.screenToWorldRect(p) : p);
      }
    } catch { /* */ }
    return rects;
  }

  /** Keep a bubble inside the camera view and off open panels (mail, etc.). */
  private placeBubble(
    pref: { x: number; y: number; flip: boolean; speaker?: { x: number; y: number } },
    bw: number, bh: number, padT: number,
  ) {
    const view = this.viewRect();
    const avoids = this.avoidRects();
    const box = (x: number, y: number, flip: boolean) => ({
      x: flip ? x - bw : x,
      y: y - padT,
      w: bw,
      h: bh,
    });
    const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const clamp = (x: number, y: number, flip: boolean) => {
      const r = box(x, y, flip);
      if (r.x < view.x) x += view.x - r.x;
      if (r.x + r.w > view.x + view.w) x -= (r.x + r.w) - (view.x + view.w);
      if (r.y < view.y) y += view.y - r.y;
      if (r.y + r.h > view.y + view.h) y -= (r.y + r.h) - (view.y + view.h);
      return { x, y, flip, r: box(x, y, flip) };
    };
    const hits = (r: { x: number; y: number; w: number; h: number }) => avoids.some(a => overlaps(r, a));
    const inView = (r: { x: number; y: number; w: number; h: number }) =>
      r.x >= view.x - 1 && r.y >= view.y - 1 && r.x + r.w <= view.x + view.w + 1 && r.y + r.h <= view.y + view.h + 1;

    const sp = pref.speaker ?? { x: pref.x, y: pref.y + 80 };
    const tries: { x: number; y: number; flip: boolean }[] = [
      { x: pref.x, y: pref.y, flip: pref.flip },
      { x: pref.x, y: pref.y, flip: !pref.flip },
      { x: sp.x + 48, y: sp.y - 90, flip: false },
      { x: sp.x - 48, y: sp.y - 90, flip: true },
      { x: sp.x + 48, y: sp.y + 36, flip: false },
      { x: sp.x - 48, y: sp.y + 36, flip: true },
    ];
    for (const a of avoids) {
      tries.push({ x: a.x - 14, y: pref.y, flip: true });
      tries.push({ x: a.x + a.w + 14, y: pref.y, flip: false });
      tries.push({ x: pref.x, y: a.y - bh + padT - 12, flip: pref.flip });
      tries.push({ x: pref.x, y: a.y + a.h + padT + 12, flip: pref.flip });
    }
    for (const t of tries) {
      const c = clamp(t.x, t.y, t.flip);
      if (inView(c.r) && !hits(c.r)) return { x: c.x, y: c.y, flip: c.flip };
    }
    // Last resort: clamp the preferred pose into the view even if a panel still clips.
    const fallback = clamp(pref.x, pref.y, pref.flip);
    return { x: fallback.x, y: fallback.y, flip: fallback.flip };
  }

  private moodFrom(line: string): { mood: 'happy' | 'sad' | 'worried' | 'alarmed' | 'lean' | 'neutral'; emote?: '!' | '?' | '...' | 'sparkle' } {
    const l = line.toLowerCase();
    if (/\?/.test(line) && /(who|what|where|why|and you)/.test(l)) return { mood: 'lean', emote: '?' };
    if (/wasn['’]t yours|not supposed|no shadow|fight\.|split the claim|don['’]t tell|not me\b/.test(l))
      return { mood: 'alarmed', emote: '!' };
    if (/something is wrong|lift is dead|not here|only the owner|isn['’]t true|you keep saying|they said you wouldn/.test(l)
        || (/\b(dead|wrong)\b/.test(l) && /lift|send|wall/.test(l)))
      return { mood: 'worried', emote: '...' };
    if (/office plant|you talked to me|every morning|it likes you|good\.|you found me|that['’]s all of it|for now, go through|came back|it woke up/.test(l))
      return { mood: 'happy', emote: 'sparkle' };
    if (/same rule|words catch|inside everything|say something|look\.|try the lift|left you a note|psst|it['’]ll help|then go down|try \w/.test(l)
        || /\?/.test(line))
      return { mood: 'lean', emote: /\?/.test(line) ? '?' : '...' };
    return { mood: 'neutral' };
  }

  private reactFernLine(line: string) {
    try {
      const r = this.moodFrom(line);
      this.reactFern(r.mood, r.emote);
    } catch { /* reaction must never break dialogue */ }
  }

  private living(o?: Phaser.GameObjects.GameObject | null) {
    return !!o && o.active && !!(o as Phaser.GameObjects.GameObject & { scene?: Phaser.Scene }).scene;
  }

  private clearFernAct() {
    this.fernActUntil = 0;
    for (const e of this.fernEmotes) { try { this.s.tweens.killTweensOf(e); e.destroy(); } catch { /* */ } }
    this.fernEmotes = [];
    if (this.living(this.holo)) { try { this.s.tweens.killTweensOf(this.holo!); } catch { /* */ } }
    if (this.living(this.holoBody)) {
      try { this.s.tweens.killTweensOf(this.holoBody!); } catch { /* */ }
      try { this.holoBody!.setRotation(0).clearTint(); } catch { /* */ }
    }
    if (this.living(this.holoGlow)) {
      try { this.s.tweens.killTweensOf(this.holoGlow!); } catch { /* */ }
      try { this.holoGlow!.setRotation(0); } catch { /* */ }
    }
    if (this.living(this.portraitSpr)) {
      try { this.s.tweens.killTweensOf(this.portraitSpr!); } catch { /* */ }
      try { this.portraitSpr!.clearTint().setRotation(0); } catch { /* */ }
    }
    try { if (this.living(this.portraitEyes)) this.portraitEyes!.clear(); } catch { /* */ }
  }

  private drawPortraitEyes(kind: 'alarmed' | 'sad' | 'happy' | 'none') {
    const g = this.portraitEyes;
    if (!g) return;
    g.clear();
    // Baked face centre is ~(80, 96) in the 160×220 frame.
    const fy = (g.getData('faceY') as number) ?? -18;
    const sc = (g.getData('faceScale') as number) ?? 0.5;
    const eyeX = 10 * sc / 0.5;
    if (kind === 'alarmed') {
      // Cover the baked smile/eyes with a head disc, then draw wide eyes + an O mouth.
      g.fillStyle(0x7ed0c8, 0.95);
      g.fillCircle(0, fy, 13 * sc / 0.5);
      g.fillStyle(0xffffff, 0.98);
      g.fillEllipse(-eyeX, fy - 1, 9, 11);
      g.fillEllipse(eyeX, fy - 1, 9, 11);
      g.fillStyle(0x1a1020, 0.95);
      g.fillCircle(-eyeX, fy - 1, 2.8);
      g.fillCircle(eyeX, fy - 1, 2.8);
      g.lineStyle(1.6, 0x1a1020, 0.95);
      g.strokeCircle(0, fy + 7, 3.2);
    } else if (kind === 'sad') {
      g.fillStyle(0x7ed0c8, 0.9);
      g.fillCircle(0, fy, 13 * sc / 0.5);
      g.fillStyle(0xffffff, 0.95);
      g.fillEllipse(-eyeX, fy + 1, 8, 6);
      g.fillEllipse(eyeX, fy + 1, 8, 6);
      g.fillStyle(0x1a1020, 0.95);
      g.fillCircle(-eyeX, fy + 2, 2.2);
      g.fillCircle(eyeX, fy + 2, 2.2);
      g.fillStyle(0x1a2030, 0.75);
      g.fillEllipse(-eyeX, fy - 3, 9, 3);
      g.fillEllipse(eyeX, fy - 3, 9, 3);
      g.lineStyle(1.6, 0x1a1020, 0.9);
      g.beginPath();
      g.arc(0, fy + 9, 4, Math.PI * 1.15, Math.PI * 1.85, true);
      g.strokePath();
    } else if (kind === 'happy') {
      // Keep the baked smile; just add a slight cheek glow.
      g.fillStyle(0xe27bd8, 0.28);
      g.fillCircle(-eyeX - 4, fy + 5, 3.2);
      g.fillCircle(eyeX + 4, fy + 5, 3.2);
    }
  }

  private spawnFernEmote(kind: '!' | '?' | '...' | 'sparkle') {
    const s = this.s;
    const hx = this.holo?.x ?? (this.s.noor?.x ?? 640) + 80;
    const hy = (this.holo?.y ?? 400) - 100;
    if (kind === 'sparkle') {
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i - 2) * 0.45;
        const x = hx + Math.cos(ang) * 8, y = hy + Math.sin(ang) * 6;
        const st = s.add.graphics().setDepth(DEPTH + 50).setPosition(x, y);
        st.fillStyle(0xf8f0a8, 0.95);
        st.fillTriangle(0, -7, 4, 0, 0, 7);
        st.fillTriangle(0, -7, -4, 0, 0, 7);
        this.fernEmotes.push(st);
        s.tweens.add({
          targets: st,
          x: x + Math.cos(ang) * 22,
          y: y + Math.sin(ang) * 18 - 8,
          alpha: 0,
          scale: 1.3,
          duration: 1100,
          ease: 'Sine.easeOut',
          onComplete: () => { try { st.destroy(); } catch { /* */ } },
        });
      }
      return;
    }
    const label = kind === '...' ? '…' : kind;
    const t = s.add.text(hx, hy, label, {
      fontFamily: FONT, fontSize: kind === '...' ? '22px' : '28px', fontStyle: 'bold', color: '#e27bd8',
    }).setOrigin(0.5).setDepth(DEPTH + 50).setAlpha(0);
    this.fernEmotes.push(t);
    s.tweens.add({
      targets: t, alpha: 1, y: hy - 16, duration: 220, ease: 'Cubic.easeOut',
      onComplete: () => s.tweens.add({ targets: t, alpha: 0, y: hy - 28, delay: 900, duration: 280, onComplete: () => t.destroy() }),
    });
  }

  private reactFern(mood: 'happy' | 'sad' | 'worried' | 'alarmed' | 'lean' | 'neutral', emote?: '!' | '?' | '...' | 'sparkle') {
    this.clearFernAct();
    if (mood === 'neutral' && !emote) return;
    const body = this.holoBody;
    const glow = this.holoGlow;
    const targets = [body, glow].filter((v): v is Phaser.GameObjects.Sprite => !!v);
    const spr = this.portraitSpr;
    this.fernActUntil = this.s.time.now + 1800;
    const noorX = this.s.noor?.x ?? 0;
    const hx = this.holo?.x ?? 0;
    const toward = noorX <= hx ? -1 : 1;

    if (mood === 'happy') {
      if (targets.length) {
        this.s.tweens.add({
          targets, y: '-=14', scaleY: (body?.scaleY ?? 1) * 1.16,
          duration: 200, yoyo: true, repeat: 3, ease: 'Sine.easeOut',
        });
      }
      if (spr) {
        this.s.tweens.add({
          targets: spr, y: spr.y - 4, scaleY: spr.scaleY * 1.08,
          duration: 180, yoyo: true, repeat: 2, ease: 'Sine.easeOut',
        });
        this.drawPortraitEyes('happy');
      }
    } else if (mood === 'sad' || mood === 'worried') {
      if (targets.length) {
        this.s.tweens.add({
          targets, rotation: toward * 0.16, y: '+=8', scaleY: (body?.scaleY ?? 1) * 0.86,
          duration: 340, ease: 'Sine.easeOut',
        });
      }
      if (spr) {
        spr.setTint(0xc8d4e8);
        this.s.tweens.add({ targets: spr, y: spr.y + 5, rotation: 0.1, duration: 300, ease: 'Sine.easeOut' });
        this.drawPortraitEyes('sad');
      }
    } else if (mood === 'alarmed') {
      if (targets.length) {
        this.s.tweens.add({ targets, x: '+=6', duration: 40, yoyo: true, repeat: 9, ease: 'Sine.easeInOut' });
      }
      if (this.holo) {
        this.s.tweens.add({ targets: this.holo, alpha: { from: 1, to: 0.55 }, duration: 50, yoyo: true, repeat: 6 });
      }
      // Short glitch bars over the plant.
      if (this.holo) {
        for (let i = 0; i < 4; i++) {
          const bar = this.s.add.rectangle(
            this.holo.x + (Math.random() - 0.5) * 28,
            this.holo.y - 40 + Math.random() * 50,
            16 + Math.random() * 18, 2 + Math.random() * 2,
            Math.random() > 0.5 ? 0x78e4e8 : 0xe27bd8, 0.8,
          ).setDepth(DEPTH + 8);
          this.fernEmotes.push(bar);
          this.s.tweens.add({ targets: bar, alpha: 0, x: bar.x + (Math.random() - 0.5) * 16, duration: 160 + i * 40, onComplete: () => bar.destroy() });
        }
      }
      if (spr) {
        spr.setTint(0xffe8a0);
        this.s.tweens.add({ targets: spr, x: spr.x + 3, duration: 40, yoyo: true, repeat: 8 });
        this.drawPortraitEyes('alarmed');
      }
    } else if (mood === 'lean') {
      if (targets.length) {
        this.s.tweens.add({
          targets, rotation: toward * -0.14, x: `+=${toward * 10}`,
          duration: 280, ease: 'Sine.easeOut',
        });
      }
      if (spr) this.s.tweens.add({ targets: spr, rotation: toward * -0.08, x: spr.x + toward * 3, duration: 260 });
    }
    if (emote) this.spawnFernEmote(emote);
  }

  private at(ms: number, fn: () => void) {
    this.timers.push(this.s.time.delayedCall(ms, fn));
  }
}

