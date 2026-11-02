# Prompt Injection

A narrative action game built with Phaser 4 + TypeScript + Vite. Art is rendered in Blender from Python scripts (`art/tools/`).

## Play it on a Mac
You need [Node.js](https://nodejs.org) 20 or newer (`brew install node` works) and git (comes with Xcode Command Line Tools: `xcode-select --install`).

First time, in Terminal:
```
git clone https://github.com/Danish-Osahan/prompt-injection.git
cd prompt-injection/game
npm install
npm run dev
```
Then open the `http://localhost:5173/` link it prints (Cmd-click it). Stop the server with Ctrl-C.

To get updates later:
```
cd prompt-injection
git pull
cd game
npm install      # only needed if dependencies changed; harmless otherwise
npm run dev
```

Options: add `?v9` to the URL (`http://localhost:5173/?v9`) to try the experimental lower-angle office (art-v9/v10). The default is the original office angle.

## Other commands (in `game/`)
```
npm run build      # type-check + production build
npm run playtest   # automated Playwright playtest (needs: npx playwright install chromium)
```

## Folder map
- `game/` – game source (src, public assets, tests, screenshots)
- `art/` – art-v7 pipeline: `tools/` (Blender/Python scripts), `tex/`, `render/` (renders + layout JSON), `out/` (final exported plates, sprites, overlays)
- `docs/` – story docs (`docs/story/`) and `HANDOFF.md`
- `CREDITS.md` – credits

Older art iterations (art-v2–v6, art-v3-hybrid, ui-v1, ui-v2, mock-words, preprod) are archived locally and not included in this repo.
