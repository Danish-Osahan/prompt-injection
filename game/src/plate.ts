// Word plates are DATA now (locked hybrid, 2 Nov 2026): no mounted world signs. Each plate feeds
//  - a subtitle CAPTION line (normal view): `cap` with {} where the swappable word sits as a tappable chip,
//  - a CODE line (hold READ): `obj.field = VALUE;`,
//  - optionally a lens-only SECRET (hold READ near it; only visible inside the lens around Noor).
// def.x/def.y = where Noor stands to read it (reach point); def.sx/def.sy = the object it describes (highlight + code line anchor).
import Phaser from 'phaser';

export type PlateKind = 'rule' | 'lore' | 'fixed' | 'secret' | 'look' | 'line' | 'unlock';
export type Mount = 'screws' | 'bracket' | 'string' | 'tape';
export interface PlateDef {
  id: string; words: string[]; slot: number; x: number; y: number; sx: number; sy: number; mount?: Mount; kind: PlateKind; hidden?: boolean; text?: string; note?: boolean;
  cap?: string;            // caption, {} = the slot word (or the redaction for lore)
  code?: string;           // "obj.field" for the code line
  val?: string;            // code value for non-slot plates (defaults to the last word)
  redact?: string;         // caption shows ██ instead; code view shows this true value
  toy?: boolean;           // art-v8: optional word-swap toy (swaps only with the other toy in its room; harmless, funny)
  cap2?: string; val2?: string;   // art-v8: revisit variants (2nd+ visit to the room)
  line?: string;           // art-v8: lost-line text (kind 'line')
  after?: 'draft';         // art-v8: only appears once the Draft is beaten
}
export interface DrawOpts { selected?: boolean; glow?: string }

export class Plate {
  container: Phaser.GameObjects.Container;   // invisible anchor that follows the object (the Draft's guard plate moves)
  focused = false;
  visible = true;
  opts: DrawOpts = {};
  glowT = 0;                                  // > 0 after a pulse (checkpoint / swap): caption + highlight flash
  glowCol = '#F6C684';
  alt = false;                                // revisit variant
  constructor(scene: Phaser.Scene, public def: PlateDef, public words: string[]) {
    this.container = scene.add.container(def.sx, def.sy);
    this.setVisibleState(!def.hidden);
  }
  get slotWord() { return this.def.slot >= 0 ? this.words[this.def.slot] : null; }
  setSlotWord(w: string) { this.words[this.def.slot] = w; }
  setOpts(o: DrawOpts) { this.opts = o; }
  bounds(pad = 24) { return new Phaser.Geom.Rectangle(this.container.x - 60 - pad, this.container.y - 30 - pad, 120 + pad * 2, 60 + pad * 2); }
  setFocus(on: boolean) { if (this.visible) this.focused = on; }
  setVisibleState(v: boolean) { this.visible = v; if (!v) this.focused = false; }
  pulse(color = '#F6C684') { this.glowT = 0.7; this.glowCol = color; }
  /** caption pieces: [before, slot, after]; slot === '' when the plate has no chip */
  caption(redacted = true): { pre: string; word: string; post: string; chip: boolean; red: boolean } {
    const d = this.def; const cap = (this.alt && d.cap2) || (d.cap ?? this.words.join(' ') + '.');
    const i = cap.indexOf('{}');
    if (i < 0) return { pre: cap, word: '', post: '', chip: false, red: false };
    const red = !!d.redact && redacted;
    const word = d.slot >= 0 ? this.slotWord! : red ? '\u2588'.repeat(6) : d.redact ?? '';
    return { pre: cap.slice(0, i), word, post: cap.slice(i + 2), chip: d.slot >= 0, red };
  }
  codeLine() {
    const d = this.def; const obj = d.code ?? `${d.words[0].toLowerCase().replace(/[^a-z0-9]/g, '')}.state`;
    const v = d.slot >= 0 ? this.slotWord! : d.redact ?? ((this.alt && d.val2) || d.val) ?? d.words[d.words.length - 1];
    return { lhs: `${obj} = `, val: v, chip: d.slot >= 0 };
  }
  destroy() { this.container.destroy(); }
}
