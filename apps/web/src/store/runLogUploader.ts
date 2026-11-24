import { RUN_ABANDONED_KIND, RUN_LOG_MAX_EVENTS, RUN_LOG_MAX_MESSAGE, type EventEntry, type RunLogEvent, type RunLogUpload } from '@gol/shared';
import { useLabStore } from './labStore';
import { authFetch, useAuthStore } from './authStore';

/**
 * Log การเล่นต่อรอบ (W4 / SPEC § 4.41) — เก็บ Event ของรอบที่ Web ได้รับ แล้วส่งขึ้น Server เมื่อ Login อยู่
 * จบรอบ (won/lost) → ส่งทั้งรอบ · รอบเปลี่ยน/ปิดหน้าเว็บหลังเริ่มเล่น → ส่งพร้อมแถว "ออกกลางคัน"
 */

interface Run {
  labId: string;
  labRunId: number;
  levelId: string;
  events: Map<number, EventEntry>;
  simTimeS: number;
  started: boolean;
  ended: boolean;
  /** ส่งฉบับจบรอบแล้ว (ฉบับ "ออกกลางคัน" ส่งซ้ำ/แทนได้) */
  done: boolean;
}

/** keepalive ของ fetch ส่งได้ไม่เกิน ~64 KB */
const KEEPALIVE_MAX_BYTES = 60_000;
/** รอ Event จบรอบ (game.won/over) ตามมาหลัง Snapshot */
const END_DELAY_MS = 1000;
const STORAGE_KEY = 'gol.runlog.v1';
const STORAGE_MAX = 100;

let run: Run | null = null;
let endTimer: ReturnType<typeof setTimeout> | null = null;

type Sent = Record<string, { uuid: string; full: boolean }>;

function readSent(): Sent {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '{}') as Sent;
  } catch {
    return {};
  }
}

function writeSent(sent: Sent): void {
  try {
    const keys = Object.keys(sent);
    for (const k of keys.slice(0, Math.max(0, keys.length - STORAGE_MAX))) delete sent[k];
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(sent));
  } catch {
    // ไม่มี Storage — Reload แล้วอาจได้ Log รอบเดิมซ้ำ
  }
}

const toLogEvent = ({ at, simTimeS, kind, severity, message, plantId, value }: EventEntry): RunLogEvent => ({
  at,
  simTimeS,
  kind,
  severity,
  message: message.slice(0, RUN_LOG_MAX_MESSAGE),
  ...(plantId !== undefined ? { plantId } : {}),
  ...(value !== undefined ? { value: typeof value === 'string' ? value.slice(0, 32) : value } : {}),
});

/**
 * ส่ง Log ของรอบ — รหัสรอบ (UUID) ผูกกับ Lab + runId + เวลาของ Event แรก แล้วจำไว้ใน localStorage
 * Reload หน้าเว็บกลางรอบ (โหมดห้องเรียน) จึงใช้รหัสเดิม และ Server แทนฉบับ "ออกกลางคัน" ด้วยฉบับใหม่ได้
 */
function finishRun(r: Run, abandoned: boolean, keepalive = false): void {
  if (r.done || !r.started || r.events.size === 0) return;
  const { status, token } = useAuthStore.getState();
  if (status !== 'signedIn' || !token) return;
  const sorted = [...r.events.values()].sort((a, b) => a.id - b.id);
  const key = `${r.labId}:${r.labRunId}:${sorted[0]!.at}`;
  const sent = readSent();
  if (sent[key]?.full) return void (r.done = true);
  const uuid = sent[key]?.uuid ?? crypto.randomUUID();
  const events = sorted.map(toLogEvent).slice(0, RUN_LOG_MAX_EVENTS - 1);
  if (abandoned) {
    // Snapshot อาจตามหลัง Event ล่าสุดเล็กน้อย — ใช้เวลาที่มากกว่า
    const simTimeS = Math.max(r.simTimeS, sorted[sorted.length - 1]!.simTimeS);
    events.push({ at: Date.now(), simTimeS, kind: RUN_ABANDONED_KIND, severity: 'warning', message: 'ออกกลางคัน — ยังไม่จบรอบ' });
  }
  const body: RunLogUpload = { runId: uuid, levelId: r.levelId, events };
  const json = JSON.stringify(body);
  if (keepalive && json.length > KEEPALIVE_MAX_BYTES) return;
  if (!abandoned) r.done = true;
  sent[key] = { uuid, full: !abandoned };
  writeSent(sent);
  void authFetch('/api/runs/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: json,
    keepalive,
  }).catch(() => {
    // เครือข่ายขัดข้อง — Log รอบนี้หาย แต่เกมเล่นต่อได้
  });
}

function track(): void {
  const { labId, snapshot: snap, events } = useLabStore.getState();
  if (!labId || !snap) return;
  if (!run || run.labId !== labId || run.labRunId !== snap.runId) {
    if (run) finishRun(run, !run.ended);
    if (endTimer) clearTimeout(endTimer);
    endTimer = null;
    run = { labId, labRunId: snap.runId, levelId: 'free', events: new Map(), simTimeS: 0, started: false, ended: false, done: false };
  }
  const r = run;
  r.levelId = snap.level?.id ?? 'free';
  r.simTimeS = snap.simTimeS;
  for (const e of events) if (e.runId === r.labRunId && r.events.size < RUN_LOG_MAX_EVENTS) r.events.set(e.id, e);
  if (snap.game.status !== 'ready') r.started = true;
  r.ended = snap.game.status === 'won' || snap.game.status === 'lost';
  if (r.ended && !r.done && !endTimer) {
    endTimer = setTimeout(() => {
      endTimer = null;
      track();
      if (run === r) finishRun(r, false);
    }, END_DELAY_MS);
  }
}

/** เริ่มเก็บ Log — เรียกครั้งเดียวตอนเปิดหน้าเว็บ */
export function startRunLogUploader(): () => void {
  const unsub = useLabStore.subscribe(track);
  const onPageHide = () => {
    if (run) finishRun(run, !run.ended, true);
  };
  window.addEventListener('pagehide', onPageHide);
  return () => {
    unsub();
    window.removeEventListener('pagehide', onPageHide);
  };
}
