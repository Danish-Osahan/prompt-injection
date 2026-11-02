# Phase 1: Levels, Controls, Puzzles, Checkpoints (locked)
Style: clean, calm, few props, atmosphere from lighting. Each room is short (1-3 min).

## Room flow
1. R0 Real Office (cold open). Open-plan floor, 3 desks, a rainy window. Path: entrance, past Dez's desk, past Kabir's desk, to Noor's desk. Teaches: walk, inspect, type. No enemies.
2. Mirror Hub (landing). Same layout in neon-noir. Fern's desk at the centre, the exit door north. Teaches: plate swap (door), dash (gap). Home base for the whole game.
3. Dark Corridor (lamp puzzle). A long, narrow, near-black corridor with 2 plates. Teaches: finding words in the room. Ends at the paper-dummy alcove (attack tutorial).
4. Flooded Archive (two-step puzzle). A sunken room of filing cabinets with a bridge. Teaches: order matters.
5. R1 Draft Arena (boss). A round, empty, single-lamp room with cover-free open space for dodging. Boss: the Draft.
6. Message Room (ending). A small quiet room with a chat wall and a stairwell. Cutscene only.

## Controls tutorial (small prompts under Noor; each shown once, auto-switches keyboard or touch)
- Move: R0 near the desk, "WASD TO WALK" or "DRAG TO WALK". Fades after moving.
- Inspect: by the coffee, "E TO READ" or "TAP TO READ".
- Type: composer keys glow in order for the angry prompt.
- Swap: hub, "CLICK / TAP THE BOXED WORD IN THE CAPTION" by the lamp, then "E AT THE DOOR · OR CLICK SHUT IN THE CAPTION".
- Code vision: dark corridor, "HOLD E / HOLD READ TO SEE THE CODE".
- Dash: hub gap, plate "GAP IS WIDE", prompt "SPACE TO DASH" or the dash button.
- Attack: paper dummy, "CLICK TO TYPE", then "HOLD TO SELECT".
- Rewrite in combat: Draft guard, "GRAB WORD" then slow-mo "DROP IT ON STRONG".
- Pause or settings: the first time you press Esc or the menu, a short controls list (can be reopened any time).

## Puzzles
1. Door (hub): "DOOR IS SHUT". The word OPEN sits on "LAMP IS OPEN". Swap them to open the door.
2. Lamp (corridor): "LIGHT IS OFF" and a side plate "SWITCH IS ON". Swap OFF and ON; the light reveals a path and a hidden note from Fern.
3. Two-step (archive): "WATER IS HIGH" and "BRIDGE IS UP" (raised, cannot cross). Cabinet plate: "DRAWER IS LOW". Step 1: swap HIGH and LOW, so the water drains. This uncovers a submerged plate, "STAIRS GO DOWN". Step 2: swap UP and DOWN, so the bridge lowers. Order matters because DOWN is underwater until step 1.
4. Guard break (boss): "THE DRAFT IS STRONG" becomes "THE DRAFT IS WEAK" using a dropped fragment.
Hint rule: after ~45 s stuck, Fern's leaf points at the key plate.

## Checkpoints and death
- Checkpoint = the last plate you read or swapped (it glows briefly when saved).
- Death: the screen glitches, "UNDO", and you respawn at the checkpoint in under 1 s. No loading screens.
- Boss death: restart the fight at the arena door. Puzzle progress is kept.
- Autosave at each room exit and each cutscene end.

## What carries over between rooms
- Kept: health (refills at each checkpoint), unlocked abilities, collected claim shards, inspected lore, Fern's growth.
- Not kept: word fragments (they expire when you leave a fight or room), stored Cut and Paste attacks.

## Presentation: how words are shown (LOCKED 2 Nov 2026, hybrid A + D + E)
No mounted world signs. Plates are data (`game/src/rooms.ts`); each object has a caption line and a code line.
- **Normal view = subtitle captions (E).** A cinematic bar at the bottom (y 626-720 of 1280x720) with a small scene heading
  ("INT. MIRROR OFFICE — NIGHT, PROBABLY") and a typed-in screenplay line about the nearest 1-2 interactive objects (the nearest
  gets a soft highlight in the world). Swappable words are boxed chips: tap/click picks the word up (or swaps if you already hold one),
  drag a chip onto another chip (or onto the object) to swap. E/READ at an object still works. Lines have voice: short, two clauses,
  melancholy and a little wry. When Noor walks low in the room the bar fades to 60%.
- **The narrator lies once:** the monitor caption reads "Your claim was ██████." Only code vision shows `claim.status = DENIED;`.
- **Hold READ (E, or the READ button) = full code vision (A).** After 0.25 s the room switches to a teal wireframe plate, every object
  shows `obj.field = VALUE;`, and Noor shows `noor.shadow = null;`. You can swap between any lines, no distance limit.
  `draft.guard = STRONG;` follows the Draft. In combat code vision also slows time (REWRITE bullet time); holding a word still does.
- **Lens-only secrets (D).** Two spots: `fern.awake = true;` by Fern's desk (hub) and `wall.solid = TRUE;` on the corridor's
  bricked-in stretch. In code vision near them, a lens (r 130) follows Noor's facing, the rest darkens, and the hidden line fades in
  only inside the lens. Holding it ~0.5 s logs the secret (save `tutorials` entry `secret:<id>`; it does not count as lore) and Fern reacts.
- Every Phase 1 caption:
  | object | caption | code |
  |---|---|---|
  | coffee | Someone's mug, still waiting. Cold since August. | `mug.temp = COLD;` |
  | Dez's desk | Dez's desk, chair pushed in. Back Monday, it promises. | `dez.back = MONDAY;` |
  | Kabir's note | A note on Kabir's screen. Miss you around here. | `kabir.note = "miss you";` |
  | monitor | Your monitor, still awake. Your claim was ██████. | `claim.status = DENIED;` |
  | hub lamp | A small lamp keeps watch. It is [OPEN]. | `lamp.state = OPEN;` |
  | hub door | The door is [SHUT]. It would rather you stayed. | `door.state = SHUT;` |
  | gap | The floor gives up here. The gap is WIDE. | `gap.width = WIDE;` |
  | exit | A door that knows your name. EXIT is NOOR'S. | `exit.owner = NOOR;` |
  | corridor light | A lamp nobody remembers fitting. The light is [OFF]. | `light.state = OFF;` |
  | switch | A switch, painted over twice. It is [ON]. | `switch.state = ON;` |
  | Fern's note | Fern's handwriting, taped low. You always said good morning. | `fern.note = "good morning";` |
  | dummy | A paper dummy, patient as furniture. It is [STILL]. | `dummy.state = STILL;` |
  | clock | The clock runs ahead of everyone. It is [QUICK]. | `clock.speed = QUICK;` |
  | water | The pipe sweats into the dark. The water is [HIGH]. | `water.level = HIGH;` |
  | bridge | A plank bridge, folded like an argument. It is [UP]. | `bridge.state = UP;` |
  | drawer | A drawer of old intake forms. It is [LOW]. | `drawer.height = LOW;` |
  | ink | An ink bottle, uncorked for years. It is still [WET]. | `ink.state = WET;` |
  | towel | A towel on a rack. Somehow, it is [DRY]. | `towel.state = DRY;` |
  | notes | Sticky notes in a clump. They stick [TOGETHER]. | `notes.stick = TOGETHER;` |
  | books | Books on a shelf, not speaking. They sit [APART]. | `books.sit = APART;` |
  | stairs | Stairs, drowned until now. They go [DOWN]. | `stairs.dir = DOWN;` |
  | Draft | The Draft circles, sure of itself. It is [STRONG]. | `draft.guard = STRONG;` |
  | pillar | A paper pillar, patched with tape. Paper is [WEAK]. | `paper.state = WEAK;` |
  | stairwell | The stairwell hums. Floor 1 goes DOWN. | `stairs.floor1 = DOWN;` |
  | (secret) Fern | Fern, at her desk. She was always here first. | `fern.awake = true;` (lens only) |
  | (secret) wall | A wall where a door should be. Painted in. | `wall.solid = TRUE;` (lens only) |
- Puzzles are unchanged (same words, same order rules); only the presentation moved from signs to captions + code lines.
