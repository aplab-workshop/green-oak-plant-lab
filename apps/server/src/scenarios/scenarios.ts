import type { ScenarioInfo } from '@gol/shared';
import type { Simulation } from '@gol/sim-core';

export interface Scenario extends ScenarioInfo {
  /** ตั้ง Initial conditions และ Disturbance ให้ Simulation (หลัง Reset) */
  apply(sim: Simulation): void;
}

/**
 * Scenario ของ M1 — Library ครบ 10 บทอยู่ใน M5
 * Scenario ตั้งเฉพาะสภาพเริ่มต้นและ Disturbance ส่วนผลลัพธ์ขึ้นกับคำสั่งจาก PLC เสมอ
 */
export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'water-shortage',
    title: 'Water Shortage Simulation',
    objective: 'เขียน Ladder ให้ Refill Pump (M102) รักษาระดับน้ำ (D106) ก่อนรากพ้นน้ำ',
    description:
      'ถังมีรอยรั่ว 1.5 L/h และระดับน้ำเริ่มที่ 65% ต้นกล้ารากสั้นจะเริ่ม Water stress เมื่อระดับน้ำต่ำกว่า ~55% ' +
      'ถ้าไม่เติมน้ำ ใบจะตก เหี่ยว และเกิด Damage ถาวรเมื่อขาดน้ำนาน',
    apply(sim) {
      sim.setWaterLevelPct(65);
      sim.disturbance.leakLph = 1.5;
    },
  },
];

export const findScenario = (id: string): Scenario | undefined => SCENARIOS.find((s) => s.id === id);
