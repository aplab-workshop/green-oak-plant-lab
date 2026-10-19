import type { CareProgress, EventEntry, HistorySample, PlantState } from '@gol/shared';

/**
 * เล่าเรื่อง "ทำไมรอบนี้แพ้" แบบเข้าใจง่ายจาก Event/History/State ที่ Server ส่งมา
 * อ่านอย่างเดียว ไม่คำนวณพืชใหม่ — ค่า Stress ของต้นที่ตายถูก Server คงไว้ ณ ตอนตาย
 */

export type Cause = 'water' | 'heat' | 'nutrient' | 'root' | 'dark';

export interface StoryLine { when: string; icon: string; text: string }
export interface LossStory {
  intro: string;
  lines: StoryLine[];
  ending: string;
  /** สาเหตุหลักเรียงจากมากไปน้อย */
  causes: { cause: Cause; plants: number }[];
  tips: string[];
}

export const CAUSE_LABEL: Record<Cause, string> = {
  water: '💧 ขาดน้ำ',
  heat: '🔥 ร้อน/แสงแรงเกิน',
  nutrient: '🧪 ปุ๋ยหรือ pH ไม่เหมาะ',
  root: '🫧 รากขาดอากาศ',
  dark: '🌑 แสงไม่พอ',
};

const TIP: Record<Cause, string> = {
  water: 'เช็คระดับน้ำบ่อย ๆ ต่ำกว่า 70% ให้กด 🚰 เติมน้ำ (+10% ต่อกด) จนถึงราว 90%',
  heat: 'ใช้ไฟ 80% ไม่ต้อง 100% และเปิดพัดลมเมื่ออากาศเกิน 25 °C',
  nutrient: 'รักษา EC ให้อยู่ 0.8–1.6 — ต่ำกว่า 1.0 ใส่ปุ๋ย A+B แป๊บเดียว สูงเกินให้เติมน้ำเจือจาง',
  root: 'เปิดปั๊มลมไว้ตลอดเวลา รากต้องหายใจ',
  dark: 'เปิดไฟ LED 80% ตั้งแต่ 06:00 ถึง 22:00 ทุกวัน ผักต้องใช้แสงสร้างอาหาร',
};

/** สาเหตุหลักของต้นจากค่า Stress ที่ Server คงไว้ ณ ตอนตาย */
export function plantCause(p: Pick<PlantState, 'waterStress' | 'hydration' | 'lightStress' | 'nutrientStress' | 'rootHealth'>): Exclude<Cause, 'dark'> {
  const scores: [Exclude<Cause, 'dark'>, number][] = [
    ['water', Math.max(p.waterStress, 1 - p.hydration)],
    ['heat', p.lightStress],
    ['nutrient', p.nutrientStress],
    ['root', 1 - p.rootHealth],
  ];
  return scores.reduce((best, s) => (s[1] > best[1] ? s : best))[0];
}

const plantName = (id: number) => `ต้นที่ ${id}`;

function nutrientText(ec: number | undefined): string {
  if (ec === undefined) return 'ได้อาหารไม่พอดี';
  if (ec < 0.8) return `หิวปุ๋ย เพราะ EC เหลือแค่ ${ec.toFixed(2)}`;
  if (ec > 1.6) return `เจอปุ๋ยเข้มเกินไป (EC ${ec.toFixed(2)})`;
  return 'ดูดอาหารได้ไม่ดี เพราะ pH ไม่เหมาะ';
}

export function buildLossStory(
  game: Pick<CareProgress, 'lostReason' | 'elapsedS' | 'endedAtS' | 'targetG' | 'timeLimitS' | 'deadPlantIds' | 'totalPlants'>,
  plants: readonly PlantState[],
  events: readonly EventEntry[],
  history: readonly HistorySample[],
): LossStory {
  const endS = game.endedAtS ?? 0;
  const startS = endS - game.elapsedS;
  const when = (t: number) => {
    const day = Math.floor((t - startS) / 86_400) + 1;
    const m = Math.floor((((t % 86_400) + 86_400) % 86_400) / 60);
    return `วันที่ ${day} · ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  const sampleAt = (t: number) => history.reduce<HistorySample | undefined>((best, h) =>
    !best || Math.abs(h.simTimeS - t) < Math.abs(best.simTimeS - t) ? h : best, undefined);
  const inRound = events.filter((e) => e.simTimeS >= startS && e.simTimeS <= endS).sort((a, b) => a.simTimeS - b.simTimeS || a.id - b.id);
  const first = (kind: string) => inRound.find((e) => e.kind === kind);

  const timed: (StoryLine & { t: number })[] = [];
  const add = (e: EventEntry | undefined, icon: string, text: (e: EventEntry) => string) => {
    if (e) timed.push({ t: e.simTimeS, when: when(e.simTimeS), icon, text: text(e) });
  };
  const roundSamples = history.filter((h) => h.simTimeS >= startS && h.simTimeS <= endS);
  const neverLit = roundSamples.length > 0 && roundSamples.every((h) => h.ppfd < 1);
  if (neverLit) timed.push({ t: -Infinity, when: 'ตลอดรอบ', icon: '🌑', text: 'ไฟ LED ไม่เคยเปิดเลย ผักไม่มีแสงสร้างอาหาร จึงแทบไม่โต' });

  add(first('tank.roots_exposed'), '💧', (e) => `น้ำในถังลดลงเหลือ ${Math.round(sampleAt(e.simTimeS)?.waterLevelPct ?? 0)}% รากของผักบางต้นลอยพ้นน้ำ ดื่มน้ำไม่ได้`);
  add(first('tank.empty'), '🏜️', () => 'ถังน้ำแห้งสนิท ไม่เหลือน้ำให้ผักดื่มเลย');
  add(first('plant.water_stress'), '😟', (e) => `${plantName(e.plantId!)} เริ่มกระหายน้ำ`);
  add(first('plant.light_stress'), '🔥', (e) => `${plantName(e.plantId!)} โดนแสงแรงและความร้อนจนใบเริ่มม้วน`);
  add(first('plant.nutrient_stress'), '🧪', (e) => `${plantName(e.plantId!)} ${nutrientText(sampleAt(e.simTimeS)?.ecMsCm)}`);
  add(first('plant.root_stress'), '🫧', (e) => `รากของ${plantName(e.plantId!)}หายใจไม่ออก (ปั๊มลมปิดหรือน้ำอุ่นเกินไป)`);
  add(first('plant.wilting'), '🥀', (e) => `${plantName(e.plantId!)} ใบเหี่ยวห้อยลง เริ่มบาดเจ็บแบบรักษาไม่หาย`);
  // เรียงตามเวลา แล้วต่อด้วยการตาย (จัดกลุ่มต้นที่ตายวันเดียวกัน)
  const lines: StoryLine[] = timed.sort((a, b) => a.t - b.t).map(({ t: _t, ...l }) => l);
  const deaths = inRound.filter((e) => e.kind === 'plant.died' && e.plantId !== undefined);
  const byDay = new Map<string, number[]>();
  for (const d of deaths) {
    const day = when(d.simTimeS).split(' · ')[0]!;
    byDay.set(day, [...(byDay.get(day) ?? []), d.plantId!]);
  }
  let firstDeath = true;
  for (const [day, ids] of byDay) {
    const who = ids.length === game.totalPlants && ids.length > 1 ? `ผักทั้ง ${ids.length} ต้น` : ids.map(plantName).join(', ');
    lines.push({ when: day, icon: '💀', text: `${who} ${firstDeath ? 'ทนไม่ไหวและตายไป' : 'ตายตามไป'}` });
    firstDeath = false;
  }

  const counts = new Map<Cause, number>();
  for (const p of plants) if (game.deadPlantIds.includes(p.id)) counts.set(plantCause(p), (counts.get(plantCause(p)) ?? 0) + 1);
  if (game.lostReason === 'timeout') {
    for (const p of plants) if (!game.deadPlantIds.includes(p.id) && p.biomassG < game.targetG) {
      const c: Cause = neverLit ? 'dark' : plantCause(p);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  const causes = [...counts].map(([cause, n]) => ({ cause, plants: n })).sort((a, b) => b.plants - a.plants);

  const alive = plants.filter((p) => !game.deadPlantIds.includes(p.id));
  const smallest = alive.reduce((m, p) => Math.min(m, p.biomassG), Infinity);
  const intro = 'ต้นกล้า 6 ต้นถูกปลูกลงถังน้ำ ทุกต้นยังสดชื่นและพร้อมจะโต 🌱';
  const ending = game.lostReason === 'timeout'
    ? `ครบ ${Math.round((game.timeLimitS ?? 0) / 86_400)} วันแล้ว ต้นที่เล็กที่สุดหนักแค่ ${Number.isFinite(smallest) ? smallest.toFixed(1) : '0'} g แต่เป้าหมายคือ ${game.targetG} g — ผักโตไม่ทันเวลา ⏰`
    : 'ไม่เหลือผักที่มีชีวิตอยู่เลย สวนรอบนี้จึงจบลง… แต่เราเรียนรู้แล้วว่าต้องระวังอะไร 💪';
  if (!lines.length) lines.push({ when: when(endS), icon: '❓', text: 'ผักค่อย ๆ อ่อนแอลงทีละน้อยโดยไม่มีสัญญาณเตือนชัดเจน — ลองเปิดกราฟ Plant Stress ดู' });
  // ไฟไม่เคยเปิดเป็นปัญหาร่วมเสมอ แม้ไม่ใช่สาเหตุที่ทำให้ตาย
  const tipCauses = [...new Set<Cause>([...causes.map((c) => c.cause), ...(neverLit ? ['dark' as const] : [])])];
  return { intro, lines, ending, causes, tips: tipCauses.map((c) => TIP[c]) };
}
