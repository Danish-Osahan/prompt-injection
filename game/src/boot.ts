import Phaser from 'phaser';
import { ROOMART } from './roomart';
import { OFFICE9 } from './office9art';
import { OFFICE8C } from './office8art';
import { O11_PROPS, O11_DOOR, O11_DUMMY } from './office11art';

export const SHEETS = ['noor_idle', 'noor_walk', 'noor_attack', 'noor_dash', 'noor_type1', 'noor_type2', 'noor_type3', 'noor_lookL', 'noor_lookR', 'noor_phone', 'noor_shadow', 'noor_surprise', 'fern_seated', 'caret_idle', 'caret_move'];

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  preload() {
    for (const s of SHEETS) this.load.atlas(s, `assets/sprites/${s}.png`, `assets/sprites/${s}.json`);
    for (const s of SHEETS.filter(s => s.startsWith('noor_'))) this.load.atlas(s + '_wire', `assets/sprites/${s}_wire.png`, `assets/sprites/${s}_wire.json`);
    for (const [room, a] of Object.entries(ROOMART)) {
      for (const [st, f] of Object.entries(a.images)) this.load.image(`bg_${room}_${st}`, `assets/${f}`);
      for (const [st, f] of Object.entries(a.code ?? {})) this.load.image(`code_${room}_${st}`, `assets/${f}`);
      for (const l of a.fg) this.load.image(l.key, `assets/${l.file}`);
      for (const m of a.amb ?? []) this.load.spritesheet(m.key, `assets/${m.file}`, { frameWidth: m.w, frameHeight: m.h });
      a.bridge?.frames.forEach((f, i) => this.load.image(`bridge_${i}`, `assets/${f}`));
    }
    // art-v9 office test level (perspective layers, variants, close-ups)
    const O = OFFICE9, A = (f: string) => `assets/${f}`;
    this.load.image('o9_back', A(O.back)); this.load.image('o9_mid', A(O.mid));
    for (const l of O.fg) this.load.image('o9fg_' + l.name, A(l.file));
    for (const v of O.var) this.load.image('o9v_' + v.file, A(v.file));
    for (const m of O.amb) this.load.spritesheet('o9a_' + m.name, A(m.file), { frameWidth: m.w, frameHeight: m.h });
    for (const [k, c] of Object.entries(O.close)) { this.load.image('o9c_' + k, A(c.img)); this.load.image('o9c_' + k + '_code', A(c.code)); (c.dolly ?? []).forEach((f, i) => this.load.image(`o9d_${k}_${i}`, A(f))); }
    this.load.image('code_office9', A(O.code));
    for (const [k, c] of Object.entries(OFFICE8C.close)) { this.load.image('o8c_' + k, A(c.img)); this.load.image('o8c_' + k + '_code', A(c.code)); (c.dolly ?? []).forEach((f, i) => this.load.image(`o8d_${k}_${i}`, A(f))); }
    for (const p of O11_PROPS) if (p.fg) this.load.image('o11fg_' + p.name, A(p.fg));
    O11_DOOR.frames.forEach((f, i) => this.load.image('o11door_' + i, A(f))); this.load.image('o11_dummy', A(O11_DUMMY.img));
    // art-v12 attack set (combat greybox / wire-in). Loaded always; used when ?combat=1.
    const A12 = ['noor_combo1', 'noor_combo2', 'noor_combo3', 'noor_peel', 'noor_throw', 'noor_charge_in', 'noor_charge_hold', 'noor_release'];
    for (const s of A12) this.load.atlas(s, `assets/sprites12/${s}.png`, `assets/sprites12/${s}.json`);
    for (const i of ['hp_on', 'hp_off', 'floor_mark']) this.load.image(i, `assets/icons/${i}.png`);
    // Impact lab FX (CC0 Kenney + original soft particles) + SFX
    const FX = [
  'spark_core', 'smoke_soft', 'dust_puff',
  'key_e', 'key_f',
  'lamp_on', 'lamp_off',
  'lift_panel_dead', 'lift_panel_live', 'lift_panel_cracked', 'lift_panel_cover',
  'spark_orb_0', 'spark_orb_1', 'spark_orb_2', 'spark_orb_3',
  'lightning_0', 'lightning_1', 'lightning_2', 'lightning_3',
  'spark_pop', 'lift_floor_ind_off', 'lift_floor_ind_on', 'lift_cab',
  // v15e layered lift (code-drawn; see assets/fx/lift_layers)

  'hit_spark_0', 'hit_spark_1', 'hit_spark_2', 'hit_spark_3',
];
    for (const f of FX) this.load.image('fx_' + f, `assets/fx/${f}.png`);
    const LL = ['recess','cab','leaf_l','leaf_r','frame','panel_dead','panel_live','ind_off','ind_on','wall_cover','seam','spill','lamp_on','lamp_off'];
    for (const f of LL) this.load.image('lift_' + f, `assets/fx/lift_layers/${f}.png`);
    const SFX = ['sfx_whoosh', 'sfx_clank', 'sfx_snap', 'sfx_bounce', 'sfx_padlock', 'sfx_hum', 'sfx_hit_heavy', 'sfx_metal'];
    for (const f of SFX) this.load.audio(f, `assets/sfx/${f}.ogg`);
    const t = this.add.text(640, 360, '> loading_', { fontFamily: 'JetBrains Mono', fontSize: '18px', color: '#B4EEF0' }).setOrigin(0.5);
    this.load.on('progress', (p: number) => t.setText(`> loading ${Math.round(p * 100)}%_`));
  }
  create() {
    // Build animations from the frame names in each JSON-hash sheet: <char>_<anim>_<DIR>_<NN>
    for (const s of SHEETS) {
      const names = this.textures.get(s).getFrameNames();
      const dirs = new Set(names.map(n => n.split('_').slice(-2, -1)[0]));
      for (const d of dirs) {
        let frames = names.filter(n => n.split('_').slice(-2, -1)[0] === d).sort();
        if (s === 'noor_idle') frames = frames.slice(0, 1);   // art-v11: frames 1-3 sway the head (read as a tilt); idle holds frame 0 and breathes in code
        const FPS: Record<string, number> = { noor_phone: 4, noor_shadow: 5, noor_surprise: 14, noor_attack: 22, noor_walk: 12, noor_dash: 30, noor_type1: 24, noor_type2: 24, noor_type3: 22 };
        const once = ['noor_phone', 'noor_shadow', 'noor_surprise', 'noor_attack', 'noor_dash', 'noor_type1', 'noor_type2', 'noor_type3'].includes(s);
        this.anims.create({ key: `${s}_${d}`, frames: frames.map(f => ({ key: s, frame: f })), frameRate: FPS[s] ?? 8, repeat: once ? 0 : -1 });
      }
    }
    // sprites12 attack anims (per-frame duration is applied in combat when playing)
    for (const s of ['noor_combo1', 'noor_combo2', 'noor_combo3', 'noor_peel', 'noor_throw', 'noor_charge_in', 'noor_charge_hold', 'noor_release']) {
      if (!this.textures.exists(s)) continue;
      const names = this.textures.get(s).getFrameNames();
      const dirs = new Set(names.map(n => n.split('_').slice(-2, -1)[0]));
      const once = s !== 'noor_charge_hold';
      for (const d of dirs) {
        const frames = names.filter(n => n.split('_').slice(-2, -1)[0] === d).sort();
        this.anims.create({ key: `${s}_${d}`, frames: frames.map(f => ({ key: s, frame: f })), frameRate: 18, repeat: once ? 0 : -1 });
      }
    }
    this.scene.start('game');
  }
}
