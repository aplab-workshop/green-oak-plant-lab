import { runAdmin } from './cli';

/** `npm run admin -- …` (W3 / SPEC § 4.40) — อ่าน ADMIN_KEY / GOL_API_URL จาก Environment หรือ .env (ค่าใน Environment ชนะ) */
try {
  process.loadEnvFile('.env');
} catch {
  // ไม่มี .env — ใช้ค่าจาก Environment อย่างเดียว
}
const url = process.env.GOL_API_URL || `http://127.0.0.1:${process.env.SERVER_PORT || 3001}`;
process.exitCode = await runAdmin(process.argv.slice(2), { url, key: process.env.ADMIN_KEY || undefined });
