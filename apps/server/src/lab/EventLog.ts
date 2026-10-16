import type { EventEntry } from '@gol/shared';

/** Ring buffer ของ Event (เก็บล่าสุด capacity รายการ) */
export class EventLog {
  private entries: EventEntry[] = [];
  private nextId = 1;
  private listeners = new Set<(e: EventEntry) => void>();

  constructor(private readonly capacity = 500) {}

  add(e: Omit<EventEntry, 'id'>): EventEntry {
    const entry: EventEntry = { id: this.nextId++, ...e };
    this.entries.push(entry);
    if (this.entries.length > this.capacity) this.entries.splice(0, this.entries.length - this.capacity);
    for (const l of this.listeners) l(entry);
    return entry;
  }

  /** รายการล่าสุด (เก่า → ใหม่) */
  list(limit = this.capacity): EventEntry[] {
    return this.entries.slice(-limit);
  }

  clear(): void {
    this.entries = [];
  }

  onEvent(listener: (e: EventEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
