import type { HistorySample, LabSnapshot, LevelId, PlayerDevice } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { DEMO } from '../demo/mode';
import { sendCommand } from '../store/api';

/** ไอคอนการ์ดด่าน (ข้อมูลเป้า/เวลา/งบ/อุปกรณ์มาจาก Server ใน snapshot.levels) */
const LEVEL_ICON: Record<LevelId, string> = { L1: '🌱', L2: '🧪', L3: '🔥', L4: '🏆' };

const DEVICE_ICON: Record<PlayerDevice, string> = {
  led: '💡', refillPump: '🚰', nutrient: '🧪', fan: '🌀', humidifier: '🌫️', airPump: '🫧', phDown: '⚗️',
};

/** หน้าเลือกด่าน: การ์ด 4 ใบ + Free Play */
export function LevelSelect({ onDone }: { onDone: () => void }) {
  const levels = useLabStore((s) => s.snapshot?.levels);
  const current = useLabStore((s) => s.snapshot?.level?.id ?? 'free');
  const devUnlockAll = useLabStore((s) => s.snapshot?.devUnlockAll ?? false);
  const choose = async (levelId: LevelId | 'free') => {
    if (await sendCommand({ type: 'selectLevel', levelId })) onDone();
  };
  if (!levels) return <p className="p-6">กำลังรอข้อมูลด่าน…</p>;
  return (
    <div className="grid gap-3 p-5 sm:grid-cols-2">
      {devUnlockAll && (
        <p role="note" className="rounded-md bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 sm:col-span-2">
          {DEMO ? '🧪 Demo: ปลดล็อกทุกด่าน — Simulation รันในเบราว์เซอร์นี้ รีเฟรชหน้าแล้วเริ่มใหม่' : '🔓 โหมดผู้พัฒนา: ปลดล็อกทุกด่าน (npm run dev — ห้องเรียนใช้ npm run serve จะล็อกตามปกติ)'}
        </p>
      )}
      {levels.map((l) => {
        return (
          <button
            key={l.id}
            type="button"
            disabled={!l.unlocked}
            onClick={() => void choose(l.id)}
            className={`level-card ${current === l.id ? 'level-current' : ''}`}
          >
            <span className="text-3xl">{l.unlocked ? LEVEL_ICON[l.id] : '🔒'}</span>
            <span className="block text-base font-bold text-slate-800">ด่าน {l.id.slice(1)}: {l.title}</span>
            <span className="block text-xs text-slate-600">{l.description}</span>
            <span className="block text-xs text-slate-600">เป้า {l.targetG} g · {l.timeLimitDays} วัน · งบไฟ {l.energyBudgetKWh} kWh</span>
            <span className="block text-sm" aria-label="อุปกรณ์ที่คุม">{l.playerDevices.map((d) => DEVICE_ICON[d]).join(' ')}</span>
            <span className="mt-1 block text-lg">{l.unlocked ? '⭐'.repeat(l.bestStars) + '☆'.repeat(3 - l.bestStars) : 'ผ่านด่านก่อนหน้าเพื่อปลดล็อก'}</span>
          </button>
        );
      })}
      <button type="button" onClick={() => void choose('free')} className={`level-card sm:col-span-2 ${current === 'free' ? 'level-current' : ''}`}>
        <span className="text-2xl">🧑‍🔬</span>
        <span className="block text-base font-bold text-slate-800">Free Play — ห้องแล็บฝึก PLC</span>
        <span className="block text-xs text-slate-600">ไม่มีเวลาจำกัด ใช้แผงเดิมครบ เหมาะกับทดสอบ Ladder และ Scenario</span>
      </button>
    </div>
  );
}

/** โตเฉลี่ย +g ต่อต้นจาก History จุดแรกของรอบ */
export function averageGain(s: LabSnapshot, history: readonly HistorySample[]): number | null {
  const first = history[0];
  if (!first) return null;
  const dead = new Set(s.game.deadPlantIds);
  const alive = s.plants.filter((p) => !dead.has(p.id));
  if (!alive.length) return null;
  return alive.reduce((a, p) => a + p.biomassG, 0) / alive.length - first.avgBiomassG;
}

/** หน้าผ่านด่าน */
export function WinScreen({ onLevels, onClose }: { onLevels: () => void; onClose: () => void }) {
  const s = useLabStore((st) => st.snapshot);
  const history = useLabStore((st) => st.history);
  if (!s || s.game.status !== 'won') return null;
  const g = s.game;
  const dead = new Set(g.deadPlantIds);
  const gain = averageGain(s, history);
  const levels = s.levels;
  const idx = levels.findIndex((l) => l.id === s.level?.id);
  const next = idx >= 0 ? levels[idx + 1] : undefined;
  return (
    <div className="space-y-4 p-6">
      <div className="text-center">
        <p className="text-5xl">{'⭐'.repeat(g.stars)}{'☆'.repeat(3 - g.stars)}</p>
        <p className="mt-2 text-xl font-bold text-emerald-900">ผ่านด่าน{s.level ? ` ${s.level.id.slice(1)}` : ''}!</p>
        <p className="text-sm text-slate-600">
          คะแนน {g.score} (โบนัส +{g.harvestBonus}) · ผลผลิต {g.yieldG?.toFixed(0) ?? '—'} g · ใช้เวลา {(g.elapsedS / 86400).toFixed(1)} วัน
          {g.energyBudgetKWh !== null && ` · ไฟ ${g.energyKWh.toFixed(1)}/${g.energyBudgetKWh} kWh`}
        </p>
        {g.overflowL > 0 && <p className="mt-1 text-sm text-rose-700">💧 น้ำล้น {g.overflowL.toFixed(1)} L · ⚡ {g.overflowKWh.toFixed(3)} kWh · หักคะแนน −{g.overflowPenalty}</p>}
        {gain !== null && <p className="mt-1 text-sm font-semibold text-emerald-700">ผักโตขึ้นเฉลี่ย +{gain.toFixed(1)} g ต่อต้น</p>}
      </div>
      <ul className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
        {s.plants.map((p) => (
          <li key={p.id} className={`rounded-lg p-2 ${dead.has(p.id) ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-900'}`}>
            <span className="block">ต้น {p.id}</span>
            <b className="block text-sm">{dead.has(p.id) ? 'ตาย' : `${p.biomassG.toFixed(0)} g`}</b>
          </li>
        ))}
      </ul>
      <ul className="text-xs text-slate-600">
        <li>{'⭐'} ผ่านด่าน</li>
        <li>{g.stars >= 2 ? '⭐' : '☆'} ไม่มีผักตาย</li>
        <li>{g.stars >= 3 ? '⭐' : '☆'} สุขภาพเฉลี่ย ≥ 85% และไฟไม่เกินงบ</li>
      </ul>
      <div className="flex flex-wrap justify-center gap-3">
        {next?.unlocked && (
          <button type="button" className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white" onClick={async () => {
            if (await sendCommand({ type: 'selectLevel', levelId: next.id })) onClose();
          }}>
            ด่านถัดไป: {next.title} →
          </button>
        )}
        <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={async () => {
          if (await sendCommand({ type: 'reset' })) onClose();
        }}>
          เล่นซ้ำ
        </button>
        <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={onLevels}>
          เลือกด่าน
        </button>
      </div>
    </div>
  );
}
