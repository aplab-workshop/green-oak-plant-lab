import { writeFile } from 'node:fs/promises';
import { SCORE_REJECT_TEXT, type ScoreRejectReason } from '@gol/shared';

/**
 * เครื่องมือครู (W3 / SPEC § 4.40) — `npm run admin -- <คำสั่ง>` เรียก Admin API ของ Server
 * แยกจาก main.ts เพื่อให้เทสต์เรียก runAdmin() ได้โดยไม่ต้องเปิด Process ใหม่
 */

export interface AdminTarget {
  /** เช่น http://127.0.0.1:3001 หรือ URL ของ Server บน Cloud */
  url: string;
  key: string | undefined;
}

export const HELP = `เครื่องมือครู — Green Oak Virtual Plant Lab

ใช้: npm run admin -- <คำสั่ง> [ตัวเลือก]

  invite create --max <N> [--note <ข้อความ>] [--code <รหัส>]   สร้างรหัสเชิญ (ไม่ใส่ --code = สุ่ม)
  invite list                                                 ดูรหัสทั้งหมดและจำนวนที่ใช้
  invite close <รหัส> | invite open <รหัส>                    ปิด/เปิดการสมัครด้วยรหัสนี้
  player list [--invite <รหัส>]                               ดูผู้เล่น
  player reset-password <ID> [--password <ใหม่>]             ตั้ง Password ใหม่ (ไม่ใส่ = สุ่ม)
  player delete <ID> --yes                                    ลบบัญชี + คะแนน + Log
  data delete --invite <รหัส> [--with-accounts] --yes         ลบคะแนน + Log ทั้งรหัส (เช่น จบเทอม)
  score list [--invite <รหัส>] [--player <ID>] [--level <ด่าน>] [--unranked]
                                                              ดูคะแนนทุกรอบ (--unranked = เฉพาะที่ไม่นับอันดับ)
  log export [--invite <รหัส>] [--player <ID>] [--level <ด่าน>] [--out <ไฟล์.csv>]
                                                              ดาวน์โหลด Log การเล่นเป็น CSV (เปิดด้วย Excel ได้)
  stats                                                       จำนวนข้อมูลและขนาดฐานข้อมูล

ตั้งค่าใน .env: ADMIN_KEY=<กุญแจเดียวกับ Server>  GOL_API_URL=<URL ของ Server>  (หรือใส่ --url <URL>)
คำสั่งลบที่ไม่มี --yes จะแสดงจำนวนที่จะถูกลบเท่านั้น`;

const NEON_FREE_BYTES = 1024 ** 3;

interface Args {
  positional: string[];
  flags: Map<string, string | true>;
}

export function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags.set(a.slice(2), next);
        i++;
      } else flags.set(a.slice(2), true);
    } else positional.push(a);
  }
  return { positional, flags };
}

class CliError extends Error {}

const flagText = (args: Args, name: string): string | undefined => {
  const v = args.flags.get(name);
  if (v === true) throw new CliError(`--${name} ต้องมีค่าตามหลัง`);
  return v;
};

const when = (iso: unknown) =>
  typeof iso === 'string' ? new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-';

/** ตารางข้อความแบบง่าย */
function table(rows: string[][]): string[] {
  const widths = rows[0]!.map((_, c) => Math.max(...rows.map((r) => r[c]!.length)));
  return rows.map((r) => r.map((cell, c) => cell.padEnd(widths[c]!)).join('  ').trimEnd());
}

/** คืน Exit code (0 = สำเร็จ) */
export async function runAdmin(argv: string[], target: AdminTarget, print: (line: string) => void = console.log): Promise<number> {
  const args = parseArgs(argv);
  const url = (typeof args.flags.get('url') === 'string' ? (args.flags.get('url') as string) : target.url).replace(/\/+$/, '');
  const [group, action, arg] = args.positional;

  const request = async (method: string, path: string, body?: unknown): Promise<Response> => {
    if (!target.key) throw new CliError('ยังไม่ได้ตั้ง ADMIN_KEY (ใส่ในไฟล์ .env ให้ตรงกับ Server)');
    let res: Response;
    try {
      res = await fetch(`${url}${path}`, {
        method,
        headers: { authorization: `Bearer ${target.key}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new CliError(`ติดต่อ Server ที่ ${url} ไม่ได้ (Server เปิดอยู่ไหม / URL ถูกไหม)`);
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new CliError(data.error ?? `HTTP ${res.status}`);
    }
    return res;
  };
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> =>
    (await (await request(method, path, body)).json()) as T;

  try {
    switch (`${group ?? ''} ${action ?? ''}`.trim()) {
      case 'invite create': {
        const max = Number(flagText(args, 'max'));
        if (!Number.isInteger(max) || max < 1) throw new CliError('ใส่ --max <จำนวนคนที่สมัครได้> เช่น --max 40');
        const note = flagText(args, 'note');
        const code = flagText(args, 'code');
        const inv = await call<{ code: string; maxUses: number }>('POST', '/api/admin/invites', { maxUses: max, ...(note ? { note } : {}), ...(code ? { code } : {}) });
        print(`สร้างรหัสเชิญแล้ว: ${inv.code}  (สมัครได้ ${inv.maxUses} คน${note ? ` · ${note}` : ''})`);
        return 0;
      }
      case 'invite list': {
        const list = await call<{ code: string; maxUses: number; usedCount: number; active: boolean; note: string | null; createdAt: string }[]>('GET', '/api/admin/invites');
        if (list.length === 0) return print('ยังไม่มีรหัสเชิญ — สร้างด้วย: npm run admin -- invite create --max 40'), 0;
        table([['รหัส', 'ใช้ไป', 'สถานะ', 'สร้างเมื่อ', 'หมายเหตุ'], ...list.map((i) => [i.code, `${i.usedCount}/${i.maxUses}`, i.active ? 'เปิด' : 'ปิด', when(i.createdAt), i.note ?? ''])]).forEach((l) => print(l));
        return 0;
      }
      case 'invite close':
      case 'invite open': {
        if (!arg) throw new CliError(`ใส่รหัส เช่น invite ${action} GO-XXXX-XXXX`);
        const inv = await call<{ code: string }>('PATCH', `/api/admin/invites/${encodeURIComponent(arg)}`, { active: action === 'open' });
        print(action === 'open' ? `เปิดรหัส ${inv.code} แล้ว — สมัครได้อีกครั้ง` : `ปิดรหัส ${inv.code} แล้ว — สมัครเพิ่มไม่ได้ (คนที่สมัครแล้วยังเล่นได้)`);
        return 0;
      }
      case 'player list': {
        const invite = flagText(args, 'invite');
        const list = await call<{ username: string; inviteCode: string; createdAt: string; lastLoginAt: string | null }[]>(
          'GET',
          `/api/admin/players${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`,
        );
        if (list.length === 0) return print('ยังไม่มีผู้เล่น'), 0;
        table([['ID', 'รหัสเชิญ', 'สมัครเมื่อ', 'เข้าล่าสุด'], ...list.map((p) => [p.username, p.inviteCode, when(p.createdAt), when(p.lastLoginAt)])]).forEach((l) => print(l));
        print(`รวม ${list.length} คน`);
        return 0;
      }
      case 'player reset-password': {
        if (!arg) throw new CliError('ใส่ ID เช่น player reset-password somchai');
        const password = flagText(args, 'password');
        const r = await call<{ username: string; password: string }>('POST', `/api/admin/players/${encodeURIComponent(arg)}/password`, password ? { password } : {});
        print(`ตั้ง Password ใหม่ของ ${r.username}: ${r.password}`);
        print('แจ้งผู้เล่นให้ Login ด้วย Password นี้ (เครื่องที่ Login ค้างไว้จะต้อง Login ใหม่)');
        return 0;
      }
      case 'player delete': {
        if (!arg) throw new CliError('ใส่ ID เช่น player delete somchai --yes');
        if (args.flags.get('yes') !== true) {
          print(`จะลบบัญชี ${arg} พร้อมคะแนนและ Log ทั้งหมดของคนนี้ — ยืนยันด้วยการใส่ --yes ต่อท้าย`);
          return 1;
        }
        const r = await call<{ deleted: string }>('DELETE', `/api/admin/players/${encodeURIComponent(arg)}`);
        print(`ลบบัญชี ${r.deleted} แล้ว`);
        return 0;
      }
      case 'data delete': {
        const invite = flagText(args, 'invite');
        if (!invite) throw new CliError('ใส่ --invite <รหัส> เช่น data delete --invite GO-XXXX-XXXX --yes');
        const withAccounts = args.flags.get('with-accounts') === true;
        const yes = args.flags.get('yes') === true;
        const q = `?withAccounts=${withAccounts ? 1 : 0}${yes ? '' : '&dryRun=1'}`;
        const r = await call<{ players: number; scores: number; runLogs: number }>('DELETE', `/api/admin/invites/${encodeURIComponent(invite)}/data${q}`);
        const what = `คะแนน ${r.scores} รอบ, Log ${r.runLogs} รอบ${withAccounts ? `, บัญชี ${r.players} คน` : ''}`;
        if (!yes) {
          print(`จะลบของรหัส ${invite.toUpperCase()}: ${what} — ยืนยันด้วยการใส่ --yes ต่อท้าย`);
          return 1;
        }
        print(`ลบของรหัส ${invite.toUpperCase()} แล้ว: ${what}`);
        return 0;
      }
      case 'score list': {
        const invite = flagText(args, 'invite');
        const player = flagText(args, 'player');
        const level = flagText(args, 'level');
        const q = new URLSearchParams({ ...(invite ? { invite } : {}), ...(player ? { player } : {}), ...(level ? { level } : {}) }).toString();
        type Row = { username: string; levelId: string; status: string; score: number; stars: number; biomassG: number; realSeconds: number; ranked: boolean; rejectReason: string | null; createdAt: string };
        let list = await call<Row[]>('GET', `/api/admin/scores${q ? `?${q}` : ''}`);
        if (args.flags.get('unranked') === true) list = list.filter((s) => !s.ranked);
        if (list.length === 0) return print('ยังไม่มีคะแนน'), 0;
        const reasons = (r: string | null) =>
          (r ?? '').split(',').filter(Boolean).map((c) => SCORE_REJECT_TEXT[c as ScoreRejectReason] ?? c).join(', ');
        const minSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        table([
          ['ID', 'ด่าน', 'ผล', 'คะแนน', 'ดาว', 'น้ำหนัก', 'เวลาจริง', 'ส่งเมื่อ', 'นับอันดับ'],
          ...list.map((s) => [s.username, s.levelId, s.status === 'won' ? 'ชนะ' : 'แพ้', String(s.score), '⭐'.repeat(s.stars) || '-', `${s.biomassG.toFixed(1)} g`, minSec(s.realSeconds), when(s.createdAt), s.ranked ? 'นับ' : `ไม่นับ: ${reasons(s.rejectReason)}`]),
        ]).forEach((l) => print(l));
        print(`รวม ${list.length} รอบ (ไม่นับอันดับ ${list.filter((s) => !s.ranked).length})`);
        return 0;
      }
      case 'log export': {
        const invite = flagText(args, 'invite');
        const player = flagText(args, 'player');
        const level = flagText(args, 'level');
        const q = new URLSearchParams({ ...(invite ? { invite } : {}), ...(player ? { player } : {}), ...(level ? { level } : {}) }).toString();
        const res = await request('GET', `/api/admin/logs.csv${q ? `?${q}` : ''}`);
        const csv = Buffer.from(await res.arrayBuffer());
        const runs = Number(res.headers.get('x-run-count') ?? 0);
        const stamp = new Date().toISOString().slice(0, 10);
        const out = flagText(args, 'out') ?? `play-log-${(invite ?? player ?? 'all').toUpperCase()}-${stamp}.csv`;
        await writeFile(out, csv);
        print(`บันทึก ${out} แล้ว — ${runs} รอบ, ${csv.toString('utf8').split('\r\n').length - 2} แถว`);
        return 0;
      }
      case 'stats': {
        const s = await call<{ invites: number; players: number; scores: number; runLogs: number; databaseBytes: number }>('GET', '/api/admin/stats');
        print(`รหัสเชิญ ${s.invites} · ผู้เล่น ${s.players} · คะแนน ${s.scores} รอบ · Log ${s.runLogs} รอบ`);
        print(`ขนาดฐานข้อมูล ${(s.databaseBytes / 1024 ** 2).toFixed(1)} MB (${((s.databaseBytes / NEON_FREE_BYTES) * 100).toFixed(1)} % ของ 1 GB ของ Neon Free)`);
        return 0;
      }
      default:
        print(HELP);
        return group ? 1 : 0;
    }
  } catch (err) {
    if (err instanceof CliError) {
      print(`❌ ${err.message}`);
      return 1;
    }
    throw err;
  }
}
