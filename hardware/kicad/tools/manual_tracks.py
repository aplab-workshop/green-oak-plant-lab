"""Hand-routed tracks that Freerouting left open (re-apply after every autoroute import)."""
import os, pcbnew
PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PCB = os.path.join(PROJ, "GreenOak.kicad_pcb")
OX, OY = 50.0, 50.0
# (net, layer, [(x, y), ...] local mm, width, vias at these points)
TRACKS = [
    # J7 pin 1 (pH Down +12V) -> B.Cu up between PHDOWN_G and PHDOWN_D -> via onto the F.Cu +12V bus
    ("+12V", "B.Cu", [(66, 94.5), (69.5, 91), (69.5, 72.73)], 0.8, [(69.5, 72.73)]),
    # join the left +12V group (J4-J6) with the F.Cu +12V bus that feeds D2-D5 / J7 / J8
    ("+12V", "B.Cu", [(54, 94.5), (54, 72.73)], 1.5, [(54, 72.73)]),
]
b = pcbnew.LoadBoard(PCB)
P = lambda x, y: pcbnew.VECTOR2I(pcbnew.FromMM(OX + x), pcbnew.FromMM(OY + y))
for net, layer, pts, w, vias in TRACKS:
    n = b.FindNet(net)
    for a, c in zip(pts, pts[1:]):
        t = pcbnew.PCB_TRACK(b); t.SetStart(P(*a)); t.SetEnd(P(*c)); t.SetWidth(pcbnew.FromMM(w))
        t.SetLayer(b.GetLayerID(layer)); t.SetNet(n); b.Add(t)
    for x, y in vias:
        v = pcbnew.PCB_VIA(b); v.SetPosition(P(x, y)); v.SetWidth(pcbnew.FromMM(1.2)); v.SetDrill(pcbnew.FromMM(0.6))
        v.SetNet(n); b.Add(v)
# GND pads whose thermal spokes are blocked by tracks: connect them solid to the pour
for ref, pad in [("J15", "2")]:
    for pd in b.FindFootprintByReference(ref).Pads():
        if pd.GetNumber() == pad:
            pd.SetLocalZoneConnection(pcbnew.ZONE_CONNECTION_FULL)
b.Save(PCB)
print("manual tracks", len(TRACKS))
