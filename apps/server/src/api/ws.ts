import type { FastifyInstance } from 'fastify';
import { ClientMessage, WS_PATH, type ServerMessage } from '@gol/shared';
import type { ServerConfig } from '../config';
import { SERVER_VERSION } from '../version';

export function registerWs(app: FastifyInstance, config: ServerConfig): void {
  app.get(WS_PATH, { websocket: true }, (socket) => {
    const send = (msg: ServerMessage) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
    };

    send({ type: 'hello', serverVersion: SERVER_VERSION, serverTime: Date.now() });

    let seq = 0;
    const timer = setInterval(() => {
      send({ type: 'heartbeat', serverTime: Date.now(), seq: ++seq });
    }, config.heartbeatMs);

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
      if (msg.type === 'ping') send({ type: 'pong', t: msg.t, serverTime: Date.now() });
      // 'subscribe' จะใช้งานใน P4 เมื่อมี LabSession
    });

    socket.on('close', () => clearInterval(timer));
  });
}
