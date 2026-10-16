import { INT16_MAX, INT16_MIN } from '@gol/shared';

/**
 * หน่วยความจำ Device จำลองของ FX5U (ใช้ใน Mock PLC)
 * D0–D7999 (INT16), M0–M7679 (bit)
 */
export class DeviceMemory {
  readonly D = new Int16Array(8000);
  readonly M = new Uint8Array(7680);

  getD(address: number): number {
    this.checkRange('D', address, this.D.length);
    return this.D[address]!;
  }

  setD(address: number, value: number): void {
    this.checkRange('D', address, this.D.length);
    this.D[address] = Math.max(INT16_MIN, Math.min(INT16_MAX, Math.round(value)));
  }

  getM(address: number): boolean {
    this.checkRange('M', address, this.M.length);
    return this.M[address] === 1;
  }

  setM(address: number, value: boolean): void {
    this.checkRange('M', address, this.M.length);
    this.M[address] = value ? 1 : 0;
  }

  private checkRange(kind: string, address: number, size: number): void {
    if (!Number.isInteger(address) || address < 0 || address >= size) throw new RangeError(`${kind}${address} out of range`);
  }
}
