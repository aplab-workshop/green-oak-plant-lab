import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import type { ServerMessage } from '@gol/shared';
import { buildApp } from '../src/app';

let app: FastifyInstance;
let baseUrl: string;

beforeAll(async () => {
  app = await buildApp({ host: '127.0.0.1', port: 0, heartbeatMs: 50 });
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
});

afterAll(async () => {
  await app.close();
});

/** เก็บข้อความ WS จนกว่า predicate จะเป็นจริง */
function collect(ws: WebSocket, until: (msgs: ServerMessage[]) => boolean): Promise<ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const msgs: ServerMessage[] = [];
    const timeout = setTimeout(() => reject(new Error('timeout')), 2000);
    ws.on('message', (data) => {
      msgs.push(JSON.parse(String(data)) as ServerMessage);
      if (until(msgs)) {
        clearTimeout(timeout);
        resolve(msgs);
      }
    });
  });
}

describe('server', () => {
  it('GET /api/health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('WebSocket sends hello then heartbeats and answers ping', async () => {
    const ws = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws`);
    const done = collect(ws, (m) => m.filter((x) => x.type === 'heartbeat').length >= 2 && m.some((x) => x.type === 'pong'));
    await new Promise<void>((resolve) => ws.on('open', () => resolve()));
    ws.send(JSON.stringify({ type: 'ping', t: 123 }));
    const msgs = await done;
    ws.close();

    expect(msgs[0]?.type).toBe('hello');
    expect(msgs.find((m) => m.type === 'pong')).toMatchObject({ t: 123 });
  });

  it('WebSocket rejects invalid messages', async () => {
    const ws = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws`);
    const done = collect(ws, (m) => m.some((x) => x.type === 'error'));
    await new Promise<void>((resolve) => ws.on('open', () => resolve()));
    ws.send(JSON.stringify({ type: 'hack', labId: 1 }));
    const msgs = await done;
    ws.close();
    expect(msgs.find((m) => m.type === 'error')).toBeDefined();
  });
});
