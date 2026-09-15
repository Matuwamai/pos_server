import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import customerService from './customer.js';
import locationService from './location.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';

const invoiceInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  location: { select: { id: true, name: true, address: true } },
  createdBy: { select: { id: true, name: true } },
  items: { include: { variant: { select: { id: true, sku: true, product: { select: { id: true, name: true } } } } } },
  payments: { orderBy: { createdAt: 'asc' } },
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function priceItem({ description, quantity, unitPrice, taxAmount }) {
  const lineTotal = round2(quantity * unitPrice + (taxAmount || 0));
  return { description, quantity, unitPrice, taxAmount: taxAmount || 0, lineTotal };
}

function computeTotals(pricedItems, discountTotal) {
  const subtotal = round2(pricedItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0));
  const taxTotal = round2(pricedItems.reduce((sum, i) => sum + i.taxAmount, 0));
  const total = round2(subtotal - discountTotal + taxTotal);
  if (total < 0) {
    throw ApiError.badRequest('Discount cannot exceed the invoice subtotal plus tax');
  }
  return { subtotal, taxTotal, total };
}

async function validateItemVariants(items) {
  for (const item of items) {
    if (item.variantId) {
      const variant = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
      if (!variant) throw ApiError.notFound(`Variant ${item.variantId} not found`);
    }
  }
}

async function createInvoice(actingUser, { customerId, orderId, locationId, dueDate, discountTotal, notes, items }) {
  await customerService.getCustomerById(customerId); // 404s if missing/foreign tenant
  if (locationId) {
    await locationService.getLocationById(locationId); // 404s if missing/foreign tenant
  }
  if (orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Order not found');
  }
  await validateItemVariants(items);

  const pricedItems = items.map(priceItem);
  const { subtotal, taxTotal, total } = computeTotals(pricedItems, discountTotal);

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        customerId,
        orderId,
        locationId,
        createdById: actingUser.id,
        dueDate,
        discountTotal,
        notes,
        subtotal,
        taxTotal,
        total,
        status: 'DRAFT',
      },
    });

    await tx.invoiceItem.createMany({
      data: pricedItems.map((item) => ({ invoiceId: created.id, ...item })),
    });

    return created;
  });

  return getInvoiceById(invoice.id);
}

async function listInvoices({ customerId, status, overdue, page, limit }) {
  const where = {
    ...(customerId ? { customerId } : {}),
    ...(status ? { status } : {}),
    ...(overdue ? { status: { in: ['SENT', 'PARTIALLY_PAID'] }, dueDate: { lt: new Date() } } : {}),
  };

  const [total, invoices] = await prisma.$transaction([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({ where, orderBy: { createdAt: 'desc' }, ...getPagination({ page, limit }), include: invoiceInclude }),
  ]);

  return { data: invoices, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getInvoiceById(id) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice) throw ApiError.notFound('Invoice not found');
  return invoice;
}

function assertDraft(invoice) {
  if (invoice.status !== 'DRAFT') {
    throw ApiError.conflict('Only a draft invoice can be edited');
  }
}

async function updateInvoice(id, updates) {
  const invoice = await getInvoiceById(id);
  assertDraft(invoice);

  if (updates.customerId) {
    await customerService.getCustomerById(updates.customerId);
  }
  if (updates.locationId) {
    await locationService.getLocationById(updates.locationId);
  }

  const { items, discountTotal, ...rest } = updates;
  const effectiveDiscountTotal = discountTotal !== undefined ? discountTotal : Number(invoice.discountTotal);

  return prisma.$transaction(async (tx) => {
    if (items) {
      await validateItemVariants(items);
      const pricedItems = items.map(priceItem);
      const { subtotal, taxTotal, total } = computeTotals(pricedItems, effectiveDiscountTotal);

      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceItem.createMany({ data: pricedItems.map((item) => ({ invoiceId: id, ...item })) });

      return tx.invoice.update({
        where: { id },
        data: { ...rest, discountTotal: effectiveDiscountTotal, subtotal, taxTotal, total },
        include: invoiceInclude,
      });
    }

    if (discountTotal !== undefined) {
      const currentItems = await tx.invoiceItem.findMany({ where: { invoiceId: id } });
      const { subtotal, taxTotal, total } = computeTotals(
        currentItems.map((i) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), taxAmount: Number(i.taxAmount) })),
        discountTotal
      );
      return tx.invoice.update({ where: { id }, data: { ...rest, discountTotal, subtotal, taxTotal, total }, include: invoiceInclude });
    }

    return tx.invoice.update({ where: { id }, data: rest, include: invoiceInclude });
  });
}

async function issueInvoice(id) {
  const invoice = await getInvoiceById(id);
  if (invoice.status !== 'DRAFT') {
    throw ApiError.conflict('Only a draft invoice can be issued');
  }
  return prisma.invoice.update({ where: { id }, data: { status: 'SENT', issueDate: new Date() }, include: invoiceInclude });
}

async function recordPayment(actingUser, id, { method, amount, reference }) {
  const invoice = await getInvoiceById(id);
  if (!['SENT', 'PARTIALLY_PAID'].includes(invoice.status)) {
    throw ApiError.conflict('Payments can only be recorded against an issued, unpaid invoice');
  }

  const balanceDue = round2(Number(invoice.total) - Number(invoice.amountPaid));
  if (amount > balanceDue) {
    throw ApiError.badRequest(`Payment (${amount}) exceeds the outstanding balance (${balanceDue})`);
  }

  return prisma.$transaction(async (tx) => {
    await tx.invoicePayment.create({ data: { invoiceId: id, method, amount, reference, recordedById: actingUser.id } });

    const amountPaid = round2(Number(invoice.amountPaid) + amount);
    const status = amountPaid >= Number(invoice.total) ? 'PAID' : 'PARTIALLY_PAID';

    return tx.invoice.update({ where: { id }, data: { amountPaid, status }, include: invoiceInclude });
  });
}

async function voidInvoice(id, reason) {
  const invoice = await getInvoiceById(id);
  if (invoice.status === 'VOID') {
    throw ApiError.conflict('Invoice is already void');
  }
  if (invoice.status === 'PAID') {
    throw ApiError.conflict('A fully paid invoice cannot be voided');
  }

  return prisma.invoice.update({
    where: { id },
    data: { status: 'VOID', voidReason: reason, voidedAt: new Date() },
    include: invoiceInclude,
  });
}

export default { createInvoice, listInvoices, getInvoiceById, updateInvoice, issueInvoice, recordPayment, voidInvoice };
