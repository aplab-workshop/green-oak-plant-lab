import {
  COMMAND_BITS,
  FAN_COMMAND_REGISTER,
  LED_COMMAND_REGISTER,
  type ActuatorCommands,
  type MockPlcMode,
  type PlcStatus,
} from '@gol/shared';
import { DeviceMemory } from './DeviceMemory';
import { autoProgramScan, clearCommands } from './mockPrograms';
import { PlcCommError, encodeSensorWrite, type CommandRead, type PlcAdapter, type SensorWrite } from './PlcAdapter';

type BitKey = (typeof COMMAND_BITS)[number]['key'];

/**
 * Mock PLC (FR-30) — จำลอง Device memory ของ FX5U ทำให้ Data path เหมือน SLMP จริง
 * - Gateway เขียน D100–D112, D120 และอ่าน M101–M106, D200–D201 ผ่าน API เดียวกับ SLMP (P48: พัดลม D201)
 * - manual: UI สั่ง M/D ภายใน "PLC" (แทนนักเรียนกดสวิตช์) ไม่ใช่ผ่าน Gateway
 * - auto: รัน autoProgramScan เหมือน Ladder ทุกครั้งที่ PLC scan
 * - offline: จำลองสายหลุด ทุกการสื่อสาร throw PlcCommError
 */
export class MockPlcAdapter implements PlcAdapter {
  readonly kind = 'mock' as const;
  readonly memory = new DeviceMemory();
  private _mode: MockPlcMode;
  private connected = false;
  private lastOkAt: number | null = null;
  private errorCount = 0;
  private lastError: string | null = null;

  constructor(
    mode: MockPlcMode = 'auto',
    private readonly now: () => number = Date.now,
  ) {
    this._mode = mode;
    clearCommands(this.memory);
  }

  get mode(): MockPlcMode {
    return this._mode;
  }

  setMode(mode: MockPlcMode): void {
    if (mode === this._mode) return;
    // เปลี่ยนระหว่าง manual/auto ให้เริ่มจากคำสั่งที่ปลอดภัย
    if (mode !== 'offline' && this._mode !== 'offline') clearCommands(this.memory);
    this._mode = mode;
  }

  /** Manual mode: สั่ง Actuator แบบ bit ภายใน PLC */
  setManualBit(key: BitKey, value: boolean): void {
    this.requireManual();
    const bit = COMMAND_BITS.find((b) => b.key === key);
    if (!bit) throw new Error(`unknown actuator ${key}`);
    this.memory.setM(bit.address, value);
  }

  /** Manual mode: ตั้งความเร็วพัดลม (D201) ภายใน PLC — P48 */
  setManualFan(pct: number): void {
    this.requireManual();
    this.memory.setD(FAN_COMMAND_REGISTER.address, pct);
  }

  /** Manual mode: ตั้งความสว่าง LED (D200) ภายใน PLC */
  setManualLed(pct: number): void {
    this.requireManual();
    this.memory.setD(LED_COMMAND_REGISTER.address, pct);
  }

  async connect(): Promise<void> {
    this.connected = this._mode !== 'offline';
  }

  async close(): Promise<void> {
    this.connected = false;
  }

  async writeSensors(data: SensorWrite): Promise<{ clamped: string[] }> {
    this.checkLink();
    const { words, clamped } = encodeSensorWrite(data);
    for (const w of words) this.memory.setD(w.address, w.raw);
    this.ok();
    return { clamped };
  }

  async readCommands(): Promise<CommandRead> {
    this.checkLink();
    if (this._mode === 'auto') autoProgramScan(this.memory);

    const commands = Object.fromEntries(COMMAND_BITS.map((b) => [b.key, this.memory.getM(b.address)])) as Omit<
      ActuatorCommands,
      'ledPct' | 'fanPct'
    >;
    const outOfRange: string[] = [];
    const word = (reg: { address: number; min: number; max: number }) => {
      const raw = this.memory.getD(reg.address);
      const v = Math.min(reg.max, Math.max(reg.min, raw));
      if (v !== raw) outOfRange.push(`D${reg.address} = ${raw}`);
      return v;
    };
    const ledPct = word(LED_COMMAND_REGISTER);
    const fanPct = word(FAN_COMMAND_REGISTER);
    this.ok();
    return { commands: { ...commands, ledPct, fanPct }, at: this.now(), outOfRange };
  }

  status(): PlcStatus {
    return {
      kind: 'mock',
      mode: this._mode,
      connection: this._mode === 'offline' ? 'offline' : this.connected ? 'connected' : 'connecting',
      lastOkAt: this.lastOkAt,
      latencyMs: this._mode === 'offline' ? null : 0,
      errorCount: this.errorCount,
      lastError: this.lastError,
    };
  }

  private checkLink(): void {
    if (this._mode === 'offline') {
      this.errorCount++;
      this.lastError = 'Mock PLC offline (simulated cable disconnect)';
      this.connected = false;
      throw new PlcCommError(this.lastError);
    }
    this.connected = true;
  }

  private ok(): void {
    this.lastOkAt = this.now();
    this.lastError = null;
  }

  private requireManual(): void {
    if (this._mode !== 'manual') throw new Error('Manual control is available in manual mode only');
  }
}
