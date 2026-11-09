# Power rewrite: Steal Qualities (story pass)

*Writing only. For Danishpreet to read before art or code changes.*  
*Grounded in `phase-1-after-hours.md`, `phase-1-script.md`, `phase-1-levels.md`, `enemies.md`, and the steal-qualities direction.*

*Gameplay rules + full Phase 1 room flow (compatibility, Undo, edge cases, loophole checklist): **`docs/design/power-rules.md`**. The five open questions in §8 stay open.*

---

## 1. What changes, what stays

**Stays (locked story spine)**  
Noor Sethi falls into the company AI. Fern guides her. The Draft is the Phase 1 boss. Papa’s messages and the split claim still pull her downward. The big twist still holds: the player is an **echo** — a copy built from the real Noor’s prompts — and the real Noor quit in August. Copies cast no shadow. The Sethi Signs claim rejection still dates *before* the fire (Phase 3 payoff). Endings still turn on what she does with “her” voice.

**Changes (how she acts on the world)**  
Word swapping, caption chips, code vision, and on-screen rule plates go away as the player’s verbs. In their place: **steal qualities**. Noor pulls a *description* off one thing and presses it into another. Nothing writes text on the object. The room just *looks* different — the window shuts, the door opens, the ink dries, the Draft crumples.

That is not a new magic system bolted on. It is the old world rule, made physical — and it is literally a **prompt injection**, which is why the working title finally explains itself.

---

## 2. In-world rules of the power

### How the world works
Inside the AI, things come alive from what people typed about them. A window is open because someone described it open. A door is shut because the ticket said so. Complaints thicken into enemies; kindness thickens into Fern. Qualities are not labels on a UI. They are **stuck descriptions** — ink that has soaked into the thing.

### What Noor can do
Because she is made of the same ink — an echo of the real Noor’s prompts — she can **peel** a description off one object and **press** it into another.

- **Take (E):** Near a shimmering object, pull its quality into her hand. The source loses it (window slams, rain stops, tank drains).
- **Throw (F):** Fling the carried quality into a target. The target takes it on (chains snap, door opens; wet melts a Scribble; paper crumples chrome).
- **Attack (J):** Still her hands and the Caret — close combat. Attack does not throw.

She only holds what the room has already been said to have. She cannot invent “laser” or “god.” She can only move descriptions that already stick.

### What can be taken (Phase 1 palette)
Physical, readable states — the ones players already meet as plates:

| Quality | Typical source | Typical use |
|---|---|---|
| **open** | Window, drawer, lamp that “keeps watch” | Open a shut door / exit |
| **wet / water** | Cooler, pipe, ink bottle | Melt ink enemies, soak paper |
| **dry** | Towel, umbrella | Crack wet ink, scatter sticky notes |
| **paper** | Scrap, pillar, bin of drafts | Fold chrome / metal guards |
| **weak** | Scrap, paper pillar | Break a Draft’s confidence |
| **slow** | Clock, sticky floor | Soften a charge |
| **still / quick** | Dummy, clock | Wake or quiet a dummy |

Later floors can add ALL/ONE, DENIED/OPEN, etc., as *qualities of paperwork*, not as words printed on enemies.

### Limits and cost
- **One quality at a time** in Phase 1 (hard rule in `power-rules.md`; combat.md’s older “max 2 orbiting” is superseded for Phase 1).  
- **Range:** She must stand near the source to take; throw is short — arm’s reach plus a short flight.  
- **Compatibility / Undo / threshold snap / soft-lock:** see `power-rules.md` §§A–B. Wrong throws splash home; rooms don’t export held ink.  
- **Cost — ink thinness:** Each peel costs a little of her. After a heavy steal, her edges may soft-glitch, her footfalls go quieter, the lamp light around her washes out for a beat. Fern can notice. This is the same economy as “she is made of words” — spend too freely and she feels thinner. It is a *hint*, not a fail state in Phase 1. (**Pending Q1** — whether P1 shows this.)  
- **Cannot peel people.** Living copies (Draft, Echo later) do not volunteer their qualities; she cracks them by throwing the right world quality *onto* them, or by fighting.  
- **Awake things fight back.** Fern, the Caret, and anything that casts a shadow will not casually give up their nature. Fern’s “good morning” loyalty is not a free battery.

### Why enemies are vulnerable
Enemies are complaints given bodies. Their “guard” is whatever they are *said* to be — strong, wet, stuck together. Throwing the opposite description into them is not a UI rewrite; it is changing what they are made of. That is why a wet Scribble can melt, and why a Draft that was sure of itself can crumple when **weak** lands.

---

## 3. Phase 1 rooms and beats

### R0 — Real office (cold open)
**Unchanged in story.** Rain, claim, angry prompt, AI answering in her voice, the fall.  
**Tutorial change:** No word swap. She still walks, inspects, types the prompt. Inspects stay as short spoken/floor lines (“Cold since August.”), not boxed chips. No code vision.

### Mirror hub — discovery cutscene (the new teach)

This replaces the old “DOOR IS SHUT / LAMP IS OPEN” swap tutorial.

**Beat (office teach, ~same length as the mock-steal window→door)**  
1. Noor lands. Fern unfurls. World rule exchange stays, trimmed:  
   - Noor: “Where am I?”  
   - Fern: “Inside everything you all ever typed.”  
   - Noor: “Why are things moving?”  
   - Fern: “Say something enough, and it listens.”  
   - Noor: “And you?”  
   - Fern: “You talked to me. Every morning.”  
   - Fern (softer): “You came back. They said you wouldn’t.”  
   - Noor: “Came back from where?”  
   - Fern: “Look. The door.” *(deflects, as locked)*

2. The exit door is chained / shut. The window is open — rain and wet curtains (or blinds) blow in. No words on either.

3. **Discovery (player-driven, then scripted panic):**  
   She goes to close the window — habit, office muscle memory. On touch, the **open** comes free. Rain and wind curl into her hand. She panics.  
   - Noor: “What— what is this?”  
   She flings it at the only other thing that matters: the door. Chains snap. Light spills. The door opens.  
   - Fern: **“You’re not supposed to be able to do that.”**  
   Quiet beat.  
   - Fern: “Things keep their words. People don’t… peel them.”  
   - Noor: “Then what am I?”  
   - Fern: “Someone who talks to ferns. For now, go through.”

4. **Caret** still wakes and snaps to her hand. Fern: “It’ll help. It likes you.”  
5. **Exit plate** idea stays in spirit without a word chip: the door that knows her name still won’t let *just anyone* leave — but the *reason* shifts from “only the owner of the words” as a swap puzzle to “only someone made of those words can carry them out.” Fern can say: “Only the owner of the words leaves.” Noor: “They’re my words.” Fern: “Not here. Not anymore.” *(unchanged lines; new meaning underneath)*

**Controls teach:** E near shimmer = take. F = throw. J = attack. Shown once as a small hint strip, never as world text.

### Dark corridor
**Was:** swap OFF/ON on lamp and switch; hold READ for code vision; dummy STILL→QUICK.  
**Now:**  
- Take **on** from the painted-over switch (or a glowing emergency strip) and throw it into the dark lamp — light blooms, Fern’s note appears.  
- Dummy: take **quick** from the racing clock (or throw **still** off it onto the dummy to wake a slow swipe). No plate text.  
- Secret wall that was `wall.solid = TRUE` becomes a **visual**: a painted-over door seam you can only notice when the lamp is lit and you stand still — Fern: “Someone sealed that. On purpose.” No lens UI.

### Flooded archive
**Was:** HIGH/LOW then UP/DOWN word order puzzle.  
**Now:** same *logic*, physical states:  
1. Take **low** from the drawer (or take **high** water and throw it into the drawer’s “low” — design pick one clean pair). Water drains; stairs/bridge quality becomes reachable.  
2. Take **down** (or throw **up** off the bridge into the stairs). Bridge lowers.  
Order still matters. Fern’s leaf still points after a long stall. Scribble / sticky notes crack with **dry** / **apart**-as-scatter (taken from towel / books), thrown, not swapped on a caption.

### Draft arena (boss) — story terms
**Was:** grab WEAK fragment, bullet-time rewrite “THE DRAFT IS STRONG.”  
**Now:**  
- The Draft is still her unfinished work, shadowless, Noor-shaped.  
- Fern: “No shadow. It’s a copy. Fight.” *(keep)*  
- Guard break: a paper pillar / scrap in the arena holds **weak** (or **paper**). She peels it and throws it into the Draft’s confidence — it physically crumples, staggers, guard drops.  
- Split phase: the fake still has no shadow; throw anything that marks it as **copy** scrap, or simply read the missing shadow and hit it once.  
- Defeat line stays hers, quiet: “…So did I.” Last floor-text can remain a rare exception (her own white ink), or become a soft spoken line only — open question below.

### Message room
**Unchanged.** Papa’s chat, AI-as-Noor replies, “That isn’t me,” stairwell down. Word Memory tease can become: the AI’s magenta reply quietly uses a quality she threw often (“Still *open*, don’t worry”) — optional, Phase 2+.

---

## 4. Draft boss and guard break (story)

The Draft is not “a plate with STRONG on it.” It is every rephrased claim she never sent, standing up. Its strength is the story it tells itself: *I am the version that will get through.*

When Noor throws **weak** (or **paper**) into it, she is doing what the company AI did to her for years — forcing a rewrite — except she does it with her hands, because she *is* rewrite. Fern’s “you’re not supposed to be able to do that” still hangs over the fight: a human trapped in software should not peel meaning off a pillar. An echo can.

Guard break fantasy: splat → Draft’s paper body softens → shield crumples → punish window. No floating WEAK tag. The pillar looks emptier after the peel; the Draft looks unsure.

---

## 5. How this seeds the echo reveal

| Clue | Old form | New form |
|---|---|---|
| Missing shadow | Taught by Fern; `noor.shadow = null` in code vision | **Visual only.** Lamps throw shadows from desks, Fern, coffee. Under Noor’s feet the floor stays clean. Fair, missable. Final mirror room still pays it off. |
| “You’re not supposed to…” | (new) | Fern’s discovery line. First clear signal she is outside the rules people get. |
| Thinning / glitch after steals | (new, soft) | Cost that rhymes with “made of ink.” Builds toward Phase 4 “Check your shadow. Please.” |
| Fern’s deflections | Locked lines | Unchanged text; player now has a second lens: *why* can she peel? |
| Sethi Signs pre-date | Phase 3 file | Unchanged. Power does not replace that mid-game gut punch. |
| Title | Aesthetic | **Prompt injection** = peeling a description from one context and injecting it into another. The mechanic *is* the metaphor. |

Player and Noor still believe she is a trapped human through Phase 1–2. The power is a quiet wrongness, not a speech.

---

## 6. What we retire (and where it goes)

| Retired | Re-home |
|---|---|
| **READ / code vision** (hold E → teal wireframe, `obj.field = VALUE`) | Gone as a player verb. Lore that lived only in code lines moves to inspect flavour, lighting, or Fern. |
| **Caption chips / boxed words** on the HUD bar | Gone. Objective pill + one dialogue caption stay (as in steal mock). |
| **Word lens secrets** (`fern.awake`, `wall.solid`, `noor.shadow = null`) | **Visual / behaviour clues.** Fern already “awake.” Wall seam when lit. Shadow absence under lamps. |
| **Bullet-time REWRITE UI** | Replaced by peel → throw. Optional slow-mo later, not Phase 1 default. |
| **Enemy rule plates** (“THE DRAFT IS STRONG”) | Enemies show material (chrome, ink, paper). Fern or a single caption may name a throw *once* (“Paper — it folds.”), never text glued to the body. |
| **“E TO READ” inspect tutorial** | Becomes “E near a shimmer” for take; inspect can stay a short look without a word picker. |

Linger toys that were “swap RAIN FEELS SAD / LAMP FEELS HAPPY” become optional quality tosses later, or stay cut until Phase 2.

---

## 7. Fern’s key lines (Phase 1, natural voice)

Keep six-words-max where the old script demanded it; discovery can breathe one longer beat.

- “Inside everything you all ever typed.”  
- “Say something enough, and it listens.”  
- “You talked to me. Every morning.”  
- “You came back. They said you wouldn’t.”  
- “Look. The door.”  
- **“You’re not supposed to be able to do that.”** *(discovery — protect this line)*  
- “Things keep their words. People don’t peel them.” *(optional softener after discovery)*  
- “Only the owner of the words leaves.”  
- “Not here. Not anymore.”  
- “No shadow. It’s a copy. Fight.”  
- “It’ll help. It likes you.” *(Caret)*

---

## 8. Open questions for Danishpreet

1. **Cost visibility:** Soft glitch / thinner edges after a steal in Phase 1 — yes, or save “thinning” for Phase 3–4 so discovery stays pure panic?  
2. **Exit ownership:** Keep Fern’s “only the owner of the words leaves” verbatim, or rewrite one line now that ownership means *being made of* the words?  
3. **Draft’s last line** (“I TRIED SO HARD” as floor text): keep as the one diegetic text exception, or go fully spoken/no text?  
4. **Archive pair:** Prefer take-from-drawer **low** vs take-water-**high** as the first step — which reads clearer in a muted top-down room?  
5. **Title:** Does “Prompt Injection” stay the working title now that the mechanic is the metaphor, or do we still plan Voice Match / Draft Zero for storefront?

---

*End of story pass. No `game/src` changes in this document. Gameplay numbers stay in `docs/design/combat.md`; this file only explains how and why.*
