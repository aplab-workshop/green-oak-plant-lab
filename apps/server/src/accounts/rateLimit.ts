/**
 * จำกัดจำนวนครั้งต่อช่วงเวลา (W2 / SPEC § 4.39) — เก็บในหน่วยความจำของ Server (รีสตาร์ทแล้วเริ่มนับใหม่)
 * Fixed window ต่อ key: ครบ limit ภายใน windowMs → บล็อกจนหมดช่วง
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** วินาทีที่ต้องรอ (0 = ยังไม่โดนบล็อก) */
  retryAfterS(key: string): number {
    const h = this.current(key);
    return h && h.count >= this.limit ? Math.max(1, Math.ceil((h.resetAt - this.now()) / 1000)) : 0;
  }

  hit(key: string): void {
    const h = this.current(key);
    if (h) h.count++;
    else this.hits.set(key, { count: 1, resetAt: this.now() + this.windowMs });
    if (this.hits.size > 10_000) this.sweep();
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  private current(key: string) {
    const h = this.hits.get(key);
    if (h && h.resetAt <= this.now()) {
      this.hits.delete(key);
      return undefined;
    }
    return h;
  }

  private sweep(): void {
    const t = this.now();
    for (const [k, h] of this.hits) if (h.resetAt <= t) this.hits.delete(k);
  }
}
