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

## Linger layer (art-v8, 2 Nov 2026)

Optional, off the main path. Every room has at least 4 story objects to inspect (E or tap), 2+ Blender-rendered ambient loops, a code-vision **toy pair** (two inspectables whose last words swap only with each other), one collectible **unsent line** (the six lines build `unsent.txt` in the pause journal; the HUD shows `unsent n/6`), a stand-still line after 6 s (a different one on revisit), and an inspect-all unlock that reveals one extra code line. Some objects read differently on revisit. Source of truth: `game/src/linger.ts`.

### office
- **o_phone**: Your phone, face up on a desk that isn’t yours. Thirty-seven unread.  
  *revisit:* Your phone, face up. Thirty-eight unread now. One came while you were gone.  
  `phone.unread = 37;`
- **o_calendar**: A calendar stuck on August. Nobody’s fault, it says.  
  `calendar.fault = NOOR;`
- **o_sticky**: A sticky note on the whiteboard: CALL, and a name scratched out hard.  
  `note.name = null;`
- **o_printer**: The printer jammed on page one. Page one was the apology.  
  `printer.job = "sorry.pdf";`
- **o_photo**: A photo, face down. Easier for everyone.  
  `photo.side = DOWN;`
- **o_rain** *(toy: RAIN FEELS SAD)*: Rain on the glass, taking its time. It feels {}.  
  `rain.mood = undefined;`
- **o_lamp** *(toy: LAMP FEELS HAPPY)*: A floor lamp nobody switches off. It feels {}.  
  `lamp.mood = undefined;`
- *stand still:* You stand still. The office does too. It’s had practice. / *revisit:* The rain hasn’t moved on either.
- *inspect-all:* You’ve read the whole room. One thing is missing, and it’s you. `office.missing = "noor";`
- *toy swapped:* The rain cheers up. The lamp takes it personally. / *swapped back:* Everyone goes back to how they were. It’s easier.

### hub
- **h_mirror** *(toy: MIRROR RUNS FORWARD)*: A mirror that copies you a beat late. It runs {}.  
  `mirror.dir = undefined;`
- **h_clock** *(toy: CLOCK RUNS BACKWARD)*: The clock disagrees with the mirror. It runs {}.  
  `clock.dir = undefined;`
- **h_coat**: The coat rack from upstairs, one floor too far. It holds nothing, carefully.  
  `rack.holds = null;`
- **h_notes**: A stack of sticky notes on Fern’s desk. Every one says good morning.  
  *revisit:* The sticky stack on Fern’s desk is one note taller.  
  `fern.notes = 214;`
- **h_plant**: The office plant, but greener. Somebody here remembers to water it.  
  `plant.thirsty = FALSE;`
- *stand still:* Stand still long enough and the room starts copying you. It’s flattering. It isn’t. / *revisit:* The clock has lost another hour. It looks relieved.
- *inspect-all:* Everything here is a reflection. Some of it is running late. `mirror.lag = 0.4s;`
- *toy swapped:* The mirror gets ahead of you. The clock finally goes somewhere. / *swapped back:* The mirror falls back in line. Late, as usual.

### corridor
- **c_moth** *(toy: MOTH WANTS LAMP)*: A moth keeps the lamp company. It wants the {}.  
  `moth.wants = undefined;`
- **c_bucket** *(toy: BUCKET WANTS DRIP)*: A bucket under a slow leak. It wants the {}.  
  `bucket.wants = undefined;`
- **c_umbrella**: An umbrella, bone dry, in a corridor with no weather.  
  `umbrella.wet = FALSE;`
- **c_tape**: Tape on the floor where a desk used to be. It left in a hurry.  
  `desk.owner = "kabir";`
- **c_drip**: Something upstairs is leaking, one patient drop at a time.  
  `leak.source = "floor 3";`
- *stand still:* In the dark you can hear the building think. Mostly about you. / *revisit:* The moth has moved an inch to the left. It calls this progress.
- *inspect-all:* You touched everything in a dark corridor. Brave, or just lonely. `corridor.length = "longer than yesterday";`
- *toy swapped:* The moth goes to the bucket. The bucket looks up at the lamp. Nothing drips upward. / *swapped back:* The moth remembers the lamp. The bucket stops hoping.

### archive
- **a_radio**: A radio tuned between two stations. It can’t commit either.  
  `radio.station = BETWEEN;`
- **a_duck** *(toy: DUCK STAYS AFLOAT)*: A rubber duck, on duty. It stays {}.  
  `duck.state = undefined;`
- **a_memo** *(toy: MEMO STAYS SUNK)*: A memo under the water, still legible. It stays {}.  
  `memo.state = undefined;`
- **a_boots**: Wellies by the wall, lined up neat. Somebody planned for this.  
  `boots.owner = "dez";`
- **a_leak**: A pipe over the pit, keeping time with drips.  
  `pipe.fixed = FALSE;`
- *stand still:* Water keeps the only honest record in here. Every step, a ripple. / *revisit:* The duck has drifted. It doesn’t explain itself.
- *inspect-all:* Nothing in here was ever thrown away. That was the problem. `archive.deleted = 0;`
- *toy swapped:* The duck goes down with dignity. The memo comes up for air. / *swapped back:* The duck bobs back up, unbothered. The memo sinks, relieved.

### arena
- **r_bin**: A bin of crumpled drafts. Nine of them, all yours.  
  *revisit:* The bin of drafts. Ten now. You don’t remember the tenth.  
  `drafts.binned = 9;`
- **r_chair**: One chair, facing the ring. Somebody always watches you rehearse.  
  `audience.size = 1;`
- **r_scrap**: A draft that got as far as one word. Honestly,  
  `draft.opening = "Honestly,";`
- **r_lamp** *(toy: LIGHT RUNS WARM)*: The one lamp, holding the room together. It runs {}.  
  `light.temp = undefined;`
- **r_rim** *(toy: RIM RUNS COLD)*: A ring of light around the floor. It runs {}.  
  `rim.temp = undefined;`
- *stand still:* The arena is quiet the way a page is quiet before you ruin it. / *revisit:* The bin has one more draft in it than last time.
- *inspect-all:* Nine drafts. You only ever sent the first one. `draft.version = 9;`
- *toy swapped:* The room changes its mind about the weather. / *swapped back:* The lamp is warm again. The rim pretends it never wasn’t.

### message
- **m_bench**: A bench for waiting. It has been waiting longest.  
  `bench.waiting = TRUE;`
- **m_plant**: A plant that only grows toward the screen.  
  `plant.light = SCREEN;`
- **m_lamp**: A lamp left on for somebody coming home late.  
  `lamp.for = "kabir";`
- **m_kabir** *(toy: KABIR IS AWAY)*: Kabir’s name in the contact list. He is {}.  
  `kabir.status = undefined;`
- **m_papa** *(toy: PAPA IS TYPING)*: Papa’s name, three dots beside it. He is {}.  
  `papa.status = undefined;`
- *stand still:* Nobody types in here. The silence has three dots in it. / *revisit:* Papa’s last message is still the last message.
- *inspect-all:* Somebody read every word in this room. The receipt says so. `kabir.read = TRUE;`
- *toy swapped:* Kabir is typing. Kabir has been typing for three years. / *swapped back:* Kabir is away again. Papa picks the dots back up.

### Unsent lines (collectibles, one per room)
- office: "Kabir. I'm sorry I made it about the claim."
- hub: "Papa asks about you like you're the weather."
- corridor: "I still leave the hallway light on. Habit."
- archive: "I filed everything except the part where I miss you."
- arena: "I wrote this nine times. This is the honest one."
- message: "Come home for Diwali. I'll make the bad chai."
