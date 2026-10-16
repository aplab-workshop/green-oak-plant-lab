import { describe, expect, it } from 'vitest';
import { WRITABLE_D_ADDRESSES } from '@gol/shared';
import { Simulation } from '@gol/sim-core';
import { MockPlcAdapter } from '../src/plc/MockPlcAdapter';
import { PlcCommError, assertWritable, encodeSensorWrite, nextHeartbeat } from '../src/plc/PlcAdapter';
import { makeLab } from './helpers';

const sampleWrite = () => {
  const sim = new Simulation();
  return { sensors: sim.readSensors(false), sim: sim.readSimInfo(), heartbeat: 7 };
};

describe('Gateway write guard — AC-11', () => {
  it('allows only D100–D112 and D120', () => {
    for (const a of WRITABLE_D_ADDRESSES) expect(() => assertWritable('D', a)).not.toThrow();
    expect(() => assertWritable('D', 200)).toThrow(/D200/);
    expect(() => assertWritable('D', 99)).toThrow();
    for (const m of [100, 101, 102, 103, 104, 105]) expect(() => assertWritable('M', m)).toThrow(/M10/);
  });

  it('encodes sensors into exactly the allowed registers', () => {
    const { words } = encodeSensorWrite(sampleWrite());
    expect(words.map((w) => w.address)).toEqual([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 120]);
    expect(words.find((w) => w.address === 106)?.raw).toBe(85);
    expect(words.find((w) => w.address === 111)?.raw).toBe(360);
    expect(words.find((w) => w.address === 120)?.raw).toBe(7);
  });

  it('PlcAdapter has no API that can write an M device', () => {
    const mock = new MockPlcAdapter('manual');
    const gatewayApi = ['connect', 'close', 'writeSensors', 'readCommands', 'status'];
    // writeSensors รับเฉพาะ SensorWrite (Type-level) — ตรวจว่าไม่มีเมธอดเขียน Address อิสระ
    for (const name of ['write', 'writeWords', 'writeDevice', 'writeBits']) {
      expect((mock as unknown as Record<string, unknown>)[name]).toBeUndefined();
    }
    for (const name of gatewayApi) expect(typeof (mock as unknown as Record<string, unknown>)[name]).toBe('function');
  });

  it("gateway polling never overwrites the student's M commands", async () => {
    const t = makeLab('lab01', 'manual');
    t.mock.setManualBit('refillPump', true);
    t.mock.setManualBit('fan', true);
    t.mock.setManualLed(42);
    for (let i = 0; i < 5; i++) await t.lab.poll();
    expect(t.mock.memory.getM(102)).toBe(true);
    expect(t.mock.memory.getM(100)).toBe(true);
    expect(t.mock.memory.getD(200)).toBe(42);
    expect(t.lab.commands).toMatchObject({ refillPump: true, fan: true, ledPct: 42 });
  });

  it('heartbeat wraps at 32767', () => {
    expect(nextHeartbeat(0)).toBe(1);
    expect(nextHeartbeat(32767)).toBe(0);
  });
});

describe('MockPlcAdapter', () => {
  it('writes scaled sensor values into D memory', async () => {
    const mock = new MockPlcAdapter('auto');
    await mock.writeSensors(sampleWrite());
    expect(mock.memory.getD(104)).toBe(600); // pH 6.00 × 100
    expect(mock.memory.getD(105)).toBe(120); // EC 1.20 × 100
  });

  it('auto program behaves like the example ladder (hysteresis)', async () => {
    const mock = new MockPlcAdapter('auto');
    const w = sampleWrite();
    await mock.writeSensors({ ...w, sensors: { ...w.sensors, waterLevelPct: 65 } });
    expect((await mock.readCommands()).commands.refillPump).toBe(true);
    await mock.writeSensors({ ...w, sensors: { ...w.sensors, waterLevelPct: 80 } });
    expect((await mock.readCommands()).commands.refillPump).toBe(true); // ยังเติมจนถึง 90
    await mock.writeSensors({ ...w, sensors: { ...w.sensors, waterLevelPct: 91 } });
    expect((await mock.readCommands()).commands.refillPump).toBe(false);
    // 06:00 → LED 80 %, 23:00 → 0 %
    expect((await mock.readCommands()).commands.ledPct).toBe(80);
    await mock.writeSensors({ ...w, sim: { ...w.sim, minuteOfDay: 23 * 60 } });
    const night = await mock.readCommands();
    expect(night.commands.ledPct).toBe(0);
    expect(night.commands.airPump).toBe(true);
  });

  it('clamps out-of-range D200 read from the PLC', async () => {
    const mock = new MockPlcAdapter('manual');
    mock.memory.setD(200, 250);
    const r = await mock.readCommands();
    expect(r.commands.ledPct).toBe(100);
    expect(r.outOfRange).toEqual(['D200 = 250']);
  });

  it('offline mode throws PlcCommError and reports offline status', async () => {
    const mock = new MockPlcAdapter('offline');
    await expect(mock.readCommands()).rejects.toBeInstanceOf(PlcCommError);
    expect(mock.status()).toMatchObject({ connection: 'offline', errorCount: 1 });
  });

  it('manual control is rejected outside manual mode', () => {
    expect(() => new MockPlcAdapter('auto').setManualBit('fan', true)).toThrow();
  });
});
