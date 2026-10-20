import { useLabStore } from '../store/labStore';
import { growthMeter } from './growthModel';

/**
 * แถบ Growth 0 → 100 % สู่การเก็บเกี่ยว + อัตราโต (SPEC § 4.18)
 * ป้าย "+x.xx" ลอยขึ้นหนึ่งครั้งต่อชั่วโมงจำลอง (key = ชั่วโมงจำลอง) — Pause แล้วไม่เกิดใหม่
 */
export function GrowthMeter({ variant }: { variant: 'vertical' | 'compact' }) {
  const s = useLabStore((st) => st.snapshot);
  if (!s) return null;
  const g = growthMeter(s);
  if (!g) return null;
  const pct = Math.round(g.progress * 100);
  const rate = `+${g.rateGPerH.toFixed(2)}`;
  const float = s.game.status === 'playing' && !s.paused && (
    <span key={g.hourKey} className="growth-float" style={{ color: g.color }} aria-hidden>{rate}</span>
  );

  if (variant === 'compact') {
    return (
      <div className="hud-card growth-compact" role="meter" aria-label="Growth สู่การเก็บเกี่ยว" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span className="flex items-center justify-between text-xs font-semibold text-emerald-900">
          <span>🌱 Growth {g.ready ? '· เก็บเกี่ยวได้!' : ''}</span><span>{pct}%</span>
        </span>
        <span className="growth-compact-track"><span style={{ width: `${pct}%` }} /></span>
        <span className="relative mt-1 flex items-center justify-between text-[11px]">
          <b style={{ color: g.color }}>{rate} g/ชม.</b><span style={{ color: g.color }}>{g.label}</span>
          {float}
        </span>
      </div>
    );
  }

  return (
    <aside className="growth-meter-v" role="meter" aria-label="Growth สู่การเก็บเกี่ยว" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span className="text-2xl" aria-hidden>🌿</span>
      <span className="growth-title">Growth</span>
      <div className="growth-track">
        <div className="growth-fill" style={{ height: `${pct}%` }} />
        <span className="growth-pct" style={{ bottom: `calc(${Math.min(pct, 92)}% + 4px)` }}>{pct}%</span>
        <span className="growth-float-anchor" style={{ bottom: `${Math.min(pct, 90)}%` }}>{float}</span>
      </div>
      <span className="text-xl" aria-hidden>🌱</span>
      <b className="growth-rate" style={{ color: g.color }}>{rate}</b>
      <span className="text-[10px] text-slate-500">g/ชม.</span>
      <span className="growth-word" style={{ color: g.color }}>{g.ready ? 'เก็บเกี่ยวได้!' : g.label}</span>
    </aside>
  );
}
