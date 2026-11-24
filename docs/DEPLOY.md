# คู่มือ Deploy ระบบบัญชีผู้เล่น (Milestone W / W7)

เกมยังรันในเบราว์เซอร์บน **GitHub Pages** เหมือนเดิม — สิ่งที่ขึ้น Cloud คือ **Server ระบบบัญชี** (สมัคร/Login, คะแนน, Log) บน **Render** และฐานข้อมูล **Postgres บน Neon** (SPEC § 4.38–4.44)

```
นักเรียน (เบราว์เซอร์) ──► GitHub Pages: ตัวเกม + Simulation
          │  สมัคร / Login / ส่งคะแนน + Log
          ▼
Render (Server ฟรี, Singapore) ──► Neon (Postgres ฟรี, Singapore)
          ▲
ครู: npm run admin -- …  (สร้างรหัสเชิญ, ดูคะแนน, โหลด CSV)
```

> ⚠️ ราคา/เงื่อนไขแพ็กเกจฟรีเปลี่ยนบ่อย — ตรวจหน้าราคาของ Render และ Neon ก่อนใช้จริง
> ข้อมูล ณ 2026-11: Render ฟรีหลับหลังไม่มีคนใช้ 15 นาที (ตื่น ~1 นาที), Neon ฟรี 1 GB ต่อโปรเจกต์

---

## 1. Neon — ฐานข้อมูล

1. สมัคร https://neon.tech (ใช้บัญชี GitHub ได้)
2. **Create project** → ชื่อ `green-oak` → Region **AWS Asia Pacific (Singapore)**
3. หน้า Dashboard → **Connect** → คัดลอก **Connection string** หน้าตาประมาณ
   `postgresql://<user>:<password>@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
4. เก็บไว้เป็นความลับ (ใช้ในข้อ 3) — **ห้ามใส่ใน repo / ห้ามส่งในแชตกลุ่ม**

ตารางจะถูกสร้างเองตอน Server เริ่มครั้งแรก (Migration อัตโนมัติ)

## 2. สร้าง Admin key ของครู

รันในเครื่องครู แล้วเก็บผลไว้ (ใช้ทั้งบน Render และในเครื่องครู):

```powershell
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

## 3. Render — Server ระบบบัญชี

1. สมัคร https://render.com ด้วยบัญชี GitHub
2. **New → Blueprint** → เลือก repo `aplab-workshop/green-oak-plant-lab` → Render อ่าน `render.yaml` ให้เอง
3. กรอกค่าที่ Render ถาม:
   - `DATABASE_URL` = Connection string จาก Neon (ข้อ 1)
   - `ADMIN_KEY` = Admin key (ข้อ 2)
   - (`AUTH_SECRET` Render สุ่มให้เอง, ค่าอื่นตั้งไว้ใน `render.yaml` แล้ว)
4. **Apply** → รอ Deploy เสร็จ → ได้ URL เช่น `https://green-oak-accounts.onrender.com`
5. ตรวจ: เปิด `<URL>/api/auth/config` ต้องเห็น `{"enabled":true}`

> ถ้า Pages ของคุณไม่ใช่ `https://aplab-workshop.github.io` ให้แก้ `CORS_ORIGINS` ใน Render → Environment

## 4. GitHub — ให้ตัวเกมบน Pages รู้จัก Server

1. Repo → **Settings → Secrets and variables → Actions → Variables → New repository variable**
   - Name: `ACCOUNTS_API_URL`
   - Value: URL ของ Render (ข้อ 3.4) **ไม่มี / ท้าย**
2. **Actions → Deploy demo to GitHub Pages → Run workflow** (หรือ push main ครั้งถัดไป)
3. เปิด https://aplab-workshop.github.io/green-oak-plant-lab/ → กด Play ต้องขึ้นหน้าต่าง "เข้าสู่ระบบ / สมัคร"

ลบตัวแปร `ACCOUNTS_API_URL` แล้ว Run workflow ใหม่ = กลับเป็น Demo เล่นได้เลยไม่ต้อง Login

## 5. เครื่องครู — คำสั่ง `npm run admin`

สร้างไฟล์ `.env` ที่โฟลเดอร์โปรเจกต์ (ไฟล์นี้ไม่ถูก commit):

```
GOL_API_URL=https://green-oak-accounts.onrender.com
ADMIN_KEY=<Admin key ข้อ 2>
```

```powershell
npm run admin -- stats
```

```powershell
npm run admin -- invite create --max 40 --note "ม.5/1"
```

คำสั่งทั้งหมด: `npm run admin` (ไม่ใส่คำสั่ง = แสดงวิธีใช้) — SPEC § 4.40–4.42

## 6. ทดสอบครบวงจร (W7b / AC-75b)

- [ ] ครูสร้างรหัสเชิญ (`invite create`)
- [ ] นักเรียนเปิด Pages → สมัครด้วยรหัสเชิญ → เข้าเกม
- [ ] เล่นด่านจนจบ → หน้าผ่านด่านขึ้น "☁️ บันทึกคะแนนแล้ว · อันดับ #…"
- [ ] หน้า Home → 🏆 ตารางอันดับ เห็นคะแนน
- [ ] ครู `score list` เห็นรอบนั้น และ `log export --invite <รหัส>` ได้ไฟล์ CSV เปิดใน Excel ภาษาไทยถูกต้อง
- [ ] Login อีกเครื่อง เห็นคะแนนเดิมบนการ์ดเลือกด่าน

## 7. ใช้งานประจำ

- **ปลุก Server ก่อนคาบ:** เปิดหน้าเกม หรือ `npm run admin -- stats` สัก 1–2 นาทีก่อนเริ่ม (Server ฟรีหลับเมื่อไม่มีคนใช้ 15 นาที — ระหว่างคาบมีคนใช้ต่อเนื่องจึงไม่หลับ)
- **ดูพื้นที่:** `npm run admin -- stats` (เทียบ 1 GB ของ Neon Free; Log ~20 KB/รอบ)
- **จบเทอม:** โหลด CSV/คะแนนเก็บไว้ก่อน แล้ว `npm run admin -- data delete --invite <รหัส> --yes`

## 8. สำรองข้อมูล

- ง่ายสุด: ทุกสัปดาห์ หรือจบแต่ละคาบ
  ```powershell
  npm run admin -- log export --out play-log-backup.csv
  ```
  ```powershell
  npm run admin -- score list > scores-backup.txt
  ```
- ฐานข้อมูลทั้งก้อน: ใช้ `pg_dump` (ต้องติดตั้ง PostgreSQL client) กับ Connection string ของ Neon
- Neon แพ็กเกจฟรีกู้คืนย้อนหลังได้ช่วงสั้น ๆ เท่านั้น — อย่าพึ่งอย่างเดียว

## 9. นโยบายข้อมูล (แจ้งนักเรียน)

- **เก็บ:** ID ที่ตั้งเอง, Password (เข้ารหัสแบบ scrypt — ไม่มีใครเห็นตัวจริง), รหัสเชิญที่ใช้สมัคร, คะแนน/ดาว/น้ำหนักต่อรอบ, Log การปรับอุปกรณ์ในเกม, เวลาที่เล่น
- **ไม่เก็บ:** ชื่อจริง อีเมล เบอร์โทร หรือข้อมูลอื่นที่ระบุตัวตน — แนะนำให้นักเรียนตั้ง ID ที่ไม่ใช่ชื่อจริง
- **ใครเห็น:** ตารางอันดับเห็น ID + คะแนน (ไม่เห็นรหัสเชิญ); ครูเห็นทุกอย่างผ่าน `npm run admin`
- **ลบ:** ครูลบบัญชีรายคน (`player delete <ID> --yes`) หรือทั้งรหัส (`data delete --invite <รหัส> --with-accounts --yes`); Log ไม่หมดอายุเอง (D9)
- ความลับ (`DATABASE_URL`, `ADMIN_KEY`, `AUTH_SECRET`) อยู่ใน Render/เครื่องครูเท่านั้น

## 10. แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| หน้าเกมขึ้น "Server กำลังตื่น…" นาน | ปกติของแพ็กเกจฟรี รอ ≤ 1 นาที; ถ้าเกิน ดู Render → Logs |
| "เชื่อมต่อระบบบัญชีไม่ได้" | URL ใน `ACCOUNTS_API_URL` ผิด / Render ล่ม / `CORS_ORIGINS` ไม่ตรงโดเมน Pages |
| `npm run admin` ขึ้น "Admin key ไม่ถูกต้อง" | `ADMIN_KEY` ใน `.env` ไม่ตรงกับ Render |
| `npm run admin` ขึ้น "Admin API ปิดอยู่" | ยังไม่ได้ตั้ง `ADMIN_KEY` บน Render หรือสั้นกว่า 16 ตัว |
| ทุกคนต้อง Login ใหม่หมด | `AUTH_SECRET` บน Render ถูกเปลี่ยน |
| Render Deploy ล้ม | ดู Logs — มักเป็น `DATABASE_URL` ผิด (ต้องมี `?sslmode=require`) |
