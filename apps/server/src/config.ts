/** อ่านค่าจาก Environment (ดู .env.example) */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Invalid number for ${name}: ${raw}`);
  return n;
}

export interface ServerConfig {
  host: string;
  port: number;
  /** ส่ง heartbeat ทาง WebSocket ทุกกี่ ms */
  heartbeatMs: number;
}

export function loadConfig(): ServerConfig {
  return {
    host: process.env.SERVER_HOST ?? '127.0.0.1',
    port: num('SERVER_PORT', 3001),
    heartbeatMs: num('WS_HEARTBEAT_MS', 1000),
  };
}
