import { useState, type ReactNode } from 'react';
import { Html, useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { ACTUATOR_INFO, SENSOR_DEVICES } from './devices';
import { useSceneStore, type SelectedDevice } from './sceneStore';

const sameDevice = (a: SelectedDevice | null, b: SelectedDevice) => a?.kind === b.kind && a.key === b.key;

/** กลุ่ม Mesh ที่คลิกแล้วเลือกอุปกรณ์ พร้อมป้ายชื่อเมื่อชี้/เลือก */
export function Clickable({
  device,
  position,
  labelOffset = [0, 0.06, 0],
  children,
}: {
  device: SelectedDevice;
  position?: [number, number, number];
  labelOffset?: [number, number, number];
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const selected = useSceneStore((s) => sameDevice(s.selectedDevice, device));
  useCursor(hovered);
  const label = device.kind === 'actuator' ? ACTUATOR_INFO[device.key].label : (SENSOR_DEVICES[device.key]?.label ?? device.key);

  return (
    <group
      position={position}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        useSceneStore.getState().selectDevice(device);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {children}
      {(hovered || selected) && (
        <Html position={labelOffset} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap shadow ${
              selected ? 'bg-emerald-600 text-white' : 'bg-white/90 text-slate-700'
            }`}
          >
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}
