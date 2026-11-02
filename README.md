# Prompt Injection

A pixel-art action game built with Phaser 4 + TypeScript + Vite. Art is produced by a Blender/Python-to-pixel pipeline (art-v7).

## Run
```
cd game
npm install
npm run dev        # dev server
npm run build      # type-check + production build
npm run playtest   # automated Playwright playtest
```

## Folder map
- `game/` – game source (src, public assets, tests, screenshots)
- `art/` – art-v7 pipeline: `tools/` (Blender/Python scripts), `tex/`, `render/` (renders + layout JSON), `out/` (final exported plates, sprites, overlays)
- `docs/` – story docs (`docs/story/`) and `HANDOFF.md`
- `CREDITS.md` – credits

Older art iterations (art-v2–v6, art-v3-hybrid, ui-v1, ui-v2, mock-words, preprod) are archived locally and not included in this repo.
