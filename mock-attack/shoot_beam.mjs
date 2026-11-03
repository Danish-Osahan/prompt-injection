// beam v2 clips + stills (run from the repo root with python3 -m http.server 4192). Frames: /tmp/mbb (beam), /tmp/mbc (before/after).
import { chromium } from '../game/node_modules/playwright/index.mjs';
import { mkdirSync, rmSync } from 'fs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const open = async q => { await p.goto('http://localhost:4192/mock-attack/index.html?t=0' + q); await p.waitForFunction(() => window.ready); };
const shot = async (t, f) => { await p.evaluate(t => frameAt(t), t); await p.locator('canvas').screenshot({ path: f.startsWith('/') ? f : 'mock-attack/' + f }); };
const ST = JSON.parse(process.env.ST || 'null') || [];
await open('&mode=beam');
for (const [t, n] of ST) await shot(t, `stills/${n}.png`);
if (!process.env.STILLS) {
  rmSync('/tmp/mbb', { recursive: true, force: true }); mkdirSync('/tmp/mbb'); let i = 0; for (let t = 0; t < 12.8; t += 1 / 30) await shot(t, `/tmp/mbb/${String(i++).padStart(4, '0')}.png`);
  await open('&mode=beamcompare'); rmSync('/tmp/mbc', { recursive: true, force: true }); mkdirSync('/tmp/mbc'); i = 0; for (let t = 0; t < 6.8; t += 1 / 30) await shot(t, `/tmp/mbc/${String(i++).padStart(4, '0')}.png`);
}
console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors');
await b.close();
