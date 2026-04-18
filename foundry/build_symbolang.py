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
# Primitives
# =====================================================================

def draw_tri_n(pen, base_half, apex_h):
    by, ay = CY - apex_h / 2, CY + apex_h / 2
    pen.moveTo((CX - base_half, by))
    pen.lineTo((CX + base_half, by))
    pen.lineTo((CX, ay))
    pen.closePath()

def draw_tri_s(pen, base_half, apex_h):
    ty, ay = CY + apex_h / 2, CY - apex_h / 2
    pen.moveTo((CX + base_half, ty))
    pen.lineTo((CX - base_half, ty))
    pen.lineTo((CX, ay))
    pen.closePath()

def draw_tri_e(pen, base_half, apex_h):
    lx, rx = CX - apex_h / 2, CX + apex_h / 2
    pen.moveTo((lx, CY + base_half))
    pen.lineTo((lx, CY - base_half))
    pen.lineTo((rx, CY))
    pen.closePath()

def draw_tri_w(pen, base_half, apex_h):
    lx, rx = CX - apex_h / 2, CX + apex_h / 2
    pen.moveTo((rx, CY - base_half))
    pen.lineTo((rx, CY + base_half))
    pen.lineTo((lx, CY))
    pen.closePath()

def _hex_pts(cx, cy, r):
    off = -math.pi / 2
    return [(cx + r*math.cos(off + math.pi/3*i),
             cy + r*math.sin(off + math.pi/3*i)) for i in range(6)]

N_RINGS = 4
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

N_DOTS, DOT_SIDES = 7, 10
def draw_dots(pen, spacing, r_dot):
    start_x = CX - spacing * (N_DOTS - 1) / 2
    for i in range(N_DOTS):
        cx, cy = start_x + i * spacing, CY
        pen.moveTo((cx + r_dot, cy))
        for j in range(1, DOT_SIDES):
            a = 2 * math.pi * j / DOT_SIDES
            pen.lineTo((cx + r_dot*math.cos(a), cy + r_dot*math.sin(a)))
        pen.closePath()

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

GRID_N, GRID_SIDES, GRID_SPACING = 4, 8, 175
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

STACK_N, STACK_W, STACK_GAP = 5, 75, 30
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


# =====================================================================
# Parameter grids — (wght_pos, morf_pos) -> kwargs for each draw fn
# =====================================================================
POSITIONS = ("lo", "mid", "hi")

def no_morf(wght_params):
    return {(w, m): wght_params[w] for w in POSITIONS for m in POSITIONS}

TRI_WGHT = {
    "lo":  dict(base_half=350, apex_h=180),
    "mid": dict(base_half=235, apex_h=405),
    "hi":  dict(base_half=110, apex_h=700),
}

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
def hex_grid():
    return {(w, m): dict(radii=HEX_RADII[m], stroke=HEX_STROKE[(w, m)])
            for w in POSITIONS for m in POSITIONS}

DOTS_WGHT = {
    "lo":  dict(spacing=145, r_dot=22),
    "mid": dict(spacing=95,  r_dot=38),
    "hi":  dict(spacing=55,  r_dot=55),
}

CHEVRON_T = {"lo": 20, "mid": 60, "hi": 130}
CHEVRON_H = {"lo": 130, "mid": 225, "hi": 320}
def chevron_grid():
    return {(w, m): dict(L=260, H=CHEVRON_H[m], T=CHEVRON_T[w])
            for w in POSITIONS for m in POSITIONS}

ARC_RISE  = {"lo": 0,   "mid": 120, "hi": 280}
ARC_BULGE = {"lo": 0,   "mid": 90,  "hi": 180}
def arc_grid():
    return {(w, m): dict(rise=ARC_RISE[w], bulge=ARC_BULGE[m],
                         thickness=50, span_half=340)
            for w in POSITIONS for m in POSITIONS}

QUAD_SKEW   = {"lo": -22, "mid": 0,  "hi": 22}
QUAD_RADIUS = {"lo":   0, "mid": 45, "hi": 130}
def quad_grid():
    return {(w, m): dict(skew_deg=QUAD_SKEW[w], radius=QUAD_RADIUS[m],
                         w=520, h=340)
            for w in POSITIONS for m in POSITIONS}

GRID_R = {"lo": 18, "mid": 50, "hi": 85}
def grid_grid():
    return {(w, m): dict(r_dot=GRID_R[m]) for w in POSITIONS for m in POSITIONS}

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
def stack_grid():
    return {(w, m): dict(heights=STACK_HEIGHTS[w], bottoms=STACK_BOTTOMS[m])
            for w in POSITIONS for m in POSITIONS}

RELAY_GAP  = {"lo": 400, "mid": 200, "hi":  20}
RELAY_BASE = {"lo": 190, "mid": 140, "hi":  80}
def relay_grid():
    return {(w, m): dict(L=320, base_half=RELAY_BASE[m], gap=RELAY_GAP[w])
            for w in POSITIONS for m in POSITIONS}

BOWTIE_H   = {"lo":  80, "mid": 180, "hi": 280}
BOWTIE_GAP = {"lo":   0, "mid":  60, "hi": 150}
def bowtie_grid():
    return {(w, m): dict(L=280, h=BOWTIE_H[w], gap=BOWTIE_GAP[m])
            for w in POSITIONS for m in POSITIONS}


SYMBOLS = [
    ("N", "tri_n",   draw_tri_n,       no_morf(TRI_WGHT),  "squat -> equilateral -> spike"),
    ("S", "tri_s",   draw_tri_s,       no_morf(TRI_WGHT),  "squat -> equilateral -> spike"),
    ("E", "tri_e",   draw_tri_e,       no_morf(TRI_WGHT),  "squat -> equilateral -> spike"),
    ("W", "tri_w",   draw_tri_w,       no_morf(TRI_WGHT),  "squat -> equilateral -> spike"),
    ("H", "hex",     draw_hex_nested,  hex_grid(),         "wght: stroke | MORF: vortex -> single"),
    ("D", "dots",    draw_dots,        no_morf(DOTS_WGHT), "discrete -> stream"),
    ("C", "chevron", draw_chevron,     chevron_grid(),     "wght: thin -> thick | MORF: flat -> sharp"),
    ("A", "arc",     draw_arc,         arc_grid(),         "wght: pipe -> bridge | MORF: uniform -> bulged"),
    ("Q", "quad",    draw_quad_skew,   quad_grid(),        "wght: skew | MORF: corner radius"),
    ("G", "grid",    draw_grid,        grid_grid(),        "MORF: sparse -> dense"),
    ("M", "stack",   draw_stack,       stack_grid(),       "wght: heights | MORF: wavy bottoms"),
    ("R", "relay",   draw_relay,       relay_grid(),       "wght: gap | MORF: arrow sharpness"),
    ("B", "bowtie",  draw_bowtie,      bowtie_grid(),      "wght: openness | MORF: valve gap"),
]


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
    glyph_order = [".notdef"] + [s[1] for s in SYMBOLS]
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap({ord(s[0]): s[1] for s in SYMBOLS})

    np_ = TTGlyphPen(None); draw_notdef(np_)
    glyphs = {".notdef": np_.glyph()}
    for _char, name, fn, grid, _hint in SYMBOLS:
        params = grid[(wght_pos, morf_pos)]
        p = TTGlyphPen(None)
        fn(p, **params)
        glyphs[name] = p.glyph()
    fb.setupGlyf(glyphs)

    fb.setupHorizontalMetrics({g: (ADVANCE, 0) for g in glyph_order})
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
