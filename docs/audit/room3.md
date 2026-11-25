# Room 3 audit — The Dark Corridor

## 2026-11-25 — The guard, the Caret's first use, re-rendered props

- **Purpose.** The Sentinel is the system's guard. It stands in front of the only exit. It is the Caret's teaching encounter; see `docs/caret.md`.
- **Puzzle.**
  - Light: ON goes from the switch into the lamp.
  - Send the Caret into the guard (F) to open its hidden line, `GUARD IS QUICK`.
  - Take STILL from the stopped clock (it now reads QUICK) and throw it into the line.
  - The guard freezes, the TYPE combo tears it, and the exit opens.
  - While the guard is QUICK it swipes when Noor comes close, and hits do nothing.
- **Dialogue.** Every corridor line is spoken by Fern or Noor in a named box with a portrait, one idea per line. The floating "IT ISN'T AWAKE." text is gone.
- **Sentinel.** Rendered in Blender (`art/tools/sentinel12.py`, 2x, room camera angle): a tailor's form stacked from blank claim sheets, with sleeve sheets, an iron stand on a four-foot base, and a blank ID-card head. In game it is about 150 px tall. The game prints NOOR on the card (red while it guards, grey once STILL) and the line on a chest strip. When hit while STILL it staggers on its stand and flashes white.
- **Props.** Re-rendered in the original Blender corridor scene (`rooms7.py` `P_corridor`, `rooms8.py` `L_corridor`), then graded and merged into both bleed plates:
  - The cone lamp is now a wall-mounted fluorescent fitting with a steel housing and opal diffuser, grey when off and warm when lit.
  - The umbrella (a cone with a ring), the bucket and its drip ring, the floor tape, the grey mat and both cardboard boxes are removed.
  - Fern's note is now an off-white index card held up by two strips of tape.
  - New: three blank staff portraits whose name plates read `[NAME]`, and an EXIT sign over the alcove. The sign buzzes as an ambient loop cut from the plate.
  - The linger objects follow the props: moth↔exit toy pair, portraits, door, scuffs.
- Stills:
  - `/workspace/l3c-corridor-full(-2x).png`
  - `/workspace/l3c-corridor-guard-intro(-2x).png`
  - `/workspace/l3c-corridor-caret-first(-2x).png`
  - `/workspace/l3c-corridor-still(-2x).png`
