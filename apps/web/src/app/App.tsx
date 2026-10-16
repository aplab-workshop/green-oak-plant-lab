import { Leaf } from 'lucide-react';
import { ConnectionBadge } from './ConnectionBadge';
import { ScaffoldScene } from '../scene/ScaffoldScene';

export function App() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <Leaf className="h-5 w-5 text-emerald-600" />
          <h1 className="font-semibold text-slate-800">Green Oak Virtual Plant Lab</h1>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">P1 Scaffold</span>
        </div>
        <ConnectionBadge />
      </header>
      <main className="relative flex-1">
        <ScaffoldScene />
        <p className="pointer-events-none absolute bottom-3 left-3 rounded bg-white/80 px-2 py-1 text-xs text-slate-500">
          ฉากทดสอบระบบ 3D — จะถูกแทนด้วย DWC Scene ใน P6
        </p>
      </main>
    </div>
  );
}
