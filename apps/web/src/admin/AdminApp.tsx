import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { SCORE_REJECT_TEXT, type ScoreRejectReason } from '@gol/shared';
import { authFetch } from '../store/authStore';
import { DEMO } from '../demo/mode';
import {
  AdminError, adminJson, adminRequest, minSec, query, readAdminKey, setCurrentKey, when,
  type InviteRow, type PlayerRow, type ScoreAdminRow, type StatsRow,
} from './adminApi';

/** หน้าครู (W8 / SPEC § 4.45) — เปิดที่ ?admin */

type Tab = 'invites' | 'players' | 'scores' | 'logs' | 'system';
const TABS: [Tab, string][] = [['invites', '🎟️ รหัสเชิญ'], ['players', '👥 ผู้เล่น'], ['scores', '🏆 คะแนน'], ['logs', '📄 Log (CSV)'], ['system', '⚙️ ระบบ']];
const LEVELS = ['L1', 'L2', 'L3', 'L4'];
const NEON_FREE_BYTES = 1024 ** 3;

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** โหลดข้อมูลพร้อมสถานะ — reload() เรียกซ้ำหลังแก้ข้อมูล */
function useLoad<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    load().then((d) => live && setData(d), (e) => live && setError(errText(e)));
    return () => {
      live = false;
    };
  }, [...deps, n]);
  return { data, error, reload: useCallback(() => setN((x) => x + 1), []) };
}

const Card = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
    {title && <h2 className="mb-3 font-semibold text-slate-800">{title}</h2>}
    {children}
  </section>
);
const Err = ({ msg }: { msg: string | null }) => (msg ? <p role="alert" className="auth-error">{msg}</p> : null);
const Ok = ({ msg }: { msg: string | null }) => (msg ? <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p> : null);
const btn = 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50';
const btnMain = 'rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50';
const input = 'rounded-lg border-2 border-slate-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none';

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-slate-500">ยังไม่มีข้อมูล</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500"><tr>{head.map((h) => <th key={h} className="px-2 py-1.5">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-2 py-1.5 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** ตัวเลือกรหัสเชิญจากรายการบน Server */
function InviteSelect({ value, onChange, all = 'ทุกรหัส' }: { value: string; onChange: (v: string) => void; all?: string }) {
  const { data } = useLoad(() => adminJson<InviteRow[]>('GET', '/api/admin/invites'), []);
  return (
    <select className={input} value={value} onChange={(e) => onChange(e.target.value)} aria-label="รหัสเชิญ">
      <option value="">{all}</option>
      {data?.map((i) => <option key={i.code} value={i.code}>{i.code}{i.note ? ` · ${i.note}` : ''}</option>)}
    </select>
  );
}

function InvitesTab() {
  const list = useLoad(() => adminJson<InviteRow[]>('GET', '/api/admin/invites'), []);
  const [max, setMax] = useState('40');
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      const inv = await adminJson<InviteRow>('POST', '/api/admin/invites', { maxUses: Number(max), ...(note.trim() ? { note: note.trim() } : {}), ...(code.trim() ? { code: code.trim() } : {}) });
      setMsg(`สร้างรหัสเชิญแล้ว: ${inv.code} (สมัครได้ ${inv.maxUses} คน)`);
      setNote('');
      setCode('');
      list.reload();
    } catch (e2) {
      setErr(errText(e2));
    }
  };
  const toggle = async (inv: InviteRow) => {
    try {
      await adminJson('PATCH', `/api/admin/invites/${encodeURIComponent(inv.code)}`, { active: !inv.active });
      list.reload();
    } catch (e) {
      setErr(errText(e));
    }
  };
  const copy = (c: string) => void navigator.clipboard?.writeText(c).then(() => setMsg(`คัดลอก ${c} แล้ว`), () => setMsg(c));
  return (
    <div className="space-y-4">
      <Card title="สร้างรหัสเชิญ">
        <form className="flex flex-wrap items-end gap-3" onSubmit={create}>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">สมัครได้ (คน)
            <input className={`${input} w-24`} type="number" min={1} max={100000} required value={max} onChange={(e) => setMax(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">หมายเหตุ (เช่น ห้อง)
            <input className={input} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ม.5/1" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">รหัสกำหนดเอง (ไม่ใส่ = สุ่ม)
            <input className={input} maxLength={32} value={code} onChange={(e) => setCode(e.target.value)} placeholder="GO-XXXX-XXXX" />
          </label>
          <button className={btnMain} type="submit">สร้างรหัส</button>
        </form>
        <div className="mt-3 space-y-2"><Ok msg={msg} /><Err msg={err} /></div>
      </Card>
      <Card title="รหัสทั้งหมด">
        <Err msg={list.error} />
        <Table
          head={['รหัส', 'ใช้ไป', 'สถานะ', 'สร้างเมื่อ', 'หมายเหตุ', '']}
          rows={(list.data ?? []).map((i) => [
            <b className="font-mono">{i.code}</b>,
            `${i.usedCount}/${i.maxUses}`,
            i.active ? <span className="text-emerald-700">เปิด</span> : <span className="text-slate-400">ปิด</span>,
            when(i.createdAt),
            i.note ?? '',
            <span className="flex gap-2">
              <button className={btn} type="button" onClick={() => copy(i.code)}>คัดลอก</button>
              <button className={btn} type="button" onClick={() => void toggle(i)}>{i.active ? 'ปิดการสมัคร' : 'เปิดการสมัคร'}</button>
            </span>,
          ])}
        />
      </Card>
    </div>
  );
}

function PlayersTab() {
  const [invite, setInvite] = useState('');
  const list = useLoad(() => adminJson<PlayerRow[]>('GET', `/api/admin/players${query({ invite })}`), [invite]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reset = async (p: PlayerRow) => {
    if (!window.confirm(`ตั้ง Password ใหม่ (สุ่ม) ให้ ${p.username}? เครื่องที่ Login ค้างไว้จะต้อง Login ใหม่`)) return;
    try {
      const r = await adminJson<{ username: string; password: string }>('POST', `/api/admin/players/${encodeURIComponent(p.username)}/password`, {});
      setErr(null);
      setMsg(`Password ใหม่ของ ${r.username}: ${r.password} — แจ้งผู้เล่น (แสดงครั้งเดียว)`);
    } catch (e) {
      setErr(errText(e));
    }
  };
  const remove = async (p: PlayerRow) => {
    if (window.prompt(`ลบบัญชี ${p.username} พร้อมคะแนนและ Log ทั้งหมด (ย้อนกลับไม่ได้)\nพิมพ์ ID "${p.username}" เพื่อยืนยัน`) !== p.username) return;
    try {
      await adminJson('DELETE', `/api/admin/players/${encodeURIComponent(p.username)}`);
      setErr(null);
      setMsg(`ลบบัญชี ${p.username} แล้ว`);
      list.reload();
    } catch (e) {
      setErr(errText(e));
    }
  };
  return (
    <Card title="ผู้เล่น">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <InviteSelect value={invite} onChange={setInvite} />
        <span className="text-sm text-slate-500">{list.data ? `รวม ${list.data.length} คน` : ''}</span>
      </div>
      <div className="mb-3 space-y-2"><Ok msg={msg} /><Err msg={err ?? list.error} /></div>
      <Table
        head={['ID', 'รหัสเชิญ', 'สมัครเมื่อ', 'เข้าล่าสุด', '']}
        rows={(list.data ?? []).map((p) => [
          <b>{p.username}</b>, <span className="font-mono">{p.inviteCode}</span>, when(p.createdAt), when(p.lastLoginAt),
          <span className="flex gap-2">
            <button className={btn} type="button" onClick={() => void reset(p)}>รีเซ็ต Password</button>
            <button className={`${btn} text-rose-700`} type="button" onClick={() => void remove(p)}>ลบบัญชี</button>
          </span>,
        ])}
      />
    </Card>
  );
}

function Filters({ invite, setInvite, level, setLevel, player, setPlayer }: {
  invite: string; setInvite: (v: string) => void; level: string; setLevel: (v: string) => void; player: string; setPlayer: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <InviteSelect value={invite} onChange={setInvite} />
      <select className={input} value={level} onChange={(e) => setLevel(e.target.value)} aria-label="ด่าน">
        <option value="">ทุกด่าน</option>
        {LEVELS.map((l) => <option key={l} value={l}>ด่าน {l.slice(1)}</option>)}
        <option value="free">Free Play</option>
      </select>
      <input className={input} value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="ID ผู้เล่น (ไม่ใส่ = ทุกคน)" aria-label="ID ผู้เล่น" />
    </div>
  );
}

const reasonText = (r: string | null) =>
  (r ?? '').split(',').filter(Boolean).map((c) => SCORE_REJECT_TEXT[c as ScoreRejectReason] ?? c).join(', ');

function ScoresTab() {
  const [invite, setInvite] = useState('');
  const [level, setLevel] = useState('');
  const [player, setPlayer] = useState('');
  const [unranked, setUnranked] = useState(false);
  const p = player.trim();
  const list = useLoad(() => adminJson<ScoreAdminRow[]>('GET', `/api/admin/scores${query({ invite, level, player: p })}`), [invite, level, p]);
  const rows = (list.data ?? []).filter((s) => !unranked || !s.ranked);
  return (
    <Card title="คะแนนทุกรอบ">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Filters {...{ invite, setInvite, level, setLevel, player, setPlayer }} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unranked} onChange={(e) => setUnranked(e.target.checked)} /> เฉพาะไม่นับอันดับ</label>
      </div>
      <Err msg={list.error} />
      <p className="mb-2 text-sm text-slate-500">{list.data && `รวม ${rows.length} รอบ (ไม่นับอันดับ ${rows.filter((s) => !s.ranked).length})`}</p>
      <Table
        head={['ID', 'ด่าน', 'ผล', 'คะแนน', 'ดาว', 'น้ำหนัก', 'เวลาจริง', 'ส่งเมื่อ', 'นับอันดับ']}
        rows={rows.map((s) => [
          s.username, s.levelId, s.status === 'won' ? 'ชนะ' : 'แพ้', s.score, '⭐'.repeat(s.stars) || '-', `${s.biomassG.toFixed(1)} g`, minSec(s.realSeconds), when(s.createdAt),
          s.ranked ? <span className="text-emerald-700">นับ</span> : <span className="text-amber-800">ไม่นับ: {reasonText(s.rejectReason)}</span>,
        ])}
      />
    </Card>
  );
}

function LogsTab() {
  const [invite, setInvite] = useState('');
  const [level, setLevel] = useState('');
  const [player, setPlayer] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const download = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await adminRequest('GET', `/api/admin/logs.csv${query({ invite, level, player: player.trim() })}`);
      const blob = await res.blob();
      const runs = Number(res.headers.get('x-run-count') ?? 0);
      const name = `play-log-${(invite || player.trim() || 'all').toUpperCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMsg(`ดาวน์โหลด ${name} แล้ว — ${runs} รอบ`);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="ดาวน์โหลด Log การเล่น (CSV)">
      <p className="mb-3 text-sm text-slate-600">ทุกการปรับอุปกรณ์ตามเวลาของแต่ละรอบ — เปิดด้วย Excel ได้ (ภาษาไทยไม่เพี้ยน)</p>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Filters {...{ invite, setInvite, level, setLevel, player, setPlayer }} />
        <button className={btnMain} type="button" disabled={busy} onClick={() => void download()}>{busy ? 'กำลังดาวน์โหลด…' : '⬇️ ดาวน์โหลด CSV'}</button>
      </div>
      <div className="space-y-2"><Ok msg={msg} /><Err msg={err} /></div>
    </Card>
  );
}

function SystemTab() {
  const stats = useLoad(() => adminJson<StatsRow>('GET', '/api/admin/stats'), []);
  const health = useLoad(async () => (await authFetch('/api/health')).json() as Promise<{ version: string; uptimeS: number }>, []);
  const [invite, setInvite] = useState('');
  const [withAccounts, setWithAccounts] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const path = (dry: boolean) => `/api/admin/invites/${encodeURIComponent(invite)}/data${query({ withAccounts: withAccounts ? '1' : '0', dryRun: dry ? '1' : undefined })}`;
  const describe = (n: { players: number; scores: number; runLogs: number }) => `คะแนน ${n.scores} รอบ, Log ${n.runLogs} รอบ${withAccounts ? `, บัญชี ${n.players} คน` : ''}`;
  const check = async () => {
    setErr(null);
    setMsg(null);
    try {
      setPreview(`จะลบของรหัส ${invite}: ${describe(await adminJson('DELETE', path(true)))}`);
    } catch (e) {
      setErr(errText(e));
    }
  };
  const remove = async () => {
    if (!window.confirm(`${preview}\nลบแล้วย้อนกลับไม่ได้ — แนะนำดาวน์โหลด CSV เก็บไว้ก่อน ยืนยันลบ?`)) return;
    try {
      setMsg(`ลบของรหัส ${invite} แล้ว: ${describe(await adminJson('DELETE', path(false)))}`);
      setPreview(null);
      stats.reload();
    } catch (e) {
      setErr(errText(e));
    }
  };
  const s = stats.data;
  return (
    <div className="space-y-4">
      <Card title="สถานะ">
        <Err msg={stats.error ?? health.error} />
        <ul className="space-y-1 text-sm">
          <li>Server: {health.data ? `ทำงาน · เวอร์ชัน ${health.data.version} · เปิดมา ${Math.round(health.data.uptimeS / 60)} นาที` : 'กำลังตรวจ…'}</li>
          {s && <li>รหัสเชิญ {s.invites} · ผู้เล่น {s.players} · คะแนน {s.scores} รอบ · Log {s.runLogs} รอบ</li>}
          {s && <li>ขนาดฐานข้อมูล {(s.databaseBytes / 1024 ** 2).toFixed(1)} MB ({((s.databaseBytes / NEON_FREE_BYTES) * 100).toFixed(1)} % ของ 1 GB ของ Neon Free)</li>}
        </ul>
      </Card>
      <Card title="ลบข้อมูลรายรหัสเชิญ (เช่น จบเทอม)">
        <div className="flex flex-wrap items-center gap-3">
          <InviteSelect value={invite} onChange={(v) => { setInvite(v); setPreview(null); }} all="เลือกรหัส…" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={withAccounts} onChange={(e) => { setWithAccounts(e.target.checked); setPreview(null); }} /> ลบบัญชีด้วย</label>
          <button className={btn} type="button" disabled={!invite} onClick={() => void check()}>ตรวจจำนวน</button>
          {preview && <button className={`${btn} border-rose-300 text-rose-700`} type="button" onClick={() => void remove()}>ลบจริง</button>}
        </div>
        <div className="mt-3 space-y-2">
          {preview && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{preview}</p>}
          <Ok msg={msg} /><Err msg={err} />
        </div>
      </Card>
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [key, setKey] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await adminRequest('GET', '/api/admin/stats', undefined, key.trim());
      setCurrentKey(key.trim());
      onDone();
    } catch (e2) {
      setErr(errText(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="mx-auto mt-16 flex max-w-sm flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200" onSubmit={submit}>
      <h1 className="text-lg font-bold text-emerald-900">🧑‍🏫 หน้าครู — Green Oak</h1>
      <label className="auth-field"><span>Admin key</span>
        <input type="password" autoFocus autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} required />
        <small>ค่าเดียวกับ ADMIN_KEY บน Server — จำไว้เฉพาะแท็บนี้ ปิดแท็บแล้วต้องใส่ใหม่</small>
      </label>
      <Err msg={err} />
      <button className={btnMain} type="submit" disabled={busy || !key.trim()}>{busy ? 'กำลังตรวจ…' : 'เข้าสู่หน้าครู'}</button>
    </form>
  );
}

export default function AdminApp() {
  const [state, setState] = useState<'checking' | 'off' | 'login' | 'ready' | 'down'>('checking');
  const [tab, setTab] = useState<Tab>('invites');
  useEffect(() => {
    document.title = 'หน้าครู — Green Oak';
    void (async () => {
      if (DEMO && !(import.meta.env.VITE_ACCOUNTS_API as string | undefined)) return setState('off');
      try {
        const res = await authFetch('/api/auth/config');
        if (!res.ok || !((await res.json()) as { enabled: boolean }).enabled) return setState('off');
      } catch {
        return setState('down');
      }
      if (!readAdminKey()) return setState('login');
      try {
        await adminRequest('GET', '/api/admin/stats');
        setState('ready');
      } catch (e) {
        if (e instanceof AdminError && e.status === 401) setCurrentKey(null);
        setState(e instanceof AdminError && e.status === 0 ? 'down' : 'login');
      }
    })();
  }, []);
  const logout = () => {
    setCurrentKey(null);
    setState('login');
  };

  return (
    <div className="h-full overflow-auto bg-slate-50">
      {state === 'checking' && <p className="mt-16 text-center text-slate-500">กำลังเชื่อมต่อ Server… (Server ฟรีที่หลับอยู่อาจใช้เวลาถึง 1 นาที)</p>}
      {state === 'down' && <p className="mt-16 text-center text-rose-700">ติดต่อ Server ไม่ได้ — รอสักครู่แล้วรีเฟรชหน้า</p>}
      {state === 'off' && <p className="mt-16 text-center text-slate-600">ระบบบัญชีปิดอยู่ — หน้าครูใช้ได้เมื่อ Server ตั้ง DATABASE_URL (ดู docs/DEPLOY.md)</p>}
      {state === 'login' && <Login onDone={() => setState('ready')} />}
      {state === 'ready' && (
        <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-emerald-900">🧑‍🏫 หน้าครู — Green Oak Virtual Plant Lab</h1>
            <button className={btn} type="button" onClick={logout}>ออกจากระบบ</button>
          </header>
          <nav role="tablist" className="auth-tabs flex-wrap self-start">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className="auth-tab" onClick={() => setTab(id)}>{label}</button>
            ))}
          </nav>
          {tab === 'invites' && <InvitesTab />}
          {tab === 'players' && <PlayersTab />}
          {tab === 'scores' && <ScoresTab />}
          {tab === 'logs' && <LogsTab />}
          {tab === 'system' && <SystemTab />}
        </div>
      )}
    </div>
  );
}
