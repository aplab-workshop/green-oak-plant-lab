import { create } from 'zustand';
import type { EventEntry, HistorySample, LabSnapshot, ScenarioInfo } from '@gol/shared';

const MAX_EVENTS = 300;

interface LabState {
  labIds: string[];
  labId: string | null;
  snapshot: LabSnapshot | null;
  events: EventEntry[];
  history: HistorySample[];
  scenarios: ScenarioInfo[];
  selectedPlantId: number;
  /** ข้อความ Error ล่าสุดจากการสั่งงาน */
  commandError: string | null;
  setSelectedPlant: (id: number) => void;
}

export const useLabStore = create<LabState>((set) => ({
  labIds: [],
  labId: null,
  snapshot: null,
  events: [],
  history: [],
  scenarios: [],
  selectedPlantId: 1,
  commandError: null,
  setSelectedPlant: (id) => set({ selectedPlantId: id }),
}));

/** เพิ่ม Event ใหม่ (ไม่ซ้ำ id) โดยเก็บล่าสุด MAX_EVENTS รายการ */
export function mergeEvents(current: EventEntry[], incoming: EventEntry[]): EventEntry[] {
  const seen = new Set(current.map((e) => e.id));
  const merged = [...current, ...incoming.filter((e) => !seen.has(e.id))].sort((a, b) => a.id - b.id);
  return merged.slice(-MAX_EVENTS);
}
