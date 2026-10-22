import type { EventEntry, LabSnapshot, MockPlcMode } from '@gol/shared';
import { MockPlcAdapter } from '../plc/MockPlcAdapter';
import { LabSession } from './LabSession';

export interface LabManagerConfig {
  labCount: number;
  tickMs: number;
  pollMs: number;
  broadcastMs: number;
  commandTimeoutMs: number;
  mockMode: MockPlcMode;
  /** ปลดล็อกทุกด่าน (โหมดผู้พัฒนา, P47) */
  unlockAllLevels?: boolean;
}

export const labIdOf = (n: number): string => `lab${String(n).padStart(2, '0')}`;

/**
 * สร้างและเดินทุก LabSession ด้วย Timer ของเวลาจริง
 * แต่ละ Lab มี Adapter ของตัวเอง (M3/M4: SLMP แยกตาม IP)
 */
export class LabManager {
  readonly labs = new Map<string, LabSession>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private lastTickAt = 0;
  private snapshotListeners = new Set<(s: LabSnapshot) => void>();
  private eventListeners = new Set<(labId: string, e: EventEntry) => void>();

  constructor(private readonly config: LabManagerConfig) {
    for (let i = 1; i <= config.labCount; i++) {
      const labId = labIdOf(i);
      const lab = new LabSession({
        labId,
        adapter: new MockPlcAdapter(config.mockMode),
        commandTimeoutMs: config.commandTimeoutMs,
        // seed ต่างกันต่อ Lab ทำให้ต้นแต่ละ Lab ไม่เหมือนกันทุกประการ
        sim: { seed: i },
        // เกมเริ่มที่ด่านแรก (SPEC § 4.6); Free Play/Scenario เลือกได้ภายหลัง
        level: 'L1',
        unlockAllLevels: config.unlockAllLevels ?? false,
      });
      lab.events.onEvent((e) => this.eventListeners.forEach((l) => l(labId, e)));
      this.labs.set(labId, lab);
    }
  }

  get(labId: string): LabSession | undefined {
    return this.labs.get(labId);
  }

  get labIds(): string[] {
    return [...this.labs.keys()];
  }

  async start(): Promise<void> {
    for (const lab of this.labs.values()) {
      await lab.adapter.connect();
      await lab.poll();
    }
    this.lastTickAt = Date.now();
    this.timers.push(
      setInterval(() => {
        const now = Date.now();
        const elapsed = now - this.lastTickAt;
        this.lastTickAt = now;
        // Lab หนึ่ง error ต้องไม่หยุด Lab อื่น
        for (const lab of this.labs.values()) {
          try {
            lab.tick(elapsed);
          } catch (err) {
            console.error(`[${lab.labId}] tick failed`, err);
          }
        }
      }, this.config.tickMs),
      setInterval(() => {
        for (const lab of this.labs.values()) void lab.poll();
      }, this.config.pollMs),
      setInterval(() => {
        if (this.snapshotListeners.size === 0) return;
        for (const lab of this.labs.values()) {
          const snap = lab.snapshot();
          this.snapshotListeners.forEach((l) => l(snap));
        }
      }, this.config.broadcastMs),
    );
  }

  async stop(): Promise<void> {
    this.timers.forEach(clearInterval);
    this.timers = [];
    for (const lab of this.labs.values()) await lab.adapter.close();
  }

  onSnapshot(listener: (s: LabSnapshot) => void): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  onEvent(listener: (labId: string, e: EventEntry) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }
}
