import prisma from '../config/prismaClient.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';

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
