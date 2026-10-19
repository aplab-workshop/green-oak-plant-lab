import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface DrawerTab {
  key: string;
  label: string;
  content: ReactNode;
}

/**
 * ลิ้นชัก 🔬 "ข้อมูลนักวิทยาศาสตร์" — แผงเดิมทั้งหมดเป็นแท็บ (SPEC § 4.9)
 * ใช้ต่อในการสอน PLC ได้ครบ แต่ไม่รกหน้าเกม
 */
export function ScienceDrawer({
  tabs,
  tab,
  onTab,
  onClose,
}: {
  tabs: DrawerTab[];
  tab: string;
  onTab: (key: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const current = tabs.find((t) => t.key === tab) ?? tabs[0]!;
  return (
    <aside className="science-drawer" aria-label="ลิ้นชักข้อมูลนักวิทยาศาสตร์">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <b className="text-sm text-slate-800">🔬 ข้อมูลนักวิทยาศาสตร์</b>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100" aria-label="ปิดลิ้นชัก">
          <X size={18} />
        </button>
      </header>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-2 py-1.5" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === current.key}
            onClick={() => onTab(t.key)}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${
              t.key === current.key ? 'bg-emerald-100 text-emerald-800' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto" role="tabpanel">
        {current.content}
      </div>
    </aside>
  );
}
