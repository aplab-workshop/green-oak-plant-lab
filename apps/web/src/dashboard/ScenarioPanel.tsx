import { useState } from 'react';
import { FlaskRound } from 'lucide-react';
import { useLabStore } from '../store/labStore';
import { sendCommand } from '../store/api';
import { Panel } from './Panel';

export function ScenarioPanel() {
  const scenarios = useLabStore((s) => s.scenarios);
  const active = useLabStore((s) => s.snapshot?.scenario ?? null);
  const leak = useLabStore((s) => s.snapshot?.disturbance.leakLph ?? 0);
  const [choice, setChoice] = useState('');
  const selectedId = choice || scenarios[0]?.id || '';

  return (
    <Panel title="Scenario" icon={<FlaskRound className="h-3.5 w-3.5" />}>
      <div className="space-y-2 px-3 py-2 text-xs">
        {active ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
            <div className="font-semibold text-emerald-800">{active.title}</div>
            <p className="mt-1 text-slate-700">
              <b>Objective:</b> {active.objective}
            </p>
            <p className="mt-1 text-slate-600">{active.description}</p>
            {leak > 0 && <p className="mt-1 font-mono text-rose-700">Disturbance: leak {leak} L/h</p>}
          </div>
        ) : (
          <p className="text-slate-500">ยังไม่ได้เลือก Scenario — Simulation ทำงานในสภาวะปกติ</p>
        )}
        <div className="flex gap-1">
          <select
            value={selectedId}
            onChange={(e) => setChoice(e.target.value)}
            className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1"
            aria-label="เลือก Scenario"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedId}
            onClick={() => {
              if (window.confirm('เริ่ม Scenario จะ Reset Lab นี้ ดำเนินการต่อ?')) void sendCommand({ type: 'applyScenario', scenarioId: selectedId });
            }}
            className="rounded bg-emerald-600 px-2.5 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            Start
          </button>
          {active && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('ยกเลิก Scenario และ Reset Lab?')) void sendCommand({ type: 'clearScenario' });
              }}
              className="rounded border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}
