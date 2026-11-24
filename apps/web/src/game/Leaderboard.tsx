import { useEffect, useState } from 'react';
import type { Leaderboard as Board, LeaderboardRow, LeaderboardScope, MyLevelScore } from '@gol/shared';
import { useLabStore } from '../store/labStore';
import { fetchLeaderboard } from '../store/scoreStore';

/** W6 / SPEC § 4.43: ตารางอันดับรายด่าน — แท็บด่าน + ตัวกรอง ทุกคน / กลุ่มของฉัน */

const FALLBACK_LEVELS = ['L1', 'L2', 'L3', 'L4'];

const minSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** ข้อความ "ดีที่สุดของฉัน" ของการ์ดด่าน */
export function myBestText(score: MyLevelScore | undefined): string {
  if (!score || score.bestScore === null) return score?.rounds ? `☁️ ส่งแล้ว ${score.rounds} รอบ · ยังไม่มีรอบชนะที่นับ` : '☁️ ยังไม่มีคะแนนบน Server';
  return `☁️ ดีที่สุดของฉัน ${score.bestScore} ${'⭐'.repeat(score.bestStars ?? 0)} · ชนะ ${score.wins}/${score.rounds} รอบ`;
}

function Row({ r }: { r: LeaderboardRow }) {
  return (
    <tr className={r.me ? 'bg-emerald-50 font-semibold text-emerald-900' : ''}>
      <td className="px-2 py-1.5 text-right tabular-nums">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</td>
      <td className="px-2 py-1.5">{r.username}{r.me && ' (ฉัน)'}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{r.score}</td>
      <td className="px-2 py-1.5">{'⭐'.repeat(r.stars)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{r.yieldG.toFixed(0)} g</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{minSec(r.realSeconds)}</td>
    </tr>
  );
}

export function LeaderboardPanel({ initialLevel }: { initialLevel?: string }) {
  const levelIds = useLabStore((s) => s.snapshot?.levels.map((l) => l.id).join(',') ?? '');
  const levels = levelIds ? levelIds.split(',') : FALLBACK_LEVELS;
  const [level, setLevel] = useState(initialLevel && levels.includes(initialLevel) ? initialLevel : levels[0]!);
  const [scope, setScope] = useState<LeaderboardScope>('all');
  const [board, setBoard] = useState<Board | null | 'loading'>('loading');

  useEffect(() => {
    let live = true;
    setBoard('loading');
    void fetchLeaderboard(level, scope).then((b) => live && setBoard(b));
    return () => {
      live = false;
    };
  }, [level, scope]);

  return (
    <section className="flex flex-col gap-3 p-4" aria-label="ตารางอันดับ">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="auth-tabs" aria-label="ด่าน">
          {levels.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={level === id} className="auth-tab" onClick={() => setLevel(id)}>
              ด่าน {id.slice(1)}
            </button>
          ))}
        </div>
        <div role="tablist" className="auth-tabs" aria-label="ใครบ้าง">
          {(['all', 'group'] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={scope === s} className="auth-tab" onClick={() => setScope(s)}>
              {s === 'all' ? 'ทุกคน' : 'กลุ่มของฉัน'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-500">นับเฉพาะรอบที่ชนะและผ่านการตรวจ · คนละ 1 แถว (รอบที่ดีที่สุด) · คะแนนเท่ากันดูเวลาจริงที่ใช้</p>
      {board === 'loading' ? (
        <p className="py-6 text-center text-sm text-slate-500">กำลังโหลด…</p>
      ) : board === null ? (
        <p className="py-6 text-center text-sm text-rose-700">โหลดตารางอันดับไม่ได้ ลองใหม่อีกครั้ง</p>
      ) : board.rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">ยังไม่มีใครผ่านด่านนี้ — เป็นคนแรกเลย! 🌱</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="px-2 py-1 text-right">#</th>
                <th className="px-2 py-1 text-left">ID</th>
                <th className="px-2 py-1 text-right">คะแนน</th>
                <th className="px-2 py-1 text-left">ดาว</th>
                <th className="px-2 py-1 text-right">น้ำหนัก</th>
                <th className="px-2 py-1 text-right">เวลาจริง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {board.rows.map((r) => <Row key={r.rank} r={r} />)}
              {board.me && !board.rows.some((r) => r.me) && (
                <>
                  <tr><td colSpan={6} className="py-1 text-center text-slate-400">⋯</td></tr>
                  <Row r={board.me} />
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
