import { useState } from 'react';
import { useLabStore } from '../store/labStore';
import { DAILY_ROUTINE, DEVICE_LABEL, GOLDEN_RULES, IF_THEN, LEVEL_BRIEF, WATCH } from './guideContent';
import { DEVICE_RATIONALE, PLAYER_DEVICE_KEY } from './deviceRationale';
import type { PlayerDevice } from '@gol/shared';

/** สรุปภารกิจของด่านปัจจุบัน — ใช้ทั้งใน Briefing และแท็บแรกของคู่มือ */
export function LevelBriefing() {
  const level = useLabStore((s) => s.snapshot?.level);
  if (!level) return <div className="space-y-2 text-sm text-slate-700">
    <p className="font-semibold">Free Play — ฝึกเขียน Ladder / ทดลองอิสระ</p>
    <p>ไม่มีเวลาจำกัด ใช้ Scenario และโหมด Auto ได้ (รอบที่ใช้ Auto ไม่นับ Best) เลือกด่านจากเมนูด้านบนเพื่อเล่นแบบเกม</p>
  </div>;
  const brief = LEVEL_BRIEF[level.id];
  const locked = (['refillPump', 'nutrient', 'fan', 'humidifier', 'airPump'] as const).filter((d) => !level.playerDevices.includes(d));
  return <div className="space-y-4 text-sm text-slate-700">
    <div className="rounded-2xl bg-emerald-50 p-4">
      <p className="text-xs font-semibold tracking-wide text-emerald-700">ด่าน {level.id.slice(1)} · {level.title}</p>
      <p className="mt-1">{level.description}</p>
      <p className="mt-2 font-semibold text-emerald-900">🎯 ผักทุกต้นที่รอดหนักถึง {level.targetG} g ภายใน {level.timeLimitDays} วัน</p>
      <p className="text-xs text-slate-600">⚡ งบไฟ {level.energyBudgetKWh} kWh · ⭐ ผ่าน · ⭐⭐ ไม่มีผักตาย · ⭐⭐⭐ สุขภาพ ≥ 85% และไม่เกินงบไฟ</p>
    </div>
    <div>
      <p className="mb-1 font-semibold">🎮 อุปกรณ์ที่คุณคุม</p>
      <p className="flex flex-wrap gap-1.5">{level.playerDevices.map((d) => <span key={d} className="rounded-full bg-white px-2.5 py-1 text-xs ring-1 ring-emerald-200">{DEVICE_LABEL[d]}</span>)}</p>
      {locked.length > 0 && level.lockedMode === 'helper' && <p className="mt-1.5 text-xs text-slate-500">🔒 ผู้ช่วยฟาร์มดูแลให้: {locked.map((d) => DEVICE_LABEL[d]).join(' · ')}</p>}
      {level.lockedMode === 'off' && <p className="mt-1.5 text-xs text-slate-500">
        🔒 ปิดไว้ ไม่ใช้ในด่านนี้: {(['fan', 'humidifier', 'nutrient', 'phDown'] as const).filter((d) => !level.playerDevices.includes(d)).map((d) => DEVICE_LABEL[d]).join(' · ')}
        {!level.playerDevices.includes('airPump') && ` · ${DEVICE_LABEL.airPump} เปิดตลอด`}
      </p>}
    </div>
    <div>
      <p className="mb-1 font-semibold">✅ ต้องทำ</p>
      <ol className="list-decimal space-y-1 pl-5">{brief.todo.map((t) => <li key={t}>{t}</li>)}</ol>
    </div>
    <div className="rounded-2xl bg-amber-50 p-3">
      <p className="mb-1 font-semibold text-amber-800">⚠️ ระวัง</p>
      <ul className="list-disc space-y-1 pl-5 text-amber-900">{brief.careful.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  </div>;
}

const TABS = [
  { key: 'level', label: 'ด่านนี้' },
  { key: 'routine', label: 'ทำอะไรตอนไหน' },
  { key: 'ifthen', label: 'ถ้าเห็น → ทำ' },
  { key: 'watch', label: 'ค่าที่ต้องดู' },
  { key: 'devices', label: 'อุปกรณ์ทำอะไร' },
] as const;

const ALL_DEVICES: PlayerDevice[] = ['led', 'refillPump', 'nutrient', 'fan', 'humidifier', 'airPump', 'phDown'];

/** แท็บ "อุปกรณ์ทำอะไร": ปัญหา → ผลดี → ระวัง (SPEC § 4.17) */
function DeviceRationaleList() {
  const level = useLabStore((s) => s.snapshot?.level);
  return <div className="space-y-2 text-sm">
    <p className="text-xs text-slate-500">ทุกอุปกรณ์มีเหตุผล: เกิดปัญหาอะไร → ใช้อุปกรณ์ไหน → ได้ผลดีอะไร และต้องระวังอะไร</p>
    {ALL_DEVICES.map((d) => {
      const r = DEVICE_RATIONALE[PLAYER_DEVICE_KEY[d]];
      const locked = !!level && !level.playerDevices.includes(d);
      return <div key={d} className="rounded-xl bg-slate-50 px-3 py-2">
        <p className="font-semibold text-slate-800">{DEVICE_LABEL[d]}{locked && <span className="ml-2 text-xs font-normal text-slate-500">{level?.lockedMode === 'off' && d !== 'airPump' ? '🔒 ด่านนี้ปิดไว้ ไม่ใช้' : '🔒 ด่านนี้ผู้ช่วยฟาร์มดูแล'}</span>}</p>
        <p className="text-xs text-slate-700">🩺 <b>ปัญหา:</b> {r.problem}</p>
        <p className="text-xs text-emerald-800">✅ <b>ผลดี:</b> {r.benefit}</p>
        <p className="text-xs text-amber-800">⚠️ <b>ระวัง:</b> {r.caution}</p>
      </div>;
    })}
  </div>;
}

/** คู่มือในเกม (เมนู 📖) */
export function GuidePanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('level');
  return <div className="space-y-4 p-5">
    <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="หัวข้อคู่มือ">
      {TABS.map((t) => <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${tab === t.key ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}>{t.label}</button>)}
    </div>
    {tab === 'level' && <LevelBriefing />}
    {tab === 'routine' && <div className="space-y-4 text-sm text-slate-700">
      <div><p className="mb-1 font-semibold">📅 ทุกวันในเกม เช็คตามนี้</p>
        <ol className="space-y-1">{DAILY_ROUTINE.map((t) => <li key={t} className="rounded-lg bg-slate-50 px-3 py-1.5">{t}</li>)}</ol></div>
      <div className="rounded-2xl bg-amber-50 p-3"><p className="mb-1 font-semibold text-amber-800">⭐ กฎทอง</p>
        <ul className="list-disc space-y-1 pl-5 text-amber-900">{GOLDEN_RULES.map((t) => <li key={t}>{t}</li>)}</ul></div>
    </div>}
    {tab === 'ifthen' && <table className="w-full text-left text-sm">
      <thead><tr className="text-xs text-slate-500"><th className="py-1">ถ้าเห็น…</th><th>ทำแบบนี้</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{IF_THEN.map(([a, b]) => <tr key={a}><td className="py-1.5 pr-3">{a}</td><td className="font-medium text-emerald-800">{b}</td></tr>)}</tbody>
    </table>}
    {tab === 'devices' && <DeviceRationaleList />}
    {tab === 'watch' && <table className="w-full text-left text-sm">
      <thead><tr className="text-xs text-slate-500"><th className="py-1">ค่า</th><th>🟢 ช่วงที่ดี</th><th>ถ้าไม่ดี</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{WATCH.map(([a, b, c]) => <tr key={a}><td className="py-1.5 pr-2">{a}</td><td className="pr-2 font-mono text-xs font-semibold text-emerald-700">{b}</td><td className="text-xs text-slate-600">{c}</td></tr>)}</tbody>
    </table>}
  </div>;
}
