// The Draft (Phase 1 boss), per docs/story/enemies.md. 3 bars x 12 HP = 36 HP (~27 Caret hits unguarded).
import Phaser from 'phaser';
import tokens from './tokens.json';
import { topWord, writeSave, recomputeGrowth } from './save';
import { sfx } from './sfx';
import type { GameScene, Enemy } from './game';

const C = tokens.color; const hex = (s: string) => parseInt(s.slice(1), 16);
export const DRAFT = {
  hp: 36, bar: 12, guardMult: 0.25, punishMult: 2, guardBreakS: 7, punishS: 2,
  swipeTell: [0.6, 0.5, 0.42], swipeGap: 0.3, swipe2Tell: 0.38, swipeR: 120, swipeCone: 1.1,
  ringTell: 0.9, ringSpeed: 360, ringBand: 16, ringMax: 560,
  tossTell: [0.65, 0.55, 0.5], ballSpeed: [320, 350, 380], ballSpread: 0.38, ballR: 13,
  gap: [1.0, 0.8, 0.62], move: [90, 110, 130], fakeHits: 3,
};
interface Ball { x: number; y: number; vx: number; vy: number; g: Phaser.GameObjects.Arc; life: number }

export class DraftFight {
  real!: Enemy; fake: Enemy | null = null;
  split = false; guardT = 0; ring: { x: number; y: number; r: number; g: Phaser.GameObjects.Graphics; hit: boolean } | null = null;
  balls: Ball[] = []; attackN = 0; won = false; punishCount = 0; lastTell = ''; tellCount = 0;
  bar!: Phaser.GameObjects.Graphics; barLabel!: Phaser.GameObjects.Text; status!: Phaser.GameObjects.Text;

  constructor(private s: GameScene) {
    this.bar = s.add.graphics().setScrollFactor(0).setDepth(4050); s.objs.push(this.bar);
    this.barLabel = s.add.text(640, 22, 'the_draft', { fontFamily: 'JetBrains Mono', fontSize: '13px', fontStyle: 'bold', color: C.coral }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(4050); s.objs.push(this.barLabel);
    this.status = s.add.text(640, 58, '', { fontFamily: 'IBM Plex Mono', fontSize: '12px', color: C.dim }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(4050); s.objs.push(this.status);
    this.spawn();
  }
  get guarded() { return this.guardT <= 0; }
  phase() { const h = this.real.hp; return h > 24 ? 0 : h > 12 ? 1 : 2; }
  spawn() {
    this.real = this.s.spawnEnemy('draft', 640, 340); this.real.hp = this.real.maxHp = DRAFT.hp; this.real.state = 'intro'; this.real.t = 1.4;
    this.real.g.setAlpha(0); this.s.tweens.add({ targets: this.real.g, alpha: 1, duration: 1200 });
  }
  /** fight restart at the arena door (boss death rule). Puzzle progress elsewhere is kept. */
  reset() {
    for (const b of this.balls) b.g.destroy(); this.balls = []; this.ring?.g.destroy(); this.ring = null;
    if (this.fake) { this.fake.dead = true; this.fake.g.destroy(); this.fake.flash?.clear(); this.fake = null; }
    this.real.dead = true; this.real.g.destroy(); this.real.flash?.clear();
    this.s.enemies = this.s.enemies.filter(e => e.kind !== 'draft');
    this.split = false; this.guardT = 0; this.attackN = 0; this.restoreGuard();
    this.spawn(); this.real.t = 1.0;
  }
  setGuardWord(w: string) {
    const g = this.s.plateById('r_guard'); if (!g) return;
    if (w === 'WEAK' && this.guardT <= 0) { this.guardT = DRAFT.guardBreakS; this.guardToast('GUARD BROKEN', C.ok); sfx('win'); }
    if (w !== 'WEAK') this.guardT = 0;
  }
  restoreGuard() {
    const g = this.s.plateById('r_guard'), w = this.s.plateById('r_weak'); if (!g || !w) return;
    const word = this.split ? topWord(this.s.save) : 'STRONG';
    g.setSlotWord(word === 'WEAK' ? 'STRONG' : word); w.setSlotWord('WEAK');
    if (this.s.hand && (this.s.hand.from === 'r_guard' || this.s.hand.from === 'r_weak')) this.s.hand = null;
    for (const p of [g, w]) p.setOpts({ ...p.opts, selected: false });
    delete this.s.save.plates.r_guard; delete this.s.save.plates.r_weak;
  }
  /** damage modifiers: guard, punish window, fake */
  modify(e: Enemy, dmg: number): number {
    if (e.state === 'intro') return 0;
    if (e === this.fake) { e.phase++; if (e.phase >= DRAFT.fakeHits) this.dropFake(); return 0; }
    if (this.fake) this.dropFake();
    let m = 1;
    if (this.guarded) { m *= DRAFT.guardMult; sfx('block'); this.s.floorText(e.x + 40, e.y - 120, 'BLOCKED', C.dim, 13, 500); }
    if (e.state === 'punish') m *= DRAFT.punishMult;
    const out = dmg * m;
    if (!this.split && e.hp - out <= DRAFT.hp / 2) { this.doSplit(); }
    if (e.hp - out <= 0) this.onDefeat();
    return out;
  }
  dropFake() { const f = this.fake; if (!f) return; this.fake = null; f.dead = true; f.flash?.clear(); this.s.tweens.add({ targets: f.g, alpha: 0, scaleX: 1.4, duration: 300, onComplete: () => f.g.destroy() }); }
  doSplit() {
    this.split = true;
    const f = this.s.spawnEnemy('draft', this.real.x + 120, this.real.y); f.hp = f.maxHp = 999; f.state = 'idle'; f.t = 0.8; f.phase = 0;
    this.fake = f; this.real.x -= 60;
    this.s.cameras.main.flash(160, 230, 230, 230);
    const g = this.s.plateById('r_guard');
    if (g && this.guarded) g.setSlotWord(topWord(this.s.save) === 'WEAK' ? 'STRONG' : topWord(this.s.save));
    this.s.say('fern', 'Two of them. Only one reads.', 2200);
  }
  onDefeat() {
    if (this.won) return; this.won = true; const s = this.s, sv = s.save;
    if (!sv.draftLastBarDeath && !sv.defeated.includes('draft_clean')) sv.defeated.push('draft_clean');
    recomputeGrowth(sv);
    this.dropFake(); for (const b of this.balls) b.g.destroy(); this.balls = []; this.ring?.g.destroy(); this.ring = null;
    s.plateById('r_guard')?.setVisibleState(false); s.plateById('r_weak')?.setVisibleState(false); s.hand = null;
    const shard = s.add.text(this.real.x, this.real.y - 20, 'FILED: \u2588\u2588/\u2588\u2588', { fontFamily: 'JetBrains Mono', fontSize: '16px', fontStyle: 'bold', color: C.lamp, backgroundColor: 'rgba(4,12,18,0.8)', padding: { x: 8, y: 4 } }).setOrigin(0.5).setDepth(3300);
    s.objs.push(shard); s.tweens.add({ targets: shard, y: this.real.y - 80, duration: 1200, ease: 'Sine.easeOut' });
    if (!sv.defeated.includes('shard1')) sv.defeated.push('shard1');
    sfx('win'); writeSave(sv);
  }

  private guardToast(text: string, color: string) {
    const t = this.s.add.text(640, 100, text, { fontFamily: 'JetBrains Mono', fontSize: '18px', fontStyle: 'bold', color, backgroundColor: 'rgba(4,12,18,0.78)', padding: { x: 10, y: 4 } }).setOrigin(0.5).setScrollFactor(0).setDepth(4060);
    this.s.objs.push(t);
    this.s.tweens.add({ targets: t, alpha: 0, y: 88, delay: 1100, duration: 300, onComplete: () => t.destroy() });
  }
  update(rdt: number, dt: number) {
    const s = this.s, e = this.real;
    if (this.guardT > 0 && !this.won) { this.guardT -= rdt; if (this.guardT <= 0) { this.guardT = 0; this.restoreGuard(); this.guardToast('RE-GUARD', C.coral); } }
    // guard sign follows the real Draft
    const g = s.plateById('r_guard');
    if (g && !e.dead) { g.def.x = e.x; g.def.y = e.y; const sy = Math.max(100, e.y - 150); g.def.sx = e.x; g.def.sy = sy; g.container.setPosition(e.x, sy); }
    // projectiles (scaled by bullet time)
    for (const b of [...this.balls]) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; b.g.setPosition(b.x, b.y - 30).setDepth(b.y);
      if (Math.hypot(b.x - s.x, b.y - s.y) < DRAFT.ballR + 14) { if (s.hurtNoor('ball')) { b.life = 0; } }
      if (b.life <= 0) { b.g.destroy(); this.balls.splice(this.balls.indexOf(b), 1); }
    }
    if (this.ring) {
      const r = this.ring; r.r += DRAFT.ringSpeed * dt; r.g.clear();
      r.g.lineStyle(DRAFT.ringBand * 2, 0xe6fcfc, 0.18).strokeCircle(r.x, r.y, r.r).lineStyle(3, 0xe6fcfc, 0.9).strokeCircle(r.x, r.y, r.r);
      r.g.fillStyle(0xe6fcfc, 0.7); r.g.setDepth(-500);
      const d = Math.hypot(s.x - r.x, s.y - r.y);
      if (!r.hit && Math.abs(d - r.r) < DRAFT.ringBand) { if (s.hurtNoor('ring')) r.hit = true; }
      if (r.r > DRAFT.ringMax) { r.g.destroy(); this.ring = null; }
    }
    // HUD bar
    const b = this.bar; b.clear(); const segW = 130;
    for (let i = 0; i < 3; i++) {
      const x = 640 - segW * 1.5 + i * (segW + 6) - 6, fill = Phaser.Math.Clamp((e.hp - i * DRAFT.bar) / DRAFT.bar, 0, 1);
      b.fillStyle(0x1a0e10, 0.9).fillRect(x, 40, segW, 9); b.fillStyle(hex(C.coral), 1).fillRect(x, 40, segW * fill, 9); b.lineStyle(1, hex(C.faint), 1).strokeRect(x, 40, segW, 9);
    }
    this.status.setText(this.won ? '' : `${this.guarded ? 'guard: ' + (g?.slotWord ?? 'STRONG') : `guard broken ${this.guardT.toFixed(1)}s`}${e.state === 'punish' ? '   PUNISH x2' : ''}`).setColor(this.guarded ? C.dim : C.ok);
  }

  /** per-Draft AI; called from updateEnemies with scaled dt */
  think(e: Enemy, dt: number) {
    const s = this.s, fake = e === this.fake, ph = this.phase();
    const dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy) || 1, fl = e.flash!;
    const spr = e.g.list.find(o => o instanceof Phaser.GameObjects.Sprite) as Phaser.GameObjects.Sprite;
    const tint = (c: number) => spr?.setTint(c);
    if (e.state === 'intro') { if (e.t <= 0) { e.state = 'idle'; e.t = 0.8; } return; }
    if (this.won) return;
    if (e.state === 'idle') {
      tint(this.guarded || fake ? 0x9aa0a8 : 0xc8a0a0);
      if (d > 150) { e.x += dx / d * DRAFT.move[ph] * dt; e.y += dy / d * DRAFT.move[ph] * dt; }
      if (e.t <= 0) {
        this.attackN++;
        const pick = fake ? 'swipe' : this.attackN % 3 === 0 ? 'ring' : d < 190 ? 'swipe' : 'toss';
        e.state = pick + 'Tell'; e.t = pick === 'swipe' ? DRAFT.swipeTell[ph] : pick === 'ring' ? DRAFT.ringTell : DRAFT.tossTell[ph];
        e.tx = Math.atan2(dy, dx); this.lastTell = pick; this.tellCount++; sfx('tell');
        if (fake) e.t += 0.2;
      }
    }
    const cone = (a: number, alpha: number) => { fl.fillStyle(hex(C.coral), alpha); fl.slice(e.x, e.y, DRAFT.swipeR, a - DRAFT.swipeCone, a + DRAFT.swipeCone, false); fl.fillPath(); fl.lineStyle(2, hex(C.coral), 0.9); fl.beginPath(); fl.arc(e.x, e.y, DRAFT.swipeR, a - DRAFT.swipeCone, a + DRAFT.swipeCone); fl.strokePath(); };
    const swipeHit = (a: number) => { let da = Math.abs(Math.atan2(dy, dx) - a); if (da > Math.PI) da = 2 * Math.PI - da; if (d < DRAFT.swipeR + 8 && da < DRAFT.swipeCone + 0.15) s.hurtNoor('swipe'); s.cameras.main.shake(60, 0.003); };
    if (e.state === 'swipeTell') { tint(0xf08074); e.g.setScale(1.05, 0.95); cone(e.tx, 0.12 + 0.35 * (1 - e.t / DRAFT.swipeTell[ph])); if (e.t <= 0) { swipeHit(e.tx); e.state = 'swipeGap'; e.t = DRAFT.swipeGap; e.g.setScale(1); } }
    else if (e.state === 'swipeGap') { if (e.t <= 0) { e.tx = Math.atan2(dy, dx); e.state = 'swipe2Tell'; e.t = DRAFT.swipe2Tell; sfx('tell'); } }
    else if (e.state === 'swipe2Tell') { tint(0xf08074); cone(e.tx, 0.12 + 0.35 * (1 - e.t / DRAFT.swipe2Tell)); if (e.t <= 0) { swipeHit(e.tx); e.state = 'recover'; e.t = 0.55; } }
    else if (e.state === 'ringTell') {
      tint(0xffffff); e.g.setScale(1, 1 + 0.15 * (1 - e.t / DRAFT.ringTell));
      fl.lineStyle(3, 0xe6fcfc, 0.4 + 0.5 * Math.abs(Math.sin(e.t * 18))).strokeCircle(e.x, e.y, 30 + 20 * (1 - e.t / DRAFT.ringTell));
      if (e.t <= 0) { const g = s.add.graphics(); s.objs.push(g); this.ring = { x: e.x, y: e.y, r: 30, g, hit: false }; sfx('ring'); s.floorText(e.x, e.y - 150, 'REPHRASE', '#E6FCFC', 18, 700); e.g.setScale(1); e.state = 'punish'; e.t = DRAFT.punishS; this.punishCount++; }
    }
    else if (e.state === 'punish') { tint(0x6a9ab0); e.g.setRotation(Math.sin(s.t * 3) * 0.05); fl.lineStyle(1, hex(C.cyan), 0.6).strokeCircle(e.x, e.y - 60, 40); if (e.t <= 0) { e.g.setRotation(0); e.state = 'idle'; e.t = DRAFT.gap[ph]; } }
    else if (e.state === 'tossTell') {
      tint(0xf6c684); e.g.setRotation(-0.12);
      for (const k of [-1, 0, 1]) { const a = e.tx + k * DRAFT.ballSpread; fl.lineStyle(2, hex(C.coral), 0.25 + 0.4 * (1 - e.t / DRAFT.tossTell[ph])); fl.lineBetween(e.x, e.y, e.x + Math.cos(a) * 260, e.y + Math.sin(a) * 260); }
      if (e.t <= 0) {
        e.g.setRotation(0.1);
        for (const k of [-1, 0, 1]) { const a = e.tx + k * DRAFT.ballSpread, v = DRAFT.ballSpeed[ph]; const g = s.add.circle(e.x, e.y - 30, DRAFT.ballR, 0xe8e2d4).setStrokeStyle(2, 0x8a826e); s.objs.push(g); this.balls.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g, life: 2.4 }); }
        e.state = ph === 2 && e.phase !== 1 ? 'tossAgain' : 'recover'; e.t = 0.4; e.phase = e.state === 'tossAgain' ? 1 : 0;
      }
    }
    else if (e.state === 'tossAgain') { if (e.t <= 0) { e.tx = Math.atan2(dy, dx); e.state = 'tossTell'; e.t = DRAFT.tossTell[ph] * 0.7; } }
    else if (e.state === 'recover' || e.state === 'stun') { tint(0x9aa0a8); e.g.setRotation(0); if (e.t <= 0) { e.state = 'idle'; e.t = DRAFT.gap[ph]; } }
    e.x = Phaser.Math.Clamp(e.x, 420, 860); e.y = Phaser.Math.Clamp(e.y, 200, 640);
  }
}
