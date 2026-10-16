import { create } from 'zustand';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface ConnectionState {
  status: ConnectionStatus;
  serverVersion: string | null;
  lastHeartbeatSeq: number;
  lastHeartbeatAt: number | null;
  /** Round-trip time (ms) จาก ping/pong ล่าสุด */
  rttMs: number | null;
}

export const useConnectionStore = create<ConnectionState>(() => ({
  status: 'connecting',
  serverVersion: null,
  lastHeartbeatSeq: 0,
  lastHeartbeatAt: null,
  rttMs: null,
}));
