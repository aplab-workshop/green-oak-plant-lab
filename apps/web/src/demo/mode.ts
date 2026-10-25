/** Demo build (P50): Simulation + Mock PLC รันในเบราว์เซอร์ — ตั้งจาก vite --mode demo */
export const DEMO = import.meta.env.VITE_DEMO === '1';

/** fetch ไป Server จริง หรือ Server จำลองในเบราว์เซอร์ (Demo) */
export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  return DEMO ? import('./localServer').then((m) => m.localFetch(url, init)) : fetch(url, init);
}
