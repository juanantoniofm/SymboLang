# SymbolLang — Spec

## Project

Variable TTF font. 13 symbolic primitives mapped to ASCII letters. Two axes: `wght`/"Phase" (100–900) and `MORF`/"Form" (100–900). 9 masters on 3×3 grid. Built with fontTools `FontBuilder` + `varLib.build`.

## Version History

| Version | Notes |
|---------|-------|
| v4 | Static, single weight |
| v5 | Variable font, dual-axis |
| v5.2 | Stable 12 primitives |
| v5.3 | +Bowtie (B), 13 primitives |
| **v6** | **Current.** Registry refactor, STAT table, GPOS kerning |

## Build

Script: `foundry/build_symbolang.py`

```
python build_symbolang.py                          # -> ./SymbolLang.ttf
python build_symbolang.py -o path/Font.ttf         # custom output
python build_symbolang.py --keep-masters           # keep 9 master TTFs
make fondue                                        # standard build target
```

### Architecture

Glyph registration uses `@glyph()` decorator → `SYMBOL_REGISTRY` list of `GlyphDef` dataclasses. Single touch point per glyph: draw function + parameter grid + metadata (`char`, `name`, `hint`, `advance`, `kern_class`).

## Axes

| Tag | Label | Range | Default |
|-----|-------|-------|---------|
| wght | Phase | 100–900 | 500 |
| MORF | Form | 100–900 | 500 |

### STAT Named Stops

**Phase (wght):** Min(100), Low(300), Mid(500), High(700), Max(900)

**Form (MORF):** Diffuse(100), Scattered(200), Open(300), Relaxed(400), Balanced(500), Gathered(600), Focused(700), Tight(800), Unified(900)

## Glyphs (13)

| Char | Name | Phase controls | Form controls | Kern class |
|------|------|---------------|---------------|------------|
| N/S/E/W | tri_n/s/e/w | squat→spike | — | narrow |
| H | hex | stroke width | vortex→single | wide |
| D | dots | loose→tight | — | narrow |
| C | chevron | thin→thick | flat→sharp | medium |
| A | arc | pipe→bridge | uniform→bulged | medium |
| Q | quad | skew L→R | sharp→rounded | wide |
| G | grid | — | sparse→dense | narrow |
| M | stack | flat→tall | aligned→wavy | wide |
| R | relay | wide gap→converged | blunt→sharp | medium |
| B | bowtie | pinched→open | closed→valve gap | medium |

## GPOS Kerning

Static class-based kerning. Three width classes:

| Left \ Right | Narrow | Medium | Wide |
|-------------|--------|--------|------|
| Narrow | -180 | -140 | -100 |
| Medium | -100 | -60 | 0 |
| Wide | -60 | 0 | 0 |

## Compositions

| Name | Formula | Axis coords |
|------|---------|-------------|
| Span | A·H·H | Arc(700,600) + Hex(800,900) |
| Stream | D·H | Dots(700,500) + Hex(100,900) |
| Ingress | E·H | Tri(500,500) + Hex(200,900) |
| Intercept | R·D | Relay(500,700) + accent dot |
| Observe | Q·G | Quad(500,800) + Grid(300) |
| Accelerate | C·C | Chevron(300,500)→(800,800) |

## Known Issues

1. **Hex stroke floor at low MORF** — innermost ring stroke clamped to 15 to prevent inversion. Brittle if new masters added.
2. **Quad coincident points at radius=0** — renders fine but theoretically fragile for hinters.
3. **Stack bottoms hand-authored** — aesthetic choice, not algorithmic.
4. **Standard sliders** — MORF is custom axis; consider mapping to standard OT axes (wdth, opsz) for broader app support.
