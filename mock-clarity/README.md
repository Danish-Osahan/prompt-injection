# Clarity mockup (not the game)
A scripted prototype of the clarity redesign, drawn over the v8 office plate. Nothing in `game/` is changed.

- **Play it:** from the repo root, run `python3 -m http.server 4190`, then open <http://localhost:4190/mock-clarity/index.html>. It loops a 26 s flow. Add `?t=8.9` to the URL to freeze one moment.
- **Stills:** `stills/`. **Flow:** `flow.gif` (640 px) or `flow.mp4` (1280x720).
- **Re-render:** with that server running, run `node mock-clarity/shoot.mjs`.

**What it shows**
- The whole room is always fitted between a thin top bar (the objective) and a bottom caption strip that stays empty while walking.
- The scene heading shows once when you enter the room.
- The swappable word is a glowing SHUT tag on the door itself. Tap it, pick OPEN, and the door slides open with light spilling out.
- Inspect opens a framed card using the rendered close-up still, with a slow push and the one lore line.
- Tap attack for a 3-hit combo that aims for you; hold and release for the typed beam. Both are shown on a stuffed practice dummy with an aim bracket.
- Noor uses only her plain idle (no look/tilt reaction poses).

**Art notes:** the door-open interior, light spill, dummy, slashes and UI are canvas placeholders for the mockup, not shipping art.
