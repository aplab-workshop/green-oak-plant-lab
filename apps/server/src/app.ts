import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import type { ServerConfig } from './config';
import { registerRoutes } from './api/routes';
import { registerWs } from './api/ws';
import { registerAuthRoutes, type Accounts } from './api/auth';
import { registerAdminRoutes } from './api/admin';
import { registerRunRoutes } from './api/runs';
import { registerLeaderboardRoutes } from './api/leaderboard';
import { AccountStore } from './accounts/AccountStore';
import { openDatabase } from './accounts/db';
import { migrate } from './accounts/migrations';
import { LabManager } from './lab/LabManager';

export { SERVER_VERSION } from './version';

declare module 'fastify' {
  interface FastifyInstance {
    labs: LabManager;
    /** W2: null = ระบบบัญชีปิด (ไม่ได้ตั้ง DATABASE_URL) */
    accounts: Accounts | null;
  }
}

/**
 * สร้าง Fastify app (แยกจาก listen เพื่อให้ Test ใช้ inject ได้)
 * startLabs = false สำหรับ Test ที่ต้องการคุม tick/poll เอง
 */
export async function buildApp(
  config: ServerConfig,
  opts: { logger?: boolean; startLabs?: boolean; /** เวลาจริงของระบบบัญชี (เทสต์) */ now?: () => number } = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false, trustProxy: config.trustProxy ?? false });
  const labs = new LabManager(config);
  app.decorate('labs', labs);
  app.decorate('accounts', await openAccounts(app, config, opts.now ?? Date.now));

  // Server ใช้ใน LAN เท่านั้น — CORS เปิดเพื่อให้ Vite dev server (คนละพอร์ต) เรียกได้
  await app.register(cors, { origin: true });
  await app.register(websocket);
  registerRoutes(app);
  registerAuthRoutes(app, app.accounts);
  registerAdminRoutes(app, app.accounts, config.adminKey);
  registerRunRoutes(app, app.accounts);
  registerLeaderboardRoutes(app, app.accounts);
  registerWs(app, config);

  // โหมดใช้งานจริงใน LAN: Server เสิร์ฟหน้าเว็บที่ build แล้ว (apps/web/dist) บนพอร์ตเดียวกัน
  if (config.webDist && existsSync(config.webDist)) {
    await app.register(fastifyStatic, { root: config.webDist });
  }

  if (opts.startLabs ?? true) {
    app.addHook('onReady', () => labs.start());
    app.addHook('onClose', () => labs.stop());
  }
  return app;
}

/** W2 / SPEC § 4.39: เปิดฐานข้อมูลบัญชี + Migration เมื่อตั้ง DATABASE_URL */
async function openAccounts(app: FastifyInstance, config: ServerConfig, now: () => number): Promise<Accounts | null> {
  if (!config.databaseUrl) return null;
  const db = await openDatabase(config.databaseUrl);
  await migrate(db);
  app.addHook('onClose', () => db.close());
  let secret = config.authSecret;
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    app.log.warn('AUTH_SECRET ไม่ได้ตั้ง — สุ่มกุญแจชั่วคราว ผู้เล่นต้อง Login ใหม่หลังรีสตาร์ท Server');
  }
  return { store: new AccountStore(db), secret, now };
}
