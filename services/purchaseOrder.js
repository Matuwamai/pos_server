import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import supplierService from './supplier.js';
import locationService from './location.js';
import inventoryService from './inventory.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';

const poInclude = {
  supplier: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: { include: { variant: { select: { id: true, sku: true, product: { select: { id: true, name: true } } } } } },
};

function computeTotalCost(items) {
  return items.reduce((sum, item) => sum + item.quantityOrdered * item.unitCost, 0);
}

async function assertReferencesBelongToTenant({ supplierId, locationId, items }) {
  if (supplierId) await supplierService.getSupplierById(supplierId); // 404s if missing/foreign tenant
  if (locationId) await locationService.getLocationById(locationId);
  if (items) {
    for (const item of items) {
      const variant = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
      if (!variant) throw ApiError.notFound(`Variant ${item.variantId} not found`);
    }
  }
}

async function createPurchaseOrder(createdById, { supplierId, locationId, expectedAt, items }) {
  await assertReferencesBelongToTenant({ supplierId, locationId, items });

  const poId = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.create({
      data: { supplierId, locationId, createdById, expectedAt, totalCost: computeTotalCost(items) },
    });
    await tx.purchaseOrderItem.createMany({
      data: items.map((item) => ({
        purchaseOrderId: po.id,
        variantId: item.variantId,
        quantityOrdered: item.quantityOrdered,
        unitCost: item.unitCost,
      })),
    });
    return po.id;
  });

  return getPurchaseOrderById(poId);
}

async function listPurchaseOrders({ supplierId, locationId, status, page, limit }) {
  const where = {
    ...(supplierId ? { supplierId } : {}),
    ...(locationId ? { locationId } : {}),
    ...(status ? { status } : {}),
  };

  const [total, orders] = await prisma.$transaction([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...getPagination({ page, limit }),
      include: poInclude,
    }),
  ]);

  return { data: orders, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getPurchaseOrderById(id) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: poInclude });
  if (!po) throw ApiError.notFound('Purchase order not found');
  return po;
}

async function getPurchaseOrderRaw(id) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw ApiError.notFound('Purchase order not found');
  return po;
}

async function updatePurchaseOrder(id, updates) {
  const po = await getPurchaseOrderRaw(id);
  if (po.status !== 'DRAFT') {
    throw ApiError.conflict('Only a draft purchase order can be edited');
  }
  await assertReferencesBelongToTenant(updates);

  const { items, ...fields } = updates;

  await prisma.$transaction(async (tx) => {
    if (items) {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await tx.purchaseOrderItem.createMany({
        data: items.map((item) => ({
          purchaseOrderId: id,
          variantId: item.variantId,
          quantityOrdered: item.quantityOrdered,
          unitCost: item.unitCost,
        })),
      });
    }
    await tx.purchaseOrder.update({
      where: { id },
      data: { ...fields, ...(items ? { totalCost: computeTotalCost(items) } : {}) },
    });
  });

  return getPurchaseOrderById(id);
}

async function markOrdered(id) {
  const po = await getPurchaseOrderRaw(id);
  if (po.status !== 'DRAFT') {
    throw ApiError.conflict('Only a draft purchase order can be marked as ordered');
  }
  await prisma.purchaseOrder.update({ where: { id }, data: { status: 'ORDERED', orderedAt: new Date() } });
  return getPurchaseOrderById(id);
}

async function receiveItems(id, receivedItems) {
  const po = await getPurchaseOrderById(id);
  if (!['ORDERED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
    throw ApiError.conflict('This purchase order is not open to receive stock against');
  }

  await prisma.$transaction(async (tx) => {
    for (const { purchaseOrderItemId, quantityReceived } of receivedItems) {
      const poItem = po.items.find((item) => item.id === purchaseOrderItemId);
      if (!poItem) throw ApiError.notFound(`Purchase order item ${purchaseOrderItemId} not found on this order`);

      const newReceivedTotal = Number(poItem.quantityReceived) + quantityReceived;
      if (newReceivedTotal > Number(poItem.quantityOrdered)) {
        throw ApiError.badRequest(
          `Cannot receive ${quantityReceived} of variant ${poItem.variantId}: only ${Number(poItem.quantityOrdered) - Number(poItem.quantityReceived)} remain outstanding`
        );
      }

      await tx.purchaseOrderItem.update({
        where: { id: purchaseOrderItemId },
        data: { quantityReceived: { increment: quantityReceived } },
      });
      await inventoryService.applyInventoryChange(tx, {
        variantId: poItem.variantId,
        locationId: po.locationId,
        changeQty: quantityReceived,
        reason: 'purchase_order',
        referenceId: po.id,
        allowNegative: true, // receiving only ever increases stock
      });
    }

    const refreshedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: id } });
    const fullyReceived = refreshedItems.every((item) => Number(item.quantityReceived) >= Number(item.quantityOrdered));
    await tx.purchaseOrder.update({
      where: { id },
      data: fullyReceived
        ? { status: 'RECEIVED', receivedAt: new Date() }
        : { status: 'PARTIALLY_RECEIVED' },
    });
  });

  return getPurchaseOrderById(id);
}

async function cancelPurchaseOrder(id) {
  const po = await getPurchaseOrderRaw(id);
  if (po.status === 'RECEIVED') {
    throw ApiError.conflict('A fully received purchase order cannot be cancelled');
  }
  if (po.status === 'CANCELLED') {
    throw ApiError.conflict('This purchase order is already cancelled');
  }
  await prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
  return getPurchaseOrderById(id);
}

export default {
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  markOrdered,
  receiveItems,
  cancelPurchaseOrder,
};
