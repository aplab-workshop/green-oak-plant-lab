import { create } from 'zustand';
import type { EventEntry, HistorySample, LabSnapshot, ScenarioInfo } from '@gol/shared';

const MAX_EVENTS = 1000;

export interface LabState {
  labIds: string[];
  labId: string | null;
  snapshot: LabSnapshot | null;
  events: EventEntry[];
  history: HistorySample[];
  scenarios: ScenarioInfo[];
  selectedPlantId: number;
  timelineHours: 6 | 24 | 336;
  /** เปลี่ยนทุกครั้งที่เลือก Lab เพื่อทิ้งคำตอบเก่าแม้สลับ A → B → A */
  viewRevision: number;
  /** ข้อความ Error ล่าสุดจากการสั่งงาน */
  commandError: string | null;
  setSelectedPlant: (id: number) => void;
  setTimelineHours: (hours: 6 | 24 | 336) => void;
}

export const useLabStore = create<LabState>((set) => ({
  labIds: [],
  labId: null,
  snapshot: null,
  events: [],
  history: [],
  scenarios: [],
  selectedPlantId: 1,
  timelineHours: 24,
  viewRevision: 0,
  commandError: null,
  setSelectedPlant: (id) => set({ selectedPlantId: id }),
  setTimelineHours: (timelineHours) => set({ timelineHours }),
}));

/** รับเฉพาะ Lab/รอบปัจจุบัน และล้างข้อมูลทันทีเมื่อ Server Reset */
export function acceptSnapshot(snapshot: LabSnapshot): boolean {
  const current = useLabStore.getState();
  if (snapshot.labId !== current.labId) return false;
  const prev = current.snapshot;
  if (prev && (snapshot.runId < prev.runId || (snapshot.runId === prev.runId && snapshot.at < prev.at))) return false;
  const newRun = !prev || prev.runId !== snapshot.runId;
  useLabStore.setState({ snapshot, ...(newRun ? { history: [], events: [], commandError: null } : {}) });
  return true;
}

export function acceptEvent(labId: string, event: EventEntry): void {
  const s = useLabStore.getState();
  if (s.labId === labId && s.snapshot?.runId === event.runId) {
    useLabStore.setState({ events: mergeEvents(s.events, [event]) });
  }
}

/** เพิ่ม Event ใหม่ (ไม่ซ้ำ id) โดยเก็บล่าสุด MAX_EVENTS รายการ */
export function mergeEvents(current: EventEntry[], incoming: EventEntry[]): EventEntry[] {
  const seen = new Set(current.map((e) => e.id));
  const merged = [...current, ...incoming.filter((e) => !seen.has(e.id))].sort((a, b) => a.id - b.id);
  return merged.slice(-MAX_EVENTS);
}
