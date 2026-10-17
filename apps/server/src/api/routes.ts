import type { FastifyInstance, FastifyReply } from 'fastify';
import { LabCommand } from '@gol/shared';
import { SERVER_VERSION } from '../version';
import { LabCommandError, type LabSession } from '../lab/LabSession';
import { SCENARIOS } from '../scenarios/scenarios';

const startedAt = Date.now();

type LabParams = { Params: { labId: string } };

export function registerRoutes(app: FastifyInstance): void {
  const findLab = (labId: string, reply: FastifyReply): LabSession | undefined => {
    const lab = app.labs.get(labId);
    if (!lab) void reply.code(404).send({ error: `ไม่พบ Lab ${labId}` });
    return lab;
  };

  app.get('/api/health', async () => ({
    status: 'ok',
    version: SERVER_VERSION,
    uptimeS: Math.round((Date.now() - startedAt) / 1000),
    serverTime: Date.now(),
  }));

  app.get('/api/labs', async () =>
    [...app.labs.labs.values()].map((lab) => {
      const s = lab.snapshot();
      return {
        labId: s.labId,
        plc: s.plc,
        failsafe: s.failsafe,
        sim: s.sim,
        speed: s.speed,
        paused: s.paused,
        waterLevelPct: s.tank.waterLevelPct,
        avgHealth: s.plants.reduce((sum, p) => sum + p.health, 0) / Math.max(1, s.plants.length),
        scenario: s.scenario?.id ?? null,
      };
    }),
  );

  app.get('/api/scenarios', async () => SCENARIOS.map(({ id, title, objective, description }) => ({ id, title, objective, description })));

  app.get<LabParams>('/api/labs/:labId', async (req, reply) => findLab(req.params.labId, reply)?.snapshot());

  app.get<LabParams>('/api/labs/:labId/history', async (req, reply) => {
    const lab = findLab(req.params.labId, reply);
    if (!lab) return;
    reply.header('X-Lab-Run-Id', lab.events.runId);
    return lab.history.list();
  });

  app.get<LabParams & { Querystring: { limit?: string } }>('/api/labs/:labId/events', async (req, reply) => {
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit ?? 1000) || 1000));
    const lab = findLab(req.params.labId, reply);
    if (!lab) return;
    reply.header('X-Lab-Run-Id', lab.events.runId);
    return lab.events.list(limit);
  });

  app.post<LabParams>('/api/labs/:labId/commands', async (req, reply) => {
    const lab = findLab(req.params.labId, reply);
    if (!lab) return;
    const parsed = LabCommand.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'คำสั่งไม่ถูกต้อง', issues: parsed.error.issues });
    }
    try {
      await lab.handle(parsed.data);
    } catch (err) {
      if (err instanceof LabCommandError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
    return lab.snapshot();
  });
}
