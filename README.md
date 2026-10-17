# Green Oak Virtual Plant Lab

ห้องปฏิบัติการเสมือนสำหรับฝึกเขียน PLC **Mitsubishi FX5U** เพื่อควบคุมระบบปลูกผักสลัด Green Oak แบบ Hydroponics **Deep Water Culture (DWC)** ด้วย Simulation และโมเดล 3D แบบ Interactive

> **สถานะ:** Milestone 2 P8–P15 และส่วนต่อ P16–P17 เสร็จ พร้อมให้ผู้ใช้ตรวจรับ — โรงเรือนสไตล์เกม, Dashboard ย่อ/ขยาย, Care Score และ Game Over ใช้ Mock PLC
>
> **Educational Simulation:** แบบจำลองพืชใช้สมการที่อธิบายได้เพื่อการเรียนการสอน **ไม่ใช่**โมเดลทำนายชีววิทยาที่ผ่านการตรวจสอบความแม่นยำ

---

## สารบัญ

1. [ความสามารถใน Milestone 1–2](#1-ความสามารถใน-milestone-12)
2. [สิ่งที่ต้องมี](#2-สิ่งที่ต้องมี)
3. [ติดตั้ง](#3-ติดตั้ง)
4. [รันระหว่างพัฒนา](#4-รันระหว่างพัฒนา-development)
5. [ใช้งานในห้องเรียนผ่าน LAN](#5-ใช้งานในห้องเรียนผ่าน-lan)
6. [การตั้งค่า (.env)](#6-การตั้งค่า-env)
7. [วิธีใช้งาน](#7-วิธีใช้งาน)
8. [ทดสอบ](#8-ทดสอบ)
9. [โครงสร้างโปรเจกต์](#9-โครงสร้างโปรเจกต์)
10. [แก้ปัญหาที่พบบ่อย](#10-แก้ปัญหาที่พบบ่อย)
11. [ข้อจำกัดและแผนถัดไป](#11-ข้อจำกัดและแผนถัดไป)

---

## 1. ความสามารถใน Milestone 1–2

| ส่วน | รายละเอียด |
|---|---|
| **Simulation (Server)** | Fixed time-step, Speed 1x / 60x / 360x, Pause/Resume/Reset, Water mass balance, Refill, LED → PPFD/DLI, Air temp/RH/VPD, Water temp, EC (Salt mass balance), pH (Empirical), Power |
| **Plant model** | ผัก 6 ต้นแยกสถานะ: Water/Light/Nutrient Stress, Root Health, Hydration, Damage ถาวร, Recovery, Growth, Leaf count/area, Root length, Health score รวม Stress |
| **Mock PLC** | จำลอง Device memory ของ FX5U: `auto` (Ladder ตัวอย่าง), `manual` (กดสั่งเอง), `offline` (จำลองสายหลุด) และ Fail-safe เมื่อไม่ได้รับคำสั่ง |
| **Student Dashboard** | Sensor → PLC (D100–D110), Actuator ← PLC (M100–M105, D200), Plant diagnostics + Estimated Oxygen, Growth/Stress chart รายต้น, Timeline 6 h/24 h/14 วัน, Scenario |
| **3D DWC Scene** | โรงเรือน Diorama พร้อมฐานสวน ถังใสฝาขาว พุ่ม Green Oak แบบ Procedural และรากฝอย; ใบตก/เหี่ยว/ฟื้น/ม้วนตาม Simulation, น้ำขึ้นลงจริง, LED, Fan, Humidifier, Pumps, ฟองอากาศ และ Sensor probes ที่คลิกดูข้อมูลได้ |
| **Scenario** | `Water Shortage Simulation` (ระดับน้ำ 65% + รั่ว 1.5 L/h) |

เอกสารออกแบบอยู่ใน `docs/` (เปิดด้วย Obsidian ได้)

| ไฟล์ | เนื้อหา |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | ปัญหา ขอบเขต ข้อกำหนด Acceptance Criteria |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | โครงสร้าง Software, Data Flow, สมการ Simulation |
| [docs/DEVICE-MAP.md](docs/DEVICE-MAP.md) | PLC Memory Mapping, Scaling, Fail-safe, ตัวอย่าง Ladder |
| [docs/PHASES.md](docs/PHASES.md) | Roadmap แบ่ง Phase พร้อม Checklist |
| [docs/M2-ACCEPTANCE.md](docs/M2-ACCEPTANCE.md) | คู่มือทดลอง M2, Test matrix, Browser checks และข้อจำกัด |

## 2. สิ่งที่ต้องมี

- **Windows 10/11** (หรือ macOS / Linux)
- **Node.js 20 ขึ้นไป** (ทดสอบกับ v24.14) — ดาวน์โหลดจาก https://nodejs.org (เลือก LTS)
- Browser ที่รองรับ WebGL: Chrome / Edge / Firefox รุ่นปัจจุบัน
- ไม่ต้องมี PLC หรือ Internet ระหว่างใช้งาน (ต้องใช้ Internet ตอน `npm install` ครั้งแรกเท่านั้น)

ตรวจเวอร์ชัน:

```bash
node -v
```

## 3. ติดตั้ง

เปิด Terminal (PowerShell หรือ Git Bash) ที่โฟลเดอร์โปรเจกต์ แล้วรัน:

```bash
npm install
```

ถ้าต้องการเปลี่ยนการตั้งค่า ให้คัดลอก `.env.example` เป็น `.env` แล้วแก้ค่า (ไม่จำเป็นสำหรับการใช้งานพื้นฐาน)

## 4. รันระหว่างพัฒนา (Development)

```bash
npm run dev
```

- เปิด **http://localhost:5173** ใน Browser
- Server (API + Simulation) อยู่ที่พอร์ต `3001` และหน้าเว็บ (Vite) อยู่ที่ `5173` ซึ่งส่งต่อ `/api` และ `/ws` ไปที่ Server ให้อัตโนมัติ
- แก้โค้ดแล้วหน้าเว็บและ Server รีโหลดเอง
- หยุดด้วย `Ctrl + C`

## 5. ใช้งานในห้องเรียนผ่าน LAN

โหมดนี้ Server เสิร์ฟทั้งหน้าเว็บและ API บน **พอร์ตเดียว** เหมาะกับคอมพิวเตอร์ครูที่เป็น Server ให้นักเรียนเปิดจากเครื่องตัวเอง

**ขั้นตอน**

1. สร้างไฟล์ `.env` ที่โฟลเดอร์โปรเจกต์ และกำหนดให้รับการเชื่อมต่อจาก LAN:

   ```ini
   SERVER_HOST=0.0.0.0
   SERVER_PORT=3001
   ```

2. Build หน้าเว็บและเริ่ม Server:

   ```bash
   npm run serve
   ```

   (เท่ากับ `npm run build` แล้วตามด้วย `npm start` ครั้งต่อไปถ้าไม่ได้แก้โค้ด รันแค่ `npm start` ได้เลย)

3. Terminal จะแสดง URL เช่น `http://192.168.1.20:3001` ให้นักเรียนเปิด URL นี้จากเครื่องในวง LAN เดียวกัน
4. ถ้าเปิดจากเครื่องอื่นไม่ได้ ให้อนุญาต Node.js ใน **Windows Defender Firewall** สำหรับ **Private network** เท่านั้น

> [!warning] ความปลอดภัย
> ใช้ภายในเครือข่ายโรงเรียนเท่านั้น **ห้าม**เปิดพอร์ตนี้สู่ Internet (ไม่ Port-forward บน Router) เพราะยังไม่มีระบบ Login (มาใน M4) และในอนาคต Server จะต่อกับ PLC จริง

**เลือก Lab:** ใส่ `?lab=lab01` ต่อท้าย URL ถ้าตั้ง `LAB_COUNT` มากกว่า 1 จะเลือก Lab จากเมนูบน Header ได้ด้วย

## 6. การตั้งค่า (.env)

ดูตัวอย่างทั้งหมดใน [.env.example](.env.example)

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `SERVER_HOST` | `127.0.0.1` | `0.0.0.0` = เปิดให้เครื่องใน LAN เข้าได้ |
| `SERVER_PORT` | `3001` | พอร์ตของ Server |
| `LAB_COUNT` | `1` | จำนวน Lab (แต่ละ Lab แยกอิสระ) |
| `MOCK_PLC_MODE` | `manual` | โหมดเริ่มต้นของ Mock PLC: `manual` (ผู้เล่น) / `auto` (Test เท่านั้น, ไม่นับ Best) / `offline` |
| `SIM_TICK_MS` | `100` | รอบการเดิน Simulation (ms เวลาจริง) |
| `PLC_POLL_MS` | `500` | รอบการสื่อสารกับ PLC |
| `PLC_COMMAND_TIMEOUT_MS` | `3000` | ไม่ได้รับคำสั่งนานเกินนี้ → Fail-safe |
| `WS_BROADCAST_MS` | `200` | รอบการส่งข้อมูลไปหน้าเว็บ |
| `WEB_DIST` | `apps/web/dist` | โฟลเดอร์หน้าเว็บที่ build แล้ว |

พารามิเตอร์ของแบบจำลอง (ขนาดถัง, อัตราการเติบโต, ความเร็วในการเหี่ยว ฯลฯ) อยู่ที่ [packages/sim-core/src/config/defaultConfig.ts](packages/sim-core/src/config/defaultConfig.ts) พร้อมหน่วยและคำอธิบาย

## 7. วิธีใช้งาน

### 7.1 หน้าจอ

| ตำแหน่ง | ส่วน |
|---|---|
| บน | ชื่อ Lab, สถานะ Mock PLC (connected / FAIL-SAFE), สถานะการเชื่อมต่อ Server |
| ซ้าย | **Sensors → PLC** ค่าที่ส่งเข้า D100–D110 (จุดเขียว/เหลือง/แดงเทียบช่วงแนะนำ) และ **Scenario** |
| กลาง | **Plant View** (3D หรือ 2D), เวลาจำลอง, Speed, Pause, Reset, **Trends** และ **Timeline** |
| ขวา | **Actuators ← PLC** (M100–M105, D200 และโหมด Mock PLC) และ **Plant** รายละเอียดต้นที่เลือก |

### 7.2 มุมมอง 3D

- **ลาก** = หมุน · **Scroll** = ซูม · **คลิกขวาลาก** = เลื่อน
- **คลิกต้นผัก** = เลือกต้น · **ดับเบิลคลิก** = ซูมเข้าหาต้น
- **คลิกอุปกรณ์** (LED, Fan, ปั๊ม, Probe ฯลฯ) = ดูสถานะ, Address PLC และคำอธิบาย
- แถบเครื่องมือมุมขวาบน: `3D/2D`, `Roots`, `Transparent → Cutaway → Opaque`, `Day/Night`, `Low` (สำหรับเครื่องสเปกต่ำ), รีเซ็ตกล้อง
- มุมมอง **2D** เป็นภาพตัดขวางที่เห็นระดับน้ำเทียบกับปลายรากได้ชัดที่สุด

### 7.3 ตัวอย่างการทดลอง: Water Shortage

1. ที่แผง **Scenario** เลือก `Water Shortage Simulation` แล้วกด **Start**
2. ที่แผง **Actuators** เลือกโหมด **Manual** (จำลองว่ายังไม่มีโปรแกรมควบคุม)
3. เลื่อน **LED** เป็น 80% แล้วกด **360x**
4. สังเกต: ระดับน้ำลดลง → รากพ้นน้ำ → Event log แจ้ง **Water stress** → ใบตกและเหี่ยวในฉาก 3D
5. เปิด **Water Refill Pump** สักครู่แล้วปิด → ใบฟื้นกลับมา (ถ้าปล่อยนานจนเกิด **Damage** ต้นจะฟื้นไม่เต็ม)
6. ลองเปลี่ยนเป็นโหมด **Auto** ซึ่งใช้ Ladder ตัวอย่างใน Mock PLC (เติมเมื่อ D106 < 70%, หยุดเมื่อ ≥ 90%) แล้วดูว่าระบบรักษาระดับน้ำได้เอง
7. ลองโหมด **Offline** เพื่อดู **Fail-safe**: ปิดทุกอย่างยกเว้น Air Pump

> [!note] เรื่องการเร่งเวลา
> Timer ใน PLC จริงนับตามเวลาจริง ถ้าบทเรียนใช้ Timer ให้รันที่ **1x** ส่วนบทเรียนแบบ Threshold/Hysteresis เร่งเวลาได้ และใช้ D111 (นาทีของวันจำลอง) ทำ Photoperiod แทน Timer ได้ (ดู [DEVICE-MAP.md](docs/DEVICE-MAP.md))

### 7.4 Plant diagnostics และ Timeline (M2)

- เลือกต้น 1–6 ที่แผง Plant หรือฉาก; กราฟ Growth แสดง **Biomass ของต้นนั้น** กับ Health ส่วนกราฟอื่นแสดง Water, Stress, Root/Oxygen, Climate และ EC/pH
- เลือกช่วง **6 h / 24 h / 14 days** เพื่อกรองทั้งกราฟและ Timeline จนถึงเวลาจำลองปัจจุบัน; Timeline รวม Event ของต้นที่เลือกกับ Global events
- History เก็บทุก 10 นาทีจำลอง สูงสุด 2016 จุด; Event ล่าสุด 1000 รายการ; หลัง Reset ต้องรออย่างน้อย 2 samples จึงมีกราฟ ไม่มี Replay หรือการย้อนเวลา
- Light Stress ทำให้ใบม้วน ส่วน Water Stress/Damage ทำให้ใบตก; การเปิด LED แรงไม่ทำให้เหี่ยวทันที
- **Estimated Oxygen** แสดงดัชนี 0–100% จาก Model ไม่ใช่ DO Sensor หรือ mg/L; ดู Root Health ร่วมกับระดับน้ำและอุณหภูมิ
- Reset จาก Browser ใด ๆ ล้าง History/Events ของ Lab นั้นทุกหน้าต่าง; ปิด Server แล้วข้อมูลใน Memory หาย
- วิธีทดลอง High/Low Light, EC/pH, Air OFF/ON และ Recovery พร้อมเกณฑ์ตรวจรับอยู่ใน [คู่มือ M2](docs/M2-ACCEPTANCE.md)

## 8. ทดสอบ

```bash
npm test
```

```bash
npm run typecheck
```

| กลุ่ม | ตัวอย่างที่ทดสอบ |
|---|---|
| `packages/sim-core` | Water/Light/Nutrient/Root Stress, Recovery, Damage, Healthy growth/pH 30 วัน, Mass balance, DLI, Determinism |
| `apps/server` | Mock PLC loop, Lab isolation, Fail-safe, Write guard, REST/WS, History/Events, Stress/Recovery ผ่าน LabSession, โหมด LAN |
| `apps/web` | State → ภาพ/Curl, Geometry, Sensor ranges, กราฟรายต้น, Timeline, stale response หลัง Reset/สลับ Lab |

ผลตรวจ P15: **154/154 tests**, TypeScript strict และ production build ผ่าน ดูหลักฐานและวิธีทำซ้ำใน [M2-ACCEPTANCE.md](docs/M2-ACCEPTANCE.md)

## 9. โครงสร้างโปรเจกต์

```
Green_oak_plan/
├─ docs/                  เอกสาร Spec / Architecture / Device map / Phases
├─ packages/
│  ├─ shared/             Type, Device map (D/M), Protocol ที่ Server และ Web ใช้ร่วมกัน
│  └─ sim-core/           Simulation ล้วน (ไม่มี I/O) — Environment, Plant, Clock, Sensors
├─ apps/
│  ├─ server/             Fastify: LabSession, Mock PLC, REST, WebSocket, เสิร์ฟหน้าเว็บ
│  └─ web/                React + React Three Fiber: Dashboard และ 3D Scene
├─ .env.example
└─ package.json           npm workspaces + scripts
```

| คำสั่ง | ใช้ทำ |
|---|---|
| `npm run dev` | รันแบบพัฒนา (Server + Vite) |
| `npm run build` | Build หน้าเว็บไปที่ `apps/web/dist` |
| `npm start` | รัน Server (เสิร์ฟหน้าเว็บที่ build แล้วด้วย) |
| `npm run serve` | Build แล้วรัน Server (โหมดห้องเรียน) |
| `npm test` | รัน Unit/Integration tests |
| `npm run typecheck` | ตรวจ TypeScript ทุก Workspace |

## 10. แก้ปัญหาที่พบบ่อย

| อาการ | วิธีแก้ |
|---|---|
| หน้าเว็บขึ้น **Server Disconnected** | ตรวจว่า Server รันอยู่ (Terminal ไม่มี Error) และพอร์ต 3001 ไม่ถูกโปรแกรมอื่นใช้ |
| `EADDRINUSE` ตอนเริ่ม | มีโปรแกรมใช้พอร์ตอยู่ ปิดโปรแกรมนั้นหรือเปลี่ยน `SERVER_PORT` ใน `.env` |
| เครื่องนักเรียนเปิด URL ไม่ได้ | ตั้ง `SERVER_HOST=0.0.0.0`, อยู่วง LAN เดียวกัน, อนุญาต Node.js ใน Firewall (Private) |
| 3D ช้า/กระตุก | กดปุ่ม **Low** บนแถบเครื่องมือ 3D (ระบบจำค่าไว้) หรือใช้มุมมอง **2D** |
| ขึ้นว่าเปิด 3D ไม่ได้ (WebGL) | อัปเดต Browser/ไดรเวอร์การ์ดจอ ระหว่างนี้ใช้มุมมอง 2D ได้ตามปกติ |
| `npm start` บอกว่ายังไม่ได้ build หน้าเว็บ | รัน `npm run build` ก่อน หรือใช้ `npm run serve` |

## 11. ข้อจำกัดและแผนถัดไป

**สถานะหลัง P19**
- ใช้ **Mock PLC** เท่านั้น ยังไม่ต่อ FX5U จริง
- หน้าหลักจอกว้างเปิด Sensors/Plant ซ้าย, ควบคุมขวาและกราฟขวาล่าง; Dock เปิด/ปิดแผง, Expand ขยายรายละเอียด, X/Escape ปิด Dialog; จอแคบเปิดรายละเอียดทีละแผง; คะแนนคำนวณที่ Server และไม่เพิ่มเมื่อ Pause
- Care Score เต็ม 1,000: สุขภาพเฉลี่ยตลอดรอบ 80% + การเติบโต 20% คูณสัดส่วนต้นที่รอด; Best บันทึกเมื่อจบรอบที่เล่นอย่างน้อย 24 h จำลอง แยก Lab/Scenario และล้างเมื่อปิด Server ควรเทียบรอบระยะเวลาเท่ากัน
- Damage 100% = ตายถาวร หยุดโต/ดูดน้ำ; ตายครบทุกต้น = Game Over พร้อมดู Timeline และกด **ปลูกใหม่** (Reset + Resume); คะแนนรอบที่แพ้คงที่ 0 แต่ยังเปิดดู Simulation/PLC ได้
- Light/Nutrient/Root Stress รวมใน Growth, Damage และ Health แล้ว; Air Pump/Water Temperature/Water Level ส่งผลต่อ Estimated Oxygen และ Root Health ซึ่งจำกัดการดูดน้ำ
- Dashboard/Timeline/Curl ทำงานแล้ว; P16 ปรับภาพโรงเรือนสไตล์เกมตามภาพอ้างอิงแล้ว พร้อมให้ตรวจรูปลักษณ์; เป็น Procedural stylized model ไม่ใช่ภาพ Photorealistic
- pH ใช้ Empirical equilibrium (ค่าเริ่มต้น 6.2, time constant 2 วัน) พร้อมผล Refill/Dosing; ไม่ใช่เคมีกรด–ด่าง และไม่ได้ทำนายว่า pH ของจริงจะฟื้นเองโดยไม่ปรับสารละลาย
- ยังไม่มี Login, Teacher Dashboard และการบันทึกลงฐานข้อมูล (ข้อมูลอยู่ในหน่วยความจำ Reset เมื่อปิด Server)

**แผนถัดไป** (ดู [docs/PHASES.md](docs/PHASES.md))

| Milestone | เนื้อหา |
|---|---|
| M2 | P8–P15 และส่วนต่อ P16–P19 เสร็จ รอผู้ใช้ตรวจ Layout/อุปกรณ์/คะแนน/Game Over ก่อน tag `m2` |
| M3 | เชื่อม FX5U จริง 1 เครื่องผ่าน SLMP 3E, Communication monitor |
| M4 | 10 Lab, 10 PLC, Teacher Dashboard, Login, SQLite |
| M5 | Scenario 10 บท, Data logging, Performance evaluation, Real sensor architecture |
