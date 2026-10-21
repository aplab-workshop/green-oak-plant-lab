import { Clock, Pause, Play, RotateCcw, Sprout } from 'lucide-react';
import { uiSpeeds } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { sendCommand } from '../store/api';
import { formatClock } from '../lib/format';

/** คำอธิบายปุ่ม Speed (P40; ปุ่มกลางตามด่าน P42) */
const speedHint = (v: number): string =>
  v === 1 ? '1x — เริ่มเกม / หยุดปรับสภาพแวดล้อม (เวลาจริง)'
    : v === 1440 ? '1440x — สำหรับทดสอบ (1 วันจำลอง ≈ 1 นาทีจริง)'
    : `${v}x — เล่นปกติ (1 วันจำลอง ≈ ${1440 / v} นาทีจริง)`;

export function SimControls() {
  const snap = useLabStore((s) => s.snapshot);
  if (!snap) return null;
  const { sim, speed, paused, plc, game, level } = snap;
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
        {uiSpeeds(level).map((v) => (
          <button
            key={v}
            type="button"
            title={speedHint(v)}
            onClick={() => void sendCommand({ type: 'setSpeed', speed: v as 1 | 144 | 720 | 1440 })}
            className={`rounded px-2.5 py-1 font-mono text-xs font-semibold ${
              speed === v ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {v}x{v === 1440 && <span className="ml-1 font-sans text-[10px] font-normal text-slate-500">ทดสอบ</span>}
          </button>
        ))}
      </div>

      {game.status === 'ready' ? <button
        type="button"
        onClick={() => void sendCommand({ type: 'startGame' })}
        className="flex items-center gap-1 rounded-md bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
      >
        <Sprout className="h-3.5 w-3.5" /> เริ่มปลูก
      </button> : <button
        type="button"
        disabled={game.status === 'won'}
        onClick={() => void sendCommand({ type: paused ? 'resume' : 'pause' })}
        className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
      >
        {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        {paused ? 'Resume' : 'Pause'}
      </button>}

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
