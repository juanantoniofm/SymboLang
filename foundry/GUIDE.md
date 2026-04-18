# SymbolLang — Visual Identity Guide

A working alphabet for systems thinking. 13 primitives, 2 axes, one font file. Type a letter, get a symbol; move the sliders, change its state.

---

## 1. The alphabet

Each letter maps to one primitive. Choose them by what they *mean*, not how they look.

| Key | Glyph | Semantic role |
|-----|--------|----------------|
| **N S E W** | directional triangles | flow, direction, vector |
| **H** | hex node | entity, service, hub |
| **D** | dot stream | discrete events, messages, time |
| **C** | chevron | throughput, forward progress |
| **A** | arc / bridge | connection, span, link |
| **Q** | quad | container, region, scope |
| **G** | grid | lattice, cluster, field |
| **M** | metrics | measurements, load, histogram |
| **R** | relay | handoff, converging paths |
| **B** | bowtie | gate, valve, transition point |

Read them as nouns. Stack them to form sentences.

---

## 2. The two axes

Both run 100 → 900. Named instances at 100/300/500/700/900 along Phase.

### Phase (wght)
*"How loud?"*  State intensity. Low = dormant/idle/empty. High = active/saturated/full.
- Triangles spike.
- Hex rings thicken.
- Dots pack tighter.
- Bars grow.
- Chevron thickens.
- Quad skews.
- Relay tips converge.
- Bowtie opens vertically.

### Form (MORF)
*"What shape is the story?"*  Structural mode. Low = diffuse, plural, granular. High = unified, singular, crisp.
- Hex: vortex of 4 rings → single solid hex.
- Chevron: flat → sharp.
- Arc: uniform → bulged.
- Quad: sharp corners → rounded.
- Grid: sparse → dense.
- Metrics bars: aligned bottoms → audio-wave bottoms.
- Relay: blunt → sharp arrowheads.
- Bowtie: closed apex → open valve.

(Triangles and dots don't react to Form — some primitives are one-axis on purpose.)

### Mental model
Phase = **energy**. Form = **focus**. A "dormant distributed system" = low Phase, low Form. An "alert, unified state" = high Phase, high Form.

---

## 3. Composition patterns

### Pattern A — Triplet logomark
Three glyphs, one identity. Pick a *source → channel → sink*.

- `H C H` — node → throughput → node ("service mesh")
- `D A H` — stream → bridge → hub ("ingest pipeline")
- `G R Q` — cluster → handoff → container ("orchestrator")
- `N D S` — input flow → stream → output flow ("ETL")

Set all three to the same Phase/Form to feel cohesive. Vary one to emphasize a role (e.g. middle glyph at higher Phase = "the hot path").

### Pattern B — State triptych
Same glyph, three snapshots. Show dormant → active → saturated by stepping Phase.

`H` at Phase=100, 500, 900 — same hex, three moods. Works for status lights, dashboards, loading states.

### Pattern C — Cross-axis grid
A 3×3 matrix of the same glyph across both axes. Instant design-space poster; reads as a "periodic table" of one idea.

### Pattern D — Pairs of opposites
Mirror the alphabet: **E W** (east/west), **N S** (up/down), **R B** (converge/gate). Useful for duality branding — before/after, in/out, on/off.

### Pattern E — Word as logo
Spell a real word. It renders as a glyph sequence. `SEND`, `HASH`, `MESH`, `GRID`, `CASE`, `WEB`. The meaning collides with the form.

---

## 4. Showcase ideas

### a. Brand mark
Pick one glyph. Set a signature `(Phase, Form)`. That's the mark. Animate it subtly (Phase wobble, Form breath) for digital touchpoints; freeze it at the signature for print.

### b. System status board
One row per service. Glyph = service type (H for API, G for cluster, Q for workload). Phase = current load. Form = mode (steady vs event-driven). Reads like a weather map for infrastructure.

### c. Poster / cover
One glyph at 800–1000pt at an extreme corner: `H` at (900, 900) = big solid hex. `M` at (900, 900) = audio-wave skyline. Minimal, bold, instantly iconic.

### d. Deck slide headers
Section dividers: `C` at (500, 100) → low, flat = "intro"; `C` at (900, 900) → sharp, thick = "conclusion". Same letter, different energy.

### e. Motion / loading
Loop Phase 100↔900 at 2s period on `D` → pulsing dots. Loop Form on `H` → vortex blooming and collapsing. Cheap, recognizable loader.

### f. Identity system
Lock a palette: pick 4 glyphs (e.g. `H D A M`) as your allowed marks, and pick a Form value (e.g. 700) as your "house style". Everything you ship draws from that tiny vocabulary. Consistency by constraint.

### g. Wordmark hybrid
Set a wordmark in a normal typeface; prefix or suffix with one SymbolLang glyph at matched size. `◆ACME` / `ACME◆`. The glyph is the logo core; the word is the name.

---

## 5. Practical tips

- **Same axis values across glyphs** = unified feel. Different values = hierarchy.
- **Don't mix extremes randomly** — pick a coordinate in design space and commit to it.
- **Lowercase ASCII `nsewhdcaqgmrb` also maps** (same glyphs) — use either case.
- **Scale freely** — pure vector, no hinting dependency.
- **Color is separate** — the font is monochrome. Apply `color:` and `background:` in CSS or your design tool.

---

## 6. Using it

Any tool that supports variable fonts. CSS:

```css
@font-face {
  font-family: 'SymbolLang';
  src: url('fonts/SymbolLang.ttf') format('truetype-variations');
}
.mark {
  font-family: 'SymbolLang';
  font-size: 240px;
  font-variation-settings: 'wght' 700, 'MORF' 500;
}
```

Figma, Illustrator, InDesign: open as variable, sliders appear under the font. Axis labels read as "Phase" and "Form" in friendly UIs, `wght` and `MORF` in technical ones.
