import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { testConfig } from './helpers';

const dir = mkdtempSync(join(tmpdir(), 'gol-web-'));
writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Green Oak</title>');

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('LAN production mode', () => {
  it('serves the built web app and the API on the same port', async () => {
    const app = await buildApp(testConfig({ webDist: dir }), { startLabs: false });
    const page = await app.inject({ method: 'GET', url: '/' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Green Oak');
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    await app.close();
  });

  it('runs API-only when the web build is missing', async () => {
    const app = await buildApp(testConfig({ webDist: join(dir, 'missing') }), { startLabs: false });
    expect((await app.inject({ method: 'GET', url: '/' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    await app.close();
  });
});
