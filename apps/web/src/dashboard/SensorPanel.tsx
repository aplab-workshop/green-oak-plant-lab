import { Gauge } from 'lucide-react';
import { SENSOR_REGISTERS, deviceName } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { fmt } from '../lib/format';
import { Panel } from './Panel';
import { SENSOR_META, sensorStatus, type SensorStatus } from './sensorMeta';

const DOT: Record<SensorStatus, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  alarm: 'bg-rose-500',
  neutral: 'bg-slate-300',
};

export function SensorPanel() {
  const sensors = useLabStore((s) => s.snapshot?.sensors);
  return (
    <Panel title="Sensors → PLC" icon={<Gauge className="h-3.5 w-3.5" />}>
      <ul className="divide-y divide-slate-100">
        {SENSOR_REGISTERS.map((reg) => {
          const meta = SENSOR_META[reg.key];
          const value = sensors?.[reg.key];
          const status = value === undefined ? 'neutral' : sensorStatus(reg.key, value);
          return (
            <li key={reg.key} className="flex items-center gap-2 px-3 py-1.5" title={meta.hint}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[status]}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-slate-500">
                  {reg.label}
                  {meta.estimated && <span className="ml-1 text-[10px] text-amber-600">(est.)</span>}
                </div>
                <div className="font-mono text-[10px] text-slate-400">{deviceName('D', reg.address)}</div>
              </div>
              <div className="text-right">
                <span className="font-mono text-base font-semibold text-slate-800 tabular-nums">
                  {value === undefined ? '—' : fmt(value, meta.digits)}
                </span>
                <span className="ml-1 text-xs text-slate-500">{reg.unit}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
