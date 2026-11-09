// node mock-steal/shoot.mjs  (from repo root; needs static server on :4191)
import { chromium } from '../game/node_modules/playwright/index.mjs';
import { mkdirSync, readdirSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';

const ROOT = new URL('.', import.meta.url).pathname;
const STILLS = ROOT + 'stills/';
const FRAMES = '/tmp/steal_frames/';
mkdirSync(STILLS, { recursive: true });
mkdirSync(FRAMES, { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:4191/mock-steal/index.html?t=0');
await p.waitForFunction(() => window.ready, null, { timeout: 20000 });

const shot = async (t, path) => {
  await p.evaluate(t => frameAt(t), t);
  await p.waitForTimeout(40);
  await p.locator('canvas').screenshot({ path });
};

// key beats
const S = [
  [1.0,  '01-establish-chained-door'],
  [3.5,  '02-window-open-rain'],
  [4.8,  '03-taking-open'],
  [6.4,  '04-carrying-open-window-shut'],
  [8.2,  '05-throw-door-chains-burst'],
  [9.4,  '06-door-open'],
  [12.8, '07-taking-water-cooler'],
  [16.2, '08-scribble-melt'],
];
for (const [t, n] of S) {
  await shot(t, STILLS + n + '.png');
  console.log('still', n, t);
}

if (!process.env.STILLS) {
  let i = 0;
  for (let t = 0; t < 20; t += 1 / 24) {
    await shot(t, FRAMES + String(i++).padStart(4, '0') + '.png');
  }
  console.log('frames', i);
}
await b.close();

if (!process.env.STILLS) {
  const mp4 = ROOT + 'flow.mp4';
  const gif = ROOT + 'flow.gif';
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '24', '-i', FRAMES + '%04d.png',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', mp4], { stdio: 'inherit' });
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4,
    '-vf', 'fps=15,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer',
    gif], { stdio: 'inherit' });
  console.log('wrote', mp4, gif);
}
