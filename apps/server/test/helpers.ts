import type { MockPlcMode } from '@gol/shared';
import type { SimulationOptions } from '@gol/sim-core';
import type { ServerConfig } from '../src/config';
import { LabSession } from '../src/lab/LabSession';
import { MockPlcAdapter } from '../src/plc/MockPlcAdapter';

export const testConfig = (overrides: Partial<ServerConfig> = {}): ServerConfig => ({
  host: '127.0.0.1',
  port: 0,
  heartbeatMs: 50,
  labCount: 2,
  tickMs: 100,
  pollMs: 500,
  broadcastMs: 50,
  commandTimeoutMs: 3000,
  mockMode: 'auto',
  ...overrides,
});

/** นาฬิกาเวลาจริงปลอมสำหรับ Test */
export class FakeClock {
  t = 1_000_000;
  now = (): number => this.t;
}

export interface TestLab {
  lab: LabSession;
  mock: MockPlcAdapter;
  clock: FakeClock;
}

export function makeLab(labId = 'lab01', mode: MockPlcMode = 'auto', seed = 1, simOptions: SimulationOptions = {}): TestLab {
  const clock = new FakeClock();
  const mock = new MockPlcAdapter(mode, clock.now);
  const lab = new LabSession({ labId, adapter: mock, now: clock.now, sim: { ...simOptions, seed }, sensorNoise: false });
  return { lab, mock, clock };
}

/**
 * เดินเวลาจริงจำลองเหมือน LabManager: tick ทุก 100 ms และ poll ทุก 500 ms
 */
export async function runReal(t: TestLab, realMs: number, tickMs = 100, pollMs = 500): Promise<void> {
  let sincePoll = 0;
  for (let elapsed = 0; elapsed < realMs; elapsed += tickMs) {
    t.clock.t += tickMs;
    t.lab.tick(tickMs);
    sincePoll += tickMs;
    if (sincePoll >= pollMs) {
      sincePoll = 0;
      await t.lab.poll();
    }
  }
}
