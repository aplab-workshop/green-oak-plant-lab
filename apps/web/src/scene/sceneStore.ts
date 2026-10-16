import { create } from 'zustand';
import type { ActuatorKey, SensorKey } from '@gol/shared';

export type ViewMode = '3d' | '2d';
export type TankMode = 'transparent' | 'cutaway' | 'opaque';
export type SelectedDevice = { kind: 'actuator'; key: ActuatorKey } | { kind: 'sensor'; key: SensorKey };

interface ScenePrefs {
  view: ViewMode;
  showRoots: boolean;
  tankMode: TankMode;
  /** บรรยากาศกลางวัน/กลางคืนตามเวลาจำลอง */
  dayNight: boolean;
  lowGraphics: boolean;
}

interface SceneState extends ScenePrefs {
  selectedDevice: SelectedDevice | null;
  /** เพิ่มค่าเพื่อสั่งให้กล้องกลับตำแหน่งเริ่มต้น */
  cameraResetSeq: number;
  /** จุดที่กล้องจะซูมเข้าหา (ดับเบิลคลิกต้นผัก) */
  focus: { point: [number, number, number]; seq: number } | null;
  focusOn: (point: [number, number, number]) => void;
  set: (patch: Partial<ScenePrefs>) => void;
  selectDevice: (d: SelectedDevice | null) => void;
  resetCamera: () => void;
}

const STORAGE_KEY = 'gol.scenePrefs';
const DEFAULTS: ScenePrefs = { view: '3d', showRoots: true, tankMode: 'transparent', dayNight: true, lowGraphics: false };

/** อ่านค่าที่จำไว้ในเครื่อง (อาจใช้ไม่ได้ใน Private mode จึงต้อง try/catch) */
function loadPrefs(): ScenePrefs {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ScenePrefs>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function savePrefs(p: ScenePrefs): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ไม่จำค่าได้ก็ไม่เป็นไร
  }
}

export const useSceneStore = create<SceneState>((set, get) => ({
  ...loadPrefs(),
  selectedDevice: null,
  cameraResetSeq: 0,
  focus: null,
  focusOn: (point) => set((s) => ({ focus: { point, seq: (s.focus?.seq ?? 0) + 1 } })),
  set: (patch) => {
    set(patch);
    const { view, showRoots, tankMode, dayNight, lowGraphics } = get();
    savePrefs({ view, showRoots, tankMode, dayNight, lowGraphics });
  },
  selectDevice: (d) => set({ selectedDevice: d }),
  resetCamera: () => set((s) => ({ cameraResetSeq: s.cameraResetSeq + 1 })),
}));
