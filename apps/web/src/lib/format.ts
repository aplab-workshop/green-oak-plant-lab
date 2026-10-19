/** "Day 14 · 06:00" จากเวลาจำลอง (s) */
export function formatSimTime(simTimeS: number): string {
  const day = Math.floor(simTimeS / 86_400);
  const minute = Math.floor((simTimeS % 86_400) / 60);
  return `Day ${day} · ${formatClock(minute)}`;
}

/** "06:05" จากนาทีของวัน */
export function formatClock(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** แสดงตัวเลขตามจำนวนทศนิยม */
export const fmt = (v: number, digits = 1): string => (Number.isFinite(v) ? v.toFixed(digits) : '—');

/** 0–1 → "73%" */
export const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** เวลาโดสที่เหลือ (s จำลอง) → "1:40" */
export function formatDoseRemaining(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** วินาทีจำลอง → "5:30" (ชั่วโมง:นาที) สำหรับนับถอยหลังเหตุการณ์ */
export function formatHours(seconds: number): string {
  const m = Math.max(0, Math.ceil(seconds / 60));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}
