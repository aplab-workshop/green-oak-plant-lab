"""Add GND stitching vias on a grid where there is room (joins F.Cu / B.Cu pour islands).

  kicad-python tools/stitch_gnd.py add [pitch_mm]     add vias (removes earlier stitching vias first)
  kicad-python tools/stitch_gnd.py prune drc.json      delete stitching vias that DRC flagged
Stitching vias are 0.6/0.3 mm and are recognised by that size on the GND net.
"""
import json
import math
import os
import sys

import pcbnew

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PCB = os.path.join(PROJ, "GreenOak.kicad_pcb")
OX, OY, W, H = 50.0, 50.0, 100.0, 100.0
VIA_D, VIA_DRILL, CLR = 0.6, 0.3, 0.35
mm = pcbnew.ToMM


def is_stitch(t, gnd):
    return (t.GetClass() == "PCB_VIA" and t.GetNetCode() == gnd
            and abs(mm(t.GetWidth(pcbnew.F_Cu)) - VIA_D) < 1e-3)


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def add(board, pitch):
    gnd = board.FindNet("GND").GetNetCode()
    tracks = list(board.GetTracks())
    old = [t for t in tracks if is_stitch(t, gnd)]
    tracks = [t for t in tracks if not is_stitch(t, gnd)]
    for t in old:
        board.Remove(t)
    segs, circles = [], []
    for t in tracks:
        if t.GetClass() == "PCB_TRACK":
            segs.append((mm(t.GetStart().x), mm(t.GetStart().y), mm(t.GetEnd().x), mm(t.GetEnd().y),
                         mm(t.GetWidth()) / 2))
        else:
            circles.append((mm(t.GetPosition().x), mm(t.GetPosition().y), mm(t.GetWidth(pcbnew.F_Cu)) / 2))
    rects = []
    for fp in board.GetFootprints():
        for p in fp.Pads():
            bb = p.GetBoundingBox()
            rects.append((mm(bb.GetLeft()), mm(bb.GetTop()), mm(bb.GetRight()), mm(bb.GetBottom())))
    keep = []
    for z in board.Zones():
        if z.GetIsRuleArea():
            bb = z.GetBoundingBox()
            keep.append((mm(bb.GetLeft()), mm(bb.GetTop()), mm(bb.GetRight()), mm(bb.GetBottom())))
    r = VIA_D / 2
    n = 0
    y = OY + 2.0
    while y < OY + H - 1.9:
        x = OX + 2.0
        while x < OX + W - 1.9:
            ok = all(not (a - r - CLR < x < c + r + CLR and b - r - CLR < y < d + r + CLR)
                     for a, b, c, d in rects + keep)
            ok = ok and all(seg_dist(x, y, *s[:4]) > s[4] + r + CLR for s in segs)
            ok = ok and all(math.hypot(x - cx, y - cy) > cr + r + CLR for cx, cy, cr in circles)
            if ok:
                v = pcbnew.PCB_VIA(board)
                v.SetPosition(pcbnew.VECTOR2I(pcbnew.FromMM(x), pcbnew.FromMM(y)))
                v.SetWidth(pcbnew.FromMM(VIA_D))
                v.SetDrill(pcbnew.FromMM(VIA_DRILL))
                v.SetNetCode(gnd)
                board.Add(v)
                n += 1
            x += pitch
        y += pitch
    print("stitching vias", n)


def prune(board, report):
    gnd = board.FindNet("GND").GetNetCode()
    d = json.load(open(report, encoding="utf-8"))
    bad = set()
    for v in d["violations"]:
        for it in v["items"]:
            if it["description"].startswith("Via"):
                bad.add((round(it["pos"]["x"], 2), round(it["pos"]["y"], 2)))
    n = 0
    for t in list(board.GetTracks()):
        if is_stitch(t, gnd) and (round(mm(t.GetPosition().x), 2), round(mm(t.GetPosition().y), 2)) in bad:
            board.Remove(t)
            n += 1
    print("pruned", n)


board = pcbnew.LoadBoard(PCB)
if sys.argv[1] == "add":
    add(board, float(sys.argv[2]) if len(sys.argv) > 2 else 5.0)
else:
    prune(board, sys.argv[2])
board.Save(PCB)
