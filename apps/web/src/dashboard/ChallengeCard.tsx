import { Pause, Play, Wrench } from 'lucide-react';
import type { ChallengeView } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { sendCommand } from '../store/api';
import { formatHours } from '../lib/format';

// ค่าคงที่: selector ต้องคืน reference เดิมเมื่อไม่มีข้อมูล
const NONE: ChallengeView[] = [];

/** สถานะเหตุการณ์ที่ผู้เล่นเห็น — เวลาเทียบกับเวลาจำลองจาก Server */
export function challengeLine(c: ChallengeView, simTimeS: number): string {
  if (c.status === 'warned') return `อีก ${formatHours(c.startS - simTimeS)} ชม.`;
  if (c.status === 'active') return c.endS === null ? 'กำลังเกิด — กดซ่อม' : `เหลือ ${formatHours(c.endS - simTimeS)} ชม.`;
  return c.repaired ? 'ซ่อมแล้ว' : 'จบแล้ว';
}

/** การ์ดเหตุการณ์ (SPEC § 4.8) แสดงเมื่อมีเหตุการณ์ที่ถูกเตือนแล้ว */
export function ChallengeCard() {
  const challenges = useLabStore((s) => s.snapshot?.challenges ?? NONE);
  const simTimeS = useLabStore((s) => s.snapshot?.simTimeS ?? 0);
  const upcoming = challenges.filter((c) => c.status !== 'done');
  const last = challenges.filter((c) => c.status === 'done').at(-1);
  if (upcoming.length === 0 && !last) return null;

  return (
    <section className="hud-card challenge-card" aria-label="เหตุการณ์">
      <span className="mb-2 block text-xs font-semibold text-slate-500">⚠️ เหตุการณ์</span>
      <ul className="space-y-1.5">
        {upcoming.map((c) => (
          <li
            key={c.id}
            className={`rounded-lg px-2 py-1.5 text-xs ${c.status === 'active' ? 'bg-rose-50 text-rose-900' : 'bg-amber-50 text-amber-900'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <b>{c.title}</b>
              <span className="whitespace-nowrap">{challengeLine(c, simTimeS)}</span>
            </div>
            {c.kind === 'leak' && c.status === 'active' && (
              <button
                type="button"
                onClick={() => void sendCommand({ type: 'repairLeak' })}
                className="mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-rose-600 px-2 py-1 font-semibold text-white hover:bg-rose-700"
              >
                <Wrench size={13} /> ซ่อมถัง
              </button>
            )}
          </li>
        ))}
        {upcoming.length === 0 && last && (
          <li className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
            {last.title} · {challengeLine(last, simTimeS)}
          </li>
        )}
      </ul>
    </section>
  );
}

/** แถบ "ผู้ช่วยหยุดเกมให้" พร้อมปุ่มเล่นต่อ */
export function AutoPauseBanner() {
  const reason = useLabStore((s) => s.snapshot?.autoPause.reason ?? null);
  const paused = useLabStore((s) => s.snapshot?.paused ?? false);
  if (!reason || !paused) return null;
  return (
    <div role="status" className="autopause-banner">
      <Pause size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <b>ผู้ช่วยหยุดเกมให้:</b> {reason}
      </span>
      <button type="button" onClick={() => void sendCommand({ type: 'resume' })} className="autopause-resume">
        <Play size={14} /> เล่นต่อ
      </button>
    </div>
  );
}

/** สวิตช์ผู้ช่วยหยุดเกม (แสดงเฉพาะโหมดด่าน) */
export function AutoPauseToggle() {
  const enabled = useLabStore((s) => s.snapshot?.autoPause.enabled ?? true);
  const level = useLabStore((s) => s.snapshot?.level?.id ?? null);
  if (!level) return null;
  return (
    <button
      type="button"
      aria-pressed={enabled}
      title="หยุดเกมอัตโนมัติเมื่อมีคำเตือนเหตุการณ์หรือค่าเป็นสีแดงครั้งแรก"
      onClick={() => void sendCommand({ type: 'setAutoPause', enabled: !enabled })}
      className={`rounded-md border px-2 py-1 text-xs font-medium ${
        enabled ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500'
      }`}
    >
      ⏸ หยุดอัตโนมัติ: {enabled ? 'เปิด' : 'ปิด'}
    </button>
  );
}
