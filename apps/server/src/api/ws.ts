import type { FastifyInstance } from 'fastify';
import { ClientMessage, WS_PATH, type ServerMessage } from '@gol/shared';
import type { ServerConfig } from '../config';
import { SERVER_VERSION } from '../version';

/**
 * WebSocket (FR-41): Client subscribe Lab แล้วได้ snapshot (~5 Hz) และ event ของ Lab นั้นเท่านั้น
 * คำสั่งเปลี่ยน State ส่งผ่าน REST (POST /api/labs/:labId/commands)
 */
export function registerWs(app: FastifyInstance, config: ServerConfig): void {
  app.get(WS_PATH, { websocket: true }, (socket) => {
    const send = (msg: ServerMessage) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
    };
    const subscribed = new Set<string>();

    send({ type: 'hello', serverVersion: SERVER_VERSION, serverTime: Date.now(), labIds: app.labs.labIds });

    let seq = 0;
    const heartbeat = setInterval(() => send({ type: 'heartbeat', serverTime: Date.now(), seq: ++seq }), config.heartbeatMs);
    const offSnapshot = app.labs.onSnapshot((snap) => {
      if (subscribed.has(snap.labId)) send({ type: 'snapshot', labId: snap.labId, data: snap });
    });
    const offEvent = app.labs.onEvent((labId, event) => {
      if (subscribed.has(labId)) send({ type: 'event', labId, event });
    });

    socket.on('message', (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(data));
      } catch {
        send({ type: 'error', message: 'invalid JSON' });
        return;
      }
      const result = ClientMessage.safeParse(parsed);
      if (!result.success) {
        send({ type: 'error', message: 'invalid message' });
        return;
      }
      const msg = result.data;
      if (msg.type === 'ping') {
        send({ type: 'pong', t: msg.t, serverTime: Date.now() });
      } else if (msg.type === 'subscribe') {
        const lab = app.labs.get(msg.labId);
        if (!lab) {
          send({ type: 'error', message: `unknown lab ${msg.labId}` });
          return;
        }
        subscribed.add(msg.labId);
        send({ type: 'snapshot', labId: msg.labId, data: lab.snapshot() });
      }
    });

    socket.on('close', () => {
      clearInterval(heartbeat);
      offSnapshot();
      offEvent();
    });
  });
}
