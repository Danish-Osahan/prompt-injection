# Room 4 audit — The Flooded Archive

## 2026-11-28 — GB-5b: playtest fixes (Dez's size, visible word selection, weak spots)

Danishpreet playtested `19e419e`: Dez was far too big next to the desk and Noor; with the Caret inside a card, ←/→ only played a sound and the highlight never moved.

- **Root cause of the dead highlight.** `ArchiveRoom.select()` changed the index but never redrew the cards; only the guard path redrew every frame. `select()` now calls `refreshCards()`, and `StaffCard.setSel()` itself redraws immediately (so every card, guard included, is covered).
- **Highlight.** The selected word is reverse-printed: a near-black block with the word in paper colour and a cyan underline with end ticks, plus a short cyan flash on every move. Unselected words in an open line are dimmed. Ready (open-line) state prints a cyan underline under each word. No circles, rings or floating text.
- **Dez.** Re-rendered at 1.12 scale (about Noor's height, desk about 123px wide); card anchor, desk collider (`DESK`) and speaker spot follow. While a line is open the speaker's rig is lifted above Noor so she cannot cover the card.
- **Cards.** Dez's and the Keeper's cards are 1.35x (`STAFF_RECORDS` scale, `CH`), same spot, same ~4-word lines.
- **Keeper.** Fuller geometry (drawer body, head scale 1.25, index cards), still a stilted box-man.
- **Asleep Dez.** New head/arm pose, warm rim light, so the silhouette reads against the monitor glow.
- **Open-line sign.** Cyan magstripe with `OPEN`, cyan wash scaled by the pulse, bold glowing edge (2.2px, blur 13), cyan underlines under each word.
- **Right half.** Two records lockers on the back wall, one warm floor lamp by the exit (a quiet pool of light baked into the plate), a stack of boxes; all have colliders (`rooms.ts`, GB-5b comment).
- **Warm-up.** The plate after the trade is a baked, relit `archive13_warm.jpg` cross-faded in over 2.2s (instead of the multiply rectangle).
- **Reach.** `DEZ_REACH` 175 -> 165 so the Keeper's side of the floor (walkable floor ends about x 460) is outside Dez's reach with the bigger card; test spot for the Keeper is now (480,470).
- **Tests.** `archive_softlock.mjs` E and `corridor_softlock.mjs` O press real ←/→ and check, within 60ms, that the card's drawn selection equals the new word, `selMoves` increments (not at the clamp), and a pixel probe (`StaffCard.probe`, exposed as `probes` in `testState`) finds the dark block and cyan underline on that word only.

## 2026-11-28 — GB-5: one trade, the Keeper's lamp (built from the approved plan)

Plan: `/workspace/l12-next/PROPOSAL.md` (approved as proposed, with the lamp sweep). Code: `game/src/archive.ts`; rules in `docs/caret.md` (Room 3 section).

**Story.** Records come here when nobody reads them. Dez, from the office (`DEZ: BACK MONDAY :)`), was filed down here asleep at his desk. Lines, every one in a named box with a portrait (Dez has his own, a render of his model):
- On entry: Fern "Records come here when nobody reads them." / Noor "That's Dez's desk."
- First time the Caret opens Dez's card: Fern "Cards give words too. Take his."
- First filing: Fern "Its light files you. Keep to the dark."
- After the trade: Dez "Monday came. Nobody read it." / "The winch. I've got it."

**Puzzle (the only one).** DEZ IS ASLEEP (Dez's lanyard card) and KEEPER IS AWAKE (the Keeper's lanyard card). Caret into Dez's card, select ASLEEP, hold E: the Caret carries it. Near the Keeper the card shows the open-line sign (print through the bars, cyan edge); F sends the Caret in; select AWAKE, F: ASLEEP is written and AWAKE flies back to Dez in the same step. The Keeper slumps on its stilts and sets the lamp on the water; the room warms; Dez wakes and lowers the bridge on the winch. Walk east to the arena.

**Removed.** LOW/DOWN chain (drawer, water, stairs, bridge plates), cooler/WET, books/APART, towel/DRY, ink, the sticky-note swarm and the Scribble, the duck, boots, cooler, ink, books, notes, towel art, the ripple rings and the bright cyan pool. Plates in the room: 2. No enemies.

**Look.** Same archive plate with the clutter painted out and regraded colder (`art/tools/archive13_post.py`); the pool is black-teal with five faint sheen lines; three lights only: Dez's desk lamp (warm), the high window slit (cold), the Keeper's lamp (warm strip). Drip and slow sheen loops only.

**The Keeper.** Its own Blender figure (`art/tools/archive13.py`): two tall stilts, a filing-drawer body with index cards, a tilted head, lanyard card, lamp on a pole. It stands in the water; its lamp sweeps a narrow angled strip across the near floor on a 10 s cycle (no discs, no rings). About 1 s in the light files Noor (FILED, fade to the doorway, no damage, everything snaps home). The doorway column and the shadow behind Dez's desk are always safe.

**Sound.** `ambience/archive13.ogg` (the CC0 cellar tone, low-passed, + a synthesized 49 Hz submerged hum + reversed page turns); Keeper stilt clunks on its sweep turn; Dez's sleeping breath louder as Noor nears, which stops on the wake; a filed stamp. All synthesized except the CC0 base (CREDITS.md).

**Soft-lock safety.** Plates change only in the atomic trade; the carried word is view state, so any interruption (recall, filing, bounce) sends it home to Dez. Flights hold input; Q during a flight is queued; 0.35 s grace on landing in the Keeper line; filing snaps every phase home; the bridge falls back after 6.5 s if Dez's line is skipped. `tests/archive_softlock.mjs` (real keys): A mash F, B recall in every phase, C filed while carrying and while inside the Keeper line, D wrong-word take / wrong-slot write / out-of-range and empty-Caret bounces. Each ends with the trade, the bridge down, and A and D cross the bridge to the arena.
