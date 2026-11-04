---
title: Real Prototype — Connection Flowchart
updated: 2026-11-04
tags: [green-oak, hardware, wiring, mermaid]
---

# Connection Flowchart — ต้นแบบจริง

เกี่ยวข้อง: [HARDWARE.md](HARDWARE.md) · [DEVICE-MAP.md](DEVICE-MAP.md) · ผัง § 1–3 แบบ Obsidian Canvas: [HARDWARE-FLOW.canvas](HARDWARE-FLOW.canvas)

> [!note] ผังภาพรวมการเชื่อมต่อ ยังไม่ใช่ Wiring diagram — เลขขา GPIO และรุ่นอุปกรณ์จริงจะกำหนดตอนทำ H1–H6

## 1. ภาพรวม

```mermaid
flowchart TB
    AC["⚡ 220 VAC"] --> PLC
    AC --> PSU["Power Supply 12 VDC"]
    PSU --> BUCK["Buck 12V → 5V"] --> MCU
    AC --> ESTOP["E-Stop + Fuse<br/>(ตัดเฉพาะไฟโหลด)"] --> OUT

    PC["PC<br/>GX Works3 / Modbus tool"] --- SW["Ethernet Switch"]
    SW --- PLC["FX5U<br/>Modbus TCP Slave :502<br/>Ladder ของนักเรียน"]
    SW --- W5500["W5500"]
    W5500 -- "SPI" --- MCU["ESP32-S3<br/>Modbus TCP Master<br/>Remote I/O + Fail-safe"]

    MCU == "เขียน D100–D112, D120–D121 ทุก 200 ms" ==> PLC
    PLC == "อ่าน M101–M106, D200–D202" ==> MCU

    IN["📥 Sensor ทั้งหมด (§ 2)"] --> MCU
    MCU --> OUT["📤 Actuator ทั้งหมด (§ 3)"]
```

- เส้นหนา `==>` คือข้อมูล Modbus TCP ระหว่าง MCU กับ PLC
- E-Stop ตัดเฉพาะไฟโหลด (ปั๊ม ไฟ พัดลม) ไม่ตัดไฟ MCU และ PLC

## 2. Input — Sensor → ESP32-S3

```mermaid
flowchart LR
    subgraph BUSA["RS-485 บัส A (A / B, 120 Ω ที่ปลายบัส)"]
        WQ["5-in-1 Water Quality (addr 1)<br/>pH → D104 · EC → D105<br/>Water Temp → D103"]
        PAR["PAR sensor RS-485 (addr 2)<br/>PPFD → D102"]
    end
    BUSA --> RS485["TTL to RS485 module"]

    subgraph I2C["I²C bus (SDA / SCL)"]
        SHT["SHT40<br/>Air Temp / RH → D100, D101"]
        RTC["DS3231 RTC<br/>→ D111, D112"]
        ADC["ADS1115"]
    end
    LVL["Level 4–20 mA + R 150 Ω<br/>→ D106"] --> ADC

    MCU["ESP32-S3<br/>คำนวณ VPD → D109, DLI → D110<br/>เขียนทั้งหมดลง PLC"]
    RS485 -- "UART 1" --> MCU
    PZEM["PZEM-004T-100A + CT<br/>Power → D108"] -- "UART 2 (TTL)" --> MCU
    I2C --> MCU
    FLOW["YF-S401<br/>Flow → D107"] -- "Pulse (Divider 5V→3.3V)" --> MCU
    FLH["Float สูง"] -- "GPIO → D121" --> MCU
    FLL["Float ต่ำ"] -- "GPIO → D121" --> MCU
```

- 5-in-1 แยกสัญญาณ pH/EC และชดเชยอุณหภูมิในตัว — ไม่ต้องใช้ Isolator และ DS18B20
- EC เต็มสเกล 2000 µS/cm: ค่า ≥ 1990 ตั้ง D121 bit 13 (เกินช่วงวัด)
- PZEM-004T เป็น TTL ไม่ใช่ RS-485 — ต่อ UART ตรง (สัญญาณ 5V ต้องลดเป็น 3.3V ก่อนเข้า RX)

## 3. Output — ESP32-S3 → Actuator

```mermaid
flowchart LR
    MCU["ESP32-S3<br/>คำสั่งจาก PLC: M101–M106, D200–D201"]
    FUSE["E-Stop + Fuse"]

    MCU -- "GPIO + Pull-down" --> MOS["MOSFET modules (12V)"]
    MCU -- "GPIO + Pull-down" --> REL["Relay module (Opto, 3.3V)"]
    MCU -- "PWM" --> FAN["พัดลม 4-pin PWM — D201"]
    FUSE --> MOS
    FUSE --> REL
    FUSE --> FAN

    MOS --> REFILL["ปั๊มเติมน้ำ — M102"]
    MOS --> NUTA["ปั๊มปุ๋ย A — M103"]
    MOS --> NUTB["ปั๊มปุ๋ย B — M104"]
    MOS --> PHD["ปั๊ม pH Down — M106"]
    MOS -- "PWM" --> LED["Grow Light — D200"]
    REL -- "NC" --> AIR["Air Pump 220V — M105"]
    REL -- "NO" --> HUM["Humidifier — M101"]

    FLH["Float สูง"] -. "ตัดไฟปั๊มโดยตรง<br/>(Hardware interlock)" .-> REFILL
```

- Air Pump ต่อขา **NC** — MCU ค้าง/ไม่มีไฟ ปั๊มลมยังทำงาน
- เส้นประ: Float สูงตัดไฟปั๊มเติมน้ำโดยไม่ผ่าน Software

## 4. ลำดับการต่อและทดสอบ (ตาม Phase)

```mermaid
flowchart TB
    S1["1. ตั้ง FX5U<br/>IP + Modbus/TCP Slave + Device assignment"] --> S2["2. ทดสอบ FX5U ด้วย Modbus tool บน PC"]
    S2 --> S3["3. ต่อ ESP32-S3 + W5500 เข้า Switch<br/>เขียน D100 / อ่าน M101, D200"]
    S3 --> S4["4. ทดสอบ Fail-safe<br/>ถอดสาย LAN, PLC STOP, D202 หยุด"]
    S4 -->|H1 ผ่าน| S5["5. Sensor อากาศ/แสง/เวลา<br/>SHT40, RTC (I²C), PAR (RS-485)"]
    S5 -->|H2 ผ่าน| S6["6. Sensor น้ำ<br/>5-in-1 RS-485, Level, Flow, Float"]
    S6 -->|H3 ผ่าน| S7["7. PZEM-004T Power meter (UART)"]
    S7 -->|H4 ผ่าน| S8["8. Output: MOSFET / Relay / PWM<br/>+ Interlock, E-Stop, Safety limit"]
    S8 -->|H5 ผ่าน| S9["9. ย้ายวงจรลง PCB (KiCad)<br/>ทดสอบ H1–H5 ซ้ำ"]
    S9 -->|H6 ผ่าน| S10["10. ประกอบตู้ปลูกจริง<br/>รัน Ladder 24 ชม."]

    S4 -. "ไม่ผ่าน" .-> S3
```
