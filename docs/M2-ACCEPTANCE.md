---
title: Milestone 2 — Acceptance & Experiments
updated: 2026-10-17
tags: [green-oak, acceptance, experiments]
---

# M2 Acceptance & Experiments

เอกสารตรวจรับ Plant Behavior Engine P8–P15 คู่กับ [SPEC § 8.1](SPEC.md#81-acceptance-criteria--milestone-2) และ [Architecture § 11](ARCHITECTURE.md) ยังไม่รวมการปรับรูปลักษณ์ Model ตามภาพโรงเรือนอ้างอิง และยังไม่ tag `m2` จนกว่าผู้ใช้ตรวจรับ

## 1. รันทดสอบซ้ำบน Windows

เปิด PowerShell ที่โฟลเดอร์โปรเจกต์ หลังติดตั้ง dependencies แล้ว:

```powershell
npm test
npm run typecheck
npm run build
```

สำหรับตรวจโหมดห้องเรียนโดยไม่แก้ `.env`:

```powershell
$env:SERVER_HOST='0.0.0.0'
$env:SERVER_PORT='3302'
$env:LAB_COUNT='2'
npm run serve
```

เปิด URL ที่ Server แสดงพร้อม `?lab=lab01` หรือ `?lab=lab02`; หยุด Server ด้วย Ctrl+C ค่า Environment นี้มีผลเฉพาะ PowerShell ปัจจุบัน ดูการใช้งาน LAN ใน [README](../README.md#5-ใช้งานในห้องเรียนผ่าน-lan)

## 2. หลักฐาน Automated acceptance

การรัน Simulation และ Plant fixtures ใช้ Fixed step 1 s; Unit tests ของสูตรมีการตรวจช่วงเวลาอื่นด้วย ส่วน FakeClock เร่งการทดสอบโดยไม่ต้องรอเวลาจริง ไม่ข้ามขั้นคำนวณพืช

**ผลตรวจ 2026-10-17:** 22 test files, 154/154 tests ผ่าน (64.22 s), `npm run typecheck` ผ่าน และ `npm run serve` build สำเร็จพร้อมเปิดหน้าเว็บ/REST/WS บนพอร์ตเดียว

| AC | Setup / สิ่งที่ตรวจ | Test file |
|---|---|---|
| 16–18 | PPFD 650 → 250, Heat/Water amplification, Low Light 50 เทียบ 250, Photoperiod 3 วัน, Midnight/DLI | `packages/sim-core/test/lightStress.test.ts` |
| 19–21 | EC 0/3.2 และ pH 4/9 แยกสาเหตุ, Stress 24 h + Recovery 48 h, Salt balance, Sensor noise, pH 30 วัน | `packages/sim-core/test/nutrientStress.test.ts` |
| 22–24 | Air OFF/ON, น้ำร้อน/น้ำต่ำ, Root access, Root Health, Uptake ตามน้ำจริง, ถังแห้ง/รากยาว | `packages/sim-core/test/rootStress.test.ts` |
| 25 | Healthy reference 30 วัน: Biomass เฉลี่ย 70–150 g, Damage <0.01 | `packages/sim-core/test/nutrientStress.test.ts` |
| 25–26 | Stress รวม, Exposure 1.5/24 h + Recovery 48 h, Damage ไม่ลด, 1x/60x/360x, Pause/Reset | `packages/sim-core/test/integratedGrowth.test.ts` |
| 27 | Start/Clear threshold 0.3/0.15 อย่างละครั้ง | `packages/sim-core/test/stressEvents.test.ts` |
| 27 | Snapshot/History, 15 วันไม่เกิน 2016 จุด, Event ไม่เกิน 1000, Lab isolation, REST/WS/runId | `apps/server/test/history.test.ts`, `apps/server/test/app.test.ts` |
| 28 | Curl ตาม State และ PPFD ไม่สั่ง Droop, เลือกต้น/ช่วงเวลา, ข้อมูลหาย, Reset/Lab/request race | `apps/web/test/dashboard.test.ts`, `apps/web/test/timeline.test.ts` |
| 29 | Command ผ่าน Mock PLC → Model → Snapshot/History/Event: High Light/Recovery, EC/pH ทั้งสองด้าน, Air OFF/ON | `apps/server/test/m2Acceptance.test.ts` |
| M1 regression | Water shortage, Refill/Recovery, PLC loop 3 วัน, Allowlist, Fail-safe, UI/Geometry, LAN serving | Test suite เดิมทั้งหมดรวมอยู่ใน `npm test` |

รันเฉพาะกลไกได้ เช่น:

```powershell
npm test -- packages/sim-core/test/lightStress.test.ts
npm test -- packages/sim-core/test/nutrientStress.test.ts
npm test -- packages/sim-core/test/rootStress.test.ts
npm test -- packages/sim-core/test/integratedGrowth.test.ts
npm test -- apps/server/test/m2Acceptance.test.ts
```

## 3. วิธีสาธิตใน Dashboard

### เตรียมทุกการทดลอง

1. เลือก Lab และล้าง Scenario ถ้ามี (Reset ปกติยังคง Scenario เดิม)
2. Reset → เลือก Manual → ตั้ง Actuator ใหม่ทุกครั้ง เพราะการเปลี่ยนโหมดเริ่มจาก LED 0%, ปั๊มอื่น OFF และ Air ON
3. ใช้ 360x: 1 h จำลอง = 10 s จริง, 24 h = 4 min จริง; ดูเวลาจำลองเป็นหลัก ถ้าเครื่องคำนวณไม่ทันจะมี Event `sim.lagged`
4. เลือกต้นที่แผง Plant หรือฉาก; Trends และ Timeline ใช้ต้น/ช่วงเวลาเดียวกัน มี Global events รวมด้วย กราฟเก็บทุก 10 นาทีจำลอง ต้องมีอย่างน้อย 2 จุด
5. Pause หยุด Model และ History; การสื่อสาร PLC, Sensor noise และ Event คำสั่งยังทำงาน จึงไม่ควรใช้การขยับของ Sensor display ตัดสินว่า Model ยังเดิน

### Healthy growth และ Low Light

- สำหรับสาธิต Growth ให้ใช้ Auto, ไม่มี Scenario และดู Biomass รายต้นในกราฟ Growth ข้ามวัน
- เพื่อแยกผล Low Light ให้ใช้สอง Lab ที่เริ่มใหม่: Manual, Air ON, LED 10% เทียบ 60%, น้ำถึงราก, คุม Fan/ระดับน้ำ/EC ให้ใกล้กัน นาน 3 วันจำลอง; กลุ่มแสงน้อยควรโตช้ากว่าโดยไม่เหี่ยวทันที
- การเปรียบเทียบ Browser มีความต่างเริ่มต้นตาม Seed/ตำแหน่งและอุณหภูมิ ให้เปรียบเทียบการเพิ่ม Biomass จากค่าเริ่มต้น ไม่เทียบค่าปลายทางล้วน
- เกณฑ์ตัวเลข Healthy 30 วันตรวจด้วย test: LED 80% เวลา 06–22, Refill เมื่อ <70%, Fan เมื่อ >25 °C, A+B เมื่อ EC <1.0, Air ON; การสาธิต Auto ไม่แทนการทดลองควบคุมนี้

### High Light และ Curl

- Manual, LED 100%, Air ON, น้ำเพียงพอ; เลือก Plant 2 หรือ 5 (กลางถัง) แล้วเร่งเวลา 6 h ดู Light Stress ใน Plant Stress chart และใบม้วน
- Default LED สูงสุด 400 µmol/m²/s ที่กลางถัง; มุมถังได้ 340 ซึ่งต่ำกว่า threshold 350 จึงอาจไม่มี Light Stress ในต้นมุม
- ลด LED เหลือ 60% และติดตาม 12 h; Light Stress ค่อยลด ไม่เปลี่ยนเป็นศูนย์ทันที; Damage ที่เกิดแล้วคงอยู่
- เกณฑ์ Stress >0.9 ที่ PPFD 650 ใช้ **Test fixture** ที่ override `light.ppfdMax=650` เท่านั้น UI Default ไม่สามารถสร้าง 650 ได้ ไม่เพิ่มปุ่มหรือแก้ Config ปกติเพื่อให้ผ่านเกณฑ์

### Nutrient / EC / pH

- Manual, LED 60%, Air ON, ไม่มี Leak; เปิด Nutrient A และ B ชั่วครู่ ดู EC เพิ่ม แล้วปิดทั้งคู่ ใช้ 1x/60x ตอน Dosing เพื่อควบคุมระยะเวลา
- ถ้าปล่อยจน EC >3.2 จะสะสม Nutrient Stress; ดูกราฟ EC/pH ควบคู่ Plant Stress และ Biomass ไม่ควรสรุปจากค่า Sensor ครั้งเดียวที่มี Noise
- Dashboard ไม่มีปุ่มกำหนด Initial EC/pH หรือเปลี่ยนสารละลายทั้งถัง และ A/B ไม่ใช่ pH controller
- ตรวจทั้ง EC ต่ำ/สูง และ pH ต่ำ/สูงพร้อม Recovery แบบควบคุมด้วย `nutrientStress.test.ts`: EC 1.2/pH 6 เป็น Control; แยก EC 0/3.2 หรือ pH 4/9 24 h → Stress >0.95; คืน EC 1.2/pH 6 ต่อ 48 h → Stress <0.02
- `m2Acceptance.test.ts` ตรวจ Initial EC 0/3.2, pH 4/9 ผ่าน LabSession 6 h → Stress >0.3 และ Event ครบ 6 ต้น พร้อมข้อมูล History ตรง Snapshot; pH ในการทดสอบนี้ยังเคลื่อนตาม Model ไม่ได้ตรึงไว้เหมือน Plant fixture

### Air Pump OFF/ON และ Root Health

- Manual, LED 60%, Air ON, น้ำประมาณ 85%; เลือกกราฟ Root & Oxygen
- ปิด Air ต่อ 12–24 h จำลอง: Estimated Oxygen ลดก่อน แล้ว Root Health ลดตาม แม้น้ำยังถึงราก
- เปิด Air อีกครั้ง ติดตาม 6–24 h: Oxygen ฟื้นก่อน Root Health และ Growth; ถ้าน้ำพ้นรากต้องเติมน้ำด้วย
- เกณฑ์ควบคุมที่น้ำ 24 °C: OFF 12 h → Oxygen <21%, ON ต่อ 6 h → >90%; LabSession fixture ห้องคงที่ 24 °C/ไม่มี LED heat ตรวจ OFF 24 h → Root Health <60%, ON ต่อ 24 h → >90%
- ค่า Browser จริงอาจต่างเพราะ Water Temperature เปลี่ยน ดัชนีนี้ไม่ใช่ DO Sensor หรือ mg/L

### Water shortage และ Recovery ทัน/ล่าช้า

- Start `Water Shortage Simulation` → Manual → LED 80%, Air ON; ตรวจกราฟ Water & Stress และ 2D ที่เห็นปลายราก
- ถังเริ่ม 65%, Leak 1.5 L/h; ระดับน้ำลดก่อน Stress เพิ่ม ภายใน 12 h จะเห็น Water Stress ชัดใน Integration test
- กรณีช่วยทัน: เปิด Refill ก่อนเกิด Damage แล้วปิดเมื่อระดับน้ำกลับมาประมาณ 85–90%; ยังคง Leak อยู่จึงต้องเติมซ้ำหรือเปลี่ยนเป็น Auto
- กรณีช่วยช้า: ทดลองใหม่แล้วปล่อยจน Damage >0 ก่อนเติมน้ำ; Hydration/Health อาจฟื้นไม่เต็มและ Damage ไม่ลด; Refill ยังเจือจาง EC จึงต้องดู Nutrient Stress ร่วมด้วย
- เกณฑ์แยกเวลา Recovery ใช้ `integratedGrowth.test.ts`: PPFD 650 ที่น้ำ/อุณหภูมิคงที่ 1.5 h หรือ 24 h แล้วลดเป็น 250 ต่อ 48 h; ช่วยทัน Damage <0.01, ช่วยช้า Damage >0 และไม่ลดตลอด Recovery

## 4. Browser checks ที่ทำแล้ว

ตรวจบน Windows ด้วยหน้า production build; P14 ตรวจ Desktop viewport 1366×768 และมุมมองแคบเริ่มต้นของ In-app browser

| Check | หลักฐาน / ผล |
|---|---|
| 3D/Low/Roots/Cutaway | Scene แสดงครบ, ปุ่มเปลี่ยน State ได้, 2D แสดง 6 ต้น |
| Diagnostics / Chart | Plant 3 Payload biomass 5.105974 g → UI 5.1 g; Oxygen 0.95 → 95%; History 8 samples; เลือก Plant 6 เปลี่ยนกราฟและ Timeline ตาม |
| Timeline 6 h / 24 h / 14 days | ทุกตัวเลือกทำงาน; เลือก Growth, Plant Stress และ Root & Oxygen ได้; กรองช่วง/ต้นด้วย tests เพิ่มเติม |
| Pause | เวลา Model ค้าง Day 14 07:14 และ History คง 8 samples หลัง refresh; PLC ยังทำงานตาม Contract |
| Lab isolation | Lab 01 มี 8 samples, สลับ Lab 02 มี 1 sample/ข้อมูลว่าง, กลับ Lab 01 คืนข้อมูลถูกชุด |
| Reset จากอีกแท็บ | Lab 01 กลับ Day 14 06:00, 1 sample และ Event Reset; ไม่มีกราฟ/Event รอบเก่าค้าง |
| WebGL unavailable | HTML fixture ชั่วคราวใน dist คืน null จาก WebGL `getContext` ก่อนโหลด bundle; fallback เป็น 2D, ภาพอยู่ใน Panel, 3D disabled และซ่อน Controls ที่ใช้ไม่ได้ |
| Classroom serving | `npm run serve`, bind 0.0.0.0:3302, 2 Labs; เปิดผ่าน IP LAN 192.168.1.199 บนเครื่อง Server ได้, WS Connected, Manual LED/Air commands และกราฟทำงาน |
| Recovery ใน Browser | LED 100% + Air OFF → Plant 2 Light Stress 26%, Root Health 65%, Oxygen 14%; หลัง Air ON/LED 60% ประมาณ 5 h จำลอง → 7%, 76%, 62%; กราฟ Root/Oxygen แสดงการลดและฟื้น โดยน้ำประมาณ 28.5 °C |
| Chart ครบ 6 กลุ่ม | Growth, Water & Stress, Plant Stress, Root & Oxygen, Climate, EC/pH แสดง series และหน่วยตามตัวเลือก |

Fixture WebGL ใช้ตรวจเฉพาะ Browser ไม่ถูก commit และ build ถัดไปล้างออก; Console ปกติไม่มี application error มี Three.js warnings เรื่อง Clock/ShadowMap จาก dependency และ build เตือน chunk >500 kB

## 5. ขอบเขตผลตรวจและงานส่งต่อ

- การตรวจ LAN รอบนี้ใช้เครื่อง Server เปิดผ่าน IP ของตัวเอง ยังไม่ได้ทดสอบเครื่องนักเรียนอีกเครื่อง/Firewall ของห้องเรียนจริง และไม่ได้ต่อ FX5U
- ผลเชิงตัวเลขเป็น Educational Simulation ยังไม่มี Calibration กับผักจริง; pH เป็น Empirical equilibrium, Oxygen เป็นดัชนี และไม่มีแบบจำลองธาตุอาหารรายชนิด
- History อยู่ใน Memory สูงสุด 2016 จุด/ประมาณ 14 วัน, Events ล่าสุด 1000; การ Reset/Restart ล้างข้อมูล ไม่มี Replay 3D หรือ Persistence
- รูปลักษณ์โรงเรือน ผัก วัสดุ แสง และอุปกรณ์ตามภาพต้นแบบเป็นงานถัดไปหลังผู้ใช้ตรวจ P15; การปรับภาพต้องยังใช้ State จาก Server และไม่เปลี่ยน Model พฤติกรรมโดยไม่มี Spec
- รอผู้ใช้ตรวจรับ M2 ก่อน tag `m2`; M3 SLMP/PLC จริงยังไม่เริ่ม
