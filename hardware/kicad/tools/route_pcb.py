"""Specctra round-trip helper for Freerouting.

  kicad-python route_pcb.py export   -> route/GreenOak.dsn
  kicad-python route_pcb.py import   <- route/GreenOak.ses  (saves GreenOak.kicad_pcb)

Full flow (from hardware/kicad):
  1. kicad-python tools/route_pcb.py export
  2. python <skill>/scripts/patch_dsn_classes.py route/GreenOak.dsn --power ... --supply ... --power-width 2000
  3. java -jar ~/.kicad-mcp/freerouting.jar -de route/GreenOak.dsn -do route/GreenOak.ses -mp 100 --gui.enabled=false
  4. kicad-python tools/route_pcb.py import
  5. kicad-cli pcb drc --refill-zones --save-board ...
"""
import os
import sys

import pcbnew

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PCB = os.path.join(PROJ, "GreenOak.kicad_pcb")
ROUTE = os.path.join(PROJ, "route")

board = pcbnew.LoadBoard(PCB)
os.makedirs(ROUTE, exist_ok=True)
if sys.argv[1] == "export":
    # route GND as a normal net (not a plane): drop pours + earlier tracks in memory only
    zones = [z for z in board.Zones() if not z.GetIsRuleArea()]
    tracks = list(board.GetTracks())
    for item in zones + tracks:
        board.Remove(item)
    ok = pcbnew.ExportSpecctraDSN(board, os.path.join(ROUTE, "GreenOak.dsn"))
    print("export", ok)
else:
    ok = pcbnew.ImportSpecctraSES(board, os.path.join(ROUTE, "GreenOak.ses"))
    print("import", ok, "tracks", len(board.GetTracks()))
    board.Save(PCB)
