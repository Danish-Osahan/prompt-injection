// renders the stills + GIF frames from index.html (node mock-clarity/shoot.mjs, run from repo with a static server on :4190)
import { chromium } from '../game/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:4190/mock-clarity/index.html?t=0'); await p.waitForFunction(() => window.ready);
const shot = async (t, f) => { await p.evaluate(t => frameAt(t), t); await p.locator('canvas').screenshot({ path: f.startsWith('/') ? f : 'mock-clarity/' + f }); };
for (const [t, n] of [[4.2, '01-walk-empty-bottom'], [6.7, '02-near-door-glowing-word'], [8.95, '03-swap-pick-open'], [11.2, '03b-door-opened'], [17, '04-inspect-card'], [21.65, '05a-attack-combo'], [3.6 + 21 + .15, '05b-attack-beam']]) await shot(t, `stills/${n}.png`);
mkdirSync('/tmp/mcf', { recursive: true }); let i = 0;
for (let t = 0; t < 26; t += 1 / 12) await shot(t, `/tmp/mcf/${String(i++).padStart(4, '0')}.png`);
await b.close();
