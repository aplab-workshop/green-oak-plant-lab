import { sensorStatus, type HistorySample, type LabSnapshot, type PlayerDevice, type SensorStatus } from '@gol/shared';

/**
 * ตรรกะหน้าเกม (SPEC § 4.9) — Pure function จาก Snapshot/History ของ Server ไม่คำนวณพืชเอง
 */

export type Trend = 'up' | 'down' | 'flat';

export interface Gauge {
  key: 'water' | 'nutrient' | 'air' | 'light' | 'ph';
  icon: string;
  label: string;
  value: string;
  status: SensorStatus;
  trend: Trend;
}

const RANK: Record<SensorStatus, number> = { neutral: 0, ok: 1, warn: 2, alarm: 3 };
const worse = (a: SensorStatus, b: SensorStatus): SensorStatus => (RANK[a] >= RANK[b] ? a : b);

/** กลางวันตามเวลาจำลอง (06:00–22:00 เหมือนสูตรดูแล) */
export const isDaytime = (minuteOfDay: number): boolean => minuteOfDay >= 360 && minuteOfDay < 1320;

/** ลูกศรแนวโน้มจาก History 2 จุดล่าสุด (เปลี่ยนน้อยกว่า eps = คงที่) */
export function trendOf(history: readonly HistorySample[], key: keyof HistorySample, eps: number): Trend {
  const a = history.at(-2);
  const b = history.at(-1);
  if (!a || !b) return 'flat';
  const d = (b[key] as number) - (a[key] as number);
  return d > eps ? 'up' : d < -eps ? 'down' : 'flat';
}

/** สถานะแสง: เปิดไฟดูช่วง PPFD, ปิดไฟตอนกลางวัน = เหลือง, กลางคืน = ปกติ */
export function lightStatus(ppfd: number, ledPct: number, minuteOfDay: number): SensorStatus {
  if (ledPct <= 0) return isDaytime(minuteOfDay) ? 'warn' : 'neutral';
  if (ppfd >= 200 && ppfd <= 350) return 'ok';
  if (ppfd >= 100 && ppfd <= 500) return 'warn';
  return 'alarm';
}

export function gauges(s: LabSnapshot, history: readonly HistorySample[]): Gauge[] {
  const r = s.sensors;
  const out: Gauge[] = [
    { key: 'water', icon: '💧', label: 'น้ำ', value: `${r.waterLevelPct.toFixed(0)}%`, status: sensorStatus('waterLevelPct', r.waterLevelPct), trend: trendOf(history, 'waterLevelPct', 0.3) },
    { key: 'nutrient', icon: '🧪', label: 'ปุ๋ย', value: r.ecMsCm.toFixed(2), status: sensorStatus('ecMsCm', r.ecMsCm), trend: trendOf(history, 'ecMsCm', 0.01) },
    {
      key: 'air',
      icon: '🌡️',
      label: 'อากาศ',
      value: `${r.airTempC.toFixed(1)}° · ${r.rhPct.toFixed(0)}%`,
      status: worse(sensorStatus('airTempC', r.airTempC), sensorStatus('rhPct', r.rhPct)),
      trend: trendOf(history, 'airTempC', 0.2),
    },
    {
      key: 'light',
      icon: '☀️',
      label: 'แสง',
      value: s.commands.ledPct > 0 ? `${r.ppfd.toFixed(0)}` : isDaytime(s.sim.minuteOfDay) ? 'ไฟปิด' : 'กลางคืน',
      status: lightStatus(r.ppfd, s.commands.ledPct, s.sim.minuteOfDay),
      trend: trendOf(history, 'ppfd', 5),
    },
  ];
  if (canControl(s, 'phDown')) {
    out.push({ key: 'ph', icon: '⚗️', label: 'pH', value: r.ph.toFixed(2), status: sensorStatus('ph', r.ph), trend: trendOf(history, 'ph', 0.01) });
  }
  return out;
}

/** ผู้เล่นคุมอุปกรณ์นี้ได้ในด่านปัจจุบัน (Free Play = ได้ทุกอย่าง) */
export const canControl = (s: LabSnapshot, d: PlayerDevice): boolean => !s.level || s.level.playerDevices.includes(d);

export interface GoalProgress {
  /** Biomass ต่ำสุดของต้นที่รอด (g) */
  minG: number;
  targetG: number;
  /** 0–1 */
  ratio: number;
}

/** เป้าหมาย: ทุกต้นที่รอดต้องถึงเป้า → ดูต้นที่เล็กที่สุด */
export function goalProgress(s: LabSnapshot): GoalProgress {
  const dead = new Set(s.game.deadPlantIds);
  const alive = s.plants.filter((p) => !dead.has(p.id));
  const minG = alive.length ? Math.min(...alive.map((p) => p.biomassG)) : 0;
  const targetG = s.game.targetG;
  return { minG, targetG, ratio: targetG > 0 ? Math.min(1, minG / targetG) : 0 };
}

export type Tone = 'info' | 'good' | 'warn' | 'danger';

export interface HelperMessage {
  text: string;
  tone: Tone;
}

const ADVICE: Record<string, string> = {
  heatWave: 'เตรียมเปิดพัดลมและลดไฟ LED ช่วงร้อน',
  leak: 'เติมน้ำให้พร้อม แล้วกด 🔧 ซ่อมถังทันทีที่รั่ว',
  powerOutage: 'เติมน้ำและปุ๋ยให้พอก่อนไฟดับ',
  dryAir: 'เตรียมเปิดเครื่องทำหมอก',
  alkalineTap: 'เติมน้ำทีละน้อย และใช้ pH Down ถ้า pH สูง',
};

/** ข้อความผู้ช่วยหนึ่งข้อความตามลำดับความสำคัญ (SPEC § 4.9) */
export function helperMessage(s: LabSnapshot): HelperMessage {
  const g = s.game;
  const r = s.sensors;
  const cmd = s.commands;
  const own = (d: PlayerDevice) => canControl(s, d);
  if (g.status === 'ready') return { text: 'อ่านภารกิจแล้วกด "เริ่มปลูก 🌱" เพื่อเริ่มด่าน', tone: 'info' };
  if (g.status === 'won') return { text: `เก่งมาก! เก็บเกี่ยวได้ ${g.yieldG?.toFixed(0) ?? 0} g ${'⭐'.repeat(g.stars)} — ไปด่านถัดไปได้เลย`, tone: 'good' };
  if (g.status === 'lost') return { text: 'รอบนี้ยังไม่สำเร็จ ดูสาเหตุแล้วลองปลูกใหม่อีกครั้งนะ', tone: 'danger' };
  if (s.failsafe) return { text: 'PLC ไม่ตอบสนอง (Fail-safe) — อุปกรณ์ปิดหมดยกเว้นปั๊มลม เปลี่ยนเป็นโหมด Manual ในลิ้นชัก 🔬', tone: 'danger' };

  const active = s.challenges.filter((c) => c.status === 'active');
  if (active.some((c) => c.kind === 'powerOutage')) return { text: '⚡ ไฟดับ! อุปกรณ์หยุดหมด รอให้ไฟกลับมา แล้วค่อยเช็คน้ำและอากาศ', tone: 'danger' };
  if (active.some((c) => c.kind === 'leak')) return { text: '💧 ถังรั่ว! กด 🔧 ซ่อมถังบนการ์ดเหตุการณ์ แล้วเติมน้ำ', tone: 'danger' };
  const warned = s.challenges.filter((c) => c.status === 'warned').sort((a, b) => a.startS - b.startS)[0];
  if (warned) return { text: `${warned.title} กำลังจะมา — ${ADVICE[warned.kind] ?? 'เตรียมตัวไว้'}`, tone: 'warn' };

  if (g.canHarvest) return { text: '🎉 ผักทุกต้นถึงเป้าแล้ว กด "เก็บเกี่ยว" ได้เลย!', tone: 'good' };

  if (r.waterLevelPct < 65) {
    return { text: `น้ำเหลือ ${r.waterLevelPct.toFixed(0)}% — ${own('refillPump') ? 'กด 🚰 เติมน้ำ (+10% ต่อกด)' : 'ผู้ช่วยฟาร์มกำลังเติมให้'}`, tone: r.waterLevelPct < 55 ? 'danger' : 'warn' };
  }
  const dead = new Set(g.deadPlantIds);
  const thirsty = s.plants.filter((p) => !dead.has(p.id) && p.waterStress > 0.3).sort((a, b) => b.waterStress - a.waterStress)[0];
  if (thirsty) return { text: `ต้นที่ ${thirsty.id} ขาดน้ำ ใบเริ่มตก — เช็คระดับน้ำและรากว่าแช่น้ำพอไหม`, tone: 'warn' };

  if (r.ecMsCm < 0.8) return { text: `ผักหิวปุ๋ย (EC ${r.ecMsCm.toFixed(2)}) — ${own('nutrient') ? 'กด 🧪 ใส่ปุ๋ย แล้วรอดูค่า' : 'ผู้ช่วยฟาร์มกำลังเติมปุ๋ยให้'}`, tone: 'warn' };
  if (r.ecMsCm > 1.6) return { text: `ปุ๋ยเข้มเกิน (EC ${r.ecMsCm.toFixed(2)}) — เติมน้ำเพื่อเจือจาง และหยุดใส่ปุ๋ยก่อน`, tone: 'warn' };
  if (r.ph > 6.6) return { text: `pH สูง (${r.ph.toFixed(2)}) — ${own('phDown') ? 'กด ⚗️ pH Down 1 โดส' : 'ผู้ช่วยฟาร์มกำลังปรับให้'}`, tone: 'warn' };

  if (r.airTempC > 25.5 && !cmd.fan) return { text: `อากาศร้อน ${r.airTempC.toFixed(1)} °C — ${own('fan') ? 'เปิด 🌀 พัดลม หรือลดไฟ LED' : 'ลดไฟ LED ลงสักหน่อย'}`, tone: 'warn' };
  if (r.rhPct < 55 && !cmd.humidifier && own('humidifier')) return { text: `อากาศแห้ง (${r.rhPct.toFixed(0)}%) — เปิด 🌫️ เครื่องทำหมอก`, tone: 'warn' };

  const day = isDaytime(s.sim.minuteOfDay);
  if (day && cmd.ledPct === 0) return { text: 'กลางวันแล้ว ผักต้องการแสง — กด 💡 80%', tone: 'warn' };
  if (!day && cmd.ledPct > 0) return { text: 'กลางคืนแล้ว ปิด 💡 ไฟเพื่อประหยัดงบไฟ (ผักพักผ่อน)', tone: 'info' };
  if (!cmd.airPump) return { text: 'ปั๊มลมปิดอยู่ รากต้องการอากาศ — เปิด 🫧 ปั๊มลม', tone: 'warn' };

  const goal = goalProgress(s);
  return { text: `ทุกอย่างดี 👍 ต้นที่เล็กที่สุด ${goal.minG.toFixed(1)} / ${goal.targetG} g`, tone: 'good' };
}
