import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import type { LabSnapshot, ServerMessage } from '@gol/shared';
import { buildApp } from '../src/app';
import { testConfig } from './helpers';

let app: FastifyInstance;
let baseUrl: string;

beforeAll(async () => {
  app = await buildApp(testConfig());
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
});

afterAll(async () => {
  await app.close();
});

/** เปิด WS แล้วเก็บข้อความจนกว่า predicate จะเป็นจริง */
async function wsCollect(onOpen: (ws: WebSocket) => void, until: (msgs: ServerMessage[]) => boolean): Promise<ServerMessage[]> {
  const ws = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws`);
  try {
    return await new Promise((resolve, reject) => {
      const msgs: ServerMessage[] = [];
      const timeout = setTimeout(() => reject(new Error(`timeout; got ${msgs.map((m) => m.type).join(',')}`)), 3000);
      ws.on('open', () => onOpen(ws));
      ws.on('message', (data) => {
        msgs.push(JSON.parse(String(data)) as ServerMessage);
        if (until(msgs)) {
          clearTimeout(timeout);
          resolve(msgs);
        }
      });
    });
  } finally {
    ws.close();
  }
}

const post = (labId: string, body: unknown) =>
  app.inject({ method: 'POST', url: `/api/labs/${labId}/commands`, payload: body as object });

describe('REST API', () => {
  it('GET /api/health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('lists labs and returns a lab snapshot', async () => {
    const list = (await app.inject({ method: 'GET', url: '/api/labs' })).json();
    expect(list.map((l: { labId: string }) => l.labId)).toEqual(['lab01', 'lab02']);

    const snap = (await app.inject({ method: 'GET', url: '/api/labs/lab01' })).json() as LabSnapshot;
    expect(snap.labId).toBe('lab01');
    expect(snap.plants).toHaveLength(6);
    expect(snap.plc.kind).toBe('mock');
    expect(snap.tank.capacityL).toBe(40);
  });

  it('returns 404 for unknown lab and 400 for invalid command', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/labs/lab99' })).statusCode).toBe(404);
    expect((await post('lab01', { type: 'setSpeed', speed: 7 })).statusCode).toBe(400);
    expect((await post('lab01', { type: 'hack' })).statusCode).toBe(400);
  });

  it('applies commands: speed, manual mode and manual actuator', async () => {
    const speed = await post('lab01', { type: 'setSpeed', speed: 60 });
    expect(speed.json().speed).toBe(60);

    // manual actuator ในโหมด auto → 409
    expect((await post('lab01', { type: 'setManualBit', key: 'refillPump', value: true })).statusCode).toBe(409);

    await post('lab01', { type: 'setPlcMode', mode: 'manual' });
    const on = await post('lab01', { type: 'setManualBit', key: 'refillPump', value: true });
    expect(on.statusCode).toBe(200);
    expect((on.json() as LabSnapshot).commands.refillPump).toBe(true);

    const led = await post('lab01', { type: 'setManualLed', value: 55 });
    expect((led.json() as LabSnapshot).commands.ledPct).toBe(55);
  });

  it('applies the water-shortage scenario and rejects unknown ones', async () => {
    const res = await post('lab02', { type: 'applyScenario', scenarioId: 'water-shortage' });
    const snap = res.json() as LabSnapshot;
    expect(snap.scenario?.id).toBe('water-shortage');
    expect(snap.disturbance.leakLph).toBeGreaterThan(0);
    expect(snap.tank.waterLevelPct).toBeCloseTo(65, 0);
    expect((await post('lab02', { type: 'applyScenario', scenarioId: 'nope' })).statusCode).toBe(404);
    const scenarios = (await app.inject({ method: 'GET', url: '/api/scenarios' })).json();
    expect(scenarios[0].id).toBe('water-shortage');
  });

  it('serves history and events', async () => {
    const history = (await app.inject({ method: 'GET', url: '/api/labs/lab02/history' })).json();
    expect(history.length).toBeGreaterThan(0);
    const events = (await app.inject({ method: 'GET', url: '/api/labs/lab02/events' })).json();
    expect(events.some((e: { kind: string }) => e.kind === 'lab.reset')).toBe(true);
  });
});

describe('WebSocket', () => {
  it('sends hello with lab ids, heartbeats and answers ping', async () => {
    const msgs = await wsCollect(
      (ws) => ws.send(JSON.stringify({ type: 'ping', t: 123 })),
      (m) => m.filter((x) => x.type === 'heartbeat').length >= 2 && m.some((x) => x.type === 'pong'),
    );
    expect(msgs[0]).toMatchObject({ type: 'hello', labIds: ['lab01', 'lab02'] });
    expect(msgs.find((m) => m.type === 'pong')).toMatchObject({ t: 123 });
  });

  it('streams snapshots only for the subscribed lab', async () => {
    const msgs = await wsCollect(
      (ws) => ws.send(JSON.stringify({ type: 'subscribe', labId: 'lab02' })),
      (m) => m.filter((x) => x.type === 'snapshot').length >= 3,
    );
    const snaps = msgs.filter((m): m is Extract<ServerMessage, { type: 'snapshot' }> => m.type === 'snapshot');
    expect(snaps.every((s) => s.labId === 'lab02')).toBe(true);
  });

  it('rejects invalid messages and unknown labs', async () => {
    const msgs = await wsCollect(
      (ws) => {
        ws.send(JSON.stringify({ type: 'hack', labId: 1 }));
        ws.send(JSON.stringify({ type: 'subscribe', labId: 'lab99' }));
      },
      (m) => m.filter((x) => x.type === 'error').length >= 2,
    );
    expect(msgs.filter((m) => m.type === 'error')).toHaveLength(2);
  });

  it('AC-27: REST/WS preserve oxygen, per-plant history and reset generation', async () => {
    await post('lab02', { type: 'pause' });
    await post('lab02', { type: 'reset' });
    const lab = app.labs.get('lab02')!;
    const expected = lab.snapshot();
    const rest = (await app.inject({ method: 'GET', url: '/api/labs/lab02' })).json() as LabSnapshot;
    expect(rest.tank.estimatedOxygen).toBe(lab.sim.env.estimatedOxygen);
    expect(rest.plants).toEqual(expected.plants);
    const history = await app.inject({ method: 'GET', url: '/api/labs/lab02/history' });
    expect(history.headers['x-lab-run-id']).toBe(String(expected.runId));
    expect(history.json()[0].plants[0]).toMatchObject({ lightStress: 0, nutrientStress: 0, rootHealth: 1 });
    const msgs = await wsCollect(
      (ws) => ws.send(JSON.stringify({ type: 'subscribe', labId: 'lab02' })),
      (m) => m.some((x) => x.type === 'snapshot'),
    );
    const snap = msgs.find((m) => m.type === 'snapshot');
    expect(snap?.type === 'snapshot' && snap.data.tank).toEqual(expected.tank);
    expect(snap?.type === 'snapshot' && snap.data.runId).toBe(expected.runId);
  });
});
