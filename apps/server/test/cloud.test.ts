import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { testConfig } from './helpers';

/** W7a / SPEC § 4.44 / AC-75a — Server โหมด Cloud (Render) */

const PAGES = 'https://aplab-workshop.github.io';
const apps: FastifyInstance[] = [];
const saved = { ...process.env };

afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  for (const k of ['PORT', 'SERVER_PORT', 'CORS_ORIGINS']) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('cloud mode (W7a)', () => {
  it('reads PORT from the cloud when SERVER_PORT is not set, and CORS_ORIGINS as a list', () => {
    delete process.env.SERVER_PORT;
    process.env.PORT = '10000';
    process.env.CORS_ORIGINS = ` ${PAGES}/ , http://localhost:4174 `;
    const c = loadConfig();
    expect(c.port).toBe(10000);
    expect(c.corsOrigins).toEqual([PAGES, 'http://localhost:4174']);
    process.env.SERVER_PORT = '3005';
    expect(loadConfig().port).toBe(3005);
    process.env.CORS_ORIGINS = '';
    expect(loadConfig().corsOrigins).toEqual([]);
  });

  it('CORS answers only the allowed site; accounts work with no labs (LAB_COUNT=0)', async () => {
    const app = await buildApp(testConfig({ labCount: 0, databaseUrl: 'memory://', authSecret: 's', corsOrigins: [PAGES] }), { startLabs: false });
    apps.push(app);
    const preflight = (origin: string) =>
      app.inject({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,authorization' },
      });
    const ok = await preflight(PAGES);
    expect(ok.headers['access-control-allow-origin']).toBe(PAGES);
    expect(String(ok.headers['access-control-allow-headers'])).toMatch(/authorization/i);
    expect((await preflight('https://evil.example')).headers['access-control-allow-origin']).toBeUndefined();

    const cfg = await app.inject({ method: 'GET', url: '/api/auth/config', headers: { origin: PAGES } });
    expect(cfg.json()).toEqual({ enabled: true });
    expect(cfg.headers['access-control-allow-origin']).toBe(PAGES);
    expect(app.labs.labIds).toEqual([]);
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
  }, 30_000);

  it('W8: the admin page on Pages may use PATCH/DELETE and read x-run-count across origins', async () => {
    const app = await buildApp(testConfig({ labCount: 0, databaseUrl: 'memory://', authSecret: 's', adminKey: 'teacher-key-0123456789', corsOrigins: [PAGES] }), { startLabs: false });
    apps.push(app);
    for (const method of ['PATCH', 'DELETE']) {
      const pre = await app.inject({
        method: 'OPTIONS',
        url: '/api/admin/invites/X',
        headers: { origin: PAGES, 'access-control-request-method': method, 'access-control-request-headers': 'authorization,content-type' },
      });
      expect(String(pre.headers['access-control-allow-methods'])).toContain(method);
    }
    const csv = await app.inject({ method: 'GET', url: '/api/admin/logs.csv', headers: { origin: PAGES, authorization: 'Bearer teacher-key-0123456789' } });
    expect(csv.statusCode).toBe(200);
    expect(String(csv.headers['access-control-expose-headers'])).toContain('x-run-count');
  }, 30_000);

  it('LAN/dev keeps allowing any origin when CORS_ORIGINS is empty', async () => {
    const app = await buildApp(testConfig(), { startLabs: false });
    apps.push(app);
    const res = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'http://192.168.1.20:5173' } });
    expect(res.headers['access-control-allow-origin']).toBe('http://192.168.1.20:5173');
  });
});
