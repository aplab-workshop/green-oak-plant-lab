"""Generate GreenOak.kicad_sch (Rev A) from a net table.

Every pin is connected with a local net label placed on the pin end (no wires),
unused pins get a no-connect marker. Re-run this script to rebuild the
schematic after changing the tables below; do not hand-edit the generated file
if you plan to regenerate it.

Usage:  python hardware/kicad/tools/gen_schematic.py
"""
from __future__ import annotations

import json
import os
import re
import uuid

KICAD = r"C:\Users\Chanatip\AppData\Local\Programs\KiCad\10.0\share\kicad"
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ_DIR = os.path.dirname(HERE)
PROJECT = "GreenOak"
NS = uuid.UUID("6f1d3c2e-7a55-4b0e-9a1c-0e5b3d1a9c42")


def uid(*parts) -> str:
    return str(uuid.uuid5(NS, "/".join(str(p) for p in parts)))


ROOT_UUID = uid("root")

# ---------------------------------------------------------------- s-expr utils

def find_block(text: str, start: int) -> str:
    """Return the balanced (...) block that starts at text[start] == '('."""
    depth, i, in_str = 0, start, False
    while i < len(text):
        c = text[i]
        if in_str:
            if c == "\\":
                i += 1
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
        i += 1
    raise ValueError("unbalanced")


def tokenize(s: str):
    return re.findall(r'"(?:\\.|[^"\\])*"|\(|\)|[^\s()"]+', s)


def parse(tokens):
    stack = [[]]
    for t in tokens:
        if t == "(":
            stack.append([])
        elif t == ")":
            done = stack.pop()
            stack[-1].append(done)
        else:
            stack[-1].append(t.strip('"') if t.startswith('"') else t)
    return stack[0][0]


def walk(node):
    yield node
    for c in node:
        if isinstance(c, list):
            yield from walk(c)


def pins_of(block: str):
    """{number: (x, y, rot, name)} — x/y in symbol coords (y up)."""
    tree = parse(tokenize(block))
    pins = {}
    for n in walk(tree):
        if n and n[0] == "pin" and isinstance(n[1], str):
            at = next(c for c in n if isinstance(c, list) and c[0] == "at")
            num = next(c for c in n if isinstance(c, list) and c[0] == "number")[1]
            name = next(c for c in n if isinstance(c, list) and c[0] == "name")[1]
            pins.setdefault(num, (float(at[1]), float(at[2]), int(float(at[3])), name))
    return pins


LIB_CACHE: dict[str, str] = {}


def lib_symbol(lib_id: str) -> str:
    if lib_id in LIB_CACHE:
        return LIB_CACHE[lib_id]
    lib, name = lib_id.split(":")
    if lib == PROJECT:
        text = open(os.path.join(PROJ_DIR, f"{PROJECT}.kicad_sym"), encoding="utf-8").read()
    else:
        text = open(os.path.join(KICAD, "symbols", f"{lib}.kicad_sym"), encoding="utf-8").read()
    m = re.search(r'\(symbol "%s"\s' % re.escape(name), text)
    if not m:
        raise KeyError(lib_id)
    blk = find_block(text, m.start())
    if "(extends" in blk[:400]:
        raise ValueError(f"{lib_id} extends another symbol; not supported")
    blk = blk.replace(f'(symbol "{name}"', f'(symbol "{lib_id}"', 1)
    LIB_CACHE[lib_id] = blk
    return blk


# ---------------------------------------------------------------- custom library

DEVKIT_LEFT = ["3V3", "3V3", "EN", "IO4", "IO5", "IO6", "IO7", "IO15", "IO16", "IO17", "IO18",
               "IO8", "IO3", "IO46", "IO9", "IO10", "IO11", "IO12", "IO13", "IO14", "5V", "GND"]
DEVKIT_RIGHT = ["GND", "TX/IO43", "RX/IO44", "IO1", "IO2", "IO42", "IO41", "IO40", "IO39", "IO38",
                "IO37", "IO36", "IO35", "IO0", "IO45", "IO48", "IO47", "IO21", "IO20", "IO19", "GND", "GND"]


def pin_sexpr(ptype, x, y, rot, name, num, length=3.81):
    return (f'\t\t\t(pin {ptype} line (at {x} {y} {rot}) (length {length})\n'
            f'\t\t\t\t(name "{name}" (effects (font (size 1.27 1.27))))\n'
            f'\t\t\t\t(number "{num}" (effects (font (size 1.27 1.27))))\n\t\t\t)\n')


def custom_symbol(name, ref, value, descr, fp, body, pins):
    out = [f'\t(symbol "{name}"\n\t\t(pin_names (offset 1.016))\n\t\t(exclude_from_sim no)\n'
           f'\t\t(in_bom yes)\n\t\t(on_board yes)\n']
    (x0, y0, x1, y1) = body
    for i, (k, v, hide) in enumerate([("Reference", ref, False), ("Value", value, False),
                                      ("Footprint", fp, True), ("Datasheet", "", True),
                                      ("Description", descr, True)]):
        yy = y0 + 2.54 if k == "Reference" else (y1 - 2.54 if k == "Value" else 0)
        out.append(f'\t\t(property "{k}" "{v}" (at 0 {yy:.2f} 0)'
                   + (" (hide yes)" if hide else "") +
                   ' (effects (font (size 1.27 1.27))))\n')
    out.append(f'\t\t(symbol "{name}_0_1"\n\t\t\t(rectangle (start {x0} {y0}) (end {x1} {y1})'
               ' (stroke (width 0.254) (type default)) (fill (type background)))\n\t\t)\n')
    out.append(f'\t\t(symbol "{name}_1_1"\n')
    out += [pin_sexpr(*p) for p in pins]
    out.append("\t\t)\n\t)\n")
    return "".join(out)


def write_custom_lib():
    pins = []
    for i, n in enumerate(DEVKIT_LEFT):
        t = "bidirectional" if n.startswith("IO") else "passive"
        pins.append((t, -15.24, 26.67 - i * 2.54, 0, n, str(i + 1)))
    for i, n in enumerate(DEVKIT_RIGHT):
        t = "bidirectional" if "IO" in n else "passive"
        pins.append((t, 15.24, 26.67 - i * 2.54, 180, n, str(23 + i)))
    devkit = custom_symbol(
        "ESP32-S3-DevKitC-1", "U", "ESP32-S3-DevKitC-1 N16R8",
        "ESP32-S3-DevKitC-1 (clone 2022-V1.3) on 2x22 female headers; pins 1-22 = J1 (left), 23-44 = J3 (right)",
        f"{PROJECT}:ESP32-S3-DevKitC-1_Socket", (-11.43, 29.21, 11.43, -29.21), pins)
    buck = custom_symbol(
        "CR-DC2580", "U", "CR-DC2580 12V->5V",
        "Mini DC-DC step-down buck module (IN 6-25V, OUT 5V)",
        f"{PROJECT}:CR-DC2580", (-7.62, 5.08, 7.62, -5.08),
        [("passive", -11.43, 2.54, 0, "IN+", "1"), ("passive", -11.43, -2.54, 0, "IN-", "2"),
         ("passive", 11.43, 2.54, 180, "OUT+", "3"), ("passive", 11.43, -2.54, 180, "OUT-", "4")])
    lib = ("(kicad_symbol_lib\n\t(version 20241209)\n\t(generator \"gen_schematic.py\")\n"
           + devkit + buck + ")\n")
    open(os.path.join(PROJ_DIR, f"{PROJECT}.kicad_sym"), "w", encoding="utf-8", newline="\n").write(lib)


# ---------------------------------------------------------------- design tables

FP = {
    "R": "Resistor_SMD:R_0805_2012Metric",
    "C": "Capacitor_SMD:C_0805_2012Metric",
    "TB2": "TerminalBlock_Phoenix:TerminalBlock_Phoenix_MKDS-1,5-2-5.08_1x02_P5.08mm_Horizontal",
    "XH": "Connector_JST:JST_XH_B{n}B-XH-A_1x0{n}_P2.50mm_Vertical",
    "SS34": "Diode_SMD:D_SMA",
    "FUSE": "Fuse:Fuseholder_Blade_Mini_Keystone_3568",
    "TP": "TestPoint:TestPoint_THTPad_D2.0mm_Drill1.0mm",
    "MOS": "Package_TO_SOT_SMD:TO-252-2",
}

parts: list[dict] = []   # filled below
notes: list[tuple] = []  # (text, x, y, size)
_refcount: dict[str, int] = {}


def add(prefix, lib_id, value, fp, x, y, nets, dnp=False, extra=None, pos=None):
    _refcount[prefix] = _refcount.get(prefix, 0) + 1
    ref = f"{prefix}{_refcount[prefix]}"
    parts.append(dict(ref=ref, lib_id=lib_id, value=value, fp=fp, x=x, y=y,
                      nets=nets, dnp=dnp, extra=extra or {}, pos=pos))
    return ref


def R(value, x, y, n1, n2, dnp=False):
    return add("R", "Device:R", value, FP["R"], x, y, {"1": n1, "2": n2}, dnp)


def C(value, x, y, n1, n2, fp=None, polar=False):
    return add("C", "Device:C_Polarized" if polar else "Device:C", value, fp or FP["C"], x, y,
               {"1": n1, "2": n2})


def XH(n, value, x, y, nets):
    return add("J", f"Connector_Generic:Conn_01x{n:02d}", value, FP["XH"].format(n=n), x, y,
               {str(i + 1): net for i, net in enumerate(nets)})


def TB2(value, x, y, n1, n2):
    return add("J", "Connector:Screw_Terminal_01x02", value, FP["TB2"], x, y, {"1": n1, "2": n2})


def SS34(x, y, anode, cathode):
    # Device:D_Schottky: pin 1 = K, pin 2 = A
    return add("D", "Device:D_Schottky", "SS34", FP["SS34"], x, y, {"1": cathode, "2": anode},
               extra={"MPN": "SS34"}, pos=((-3, 3.5), (-3, 5)))


G = 2.54  # grid


def g(n):
    return round(n * G, 2)


# ---- Power ------------------------------------------------------------------
# A3 sheet = 165 x 117 grid units of 2.54 mm; title block covers x > 99, y > 104.
notes.append(("POWER", g(4), g(4), 2))
notes.append(("12V IN -> F1 main fuse -> POWER SWITCH (off-board) -> +12V rail", g(4), g(6), 1.27))
TB2("12V IN", g(6), g(12), "+12V_IN", "GND")
add("F", "Device:Fuse", "10A Mini Blade", FP["FUSE"], g(18), g(10), {"1": "+12V_IN", "2": "12V_FUSED"})
TB2("POWER SWITCH", g(30), g(12), "12V_FUSED", "+12V")
C("470uF/25V", g(46), g(12), "+12V", "GND", fp="Capacitor_THT:CP_Radial_D10.0mm_P5.00mm", polar=True)
add("U", f"{PROJECT}:CR-DC2580", "CR-DC2580 12V->5V", f"{PROJECT}:CR-DC2580", g(12), g(26),
    {"1": "+12V", "2": "GND", "3": "+5V", "4": "GND"}, pos=((-7.6, -7.6), (-7.6, 7.6)))
C("100uF/16V", g(28), g(26), "+5V", "GND", fp="Capacitor_THT:CP_Radial_D6.3mm_P2.50mm", polar=True)
C("100nF", g(36), g(26), "+5V", "GND")
SS34(g(48), g(26), "+5V", "+5V_DEVKIT")  # R6: block USB back-feed into the 5V rail
notes.append(("D1 blocks USB back-feed into +5V (R6)", g(42), g(22), 1.27))
add("F", "Device:Fuse", "5A Mini Blade", FP["FUSE"], g(10), g(40), {"1": "+12V", "2": "+12V_LED"})
add("F", "Device:Polyfuse", "0.5A PTC 1812", "Fuse:Fuse_1812_4532Metric", g(24), g(40),
    {"1": "+12V", "2": "+12V_SENSOR"})
TB2("12V SENSOR", g(36), g(40), "+12V_SENSOR", "GND")
notes.append(("12V SENSOR -> PAR, 5-in-1, QDY30A (A/B go to the RS485 module)", g(30), g(46), 1.27))
for i, net in enumerate(["+12V", "+5V", "+3V3", "GND"]):
    add("TP", "Connector:TestPoint", net, FP["TP"], g(6 + 8 * i), g(56), {"1": net})
for i, net in enumerate(["+12V", "+5V", "+3V3", "GND"]):
    add("#FLG", "power:PWR_FLAG", "PWR_FLAG", "", g(6 + 8 * i), g(64), {"1": net})

# ---- MCU --------------------------------------------------------------------
DEVKIT_NETS = {
    1: "+3V3", 2: "+3V3", 3: None, 4: "LIGHT_PWM", 5: "PUMP_A", 6: "PUMP_B", 7: "FLOW",
    8: "UART2_TX", 9: "UART2_RX", 10: "UART1_TX", 11: "UART1_RX", 12: "I2C_SDA", 13: None,
    14: None, 15: "I2C_SCL", 16: "W5500_CS", 17: "W5500_MOSI", 18: "W5500_SCLK",
    19: "W5500_MISO", 20: "SPARE_IO14", 21: "+5V_DEVKIT", 22: "GND",
    23: "GND", 24: None, 25: None, 26: "PH_DOWN", 27: "REFILL", 28: "FAN_PWM", 29: "RLY3_AIR",
    30: "RLY2_GREEN", 31: "RLY1_RED", 32: None, 33: None, 34: None, 35: None, 36: None,
    37: None, 38: None, 39: "SPARE_IO47", 40: "RLY4_HUM", 41: None, 42: None, 43: "GND", 44: "GND",
}
notes.append(("MCU", g(70), g(4), 2))
notes.append(("ESP32-S3-DevKitC-1 N16R8 (clone 2022-V1.3) on 2x22 female headers", g(70), g(6), 1.27))
notes.append(("NC: strapping 0/3/45/46, USB 19/20, PSRAM 35-37, RGB 38/48, UART0 43/44",
              g(70), g(58), 1.27))
add("U", f"{PROJECT}:ESP32-S3-DevKitC-1", "ESP32-S3-DevKitC-1 N16R8",
    f"{PROJECT}:ESP32-S3-DevKitC-1_Socket", g(86), g(32), {str(k): v for k, v in DEVKIT_NETS.items()},
    pos=((-11.4, -31.8), (-11.4, -30.2)))

# ---- MOSFET low-side outputs -----------------------------------------------
notes.append(("OUTPUTS 12V", g(4), g(71), 2))
notes.append(("AOD4184A low-side, gate 100R, 10k pull-down at the GPIO, SS34 flyback on pumps; "
              "terminal pin 1 = +12V, pin 2 = load -", g(4), g(73), 1.27))
channels = [  # (name, gpio net, supply, flyback, terminal label)
    ("LIGHT", "LIGHT_PWM", "+12V_LED", False, "GROW LIGHT (D200)"),
    ("PUMPA", "PUMP_A", "+12V", True, "PUMP A (M103)"),
    ("PUMPB", "PUMP_B", "+12V", True, "PUMP B (M104)"),
    ("PHDOWN", "PH_DOWN", "+12V", True, "PH DOWN (M106)"),
    ("REFILL", "REFILL", "+12V", True, "REFILL (M102)"),
]
for i, (name, gpio, supply, flyback, label) in enumerate(channels):
    x0 = g(6 + 23 * i)
    y0 = g(78)
    gate = f"{name}_G"
    drain = f"{name}_D"
    R("100R", x0, y0, gpio, gate)
    R("10k", x0 + g(4), y0 + g(8), gpio, "GND")
    add("Q", "Transistor_FET:Q_NMOS_GDS", "AOD4184A", FP["MOS"], x0 + g(12), y0 + g(3),
        {"1": gate, "2": drain, "3": "GND"}, extra={"MPN": "AOD4184A"})
    TB2(label, x0 + g(12), y0 + g(16), supply, drain)
    if flyback:
        SS34(x0 + g(16), y0 + g(11), drain, supply)

# ---- Relay / fan / spare ----------------------------------------------------
notes.append(("RELAY / FAN / SPARE", g(4), g(99), 2))
notes.append(("Relay 4CH off-board, Active-HIGH (jumper H); Ch3 AIR PUMP on NC. "
              "Fan: IN1=5V, IN2=GND wired on the L298N", g(4), g(101), 1.27))
add("JP", "Jumper:SolderJumper_3_Bridged12", "RELAY VCC 1-2=5V 2-3=3V3",
    "Jumper:SolderJumper-3_P1.3mm_Bridged12_Pad1.0x1.5mm", g(8), g(104),
    {"1": "+5V", "2": "RELAY_VCC", "3": "+3V3"}, pos=((-6, 4), (-6, 5.5)))
XH(6, "RELAY 4CH", g(24), g(106),
   ["RELAY_VCC", "GND", "RLY1_RED", "RLY2_GREEN", "RLY3_AIR", "RLY4_HUM"])
for i, net in enumerate(["RLY1_RED", "RLY2_GREEN", "RLY3_AIR", "RLY4_HUM"]):
    R("10k", g(38 + 6 * i), g(106), net, "GND")
XH(2, "FAN L298N ENA", g(68), g(106), ["FAN_PWM", "GND"])
R("10k", g(78), g(106), "FAN_PWM", "GND")
XH(4, "SPARE IO", g(90), g(106), ["+3V3", "GND", "SPARE_IO14", "SPARE_IO47"])

# ---- Communication / sensors ------------------------------------------------
notes.append(("COMMS + SENSORS (XH 2.50 mm)", g(122), g(4), 2))
notes.append(("pin 1 first: W5500 5V GND MISO MOSI SCLK CS / RS485 3V3 TXD RXD GND / PZEM 5V RX TX GND",
              g(122), g(6), 1.27))
notes.append(("YF-S401 5V GND PULSE / SHT40 + DS3231: 3V3 GND SDA SCL", g(122), g(8), 1.27))
XH(6, "W5500", g(128), g(16), ["+5V", "GND", "W5500_MISO", "W5500_MOSI", "W5500_SCLK", "W5500_CS"])
XH(4, "RS485 MODULE (3V3!)", g(128), g(30), ["+3V3", "UART1_RX", "UART1_TX", "GND"])
XH(4, "PZEM-004T", g(128), g(42), ["+5V", "UART2_TX", "PZEM_TX_5V", "GND"])
R("2.2k", g(146), g(42), "PZEM_TX_5V", "UART2_RX")
R("3.3k", g(152), g(42), "UART2_RX", "GND")
notes.append(("PZEM TX 5V -> 2.2k/3.3k -> 3.0V", g(140), g(36), 1.27))
XH(3, "YF-S401", g(128), g(56), ["+5V", "GND", "FLOW_5V"])
R("10k", g(146), g(56), "FLOW_5V", "FLOW")
R("20k", g(152), g(56), "FLOW", "GND")
C("1nF", g(158), g(56), "FLOW", "GND")
notes.append(("Pulse 5V -> 10k/20k + 1nF", g(140), g(50), 1.27))
XH(4, "SHT40", g(128), g(70), ["+3V3", "GND", "I2C_SDA", "I2C_SCL"])
XH(4, "DS3231 ZS-042", g(128), g(82), ["+3V3", "GND", "I2C_SDA", "I2C_SCL"])
R("4.7k", g(146), g(72), "+3V3", "I2C_SDA", dnp=True)
R("4.7k", g(152), g(72), "+3V3", "I2C_SCL", dnp=True)
notes.append(("I2C pull-ups DNP (boards have their own)", g(140), g(66), 1.27))

# ---------------------------------------------------------------- emit

def prop(k, v, x, y, hide=False):
    return (f'\t\t(property "{k}" "{v}"\n\t\t\t(at {x:.2f} {y:.2f} 0)\n'
            + ("\t\t\t(hide yes)\n" if hide else "")
            + '\t\t\t(effects\n\t\t\t\t(font\n\t\t\t\t\t(size 1.27 1.27)\n\t\t\t\t)\n'
            + ("\t\t\t\t(justify left)\n" if not hide else "")
            + '\t\t\t)\n\t\t)\n')


def label(net, x, y, pin_rot, key):
    # pin_rot: direction the pin points from its connection end (lib coords)
    ang, just = {0: (180, "right bottom"), 180: (0, "left bottom"),
                 90: (270, "right bottom"), 270: (90, "left bottom")}[pin_rot]
    return (f'\t(label "{net}"\n\t\t(at {x:.2f} {y:.2f} {ang})\n\t\t(effects\n\t\t\t(font\n'
            f'\t\t\t\t(size 1.27 1.27)\n\t\t\t)\n\t\t\t(justify {just})\n\t\t)\n'
            f'\t\t(uuid "{uid("label", key)}")\n\t)\n')


def main():
    write_custom_lib()
    used = sorted({p["lib_id"] for p in parts})
    body = []
    for p in parts:
        blk = lib_symbol(p["lib_id"])
        pins = pins_of(blk)
        missing = set(p["nets"]) - set(pins)
        if missing:
            raise KeyError(f"{p['ref']}: no pins {missing} in {p['lib_id']}")
        is_power = p["lib_id"].startswith("power:")
        s = [f'\t(symbol\n\t\t(lib_id "{p["lib_id"]}")\n\t\t(at {p["x"]:.2f} {p["y"]:.2f} 0)\n'
             f'\t\t(unit 1)\n\t\t(exclude_from_sim no)\n\t\t(in_bom {"no" if is_power else "yes"})\n'
             f'\t\t(on_board {"no" if is_power else "yes"})\n\t\t(dnp {"yes" if p["dnp"] else "no"})\n'
             f'\t\t(uuid "{uid("sym", p["ref"])}")\n']
        (rx, ry), (vx, vy) = p["pos"] or ((3.81, -1.27), (3.81, 1.27))
        s.append(prop("Reference", p["ref"], p["x"] + rx, p["y"] + ry, hide=is_power))
        s.append(prop("Value", p["value"], p["x"] + vx, p["y"] + vy, hide=is_power))
        s.append(prop("Footprint", p["fp"], p["x"], p["y"], hide=True))
        s.append(prop("Datasheet", "", p["x"], p["y"], hide=True))
        for k, v in p["extra"].items():
            s.append(prop(k, v, p["x"], p["y"], hide=True))
        for num in sorted(pins, key=lambda n: (len(n), n)):
            s.append(f'\t\t(pin "{num}"\n\t\t\t(uuid "{uid("pin", p["ref"], num)}")\n\t\t)\n')
        s.append(f'\t\t(instances\n\t\t\t(project "{PROJECT}"\n\t\t\t\t(path "/{ROOT_UUID}"\n'
                 f'\t\t\t\t\t(reference "{p["ref"]}")\n\t\t\t\t\t(unit 1)\n\t\t\t\t)\n\t\t\t)\n\t\t)\n\t)\n')
        body.append("".join(s))
        for num, (px, py, prot, _name) in pins.items():
            X, Y = p["x"] + px, p["y"] - py
            if num not in p["nets"] or p["nets"][num] is None:
                body.append(f'\t(no_connect\n\t\t(at {X:.2f} {Y:.2f})\n'
                            f'\t\t(uuid "{uid("nc", p["ref"], num)}")\n\t)\n')
            else:
                body.append(label(p["nets"][num], X, Y, prot, f'{p["ref"]}.{num}'))
    for i, (t, x, y, size) in enumerate(notes):
        body.append(f'\t(text "{t}"\n\t\t(exclude_from_sim no)\n\t\t(at {x:.2f} {y:.2f} 0)\n'
                    f'\t\t(effects\n\t\t\t(font\n\t\t\t\t(size {size} {size})\n\t\t\t)\n'
                    f'\t\t\t(justify left bottom)\n\t\t)\n\t\t(uuid "{uid("text", i)}")\n\t)\n')

    head = (f'(kicad_sch\n\t(version 20260101)\n\t(generator "eeschema")\n\t(generator_version "10.0")\n'
            f'\t(uuid "{ROOT_UUID}")\n\t(paper "A3")\n'
            f'\t(title_block\n\t\t(title "Green Oak Control Board")\n\t\t(rev "A")\n'
            f'\t\t(comment 1 "ESP32-S3 + W5500 Modbus TCP master -> FX5U (docs/HARDWARE.md)")\n'
            f'\t\t(comment 2 "Generated by hardware/kicad/tools/gen_schematic.py")\n\t)\n'
            '\t(lib_symbols\n')
    libs = "".join("\t\t" + lib_symbol(l).replace("\n", "\n\t") + "\n" for l in used)
    tail = '\t(sheet_instances\n\t\t(path "/"\n\t\t\t(page "1")\n\t\t)\n\t)\n)\n'
    out = head + libs + "\t)\n" + "".join(body) + tail
    path = os.path.join(PROJ_DIR, f"{PROJECT}.kicad_sch")
    open(path, "w", encoding="utf-8", newline="\n").write(out)

    nets = {}
    for p in parts:
        for num, net in p["nets"].items():
            if net:
                nets.setdefault(net, []).append(f'{p["ref"]}.{num}')
    single = {n: v for n, v in nets.items() if len(v) < 2}
    json.dump({"parts": len(parts), "nets": len(nets), "single_pin_nets": single},
              open(os.path.join(PROJ_DIR, "output", "gen_report.json"), "w"), indent=1)
    print(f"wrote {path}: {len(parts)} parts, {len(nets)} nets, single-pin nets: {list(single)}")


if __name__ == "__main__":
    os.makedirs(os.path.join(PROJ_DIR, "output"), exist_ok=True)
    main()
