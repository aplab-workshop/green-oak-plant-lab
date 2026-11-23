import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Native dialog จัดการ Focus trap และ Escape; ปิดแล้วคืน Focus ให้ปุ่มเดิม */
export function DetailDialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => { dialog.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  return <dialog ref={ref} className="detail-dialog" aria-label={title} onCancel={close}
    onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
    <div className="detail-shell">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <button autoFocus className="rounded-full p-2 hover:bg-slate-100" aria-label="ปิดรายละเอียด" onClick={close}><X size={20} /></button>
      </header>
      <div className="detail-content">{children}</div>
    </div>
  </dialog>;
}
