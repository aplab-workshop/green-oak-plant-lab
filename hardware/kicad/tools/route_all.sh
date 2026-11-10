#!/usr/bin/env bash
# Full rebuild: place -> DSN -> Freerouting -> import + manual fixes + GND stitching -> DRC  (run from hardware/kicad)
set -e
B="/c/Users/Chanatip/AppData/Local/Programs/KiCad/10.0/bin"
JAVA="/c/Program Files/Microsoft/jdk-25.0.5.21-hotspot/bin/java.exe"
PATCH="$HOME/.claude/skills/kicad-pcb-design/scripts/patch_dsn_classes.py"
"$B/python.exe" tools/build_pcb.py
"$B/python.exe" tools/route_pcb.py export 2>&1 | grep -v leak
python "$PATCH" route/GreenOak.dsn --power-width 2000 \
  --power "+12V_IN,12V_FUSED,+12V,+12V_LED,LIGHT_D" \
  --supply "GND,+5V,+5V_DEVKIT,+12V_SENSOR,RELAY_VCC,PUMPA_D,PUMPB_D,PHDOWN_D,REFILL_D"   # +3V3 = signal (0.3 mm, < 0.3 A)
# Freerouting is not deterministic: retry until the session ends with no unrouted net
for try in 1 2 3 4 5 6 7 8; do
  (cd route && "$JAVA" -jar ~/.kicad-mcp/freerouting.jar -de GreenOak.dsn -do GreenOak.ses -mp 200 --gui.enabled=false > freerouting.log 2>&1)
  last=$(grep "session completed" route/freerouting.log | tail -1)
  echo "try $try: $(echo "$last" | grep -o 'final score: [^,]*([^)]*)\|final score: [0-9.]*')"
  echo "$last" | grep -q "unrouted)" || break
done
bash tools/post_route.sh
