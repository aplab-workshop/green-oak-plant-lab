import { describe, expect, it } from 'vitest';
import { makeConfig, stepAir, vpdKPa } from '../src';

const cfg = makeConfig();
const at = (hour: number) => 28 * 86400 + hour * 3600;

/** อากาศที่สมดุลแล้ว (เดิน 400 นาทีจำลอง) */
function steady(hour: number, ledPct: number, fanPct: number, humidifier: boolean, roomTempDeltaC = 0, roomRhDeltaPct = 0, sunFrac = 0) {
  let s = { airTempC: 24, rhPct: 60 };
  for (let i = 0; i < 400; i++) s = stepAir(s, { simTimeS: at(hour), ledPct, fanPct, humidifier, roomTempDeltaC, roomRhDeltaPct, sunFrac }, 60, cfg);
  return { ...s, vpd: vpdKPa(s.airTempC, s.rhPct) };
}

const good = (s: { airTempC: number; vpd: number }) => s.airTempC >= 18 && s.airTempC <= 25 && s.vpd >= 0.5 && s.vpd <= 1.7;

const SCENARIOS = [
  ['เที่ยงปกติ (LED 40 %)', 13, 40, 0, 0, 1],
  ['คลื่นความร้อนตอนเที่ยง', 13, 40, 5, 0, 1],
  ['อากาศแห้งตอนเที่ยง', 13, 40, 0, -20, 1],
  ['ร้อน + แห้ง', 13, 40, 5, -20, 1],
  ['เช้า (LED 80 %)', 8, 80, 0, 0, 0.3],
  ['กลางคืน', 2, 0, 0, 0, 0],
  ['กลางคืน + แห้ง', 3, 0, 0, -20, 0],
] as const;

describe('Fan speed + humidifier control every situation — P48 (SPEC § 4.31)', () => {
  it.each(SCENARIOS)('%s: some fan % + humidifier ON/OFF keeps 18–25 °C and air "ok"', (_name, hour, led, dT, dRh, sun) => {
    const options = [false, true].flatMap((hum) => Array.from({ length: 11 }, (_, i) => steady(hour, led, i * 10, hum, dT, dRh, sun)));
    expect(options.some(good)).toBe(true);
  });

  it('fan speed cools stepwise and can go below room temperature (cooling pad)', () => {
    const t = [0, 50, 100].map((f) => steady(13, 40, f, false, 5, 0, 1).airTempC);
    expect(t[0]).toBeGreaterThan(30);
    expect(t[1]).toBeLessThan(t[0]! - 4);
    expect(t[2]).toBeLessThanOrEqual(25);
    // กลางคืนเปิดเต็มที่จะเย็นเกิน → ต้องหรี่
    expect(steady(2, 0, 100, false).airTempC).toBeLessThan(15);
  });

  it('humidifier ON fixes dry air, OFF fixes humid air', () => {
    const dry = steady(13, 40, 50, false, 0, -20, 1);
    const dryMist = steady(13, 40, 50, true, 0, -20, 1);
    expect(dryMist.vpd).toBeLessThan(dry.vpd - 0.4);
    const nightMist = steady(2, 0, 0, true);
    const nightOff = steady(2, 0, 0, false);
    expect(nightMist.vpd).toBeLessThan(0.5);
    expect(good(nightOff)).toBe(true);
  });
});
