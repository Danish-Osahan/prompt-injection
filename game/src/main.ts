import Phaser from 'phaser';
import { BootScene } from './boot';
import { GameScene } from './game';

async function start() {
  // Floor text is drawn into canvases, so the fonts must be ready before the first plate is drawn.
  try {
    await Promise.all([
      document.fonts.load('700 22px "JetBrains Mono"'), document.fonts.load('500 12px "JetBrains Mono"'),
      document.fonts.load('500 14px "IBM Plex Mono"'), document.fonts.load('400 12px "IBM Plex Mono"'),
    ]);
  } catch { /* fall back to monospace */ }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#04080c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
    input: { activePointers: 4 },
    scene: [BootScene, GameScene],
  });
  if (new URLSearchParams(window.location.search).has('test')) {
    (window as unknown as { __game: Phaser.Game }).__game = game;
  }
}
start();
