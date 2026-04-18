# SymbolLang — Spec

## Project

SymbolLang is a parametric, two-axis variable TTF font that encodes a small visual language of 13 symbolic primitives (directional triangles N/S/E/W, hex node H, dots stream D, chevron C, arc A, quad container Q, grid G, metrics/stack M, relay R, bowtie B) as glyphs mapped to ASCII letters. Each primitive is a single parametric routine driven by two axes — `wght` (exposed as "Phase", 100–900) and `MORF` (exposed as "Form", 100–900) — interpolated across 9 masters on a 3×3 grid. Compilation uses fontTools `FontBuilder` + `varLib.build` from a `DesignSpaceDocument`. Output: one `.ttf` that renders any `(Phase, Form)` location at runtime in any variable-font-aware host.

## Versions

| Version | File | Notes |
|---------|------|-------|
| v4 | `SymbolLang_v4.ttf` | Legacy static font, single weight, no variable axes |
| v5 | `SymbolLang_v5.ttf` | Initial variable font release, dual-axis (wght + MORF) |
| v5.2 | `SymbolLang_v5.2.ttf` | Stable 12-primitive variable font |
| **v5.3** | `SymbolLang_v5.3.ttf` | **Latest.** 13 primitives. Bowtie (B) glyph added. Full wght + MORF axes |

### v5 deltas vs v4
- Hex MORF: nested 4-ring vortex at Form=100 → rings coincide into single hex at Form=900 (same 8-contour topology across all masters; non-zero winding composites overlapping rings into one band).
- Metrics MORF: per-bar `bottoms` list offsets each bar's baseline → "audio-wave" feel at Form=900, aligned at Form=100.
- Quad Phase: now drives horizontal skew (−22°…+22°) instead of rotation; corner radius (0…130) stays on MORF.
- Added **relay (R)** — two converging triangles, Phase=gap, Form=tip sharpness.
- Added **bowtie (B)** — two mirror triangles, Phase=height, Form=valve gap.

## Foundry

- **Build script**: `foundry/build_symbolang.py`. Standalone, portable, CLI-driven.
  - `python build_symbolang.py` → `./SymbolLang.ttf`
  - `python build_symbolang.py -o path/Font.ttf --keep-masters`
  - Intermediate masters go to a tempdir by default (auto-cleaned) or to `--masters-dir` (kept).
- **Guide**: `foundry/GUIDE.md` — visual identity guide, composition patterns, usage tips.

## Composition recipes

Six tested multi-glyph compositions. Each combines 2–3 primitives at specific axis coordinates.

| Name | Formula | Description |
|------|---------|-------------|
| **Span** | A · H · H | Arc (wght 700, MORF 600) bridging above two solid hexes (wght 800, MORF 900). Bridge metaphor. |
| **Stream** | D · H | Dot stream (wght 700, MORF 500) flowing through an outlined hex (wght 100, MORF 900) with a single accent dot centered inside. |
| **Ingress** | E · H | Filled triangle (wght 500, MORF 500) pointing at an outlined hex (wght 200, MORF 900). Cleanest composition, scales to 16px. |
| **Intercept** | R · D | Relay (wght 500, MORF 700) with accent dot at the pinch point. Assertive, security-forward. |
| **Observe** | Q · G | Quad frame (wght 500, MORF 800) containing a sparse grid (MORF 300). No accent — monochrome. |
| **Accelerate** | C · C | Small thin chevron (wght 300, MORF 500) → large thick chevron (wght 800, MORF 800). Speed metaphor. |

**Lockup**: Span mark scaled down above a monospace wordmark.

## Pending work / known issues

1. **Hex stroke floor at low MORF.** When Form=100 the innermost ring has radius 70; stroke is forced down to 15 at that corner to keep `r − stroke > 0` on the innermost ring. If stroke were interpolated naively from the (hi,hi)=130 master the inner ring would invert. Current table hand-holds this — works, but is brittle if new masters are added.
2. **Quad topology uses coincident points at radius=0.** 13 points per contour always; at `radius=0` the off-curve control and adjacent on-curve land on the same coordinate. Renders fine in every tested engine, but is theoretically fragile on hinters that dedup identical points.
3. **Stack `bottoms` arrays are hand-authored.** `STACK_BOTTOMS["hi"] = [30, 200, 60, 180, 110]` is just an aesthetic choice for the audio-wave pattern. If you want deterministic/seeded pseudo-randomness or user-controllable waveforms, that's a new feature — not done.
4. **No STAT table.** Named instances exist via `fvar`, but there's no explicit STAT axis-value table. Most hosts fall back gracefully; some (older Office, some PDF viewers) may show less helpful axis labels.
5. **No kerning, no GPOS, no hinting.** Glyphs share a fixed 1000-unit advance. Fine for symbolic use; not a text font. Kerning could help composition alignment (e.g. lattice G needs ~-29% kern to sit tight next to other glyphs).
6. **`instantiateVariableFont` deprecation warning** in the render check script — cosmetic, use `fontTools.varLib.instancer.instantiateVariableFont` when rebuilding preview.
