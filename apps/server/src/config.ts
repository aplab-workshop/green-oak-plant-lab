import type { MockPlcMode } from '@gol/shared';

/** อ่านค่าจาก Environment (ดู .env.example) */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Invalid number for ${name}: ${raw}`);
  return n;
}

function mockMode(): MockPlcMode {
  const raw = process.env.MOCK_PLC_MODE ?? 'auto';
  if (raw === 'manual' || raw === 'auto' || raw === 'offline') return raw;
  throw new Error(`Invalid MOCK_PLC_MODE: ${raw}`);
}

export interface ServerConfig {
  host: string;
  port: number;
  /** ส่ง heartbeat ทาง WebSocket ทุกกี่ ms */
  heartbeatMs: number;
  labCount: number;
  tickMs: number;
  pollMs: number;
  broadcastMs: number;
  commandTimeoutMs: number;
  mockMode: MockPlcMode;
}

export function loadConfig(): ServerConfig {
  return {
    host: process.env.SERVER_HOST ?? '127.0.0.1',
    port: num('SERVER_PORT', 3001),
    heartbeatMs: num('WS_HEARTBEAT_MS', 1000),
    labCount: num('LAB_COUNT', 1),
    tickMs: num('SIM_TICK_MS', 100),
    pollMs: num('PLC_POLL_MS', 500),
    broadcastMs: num('WS_BROADCAST_MS', 200),
    commandTimeoutMs: num('PLC_COMMAND_TIMEOUT_MS', 3000),
    mockMode: mockMode(),
  };
}
