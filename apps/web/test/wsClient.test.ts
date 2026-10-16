import { describe, expect, it } from 'vitest';
import { reconnectDelayMs, wsUrl } from '../src/store/wsClient';

describe('wsClient helpers', () => {
  it('builds ws/wss URL from page location', () => {
    expect(wsUrl({ protocol: 'http:', host: '192.168.1.10:5173' })).toBe('ws://192.168.1.10:5173/ws');
    expect(wsUrl({ protocol: 'https:', host: 'lab.local' })).toBe('wss://lab.local/ws');
  });

  it('backs off reconnect up to 5 s', () => {
    expect(reconnectDelayMs(0)).toBe(500);
    expect(reconnectDelayMs(1)).toBe(1000);
    expect(reconnectDelayMs(10)).toBe(5000);
  });
});
