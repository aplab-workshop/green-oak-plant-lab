import type { EventSeverity } from '@gol/shared';

/** เหตุการณ์ที่ Simulation ตรวจพบ (FR-43) — ใช้ใน Event Log */
export interface SimEvent {
  simTimeS: number;
  kind:
    | 'game.over'
    | 'game.won'
    | 'plant.died'
    | 'plant.water_stress'
    | 'plant.water_stress_cleared'
    | `plant.${'light' | 'nutrient' | 'root'}_stress`
    | `plant.${'light' | 'nutrient' | 'root'}_stress_cleared`
    | 'plant.wilting'
    | 'plant.damage'
    | 'tank.roots_exposed'
    | 'tank.roots_covered'
    | 'tank.overflow'
    | 'tank.empty'
    | 'challenge.warning'
    | 'challenge.start'
    | 'challenge.end';
  severity: EventSeverity;
  plantId?: number;
  /** ข้อความภาษาไทย ศัพท์เทคนิคภาษาอังกฤษ */
  message: string;
}
