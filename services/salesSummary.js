import prisma from '../config/prismaClient.js';
import { getTenantId } from '../config/tenantContext.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';

// Buckets a moment into the location's own calendar day rather than UTC, so
// a late-night sale lands on the day staff actually experienced it. Stored
// as a UTC-midnight Date representing that calendar day — the column is
// DATE-typed, so time-of-day is dropped regardless; this just avoids
// server-local-time Date parsing shifting which day it lands on.
function getLocalDateKey(when, timeZone) {
  const dateString = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(when);
  return new Date(`${dateString}T00:00:00.000Z`);
}

// DailySalesSummary's unique key is a 3-column compound (tenantId,
// locationId, date), which — unlike a plain tenantId filter — the
// tenant-scoping extension can't complete on its own, since Prisma requires
// every field of a compound unique spelled out in that nested object. Read
// explicitly from ALS instead, same reasoning as payment.js.
async function applySalesForOrder(tx, { locationId, timezone, subtotal, discountTotal, taxTotal, total, itemCount }) {
  const tenantId = getTenantId();
  const date = getLocalDateKey(new Date(), timezone);

  await tx.dailySalesSummary.upsert({
    where: { tenantId_locationId_date: { tenantId, locationId, date } },
    create: {
      tenantId,
      locationId,
      date,
      orderCount: 1,
      itemCount,
      subtotal,
      discountTotal,
      taxTotal,
      total,
      netTotal: total,
    },
    update: {
      orderCount: { increment: 1 },
      itemCount: { increment: itemCount },
      subtotal: { increment: subtotal },
      discountTotal: { increment: discountTotal },
      taxTotal: { increment: taxTotal },
      total: { increment: total },
      netTotal: { increment: total },
    },
  });
}

// Booked against the day the refund happened, not the original sale date —
// a closed day's summary never changes after the fact, and "today's net"
// reflects today's actual cash movement.
async function applyRefundForOrder(tx, { locationId, timezone, refundAmount }) {
  const tenantId = getTenantId();
  const date = getLocalDateKey(new Date(), timezone);

  await tx.dailySalesSummary.upsert({
    where: { tenantId_locationId_date: { tenantId, locationId, date } },
    create: {
      tenantId,
      locationId,
      date,
      refundTotal: refundAmount,
      netTotal: -refundAmount,
    },
    update: {
      refundTotal: { increment: refundAmount },
      netTotal: { decrement: refundAmount },
    },
  });
}

function buildRangeWhere({ locationId, dateFrom, dateTo }) {
  return {
    ...(locationId ? { locationId } : {}),
    ...(dateFrom || dateTo ? { date: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
  };
}

async function listSummaries({ locationId, dateFrom, dateTo, page, limit }) {
  const where = buildRangeWhere({ locationId, dateFrom, dateTo });

  const [total, summaries] = await prisma.$transaction([
    prisma.dailySalesSummary.count({ where }),
    prisma.dailySalesSummary.findMany({
      where,
      orderBy: { date: 'desc' },
      ...getPagination({ page, limit }),
      include: { location: { select: { id: true, name: true } } },
    }),
  ]);

  return { data: summaries, pagination: buildPaginationMeta({ page, limit, total }) };
}

// Sums the whole matching range into one object — the "total sales this
// month" dashboard need, as opposed to listSummaries' day-by-day rows.
async function getTotals({ locationId, dateFrom, dateTo }) {
  const where = buildRangeWhere({ locationId, dateFrom, dateTo });

  const result = await prisma.dailySalesSummary.aggregate({
    where,
    _sum: {
      orderCount: true,
      itemCount: true,
      subtotal: true,
      discountTotal: true,
      taxTotal: true,
      total: true,
      refundTotal: true,
      netTotal: true,
    },
  });

  return {
    orderCount: result._sum.orderCount ?? 0,
    itemCount: result._sum.itemCount ?? 0,
    subtotal: result._sum.subtotal ?? 0,
    discountTotal: result._sum.discountTotal ?? 0,
    taxTotal: result._sum.taxTotal ?? 0,
    total: result._sum.total ?? 0,
    refundTotal: result._sum.refundTotal ?? 0,
    netTotal: result._sum.netTotal ?? 0,
  };
}

export default { applySalesForOrder, applyRefundForOrder, listSummaries, getTotals };
