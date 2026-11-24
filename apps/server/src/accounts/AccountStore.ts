import type { Database, Sql } from './db';

/**
 * ที่เก็บข้อมูลบัญชี/คะแนน/Log (W1 / SPEC § 4.38) — ไม่ตรวจรูปแบบ ID/Password/คะแนน (เป็นงานของ API ใน W2/W5)
 */

export interface InviteCode {
  code: string;
  maxUses: number;
  usedCount: number;
  active: boolean;
  note: string | null;
  createdAt: Date;
}

export interface Player {
  id: number;
  username: string;
  inviteCode: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

/** ใช้ตอน Login เท่านั้น — อย่าส่ง passwordHash ออกไปนอก Server */
export interface PlayerWithHash extends Player {
  passwordHash: string;
}

export type RegisterFailure = 'invite_not_found' | 'invite_inactive' | 'invite_full' | 'username_taken';
export type RegisterResult = { ok: true; player: Player } | { ok: false; reason: RegisterFailure };

export interface ScoreInput {
  playerId: number;
  runId: string;
  levelId: string;
  status: 'won' | 'lost';
  score: number;
  stars: number;
  biomassG: number;
  simSeconds: number;
  realSeconds: number;
  gameVersion: string;
  ranked: boolean;
  rejectReason: string | null;
}

export interface ScoreRow extends ScoreInput {
  id: number;
  username: string;
  inviteCode: string;
  createdAt: Date;
}

export interface RunLogInput {
  playerId: number;
  runId: string;
  levelId: string;
  events: unknown[];
}

export interface RunLogRow extends RunLogInput {
  id: number;
  username: string;
  inviteCode: string;
  createdAt: Date;
}

/** จำนวนข้อมูลของรหัสเชิญ (ใช้ก่อน/หลังลบ) */
export interface InviteDataCount {
  players: number;
  scores: number;
  runLogs: number;
}

export interface DatabaseStats {
  invites: number;
  players: number;
  scores: number;
  runLogs: number;
  databaseBytes: number;
}

export interface RunFilter {
  playerId?: number;
  inviteCode?: string;
  levelId?: string;
}

const PLAYER_COLS = 'id, username, invite_code, created_at, last_login_at';

type Row = Record<string, unknown>;

const toInvite = (r: Row): InviteCode => ({
  code: r.code as string,
  maxUses: r.max_uses as number,
  usedCount: r.used_count as number,
  active: r.active as boolean,
  note: (r.note as string | null) ?? null,
  createdAt: r.created_at as Date,
});

const toPlayer = (r: Row): Player => ({
  id: r.id as number,
  username: r.username as string,
  inviteCode: r.invite_code as string,
  createdAt: r.created_at as Date,
  lastLoginAt: (r.last_login_at as Date | null) ?? null,
});

const toScore = (r: Row): ScoreRow => ({
  id: r.id as number,
  playerId: r.player_id as number,
  username: r.username as string,
  inviteCode: r.invite_code as string,
  runId: r.run_id as string,
  levelId: r.level_id as string,
  status: r.status as 'won' | 'lost',
  score: r.score as number,
  stars: r.stars as number,
  biomassG: r.biomass_g as number,
  simSeconds: r.sim_seconds as number,
  realSeconds: r.real_seconds as number,
  gameVersion: r.game_version as string,
  ranked: r.ranked as boolean,
  rejectReason: (r.reject_reason as string | null) ?? null,
  createdAt: r.created_at as Date,
});

const toRunLog = (r: Row): RunLogRow => ({
  id: r.id as number,
  playerId: r.player_id as number,
  username: r.username as string,
  inviteCode: r.invite_code as string,
  runId: r.run_id as string,
  levelId: r.level_id as string,
  events: r.events as unknown[],
  createdAt: r.created_at as Date,
});

/** Postgres unique_violation */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '23505';
}

class RegisterAbort extends Error {
  constructor(readonly reason: RegisterFailure) {
    super(reason);
  }
}

/** WHERE ของตัวกรองรอบ (ตาราง alias r + players p) */
function runWhere(f: RunFilter): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  if (f.playerId !== undefined) parts.push(`r.player_id = $${params.push(f.playerId)}`);
  if (f.inviteCode !== undefined) parts.push(`p.invite_code = $${params.push(f.inviteCode)}`);
  if (f.levelId !== undefined) parts.push(`r.level_id = $${params.push(f.levelId)}`);
  return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

export class AccountStore {
  constructor(private readonly db: Database) {}

  // ---------- รหัสเชิญ ----------

  /** null = มีรหัสนี้แล้ว */
  async createInvite(input: { code: string; maxUses: number; note?: string }): Promise<InviteCode | null> {
    try {
      const { rows } = await this.db.query(
        'INSERT INTO invite_codes (code, max_uses, note) VALUES ($1, $2, $3) RETURNING *',
        [input.code, input.maxUses, input.note ?? null],
      );
      return toInvite(rows[0]!);
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  async getInvite(code: string): Promise<InviteCode | null> {
    const { rows } = await this.db.query('SELECT * FROM invite_codes WHERE code = $1', [code]);
    return rows[0] ? toInvite(rows[0]) : null;
  }

  async listInvites(): Promise<InviteCode[]> {
    const { rows } = await this.db.query('SELECT * FROM invite_codes ORDER BY created_at, code');
    return rows.map(toInvite);
  }

  /** false = ไม่พบรหัส */
  async setInviteActive(code: string, active: boolean): Promise<boolean> {
    const { rows } = await this.db.query('UPDATE invite_codes SET active = $2 WHERE code = $1 RETURNING code', [code, active]);
    return rows.length > 0;
  }

  // ---------- ผู้เล่น ----------

  /**
   * สมัคร = ธุรกรรมเดียว: ใช้สิทธิ์รหัสเชิญแบบ atomic แล้วสร้างผู้เล่น
   * ID ซ้ำ → ROLLBACK ทั้งหมด จึงไม่เสียสิทธิ์รหัส
   */
  async registerPlayer(input: { username: string; passwordHash: string; inviteCode: string }): Promise<RegisterResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const claim = await tx.query(
          `UPDATE invite_codes SET used_count = used_count + 1
           WHERE code = $1 AND active AND used_count < max_uses RETURNING code`,
          [input.inviteCode],
        );
        if (claim.rows.length === 0) throw new RegisterAbort(await inviteFailure(tx, input.inviteCode));
        const { rows } = await tx.query(
          `INSERT INTO players (username, password_hash, invite_code) VALUES ($1, $2, $3) RETURNING ${PLAYER_COLS}`,
          [input.username, input.passwordHash, input.inviteCode],
        );
        return { ok: true as const, player: toPlayer(rows[0]!) };
      });
    } catch (err) {
      if (err instanceof RegisterAbort) return { ok: false, reason: err.reason };
      if (isUniqueViolation(err)) return { ok: false, reason: 'username_taken' };
      throw err;
    }
  }

  async getPlayer(id: number): Promise<Player | null> {
    const { rows } = await this.db.query(`SELECT ${PLAYER_COLS} FROM players WHERE id = $1`, [id]);
    return rows[0] ? toPlayer(rows[0]) : null;
  }

  /** ใช้ตรวจ Token (เทียบลายนิ้วมือ Password) */
  async getPlayerWithHash(id: number): Promise<PlayerWithHash | null> {
    const { rows } = await this.db.query(`SELECT ${PLAYER_COLS}, password_hash FROM players WHERE id = $1`, [id]);
    const r = rows[0];
    return r ? { ...toPlayer(r), passwordHash: r.password_hash as string } : null;
  }

  async getPlayerForLogin(username: string): Promise<PlayerWithHash | null> {
    const { rows } = await this.db.query(`SELECT ${PLAYER_COLS}, password_hash FROM players WHERE username = $1`, [username]);
    const r = rows[0];
    return r ? { ...toPlayer(r), passwordHash: r.password_hash as string } : null;
  }

  async listPlayers(inviteCode?: string): Promise<Player[]> {
    const { rows } = inviteCode === undefined
      ? await this.db.query(`SELECT ${PLAYER_COLS} FROM players ORDER BY id`)
      : await this.db.query(`SELECT ${PLAYER_COLS} FROM players WHERE invite_code = $1 ORDER BY id`, [inviteCode]);
    return rows.map(toPlayer);
  }

  async setPasswordHash(id: number, passwordHash: string): Promise<boolean> {
    const { rows } = await this.db.query('UPDATE players SET password_hash = $2 WHERE id = $1 RETURNING id', [id, passwordHash]);
    return rows.length > 0;
  }

  async touchLogin(id: number): Promise<void> {
    await this.db.query('UPDATE players SET last_login_at = now() WHERE id = $1', [id]);
  }

  /** ลบผู้เล่น — คะแนนและ Log ของผู้เล่นหายตาม (ON DELETE CASCADE) */
  async deletePlayer(id: number): Promise<boolean> {
    const { rows } = await this.db.query('DELETE FROM players WHERE id = $1 RETURNING id', [id]);
    return rows.length > 0;
  }

  async countInviteData(inviteCode: string): Promise<InviteDataCount> {
    const { rows } = await this.db.query<InviteDataCount>(
      `SELECT
         (SELECT count(*)::int FROM players WHERE invite_code = $1) AS players,
         (SELECT count(*)::int FROM scores s JOIN players p ON p.id = s.player_id WHERE p.invite_code = $1) AS scores,
         (SELECT count(*)::int FROM run_logs l JOIN players p ON p.id = l.player_id WHERE p.invite_code = $1) AS "runLogs"`,
      [inviteCode],
    );
    return rows[0]!;
  }

  /**
   * ลบคะแนน + Log ของทุกคนในรหัสเชิญ (เช่น จบเทอม) — withAccounts ลบบัญชีด้วย
   * used_count ของรหัสไม่ลด (นับ "จำนวนครั้งที่สมัคร" ไม่ใช่จำนวนบัญชีที่เหลือ)
   */
  async deleteInviteData(inviteCode: string, withAccounts: boolean): Promise<InviteDataCount> {
    return this.db.transaction(async (tx) => {
      const ids = 'SELECT id FROM players WHERE invite_code = $1';
      const scores = await tx.query(`DELETE FROM scores WHERE player_id IN (${ids}) RETURNING id`, [inviteCode]);
      const logs = await tx.query(`DELETE FROM run_logs WHERE player_id IN (${ids}) RETURNING id`, [inviteCode]);
      const players = withAccounts ? await tx.query('DELETE FROM players WHERE invite_code = $1 RETURNING id', [inviteCode]) : { rows: [] };
      return { players: players.rows.length, scores: scores.rows.length, runLogs: logs.rows.length };
    });
  }

  async stats(): Promise<DatabaseStats> {
    const { rows } = await this.db.query<DatabaseStats>(
      `SELECT
         (SELECT count(*)::int FROM invite_codes) AS invites,
         (SELECT count(*)::int FROM players) AS players,
         (SELECT count(*)::int FROM scores) AS scores,
         (SELECT count(*)::int FROM run_logs) AS "runLogs",
         pg_database_size(current_database())::float8 AS "databaseBytes"`,
    );
    return rows[0]!;
  }

  // ---------- คะแนน / Log ของรอบ ----------

  /** null = ผู้เล่นคนนี้ส่งรอบนี้ไปแล้ว */
  async insertScore(s: ScoreInput): Promise<number | null> {
    try {
      const { rows } = await this.db.query<{ id: number }>(
        `INSERT INTO scores (player_id, run_id, level_id, status, score, stars, biomass_g, sim_seconds, real_seconds, game_version, ranked, reject_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [s.playerId, s.runId, s.levelId, s.status, s.score, s.stars, s.biomassG, s.simSeconds, s.realSeconds, s.gameVersion, s.ranked, s.rejectReason],
      );
      return rows[0]!.id;
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  async listScores(filter: RunFilter = {}): Promise<ScoreRow[]> {
    const w = runWhere(filter);
    const { rows } = await this.db.query(
      `SELECT r.*, p.username, p.invite_code FROM scores r JOIN players p ON p.id = r.player_id ${w.sql} ORDER BY r.created_at, r.id`,
      w.params,
    );
    return rows.map(toScore);
  }

  /** null = ผู้เล่นคนนี้ส่ง Log ของรอบนี้ไปแล้ว */
  async insertRunLog(log: RunLogInput): Promise<number | null> {
    try {
      const { rows } = await this.db.query<{ id: number }>(
        'INSERT INTO run_logs (player_id, run_id, level_id, events) VALUES ($1, $2, $3, $4) RETURNING id',
        [log.playerId, log.runId, log.levelId, JSON.stringify(log.events)],
      );
      return rows[0]!.id;
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  async listRunLogs(filter: RunFilter = {}): Promise<RunLogRow[]> {
    const w = runWhere(filter);
    const { rows } = await this.db.query(
      `SELECT r.*, p.username, p.invite_code FROM run_logs r JOIN players p ON p.id = r.player_id ${w.sql} ORDER BY r.created_at, r.id`,
      w.params,
    );
    return rows.map(toRunLog);
  }
}

/** สาเหตุที่ใช้สิทธิ์รหัสไม่ได้ (เรียกหลัง UPDATE ไม่โดนแถวใด) */
async function inviteFailure(tx: Sql, code: string): Promise<RegisterFailure> {
  const { rows } = await tx.query<{ active: boolean }>('SELECT active FROM invite_codes WHERE code = $1', [code]);
  if (!rows[0]) return 'invite_not_found';
  return rows[0].active ? 'invite_full' : 'invite_inactive';
}
