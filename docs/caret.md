# The Caret: one job

**What it is.** Noor's stolen write-cursor. It's the rendered pale I-beam with small eyes (`assets/sprites/caret_idle.png` / `caret_move.png`, from the first commit). It is the only cursor on screen. The cyan code-drawn I-beam (added in 11dacf0) is gone, and `drawCaretMark` now always hides.

**Its job.** Some things hide their words. The Caret goes inside one, and only there can Noor see the line and choose which word to change.
- Ordinary things show their words. Noor takes and throws them without the Caret: hold E to take a word, press F to throw it. Reading (floor notes, letters, wall notes, lookables) is R, never E.
- A guarded thing shows no words until the Caret is inside. Its line is printed on its staff ID card, and while hidden the card carries only ragged ink bars where the words would be (no letters exist anywhere in the display list). There are no rings.
- While the Caret is inside, the full line prints on the card. The selected word is reverse-printed (a block of ink with the word knocked out), and the Caret stands just past the card's right edge on that word's row, so it never covers the word.
- Only the selected word can be replaced, and only if it's the word that can change. Any other selection bounces the throw with a short reason, and the word goes home to where it came from.
- When the Caret leaves, the line hides again, unless it's solved.

**Controls (corridor guard).**
| Input | Effect |
|---|---|
| F, empty hands, guard in range (460px) | The Caret flies in. `GUARD IS QUICK` prints on the guard's ID card (rows `GUARD IS` / `QUICK`). The Caret lands on GUARD, the first word. |
| F, holding a word, line shut | The Caret goes in first and the word stays in hand. |
| Hold E at the clock, Caret inside | Takes STILL. The Caret stays in the guard on the word it was on. Both orders work: take first then send, or send first then take. The clock's reach is 190px (other sources 130px), so the end of the left hall under the clock counts. Holding E out of reach with the Caret inside shows `STILL IS ON THE CLOCK` and cues the clock. |
| ← / → (or mouse hover over a word, or tap on touch) | Move the Caret word to word. ← / → don't move Noor while the Caret is inside; ↑ / ↓ and WASD still walk, so an arrow-key player can reach the clock. |
| Hints near the guard | The one HUD hint chip (`← → MOVE CURSOR`, `F THROW`, …) is placed off the guard's ID card and the parked Caret: below Noor first, else shifted left/right, further below, or above. The clock hangs above the top of the walkable floor, so Noor never covers its face or word. |
| F, holding a word, Caret inside | Throw (never a recall while a word is in hand). If QUICK is selected, it becomes `GUARD IS STILL`: STILL re-prints in teal on the card with a short print-head wipe (260 ms). If GUARD or IS is selected, the throw bounces, Fern gives the reason, and STILL returns to the clock. |
| F (empty hands) / Q / Esc, Caret inside | Recall: the Caret comes home and the line hides again. Esc recalls instead of opening the menu while the Caret is inside. |
| SPACE while the Caret is out | No dash. A `CURSOR OUT` tag shows, and Fern explains once. Walking still works. |

**Cost.** While the Caret is out (flying in, or inside a line), Noor can't dash. To keep that fair, the guard's repeat swipe wind-up goes from 0.20s to 0.5s while the Caret is out, so you can walk out of the reach of a readable tell. The first swipe was already 0.95s.

**Soft-lock protections (unchanged).** F mashed while the Caret is in flight is ignored and the word stays in hand. A throw at the open line can't be dodged or missed from any range. A missed or bounced word returns to the clock. If the clock shows QUICK while nothing is held and the guard isn't STILL, it resets to STILL after 1.6s. Wrong-word bounces use the same return path, so they can't strand STILL.

**Fern's teaching lines (named boxes with portraits).**
1. Near the guard: "That guard blocks the exit. It hides its words." / "Press F. Send your cursor in."
2. Caret lands: Noor: "My cursor's in it. I can see its line." / Fern: "← → move your cursor. Put it on QUICK." / "Hold E at the clock for STILL. F throws it in." (or "You have STILL. F throws it in." if it is already in hand)
3. Wrong word (once per word): "GUARD is what it is. Can't cut that." or "IS just joins words. Can't cut that." / "Move onto QUICK. STILL is back on the clock."
4. First blocked dash: "No dashing while your cursor's out. F with empty hands calls it back."
5. Hitting the QUICK guard: "It's quicker than you. Hitting it won't work." / "Send your cursor in first." (line shut) or "Put your cursor on QUICK. Throw STILL." (Caret inside)
6. STILL lands: "It's STILL now. Still paper tears." / "J to strike." Then after the tear: "It tore. The exit is open."

**The staff ID card (`game/src/staffCard.ts`).** World rule: every enemy is a staff record and wears an ID card in a fixed, big-enough spot; its line (about 4 words, two rows) is printed on it. The card face is a 4x canvas texture shown at 1x (62 x 42 px). It is lit like the paper body it is clipped to (tones sampled from `sentinel.png`): the warm lamp keys it from the right like the body's lit faces, a cool fill from the left matches the shaded faces, the lower edge falls off toward the chest, the clip occludes the face above it, and the thickness edge is lamp-lit on the right and shaded on the left. On it: magstripe, the line in Barlow Condensed ExtraBold (Q tail printed a little heavier so it reads at 1x; a re-printed word is dark teal `rgb(0,60,72)` with a darker `rgb(0,38,48)` stroke and underline so it holds at 1x), a footer with the name (red while it guards, grey once stopped) and a barcode, a faint diagonal sheen, a contact shadow and the mount. The card is a child of the enemy's rig container, so it inherits position, lean and rotation (`setLean`). Dash afterimages are the whole rig: the stand plus a copy of the live card (`card.ghostImage()`), so the ghosts carry the line too.
- The Caret beside the card is the original pale sprite at scale 0.5 (0.45 in hand), with a dark outline: four `0x05080c`-tinted copies of the same frame offset by 1.2–1.6 px (`syncCaretEdge`), so it reads on the pale card at 1x.
- Config: `STAFF_RECORDS[id] = { line, anchor, scale, mount, name, tilt }`. `mount` is `clip | tape | holder | lanyard`; only the guard (`c_dummy`, `clip`, anchor `(0, -158)`) is built.
- States: `hidden` (ink bars, `printed === ''`), `open` (line printed, `sel` reverse-printed), `still` (changed word re-printed in teal with a wipe).
- Hooks: `card.wordBox(i)` (world box per word: mouse hover and floor tags use it), `card.caretSpot(i)` (where the Caret stands), `card.edge()`. Test state: `__pi.state().card` (`state`, `printed`, `selWord`, `fresh`, `wipe`, `rot`, `lean`, `parented`, `rigText` = Text objects inside the guard's rig, must be 0).

**What it never does.** It never takes words (E does). It never aims bolts or melee. It never sticks to things as a marker. Sending it at anything that isn't guarded does nothing (`GUARDED = ['c_dummy']`).

## How this scales to multi-word lines (design only, not built)

A guarded line is a sentence, and the Caret's selection is the verb's object. The thrown word replaces whatever word is selected, and each word slot decides what happens when it's replaced:

```
DOOR IS LOCKED AND LOUD
 0   1    2     3   4
```
- Each slot is marked as `name` (DOOR: never replaceable, same reason as GUARD), `joint` (IS, AND: never replaceable, "just joins words"), or `state` (LOCKED, LOUD: replaceable).
- Different cuts give different results. Throwing QUIET onto LOUD gives `DOOR IS LOCKED AND QUIET`: the door stays locked, but you can sneak past the room's listener. Throwing OPEN onto LOCKED gives `DOOR IS OPEN AND LOUD`: the door opens, but it alarms and wakes the room. The player picks the outcome by picking the word.
- Data shape: plate `words[]` plus `slots: { [i]: 'name' | 'joint' | 'state' }` and per-slot `STICKS` (which words each state slot accepts). The current single `def.slot` is the one-state-slot case of this. `compatible(word, dest)` would check `slots[caretSel] === 'state' && sticksAt(dest, caretSel).includes(word)`. `evaluate()` reads each slot by index.
- Bounce reasons come from the slot kind (name/joint/state-but-wrong-word), so new rooms get readable failures for free.
- Selection stays one word at a time (←/→). Longer lines don't need any new input.
- The cost (no dash while out) and the recall rule (F empty / Q / Esc) carry over unchanged. In later rooms, recalling to dodge and then re-sending becomes part of the fight rhythm.
