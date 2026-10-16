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

### P2 — Environment Model (`sim-core`)
- [ ] `SimClock` (dt คงที่, speed, pause, accumulator)
- [ ] Tank water balance, Refill, Evaporation
- [ ] LED → PPFD (position factor), DLI
- [ ] Air temp / RH / Water temp / VPD, EC (salt mass), pH drift, Power
- [ ] `defaultConfig.ts` พร้อมหน่วยและคำอธิบาย
- **ผ่านเมื่อ:** Unit tests AC-01, AC-02, AC-06, AC-07

### P3 — Plant Model: Water (`sim-core`)
- [ ] PlantState ครบทุก field (FR-20), Root access, Demand/Supply
- [ ] Hydration, Water stress, Damage (ถาวร), Recovery, Health
- [ ] Growth baseline (logistic) → LeafArea, LeafCount, RootLength, Stage
- [ ] `Simulation.step()` รวม Environment + Plants + Sensors
- **ผ่านเมื่อ:** Unit tests AC-03, AC-04, AC-05

### P4 — Server, Lab Session, Mock PLC
- [ ] `PlcAdapter` interface + write guard, `MockPlcAdapter` (manual / auto / offline)
- [ ] `SensorProvider` + `SimulatedSensorProvider`
- [ ] `LabSession`, `LabManager`, `EventLog`, `History`
- [ ] REST routes + WebSocket snapshot stream
- **ผ่านเมื่อ:** Integration tests AC-08, AC-09, AC-10, AC-11

### P5 — Student Dashboard
- [ ] Layout 5 ส่วน (FR-50), Zustand store + WS client
- [ ] Sensor panel, Actuator panel (manual control / auto mode), Plant detail
- [ ] Speed / Pause / Reset, กราฟ (Water level, Hydration, Stress), Event log
- [ ] Disclaimer "Educational Simulation"
- **ผ่านเมื่อ:** ค่าทุกช่องมาจาก Server และทุกปุ่มทำงาน (ตรวจด้วย Browser)

### P6 — 3D DWC Scene
- [ ] Tank + lid + water (level จริง) + net pots 6 ใบ + pipes + sensor probes
- [ ] Procedural Green Oak + roots + `plantVisuals()` (unit test)
- [ ] Actuators: LED (dimmable), Fan (หมุน), Humidifier (หมอก), Pumps, Air bubbles
- [ ] Orbit/Zoom/Pan, select plant, click actuator, roots toggle, cutaway, day/night, low graphics
- **ผ่านเมื่อ:** AC-12, AC-13, AC-14

### P7 — M1 Acceptance
- [ ] README ภาษาไทย (ติดตั้ง, รัน, ใช้ผ่าน LAN, ทดสอบ)
- [ ] Scenario `water-shortage` ทดสอบครบวงจร
- [ ] ตรวจ AC-01 … AC-15 ครบ แล้ว Tag `m1`

---

## Milestone 2–5 (แตก Phase ละเอียดเมื่อถึงรอบ)

| Milestone | Phase คร่าว ๆ |
|---|---|
| M2 Plant Behavior Engine | Light stress (สะสม, ห้ามเหี่ยวทันที) · Low light · Nutrient (EC/pH) · Root stress + Estimated O₂ · Recovery model · Curl visual · Timeline + Growth chart · Unit tests |
| M3 One Real FX5U | SLMP 3E Binary client · Batch R/W · Reconnect/Timeout/Heartbeat · Communication Monitor UI · ทดสอบกับ FX5U จริง · Ladder examples |
| M4 Multi-Lab Classroom | 10 LabSession + Config IP · Auth/สิทธิ์ · Teacher Dashboard · SQLite · Concurrent connection test |
| M5 Advanced | Scenario library 10 บท + metrics · Experiment logging/export · Performance evaluation · Real sensor provider architecture |
