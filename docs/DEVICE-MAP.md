---
title: PLC Device Mapping — FX5U
version: 0.1 (P0 draft)
status: draft — ต้องทดสอบกับ FX5U จริงใน M3 ก่อนใช้ในห้องเรียน
updated: 2026-10-16
tags: [green-oak, plc, fx5u, slmp]
---

# PLC Device Mapping (FX5U)

เกี่ยวข้อง: [SPEC.md](SPEC.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

ทุก PLC ใช้ Mapping เดียวกัน โดย Gateway เชื่อมต่อแยกตาม IP ของแต่ละเครื่อง ค่า Mapping ทั้งหมดอยู่ใน `packages/shared/src/deviceMap.ts` (Single Source of Truth) และเอกสารนี้ต้องตรงกับไฟล์นั้นเสมอ

> [!warning] เป็นข้อเสนอเบื้องต้น
> ต้องยืนยันการเข้าถึง Device, พอร์ต และการตั้งค่า SLMP กับ FX5U จริงใน **M3** ก่อนนำไปใช้

---

## 1. Sensor Registers — Gateway **เขียน** → PLC **อ่าน**

ทุกค่าเป็น **Signed 16-bit (INT16)** ช่วง −32768 ถึง 32767

| Address | Parameter | Unit | Scaling | ตัวอย่าง | ช่วงที่ส่ง |
|---|---|---|---|---|---|
| D100 | Air Temperature | °C | × 10 | 25.3 °C → `253` | −100 … 600 |
| D101 | Relative Humidity | %RH | × 10 | 65.5 % → `655` | 0 … 1000 |
| D102 | PPFD | µmol/m²/s | × 1 | 320 → `320` | 0 … 2500 |
| D103 | Water Temperature | °C | × 10 | 22.1 °C → `221` | −100 … 600 |
| D104 | pH | pH | × 100 | 6.05 → `605` | 0 … 1400 |
| D105 | EC | mS/cm | × 100 | 1.20 → `120` | 0 … 1000 |
| D106 | Water Level | % | × 1 | 72 % → `72` | 0 … 100 |
| D107 | Refill Water Flow | L/min | × 100 | 2.00 → `200` | 0 … 1000 |
| D108 | Power Consumption | W | × 1 | 143 W → `143` | 0 … 5000 |
| D109 | VPD (Estimated, Air) | kPa | × 100 | 1.12 → `112` | 0 … 1000 |
| D110 | DLI (today, since sim 00:00) | mol/m²/day | × 100 | 14.40 → `1440` | 0 … 10000 |

**กฎการแปลง (Gateway):** `raw = clamp(round(value × scale), min, max)` ถ้าค่าเกินช่วง ให้ Clamp และบันทึก Event `sensor.out_of_range`

## 2. Actuator Commands — PLC **เขียน** (Ladder) → Gateway **อ่าน**

| Address | Actuator | Type | ค่า |
|---|---|---|---|
| M100 | Ventilation Fan | bit | 0 = OFF, 1 = ON |
| M101 | Humidifier | bit | 0/1 |
| M102 | Water Refill Pump | bit | 0/1 |
| M103 | Nutrient Pump A | bit | 0/1 |
| M104 | Nutrient Pump B | bit | 0/1 |
| M105 | Air Pump | bit | 0/1 |
| D200 | Grow Light Brightness | INT16 | 0 … 100 (%) |

**กฎการอ่าน (Gateway):**
- Batch read M100–M105 (6 bits) และ D200 (1 word)
- D200 นอกช่วง 0–100 → Clamp และบันทึก Event `command.out_of_range`
- ทุก Command ติด Timestamp ถ้าอ่านไม่ได้นานกว่า `PLC_COMMAND_TIMEOUT_MS` (3000 ms) ให้เข้า **Fail-safe**

## 3. Access Rules (FR-31)

| Operation | Allowed devices |
|---|---|
| **Write** | D100–D110 (+ D111–D112, D120 หากอนุมัติ § 4) |
| **Read** | M100–M105, D200 |
| **ห้ามเด็ดขาด** | เขียน M Device ใด ๆ, เขียน D200, เขียนนอกช่วงที่ระบุ |

Software บังคับใช้ 2 ชั้น
1. **Type-level:** ฟังก์ชันเขียนรับเฉพาะ `SensorReadings` ไม่มี API รับ Address อิสระ
2. **Runtime guard:** Low-level writer ตรวจ Address ก่อนส่ง Frame ถ้าไม่อยู่ใน Allowlist ให้ `throw` (มี Unit Test, AC-11)

## 4. ข้อเสนอเพิ่มเติม (รออนุมัติ)

Register เสริมเหล่านี้ช่วยแก้ปัญหาการเร่งเวลา และใช้สอน Sensor Fault Detection ได้

| Address | Parameter | Scaling | ประโยชน์ |
|---|---|---|---|
| D111 | Sim Time of Day | นาที 0 … 1439 | Ladder ทำ Photoperiod ตาม **เวลาจำลอง** ได้ (เช่น LED เปิด 06:00–22:00) แม้เร่ง 360x โดยไม่ต้องใช้ Timer/RTC ของ PLC |
| D112 | Sim Day | วัน (นับจากเพาะ) | ทำโปรแกรมตามอายุพืช |
| D120 | Gateway Heartbeat | นับ 0 … 32767 วนซ้ำ (+1 ทุกรอบเขียน) | Ladder ตรวจได้ว่า Gateway/Sensor ค้าง (ใช้ในบท Sensor Fault Detection) |

## 5. Fail-safe State

เมื่อ Command หมดอายุหรือ PLC Offline:

| Actuator | State |
|---|---|
| Fan, Humidifier, Refill, Nutrient A/B | OFF |
| LED | 0 % |
| **Air Pump** | **ON** (เพื่อให้รากยังได้ออกซิเจน) |

เมื่อสื่อสารกลับมา ให้ใช้ Command ใหม่ที่อ่านได้ทันที และบันทึก Event `plc.recovered`

## 6. FX5U Setup Checklist (ทำใน M3)

- [ ] GX Works3 → Parameter → Module Parameter → Ethernet Port → ตั้ง IP ของ PLC แต่ละเครื่อง
- [ ] External Device Configuration → เพิ่ม **SLMP Connection Module** (TCP, Binary) และกำหนดพอร์ต (เช่น 5000)
- [ ] เปิดการเขียนข้อมูลขณะ RUN (Enable online change via SLMP)
- [ ] ทดสอบอ่าน/เขียน D100 และอ่าน M100 จาก Gateway ด้วยเครื่องมือทดสอบ
- [ ] บันทึก IP/Port ของแต่ละเครื่องลง Config ของ Lab
- [ ] ยืนยันว่า Network ของ PLC อยู่ใน LAN ห้องเรียนเท่านั้น

## 7. ตัวอย่าง Ladder (Pseudocode) — Automatic Water Refill

```
// Hysteresis: เติมเมื่อ < 60%, หยุดเมื่อ ≥ 90%
|--[ < D106 K60 ]----------------( SET M102 )--|
|--[ >= D106 K90 ]---------------( RST M102 )--|
|--[ SM400 ]---------------------( M105 )------|   // Air pump ON ตลอด
```

ตัวอย่างครบทุกบทเรียนจะอยู่ใน `docs/ladder-examples.md` (M3/M5)
