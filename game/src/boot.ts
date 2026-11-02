import Phaser from 'phaser';
import { ROOMART } from './roomart';

export const SHEETS = ['noor_idle', 'noor_walk', 'noor_attack', 'noor_dash', 'noor_type1', 'noor_type2', 'noor_type3', 'fern_seated', 'caret_idle', 'caret_move'];

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  preload() {
    for (const s of SHEETS) this.load.atlas(s, `assets/sprites/${s}.png`, `assets/sprites/${s}.json`);
    for (const [room, a] of Object.entries(ROOMART)) {
      for (const [st, f] of Object.entries(a.images)) this.load.image(`bg_${room}_${st}`, `assets/${f}`);
      for (const [st, f] of Object.entries(a.code ?? {})) this.load.image(`code_${room}_${st}`, `assets/${f}`);
      for (const l of a.fg) this.load.image(l.key, `assets/${l.file}`);
      a.bridge?.frames.forEach((f, i) => this.load.image(`bridge_${i}`, `assets/${f}`));
    }
    for (const i of ['hp_on', 'hp_off', 'floor_mark']) this.load.image(i, `assets/icons/${i}.png`);
    const t = this.add.text(640, 360, '> loading_', { fontFamily: 'JetBrains Mono', fontSize: '18px', color: '#B4EEF0' }).setOrigin(0.5);
    this.load.on('progress', (p: number) => t.setText(`> loading ${Math.round(p * 100)}%_`));
  }
  create() {
    // Build animations from the frame names in each JSON-hash sheet: <char>_<anim>_<DIR>_<NN>
    for (const s of SHEETS) {
      const names = this.textures.get(s).getFrameNames();
      const dirs = new Set(names.map(n => n.split('_').slice(-2, -1)[0]));
      for (const d of dirs) {
        const frames = names.filter(n => n.split('_').slice(-2, -1)[0] === d).sort();
        const FPS: Record<string, number> = { noor_attack: 22, noor_walk: 12, noor_dash: 30, noor_type1: 24, noor_type2: 24, noor_type3: 22 };
        const once = ['noor_attack', 'noor_dash', 'noor_type1', 'noor_type2', 'noor_type3'].includes(s);
        this.anims.create({ key: `${s}_${d}`, frames: frames.map(f => ({ key: s, frame: f })), frameRate: FPS[s] ?? 8, repeat: once ? 0 : -1 });
      }
    }
    this.scene.start('game');
  }
}
