import type { FastifyInstance } from 'fastify';
import { SERVER_VERSION } from '../version';

const startedAt = Date.now();

export function registerRoutes(app: FastifyInstance): void {
  app.get('/api/health', async () => ({
    status: 'ok',
    version: SERVER_VERSION,
    uptimeS: Math.round((Date.now() - startedAt) / 1000),
    serverTime: Date.now(),
  }));
}
