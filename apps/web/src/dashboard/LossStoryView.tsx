import { useMemo } from 'react';
import { useLabStore } from '../store/labStore';
import { CAUSE_LABEL, buildLossStory } from './lossStory';

/** เรื่องเล่าตอน Game Over: เกิดอะไรขึ้นทีละช่วง สาเหตุหลัก และครั้งหน้าควรทำอะไร */
export function LossStoryView() {
  const snap = useLabStore((s) => s.snapshot);
  const events = useLabStore((s) => s.events);
  const history = useLabStore((s) => s.history);
  const story = useMemo(() => snap ? buildLossStory(snap.game, snap.plants, events, history) : null, [snap?.game, snap?.plants, events, history]);
  if (!snap || !story) return null;
  const { game } = snap;
  return <div className="space-y-4 text-left text-sm text-slate-700">
    <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-emerald-900">🌱 {story.intro}</p>
    <ol className="relative space-y-2 border-l-2 border-rose-100 pl-5">
      {story.lines.map((l, i) => <li key={i} className="relative">
        <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs ring-2 ring-rose-100">{l.icon}</span>
        <span className="block text-[11px] font-semibold text-slate-400">{l.when}</span>
        <span>{l.text}</span>
      </li>)}
    </ol>
    <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-rose-900">{story.ending}</p>
    {story.causes.length > 0 && <div>
      <p className="mb-1.5 font-semibold">🔍 สาเหตุหลัก</p>
      <p className="flex flex-wrap gap-1.5">{story.causes.map((c) => <span key={c.cause} className="rounded-full bg-white px-3 py-1 text-xs ring-1 ring-rose-200">
        {CAUSE_LABEL[c.cause]} · {c.plants}/{game.totalPlants} ต้น</span>)}</p>
    </div>}
    {story.tips.length > 0 && <div className="rounded-2xl bg-amber-50 p-3">
      <p className="mb-1 font-semibold text-amber-800">💡 ครั้งหน้าลองแบบนี้</p>
      <ul className="list-disc space-y-1 pl-5 text-amber-900">{story.tips.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>}
    <p className="text-center text-xs text-slate-500">คะแนนสุดท้าย {game.score} · ดูแลมา {(game.elapsedS / 86_400).toFixed(1)} วัน</p>
  </div>;
}
