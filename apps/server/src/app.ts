import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import type { ServerConfig } from './config';
import { registerRoutes } from './api/routes';
import { registerWs } from './api/ws';

export { SERVER_VERSION } from './version';

/** สร้าง Fastify app (แยกจาก listen เพื่อให้ Test ใช้ inject ได้) */
export async function buildApp(config: ServerConfig, opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  // Server ใช้ใน LAN เท่านั้น — CORS เปิดเพื่อให้ Vite dev server (คนละพอร์ต) เรียกได้
  await app.register(cors, { origin: true });
  await app.register(websocket);
  registerRoutes(app);
  registerWs(app, config);
  return app;
}
