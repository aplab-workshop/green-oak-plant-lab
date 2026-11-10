# Design Review — Green Oak Control Board (Rev A)

ตรวจจาก Block diagram ของผู้ใช้ (รอบที่ 3, 2026-11-10) เทียบกับ [[HARDWARE]] — สถานะ: **อนุมัติแล้ว (Chanatip, 2026-11-10)** ใน `GreenOak_PCB_RevA.canvas` — ดู "ผลอนุมัติ" ท้ายไฟล์

## ✅ ถูกแล้ว

- ESP32-S3 DevKitC-1 + W5500 (SPI 6 ขา: VCC, GND, MISO, MOSI, SCLK, CS — ไม่ใช้ RST/INT)
- RS-485 บัส A ผ่าน TTL to RS485 (สลับทิศทางเอง) — PAR (addr 2), 5-in-1 pH/EC (addr 1), QDY30A (addr 3) ใช้ Terminal 4 ขา 12V / GND / A / B
- I²C: SHT40 (`0x44`) + DS3231 (`0x68`, EEPROM `0x57`) — ไม่ชนกัน ใช้บัสเดียวได้
- PZEM-004T-100A ต่อ UART แยก (TTL) ขั้ว 220V/CT อยู่นอกบอร์ด
- YF-S401 ผ่าน Divider 5V → 3.3V
- MOSFET Logic-level 5 ช่อง (Grow Light PWM, Pump A, Pump B, pH Down, Refill) + Pull-down
- Relay 4 ช่องอยู่นอกบอร์ด (ต่อผ่าน XH) — **ไม่มีไฟ 220V บน PCB**
- Lamp RED / GREEN แทน LED สถานะ
- Buck CR-DC2580 12V → 5V (8 A เกินพอ)

## ❌ สิ่งที่ขาด (ต้องเพิ่มตอนทำ Schematic)

| รหัส | รายการ | รายละเอียด |
|---|---|---|
| A1 | ฟิวส์รวม | หลัง Terminal 12V ก่อน Switch — ~10 A (ตาม PSU 12V 10A) แบบ Blade/5×20 + Holder |
| A2 | ฟิวส์ Grow Light | 5 A ก่อน Terminal Grow Light |
| A3 | Flyback diode | ทุกช่องปั๊ม (Refill, A, B, pH Down) — Schottky SS34 คร่อมขั้ว ถ้าโมดูล MOSFET ไม่มีในตัว |
| A4 | Termination 120 Ω | Jumper ที่บัส RS-485 บนบอร์ด (เปิดเมื่อบอร์ดอยู่ปลายบัส) |
| A5 | GND ร่วมกับ L298N | ขั้วต่อพัดลมต้องมี GND — เปลี่ยนเป็น XH 4 ขา (ENA, IN1, IN2, GND) หรือ 3 ขา (ENA, GND + 12V ไม่ผ่านบอร์ด) |
| A6 | Bulk capacitor | 470 µF/25 V ที่ราง 12V ใกล้ MOSFET, 100 µF + 100 nF ที่ 5V |
| A7 | Test point | 12V, 5V, 3V3, GND |

## ⚠️ ความเสี่ยง

| รหัส | ความเสี่ยง | ทางแก้ที่เสนอ |
|---|---|---|
| R1 | Relay module ส่วนใหญ่เป็น **Active-LOW** — ต่อกับ Pull-down แล้ว Relay ติดตอน Boot | ซื้อรุ่นมี Jumper H/L ตั้ง **H** หรือรุ่น Active-HIGH; เช็ค JD-VCC ต้องการ 5V หรือไม่ |
| R2 | Air Pump ต้องอยู่หน้าสัมผัส **NC** ของ Ch3 (ไม่มีไฟ = ทำงาน) — ช่องอื่นใช้ NO | Silkscreen/ป้ายที่ Relay: "Ch3 NC = AIR PUMP" |
| R3 | Humidifier (บอร์ด USB-C 5V มีปุ่ม) อาจไม่พ่นเองเมื่อจ่ายไฟ | ทดลองของจริงก่อน — ถ้าต้องกด ใช้ Optocoupler คร่อมปุ่ม S1 แทนการตัดไฟ |
| R4 | PZEM-004T เลี้ยง 5V → TX ออก 5V เข้า RX ของ ESP32-S3 | Divider (1 k / 2 k) ที่ PZEM TX → GPIO16 หรือเลี้ยงฝั่ง TTL ด้วย 3.3V (ทดลอง) |
| R5 | L298N ตกแรงดัน ~2 V (พัดลมได้ ~10 V) | ยอมรับได้; IN1 → 3.3V, IN2 → GND ตายตัวบนบอร์ด ใช้ GPIO แค่ ENA |
| R6 | ป้อน 5V เข้า DevKit พร้อมเสียบ USB อาจจ่ายไฟย้อน | Schottky ที่เส้น 5V → ขา 5V ของ DevKit (หรือเตือนให้ถอด 12V ตอนเสียบ USB) |
| R7 | DS3231 ZS-042 วงจรชาร์จแบต | ใช้ CR2032 ต้องถอด 200 Ω; เลี้ยง 3.3V เท่านั้น |
| R8 | QDY30A บางรุ่นต้องการ 24V | ยืนยันกับผู้ขายว่า 12V ใช้ได้ (HARDWARE บันทึกว่ารองรับ 12–30V) |
| R9 | GPIO39–42 เป็นขา JTAG — ถ้ามี Pull ภายในตอน Reset | Pull-down 10 k ภายนอกกดให้ LOW ได้; ตรวจตอนทดสอบว่า Relay ไม่กระพริบตอน Boot |

## Pin map ที่แนะนำ (ESP32-S3-DevKitC-1)

ห้ามใช้: 0, 3, 45, 46 (Strapping) · 19, 20 (USB) · 26–32 (Flash) · 35–37 (ถ้ารุ่น N8R8/N16R8) · 43, 44 (USB-UART บนบอร์ด) · 38/48 (RGB LED ตามเวอร์ชันบอร์ด)

| GPIO | หน้าที่ | หมายเหตุ |
|---|---|---|
| 10 | W5500 CS | FSPI |
| 11 | W5500 MOSI | FSPI |
| 12 | W5500 SCLK | FSPI |
| 13 | W5500 MISO | FSPI |
| 8 | I²C SDA | SHT40 + DS3231 |
| 9 | I²C SCL | |
| 17 | UART1 TX → RS485 RXD | บัส A |
| 18 | UART1 RX ← RS485 TXD | |
| 15 | UART2 TX → PZEM RX | |
| 16 | UART2 RX ← PZEM TX | Divider ถ้า PZEM เลี้ยง 5V |
| 7 | YF-S401 Pulse | Interrupt, Divider + RC filter |
| 4 | Grow Light PWM (D200) | LEDC ~1–20 kHz |
| 5 | Pump A (M103) | |
| 6 | Pump B (M104) | |
| 1 | pH Down (M106) | |
| 2 | Refill (M102) | |
| 42 | พัดลม ENA PWM (D201) | |
| 39 | Relay Ch1 Lamp RED | |
| 40 | Relay Ch2 Lamp GREEN | |
| 41 | Relay Ch3 Air Pump (M105, NC) | |
| 21 | Relay Ch4 Humidifier (M101) | |
| 14, 47 | สำรอง | |

รวมใช้ **21 ขา** เหลือสำรอง 2 ขา (+35–37 ถ้าบอร์ดไม่มี Octal PSRAM) · PWM 2/8 ช่อง LEDC · UART 2/3 ช่อง (UART0 เก็บไว้ Log)

## ทางเดินไฟ

```
12V PSU (≥10 A) → Terminal 12V → A1 Fuse ~10 A → Switch System → ราง 12V
  ├─ A2 Fuse 5 A → MOSFET → Grow Light COB 50W (~4.2 A)
  ├─ MOSFET → Refill (diaphragm ~0.5–1 A), Pump A/B, pH Down (peristaltic ~0.3 A ต่อตัว)
  ├─ L298N → พัดลม (~0.3 A)
  ├─ PAR, 5-in-1, QDY30A (รวม < 0.2 A)
  └─ CR-DC2580 Buck → 5V
        ├─ ESP32-S3 DevKit (ขา 5V) → LDO บนบอร์ด → 3V3
        │     └─ 3V3: W5500 (~150 mA), SHT40, DS3231, TTL to RS485
        ├─ Relay module VCC / JD-VCC
        ├─ PZEM-004T (ฝั่ง TTL), YF-S401
        └─ (Humidifier 5V ผ่าน Relay Ch4 — ถ้าใช้ไฟจากบอร์ด)
```

กระแสรวม 12V กรณีเปิดพร้อมกันทั้งหมด ≈ 4.2 + 1 + 0.9 + 0.3 + 0.2 + ~0.6 (Buck) ≈ **7.2 A** → PSU 12V 10A พอ (เผื่อ ~30 %)

## ผลอนุมัติ (2026-11-10)

ผู้ใช้ติ๊กครบ A1–A7, R1–R9, P1 และกรอก O1–O4:

| รหัส | ผล | ผลต่อแบบ |
|---|---|---|
| A5 | **แก้:** ขั้วต่อพัดลมเป็น XH 2 ขา (ENA + GND) | IN1/IN2 ไม่ผ่านบอร์ด → R5 ทำที่ฝั่งโมดูล L298N แทน: IN1 ต่อ +5V ของ L298N, IN2 ต่อ GND (สายจั๊มบนโมดูล) |
| O1 | ESP32-S3-DevKitC-1 **WROOM-1-N16R8** | Octal PSRAM → ห้ามใช้ GPIO35–37 (Pin map ไม่ได้ใช้อยู่แล้ว); ไม่รู้ v1.0/v1.1 → เว้นทั้ง 38 และ 48 |
| O2 | W5500 เลี้ยงได้ทั้ง 3.3V / 5V | เลือก **VCC = 5V** (ใช้ LDO บนโมดูล W5500 ลดภาระ LDO ของ DevKit); สัญญาณ SPI เป็น 3.3V |
| O3 | MOSFET module ยังไม่แน่ใจ (Flyback?) | ใส่ SS34 บน PCB ทุกช่องปั๊มตาม A3 ไม่พึ่งโมดูล — **โมดูล IRF520 (34 × 26 mm) ใช้ไม่ได้**: Rds(on) กำหนดที่ Vgs 10 V, ที่ 3.3 V เปิดไม่สุด (Grow Light 4.2 A จะร้อน/หรี่ไม่เต็ม), ไม่มี Flyback และ 5 ตัวกินพื้นที่ ~44 cm² จาก 100 cm² — **ตัดสิน 2026-11-10: AOD4184A (TO-252) บน PCB 5 ช่อง** (Gate 100 Ω, Pull-down 10 kΩ, SS34 ที่ช่องปั๊ม) ภายในขนาด ≤ 100 × 100 mm (ประมาณการพื้นที่ด้านล่าง) |
| O1+ | บอร์ดจริงพิมพ์ "N16R8 2022-V1.3" | เป็นบอร์ด Clone (Espressif มีแค่ v1.0/v1.1) — Pinout ตาม DevKitC-1 แต่**ต้องวัดระยะแถวขาเอง**และเช็คว่ามีไดโอด/Jumper ที่เส้น 5V ไหม (เกี่ยวกับ R6) |
| O4 | ขนาด ≤ 100 × 100 mm | ขั้วต่อ 5.08 mm รวม ~30 ขา (~152 mm) วางรอบขอบได้ — W5500 / Relay / L298N อยู่นอกบอร์ดผ่าน XH |

## ประมาณการพื้นที่ (เป้า ≤ 100 × 100 mm = 100 cm²)

| ส่วน | ขนาดโดยประมาณ | cm² |
|---|---|---|
| ESP32-S3 DevKit (Clone) บน Female header + ระยะเว้น | ~65 × 30 mm | 20 |
| TTL to RS485 (HW-726/XY-017) — **นอกบอร์ด** ต่อด้วย XH 4 ขา | — | 0 |
| CR-DC2580 Buck | 30 × 20 mm | 6 |
| Terminal 5.08 mm 26 ขา (12V 2, Switch 2, Grow Light 2, ปั๊ม 8, PAR/5-in-1/QDY30A 12) วางรอบขอบ | ~132 × 10 mm | 13 |
| XH 2.50 mm 29 ขา (Relay 6, W5500 6, PZEM 4, SHT40 4, DS3231 4, YF-S401 3, พัดลม 2) | ~73 × 6 mm | 5 |
| AOD4184A × 5 + Gate R + Pull-down + SS34 × 4 | 5 × ~10 × 15 mm | 8 |
| Fuse holder × 2 (แบบ Mini blade) | | 4 |
| Bulk cap, Schottky, Divider, Test point, Jumper | | 5 |
| **รวม** | | **~55 (≈ 55 %)** |

**ตัดสิน 2026-11-10 (แทนแบบวางใต้ DevKit): โมดูล RS485 อยู่นอกบอร์ด** — PCB มีแค่ XH 4 ขา (VCC, TXD, RXD, GND); Sensor 3 ตัวต่อ A/B ที่ขั้วสกรูของโมดูล ผลที่ตามมา:
- **VCC ของโมดูลต้องเป็น 3.3V** — ถ้าเลี้ยง 5V ขา TXD จะออก 5V เข้า GPIO18 ของ ESP32-S3
- **A4 (Jumper 120 Ω บน PCB) ตัดออก** — Termination ใช้ 120 Ω ที่มีบนโมดูล (ถ้ามี) หรือใส่ที่ปลายบัส
- **ต้องเพิ่ม Terminal 12V ออกไปเลี้ยง Sensor** (PAR 7–30V, 5-in-1 9–24V, QDY30A 12–30V) เพราะขั้วสกรูของโมดูลมีแค่ A / B / Earth — เสนอ Terminal 5.08 mm 2 ขา "12V SENSOR" + Polyfuse ~0.5 A
- Terminal 4 ขาของ Sensor ทั้ง 3 ตัวย้ายไปอยู่นอกบอร์ด (เช่น Terminal strip ในกล่อง)
- สาย TTL ระหว่าง PCB กับโมดูลให้สั้น (≤ ~30 cm)
- เสาอากาศของ ESP32-S3 WROOM ยังต้องยื่นพ้นขอบบอร์ด หรือมี Keep-out ไม่มีทองแดงใต้เสาอากาศ

## Schematic Rev A (2026-11-10)

- ไฟล์: `hardware/kicad/GreenOak.kicad_sch` สร้างด้วย `hardware/kicad/tools/gen_schematic.py` (แก้ตารางในสคริปต์แล้วรันใหม่ — อย่าแก้ไฟล์ .kicad_sch ตรง ๆ ถ้าจะ Generate ซ้ำ); ทุกขาต่อด้วย Net label, ขาที่ไม่ใช้มี No-connect
- **ERC: 0 violation** (error 0, warning 0) — Footprint ครบทุกชิ้น
- Output: `output/GreenOak_schematic.pdf`, `output/GreenOak_BOM.csv`, `output/GreenOak.net`
- 66 ชิ้น 45 Net; Net หลัก: +12V_IN → F1 10A → POWER SWITCH → +12V → F2 5A → +12V_LED / F3 PTC 0.5A → +12V_SENSOR; Buck → +5V → D1 SS34 → +5V_DEVKIT; +3V3 จาก DevKit
- เพิ่มจากแผนภาพ: **JP1 Solder jumper เลือกไฟ Relay** (1-2 = 5V ค่าเริ่ม, 2-3 = 3V3 — Relay 3.3V 4 ช่องกินกระแส ~0.3 A จาก LDO ของ DevKit ไม่แนะนำ), **XH 4 ขา SPARE** (3V3, GND, IO14, IO47)
- **ลำดับขา XH** (ผู้ใช้ให้เลือกตามความเหมาะสม 2026-11-10 — ขา 1 ก่อน, เรียงตาม Header ของโมดูลให้ใช้สายตรงได้):

| Connector | ลำดับ | เหตุผล |
|---|---|---|
| J9 Relay 4CH | GND · IN1 RED · IN2 GREEN · IN3 AIR · IN4 HUM · VCC | ตรงกับ Header ของโมดูล Relay 4 ช่องทั่วไป |
| J13 RS485 | 3V3 · TXD · RXD · GND | ตรงกับ Header ของ HW-726/XY-017 |
| J14 PZEM-004T | 5V · RX · TX · GND | ตรงกับ Header ของ PZEM |
| J16 SHT40 / J17 DS3231 | GND · 3V3 · SDA · SCL | ลำดับ STEMMA QT/Qwiic และตรงกับ Header 4 ขาฝั่งเดียวของ ZS-042 |
| J12 W5500 | 5V · GND · MISO · MOSI · SCLK · CS | ตามที่ผู้ใช้ระบุ (Header ของ W5500 เป็น 2 × 5 ต้องทำสายเอง) |
| J15 YF-S401 | 5V · GND · PULSE | แดง · ดำ · เหลือง |
| J10 Fan | ENA · GND | |
| J11 Spare | 3V3 · GND · IO14 · IO47 | |

- Terminal ของโหลด: ขา 1 = +12V, ขา 2 = ขั้วลบของโหลด (Drain)
- **YF-S401 เป็น Open-drain** (ผู้ใช้ยืนยัน): ตัด Divider ออก → R19 10k Pull-up ไป 3V3, R18 1k อนุกรม, C4 1nF — **ห้ามมี Pull-up ไป 5V ในตัวเซนเซอร์** (ตรวจตอน H3: ถอดสายสัญญาณแล้ววัดขาเหลืองต้องไม่มี 5V ลอยอยู่)
- **ฟิวส์ F1 10 A / F2 5 A เป็นหลอดแก้ว 5×20** — Footprint `Fuseholder_Clip-5x20mm_Littelfuse_111_Inline_P20.00x5.00mm` (คลิปคู่ ระยะ 20 mm) ต้องเทียบกับคลิป/ซ็อกเก็ตที่ซื้อจริง และคลิปต้องรับ ≥ 10 A
- **Footprint ทำเอง** (`tools/gen_footprints.py` → `GreenOak.pretty`):
  - ESP32-S3 Clone: 2 × 22 ขา Pitch 2.54, ระยะแถว **25.4 mm**, บอร์ดกว้าง 28 mm; ขา 1 (3V3) อยู่ฝั่งเสาอากาศ; **ความยาวบอร์ด 69 mm ยังเป็นค่าประมาณ** (ใช้วาด Courtyard/Keep-out เสาอากาศ)
  - CR-DC2580: บอร์ด 30 × 20 mm, Pad 4 มุมห่างขอบ 2 mm → ระยะ Pad 26 × 16 mm (ไม่ตรง Grid 2.54 — บัดกรีขาลวด/สายตรง ไม่ใช้ Pin header)

## PCB Rev A v1.0 (2026-11-10)

- **ขนาด 100 × 100 mm, 2 ชั้น**, รูยึด M3 4 มุม (3.5 mm จากขอบ)
- **DRC: 0 violation, 0 unconnected** (`output/drc.json`)
- การจัดวาง (`tools/build_pcb.py`):
  - ขอบซ้าย: Terminal 12V IN / POWER SWITCH / 12V SENSOR (สายเข้าทางซ้าย) + F1 10 A, F2 5 A (คลิป 5×20), Buck CR-DC2580, C1 470 µF
  - ขอบบน: XH Relay / Fan / Spare; ESP32-S3 DevKit ตรงกลางบน **เสาอากาศยื่นพ้นขอบบนเล็กน้อย** + Keep-out ทองแดง; USB-C ชี้ลงในบอร์ด (หน้า USB มีแค่ชิ้น SMD เตี้ย)
  - ขอบขวา: XH W5500 / RS485 / PZEM / YF-S401 / SHT40; ขอบล่างซ้าย: XH DS3231 + Test point 12V/5V/3V3/GND
  - ขอบล่าง: Terminal โหลด 5 ช่อง (LED D200, A M103, B M104, pH M106, FILL M102 — ขา 1 = +, ขา 2 = −), AOD4184A หมุน 90° อยู่เหนือ Terminal, SS34 เหนือ MOSFET
  - ตัวต้านทาน Gate/Pull-down และ Pull-down ของ Relay อยู่**ใต้ DevKit** (SMD 0805 สูงไม่ถึง Female header) — Courtyard ของ DevKit จึงครอบเฉพาะแถว Header
- ลาย: Freerouting (`tools/route_pcb.py` + `patch_dsn_classes.py`) — Power 2.0 mm (+12V_IN, 12V_FUSED, +12V, +12V_LED, LIGHT_D), Supply 0.8 mm (GND, 5V, 3V3, Drain ปั๊ม ฯลฯ), สัญญาณ 0.3 mm; ลายมือ 2 เส้นใน `tools/manual_tracks.py` (+12V ไป J6/J7 ที่ Freerouting เดินไม่ผ่าน, กว้าง 1.5 / 0.8 mm + Via 1.2/0.6); GND เทเต็มทั้ง 2 ชั้น + Stitching via 0.6/0.3 (`tools/stitch_gnd.py`)
- ทำซ้ำทั้งหมด: `build_pcb.py` → `route_pcb.py export` → patch DSN → Freerouting → `bash tools/post_route.sh`
- Output: `output/GreenOak_gerber_v1.0.zip` (Gerber 9 ชั้น + PTH/NPTH drill + map), `GreenOak_pcb_front.pdf`, `GreenOak_pcb_back.pdf` (กลับด้าน), `GreenOak.step` (ไม่ commit — สร้างใหม่ได้)

### ก่อนสั่งผลิต (ต้องให้ผู้ใช้ยืนยัน — ตรวจจากไฟล์ไม่ได้)

1. **ลำดับขา Connector** เทียบสายจริงทุกตัว (ตารางลำดับ XH ด้านบน) และ **ทิศช่องเสียบสายของ Terminal 5.08** (Footprint Phoenix MKDS Horizontal — ตั้งให้ช่องเสียบหันออกขอบบอร์ด)
2. **3D Viewer ไม่ชน**: ESP32 บน Female header สูงพอเหนือ R ใต้บอร์ด, C1 (Ø10 สูง ~16 mm) / คลิปฟิวส์ / Buck ไม่ชนกล่อง; Footprint ESP32 Clone ความยาว 69 mm ยังเป็นค่าประมาณ — วัดระยะขา 1 ถึงปลายเสาอากาศ ถ้าเสาอากาศยาวกว่า ~5 mm จากขา 1 จะยื่นพ้นขอบมากขึ้น (ไม่เสียหาย)
3. **ลายรอบ MOSFET/ไฟ 12V** ดูด้วยตา โดยเฉพาะ Grow Light 4.2 A: +12V_LED / LIGHT_D 2.0 mm + GND เทเต็มทั้งสองชั้น
4. **คลิปฟิวส์ 5×20** ที่ซื้อ: ระยะขา 20 mm (Littelfuse 111 Inline) และทน ≥ 10 A

**ผู้ใช้ตรวจผ่านครบ 4 ข้อ (2026-11-10) → `GreenOak_gerber_v1.0.zip` พร้อมสั่งผลิต** — แก้หลังส่งผลิตให้ขึ้น v1.1 (แก้ Silkscreen ชื่อบอร์ด + zip ใหม่) อย่าทับ v1.0

## PCB Rev A v1.1 (2026-11-10) — **ใช้ไฟล์นี้แทน v1.0**

ผู้ใช้แจ้งว่าขนาด U1, F1, F2 ใน v1.0 ไม่ตรงของจริง → ใช้ Footprint ที่วัดจริงจาก**ไลบรารีกลาง APLab** (`C:\Users\Chanatip\Desktop\Main\PCB_Kidcad\Library\APLab.pretty`, ลงทะเบียน Global ชื่อ `APLab` — อยู่นอก repo):

| Ref | v1.0 | v1.1 | ขนาดจริง |
|---|---|---|---|
| U1 | `GreenOak:CR-DC2580` (Pad 26 × 16 mm) | `APLab:CR-DC2580_Module` | รุ่น V5: ขา 1→3 26.12 mm, 3→4 12.6 mm, บอร์ด 30.2 × 20 mm, ติดด้วย Pin header |
| F1, F2 | Littelfuse 111 Inline (คลิป P20 mm) | `APLab:Fuseholder_5x20_BLX-A` | ฐาน BLX-A 2 ขา ห่าง 22.2 mm, รู 1.3 mm, ตัว 27.8 × 9.5 mm สูง 13 mm, รับ 10 A |

- ลบ `GreenOak.pretty/CR-DC2580.kicad_mod` (ใช้ของ APLab แทน)
- จัดวางใหม่: F1 ลงมาที่ y 53.5 (ฐานกว้างขึ้น), C1/C2/C3/D1/F3 ขยับลง; **J10 FAN ย้ายไปมุมบนขวา** ข้าง GPIO42 และ J11 SPARE มาแทนที่เดิม (ลายพัดลมสั้นลง)
- +3V3 เดินเป็นลายสัญญาณ 0.3 mm (กระแส < 0.3 A) เพื่อให้ Freerouting เดินครบ
- ไม่มีลายมือแล้ว: `tools/route_all.sh` ทำทั้งหมด (วางชิ้น → DSN → Freerouting วนจนครบ 100 % → Import → ใส่ Silkscreen หลังเดินลาย → GND stitching → ต่อ Pad ที่ thermal ขาดแบบทึบ → DRC) — Silkscreen ใส่หลังเดินลายเพราะข้อความบนบอร์ดเปลี่ยนผลของ Freerouting
- **ERC 0, DRC 0 violation / 0 unconnected**
- Output: `output/GreenOak_gerber_v1.1.zip` (v1.0 zip เก็บไว้ไม่ทับ), PDF หน้า/หลัง, Wiring canvas สร้างใหม่จาก Netlist

### ก่อนสั่งผลิต v1.1
- เปิด 3D Viewer ดูฐานฟิวส์ BLX-A (สูง 13 mm) และ Buck บน Pin header ไม่ชนกัน/ไม่ชนกล่อง
- ทิศ Footprint ของ APLab ตรงกับการวางจริง (ขา 1 Buck = VIN+ มุมบนซ้าย)

## ถัดไป

1. รายการจัดหาอุปกรณ์ (BOM_Procurement) ให้ Codex — ถามก่อนว่ามีชิ้นไหนแล้ว
