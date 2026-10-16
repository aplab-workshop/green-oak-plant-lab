---
title: Green Oak Virtual Plant Lab — Specification
version: 0.1 (P0 draft)
status: draft — รอผู้ใช้อนุมัติ
updated: 2026-10-16
tags: [green-oak, spec]
---

# Green Oak Virtual Plant Lab — Specification

> [!info] เอกสารชุดนี้
> - **SPEC.md** (ไฟล์นี้) — ปัญหา ขอบเขต ข้อกำหนด และเกณฑ์ตรวจรับ
> - [ARCHITECTURE.md](ARCHITECTURE.md) — โครงสร้าง Software, Data Flow, Simulation Model
> - [DEVICE-MAP.md](DEVICE-MAP.md) — PLC Memory Mapping และ Scaling
> - [PHASES.md](PHASES.md) — Roadmap แบ่ง Phase พร้อม Checklist

---

## 1. Problem Statement

ห้องเรียนมี **Mitsubishi FX5U 10 เครื่อง** และนักเรียน 10 คน แต่ยัง**ไม่มีชุดปลูก Hydroponics จริง** นักเรียนจึงเขียน Ladder Diagram ได้ แต่ไม่มีระบบจริงให้ควบคุมและเห็นผลลัพธ์

**แนวทางแก้:** สร้าง Web Application ที่จำลองระบบปลูกผักสลัด Green Oak แบบ Deep Water Culture (DWC) บน Server โดย
1. Simulation คำนวณค่า Sensor แล้วส่งไปที่ PLC
2. Ladder ของนักเรียนตัดสินใจ แล้วส่งคำสั่ง Actuator กลับมา
3. Simulation คำนวณสภาพแวดล้อมและพฤติกรรมพืชจากคำสั่งนั้น
4. นักเรียนเห็นผลในโมเดล 3D แบบ Interactive ส่วนครูดูทุก Lab ได้จาก Dashboard กลาง

> [!warning] ขอบเขตทางวิชาการ
> แบบจำลองพืชเป็น **Educational Simulation** ใช้สมการที่อธิบายได้และพารามิเตอร์ที่ปรับเทียบได้ **ไม่ใช่**โมเดลทำนายชีววิทยาที่ผ่านการตรวจสอบความแม่นยำ ข้อความนี้ต้องแสดงใน UI ด้วย

## 2. Users

| User | ความต้องการหลัก |
|---|---|
| **Student** (10 คน) | ดู Sensor, ดูสถานะ Actuator ที่ PLC สั่ง, ดูผัก 3D ตอบสนองต่อ Ladder ของตน, ดูกราฟและ Event Log |
| **Teacher** | ดูภาพรวมทั้ง 10 Lab, ส่ง Scenario/Disturbance, Reset Lab, ดูประวัติการทดลอง |
| **Developer/Maintainer** | ปรับพารามิเตอร์ Model, เพิ่ม Adapter (SLMP, Real Sensor, MQTT) โดยไม่กระทบส่วนอื่น |

## 3. Priority

**Functional Simulation > Correct Data Flow > Educational Value > 3D Visual Quality**

เมื่อสองข้อขัดกัน ให้เลือกข้อที่อยู่ทางซ้าย

## 4. Scope by Milestone

| Milestone | เนื้อหา | สถานะ |
|---|---|---|
| **M1** Functional 3D Virtual Plant | Web App, 3D DWC 6 ต้น, Sensor Dashboard, Mock Actuator, Water Balance, Water Shortage Behavior, ทำงานโดยไม่มี PLC | **รอบนี้** |
| M2 Plant Behavior Engine | Growth Model เต็ม, Light/Nutrient/Root Stress, Recovery, Timeline, Unit Tests | ถัดไป |
| M3 One Real FX5U | SLMP 3E Gateway, Communication Monitor, PLC-in-the-Loop กับเครื่องจริง 1 เครื่อง | |
| M4 Multi-Lab Classroom | 10 PLC, 10 Lab, Student/Teacher Dashboard, Concurrent Test | |
| M5 Advanced | Scenario Management, Data Logging, Performance Evaluation, Real Sensor Architecture | |

### 4.1 M1 — In Scope

- Monorepo โครงสร้างพร้อมต่อยอดถึง M5 (มีแค่ Interface/โฟลเดอร์สำหรับส่วนที่ยังไม่ทำ)
- Simulation Engine บน **Server** แบบ Fixed Time-Step
- Simulation Clock: 1x / 60x / 360x, Pause / Resume, Reset
- Environment Model ขั้นพื้นฐาน: Water Mass Balance, Refill Pump, LED → PPFD/DLI, Air Temp/RH/VPD, Water Temp, EC จาก Salt Mass Balance, Power
- Plant Model ขั้นพื้นฐาน: Hydration, Water Stress, Accumulated Damage, Recovery, Growth อย่างง่าย, Root Length, Health Score
- **Mock PLC Adapter** 2 โหมด
  - `manual` — ผู้ใช้กดสั่ง Actuator จาก UI (แทน Ladder)
  - `auto` — Logic ตัวอย่างในตัว (เช่น Refill แบบ Hysteresis) เพื่อสาธิต Closed-Loop
- WebSocket ส่ง State แบบ Real-time ไปที่ Browser
- Student Dashboard (1 Lab): Header, Sensor Panel, 3D Viewer, Actuator Panel, Plant Detail, กราฟ, Event Log, Speed Control, Reset
- 3D DWC Scene แบบ Procedural: ถัง ฝา Net Pot 6 ใบ, ผัก Green Oak ใบหยัก, ราก, ระดับน้ำ, LED, Fan, Humidifier, Refill/Nutrient A/B/Air Pump, ฟองอากาศ, ท่อ และจุด Sensor
- 3D Interaction: Orbit/Zoom/Pan, คลิกเลือกต้น, คลิก Actuator, Toggle Roots, Cutaway/Transparent Tank, Day/Night, Low Graphics Mode
- Unit Tests (sim-core) และ Integration Test (Sim → Mock PLC → Sim)
- README ภาษาไทย และ `.env.example`

### 4.2 M1 — Out of Scope (ทำใน Milestone ถัดไป)

- การเชื่อมต่อ SLMP กับ FX5U จริง (M3) — M1 มีเฉพาะ `PlcAdapter` interface กับ `MockPlcAdapter`
- Light / Nutrient / Root Stress แบบเต็ม, pH Model แบบละเอียด (M2) — M1 คำนวณค่าเหล่านี้เพื่อแสดงผล แต่ยังไม่ส่งผลต่อพืชครบทุกกลไก
- 10 Lab พร้อมกันบน UI, Teacher Dashboard, Login/สิทธิ์ผู้ใช้ (M4) — Backend ของ M1 รองรับหลาย Lab ในระดับโครงสร้างแล้ว
- SQLite persistence, Scenario Library 10 บท, Performance Metrics (M5) — M1 มีแค่ Event Log ใน Memory และ Scenario `water-shortage` 1 บทสำหรับทดสอบ
- MQTT, InfluxDB, Real Sensor (Phase 2 ของโครงการ)
- Plant 12 ต้น (M1 ใช้ 6 ต้น แต่จำนวนต้นอยู่ใน Config)

## 5. Functional Requirements

รหัส `FR-xx` ใช้อ้างอิงใน Test และ Commit, คอลัมน์ **M** = Milestone ที่ต้องทำเสร็จ

### 5.1 Simulation Core

| ID | Requirement | M |
|---|---|---|
| FR-01 | Simulation ใช้ **Fixed Time-Step** (ค่าเริ่มต้น `dt = 1 s` เวลาจำลอง) และผลลัพธ์ไม่ขึ้นกับ FPS ของ Browser หรือ Tick Rate ของ Server | M1 |
| FR-02 | แยก **Real Time** กับ **Simulated Time** และรองรับ Speed 1x / 60x / 360x, Pause, Resume, Reset | M1 |
| FR-03 | **Water Mass Balance**: `dV/dt = Q_refill − ΣT_plant − E_evap` และ Volume ต้องอยู่ในช่วง `[0, V_max]` (น้ำเกินถือว่าล้น) | M1 |
| FR-04 | Refill Pump ON แล้วระดับน้ำเพิ่มขึ้นและ Water Flow > 0 ส่วนปั๊ม OFF แล้ว Flow = 0 | M1 |
| FR-05 | LED Brightness 0–100% ควบคุม PPFD ของแต่ละต้นตามตำแหน่ง (Position Factor) และ **DLI** สะสมจาก PPFD ตามเวลาจำลอง (Reset ตอนเที่ยงคืนเวลาจำลอง) | M1 |
| FR-06 | Air Temp / RH เปลี่ยนแบบ First-Order ตาม Fan, Humidifier, LED Heat และ Ambient ไม่กระโดดทันที | M1 |
| FR-07 | **VPD** คำนวณจาก Air Temp และ RH (Tetens) และแสดงว่าเป็นค่าประมาณจากอากาศ | M1 |
| FR-08 | **EC** คำนวณจาก Salt Mass / Volume ทำให้น้ำระเหยแล้ว EC เพิ่ม Refill แล้วเจือจาง และ Nutrient A+B เพิ่ม Salt Mass | M1 |
| FR-09 | pH ใช้ Empirical Drift อย่างง่าย และ**ห้าม**ทำให้เข้าใจว่า Nutrient A/B ควบคุม pH ได้แม่นยำ | M1 (basic) / M2 |
| FR-10 | Power Consumption = ผลรวม Rated Power ของ Actuator ที่ทำงาน (LED ตาม Brightness) | M1 |
| FR-11 | ค่า Sensor มาจาก State ของ Model เท่านั้น อาจมี Noise เล็กน้อยได้แต่ต้องไม่ใช่ค่าสุ่มล้วน | M1 |

### 5.2 Plant Behavior

| ID | Requirement | M |
|---|---|---|
| FR-20 | Plant แต่ละต้นมี State ของตัวเอง: Age, Growth Stage, Biomass, Leaf Count, Leaf Area, Root Length, Hydration, Water/Light/Nutrient Stress, Root Health, Accumulated Damage, Health Score | M1 (โครงครบ) |
| FR-21 | ทุกต้นใช้น้ำในถังเดียวกัน แต่ PPFD ต่างกันได้ตามตำแหน่ง | M1 |
| FR-22 | **Root Water Access**: สัดส่วนรากที่แช่น้ำขึ้นกับ Water Level เทียบกับ Root Length ทำให้ต้นที่รากสั้นขาดน้ำก่อน | M1 |
| FR-23 | **Water Stress** เพิ่มขึ้นเมื่อ Uptake < Demand ต่อเนื่อง และลดลงเมื่อน้ำกลับมาพอ (Recovery) | M1 |
| FR-24 | **Accumulated Damage** เพิ่มเมื่อ Stress เกิน Threshold นาน เป็นค่าถาวรที่ลดลงไม่ได้ และจำกัด Health/Growth สูงสุดที่ฟื้นได้ | M1 |
| FR-25 | Growth ขึ้นกับ Light, Water, Temperature และ Damage (M1 เป็นสูตร Logistic อย่างง่าย) | M1 (basic) / M2 |
| FR-26 | Light Stress จากแสง + ความร้อน + น้ำสะสม (**ห้าม**เหี่ยวทันทีเพียงเพราะ PPFD สูง), Low Light, Nutrient (EC/pH), Root Stress (Water Temp, Level, Air Pump → Estimated O₂) | M2 |
| FR-27 | พารามิเตอร์ทั้งหมดอยู่ในไฟล์ Config แยก พร้อมหน่วยและคำอธิบาย | M1 |

### 5.3 PLC Communication

| ID | Requirement | M |
|---|---|---|
| FR-30 | `PlcAdapter` interface เดียวสำหรับ Mock และ SLMP ประกอบด้วย `connect`, `writeSensors`, `readCommands`, `status` | M1 (interface + mock) |
| FR-31 | Gateway **เขียน**เฉพาะ Sensor Registers (D100–D110) และ**อ่าน**เฉพาะ Command Devices (M100–M105, D200) **ห้ามเขียน M Device เด็ดขาด** | M1 (บังคับใน interface) / M3 |
| FR-32 | Command ที่อ่านได้ต้องมี Timestamp หาก Command เก่ากว่า `COMMAND_TIMEOUT` ให้ Simulation เข้า **Fail-safe** (Actuator ทั้งหมด OFF ยกเว้น Air Pump ON) และบันทึก Event | M1 (logic) / M3 |
| FR-33 | ตรวจ Range ของค่าก่อนเขียน (Clamp ใน INT16) และตรวจ Range ของ D200 (0–100) ที่อ่านกลับ | M1 |
| FR-34 | SLMP 3E Frame (Binary) ผ่าน TCP, Batch Read/Write, Timeout, Auto-Reconnect, Heartbeat, Poll 500 ms (ปรับได้) | M3 |
| FR-35 | Browser **ห้าม**เชื่อม PLC โดยตรง Gateway ทำงานบน Server ใน LAN เท่านั้น | M1 (โดยโครงสร้าง) |

### 5.4 Lab & Real-time

| ID | Requirement | M |
|---|---|---|
| FR-40 | `LabSession` แต่ละ Lab มี Clock, Environment, Plants, Adapter, Event Log ของตัวเอง และ Lab หนึ่งเปลี่ยน State ของอีก Lab ไม่ได้ | M1 (backend) / M4 (UI) |
| FR-41 | WebSocket ส่ง Snapshot ของ Lab ที่ Subscribe (~5 Hz) และ Client สั่งงานผ่านข้อความที่ผ่าน Validation | M1 |
| FR-42 | Reset Lab หนึ่งไม่กระทบ Lab อื่น | M1 |
| FR-43 | Event Log บันทึก: Actuator เปลี่ยนสถานะ, Stress เกิน Threshold, Damage เริ่มเกิด, Comm Status, Reset, Speed Change | M1 |

### 5.5 Frontend

| ID | Requirement | M |
|---|---|---|
| FR-50 | Student Dashboard Layout: Header / Left Sensor / Center 3D / Right Actuator + Plant Detail / Bottom Timeline + Chart + Log | M1 |
| FR-51 | 3D Viewer: Orbit 360°, Zoom, Pan, คลิกเลือกต้น, คลิก Actuator ดูสถานะและ Address PLC | M1 |
| FR-52 | Toggle Roots, Cutaway/Transparent Tank, Day/Night, Low Graphics Mode | M1 |
| FR-53 | Visual ของพืชมาจาก State ผ่าน Mapping Function: Droop, Curl, Color, Scale, Root Length, Wilt/Recovery แบบ Interpolate ลื่นไหล | M1 (droop/wilt/color/size/root) / M2 (curl) |
| FR-54 | ระดับน้ำ 3D ตรงกับ Water Level จริง ส่วน Animation ของ Fan, ฟองอากาศ และ LED ต้องตรงกับสถานะ Actuator | M1 |
| FR-55 | ปุ่มทุกปุ่มต้องทำงานจริง ห้ามมี Placeholder ที่กดแล้วไม่เกิดอะไร (ฟีเจอร์ที่ยังไม่มีไม่ต้องแสดง) | M1 |
| FR-56 | UI ใช้ศัพท์เทคนิคภาษาอังกฤษ คำอธิบายภาษาไทย และใช้โทน White / Light Gray / Emerald / Dark Slate | M1 |
| FR-57 | Teacher Dashboard: Grid Lab 01–10, Status, Health, Water, Scenario, Alarm, ส่งโจทย์, Reset | M4 |

## 6. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | ทำงานบน PC ห้องเรียนทั่วไป มี Low Graphics Mode และ 3D ≥ 30 FPS บน Integrated GPU (Low mode) |
| NFR-02 | Server รับ 10 Lab ที่ 360x ได้โดย CPU ไม่เกิน 1 core (ประมาณ 3,600 steps/s รวม) |
| NFR-03 | Calculation ของพืช (`sim-core`) **ไม่ import** อะไรจาก React/Three.js และทดสอบได้ด้วย Node ล้วน |
| NFR-04 | เปลี่ยน `SensorProvider` (Simulated → Real) และ `PlcAdapter` (Mock → SLMP) ได้โดยไม่แก้ 3D Renderer |
| NFR-05 | Server ใช้ใน LAN เท่านั้น ไม่เปิด PLC สู่ Public Internet และ Bind host ผ่าน `.env` |
| NFR-06 | TypeScript `strict` ทั้ง Repo, Unit Test ด้วย Vitest และ `npm test` ต้องผ่านก่อน Commit จบ Phase |
| NFR-07 | ติดตั้งและรันบน Windows ด้วย Node.js ≥ 20 (เครื่องพัฒนาใช้ v24.14) |

## 7. Simulation Time & PLC Timer Limitation

PLC จริงนับ Timer (T/ST) ตาม **เวลาจริง** แต่ Simulation เร่งได้ถึง 360x

**ตัวอย่างปัญหา:** Ladder สั่ง Refill Pump 10 วินาทีด้วย Timer ที่ 360x จะเท่ากับปั๊มทำงาน 1 ชั่วโมงในโลกจำลอง

**แนวทาง:**
- บทเรียนที่ Logic ขึ้นกับ Timer ให้รันที่ **1x** และ UI แสดงคำเตือนเมื่อเร่งเวลาขณะต่อ PLC จริง
- บทเรียนแบบ Threshold/Hysteresis (เช่น Refill ตามระดับน้ำ) เร่งเวลาได้ เพราะ Logic ไม่ขึ้นกับเวลา
- Refill flow rate ในโหมดเร่งต้องเลือกให้ Hysteresis ยังทำงานได้ ไม่ใช่น้ำเต็มภายใน Poll เดียว (ตรวจใน M3)
- **Real Control Mode ห้ามเร่งเวลา** (Phase 2)

## 8. Acceptance Criteria — Milestone 1

M1 ผ่านเมื่อทุกข้อเป็นจริง (ข้อที่มี 🧪 ต้องเป็น Automated Test)

- [ ] AC-01 🧪 ระดับน้ำลดลงตามเวลาเมื่อ Refill OFF (FR-03)
- [ ] AC-02 🧪 Refill Pump ON ทำให้ระดับน้ำเพิ่มขึ้นและไม่เกิน 100% (FR-03, FR-04)
- [ ] AC-03 🧪 เมื่อรากขาดน้ำนานพอ Water Stress เพิ่มขึ้นและ Hydration ลดลง (FR-22, FR-23)
- [ ] AC-04 🧪 เมื่อเติมน้ำทันเวลา Water Stress ลดลงและ Damage ≈ 0 (FR-23)
- [ ] AC-05 🧪 เมื่อขาดน้ำนานเกิน Threshold Damage > 0 และหลังเติมน้ำแล้ว Damage ไม่ลดลง (FR-24)
- [ ] AC-06 🧪 LED Brightness มีผลต่อ PPFD และ DLI (0% → PPFD 0, DLI ไม่เพิ่ม) (FR-05)
- [ ] AC-07 🧪 ผลลัพธ์เท่ากัน (ภายใน tolerance) ไม่ว่าจะเดิน 3600 step ทีละ 1 หรือแบ่งเป็นหลาย Tick (FR-01)
- [ ] AC-08 🧪 Lab 01 เปลี่ยนแปลงหรือ Reset แล้ว State ของ Lab 02 ไม่เปลี่ยน (FR-40, FR-42)
- [ ] AC-09 🧪 Integration: Sim → MockPlc(auto) → Sim รักษาระดับน้ำอยู่ในช่วง Hysteresis ได้ใน 3 วันจำลอง
- [ ] AC-10 🧪 Command หมดอายุ → Fail-safe ทำงานและ Simulation ยังเดินต่อ (FR-32)
- [ ] AC-11 🧪 Adapter ไม่มีทางเขียน M Device (Type-level และ Runtime guard) (FR-31)
- [ ] AC-12 เปิดเว็บแล้วเห็น 3D ถัง + ผัก 6 ต้น และค่า Sensor อัปเดต Real-time
- [ ] AC-13 ปิด Refill และเร่ง 360x แล้วเห็นน้ำลด ใบตก จนเหี่ยว จากนั้นเปิด Refill แล้วเห็นใบฟื้น (ต้นที่เสียหายมากฟื้นไม่เต็ม)
- [ ] AC-14 Interaction ครบตาม FR-51, FR-52 และไม่มีปุ่ม Placeholder
- [ ] AC-15 `npm install` → `npm run dev` ตาม README ภาษาไทยได้บนเครื่อง Windows สะอาด

## 9. Assumptions

- Sensor ที่ใช้คือ Virtual ทั้งหมด หาก Phase 2 ใช้ BH1750 (Lux) ต้องปรับเทียบเป็น PPFD ก่อน
- ไม่มี Leaf Temperature Sensor ดังนั้น VPD เป็นค่าประมาณจากอากาศ
- ไม่มี DO Sensor ดังนั้น Root Oxygen เป็น **Estimated Oxygen Status** (M2)
- FX5U เปิด SLMP (3E Binary) บน Built-in Ethernet และพอร์ตจะกำหนดตอน M3 ต้องทดสอบกับเครื่องจริงก่อนใช้ในห้องเรียน
- Indoor Growing ไม่มีแสงแดด แสงทั้งหมดมาจาก LED และ "Day/Night" ใน UI คือภาพบรรยากาศตามเวลาจำลอง ส่วน LED ยังคุมโดย PLC

## 10. Glossary

| Term | ความหมาย |
|---|---|
| DWC | Deep Water Culture ปลูกโดยให้รากแช่ในสารละลายที่เติมอากาศ |
| PPFD | Photosynthetic Photon Flux Density (µmol/m²/s) ความเข้มแสงที่พืชใช้ได้ |
| DLI | Daily Light Integral (mol/m²/day) ผลรวมแสงต่อวัน = Σ PPFD·dt / 10⁶ |
| VPD | Vapor Pressure Deficit (kPa) แรงดึงไอน้ำของอากาศ ยิ่งสูงพืชยิ่งคายน้ำมาก |
| EC | Electrical Conductivity (mS/cm) บ่งบอกความเข้มข้นรวมของธาตุอาหาร ไม่บอกชนิดธาตุ |
| SLMP | Seamless Message Protocol ของ Mitsubishi (MC Protocol) ใช้ 3E Frame |
| Fail-safe | สถานะปลอดภัยเมื่อสื่อสารหลุด |
| Fixed Time-Step | เดิน Simulation ทีละ dt คงที่ ไม่ขึ้นกับความเร็วเครื่อง |
