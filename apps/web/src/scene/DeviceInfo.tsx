import { X } from 'lucide-react';
import { SENSOR_REGISTERS, deviceName } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { fmt } from '../lib/format';
import { SENSOR_META } from '../dashboard/sensorMeta';
import { ACTUATOR_INFO, SENSOR_DEVICES } from './devices';
import { useSceneStore } from './sceneStore';

/** การ์ดข้อมูลอุปกรณ์ที่คลิกในฉาก 3D: สถานะ + Address ใน PLC */
export function DeviceInfo() {
  const device = useSceneStore((s) => s.selectedDevice);
  const close = () => useSceneStore.getState().selectDevice(null);
  const snap = useLabStore((s) => s.snapshot);
  if (!device || !snap) return null;

  let body;
  if (device.kind === 'actuator') {
    const info = ACTUATOR_INFO[device.key];
    const value = snap.commands[device.key];
    const on = typeof value === 'boolean' ? value : value > 0;
    body = (
      <>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] tracking-wide text-slate-500 uppercase">Actuator ← PLC</div>
            <div className="font-semibold text-slate-800">{info.label}</div>
          </div>
          <span className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {typeof value === 'boolean' ? (value ? 'ON' : 'OFF') : `${value}%`}
          </span>
        </div>
        <div className="mt-1 font-mono text-xs text-slate-600">
          PLC: <b>{info.address}</b> · {info.ratedPower}
        </div>
        <p className="mt-1 text-xs text-slate-600">{info.description}</p>
        {snap.failsafe && <p className="mt-1 text-xs font-medium text-rose-600">Fail-safe active: ไม่ได้ใช้คำสั่งจาก PLC</p>}
      </>
    );
  } else {
    const info = SENSOR_DEVICES[device.key];
    if (!info) return null;
    body = (
      <>
        <div className="text-[10px] tracking-wide text-slate-500 uppercase">Sensor → PLC</div>
        <div className="font-semibold text-slate-800">{info.label}</div>
        <ul className="mt-1 space-y-0.5">
          {info.keys.map((k) => {
            const reg = SENSOR_REGISTERS.find((r) => r.key === k)!;
            return (
              <li key={k} className="flex justify-between gap-3 text-xs">
                <span className="text-slate-600">
                  {reg.label} <span className="font-mono text-slate-400">{deviceName('D', reg.address)}</span>
                </span>
                <span className="font-mono font-semibold text-slate-800">
                  {fmt(snap.sensors[k], SENSOR_META[k].digits)} {reg.unit}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-1 text-xs text-slate-600">{info.description}</p>
      </>
    );
  }

  return (
    <div className="absolute top-12 left-2 z-10 w-72 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
      <button type="button" onClick={close} className="absolute top-1.5 right-1.5 rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="ปิด">
        <X className="h-4 w-4" />
      </button>
      {body}
    </div>
  );
}
