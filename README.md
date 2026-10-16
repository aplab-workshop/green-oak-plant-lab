# Green Oak Virtual Plant Lab

ห้องปฏิบัติการเสมือนสำหรับฝึกเขียน PLC **Mitsubishi FX5U** เพื่อควบคุมระบบปลูกผักสลัด Green Oak แบบ Hydroponics **Deep Water Culture (DWC)** ด้วย Simulation และโมเดล 3D แบบ Interactive

> **สถานะ:** Milestone 1 เสร็จ — Functional 3D Virtual Plant (ทำงานได้โดยไม่ต้องมี PLC จริง ใช้ Mock PLC)
>
> **Educational Simulation:** แบบจำลองพืชใช้สมการที่อธิบายได้เพื่อการเรียนการสอน **ไม่ใช่**โมเดลทำนายชีววิทยาที่ผ่านการตรวจสอบความแม่นยำ

---

## สารบัญ

1. [ความสามารถใน Milestone 1](#1-ความสามารถใน-milestone-1)
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

## 1. ความสามารถใน Milestone 1

| ส่วน | รายละเอียด |
|---|---|
| **Simulation (Server)** | Fixed time-step, Speed 1x / 60x / 360x, Pause/Resume/Reset, Water mass balance, Refill, LED → PPFD/DLI, Air temp/RH/VPD, Water temp, EC (Salt mass balance), pH (Empirical), Power |
| **Plant model** | ผัก 6 ต้นแยกสถานะ: Hydration, Water stress, Damage ถาวร, Recovery, Growth, Leaf count/area, Root length, Health score |
| **Mock PLC** | จำลอง Device memory ของ FX5U: `auto` (Ladder ตัวอย่าง), `manual` (กดสั่งเอง), `offline` (จำลองสายหลุด) และ Fail-safe เมื่อไม่ได้รับคำสั่ง |
| **Student Dashboard** | Sensor → PLC (D100–D110), Actuator ← PLC (M100–M105, D200), Plant detail, Trends, Event log, Scenario |
| **3D DWC Scene** | ผัก Green Oak แบบ Procedural ที่ใบตก/เหี่ยว/ฟื้นตาม Simulation, ราก, น้ำขึ้นลงจริง, LED, Fan, Humidifier, Pumps, ฟองอากาศ, Sensor probes ที่คลิกดูข้อมูลได้ |
| **Scenario** | `Water Shortage Simulation` (ระดับน้ำ 65% + รั่ว 1.5 L/h) |

เอกสารออกแบบอยู่ใน `docs/` (เปิดด้วย Obsidian ได้)

| ไฟล์ | เนื้อหา |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | ปัญหา ขอบเขต ข้อกำหนด Acceptance Criteria |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | โครงสร้าง Software, Data Flow, สมการ Simulation |
| [docs/DEVICE-MAP.md](docs/DEVICE-MAP.md) | PLC Memory Mapping, Scaling, Fail-safe, ตัวอย่าง Ladder |
| [docs/PHASES.md](docs/PHASES.md) | Roadmap แบ่ง Phase พร้อม Checklist |

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
| `MOCK_PLC_MODE` | `auto` | โหมดเริ่มต้นของ Mock PLC: `auto` / `manual` / `offline` |
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
| กลาง | **Plant View** (3D หรือ 2D), เวลาจำลอง, Speed, Pause, Reset, **Trends** และ **Event Log** |
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

## 8. ทดสอบ

```bash
npm test
```

```bash
npm run typecheck
```

| กลุ่ม | ตัวอย่างที่ทดสอบ |
|---|---|
| `packages/sim-core` | น้ำลดตามเวลา, Refill ทำให้น้ำเพิ่ม, Water stress เพิ่มเมื่อรากขาดน้ำ, ลดลงเมื่อเติมทัน, Damage ไม่ลดลง, LED มีผลต่อ PPFD/DLI, ผลไม่ขึ้นกับการแบ่ง Tick |
| `apps/server` | Lab 01 ไม่กระทบ Lab 02, Sim → Mock PLC → Sim รักษาระดับน้ำ 3 วัน, PLC Offline → Fail-safe และระบบยังทำงาน, Gateway เขียน M Device ไม่ได้, REST/WebSocket, โหมด LAN |
| `apps/web` | การแปลง PlantState → ภาพ (ใบตก/สี/ขนาด), Geometry ใบหยัก, การจัดใบ, ช่วงค่า Sensor |

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

**สถานะระหว่างพัฒนา M2 (ดู Phase ที่เสร็จล่าสุดใน PHASES)**
- ใช้ **Mock PLC** เท่านั้น ยังไม่ต่อ FX5U จริง
- P9–P11: Light และ Nutrient Stress สะสมตามเวลาจำลองและลด Growth แล้ว; Air Pump/Water Temperature/Water Level ส่งผลต่อ Estimated Oxygen Status และ Root Health ซึ่งจำกัดการดูดน้ำ
- Damage/Health ยังใช้ Water Stress ตาม M1; การรวม Stress ทั้งหมดเป็นงาน P12 ส่วน Oxygen ใน Dashboard, Timeline และ Curl เพิ่มใน P13/P14 ภาพ 3D ยังไม่ใช่รูปลักษณ์ Final
- pH ใช้ Empirical equilibrium (ค่าเริ่มต้น 6.2, time constant 2 วัน) พร้อมผล Refill/Dosing; ไม่ใช่เคมีกรด–ด่าง และไม่ได้ทำนายว่า pH ของจริงจะฟื้นเองโดยไม่ปรับสารละลาย
- ยังไม่มี Login, Teacher Dashboard และการบันทึกลงฐานข้อมูล (ข้อมูลอยู่ในหน่วยความจำ Reset เมื่อปิด Server)

**แผนถัดไป** (ดู [docs/PHASES.md](docs/PHASES.md))

| Milestone | เนื้อหา |
|---|---|
| M2 | Plant Behavior Engine เต็ม: Light/Nutrient/Root stress, Recovery model, Timeline |
| M3 | เชื่อม FX5U จริง 1 เครื่องผ่าน SLMP 3E, Communication monitor |
| M4 | 10 Lab, 10 PLC, Teacher Dashboard, Login, SQLite |
| M5 | Scenario 10 บท, Data logging, Performance evaluation, Real sensor architecture |
