import { Sprout } from 'lucide-react';
import type { PlantState } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { fmt, pct } from '../lib/format';
import { healthColor } from '../scene/plantVisuals';
import { Bar, Panel } from './Panel';

const STAGE_LABEL: Record<PlantState['stage'], string> = {
  seedling: 'Seedling (ต้นกล้า)',
  vegetative: 'Vegetative (กำลังโต)',
  harvest: 'Harvest-ready (พร้อมเก็บ)',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-800 tabular-nums">{value}</span>
    </div>
  );
}

function Meter({ label, value, color, hint }: { label: string; value: number; color: string; hint?: string }) {
  return (
    <div title={hint}>
      <div className="mb-0.5 flex justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-mono text-slate-800">{pct(value)}</span>
      </div>
      <Bar value={value} color={color} />
    </div>
  );
}

// ค่าคงที่: selector ต้องคืน reference เดิมเมื่อไม่มีข้อมูล ไม่งั้น React render วนไม่รู้จบ
const NO_PLANTS: PlantState[] = [];

export function PlantSelector() {
  const plants = useLabStore((s) => s.snapshot?.plants ?? NO_PLANTS);
  const selected = useLabStore((s) => s.selectedPlantId);
  const select = useLabStore((s) => s.setSelectedPlant);
  return (
    <div className="flex flex-wrap justify-end gap-0.5">
      {plants.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => select(p.id)}
          title={`Plant ${p.id}: Health ${Math.round(p.health)}`}
          className={`flex h-6 w-6 items-center justify-center rounded border text-[11px] font-semibold ${
            p.id === selected ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'
          }`}
          style={{ boxShadow: `inset 0 -3px 0 ${healthColor(p.health)}` }}
        >
          {p.id}
        </button>
      ))}
    </div>
  );
}

export function PlantDetail() {
  const plants = useLabStore((s) => s.snapshot?.plants);
  const selected = useLabStore((s) => s.selectedPlantId);
  const p = plants?.find((x) => x.id === selected) ?? plants?.[0];

  return (
    <Panel title="Plant" icon={<Sprout className="h-3.5 w-3.5" />} right={<PlantSelector />}>
      {p && (
        <div className="space-y-2 px-3 py-2">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-800">Plant {p.id}</div>
              <div className="text-[11px] text-slate-500">{STAGE_LABEL[p.stage]}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl font-bold" style={{ color: healthColor(p.health) }}>
                {Math.round(p.health)}
              </div>
              <div className="text-[10px] text-slate-500">Health score</div>
            </div>
          </div>

          <Meter label="Hydration" value={p.hydration} color="#0ea5e9" hint="ปริมาณน้ำในต้น 100% = เต็มที่" />
          <Meter label="Water stress" value={p.waterStress} color="#f59e0b" hint="ความเครียดจากการขาดน้ำ ลดลงได้เมื่อได้น้ำกลับมา" />
          <Meter label="Accumulated damage" value={p.damage} color="#dc2626" hint="ความเสียหายถาวร ไม่ลดลง" />
          <Meter label="Roots in water" value={p.rootSubmerged} color="#14b8a6" hint="สัดส่วนความยาวรากที่แช่น้ำ" />

          <div className="space-y-0.5 border-t border-slate-100 pt-2">
            <Row label="Age" value={`${fmt(p.ageDays, 1)} days`} />
            <Row label="Biomass (est.)" value={`${fmt(p.biomassG, 1)} g`} />
            <Row label="Leaf count / area" value={`${p.leafCount} · ${fmt(p.leafAreaCm2, 0)} cm²`} />
            <Row label="Root length" value={`${fmt(p.rootLengthCm, 1)} cm`} />
            <Row label="PPFD at plant" value={`${fmt(p.ppfd, 0)} µmol/m²/s`} />
            <Row label="DLI today / yesterday" value={`${fmt(p.dliToday, 1)} / ${fmt(p.dliYesterday, 1)}`} />
            <Row label="Water demand" value={`${fmt(p.demandLPerDay, 2)} L/day`} />
          </div>
          <p className="text-[10px] leading-snug text-slate-400">Light / Nutrient / Root stress จะเพิ่มใน Milestone 2</p>
        </div>
      )}
    </Panel>
  );
}
