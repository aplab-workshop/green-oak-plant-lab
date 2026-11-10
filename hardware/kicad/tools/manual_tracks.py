"""Hand-routed tracks that Freerouting left open (re-apply after every autoroute import)."""
import os, pcbnew
PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PCB = os.path.join(PROJ, "GreenOak.kicad_pcb")
OX, OY = 50.0, 50.0
# (net, layer, [(x, y), ...] local mm, width, vias at these points)
TRACKS = []  # route_all.sh retries Freerouting until 100 % routed; add hand-routed segments here only if needed
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
# GND pads whose thermal spokes DRC reported as starved: connect them solid to the pour
import json, sys
rep = os.path.join(PROJ, "output", "drc.json")
if len(sys.argv) > 1 and sys.argv[1] == "starved" and os.path.exists(rep):
    want = set()
    for v in json.load(open(rep, encoding="utf-8"))["violations"]:
        if v["type"] == "starved_thermal":
            for it in v["items"]:
                d = it["description"]
                if " of " in d and "pad" in d:
                    num = d.split("pad ")[1].split(" ")[0]
                    want.add((d.rsplit(" of ", 1)[1].split(" ")[0], num))
    for ref, num in sorted(want):
        for pd in b.FindFootprintByReference(ref).Pads():
            if pd.GetNumber() == num:
                pd.SetLocalZoneConnection(pcbnew.ZONE_CONNECTION_FULL)
    print("solid pads", sorted(want))
b.Save(PCB)
print("manual tracks", len(TRACKS))
