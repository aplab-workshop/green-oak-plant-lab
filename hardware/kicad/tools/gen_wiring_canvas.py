"""Build hardware/GreenOak_Wiring_RevA.canvas (Obsidian) from output/GreenOak.net.

Every pin table is read from the netlist, so the canvas always matches the KiCad schematic.
Usage:  python hardware/kicad/tools/gen_wiring_canvas.py
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PROJ))
sys.path.insert(0, HERE)
from gen_schematic import DEVKIT_LEFT, DEVKIT_RIGHT  # noqa: E402

# ---------------------------------------------------------------- netlist
s = open(os.path.join(PROJ, "output", "GreenOak.net"), encoding="utf-8").read()
VALUE = {m.group(1): m.group(2) for m in re.finditer(r'\(comp\s+\(ref "([^"]+)"\)\s*\(value "([^"]*)"\)', s)}
PIN2NET, NET2PINS = {}, {}
for blk in re.split(r"\n\t\t\(net\n", s[s.find("(nets"):])[1:]:
    name = re.search(r'\(name "([^"]+)"\)', blk).group(1).lstrip("/")
    for r, p in re.findall(r'\(ref "([^"]+)"\)\s*\(pin "([^"]+)"\)', blk):
        PIN2NET[(r, p)] = name
        NET2PINS.setdefault(name, []).append((r, p))

ESP_NAME = {str(i + 1): n for i, n in enumerate(DEVKIT_LEFT)}
ESP_NAME.update({str(23 + i): n for i, n in enumerate(DEVKIT_RIGHT)})


def gpio_of(net):
    """'IO39' for a net that touches the DevKit, else ''."""
    for r, p in NET2PINS.get(net, []):
        if r == "U2":
            n = ESP_NAME[p]
            return "GPIO" + n.split("IO")[-1] if "IO" in n else ""
    return ""


def net(ref, pin):
    return PIN2NET.get((ref, pin), "—")


def others(netname, skip):
    return ", ".join(f"{r}.{p}" for r, p in NET2PINS.get(netname, []) if r not in skip)


# ---------------------------------------------------------------- canvas helpers
nodes, edges = [], []


def card(id, text, x, y, w, h, color=None):
    n = {"id": id, "type": "text", "text": text, "x": x, "y": y, "width": w, "height": h}
    if color:
        n["color"] = color
    nodes.append(n)


def img(id, file, x, y, w=170, h=125):
    if os.path.exists(os.path.join(REPO, "image", file)):
        nodes.append({"id": id, "type": "file", "file": "image/" + file, "x": x, "y": y, "width": w, "height": h})
    else:
        card(id, f"(ไม่มีรูป {file})", x, y, w, 60)


def group(id, label, x, y, w, h, color):
    nodes.append({"id": id, "type": "group", "label": label, "x": x, "y": y, "width": w, "height": h, "color": color})


def edge(a, b, label=None, fs="right", ts="left", color=None):
    e = {"id": f"e{len(edges)}", "fromNode": a, "fromSide": fs, "toNode": b, "toSide": ts}
    if label:
        e["label"] = label
    if color:
        e["color"] = color
    edges.append(e)


def conn_table(ref, title, pin_desc):
    """Markdown card for a connector: pin | net | what it connects to."""
    rows = [f"### {ref} {title}", "| ขา | Net | ต่อกับ |", "|---|---|---|"]
    for pin, desc in pin_desc:
        n = net(ref, pin)
        g = gpio_of(n)
        rows.append(f"| {pin} | `{n}` | {desc}{' — **' + g + '**' if g else ''} |")
    return "\n".join(rows)


# ---------------------------------------------------------------- legend
card("title", "# Green Oak Control Board — Wiring (Rev A v1.0)\n"
     "สร้างจาก `hardware/kicad/output/GreenOak.net` ด้วย `tools/gen_wiring_canvas.py` — ตรงกับ Schematic/PCB เสมอ\n\n"
     "สี: 🟥 ไฟ 12V/กำลัง · 🟧 5V/3V3 · 🟦 Connector บน PCB · 🟪 อุปกรณ์นอกบอร์ด · 🟩 วงจรบนบอร์ด\n"
     "ลูกศร = ทางเดินไฟ/สัญญาณ, ป้ายบนเส้น = Net หรือ GPIO",
     0, -330, 860, 260)

# ---------------------------------------------------------------- POWER (left)
group("g_pwr", "POWER — 12V → ฟิวส์ → สวิตช์ → +12V / 5V / 3V3", -1300, 0, 1100, 1560, "1")
card("p_psu", "### PSU 12V ≥ 10 A\n(นอกบอร์ด)\nขาเข้า 220V ผ่าน CT ของ PZEM", -1280, 40, 260, 130, "6")
card("p_j1", conn_table("J1", "12V IN (Terminal 5.08)", [("1", "+12V จาก PSU"), ("2", "GND จาก PSU")]),
     -980, 40, 360, 170, "5")
card("p_f1", f"### F1 {VALUE['F1']}\nฟิวส์รวม (คลิป 5×20)\n`+12V_IN` → `12V_FUSED`", -580, 40, 330, 130, "1")
card("p_j2", conn_table("J2", "POWER SWITCH (Terminal, สวิตช์อยู่นอกบอร์ด)",
                        [("1", "ขาเข้าสวิตช์"), ("2", "ขาออกสวิตช์ = ราง +12V")]),
     -980, 260, 420, 190, "5")
card("p_rail", "## ราง +12V\n"
     f"ต่อกับ: {others('+12V', ())}\n\n"
     f"- C1 {VALUE['C1']} กรองไฟ\n- TP1 = จุดวัด +12V",
     -520, 260, 300, 260, "1")
card("p_f2", f"### F2 {VALUE['F2']}\n`+12V` → `+12V_LED`\nเลี้ยง Grow Light อย่างเดียว", -980, 520, 330, 130, "1")
card("p_f3", f"### F3 {VALUE['F3']}\n`+12V` → `+12V_SENSOR`\nกันสาย Sensor ลัดวงจร", -580, 580, 330, 130, "1")
card("p_j3", conn_table("J3", "12V SENSOR (Terminal)", [("1", "+12V ไป PAR / 5-in-1 / QDY30A (สายแดง)"),
                                                        ("2", "GND ของ Sensor ทั้ง 3")]),
     -580, 760, 360, 190, "5")
card("p_buck", f"### U1 {VALUE['U1']}\n| ขา | Net |\n|---|---|\n| IN+ | `{net('U1','1')}` |\n"
     f"| IN− | `{net('U1','2')}` |\n| OUT+ | `{net('U1','3')}` |\n| OUT− | `{net('U1','4')}` |\n"
     f"C2 {VALUE['C2']} + C3 {VALUE['C3']} ที่ +5V",
     -1280, 700, 320, 300, "2")
card("p_5v", "## ราง +5V\n" f"ต่อกับ: {others('+5V', ())}\n\n"
     "ใช้เลี้ยง: W5500, PZEM (ฝั่ง TTL), YF-S401, Relay (ถ้า JP1 = 5V)",
     -1280, 1040, 320, 260, "2")
card("p_d1", f"### D1 {VALUE['D1']}\n`+5V` → `+5V_DEVKIT` → ขา **5V** ของ DevKit\nกันไฟจาก USB ย้อนเข้าราง 5V",
     -900, 1040, 330, 150, "2")
card("p_3v3", "## ราง +3V3 (จาก LDO ของ DevKit)\n" f"ต่อกับ: {others('+3V3', ())}\n\n"
     "ใช้เลี้ยง: RS485 module, SHT40, DS3231, Pull-up YF-S401, Spare",
     -900, 1230, 400, 230, "2")
card("p_tp", "### Test point\nTP1 +12V · TP2 +5V · TP3 +3V3 · TP4 GND\n(มุมล่างซ้ายของบอร์ด)", -480, 1000, 260, 130, "4")

edge("p_psu", "p_j1", "+12V / GND", color="1")
edge("p_j1", "p_f1", "+12V_IN", color="1")
edge("p_f1", "p_j2", "12V_FUSED", "bottom", "top", "1")
edge("p_j2", "p_rail", "+12V", color="1")
edge("p_rail", "p_f2", "+12V", "bottom", "top", "1")
edge("p_rail", "p_f3", "+12V", "bottom", "top", "1")
edge("p_f3", "p_j3", "+12V_SENSOR", "bottom", "top", "1")
edge("p_rail", "p_buck", "+12V", "left", "top", "1")
edge("p_buck", "p_5v", "+5V", "bottom", "top", "2")
edge("p_5v", "p_d1", "+5V", color="2")

# ---------------------------------------------------------------- MCU (center)
rows = ["## U2 ESP32-S3-DevKitC-1 N16R8", "(Clone 2022-V1.3 บน Female header 2×22)", "",
        "| ขา | ชื่อ | Net | ไปที่ |", "|---|---|---|---|"]
for pin in [str(i) for i in range(1, 45)]:
    n = PIN2NET.get(("U2", pin))
    if not n:
        continue
    to = others(n, ("U2",)) if n not in ("GND", "+3V3") else ("ราง GND" if n == "GND" else "ราง +3V3")
    rows.append(f"| {pin} | {ESP_NAME[pin]} | `{n}` | {to} |")
rows += ["", "**ไม่ใช้ (NC):** EN, IO0, IO3, IO45, IO46 (Strapping), IO19/20 (USB), IO35–37 (PSRAM), "
         "IO38/48 (RGB), TX/RX IO43/44 (UART0 Log)"]
card("mcu", "\n".join(rows), 0, 0, 760, 1460, "4")
edge("p_d1", "mcu", "+5V_DEVKIT → ขา 21 (5V)", color="2")
edge("mcu", "p_3v3", "ขา 1, 2 (3V3)", "left", "right", "2")

# ---------------------------------------------------------------- RELAY / FAN / SPARE (top-right)
group("g_rly", "RELAY 4CH / พัดลม / Spare", 900, -1250, 1500, 820, "3")
card("rly", conn_table("J9", "RELAY 4CH (XH 6 ขา → Header ของโมดูล Relay)", [
    ("1", "GND"), ("2", "IN1 → Ch1 Lamp RED (Pull-down R11 10k)"),
    ("3", "IN2 → Ch2 Lamp GREEN (Pull-down R12)"), ("4", "IN3 → Ch3 Air Pump M105 **ขา NC** (R13)"),
    ("5", "IN4 → Ch4 Humidifier M101 ขา NO (R14)"), ("6", "VCC ของโมดูล (เลือกด้วย JP1)")]),
    920, -1210, 620, 330, "5")
card("jp1", f"### JP1 Solder jumper\n{VALUE['JP1']}\n1 = +5V · 2 = `RELAY_VCC` · 3 = +3V3\n**ค่าเริ่ม: บัดกรี 1-2 (5V)**",
     920, -850, 360, 170, "2")
card("rly_dev", "### โมดูล Relay 4CH (นอกบอร์ด, Active-HIGH / Jumper H)\n"
     "| Ch | หน้าสัมผัส | โหลด |\n|---|---|---|\n| 1 | NO | Lamp RED |\n| 2 | NO | Lamp GREEN |\n"
     "| 3 | **NC** | Air Pump 220V (ไม่มีไฟ = ทำงาน) |\n| 4 | NO | Humidifier 5V (USB) |\n\n⚠ 220V อยู่ที่โมดูล Relay เท่านั้น ไม่ผ่าน PCB",
     1600, -1210, 460, 330, "6")
img("i_air", "air pump oxygen.png", 2100, -1210)
img("i_hum", "Humidifier.png", 2100, -1060)
card("fan", conn_table("J10", "FAN → L298N (XH 2 ขา)", [("1", "ENA (PWM D201, Pull-down R15)"), ("2", "GND ร่วม L298N")]) +
     "\n\nบน L298N: IN1 → +5V ของ L298N, IN2 → GND (สายจั๊ม) · พัดลม 12V ต่อ OUT1/OUT2",
     1320, -850, 520, 260, "5")
card("spare", conn_table("J11", "SPARE (XH 4 ขา)", [("1", "+3V3"), ("2", "GND"), ("3", "ว่าง"), ("4", "ว่าง")]),
     1880, -850, 500, 230, "5")
edge("mcu", "rly", "GPIO39/40/41/21", "top", "bottom")
edge("jp1", "rly", "RELAY_VCC", "top", "bottom", "2")
edge("rly", "rly_dev", "สาย 6 เส้นตรง")
edge("mcu", "fan", "GPIO42 PWM", "top", "bottom")
edge("mcu", "spare", "GPIO14 / GPIO47", "top", "bottom")

# ---------------------------------------------------------------- COMMS / SENSORS (right)
group("g_com", "COMMS + SENSORS (XH 2.50 mm บนขอบขวาของบอร์ด)", 900, -380, 1500, 1920, "5")
y = -340
items = [
    ("w5500", conn_table("J12", "W5500 Ethernet (XH 6)", [("1", "VCC 5V"), ("2", "GND"), ("3", "MISO"), ("4", "MOSI"),
                                                           ("5", "SCLK"), ("6", "CS")]) +
     "\n\nRJ45 → Switch → FX5U (Modbus TCP)", None, "SPI: GPIO10–13", 300),
    ("rs485", conn_table("J13", "RS485 module (XH 4, **เลี้ยง 3V3**)", [("1", "VCC 3V3"), ("2", "TXD ของโมดูล → ESP RX"),
                                                                       ("3", "RXD ของโมดูล ← ESP TX"), ("4", "GND")]) +
     "\n\nบัส A/B ที่ขั้วสกรูของโมดูล: 5-in-1 (addr 1), PAR (addr 2), QDY30A (addr 3)\nไฟ 12V ของ Sensor มาจาก **J3**",
     ["TTL to RS485.png", "Par_sensor.png", "PH, EC, Temperature, Salinity, TDS 5-in-1.png", "QDY30A Water level sensor.png"],
     "UART1: GPIO17 TX / GPIO18 RX", 330),
    ("pzem", conn_table("J14", "PZEM-004T (XH 4)", [("1", "5V"), ("2", "RX ของ PZEM ← ESP TX"), ("3", "TX ของ PZEM (5V)"),
                                                    ("4", "GND")]) +
     f"\n\nTX 5V → R16 {VALUE['R16']} → `UART2_RX` → R17 {VALUE['R17']} ลง GND ≈ 3.0V",
     ["PZEM-004T-100A-D-P AC.png"], "UART2: GPIO15 TX / GPIO16 RX", 300),
    ("flow", conn_table("J15", "YF-S401 Flow (XH 3)", [("1", "5V (แดง)"), ("2", "GND (ดำ)"), ("3", "PULSE Open-drain (เหลือง)")]) +
     f"\n\n`FLOW_SIG` → R18 {VALUE['R18']} → `FLOW` + R19 {VALUE['R19']} Pull-up 3V3 + C4 {VALUE['C4']}",
     ["YF-S401.png"], "GPIO7 (Interrupt)", 280),
    ("sht", conn_table("J16", "SHT40 (XH 4)", [("1", "GND"), ("2", "3V3"), ("3", "SDA"), ("4", "SCL")]),
     ["Aideepen SHT40.png"], "I2C: GPIO8 SDA / GPIO9 SCL", 220),
    ("rtc", conn_table("J17", "DS3231 ZS-042 (XH 4, มุมล่างซ้ายบอร์ด)", [("1", "GND"), ("2", "3V3"), ("3", "SDA"), ("4", "SCL")]) +
     "\n\nR20/R21 4.7k Pull-up = **DNP** (บอร์ดโมดูลมีแล้ว)",
     ["DS3231.png"], "I2C ร่วมกับ SHT40", 250),
]
for id, text, imgs, lab, h in items:
    card(id, text, 920, y, 640, h, "5")
    for k, f in enumerate(imgs or []):
        img(f"{id}_i{k}", f, 1600 + 190 * k, y + 10)
    edge("mcu", id, lab)
    y += h + 30
edge("p_j3", "rs485_i1", "+12V_SENSOR (ไฟเลี้ยง Sensor)", "bottom", "bottom", "1")

# ---------------------------------------------------------------- OUTPUTS (bottom)
group("g_out", "OUTPUTS 12V — AOD4184A Low-side (Terminal ขอบล่าง: ขา 1 = +, ขา 2 = −)", 0, 1600, 2400, 900, "1")
CH = [  # (Q, J, Rg, Rpd, D, name, address, image)
    ("Q1", "J4", "R1", "R2", None, "Grow Light COB 50W", "D200 (PWM)", "50W LED Light Grow 12VDC.png"),
    ("Q2", "J5", "R3", "R4", "D2", "ปั๊มปุ๋ย A", "M103", "Peristaltic pump.png"),
    ("Q3", "J6", "R5", "R6", "D3", "ปั๊มปุ๋ย B", "M104", "Peristaltic pump.png"),
    ("Q4", "J7", "R7", "R8", "D4", "ปั๊ม pH Down", "M106", "Peristaltic pump.png"),
    ("Q5", "J8", "R9", "R10", "D5", "ปั๊มเติมน้ำ", "M102", "Diaphragm pump.png"),
]
for i, (q, j, rg, rpd, d, name, addr, picture) in enumerate(CH):
    x = 20 + 475 * i
    gpio_net = net(rg, "1")
    txt = [f"### {name} — {addr}", f"**{gpio_of(gpio_net)}** `{gpio_net}`", "",
           f"1. {rg} {VALUE[rg]}: `{gpio_net}` → `{net(rg, '2')}` (Gate)",
           f"2. {rpd} {VALUE[rpd]}: `{gpio_net}` → GND (Pull-down ตอน Boot)",
           f"3. {q} AOD4184A: G=`{net(q, '1')}` · D=`{net(q, '2')}` · S=`{net(q, '3')}`"]
    if d:
        txt.append(f"4. {d} SS34 Flyback: A=`{net(d, '2')}` · K=`{net(d, '1')}`")
    txt += ["", f"**{j}** ขา 1 = `{net(j, '1')}` (+ โหลด) · ขา 2 = `{net(j, '2')}` (− โหลด)"]
    card(f"ch{i}", "\n".join(txt), x, 1640, 455, 400, "1" if i == 0 else "4")
    img(f"ch{i}_img", picture, x + 140, 2080, 175, 130)
    edge(f"ch{i}", f"ch{i}_img", j, "bottom", "top", "1")
    edge("mcu", f"ch{i}", gpio_of(gpio_net), "bottom", "top")
edge("p_f2", "ch0", "+12V_LED (2.0 mm)", "bottom", "left", "1")
edge("p_rail", "ch1", "+12V → ขา 1 ของ J5–J8", "bottom", "left", "1")

card("gnd", "## GND\nเทเต็มทั้งสองชั้น + Stitching via\nทุก Connector มีขา GND ร่วมกัน\n"
     f"(ทั้งหมด {len(NET2PINS['GND'])} ขา)", -1300, 1640, 400, 170, "4")

out = os.path.join(REPO, "hardware", "GreenOak_Wiring_RevA.canvas")
json.dump({"nodes": [n for n in nodes if n], "edges": edges}, open(out, "w", encoding="utf-8"),
          ensure_ascii=False, indent="\t")
print("wrote", out, len(nodes), "nodes", len(edges), "edges")
