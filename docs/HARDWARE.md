---
title: Real Prototype — Hardware Plan (MCU + FX5U)
version: 0.1
status: approved 2026-11-04 — แผน Phase H1–H7 อยู่ใน PHASES.md
updated: 2026-11-04
tags: [green-oak, hardware, esp32, modbus, fx5u, kicad]
---

# Real Prototype — Hardware Plan

เกี่ยวข้อง: [DEVICE-MAP.md](DEVICE-MAP.md) · [SPEC.md](SPEC.md) · [PHASES.md](PHASES.md)

ต้นแบบจริงของระบบปลูก Green Oak ที่ PLC FX5U ควบคุมได้ด้วย Ladder ชุดเดียวกับที่นักเรียนเขียนกับ Sim

---

## 1. การตัดสินใจที่ตกลงแล้ว

| วันที่ | เรื่อง | ข้อตกลง |
|---|---|---|
| 2026-11-04 | แนวทาง | Sensor และ Output ทั้งหมดต่อเข้า **Microcontroller (MCU)** ซึ่งทำหน้าที่เป็น Remote I/O ส่วน PLC คุมผ่าน **Modbus TCP** |
| 2026-11-04 | Master/Slave | **MCU = Modbus TCP Client (Master), FX5U = Server (Slave)** — MCU ทำงานแทน Gateway: เขียน D100–D112, D120 แล้วอ่าน M101–M106, D200–D201 (Address เดิมตาม DEVICE-MAP) |
| 2026-11-04 | เครือข่าย | ใช้สาย LAN ในห้องเรียน ไม่ใช้ WiFi |
| 2026-11-04 | MCU | **ESP32-S3 + W5500** (เหตุผลดู § 4) |
| 2026-11-04 | ระบายอากาศ | ใช้**พัดลมอย่างเดียว** (D201) ไม่มี Cooling pad — Sim ยังเย็นกว่าห้อง 9 °C ไว้ก่อน (ผู้ใช้สั่งคงไว้) |
| 2026-11-04 | Dashboard | ตัดสินใจทีหลังสุด — ตอนนี้ต้นแบบทำงานกับ PLC อย่างเดียว ไม่ต่อกับ Server |
| 2026-11-04 | แผน + Register | ผู้ใช้อนุมัติแผน H1–H7 และ Register ใหม่ D121 (MCU Status), D202 (PLC Heartbeat) |

## 2. โครงสร้าง

```
 Sensors ──► ┌─────────────────────────┐   Modbus TCP (LAN)   ┌──────────────┐
             │ ESP32-S3 + W5500 (MCU)  │ ── write D100–D121 ─►│  FX5U (Slave)│
 Outputs ◄── │ Remote I/O + Fail-safe  │ ◄─ read M101–M106 ── │  Ladder ของ  │
             │                         │ ◄─ read D200–D202 ── │  นักเรียน     │
             └─────────────────────────┘                      └──────────────┘
```

- MCU **ไม่มี Logic ควบคุมพืช** (ไม่เปิด/ปิดตามค่า Sensor เอง) — มีแค่ Safety limit และ Fail-safe (§ 5) เพื่อให้นักเรียนเป็นคนเขียน Logic
- กฎ FR-31 ใช้กับ Firmware ด้วย: MCU **เขียนได้เฉพาะ D100–D112, D120–D121** ห้ามเขียน M Device และ D200 ขึ้นไป (มี Allowlist + Unit test)
- รอบสื่อสารเสนอ 200 ms: FC16 เขียน D100–D112 (13 words) และ D120–D121 (2 words) แยกกัน (ห้ามเขียนช่วง D113–D119), FC01 อ่าน Coil M101–M106, FC03 อ่าน D200–D202

## 3. I/O ของต้นแบบ

### Input (MCU อ่าน → เขียนลง PLC)

| Address | ค่า | ที่มา | Interface (เสนอ) |
|---|---|---|---|
| D100, D101 | Air Temp, RH | Sensor ตัวเดียว (เช่น SHT40/SHT31) | I²C หรือ RS-485 |
| D102 | PPFD | Quantum (PAR) sensor | Analog → ADS1115 หรือ RS-485 |
| D103 | Water Temp | DS18B20 กันน้ำ | 1-Wire |
| D104 | pH | Probe + Isolation board | Analog → ADS1115 (แยกกราวด์) |
| D105 | EC | Probe + Isolation board | Analog → ADS1115 (แยกกราวด์) |
| D106 | Water Level % | Ultrasonic/Pressure แบบ Analog | Analog → ADS1115 |
| D107 | Refill Flow | Flow sensor แบบ Pulse | GPIO Interrupt |
| D108 | Power | Power meter (เช่น PZEM-016) | RS-485 Modbus RTU |
| D109 | VPD | **คำนวณ** จาก D100/D101 | — |
| D110 | DLI today | **คำนวณ** สะสม PPFD ตั้งแต่ 00:00 | — |
| D111, D112 | เวลาของวัน, วันที่ปลูก | **RTC** (DS3231) + วันเริ่มปลูกที่ตั้งไว้ | I²C |
| D120 | MCU Heartbeat | +1 ทุกรอบเขียน | — |
| D121 | MCU Status bits (อนุมัติแล้ว) | § 5.4 | — |
| — | Float switch สูง/ต่ำ | Interlock + สถานะ | GPIO (และต่อ Hardware ตรง § 5.1) |

### Output (PLC สั่ง → MCU ขับ)

| Address | อุปกรณ์ | Driver (เสนอ) |
|---|---|---|
| M101 | Humidifier (หมอก) | Relay |
| M102 | Water Refill Pump | MOSFET (12V) + Float สูงตัดวงจร |
| M103, M104 | Nutrient Pump A, B (Peristaltic) | MOSFET (12V) |
| M105 | Air Pump | **Relay หน้าสัมผัส NC** (ไม่มีไฟเลี้ยง = ทำงาน) |
| M106 | pH Down Pump (Peristaltic ทนกรด) | MOSFET (12V) |
| D200 | Grow Light Brightness 0–100 % | PWM หรือ 0–10V ตาม LED Driver |
| D201 | Fan Speed 0–100 % | PWM หรือ 0–10V ตามชนิดพัดลม |
| D202 | PLC Heartbeat (อนุมัติแล้ว) | Ladder นับ +1 ทุก 1 s (§ 5.2) |

## 4. การเลือก MCU

| ตัวเลือก | ข้อดี | ข้อเสีย | สรุป |
|---|---|---|---|
| WT32-ETH01 (ESP32 + LAN8720) | ถูก, LAN บนบอร์ด | GPIO ว่างน้อย (~10 ขา บางขา Input-only), ไม่มี USB ต้องใช้ USB-TTL, GPIO0 ชนกับ Clock ของ PHY ตอน Boot | ❌ ขาไม่พอ |
| ESP32 + W5500 | W5500 มี TCP/IP stack ใน Hardware เสถียร, ขาเหลือเยอะ | ESP32 รุ่นเดิม ไม่มี Native USB | ✅ ใช้ได้ |
| **ESP32-S3 + W5500** | เหมือนข้างบน + GPIO มากกว่า, Native USB (โปรแกรม/Debug ด้วยสายเดียว), รุ่นใหม่กว่า | ราคาสูงกว่าเล็กน้อย | ✅ **เลือก** |
| Arduino UNO Q | มี Linux (MPU) + MCU STM32 ในบอร์ดเดียว | ไม่มีพอร์ต LAN บนบอร์ด (ต้องใช้ USB adapter), ฝั่ง Linux Boot ช้าและเสี่ยงไฟล์เสียเมื่อไฟดับ, ซับซ้อนเกินงาน Remote I/O | ❌ ไม่ช่วยเรื่องความเสถียร |

- **ESP32-S3 ไม่ได้เสถียรกว่า ESP32 เดิมโดยตัวชิป** ความเสถียรมาจาก W5500 (Hardware TCP/IP), แหล่งจ่ายไฟที่ดี, Watchdog และ Firmware แบบ Non-blocking — S3 ได้เปรียบที่ GPIO และ USB
- ต้นแบบแรก: **ESP32-S3-DevKitC-1 + โมดูล W5500** ต่อผ่าน Pin header บน PCB เพื่อเปลี่ยนได้ง่ายถ้าเสีย (ทางเลือก: บอร์ดสำเร็จรูป S3 + W5500 บนบอร์ดเดียว ถ้าขาพอ)
- Software ที่จะทดลองใน Phase แรก: Arduino-ESP32 core 3.x (`ETH` รองรับ W5500 ผ่าน SPI) + Library Modbus TCP Client เช่น eModbus — ต้องยืนยันว่าใช้กับ W5500 ได้จริง
- **งบขา (ประมาณ):** W5500 SPI 6 · I²C 2 · 1-Wire 1 · RS-485 3 · Flow 1 · Float 2 · Output on/off 6 · PWM 2 · LED สถานะ/Buzzer 2 = **~25 ขา** — DevKitC-1 พอ

## 5. Fail-safe (3 ชั้น)

หลักการ: ทุกชั้นทำงานแยกกัน ชั้นล่างต้องปลอดภัยแม้ชั้นบนพังทั้งหมด

### 5.1 ชั้น Hardware (ไม่พึ่ง Software)
- **Air Pump ต่อที่หน้าสัมผัส NC ของ Relay** — MCU ค้าง/ไม่มีไฟ/รีบูต Air Pump ยังทำงาน
- **Float switch ระดับสูงต่ออนุกรมกับไฟของปั๊มเติมน้ำ** — น้ำเต็มแล้วปั๊มหยุดแม้ Ladder สั่งค้าง
- ขา GPIO ที่ขับ Output ต้องมี **Pull-down** และ**ห้ามใช้ Strapping pin** (S3: GPIO0, 3, 45, 46) และ USB (19, 20) — ตอน Boot ทุก Output ต้อง OFF
- Fuse แยกต่อช่อง, ปุ่ม **E-Stop ตัดไฟโหลด** (ไม่ตัดไฟ MCU) สำหรับครู
- (ไม่บังคับ) สวิตช์ Hand-Off-Auto ต่อช่อง สำหรับทดสอบ/สาธิตโดยไม่ใช้ PLC

### 5.2 ชั้น Firmware MCU
| เงื่อนไข | ตรวจจับ | ทำอะไร |
|---|---|---|
| ติดต่อ PLC ไม่ได้ | Modbus อ่าน/เขียนล้มเหลวต่อเนื่อง > 3000 ms (เท่า `PLC_COMMAND_TIMEOUT_MS`) | เข้า Fail-safe ตาม DEVICE-MAP § 5 |
| **PLC อยู่ STOP** (ยังตอบ Modbus ได้ แต่ M ค้างค่าเดิม) | **D202 PLC Heartbeat ไม่เปลี่ยน > 3 s** | เข้า Fail-safe |
| MCU ค้าง | Task Watchdog ของ ESP32 (ไม่มี `delay()` ใน Loop หลัก) | รีบูต → Output OFF (ชั้น 5.1) |
| ปั๊มเติมน้ำเปิดค้าง | เปิดต่อเนื่องเกินเวลาสูงสุด (ค่าเริ่ม 10 นาที — ปรับตามอัตราไหลจริง) | ตัดปั๊ม + ตั้งบิตใน D121 จน PLC สั่ง OFF |
| ปั๊มโดส A/B/pH Down เปิดค้าง | เกินเวลาต่อครั้ง หรือรวมต่อชั่วโมง (ค่าเริ่ม: ≤ 10 s/ครั้ง — ปรับจากการวัดจริง) | ตัดปั๊ม + ตั้งบิตใน D121 |

- สถานะ Fail-safe: Humidifier, Refill, A/B, pH Down = OFF · LED, Fan = 0 % · Air Pump = ON
- เมื่อสื่อสารกลับมาและ Heartbeat เดินอีก ให้ใช้คำสั่งจาก PLC ทันที (เหมือน Gateway เดิม) และกระพริบ LED สถานะ
- Safety limit เป็นข้อจำกัดความปลอดภัย ไม่ใช่ Logic ควบคุม — ต้องเขียนในเอกสารให้นักเรียนรู้ และแจ้งผ่าน D121

### 5.3 ชั้น PLC (Ladder ของนักเรียน)
- Template ต้องมี Rung นับ D202 ทุก 1 s (เช่น ใช้ Clock 1 s ของ PLC + INC) — ถ้าไม่มี MCU จะไม่ยอมสั่ง Output
- Ladder ตรวจ D120 (MCU Heartbeat) และ D121 ได้ ใช้สอนบท Sensor Fault Detection

### 5.4 D121 MCU Status bits (อนุมัติ 2026-11-04 — DEVICE-MAP § 8)
| Bit | ความหมาย |
|---|---|
| 0–7 | Sensor fault: Temp/RH · PPFD · Water Temp · pH · EC · Level · Flow · Power |
| 8 | Refill ถูกตัดเพราะเปิดนานเกิน |
| 9 | ปั๊มโดสถูกตัดเพราะเกินขีดจำกัด |
| 10 / 11 | Float สูง / Float ต่ำ ทำงาน |
| 12 | RTC ยังไม่ได้ตั้งเวลา |
| 15 | เพิ่งออกจาก Fail-safe (เคลียร์หลัง 10 s) |

Sensor เสีย: เขียน**ค่าดีล่าสุด**ต่อและตั้งบิต fault (ไม่เขียนค่าปลอม)

## 6. Checklist ออกแบบ PCB (KiCad)

### ไฟเลี้ยง
- [ ] แหล่งจ่าย 12V (ปั๊ม/พัดลม) → Buck 5V → LDO 3.3V; คำนวณกระแสรวมของปั๊มที่เปิดพร้อมกัน
- [ ] แยก Analog ground (ADS1115, pH, EC, Level) กับ Power ground ต่อกันจุดเดียว (Star ground)
- [ ] Bulk capacitor ใกล้ขั้วต่อปั๊ม, Decoupling 100 nF ทุก IC

### Sensor
- [ ] **pH และ EC ต้องแยกไฟและสัญญาณ (Isolated DC-DC + Isolator)** — ถ้าไม่แยก Probe สองตัวในถังเดียวรบกวนกันจนค่าผิด
- [ ] ระดับแรงดัน: ESP32-S3 เป็น 3.3V — Sensor 5V ต้องมี Level shifter/Divider; ADS1115 จ่าย 3.3V หรือ 5V ให้ตรงช่วงสัญญาณ
- [ ] TVS/ESD และตัวต้านทานอนุกรมที่ขั้วต่อ Sensor ที่สายยาว
- [ ] 1-Wire: Pull-up 4.7 kΩ; I²C: Pull-up 4.7 kΩ (เช็กว่าโมดูลมีอยู่แล้วหรือไม่ อย่าซ้อนจนต่ำเกิน)
- [ ] RS-485: Transceiver 3.3V (เช่น MAX3485), Termination 120 Ω แบบ Jumper, Bias resistor, ขา DE/RE
- [ ] Flow sensor: Pull-up + RC filter กันสัญญาณเด้ง

### Output
- [ ] **ห้ามมีไฟ 220V บนบอร์ดหลัก** — ใช้ Relay/SSR แบบ DIN rail ในตู้แยก (ความปลอดภัยในห้องเรียน)
- [ ] MOSFET แบบ Logic-level (Vgs(th) ต่ำพอที่ 3.3V), Gate resistor + Pull-down
- [ ] Flyback diode ที่ปั๊ม/คอยล์ Relay ทุกตัว
- [ ] Air Pump ต่อขา NC
- [ ] PWM → 0–10V (ถ้าพัดลม/LED Driver ใช้ 0–10V) — ตัดสินใจหลังซื้ออุปกรณ์จริง
- [ ] LED แสดงสถานะทุก Output (ช่วยสอนและ Debug)

### ทั่วไป
- [ ] ESP32-S3 DevKit และ W5500 บน Pin header (เปลี่ยนได้)
- [ ] Terminal block แบบถอดได้ **พิมพ์ชื่อ + Address PLC** ข้างขั้วต่อ (เช่น "M102 REFILL")
- [ ] Test point ที่ 3.3V, 5V, 12V, GND และสัญญาณ Analog
- [ ] รูยึด/ขนาดตามกล่อง; Sensor ที่โดนน้ำใช้ขั้วต่อกันน้ำ
- [ ] ห้ามใช้ Strapping pin / USB pin ขับ Output (§ 5.1)

## 7. Checklist เขียน Firmware

- [ ] **Scaling ตาม DEVICE-MAP ทุกตัว** (×10, ×100) + Clamp ตามช่วงที่ส่ง — เขียนเป็นตารางเดียว มี Unit test
- [ ] **Allowlist การเขียน** D100–D112, D120–D121 เท่านั้น (Unit test เหมือน AC-11)
- [ ] VPD: `es = 0.6108·exp(17.27·T/(T+237.3))` kPa, `VPD = es·(1 − RH/100)`
- [ ] DLI: สะสม `PPFD·dt/1e6` mol/m², รีเซ็ตเที่ยงคืนตาม RTC; เก็บค่าใน NVS เผื่อไฟดับ
- [ ] RTC DS3231 → D111 (นาทีของวัน), D112 (วันนับจากวันปลูกที่ตั้งไว้)
- [ ] pH/EC: ชดเชยอุณหภูมิด้วย D103 (EC ~2 %/°C), Calibration 2 จุด เก็บใน NVS
- [ ] Filter: Median/ค่าเฉลี่ยเคลื่อนที่, ตรวจ Sensor fault (I²C ไม่ตอบ, ค่าเกินช่วงกายภาพ, ค่าค้างนานผิดปกติ)
- [ ] Loop แบบ Non-blocking (ไม่มี `delay()`), Task Watchdog, รอบ Modbus 200 ms
- [ ] Fail-safe ตาม § 5.2 และ Safety limit ตั้งค่าเป็นค่าคงที่รวมที่เดียวพร้อมหน่วย
- [ ] Serial log: สถานะ Modbus, Fail-safe เข้า/ออก, Sensor fault
- [ ] Unit test ส่วนที่ไม่ยุ่งกับ Hardware (Scaling, VPD, DLI, Allowlist, Fail-safe state machine) รันบนเครื่อง (PlatformIO `native`)

## 8. ฝั่ง FX5U (ต้องยืนยันกับเครื่องจริง)

- [ ] Firmware ของ CPU รองรับ Modbus/TCP Slave
- [ ] GX Works3: เพิ่ม MODBUS/TCP Connection Device (Port 502) และตั้ง **Device assignment**: Holding register → D, Coil → M ให้ Address ตรง D100/M101
- [ ] ตรวจพฤติกรรม M ตอน PLC STOP (คาดว่าค้างค่า — จึงต้องมี D202)
- [ ] ทดสอบด้วย Modbus tool บน PC ก่อนต่อ MCU

## 9. แผน Phase (อนุมัติ 2026-11-04 — Checklist อยู่ใน PHASES.md)

| Phase | งาน | เกณฑ์ผ่าน |
|---|---|---|
| H1 Modbus Link | ESP32-S3 + W5500 บน Breadboard ↔ FX5U Slave; เขียน D100 อ่าน M101/D200; Heartbeat D120/D202; Fail-safe เมื่อถอดสาย LAN / PLC STOP (แสดงด้วย LED) | ถอดสาย/STOP แล้วเข้า Fail-safe ≤ 3 s, ต่อกลับแล้วทำงานต่อ; Unit test Scaling/Allowlist ผ่าน |
| H2 Sensor อากาศ/แสง/เวลา | Temp/RH, Water Temp, PPFD, RTC → D100–D103, D109–D112 | ค่าใน GX Works3 Monitor ตรงกับเครื่องวัดอ้างอิงในช่วงที่ยอมรับได้ |
| H3 Sensor น้ำ | pH, EC (Isolation + Calibration + ชดเชยอุณหภูมิ), Level, Flow → D104–D107 | pH/EC ตรงน้ำยามาตรฐาน; จุ่มพร้อมกันแล้วค่าไม่รบกวนกัน |
| H4 Power Meter | RS-485 → D108 | ค่าตรงกับมิเตอร์อ้างอิง |
| H5 Output + Safety | Driver ทุกช่อง, Interlock Hardware, Safety limit, D121 | ทดสอบตาราง Fail-safe ทุกแถวผ่าน |
| H6 PCB (KiCad) | Schematic → Layout → สั่งผลิต จากวงจรที่พิสูจน์แล้วใน H1–H5 | ERC/DRC ผ่าน, ประกอบแล้วผ่านเทสต์ H1–H5 ซ้ำ |
| H7 Integration | ตู้ปลูกจริง + Ladder แบบที่นักเรียนเขียนกับ Sim | รัน 24 ชม. ไม่มี Fail-safe ที่ไม่คาดคิด |
| ภายหลัง | Dashboard ต่อกับต้นแบบ (ต้องแก้ FR-31/SPEC ก่อน) | — |

## 10. คำถามที่ยังเปิดอยู่

- งบประมาณ และ Sensor รุ่นไหน (เกรด Hobby vs Industrial) — ตัดสินก่อน H2
- เก็บ Firmware (`firmware/`, PlatformIO) และไฟล์ KiCad (`hardware/`) ใน repo นี้หรือแยก repo (repo นี้เป็น Public)
- ต้นแบบ M3 เดิม (SLMP Gateway กับ FX5U จริง) ยังทำต่อหรือแทนด้วยแผนนี้
- ขนาดตู้/ถัง (จำนวนต้น, ปริมาตรน้ำ) — ใช้คำนวณขนาดปั๊ม พัดลม LED และ Safety limit
