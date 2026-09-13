import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

const itemInclude = {
  variant: { select: { id: true, sku: true, barcode: true, product: { select: { id: true, name: true } } } },
  location: { select: { id: true, name: true } },
};

// The single place every stock-affecting operation in the system goes
// through — manual adjustments, purchase order receiving, stock transfers.
// Writes the append-only InventoryLog entry and updates the InventoryItem
// snapshot in the same transaction, so the two can never drift apart.
// `increment` (not a read-then-set) keeps the actual write atomic under
// concurrent calls; the negative-stock guard is a best-effort check against
// the last-read quantity, not a hard row lock — acceptable for a single
// till/location's normal transaction volume, not bulletproof under heavy
// concurrent writes to the same row.
async function applyInventoryChange(tx, { variantId, locationId, changeQty, reason, referenceId, allowNegative = false }) {
  const item = await tx.inventoryItem.findUnique({ where: { variantId_locationId: { variantId, locationId } } });
  if (!item) {
    throw ApiError.conflict('This variant is not tracked at this location (trackInventory may be off, or it has never been stocked there)');
  }
  if (!allowNegative && Number(item.quantity) + changeQty < 0) {
    throw ApiError.conflict(`Insufficient stock: only ${item.quantity} on hand`);
  }

  await tx.inventoryLog.create({ data: { variantId, locationId, changeQty, reason, referenceId } });
  return tx.inventoryItem.update({
    where: { variantId_locationId: { variantId, locationId } },
    data: { quantity: { increment: changeQty } },
  });
}

async function adjustInventory({ variantId, locationId, changeQty, reason }) {
  return prisma.$transaction((tx) => applyInventoryChange(tx, { variantId, locationId, changeQty, reason }));
}

async function listInventory({ search, locationId, variantId, lowStockOnly, page, limit }) {
  const where = {
    ...(locationId ? { locationId } : {}),
    ...(variantId ? { variantId } : {}),
    ...(search
      ? { variant: { OR: [{ sku: { contains: search } }, { product: { name: { contains: search } } }] } }
      : {}),
  };

  // A "quantity <= lowStockThreshold" filter compares two columns, which
  // Prisma's `where` can't express directly (short of $queryRaw, which
  // would bypass the tenant-scoping extension entirely). Since a single
  // tenant's inventory rows are a modest, bounded set, it's fetched in full
  // and filtered/paginated in memory for this one case rather than reaching
  // for raw SQL.
  if (lowStockOnly) {
    const all = await prisma.inventoryItem.findMany({ where, include: itemInclude, orderBy: { updatedAt: 'desc' } });
    const filtered = all.filter((item) => item.lowStockThreshold !== null && Number(item.quantity) <= Number(item.lowStockThreshold));
    const { skip, take } = getPagination({ page, limit });
    return { data: filtered.slice(skip, skip + take), pagination: buildPaginationMeta({ page, limit, total: filtered.length }) };
  }

  const [total, items] = await prisma.$transaction([
    prisma.inventoryItem.count({ where }),
    prisma.inventoryItem.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      ...getPagination({ page, limit }),
      include: itemInclude,
    }),
  ]);

  return { data: items, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getInventoryItemById(id) {
  const item = await prisma.inventoryItem.findUnique({ where: { id }, include: itemInclude });
  if (!item) throw ApiError.notFound('Inventory item not found');
  return item;
}

async function updateLowStockThreshold(id, lowStockThreshold) {
  await getInventoryItemById(id); // ensures it exists (and belongs to this tenant), 404s otherwise
  return prisma.inventoryItem.update({ where: { id }, data: { lowStockThreshold } });
}

async function listInventoryLogs({ variantId, locationId, reason, page, limit }) {
  const where = {
    ...(variantId ? { variantId } : {}),
    ...(locationId ? { locationId } : {}),
    ...(reason ? { reason } : {}),
  };

  const [total, logs] = await prisma.$transaction([
    prisma.inventoryLog.count({ where }),
    prisma.inventoryLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...getPagination({ page, limit }),
      include: {
        variant: { select: { id: true, sku: true, product: { select: { id: true, name: true } } } },
        location: { select: { id: true, name: true } },
      },
    }),
  ]);

  return { data: logs, pagination: buildPaginationMeta({ page, limit, total }) };
}

export default {
  applyInventoryChange,
  adjustInventory,
  listInventory,
  getInventoryItemById,
  updateLowStockThreshold,
  listInventoryLogs,
};
