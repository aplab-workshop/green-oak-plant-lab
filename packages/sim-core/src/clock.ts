/**
 * SimClock — แยกเวลาจริงกับเวลาจำลอง (FR-01, FR-02)
 *
 * Server เรียก advance(realElapsedMs) ทุก tick แล้ว Clock จะเรียก step(dt) เป็นจำนวนครั้ง
 * ตามเวลาจำลองที่ค้างอยู่ โดย dt คงที่เสมอ ผลลัพธ์จึงไม่ขึ้นกับความถี่ของ tick หรือ FPS
 */

export const SIM_SPEEDS = [1, 60, 360, 1440, 3600] as const;
export type SimSpeed = (typeof SIM_SPEEDS)[number];

export const SECONDS_PER_DAY = 86_400;

export interface ClockOptions {
  /** เวลาจำลองเริ่มต้น (s นับจากวันเพาะ 00:00) */
  startS: number;
  dtS: number;
  maxStepsPerTick: number;
  speed?: SimSpeed;
}

export interface AdvanceResult {
  steps: number;
  /** true ถ้าเครื่องคำนวณไม่ทันและต้องทิ้งเวลาที่ค้าง */
  lagged: boolean;
}

export class SimClock {
  readonly dtS: number;
  private readonly maxStepsPerTick: number;
  private startS: number;
  private _simTimeS: number;
  private _speed: SimSpeed;
  private _paused = false;
  /** เวลาจำลองที่ค้างอยู่แต่ยังไม่ครบ 1 step (s) */
  private dueS = 0;

  constructor(opts: ClockOptions) {
    if (!(opts.dtS > 0)) throw new Error('dtS must be > 0');
    this.dtS = opts.dtS;
    this.maxStepsPerTick = opts.maxStepsPerTick;
    this.startS = opts.startS;
    this._simTimeS = opts.startS;
    this._speed = opts.speed ?? 1;
  }

  get simTimeS(): number {
    return this._simTimeS;
  }
  get speed(): SimSpeed {
    return this._speed;
  }
  get paused(): boolean {
    return this._paused;
  }

  setSpeed(speed: SimSpeed): void {
    if (!SIM_SPEEDS.includes(speed)) throw new Error(`unsupported speed ${speed}`);
    this._speed = speed;
  }
  pause(): void {
    this._paused = true;
  }
  resume(): void {
    this._paused = false;
  }

  /** กลับไปเวลาเริ่มต้น (หรือเวลาใหม่) และล้างเวลาที่ค้าง */
  reset(startS: number = this.startS): void {
    this.startS = startS;
    this._simTimeS = startS;
    this.dueS = 0;
  }

  /**
   * เดินเวลาตามเวลาจริงที่ผ่านไป และเรียก step(dt, simTimeAtStepStart) ทีละ step
   */
  advance(realElapsedMs: number, step: (dtS: number, simTimeS: number) => void): AdvanceResult {
    if (this._paused || realElapsedMs <= 0) return { steps: 0, lagged: false };
    this.dueS += (realElapsedMs / 1000) * this._speed;

    let steps = 0;
    // epsilon กัน floating error ทำให้ขาดไป 1 step
    while (this.dueS + 1e-9 >= this.dtS && steps < this.maxStepsPerTick) {
      step(this.dtS, this._simTimeS);
      this._simTimeS += this.dtS;
      this.dueS -= this.dtS;
      steps++;
    }
    const lagged = this.dueS + 1e-9 >= this.dtS;
    if (lagged) this.dueS = 0;
    if (this.dueS < 0) this.dueS = 0;
    return { steps, lagged };
  }
}

/** เวลาจำลองเป็นวินาทีจาก (วัน, ชั่วโมง) */
export const simTimeFrom = (day: number, hour = 0, minute = 0): number =>
  day * SECONDS_PER_DAY + hour * 3600 + minute * 60;

/** วันนับจากเพาะ */
export const simDay = (simTimeS: number): number => Math.floor(simTimeS / SECONDS_PER_DAY);

/** นาทีของวัน 0–1439 */
export const minuteOfDay = (simTimeS: number): number =>
  Math.floor((((simTimeS % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY) / 60);

/** ชั่วโมงของวันแบบทศนิยม 0–24 */
export const hourOfDay = (simTimeS: number): number =>
  (((simTimeS % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY) / 3600;
