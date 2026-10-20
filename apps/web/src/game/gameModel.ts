import { isDaytime, type LabSnapshot, type PlayerDevice } from '@gol/shared';

/**
 * ตรรกะหน้าเกม (SPEC § 4.9) — Pure function จาก Snapshot/History ของ Server ไม่คำนวณพืชเอง
 */


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
  if (s.failsafe) return { text: 'PLC ไม่ตอบสนอง (Fail-safe) — อุปกรณ์ปิดหมดยกเว้นปั๊มลม เปลี่ยนเป็นโหมด Manual ในแผงควบคุม', tone: 'danger' };

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
