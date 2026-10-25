import { ClientMessage, LabCommand, type ServerMessage } from '@gol/shared';
import { LabManager } from '../../../server/src/lab/LabManager';
import { LabCommandError } from '../../../server/src/lab/LabSession';
import { SCENARIOS } from '../../../server/src/scenarios/scenarios';
import { SERVER_VERSION } from '../../../server/src/version';

/**
 * Demo build (P50 / SPEC § 4.33): Server จำลองในเบราว์เซอร์ — ใช้ LabManager/LabSession/MockPlcAdapter ตัวเดียวกับ Server
 * แทน REST (localFetch) และ WebSocket (LocalSocket) ด้วยเส้นทาง/ข้อความเดียวกับ apps/server/src/api
 */
const HEARTBEAT_MS = 1000;

const manager = new LabManager({
  labCount: 1,
  tickMs: 100,
  pollMs: 500,
  broadcastMs: 200,
  commandTimeoutMs: 3000,
  mockMode: 'manual',
  unlockAllLevels: true,
});
const started = manager.start();

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** เหมือน api/routes.ts — คืน Response เพื่อให้ api.ts ใช้โค้ดเดิมได้ */
export async function localFetch(input: string, init?: RequestInit): Promise<Response> {
  await started;
  const url = new URL(input, 'http://demo.local');
  const path = url.pathname;
  if (path === '/api/scenarios') return json(SCENARIOS.map(({ id, title, objective, description }) => ({ id, title, objective, description })));
  const m = /^\/api\/labs\/([^/]+)(?:\/(history|events|commands))?$/.exec(path);
  const lab = m ? manager.get(m[1]!) : undefined;
  if (!m || !lab) return json({ error: `ไม่พบ ${path}` }, 404);
  const runHeader = { 'X-Lab-Run-Id': String(lab.events.runId) };
  switch (m[2]) {
    case undefined:
      return json(lab.snapshot());
    case 'history':
      return json(lab.history.list(), 200, runHeader);
    case 'events': {
      const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') ?? 1000) || 1000));
      return json(lab.events.list(limit), 200, runHeader);
    }
    case 'commands': {
      const parsed = LabCommand.safeParse(JSON.parse(String(init?.body ?? 'null')));
      if (!parsed.success) return json({ error: 'คำสั่งไม่ถูกต้อง', issues: parsed.error.issues }, 400);
      try {
        await lab.handle(parsed.data);
      } catch (err) {
        if (err instanceof LabCommandError) return json({ error: err.message }, err.statusCode);
        throw err;
      }
      return json(lab.snapshot());
    }
  }
  return json({ error: 'not found' }, 404);
}

/** เหมือน api/ws.ts — หน้าตาเท่าที่ wsClient.ts ใช้ของ WebSocket */
export class LocalSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  private readonly subscribed = new Set<string>();
  private readonly cleanups: (() => void)[] = [];

  constructor() {
    void started.then(() => {
      this.readyState = 1;
      this.onopen?.();
      this.emit({ type: 'hello', serverVersion: `${SERVER_VERSION}-demo`, serverTime: Date.now(), labIds: manager.labIds });
      let seq = 0;
      const hb = setInterval(() => this.emit({ type: 'heartbeat', serverTime: Date.now(), seq: ++seq }), HEARTBEAT_MS);
      this.cleanups.push(() => clearInterval(hb));
      this.cleanups.push(manager.onSnapshot((snap) => {
        if (this.subscribed.has(snap.labId)) this.emit({ type: 'snapshot', labId: snap.labId, data: snap });
      }));
      this.cleanups.push(manager.onEvent((labId, event) => {
        if (this.subscribed.has(labId)) this.emit({ type: 'event', labId, event });
      }));
    });
  }

  send(data: string): void {
    const result = ClientMessage.safeParse(JSON.parse(data));
    if (!result.success) return this.emit({ type: 'error', message: 'invalid message' });
    const msg = result.data;
    if (msg.type === 'ping') this.emit({ type: 'pong', t: msg.t, serverTime: Date.now() });
    else if (msg.type === 'subscribe') {
      const lab = manager.get(msg.labId);
      if (!lab) return this.emit({ type: 'error', message: `unknown lab ${msg.labId}` });
      this.subscribed.add(msg.labId);
      this.emit({ type: 'snapshot', labId: msg.labId, data: lab.snapshot() });
    }
  }

  close(): void {
    this.cleanups.forEach((c) => c());
    this.readyState = 3;
    this.onclose?.();
  }

  private emit(msg: ServerMessage): void {
    // ส่งแบบ async เหมือนเครือข่าย และผ่าน JSON เหมือนของจริง (ไม่แชร์ object กับ Server จำลอง)
    const data = JSON.stringify(msg);
    queueMicrotask(() => this.onmessage?.({ data }));
  }
}
