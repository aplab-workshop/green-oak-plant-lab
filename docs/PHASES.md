---
title: Development Phases
updated: 2026-10-18
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

> **สถานะ 2026-10-18: P8–P15 และส่วนต่อ P16–P21 เสร็จ (Garden Game v2: P22–P25 ยังไม่เริ่ม) — รอผู้ใช้ตรวจ Layout/อุปกรณ์ และ Dashboard/คะแนน/Game Over และตรวจรับก่อน tag `m2`; ยังไม่เริ่ม M3**
>
> ใช้เลข Phase ต่อจาก M1: **P8 → P9 → P10 → P11 → P12 → P13 → P14 → P15** ทำตามลำดับและหยุดให้ผู้ใช้ตรวจทุก Phase

### ขอบเขตที่ใช้ดำเนินงาน (ผู้ใช้อนุมัติ P8–P11 และ P12–P15 ต่อเนื่อง)

- ครอบคลุม FR-09, FR-25, FR-26, FR-43 และ FR-53: Light/Low Light, Nutrient, Root Stress, Estimated Oxygen Status, Growth/Recovery, Timeline และ Curl
- คง Fixed step, Pure TypeScript, Seeded randomness, Water/Salt mass balance และกฎ Gateway เดิม พารามิเตอร์ Model ทุกตัวต้องมีหน่วยและคำอธิบายใน `defaultConfig.ts`
- **แนวทาง pH (ทำแล้วใน P10):** ปรับ Empirical Drift ให้มีสมดุลและอัตราเข้าใกล้สมดุลที่กำหนดใน Config แทน drift บวกคงที่ไม่สิ้นสุด โดยยังมีผลของ Refill/Dosing และยังจำลอง pH นอกช่วงได้ผ่าน Initial conditions ใน Test ไม่เพิ่ม pH actuator หรือ PLC address ใน M2 และไม่อ้างว่า A/B ควบคุม pH ได้แม่นยำ ต้องกำหนดสูตรและข้อจำกัดใน P8 ก่อนลงมือ P10
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

### P9 — Light Stress & Low Light ✅

- [x] เพิ่มการสะสมและลด Light Stress ตาม PPFD รายต้น ความร้อน และสถานะน้ำ ด้วยเวลาจำลอง
- [x] ปรับ Light growth factor และ Low Light ตาม Contract ใน P8 รวมพฤติกรรม DLI ที่เปลี่ยนวัน
- [x] เพิ่ม Config และ Unit tests ของกลไกแสง โดยแยกตัวแปรน้ำ/อุณหภูมิในการเปรียบเทียบ
- **ผ่านเมื่อ:** PPFD สูงช่วงสั้นไม่ทำให้ Hydration/ภาพเหี่ยวกระโดด; Exposure ต่อเนื่องเพิ่ม Light Stress; ลดแสงแล้ว Stress ค่อยลด; Low Light ให้ Biomass เพิ่มน้อยกว่ากลุ่มควบคุมในเวลาเท่ากัน; Photoperiod ปกติไม่เกิด Damage เพียงเพราะกลางคืน; ค่าทั้งหมดอยู่ในช่วงที่กำหนด

- **ผลตรวจ:** AC-16…18 ผ่าน; tests 106/106 และ typecheck ผ่าน; ยังไม่เปลี่ยน Damage/Health รวมและ Visual mapping (P12/P14)

### P10 — Nutrient Stress & pH Behavior ✅

- [x] ปรับ pH Model ตาม Spec ที่ผ่านการตรวจใน P8 พร้อมทดสอบระยะยาว
- [x] คำนวณ Nutrient Stress จาก EC ต่ำ/สูงและ pH นอกช่วง รวมเวลาสะสมและการฟื้น
- [x] นำ Nutrient factor เข้า Growth ตาม Contract โดยคง Salt mass balance และข้อจำกัด A/B
- [x] เพิ่ม Config และ Unit tests แยก EC/pH เพื่อยืนยันสาเหตุ
- **ผ่านเมื่อ:** EC/pH ที่เหมาะสมมี Stress ต่ำกว่ากรณีผิดช่วง; Stress ทำให้ Growth ลดและค่อยฟื้นเมื่อสภาพดีขึ้น; Default pH ไม่ drift ไปชน Clamp โดยไม่มีสมดุลในรัน 30 วัน; Refill/Dosing มีผลตาม Spec และไม่มีการเพิ่มหรือลดเกลือเพื่อบังคับ EC ให้เหมาะสมเอง

- **ผลตรวจ:** AC-19…21 ผ่าน; tests 118/118 และ typecheck ผ่าน; รัน 30 วันจำลองที่ dt 1 s ทั้ง pH แยกกลไกและ Simulation พร้อมการดูแล

### P11 — Root Stress & Estimated Oxygen Status ✅

- [x] เพิ่ม Oxygen Model จาก Air Pump, Water Temperature และ Water Level ตาม P8
- [x] คำนวณ Root Stress/Root Health และผลต่อ Water uptake โดยใช้ Root access และน้ำที่ถังจ่ายได้จริงร่วมกัน
- [x] เพิ่ม Config และ Unit tests รวมกรณีถังแห้ง น้ำร้อน เปิด/ปิด Air Pump และรากยาวต่างกัน
- **ผ่านเมื่อ:** ปิด Air Pump ต่อเนื่องในสภาวะทดสอบทำให้ Oxygen/Root Health ลดและ Uptake ลด แม้น้ำยังถึงราก; เปิดใหม่แล้วค่อยฟื้น; อุณหภูมิน้ำมีผลตามทิศทางที่กำหนด; ปั๊มอากาศไม่แก้อาการรากพ้นน้ำ; ไม่มี NaN/Infinity เมื่อถังแห้ง และ Uptake รวมไม่เกินน้ำที่มีให้ใช้

- **ผลตรวจ:** AC-22…24 ผ่าน; tests 126/126 และ typecheck ผ่าน; ตรวจ Uptake ตรงกับน้ำที่ถังจ่ายจริง, Reset, รากยาว/ถังแห้ง และ Regression M1
- **เหลือตามแผน:** P12 รวม Stress เข้า Damage/Health; P13 ต่อ Oxygen/History/Events; P14 Diagnostics/Curl; หยุดให้ผู้ใช้ตรวจหลัง P11

### P12 — Integrated Growth, Damage & Recovery ✅

- [x] รวม Water/Light/Nutrient/Root effects เข้า Growth และ Health ในจุดเดียวตามสูตร P8
- [x] รวมการสะสม Damage ถาวรและข้อจำกัดในการฟื้น; จัดลำดับ Step ให้ผลระหว่าง Environment/Plants สอดคล้องกัน
- [x] เพิ่ม Test แบบหลาย Stress, Recovery ทันเวลา/ล่าช้า และ Healthy reference 30 วัน
- [x] ตรวจ Determinism ด้วย Seed และ Command schedule ตามเวลาจำลองเดียวกัน แบ่ง Tick ต่างกันที่ 1x/60x/360x โดยควบคุม Noise
- **ผ่านเมื่อ:** กลุ่ม Healthy เติบโตตามช่วงที่ P8 กำหนด; กลุ่ม Stress โตช้ากว่า; ฟื้นทันมี Damage ใกล้ศูนย์ตาม tolerance; ฟื้นช้า Damage ไม่ลดและเพดาน Health/Growth ต่ำลง; ทุก State มีขอบเขตและไม่มีค่าผิดปกติ; ผลไม่เปลี่ยนเพราะการแบ่ง Tick; M1 regression ผ่าน

- **ผลตรวจ:** AC-25/26 ผ่าน; tests 131/131 + typecheck ผ่าน; ตรวจ Healthy reference 30 วัน, หลาย Stress และ Recovery 48 h

### P13 — Server Data Flow, Events & History ✅

- [x] ส่ง State/Diagnostics ใหม่ผ่าน Shared types และ Snapshot ไป Browser โดย Calculation ยังอยู่ใน `sim-core`
- [x] เพิ่ม Event เริ่ม/คลาย Stress แต่ละชนิดพร้อม Hysteresis ป้องกัน Event ซ้ำทุก Step
- [x] ขยาย History สำหรับ Growth/Stress รายต้นและ Oxygen ตาม Contract โดยจำกัดจำนวนข้อมูลใน Memory
- [x] Integration tests: Sim → LabSession → REST/WS/History, Reset, สลับ/แยก Lab, Pause และ Fail-safe
- **ผ่านเมื่อ:** Snapshot/History ตรงกับ State ของต้นและเวลาจำลองที่บันทึก; Event เกิดเมื่อข้าม Threshold และไม่ Spam; Pause ไม่สร้างความคืบหน้าของ Model/History; Reset ล้างข้อมูลรอบเก่า; Lab ไม่ปะปน; PLC Allowlist และ Fail-safe เดิมยังผ่าน

- **ผลตรวจ:** AC-27 ผ่าน; tests 139/139 + typecheck ผ่าน; History 15 วัน, Lab isolation 24 h, Pause/Reset และ REST/WS

### P14 — Plant Diagnostics, Timeline, Growth Chart & Curl ✅

- [x] แสดง Stress, Root Health และ Estimated Oxygen Status พร้อมคำอธิบายไทยและหน่วยที่ถูกต้อง
- [x] เพิ่ม Growth chart รายต้นและ Timeline เลือกช่วงเวลาพร้อม Event จาก Server History ตามขอบเขต P8
- [x] ต่อ Light Stress เข้า `plantVisuals.ts` และ Curl ของใบ พร้อมทดสอบ Mapping; คง Droop จาก Water Stress/Damage
- [x] ตรวจ Browser ทั้ง 3D, 2D fallback, Low Graphics, เลือกต้น, สลับ Lab, Pause และ Reset
- **ผ่านเมื่อ:** กราฟ/ค่าตรงกับ Payload และต้นที่เลือก; ข้อมูลว่าง/หลัง Reset แสดงถูกต้อง; Curl เพิ่ม/ลดตาม State จาก Server; PPFD สูงอย่างเดียวไม่สั่งเหี่ยวทันที; ทุก Control ใช้งานได้และไม่มี Client คำนวณพฤติกรรมพืชเอง

- **ผลตรวจ:** AC-28 ผ่าน; tests 148/148 + typecheck + build ผ่าน; Browser 3D/2D/Low/Cutaway/Roots, 6/24 h/14 วัน, เลือกต้น, สลับ Lab และ Reset จากอีกแท็บล้างกราฟ/Events; WebGL fault fixture ยืนยัน fallback และแก้ภาพล้น/ปุ่ม 3D ที่ใช้ไม่ได้

### P15 — M2 Acceptance & Handoff ✅

- [x] ตรวจ AC ของ M2 ทุกข้อ พร้อมหลักฐาน Automated tests และ Browser checks ที่เหมาะสม
- [x] ตรวจครบวงจร: Healthy growth, High/Low Light, EC/pH ผิดช่วง, Air Pump OFF/ON, Water shortage และ Recovery ทัน/ล่าช้า โดยบันทึกวิธีตั้งสภาวะและผลที่คาดหวัง
- [x] รัน `npm test`, `npm run typecheck` และ `npm run build`; ตรวจรันโหมดห้องเรียนและ Regression ของ M1
- [x] อัปเดต README, SPEC checklist, ARCHITECTURE Implementation Notes, PHASES และสถานะ AGENTS พร้อมข้อจำกัดที่เหลือ
- **ผ่านเมื่อ:** AC ของ M2 ผ่านครบและ M1 ไม่ถดถอย; คู่มือทำซ้ำการทดลองได้; commit `phase(P15): ...`; หลังผู้ใช้ตรวจรับจึง tag `m2`

- **ผลตรวจ:** AC-16…29 ผ่านตามหลักฐานใน [M2-ACCEPTANCE.md](M2-ACCEPTANCE.md); tests 154/154 (22 files) + typecheck + build ผ่าน; เพิ่ม Integration 6 cases ผ่าน PLC/Model/History/Events; Browser เปิด production ผ่าน IP LAN ของเครื่อง Server ได้ และตรวจ Light/Root/Oxygen recovery จริง
- **ขอบเขตที่ยังไม่ตรวจ:** เครื่องนักเรียนอีกเครื่อง/Firewall ของห้องเรียน และ FX5U จริง; ยังไม่ tag `m2` และยังไม่เริ่ม Visual polish

### กติกาตรวจรับและงานถัดไป

- ทุก Phase: ทำให้เกณฑ์ผ่านครบ → `npm test` + `npm run typecheck` → อัปเดต Checklist/AC/Implementation Notes ตามจริง → commit `phase(Px): ...` → หยุดให้ผู้ใช้ตรวจ
- Unit tests ของแต่ละกลไกทำใน Phase นั้น ไม่เลื่อนไปรวมท้าย Milestone
- P8–P15 และส่วนต่อ P16–P25 เสร็จ (Garden Game v2 ครบ P21–P25); ผู้ใช้ตรวจ P25 แล้วสั่งปรับเงื่อนไขเกม P28–P30 ก่อน M3; **หยุดให้ผู้ใช้ตรวจ Layout/อุปกรณ์ และ Dashboard/ระบบเกม** ก่อนปรับรอบถัดไป; tag `m2` หลังผู้ใช้ตรวจรับเท่านั้น; ยังไม่เริ่ม M3

---

## P16 — Greenhouse Visual Polish (ส่วนต่อ M2 ตามคำสั่งผู้ใช้) ✅

ผู้ใช้อนุมัติปรับเฉพาะรูปลักษณ์ 3D ให้รู้สึกเหมือนเกมปลูกผัก โดยอ้างอิงภาพถัง DWC/โรงเรือน 3 ภาพ ไม่เริ่ม Milestone ใหม่และไม่เปลี่ยน Model พฤติกรรม

- [x] โรงเรือนแบบ Diorama, ฐานสวน, โครงโลหะ/แผงโปร่งแสง และมุมกล้องที่เห็นผักชัด
- [x] ใบ Green Oak มีพุ่ม/หยัก/เส้นใบ, Net pot และรากละเอียดขึ้น โดยขนาด/จำนวน/Stress ยังสัมพันธ์ State
- [x] ฝาถังสีขาว ถังใส น้ำ และอุปกรณ์แบบโรงเรือน พร้อมวัสดุและแสงสไตล์เกม
- [x] Controls, Selection, Low Graphics และ 2D เดิมใช้งานได้
- [x] tests/typecheck/build ผ่าน และตรวจ Browser พร้อมภาพก่อนส่งให้ผู้ใช้ตรวจ
- **ผ่านเมื่อ:** AC-30; commit แยก `phase(P16): ...` แล้วหยุดให้ตรวจ
- **ผลตรวจ:** tests 154/154 (22 files), typecheck และ production build ผ่าน; Browser ตรวจต้น 5/80 g, ถังแห้ง 12 h (Hydration 0%, Water stress 100%, Health 31 → ใบตกและเปลี่ยนสี), High/Low, Roots, Transparent → Cutaway → Opaque → Transparent, เลือกต้น/ซูม/คืนกล้อง, คลิกพัดลม และ 2D; ไม่พบ console error หลังตรวจ
- **ขอบเขต:** แก้เฉพาะ `apps/web/src/scene` และเอกสาร; ใช้ fixture Server แยกสำหรับตรวจภาพแล้วนำออก ไม่ Reset หรือเปลี่ยนคำสั่งใน Lab ผู้ใช้; รูปแบบ Stylized ยังรอผู้ใช้ตรวจความพอใจ

## P17 — Game Dashboard, Care Score & Game Over ✅

ผู้ใช้สั่งปรับ Dashboard ตามภาพตัวอย่าง ให้ฉากเป็นพื้นที่หลักและกดขยายข้อมูลได้ พร้อมคะแนนการดูแลและแพ้เมื่อต้นไม้ตายหมด เป็นส่วนต่อของ Lab เดิม ไม่เริ่ม M3

- [x] Dashboard แบบฉากเต็มพื้นที่ พร้อม HUD ย่อและแผงรายละเอียดที่เปิด/ปิดได้ รองรับจอแคบและ Keyboard
- [x] คะแนนจาก Server ตาม Contract ใน SPEC; Best ของรอบที่จบแยกตาม Lab/Scenario ใน Memory
- [x] ต้นตายเมื่อ Damage = 1; ไม่ดูดน้ำ/ไม่ฟื้น/ไม่โต; ทุกต้นตาย → Game Over พร้อมเริ่มรอบใหม่
- [x] Tests คะแนน/ตาย/Reset/แยก Lab และ Browser, typecheck/build; docs และ commit `phase(P17): ...`
- **ผลตรวจ:** AC-31 ผ่าน; 160/160 tests (24 files), typecheck และ build ผ่าน; Browser 1440×900 / 390×844 ตรวจ HUD, แผง Sensors/Actuators/Plant/Scenario/Chart/Timeline/Score, Escape/คืน Focus, Manual Fan ON, 2D/3D และไม่มี console error; fixture ถังแห้งตายครบที่ 1.17 วัน → Game Over → Timeline → ปลูกใหม่ได้ 6 ต้นและ Resume
- **ข้อจำกัด:** Best เป็นคะแนนรอบที่จบและมีอายุอย่างน้อย 24 h จำลองใน Memory ของ Server ควรเทียบรอบยาวเท่ากัน; Game Over ล็อกคะแนนแต่ยังตรวจ Environment/PLC ต่อได้; ไม่มี Leaderboard ข้ามผู้ใช้; เปิด preview ใหม่ที่พอร์ต 3304 โดยไม่หยุด Lab เดิม 3301

## P18 — Ventilation Fan Visual Refinement ✅

- [x] ปรับพัดลมตามภาพผู้ใช้: กรอบดำช่องกลม ใบพัดโค้ง 5 ใบแผ่ถึงขอบ ฝาครอบแกน สกรูและโครงยึดด้านหลัง
- [x] คงตำแหน่ง/การคลิก/M100 เดิมทั้งสองตัว; ลูกศรบอกทิศลมแสดงเมื่อ Fan ON เท่านั้น
- [x] ตรวจ Browser ใกล้/ไกล High/Low และ ON/OFF; tests/typecheck/build, docs และ commit `phase(P18): ...`

- **ผลตรวจ:** AC-32 ผ่าน; tests 160/160 (24 files), typecheck และ production build ผ่าน; Fan ON/OFF, ลูกศรลม, การคลิก M100, มุมหน้า/หลังและ High/Low ผ่านบน Server ทดสอบแยกพอร์ต 3306; แก้ error จาก Canvas remount ตอนสลับ Graphics ขณะมีป้าย โดยคง Canvas/กล้องและลด DPR/เงา/รายละเอียดแทน; Lab ผู้ใช้ไม่ถูก Reset

## P19 — Workspace Layout & Utility Equipment ✅

- [x] จอกว้างเปิด Sensors/Plant ซ้าย, Actuators ขวา และกราฟขวาล่างพร้อมกันได้; ปิด/เปิดจาก Dock และขยายอ่านได้ จอเล็กใช้ Dialog
- [x] Humidifier ตัวถังขาว/ฐานดำและละอองนุ่มคล้ายควัน ตาม Server command; Low ยังเห็นละออง
- [x] ชุดถังสำรอง/Water Refill Pump/Flow Sensor เชื่อมด้วยท่อ, Air Pump ตัวถังดำ, Power Meter มีหน้าจอค่า W จาก Server; คลิกอุปกรณ์เดิมได้
- [x] ตรวจ Browser จอกว้าง/แคบ, Panels, เลือกต้น, ON/OFF/Low และค่าจาก Server; tests/typecheck/build, docs และ commit `phase(P19): ...`
- ขอบเขต: ส่วนต่อ M2 ตามภาพผู้ใช้ ไม่เปลี่ยน Simulation/PLC mapping; ถังสำรองเป็นภาพประกอบ ไม่อ้างว่าจำลองปริมาณน้ำสำรอง; Air Pump ไม่บังคับ always ON นอก Fail-safe

- **ผลตรวจ:** AC-33 ผ่าน; tests 160/160 (24 files), typecheck และ production build ผ่าน; Browser 1440×900, 1280×720 และ 390×844 ตรวจ Toggle/Expand/Escape, Plant 3/Chart คงค่า, หมอก ON/OFF/Low/Pause, อุปกรณ์ 4 จุดและค่า Power Meter ตรง Snapshot; ไม่มี Console error; หยุดรอผู้ใช้ตรวจรับ P19
- **ตรวจรัน 2026-10-18 (หลัง commit P19):** `npm run dev` ขึ้นครบ — Server `http://127.0.0.1:3001` (lab01, Mock PLC: auto) และ Web `http://localhost:5173` ตอบ HTTP 200; tests 160/160 (24 files) และ typecheck ผ่านซ้ำ; รอบนี้ไม่ได้ตรวจภาพใน Browser (Chrome extension ไม่เชื่อมต่อ) — ยังรอผู้ใช้ตรวจรับ P16–P19 ก่อน tag `m2`

## P20–P22 — Garden Game Mode (ส่วนต่อ M2 ตามคำสั่งผู้ใช้)

> **ผู้ใช้อนุมัติ 2026-10-18:** Speed เพิ่ม 1440x และ 3600x; ชนะเมื่อต้นที่รอดทุกต้นถึง 100 g (มีต้นตายระหว่างทางยังชนะได้แต่คะแนนลด); Auto ยังเปิดใช้ใน UI จนกว่าโปรเจกต์เสร็จ (ค่อยปิดภายหลัง) แต่รอบที่ใช้ Auto ไม่นับ Best

> เป้าหมาย: ทำให้ Lab เล่นเหมือนเกมปลูกผัก เข้าใจง่าย — **Game Start → ดูแลด้วย Manual → เก็บเกี่ยว = ชนะ / ตายหมด = Game Over**, มี Score ระหว่างทางและหน้าแนะนำการดูแล; Auto ใช้เพื่อ Test เท่านั้น
> ไม่เปลี่ยน Model พืช/สมการ และไม่เปลี่ยน PLC mapping (D100–D112, D120, M100–M105, D200)

### P20 — Game Flow & Win Condition (sim-core + server) ✅
- [x] SPEC § 4.5: State machine `ready → playing → won | lost`; ก่อนกด Start เวลาจำลองไม่เดิน (paused); Reset กลับ `ready`
- [x] คำสั่ง WS `startGame` และ `harvest`; Harvest ได้เมื่อต้นที่รอดทุกต้นถึง `harvestAtG` (100 g) และรอดอย่างน้อย 1 ต้น → `won`
- [x] คะแนนสุดท้ายเมื่อชนะ = Care Score + Harvest Bonus ตามผลผลิต (Biomass รวมของต้นที่รอด) — สูตรและน้ำหนักอยู่ใน `defaultConfig.ts`
- [x] ถ้ารอบนั้นเคยใช้ Auto → ติดป้าย `testRun` ไม่นับ Best score; รอบเกมเริ่มที่ Manual เสมอ
- [x] เพิ่ม Speed 1440x และ 3600x เพื่อให้รอบ ~25–30 วันจำลองจบใน ~30 / ~12 นาทีจริง
- [x] Unit tests: state transitions, harvest guard, bonus, testRun, Reset/Best; `npm test` + typecheck → commit `phase(P20): ...`

- **ผลตรวจ:** AC-34 ผ่าน; tests 169/169 (26 files), typecheck และ build ผ่าน; ตรวจ REST บน Dev server: Lab ใหม่ `ready`/paused/manual, `resume` และ `harvest` → 409, `startGame` → playing, Speed 3600x รับได้; Web มีปุ่มเริ่มปลูก/เก็บเกี่ยวขั้นต่ำ (หน้าจอเต็มทำใน P21); ยังไม่ตรวจภาพใน Browser (Chrome extension ไม่เชื่อมต่อ); หยุดรอผู้ใช้ตรวจ P20

## P21–P25 — Garden Game v2 (ส่วนต่อ M2 ตาม [[GAME-DESIGN]])

> **ผู้ใช้อนุมัติ 2026-10-18 ("โอเคร")** ตามข้อเสนอ: 4 ด่าน + ดาว, เพิ่ม pH Down (M106) ใน P22, งบไฟ (เกินงบเสียดาวที่ 3); แทน P21–P22 เดิม (Game Screens / Care Guide → รวมไว้ใน P24)
> เนื้อหาคู่มือ: [[GAME-GUIDE]]

### P21 — Levels & Missions (sim-core + server) ✅
- [x] SPEC § 4.6 + AC-35; ด่าน L1–L4 ใน `sim-core/src/levels.ts` เริ่มจากช่วงการเติบโตต่างกัน (5/15/30/5 g) พร้อมเป้า g, เวลาจำกัด, งบไฟ, อุปกรณ์ที่ผู้เล่นคุม
- [x] `CareGame` รับ Mission: เป้าหมายแทน harvestAtG, ครบเวลา → เก็บอัตโนมัติถ้าพร้อม/มิฉะนั้น `lost` (`timeout`), สะสม `energyKWh`, ดาว 1–3
- [x] ผู้ช่วยฟาร์ม (`apps/server/src/lab/farmHelper.ts`) คุมอุปกรณ์ที่ล็อกด้วยเกณฑ์ Ladder ตัวอย่าง; ปฏิเสธการกดอุปกรณ์ที่ล็อก (409)
- [x] `selectLevel`, ปลดล็อกด่านถัดไป/ดาวสูงสุดใน Memory, testRun ไม่ปลดล็อก, Lab เริ่มที่ L1; Best แยกตามด่าน และบันทึกทุกรอบที่ชนะ
- [x] ปรับเป้าด้วย Simulation ตามสูตรคู่มือ: L1 5.6/8 วัน, L2 6.3/8, L3 7.5/9, L4 28.5/35, พลังงานต่ำกว่างบ, ได้ ⭐⭐⭐ ทุกด่าน (L2 ขยายจาก 7 → 8 วันเพราะเหลือเวลาแค่ 10%)
- [x] Web ขั้นต่ำ: ตัวเลือกด่าน, เป้า/วัน/งบไฟบน HUD, ดาวเมื่อชนะ, อุปกรณ์ล็อกแสดง 🔒 ผู้ช่วย, Game Over แยกสาเหตุหมดเวลา
- **ผลตรวจ:** AC-35 ผ่าน; tests 181/181 (28 files), typecheck และ build ผ่าน; Dev server: Lab เริ่ม L1 `ready`, กด Fan → 409, เลือก L3 ที่ล็อก → 409; ยังไม่ตรวจภาพใน Browser (Chrome extension ไม่เชื่อมต่อ); หยุดรอผู้ใช้ตรวจ P21

- **ปรับหลังผู้ใช้ตรวจ (2026-10-18):** แก้การ์ด CARE SCORE ซ้อนแผง Sensors บนจอกว้าง (การ์ด HUD ย้ายเข้าคอลัมน์ซ้ายเดียวกับแผง เรียงต่อกันเอง และซ่อนการ์ดสภาพแวดล้อมเมื่อเปิดแผง Sensors); เพิ่มเมนู 📖 **คู่มือ** ใน Dock (แท็บ ด่านนี้ / ทำอะไรตอนไหน / ถ้าเห็น → ทำ / ค่าที่ต้องดู) และหน้า **Briefing** เด้งตอนรอบอยู่ `ready` (เป้าหมาย, อุปกรณ์ที่คุม/ผู้ช่วยคุม, ต้องทำ, ระวัง, ปุ่มเริ่มปลูก); เนื้อหาใน `apps/web/src/dashboard/guideContent.ts` สรุปจาก [[GAME-GUIDE]]; ตรวจด้วย Headless Chrome 1908×924, 1280×720 และมือถือ (Chrome extension ไม่เชื่อมต่อ); tests 181/181, typecheck, build ผ่าน — งาน UI เต็มรูปแบบยังเป็น P24

- **Game Over Story (ผู้ใช้ขอ 2026-10-18):** หน้า Game Over เล่าเรื่องตามลำดับเวลา (ไฟไม่เคยเปิด, รากพ้นน้ำ, ถังแห้ง, กระหายน้ำ, ร้อน/แสงแรง, ปุ๋ยขาด/เกิน/pH ตาม EC ขณะนั้น, รากขาดอากาศ, ใบเหี่ยว, ต้นที่ตายจัดกลุ่มตามวัน), สาเหตุหลักรายต้นจาก Stress ที่ Server คงไว้ ณ ตอนตาย และ "ครั้งหน้าลองแบบนี้"; Timeout อธิบายต้นที่เล็กสุดเทียบเป้า; `apps/web/src/dashboard/lossStory.ts` + test 5 ข้อ; ตรวจกับรอบจริงบน Lab 01 (ไฟไม่เปิด + EC 3.06 → สาเหตุปุ๋ยเข้มเกิน); ปุ่ม "ปลูกใหม่" Reset แล้วให้ Briefing เด้งก่อนเริ่ม; tests 186/186, typecheck, build ผ่าน

### P22 — Dose Actuators + pH Down ✅
- [x] SPEC § 4.7 + AC-38 ก่อน; คำสั่ง `dose` (เติมน้ำ +10% = M102 120 s, ปุ๋ย = M103+M104 30 s, pH Down = M106 120 s) นับเวลาจำลองราย Step ผลเท่ากันทุก Speed; กดซ้ำต่อคิว ≤ 5; LED presets 0/50/80/100 (Slider เฉพาะ Free Play)
- [x] pH Down **M106**: DEVICE-MAP, Read M100–M106, Model `phDownPerMin` สเกลตามปริมาตร, Fail-safe OFF, Ladder ตัวอย่าง/Auto (D104 > 660 / ≤ 630), L4 ผู้เล่นคุม, ด่านอื่นผู้ช่วยสั่งโดสเมื่อ pH > 6.6; Gateway ยังห้ามเขียน M (FR-31)
- [x] Web: ปุ่มโดส 3 ปุ่มพร้อมเวลาที่เหลือ/🔒, แถว M106, ขวด+ปั๊ม pH Down ใน 3D คลิกดูข้อมูลได้, คู่มือในเกม/GAME-GUIDE แนะนำปุ่มโดสแทน "ลดเหลือ 60x"
- [x] Tests: โดสเท่ากันที่ 60x/3600x/Tick ต่างกัน, ผล +10% / EC +0.15 / pH −0.2, คิว, ยกเลิก, Auto/Fail-safe/ล็อก → 409, Auto ladder M106, ผู้ช่วย, pH Down Model → commit `phase(P22): ...`
- **ผลตรวจ:** AC-38 ผ่าน; tests 206/206 (31 files), typecheck และ build ผ่าน; Browser 1440×900: L1 แผงควบคุมแสดงโดส/🔒/M106/LED presets, โดสเติมน้ำ 2 ครั้ง = 240 s และหยุดเองที่ 3600x, คลิกปั๊ม pH Down แสดง M106; Free Play มีโดสครบ + สวิตช์ M106 + Slider, pH Down จริงลด 5.997 → 5.806
- **พบและแก้ระหว่าง P22:** ผู้ช่วยฟาร์มของ P21 เปิดปั๊มปุ๋ยค้างตามรอบ Poll → ที่ 3600x หลังเติมน้ำ EC พุ่ง 8.57 / pH 4.97 จึงเปลี่ยนเป็นสั่งปุ๋ยครั้งละ 1 โดสเมื่อ EC < 1.0 (หลังแก้ EC 1.41 / pH 6.36) พร้อม regression test
- **ต่างจากร่าง GAME-DESIGN:** โดสเป็น Server overlay ไม่เขียน Mock PLC memory (เหตุผลใน SPEC § 4.7)

### P23 — Events & Challenge ✅
- [x] SPEC § 4.8 + AC-39 ก่อน; เหตุการณ์ 5 ชนิด (`sim-core/src/challenges.ts`): คลื่นความร้อน +5 °C 6–8 ชม., ถังรั่ว 1.5 L/h จนซ่อม, ไฟดับ 2–3 ชม. (ปิดทุกตัวรวม Air Pump/LED, โดสหยุดนับ), อากาศแห้ง RH −20% 12 ชม., น้ำประปาด่าง pH 8.0 24 ชม.
- [x] ตาราง Deterministic ตาม Seed + ด่าน (L3 คลื่นความร้อน 1–2 ครั้ง วันที่ 1–7, L4 3–4 ชนิดไม่ซ้ำ วันที่ 3–30, ห่างกัน ≥ 2 วัน); เตือนก่อน 6 ชม.; Snapshot แสดงเฉพาะที่เตือนแล้ว
- [x] Auto-pause เฉพาะโหมดด่าน: เตือน/เริ่มเหตุการณ์ และค่าแดงครั้งแรกต่อค่า (น้ำ EC pH อุณหภูมิ RH — ช่วงสีย้ายไป `@gol/shared` SENSOR_RANGES); `setAutoPause`, `repairLeak`
- [x] สมดุลด่าน: L3 ขยาย 9 → 10 วัน (วัดได้เหลือเวลาแค่ 6–17%); L4 คงเดิม (เหลือ 16–17%, ⭐⭐⭐ ทุก Seed 1–5)
- [x] Web: การ์ด ⚠️ เหตุการณ์ (นับถอยหลัง, ปุ่ม 🔧 ซ่อมถัง), แถบ "ผู้ช่วยหยุดเกมให้" + เล่นต่อ, สวิตช์ "⏸ หยุดอัตโนมัติ" บนแถบบน, คู่มือในเกม L3/L4 เพิ่มเรื่องเหตุการณ์
- **ผลตรวจ:** AC-39 ผ่าน; tests 229/229 (33 files), typecheck และ build ผ่าน; Browser 1440×900 บน Server ทดสอบแยก (พอร์ต 3401, L4 + ตารางกำหนดเอง): หยุดเกม 5 ครั้งตามลำดับ เตือนคลื่นความร้อน → เตือนถังรั่ว → คลื่นความร้อนเริ่ม → อุณหภูมิอากาศแดง 29.1 °C → ถังรั่ว, กดซ่อมถังแล้วสถานะ repaired, ปิดสวิตช์แล้วแถบหาย; ไม่มี Console error; ไม่แตะ Lab ผู้ใช้ที่พอร์ต 3001
- **ผู้ใช้ตรวจรับแล้ว 2026-10-19:** ทดลองใน Browser บน Server ทดลองแยก (L4 + เหตุการณ์ครบ 5 ชนิด) — ผ่าน
- **หมายเหตุ:** เหตุการณ์ใน L4 ตามสูตรดูแลมีผลต่อสุขภาพน้อย (สุขภาพเฉลี่ยยัง 100%) ความยากหลักคือเวลา; Auto-pause หยุดหลังจบ Tick ที่ตรวจพบ (ช้าได้ ≤ 6 นาทีจำลองที่ 3600x)

### P24 — Simple Game UI ✅
- [x] SPEC § 4.9 + AC-40 ก่อน; โหมดด่านใช้หน้าจอเกม 5 ส่วน (`apps/web/src/game/`): แถบบน (ด่าน/วัน/เวลา/Speed/เป้า = ต้นเล็กสุด ÷ เป้า/คะแนน/งบไฟ/เลือกด่าน/หยุดอัตโนมัติ/เก็บเกี่ยว), มาตรวัด 4 ตัว (+pH เมื่อคุม pH Down) สีจาก SENSOR_RANGES และลูกศรจาก History, ฉาก + การ์ดเหตุการณ์, กล่องผู้ช่วย 💬, แถบปุ่ม (LED preset, โดส 3 ชนิด, สวิตช์ 3 ตัว, 🔒, Manual/Fail-safe guard)
- [x] ลิ้นชัก 🔬 รวมแผงเดิม 7 แท็บ; หน้าเลือกด่าน (การ์ด 4 ด่าน + Free Play) ใช้รายละเอียดด่านจาก Server; หน้าผ่านด่าน (ดาว, ผลผลิตรายต้น, +g เฉลี่ย, เวลา, พลังงาน, ด่านถัดไป/เล่นซ้ำ); Briefing/Loss story/คู่มือเดิมใช้ต่อ; Free Play คง Layout เดิม
- [x] Unit tests `gameModel` 11 ข้อ (มาตรวัด, ลูกศร, เป้า, ลำดับข้อความผู้ช่วย, ล็อกตามด่าน)
- **ผลตรวจ:** AC-40 ผ่าน; tests 240/240 (34 files), typecheck และ build ผ่าน; Browser 1440×900: 5 ส่วนพอดีจอไม่ต้องเลื่อน, LED 80% → มาตรวัดแสงเขียว, โดสเติมน้ำนับถอยหลัง, ปุ่มที่ล็อก 5 ตัวกดไม่ได้, ลิ้นชัก 7 แท็บ/Escape, เลือกด่าน, สลับ Free Play ↔ L1; มือถือ 375×812: มาตรวัดเป็นแถวเลื่อนได้, ไม่มีส่วนทับกัน, แถบปุ่มเลื่อนแนวนอน, ลิ้นชักเป็น Bottom sheet; ไม่มี Console error นอกจาก WebSocket ตอน Server ยังเริ่มไม่เสร็จ
- **แก้ระหว่างทาง:** จอแคบแถวมาตรวัดถูก Grid บีบจนหาย (แถวที่ overflow มี min-height 0) จึงให้จอแคบเป็นหน้ายาวเลื่อนลงได้
- **ยังไม่ได้ตรวจใน Browser:** หน้าผ่านด่านกับข้อมูลจริง (ต้องเล่นจนชนะ) — ตรวจผ่าน typecheck/โค้ด และใช้ข้อมูลจาก Snapshot เดิม

### P24b — กลับไปใช้ Layout P19 (ตามผู้ใช้ตรวจ P24) ✅
- [x] ผู้ใช้ตรวจ P24 (2026-10-20) แล้วชอบ Layout เดิม (ฉาก 3D กลาง, การ์ดซ้าย, แผงควบคุมขวา, Dock ล่าง) มากกว่าหน้าจอเกม 5 ส่วน → แก้ SPEC § 4.9 + AC-40 ก่อน
- [x] ทุกโหมดใช้ Layout P19; ลบ `game/GameScreen.tsx`, `game/ScienceDrawer.tsx` และโค้ดมาตรวัด (`gauges`/`trendOf`/`lightStatus`) พร้อมเทสต์
- [x] เก็บ 3 ส่วนที่ผู้ใช้เลือก: ปุ่ม 🗺️ เปิดการ์ดเลือกด่าน (แทน Dropdown), ข้อความผู้ช่วย 💬 เหนือ Dock (เฉพาะโหมดด่าน, `game/HelperBubble.tsx`), หน้าผ่านด่าน (เปิดซ้ำได้จากการ์ด "เก็บเกี่ยวสำเร็จ")
- [x] แก้ Bug: `sendCommand` คืน false เมื่อ WebSocket ส่ง Snapshot รอบใหม่มาก่อน HTTP ตอบ (selectLevel/reset) ทำให้ Dialog เลือกด่านไม่ปิด — ตอนนี้ถือว่าคำสั่งสำเร็จ
- **ผลตรวจ:** AC-40 ผ่าน; tests 236/236, typecheck และ build ผ่าน; Browser จอกว้าง: Layout เดิม + ข้อความผู้ช่วยห่าง Dock 22 px, การ์ดเลือกด่านเปิด/เลือกแล้วปิดเอง → Briefing เด้ง, Free Play ไม่มีข้อความผู้ช่วย; มือถือ 375×812: ข้อความผู้ช่วยห่าง Dock 8 px (เดิมทับ 2 px แก้แล้ว); ไม่มี Server error
- **ยังไม่ได้ตรวจใน Browser:** หน้าผ่านด่านกับข้อมูลจริง (ต้องเล่นจนชนะ)

### P25 — Plant Feedback ✅
- [x] ผู้ใช้ตรวจรับ P24b และสั่งเริ่ม P25 (2026-10-20); SPEC § 4.10 + AC-41 ก่อน
- [x] sim-core: `PlantState` เพิ่ม `biomassDayStartG`, `gainYesterdayG` (อัปเดตตอนเที่ยงคืนจำลอง), `stageChangedAtS` + Event `plant.stage`; ไม่เปลี่ยนสมการพืช
- [x] shared `plantFeedback.ts`: `plantMood`, `plantCause` (💧/🫧/🔥/⚗️/🧪/🌑), `isDaytime` (ย้ายจาก web), `showGainBadge`, `isCelebrating` + Unit tests
- [x] ฉาก 3D: ป้ายเหนือแต่ละต้น (Mood + สาเหตุ, แถบ Damage, "+x.x g" ช่วง 00:00–03:00, "🎉 ใบอ่อน!/พร้อมเก็บ!" + วงแหวนทอง 3 ชม.จำลอง); สีใบแยกตาม Stress (น้ำ/ปุ๋ย-pH/แสง/Damage); ต้นตายน้ำตาลเข้ม ใบตก เอนล้ม; แผงต้นผักแสดง Mood/สาเหตุ/โตเมื่อวาน
- **ผลตรวจ:** AC-41 ผ่าน; tests 247/247 (35 files), typecheck และ build ผ่าน; Browser (3600x): ป้ายครบ 6 ต้น, กลางวันไฟปิด → 🌑, เที่ยงคืนขึ้น "+0.8…+1.7 g" และหายหลัง 03:00, ต้นที่ 5 ถึง 15 g → "🎉 ใบอ่อน!" + วงแหวนทอง, โหลดหน้าใหม่ไม่มี Console error
- **แก้ระหว่างทาง:** ป้ายแบบ drei `Html` สร้าง React root แยกต่อป้าย → ป้ายต้นที่ 1 ว่างและมี Error "synchronously unmount a root" จึงเปลี่ยนเป็น DOM ชั้นเดียวเหนือ Canvas ที่ Lettuce เขียนตำแหน่งจอทุกเฟรม; ข้อความ "+g เมื่อวาน" ยาวทับกันบนจอแคบ จึงย่อเป็น "+x.x g"
- **ยังไม่ได้ตรวจใน Browser:** ภาพต้นตาย (เอนล้ม/น้ำตาลเข้ม) และสีใบตาม Stress แต่ละชนิด — ตรวจด้วย Unit test ของ `plantVisuals`; ภาพตัดขวาง 2D ยังไม่มีป้าย

## P28–P30 — ปรับเงื่อนไขเกม (ผู้ใช้ลองด่าน 1, 2026-10-20)

> ผู้ใช้สั่ง "ยังไม่ไป M3 แก้เงื่อนไขเกมก่อน" — ให้ผู้เล่นเลือกได้ว่าจะ **ปลูกให้ผ่าน** หรือ **ควบคุมให้ดีเพื่อทำคะแนนสูง**; ทำทีละ Phase และหยุดให้ผู้ใช้ตรวจทุก Phase; ยังไม่ tag m2

### P28 — Stamina panel ต้นผัก ✅
- [x] SPEC § 4.11 + AC-42 ก่อน
- [x] แผงต้นผักเป็นแถบ Stamina แบบเกม Survival (`dashboard/plantStamina.ts` + `Stamina` ใน `PlantDetail.tsx`): ❤️ Health, 💧 น้ำในต้น, 🧪 ปุ๋ย, ☀️ แสงพอดี, 🫧 ราก, 🛡️ ความแข็งแรง — แถบหนาพื้นเข้ม ไอคอนซ้าย ชื่อ/% ในแถบ ค่ามาก = ดี; < 60 % สีอำพัน, < 30 % สีแดง + ขอบเตือน; รายละเอียดเทคนิคเดิมอยู่ในส่วนพับ
- [x] แก้ Bug: ต้น Damage 100% ที่ยังไม่อยู่ใน `deadPlantIds` แสดง "ไม่มีปัญหาเด่น"/"โตเมื่อวาน"/ระยะพร้อมเก็บ → `isPlantDead` ใช้ Damage ด้วย (แผงต้นผักและป้ายในฉาก), แถบเป็นสีเทา
- **ผลตรวจ:** AC-42 ผ่าน; tests 251/251 (36 files), typecheck และ build ผ่าน; Browser: Dialog ต้นผักแสดง 6 แถบตามภาพตัวอย่าง, สาเหตุ 🌑 ก่อนเปิดไฟ, ส่วนพับเปิดได้; ไม่มี Console error
- **ยังไม่ได้ตรวจใน Browser:** สีเตือน/สีเทาของต้นตายกับข้อมูลจริง — ตรวจด้วย Unit test

### P28b — กลับไปใช้แผงต้นผักแบบเดิม ✅
- [x] ผู้ใช้ตรวจ P28 (2026-10-20): "ไม่ชอบ เอาแบบเดิม" → แก้ SPEC § 4.11 + AC-42 ก่อน
- [x] แผงต้นผักกลับเป็นแบบ P25; ลบ `dashboard/plantStamina.ts`, เทสต์ และ CSS `.stamina*`
- [x] คงการแก้ Bug ต้นตาย: ย้าย `isPlantDead` (Damage ≥ 1 หรือใน `deadPlantIds`) ไป `packages/shared/src/plantFeedback.ts` ใช้ทั้งแผงต้นผักและป้ายในฉาก + Unit test
- **ผลตรวจ:** AC-42 ผ่าน; tests 248/248 (35 files), typecheck และ build ผ่าน; Browser: Dialog ต้นผักกลับเป็น Meter แบบเดิม ไม่มี Console error หลังโหลดใหม่

### P29 — น้ำล้นเสียคะแนน ✅
- [x] SPEC § 4.12 + AC-43 ก่อน
- [x] sim-core `CareGame.step` รับน้ำล้นต่อ Step และกำลังปั๊มเติมน้ำ → `game.overflowL`, `overflowKWh`, `overflowPenalty` (10 คะแนน/L สูงสุด 300 จาก `cfg.game`); คะแนน = max(0, คะแนนดูแล − หัก); นับเฉพาะ `playing`, ไม่ทำให้แพ้/ไม่ลดดาว; โดสเติมน้ำที่ล้นก็นับ (ผ่านบิต Refill)
- [x] UI: การ์ด CARE SCORE "💧 ล้น x L · ⚡ y kWh · −z", หน้าคะแนน/หน้าผ่านด่านแสดงรายการหัก, ข้อความผู้ช่วยขณะล้น (หลังไฟดับ/ถังรั่ว), แถบน้ำล้นในฉากบอกคะแนนที่เสีย
- **ผลตรวจ:** AC-43 ผ่าน; tests 252/252 (35 files), typecheck และ build ผ่าน; Browser (60x, เปิดเติมน้ำค้าง): ล้น 12.3 L → −123 คะแนน, kWh ขึ้น, ผู้ช่วยเตือน, ยัง playing; ปิดปั๊มแล้วข้อความกลับปกติ; ไม่มี Console error
- **หมายเหตุสมดุล:** ที่ 60x ล้น 6 นาทีจำลองเสีย ~120 คะแนน (ปั๊ม 2 L/min) — ปรับ `overflowPenaltyPerL`/`overflowPenaltyMax` ได้ใน Config ถ้าแรงไป

### P30 — เปิด LED นานเกินเกิดความเครียด ✅
- [x] SPEC § 4.13 + AC-44 ก่อน
- [x] sim-core: `PlantState.lightLoadH` (ชั่วโมงแสงสะสมที่ยังไม่พัก) — PPFD ≥ 60 สะสม `min(1, PPFD/250)` h/h, ต่ำกว่านั้นล้าง 3 h/h × (1 − PPFD/60); Photoperiod stress = (load − 18)/8 × 0.6 รวมกับ Light stress เดิมแบบ max; พารามิเตอร์ใน `cfg.light`
- [x] เพดาน 0.6 < เกณฑ์ Damage 0.7 → เปิดไฟทั้งวันทำให้โตช้าแต่ไม่ตาย; ตาราง 06–22 ไม่เกิด Stress; สูตรดูแลยังผ่าน L1–L4 (levels tests เดิมผ่าน)
- [x] เทสต์เดิม 4 ข้อที่ตั้งใจเปิดไฟต่อเนื่องเพื่อทดสอบกลไกอื่น (แสงน้อย, Damage ฟื้น, แสงแรงใน M2 acceptance) ตั้ง `photoperiodMaxStress: 0` เพื่อแยกผล + เทสต์ P30 ใหม่ 3 ข้อ
- [x] UI: แผงต้นผักแถว "แสงสะสม (ยังไม่พัก)", สาเหตุ 🔥 "แสงมาก/เปิดไฟนานเกิน", ผู้ช่วยเตือนเมื่อ load ≥ 16 ชม. และไฟเปิด, Briefing ด่าน 1 เพิ่มข้อระวังเรื่องไฟและน้ำล้น
- **ผลตรวจ:** AC-44 ผ่าน; tests 256/256 (35 files), typecheck และ build ผ่าน; Browser (3600x, LED 80% ค้าง): 18 ชม. ผู้ช่วยเตือน "เปิดไฟมา 18 ชม.…", 20 ชม. Light stress 0.07 เริ่มขึ้น, แผงต้นผักแสดง 20.3 h; ไม่มี Console error
- **หมายเหตุ:** ค่าเกณฑ์เป็นค่าเชิงการสอน ยังไม่ปรับเทียบกับข้อมูลจริงของผักกาด

### P31 — สิ่งที่ต้องดูของด่าน (Level Watch HUD) ✅
- [x] ผู้ใช้ลอง P30 แล้วขอ (2026-10-20): แสดงค่าที่ต้องดูของแต่ละด่าน + น้ำหนัก/เวลาที่เหลือ ตามภาพร่าง (หน้าปัดกลมด้านบนฉาก) → SPEC § 4.14 + AC-45 ก่อน
- [x] `LevelInfo.startBiomassG` (ส่งจาก Server), `LIGHT_LOAD_STRESS_H` ใน shared
- [x] `game/watchModel.ts` (Pure): `watchDials` เลือกมาตรวัดตามอุปกรณ์ของด่าน (L1 น้ำ/แสง PPFD/แสงสะสม, L2 +EC, L3 +อุณหภูมิ/ความชื้น, L4 +pH) ช่วงจาก `SENSOR_RANGES`, PPFD 200–350, แสงสะสม < 16 ชม.; `watchGoal` (เป้า/ต้นเล็กสุด/เริ่ม/เวลาที่เหลือ) + Unit tests 4 ข้อ
- [x] `game/LevelWatch.tsx`: การ์ดเป้าหมาย + หน้าปัด SVG 240° (เหลือง = พอรับได้, เขียว = แนะนำ, เข็ม, ตัวเลข, ช่วงแนะนำ); เฉพาะโหมดด่าน; แถบหยุดเกมเลื่อนลงใต้แถบนี้บนจอกว้าง
- **ผลตรวจ:** AC-45 ผ่าน; tests 260/260 (35 files), typecheck และ build ผ่าน; Browser 1440×900: แถบถัดจากคอลัมน์การ์ดด้านบนฉาก, 900×900: ถัดคอลัมน์การ์ดใต้ Toolbar, 375×812: ใต้แถวการ์ด ไม่ทับการ์ดผัก/Dock (วัดด้วยตำแหน่ง Element); ไม่มี Console error หลังรีสตาร์ท Dev server
- **แก้ระหว่างทาง:** ตั้งชื่อ `levelWatch.ts` ชนกับ `LevelWatch.tsx` บน Windows (ไม่สนตัวพิมพ์) → เปลี่ยนเป็น `watchModel.ts` และต้องรีสตาร์ท Vite; จอมือถือแถบแรกทับการ์ดผัก → ย้ายขึ้นใต้แถวการ์ด
- **ยังไม่ได้ตรวจใน Browser:** ด่าน 2–4 (ต้องปลดล็อก) — หน้าปัด EC/อุณหภูมิ/ความชื้น/pH ตรวจด้วย Unit test

## P32–P34 — เหตุผลการควบคุมอุปกรณ์ (ผู้ใช้สั่ง 2026-10-20)

> เป้าหมาย: ผู้เล่นเห็น "เกิดปัญหาอะไร → ควบคุมอุปกรณ์อะไร → ผลดีและผลข้างเคียง" ทุกผลมาจาก Model บน Server; ไม่เปลี่ยน Layout ที่ผู้ใช้เลือก; ทำทีละ Phase และหยุดให้ผู้ใช้ตรวจ

**ผลตรวจ Model ปัจจุบัน (2026-10-20):** Fan (ลด LED heat เข้าหาห้อง ไม่ต่ำกว่าห้อง, RH ลด), Refill (น้ำต่ำ → Hydration ลด; ล้น → เกลือออกกับน้ำล้น + น้ำประปาเจือจาง EC/ดัน pH, หักคะแนน P29), Nutrient A+B (EC ต่ำ → Stress, ช่วง 0.8–1.6 ไม่มีโบนัส, เกิน → Stress), Air Pump (Oxygen → Root health → ดูดน้ำ), pH Down (pH สูง/ต่ำเกิน → Nutrient stress), Light (แสงน้อยโตช้า, แสงแรง/นานเกิน → Light stress, LED เพิ่มความร้อนและความต้องการน้ำ) **มีครบแล้ว**; ที่ขาดคือ **ความเครียดจากสภาพอากาศ (VPD)** สำหรับ Humidifier

### P32 — ตรวจเหตุผลอุปกรณ์ด้วย Scenario tests ✅
- [x] SPEC § 4.15 (ตาราง ปัญหา → อุปกรณ์ → ผลดี → ผลข้างเคียง) + AC-46 ก่อน
- [x] `packages/sim-core/test/deviceRationale.test.ts` — 12 Scenario (7 อุปกรณ์) เทียบเปิด/ไม่เปิดด้วย Seed เดียวกัน: Fan ลดความร้อน LED เข้าหาห้อง ไม่ต่ำกว่าห้อง/RH ลด/โตดีขึ้น; Humidifier RH เพิ่ม ความต้องการน้ำลด; Refill น้ำต่ำ Hydration ลด เติมแล้วฟื้น, ล้นแล้ว EC ลด pH ขึ้นหาน้ำประปา หักคะแนนแต่ยังเล่น; Nutrient EC ต่ำเครียด โดส A+B ฟื้น, ในช่วงไม่มีโบนัส, เกินเครียด; Air Pump ปิดนาน Oxygen/Root health/การดูดน้ำลด โตช้าแม้น้ำเต็ม; pH Down pH สูงเครียดแม้ EC พอ โดสแล้วฟื้น เปิดค้างต่ำเกินเครียด; Light มืดไม่โต หรี่โตช้า แรงเกินเพิ่มความร้อน/ความต้องการน้ำ/Light stress
- [x] ไม่พบจุดที่ Model ขัดกับตาราง → ไม่แก้โค้ด Model
- **ผลตรวจ:** AC-46 ผ่าน; tests 272/272 (36 files), typecheck และ build ผ่าน
- **ข้อสังเกตจากการตรวจ:** ไฟ 80 % ไม่เปิดพัดลม อากาศขึ้น ~29–31 °C (ห้อง 24 ± 2 + LED 4.8 °C) ทำให้โตช้ามาก (temperatureFactor) — ด่าน 1–2 ผู้ช่วยฟาร์มคุมพัดลมให้ จึงไม่กระทบสมดุลด่าน แต่ควรอธิบายในคู่มือ (P34)

### P33 — ความเครียดจากสภาพอากาศ (VPD) สำหรับ Humidifier ✅
- [x] วัดก่อนตั้งเกณฑ์: สูตรดูแล L1–L4 ได้ VPD 0.93–1.6 kPa (คลื่นความร้อนสูงสุด ~1.96) → SPEC § 4.16 + AC-47
- [x] sim-core `plant/air.ts`: `dryAirStress` (VPD > 1.7 → เต็มที่ 2.5) และ `humidAirStress` (VPD < 0.5 → เต็มที่ 0.2) เพดาน 0.5, rise/recovery 6 ชม. (`cfg.airStress`); รวมแบบไม่หักซ้ำ: แห้งอยู่กลุ่มน้ำ, ชื้นจัดอยู่กลุ่มธาตุอาหาร (`combinedStress`); รวมใน Health แต่ต่ำกว่าเกณฑ์ Damage; Event `plant.dryAir_stress`/`plant.humidAir_stress`
- [x] shared: `airComfort` (แห้ง/เหมาะสม/ชื้นจัด), สาเหตุ 🏜️/💦, `SENSOR_RANGES.vpdKPa` ok 0.5–1.7 / warn 0.3–2.3
- [x] UI (ไม่เปลี่ยน Layout): Meter Dry/Humid air stress ในแผงต้นผัก, หน้าปัด "อากาศ" (แทน ความชื้น) ด่านที่คุมหมอก แสดงคำ + RH %, ข้อความผู้ช่วยตาม VPD (แห้ง → เปิดหมอก, ชื้นจัดขณะเปิด → ปิด, ด่านที่ล็อก → ผู้ช่วยฟาร์มดูแล)
- **ผลตรวจ:** AC-47 ผ่าน — (1) VPD 2.6 น้ำพอ Stress ขึ้นช้า ๆ ถึง ~0.5 โตช้ากว่า; (2) ห้อง 35 % เปิดหมอกแล้ว VPD ลด Stress ลดเกินครึ่ง โตดีกว่า; (3) เปิดหมอกค้าง กลางคืนชื้นจัด Stress > 0.1 ปิดแล้วลดเหลือ < 1/5; (4) สูตรดูแล 72 ชม. ไม่มี Air stress, ชื้นจัดสุดขีด 5 วันไม่มี Damage; (5) Tick 1 s vs 60 s ได้ผลเท่ากัน + levels tests ⭐⭐⭐ เดิมผ่าน; (6) P29 tests เดิมผ่าน; tests 282/282 (37 files), typecheck และ build ผ่าน; Browser: Meter ใหม่แสดง 0 % ที่ VPD 1.10, ไม่มี Console error
- **ยังไม่ได้ตรวจใน Browser:** หน้าปัด "อากาศ" (ด่าน 3–4 ต้องปลดล็อก) — ตรวจด้วย Unit test

### P34 — อธิบายเหตุผลในคู่มือ/ผู้ช่วย/ข้อมูลอุปกรณ์
- [ ] SPEC ก่อน: คู่มือในเกม, Briefing, ข้อความผู้ช่วย และป้ายข้อมูลอุปกรณ์ (คลิกในฉาก) บอก ปัญหา → อุปกรณ์ → ผลดี/ผลข้างเคียง ตรงกับ Model; ไม่เปลี่ยน Layout → commit `phase(P34): ...`
- หมายเหตุ: `docs/GAME-GUIDE.md` มีการจัดรูปจาก Obsidian ของผู้ใช้ค้างอยู่ — ถามผู้ใช้ก่อน commit ไฟล์นี้

## Milestone 3–5 (แตก Phase ละเอียดเมื่อถึงรอบ)

| Milestone | Phase คร่าว ๆ |
|---|---|
| M3 One Real FX5U | SLMP 3E Binary client · Batch R/W · Reconnect/Timeout/Heartbeat · Communication Monitor UI · ทดสอบกับ FX5U จริง · Ladder examples |
| M4 Multi-Lab Classroom | 10 LabSession + Config IP · Auth/สิทธิ์ · Teacher Dashboard · SQLite · Concurrent connection test |
| M5 Advanced | Scenario library 10 บท + metrics · Experiment logging/export · Performance evaluation · Real sensor provider architecture |

## P26 — Green Oak Visual Refinement (ตามภาพผู้ใช้ 2026-10-18)
- ปรับภาพก่อน P22–P25 ตามคำขอล่าสุด; ไม่เปลี่ยนสมการหรือ PLC mapping
- [x] ใบ Rosette กว้างเตี้ย หยักมน และปรับวัสดุปลูก/แสง
- [x] เริ่มด้วย HUD ย่อและแผงควบคุม รายละเอียดเปิดจาก Dock
- [x] ตรวจ Browser High/Low + tests/typecheck/build และ commit

- ผลตรวจ: tests 186/186, typecheck/build ผ่าน; Browser 1280×720 ตรวจมุมรวม/ซูมต้น 5, Low, Dock Sensors, ไม่มี Console error; ไม่ Reset/เริ่มเกมใน Lab ผู้ใช้; เปิด preview 3307 ให้ตรวจรับ ภาพยังเป็น Procedural stylized และยังไม่ได้ตรวจภาพต้นโตเต็มวัย/ตายรอบนี้

## P27 — Flow Sensor ตามภาพตัวอย่าง
- [x] ตัวเรือนดำ ฝาแปดเหลี่ยม ข้อต่อ Union ซ้าย/ขวา คอบน/ล่าง สกรูและสายสัญญาณสั้น
- [x] ต่อท่อเข้าด้านซ้ายให้ตรงแกนทางออกขวา; คง D107/flowLpm และ Clickable เดิม
- [x] tests 186/186, typecheck/build ผ่าน; Browser คลิก Flow Sensor แสดง D107 0.00 L/min และไม่มี Console error; รอผู้ใช้ตรวจรับรูปทรง


## งานปรับท่อและน้ำล้น — 2026-10-18
- จัดท่อน้ำเป็นแนวตรง/ข้อศอกสั้นด้วย RoutedPipe, ลดการพาดเหนือผัก และวางสายปุ๋ยขนานด้านหลัง
- เพิ่ม overflowFlowLpm จากปริมาณน้ำล้นจริงใน Simulation, หยดน้ำ 3D ตาม simTimeS และข้อความเตือนทั้ง 3D/2D; ปิดปั๊มแล้วหยุด ไม่มีการหักคะแนนเพิ่ม
- ตรวจ tests 187/187, typecheck/build ผ่าน; Browser ตรวจคำเตือนและปิดปั๊มขณะ Pause แล้วคำเตือนหาย ไม่มี Console error
- ผู้ใช้ให้หยุดและ commit แล้ว; Preview รุ่นล่าสุด http://127.0.0.1:3308/?lab=lab02 (ตัวอย่างน้ำล้น) ส่วน 3307 เป็น Server รุ่นก่อน ไม่ได้ปิดหรือ Reset
