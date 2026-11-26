# The Caret: one job

**What it is.** Noor's stolen write-cursor: the blinking I-beam that was hers before the system took her words. The game shows only one, the cyan I-beam.

**Its job.** Some things hide their words. The Caret goes inside one of these things and opens its line so Noor can write on it.
- Ordinary things show their words, and Noor takes and throws them without the Caret: E (hold) takes a word, F throws it.
- A guarded thing shows no line until the Caret is inside it.
- Throwing a word at a guarded thing before then bounces off; there is nothing to write on yet.

**Controls.**
- F with empty hands, while a guarded thing is in range: the Caret flies in. The line types itself onto the thing (a printed strip on the corridor guard: `GUARD IS QUICK`), and the Caret parks blinking at the end of it, where the next word will go.
- F while holding a word next to a still-locked guarded thing: the Caret goes in first and the word stays in hand. The next F throws the word.
- When the word lands, the Caret comes home to Noor.

**What it never does.**
- It never takes words (E does that).
- It never aims or carries bolts or melee. Combat doesn't use it at all; the old "the cursor aims" hint and bolt routing are gone.
- It never sticks to things as a marker.
- Sending it at anything that isn't guarded does nothing (`GUARDED = ['c_dummy']` in `game.ts`).

**How the player learns it.**
1. Hub: holding E at the end of the etched rift word takes the Caret. Fern (box): "That's your cursor. They took your words, not that." Then: "Some things hide their words. Send it in, and you can write there."
2. Corridor, forced first use: the guard blocks the only exit.
   - When Noor gets near, Fern says: "That guard blocks the exit. It hides its words." Then: "Press F. Send your cursor in." The chip reads `F  WRITE INTO IT`.
   - Hitting the QUICK guard does nothing: it smear-dashes out of the blow. Fern says once: "It's quicker than you. Hitting it won't work." Then, if the line is still locked: "Send your cursor in first." If the Caret is already in: "Take STILL from the clock."
   - Throwing at it bounces off until the line is open.
   - F sends the Caret in. `GUARD IS QUICK` prints across its chest with a cyan flash and a small shake, and the Caret parks at the end of the strip. Noor: "My cursor's in it. I can see its line." Fern: "GUARD IS QUICK. The clock has STILL." Then: "Hold E on the clock. Then F to throw STILL at it."
   - STILL is etched under the stopped clock (same style as the rift VOID). Hold E to take it — the clock then reads QUICK in gold — and throw it (F) into the open line. The guard reads `GUARD IS STILL`, eases home, drops its head, and its name card greys out. Fern: "It's STILL now. Still paper tears." Then: "J to strike."
   - The STILL guard tears under the TYPE combo, and the exit opens. Fern: "It tore. The exit is open."

**Visible effect every time.** The Caret flies in, the line types out with a cyan flash and a small shake, and the Caret parks blinking at the end of the line. It returns to Noor when the word lands.
