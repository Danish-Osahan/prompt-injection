// renders stills + clip frames from index.html (node mock-attack/shoot.mjs, run from the repo root with a static server on :4192:
//   python3 -m http.server 4192). STILLS=1 = stills only. ONLY=flow|compare limits the clips. Frames go to /tmp/maf (flow) and /tmp/mac (compare).
import { chromium } from '../game/node_modules/playwright/index.mjs';
import { mkdirSync, rmSync } from 'fs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const open = async q => { await p.goto('http://localhost:4192/mock-attack/index.html?t=0' + q); await p.waitForFunction(() => window.ready); };
const shot = async (t, f) => { await p.evaluate(t => frameAt(t), t); await p.locator('canvas').screenshot({ path: f.startsWith('/') ? f : 'mock-attack/' + f }); };
const S = JSON.parse(process.env.STILLS_AT || 'null') || (await import('./stills.mjs')).default;
await open('');
if (!process.env.ONLY || process.env.STILLS) for (const [t, n] of S.flow) await shot(t, `stills/${n}.png`);
if (!process.env.STILLS && process.env.ONLY !== 'compare') { rmSync('/tmp/maf', { recursive: true, force: true }); mkdirSync('/tmp/maf'); let i = 0; for (let t = 0; t < 16; t += 1 / 30) await shot(t, `/tmp/maf/${String(i++).padStart(4, '0')}.png`); }
await open('&mode=compare');
if (!process.env.ONLY || process.env.STILLS) for (const [t, n] of S.compare) await shot(t, `stills/${n}.png`);
if (!process.env.STILLS && process.env.ONLY !== 'flow') { rmSync('/tmp/mac', { recursive: true, force: true }); mkdirSync('/tmp/mac'); let i = 0; for (let t = 0; t < 7; t += 1 / 30) await shot(t, `/tmp/mac/${String(i++).padStart(4, '0')}.png`); }
console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors');
await b.close();
