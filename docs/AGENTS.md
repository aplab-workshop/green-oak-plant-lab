# AGENTS.md — คู่มือสำหรับ AI ที่มาทำงานต่อ

ไฟล์นี้สำหรับ AI coding assistant ทุกตัว (Claude, Codex, Cursor, Copilot, Gemini ฯลฯ) **อ่านไฟล์นี้ให้จบก่อนแก้โค้ด**

## 1. โปรเจกต์คืออะไร

Green Oak Virtual Plant Lab คือห้องแล็บเสมือนสำหรับให้นักเรียนฝึกเขียน Ladder บน PLC Mitsubishi FX5U เพื่อควบคุมระบบปลูกผักสลัด Green Oak แบบ DWC ระบบประกอบด้วย Simulation บน Server, PLC Gateway (ตอนนี้ยังเป็น Mock) และ 3D Dashboard

## 2. อ่านเอกสารตามลำดับนี้

1. `docs/PHASES.md` — สถานะปัจจุบันและงานถัดไป (**เริ่มที่นี่**)
2. `docs/SPEC.md` — ข้อกำหนด (FR-xx, NFR-xx) และ Acceptance Criteria (AC-xx)
3. `docs/ARCHITECTURE.md` — โครงสร้าง, สมการ Simulation, และ Implementation Notes ของแต่ละ Phase
4. `docs/DEVICE-MAP.md` — PLC Address (D100–D112, D120, M100–M105, D200) และกฎการเขียน/อ่าน
5. `README.md` — วิธีติดตั้งและรัน

## 3. สถานะ (อัปเดตล่าสุด 2026-10-18)

- **Milestone 1 เสร็จแล้ว** (git tag `m1`) — P0–P7 ผ่านครบ, เทสต์ 100/100
- **Milestone 2 Plant Behavior Engine:** **P8–P15 และส่วนต่อ P16–P21 เสร็จ (tests 181/181 + typecheck + build ผ่าน)**; P21 เพิ่มด่าน L1–L4 (`sim-core/src/levels.ts`), Mission/เวลาจำกัด/ดาว/งบไฟ, ผู้ช่วยฟาร์ม (`server/src/lab/farmHelper.ts`) และ `selectLevel` (SPEC § 4.6); ออกแบบเกม v2 อยู่ใน `docs/GAME-DESIGN.md`, คู่มือผู้เล่น `docs/GAME-GUIDE.md`; P20 เพิ่ม Game flow `ready → playing → won | lost`, คำสั่ง startGame/harvest, Harvest Bonus, testRun เมื่อใช้ Auto และ Speed 1440x/3600x (SPEC § 4.5); ถัดไป P22 Dose/pH Down (M106) → P23 Events → P24 UI → P25 Plant Feedback (แผนใน PHASES); P19 จัดแผงรอบฉากแบบเปิดพร้อมกัน/ขยายได้ ปรับ Humidifier เป็นหมอกและชุดเติมน้ำ/Air Pump/Power Meter; P18 ปรับพัดลมกรอบดำ/ใบโค้งและลูกศรตาม M100 พร้อมแก้การสลับ Low ขณะเลือกอุปกรณ์; P17 เปลี่ยน Dashboard เป็น HUD ย่อ/ขยาย เพิ่ม Care Score/Best และ Game Over เมื่อตายครบ; หยุดให้ผู้ใช้ตรวจรับก่อนงานถัดไปและก่อน tag `m2`; ยังไม่เริ่ม M3
- คะแนนอยู่ใน `sim-core/src/careGame.ts`; ตายเมื่อ Damage = 1 ไม่ฟื้น/ไม่ดูดน้ำ/ไม่โต; Best แยก Lab/Scenario อยู่ใน Memory ของ LabSession เท่านั้น (SPEC § 4.4)
- คู่มือทดลอง/หลักฐานอยู่ที่ `docs/M2-ACCEPTANCE.md`; โหมดห้องเรียนตรวจผ่าน IP LAN บนเครื่อง Server แล้ว ยังไม่ได้ตรวจเครื่องนักเรียนอีกเครื่องหรือ PLC จริง
- P10 แก้ pH drift เป็น Empirical equilibrium แล้ว (ARCHITECTURE § 11.3/11.8); ยังไม่ใช่ Model เคมีที่ปรับเทียบกับข้อมูลจริง

## 4. วิธีทำงานที่เจ้าของโปรเจกต์ต้องการ (สำคัญ)

- **ทำทีละ Phase** ห้ามทำหลายอย่างพร้อมกัน แต่ละ Phase ต้องมีเกณฑ์ผ่านที่ทดสอบได้
- **ก่อนเริ่ม Milestone ใหม่:** วางแผนแตก Phase ลง `docs/PHASES.md` ก่อน ให้ผู้ใช้อนุมัติแล้วค่อยเขียนโค้ด
- **จบแต่ละ Phase:** `npm test` และ `npm run typecheck` ต้องผ่าน → อัปเดต docs (Checklist ใน PHASES, AC ใน SPEC, Implementation Notes ใน ARCHITECTURE) → `git commit` ด้วยข้อความ `phase(Px): ...` → **หยุดให้ผู้ใช้ตรวจ** ก่อนเริ่ม Phase ถัดไป
- **ถ้าต้องเปลี่ยนพฤติกรรมของระบบ:** แก้ Spec ก่อน แล้วค่อยแก้โค้ด
- **ภาษา:** อธิบายเป็นภาษาไทย ศัพท์เทคนิคใช้ภาษาอังกฤษ (ทั้งใน UI, เอกสาร และคอมเมนต์)
- เอกสารเป็น Markdown (ผู้ใช้เปิดด้วย Obsidian)
- **Priority:** Functional Simulation > Correct Data Flow > Educational Value > 3D Visual Quality

## 5. กฎของโค้ด (ห้ามละเมิด)

- `packages/sim-core` ต้องเป็น Pure TypeScript: ห้าม import React, Three.js หรือ Node I/O และห้ามใช้ `Date.now()` (NFR-03)
- การคำนวณพืชอยู่ใน `sim-core` เท่านั้น ส่วนฝั่ง Web แค่แปลง State เป็นภาพ (`apps/web/src/scene/plantVisuals.ts`)
- PLC Gateway **เขียนได้เฉพาะ** D100–D112 และ D120 และ**ห้ามเขียน M Device เด็ดขาด** (FR-31, มี guard + test)
- ภาพ 3D ต้องขับด้วยข้อมูลจาก Server เท่านั้น ห้ามมี Animation ที่เล่นเองโดยไม่ขึ้นกับ Simulation
- พารามิเตอร์ของ Model อยู่ที่ `packages/sim-core/src/config/defaultConfig.ts` พร้อมหน่วยและคำอธิบาย
- Zustand selector ห้ามคืน object/array ใหม่ทุกครั้ง (เช่น `?? []`) เพราะทำให้ React render วนไม่รู้จบ
- ไม่มี Placeholder ที่กดแล้วไม่ทำงาน (FR-55)
- TypeScript strict และใช้ Vitest

## 6. คำสั่งที่ใช้บ่อย

| คำสั่ง | ใช้ทำ |
|---|---|
| `npm install` | ติดตั้ง (Node.js ≥ 20) |
| `npm run dev` | รันพัฒนา → http://localhost:5173 |
| `npm test` | เทสต์ทั้งหมด |
| `npm run typecheck` | ตรวจ TypeScript |
| `npm run serve` | Build + รันโหมดห้องเรียน (LAN) |

## 7. แผนที่โค้ด

| ที่อยู่ | หน้าที่ |
|---|---|
| `packages/shared` | Type, Device map, Protocol (zod) ที่ Server/Web ใช้ร่วมกัน |
| `packages/sim-core` | Clock, Environment, Plant, Sensors, `Simulation` |
| `apps/server/src/lab` | `LabSession` (วงจร Sim ↔ PLC, Fail-safe), `LabManager` |
| `apps/server/src/plc` | `PlcAdapter` interface, `MockPlcAdapter` — M3 จะเพิ่ม `slmp/` |
| `apps/server/src/api` | REST + WebSocket |
| `apps/web/src/dashboard` | แผงต่าง ๆ ของ Student Dashboard |
| `apps/web/src/scene` | ฉาก 3D (R3F) |

## 8. ส่งต่องานระหว่าง AI

- ก่อนเลิกงานทุกครั้ง: commit งานที่เสร็จ และอัปเดต `docs/PHASES.md` (และหัวข้อ "สถานะ" ในไฟล์นี้) ให้ AI ตัวถัดไปรู้ว่าทำถึงไหน
- งานที่ทำค้างไว้ ให้จดใน `docs/PHASES.md` ใต้ Phase นั้นว่าเหลืออะไร
- อย่า commit `.env`, `node_modules`, `dist`

### สถานะเพิ่มเติม 2026-10-18 — P26
- ตามคำสั่งผู้ใช้ ปรับ Green Oak/แสง/วัสดุปลูก และ HUD เรียบง่ายก่อน P22–P25; tests 186/186 + typecheck/build ผ่าน และ Browser High/Low/Selection ตรวจแล้ว
- P26 รอผู้ใช้ตรวจรับ; P22–P25 ยังไม่เริ่มต่อ ไม่ tag m2; preview ล่าสุด http://127.0.0.1:3307/?lab=lab01
- AGENTS.md ของ repo อยู่ใน docs/AGENTS.md

### สถานะเพิ่มเติม — P27 Flow Sensor
- ปรับ Flow Sensor ตามภาพผู้ใช้: ฝาดำแปดเหลี่ยม, ข้อต่อสองข้าง, คอและสกรู; ท่อเข้าแกนซ้าย/ออกขวา
- tests 186/186 + typecheck/build ผ่าน; Browser คลิก D107 ผ่าน ไม่มี Console error; รอผู้ใช้ตรวจรับรูปลักษณ์ที่พอร์ต 3307

### สถานะเพิ่มเติม 2026-10-19 — P22 Dose Actuators + pH Down
- เสร็จและ commit แล้ว: คำสั่ง `dose` นับเวลาจำลอง (SPEC § 4.7), pH Down M106 ครบทุกชั้น, ผู้ช่วยฟาร์มสั่งปุ๋ย/pH Down เป็นโดส (แก้ EC พุ่งที่ 3600x); tests 206/206 + typecheck/build ผ่าน
- `CLAUDE.md` ชี้มาที่ไฟล์นี้แล้ว (`@docs/AGENTS.md`); เทสต์ยาวต้องใส่ timeout เอง (ดูตัวอย่าง 30000 ใน lab.test.ts)
- ถัดไป P23 Events & Challenge — รอผู้ใช้ตรวจรับ P22 ก่อน; ยังไม่ tag m2

### สถานะเพิ่มเติม 2026-10-19 — P23 Events & Challenge
- เสร็จและ commit แล้ว: เหตุการณ์ 5 ชนิด (SPEC § 4.8), ตาราง Deterministic ตาม Seed + ด่าน, Auto-pause, ซ่อมถัง; L3 ขยายเป็น 10 วัน; tests 229/229 + typecheck/build ผ่าน
- ตรวจ UI ด้วย Server ทดสอบแยก (สคริปต์อยู่นอก repo) เพราะ L3/L4 ล็อกจนกว่าจะชนะด่านก่อนหน้า — ถ้าต้องตรวจอีก ให้ปลดล็อกผ่าน fixture ไม่ใช่แก้โค้ด
- `docs/GAME-GUIDE.md` มีการจัดรูปตาราง (จาก Obsidian ของผู้ใช้) ค้างไม่ได้ commit — อย่า revert
- ผู้ใช้ตรวจรับ P23 แล้ว (2026-10-19); ถัดไป P24 Simple Game UI; ยังไม่ tag m2

### สถานะเพิ่มเติม 2026-10-19 — P24 Simple Game UI
- เสร็จและ commit แล้ว: หน้าจอเกม 5 ส่วนสำหรับโหมดด่าน (`apps/web/src/game/`), ลิ้นชัก 🔬, เลือกด่าน, ผ่านด่าน; Free Play ยังใช้ Layout เดิม; tests 240/240 + typecheck/build ผ่าน
- แก้ UI โหมดด่านที่ `game/`; แก้ Free Play ที่ส่วนเดิมใน `App.tsx` และ `dashboard/`
- ถัดไป P25 Plant Feedback — รอผู้ใช้ตรวจรับ P24 ก่อน; ยังไม่ tag m2

### สถานะเพิ่มเติม 2026-10-20 — P24b
- ผู้ใช้ตรวจ P24 แล้วชอบ Layout เดิม: ทุกโหมดกลับไปใช้ Layout P19; เก็บการ์ดเลือกด่าน 🗺️, ข้อความผู้ช่วย 💬 เหนือ Dock, หน้าผ่านด่าน; ลบหน้าจอ 5 ส่วน/ลิ้นชัก 🔬; tests 236/236 + typecheck/build ผ่าน
- อย่าแยก Layout โหมดด่านอีกโดยไม่ถามผู้ใช้; ถัดไป P25 Plant Feedback — รอผู้ใช้ตรวจรับ P24b ก่อน; ยังไม่ tag m2
- ตรวจ UI ใน Browser อย่าเลือกด่านใน Lab ที่ผู้ใช้เล่นค้าง (selectLevel รีเซ็ตรอบ); dev server ใช้ ?lab= เลือก Lab

