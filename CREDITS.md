# Prompt Injection (working title) - asset credits

All art below is CC0 (public domain); credit is not required, given anyway.

- Kenney (www.kenney.nl), "Furniture Kit" 2.0 - CC0 (License.txt in zip, checked 28 Oct 2026). Desk, chairDesk, computerScreen, laptop, bookcaseClosedWide, trashcan, pottedPlant, kitchenCoffeeMachine, lampRoundTable, televisionModern, doorway, coatRackStanding (+ others rendered).
- Quaternius, "Universal Base Characters", "Universal Animation Library", "Modular Character Outfits - Fantasy" - CC0 (licence files in zips). Noor, Dez (base + Peasant outfit + hair), all UAL actions.
- Quaternius, "LowPoly Animated Monsters" and "LowPoly Animated Knight" (OpenGameArt, CC0) - Autocomplete (slime), Hallucinator (dragon), Refusal Warden (knight), Sycophant (skeleton), Redactor (bat).

Pipeline: Blender 4.2.9 (/opt/tools) headless CPU renders -> pixelised in Python (build_pi.py).
Downloads: /workspace/games/_downloads/furniture-kit/, /workspace/games/_downloads/quaternius/.

## Art direction v2 (art-v2/) — added 2026-10-28

Shipping-candidate assets used in the v2 style samples (licence text checked in each downloaded pack):

| Asset | Author | Licence | Verified from |
|---|---|---|---|
| Mini Characters 1.0 (12 modern casual/office characters, 30+ animations; used for Noor, Dez, Fern) | Kenney (kenney.nl) | CC0 1.0 | `_downloads/mini-characters/License.txt` |
| Furniture Kit (desks, monitors, chairs, bookcases, boxes, cabinets, lounge set, TVs) | Kenney | CC0 1.0 | `_downloads/furniture-kit/License.txt` |
| UI Pack font "Kenney Future" / "Kenney Future Narrow" (direction C UI) | Kenney | CC0 1.0 | `_downloads/ui-pack/License.txt` |
| Pixelify Sans font (direction A/B mock UI) | Stefie Justprince, via Google Fonts | SIL OFL 1.1 (commercial OK; FLAG: keep licence file if shipped; not CC0) | Google Fonts listing; no licence file on box |

Made here (original, no third-party content): all screen/sticky-note/poster/whiteboard/rule-plate/floor
textures (`art-v2/tools/make_tex.py`), the enemy builds (Refusal Warden, Sycophant, Autocomplete keycaps,
Caret) assembled from Kenney Furniture Kit parts + primitives in `art-v2/tools/scene.py`, and all
post-processing (`art-v2/tools/post*.py`, `sheet.py`). Noor is Kenney `character-female-d` with a recoloured
copy of the colormap (cardigan, hair, skin); Fern is the same model with a hologram shader.

Researched, licence confirmed, not used yet:
- Quaternius Ultimate Modular Women / Men (casual, worker, formal, sci-fi parts) — CC0 (quaternius.com pack page; Poly Pizza "Woman Casual" listed Public Domain CC0).
- KayKit packs by Kay Lousberg — CC0 1.0 (itch.io pages and GitHub LICENSE.txt). Request: don't resell unmodified copies.

Concept frames in `art-v2/concepts/` are AI-generated mood references only. They are NOT shipping assets
and must not be traced or shipped.

Pipeline: Blender 4.2 Cycles CPU headless -> mist + object-index passes -> PIL/numpy post
(fog, bloom, palette quantisation, index-based outlines, particles, UI).

## Art direction v3: hybrid (art-v3-hybrid/), added 2026-10-28

Rule for v3: **CC0 only**. Every third-party file used is CC0 1.0:

| Asset | Author | Licence | Verified from |
|---|---|---|---|
| Mini Characters 1.0 (Noor, Dez) | Kenney | CC0 1.0 | `_downloads/mini-characters/License.txt` |
| Furniture Kit (desks, monitors, racks/bookcases, cabinets, boxes, stairs, TVs; Warden + Sycophant parts) | Kenney | CC0 1.0 | `_downloads/furniture-kit/License.txt` |
| Kenney Future / Kenney Future Narrow fonts (all UI and every in-world texture) | Kenney (UI Pack) | CC0 1.0 | `_downloads/ui-pack/License.txt` |

Changes from v2: every texture was rebuilt with Kenney fonts (`make_tex_base.py`, `make_tex_h.py`), so v3 no longer uses Pixelify Sans (OFL) or DejaVu. The unused v2 scripts that still referenced them were moved to `tools/_v2_unused/`, and they are not part of the v3 pipeline.

Original work made here, with no third-party content:
- Fern, rebuilt as a figure made of floating UI windows. The geometry is primitives and the textures are generated.
- The bigger keycap Autocomplete swarm and the I-beam Caret with eyes.
- The Refusal Warden's arcs.
- The Floor 1 Archive layout.
- The 24-colour palette.
- All post-processing (`post_H.py`, `palette_h.py`, `sheet_h.py`).

No AI-generated images are used in v3.

## Art v4: neon-noir diorama, variant (a) (art-v4/), added 2026-10-28

Rule for v4: **CC0 only, zero spend, no AI images.** v4 adds no new third-party packs. It reuses the same three Kenney packs as v3, and their licence files were re-checked for v4:

| Asset | Author | Licence | Verified from |
|---|---|---|---|
| Mini Characters 1.0: `character-female-d` mesh, rig and colormap, plus the `idle`, `walk`, `holding-both` and `holding-both-shoot` actions (Noor base, Fern base) | Kenney | CC0 1.0 | `_downloads/mini-characters/License.txt` ("License: (Creative Commons Zero, CC0)") |
| Furniture Kit: v3 props plus the new set dressing `lampRoundFloor`, `radio`, `coatRackStanding`, `speaker`, `kitchenMicrowave` | Kenney | CC0 1.0 | `_downloads/furniture-kit/License.txt` |
| Kenney Future / Kenney Future Narrow fonts (rule tiles, badge, labels, Fern fragments, UI, sheets) | Kenney (UI Pack) | CC0 1.0 | `_downloads/ui-pack/License.txt` |

Original work made here, with no third-party content:
- Noor's v4 build (`art-v4/tools/noor.py`): the oversized cardigan shell and its generated knit texture, the messy bun and pencil, flyaways and locks, round glasses, the neck headset, the lanyard and SUPPORT badge, and the hair-strand shader.
- Fern's v4 hologram (`fern.py`): holo shader, ghost copy, scanline shells, text-fragment halo, spinner ring, and projector.
- The Hallucinator and Redactor builds, and the 3D rule tiles (`scene4.py`).
- All textures (`make_tex_v4.py`), the sprite rig, the attack FX and the prompt-shard projectile (`sprites.py`), the packing (`pack.py`), all post-processing (`post4.py`), and the cast sheet (`cast4.py`).

No AI-generated images are used in v4. FLUX was not used.

## Art v5: calm neon-noir diorama (art-v5/), added 2026-10-29

Rule for v5: **CC0 only, zero spend, no AI images.** v5 adds no new third-party packs. It reuses the same three Kenney packs as v3/v4 (licence files re-checked):

| Asset | Author | Licence | Verified from |
|---|---|---|---|
| Mini Characters 1.0: `character-female-d` mesh, rig and colormap, plus the `idle`, `walk`, `holding-both` and `holding-both-shoot` actions (Noor, Fern base) | Kenney | CC0 1.0 | `_downloads/mini-characters/License.txt` |
| Furniture Kit 2.0, used for the rooms and as enemy parts: `bench`, `bookcaseClosedWide`, `books`, `chair`, `chairDesk`, `computerScreen` (Warden head), `desk`, `kitchenBar`, `kitchenCabinetDrawer` (Warden/Redactor body), `kitchenCoffeeMachine`, `kitchenFridge`, `kitchenMicrowave`, `lampRoundFloor`, `lampSquareTable`, `loungeSofa`, `plantSmall1`, `plantSmall2`, `pottedPlant`, `rugRound`, `stairsOpen`, `tableCoffee`, `tableRound`, `televisionVintage` (Sycophant body) | Kenney | CC0 1.0 | `_downloads/furniture-kit/License.txt` |
| Kenney Future / Kenney Future Narrow fonts (rule tiles, keycaps, HUD, labels, sheets) | Kenney (UI Pack) | CC0 1.0 | `_downloads/ui-pack/License.txt` |

Original work made here, with no third-party content:
- Noor v5 head and face fix, hem fix and headset (`art-v5/tools/noor.py`), and the shared light-linked actor rig (`rig5.py`).
- The calm Fern (`fern.py`).
- The procedural enemy and Caret rigs and animations: Autocomplete, Sycophant, Refusal Warden, Redactor, Hallucinator and Caret (`enemies.py`, `anim_table.py`, `enemy_sprites.py`).
- The rooms, including the new break room and the custom window (`scene5.py`).
- All v5 textures (`make_tex_v5.py`: calm floor tiles, wood floor, TV static, fake EXIT door, draft letter, window sky).
- Packing, outline and GIFs (`pack5.py`), post-processing, HUD and overlap QA (`post5.py`), and the cast sheet and palette (`cast5.py`).
- The v3 textures reused from `tex/v3/` (faces, keycaps) were also generated here.

No AI-generated images are used in v5. FLUX was not used.

## Art v6: calm diorama, full art list (art-v6/), added 2026-10-29

Rule for v6: **zero spend, CC0 or clearly commercial-OK only, no AI images (no FLUX).** Reused packs (licence files re-checked): Kenney Mini Characters 1.0, Furniture Kit 2.0 and UI Pack fonts, all CC0 1.0 (see "Art v5" above for the exact files).

| New asset | Author | Licence | Verified from | Used for |
|---|---|---|---|---|
| Permanent Marker font (`PermanentMarker-Regular.ttf`) | Font Diner (Google Fonts) | Apache License 2.0 (commercial use OK) | `_downloads/fonts/LICENSE.txt` (downloaded from github.com/google/fonts `apache/permanentmarker`) | painted lettering on the sign plates, sticky notes, the REVIEWED stamp |

(`_downloads/fonts/Kalam-Bold.ttf`, SIL OFL 1.1, was downloaded for comparison but is **not used** in any output.)

Original work made here for v6 (no third-party content): the Noor v6 readability changes (`noor.py`), the calm attack FX (`sprites.py`), the painted-sign plate set, overlays and atlas (`make_tex_v6.py`), the R8 horseshoe room and room helpers (`scene6.py`, `rooms6.py`), the v6 post/HUD/QA (`post6.py`, `rooms_cfg.py`), packing (`pack5.py`, `pack_fx6.py`).
- v6 P2/P3: Dez = Kenney Mini Characters `character-male-a`, Kabir (dawn still) = `character-male-d` (CC0). All other P2/P3 props, moths, stars, laurel, icons, textures are original procedural geometry / PIL drawing in `art-v6/tools/`. No new third-party assets.
- v6 P3 icons: DejaVu Sans Mono (Bitstream Vera / DejaVu licence: free incl. commercial use, embedding allowed; system font `/usr/share/fonts/truetype/dejavu/`). Permanent Marker plates are deprecated (UI direction B).
<!-- V6-MORE -->

## UI fonts (ui-v1, added 29 Oct 2026)
All from https://github.com/google/fonts/tree/main/ofl/ under the **SIL Open Font License 1.1**. The licence texts are kept in `ui-v1/fonts/*-OFL.txt`.
| Font | Author / copyright | Licence |
|---|---|---|
| Manrope | The Manrope Project Authors (2018) | OFL-1.1 |
| Inter | The Inter Project Authors (2020) | OFL-1.1 |
| JetBrains Mono | The JetBrains Mono Project Authors (2020) | OFL-1.1 |
| IBM Plex Mono | IBM Corp. (2017), RFN "Plex" | OFL-1.1 |
| DM Serif Display | Adobe (2014-2018), Google LLC (2019), RFN "Source" | OFL-1.1 |
| DM Sans | The DM Sans Project Authors (2014) | OFL-1.1 |
| Space Grotesk | The Space Grotesk Project Authors (2020) | OFL-1.1 |
| Space Mono | The Space Mono Project Authors (2016) | OFL-1.1 |

## UI v2 (final, direction B "Terminal Poetry", 29 Oct 2026)
Ships only **JetBrains Mono** (OFL-1.1, The JetBrains Mono Project Authors) and **IBM Plex Mono** (OFL-1.1, IBM Corp., RFN "Plex"), from https://github.com/google/fonts/tree/main/ofl/. The licences are in `ui-v2/kit/fonts/*-OFL.txt`. The icons in `ui-v2/kit/icons/` are original and generated by script. The ui-v1 fonts for directions A, C and D are not shipped.

## Session 4 (2 Nov 2026): hybrid word UI + art-v7b
No new third-party assets. Everything added is original work made here:
- `game/src/words.ts` caption bar, word chips, code vision, lens; code-vision plates generated from our own renders (`art-v7/tools/post7.py codeview()`).
- art-v7b props in `art-v7/tools/rooms7.py` (office storytelling props, cables, nook, printer; hub mirror pane, reversed clock, ghost desks, door panel; archive hinged bridge with chains) are procedural Blender geometry. New procedural textures `art-v7/tex/whiteboard.png`, `rain_light.png`, `clock_mirror.png`, `mon_mirror.png` (PIL, no text, no third-party images). Office and hub furniture reuse the already-credited Kenney Furniture Kit / Mini Characters (CC0).
- Noor dash hair secondary motion (`art-v7/tools/noor7.py`), jab/slash/hit FX (code-drawn in `game/src/game.ts`).
- `game/public/assets/sprites/fern_seated.png` is the existing Fern sheet with the baked speech text and ring masked out (same masking as the mock-words `fern_clean.png`).

## Session 5 (2 Nov 2026): art-v8 linger layer + weak-spot pass
No new third-party asset packs. Added in this session:
- `art/tex/` (made by `art/tools/make_tex_v8.py`, PIL, original): calendar_aug, phone_37, sticky_call, sticky_gm, lostline, memo, saver_00..11, chatglow_00..07, clock_blank. Their lettering uses the already-shipped OFL-1.1 fonts JetBrains Mono / IBM Plex Mono (`game/public/assets/fonts`).
- New props in `art/tools/rooms8.py` are procedural Blender geometry (phone, bucket, umbrella, tape, pipe, duck, radio, wellies, moth, drips, flakes, rim) plus Kenney Furniture Kit `chair` and `coatRackStanding` (CC0, Kenney.nl, already credited above).
- Ambient loops in `game/public/assets/rooms/amb/` and the wireframe Noor sheets `game/public/assets/sprites/noor_*_wire.*` (`art/tools/wire8.py`, edge pass over our own Noor renders) are our own Blender renders. No AI-generated imagery.

## art-v9 (office)
- Office render, close-ups, Noor reaction sheets: original Blender (Cycles) renders, `art/tools/office9.py`, `noor9.py`.
- Textures: generated procedurally with PIL (`make_tex_v9.py`); code text set in JetBrains Mono (OFL).
- Props: Kenney furniture kits (CC0), reused.
