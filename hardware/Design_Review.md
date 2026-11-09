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
| TTL to RS485 (HW-726/XY-017) — **วางใต้ DevKit** (ใช้พื้นที่ซ้อนกัน) | 52 × 23 mm | 0 |
| CR-DC2580 Buck | 30 × 20 mm | 6 |
| Terminal 5.08 mm 26 ขา (12V 2, Switch 2, Grow Light 2, ปั๊ม 8, PAR/5-in-1/QDY30A 12) วางรอบขอบ | ~132 × 10 mm | 13 |
| XH 2.50 mm 29 ขา (Relay 6, W5500 6, PZEM 4, SHT40 4, DS3231 4, YF-S401 3, พัดลม 2) | ~73 × 6 mm | 5 |
| AOD4184A × 5 + Gate R + Pull-down + SS34 × 4 | 5 × ~10 × 15 mm | 8 |
| Fuse holder × 2 (แบบ Mini blade) | | 4 |
| Bulk cap, Schottky, Divider, Test point, Jumper | | 5 |
| **รวม** | | **~61 (≈ 61 %)** |

**ตัดสิน 2026-11-10: วางโมดูล RS485 ใต้ DevKit** — เงื่อนไขที่ต้องทำตาม:
- โมดูลบัดกรีราบกับ PCB ผ่าน Pin header ทั้งฝั่ง TTL (4 ขา: VCC, TXD, RXD, GND) และฝั่ง RS485 (3 รู: A+, B−, GND) — **ไม่ใช้ขั้วสกรูสีน้ำเงินบนโมดูล** (อยู่ใต้ DevKit เข้าไม่ถึง) บัส A/B เดินลายไป Terminal 5.08 ของ PAR / 5-in-1 / QDY30A
- ขั้วสกรูน้ำเงินสูง ~10 mm → DevKit ต้องยกด้วย **Female header แบบสูง** (หรือถอดขั้วสกรูออกจากโมดูลแล้วใช้ Header มาตรฐาน 8.5 mm) — วัดความสูงจริงก่อนทำ PCB
- เสาอากาศของ ESP32-S3 WROOM ต้องยื่นพ้นขอบบอร์ด หรือมี Keep-out ไม่มีทองแดงใต้เสาอากาศ
- เช็คว่าโมดูลมี 120 Ω บนบอร์ดแล้วหรือไม่ (ถ้ามี Jumper A4 บน PCB ต้องเปิดไว้ ไม่ให้ซ้อน 2 ตัว)

## ถัดไป

1. ขนาดจริงของโมดูลบนบอร์ด (ระยะแถวขา center-to-center, จำนวนขา, รูยึด): DevKitC-1, TTL to RS485, CR-DC2580, Switch System
2. สร้าง Schematic ใน `hardware/kicad/`
