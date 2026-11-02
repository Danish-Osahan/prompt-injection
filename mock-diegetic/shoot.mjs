// renders the stills + clip frames from index.html (node mock-diegetic/shoot.mjs, run from repo root with a static server on :4191)
import { chromium } from '../game/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:4191/mock-diegetic/index.html?t=0'); await p.waitForFunction(() => window.ready);
const shot = async (t, f) => { await p.evaluate(t => frameAt(t), t); await p.locator('canvas').screenshot({ path: f.startsWith('/') ? f : 'mock-diegetic/' + f }); };
const S = [[3.0, '01-door-painted-shut'], [4.35, '02-shimmer-near'], [5.15, '03-mid-peel'], [6.45, '04-carrying-door-blank'], [7.68, '05-open-flicked-splat'], [9.3, '06-door-open'],
  [10.85, '07-dummy-armored'], [11.6, '08-paper-thrown'], [12.25, '09-splat-papery'], [14.5, '10-combo-tear']];
for (const [t, n] of S) await shot(t, `stills/${n}.png`);
if (!process.env.STILLS) { mkdirSync('/tmp/mdf', { recursive: true }); let i = 0; for (let t = 0; t < 16; t += 1 / 24) await shot(t, `/tmp/mdf/${String(i++).padStart(4, '0')}.png`); }
await b.close();
