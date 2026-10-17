import type { ReactNode } from 'react';
import { Box, Gauge, Layers, Moon, Rows3, Sprout, Sun, Video } from 'lucide-react';
import { useSceneStore, type TankMode } from './sceneStore';

const TANK_LABEL: Record<TankMode, string> = { transparent: 'Transparent', cutaway: 'Cutaway', opaque: 'Opaque' };
const NEXT_TANK: Record<TankMode, TankMode> = { transparent: 'cutaway', cutaway: 'opaque', opaque: 'transparent' };

function Btn({ active, disabled, onClick, title, children }: { active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? 'bg-emerald-600 text-white' : 'bg-white/90 text-slate-700 hover:bg-white'
      }`}
    >
      {children}
    </button>
  );
}

export function SceneToolbar({ webglUnavailable = false }: { webglUnavailable?: boolean }) {
  const s = useSceneStore();
  const is3d = s.view === '3d';
  return (
    <div className="absolute top-2 right-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap justify-end gap-1 rounded-md bg-slate-900/10 p-1 backdrop-blur-sm">
      <Btn active={is3d} disabled={webglUnavailable} onClick={() => s.set({ view: '3d' })}
        title={webglUnavailable ? 'WebGL ใช้ไม่ได้ — โหลดหน้าใหม่เพื่อลองอีกครั้ง' : 'มุมมอง 3D'}>
        <Box className="h-3.5 w-3.5" /> 3D
      </Btn>
      <Btn active={!is3d} onClick={() => s.set({ view: '2d' })} title="ภาพตัดขวาง 2D (ระดับน้ำเทียบปลายราก)">
        <Rows3 className="h-3.5 w-3.5" /> 2D
      </Btn>
      {is3d && (
        <>
          <span className="mx-0.5 w-px bg-slate-300" />
          <Btn active={s.showRoots} onClick={() => s.set({ showRoots: !s.showRoots })} title="แสดง/ซ่อนราก">
            <Sprout className="h-3.5 w-3.5" /> Roots
          </Btn>
          <Btn onClick={() => s.set({ tankMode: NEXT_TANK[s.tankMode] })} title="เปลี่ยนการแสดงถัง: Transparent → Cutaway → Opaque">
            <Layers className="h-3.5 w-3.5" /> {TANK_LABEL[s.tankMode]}
          </Btn>
          <Btn active={s.dayNight} onClick={() => s.set({ dayNight: !s.dayNight })} title="บรรยากาศกลางวัน/กลางคืนตามเวลาจำลอง">
            {s.dayNight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />} Day/Night
          </Btn>
          <Btn active={s.lowGraphics} onClick={() => s.set({ lowGraphics: !s.lowGraphics })} title="Low Graphics Mode สำหรับคอมพิวเตอร์สเปกต่ำ">
            <Gauge className="h-3.5 w-3.5" /> Low
          </Btn>
          <Btn onClick={s.resetCamera} title="กล้องกลับตำแหน่งเริ่มต้น">
            <Video className="h-3.5 w-3.5" />
          </Btn>
        </>
      )}
    </div>
  );
}
