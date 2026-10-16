---
title: Development Phases
updated: 2026-10-16
tags: [green-oak, roadmap]
---

# Development Phases

เกี่ยวข้อง: [SPEC.md](SPEC.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

**กติกา**
- ทำทีละ Phase และ**หยุดให้ผู้ใช้ตรวจ**ก่อนเริ่ม Phase ถัดไปทุกครั้ง
- จบ Phase = เกณฑ์ผ่านครบ + `npm test` ผ่าน + **git commit** (`phase(Px): …`)
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

## Milestone 2–5 (แตก Phase ละเอียดเมื่อถึงรอบ)

| Milestone | Phase คร่าว ๆ |
|---|---|
| M2 Plant Behavior Engine | Light stress (สะสม, ห้ามเหี่ยวทันที) · Low light · Nutrient (EC/pH) · Root stress + Estimated O₂ · Recovery model · Curl visual · Timeline + Growth chart · Unit tests |
| M3 One Real FX5U | SLMP 3E Binary client · Batch R/W · Reconnect/Timeout/Heartbeat · Communication Monitor UI · ทดสอบกับ FX5U จริง · Ladder examples |
| M4 Multi-Lab Classroom | 10 LabSession + Config IP · Auth/สิทธิ์ · Teacher Dashboard · SQLite · Concurrent connection test |
| M5 Advanced | Scenario library 10 บท + metrics · Experiment logging/export · Performance evaluation · Real sensor provider architecture |
