import { minuteOfDay } from '@gol/sim-core';
import type { RunLogEvent } from '@gol/shared';
import type { RunLogRow } from './AccountStore';

/** CSV ของ Log การเล่น (W4 / SPEC § 4.41) — UTF-8 + BOM ให้ Excel อ่านภาษาไทยได้ */

export const CSV_HEADER = ['เวลาจริง', 'ผู้เล่น', 'รหัสเชิญ', 'ด่าน', 'รอบ', 'วันจำลอง', 'เวลาจำลอง', 'ชนิด', 'รายละเอียด', 'ค่า'] as const;
export const CSV_TIME_ZONE = 'Asia/Bangkok';

/** ชนิดเหตุการณ์ → คำไทย (เช็กแบบตรงตัวก่อน แล้วค่อยตามคำนำหน้า) */
const KIND_EXACT: Record<string, string> = {
  'game.start': 'เริ่มเล่น',
  'game.won': 'จบรอบ (ชนะ)',
  'game.over': 'จบรอบ (แพ้)',
  'game.autopause': 'ผู้ช่วยหยุดเกม',
  'game.autopause_setting': 'ตั้งค่าผู้ช่วยหยุดเกม',
  'actuator.change': 'ปรับอุปกรณ์',
  'dose.start': 'เริ่มโดส',
  'dose.done': 'โดสเสร็จ',
  'dose.cancel': 'ยกเลิกโดส',
  'sim.speed': 'เปลี่ยน Speed',
  'sim.pause': 'หยุดเวลา',
  'sim.resume': 'เดินเวลาต่อ',
  'lab.reset': 'เริ่มรอบใหม่',
  'tank.low_water': 'แจ้งเตือนน้ำ',
  'tank.ec_alert': 'แจ้งเตือน EC',
  'plant.stage': 'ผักเปลี่ยนระยะ',
  'run.abandoned': 'ออกกลางคัน',
};
const KIND_PREFIX: [string, string][] = [
  ['challenge.', 'เหตุการณ์ของด่าน'],
  ['plant.', 'ผัก'],
  ['tank.', 'ถังน้ำ'],
  ['alert.', 'แจ้งเตือน'],
  ['air.', 'แจ้งเตือนอากาศ'],
  ['water.', 'แจ้งเตือนน้ำ'],
  ['nutrient.', 'แจ้งเตือนธาตุอาหาร'],
  ['plc.', 'PLC'],
  ['sensor.', 'Sensor'],
  ['command.', 'คำสั่ง'],
  ['game.', 'เกม'],
];

export function kindLabel(kind: string): string {
  return KIND_EXACT[kind] ?? KIND_PREFIX.find(([p]) => kind.startsWith(p))?.[1] ?? kind;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-24 09:05:07" ตามเวลาไทย */
export function formatRealTime(ms: number): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: CSV_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/** ช่อง CSV: ครอบ " เมื่อจำเป็น; ข้อความขึ้นต้น = + - @ ใส่ ' นำหน้า (กันสูตร Excel) */
export function csvCell(value: string | number | undefined, text = false): string {
  if (value === undefined) return '';
  let s = String(value);
  if (text && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * แถว CSV ของหลายรอบ — เรียง ผู้เล่น → ด่าน → รอบ (ตามเวลาที่ส่ง) → ลำดับเหตุการณ์
 * รอบ = ลำดับรอบของผู้เล่นคนนั้นในด่านนั้น
 */
export function buildRunLogCsv(logs: RunLogRow[]): string {
  const sorted = [...logs].sort(
    (a, b) => a.username.localeCompare(b.username) || a.levelId.localeCompare(b.levelId) || a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id,
  );
  const lines = [CSV_HEADER.join(',')];
  const roundNo = new Map<string, number>();
  for (const log of sorted) {
    const key = `${log.username}\u0000${log.levelId}`;
    const round = (roundNo.get(key) ?? 0) + 1;
    roundNo.set(key, round);
    for (const e of log.events as RunLogEvent[]) {
      const minute = minuteOfDay(e.simTimeS);
      lines.push(
        [
          csvCell(formatRealTime(e.at)),
          csvCell(log.username),
          csvCell(log.inviteCode),
          csvCell(log.levelId),
          csvCell(round),
          csvCell(Math.floor(e.simTimeS / 86_400)),
          csvCell(`${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`),
          csvCell(kindLabel(e.kind)),
          csvCell(e.message, true),
          csvCell(e.value, true),
        ].join(','),
      );
    }
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}
