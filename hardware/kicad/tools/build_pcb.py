"""Build GreenOak.kicad_pcb (Rev A) from output/GreenOak.net: place parts, outline, holes, zones, silkscreen.

Run with KiCad's Python:
  "C:/Users/Chanatip/AppData/Local/Programs/KiCad/10.0/bin/python.exe" hardware/kicad/tools/build_pcb.py
Board coordinates below are local mm (0,0 = top-left of the 100 x 100 board).
Re-running overwrites the board (and any routing) - route again afterwards (tools/route_pcb.py).
"""
import json
import os
import re

import pcbnew

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
KL = r"C:\Users\Chanatip\AppData\Local\Programs\KiCad\10.0\share\kicad\footprints"
APLAB = r"C:\Users\Chanatip\Desktop\Main\PCB_Kidcad\Library\APLab.pretty"  # global APLab lib
OX, OY = 50.0, 50.0          # board origin on the sheet
W, H = 100.0, 100.0
BOARD_TITLE = "GREEN OAK CONTROL  Rev A  v1.1"

POWER = ["+12V_IN", "12V_FUSED", "+12V", "+12V_LED", "LIGHT_D"]
SUPPLY = ["GND", "+5V", "+5V_DEVKIT", "+3V3", "+12V_SENSOR", "RELAY_VCC",
          "PUMPA_D", "PUMPB_D", "PHDOWN_D", "REFILL_D"]


def P(x, y):
    return pcbnew.VECTOR2I(pcbnew.FromMM(OX + x), pcbnew.FromMM(OY + y))


# ref: (x, y, rotation_deg)  - position of footprint origin (pad 1 for most parts)
PLACE = {
    # power, left side
    "J1": (6, 49, 270), "J2": (6, 62, 270), "J3": (6, 75, 270),
    "F2": (16, 43, 0), "F1": (16, 53.5, 0), "F3": (18, 76.5, 0),
    "U1": (15, 20.5, 0),
    "C1": (17, 66, 0), "C2": (29, 65, 0), "C3": (37, 62, 0), "D1": (44, 62, 0),
    "TP1": (9, 87, 0), "TP2": (13, 87, 0), "TP3": (17, 87, 0), "TP4": (21, 87, 0),
    "JP1": (5, 14, 0),
    # MCU
    "U2": (52, 5, 0),
    # top edge XH
    "J9": (11, 4, 0), "J11": (30, 4, 0), "J10": (84, 4, 0),  # fan next to GPIO42
    # right edge XH (rot 90 -> pins run upward from pin 1)
    "J12": (94, 23.5, 90), "J13": (94, 38, 90), "J14": (94, 52.5, 90),
    "J15": (94, 64.5, 90), "J16": (94, 79, 90),
    # bottom-left XH
    "J17": (10, 95, 0),
    # right-side small parts
    "R20": (85, 30, 0), "R21": (85, 33.5, 0),
    "R16": (85, 44, 0), "R17": (85, 47.5, 0),
    "R18": (85, 57, 0), "R19": (85, 60.5, 0), "C4": (85, 64, 0),
    # relay / fan pull-downs under the DevKit
    "R11": (72, 30, 0), "R12": (72, 33.5, 0), "R13": (72, 37, 0), "R14": (72, 40.5, 0), "R15": (72, 44, 0),
}
# MOSFET channels: terminal on the bottom edge, MOSFET above, flyback above that,
# gate resistor + pull-down under the DevKit
for i, ch in enumerate(["LIGHT", "PUMPA", "PUMPB", "PHDOWN", "REFILL"]):
    x0 = 30 + 12 * i
    PLACE[f"J{4 + i}"] = (x0, 94.5, 0)
    PLACE[f"Q{1 + i}"] = (x0 + 8, 80, 90)   # rotated: leaves a corridor above the next pin 1
    PLACE[f"R{1 + 2 * i}"] = (60, 12 + 3.5 * i, 0)     # gate 100R
    PLACE[f"R{2 + 2 * i}"] = (66, 12 + 3.5 * i, 0)     # pull-down 10k
    if i:
        PLACE[f"D{1 + i}"] = (x0 + 8, 70.5, 0)

HOLES = [(3.5, 3.5), (96.5, 3.5), (3.5, 96.5), (96.5, 96.5)]

# silkscreen labels: (text, x, y, rot, size)
SILK = [
    ("-  12V IN  +", 12.3, 51.5, 90, 0.8),
    ("-  SWITCH  +", 12.3, 64.5, 90, 0.8),
    ("-  12V SENSOR  +", 12.3, 77.5, 90, 0.8),
    ("5A LED", 45.5, 43, 0, 0.8), ("10A MAIN", 46.2, 53.5, 0, 0.8),
    ("RELAY", 17.5, 11.3, 0, 0.8), ("GND 1 2 3 4 VCC", 17.5, 9.5, 0, 0.8),
    ("FAN", 85.2, 11.3, 0, 0.8), ("ENA GND", 85.2, 9.5, 0, 0.8),
    ("SPARE", 33.7, 11.3, 0, 0.8), ("3V3 GND 14 47", 33.7, 9.5, 0, 0.8),
    ("W5500: 5V G MI MO SCK CS", 89, 17.25, 90, 0.8),
    ("RS485: 3V3 TX RX G", 89, 34.25, 90, 0.8),
    ("PZEM: 5V RX TX G", 89, 48.75, 90, 0.8),
    ("FLOW: 5V G SIG", 89, 62, 90, 0.8),
    ("SHT40: G 3V3 SDA SCL", 90.2, 75.25, 90, 0.8),
    ("DS3231 GND 3V3 SDA SCL", 13.5, 91, 0, 0.8),
    ("12V", 9, 84.8, 0, 0.8), ("5V", 13, 84.8, 0, 0.8), ("3V3", 17, 84.8, 0, 0.8), ("GND", 21, 84.8, 0, 0.8),
    ("RLY VCC", 5, 17, 0, 0.8),
    (BOARD_TITLE, 28, 14.3, 0, 1.2),
    ("ESP32-S3-DevKitC-1  USB v", 64.5, 66.8, 0, 0.8),
]
for i, (name, code) in enumerate([("LED", "D200"), ("A", "M103"), ("B", "M104"), ("pH", "M106"), ("FILL", "M102")]):
    x0 = 30 + 12 * i
    SILK += [("+", x0, 88, 0, 1.0), ("-", x0 + 5.08, 88, 0, 1.0), (name, x0 + 2.54, 87.8, 0, 0.8),
             (code, x0 + 1.5, 86.2, 0, 0.8)]


def load_netlist():
    s = open(os.path.join(PROJ, "output", "GreenOak.net"), encoding="utf-8").read()
    comps = {}
    for m in re.finditer(r'\(comp\s+\(ref "([^"]+)"\)\s*\(value "([^"]*)"\)\s*\(footprint "([^"]*)"\)', s):
        comps[m.group(1)] = (m.group(2), m.group(3))
    nets = {}
    body = s[s.find("(nets"):]
    for blk in re.split(r"\n\t\t\(net\n", body)[1:]:
        name = re.search(r'\(name "([^"]+)"\)', blk).group(1).lstrip("/")
        for r, p in re.findall(r'\(ref "([^"]+)"\)\s*\(pin "([^"]+)"\)', blk):
            nets[(r, p)] = name
    return comps, nets


def fp_path(lib):
    if lib == "APLab":
        return APLAB
    return os.path.join(PROJ, "GreenOak.pretty") if lib == "GreenOak" else os.path.join(KL, lib + ".pretty")


def add_seg(board, layer, a, b, w=0.1):
    s = pcbnew.PCB_SHAPE(board)
    s.SetShape(pcbnew.SHAPE_T_SEGMENT)
    s.SetStart(P(*a))
    s.SetEnd(P(*b))
    s.SetLayer(layer)
    s.SetWidth(pcbnew.FromMM(w))
    board.Add(s)


def add_text(board, txt, x, y, rot, size, layer=pcbnew.F_SilkS):
    t = pcbnew.PCB_TEXT(board)
    t.SetText(txt)
    t.SetPosition(P(x, y))
    t.SetLayer(layer)
    t.SetTextSize(pcbnew.VECTOR2I(pcbnew.FromMM(size), pcbnew.FromMM(size)))
    t.SetTextThickness(pcbnew.FromMM(max(0.12, size * 0.15)))
    t.SetTextAngleDegrees(rot)
    board.Add(t)


def set_rect(zone, x0, y0, x1, y1):
    ol = zone.Outline()
    ol.NewOutline()
    for x, y in [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]:
        v = P(x, y)
        ol.Append(v.x, v.y)


def update_project_netclasses():
    path = os.path.join(PROJ, "GreenOak.kicad_pro")
    p = json.load(open(path, encoding="utf-8"))
    ns = p["net_settings"]
    for c in ns["classes"]:
        if c["name"] == "Power":
            c.update(track_width=2.0, clearance=0.3, via_diameter=1.2, via_drill=0.6)
        if c["name"] == "Supply":
            c.update(track_width=0.8, clearance=0.25, via_diameter=1.0, via_drill=0.5)
        if c["name"] == "Default":
            c.update(track_width=0.3, clearance=0.25)
    ns["netclass_patterns"] = ([{"netclass": "Power", "pattern": n} for n in POWER]
                               + [{"netclass": "Supply", "pattern": n} for n in SUPPLY])
    ns["netclass_assignments"] = None
    json.dump(p, open(path, "w", encoding="utf-8"), indent=2)


def main():
    comps, padnets = load_netlist()
    board = pcbnew.BOARD()
    board.SetCopperLayerCount(2)
    nets = {}
    for n in sorted(set(padnets.values())):
        ni = pcbnew.NETINFO_ITEM(board, n)
        board.Add(ni)
        nets[n] = ni

    for ref, (value, fp) in comps.items():
        if ref not in PLACE:
            raise SystemExit(f"no placement for {ref}")
        lib, name = fp.split(":")
        m = pcbnew.FootprintLoad(fp_path(lib), name)
        m.SetReference(ref)
        m.SetValue(value)
        m.SetFPID(pcbnew.LIB_ID(lib, name))
        x, y, rot = PLACE[ref]
        m.SetPosition(P(x, y))
        m.SetOrientationDegrees(rot)
        m.Value().SetVisible(False)
        if ref.startswith(("J", "TP", "F")):
            m.Reference().SetVisible(False)
        m.Reference().SetTextSize(pcbnew.VECTOR2I(pcbnew.FromMM(0.8), pcbnew.FromMM(0.8)))
        m.Reference().SetTextThickness(pcbnew.FromMM(0.12))
        for pad in m.Pads():
            net = padnets.get((ref, pad.GetNumber()))
            if net:
                pad.SetNet(nets[net])
        board.Add(m)

    for i, (x, y) in enumerate(HOLES):
        m = pcbnew.FootprintLoad(os.path.join(KL, "MountingHole.pretty"), "MountingHole_3.2mm_M3")
        m.SetReference(f"H{i + 1}")
        m.SetPosition(P(x, y))
        m.Reference().SetVisible(False)
        m.Value().SetVisible(False)
        board.Add(m)

    for a, b in [((0, 0), (W, 0)), ((W, 0), (W, H)), ((W, H), (0, H)), ((0, H), (0, 0))]:
        add_seg(board, pcbnew.Edge_Cuts, a, b, 0.1)

    # board texts are added after routing (`build_pcb.py silk`): they change the Specctra export

    # GND pour on both layers
    for layer in (pcbnew.F_Cu, pcbnew.B_Cu):
        z = pcbnew.ZONE(board)
        z.SetLayer(layer)
        z.SetNet(nets["GND"])
        set_rect(z, 0.3, 0.3, W - 0.3, H - 0.3)
        z.SetLocalClearance(pcbnew.FromMM(0.3))
        z.SetMinThickness(pcbnew.FromMM(0.25))
        z.SetPadConnection(pcbnew.ZONE_CONNECTION_THT_THERMAL)
        z.SetThermalReliefGap(pcbnew.FromMM(0.3))
        z.SetThermalReliefSpokeWidth(pcbnew.FromMM(0.5))
        board.Add(z)
    # no copper under the part of the ESP32 antenna that is still over the board
    k = pcbnew.ZONE(board)
    k.SetIsRuleArea(True)
    k.SetLayerSet(pcbnew.LSET.AllCuMask())
    k.SetDoNotAllowTracks(True)
    k.SetDoNotAllowVias(True)
    k.SetDoNotAllowZoneFills(True)
    k.SetDoNotAllowPads(False)
    k.SetDoNotAllowFootprints(False)
    set_rect(k, 50.5, 0.2, 79, 3.6)
    board.Add(k)

    ds = board.GetDesignSettings()
    ds.m_CopperEdgeClearance = pcbnew.FromMM(0.5)

    out = os.path.join(PROJ, "GreenOak.kicad_pcb")
    board.Save(out)
    update_project_netclasses()
    print("saved", out, len(comps), "parts")


def add_silk():
    out = os.path.join(PROJ, "GreenOak.kicad_pcb")
    board = pcbnew.LoadBoard(out)
    for t in [d for d in board.GetDrawings() if d.GetClass() == "PCB_TEXT"]:
        board.Remove(t)
    for txt, x, y, rot, size in SILK:
        add_text(board, txt, x, y, rot, size)
    board.Save(out)
    print("silk texts", len(SILK))


if __name__ == "__main__":
    import sys
    add_silk() if sys.argv[1:] == ["silk"] else main()
