// Room-name cards and the Level 1 end screen. Typographic only; replaces the ~/hub/ path HUD.
import Phaser from 'phaser';
import tokens from './tokens.json';
import type { RoomId } from './save';
import { writeSave } from './save';
import { sfx } from './sfx';
import type { GameScene } from './game';

const C = tokens.color;
const FONT = 'JetBrains Mono';
const UI = 'IBM Plex Mono';

export const ROOM_CARD: Record<RoomId, string> = {
  office: 'THE REAL OFFICE',
  hub: 'THE MIRROR OFFICE',
  corridor: 'THE DARK CORRIDOR',
  archive: 'THE FLOODED ARCHIVE',
  arena: 'THE DRAFT',
  message: 'THE MESSAGE ROOM',
};

export function formatPlayTime(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function flushPlay(s: GameScene) {
  s.save.playMs = (s.save.playMs ?? 0) + (s.playAcc || 0);
  s.playAcc = 0;
}

export function showRoomCard(s: GameScene, id: RoomId) {
  s.roomCard?.destroy();
  s.roomCard = undefined;
  const name = ROOM_CARD[id] ?? id;
  const c = s.add.container(640, 140).setScrollFactor(0).setDepth(7600).setAlpha(0);
  const rule = s.add.rectangle(0, -28, 220, 1.5, hex(C.cyan), 0.85);
  const t = s.add.text(0, 0, name, {
    fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: C.inkBright, letterSpacing: 4,
  } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5);
  c.add([rule, t]);
  s.roomCard = c;
  s.tweens.add({ targets: c, alpha: 1, duration: 280, ease: 'Quad.easeOut' });
  s.time.delayedCall(1600, () => {
    if (s.roomCard !== c) return;
    s.tweens.add({ targets: c, alpha: 0, duration: 450, onComplete: () => { if (s.roomCard === c) { c.destroy(); s.roomCard = undefined; } } });
  });
}

export function showEndScreen(s: GameScene) {
  if (s.endScreen || s.room?.id !== 'message' || s.transitioning || s.ending) return;
  flushPlay(s);
  s.save.phaseComplete = true;
  writeSave(s.save);
  s.busy = true;
  s.cutscene = { id: 'end', skip: () => backToTitle(s) };
  const time = formatPlayTime(s.save.playMs ?? 0);
  const c = s.add.container(0, 0).setScrollFactor(0).setDepth(8600);
  const dim = s.add.rectangle(640, 360, 1280, 720, 0x04080c, 0.96).setInteractive();
  const kicker = s.add.text(640, 200, 'LEVEL 1', {
    fontFamily: FONT, fontSize: '16px', color: C.cyan, letterSpacing: 6,
  } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5);
  const title = s.add.text(640, 250, 'COMPLETE', {
    fontFamily: FONT, fontSize: '52px', fontStyle: 'bold', color: C.inkBright, letterSpacing: 8,
  } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5);
  const clock = s.add.text(640, 330, `Time  ${time}`, { fontFamily: UI, fontSize: '20px', color: C.ink }).setOrigin(0.5);
  const thanks = s.add.text(640, 400, 'Thank you for playing.', { fontFamily: UI, fontSize: '18px', color: C.ink }).setOrigin(0.5);
  const tbc = s.add.text(640, 432, 'To be continued.', { fontFamily: UI, fontSize: '18px', color: C.dim }).setOrigin(0.5);
  const btn = s.add.rectangle(640, 530, 320, 56, 0x78e4e8, 0.08).setStrokeStyle(1.5, 0x78e4e8, 0.8).setInteractive({ useHandCursor: true });
  const lab = s.add.text(640, 530, 'Back to menu', { fontFamily: FONT, fontSize: '18px', color: C.inkBright }).setOrigin(0.5);
  c.add([dim, kicker, title, clock, thanks, tbc, btn, lab]);
  c.setAlpha(0);
  s.endScreen = c;
  s.tweens.add({ targets: c, alpha: 1, duration: 400 });
  try { sfx('win'); } catch { /* */ }
  const go = () => backToTitle(s);
  btn.on('pointerdown', go);
  dim.on('pointerdown', go);
}

export function backToTitle(s: GameScene) {
  if (s.ending) return;
  s.ending = true;
  flushPlay(s);
  writeSave(s.save);
  try { sfx('key'); } catch { /* */ }
  s.cameras.main.fadeOut(280, 4, 8, 12);
  s.cameras.main.once('camerafadeoutcomplete', () => {
    s.endScreen?.destroy(); s.endScreen = undefined;
    s.busy = false; s.cutscene = null; s.ending = false;
    s.scene.start('title');
  });
}

function hex(col: string) { return parseInt(col.slice(1), 16); }
