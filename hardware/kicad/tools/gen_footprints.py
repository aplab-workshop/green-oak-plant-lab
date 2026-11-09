"""Generate GreenOak.pretty footprints for the plug-in modules (measured by the user 2026-11-10).

Usage:  python hardware/kicad/tools/gen_footprints.py
"""
import os
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(os.path.dirname(HERE), "GreenOak.pretty")
NS = uuid.UUID("0b8f2a51-3d7e-4c1a-8e2f-5a9d6c3b7e10")


def uid(*p):
    return str(uuid.uuid5(NS, "/".join(map(str, p))))


def line(layer, x1, y1, x2, y2, w, key):
    return (f'\t(fp_line (start {x1} {y1}) (end {x2} {y2}) (stroke (width {w}) (type solid)) '
            f'(layer "{layer}") (uuid "{uid(key)}"))\n')


def rect(layer, x1, y1, x2, y2, w, key):
    return "".join(line(layer, *seg, w, f"{key}{i}") for i, seg in enumerate(
        [(x1, y1, x2, y1), (x2, y1, x2, y2), (x2, y2, x1, y2), (x1, y2, x1, y1)]))


def text(kind, value, x, y, layer, key, hide=False):
    return (f'\t(property "{kind}" "{value}" (at {x} {y} 0) (layer "{layer}")'
            + (" (hide yes)" if hide else "")
            + f' (uuid "{uid(key)}") (effects (font (size 1 1) (thickness 0.15))))\n')


def fp_text(value, x, y, layer, key, size=1.0):
    return (f'\t(fp_text user "{value}" (at {x} {y} 0) (layer "{layer}") (uuid "{uid(key)}") '
            f'(effects (font (size {size} {size}) (thickness 0.15))))\n')


def pad(num, x, y, size, drill, square=False):
    shape = "rect" if square else "circle"
    return (f'\t(pad "{num}" thru_hole {shape} (at {x} {y}) (size {size} {size}) (drill {drill}) '
            f'(layers "*.Cu" "*.Mask") (remove_unused_layers no) (uuid "{uid("pad", num, x, y)}"))\n')


def write(name, descr, body):
    s = (f'(footprint "{name}"\n\t(version 20241229)\n\t(generator "gen_footprints.py")\n'
         f'\t(layer "F.Cu")\n\t(descr "{descr}")\n\t(attr through_hole)\n' + body + ")\n")
    open(os.path.join(LIB, f"{name}.kicad_mod"), "w", encoding="utf-8", newline="\n").write(s)


def devkit():
    # Clone ESP32-S3-DevKitC-1 N16R8 "2022-V1.3": 2 x 22 pins, pitch 2.54, rows 25.4 mm apart,
    # board width 28.0 mm. Pin 1 (3V3) at the antenna end; USB-C at the far end.
    # Board length is NOT measured yet -> 69 mm outline is an estimate (F.Fab / courtyard).
    p, row, n = 2.54, 25.4, 22
    b = text("Reference", "U**", row / 2, -9.5, "F.SilkS", "ref")
    b += text("Value", "ESP32-S3-DevKitC-1_Socket", row / 2, 50, "F.Fab", "val")
    b += text("Footprint", "", 0, 0, "F.Fab", "fp", hide=True)
    x0, x1 = row / 2 - 14.0, row / 2 + 14.0          # 28 mm wide board
    y0, y1 = -8.0, -8.0 + 69.0                      # estimate: 8 mm antenna overhang above pin 1
    b += rect("F.Fab", x0, y0, x1, y1, 0.1, "fab")
    # courtyard only around the two female header rows: low SMD parts may sit under the module
    for k, xc in (("crtL", 0), ("crtR", row)):
        b += rect("F.CrtYd", xc - 1.6, -1.6, xc + 1.6, (n - 1) * p + 1.6, 0.05, k)
    b += rect("F.SilkS", -1.6, -1.6, row + 1.6, (n - 1) * p + 1.6, 0.12, "silk")
    b += line("F.SilkS", -2.4, -1.0, -2.4, 1.0, 0.2, "pin1")
    b += fp_text("ANTENNA - no copper", row / 2, -5.5, "Cmts.User", "ant", 0.8)
    b += fp_text("USB", row / 2, y1 - 3, "F.Fab", "usb")
    for i in range(n):
        b += pad(i + 1, 0, round(i * p, 2), 1.7, 1.0, square=(i == 0))
        b += pad(23 + i, row, round(i * p, 2), 1.7, 1.0)
    write("ESP32-S3-DevKitC-1_Socket",
          "ESP32-S3-DevKitC-1 clone on 2x22 female headers, pitch 2.54, row spacing 25.4 mm; "
          "pads 1-22 left (J1), 23-44 right (J3)", b)


def buck():
    # CR-DC2580: board 30 x 20 mm, 4 corner pads 2.0 mm in from each edge (user, 2026-11-10).
    # Origin = pad 1 (IN+, top-left).
    b = text("Reference", "U**", 13, -3.6, "F.SilkS", "ref")
    b += text("Value", "CR-DC2580", 13, 8, "F.Fab", "val")
    b += text("Footprint", "", 0, 0, "F.Fab", "fp", hide=True)
    b += rect("F.Fab", -2, -2, 28, 18, 0.1, "fab")
    b += rect("F.SilkS", -2.12, -2.12, 28.12, 18.12, 0.12, "silk")
    b += rect("F.CrtYd", -2.5, -2.5, 28.5, 18.5, 0.05, "crt")
    for t, x, y, k in [("IN+", 3.6, 0, "a"), ("IN-", 3.6, 16, "b"), ("OUT+", 22, 0, "c"), ("OUT-", 22, 16, "d")]:
        b += fp_text(t, x, y, "F.SilkS", f"lbl{k}", 0.8)
    for num, x, y in [(1, 0, 0), (2, 0, 16), (3, 26, 0), (4, 26, 16)]:
        b += pad(num, x, y, 2.2, 1.1, square=(num == 1))
    write("CR-DC2580", "CR-DC2580 mini buck module 30x20 mm, pads 2 mm from each edge "
          "(IN+ 1, IN- 2, OUT+ 3, OUT- 4)", b)


if __name__ == "__main__":
    os.makedirs(LIB, exist_ok=True)
    devkit()
    buck()
    print("wrote", sorted(os.listdir(LIB)))
