import { useMemo, useState } from 'react';
import { LineChart as LineIcon } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useLabStore } from '../store/labStore';
import { formatSimTime } from '../lib/format';
import { Panel } from './Panel';
import { historyForPlant } from './timeline';

interface Series {
  key: keyof ReturnType<typeof historyForPlant>[number];
  name: string;
  color: string;
  axis: 'left' | 'right';
}
interface ChartDef {
  id: string;
  label: string;
  left: [number, number] | ['auto', 'auto'];
  right?: [number, number] | ['auto', 'auto'];
  series: Series[];
}

const CHARTS: ChartDef[] = [
  { id: 'growth', label: 'Growth', left: ['auto', 'auto'], right: [0, 100], series: [
    { key: 'biomassG', name: 'Biomass g', color: '#059669', axis: 'left' },
    { key: 'health', name: 'Health', color: '#d97706', axis: 'right' },
  ] },
  { id: 'water', label: 'Water & Stress', left: [0, 100], series: [
    { key: 'waterLevelPct', name: 'Water level %', color: '#0284c7', axis: 'left' },
    { key: 'hydration', name: 'Hydration %', color: '#14b8a6', axis: 'left' },
    { key: 'waterStress', name: 'Water stress %', color: '#f59e0b', axis: 'left' },
  ] },
  { id: 'stress', label: 'Plant Stress', left: [0, 100], series: [
    { key: 'lightStress', name: 'Light %', color: '#ca8a04', axis: 'left' },
    { key: 'nutrientStress', name: 'Nutrient %', color: '#8b5cf6', axis: 'left' },
    { key: 'damage', name: 'Damage %', color: '#dc2626', axis: 'left' },
  ] },
  { id: 'root', label: 'Root & Oxygen', left: [0, 100], series: [
    { key: 'rootHealth', name: 'Root health %', color: '#059669', axis: 'left' },
    { key: 'estimatedOxygen', name: 'Estimated Oxygen %', color: '#0891b2', axis: 'left' },
  ] },
  { id: 'climate', label: 'Climate', left: ['auto', 'auto'], right: [0, 100], series: [
    { key: 'airTempC', name: 'Air °C', color: '#ef4444', axis: 'left' },
    { key: 'rhPct', name: 'RH %', color: '#6366f1', axis: 'right' },
  ] },
  { id: 'nutrient', label: 'EC / pH', left: ['auto', 'auto'], right: ['auto', 'auto'], series: [
    { key: 'ecMsCm', name: 'EC mS/cm', color: '#8b5cf6', axis: 'left' },
    { key: 'ph', name: 'pH', color: '#0f766e', axis: 'right' },
  ] },
];

export function TrendChart({ selectedChart, onChartChange }: { selectedChart?: string; onChartChange?: (id: string) => void } = {}) {
  const history = useLabStore((s) => s.history);
  const plantId = useLabStore((s) => s.selectedPlantId);
  const hours = useLabStore((s) => s.timelineHours);
  const setHours = useLabStore((s) => s.setTimelineHours);
  const endS = useLabStore((s) => s.snapshot?.simTimeS ?? 0);
  const [localChart, setLocalChart] = useState('growth');
  const chartId = selectedChart ?? localChart;
  const setChartId = onChartChange ?? setLocalChart;
  const chart = CHARTS.find((c) => c.id === chartId) ?? CHARTS[0]!;
  const data = useMemo(() => historyForPlant(history, plantId, endS, hours), [history, plantId, endS, hours]);
  const hasData = data.length >= 2 && data.some((row) => chart.series.some((s) => row[s.key] !== null));
  return (
    <Panel title={`Trends · Plant ${plantId}`} icon={<LineIcon className="h-3.5 w-3.5" />} right={
      <select aria-label="Chart" value={chartId} onChange={(e) => setChartId(e.target.value)}
        className="max-w-[145px] rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-700">
        {CHARTS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    }>
      <div className="flex h-full min-h-[200px] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-1 px-2 pt-1 text-[10px] text-slate-500">
          <label className="flex items-center gap-1">Timeline
            <select aria-label="Timeline range" value={hours} onChange={(e) => setHours(Number(e.target.value) as 6 | 24 | 336)}
              className="rounded border border-slate-200 bg-white px-1 py-0.5 text-slate-700">
              <option value={6}>6 h</option><option value={24}>24 h</option><option value={336}>14 days</option>
            </select>
          </label>
          <span>{data.length} samples · ทุก 10 นาทีจำลอง</span>
        </div>
        <div className="min-h-[160px] flex-1 px-1 pb-1">
          {!hasData ? <div className="flex h-full items-center justify-center px-3 text-center text-xs text-slate-400">
            ยังไม่มีข้อมูลเพียงพอในช่วงที่เลือก — เร่งเวลาเพื่อเก็บข้อมูลเพิ่ม
          </div> : <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']}
                tickFormatter={(t: number) => formatSimTime(t).replace('Day ', 'D')}
                tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={40} />
              <YAxis yAxisId="left" domain={chart.left} tick={{ fontSize: 10, fill: '#64748b' }} width={44} />
              {chart.right && <YAxis yAxisId="right" orientation="right" domain={chart.right} tick={{ fontSize: 10, fill: '#64748b' }} width={36} />}
              <Tooltip labelFormatter={(t) => formatSimTime(Number(t))}
                formatter={(v) => typeof v === 'number' ? v.toFixed(2) : String(v)}
                contentStyle={{ fontSize: 11, borderRadius: 6 }} isAnimationActive={false} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
              {chart.series.map((s) => <Line key={s.key} yAxisId={s.axis} type="linear" dataKey={s.key}
                name={s.name} stroke={s.color} strokeWidth={1.8} dot={false} connectNulls={false} isAnimationActive={false} />)}
            </LineChart>
          </ResponsiveContainer>}
        </div>
      </div>
    </Panel>
  );
}
