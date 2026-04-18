# SymbolLang — Spec

## Project

SymbolLang is a parametric, two-axis variable TTF font that encodes a small visual language of 13 symbolic primitives (directional triangles N/S/E/W, hex node H, dots stream D, chevron C, arc A, quad container Q, grid G, metrics/stack M, relay R, bowtie B) as glyphs mapped to ASCII letters. Each primitive is a single parametric routine driven by two axes — `wght` (exposed as "Phase", 100–900) and `MORF` (exposed as "Form", 100–900) — interpolated across 9 masters on a 3×3 grid. Compilation uses fontTools `FontBuilder` + `varLib.build` from a `DesignSpaceDocument`. Output: one `.ttf` that renders any `(Phase, Form)` location at runtime in any variable-font-aware host.

## Current state (v5)

- **Font built & verified**: `SymbolLang.ttf`, 13 glyphs, 9 masters, 2 axes, 5 named instances (Min/Low/Mid/High/Max along Phase at Form=500). Visual sweep across 9 corners of design space confirms all glyphs interpolate cleanly.
- **Foundry script**: `build_symbolang.py`. Standalone, portable, CLI-driven. Intermediate masters go to a tempdir by default (auto-cleaned) or to `--masters-dir` (kept). No hardcoded absolute paths.
  - `python build_symbolang.py` → `./SymbolLang.ttf`
  - `python build_symbolang.py -o path/Font.ttf --keep-masters`
- **v5 deltas vs v4**:
  - Hex MORF: nested 4-ring vortex at Form=100 → rings coincide into single hex at Form=900 (same 8-contour topology across all masters; non-zero winding composites overlapping rings into one band).
  - Metrics MORF: per-bar `bottoms` list offsets each bar's baseline → "audio-wave" feel at Form=900, aligned at Form=100.
  - Quad Phase: now drives horizontal skew (−22°…+22°) instead of rotation; corner radius (0…130) stays on MORF.
  - Added **relay (R)** — two converging triangles, Phase=gap, Form=tip sharpness.
  - Added **bowtie (B)** — two mirror triangles, Phase=height, Form=valve gap.

## Composition Ideas

- **Span A · H · H**
  - two nodes (hex at low thickness, small radius) connected by a bridge arc (curvature high, weight moderate). This is the most literal reading of the product: a structure that spans from the client to the database. The teal lives in the arc — which is the proxy itself, the thing doing the work. The navy hexes are the static endpoints. Of the six, this is the one that survives translation to a one-sentence explanation: "we're the bridge between your app and your database."
- **Stream D · H**
  - node (thin outline) with stream (high density, horizontal flow) passing through. The only composition where the hex is outlined rather than filled, which reads as "the gateway is transparent — you see the traffic flowing through it." The single teal dot in the center is the moment of intelligence: caching, auth, observation. This is your observability/intercept story in one mark.
- **Ingress E · H**
  - directional (pointing right, equilateral) and node (medium thickness). Cleanest of the six, and the one that would shrink to 16px with the least loss. Flips the color convention: teal on the input side, navy on the gateway. Reads as "something enters here, something intelligent happens."
- **Intercept R · D**
  - relay (medium gap, sharp arrows) with a single stream-point in the pinch. Different energy from Span — this one says "nothing passes through untouched." More assertive, slightly more menacing, depending on how you feel about that. Good for security/governance framings, slightly less good for developer-tooling framings.
- **Observe Q · G**
  - container (frame, no tilt) holding a lattice (sparse). The only composition that leans into the observability angle rather than the middleman angle. The teal center point is a selected query. This one reads more as a dashboard/monitoring product than a proxy, which may or may not be where you want to aim.
- **Accelerate C · C**
  - throughput at two weights, thin-to-thick. Pure speed metaphor, no middleman reading. This is the composition that feels most like HAProxy/Nginx visually — aggressive, directional, performance-forward. Least unique of the six (chevrons are common in the devtool space) but the tonal match is strong.
The lockup at the bottom shows Span with the wordmark in monospace. The arc rides above the x-height of the word nicely, and at that size the two hex endpoints align with the cap-height of "D" and "y" — the mark feels anchored to the type rather than floating above it.
## Pending work / known issues

2. **Hex stroke floor at low MORF.** When Form=100 the innermost ring has radius 70; stroke is forced down to 15 at that corner to keep `r − stroke > 0` on the innermost ring. If stroke were interpolated naively from the (hi,hi)=130 master the inner ring would invert. Current table hand-holds this — works, but is brittle if new masters are added.
3. **Quad topology uses coincident points at radius=0.** 13 points per contour always; at `radius=0` the off-curve control and adjacent on-curve land on the same coordinate. Renders fine in every tested engine, but is theoretically fragile on hinters that dedup identical points.
4. **Stack `bottoms` arrays are hand-authored.** `STACK_BOTTOMS["hi"] = [30, 200, 60, 180, 110]` is just an aesthetic choice for the audio-wave pattern. If you want deterministic/seeded pseudo-randomness or user-controllable waveforms, that's a new feature — not done.
5. **No STAT table.** Named instances exist via `fvar`, but there's no explicit STAT axis-value table. Most hosts fall back gracefully; some (older Office, some PDF viewers) may show less helpful axis labels.
6. **No kerning, no GPOS, no hinting.** Glyphs share a fixed 1000-unit advance. Fine for symbolic use; not a text font. we could align kerning to ensure easier composition (i.e. curretly a lattice is very far from the next unles -29% kerning is applied)
7. **`instantiateVariableFont` deprecation warning** in the render check script — cosmetic, use `fontTools.varLib.instancer.instantiateVariableFont` when rebuilding preview.
