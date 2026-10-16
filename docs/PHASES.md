---
title: Development Phases
updated: 2026-10-16
tags: [green-oak, roadmap]
---

# Development Phases

เกี่ยวข้อง: [SPEC.md](SPEC.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

**กติกา**
- ทำทีละ Phase และ**หยุดให้ผู้ใช้ตรวจ**ก่อนเริ่ม Phase ถัดไปทุกครั้ง
- จบ Phase = เกณฑ์ผ่านครบ + `npm test` และ `npm run typecheck` ผ่าน + **git commit** (`phase(Px): …`)
- ถ้าระหว่างทำพบว่าต้องเปลี่ยน Spec ให้แก้เอกสารก่อนแล้วค่อยแก้โค้ด (Maintain)

---

## Milestone 1 — Functional 3D Virtual Plant

### P0 — Specification ✅
- [x] `docs/SPEC.md` ข้อกำหนด + Acceptance Criteria
- [x] `docs/ARCHITECTURE.md` โครงสร้าง, Runtime Loop, Simulation Model
- [x] `docs/DEVICE-MAP.md` Mapping + Access Rules + Fail-safe
- [x] `docs/PHASES.md` (ไฟล์นี้)
- [x] **ผู้ใช้อนุมัติ Spec** และรับ D111/D112/D120 (2026-10-16)

### P1 — Scaffold ✅
- [x] npm workspaces: `packages/shared`, `packages/sim-core`, `apps/server`, `apps/web`
- [x] TypeScript strict, Vitest, `.gitignore`, `.env.example`
- [x] Fastify `/api/health` + WebSocket heartbeat
- [x] Vite + React + Tailwind + R3F แสดงกล่อง 3D และสถานะ WS
- **ผ่านเมื่อ:** `npm run dev` แล้วหน้าเว็บแสดง "Connected" + heartbeat และ `npm test` ผ่าน

### P2 — Environment Model (`sim-core`) ✅
- [x] `SimClock` (dt คงที่, speed, pause, accumulator)
- [x] Tank water balance, Refill, Evaporation
- [x] LED → PPFD (position factor), DLI
- [x] Air temp / RH / Water temp / VPD, EC (salt mass), pH drift, Power
- [x] `defaultConfig.ts` พร้อมหน่วยและคำอธิบาย
- **ผ่านเมื่อ:** Unit tests AC-01, AC-02, AC-06, AC-07

### P3 — Plant Model: Water (`sim-core`) ✅
- [x] PlantState ครบทุก field (FR-20), Root access, Demand/Supply
- [x] Hydration, Water stress, Damage (ถาวร), Recovery, Health
- [x] Growth baseline (logistic) → LeafArea, LeafCount, RootLength, Stage
- [x] `Simulation.step()` รวม Environment + Plants + Sensors
- [x] Leak disturbance + Event detection
- **ผ่านเมื่อ:** Unit tests AC-03, AC-04, AC-05

### P4 — Server, Lab Session, Mock PLC ✅
- [x] `PlcAdapter` interface + write guard, `MockPlcAdapter` (manual / auto / offline)
- [x] `SensorProvider` + `SimulatedSensorProvider`
- [x] `LabSession`, `LabManager`, `EventLog`, `History`
- [x] REST routes + WebSocket snapshot stream
- [x] Scenario `water-shortage` (ระดับน้ำ 65% + รั่ว 1.5 L/h)
- **ผ่านเมื่อ:** Integration tests AC-08, AC-09, AC-10, AC-11

### P5 — Student Dashboard ✅
- [x] Layout 5 ส่วน (FR-50), Zustand store + WS client
- [x] Sensor panel, Actuator panel (manual control / auto mode), Plant detail
- [x] Speed / Pause / Reset, กราฟ (Water level, Hydration, Stress), Event log
- [x] Disclaimer "Educational Simulation"
- [x] Tank cross-section 2D (ระดับน้ำเทียบปลายราก, คลิกเลือกต้น), Scenario panel, Lab selector
- **ผ่านเมื่อ:** ค่าทุกช่องมาจาก Server และทุกปุ่มทำงาน (ตรวจด้วย Browser)

### P6 — 3D DWC Scene ✅
- [x] Tank + lid + water (level จริง) + net pots 6 ใบ + pipes + sensor probes
- [x] Procedural Green Oak + roots + `plantVisuals()` (unit test)
- [x] Actuators: LED (dimmable), Fan (หมุน), Humidifier (หมอก), Pumps, Air bubbles
- [x] Orbit/Zoom/Pan, select plant, click actuator, roots toggle, cutaway, day/night, low graphics
- [x] ดับเบิลคลิกต้นเพื่อซูม, ใบที่เหี่ยวนอนบนฝา, ป้ายชื่ออุปกรณ์, WebGL fallback เป็น 2D
- **ผ่านเมื่อ:** AC-12, AC-13, AC-14

### P7 — M1 Acceptance ✅
- [x] README ภาษาไทย (ติดตั้ง, รัน, ใช้ผ่าน LAN, ทดสอบ, แก้ปัญหา)
- [x] โหมด LAN: Server เสิร์ฟหน้าเว็บที่ build แล้วบนพอร์ตเดียว (`npm run serve`) และแสดง URL ของเครื่อง
- [x] Scenario `water-shortage` ทดสอบครบวงจร (Integration test + Browser)
- [x] ตรวจ AC-01 … AC-15 ครบ (Clean install จากสำเนาที่ไม่มี node_modules: `npm ci` → test 100/100 → build → เปิดผ่าน IP ใน LAN) แล้ว Tag `m1`

> **Milestone 1 เสร็จ 2026-10-16**

---

## Milestone 2 — Plant Behavior Engine

> **สถานะ 2026-10-16: P8 เสร็จ — ผู้ใช้อนุมัติให้ทำ P8–P11 ต่อเนื่อง โดยตรวจและ commit แยก Phase; หยุดตรวจเมื่อจบ P11**
>
> ใช้เลข Phase ต่อจาก M1: **P8 → P9 → P10 → P11 → P12 → P13 → P14 → P15** ทำตามลำดับและหยุดให้ผู้ใช้ตรวจทุก Phase

### ขอบเขตและข้อเสนอสำหรับอนุมัติ

- ครอบคลุม FR-09, FR-25, FR-26, FR-43 และ FR-53: Light/Low Light, Nutrient, Root Stress, Estimated Oxygen Status, Growth/Recovery, Timeline และ Curl
- คง Fixed step, Pure TypeScript, Seeded randomness, Water/Salt mass balance และกฎ Gateway เดิม พารามิเตอร์ Model ทุกตัวต้องมีหน่วยและคำอธิบายใน `defaultConfig.ts`
- **ข้อเสนอ pH:** ปรับ Empirical Drift ให้มีสมดุลและอัตราเข้าใกล้สมดุลที่กำหนดใน Config แทน drift บวกคงที่ไม่สิ้นสุด โดยยังมีผลของ Refill/Dosing และยังจำลอง pH นอกช่วงได้ผ่าน Initial conditions ใน Test ไม่เพิ่ม pH actuator หรือ PLC address ใน M2 และไม่อ้างว่า A/B ควบคุม pH ได้แม่นยำ ต้องกำหนดสูตรและข้อจำกัดใน P8 ก่อนลงมือ P10
- **Estimated Oxygen Status:** ดัชนีไร้หน่วย 0–1 จาก Model ไม่ใช่ค่าจาก DO Sensor และไม่อ้างเป็น mg/L ส่งให้ Browser ผ่าน Snapshot โดยไม่เพิ่ม Sensor Register
- **Low Light:** ลด Growth ตามแสงที่ได้รับ ไม่ทำให้เกิด Water Stress หรือเหี่ยวทันที ช่วงมืดตาม Photoperiod ต้องไม่ถูกตีความเป็นความเสียหายโดยอัตโนมัติ
- **Timeline:** ดูแนวโน้มและ Event ย้อนหลังในหน่วยเวลาจำลองจาก History ใน Memory เลือกช่วงเวลาและต้นได้ ไม่รวมการย้อน Simulation, Replay 3D หรือ Persistence
- ไม่รวม SLMP, Teacher Dashboard, Auth, ฐานข้อมูล หรือ Scenario Library 10 บท ใช้ Test fixtures และขั้นตอนทดลองสำหรับตรวจรับ M2
- ค่า Threshold, Time constant และช่วงเวลาคาดหวังเป็นพารามิเตอร์เพื่อการสอน ต้องกำหนดและบันทึกก่อน Implementation ไม่ถือเป็นค่าชีววิทยาที่ผ่านการปรับเทียบ

### P8 — M2 Specification & Model Contract ✅

- [x] แก้ `SPEC.md` เพิ่มขอบเขต M2 และ AC-16 เป็นต้นไป พร้อม Traceability ไป FR และ Phase ที่ตรวจรับ
- [x] เพิ่ม Design ใน `ARCHITECTURE.md`: State/หน่วย/ช่วงค่า, สูตร Stress/Growth/Recovery, ลำดับ Step และความสัมพันธ์กับ Water/Salt balance
- [x] กำหนด Light exposure, Low Light, EC/pH response, Oxygen/Root Health, การรวม Stress และ Damage โดยหลีกเลี่ยงการนับผลซ้ำ
- [x] สรุปแนวทาง pH ข้างต้น รวม Initial conditions และสภาวะอ้างอิงที่พืชเติบโตได้ระยะยาว
- [x] กำหนด Data contract สำหรับ Snapshot/History/Events, ความหมาย Timeline, ขอบเขตการเก็บข้อมูล และการ Reset
- [x] จัด Test matrix: สภาวะเหมาะสม, Stress แยกชนิด, หลาย Stress พร้อมกัน, ฟื้นทัน/ฟื้นช้า, ข้ามเที่ยงคืน, ถังแห้ง, Pause/Reset และ Determinism
- **ผ่านเมื่อ:** แต่ละ AC มี Setup, Input, ระยะเวลาจำลอง, Expected result และ tolerance เชิงตัวเลข; แต่ละพารามิเตอร์มีหน่วย/ช่วง/เหตุผล; ประเด็น pH และ Timeline มีข้อสรุป; ดำเนินต่อ P9 ตามคำสั่งผู้ใช้ที่อนุมัติ P8–P11 ต่อเนื่อง
- **ขอบเขต:** เอกสารเท่านั้น ไม่แก้ Runtime ใน Phase นี้

- **ผลตรวจ:** Baseline tests 100/100 และ typecheck ผ่าน (WebSocket tests ต้องรันนอก sandbox ที่บล็อก localhost); ไม่มีการแก้ Runtime

### P9 — Light Stress & Low Light

- [ ] เพิ่มการสะสมและลด Light Stress ตาม PPFD รายต้น ความร้อน และสถานะน้ำ ด้วยเวลาจำลอง
- [ ] ปรับ Light growth factor และ Low Light ตาม Contract ใน P8 รวมพฤติกรรม DLI ที่เปลี่ยนวัน
- [ ] เพิ่ม Config และ Unit tests ของกลไกแสง โดยแยกตัวแปรน้ำ/อุณหภูมิในการเปรียบเทียบ
- **ผ่านเมื่อ:** PPFD สูงช่วงสั้นไม่ทำให้ Hydration/ภาพเหี่ยวกระโดด; Exposure ต่อเนื่องเพิ่ม Light Stress; ลดแสงแล้ว Stress ค่อยลด; Low Light ให้ Biomass เพิ่มน้อยกว่ากลุ่มควบคุมในเวลาเท่ากัน; Photoperiod ปกติไม่เกิด Damage เพียงเพราะกลางคืน; ค่าทั้งหมดอยู่ในช่วงที่กำหนด

### P10 — Nutrient Stress & pH Behavior

- [ ] ปรับ pH Model ตาม Spec ที่ผ่านการตรวจใน P8 พร้อมทดสอบระยะยาว
- [ ] คำนวณ Nutrient Stress จาก EC ต่ำ/สูงและ pH นอกช่วง รวมเวลาสะสมและการฟื้น
- [ ] นำ Nutrient factor เข้า Growth ตาม Contract โดยคง Salt mass balance และข้อจำกัด A/B
- [ ] เพิ่ม Config และ Unit tests แยก EC/pH เพื่อยืนยันสาเหตุ
- **ผ่านเมื่อ:** EC/pH ที่เหมาะสมมี Stress ต่ำกว่ากรณีผิดช่วง; Stress ทำให้ Growth ลดและค่อยฟื้นเมื่อสภาพดีขึ้น; Default pH ไม่ drift ไปชน Clamp โดยไม่มีสมดุลในรัน 30 วัน; Refill/Dosing มีผลตาม Spec และไม่มีการเพิ่มหรือลดเกลือเพื่อบังคับ EC ให้เหมาะสมเอง

### P11 — Root Stress & Estimated Oxygen Status

- [ ] เพิ่ม Oxygen Model จาก Air Pump, Water Temperature และ Water Level ตาม P8
- [ ] คำนวณ Root Stress/Root Health และผลต่อ Water uptake โดยใช้ Root access และน้ำที่ถังจ่ายได้จริงร่วมกัน
- [ ] เพิ่ม Config และ Unit tests รวมกรณีถังแห้ง น้ำร้อน เปิด/ปิด Air Pump และรากยาวต่างกัน
- **ผ่านเมื่อ:** ปิด Air Pump ต่อเนื่องในสภาวะทดสอบทำให้ Oxygen/Root Health ลดและ Uptake ลด แม้น้ำยังถึงราก; เปิดใหม่แล้วค่อยฟื้น; อุณหภูมิน้ำมีผลตามทิศทางที่กำหนด; ปั๊มอากาศไม่แก้อาการรากพ้นน้ำ; ไม่มี NaN/Infinity เมื่อถังแห้ง และ Uptake รวมไม่เกินน้ำที่มีให้ใช้

### P12 — Integrated Growth, Damage & Recovery

- [ ] รวม Water/Light/Nutrient/Root effects เข้า Growth และ Health ในจุดเดียวตามสูตร P8
- [ ] รวมการสะสม Damage ถาวรและข้อจำกัดในการฟื้น; จัดลำดับ Step ให้ผลระหว่าง Environment/Plants สอดคล้องกัน
- [ ] เพิ่ม Test แบบหลาย Stress, Recovery ทันเวลา/ล่าช้า และ Healthy reference 30 วัน
- [ ] ตรวจ Determinism ด้วย Seed และ Command schedule ตามเวลาจำลองเดียวกัน แบ่ง Tick ต่างกันที่ 1x/60x/360x โดยควบคุม Noise
- **ผ่านเมื่อ:** กลุ่ม Healthy เติบโตตามช่วงที่ P8 กำหนด; กลุ่ม Stress โตช้ากว่า; ฟื้นทันมี Damage ใกล้ศูนย์ตาม tolerance; ฟื้นช้า Damage ไม่ลดและเพดาน Health/Growth ต่ำลง; ทุก State มีขอบเขตและไม่มีค่าผิดปกติ; ผลไม่เปลี่ยนเพราะการแบ่ง Tick; M1 regression ผ่าน

### P13 — Server Data Flow, Events & History

- [ ] ส่ง State/Diagnostics ใหม่ผ่าน Shared types และ Snapshot ไป Browser โดย Calculation ยังอยู่ใน `sim-core`
- [ ] เพิ่ม Event เริ่ม/คลาย Stress แต่ละชนิดพร้อม Hysteresis ป้องกัน Event ซ้ำทุก Step
- [ ] ขยาย History สำหรับ Growth/Stress รายต้นและ Oxygen ตาม Contract โดยจำกัดจำนวนข้อมูลใน Memory
- [ ] Integration tests: Sim → LabSession → REST/WS/History, Reset, สลับ/แยก Lab, Pause และ Fail-safe
- **ผ่านเมื่อ:** Snapshot/History ตรงกับ State ของต้นและเวลาจำลองที่บันทึก; Event เกิดเมื่อข้าม Threshold และไม่ Spam; Pause ไม่สร้างความคืบหน้าของ Model/History; Reset ล้างข้อมูลรอบเก่า; Lab ไม่ปะปน; PLC Allowlist และ Fail-safe เดิมยังผ่าน

### P14 — Plant Diagnostics, Timeline, Growth Chart & Curl

- [ ] แสดง Stress, Root Health และ Estimated Oxygen Status พร้อมคำอธิบายไทยและหน่วยที่ถูกต้อง
- [ ] เพิ่ม Growth chart รายต้นและ Timeline เลือกช่วงเวลาพร้อม Event จาก Server History ตามขอบเขต P8
- [ ] ต่อ Light Stress เข้า `plantVisuals.ts` และ Curl ของใบ พร้อมทดสอบ Mapping; คง Droop จาก Water Stress/Damage
- [ ] ตรวจ Browser ทั้ง 3D, 2D fallback, Low Graphics, เลือกต้น, สลับ Lab, Pause และ Reset
- **ผ่านเมื่อ:** กราฟ/ค่าตรงกับ Payload และต้นที่เลือก; ข้อมูลว่าง/หลัง Reset แสดงถูกต้อง; Curl เพิ่ม/ลดตาม State จาก Server; PPFD สูงอย่างเดียวไม่สั่งเหี่ยวทันที; ทุก Control ใช้งานได้และไม่มี Client คำนวณพฤติกรรมพืชเอง

### P15 — M2 Acceptance & Handoff

- [ ] ตรวจ AC ของ M2 ทุกข้อ พร้อมหลักฐาน Automated tests และ Browser checks ที่เหมาะสม
- [ ] ตรวจครบวงจร: Healthy growth, High/Low Light, EC/pH ผิดช่วง, Air Pump OFF/ON, Water shortage และ Recovery ทัน/ล่าช้า โดยบันทึกวิธีตั้งสภาวะและผลที่คาดหวัง
- [ ] รัน `npm test`, `npm run typecheck` และ `npm run build`; ตรวจรันโหมดห้องเรียนและ Regression ของ M1
- [ ] อัปเดต README, SPEC checklist, ARCHITECTURE Implementation Notes, PHASES และสถานะ AGENTS พร้อมข้อจำกัดที่เหลือ
- **ผ่านเมื่อ:** AC ของ M2 ผ่านครบและ M1 ไม่ถดถอย; คู่มือทำซ้ำการทดลองได้; commit `phase(P15): ...`; หลังผู้ใช้ตรวจรับจึง tag `m2`

### กติกาตรวจรับและงานถัดไป

- ทุก Phase: ทำให้เกณฑ์ผ่านครบ → `npm test` + `npm run typecheck` → อัปเดต Checklist/AC/Implementation Notes ตามจริง → commit `phase(Px): ...` → หยุดให้ผู้ใช้ตรวจ
- Unit tests ของแต่ละกลไกทำใน Phase นั้น ไม่เลื่อนไปรวมท้าย Milestone
- P8 เสร็จ; งานถัดไป P9 → P10 → P11 ตามคำสั่งผู้ใช้ แล้วหยุดตรวจ; P12–P15 ยังไม่เริ่ม

---

## Milestone 3–5 (แตก Phase ละเอียดเมื่อถึงรอบ)

| Milestone | Phase คร่าว ๆ |
|---|---|
| M3 One Real FX5U | SLMP 3E Binary client · Batch R/W · Reconnect/Timeout/Heartbeat · Communication Monitor UI · ทดสอบกับ FX5U จริง · Ladder examples |
| M4 Multi-Lab Classroom | 10 LabSession + Config IP · Auth/สิทธิ์ · Teacher Dashboard · SQLite · Concurrent connection test |
| M5 Advanced | Scenario library 10 บท + metrics · Experiment logging/export · Performance evaluation · Real sensor provider architecture |
