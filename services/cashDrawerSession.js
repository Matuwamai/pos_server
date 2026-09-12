import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import locationService from './location.js';
import terminalService from './terminal.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';

// tenantId is never passed explicitly — the tenant-scoping Prisma extension
// injects it from the request context, same as location.service.js.

async function openSession({ locationId, terminalId, openingFloat }, openedByUserId) {
  await locationService.getLocationById(locationId); // 404s if missing or belongs to another tenant

  if (terminalId) {
    const terminal = await terminalService.getTerminalById(terminalId); // 404s if missing/foreign tenant
    if (terminal.locationId !== locationId) {
      throw ApiError.badRequest('This terminal does not belong to the specified location');
    }
    if (!terminal.isActive) {
      throw ApiError.conflict('This terminal is inactive');
    }

    const alreadyOpen = await prisma.cashDrawerSession.findFirst({
      where: { terminalId, status: 'OPEN' },
    });
    if (alreadyOpen) {
      throw ApiError.conflict('This terminal already has an open cash drawer session');
    }
  } else {
    // No terminal specified — still guard against opening two untracked
    // sessions on the same location at once.
    const alreadyOpen = await prisma.cashDrawerSession.findFirst({
      where: { locationId, terminalId: null, status: 'OPEN' },
    });
    if (alreadyOpen) {
      throw ApiError.conflict('This location already has an open cash drawer session');
    }
  }

  return prisma.cashDrawerSession.create({
    data: { locationId, terminalId, openedByUserId, openingFloat },
  });
}

async function getSessionById(id) {
  const session = await prisma.cashDrawerSession.findUnique({ where: { id } });
  if (!session) throw ApiError.notFound('Cash drawer session not found');
  return session;
}

async function listSessions({ locationId, terminalId, status, page, limit }) {
  const where = {
    ...(locationId ? { locationId } : {}),
    ...(terminalId ? { terminalId } : {}),
    ...(status ? { status } : {}),
  };

  const [total, sessions] = await prisma.$transaction([
    prisma.cashDrawerSession.count({ where }),
    prisma.cashDrawerSession.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      ...getPagination({ page, limit }),
    }),
  ]);

  return {
    data: sessions,
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

// Sums CASH payments recorded against orders rung up under this session.
// Payment has no tenantId of its own (see schema), so this isn't
// auto-scoped by the tenant extension — but session.id was already
// resolved through getSessionById, which IS tenant-scoped, so restricting
// to this one session's orders is sufficient on its own.
// Returns openingFloat (i.e. zero net sales) until the orders/payments
// business logic exists, and becomes accurate automatically once it does —
// nothing here will need to change when that ships.
async function computeExpectedCash(session) {
  const result = await prisma.payment.aggregate({
    where: { method: 'CASH', order: { cashDrawerSessionId: session.id } },
    _sum: { amount: true },
  });
  const cashTotal = Number(result._sum.amount ?? 0);
  return Number(session.openingFloat) + cashTotal;
}

async function closeSession(id, closingCash, actingUser) {
  const session = await getSessionById(id);
  if (session.status === 'CLOSED') {
    throw ApiError.conflict('This cash drawer session is already closed');
  }
  if (actingUser.role === 'CASHIER' && actingUser.id !== session.openedByUserId) {
    throw ApiError.forbidden('Only the cashier who opened this session, or a manager, can close it');
  }

  const expectedCash = await computeExpectedCash(session);
  const difference = closingCash - expectedCash;

  return prisma.cashDrawerSession.update({
    where: { id },
    data: {
      closingCash,
      expectedCash,
      difference,
      status: 'CLOSED',
      closedAt: new Date(),
    },
  });
}

export default { openSession, getSessionById, listSessions, closeSession };
