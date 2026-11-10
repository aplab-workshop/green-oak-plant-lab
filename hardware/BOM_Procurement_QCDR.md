# Green Oak Control Board PCB v1.1 – รายการจัดหาอุปกรณ์ (Q, C, D, R)

> **สำหรับ Codex:** ไฟล์นี้เป็นโจทย์จัดหาอุปกรณ์ ให้ค้นจากแหล่งขายอิเล็กทรอนิกส์ (ผู้ใช้ใช้ **ES = es.co.th** เป็นหลัก) แล้วกรอกผลลงตาราง "ผลการจัดหา" (หัวข้อ 4)
> PCB ออกแบบเสร็จแล้ว **footprint เปลี่ยนไม่ได้** ต้องหาอุปกรณ์ที่ลงแพดตามขนาดที่ระบุเท่านั้น
> ถ้าหาไม่ได้หรือต้องใช้ตัวแทน ให้บันทึกในหัวข้อ 5 แล้วส่งกลับมาให้ผู้ออกแบบตรวจ
> **ห้ามใส่รหัสสินค้าหรือราคาจากความจำ** — ทุกช่องในหัวข้อ 4 ต้องมาจากหน้าร้านจริง พร้อมลิงก์ และเปิด Datasheet ยืนยันสเปกในหัวข้อ 1

- โปรเจกต์: Green Oak Control Board Rev A v1.1 (ESP32-S3 + W5500, ขับปั๊ม/ไฟ 12V)
- อ้างอิง BOM เต็ม: `hardware/kicad/output/GreenOak_BOM.csv`, Schematic `hardware/kicad/output/GreenOak_schematic.pdf`
- จำนวนบอร์ดที่จะประกอบ: **N = 1**
- อุปกรณ์ที่ **มีแล้ว ไม่ต้องหา:** J1–J17 (Terminal 5.08 / XH), U1 (CR-DC2580), U2 (ESP32-S3-DevKitC-1 N16R8), F1–F3 (ฐานฟิวส์ BLX-A + หลอด 10 A / 5 A, PTC 0.5 A)
- ไม่ต้องหา (ไม่ใช่ชิ้นส่วน): JP1 (Solder jumper บนลาย), TP1–TP4 (แพดทดสอบ)

---

## 1. รายการที่ต้องจัดหา

| # | Ref | ชนิด | ค่า / Part | แพ็กเกจ (ห้ามเปลี่ยน) | สเปกขั้นต่ำ | จำนวน/บอร์ด | แนะนำสั่ง (N=1) |
|---|---|---|---|---|---|---|---|
| 1 | Q1–Q5 | N-MOSFET Logic-level | **AOD4184A** (Alpha & Omega) | **TO-252 (DPAK)** SMD — ขา 1 = G, แท็บ/ขา 2 = D, ขา 3 = S | Vds ≥ 30 V · Id ≥ 20 A · **Rds(on) ≤ 15 mΩ ที่ Vgs = 4.5 V** (หรือต่ำกว่า) · **Vgs(th) max ≤ 2.5 V** | 5 | 7 |
| 2 | D1–D5 | Schottky diode | **SS34** | **SMA (DO-214AC)** — แถบบนตัว = Cathode | Vrrm ≥ 40 V · If(av) ≥ 3 A · Vf ≤ 0.55 V ที่ 3 A | 5 | 10 |
| 3 | C1 | Electrolytic (Aluminium) | **470 µF / 25 V** | Radial THT **Ø10 mm, ระยะขา 5.0 mm** | ≥ 25 V · 105 °C · Low-ESR ถ้ามี · **สูงไม่เกิน 20 mm** | 1 | 2 |
| 4 | C2 | Electrolytic (Aluminium) | **100 µF / 16 V** | Radial THT **Ø6.3 mm, ระยะขา 2.5 mm** | ≥ 16 V (25 V ได้ถ้ายัง Ø6.3) · 105 °C · สูงไม่เกิน 12 mm | 1 | 2 |
| 5 | C3 | MLCC | **100 nF** | **0805 (2012 metric)** | X7R · ≥ 25 V · ±10 % | 1 | 10 |
| 6 | C4 | MLCC | **1 nF** | **0805** | C0G/NP0 หรือ X7R · ≥ 25 V | 1 | 10 |
| 7 | R1, R3, R5, R7, R9 | ตัวต้านทาน (Gate) | **100 Ω** | **0805** | ±1 % · ≥ 1/8 W | 5 | 10 |
| 8 | R2, R4, R6, R8, R10–R15, R19 | ตัวต้านทาน (Pull-down/Pull-up) | **10 kΩ** | **0805** | ±1 % · ≥ 1/8 W | 11 | 20 |
| 9 | R16 | ตัวต้านทาน (Divider PZEM) | **2.2 kΩ** | **0805** | ±1 % · ≥ 1/8 W | 1 | 10 |
| 10 | R17 | ตัวต้านทาน (Divider PZEM) | **3.3 kΩ** | **0805** | ±1 % · ≥ 1/8 W | 1 | 10 |
| 11 | R18 | ตัวต้านทาน (อนุกรม Flow) | **1 kΩ** | **0805** | ±1 % · ≥ 1/8 W | 1 | 10 |
| 12 | R20, R21 | ตัวต้านทาน I²C Pull-up — **DNP (ไม่ประกอบ)** | **4.7 kΩ** | **0805** | ±1 % · ≥ 1/8 W | 0 (สำรอง 2) | 10 (ไม่บังคับ) |

> จำนวนแนะนำสั่ง เผื่อของเสีย และคิดตามขั้นต่ำร้าน (SMD R/C ขั้นต่ำ 10–100) — ถ้าร้านขาย R/C เป็นแพ็ก 100 ให้เลือกแพ็กที่เล็กที่สุด
> หน้าที่ของแต่ละชิ้น: Q ขับ Grow Light 4.2 A (Q1) และปั๊ม 12 V (Q2–Q5) ด้วย GPIO 3.3 V โดยตรง · D2–D5 กันไฟย้อนจากมอเตอร์ปั๊ม · D1 กันไฟ USB ย้อนเข้าราง 5 V · C1 กรองราง 12 V · C2/C3 กรองราง 5 V · C4 กรองสัญญาณ Flow

## 2. ข้อห้ามและจุดที่ต้องเช็ค
1. **ขนาดแพ็กเกจต้องตรงเป๊ะ** — R/C เป็น **0805** เท่านั้น (0603 / 1206 ใช้ไม่ได้)
2. **Q (สำคัญที่สุด):**
   - ต้องเป็น **TO-252 / DPAK** ห้าม TO-220 (ขาเสียบ), ห้าม TO-251 (IPAK ขายาว), ห้าม DFN/SO-8
   - ต้องเป็น **Logic-level**: Datasheet ต้องระบุ **Rds(on) ที่ Vgs = 4.5 V (หรือ 2.5 V)** — ถ้าระบุเฉพาะที่ 10 V ถือว่า **ใช้ไม่ได้** (เช่น IRF520, IRFZ44N, IRFR024)
   - Pinout ที่บอร์ดใช้: ขา 1 = Gate, แท็บ = Drain, ขา 3 = Source — เปิด Datasheet ยืนยัน (DPAK ทั่วไปเป็นแบบนี้ แต่บางรุ่นสลับ)
3. **D:** ต้องเป็น **SMA (DO-214AC)** ห้าม SMB (DO-214AA, ใหญ่กว่า), ห้าม SMAF/SOD-123FL (แบนกว่า แพดไม่ตรง)
4. **C1/C2 (THT):** เส้นผ่านศูนย์กลาง + ระยะขาต้องตรง (Ø10 / 5.0 mm และ Ø6.3 / 2.5 mm); C1 ห้ามสูงเกิน 20 mm (ใกล้ฐานฟิวส์ BLX-A สูง 13 mm ในกล่อง)
5. ไม่มี LED บนบอร์ดนี้ (สถานะใช้ Lamp ผ่าน Relay)
6. **F3 (ผู้ใช้มีแล้ว) — ฝากเช็ค:** PTC 1812 ต้องทน **Vmax ≥ 15 V** (บางรุ่นทนแค่ 6 V ใช้กับ 12 V ไม่ได้), Hold 0.5 A / Trip ~1 A — ถ้าของที่มีไม่ผ่าน ให้หาเพิ่มและบันทึกในหัวข้อ 4

## 3. ตัวแทนที่ยอมรับได้
| Ref | ตัวหลัก | ตัวแทนที่ใช้ได้เลย | เงื่อนไข |
|---|---|---|---|
| Q1–Q5 | AOD4184A | AOD4184 (ไม่มี A), IRLR7843 | TO-252, Rds(on) ≤ 15 mΩ ที่ Vgs 4.5 V, Vgs(th) max ≤ 2.5 V, Vds ≥ 30 V, ขา G-D(แท็บ)-S — ตัวอื่นที่ผ่านเงื่อนไขนี้ครบให้ใส่ ⚠️ รอผู้ออกแบบตรวจ |
| D1–D5 | SS34 | SS36, SK34A, B340A | SMA (DO-214AC), ≥ 40 V, ≥ 3 A Schottky |
| C1 | 470 µF/25 V | 470 µF/35 V, 680 µF/25 V | ยัง Ø10 mm ระยะขา 5.0 mm และสูง ≤ 20 mm |
| C2 | 100 µF/16 V | 100 µF/25 V | ยัง Ø6.3 mm ระยะขา 2.5 mm |
| C3, C4 | X7R 25 V | X7R 50 V, X5R ≥ 25 V (C3 เท่านั้น) | 0805 |
| R ทั้งหมด | ±1 % 0805 | ±5 % 0805 | ยอมรับได้ทุกค่า (ไม่มีวงจรที่ต้องแม่นยำ) |

## 4. ผลการจัดหา (Codex กรอก)

ตรวจหน้าสินค้า Electronics Source (ES) เมื่อ 10 พ.ย. 2569 ราคาต่อชิ้นอิงช่วงของจำนวนที่เสนอซื้อและยังไม่รวม VAT 7% สต็อกเป็นยอดรวมที่ร้านแสดงขณะตรวจ

| # | Ref | MPN ที่เลือก | ผู้ผลิต | ร้าน / แหล่ง | รหัสสินค้าในร้าน | ลิงก์ | ราคา/ชิ้น | ขั้นต่ำ | จำนวนสั่ง | สต็อก | สถานะ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Q1–Q5 | RD3G500GNTL | ROHM | ES | 0176-0653-6 | [สินค้า](https://www.es.co.th/detail.asp?prod=017606536) · [Datasheet](https://www.es.co.th/Schemetic/PDF/RD3G500GN.PDF) | ฿16.56 | 1 | 7 หลังอนุมัติ | 766 | ⚠️ ตัวแทนรอตรวจที่ GPIO 3.3 V |
| 2 | D1–D5 | SK34SMA-3G | Diotec | ES | 1998-0113-5 | [สินค้า](https://www.es.co.th/detail.asp?Prod=199801135) · [Datasheet](https://diotec.com/files/diotec/productfiles/datasheet/sk34sma-3g.pdf) | ฿2.11 | 10 | 10 หลังอนุมัติ | 4,717 | ⚠️ ตัวแทน SMA ตรงสเปก รอผู้ออกแบบตรวจ |
| 3 | C1 | EGK477M1EG16RRSMP | Samxon | ES | 0566-0313-9 | [สินค้า](https://www.es.co.th/detail.asp?Prod=056603139) · [Datasheet](https://www.manyue.com/catalog/MY_SAMXON%20E-Cap%20Catalog.pdf) | ฿2.56 | 5 | 5 | 16,223 | ✅ 470 µF/25 V, Ø10 × 16 mm, ขา 5.0 mm, 105 °C, low impedance |
| 4 | C2 | RE1CM101E110T | AiSHi | ES | 0825-0097-0 | [สินค้า](https://www.es.co.th/detail.asp?Prod=082500970) · [Datasheet](https://www.aishi.com/files/3_AiSHi_Full_Catalog.pdf) | ฿0.97 | 10 | 10 | 50,771 | ✅ 100 µF/16 V, Ø6.3 × 11 mm, ขา 2.5 mm, 105 °C |
| 5 | C3 | 08055C104K4T2A | KYOCERA AVX | ES | 1721-0040-7 | [สินค้า](https://www.es.co.th/detail.asp?Prod=172100407) · [Datasheet](https://datasheets.kyocera-avx.com/AutoMLCC.pdf) | ฿0.65 | 10 (ทีละ 10) | 10 | 40,890 | ✅ 100 nF/50 V, X7R, ±10%, 0805 |
| 6 | C4 | 0805N102J500CT | Walsin | ES | 0328-0182-8 | [สินค้า](https://www.es.co.th/detail.asp?Prod=032801828) · [Datasheet](https://www.ocean-components.kr/datasheet/38-0805N102J500CT.pdf) | ฿0.33 | 10 (ทีละ 10) | 10 | 31,858 | ✅ 1 nF/50 V, C0G/NP0, ±5%, 0805 |
| 7 | 100 Ω ×5 | 0805W8F1000T5E | Royalohm | ES | 0150-1757-1 | [สินค้า](https://www.es.co.th/detail.asp?Prod=015017571) · [Datasheet](https://www.es.co.th/Schemetic/PDF/THICKFILMCHIP-R.PDF) | ฿0.12 | 100 | 100 | 55,398 | ✅ 0805, ±1%, 1/8 W |
| 8 | 10 kΩ ×11 | 0805W8F1002T5E | Royalohm | ES | 0150-1831-0 | [สินค้า](https://www.es.co.th/detail.asp?Prod=015018310) · [Datasheet](https://www.es.co.th/Schemetic/PDF/THICKFILMCHIP-R.PDF) | ฿0.12 | 100 | 100 | 1,276 | ✅ 0805, ±1%, 1/8 W |
| 9 | 2.2 kΩ | 0805W8F2201T5E | Royalohm | ES | 0150-1875-8 | [สินค้า](https://www.es.co.th/detail.asp?Prod=015018758) · [Datasheet](https://www.es.co.th/Schemetic/PDF/THICKFILMCHIP-R.PDF) | ฿0.12 | 100 | 100 | 43,216 | ✅ 0805, ±1%, 1/8 W |
| 10 | 3.3 kΩ | 0805W8F3301T5E | Royalohm | ES | 0150-1836-5 | [สินค้า](https://www.es.co.th/detail.asp?Prod=015018365) · [Datasheet](https://www.es.co.th/Schemetic/PDF/THICKFILMCHIP-R.PDF) | ฿0.12 | 100 | 100 | 29,363 | ✅ 0805, ±1%, 1/8 W |
| 11 | 1 kΩ | 0805W8F1001T5E | Royalohm | ES | 0150-1758-4 | [สินค้า](https://www.es.co.th/detail.asp?Prod=015017584) · [Datasheet](https://www.es.co.th/Schemetic/PDF/THICKFILMCHIP-R.PDF) | ฿0.12 | 100 | 100 | 64,635 | ✅ 0805, ±1%, 1/8 W |
| 12 | 4.7 kΩ (DNP, ไม่บังคับ) | 0805W8F4701T5E | Royalohm | ES | 0150-1882-3 | [สินค้า](https://www.es.co.th/detail.asp?Prod=015018823) · [Datasheet](https://www.es.co.th/Schemetic/PDF/THICKFILMCHIP-R.PDF) | ฿0.12 | 100 | 0 (ซื้อสำรองได้ 100) | 82,928 | ✅ 0805, ±1%, 1/8 W · DNP |
| 13 | F3 (ซื้อเมื่อของเดิมไม่ผ่าน) | 0ZCG0050AF2C | Bel Fuse | ES | 0781-0015-1 | [สินค้า](https://www.es.co.th/detail.asp?Prod=078100151) · [Datasheet](https://www.es.co.th/Schemetic/PDF/0ZCG.PDF) | ฿5.63 | 1 | 0 (ซื้อ 1 ถ้าต้องเปลี่ยน) | 1,309 | ✅ ตัวเลือก 1812, 30 V, hold 0.5 A, trip 1 A |

**สถานะ** ✅ ตรงสเปก · ⚠️ รอผู้ออกแบบตรวจ

| ประมาณการสำหรับ 1 บอร์ด | ก่อน VAT | รวม VAT 7% |
|---|---:|---:|
| C1–C4 และตัวต้านทานที่ประกอบ | ฿92.30 | ฿98.76 |
| รวม D1–D5 หากอนุมัติ SK34SMA-3G | ฿113.40 | ฿121.34 |
| รวม D1–D5 และ Q1–Q5 หากอนุมัติทั้งสองตัวแทน | ฿229.32 | ฿245.37 |

ยอดข้างต้นยังไม่รวมค่าส่ง, 4.7 kΩ สำหรับสำรอง (฿12.00 ก่อน VAT) และ F3 เผื่อเปลี่ยน (฿5.63 ก่อน VAT)

## 5. ส่งกลับให้ผู้ออกแบบแก้

| Ref | ปัญหาที่พบ | ตัวที่หาได้ใกล้เคียงสุด (MPN + แพ็กเกจ) | ข้อเสนอ |
|---|---|---|---|
| Q1–Q5 | **AOD4184A** (ES 1554-0008-4) เป็น TO-252 ตามแบบและมี Rds(on) สูงสุด 9.5 mΩ ที่ Vgs 4.5 V แต่ Vgs(th) สูงสุด **2.6 V** เกินเกณฑ์ 2.5 V อีกทั้ง ES เหลือ **3 ชิ้น** ที่ ฿13.54/ชิ้น (ขั้นต่ำ 1) | **RD3G500GNTL**, TO-252/DPAK, ขา 1 G, 2/แท็บ D, 3 S, Vds 40 V, Id 50 A ตามเงื่อนไข Datasheet, Vgs(th) สูงสุด 2.5 V, Rds(on) สูงสุด 6.3 mΩ ที่ Vgs 4.5 V | Datasheet ของ ROHM รับประกัน Rds(on) ที่ 4.5 V และ 10 V ให้ผู้ออกแบบตรวจแรงดันตกคร่อมและอุณหภูมิเมื่อขับตรงด้วย GPIO 3.3 V ที่โหลดจริง โดยเฉพาะ Q1 ที่ 4.2 A ก่อนอนุมัติ [สินค้า AOD4184A](https://www.es.co.th/detail.asp?Prod=155400084) · [Datasheet AOD4184A](https://www.es.co.th/Schemetic/PDF/AOD4184A.PDF) · [ผังขา ROHM](https://datasheet4u.com/pdf-down/R/D/3/RD3G500GN-ROHM.pdf) |
| D1–D5 | SS34B ที่ ES แสดงเป็น DO-214AA (SMB) และ SS34 ของ LGE ในแคตตาล็อก ES เป็น DO-214AB (SMC) | **SK34SMA-3G**, SMA/DO-214AC, VRRM 40 V, IFAV 3 A, Vf < 0.50 V ที่ 3 A, แถบระบุด้าน cathode | ใช้แพด SMA เดิมได้ ส่งยืนยัน MPN ตัวแทนก่อนสั่ง [สินค้า SS34B](https://www.es.co.th/detail.asp?Prod=020400218) · [แคตตาล็อก ES](https://www.es.co.th/Catalog/catalogALL.pdf) · [Datasheet Diotec](https://diotec.com/files/diotec/productfiles/datasheet/sk34sma-3g.pdf) |
| F3 | BOM เต็มระบุเพียง 0.5 A PTC 1812 จึงยังยืนยัน Vmax ของชิ้นที่มีไม่ได้ | **0ZCG0050AF2C**, 1812, Vmax 30 V, hold 0.5 A, trip 1 A | เทียบ MPN ของชิ้นที่มีกับ Datasheet ให้ Vmax ≥ 15 V ถ้าไม่ผ่านให้ใช้ตัวเลือกในหัวข้อ 4 [Datasheet Bel Fuse](https://www.es.co.th/Schemetic/PDF/0ZCG.PDF) |

> ถ้าต้องเปลี่ยนแพ็กเกจ ผู้ออกแบบจะแก้ footprint → เดินลายใหม่ → Gerber v1.2

## ผลตรวจของผู้ออกแบบ (2026-11-10)

เปิด Datasheet ของทุกตัวที่ Codex เลือกแล้ว (PDF จากลิงก์ในหัวข้อ 4 + Datasheet ฉบับเต็มของ ROHM `fscdn.rohm.com/.../rd3g500gntl-e.pdf` ที่มีกราฟ) และคำนวณยอดเงินซ้ำ — **อนุมัติสั่งได้ทุกรายการ**

| Ref | ที่เลือก | ผล | หลักฐาน / เหตุผล |
|---|---|---|---|
| Q1–Q5 | **RD3G500GNTL** (ROHM) | ✅ **อนุมัติ — ดีกว่า AOD4184A** | TO-252, ขา (1) Gate · (2)/แท็บ Drain · (3) Source ตรง Footprint; 40 V / 50 A; Vgs(th) 1.0–2.5 V (ทั่วไป ~1.75 V ที่ 25 °C, Fig.9); Rds(on) ≤ 6.3 mΩ ที่ 4.5 V; **Fig.5: ที่ Vgs 2.8 V ยังนำ ~20 A** → ที่ GPIO 3.3 V กับ Grow Light 4.2 A ตกคร่อมไม่ถึง 0.05 V (ทั่วไป) ความร้อน Q1 ≈ 0.1–0.5 W แม้ตัวที่ Vth สูงสุด — DPAK บนทองแดงรับได้ |
| (เทียบ) | AOD4184A | ❌ ไม่แนะนำที่ 3.3 V | Vgs(th) 1.7 / 2.1 / **2.6 V** (min/typ/max); Fig.2 ทั่วไปที่ Vgs 3.0 V ได้แค่ ~5 A และตัวที่ Vth สูงจะได้น้อยกว่า 4.2 A ของ Grow Light — คำแนะนำเดิมใน HARDWARE.md ที่ว่า "AOD4184 เปิดเต็มที่ 3.3 V" มองโลกดีเกินไป |
| D1–D5 | **SK34SMA-3G** (Diotec) | ✅ | SMA ~ DO-214AC, 40 V, 3 A, Vf < 0.50 V ที่ 3 A — ลงแพด D_SMA เดิม (แถบ = Cathode = ขา 1 ของ Footprint) |
| C1 | **EGK477M1EG16RRSMP** (Samxon) | ✅ | 470 µF / 25 V (`477`, `1E`), Ø10 × 16 mm (`G16`) ระยะขา 5.0 mm, 105 °C — สูง 16 mm ≤ 20 mm (ลิงก์แคตตาล็อก Samxon โหลดไม่ได้ ตรวจจากรหัสสินค้า + หน้าร้าน ES) |
| C2 | **RE1CM101E110T** (AiSHi) | ✅ | 100 µF / 16 V (`1C`, `101`), Ø6.3 × 11 mm (`E11`) ระยะขา 2.5 mm |
| C3 | **08055C104K4T2A** (KYOCERA AVX) | ✅ | 0805, 50 V (`5`), X7R (`C`), 100 nF ±10 % |
| C4 | **0805N102J500CT** (Walsin) | ✅ | 0805, NP0 (`N`), 1 nF ±5 %, 50 V (`500`) — ลิงก์ Datasheet เปิดไม่ได้ ตรวจจากรหัสสินค้า |
| R ทั้งหมด | **0805W8F____T5E** (Royalohm) | ✅ | 0805, `W8` = 1/8 W, `F` = ±1 %, ค่า 1000 = 100 Ω · 1002 = 10 k · 2201 = 2.2 k · 3301 = 3.3 k · 1001 = 1 k · 4701 = 4.7 k (ตาม Datasheet Royalohm) |
| F3 (สำรอง) | **0ZCG0050AF2C** (Bel Fuse) | ✅ ใช้ได้ถ้าของเดิมไม่ผ่าน | 1812, Ihold 0.50 A, Itrip 1.00 A, **Vmax 30 V** (อีกรุ่น 0ZCG0050**F**F2C ทนแค่ 16 V — อย่าสลับ) |

**ยอดเงิน (คำนวณซ้ำ ตรงกับ Codex):** C ฿32.30 + R 5 รีล × 100 × ฿0.12 = ฿60.00 → ฿92.30 · + D 10 × ฿2.11 = ฿21.10 → ฿113.40 · + Q 7 × ฿16.56 = ฿115.92 → **฿229.32 ก่อน VAT / ฿245.37 รวม VAT** (ไม่รวมค่าส่ง, 4.7 k สำรอง ฿12, F3 สำรอง ฿5.63)

**ของประกอบโมดูล (จากหัวข้อ 6):** ✅ ผู้ใช้ยืนยันมีแล้ว (2026-11-10) — Female header 1×22 pitch 2.54 สูงมาตรฐาน 8.5 mm × 2 แถบ (ESP32) และ Pin header 4 ขา (CR-DC2580) → **ไม่ต้องซื้อเพิ่ม รายการจัดหาครบ**

อัปเดตแล้ว: Value/MPN/Manufacturer/Supplier_PN ลง Schematic + BOM + ค่าบน PCB (ไม่เดินลายใหม่)

## 6. รายการประกอบโมดูลที่ต้องเช็กเพิ่ม

เทียบกับ [BOM เต็ม](kicad/output/GreenOak_BOM.csv) แล้ว Q/C/D/R ที่ต้องประกอบครอบคลุม 11 กลุ่ม รวม 33 ชิ้นต่อบอร์ด ตัวต้านทาน R20/R21 เป็น DNP

| Ref | อุปกรณ์ประกอบสำหรับ 1 บอร์ด | สถานะ |
|---|---|---|
| U2 | Female socket header แบบตรง THT แถวเดี่ยว **1×22, pitch 2.54 mm จำนวน 2 แถบ** วางสองแถวห่างกัน 25.4 mm | ซ็อกเก็ตรวมอยู่ใน [footprint U2](kicad/GreenOak.pretty/ESP32-S3-DevKitC-1_Socket.kicad_mod) จึงต้องเช็กแยกจากตัว DevKit ยังยืนยัน SKU 1×22 ที่ ES ไม่ได้ เบอร์ตรงสเปกที่พบคือ Samtec SSW-122-01-T-S [สเปกผู้ผลิต](https://www.samtec.com/products/ssw-122-01-t-s) · [สินค้า DigiKey](https://www.digikey.com/en/products/detail/samtec-inc/SSW-122-01-T-S/1112283) |
| U1 | ขา pin header สำหรับยึด CR-DC2580 V5 ครบ **4 ตำแหน่ง** | เช็กว่ามาพร้อมโมดูลตามวิธีประกอบ Rev v1.1 [Design Review](Design_Review.md) |

ยอดในหัวข้อ 4 ยังไม่รวมขาและซ็อกเก็ตของโมดูล ให้ซื้อเพิ่มตามที่ขาดจริง
