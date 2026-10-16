import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = await buildApp(config, { logger: true });

try {
  await app.listen({ host: config.host, port: config.port });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// แสดง URL ที่นักเรียนใช้เปิดผ่าน LAN
const hasWeb = config.webDist !== undefined && existsSync(config.webDist);
const urls =
  config.host === '0.0.0.0'
    ? Object.values(networkInterfaces())
        .flat()
        .filter((n) => n && n.family === 'IPv4' && !n.internal)
        .map((n) => `http://${n!.address}:${config.port}`)
    : [`http://${config.host}:${config.port}`];
console.log('');
console.log('  Green Oak Virtual Plant Lab');
console.log(hasWeb ? '  เปิดหน้าเว็บที่:' : '  API พร้อมใช้งาน (ยังไม่ได้ build หน้าเว็บ — รัน npm run build ก่อน หรือใช้ npm run dev):');
for (const u of urls) console.log(`    ${u}`);
console.log(`  Labs: ${app.labs.labIds.join(', ')} · Mock PLC: ${config.mockMode}`);
console.log('');

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
