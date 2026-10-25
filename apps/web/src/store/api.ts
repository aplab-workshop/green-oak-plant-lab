import type { EventEntry, HistorySample, LabCommand, LabSnapshot, ScenarioInfo } from '@gol/shared';
import { acceptSnapshot, mergeEvents, useLabStore } from './labStore';
import { apiFetch } from '../demo/mode';

async function getJson<T>(url: string): Promise<T> {
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

/** ส่งคำสั่งไปยัง Lab ปัจจุบัน แล้วอัปเดต Snapshot จากผลตอบกลับ */
export async function sendCommand(cmd: LabCommand): Promise<boolean> {
  const { labId, viewRevision } = useLabStore.getState();
  if (!labId) return false;
  try {
    const res = await apiFetch(`/api/labs/${labId}/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    const body = (await res.json()) as LabSnapshot | { error: string };
    if (useLabStore.getState().labId !== labId || useLabStore.getState().viewRevision !== viewRevision) return false;
    if (!res.ok || 'error' in body) {
      useLabStore.setState({ commandError: 'error' in body ? body.error : `HTTP ${res.status}` });
      return false;
    }
    // Snapshot เก่ากว่าที่ WebSocket ส่งมาแล้ว (เช่น selectLevel/reset ขึ้นรอบใหม่ก่อน HTTP ตอบ) = คำสั่งสำเร็จแล้ว
    acceptSnapshot(body);
    useLabStore.setState({ commandError: null });
    // reset / scenario ล้าง History และ Event ฝั่ง Server
    if (cmd.type === 'reset' || cmd.type === 'applyScenario' || cmd.type === 'clearScenario') {
      useLabStore.setState({ events: [], history: [] });
      await Promise.all([refreshHistory(), refreshEvents()]);
    }
    return true;
  } catch (err) {
    if (useLabStore.getState().labId === labId && useLabStore.getState().viewRevision === viewRevision) {
      useLabStore.setState({ commandError: err instanceof Error ? err.message : String(err) });
    }
    return false;
  }
}

let historyRequest = 0;
let eventsRequest = 0;

export async function refreshHistory(): Promise<void> {
  const { labId, snapshot, viewRevision } = useLabStore.getState();
  if (!labId || !snapshot) return;
  const request = ++historyRequest;
  try {
    const res = await apiFetch(`/api/labs/${labId}/history`);
    if (!res.ok) return;
    const runId = res.headers.get('X-Lab-Run-Id');
    const history = await res.json() as HistorySample[];
    const current = useLabStore.getState();
    if (request === historyRequest && current.labId === labId && current.viewRevision === viewRevision &&
        runId !== null && Number(runId) === snapshot.runId && current.snapshot?.runId === snapshot.runId) {
      useLabStore.setState({ history });
    }
  } catch {
    // ลองใหม่รอบถัดไป
  }
}

export async function refreshEvents(): Promise<void> {
  const { labId, snapshot, viewRevision } = useLabStore.getState();
  if (!labId || !snapshot) return;
  const request = ++eventsRequest;
  try {
    const res = await apiFetch(`/api/labs/${labId}/events?limit=1000`);
    if (!res.ok) return;
    const runId = res.headers.get('X-Lab-Run-Id');
    const events = await res.json() as EventEntry[];
    const current = useLabStore.getState();
    if (request === eventsRequest && current.labId === labId && current.viewRevision === viewRevision &&
        runId !== null && Number(runId) === snapshot.runId && current.snapshot?.runId === snapshot.runId) {
      useLabStore.setState((s) => ({ events: mergeEvents(s.events, events.filter((e) => e.runId === snapshot.runId)) }));
    }
  } catch {
    // ลองใหม่รอบถัดไป
  }
}

export async function loadScenarios(): Promise<void> {
  try {
    useLabStore.setState({ scenarios: await getJson<ScenarioInfo[]>('/api/scenarios') });
  } catch {
    // ลองใหม่ตอน reconnect
  }
}
