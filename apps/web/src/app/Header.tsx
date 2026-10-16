import { Cpu, Leaf } from 'lucide-react';
import { useLabStore } from '../store/labStore';
import { selectLab } from '../store/wsClient';
import { ConnectionBadge } from './ConnectionBadge';

const labLabel = (id: string) => id.replace(/^lab/, 'Lab ');

function PlcBadge() {
  const plc = useLabStore((s) => s.snapshot?.plc);
  const failsafe = useLabStore((s) => s.snapshot?.failsafe ?? false);
  if (!plc) return null;
  const ok = plc.connection === 'connected' && !failsafe;
  const text = failsafe ? 'FAIL-SAFE' : plc.connection;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${
        ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      }`}
      title={plc.lastError ?? undefined}
    >
      <Cpu className="h-4 w-4" />
      <span>
        {plc.kind === 'mock' ? 'Mock PLC' : 'FX5U'}
        {plc.mode && ` · ${plc.mode}`} · <b>{text}</b>
      </span>
    </div>
  );
}

export function Header() {
  const labIds = useLabStore((s) => s.labIds);
  const labId = useLabStore((s) => s.labId);
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2">
      <div className="flex items-center gap-3">
        <Leaf className="h-5 w-5 text-emerald-600" />
        <h1 className="font-semibold text-slate-800">Green Oak Virtual Plant Lab</h1>
        {labIds.length > 1 ? (
          <select
            className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-sm"
            value={labId ?? ''}
            onChange={(e) => selectLab(e.target.value)}
            aria-label="เลือก Lab"
          >
            {labIds.map((id) => (
              <option key={id} value={id}>
                {labLabel(id)}
              </option>
            ))}
          </select>
        ) : (
          labId && <span className="rounded bg-slate-100 px-2 py-0.5 text-sm text-slate-600">{labLabel(labId)}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <PlcBadge />
        <ConnectionBadge />
      </div>
    </header>
  );
}
