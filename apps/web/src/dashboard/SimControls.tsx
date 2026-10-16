import { Clock, Pause, Play, RotateCcw } from 'lucide-react';
import { SPEED_VALUES } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { sendCommand } from '../store/api';
import { formatClock } from '../lib/format';

export function SimControls() {
  const snap = useLabStore((s) => s.snapshot);
  if (!snap) return null;
  const { sim, speed, paused, plc } = snap;
  const timerWarning = speed > 1 && plc.kind === 'slmp';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-slate-500" />
        <div>
          <div className="font-mono text-lg leading-tight font-semibold text-slate-800">
            Day {sim.day} · {formatClock(sim.minuteOfDay)}
          </div>
          <div className="text-[10px] text-slate-500">Simulated time {paused && '· PAUSED'}</div>
        </div>
      </div>

      <div className="flex rounded-md bg-slate-100 p-0.5" role="group" aria-label="Simulation speed">
        {SPEED_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => void sendCommand({ type: 'setSpeed', speed: v })}
            className={`rounded px-2.5 py-1 font-mono text-xs font-semibold ${
              speed === v ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {v}x
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void sendCommand({ type: paused ? 'resume' : 'pause' })}
        className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        {paused ? 'Resume' : 'Pause'}
      </button>

      <button
        type="button"
        onClick={() => {
          if (window.confirm('Reset Lab นี้กลับสู่สภาวะเริ่มต้น? (ไม่กระทบ Lab อื่น)')) void sendCommand({ type: 'reset' });
        }}
        className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </button>

      {timerWarning && (
        <span className="text-[11px] text-amber-700">⚠ เร่งเวลาขณะต่อ PLC จริง: Timer ใน PLC ยังนับตามเวลาจริง</span>
      )}
    </div>
  );
}
