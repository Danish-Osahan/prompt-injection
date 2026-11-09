# v13-ingame review notes (post-fix)

## Fixed for Danishpreet
1. **Chain scale** — span 78px (~40% of 196px door), link scale 0.72, padlock 0.85 (handle-sized).
2. **Scatter** — constraints removed; kinematic impulse + floor bounce (1–2) + shadows; padlock pops open and drops. Asserted in `tests/impact_lab.mjs` (`assertOnFloor`: every link y at floor, none at handle anchor). Debris clamped to door-front band so pieces stay on-screen.
3. **No words** — objective banner, captions, and plate tags hidden while Impact Lab is on. Debug hint only with `?debug`.
4. **Framing** — camera recentred to full-width cover (718b468); no off-centre pan for the lab.
5. **Flash** — short low-alpha flash + mild sil frames; contact still mean ~56–63 (readable).
6. **Hit spark** — hard-edged comic star with dark outline (NORMAL blend).

## Still weak
- Silhouette frames are overlays, not true RT silhouettes of Noor+door.
- Floor plane is a y-clamp + ellipse shadows (no desk collision).
- Throw not frame-synced to art-v12 `noor_throw`.
- `beat.mp4` is silent (screenshot sequence).
