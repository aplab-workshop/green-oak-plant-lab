import type { SensorReadings } from '@gol/shared';
import type { Simulation } from '@gol/sim-core';

/**
 * แหล่งค่า Sensor (NFR-04) — Phase 2 จะเพิ่ม RealSensorProvider
 * โดย LabSession และ 3D Renderer ไม่ต้องแก้
 */
export interface SensorProvider {
  readonly kind: 'simulated' | 'real';
  read(): SensorReadings;
}

/** อ่านค่าจาก Simulation พร้อม Sensor noise */
export class SimulatedSensorProvider implements SensorProvider {
  readonly kind = 'simulated' as const;

  constructor(
    private readonly sim: Simulation,
    private readonly withNoise = true,
  ) {}

  read(): SensorReadings {
    return this.sim.readSensors(this.withNoise);
  }
}
