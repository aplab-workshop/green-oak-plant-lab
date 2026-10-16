import { existsSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import type { ServerConfig } from './config';
import { registerRoutes } from './api/routes';
import { registerWs } from './api/ws';
import { LabManager } from './lab/LabManager';

export { SERVER_VERSION } from './version';

declare module 'fastify' {
  interface FastifyInstance {
    labs: LabManager;
  }
}

/**
 * สร้าง Fastify app (แยกจาก listen เพื่อให้ Test ใช้ inject ได้)
 * startLabs = false สำหรับ Test ที่ต้องการคุม tick/poll เอง
 */
export async function buildApp(
  config: ServerConfig,
  opts: { logger?: boolean; startLabs?: boolean } = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  const labs = new LabManager(config);
  app.decorate('labs', labs);

  // Server ใช้ใน LAN เท่านั้น — CORS เปิดเพื่อให้ Vite dev server (คนละพอร์ต) เรียกได้
  await app.register(cors, { origin: true });
  await app.register(websocket);
  registerRoutes(app);
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
