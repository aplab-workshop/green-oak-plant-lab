import type { PlantState } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { plantVisuals } from '../scene/plantVisuals';

// พิกัด SVG: 1 cm = 10 หน่วย
const CM = 10;
const TANK_W = 500;
const PAD_X = 40;
const PAD_TOP = 150;

function PlantGlyph({ p, x, potY, selected, onSelect }: { p: PlantState; x: number; potY: number; selected: boolean; onSelect: () => void }) {
  const v = plantVisuals(p);
  const leafLen = 22 * Math.min(v.scale, 3.2);
  const n = Math.min(v.leafCount, 14);
  const rootLen = v.rootLengthCm * CM;
  const leaves = Array.from({ length: n }, (_, i) => {
    // ใบกระจายเป็นพัด มุมก้มลงตาม droop
    const spread = (i / Math.max(1, n - 1) - 0.5) * 2; // −1…1
    const upright = -90 + spread * 55;
    const angle = upright + spread * v.droop * 70 + (v.droop * 60 * (spread >= 0 ? 1 : -1));
    const len = leafLen * (0.75 + 0.25 * Math.cos(spread * 1.2)) * (v.wilted ? 0.85 : 1);
    return { angle, len };
  });

  return (
    <g onClick={onSelect} className="cursor-pointer">
      {/* Roots */}
      {[-6, -2, 2, 6].map((dx, i) => (
        <path
          key={i}
          d={`M ${x + dx * 0.5} ${potY} q ${dx * 1.5} ${rootLen * 0.5} ${dx} ${rootLen * (0.85 + (i % 2) * 0.15)}`}
          stroke="#d6c7a1"
          strokeWidth={1.5}
          fill="none"
        />
      ))}
      {/* Net pot */}
      <path d={`M ${x - 14} ${potY - 30} L ${x + 14} ${potY - 30} L ${x + 9} ${potY} L ${x - 9} ${potY} Z`} fill="#334155" opacity={0.85} />
      {/* Leaves */}
      {leaves.map((l, i) => (
        <ellipse
          key={i}
          cx={x + (Math.cos((l.angle * Math.PI) / 180) * l.len) / 2}
          cy={potY - 30 + (Math.sin((l.angle * Math.PI) / 180) * l.len) / 2}
          rx={l.len / 2}
          ry={Math.max(3, l.len / 6)}
          transform={`rotate(${l.angle} ${x + (Math.cos((l.angle * Math.PI) / 180) * l.len) / 2} ${potY - 30 + (Math.sin((l.angle * Math.PI) / 180) * l.len) / 2})`}
          fill={v.leafColor}
          stroke="#14532d"
          strokeOpacity={0.25}
        />
      ))}
      <text x={x} y={potY - 30 - leafLen - 12} textAnchor="middle" className="fill-slate-500" fontSize={12} fontWeight={selected ? 700 : 400}>
        {p.id}
      </text>
      {selected && <rect x={x - 30} y={potY - 40 - leafLen - 20} width={60} height={leafLen + 20 + 40 + rootLen} rx={6} fill="none" stroke="#059669" strokeDasharray="4 3" />}
    </g>
  );
}

/**
 * ภาพตัดขวางถัง DWC แบบ 2D — แสดงระดับน้ำเทียบกับปลายรากของแต่ละต้นตามสัดส่วนจริง
 */
export function TankCrossSection() {
  const snap = useLabStore((s) => s.snapshot);
  const selected = useLabStore((s) => s.selectedPlantId);
  const select = useLabStore((s) => s.setSelectedPlant);
  if (!snap) return <div className="flex h-full items-center justify-center text-sm text-slate-400">รอข้อมูลจาก Server…</div>;

  const { tank, plants, commands } = snap;
  const tankH = tank.heightCm * CM;
  const bottomY = PAD_TOP + tankH;
  const waterY = bottomY - tank.waterHeightCm * CM;
  const potY = bottomY - tank.potBottomCm * CM;
  const width = TANK_W + PAD_X * 2;
  const height = bottomY + 40;
  const gap = TANK_W / plants.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="DWC tank cross-section">
      {/* LED */}
      <rect x={PAD_X + 60} y={18} width={TANK_W - 120} height={10} rx={3} fill={commands.ledPct > 0 ? '#fde68a' : '#cbd5e1'} />
      {commands.ledPct > 0 && (
        <polygon
          points={`${PAD_X + 60},28 ${PAD_X + TANK_W - 60},28 ${PAD_X + TANK_W},${PAD_TOP - 10} ${PAD_X},${PAD_TOP - 10}`}
          fill="#fde68a"
          opacity={0.12 + (commands.ledPct / 100) * 0.25}
        />
      )}
      <text x={PAD_X + TANK_W / 2} y={14} textAnchor="middle" fontSize={11} className="fill-slate-500">
        LED {commands.ledPct}%
      </text>

      {/* Tank */}
      <rect x={PAD_X} y={PAD_TOP} width={TANK_W} height={tankH} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={2} />
      <rect x={PAD_X + 1} y={waterY} width={TANK_W - 2} height={Math.max(0, bottomY - waterY - 1)} fill="#38bdf8" opacity={0.35} />
      <line x1={PAD_X} x2={PAD_X + TANK_W} y1={waterY} y2={waterY} stroke="#0284c7" strokeWidth={2} />
      {/* Lid */}
      <rect x={PAD_X - 6} y={PAD_TOP - 8} width={TANK_W + 12} height={8} fill="#475569" />

      {/* Air bubbles */}
      {commands.airPump &&
        [0.15, 0.35, 0.55, 0.75, 0.9].map((fx, i) => (
          <circle key={i} cx={PAD_X + TANK_W * fx} cy={bottomY - 8 - (i % 3) * 14} r={3} fill="#e0f2fe" stroke="#7dd3fc" />
        ))}

      {plants.map((p, i) => (
        <PlantGlyph key={p.id} p={p} x={PAD_X + gap * (i + 0.5)} potY={potY} selected={p.id === selected} onSelect={() => select(p.id)} />
      ))}

      {/* Scale */}
      <text x={PAD_X + TANK_W + 6} y={waterY + 4} fontSize={12} className="fill-sky-700" fontWeight={600}>
        {Math.round(tank.waterLevelPct)}%
      </text>
      <text x={PAD_X - 6} y={potY + 4} fontSize={10} textAnchor="end" className="fill-slate-400">
        pot
      </text>
      <text x={PAD_X} y={height - 12} fontSize={11} className="fill-slate-500">
        {`Water ${tank.volumeL.toFixed(1)} / ${tank.capacityL} L · คลิกต้นเพื่อดูรายละเอียด`}
      </text>
      {commands.refillPump && (
        <text x={PAD_X + TANK_W} y={height - 12} fontSize={11} textAnchor="end" className="fill-sky-600" fontWeight={600}>
          Refill Pump ON ↓
        </text>
      )}
    </svg>
  );
}
