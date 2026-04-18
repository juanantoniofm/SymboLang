#!/usr/bin/env python3
"""
SymbolLang v5 — 2-axis parametric symbol language, 13 primitives.

Builds a variable TTF with 9 masters on a 3x3 grid over:
  wght (tag `wght`, axis label "Phase")  100..900 default 500
  MORF (tag `MORF`, axis label "Form")   100..900 default 500

Glyphs (13)
  N S E W   triangles (directional)     wght: squat -> equilateral -> spike
  H         hex (node)                  wght: stroke thickness
                                        MORF: nested-ring vortex -> single hex
  D         dots (stream)               wght: loose -> tight packed
  C         chevron (throughput)        wght: thin -> thick
                                        MORF: flat -> sharp forwardness
  A         arc (bridge)                wght: flat pipe -> full bridge rise
                                        MORF: uniform thickness -> bulged middle
  Q         quad (container)            wght: skew left -> upright -> skew right
                                        MORF: sharp corners -> rounded corners
  G         grid (lattice)              MORF: sparse -> dense dots
  M         metrics/stack (bars)        wght: flat -> tall (histogram)
                                        MORF: aligned bottoms -> audio-wave bottoms
  R         relay (converging)          wght: wide gap -> converged tips
                                        MORF: blunt -> sharp arrow heads
  B         bowtie (valve)              wght: pinched -> open height
                                        MORF: closed apex -> valve gap

Usage:
  python build_symbolang.py                  # -> ./SymbolLang.ttf
  python build_symbolang.py -o out/Font.ttf  # custom output
  python build_symbolang.py --keep-masters   # don't delete the 9 master TTFs
"""

import argparse
import math
import os
import shutil
import sys
import tempfile
from dataclasses import dataclass, field
from typing import Callable

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.designspaceLib import (
    DesignSpaceDocument, AxisDescriptor, SourceDescriptor, InstanceDescriptor,
)
from fontTools.varLib import build as varLib_build
from fontTools.ttLib import TTFont

UPEM, ASCENT, DESCENT = 1000, 800, -200
CX, CY, ADVANCE = 500, 350, 1000
FAMILY = "SymbolLang"


# =====================================================================
# Glyph registry
# =====================================================================

@dataclass
class GlyphDef:
    char: str
    name: str
    draw: Callable
    params: dict[tuple[str, str], dict]
    hint: str = ""
    advance: int = 1000
    kern_class: str = "wide"

REGISTRY: list[GlyphDef] = []

def glyph(char: str, name: str, hint: str = "", kern_class: str = "wide"):
    """Decorator that registers a glyph draw function into REGISTRY."""
    def decorator(fn):
        # params must be attached as fn.grid before this runs,
        # or set after decoration via draw_fn.grid = ...
        # We defer reading fn.grid until module load completes.
        REGISTRY.append(GlyphDef(
            char=char, name=name, draw=fn, params={},
            hint=hint, kern_class=kern_class,
        ))
        return fn
    return decorator


# =====================================================================
# Primitives
# =====================================================================

POSITIONS = ("lo", "mid", "hi")

def no_morf(wght_params):
    return {(w, m): wght_params[w] for w in POSITIONS for m in POSITIONS}

# --- Triangles (N, S, E, W) — wght only, no MORF variation ---

TRI_WGHT = {
    "lo":  dict(base_half=350, apex_h=180),
    "mid": dict(base_half=235, apex_h=405),
    "hi":  dict(base_half=110, apex_h=700),
}

@glyph("N", "tri_n", hint="squat -> equilateral -> spike", kern_class="narrow")
def draw_tri_n(pen, base_half, apex_h):
    by, ay = CY - apex_h / 2, CY + apex_h / 2
    pen.moveTo((CX - base_half, by))
    pen.lineTo((CX + base_half, by))
    pen.lineTo((CX, ay))
    pen.closePath()

@glyph("S", "tri_s", hint="squat -> equilateral -> spike", kern_class="narrow")
def draw_tri_s(pen, base_half, apex_h):
    ty, ay = CY + apex_h / 2, CY - apex_h / 2
    pen.moveTo((CX + base_half, ty))
    pen.lineTo((CX - base_half, ty))
    pen.lineTo((CX, ay))
    pen.closePath()

@glyph("E", "tri_e", hint="squat -> equilateral -> spike", kern_class="narrow")
def draw_tri_e(pen, base_half, apex_h):
    lx, rx = CX - apex_h / 2, CX + apex_h / 2
    pen.moveTo((lx, CY + base_half))
    pen.lineTo((lx, CY - base_half))
    pen.lineTo((rx, CY))
    pen.closePath()

@glyph("W", "tri_w", hint="squat -> equilateral -> spike", kern_class="narrow")
def draw_tri_w(pen, base_half, apex_h):
    lx, rx = CX - apex_h / 2, CX + apex_h / 2
    pen.moveTo((rx, CY - base_half))
    pen.lineTo((rx, CY + base_half))
    pen.lineTo((lx, CY))
    pen.closePath()

# Attach parameter grids for triangles
draw_tri_n.grid = no_morf(TRI_WGHT)
draw_tri_s.grid = no_morf(TRI_WGHT)
draw_tri_e.grid = no_morf(TRI_WGHT)
draw_tri_w.grid = no_morf(TRI_WGHT)

# --- Hex (H) — wght: stroke, MORF: vortex -> single ---

def _hex_pts(cx, cy, r):
    off = -math.pi / 2
    return [(cx + r*math.cos(off + math.pi/3*i),
             cy + r*math.sin(off + math.pi/3*i)) for i in range(6)]

N_RINGS = 4
HEX_RADII = {
    "lo":  [280, 210, 140,  70],
    "mid": [280, 245, 210, 175],
    "hi":  [280, 280, 280, 280],
}
HEX_STROKE = {
    ("lo",  "lo"):  15, ("lo",  "mid"): 18, ("lo",  "hi"):  22,
    ("mid", "lo"):  15, ("mid", "mid"): 38, ("mid", "hi"):  60,
    ("hi",  "lo"):  15, ("hi",  "mid"): 70, ("hi",  "hi"): 130,
}

@glyph("H", "hex", hint="wght: stroke | MORF: vortex -> single", kern_class="wide")
def draw_hex_nested(pen, radii, stroke):
    """N_RINGS concentric hex rings. At max MORF they coincide and render
    as one hex band via non-zero winding; at min MORF they fan to a vortex.
    Topology: 8 contours x 6 points = 48 points."""
    assert len(radii) == N_RINGS
    for r in radii:
        pts = _hex_pts(CX, CY, r)[::-1]   # CW outer
        pen.moveTo(pts[0])
        for p in pts[1:]: pen.lineTo(p)
        pen.closePath()
    for r in radii:
        r_in = max(r - stroke, 2)
        pts = _hex_pts(CX, CY, r_in)      # CCW inner (hole)
        pen.moveTo(pts[0])
        for p in pts[1:]: pen.lineTo(p)
        pen.closePath()

draw_hex_nested.grid = {(w, m): dict(radii=HEX_RADII[m], stroke=HEX_STROKE[(w, m)])
                        for w in POSITIONS for m in POSITIONS}

# --- Dots (D) — wght only ---

N_DOTS, DOT_SIDES = 7, 10
DOTS_WGHT = {
    "lo":  dict(spacing=145, r_dot=22),
    "mid": dict(spacing=95,  r_dot=38),
    "hi":  dict(spacing=55,  r_dot=55),
}

@glyph("D", "dots", hint="discrete -> stream", kern_class="narrow")
def draw_dots(pen, spacing, r_dot):
    start_x = CX - spacing * (N_DOTS - 1) / 2
    for i in range(N_DOTS):
        cx, cy = start_x + i * spacing, CY
        pen.moveTo((cx + r_dot, cy))
        for j in range(1, DOT_SIDES):
            a = 2 * math.pi * j / DOT_SIDES
            pen.lineTo((cx + r_dot*math.cos(a), cy + r_dot*math.sin(a)))
        pen.closePath()

draw_dots.grid = no_morf(DOTS_WGHT)

# --- Chevron (C) — wght: thickness, MORF: height ---

CHEVRON_T = {"lo": 20, "mid": 60, "hi": 130}
CHEVRON_H = {"lo": 130, "mid": 225, "hi": 320}

@glyph("C", "chevron", hint="wght: thin -> thick | MORF: flat -> sharp", kern_class="medium")
def draw_chevron(pen, L, H, T):
    cx, cy = CX, CY
    ln = math.sqrt(H*H + 4*L*L)
    dy = T * ln / (2 * L)
    dx = T * ln / H
    pen.moveTo((cx - L,      cy + H))
    pen.lineTo((cx + L,      cy))
    pen.lineTo((cx - L,      cy - H))
    pen.lineTo((cx - L,      cy - H + dy))
    pen.lineTo((cx + L - dx, cy))
    pen.lineTo((cx - L,      cy + H - dy))
    pen.closePath()

draw_chevron.grid = {(w, m): dict(L=260, H=CHEVRON_H[m], T=CHEVRON_T[w])
                     for w in POSITIONS for m in POSITIONS}

# --- Arc (A) — wght: rise, MORF: bulge ---

ARC_RISE  = {"lo": 0,   "mid": 120, "hi": 280}
ARC_BULGE = {"lo": 0,   "mid": 90,  "hi": 180}

@glyph("A", "arc", hint="wght: pipe -> bridge | MORF: uniform -> bulged", kern_class="medium")
def draw_arc(pen, rise, bulge, thickness, span_half):
    y_top = CY + thickness / 2
    y_bot = CY - thickness / 2
    lx, rx, mx = CX - span_half, CX + span_half, CX
    outer_offset = rise + bulge / 2
    inner_offset = rise - bulge / 2
    c_top = (mx, y_top + 2 * outer_offset)
    c_bot = (mx, y_bot + 2 * inner_offset)
    pen.moveTo((lx, y_bot))
    pen.qCurveTo(c_bot, (rx, y_bot))
    pen.lineTo((rx, y_top))
    pen.qCurveTo(c_top, (lx, y_top))
    pen.closePath()

draw_arc.grid = {(w, m): dict(rise=ARC_RISE[w], bulge=ARC_BULGE[m],
                               thickness=50, span_half=340)
                 for w in POSITIONS for m in POSITIONS}

# --- Quad (Q) — wght: skew, MORF: corner radius ---

QUAD_SKEW   = {"lo": -22, "mid": 0,  "hi": 22}
QUAD_RADIUS = {"lo":   0, "mid": 45, "hi": 130}

@glyph("Q", "quad", hint="wght: skew | MORF: corner radius", kern_class="wide")
def draw_quad_skew(pen, skew_deg, radius, w, h):
    """Rectangle with horizontal skew and rounded corners.
    Topology: 9 on-curve + 4 off-curve = 13 points. At radius=0 multiple
    points collapse onto each corner."""
    xl, xr = CX - w/2, CX + w/2
    yb, yt = CY - h/2, CY + h/2
    r = radius
    tan_s = math.tan(math.radians(skew_deg))
    def sk(x, y):
        return (x + (y - CY) * tan_s, y)

    pen.moveTo(sk(xl + r, yt))
    pen.lineTo(sk(xr - r, yt))
    pen.qCurveTo(sk(xr, yt), sk(xr, yt - r))
    pen.lineTo(sk(xr, yb + r))
    pen.qCurveTo(sk(xr, yb), sk(xr - r, yb))
    pen.lineTo(sk(xl + r, yb))
    pen.qCurveTo(sk(xl, yb), sk(xl, yb + r))
    pen.lineTo(sk(xl, yt - r))
    pen.qCurveTo(sk(xl, yt), sk(xl + r, yt))
    pen.closePath()

draw_quad_skew.grid = {(w, m): dict(skew_deg=QUAD_SKEW[w], radius=QUAD_RADIUS[m],
                                     w=520, h=340)
                       for w in POSITIONS for m in POSITIONS}

# --- Grid (G) — MORF only: dot size ---

GRID_N, GRID_SIDES, GRID_SPACING = 4, 8, 175
GRID_R = {"lo": 18, "mid": 50, "hi": 85}

@glyph("G", "grid", hint="MORF: sparse -> dense", kern_class="narrow")
def draw_grid(pen, r_dot):
    half = (GRID_N - 1) * GRID_SPACING / 2
    for i in range(GRID_N):
        for j in range(GRID_N):
            cx = CX - half + i * GRID_SPACING
            cy = CY - half + j * GRID_SPACING
            pen.moveTo((cx + r_dot, cy))
            for k in range(1, GRID_SIDES):
                a = 2 * math.pi * k / GRID_SIDES
                pen.lineTo((cx + r_dot*math.cos(a), cy + r_dot*math.sin(a)))
            pen.closePath()

draw_grid.grid = {(w, m): dict(r_dot=GRID_R[m]) for w in POSITIONS for m in POSITIONS}

# --- Stack/Metrics (M) — wght: heights, MORF: wavy bottoms ---

STACK_N, STACK_W, STACK_GAP = 5, 75, 30
STACK_HEIGHTS = {
    "lo":  [ 60,  60,  60,  60,  60],
    "mid": [180, 160, 220, 170, 200],
    "hi":  [350, 480, 280, 520, 320],
}
STACK_BOTTOMS = {
    "lo":  [  0,   0,   0,   0,   0],
    "mid": [ 15, 100,  25,  90,  55],
    "hi":  [ 30, 200,  60, 180, 110],
}

@glyph("M", "stack", hint="wght: heights | MORF: wavy bottoms", kern_class="wide")
def draw_stack(pen, heights, bottoms):
    """heights: wght-driven per-bar length. bottoms: MORF-driven per-bar
    vertical offset above baseline (audio-wave feel at max MORF)."""
    total_w = STACK_N * STACK_W + (STACK_N - 1) * STACK_GAP
    start_x = CX - total_w / 2
    base_y = CY - 280
    for i, (h, b) in enumerate(zip(heights, bottoms)):
        lx = start_x + i * (STACK_W + STACK_GAP)
        rx = lx + STACK_W
        bot_y = base_y + b
        top_y = bot_y + h
        pen.moveTo((lx, bot_y))
        pen.lineTo((rx, bot_y))
        pen.lineTo((rx, top_y))
        pen.lineTo((lx, top_y))
        pen.closePath()

draw_stack.grid = {(w, m): dict(heights=STACK_HEIGHTS[w], bottoms=STACK_BOTTOMS[m])
                   for w in POSITIONS for m in POSITIONS}

# --- Relay (R) — wght: gap, MORF: arrow sharpness ---

RELAY_GAP  = {"lo": 400, "mid": 200, "hi":  20}
RELAY_BASE = {"lo": 190, "mid": 140, "hi":  80}

@glyph("R", "relay", hint="wght: gap | MORF: arrow sharpness", kern_class="medium")
def draw_relay(pen, L, base_half, gap):
    """Two triangles converging toward the middle. 2x3 = 6 points."""
    cx, cy = CX, CY
    pen.moveTo((cx - L, cy + base_half))
    pen.lineTo((cx - L, cy - base_half))
    pen.lineTo((cx - gap/2, cy))
    pen.closePath()
    pen.moveTo((cx + L, cy + base_half))
    pen.lineTo((cx + gap/2, cy))
    pen.lineTo((cx + L, cy - base_half))
    pen.closePath()

draw_relay.grid = {(w, m): dict(L=320, base_half=RELAY_BASE[m], gap=RELAY_GAP[w])
                   for w in POSITIONS for m in POSITIONS}

# --- Bowtie (B) — wght: height, MORF: valve gap ---

BOWTIE_H   = {"lo":  80, "mid": 180, "hi": 280}
BOWTIE_GAP = {"lo":   0, "mid":  60, "hi": 150}

@glyph("B", "bowtie", hint="wght: openness | MORF: valve gap", kern_class="medium")
def draw_bowtie(pen, L, h, gap):
    """Two triangles meeting near the middle. gap=0 -> shared apex
    (classic hourglass). gap>0 -> valve opening in the middle. 6 points."""
    cx, cy = CX, CY
    pen.moveTo((cx - L, cy + h))
    pen.lineTo((cx - L, cy - h))
    pen.lineTo((cx - gap/2, cy))
    pen.closePath()
    pen.moveTo((cx + L, cy + h))
    pen.lineTo((cx + gap/2, cy))
    pen.lineTo((cx + L, cy - h))
    pen.closePath()

draw_bowtie.grid = {(w, m): dict(L=280, h=BOWTIE_H[w], gap=BOWTIE_GAP[m])
                    for w in POSITIONS for m in POSITIONS}


# =====================================================================
# Finalize registry — copy .grid into GlyphDef.params
# =====================================================================

for _gdef in REGISTRY:
    _gdef.params = _gdef.draw.grid


def draw_notdef(pen):
    pen.moveTo((100, 0));   pen.lineTo((900, 0))
    pen.lineTo((900, 700)); pen.lineTo((100, 700))
    pen.closePath()
    pen.moveTo((200, 100)); pen.lineTo((200, 600))
    pen.lineTo((800, 600)); pen.lineTo((800, 100))
    pen.closePath()


# =====================================================================
# Build
# =====================================================================

def build_master(wght_pos, morf_pos, style_name, out_path):
    fb = FontBuilder(UPEM, isTTF=True)
    glyph_order = [".notdef"] + [g.name for g in REGISTRY]
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap({ord(g.char): g.name for g in REGISTRY})

    np_ = TTGlyphPen(None); draw_notdef(np_)
    glyphs = {".notdef": np_.glyph()}
    for g in REGISTRY:
        params = g.params[(wght_pos, morf_pos)]
        p = TTGlyphPen(None)
        g.draw(p, **params)
        glyphs[g.name] = p.glyph()
    fb.setupGlyf(glyphs)

    advances = {g.name: (g.advance, 0) for g in REGISTRY}
    advances[".notdef"] = (1000, 0)
    fb.setupHorizontalMetrics(advances)
    fb.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT)
    fb.setupNameTable({
        "familyName": FAMILY,
        "styleName":  style_name,
        "psName":     f"{FAMILY}-{style_name.replace(' ', '')}",
    })
    us_weight = {"lo": 100, "mid": 500, "hi": 900}[wght_pos]
    fb.setupOS2(
        sTypoAscender=ASCENT, sTypoDescender=DESCENT,
        usWinAscent=ASCENT, usWinDescent=-DESCENT,
        usWeightClass=us_weight,
        fsSelection=0x40 if (wght_pos == "mid" and morf_pos == "mid") else 0,
    )
    fb.setupPost()
    fb.save(out_path)
    return out_path


def build_variable_font(out_path, masters_dir, keep_masters=False):
    POS_VAL = {"lo": 100, "mid": 500, "hi": 900}
    os.makedirs(masters_dir, exist_ok=True)

    master_paths = {}
    for wp in POSITIONS:
        for mp in POSITIONS:
            style = f"W{POS_VAL[wp]}-F{POS_VAL[mp]}"
            path = os.path.join(masters_dir, f"m-{wp}-{mp}.ttf")
            master_paths[(wp, mp)] = build_master(wp, mp, style, path)
            print(f"  master: {path}")

    doc = DesignSpaceDocument()

    axis_w = AxisDescriptor()
    axis_w.tag, axis_w.name = "wght", "Phase"
    axis_w.labelNames = {"en": "Phase"}
    axis_w.minimum, axis_w.default, axis_w.maximum = 100, 500, 900
    doc.addAxis(axis_w)

    axis_m = AxisDescriptor()
    axis_m.tag, axis_m.name = "MORF", "Form"
    axis_m.labelNames = {"en": "Form"}
    axis_m.minimum, axis_m.default, axis_m.maximum = 100, 500, 900
    doc.addAxis(axis_m)

    for wp in POSITIONS:
        for mp in POSITIONS:
            s = SourceDescriptor()
            s.path = master_paths[(wp, mp)]
            s.name = f"master_{wp}_{mp}"
            s.familyName = FAMILY
            s.styleName = f"W{POS_VAL[wp]}-F{POS_VAL[mp]}"
            s.location = {"Phase": POS_VAL[wp], "Form": POS_VAL[mp]}
            doc.addSource(s)

    PHASES = [("Min", 100), ("Low", 300), ("Mid", 500), ("High", 700), ("Max", 900)]
    for style, w in PHASES:
        inst = InstanceDescriptor()
        inst.familyName = FAMILY
        inst.styleName = style
        inst.postScriptFontName = f"{FAMILY}-{style}"
        inst.location = {"Phase": w, "Form": 500}
        doc.addInstance(inst)

    varfont, _, _ = varLib_build(doc)

    # Mark regular, restore name table entries varLib strips
    os2 = varfont["OS/2"]
    os2.fsSelection = (os2.fsSelection & ~0x41) | 0x40
    varfont["head"].macStyle = 0

    VERSION  = "Version 5.000"
    FULLNAME = f"{FAMILY} Mid"
    PSNAME   = f"{FAMILY}-Mid"
    UNIQUEID = f"5.000;NONE;{PSNAME}"
    for nid, val in [(3, UNIQUEID), (4, FULLNAME), (5, VERSION),
                     (16, FAMILY), (17, "Mid"), (25, FAMILY)]:
        varfont["name"].setName(val, nid, 1, 0, 0)
        varfont["name"].setName(val, nid, 3, 1, 0x409)

    os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
    varfont.save(out_path)

    if not keep_masters:
        shutil.rmtree(masters_dir, ignore_errors=True)

    return out_path


def main():
    ap = argparse.ArgumentParser(description="Build the SymbolLang v5 variable font.")
    ap.add_argument("-o", "--output", default="SymbolLang.ttf",
                    help="output .ttf path (default: ./SymbolLang.ttf)")
    ap.add_argument("--masters-dir", default=None,
                    help="where to write the 9 intermediate master TTFs "
                         "(default: a temp directory, cleaned up after build)")
    ap.add_argument("--keep-masters", action="store_true",
                    help="keep the intermediate master TTFs after building")
    args = ap.parse_args()

    masters_dir = args.masters_dir or tempfile.mkdtemp(prefix="symbolang_masters_")
    print(f"Building SymbolLang v5 -> {args.output}")
    print(f"Masters dir: {masters_dir} (keep={args.keep_masters or bool(args.masters_dir)})")

    keep = args.keep_masters or bool(args.masters_dir)
    build_variable_font(args.output, masters_dir, keep_masters=keep)

    vf = TTFont(args.output)
    print("\nAxes:")
    for a in vf["fvar"].axes:
        lbl = vf["name"].getDebugName(a.axisNameID)
        print(f"  {a.axisTag}  {lbl!r:<8}  {a.minValue} / {a.defaultValue} / {a.maxValue}")
    print(f"Instances: {len(vf['fvar'].instances)} named")
    print(f"Glyphs ({len(vf.getGlyphOrder())-1}): {vf.getGlyphOrder()[1:]}")
    print(f"Size: {os.path.getsize(args.output)} bytes")


if __name__ == "__main__":
    sys.exit(main())
