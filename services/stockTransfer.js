import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import locationService from './location.js';
import inventoryService from './inventory.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';

const transferInclude = {
  fromLocation: { select: { id: true, name: true } },
  toLocation: { select: { id: true, name: true } },
  initiatedBy: { select: { id: true, name: true } },
  items: { include: { variant: { select: { id: true, sku: true, product: { select: { id: true, name: true } } } } } },
};

async function assertReferencesBelongToTenant({ fromLocationId, toLocationId, items }) {
  if (fromLocationId) await locationService.getLocationById(fromLocationId); // 404s if missing/foreign tenant
  if (toLocationId) await locationService.getLocationById(toLocationId);
  if (items) {
    for (const item of items) {
      const variant = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
      if (!variant) throw ApiError.notFound(`Variant ${item.variantId} not found`);
    }
  }
}

async function createStockTransfer(initiatedById, { fromLocationId, toLocationId, items }) {
  await assertReferencesBelongToTenant({ fromLocationId, toLocationId, items });

  const transferId = await prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.create({ data: { fromLocationId, toLocationId, initiatedById } });
    await tx.stockTransferItem.createMany({
      data: items.map((item) => ({ stockTransferId: transfer.id, variantId: item.variantId, quantity: item.quantity })),
    });
    return transfer.id;
  });

  return getStockTransferById(transferId);
}

async function listStockTransfers({ fromLocationId, toLocationId, status, page, limit }) {
  const where = {
    ...(fromLocationId ? { fromLocationId } : {}),
    ...(toLocationId ? { toLocationId } : {}),
    ...(status ? { status } : {}),
  };

  const [total, transfers] = await prisma.$transaction([
    prisma.stockTransfer.count({ where }),
    prisma.stockTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...getPagination({ page, limit }),
      include: transferInclude,
    }),
  ]);

  return { data: transfers, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getStockTransferById(id) {
  const transfer = await prisma.stockTransfer.findUnique({ where: { id }, include: transferInclude });
  if (!transfer) throw ApiError.notFound('Stock transfer not found');
  return transfer;
}

async function markInTransit(id) {
  const transfer = await getStockTransferById(id);
  if (transfer.status !== 'PENDING') {
    throw ApiError.conflict('Only a pending transfer can be marked in transit');
  }

  await prisma.$transaction(async (tx) => {
    for (const item of transfer.items) {
      await inventoryService.applyInventoryChange(tx, {
        variantId: item.variantId,
        locationId: transfer.fromLocationId,
        changeQty: -Number(item.quantity),
        reason: 'transfer_out',
        referenceId: transfer.id,
      });
    }
    await tx.stockTransfer.update({ where: { id }, data: { status: 'IN_TRANSIT' } });
  });

  return getStockTransferById(id);
}

async function completeTransfer(id) {
  const transfer = await getStockTransferById(id);
  if (transfer.status !== 'IN_TRANSIT') {
    throw ApiError.conflict('Only a transfer that is in transit can be completed');
  }

  await prisma.$transaction(async (tx) => {
    for (const item of transfer.items) {
      await inventoryService.applyInventoryChange(tx, {
        variantId: item.variantId,
        locationId: transfer.toLocationId,
        changeQty: Number(item.quantity),
        reason: 'transfer_in',
        referenceId: transfer.id,
        allowNegative: true, // receiving stock in only ever increases it
      });
    }
    await tx.stockTransfer.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
  });

  return getStockTransferById(id);
}

async function cancelStockTransfer(id) {
  const transfer = await getStockTransferById(id);
  if (transfer.status === 'COMPLETED') {
    throw ApiError.conflict('A completed transfer cannot be cancelled');
  }
  if (transfer.status === 'CANCELLED') {
    throw ApiError.conflict('This transfer is already cancelled');
  }

  await prisma.$transaction(async (tx) => {
    // Stock already left the source once IN_TRANSIT — cancelling has to put
    // it back. Logged as 'adjustment' (not 'transfer_out' again) since this
    // is a correction, not a second movement.
    if (transfer.status === 'IN_TRANSIT') {
      for (const item of transfer.items) {
        await inventoryService.applyInventoryChange(tx, {
          variantId: item.variantId,
          locationId: transfer.fromLocationId,
          changeQty: Number(item.quantity),
          reason: 'adjustment',
          referenceId: transfer.id,
          allowNegative: true,
        });
      }
    }
    await tx.stockTransfer.update({ where: { id }, data: { status: 'CANCELLED' } });
  });

  return getStockTransferById(id);
}

export default {
  createStockTransfer,
  listStockTransfers,
  getStockTransferById,
  markInTransit,
  completeTransfer,
  cancelStockTransfer,
};
