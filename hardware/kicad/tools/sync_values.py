"""Copy Value (and MPN fields) from the netlist to the routed PCB without touching tracks."""
import os, re, pcbnew
PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(PROJ, "output", "GreenOak.net"), encoding="utf-8").read()
b = pcbnew.LoadBoard(os.path.join(PROJ, "GreenOak.kicad_pcb"))
n = 0
for m in re.finditer(r'\(comp\s+\(ref "([^"]+)"\)\s*\(value "([^"]*)"\)', s):
    fp = b.FindFootprintByReference(m.group(1))
    if fp and fp.GetValue() != m.group(2):
        print(m.group(1), fp.GetValue(), "->", m.group(2)); fp.SetValue(m.group(2)); n += 1
b.Save(os.path.join(PROJ, "GreenOak.kicad_pcb"))
print("updated", n)
