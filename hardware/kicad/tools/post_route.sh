#!/usr/bin/env bash
# After Freerouting: import SES, manual fixes, GND stitching, refill + DRC  (run from hardware/kicad)
set -e
B="/c/Users/Chanatip/AppData/Local/Programs/KiCad/10.0/bin"
drc() { "$B/kicad-cli.exe" pcb drc --refill-zones --save-board --format json --severity-all -o output/drc.json GreenOak.kicad_pcb >/dev/null; }
"$B/python.exe" tools/route_pcb.py import 2>&1 | grep -v leak
"$B/python.exe" tools/manual_tracks.py 2>&1 | grep -v leak
drc
"$B/python.exe" tools/stitch_gnd.py add 5 2>&1 | grep -v leak
drc
"$B/python.exe" tools/stitch_gnd.py prune output/drc.json 2>&1 | grep -v leak
drc
python tools/drc_summary.py output/drc.json
