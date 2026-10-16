import { WS_PATH, type ClientMessage, type ServerMessage } from '@gol/shared';
import { useConnectionStore } from './connectionStore';
import { mergeEvents, useLabStore } from './labStore';
import { loadScenarios, refreshEvents, refreshHistory } from './api';

/** สร้าง URL ของ WebSocket จาก location ของหน้าเว็บ (ผ่าน proxy / server เดียวกัน) */
export function wsUrl(loc: Pick<Location, 'protocol' | 'host'>): string {
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${loc.host}${WS_PATH}`;
}

/** Reconnect backoff: 0.5s, 1s, 2s, ... สูงสุด 5s */
export function reconnectDelayMs(attempt: number): number {
  return Math.min(5000, 500 * 2 ** attempt);
}

/** เลือก Lab จาก ?lab= ใน URL ถ้ามี มิฉะนั้นใช้ Lab แรก */
export function pickLab(labIds: string[], search: string, current: string | null): string | null {
  const wanted = new URLSearchParams(search).get('lab');
  if (wanted && labIds.includes(wanted)) return wanted;
  if (current && labIds.includes(current)) return current;
  return labIds[0] ?? null;
}

let socket: WebSocket | null = null;
let attempt = 0;
let pingTimer: ReturnType<typeof setInterval> | undefined;
let historyTimer: ReturnType<typeof setInterval> | undefined;

function send(msg: ClientMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

/** เปลี่ยน Lab ที่ดูอยู่ */
export function selectLab(labId: string): void {
  useLabStore.setState({ labId, snapshot: null, events: [], history: [], selectedPlantId: 1 });
  const url = new URL(window.location.href);
  url.searchParams.set('lab', labId);
  window.history.replaceState(null, '', url);
  send({ type: 'subscribe', labId });
  void refreshHistory();
  void refreshEvents();
}

function handle(msg: ServerMessage): void {
  switch (msg.type) {
    case 'hello': {
      useConnectionStore.setState({ serverVersion: msg.serverVersion });
      useLabStore.setState({ labIds: msg.labIds });
      const labId = pickLab(msg.labIds, window.location.search, useLabStore.getState().labId);
      if (labId) selectLab(labId);
      void loadScenarios();
      break;
    }
    case 'heartbeat':
      useConnectionStore.setState({ lastHeartbeatSeq: msg.seq, lastHeartbeatAt: Date.now() });
      break;
    case 'pong':
      useConnectionStore.setState({ rttMs: Date.now() - msg.t });
      break;
    case 'snapshot':
      if (msg.labId === useLabStore.getState().labId) useLabStore.setState({ snapshot: msg.data });
      break;
    case 'event':
      if (msg.labId === useLabStore.getState().labId) {
        useLabStore.setState((s) => ({ events: mergeEvents(s.events, [msg.event]) }));
      }
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
    // กราฟใช้ History ที่ Server สุ่มเก็บทุก 10 นาทีจำลอง
    historyTimer = setInterval(() => void refreshHistory(), 3000);
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
    clearInterval(historyTimer);
    socket = null;
    useConnectionStore.setState({ status: 'disconnected' });
    setTimeout(startConnection, reconnectDelayMs(attempt++));
  };
}
