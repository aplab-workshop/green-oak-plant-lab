import type { Database } from './db';

/**
 * Migration ของฐานข้อมูลบัญชี (W1 / SPEC § 4.38) — เพิ่มเวอร์ชันใหม่ต่อท้ายเท่านั้น ห้ามแก้เวอร์ชันที่ใช้แล้ว
 */
export const MIGRATIONS: readonly { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: 'accounts, scores, run logs',
    sql: `
      CREATE TABLE invite_codes (
        code        TEXT PRIMARY KEY,
        max_uses    INTEGER NOT NULL CHECK (max_uses > 0),
        used_count  INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0 AND used_count <= max_uses),
        active      BOOLEAN NOT NULL DEFAULT TRUE,
        note        TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE players (
        id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        username       TEXT NOT NULL UNIQUE,
        password_hash  TEXT NOT NULL,
        invite_code    TEXT NOT NULL REFERENCES invite_codes(code),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_login_at  TIMESTAMPTZ
      );
      CREATE INDEX players_invite_code ON players (invite_code);
      CREATE TABLE scores (
        id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        player_id      INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        run_id         TEXT NOT NULL,
        level_id       TEXT NOT NULL,
        status         TEXT NOT NULL CHECK (status IN ('won', 'lost')),
        score          INTEGER NOT NULL,
        stars          INTEGER NOT NULL CHECK (stars BETWEEN 0 AND 3),
        biomass_g      DOUBLE PRECISION NOT NULL,
        sim_seconds    INTEGER NOT NULL,
        real_seconds   INTEGER NOT NULL,
        game_version   TEXT NOT NULL,
        ranked         BOOLEAN NOT NULL,
        reject_reason  TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (player_id, run_id)
      );
      CREATE INDEX scores_level ON scores (level_id, ranked, score DESC);
      CREATE TABLE run_logs (
        id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        run_id      TEXT NOT NULL,
        level_id    TEXT NOT NULL,
        events      JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (player_id, run_id)
      );
    `,
  },
];

/** สร้าง/อัปเดตตาราง — รันซ้ำได้ (ข้ามเวอร์ชันที่ทำแล้ว) คืนเวอร์ชันที่เพิ่งรัน */
export async function migrate(db: Database): Promise<number[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const { rows } = await db.query<{ version: number }>('SELECT version FROM schema_migrations');
  const done = new Set(rows.map((r) => r.version));
  const applied: number[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [m.version, m.name]);
    });
    applied.push(m.version);
  }
  return applied;
}
