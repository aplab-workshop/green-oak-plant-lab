"""Apply the zone settings of build_pcb.py to an already-routed board (keeps tracks)."""
import os, json, pcbnew
PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pcb = os.path.join(PROJ, "GreenOak.kicad_pcb")
b = pcbnew.LoadBoard(pcb)
for z in b.Zones():
    if not z.GetIsRuleArea():
        z.SetPadConnection(pcbnew.ZONE_CONNECTION_THT_THERMAL)
        z.SetThermalReliefGap(pcbnew.FromMM(0.3))
        z.SetThermalReliefSpokeWidth(pcbnew.FromMM(0.5))
        z.SetLocalClearance(pcbnew.FromMM(0.3))
b.Save(pcb)
pro = os.path.join(PROJ, "GreenOak.kicad_pro")
p = json.load(open(pro, encoding="utf-8"))
p["board"]["design_settings"]["rules"]["min_resolved_spokes"] = 1
json.dump(p, open(pro, "w", encoding="utf-8"), indent=2)
print("zones", len(list(b.Zones())))
