import type { ActuatorKey, PlayerDevice } from '@gol/shared';

/**
 * เหตุผลของอุปกรณ์แต่ละตัว (SPEC § 4.15–4.17): ปัญหา → อุปกรณ์ → ผลดี → ผลข้างเคียง
 * ข้อความสอนอย่างเดียว ตรงกับ Model บน Server และ Scenario tests ใน sim-core/test/deviceRationale.test.ts
 */
export interface DeviceRationale {
  /** ปัญหาที่อุปกรณ์นี้แก้ */
  problem: string;
  /** ผลดีเมื่อใช้ถูก */
  benefit: string;
  /** ผลข้างเคียง / ใช้เกิน */
  caution: string;
}

export const DEVICE_RATIONALE: Record<ActuatorKey, DeviceRationale> = {
  fan: {
    problem: 'อากาศร้อนเกิน 25 °C (ไฟ LED ทำให้ร้อน) ผักโตช้า',
    benefit: 'ระบายความร้อนให้อุณหภูมิเข้าใกล้อุณหภูมิห้อง',
    caution: 'เย็นได้ไม่ต่ำกว่าห้อง และทำให้อากาศแห้งลง อาจต้องเปิดหมอก',
  },
  humidifier: {
    problem: 'อากาศ "แห้ง" (VPD สูง) ต่อเนื่อง ผักโตช้าแม้น้ำพอ และดื่มน้ำมากขึ้น',
    benefit: 'อากาศชื้นขึ้น กลับมา "เหมาะสม" ความเครียดค่อย ๆ ฟื้น ความต้องการน้ำลด',
    caution: 'เปิดค้างจน "ชื้นจัด" (VPD ต่ำ) ผักลำเลียงธาตุอาหารได้น้อย โตช้า — ชื้นพอแล้วให้ปิด',
  },
  ledPct: {
    problem: 'แสงน้อยผักโตช้า ไม่มีแสงผักไม่โตเลย',
    benefit: 'แสงพอดี (PPFD 200–350 ตอนเปิด) ผักโตเต็มที่',
    caution: 'แสงแรงเกินใบม้วน, เปิดนานเกิน ~18 ชม. ผักเครียด (ต้องมีช่วงมืดพัก), ไฟทำให้ร้อนและผักดื่มน้ำมากขึ้น',
  },
  refillPump: {
    problem: 'น้ำต่ำจนรากไม่ถึงน้ำ ผักขาดน้ำ เหี่ยว โตช้า',
    benefit: 'รากแช่น้ำอีกครั้ง ผักได้น้ำกลับมา',
    caution: 'เปิดจนล้น: เสียน้ำและปุ๋ย (EC ลด pH ขยับขึ้นหาน้ำประปา) หักคะแนน 10 ต่อลิตร และเสียไฟ',
  },
  nutrientA: {
    problem: 'EC ต่ำ ผักหิวปุ๋ย โตช้า',
    benefit: 'ให้ปุ๋ย A และ B พร้อมกันจน EC กลับ 0.8–1.6 ผักโตตามปกติ',
    caution: 'EC อยู่ในช่วงแล้วเติมอีกไม่ได้ทำให้โตเร็วขึ้น · เกิน 1.6 ผักเครียด',
  },
  nutrientB: {
    problem: 'EC ต่ำ ผักหิวปุ๋ย โตช้า',
    benefit: 'ให้ปุ๋ย A และ B พร้อมกันจน EC กลับ 0.8–1.6 ผักโตตามปกติ',
    caution: 'EC อยู่ในช่วงแล้วเติมอีกไม่ได้ทำให้โตเร็วขึ้น · เกิน 1.6 ผักเครียด',
  },
  airPump: {
    problem: 'Oxygen ในน้ำต่ำ รากทำงานไม่ดี ดูดน้ำได้น้อย',
    benefit: 'รากแข็งแรง ดูดน้ำได้เต็มที่ — ปกติเปิดตลอด',
    caution: 'ปิดนาน Root health ลด ผักโตช้าและขาดน้ำได้แม้น้ำเต็มถัง',
  },
  phDown: {
    problem: 'pH สูงเกิน 6.6 ผักใช้ธาตุอาหารได้น้อย โตช้าแม้ EC พอ',
    benefit: 'กดทีละโดส (−0.2) แล้วรอดูผล ให้ pH กลับ 5.5–6.5',
    caution: 'เปิดค้างจน pH ต่ำกว่า 5.5 ผักเครียดเหมือนกัน — อย่ากดซ้ำรัว ๆ',
  },
};

/** อุปกรณ์ที่ผู้เล่นคุม → Actuator key สำหรับดึงเหตุผล */
export const PLAYER_DEVICE_KEY: Record<PlayerDevice, ActuatorKey> = {
  led: 'ledPct', refillPump: 'refillPump', nutrient: 'nutrientA', fan: 'fan', humidifier: 'humidifier', airPump: 'airPump', phDown: 'phDown',
};
