import { z } from 'zod';
import type { EventEntry, LabSnapshot } from './lab';

/** ข้อความ WebSocket จาก Client → Server */
export const ClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribe'), labId: z.string().min(1).max(32) }),
  z.object({ type: z.literal('ping'), t: z.number() }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

/** ข้อความ WebSocket จาก Server → Client */
export type ServerMessage =
  | { type: 'hello'; serverVersion: string; serverTime: number; labIds: string[] }
  | { type: 'heartbeat'; serverTime: number; seq: number }
  | { type: 'pong'; t: number; serverTime: number }
  | { type: 'snapshot'; labId: string; data: LabSnapshot }
  | { type: 'event'; labId: string; event: EventEntry }
  | { type: 'error'; message: string };

export const WS_PATH = '/ws';
