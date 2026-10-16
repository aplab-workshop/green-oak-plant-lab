import { useState } from 'react';
import { LineChart as LineIcon } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HistorySample } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { formatSimTime } from '../lib/format';
import { Panel } from './Panel';

interface Series {
  key: keyof HistorySample;
  name: string;
  color: string;
  axis: 'left' | 'right';
  scale?: number;
}

interface ChartDef {
  id: string;
  label: string;
  left: [number, number] | ['auto', 'auto'];
  right?: [number, number] | ['auto', 'auto'];
  series: Series[];
}

const CHARTS: ChartDef[] = [
  {
    id: 'water',
    label: 'Water & Stress',
    left: [0, 100],
    series: [
      { key: 'waterLevelPct', name: 'Water level %', color: '#0284c7', axis: 'left' },
      { key: 'avgHydration', name: 'Hydration %', color: '#14b8a6', axis: 'left', scale: 100 },
      { key: 'avgWaterStress', name: 'Water stress %', color: '#f59e0b', axis: 'left', scale: 100 },
    ],
  },
  {
    id: 'climate',
    label: 'Climate',
    left: ['auto', 'auto'],
    right: [0, 100],
    series: [
      { key: 'airTempC', name: 'Air °C', color: '#ef4444', axis: 'left' },
      { key: 'rhPct', name: 'RH %', color: '#6366f1', axis: 'right' },
    ],
  },
  {
    id: 'growth',
    label: 'Growth',
    left: ['auto', 'auto'],
    right: [0, 100],
    series: [
      { key: 'avgBiomassG', name: 'Biomass g', color: '#059669', axis: 'left' },
      { key: 'avgHealth', name: 'Health', color: '#d97706', axis: 'right' },
    ],
  },
  {
    id: 'nutrient',
    label: 'EC / pH',
    left: ['auto', 'auto'],
    right: ['auto', 'auto'],
    series: [
      { key: 'ecMsCm', name: 'EC mS/cm', color: '#8b5cf6', axis: 'left' },
      { key: 'ph', name: 'pH', color: '#0f766e', axis: 'right' },
    ],
  },
];

export function TrendChart() {
  const history = useLabStore((s) => s.history);
  const [chartId, setChartId] = useState('water');
  const chart = CHARTS.find((c) => c.id === chartId) ?? CHARTS[0]!;
  const data = history.map((h) => {
    const row: Record<string, number> = { t: h.simTimeS };
    for (const s of chart.series) row[s.key] = Number(((h[s.key] as number) * (s.scale ?? 1)).toFixed(3));
    return row;
  });

  const tabs = (
    <div className="flex gap-1">
      {CHARTS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setChartId(c.id)}
          className={`rounded px-2 py-0.5 text-[11px] font-medium ${
            c.id === chartId ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );

  return (
    <Panel title="Trends" icon={<LineIcon className="h-3.5 w-3.5" />} right={tabs}>
      <div className="h-full min-h-[160px] px-1 py-1">
        {data.length < 2 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            เก็บข้อมูลทุก 10 นาทีจำลอง — เร่งเวลาเพื่อดูกราฟเร็วขึ้น
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t: number) => formatSimTime(t).replace('Day ', 'D')}
                tick={{ fontSize: 10, fill: '#64748b' }}
                minTickGap={40}
              />
              <YAxis yAxisId="left" domain={chart.left} tick={{ fontSize: 10, fill: '#64748b' }} width={44} />
              {chart.right && (
                <YAxis yAxisId="right" orientation="right" domain={chart.right} tick={{ fontSize: 10, fill: '#64748b' }} width={36} />
              )}
              <Tooltip
                labelFormatter={(t) => formatSimTime(Number(t))}
                contentStyle={{ fontSize: 11, borderRadius: 6 }}
                isAnimationActive={false}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
              {chart.series.map((s) => (
                <Line
                  key={s.key}
                  yAxisId={s.axis}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={1.8}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}
