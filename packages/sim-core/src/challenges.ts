import type { ChallengeKind, ChallengeView } from '@gol/shared';
import type { SimConfig } from './config/defaultConfig';
import { SECONDS_PER_DAY } from './clock';
import { Rng } from './rng';

/**
 * เหตุการณ์ท้าทายระหว่างรอบ (SPEC § 4.8) — ตารางสร้าง Deterministic จาก Seed + ด่าน
 * ผลต่อ Model คำนวณใน Simulation ผ่าน ChallengeEffects
 */

export const CHALLENGE_KINDS: readonly ChallengeKind[] = ['heatWave', 'leak', 'powerOutage', 'dryAir', 'alkalineTap'];

/** ข้อกำหนดเหตุการณ์ของด่าน */
export interface ChallengeSpec {
  kinds: readonly ChallengeKind[];
  /** จำนวนเหตุการณ์ [ต่ำสุด, สูงสุด] */
  count: readonly [number, number];
  /** ช่วงวันของรอบที่เกิดได้ [วันแรก, วันสุดท้าย] นับจากวันเริ่มรอบ (0 = วันเริ่ม) */
  windowDays: readonly [number, number];
  /** ค่าคงที่เฉพาะด่าน ผสมกับ Seed ให้ตารางต่างกันในแต่ละด่าน */
  salt: number;
  /** ถังรั่วหยุดเองหลัง [ต่ำสุด, สูงสุด] ชั่วโมง (ซ่อมไม่ได้) — ไม่ระบุ = รั่วจนกว่าจะซ่อม (P37) */
  leakHours?: readonly [number, number];
  /**
   * ตารางเหตุการณ์รายวัน (P41, หลายชนิด P46) — ถ้ามี ใช้แทนการสุ่มวันตาม count/windowDays (ให้ count/windowDays สรุปตรงกับตารางนี้)
   * แต่ละรายการแบ่ง [fromHour, toHour) เป็น count ช่วงเท่ากัน สุ่มเวลาเริ่มในแต่ละช่วง — รายการในวันเดียวกันต้องวางช่วงไม่ให้ทับกันเอง
   */
  days?: readonly ScheduledDay[];
  /** ไม่เตือนล่วงหน้า — Mascot วิ่งมาก่อเหตุ แล้วประกาศหลัง Mascot ออก (P41/P46) */
  surprise?: boolean;
}

/** เหตุการณ์ของวันหนึ่งในตารางรายวัน */
export interface ScheduledDay {
  /** ชนิดเหตุการณ์ (ค่าเริ่ม 'leak') — P46 */
  kind?: ChallengeKind;
  /** วันของรอบ (0 = วันเริ่มรอบ) */
  day: number;
  count: number;
  /** ระยะเวลาต่อครั้ง [ต่ำสุด, สูงสุด] ชั่วโมง (จำนวนเต็ม) */
  hours: readonly [number, number];
  /** ช่วงเวลาของวันที่เกิดได้ (ชั่วโมง) */
  fromHour: number;
  toHour: number;
}

/** เหตุการณ์ที่วางแผนไว้ (เวลาจำลองแบบสัมบูรณ์) */
export interface ChallengePlan {
  id: number;
  kind: ChallengeKind;
  startS: number;
  /** null = ไม่จบเอง (ถังรั่วจนกว่าจะซ่อม) */
  durationS: number | null;
  /** ไม่เตือนล่วงหน้า (P41) */
  surprise?: boolean;
}

export type ChallengeStatus = 'scheduled' | 'warned' | 'active' | 'done';

export interface ChallengeState extends ChallengePlan {
  status: ChallengeStatus;
  /** เวลาที่จบจริง (หมดเวลา/ซ่อม) */
  endedAtS: number | null;
  repaired: boolean;
  /** ผู้เล่นรู้แล้ว (มี Event challenge.start) — เหตุการณ์ surprise ประกาศหลัง Mascot ออก */
  announced: boolean;
}

export const CHALLENGE_TITLE: Record<ChallengeKind, string> = {
  heatWave: '🔥 คลื่นความร้อน',
  leak: '💧 ถังรั่ว',
  powerOutage: '⚡ ไฟดับ',
  dryAir: '🌵 อากาศแห้ง',
  alkalineTap: '🚿 น้ำประปาด่าง',
};

/** ผลรวมของเหตุการณ์ที่ active ณ ขณะหนึ่ง */
export interface ChallengeEffects {
  roomTempDeltaC: number;
  roomRhDeltaPct: number;
  leakLph: number;
  /** pH ของน้ำที่เติม (null = ค่าปกติใน Config) */
  tapPh: number | null;
  powerOutage: boolean;
}

export const NO_EFFECTS: Readonly<ChallengeEffects> = Object.freeze({
  roomTempDeltaC: 0,
  roomRhDeltaPct: 0,
  leakLph: 0,
  tapPh: null,
  powerOutage: false,
});

const randInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng.next() * (hi - lo + 1));

/** ระยะเวลาของเหตุการณ์ (s) — null = จนกว่าจะซ่อม */
function durationOf(kind: ChallengeKind, rng: Rng, cfg: SimConfig, spec: ChallengeSpec): number | null {
  const c = cfg.challenges;
  switch (kind) {
    case 'heatWave':
      return randInt(rng, c.heatWaveHours[0], c.heatWaveHours[1]) * 3600;
    case 'powerOutage':
      return randInt(rng, c.outageHours[0], c.outageHours[1]) * 3600;
    case 'dryAir':
      return c.dryAirHours * 3600;
    case 'alkalineTap':
      return c.alkalineTapHours * 3600;
    case 'leak':
      return spec.leakHours ? randInt(rng, spec.leakHours[0], spec.leakHours[1]) * 3600 : null;
  }
}

/** ชั่วโมงเริ่ม (ของวัน) ตามชนิด — คลื่นความร้อนเริ่มช่วงเที่ยง */
const startHourOf = (kind: ChallengeKind, rng: Rng): number =>
  kind === 'heatWave' ? randInt(rng, 11, 13) : kind === 'powerOutage' ? randInt(rng, 9, 17) : randInt(rng, 8, 20);

/**
 * สร้างตารางเหตุการณ์ (Deterministic) — วันละไม่เกิน 1 เหตุการณ์ ห่างกันอย่างน้อย minGapDays
 * @param roundStartS เวลาเริ่มรอบ (s จำลอง) — วันที่ 0 = วันของ roundStartS
 */
export function planChallenges(spec: ChallengeSpec, seed: number, roundStartS: number, cfg: SimConfig): ChallengePlan[] {
  const rng = new Rng((Math.imul(seed, 2654435761) ^ Math.imul(spec.salt + 1, 40503)) >>> 0);
  if (spec.days) return planDays(spec.days, rng, roundStartS, cfg, spec.surprise === true);
  const n = randInt(rng, spec.count[0], spec.count[1]);
  if (n <= 0 || spec.kinds.length === 0) return [];

  // ชนิด: ไม่ซ้ำถ้ามีพอ (สุ่มลำดับแบบ Fisher–Yates) มิฉะนั้นวนซ้ำ
  const pool = [...spec.kinds];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const kinds = Array.from({ length: n }, (_, i) => pool[i % pool.length]!);

  // วัน: แบ่งช่วงเป็น n ส่วนเท่ากัน สุ่มวันในแต่ละส่วน แล้วบังคับระยะห่างขั้นต่ำ
  const [d0, d1] = spec.windowDays;
  const span = d1 - d0 + 1;
  const gap = cfg.challenges.minGapDays;
  const days: number[] = [];
  for (let i = 0; i < n; i++) {
    const lo = d0 + Math.floor((i * span) / n);
    const hi = Math.max(lo, d0 + Math.floor(((i + 1) * span) / n) - 1);
    let day = randInt(rng, lo, hi);
    const prev = days[i - 1];
    if (prev !== undefined && day - prev < gap) day = prev + gap;
    days.push(Math.min(day, d1 + gap * i)); // ช่วงแคบมากอาจเลยปลายช่วงเล็กน้อยเพื่อคงระยะห่าง
  }

  const day0 = Math.floor(roundStartS / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  return kinds.map((kind, i) => ({
    id: i + 1,
    kind,
    startS: day0 + days[i]! * SECONDS_PER_DAY + startHourOf(kind, rng) * 3600,
    durationS: durationOf(kind, rng, cfg, spec),
    ...(spec.surprise ? { surprise: true } : {}),
  }));
}

/** เหตุการณ์ตามตารางรายวัน — ช่วงละ 1 ครั้ง เวลาเริ่มสุ่มรายนาที ให้เหตุการณ์ + Mascot วิ่งออกจบในช่วงของตัวเอง; เรียงตามเวลาแล้วให้ id */
function planDays(days: readonly ScheduledDay[], rng: Rng, roundStartS: number, cfg: SimConfig, surprise: boolean): ChallengePlan[] {
  const day0 = Math.floor(roundStartS / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  const plans: Omit<ChallengePlan, 'id'>[] = [];
  for (const d of days) {
    const slotS = ((d.toHour - d.fromHour) * 3600) / d.count;
    for (let i = 0; i < d.count; i++) {
      const durationS = randInt(rng, d.hours[0], d.hours[1]) * 3600;
      const slot0 = day0 + d.day * SECONDS_PER_DAY + d.fromHour * 3600 + i * slotS;
      const room = Math.max(0, slotS - durationS - cfg.challenges.mascotExitS);
      const startS = slot0 + randInt(rng, 0, Math.floor(room / 60)) * 60;
      plans.push({ kind: d.kind ?? 'leak', startS, durationS, ...(surprise ? { surprise: true } : {}) });
    }
  }
  return plans.sort((a, b) => a.startS - b.startS).map((p, i) => ({ id: i + 1, ...p }));
}

export const toState = (p: ChallengePlan): ChallengeState => ({ ...p, status: 'scheduled', endedAtS: null, repaired: false, announced: false });

/** ผลรวมของเหตุการณ์ที่ active */
export function effectsOf(states: readonly ChallengeState[], cfg: SimConfig): ChallengeEffects {
  // ส่วนใหญ่ไม่มีเหตุการณ์ active — คืนค่าคงที่ ไม่สร้าง Object ใหม่ทุก Step
  if (!states.some((s) => s.status === 'active')) return NO_EFFECTS;
  const c = cfg.challenges;
  const e: ChallengeEffects = { ...NO_EFFECTS };
  for (const s of states) {
    if (s.status !== 'active') continue;
    if (s.kind === 'heatWave') e.roomTempDeltaC += c.heatWaveDeltaC;
    if (s.kind === 'dryAir') e.roomRhDeltaPct += c.dryAirRhDeltaPct;
    if (s.kind === 'leak') e.leakLph += c.leakLph;
    if (s.kind === 'alkalineTap') e.tapPh = c.alkalineTapPh;
    if (s.kind === 'powerOutage') e.powerOutage = true;
  }
  return e;
}

/** มุมมองที่ส่งให้ผู้เล่น — เฉพาะที่ถูกเตือนแล้ว (surprise: หลังประกาศ) */
export function challengeViews(states: readonly ChallengeState[]): ChallengeView[] {
  return states
    .filter((s) => s.status !== 'scheduled' && (!s.surprise || s.announced))
    .map((s) => ({
      id: s.id,
      kind: s.kind,
      title: CHALLENGE_TITLE[s.kind],
      status: s.status as ChallengeView['status'],
      startS: s.startS,
      endS: s.endedAtS ?? (s.durationS === null ? null : s.startS + s.durationS),
      repaired: s.repaired,
      repairable: s.kind === 'leak' && s.durationS === null,
    }));
}

/** ข้อความ Event log ของเหตุการณ์ (ภาษาไทย ศัพท์เทคนิคภาษาอังกฤษ) */
export function challengeMessage(s: ChallengeState, phase: 'warning' | 'start' | 'end', cfg: SimConfig): string {
  const c = cfg.challenges;
  const hours = s.durationS === null ? null : Math.round(s.durationS / 3600);
  const t = CHALLENGE_TITLE[s.kind];
  if (phase === 'warning') {
    switch (s.kind) {
      case 'heatWave':
        return `พยากรณ์ ${t}: อีก 6 ชั่วโมงห้องจะร้อนขึ้น ${c.heatWaveDeltaC} °C นาน ~${hours} ชม. — เตรียมเปิดพัดลมและลดไฟ LED`;
      case 'leak':
        return s.durationS === null
          ? `แจ้งเตือน ${t}: ข้อต่อถังเริ่มหลวม อีก 6 ชั่วโมงอาจรั่ว — เติมน้ำให้พร้อมและเตรียมกดซ่อมถัง`
          : `แจ้งเตือน ${t}: อีก 6 ชั่วโมงถังจะรั่ว ~${hours} ชม. (หยุดเอง) — เติมน้ำให้พร้อมแล้วคอยเติมชดเชย`;
      case 'powerOutage':
        return `การไฟฟ้าแจ้ง ${t}: อีก 6 ชั่วโมงไฟจะดับ ~${hours} ชม. ทุกอุปกรณ์จะหยุด — เติมน้ำและปุ๋ยให้พอก่อน`;
      case 'dryAir':
        return `พยากรณ์ ${t}: อีก 6 ชั่วโมงความชื้นห้องจะลด ${-c.dryAirRhDeltaPct}% นาน ${hours} ชม. — เตรียมเปิดเครื่องทำหมอก`;
      case 'alkalineTap':
        return `การประปาแจ้ง ${t}: อีก 6 ชั่วโมงน้ำประปาจะมี pH ${c.alkalineTapPh} นาน ${hours} ชม. — เติมน้ำทีละน้อยและใช้ pH Down`;
    }
  }
  if (phase === 'start') {
    switch (s.kind) {
      case 'heatWave':
        return `${t} มาแล้ว! ห้องร้อนขึ้น ${c.heatWaveDeltaC} °C`;
      case 'leak':
        return s.durationS === null
          ? `${t}! น้ำไหลออก ${c.leakLph} L/h — กดปุ่ม "ซ่อมถัง"`
          : `${t}! น้ำไหลออก ${c.leakLph} L/h นาน ~${hours} ชม. — เปิดปั๊มเติมน้ำชดเชย`;
      case 'powerOutage':
        return `${t}! อุปกรณ์ทุกตัวหยุด รวมไฟ LED และปั๊มลม`;
      case 'dryAir':
        return `${t}! ความชื้นห้องลดลง ${-c.dryAirRhDeltaPct}%`;
      case 'alkalineTap':
        return `${t}! น้ำที่เติมตอนนี้มี pH ${c.alkalineTapPh}`;
    }
  }
  return s.repaired ? `${t}: ซ่อมเรียบร้อย น้ำหยุดรั่วแล้ว` : `${t} จบแล้ว กลับสู่สภาวะปกติ`;
}

/**
 * ช่วง Mascot วิ่งมาก่อเหตุแบบ surprise (P41 / SPEC § 4.24; ทุกชนิด P46 / § 4.29)
 * progress 0–1 ตลอด [startS − enter, startS + exit), 0.5 = เตะถัง/ปล่อยของ; null = ไม่มี Mascot ในฉาก
 */
export function mascotState(states: readonly ChallengeState[], t: number, cfg: SimConfig): { progress: number; kind: ChallengeKind } | null {
  const { mascotEnterS: enter, mascotExitS: exit } = cfg.challenges;
  for (const s of states) {
    if (!s.surprise || s.repaired) continue;
    if (t >= s.startS - enter && t < s.startS + exit) {
      // ครึ่งแรก = วิ่งเข้า, ครึ่งหลัง = วิ่งออก (ยืดตาม enter/exit แต่ละช่วง)
      const progress = t < s.startS ? 0.5 * (t - (s.startS - enter)) / enter : 0.5 + 0.5 * (t - s.startS) / exit;
      return { progress, kind: s.kind };
    }
  }
  return null;
}

export const mascotProgress = (states: readonly ChallengeState[], t: number, cfg: SimConfig): number | null =>
  mascotState(states, t, cfg)?.progress ?? null;

/** ไฟดับ ณ เวลา t หรือไม่ (ใช้ได้ก่อน step เพื่อหยุดนับโดส) */
export const outageAt = (states: readonly ChallengeState[], t: number): boolean =>
  states.some((s) => s.kind === 'powerOutage' && s.durationS !== null && t >= s.startS && t < s.startS + s.durationS);

