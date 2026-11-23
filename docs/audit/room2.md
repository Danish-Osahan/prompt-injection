# Room 2 audit — The Mirror Office (hub)

## 2026-11-23 — Hint pin, chasm, E, caret note

Played after the `6b33b7a` follow-up (Playwright, stills under `/workspace/l2e-*.png`).

- **Stray south-floor icon.** Identified as Fern's stuck-hint `hintObj` (green ellipse, pink vein, down-triangle) over `h_lamp`, not a pickup/spawn. Removed the floating pin; the hint now pulses the plate and a soft floor pool. Fern's "Psst. That one." line stays.
- **Dash gap.** Redesigned as two detached platforms with a real dark chasm, lip faces, hazard edges, cables, faint lights, drifting paper, and short broken bridge stubs. Collision still matches the pit. First arrival: camera pan + a paper sheet falling into the well, then the dash hint. SHUT door and glass-copy beats kept.
- **E advances dialogue.** First press completes the typewriter line; second press advances or closes. Works in cutscenes, Fern boxes, and the intro claim-mail tab. The press does not also trigger an interact underneath. Tests added.
- **Caret (behavior unchanged this pass).** The I-beam is `caret_idle`, hidden until the hub door goes SHUT→OPEN. Fern introduces it as a cursor that "learned from every line I didn't send," then "When you type, it aims. Keep it close in the dark." Mechanically it fades in at Noor's left shoulder, follows her (`x-46, y-56`, depth `y+1`), and in the dark corridor adds a radius-90 light pool around itself (in addition to Noor's pool). The TYPE / typed-beam auto-aim does not actually move or aim the caret sprite — that line is flavor until a later pass. How Noor got it, and how it relates to Fern, still does not fully land; leave it for a dedicated story beat.


Played end-to-end on `546ab96` (Playwright, `?test=1&new=1`, 1280×720). Room 2 is the hub after the office lift. The owner's still matches the stand-still beat: Noor in the north, a cyan I-shaped caret, a cyan figure at a desk, and a bottom box with an empty name and empty portrait saying "Stand still long enough and the room starts copying you. It's flattering. It isn't."

## Story / setup

- Entry cutscene (sc3) does the right work: Noor asks where she is, Fern answers that this is "inside everything you all ever typed," then points at the door. The door puzzle (OPEN from the lamp, thrown at SHUT) and the gap/dash are clear once you start moving.
- The room's hook — that it copies you — is not set up. The stand-still line fires as an uncredited narrator box after ~6s anywhere in the room. The actual copy (a delayed, cyan-tinted Noor in the north wall glass) only appears when she is already in the north (`y < 300`). Stand still at spawn and you get the line with no copy on screen.
- The cyan figure at the pink chair in the south-east is not a copy of Noor. It is `fern_seated` (1005, 545). It reads as a ghostly person, so the empty-tag box plus the caret plus that figure all get mistaken for each other. The real plant lookable is the green pot in the south-west, which makes Fern harder to recognise.

## Dialogue

- The stand-still line is `say('floor', ...)`. `tagFor('floor')` returns `''`, and the portrait is an empty tinted circle. The box looks like Fern's chrome with a blank name plate and a blank portrait. That is exactly the owner's still.
- Other floor lines (toys, archive drain, some tutorials) use the same empty box.
- When Noor is in the lower half, this long box sits at the bottom and covers her. Floor has no speaker, so the "don't cover the speaker" flip never runs.
- Fern's entry lines do carry a FERN tag and (when they use a portrait box) a plant portrait. Short lines use world bubbles, which is fine when the hologram is next to her.

## Visible speaker

- Hub `fernSource()` always returns a `body` source at (1005, 470). `spawnHolo` for `kind === 'body'` builds an empty container (0 children), no plant, no cone.
- The only Fern in the room is the seated cyan figure at her desk, across the floor from spawn. During "Inside everything you all ever typed." the bubble sat mid-room and pointed vaguely toward that desk. From spawn she is easy to miss, and she does not look like the office hologram plant.
- No hologram rises from a lamp, desk, or screen, unlike the office.

## Unexplained UI (the caret)

- The I-shaped sprite is the Caret, a blinking cursor ally (the part of Fern that learned from unsent drafts). It is hidden until the door opens, which is right, but then it fades in on a 4.2s timer in the middle of "Only the owner of the words leaves." / "They're my words." — before Fern's line "It'll help. It likes you."
- That line never says what it is, that it is a cursor, or that it is the TYPE power (it aims when she types; it also lights a little of the dark corridor). The owner reasonably asked if the caret was Fern.

## Hint timing

- No always-on controls bar in this room (good; the progressive rule holds).
- At the north glass, `E  look` (first-time tutorial) and the lost-line `E take` chip stack on top of each other.
- The caret is not introduced with a spoken beat or a first-use hint; it just appears.
- SPACE dash is supposed to appear at the gap; that path is in place. Not re-tested as a miss here.

## Copy mechanic

- Implementation exists: a 0.4s-delayed, cyan, glass-cropped copy of Noor (`refl`), visible only for `y < 300`. In the north it does read, quietly, in the wall glass.
- It is not introduced. The line is not timed to the copy appearing, Fern is not present, and the line can play when the copy is invisible (south spawn, the usual first stand-still).

## Props, scale, lighting, overlap

- `fern_seated` at 0.75 scale looks like a cyan seated person, not a potted plant. `fg_hub_fern_desk` sits at depth 590, the sprite at 560, so the desk reads in front of her; together they look like a hologram typist.
- Standing at the desk, Noor overlaps the desk and the seated figure.
- The SHUT door is a large coral rectangle sitting in the cyan gap. It works, but it is cruder than the rest of the plate and can look like a floating bar.
- The printed denial letter is a 36×46 scrap under the office printer. At the playtest stand (140, 250) Noor stands on it. There is no way to read the letter; E only "looks" at the printer. "CLAIM #4471 / DENIED" is barely legible.
- Room card "THE MIRROR OFFICE" lands over the north door during the first line.
- The glass copy is small and low-contrast; easy to miss even when it is on.
- Lamp, clock, coat rack, floor notes, and the green pot are otherwise fine. Gap lighting (up-shaft glow) reads as a hole.

## Priority fixes

1. Never ship a dialogue box with an empty name or portrait. The hub copy line should be Fern's, with her name, portrait, and a visible hologram (rise from a lamp or desk, cone, same as the office).
2. Introduce the caret with a clear Fern beat when it first appears, or keep it hidden until then.
3. Time a short setup beat so the player sees the room start copying Noor, then hears Fern's line.
4. Cheap prop/UI: make desk-Fern read as the same plant; don't cover Noor with the floor box; let E open a full paper card for the denial letter.

## Fixed

Patched after this audit (see `docs/HANDOFF.md`, room-2 pass):

- Boxes never show an empty name or portrait. Floor is THE ROOM with a typographic mark; floor boxes flip off low Noor.
- Hub Fern speaks as the office plant hologram plus cone, rising from the nearest lamp, desk, glass, or table. Desk typist swapped to `fern_plant`.
- Caret stays hidden until the door opens, then Fern names it as a cursor that aims when you type and should be kept close in the dark. It appears as that line starts.
- Stand still in the hub: the glass copy fades in first, then Fern delivers the copy line (once per visit).
- Office denial letter: scrap offset, first-time `E  read`, paper card with the rewritten claim, close with E.

Left for later: stacked E chips at the north line, the coral SHUT plank, the room card over the north door, modest glass-copy contrast, small desk plant on a large desk.

## 2026-11-18 follow-up

Addressed after `a3eabe5` (see HANDOFF, room-2 pass):

- Exactly one Fern: desk pot or hologram, never both. Desk plant scaled to 0.38.
- South-spawn copy is larger, brighter, centered, with a pane glint. Fern's line waits until the copy has been visible ~1s (or the player is at the glass).
- `E look` no longer stacks on `E take` at the north glass, or on office look chips. Office click-attack no longer eats the J hint. Card close is `E  close`, darker.
- Coral SHUT slab replaced with a code-drawn cyan-framed door. Room title is a slim top nameplate above the glass.

Still weak: the top dialogue box can cover the glass copy while Fern talks about it from the south; the door is flatter than the painted art.

## 2026-11-18 leftovers pass

From the `55633f7` review:

- Copy-line (and other topic) boxes sit below a top-band subject instead of covering it. Asserted vs the north glass.
- Hologram shrunk to 76px and stood closer to Noor.
- Door redrawn with bevel, inset glass, handle, threshold, contact shadow, and cyan spill.
- Note/letter widow control: short last words no longer sit alone.
- Ambiguous quality tokens glow only when written as ALL-CAPS quality words.

Still weak: the mid-band box can cover the gap and the top of the SHUT door; the door glass is still graphic; Noor can overlap the door foot.

## 2026-11-18 leftovers pass (after 2caff00)

- Hub dialogue boxes are compact and tucked to one side so they do not cover the glass, the gap rails, or the SHUT door. Asserted vs glass and door.
- Glass copy is a sharp, upright, uniformly scaled portrait of Noor (subtle tint, no rotation). Fern still waits until it has been seen.
- SHUT door glass is a single frost pane (no split). Door depth is behind south-floor Noor; collision covers the real footprint so she cannot walk into the threshold.

Still weak: the painted lamp disc in the glass sits near her hair; at the closest stand her sprite still overlaps the lower door leaf (she is in front, not inside it).

## 2026-11-18 leftovers pass (after 2f70f70)

- The delayed glass copy is texture-cropped to the inner pane and scaled to fit; it no longer spills over the frame. Asserted for front- and back-facing views.
- The copy sits in the left of the pane so the baked lamp disc is to her right, not on her face. A painted-out overlay looked worse (flat holes), so the disc remains as a light in the glass.
- SHUT door contact shadow is slightly stronger.

Still weak: in the front view the lamp disc still grazes the bun; the copy is a bust, not a full-body reflection.
