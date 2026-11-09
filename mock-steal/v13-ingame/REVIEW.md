# v13-ingame self-review (vs Hades / Dead Cells hit feel)

## What landed
- Live Phaser 4 + Matter.js chain (7 links + padlock) in the clarity office.
- ImpactFX tiers light / heavy / big: hit-stop (Matter + tweens paused; FX keep ticking), punch-zoom + directional kick, fullscreen flash, ColorMatrix desat/invert impact frames, spark + dust emitters, slow-mo ease-back.
- Gust swirl on hand → smoke projectile + trail → heavy on contact → big on snap → door recoil + OPEN via clarity plate.
- Light tier wired to J hits on the practice dummy.
- CC0 Kenney Interface Sounds + original soft particle / chain / padlock art (CREDITS.md).
- Capture: `mock-steal/v13-ingame/beat.mp4` + gif + 8-frame strip + `10-impact-1x`.
- Playtests: **202/202 passed**.

## Weak spots (honest)
1. **Silhouette frames are ColorMatrix + overlay**, not a true Noor+door-only render-texture silhouette. Reads at speed; still softer than Hades' hard graphic cut.
2. **Chain art is generated metal links**, not door-handle chrome matched to O11 plates; material match is weaker than Dead Cells debris.
3. **Fake floor plane** (y-clamp + ellipse shadows) — links don't collide with desks; bounce is floatier than grounded Hades props. End-anchor fall can lag settle.
4. **Punch-zoom + sil** can still briefly wash the contact frame; headless capture sometimes lands on that frame for stills (we prefer the neighbour for `10-impact-1x`).
5. **Throw anim** is not frame-synced to art-v12 `noor_throw` release; gust spawns on key, not sheet event.
6. **Kenney Particle Pack 403** — soft circles are original PIL, not Kenney's authored packs; sparks lack Dead Cells' chunky comic edge.
7. `beat.mp4` is silent (screenshot sequence).

## Run
`cd game && npm install && npm run dev` → `http://localhost:5173/?impact=1&new=1` (or press **I** in the office). E at window, F to throw. Capture: `npm run build && npm run preview -- --port 5179` then `node tests/impact_lab.mjs`.
