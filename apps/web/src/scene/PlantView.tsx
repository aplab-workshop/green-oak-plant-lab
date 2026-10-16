import { Component, Suspense, lazy, type ReactNode } from 'react';
import { TankCrossSection } from '../dashboard/TankCrossSection';
import { DeviceInfo } from './DeviceInfo';
import { SceneToolbar } from './SceneToolbar';
import { useSceneStore } from './sceneStore';

// แยก Three.js เป็น chunk ของตัวเอง โหลดเมื่อเปิดมุมมอง 3D
const Scene3D = lazy(() => import('./Scene3D'));

/** ถ้า WebGL ใช้ไม่ได้ (เครื่องเก่า/ปิด GPU) ให้แสดงภาพตัดขวาง 2D แทน */
class WebGLBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const CrossSection = () => (
  <div className="h-full p-2 pt-12">
    <TankCrossSection />
  </div>
);

export function PlantView() {
  const view = useSceneStore((s) => s.view);
  return (
    <div className="relative h-full min-h-[320px]">
      {view === '3d' ? (
        <WebGLBoundary
          fallback={
            <div className="h-full">
              <p className="px-3 pt-12 text-xs text-amber-700">เปิด 3D ไม่ได้บนเครื่องนี้ (WebGL) — แสดงภาพตัดขวาง 2D แทน</p>
              <CrossSection />
            </div>
          }
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
        <CrossSection />
      )}
      <SceneToolbar />
    </div>
  );
}
