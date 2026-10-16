# Green Oak Virtual Plant Lab

ห้องปฏิบัติการเสมือนสำหรับฝึกเขียน PLC **Mitsubishi FX5U** เพื่อควบคุมระบบปลูกผักสลัด Green Oak แบบ Hydroponics **Deep Water Culture (DWC)** ด้วย Simulation และโมเดล 3D แบบ Interactive

> **สถานะ:** P6 — 3D DWC Scene เสร็จ (ผัก Green Oak แบบ Procedural ที่เหี่ยว/ฟื้นตาม Simulation, ถัง, ราก, Actuator และ Sensor ที่คลิกดูข้อมูลได้)

## เอกสาร

| ไฟล์ | เนื้อหา |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | ปัญหา ขอบเขต ข้อกำหนด Acceptance Criteria |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | โครงสร้าง Software, Data Flow, Simulation Model |
| [docs/DEVICE-MAP.md](docs/DEVICE-MAP.md) | PLC Memory Mapping และ Scaling |
| [docs/PHASES.md](docs/PHASES.md) | Roadmap แบ่ง Phase พร้อม Checklist |

วิธีติดตั้งและใช้งานจะเพิ่มใน Phase P7

## รันระหว่างพัฒนา (ชั่วคราว)

```bash
npm install
npm run dev      # Server :3001 + Web :5173 → เปิด http://localhost:5173
npm test         # Unit / Integration tests
npm run typecheck
```
