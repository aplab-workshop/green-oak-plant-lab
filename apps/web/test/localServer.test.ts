import { describe, expect, it } from 'vitest';
import type { LabSnapshot, ServerMessage } from '@gol/shared';
import { LocalSocket, localFetch } from '../src/demo/localServer';

/** Demo build (P50 / SPEC § 4.33): Server จำลองในเบราว์เซอร์ตอบเหมือน REST/WebSocket จริง */
describe('Demo local server — P50', () => {
  it('serves scenarios, the lab snapshot (every level unlocked) and history/events with the run id header', async () => {
    const scenarios = await (await localFetch('/api/scenarios')).json() as unknown[];
    expect(scenarios.length).toBeGreaterThan(0);
    const snap = await (await localFetch('/api/labs/lab01')).json() as LabSnapshot;
    expect(snap).toMatchObject({ labId: 'lab01', devUnlockAll: true, plc: { kind: 'mock', mode: 'manual' } });
    expect(snap.levels.every((l) => l.unlocked)).toBe(true);
    const history = await localFetch('/api/labs/lab01/history');
    expect(history.headers.get('X-Lab-Run-Id')).toBe(String(snap.runId));
    expect((await localFetch('/api/labs/nope')).status).toBe(404);
  });

  it('runs commands through the same LabSession rules (zod 400, level lock-outs 409)', async () => {
    const post = (body: unknown) => localFetch('/api/labs/lab01/commands', { method: 'POST', body: JSON.stringify(body) });
    const sel = await post({ type: 'selectLevel', levelId: 'L3' });
    expect(sel.status).toBe(200);
    expect(((await sel.json()) as LabSnapshot).level?.id).toBe('L3');
    expect((await post({ type: 'setManualFan', value: 40 })).status).toBe(200);
    expect((await post({ type: 'bogus' })).status).toBe(400);
    expect((await post({ type: 'dose', device: 'phDown' })).status).toBe(409); // ด่าน 3 ล็อก pH Down
  });

  it('LocalSocket says hello and streams snapshots after subscribe', async () => {
    const socket = new LocalSocket();
    const got: ServerMessage[] = [];
    socket.onmessage = (ev) => got.push(JSON.parse(ev.data) as ServerMessage);
    await new Promise<void>((resolve) => { socket.onopen = () => resolve(); });
    await new Promise((r) => setTimeout(r, 0));
    expect(got[0]).toMatchObject({ type: 'hello', labIds: ['lab01'] });
    socket.send(JSON.stringify({ type: 'subscribe', labId: 'lab01' }));
    socket.send(JSON.stringify({ type: 'ping', t: 1 }));
    await new Promise((r) => setTimeout(r, 450));
    expect(got.filter((m) => m.type === 'snapshot').length).toBeGreaterThanOrEqual(2);
    expect(got.some((m) => m.type === 'pong')).toBe(true);
    socket.close();
  });
});
