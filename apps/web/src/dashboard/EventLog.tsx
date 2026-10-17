import { ScrollText } from 'lucide-react';
import type { EventSeverity } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { formatSimTime } from '../lib/format';
import { Panel } from './Panel';
import { eventsForPlant } from './timeline';

const STYLE: Record<EventSeverity, string> = {
  info: 'border-l-slate-300',
  warning: 'border-l-amber-400 bg-amber-50/50',
  critical: 'border-l-rose-500 bg-rose-50/60',
};

export function EventLog() {
  const events = useLabStore((s) => s.events);
  const plantId = useLabStore((s) => s.selectedPlantId);
  const hours = useLabStore((s) => s.timelineHours);
  const endS = useLabStore((s) => s.snapshot?.simTimeS ?? 0);
  const recent = eventsForPlant(events, plantId, endS, hours).slice().reverse();
  return (
    <Panel title="Timeline" icon={<ScrollText className="h-3.5 w-3.5" />} right={<span className="text-[10px] text-slate-400">Plant {plantId} · {recent.length}</span>}>
      {recent.length === 0 ? (
        <p className="px-3 py-2 text-xs text-slate-400">ยังไม่มีเหตุการณ์ในช่วงที่เลือก</p>
      ) : (
        <ul className="space-y-0.5 p-1.5">
          {recent.map((e) => (
            <li key={e.id} className={`rounded-r border-l-2 px-2 py-1 text-xs ${STYLE[e.severity]}`}>
              <span className="mr-2 font-mono text-[10px] text-slate-400">{formatSimTime(e.simTimeS)}</span>
              <span className="text-slate-700">{e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
