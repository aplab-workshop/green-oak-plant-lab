import type { EventEntry, HistorySample, LabCommand, LabSnapshot, ScenarioInfo } from '@gol/shared';
import { mergeEvents, useLabStore } from './labStore';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

/** ส่งคำสั่งไปยัง Lab ปัจจุบัน แล้วอัปเดต Snapshot จากผลตอบกลับ */
export async function sendCommand(cmd: LabCommand): Promise<boolean> {
  const labId = useLabStore.getState().labId;
  if (!labId) return false;
  try {
    const res = await fetch(`/api/labs/${labId}/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    const body = (await res.json()) as LabSnapshot | { error: string };
    if (!res.ok || 'error' in body) {
      useLabStore.setState({ commandError: 'error' in body ? body.error : `HTTP ${res.status}` });
      return false;
    }
    useLabStore.setState({ snapshot: body, commandError: null });
    // reset / scenario ล้าง History และ Event ฝั่ง Server
    if (cmd.type === 'reset' || cmd.type === 'applyScenario' || cmd.type === 'clearScenario') {
      useLabStore.setState({ events: [], history: [] });
      await Promise.all([refreshHistory(), refreshEvents()]);
    }
    return true;
  } catch (err) {
    useLabStore.setState({ commandError: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

export async function refreshHistory(): Promise<void> {
  const labId = useLabStore.getState().labId;
  if (!labId) return;
  try {
    const history = await getJson<HistorySample[]>(`/api/labs/${labId}/history`);
    if (useLabStore.getState().labId === labId) useLabStore.setState({ history });
  } catch {
    // ลองใหม่รอบถัดไป
  }
}

export async function refreshEvents(): Promise<void> {
  const labId = useLabStore.getState().labId;
  if (!labId) return;
  try {
    const events = await getJson<EventEntry[]>(`/api/labs/${labId}/events?limit=300`);
    if (useLabStore.getState().labId === labId) {
      useLabStore.setState((s) => ({ events: mergeEvents(s.events, events) }));
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
