import prisma from '../config/prismaClient.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';

// Called by other services at the point of a sensitive/corrective action —
// a manual discount, a refund, a balance adjustment — never exposed as
// something a client writes to directly, per the schema's own framing of
// this as a generic trail kept "in addition to" each action's own table.
// Accepts whichever Prisma client the caller is already using (a `tx` or
// the plain client) so the log entry commits atomically with the action
// it's recording rather than as a separate, independent write.
async function recordAuditLog(client, { userId, action, entityType, entityId, metadata }) {
  return client.auditLog.create({ data: { userId, action, entityType, entityId, metadata } });
}

async function listAuditLogs({ entityType, entityId, userId, action, page, limit }) {
  const where = {
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(userId ? { userId } : {}),
    ...(action ? { action } : {}),
  };

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...getPagination({ page, limit }),
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  return { data: logs, pagination: buildPaginationMeta({ page, limit, total }) };
}

export default { recordAuditLog, listAuditLogs };
