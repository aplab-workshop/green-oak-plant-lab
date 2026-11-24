/**
 * ชั้นฐานข้อมูลของระบบบัญชี (W1 / SPEC § 4.38) — PostgreSQL อย่างเดียว
 * - Cloud: Neon ผ่าน `pg` (DATABASE_URL = postgres://…)
 * - ในเครื่อง/เทสต์: PGlite (Postgres แบบ WASM) — SQL ชุดเดียวกัน
 * โหลดไลบรารีแบบ dynamic import เพื่อไม่ให้ส่วนอื่นของ Server (และ Demo build) ต้องโหลดตาม
 */

export interface Sql {
  /** คำสั่งเดียว ใช้ $1, $2 … เป็นพารามิเตอร์ */
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** หลายคำสั่งในข้อความเดียว (ไม่มีพารามิเตอร์) — ใช้กับ Migration */
  exec(text: string): Promise<void>;
}

export interface Database extends Sql {
  readonly kind: 'pglite' | 'postgres';
  /** โยน Error ใน fn = ROLLBACK ทั้งหมด */
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function isPostgresUrl(url: string): boolean {
  return /^postgres(ql)?:\/\//i.test(url);
}

/** `postgres://…` = Server จริง, `memory://` = PGlite ในหน่วยความจำ, อย่างอื่น = โฟลเดอร์ข้อมูล PGlite */
export async function openDatabase(url: string): Promise<Database> {
  return isPostgresUrl(url) ? openPostgres(url) : openPglite(url);
}

async function openPglite(dataDir: string): Promise<Database> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = await PGlite.create(dataDir === 'memory://' ? undefined : dataDir);
  const wrap = (q: Pick<typeof db, 'query' | 'exec'>): Sql => ({
    query: async <T>(text: string, params?: unknown[]) => ({ rows: (await q.query<T>(text, params)).rows }),
    exec: async (text) => {
      await q.exec(text);
    },
  });
  return {
    kind: 'pglite',
    ...wrap(db),
    transaction: (fn) => db.transaction((tx) => fn(wrap(tx))),
    close: () => db.close(),
  };
}

async function openPostgres(url: string): Promise<Database> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  const query = async <T>(text: string, params?: unknown[]) => ({ rows: (await pool.query(text, params)).rows as T[] });
  return {
    kind: 'postgres',
    query,
    exec: async (text) => {
      await pool.query(text);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({
          query: async <T>(text: string, params?: unknown[]) => ({ rows: (await client.query(text, params)).rows as T[] }),
          exec: async (text) => {
            await client.query(text);
          },
        });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
