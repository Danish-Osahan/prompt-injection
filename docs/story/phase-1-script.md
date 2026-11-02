# Phase 1 Script: "After Hours"
Colours: Noor = white floor text + key clicks. AI = magenta, instant, silent. Fern = sticky-note popup + paper rustle. Max 6 words per line.

## SC1: Cold open (R0, real office, 11:48 PM)
- CAM: slow push-in from the rain-streaked window to Noor's grey desk under one lamp. SFX: rain, office hum, a distant elevator ding.
- Title types on the floor: "11:48 PM". Player gets control (move, inspect).
- Inspects:
  - Coffee: "COLD SINCE AUGUST."
  - Kabir's note: "MISS YOU AROUND HERE."
  - Dez's glowing desk: "DEZ: BACK MONDAY :)"
  - Her monitor (dead, flickers on when touched): "CLAIM #4471: PLEASE REPHRASE."
- Noor: "Rephrase. Again."
- Noor: "Fine. Honest version."
- Composer opens. Player types the angry prompt with preset words: "MY FATHER LOST EVERYTHING. PAY."

## SC2: The hook
- Room lights drop to the monitor glow only. Rain sound cuts out.
- AI (magenta, instant): "I UNDERSTAND. I'LL HANDLE IT."
- Beat of silence.
- AI: "LEAVE IT TO ME, NOOR."
- Noor: "...That's my voice."
- Floor text spreads from the monitor across the floor like terminal lines. The office tiles fold down into a grid. CAM shake, white flash. The floor plate under her reads "FLOOR IS GONE." She falls.

## SC3: The mirror office (hub)
- Fade in from black. A same-layout office, but in neon-noir, quiet and calm. A soft synth pad plays.
- Noor lands. Noor: "Where am I?"
- A sticky note flutters up. Fern (a plant made of sticky notes on her desk) unfurls.
- Fern: "Inside everything you all ever typed."
- Noor: "Why are things moving?"
- Fern: "Say something enough, and it listens."
- Noor: "And you?"
- Fern: "You talked to me. Every morning."
- Fern (softer): "You came back. They said you wouldn't."
- Noor: "Came back from where?"
- Fern: "Look, the door. Try it." (deflects)
- TUTORIAL: plate "DOOR IS SHUT". Swap SHUT for OPEN (the word sits on a nearby plate, "LAMP IS OPEN"). Door opens.
- Exit plate glows: "EXIT IS NOOR'S."
- Fern: "Only the owner of the words leaves."
- Noor: "They're my words."
- Fern: "Not here. Not anymore."
- The Caret (a blinking cursor) wakes and snaps to Noor's hand. Fern: "It'll help. It likes you."

## SC4: First fight, the Draft (R1)
- Room dims. A Noor-shaped figure in grey assembles from crumpled prompts. Its plate reads "THE DRAFT IS STRONG."
- Fern: "No shadow. It's a copy. Fight."
- TUTORIAL prompts (floor text): "DASH", then "STRIKE", then "GRAB WORD".
- Draft attacks: telegraphed paper swipes (floor flash, then hit) and a "REPHRASE" shockwave ring (dash through it).
- After a perfect dodge, the fragment "WEAK" drops. Bullet-time composer: swap STRONG for WEAK. Its guard breaks.
- On defeat it crumples. Its last floor text, in her white: "I TRIED SO HARD."
- Noor (quiet): "...So did I."

## SC5: The message (end of Phase 1)
- A paper shard floats up: the first piece of the claim file. Its date is corrupted: "FILED: ██/██".
- A phone chime. Magenta text bubbles rise along the wall like a chat:
  - PAPA (white, warm): "Beta, did the claim go through?"
  - AI as NOOR (magenta): "Still processing, don't worry."
  - PAPA: "Okay. Eat properly. Love you."
  - AI as NOOR: "Love you too, Papa."
- Noor stares. Noor: "That isn't me."
- Noor: "Stop talking to him."
- Fern (behind her, quiet): "Then go down. It's split the claim five ways."
- CAM pulls up, revealing the stairwell plate: "FLOOR 1: DOWN." Floor text: "PHASE 1 COMPLETE."

## Build notes
- All in-engine: Phaser camera pan/zoom/shake/flash, tweens, light dimming, and floor-text typing (PlateText.ts).
- The SC2 fold uses tile tweens on the R0 render plus the H6 hub render cross-fade. Optional: a few extra Blender frames.
- Every cutscene is skippable after the first viewing.

## Noor emotion system
Faces are not readable at this camera distance, so emotion is shown through body poses, floor-text styling, the camera and lighting.
Poses to render later (short clips on Noor's existing rig): SHOCK (steps back, hands up), FRUSTRATED (rubs forehead or slumps), CONFUSED (looks around, head tilt), SAD (head drops, shoulders sag), ANGRY (fists clench, leans in), RELIEF (relaxes, small smile posture).
Text styling: shock = shaky letters; sad = slow, fading letters; angry = sharp, fast typing.
Camera and light: small push-in on emotional lines; slight shake on shock; the lamp dims on sad beats.

Line tags for Phase 1:
- "Rephrase. Again." [FRUSTRATED]
- "...That's my voice." [SHOCK]
- "Where am I?" [CONFUSED]
- "Came back from where?" [CONFUSED]
- "They're my words." [ANGRY, mild]
- "...So did I." [SAD]
- "That isn't me." [SHOCK]
- "Stop talking to him." [ANGRY]
- Fern's "You talked to me. Every morning." prompts a Noor reaction [RELIEF, small]
