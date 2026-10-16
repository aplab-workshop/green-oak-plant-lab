import type { ReactNode } from 'react';

export function Panel({
  title,
  icon,
  right,
  children,
  className = '',
}: {
  title: string;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-600 uppercase">
          {icon}
          {title}
        </h2>
        {right}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}

/** แถบความคืบหน้า 0–1 */
export function Bar({ value, color = '#10b981' }: { value: number; color?: string }) {
  const w = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${w}%`, backgroundColor: color }} />
    </div>
  );
}
