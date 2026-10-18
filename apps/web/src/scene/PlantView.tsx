import { Component, Suspense, lazy, useState, type ReactNode } from 'react';
import { TankCrossSection } from '../dashboard/TankCrossSection';
import { DeviceInfo } from './DeviceInfo';
import { SceneToolbar } from './SceneToolbar';
import { useSceneStore } from './sceneStore';
import { useLabStore } from '../store/labStore';

// แยก Three.js เป็น chunk ของตัวเอง โหลดเมื่อเปิดมุมมอง 3D
const Scene3D = lazy(() => import('./Scene3D'));

/** ถ้า WebGL ใช้ไม่ได้ (เครื่องเก่า/ปิด GPU) ให้แสดงภาพตัดขวาง 2D แทน */
class WebGLBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onFailure();
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const CrossSection = ({ unavailable = false }: { unavailable?: boolean }) => (
  <div className="flex h-full flex-col p-2 pt-12">
    {unavailable && <p className="px-1 text-xs text-amber-700">เปิด 3D ไม่ได้บนเครื่องนี้ (WebGL) — แสดงภาพตัดขวาง 2D แทน</p>}
    <div className="min-h-0 flex-1"><TankCrossSection /></div>
  </div>
);

export function PlantView() {
  const overflowing = useLabStore((s) => !!s.snapshot?.commands.refillPump && (s.snapshot?.tank.overflowFlowLpm ?? 0) > 0);
  const view = useSceneStore((s) => s.view);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  return (
    <div className="relative h-full min-h-[320px]">
      {view === '3d' ? (
        <WebGLBoundary
          fallback={<CrossSection unavailable />}
          onFailure={() => {
            setWebglUnavailable(true);
            useSceneStore.getState().set({ view: '2d' });
          }}
        >
          <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400">กำลังโหลด 3D…</div>}>
            <Scene3D />
          </Suspense>
          <DeviceInfo />
          <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-white/80 px-2 py-0.5 text-[10px] text-slate-500">
            ลากเพื่อหมุน · Scroll เพื่อ Zoom · คลิกขวาลากเพื่อ Pan · คลิกต้นผักหรืออุปกรณ์เพื่อดูข้อมูล · ดับเบิลคลิกต้นผักเพื่อซูม
          </p>
        </WebGLBoundary>
      ) : (
        <CrossSection unavailable={webglUnavailable} />
      )}
      <SceneToolbar webglUnavailable={webglUnavailable} />
      {overflowing && <div role="status" className="pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 shadow">💧 น้ำล้น — ปิดปั๊มเติมน้ำ</div>}
    </div>
  );
}
