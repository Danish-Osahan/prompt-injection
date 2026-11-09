# Steal qualities: preview mockup (NOT the game)

A scripted ~20 s canvas mockup of a **no-words** office mechanic. Nothing in `game/src` changed.

Open through a static server from the repo root:

```bash
python3 -m http.server 4191
# → http://localhost:4191/mock-steal/index.html
```

It loops. `?t=SECONDS` freezes one frame. Re-shoot with `node mock-steal/shoot.mjs` (server must be up).

## Concept (approved direction)
1. **Object states are physical.** The door is chained shut with a red lock light. The window is open — rain blows in, curtains move. The cooler drips. No SHUT / OPEN / SAD tags. No READ / code-vision screen.
2. **E takes a quality.** Hold/press E near a shimmering object. The object visibly loses the quality (window slams, rain stops) and a small swirl of that quality orbits Noor's hand: **open** = cool wind, **water** = droplets, **paper** = fluttering scraps.
3. **F throws it.** The target physically takes the quality: chains burst and the door swings open; water melts a Scribble; paper crumples chrome armour.
4. **J is attack** (not shown in this short teach beat). Only takeable objects shimmer when Noor is close. Text appears only in dialogue captions.

## Office teach beat (this clip)
Take the **open** from the window → give it to the door → then pull **water** from the cooler and melt a Scribble.

## Controls (proposed)
| Action | Input |
|---|---|
| Take quality | **E** (near shimmer) |
| Throw quality | **F** |
| Attack | **J** |

## Honesty
- All FX (chains, rain, drips, wind swirl, water orb, melt, burst) are drawn in code (canvas 2D). **No Blender rendering.**
- Plate, lift-door frames, and Noor sprites (`sprites/` idle+walk, `sprites12/` peel+throw) are the real `game/public/assets` files already in the repo.
- This is a preview for sign-off before any gameplay rewrite.
