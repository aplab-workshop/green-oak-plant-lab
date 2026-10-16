import { createPlant, plantWaterRequest, stepPlant, simTimeFrom, type PlantEnvironment, type PlantState, type SimConfig } from '../src';

/** แยกปัจจัยที่ต้องการทดสอบ: Environment คงที่และถังจ่ายน้ำตาม Request ได้ทั้งหมด */
export function plantFixture(cfg: SimConfig, overrides: Partial<PlantEnvironment> = {}) {
  const env: PlantEnvironment = {
    simTimeS: simTimeFrom(14, 6), waterHeightCm: 17, ledPct: 62.5, airTempC: 24, vpdKPa: 1,
    ecMsCm: 1.2, ph: 6, ...overrides,
  };
  let plant = createPlant(1, 1, 5, env.simTimeS, cfg);
  return {
    env,
    get plant(): PlantState { return plant; },
    step(seconds = 1): void {
      plant = stepPlant(plant, plantWaterRequest(plant, env, cfg), env, 1, seconds, cfg);
      env.simTimeS += seconds;
    },
    runHours(hours: number): void {
      for (let i = 0; i < Math.round(hours * 3600); i++) this.step();
    },
  };
}
