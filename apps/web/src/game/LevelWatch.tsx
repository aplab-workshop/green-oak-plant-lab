import type { SensorStatus } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { formatRemaining, watchDials, watchGoal, type WatchDial } from './watchModel';

const SWEEP = 120; // องศาจากด้านบนไปแต่ละข้าง → ส่วนโค้ง 240°
const STATUS_COLOR: Record<SensorStatus, string> = { ok: '#059669', warn: '#d97706', alarm: '#dc2626', neutral: '#64748b' };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

/** หน้าปัดกลม: แถบเหลือง = พอรับได้, เขียว = แนะนำ, เข็มชี้ค่าจาก Server */
function Dial({ d }: { d: WatchDial }) {
  const [lo, hi] = d.scale;
  const angle = (v: number) => -SWEEP + 2 * SWEEP * clamp01((v - lo) / (hi - lo));
  const c = 32, r = 24;
  const [nx, ny] = polar(c, c, r - 5, angle(d.value));
  const color = STATUS_COLOR[d.status];
  return (
    <div className="watch-dial" title={`${d.label}: ช่วงแนะนำ ${d.rangeText}`} role="meter" aria-label={d.label}
      aria-valuemin={lo} aria-valuemax={hi} aria-valuenow={Number(d.value.toFixed(2))}>
      <span className="watch-dial-label"><span aria-hidden>{d.icon}</span> {d.label}</span>
      <svg viewBox="0 0 64 54" width="64" height="54" aria-hidden>
        <path d={arc(c, c, r, -SWEEP, SWEEP)} stroke="#e2e8f0" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d={arc(c, c, r, angle(d.warn[0]), angle(d.warn[1]))} stroke="#fcd34d" strokeWidth="7" fill="none" />
        <path d={arc(c, c, r, angle(d.ok[0]), angle(d.ok[1]))} stroke="#34d399" strokeWidth="7" fill="none" />
        {d.status !== 'neutral' && <line x1={c} y1={c} x2={nx} y2={ny} stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />}
        <circle cx={c} cy={c} r="4" fill={d.status === 'neutral' ? '#94a3b8' : '#0f172a'} />
      </svg>
      <b className="watch-dial-value" style={{ color }}>{d.display}</b>
      <span className="watch-dial-range">{d.rangeText}</span>
    </div>
  );
}

/** แถบ "สิ่งที่ต้องดูของด่าน" ด้านบนของฉาก (SPEC § 4.14) — เฉพาะโหมดด่าน */
export function LevelWatch() {
  const s = useLabStore((st) => st.snapshot);
  if (!s?.level) return null;
  const goal = watchGoal(s)!;
  return (
    <section className="level-watch" aria-label="สิ่งที่ต้องดูของด่าน">
      <div className="watch-goal">
        <span className="watch-goal-title">🎯 เป้าหมาย {goal.targetG} g</span>
        <span className="text-[11px] text-slate-600">ต้นเล็กสุด <b>{goal.minG.toFixed(1)} g</b> · เริ่ม ~{goal.startG} g</span>
        <div className="watch-goal-bar"><div style={{ width: `${Math.round(goal.ratio * 100)}%` }} /></div>
        {goal.remainingS !== null && <span className="text-[11px] text-slate-600">⏳ เหลือ <b>{formatRemaining(goal.remainingS)}</b> / {goal.limitDays} วัน</span>}
      </div>
      {watchDials(s).map((d) => <Dial key={d.key} d={d} />)}
    </section>
  );
}
