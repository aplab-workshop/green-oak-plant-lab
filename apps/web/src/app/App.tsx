import type { ReactNode } from 'react';
import { Box } from 'lucide-react';
import { Header } from './Header';
import { SensorPanel } from '../dashboard/SensorPanel';
import { ActuatorPanel } from '../dashboard/ActuatorPanel';
import { PlantDetail } from '../dashboard/PlantDetail';
import { SimControls } from '../dashboard/SimControls';
import { ScenarioPanel } from '../dashboard/ScenarioPanel';
import { TrendChart } from '../dashboard/TrendChart';
import { EventLog } from '../dashboard/EventLog';
import { PlantView } from '../scene/PlantView';
import { Panel } from '../dashboard/Panel';

const Cell = ({ className = '', children }: { className?: string; children: ReactNode }) => (
  // จอแคบ: ซ้อนแนวตั้งและเลื่อนทั้งหน้า (ไม่หด) / จอกว้าง (lg): Grid เต็มจอ
  <div className={`flex shrink-0 flex-col gap-2 lg:min-h-0 lg:shrink ${className}`}>{children}</div>
);

/**
 * Student Dashboard (FR-50)
 *   Header / Left: Sensors + Scenario / Center: Plant view + Trends + Log / Right: Actuators + Plant health
 */
export function App() {
  return (
    <div className="flex h-full flex-col">
      <Header />
      <main className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2 lg:grid lg:grid-cols-[250px_minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)_250px] lg:overflow-hidden">
        <Cell className="lg:row-span-1">
          <SensorPanel />
        </Cell>

        <Cell className="min-h-[420px] lg:min-h-0">
          <Panel title="Plant View" icon={<Box className="h-3.5 w-3.5" />} right={<SimControls />} className="flex-1">
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1">
                <PlantView />
              </div>
              <p className="border-t border-slate-100 px-3 py-1 text-[10px] text-slate-400">
                Educational Simulation — แบบจำลองเพื่อการเรียนการสอน ไม่ใช่โมเดลทำนายชีววิทยาที่ผ่านการตรวจสอบความแม่นยำ
              </p>
            </div>
          </Panel>
        </Cell>

        <Cell className="lg:row-span-2">
          <div className="flex min-h-0 flex-col lg:max-h-[52%]">
            <ActuatorPanel />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <PlantDetail />
          </div>
        </Cell>

        <Cell>
          <ScenarioPanel />
        </Cell>

        <Cell className="min-h-[250px] lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <TrendChart />
          <EventLog />
        </Cell>
      </main>
    </div>
  );
}
