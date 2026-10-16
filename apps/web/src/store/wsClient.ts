import { WS_PATH, type ClientMessage, type ServerMessage } from '@gol/shared';
import { useConnectionStore } from './connectionStore';

/** สร้าง URL ของ WebSocket จาก location ของหน้าเว็บ (ผ่าน proxy / server เดียวกัน) */
export function wsUrl(loc: Pick<Location, 'protocol' | 'host'>): string {
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${loc.host}${WS_PATH}`;
}

/** Reconnect backoff: 0.5s, 1s, 2s, ... สูงสุด 5s */
export function reconnectDelayMs(attempt: number): number {
  return Math.min(5000, 500 * 2 ** attempt);
}

let socket: WebSocket | null = null;
let attempt = 0;
let pingTimer: ReturnType<typeof setInterval> | undefined;

function send(msg: ClientMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

function handle(msg: ServerMessage): void {
  const set = useConnectionStore.setState;
  switch (msg.type) {
    case 'hello':
      set({ serverVersion: msg.serverVersion });
      break;
    case 'heartbeat':
      set({ lastHeartbeatSeq: msg.seq, lastHeartbeatAt: Date.now() });
      break;
    case 'pong':
      set({ rttMs: Date.now() - msg.t });
      break;
    case 'error':
      console.warn('[ws] server error:', msg.message);
      break;
  }
}

export function startConnection(): void {
  if (socket) return;
  useConnectionStore.setState({ status: 'connecting' });
  const ws = new WebSocket(wsUrl(window.location));
  socket = ws;

  ws.onopen = () => {
    attempt = 0;
    useConnectionStore.setState({ status: 'connected' });
    send({ type: 'ping', t: Date.now() });
    pingTimer = setInterval(() => send({ type: 'ping', t: Date.now() }), 5000);
  };
  ws.onmessage = (ev) => {
    try {
      handle(JSON.parse(String(ev.data)) as ServerMessage);
    } catch (err) {
      console.warn('[ws] bad message', err);
    }
  };
  ws.onclose = () => {
    clearInterval(pingTimer);
    socket = null;
    useConnectionStore.setState({ status: 'disconnected' });
    setTimeout(startConnection, reconnectDelayMs(attempt++));
  };
}
